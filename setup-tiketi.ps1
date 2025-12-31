# TIKETI Complete Setup Script (Windows PowerShell Wrapper)
# This script runs the setup via WSL

param(
    [switch]$SkipConfirmation
)

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "       TIKETI - Complete Setup Script          " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will:" -ForegroundColor White
Write-Host "  1. Create Kind cluster and namespace" -ForegroundColor White
Write-Host "  2. Setup PostgreSQL with base data and MSA schemas" -ForegroundColor White
Write-Host "  3. Build all Docker images" -ForegroundColor White
Write-Host "  4. Deploy all services to Kubernetes" -ForegroundColor White
Write-Host "  5. Verify system health" -ForegroundColor White
Write-Host ""
Write-Host "Estimated time: 5-10 minutes" -ForegroundColor Yellow
Write-Host "Requirements: Docker, Kind, kubectl, npm" -ForegroundColor Gray
Write-Host ""

# Check WSL
Write-Host "Checking WSL..." -ForegroundColor Cyan
try {
    $wslVersion = wsl --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: WSL is not installed or not working properly" -ForegroundColor Red
        Write-Host "   Please install WSL2: https://docs.microsoft.com/en-us/windows/wsl/install" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "OK: WSL is available" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to check WSL" -ForegroundColor Red
    exit 1
}

# Confirm
if (-not $SkipConfirmation) {
    Write-Host ""
    Write-Host "Continue with setup? Type Y and press Enter" -ForegroundColor Yellow
    $response = Read-Host "Your choice"
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "Aborted." -ForegroundColor Red
        exit 0
    }
}

Write-Host ""
$startTime = Get-Date

# Get WSL path
$projectPath = (Get-Location).Path
$wslPath = $projectPath -replace '^([A-Z]):', '/mnt/$1' -replace '\\', '/'
$wslPath = $wslPath.ToLower()

Write-Host "Project path: $projectPath" -ForegroundColor Gray
Write-Host "WSL path: $wslPath" -ForegroundColor Gray
Write-Host ""

# Convert scripts to Unix format
Write-Host "Converting scripts to Unix format..." -ForegroundColor Cyan
$convertCmd = 'cd "' + $wslPath + '" && dos2unix scripts/*.sh 2>&1'
wsl bash -c $convertCmd
Write-Host ""

# Make scripts executable
Write-Host "Making scripts executable..." -ForegroundColor Cyan
$chmodCmd = 'cd "' + $wslPath + '" && chmod +x scripts/*.sh'
wsl bash -c $chmodCmd
Write-Host "OK: Scripts prepared" -ForegroundColor Green
Write-Host ""

# Run setup script via WSL
Write-Host "Starting setup (running in WSL)..." -ForegroundColor Green
Write-Host ""

# Run with auto-yes for non-interactive mode
$setupCmd = 'cd "' + $wslPath + '" && echo Y | scripts/setup-tiketi.sh'
wsl bash -c $setupCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Setup failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check Docker is running" -ForegroundColor Gray
    Write-Host "  2. Check Kind cluster: kind get clusters" -ForegroundColor Gray
    Write-Host "  3. Check pods: kubectl get pods -n tiketi" -ForegroundColor Gray
    Write-Host "  4. View logs: kubectl logs -n tiketi POD_NAME" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# Calculate duration
$endTime = Get-Date
$duration = $endTime - $startTime
$minutes = [math]::Floor($duration.TotalMinutes)
$seconds = $duration.Seconds

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "       TIKETI Setup Complete!                   " -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Total time: ${minutes}m ${seconds}s" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Start port-forwarding:" -ForegroundColor White
Write-Host "     .\start_port_forwards.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Verify all services:" -ForegroundColor White
Write-Host "     wsl bash ./scripts/verify-services.sh" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Access the application:" -ForegroundColor White
Write-Host "     Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "     Backend:   http://localhost:3001" -ForegroundColor White
Write-Host "     Auth:      http://localhost:3005" -ForegroundColor White
Write-Host "     Payment:   http://localhost:3003" -ForegroundColor White
Write-Host "     Ticket:    http://localhost:3002" -ForegroundColor White
Write-Host "     Stats:     http://localhost:3004" -ForegroundColor White
Write-Host ""
Write-Host "  4. Admin Login:" -ForegroundColor White
Write-Host "     Email:    admin@tiketi.gg" -ForegroundColor Cyan
Write-Host "     Password: admin123" -ForegroundColor Cyan
Write-Host ""
Write-Host "  5. Google Login:" -ForegroundColor White
Write-Host "     Use your Google account to login" -ForegroundColor Cyan
Write-Host ""
Write-Host "  6. View all available scripts:" -ForegroundColor White
Write-Host "     See SCRIPTS.md for complete reference" -ForegroundColor Gray
Write-Host ""
Write-Host "  7. To reset everything:" -ForegroundColor White
Write-Host "     wsl bash ./scripts/cleanup.sh" -ForegroundColor Gray
Write-Host ""
Write-Host "Happy ticketing!" -ForegroundColor Green
Write-Host ""
