#!/bin/bash

set -e

echo "🗑️  Deleting Kind cluster 'tiketi-local'..."

# Check if cluster exists
if ! kind get clusters | grep -q "tiketi-local"; then
    echo "⚠️  Cluster 'tiketi-local' does not exist."
    exit 0
fi

# Confirm deletion
read -p "Are you sure you want to delete the cluster? This will remove all data. (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deletion cancelled."
    exit 0
fi

# Delete the cluster
kind delete cluster --name tiketi-local

echo "✅ Cluster 'tiketi-local' deleted successfully!"
echo ""
echo "📌 To recreate the cluster, run:"
echo "   ./scripts/kind-cluster-create.sh"
echo ""
