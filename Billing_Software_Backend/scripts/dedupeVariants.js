// scripts/dedupeVariants.js
// Merges exact-duplicate ProductVariants (created by repeated Excel imports) into one
// survivor per group: re-points transactions and stock to the survivor, then deletes
// the duplicates. Every change is written to SyncJournal so desktop apps pull it.
//
// Usage:
//   node scripts/dedupeVariants.js --uri "<mongo uri>"            # dry run (default)
//   node scripts/dedupeVariants.js --uri "<mongo uri>" --apply    # make changes
//   options: --out <dir> (report folder, default scripts/output)
'use strict';

const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const URI = getArg('--uri');
const APPLY = args.includes('--apply');
const OUT_DIR = getArg('--out') || path.join(__dirname, 'output');
const BATCH = 500;

// Every place a variant id is stored inside a transaction document.
const REF_SPECS = [
  { collection: 'invoices', syncName: 'invoices', arrays: ['items', 'exchangeOriginalItems'] },
  { collection: 'purchases', syncName: 'purchases', arrays: ['items'] },
  { collection: 'quotations', syncName: 'quotations', arrays: ['items'] },
  { collection: 'debitnotes', syncName: 'debit-notes', arrays: ['items', 'replacementItems'] },
  { collection: 'commissions', syncName: 'commissions', arrays: ['items'] },
];

// Skipped by the "any unknown reference" safety scan (large and never hold variant ids).
const SCAN_SKIP = new Set(['productvariants', 'syncjournals', 'cities', 'states', 'countries']);

const norm = (v) => String(v ?? '').trim().toLowerCase();
const num = (v) => Number(v || 0);

const groupKey = (v) => [
  String(v.productId),
  norm(v.designNo),
  norm(v.size),
  norm(v.color),
  num(v.purchase_price),
  num(v.sale_price),
  num(v.mrp),
  num(v.min_sale_price),
  num(v.reorder_limit),
  num(v.discount_value),
  String(v.barcode ?? '').trim(),
].join('|');

const refQuery = (spec, ids) => ({
  $or: spec.arrays.map((a) => ({ [`${a}.variantId`]: { $in: ids } })),
});

let db;

const journalEntry = (collectionName, operation, doc) => {
  const now = new Date();
  return {
    cursor: new ObjectId().toString(),
    syncId: doc.syncId || String(doc._id),
    operation,
    collectionName,
    payload: doc,
    deviceId: null,
    version: doc.version || 1,
    createdAt: now,
    updatedAt: now,
  };
};

const journal = (collectionName, operation, doc) =>
  db.collection('syncjournals').insertOne(journalEntry(collectionName, operation, doc));

async function analyse() {
  const variants = await db.collection('productvariants').find({}).toArray();
  const groups = new Map();
  for (const v of variants) {
    const k = groupKey(v);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(v);
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  const memberIds = dupGroups.flat().map((v) => v._id);

  // Transaction references per variant
  const refCount = new Map();
  const refDocs = {};
  for (const spec of REF_SPECS) {
    const docs = await db.collection(spec.collection).find(refQuery(spec, memberIds)).toArray();
    refDocs[spec.collection] = docs.length;
    for (const d of docs) {
      for (const a of spec.arrays) {
        for (const item of d[a] || []) {
          if (!item?.variantId) continue;
          const id = String(item.variantId);
          refCount.set(id, (refCount.get(id) || 0) + 1);
        }
      }
    }
  }

  const inventories = await db.collection('inventories').find({ variantId: { $in: memberIds } }).toArray();
  const stockOf = new Map();
  const invRowsOf = new Map();
  for (const inv of inventories) {
    const id = String(inv.variantId);
    stockOf.set(id, (stockOf.get(id) || 0) + num(inv.quantity));
    invRowsOf.set(id, (invRowsOf.get(id) || 0) + 1);
  }

  // Survivor: most used in transactions, then has stock rows, then oldest.
  const mapping = new Map(); // loserId -> survivor doc
  const report = [];
  for (const g of dupGroups) {
    const ranked = [...g].sort((a, b) =>
      (refCount.get(String(b._id)) || 0) - (refCount.get(String(a._id)) || 0) ||
      (invRowsOf.get(String(b._id)) || 0) - (invRowsOf.get(String(a._id)) || 0) ||
      new Date(a.createdAt) - new Date(b.createdAt) ||
      String(a._id).localeCompare(String(b._id))
    );
    const survivor = ranked[0];
    const losers = ranked.slice(1);
    for (const l of losers) mapping.set(String(l._id), survivor);

    const usedMembers = g.filter((v) => refCount.get(String(v._id))).length;
    const stockMembers = g.filter((v) => stockOf.get(String(v._id))).length;
    report.push({
      designNo: survivor.designNo,
      size: survivor.size,
      color: survivor.color,
      barcode: survivor.barcode,
      survivorId: String(survivor._id),
      loserIds: losers.map((l) => String(l._id)),
      refs: g.map((v) => refCount.get(String(v._id)) || 0),
      stock: g.map((v) => stockOf.get(String(v._id)) || 0),
      mergedStock: g.reduce((s, v) => s + (stockOf.get(String(v._id)) || 0), 0),
      multiUsed: usedMembers > 1,
      multiStock: stockMembers > 1,
    });
  }

  return { variants, dupGroups, mapping, report, refDocs, inventories };
}

// Finds any field anywhere (outside the known paths) that still holds one of the ids.
async function scanForIds(idSet) {
  const hits = {};
  const walk = (val, p, col) => {
    if (val == null) return;
    if (val instanceof ObjectId || (typeof val === 'string' && val.length === 24)) {
      if (idSet.has(String(val))) {
        const key = `${col}:${p.replace(/\.\d+/g, '[]')}`;
        hits[key] = (hits[key] || 0) + 1;
      }
      return;
    }
    if (Array.isArray(val)) return val.forEach((x, i) => walk(x, `${p}.${i}`, col));
    if (typeof val === 'object' && !(val instanceof Date) && val._bsontype === undefined) {
      for (const [k, x] of Object.entries(val)) walk(x, p ? `${p}.${k}` : k, col);
    }
  };
  const cols = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of cols) {
    if (SCAN_SKIP.has(name) || name.startsWith('system.')) continue;
    for await (const doc of db.collection(name).find({})) walk(doc, '', name);
  }
  return hits;
}

async function repointTransactions(mapping, loserIds) {
  let updated = 0;
  for (const spec of REF_SPECS) {
    const col = db.collection(spec.collection);
    const docs = await col.find(refQuery(spec, loserIds)).toArray();
    for (let doc of docs) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const set = {};
        for (const a of spec.arrays) {
          if (!Array.isArray(doc[a])) continue;
          set[a] = doc[a].map((item) => {
            const s = item?.variantId && mapping.get(String(item.variantId));
            return s ? { ...item, variantId: s._id } : item;
          });
        }
        set.updatedAt = new Date();
        const update = { $set: set };
        if (doc.syncId) update.$inc = { version: 1 };
        // Guard against a concurrent edit: only write if the doc is unchanged since read.
        const res = await col.updateOne({ _id: doc._id, updatedAt: doc.updatedAt }, update);
        if (res.matchedCount === 1) {
          const fresh = await col.findOne({ _id: doc._id });
          if (fresh.syncId) await journal(spec.syncName, 'UPDATE', fresh);
          updated++;
          break;
        }
        doc = await col.findOne({ _id: doc._id });
        if (!doc) break;
        if (attempt === 4) throw new Error(`Could not update ${spec.collection} ${doc._id} (kept changing)`);
      }
    }
  }
  return updated;
}

async function mergeInventories(mapping, loserIds) {
  const col = db.collection('inventories');
  const rows = await col.find({ variantId: { $in: loserIds } }).toArray();
  let merged = 0;
  let moved = 0;
  for (const row of rows) {
    const survivor = mapping.get(String(row.variantId));
    const target = await col.findOne({ variantId: survivor._id, userId: row.userId });
    const now = new Date();

    if (!target) {
      // Survivor has no stock row for this user: just re-point the duplicate's row.
      const set = { variantId: survivor._id, productId: survivor.productId, updatedAt: now };
      if (!row.syncId) set.syncId = uuidv4();
      await col.updateOne({ _id: row._id }, { $set: set, $inc: { version: 1 } });
      await journal('inventories', 'UPDATE', await col.findOne({ _id: row._id }));
      moved++;
      continue;
    }

    const qty = num(row.quantity);
    const note = {
      _id: new ObjectId(),
      unitId: null,
      quantity: num(target.quantity),
      notes: `Merged stock from duplicate variant ${row.variantId} (duplicate cleanup)`,
      type: 'adjustment',
      adjustment: qty,
      referenceId: row._id,
      referenceType: 'adjustment',
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    };
    const set = { updatedAt: now };
    if (!target.syncId) set.syncId = uuidv4();
    // Delete the duplicate row first (history syncIds are unique across rows), and only
    // if its stock did not change since it was read.
    const del = await col.deleteOne({ _id: row._id, quantity: row.quantity });
    if (del.deletedCount !== 1) {
      throw new Error(`Inventory row ${row._id} changed during merge; re-run the script`);
    }
    try {
      await col.updateOne(
        { _id: target._id },
        {
          $inc: { quantity: qty, version: 1 },
          $push: { inventory_history: { $each: [...(row.inventory_history || []), note], $sort: { createdAt: 1 } } },
          $set: set,
        }
      );
    } catch (err) {
      await col.insertOne(row);
      throw err;
    }
    await journal('inventories', 'UPDATE', await col.findOne({ _id: target._id }));
    await journal('inventories', 'DELETE', { ...row, isDeleted: true, deletedAt: now });
    merged++;
  }
  return { merged, moved };
}

async function deleteLosers(mapping, loserDocs) {
  const col = db.collection('productvariants');
  let deleted = 0;
  for (let i = 0; i < loserDocs.length; i += BATCH) {
    const batch = loserDocs.slice(i, i + BATCH);
    const ids = batch.map((v) => v._id);

    // Catch anything created against these ids while the script was running.
    await repointTransactions(mapping, ids);
    await mergeInventories(mapping, ids);

    const now = new Date();
    await db.collection('syncjournals').insertMany(
      batch.map((v) => journalEntry('product-variants', 'DELETE', { ...v, isDeleted: true, deletedAt: now }))
    );
    const res = await col.deleteMany({ _id: { $in: ids } });
    deleted += res.deletedCount;
    process.stdout.write(`\r  deleted ${deleted}/${loserDocs.length}`);
  }
  process.stdout.write('\n');
  return deleted;
}

const totalStock = async () =>
  (await db.collection('inventories').aggregate([{ $group: { _id: null, q: { $sum: '$quantity' } } }]).toArray())[0]?.q || 0;

async function main() {
  if (!URI) throw new Error('--uri is required');
  const client = new MongoClient(URI);
  await client.connect();
  db = client.db();
  console.log(`Database: ${db.databaseName}  mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  const { variants, dupGroups, mapping, report, refDocs } = await analyse();
  const loserIds = [...mapping.keys()].map((id) => new ObjectId(id));
  const loserSet = new Set(mapping.keys());

  const summary = {
    variants: variants.length,
    duplicateGroups: dupGroups.length,
    variantsToDelete: loserIds.length,
    variantsAfter: variants.length - loserIds.length,
    groupsUsedInTransactions: report.filter((r) => r.refs.some(Boolean)).length,
    groupsWithMultipleUsedCopies: report.filter((r) => r.multiUsed).length,
    groupsWithStockOnMultipleCopies: report.filter((r) => r.multiStock).length,
    transactionDocsToUpdate: refDocs,
    totalStockBefore: await totalStock(),
  };

  const loserRefs = await scanForIds(loserSet);
  summary.duplicateIdReferencesFound = loserRefs;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(OUT_DIR, `dedupe_${db.databaseName}_${stamp}`);
  fs.writeFileSync(`${base}_mapping.json`, JSON.stringify(Object.fromEntries([...mapping].map(([l, s]) => [l, String(s._id)])), null, 2));
  fs.writeFileSync(`${base}_report.json`, JSON.stringify({ summary, groups: report }, null, 2));
  const attention = report.filter((r) => r.multiUsed || r.multiStock);
  fs.writeFileSync(
    `${base}_attention.csv`,
    ['designNo,size,color,barcode,refs_per_copy,stock_per_copy,merged_stock,survivorId']
      .concat(attention.map((r) => [r.designNo, r.size, r.color, r.barcode, r.refs.join('/'), r.stock.join('/'), r.mergedStock, r.survivorId]
        .map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')))
      .join('\n')
  );
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Reports: ${base}_{mapping.json,report.json,attention.csv}`);

  const known = new Set(['inventories:variantId', ...REF_SPECS.flatMap((s) => s.arrays.map((a) => `${s.collection}:${a}[].variantId`))]);
  const unknown = Object.keys(loserRefs).filter((k) => !known.has(k));
  if (unknown.length) {
    console.error(`Duplicate ids are referenced in unhandled places: ${unknown.join(', ')} — aborting.`);
    process.exitCode = 1;
    return client.close();
  }

  if (!APPLY) return client.close();

  const loserDocs = variants.filter((v) => loserSet.has(String(v._id)));
  console.log('Re-pointing transactions...');
  console.log(`  updated ${await repointTransactions(mapping, loserIds)} documents`);
  console.log('Merging stock...');
  console.log(`  ${JSON.stringify(await mergeInventories(mapping, loserIds))}`);
  console.log('Deleting duplicate variants...');
  await deleteLosers(mapping, loserDocs);

  const after = await scanForIds(loserSet);
  const remaining = await db.collection('productvariants').countDocuments({ _id: { $in: loserIds } });
  const verify = { remainingDuplicates: remaining, leftoverReferences: after, totalStockAfter: await totalStock() };
  console.log('Verification:', JSON.stringify(verify, null, 2));
  if (remaining || Object.keys(after).length) process.exitCode = 1;
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
