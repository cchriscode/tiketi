#!/bin/bash

set -e

echo "🏗️  Building Docker images..."

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check if Kind cluster exists
if ! kind get clusters | grep -q "tiketi-local"; then
    echo "❌ Cluster 'tiketi-local' does not exist."
    echo "   Please create it first: ./scripts/kind-cluster-create.sh"
    exit 1
fi

echo ""
echo "📦 Building Backend image..."
cd "$PROJECT_ROOT/backend"
docker build -t tiketi-backend:local -f Dockerfile .
echo "✅ Backend image built: tiketi-backend:local"

echo ""
echo "📦 Building Frontend image (optional)..."
read -p "Do you want to build the frontend image? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$PROJECT_ROOT/frontend"
    docker build -t tiketi-frontend:local -f Dockerfile .
    echo "✅ Frontend image built: tiketi-frontend:local"
fi

echo ""
echo "📤 Loading images into Kind cluster..."
kind load docker-image tiketi-backend:local --name tiketi-local
echo "✅ Backend image loaded into cluster"

if [[ $REPLY =~ ^[Yy]$ ]]; then
    kind load docker-image tiketi-frontend:local --name tiketi-local
    echo "✅ Frontend image loaded into cluster"
fi

echo ""
echo "✅ All images loaded successfully!"
echo ""
echo "📌 Next steps:"
echo "   1. Deploy all services: ./scripts/deploy-all.sh"
echo "   2. Check images in cluster: docker exec -it tiketi-local-control-plane crictl images"
echo ""
