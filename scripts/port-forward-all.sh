#!/bin/bash

echo "🔌 Setting up port forwarding for Tiketi services..."
echo ""

# Check if cluster is running
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Kubernetes cluster is not accessible."
    exit 1
fi

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all port forwards..."
    jobs -p | xargs -r kill
    echo "✅ All port forwards stopped."
    exit 0
}

# Set trap to cleanup on Ctrl+C
trap cleanup SIGINT SIGTERM

echo "⏳ Waiting for pods to be ready..."
kubectl wait --for=condition=Ready pod -l app=backend -n tiketi --timeout=120s || echo "⚠️  Backend pod not ready yet"
kubectl wait --for=condition=Ready pod -l app=grafana -n tiketi --timeout=120s || echo "⚠️  Grafana pod not ready yet"

echo ""
echo "🔌 Starting port forwards..."
echo ""

# Backend API
echo "  📡 Backend API: localhost:3001 -> backend-service:3001"
kubectl port-forward -n tiketi service/backend-service 3001:3001 &
sleep 1

# Grafana Dashboard
echo "  📊 Grafana: localhost:3002 -> grafana-service:3000"
kubectl port-forward -n tiketi service/grafana-service 3002:3000 &
sleep 1

# PostgreSQL (for debugging)
echo "  🐘 PostgreSQL: localhost:5432 -> postgres-service:5432"
kubectl port-forward -n tiketi service/postgres-service 5432:5432 &
sleep 1

# DragonflyDB (for debugging)
echo "  🔴 DragonflyDB: localhost:6379 -> dragonfly-service:6379"
kubectl port-forward -n tiketi service/dragonfly-service 6379:6379 &
sleep 1

# Frontend (if deployed)
if kubectl get service/frontend-service -n tiketi &> /dev/null; then
    echo "  🌐 Frontend: localhost:3000 -> frontend-service:3000"
    kubectl port-forward -n tiketi service/frontend-service 3000:3000 &
    sleep 1
fi

echo ""
echo "✅ Port forwarding active!"
echo ""
echo "🌐 Access URLs:"
echo "  - Backend API: http://localhost:3001"
echo "  - Backend Health: http://localhost:3001/api/health"
echo "  - Grafana: http://localhost:3002 (admin/admin)"
if kubectl get service/frontend-service -n tiketi &> /dev/null; then
    echo "  - Frontend: http://localhost:3000"
fi
echo ""
echo "🔧 Database connections (for debugging):"
echo "  - PostgreSQL: localhost:5432"
echo "  - DragonflyDB: localhost:6379"
echo ""
echo "💡 Press Ctrl+C to stop all port forwards"
echo ""

# Wait for all background processes
wait
