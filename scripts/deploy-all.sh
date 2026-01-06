#!/bin/bash

set -e

echo "?? Deploying all services to Kind cluster..."

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check if cluster exists
if ! kubectl cluster-info &> /dev/null; then
    echo "??Kubernetes cluster is not accessible."
    echo "   Please create Kind cluster first: ./scripts/kind-cluster-create.sh"
    exit 1
fi


echo "Applying Kustomize overlay (dev)..."

# Apply manifests via Kustomize (dev)
echo "  1) Applying core services (Kustomize dev overlay)..."
kubectl apply -k "$PROJECT_ROOT/k8s/overlays/dev"

echo "  Waiting for databases to be ready..."
kubectl wait --for=condition=Ready pod -l app=postgres -n tiketi --timeout=120s || true
kubectl wait --for=condition=Ready pod -l app=dragonfly -n tiketi --timeout=120s || true
sleep 5

echo "  2) Deploying Frontend (optional, legacy manifest)..."
read -p "Do you want to deploy the frontend? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl apply -f "$PROJECT_ROOT/k8s/07-frontend.yaml"
fi

echo "  3) Deploying Monitoring stack (Loki, Promtail, Grafana)..."
kubectl apply -f "$PROJECT_ROOT/k8s/08-loki.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/09-promtail.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/10-grafana.yaml"
echo ""
echo "??All services deployed!"
echo ""
echo "?ìä Checking pod status..."
kubectl get pods -n tiketi

echo ""
echo "?ìå Next steps:"
echo "   1. Initialize database (first-time only): ./scripts/2-setup-database.sh"
echo "   2. Watch pod status: kubectl get pods -n tiketi -w"
echo "   3. Check logs: kubectl logs -n tiketi -l app=backend -f"
echo "   4. Setup port forwarding: ./scripts/port-forward-all.sh"
echo ""
echo "?åê Access URLs (after port forwarding):"
echo "   - Backend API: http://localhost:3001"
echo "   - Frontend: http://localhost:3000"
echo "   - Grafana: http://localhost:3002 (admin/admin)"
echo ""
