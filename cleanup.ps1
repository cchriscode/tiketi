# TIKETI Complete Cleanup Script (Windows PowerShell)

Write-Host ""
Write-Host "==========================================" -ForegroundColor Red
Write-Host "  TIKETI - Complete Cleanup Script" -ForegroundColor Red
Write-Host "==========================================" -ForegroundColor Red
Write-Host ""
Write-Host "This will DELETE:" -ForegroundColor Yellow
Write-Host "  • Kind cluster 'tiketi-local'" -ForegroundColor White
Write-Host "  • All deployed services" -ForegroundColor White
Write-Host "  • All data (irreversible!)" -ForegroundColor White
Write-Host "  • Running port-forward processes" -ForegroundColor White
Write-Host "  • Docker images (optional)" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Are you sure? (y/N)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

Write-Host ""

# Step 1: Kill port-forward processes
Write-Host "🔌 Stopping port-forward processes..." -ForegroundColor Cyan
try {
    Get-Process | Where-Object {$_.CommandLine -like "*kubectl*port-forward*"} | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  ✅ Port forwards stopped" -ForegroundColor Green
} catch {
    Write-Host "  ℹ️  No port forwards running" -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# Step 2: Delete Kind cluster via WSL
Write-Host ""
Write-Host "🗑️  Deleting Kind cluster..." -ForegroundColor Cyan

$wslPath = (Get-Location).Path -replace '^([A-Z]):', '/mnt/$1' -replace '\\', '/'
$wslPath = $wslPath.ToLower()

try {
    $clusterExists = wsl bash -c "kind get clusters 2>/dev/null | grep -q 'tiketi-local' && echo 'yes' || echo 'no'"

    if ($clusterExists -eq "yes") {
        wsl bash -c "kind delete cluster --name tiketi-local"
        Write-Host "  ✅ Cluster deleted" -ForegroundColor Green
    } else {
        Write-Host "  ℹ️  Cluster 'tiketi-local' not found" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ⚠️  Failed to delete cluster: $_" -ForegroundColor Yellow
}

# Step 3: Optional - Clean Docker images
Write-Host ""
$deleteImages = Read-Host "Delete Docker images? (y/N)"

if ($deleteImages -eq "y" -or $deleteImages -eq "Y") {
    Write-Host "🐳 Deleting Docker images..." -ForegroundColor Cyan

    $images = @(
        "tiketi-auth-service:local",
        "tiketi-ticket-service:local",
        "tiketi-stats-service:local",
        "tiketi-payment-service:local",
        "tiketi-backend:local",
        "tiketi-frontend:local"
    )

    foreach ($image in $images) {
        try {
            $exists = docker images -q $image 2>$null
            if ($exists) {
                docker rmi $image 2>$null
                Write-Host "  ✅ Deleted: $image" -ForegroundColor Green
            }
        } catch {
            Write-Host "  ⚠️  Failed to delete: $image" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  ℹ️  Docker images kept" -ForegroundColor Gray
}

# Step 4: Optional - Clean node_modules
Write-Host ""
$deleteNodeModules = Read-Host "Delete node_modules folders? (saves disk space) (y/N)"

if ($deleteNodeModules -eq "y" -or $deleteNodeModules -eq "Y") {
    Write-Host "📦 Deleting node_modules..." -ForegroundColor Cyan

    $dirs = @(
        "services\auth-service\node_modules",
        "services\ticket-service\node_modules",
        "services\stats-service\node_modules",
        "services\payment-service\node_modules",
        "backend\node_modules",
        "frontend\node_modules"
    )

    foreach ($dir in $dirs) {
        if (Test-Path $dir) {
            Write-Host "  🗑️  Deleting: $dir" -ForegroundColor Yellow
            try {
                # Use Get-ChildItem with Force to handle hidden/read-only files
                Get-ChildItem -Path $dir -Recurse -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
                Remove-Item -Path $dir -Recurse -Force -ErrorAction Stop
                Write-Host "  ✅ Deleted: $dir" -ForegroundColor Green
            } catch {
                Write-Host "  ⚠️  Partial deletion (some files may remain): $dir" -ForegroundColor Yellow
                # Try alternate method
                try {
                    cmd /c "rmdir /s /q `"$dir`"" 2>$null
                    Write-Host "  ✅ Deleted using cmd: $dir" -ForegroundColor Green
                } catch {
                    Write-Host "  ❌ Failed to delete: $dir" -ForegroundColor Red
                }
            }
        }
    }
} else {
    Write-Host "  ℹ️  node_modules kept" -ForegroundColor Gray
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  ✅ Cleanup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor White
Write-Host "  ✓ Port forwards stopped" -ForegroundColor Gray
Write-Host "  ✓ Kind cluster deleted" -ForegroundColor Gray
if ($deleteImages -eq "y" -or $deleteImages -eq "Y") {
    Write-Host "  ✓ Docker images removed" -ForegroundColor Gray
}
if ($deleteNodeModules -eq "y" -or $deleteNodeModules -eq "Y") {
    Write-Host "  ✓ node_modules removed" -ForegroundColor Gray
}
Write-Host ""
Write-Host "To recreate the system:" -ForegroundColor White
Write-Host "  .\setup-tiketi.ps1" -ForegroundColor Cyan
Write-Host ""
