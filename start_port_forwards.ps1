# TIKETI Port-Forward Startup Script

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

# Kill existing port-forwards using WSL (no admin required)
Write-Host "Stopping existing port-forwards..." -ForegroundColor Yellow

# Method 1: Kill kubectl port-forward processes from WSL side
try {
    $wslProcesses = wsl bash -c "ps aux | grep 'kubectl port-forward' | grep -v grep" 2>$null
    if ($wslProcesses) {
        $pids = $wslProcesses | ForEach-Object {
            if ($_ -match '\s+(\d+)\s+') {
                $matches[1]
            }
        }
        if ($pids) {
            Write-Host "  Found $($pids.Count) kubectl port-forward processes in WSL" -ForegroundColor Gray
            foreach ($pid in $pids) {
                wsl bash -c "kill -9 $pid" 2>$null
            }
            Write-Host "  ✅ Killed WSL kubectl processes" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "  ⚠️  WSL process cleanup failed (continuing anyway)" -ForegroundColor Yellow
}

# Method 2: Kill PowerShell windows running kubectl (fallback, no admin required)
Get-Process powershell,pwsh -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*kubectl*port-forward*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

# Method 3: Kill kubectl processes directly (fallback)
Get-Process kubectl -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

# Check ports that will be used
Write-Host "Checking port availability..." -ForegroundColor Cyan
$requiredPorts = @(3000, 3001, 3002, 3003, 3004, 3005, 5432)

$portsInUse = @()
$localPostgresRunning = $false

function Test-IsAdmin {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

foreach ($port in $requiredPorts) {
    $connections = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if ($connections.Count -gt 0) {
        $process = Get-Process -Id $connections[0].OwningProcess -ErrorAction SilentlyContinue
        if ($port -eq 5432 -and $process.Name -eq "postgres") {
            Write-Host "  ⚠️  Port 5432 in use by local PostgreSQL (PID: $($process.Id))" -ForegroundColor Yellow
            $localPostgresRunning = $true
        } else {
            $portsInUse += $port
            Write-Host "  ❌ Port $port in use by $($process.Name)" -ForegroundColor Red
        }
    }
}

# Handle local PostgreSQL on port 5432
if ($localPostgresRunning) {
    Write-Host ""
    Write-Host "⚠️  WARNING: Local PostgreSQL is using port 5432" -ForegroundColor Yellow
    Write-Host "   To use K8s PostgreSQL on localhost:5432, we need to stop the local service." -ForegroundColor Gray
    Write-Host ""
    $response = Read-Host "Stop local PostgreSQL service? (y/N)"

    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "Stopping local PostgreSQL..." -ForegroundColor Yellow
        try {
            # Try to stop PostgreSQL service (elevate if needed)
            if (Test-IsAdmin) {
                Stop-Service -Name "postgresql*" -Force -ErrorAction Stop
            } else {
                Write-Host "  Admin privileges required. Requesting elevation..." -ForegroundColor Yellow
                $elevatedCommand = "Stop-Service -Name 'postgresql*' -Force"
                Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command",$elevatedCommand -Wait
            }

            # Verify service is actually stopped
            Start-Sleep -Seconds 2
            $postgresService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
            if ($postgresService -and ($postgresService | Where-Object { $_.Status -ne "Stopped" }).Count -eq 0) {
                Write-Host "  ✅ PostgreSQL service stopped" -ForegroundColor Green
            } else {
                throw "Service stop verification failed"
            }
        } catch {
            Write-Host "  ⚠️  Could not stop service automatically: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Host "  Please stop PostgreSQL manually and re-run this script" -ForegroundColor Gray
            Write-Host "  Or run as Administrator to stop the service" -ForegroundColor Gray
            exit 1
        }
    } else {
        Write-Host ""
        Write-Host "ℹ️  Using alternative port 15432 for K8s PostgreSQL" -ForegroundColor Cyan
        Write-Host "   Connection string: localhost:15432" -ForegroundColor Gray
        $useAlternatePort = $true
    }
    Write-Host ""
}

if ($portsInUse.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Warning: Some ports are in use." -ForegroundColor Yellow
    Write-Host "   Port-forwards may fail for these ports." -ForegroundColor Gray
    Write-Host ""
    Write-Host "Continuing in 3 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
} else {
    Write-Host "  ✅ All required ports are available" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting port-forwards..." -ForegroundColor Green
Write-Host ""

# PostgreSQL
if ($useAlternatePort) {
    Write-Host "[1/7] PostgreSQL (15432 -> 5432)" -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit","-Command","kubectl port-forward --address 0.0.0.0 -n tiketi svc/postgres-service 15432:5432" -WindowStyle Minimized
} else {
    Write-Host "[1/7] PostgreSQL (5432)" -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit","-Command","kubectl port-forward --address 0.0.0.0 -n tiketi svc/postgres-service 5432:5432" -WindowStyle Minimized
}
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
if ($useAlternatePort) {
    Write-Host "  • PostgreSQL:     localhost:15432 (local PostgreSQL on 5432)" -ForegroundColor Yellow
} else {
    Write-Host "  • PostgreSQL:     localhost:5432" -ForegroundColor White
}
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
