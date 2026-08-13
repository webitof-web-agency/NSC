#!/usr/bin/env pwsh
# scripts/setup-local-backend.ps1
# Copies files from Naresh-Saree-backend into local-backend/
# Skips: .git, node_modules, .env, uploads

$source = "..\Naresh-Saree-backend"
$dest   = "local-backend"

# Folders to copy
$folders = @("controllers", "middleware", "models", "routes", "utils", "validators", "config")

Write-Host "🔄 Setting up local-backend from Naresh-Saree-backend..." -ForegroundColor Cyan

foreach ($folder in $folders) {
    $srcPath  = Join-Path $source $folder
    $destPath = Join-Path $dest   $folder
    
    if (Test-Path $srcPath) {
        Write-Host "  Copying $folder..." -ForegroundColor Gray
        if (-not (Test-Path $destPath)) {
            New-Item -ItemType Directory -Path $destPath | Out-Null
        }
        Copy-Item -Path "$srcPath\*" -Destination $destPath -Recurse -Force
    }
}

# Copy seedDefaults.js for initial data seeding
Copy-Item -Path (Join-Path $source "seedDefaults.js") -Destination $dest -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Local backend files copied!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 IMPORTANT: The following files were NOT copied (intentionally):" -ForegroundColor Yellow
Write-Host "   .env            → Use local-backend/.env.local instead" -ForegroundColor Yellow
Write-Host "   node_modules    → Run 'npm install' in NSC-Electron/" -ForegroundColor Yellow
Write-Host "   uploads/        → Local uploads stored in user home dir" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔌 Now add _localId + _syncStatus fields to offline models..." -ForegroundColor Cyan

# Patch models with offline sync plugin
$offlineModels = @("Invoice", "Quotation", "CreditNote", "Purchase", "Supplier", "SupplierPayment", "Customer", "User", "Attendance", "StaffSalary")

foreach ($model in $offlineModels) {
    $modelFile = Join-Path $dest "models\$model.js"
    if (Test-Path $modelFile) {
        $content = Get-Content $modelFile -Raw
        
        # Check if plugin already added
        if ($content -notmatch "offlineSyncPlugin") {
            # Add plugin import at top after first require
            $content = $content -replace "(const mongoose = require\('mongoose'\);)", "`$1`r`nconst offlineSyncPlugin = require('../middleware/offlineSync');"
            
            # Add plugin before module.exports
            $content = $content -replace "(module\.exports)", "${model}Schema.plugin(offlineSyncPlugin);`r`n`$1"
            
            Set-Content $modelFile $content -NoNewline
            Write-Host "  ✅ Patched: $model.js" -ForegroundColor Green
        } else {
            Write-Host "  ⏭  Already patched: $model.js" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠  Not found: $model.js" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Setup complete! Run 'npm install' next." -ForegroundColor Green
