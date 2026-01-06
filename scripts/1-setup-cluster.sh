#!/bin/bash
set -e

echo "=========================================="
echo "  TIKETI - Cluster Setup"
echo "=========================================="
echo ""

# Check if running from project root
if [ ! -f "k8s/kind-config.yaml" ]; then
  echo "??Error: Must run from project root directory"
  echo "   Current directory: $(pwd)"
  exit 1
fi

# Check if Kind cluster exists
CLUSTER_EXISTS=$(kind get clusters 2>/dev/null | grep -c "tiketi-local" || true)

if [ "$CLUSTER_EXISTS" -gt 0 ]; then
  echo "? ï¸  Kind cluster 'tiketi-local' already exists"

  # Check if running in automated mode
  if [ -t 0 ]; then
    read -p "Delete and recreate? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "?—‘ï¸? Deleting existing cluster..."
      kind delete cluster --name tiketi-local
      CLUSTER_EXISTS=0
    else
      echo "??Using existing cluster"
    fi
  else
    # Non-interactive mode: reuse existing cluster
    echo "?¹ï¸  Running in non-interactive mode: using existing cluster"
  fi
fi

# Create Kind cluster if it doesn't exist
if [ "$CLUSTER_EXISTS" -eq 0 ]; then
  echo "?? Creating Kind cluster (3 nodes: 1 control-plane, 2 workers)..."

  if ! kind create cluster --name tiketi-local --config k8s/kind-config.yaml; then
    echo "??Failed to create Kind cluster"
    exit 1
  fi

  echo "??Cluster created successfully"
fi

# Switch to cluster context
echo ""
echo "?”„ Switching to cluster context..."
kubectl config use-context kind-tiketi-local

# Verify cluster
echo ""
echo "?“‹ Verifying cluster..."
if ! kubectl cluster-info --context kind-tiketi-local > /dev/null 2>&1; then
  echo "??Failed to connect to cluster"
  exit 1
fi

echo "??Cluster is accessible"
kubectl get nodes

# Create namespace
echo ""
echo "?“¦ Creating namespace 'tiketi'..."
kubectl create namespace tiketi --dry-run=client -o yaml | kubectl apply -f -

# Verify namespace
if ! kubectl get namespace tiketi > /dev/null 2>&1; then
  echo "??Failed to create namespace"
  exit 1
fi

echo "??Namespace created"

echo "=========================================="
echo "  ??Cluster Setup Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ??Cluster: tiketi-local (3 nodes)"
echo "  ??Namespace: tiketi"
echo ""
echo "Next step: ./scripts/2-setup-database.sh"
echo ""
