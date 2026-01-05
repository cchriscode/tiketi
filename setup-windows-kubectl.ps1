# Setup Windows kubectl for TIKETI
# This allows port-forwarding to Windows localhost instead of WSL IP

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Windows kubectl Setup for TIKETI" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if kubectl is already installed on Windows
$kubectlPath = Get-Command kubectl -ErrorAction SilentlyContinue

if ($kubectlPath -and $kubectlPath.Source -notlike "*wsl*") {
    Write-Host "✅ kubectl is already installed on Windows" -ForegroundColor Green
    Write-Host "   Path: $($kubectlPath.Source)" -ForegroundColor Gray
} else {
    Write-Host "Installing kubectl for Windows..." -ForegroundColor Yellow
    Write-Host ""

    # Download kubectl
    $kubectlVersion = "v1.28.0"
    $downloadUrl = "https://dl.k8s.io/release/$kubectlVersion/bin/windows/amd64/kubectl.exe"
    $installPath = "$env:LOCALAPPDATA\Microsoft\WindowsApps\kubectl.exe"

    Write-Host "Downloading kubectl $kubectlVersion..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $installPath
        Write-Host "✅ kubectl downloaded successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to download kubectl" -ForegroundColor Red
        Write-Host "   Please install manually: https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "Copying kubeconfig from WSL to Windows..." -ForegroundColor Cyan

# Create .kube directory in Windows user profile
$windowsKubeDir = "$env:USERPROFILE\.kube"
if (-not (Test-Path $windowsKubeDir)) {
    New-Item -ItemType Directory -Path $windowsKubeDir -Force | Out-Null
}

# Copy kubeconfig from WSL
try {
    Write-Host "   Copying kubeconfig from WSL to Windows..." -ForegroundColor Gray

    # Convert Windows path to WSL mount path
    $windowsMountPath = $windowsKubeDir -replace '\\', '/' -replace '^C:', '/mnt/c'

    # Use WSL command to copy file directly (avoids username encoding issues)
    $copyResult = wsl bash -c "if [ -f ~/.kube/config ]; then mkdir -p '$windowsMountPath' && cp ~/.kube/config '$windowsMountPath/config' && echo 'SUCCESS'; else echo 'NOT_FOUND'; fi" 2>&1

    if ($copyResult -like "*SUCCESS*" -and (Test-Path "$windowsKubeDir\config")) {
        # Read and modify kubeconfig
        $kubeConfig = Get-Content -Path "$windowsKubeDir\config" -Raw

        # Replace 127.0.0.1 with localhost for Windows compatibility
        $kubeConfig = $kubeConfig -replace '127\.0\.0\.1', 'localhost'

        # Save modified config
        $kubeConfig | Out-File -FilePath "$windowsKubeDir\config" -Encoding utf8 -NoNewline

        Write-Host "✅ kubeconfig copied to Windows" -ForegroundColor Green
        Write-Host "   Path: $windowsKubeDir\config" -ForegroundColor Gray
    } else {
        throw "WSL kubeconfig not found. Make sure Kind cluster is created in WSL (run: wsl kind get clusters)"
    }
} catch {
    Write-Host "❌ Failed to copy kubeconfig from WSL" -ForegroundColor Red
    Write-Host "   Make sure Kind cluster is created in WSL" -ForegroundColor Yellow
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}

# Test connection
Write-Host ""
Write-Host "Testing connection to Kind cluster..." -ForegroundColor Cyan
$testResult = kubectl cluster-info 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully connected to Kind cluster!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Cluster info:" -ForegroundColor White
    kubectl cluster-info
} else {
    Write-Host "❌ Cannot connect to Kind cluster" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor Yellow
    Write-Host $testResult -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Make sure Kind cluster is running: wsl kind get clusters" -ForegroundColor White
    Write-Host "  2. Check WSL Docker: wsl docker ps" -ForegroundColor White
    Write-Host "  3. Restart Docker Desktop" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next step:" -ForegroundColor Yellow
Write-Host "  .\start_port_forwards.ps1" -ForegroundColor Cyan
Write-Host ""
