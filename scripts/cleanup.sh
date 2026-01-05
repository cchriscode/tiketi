#!/bin/bash

echo "=========================================="
echo "  TIKETI - Complete Cleanup Script"
echo "=========================================="
echo ""
echo "This will DELETE:"
echo "  • Kind cluster 'tiketi-local'"
echo "  • All deployed services"
echo "  • All data (irreversible!)"
echo "  • Running port-forward processes"
echo "  • Docker images (optional)"
echo ""

read -p "Are you sure? (y/N): " -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""

# Step 1: Kill port-forward processes
echo "🔌 Stopping port-forward processes..."
pkill -f "kubectl port-forward" 2>/dev/null && echo "  ✅ Port forwards stopped" || echo "  ℹ️  No port forwards running"

# Step 2: Delete Kind cluster
echo ""
echo "🗑️  Deleting Kind cluster..."

if kind get clusters 2>/dev/null | grep -q "tiketi-local"; then
  kind delete cluster --name tiketi-local
  echo "  ✅ Cluster deleted"
else
  echo "  ℹ️  Cluster 'tiketi-local' not found"
fi

# Step 3: Optional - Clean Docker images
echo ""
read -p "Delete Docker images? (y/N): " -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🐳 Deleting Docker images..."

  IMAGES=(
    "tiketi-auth-service:local"
    "tiketi-ticket-service:local"
    "tiketi-stats-service:local"
    "tiketi-payment-service:local"
    "tiketi-backend:local"
    "tiketi-frontend:local"
  )

  for image in "${IMAGES[@]}"; do
    if docker images -q "$image" 2>/dev/null | grep -q .; then
      docker rmi "$image" 2>/dev/null && echo "  ✅ Deleted: $image" || echo "  ⚠️  Failed to delete: $image"
    fi
  done
else
  echo "  ℹ️  Docker images kept"
fi

# Step 4: Optional - Clean node_modules
echo ""
read -p "Delete node_modules folders? (saves disk space) (y/N): " -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "📦 Deleting node_modules..."

  # Detect OS type
  if [[ "$OSTYPE" == "linux-gnu"* ]] && grep -qi microsoft /proc/version 2>/dev/null; then
    # WSL detected
    echo "  ⚠️  WSL detected. For better performance, use PowerShell cleanup script:"
    echo "      powershell.exe -File cleanup.ps1"
    echo ""
    echo "  Attempting WSL deletion (may have permission issues)..."
    echo ""
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    # Mac detected
    echo "  🍎 Mac detected. Deleting node_modules..."
    echo ""
  else
    # Linux (native)
    echo "  🐧 Linux detected. Deleting node_modules..."
    echo ""
  fi

  DIRS=(
    "services/auth-service/node_modules"
    "services/ticket-service/node_modules"
    "services/stats-service/node_modules"
    "services/payment-service/node_modules"
    "backend/node_modules"
    "frontend/node_modules"
  )

  for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
      if rm -rf "$dir" 2>/dev/null; then
        echo "  ✅ Deleted: $dir"
      else
        if [[ "$OSTYPE" == "linux-gnu"* ]] && grep -qi microsoft /proc/version 2>/dev/null; then
          echo "  ⚠️  Permission denied: $dir (use PowerShell cleanup.ps1)"
        else
          echo "  ⚠️  Permission denied: $dir"
        fi
      fi
    fi
  done
else
  echo "  ℹ️  node_modules kept"
fi

echo ""
echo "=========================================="
echo "  ✅ Cleanup Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✓ Port forwards stopped"
echo "  ✓ Kind cluster deleted"
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "  ✓ Docker images removed"
  echo "  ✓ node_modules removed"
fi
echo ""
echo "To recreate the system:"
# Show OS-specific command
if [[ "$OSTYPE" == "linux-gnu"* ]] && grep -qi microsoft /proc/version 2>/dev/null; then
  echo "  WSL:     ./scripts/setup-tiketi.sh"
  echo "  Windows: .\\setup-tiketi.ps1"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  echo "  ./scripts/setup-tiketi.sh"
else
  echo "  ./scripts/setup-tiketi.sh"
fi
echo ""
