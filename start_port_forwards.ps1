# TIKETI Port-Forward Startup Script

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  Requesting Administrator privileges..." -ForegroundColor Yellow
    Write-Host "   (Required to kill processes using ports)" -ForegroundColor Gray
    Write-Host ""

    # Re-launch as administrator
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
    exit
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TIKETI Port-Forward Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Windows kubectl is available
$kubectlPath = Get-Command kubectl -ErrorAction SilentlyContinue
if (-not $kubectlPath -or $kubectlPath.Source -like "*wsl*") {
    Write-Host "❌ Windows kubectl not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run setup first:" -ForegroundColor Yellow
    Write-Host "  .\setup-windows-kubectl.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This is required to use localhost instead of WSL IP" -ForegroundColor Gray
    Write-Host "for Google OAuth compatibility" -ForegroundColor Gray
    exit 1
}

# Test cluster connection
Write-Host "Testing cluster connection..." -ForegroundColor Cyan
$clusterTest = kubectl cluster-info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cannot connect to Kind cluster" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run:" -ForegroundColor Yellow
    Write-Host "  .\setup-windows-kubectl.ps1" -ForegroundColor Cyan
    exit 1
}
Write-Host "✅ Cluster connection OK" -ForegroundColor Green
Write-Host ""

# Stop PostgreSQL service if running (to free port 5432)
Write-Host "Checking for local PostgreSQL service..." -ForegroundColor Yellow
$pgServices = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgServices) {
    foreach ($svc in $pgServices) {
        if ($svc.Status -eq 'Running') {
            Write-Host "  Stopping PostgreSQL service: $($svc.Name)..." -ForegroundColor Yellow
            try {
                Stop-Service -Name $svc.Name -Force -ErrorAction Stop
                Write-Host "  ✅ PostgreSQL service stopped" -ForegroundColor Green
            } catch {
                Write-Host "  ⚠️  Cannot stop service (need admin): $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }
}

# Kill existing port-forwards
Write-Host "Stopping existing port-forwards..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.CommandLine -like "*kubectl*port-forward*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Check and kill processes using required ports
Write-Host "Checking and cleaning up ports..." -ForegroundColor Cyan
$requiredPorts = @(3000, 3001, 3002, 3003, 3004, 3005, 5432)
$killedProcesses = 0

foreach ($port in $requiredPorts) {
    $connections = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if ($connections.Count -gt 0) {
        $uniquePids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($processId in $uniquePids) {
            try {
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process) {
                    # Try Stop-Process first
                    try {
                        Stop-Process -Id $processId -Force -ErrorAction Stop
                        Write-Host "  ✅ Killed process using port $port (PID: $processId, Name: $($process.Name))" -ForegroundColor Yellow
                        $killedProcesses++
                    } catch {
                        # If Stop-Process fails, try taskkill
                        Write-Host "  ⚠️  Stop-Process failed, trying taskkill..." -ForegroundColor Yellow
                        $taskkillResult = cmd.exe /c "taskkill /F /PID $processId 2>&1"
                        if ($LASTEXITCODE -eq 0) {
                            Write-Host "  ✅ Killed with taskkill: port $port (PID: $processId)" -ForegroundColor Green
                            $killedProcesses++
                        } else {
                            Write-Host "  ❌ Failed to kill process on port $port (PID: $processId)" -ForegroundColor Red
                            Write-Host "     Process: $($process.Name)" -ForegroundColor Gray
                        }
                    }
                }
            } catch {
                Write-Host "  ❌ Error handling process on port $port (PID: $processId): $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
}

if ($killedProcesses -gt 0) {
    Write-Host "Waiting for ports to free up..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
}

# Final verification
$stillInUse = @()
foreach ($port in $requiredPorts) {
    $connections = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if ($connections.Count -gt 0) {
        $stillInUse += $port
        $pids = ($connections | Select-Object -ExpandProperty OwningProcess -Unique) -join ', '
        Write-Host "  ❌ Port $port still in use (PIDs: $pids)" -ForegroundColor Red
    }
}

if ($stillInUse.Count -gt 0) {
    Write-Host ""
    Write-Host "ERROR: Some ports could not be freed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Quick fixes:" -ForegroundColor Yellow
    Write-Host "  1. Run this script as Administrator (Right-click → Run as Administrator)" -ForegroundColor Cyan
    Write-Host "  2. Or manually stop PostgreSQL service:" -ForegroundColor Cyan
    Write-Host "     net stop postgresql-x64-15" -ForegroundColor Gray
    Write-Host "  3. Or use different port for K8s postgres:" -ForegroundColor Cyan
    Write-Host "     kubectl port-forward -n tiketi svc/postgres 5433:5432" -ForegroundColor Gray
    Write-Host ""

    # Ask user what to do
    Write-Host "Do you want to:" -ForegroundColor White
    Write-Host "  [1] Restart as Administrator (recommended)" -ForegroundColor Green
    Write-Host "  [2] Continue anyway (may fail)" -ForegroundColor Yellow
    Write-Host "  [3] Exit" -ForegroundColor Red
    $choice = Read-Host "Enter choice (1-3)"

    switch ($choice) {
        "1" {
            $scriptPath = $MyInvocation.MyCommand.Path
            Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
            exit
        }
        "2" {
            Write-Host ""
            Write-Host "⚠️  Continuing anyway..." -ForegroundColor Yellow
        }
        default {
            Write-Host "Exiting..." -ForegroundColor Gray
            exit 1
        }
    }
}

Write-Host "All ports are available" -ForegroundColor Green
Write-Host ""
Write-Host "Starting port-forwards..." -ForegroundColor Green
Write-Host ""

# PostgreSQL
Write-Host "[1/7] PostgreSQL (5432)" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","kubectl port-forward --address 0.0.0.0 -n tiketi svc/postgres-service 5432:5432" -WindowStyle Minimized
Start-Sleep -Seconds 3

# Backend - MUST start before Frontend
Write-Host "[2/7] Backend (3001)" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","kubectl port-forward --address 0.0.0.0 -n tiketi svc/backend-service 3001:3001" -WindowStyle Minimized
Start-Sleep -Seconds 3

# Auth Service
Write-Host "[3/7] Auth Service (3005)" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","kubectl port-forward --address 0.0.0.0 -n tiketi svc/auth-service 3005:3005" -WindowStyle Minimized
Start-Sleep -Seconds 3

# Ticket Service
Write-Host "[4/7] Ticket Service (3002)" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","kubectl port-forward --address 0.0.0.0 -n tiketi svc/ticket-service 3002:3002" -WindowStyle Minimized
Start-Sleep -Seconds 3

# Payment Service
Write-Host "[5/7] Payment Service (3003)" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","kubectl port-forward --address 0.0.0.0 -n tiketi svc/payment-service 3003:3003" -WindowStyle Minimized
Start-Sleep -Seconds 3

# Stats Service
Write-Host "[6/7] Stats Service (3004)" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","kubectl port-forward --address 0.0.0.0 -n tiketi svc/stats-service 3004:3004" -WindowStyle Minimized
Start-Sleep -Seconds 3

# Frontend - Start LAST to ensure backend is ready
Write-Host "[7/7] Frontend (3000)" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","kubectl port-forward --address 0.0.0.0 -n tiketi svc/frontend-service 3000:3000" -WindowStyle Minimized
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Verifying port-forwards..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# Test each service
$services = @(
    @{Name="Backend"; Port=3001; Path="/health"},
    @{Name="Auth Service"; Port=3005; Path="/health"},
    @{Name="Payment Service"; Port=3003; Path="/health"},
    @{Name="Ticket Service"; Port=3002; Path="/health"},
    @{Name="Stats Service"; Port=3004; Path="/health"},
    @{Name="Frontend"; Port=3000; Path="/"}
)

$allHealthy = $true
foreach ($svc in $services) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($svc.Port)$($svc.Path)" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "  ✅ $($svc.Name) (port $($svc.Port))" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ $($svc.Name) (port $($svc.Port)) - NOT RESPONDING" -ForegroundColor Red
        $allHealthy = $false
    }
}

Write-Host ""
if ($allHealthy) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ All services are healthy!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  ⚠️  Some services failed to start" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check PowerShell windows (taskbar)" -ForegroundColor White
    Write-Host "  2. Run: wsl kubectl get pods -n tiketi" -ForegroundColor White
    Write-Host "  3. Try: wsl --shutdown && .\start_port_forwards.ps1" -ForegroundColor White
}

Write-Host ""
Write-Host "Services available at:" -ForegroundColor White
Write-Host "  • Frontend:       http://localhost:3000" -ForegroundColor White
Write-Host "  • Backend API:    http://localhost:3001" -ForegroundColor White
Write-Host "  • Auth Service:   http://localhost:3005" -ForegroundColor White
Write-Host "  • Payment:        http://localhost:3003" -ForegroundColor White
Write-Host "  • Ticket Service: http://localhost:3002" -ForegroundColor White
Write-Host "  • Stats Service:  http://localhost:3004" -ForegroundColor White
Write-Host "  • PostgreSQL:     localhost:5432" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
