#!/bin/bash
set -e

echo "🏗️  Building MSA Docker images..."

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check if Kind cluster exists
if ! kind get clusters | grep -q "tiketi-local"; then
    echo "❌ Cluster 'tiketi-local' does not exist."
    exit 1
fi

echo ""
echo "📦 Building MSA Service images..."

# Auth Service
echo "  → Building auth-service..."
cd "$PROJECT_ROOT/services/auth-service"
docker build -t tiketi-auth-service:local -f Dockerfile .

# Ticket Service
echo "  → Building ticket-service..."
cd "$PROJECT_ROOT/services/ticket-service"
docker build -t tiketi-ticket-service:local -f Dockerfile .

# Payment Service
echo "  → Building payment-service..."
cd "$PROJECT_ROOT/services/payment-service"
docker build -t tiketi-payment-service:local -f Dockerfile .

# Stats Service
echo "  → Building stats-service..."
cd "$PROJECT_ROOT/services/stats-service"
docker build -t tiketi-stats-service:local -f Dockerfile .

# Frontend
echo "  → Building frontend..."
cd "$PROJECT_ROOT/frontend"
docker build -t tiketi-frontend:local -f Dockerfile .

echo ""
echo "📤 Loading images into Kind cluster..."
kind load docker-image tiketi-auth-service:local --name tiketi-local
kind load docker-image tiketi-ticket-service:local --name tiketi-local
kind load docker-image tiketi-payment-service:local --name tiketi-local
kind load docker-image tiketi-stats-service:local --name tiketi-local
kind load docker-image tiketi-frontend:local --name tiketi-local

echo ""
echo "✅ All MSA images loaded successfully!"
echo ""
echo "📌 Images in cluster:"
docker exec -it tiketi-local-control-plane crictl images | grep tiketi || true
echo ""
echo "📌 Next steps:"
echo "   kubectl apply -f k8s/"
echo ""
