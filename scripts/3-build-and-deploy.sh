#!/bin/bash
set -e

echo "=========================================="
echo "  TIKETI - Build & Deploy"
echo "=========================================="
echo ""

# Check if running from project root
if [ ! -f "backend/Dockerfile" ]; then
  echo "??Error: Must run from project root directory"
  echo "   Current directory: $(pwd)"
  exit 1
fi

# Install monorepo packages
echo "?ì¶ Installing monorepo packages..."
echo "  ??@tiketi/common"
echo "  ??@tiketi/database"
echo "  ??@tiketi/metrics"
echo ""

# Install packages in parallel
(cd packages/common && npm install --silent --loglevel=error) &
PID1=$!
(cd packages/database && npm install --silent --loglevel=error) &
PID2=$!
(cd packages/metrics && npm install --silent --loglevel=error) &
PID3=$!

# Wait for all to complete
wait $PID1 || { echo "??Failed to install @tiketi/common"; exit 1; }
wait $PID2 || { echo "??Failed to install @tiketi/database"; exit 1; }
wait $PID3 || { echo "??Failed to install @tiketi/metrics"; exit 1; }

echo "??All monorepo packages installed"

# Build Docker images
echo ""
echo "?ê≥ Building Docker images..."
echo "   This may take 5-10 minutes on first build..."
echo ""

echo "  [1/6] Backend..."
if ! docker build -t tiketi-backend:local -f backend/Dockerfile backend > /dev/null; then
  echo "??Failed to build backend image"
  docker build -t tiketi-backend:local -f backend/Dockerfile backend
  exit 1
fi
echo "  ??Backend image built"

echo "  [2/6] Auth Service..."
if ! docker build -t tiketi-auth-service:local -f services/auth-service/Dockerfile . > /dev/null; then
  echo "??Failed to build auth-service image"
  docker build -t tiketi-auth-service:local -f services/auth-service/Dockerfile .
  exit 1
fi
echo "  ??Auth Service image built"

echo "  [3/6] Ticket Service..."
if ! docker build -t tiketi-ticket-service:local -f services/ticket-service/Dockerfile . > /dev/null; then
  echo "??Failed to build ticket-service image"
  docker build -t tiketi-ticket-service:local -f services/ticket-service/Dockerfile .
  exit 1
fi
echo "  ??Ticket Service image built"

echo "  [4/6] Stats Service..."
if ! docker build -t tiketi-stats-service:local -f services/stats-service/Dockerfile . > /dev/null; then
  echo "??Failed to build stats-service image"
  docker build -t tiketi-stats-service:local -f services/stats-service/Dockerfile .
  exit 1
fi
echo "  ??Stats Service image built"

echo "  [5/6] Payment Service..."
if ! docker build -t tiketi-payment-service:local -f services/payment-service/Dockerfile . > /dev/null; then
  echo "??Failed to build payment-service image"
  docker build -t tiketi-payment-service:local -f services/payment-service/Dockerfile .
  exit 1
fi
echo "  ??Payment Service image built"

echo "  [6/6] Frontend..."
if ! docker build -t tiketi-frontend:local \
  --build-arg REACT_APP_API_URL=http://localhost:3001 \
  --build-arg REACT_APP_GOOGLE_CLIENT_ID=721028631258-dhjgd4gquphib49fsoitiubusbo3t9e9.apps.googleusercontent.com \
  -f frontend/Dockerfile frontend > /dev/null; then
  echo "??Failed to build frontend image"
  docker build -t tiketi-frontend:local \
    --build-arg REACT_APP_API_URL=http://localhost:3001 \
    --build-arg REACT_APP_GOOGLE_CLIENT_ID=721028631258-dhjgd4gquphib49fsoitiubusbo3t9e9.apps.googleusercontent.com \
    -f frontend/Dockerfile frontend
  exit 1
fi
echo "  ??Frontend image built"

echo ""
echo "??All Docker images built successfully"

# Load images to Kind
echo ""
echo "?ì§ Loading images to Kind cluster..."
echo "   This may take 2-3 minutes..."
echo ""

IMAGES=(
  "tiketi-backend:local"
  "tiketi-auth-service:local"
  "tiketi-ticket-service:local"
  "tiketi-stats-service:local"
  "tiketi-payment-service:local"
  "tiketi-frontend:local"
)

IMAGE_NAMES=(
  "Backend"
  "Auth Service"
  "Ticket Service"
  "Stats Service"
  "Payment Service"
  "Frontend"
)

for i in "${!IMAGES[@]}"; do
  echo "  [$((i+1))/6] ${IMAGE_NAMES[$i]}..."
  if ! kind load docker-image "${IMAGES[$i]}" --name tiketi-local > /dev/null 2>&1; then
    echo "??Failed to load ${IMAGE_NAMES[$i]} to Kind"
    exit 1
  fi
done

echo ""
echo "??All images loaded to Kind cluster"

# Deploy core services via Kustomize (dev overlay)
echo ""
echo "Deploying core services (Kustomize dev overlay)..."

if ! kubectl apply -k k8s/overlays/dev > /dev/null 2>&1; then
  echo "Failed to apply dev overlay"
  exit 1
fi

echo "Dev overlay applied"

# Wait for PostgreSQL and Dragonfly
echo ""
echo "Waiting for PostgreSQL and Dragonfly to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n tiketi --timeout=120s || {
  echo "PostgreSQL not ready yet, continuing anyway..."
}
kubectl wait --for=condition=ready pod -l app=dragonfly -n tiketi --timeout=60s || {
  echo "Dragonfly not ready yet, continuing anyway..."
}

# Deploy monitoring stack (optional)
echo ""
echo "Deploying monitoring stack (Loki, Promtail, Grafana)..."

MONITORING_FILES=(
  "k8s/08-loki.yaml"
  "k8s/09-promtail.yaml"
  "k8s/10-grafana.yaml"
)

for file in "${MONITORING_FILES[@]}"; do
  if ! kubectl apply -f "$file" > /dev/null 2>&1; then
    echo "Failed to apply $file"
    exit 1
  fi
done

echo "Monitoring stack deployed"

# Deploy frontend (legacy manifest)
echo ""
echo "Deploying frontend (legacy manifest)..."
if ! kubectl apply -f "k8s/07-frontend.yaml" > /dev/null 2>&1; then
  echo "Failed to apply k8s/07-frontend.yaml"
  exit 1
fi

echo "Frontend deployed"
# Wait for deployments
echo ""
echo "??Waiting for all pods to be ready..."
echo "   This may take 1-2 minutes..."
echo ""

DEPLOYMENTS=(
  "backend"
  "auth-service"
  "ticket-service"
  "stats-service"
  "payment-service"
  "frontend"
)

TOTAL=${#DEPLOYMENTS[@]}
READY=0

for deployment in "${DEPLOYMENTS[@]}"; do
  echo "  Waiting for $deployment..."

  if kubectl wait --for=condition=ready pod -l app=$deployment -n tiketi --timeout=120s > /dev/null 2>&1; then
    echo "  ??$deployment is ready"
    READY=$((READY + 1))
  else
    echo "  ?†Ô∏è  $deployment not ready (timeout)"
    echo "     Checking pod status..."
    kubectl get pods -n tiketi -l app=$deployment
    kubectl logs -n tiketi -l app=$deployment --tail=20 || true
  fi
done

echo ""
if [ "$READY" -eq "$TOTAL" ]; then
  echo "??All pods are ready ($READY/$TOTAL)"
else
  echo "?†Ô∏è  Some pods are not ready ($READY/$TOTAL)"
  echo ""
  echo "Pod status:"
  kubectl get pods -n tiketi
  echo ""
  echo "You can check logs with: kubectl logs -n tiketi <pod-name>"
fi

echo ""
echo "=========================================="
echo "  ??Build & Deploy Complete!"
echo "=========================================="
echo ""

# Show status
echo "?ìä Current Status:"
kubectl get pods -n tiketi

echo ""
echo "?åê Access URLs (after port-forward):"
echo "  ??Frontend:  http://localhost:3000"
echo "  ??Backend:   http://localhost:3001"
echo "  ??Auth:      http://localhost:3005"
echo "  ??Payment:   http://localhost:3003"
echo "  ??Ticket:    http://localhost:3002"
echo "  ??Stats:     http://localhost:3004"
echo ""
echo "?îå Start port-forwarding:"
echo "  Windows: .\\start_port_forwards.ps1"
echo "  Linux:   ./scripts/port-forward-all.sh"
echo ""
