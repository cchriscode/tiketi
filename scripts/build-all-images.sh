#!/bin/bash

# TIKETI - Build All Docker Images and Load to Kind
# Usage: ./scripts/build-all-images.sh

set -e  # Exit on error

CLUSTER_NAME="tiketi-local"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🚀 TIKETI - Building All Docker Images"
echo "========================================"
echo ""

cd "$PROJECT_ROOT"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to build and load image
build_and_load() {
    local service_name=$1
    local dockerfile_path=$2
    local context_path=$3
    local image_name="tiketi-${service_name}:local"

    echo -e "${BLUE}📦 Building ${service_name}...${NC}"
    docker build -t "$image_name" -f "$dockerfile_path" "$context_path"

    echo -e "${YELLOW}📥 Loading ${service_name} to Kind cluster...${NC}"
    kind load docker-image "$image_name" --name "$CLUSTER_NAME"

    echo -e "${GREEN}✅ ${service_name} complete${NC}"
    echo ""
}

# Check if Kind cluster exists
if ! kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
    echo -e "${YELLOW}⚠️  Warning: Kind cluster '${CLUSTER_NAME}' not found${NC}"
    echo "Please create the cluster first:"
    echo "  kind create cluster --name ${CLUSTER_NAME} --config k8s/kind-config.yaml"
    exit 1
fi

# Build all images
build_and_load "auth-service" "services/auth-service/Dockerfile" "."
build_and_load "ticket-service" "services/ticket-service/Dockerfile" "."
build_and_load "stats-service" "services/stats-service/Dockerfile" "."
build_and_load "payment-service" "services/payment-service/Dockerfile" "."
build_and_load "backend" "backend/Dockerfile" "backend"

# Build frontend with environment variables
echo -e "${BLUE}📦 Building frontend...${NC}"
docker build -t "tiketi-frontend:local" \
  --build-arg REACT_APP_API_URL=http://localhost:3001 \
  --build-arg REACT_APP_GOOGLE_CLIENT_ID=721028631258-dhjgd4gquphib49fsoitiubusbo3t9e9.apps.googleusercontent.com \
  -f "frontend/Dockerfile" "frontend"

echo -e "${YELLOW}📥 Loading frontend to Kind cluster...${NC}"
kind load docker-image "tiketi-frontend:local" --name "$CLUSTER_NAME"

echo -e "${GREEN}✅ frontend complete${NC}"
echo ""

echo -e "${GREEN}🎉 All images built and loaded successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Apply K8s configurations:"
echo "     kubectl apply -f k8s/04-backend.yaml"
echo "     kubectl apply -f k8s/07-frontend.yaml"
echo "     kubectl apply -f k8s/08-auth-service.yaml"
echo "     kubectl apply -f k8s/09-ticket-service.yaml"
echo "     kubectl apply -f k8s/10-stats-service.yaml"
echo "     kubectl apply -f k8s/11-payment-service.yaml"
echo ""
echo "  2. Setup port-forwarding:"
echo "     ./scripts/port-forward-all.sh"
echo ""
echo "  3. Access the application:"
echo "     Frontend: http://localhost:3000"
echo "     Backend:  http://localhost:3001"
