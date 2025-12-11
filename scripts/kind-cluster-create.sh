#!/bin/bash

set -e

echo "🚀 Creating Kind cluster for Tiketi..."

# Check if kind is installed
if ! command -v kind &> /dev/null; then
    echo "❌ Kind is not installed. Please install it first:"
    echo "   https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
    exit 1
fi

# Check if cluster already exists
if kind get clusters | grep -q "tiketi-local"; then
    echo "⚠️  Cluster 'tiketi-local' already exists."
    read -p "Do you want to delete and recreate it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Deleting existing cluster..."
        kind delete cluster --name tiketi-local
    else
        echo "❌ Aborting. Please delete the cluster manually:"
        echo "   kind delete cluster --name tiketi-local"
        exit 1
    fi
fi

# Create Kind cluster
echo "📦 Creating cluster with config file..."
kind create cluster --config kind-config.yaml --name tiketi-local

# Wait for cluster to be ready
echo "⏳ Waiting for cluster to be ready..."
kubectl wait --for=condition=Ready nodes --all --timeout=120s

# Display cluster info
echo ""
echo "✅ Kind cluster 'tiketi-local' created successfully!"
echo ""
echo "📝 Cluster information:"
kubectl cluster-info --context kind-tiketi-local
echo ""
echo "🔧 Nodes:"
kubectl get nodes
echo ""
echo "📌 Next steps:"
echo "   1. Build and load Docker images: ./scripts/build-and-load-images.sh"
echo "   2. Deploy all services: ./scripts/deploy-all.sh"
echo "   3. Check pod status: kubectl get pods -n tiketi -w"
echo ""
