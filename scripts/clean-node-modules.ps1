# Clean node_modules - PowerShell Script
# Handles Windows file permission issues

param(
    [switch]$Force
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  node_modules Cleanup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$dirs = @(
    "services\auth-service\node_modules",
    "services\ticket-service\node_modules",
    "services\stats-service\node_modules",
    "services\payment-service\node_modules",
    "backend\node_modules",
    "frontend\node_modules"
)

# Calculate total size
$totalSize = 0
foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem -Path $dir -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $totalSize += $size
    }
}

$totalSizeMB = [math]::Round($totalSize / 1MB, 2)

Write-Host "Found node_modules directories:" -ForegroundColor White
foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem -Path $dir -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $sizeMB = [math]::Round($size / 1MB, 2)
        Write-Host "  • $dir ($sizeMB MB)" -ForegroundColor Gray
    }
}
Write-Host ""
Write-Host "Total size: $totalSizeMB MB" -ForegroundColor Yellow
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Delete all node_modules? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Aborted." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "🗑️  Deleting node_modules..." -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        Write-Host "Deleting: $dir" -NoNewline

        try {
            # Method 1: PowerShell Remove-Item
            Remove-Item -Path $dir -Recurse -Force -ErrorAction Stop
            Write-Host " ✅" -ForegroundColor Green
            $successCount++
        } catch {
            # Method 2: cmd rmdir
            try {
                cmd /c "rmdir /s /q `"$dir`"" 2>$null
                if (Test-Path $dir) {
                    Write-Host " ⚠️ Partial" -ForegroundColor Yellow
                    $failCount++
                } else {
                    Write-Host " ✅ (via cmd)" -ForegroundColor Green
                    $successCount++
                }
            } catch {
                Write-Host " ❌" -ForegroundColor Red
                $failCount++
            }
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Cleanup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Results:" -ForegroundColor White
Write-Host "  ✅ Deleted: $successCount directories" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "  ❌ Failed:  $failCount directories" -ForegroundColor Red
    Write-Host ""
    Write-Host "For stubborn directories, close all applications and try again." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Disk space freed: ~$totalSizeMB MB" -ForegroundColor Cyan
Write-Host ""
