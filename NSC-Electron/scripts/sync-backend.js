// NSC-Electron/scripts/sync-backend.js
// Automatically rebuilds or updates NSC-Electron/local-backend from the original Billing_Software_Backend
// Even if local-backend is completely deleted, running npm run build:win or npm run dev will recreate it 100% from scratch.

'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_BACKEND = path.resolve(__dirname, '../../Billing_Software_Backend');
const TARGET_LOCAL_BACKEND = path.resolve(__dirname, '../local-backend');
const TEMPLATES_DIR = path.resolve(__dirname, 'offline-templates');

console.log('🔄 [Sync-Backend] Synchronizing original backend to local-backend...');
console.log('   Source:   ', SOURCE_BACKEND);
console.log('   Target:   ', TARGET_LOCAL_BACKEND);
console.log('   Templates:', TEMPLATES_DIR);

if (!fs.existsSync(SOURCE_BACKEND)) {
  console.error('❌ Source backend directory not found at:', SOURCE_BACKEND);
  process.exit(1);
}

// 1. Ensure target directory exists
if (!fs.existsSync(TARGET_LOCAL_BACKEND)) {
  console.log('📁 local-backend folder does not exist. Creating newly...');
  fs.mkdirSync(TARGET_LOCAL_BACKEND, { recursive: true });
}

// 2. Folders to copy from original Billing_Software_Backend
const SYNC_FOLDERS = [
  'controllers',
  'models',
  'routes',
  'middleware',
  'utils',
  'validators',
  'config',
  'helpers',
  'services',
  'whatsapp-module'
];

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.env',
  '.env.production',
  'uploads',
  'logs',
  'public/uploads'
];

function shouldIgnore(srcPath) {
  const normalized = srcPath.replace(/\\/g, '/');
  return IGNORE_PATTERNS.some(pat => normalized.includes(`/${pat}`) || normalized.endsWith(`/${pat}`) || normalized.endsWith(pat));
}

function copyRecursive(src, dest) {
  if (shouldIgnore(src)) return;

  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursive(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// Copy each module folder from Billing_Software_Backend
for (const folder of SYNC_FOLDERS) {
  const srcFolder = path.join(SOURCE_BACKEND, folder);
  const destFolder = path.join(TARGET_LOCAL_BACKEND, folder);

  if (fs.existsSync(srcFolder)) {
    copyRecursive(srcFolder, destFolder);
    console.log(`   ✓ Synced: ${folder}/`);
  }
}

// 3. Overlay offline templates (server.js, db.js, localSyncBootstrapController, etc.)
if (fs.existsSync(TEMPLATES_DIR)) {
  function applyTemplates(srcDir, destDir) {
    fs.readdirSync(srcDir).forEach((item) => {
      const srcPath = path.join(srcDir, item);
      const destPath = path.join(destDir, item);
      const stat = fs.statSync(srcPath);

      if (stat.isDirectory()) {
        if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
        applyTemplates(srcPath, destPath);
      } else {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }

  applyTemplates(TEMPLATES_DIR, TARGET_LOCAL_BACKEND);
  console.log('   ✓ Injected offline architecture templates (server.js, db.js, offline sync)');
}

// 4. Merge package.json dependencies and install missing packages
const srcPkgPath = path.join(SOURCE_BACKEND, 'package.json');
if (fs.existsSync(srcPkgPath)) {
  try {
    const srcPkg = JSON.parse(fs.readFileSync(srcPkgPath, 'utf8'));
    const targetPkgPath = path.join(__dirname, '../package.json');
    const targetPkg = JSON.parse(fs.readFileSync(targetPkgPath, 'utf8'));

    targetPkg.dependencies = {
      ...(srcPkg.dependencies || {}),
      ...(targetPkg.dependencies || {})
    };

    fs.writeFileSync(targetPkgPath, JSON.stringify(targetPkg, null, 2), 'utf8');
    console.log('   ✓ Merged backend dependencies into NSC-Electron/package.json');

    // Check if any dependency is missing in node_modules
    const nodeModulesDir = path.join(__dirname, '../node_modules');
    const missingDeps = Object.keys(targetPkg.dependencies).filter(dep => {
      return !fs.existsSync(path.join(nodeModulesDir, dep));
    });

    if (missingDeps.length > 0) {
      console.log(`   📦 Installing ${missingDeps.length} missing package(s): ${missingDeps.join(', ')}...`);
      const { execSync } = require('child_process');
      execSync('npm install --no-audit', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    }
  } catch (e) {
    console.warn('   ⚠️ Could not merge package.json dependencies:', e.message);
  }
}

console.log('✅ [Sync-Backend] Synchronization completed! local-backend is 100% up-to-date.');
