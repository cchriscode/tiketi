#!/bin/bash

# TIKETI - Port Forward All Services
# Sets up port forwarding for all TIKETI microservices

echo "🔌 Setting up port forwarding for TIKETI services..."
echo ""

# Check if cluster is running
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Kubernetes cluster is not accessible."
    echo "Please ensure your Kind cluster is running:"
    echo "  kind create cluster --name tiketi-local --config k8s/kind-config.yaml"
    exit 1
fi

# Check if tiketi namespace exists
if ! kubectl get namespace tiketi &> /dev/null; then
    echo "❌ Namespace 'tiketi' not found."
    echo "Please create the namespace first:"
    echo "  kubectl create namespace tiketi"
    exit 1
fi

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all port forwards..."
    jobs -p | xargs -r kill 2>/dev/null
    echo "✅ All port forwards stopped."
    exit 0
}

# Set trap to cleanup on Ctrl+C
trap cleanup SIGINT SIGTERM

echo "⏳ Waiting for pods to be ready..."
kubectl wait --for=condition=Ready pod -l app=postgres -n tiketi --timeout=60s || echo "⚠️  PostgreSQL pod not ready yet"
kubectl wait --for=condition=Ready pod -l app=backend -n tiketi --timeout=60s || echo "⚠️  Backend pod not ready yet"
kubectl wait --for=condition=Ready pod -l app=auth-service -n tiketi --timeout=60s || echo "⚠️  Auth Service pod not ready yet"
kubectl wait --for=condition=Ready pod -l app=ticket-service -n tiketi --timeout=60s || echo "⚠️  Ticket Service pod not ready yet"
kubectl wait --for=condition=Ready pod -l app=stats-service -n tiketi --timeout=60s || echo "⚠️  Stats Service pod not ready yet"
kubectl wait --for=condition=Ready pod -l app=payment-service -n tiketi --timeout=60s || echo "⚠️  Payment Service pod not ready yet"
kubectl wait --for=condition=Ready pod -l app=frontend -n tiketi --timeout=60s || echo "⚠️  Frontend pod not ready yet"

echo ""
echo "🔌 Starting port forwards..."
echo ""

# Frontend (Port 3000 -> Service port 3000 -> Container port 3000)
if kubectl get service/frontend-service -n tiketi &> /dev/null; then
    echo "  🌐 Frontend: localhost:3000 -> frontend-service:3000"
    kubectl port-forward --address 0.0.0.0 -n tiketi service/frontend-service 3000:3000 > /dev/null 2>&1 &
    PF_PID=$!
    sleep 2
    # Verify port forward started successfully
    if ! kill -0 $PF_PID 2>/dev/null; then
        echo "     ⚠️  Warning: Frontend port-forward may have failed"
    fi
fi

# Backend (Legacy API - Port 3001)
if kubectl get service/backend-service -n tiketi &> /dev/null; then
    echo "  📡 Backend API: localhost:3001 -> backend-service:3001"
    kubectl port-forward --address 0.0.0.0 -n tiketi service/backend-service 3001:3001 > /dev/null 2>&1 &
    sleep 2
fi

# Auth Service (Port 3005)
if kubectl get service/auth-service -n tiketi &> /dev/null; then
    echo "  🔐 Auth Service: localhost:3005 -> auth-service:3005"
    kubectl port-forward --address 0.0.0.0 -n tiketi service/auth-service 3005:3005 > /dev/null 2>&1 &
    sleep 2
fi

# Ticket Service (Port 3002)
if kubectl get service/ticket-service -n tiketi &> /dev/null; then
    echo "  🎫 Ticket Service: localhost:3002 -> ticket-service:3002"
    kubectl port-forward --address 0.0.0.0 -n tiketi service/ticket-service 3002:3002 > /dev/null 2>&1 &
    sleep 2
fi

# Payment Service (Port 3003)
if kubectl get service/payment-service -n tiketi &> /dev/null; then
    echo "  💳 Payment Service: localhost:3003 -> payment-service:3003"
    kubectl port-forward --address 0.0.0.0 -n tiketi service/payment-service 3003:3003 > /dev/null 2>&1 &
    sleep 2
fi

# Stats Service (Port 3004)
if kubectl get service/stats-service -n tiketi &> /dev/null; then
    echo "  📊 Stats Service: localhost:3004 -> stats-service:3004"
    kubectl port-forward --address 0.0.0.0 -n tiketi service/stats-service 3004:3004 > /dev/null 2>&1 &
    sleep 2
fi

# PostgreSQL (Port 5432 - for debugging)
if kubectl get service/postgres-service -n tiketi &> /dev/null; then
    echo "  🐘 PostgreSQL: localhost:5432 -> postgres-service:5432"
    kubectl port-forward --address 0.0.0.0 -n tiketi service/postgres-service 5432:5432 > /dev/null 2>&1 &
    sleep 2
fi

# Grafana (if exists)
if kubectl get service/grafana-service -n tiketi &> /dev/null; then
    echo "  📈 Grafana: localhost:3010 -> grafana-service:3000"
    kubectl port-forward --address 0.0.0.0 -n tiketi service/grafana-service 3010:3000 > /dev/null 2>&1 &
    sleep 2
fi

# DragonflyDB (if exists - for caching)
if kubectl get service/dragonfly-service -n tiketi &> /dev/null; then
    echo "  🔴 DragonflyDB: localhost:6379 -> dragonfly-service:6379"
    kubectl port-forward --address 0.0.0.0 -n tiketi service/dragonfly-service 6379:6379 > /dev/null 2>&1 &
    sleep 2
fi

echo ""
echo "✅ Port forwarding active!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Frontend & User Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if kubectl get service/frontend-service -n tiketi &> /dev/null; then
    echo "  Frontend:        http://localhost:3000"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Backend Services & APIs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if kubectl get service/backend-service -n tiketi &> /dev/null; then
    echo "  Backend API:     http://localhost:3001"
    echo "  Backend Health:  http://localhost:3001/health"
fi
if kubectl get service/auth-service -n tiketi &> /dev/null; then
    echo "  Auth Service:    http://localhost:3005/health"
fi
if kubectl get service/ticket-service -n tiketi &> /dev/null; then
    echo "  Ticket Service:  http://localhost:3002/health"
fi
if kubectl get service/payment-service -n tiketi &> /dev/null; then
    echo "  Payment Service: http://localhost:3003/health"
fi
if kubectl get service/stats-service -n tiketi &> /dev/null; then
    echo "  Stats Service:   http://localhost:3004/health"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 Database & Infrastructure (for debugging)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if kubectl get service/postgres-service -n tiketi &> /dev/null; then
    echo "  PostgreSQL:      localhost:5432"
    echo "    psql -h localhost -U tiketi_user -d tiketi"
fi
if kubectl get service/dragonfly-service -n tiketi &> /dev/null; then
    echo "  DragonflyDB:     localhost:6379"
    echo "    redis-cli -h localhost -p 6379"
fi
if kubectl get service/grafana-service -n tiketi &> /dev/null; then
    echo "  Grafana:         http://localhost:3010 (admin/admin)"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Quick Test Commands:"
echo "  # Test all health endpoints"
echo "  curl http://localhost:3001/health  # Backend"
echo "  curl http://localhost:3005/health  # Auth"
echo "  curl http://localhost:3002/health  # Ticket"
echo "  curl http://localhost:3003/health  # Payment"
echo "  curl http://localhost:3004/health  # Stats"
echo ""
echo "  # View service logs"
echo "  kubectl logs -f -n tiketi deployment/auth-service"
echo "  kubectl logs -f -n tiketi deployment/payment-service"
echo ""
echo "  # Check pod status"
echo "  kubectl get pods -n tiketi"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Press Ctrl+C to stop all port forwards"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Wait for all background processes
wait
