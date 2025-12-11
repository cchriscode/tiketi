#!/bin/bash

set -e

echo "🚀 Deploying all services to Kind cluster..."

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check if cluster exists
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Kubernetes cluster is not accessible."
    echo "   Please create Kind cluster first: ./scripts/kind-cluster-create.sh"
    exit 1
fi

echo ""
echo "📝 Applying Kubernetes manifests..."

# Apply manifests in order
echo "  1️⃣  Creating namespace..."
kubectl apply -f "$PROJECT_ROOT/k8s/00-namespace.yaml"

echo "  2️⃣  Creating ConfigMap and Secret..."
kubectl apply -f "$PROJECT_ROOT/k8s/01-configmap.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/02-secret.yaml"

echo "  3️⃣  Creating PersistentVolumeClaims..."
kubectl apply -f "$PROJECT_ROOT/k8s/03-pvc.yaml"

echo "  4️⃣  Deploying PostgreSQL..."
kubectl apply -f "$PROJECT_ROOT/k8s/04-postgres.yaml"

echo "  5️⃣  Deploying DragonflyDB..."
kubectl apply -f "$PROJECT_ROOT/k8s/05-dragonfly.yaml"

echo "  ⏳ Waiting for databases to be ready..."
kubectl wait --for=condition=Ready pod -l app=postgres -n tiketi --timeout=120s || true
kubectl wait --for=condition=Ready pod -l app=dragonfly -n tiketi --timeout=120s || true
sleep 5

echo "  6️⃣  Deploying Backend..."
kubectl apply -f "$PROJECT_ROOT/k8s/06-backend.yaml"

echo "  7️⃣  Deploying Frontend (optional)..."
read -p "Do you want to deploy the frontend? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl apply -f "$PROJECT_ROOT/k8s/07-frontend.yaml"
fi

echo "  8️⃣  Deploying Monitoring stack (Loki, Promtail, Grafana)..."
kubectl apply -f "$PROJECT_ROOT/k8s/08-loki.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/09-promtail.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/10-grafana.yaml"

echo ""
echo "✅ All services deployed!"
echo ""
echo "📊 Checking pod status..."
kubectl get pods -n tiketi

echo ""
echo "📌 Next steps:"
echo "   1. Watch pod status: kubectl get pods -n tiketi -w"
echo "   2. Check logs: kubectl logs -n tiketi -l app=backend -f"
echo "   3. Setup port forwarding: ./scripts/port-forward-all.sh"
echo ""
echo "🌐 Access URLs (after port forwarding):"
echo "   - Backend API: http://localhost:3001"
echo "   - Frontend: http://localhost:3000"
echo "   - Grafana: http://localhost:3002 (admin/admin)"
echo ""
