const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");

require("module-alias/register");

const SyncJournal = require("../models/SyncJournal");
const { pullSyncEvents } = require("../controllers/syncController");

const DAY_MS = 24 * 60 * 60 * 1000;
const cursorAt = (msAgo) =>
  mongoose.Types.ObjectId.createFromTime(Math.floor((Date.now() - msAgo) / 1000)).toString();

test("sync journal entries expire after the retention window", () => {
  const ttl = SyncJournal.schema.indexes().find(([fields]) => fields.createdAt === 1);
  assert.ok(ttl, "missing TTL index on createdAt");
  assert.equal(ttl[1].expireAfterSeconds, 60 * 24 * 60 * 60);
});

test("cursors older than the retention window are expired", () => {
  assert.equal(SyncJournal.isCursorExpired(cursorAt(DAY_MS)), false);
  assert.equal(SyncJournal.isCursorExpired(cursorAt(61 * DAY_MS)), true);
  assert.equal(SyncJournal.isCursorExpired("000000000000000000000000"), true);
  assert.equal(SyncJournal.isCursorExpired("not-a-cursor"), false);
});

test("pull with an expired cursor returns no events so the desktop app re-bootstraps", async () => {
  const cursor = cursorAt(90 * DAY_MS);
  let body;
  const res = { status: () => ({ json: (b) => { body = b; } }) };

  await pullSyncEvents({ query: { cursor } }, res);

  assert.deepEqual(body.data, { events: [], nextCursor: cursor, hasMore: false, resetRequired: true });
});
