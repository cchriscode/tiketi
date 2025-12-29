#!/bin/bash

# Rebuild and deploy frontend with fixes
# WSL IP 지원 + Payment Service 연결 수정

set -e

echo ""
echo "=========================================="
echo "  Frontend Rebuild & Deploy"
echo "=========================================="
echo ""

cd /mnt/c/Users/USER/project-ticketing

# 1. Build frontend Docker image
echo "1️⃣  Building frontend Docker image..."
docker build -t tiketi-frontend:local -f frontend/Dockerfile frontend
echo "   ✅ Frontend image built"
echo ""

# 2. Load into Kind cluster
echo "2️⃣  Loading image into Kind cluster..."
kind load docker-image tiketi-frontend:local --name tiketi-local
echo "   ✅ Image loaded into cluster"
echo ""

# 3. Restart frontend deployment
echo "3️⃣  Restarting frontend deployment..."
kubectl rollout restart deployment/frontend -n tiketi
echo "   ✅ Deployment restarted"
echo ""

# 4. Wait for rollout
echo "4️⃣  Waiting for new pods to be ready..."
kubectl rollout status deployment/frontend -n tiketi --timeout=120s
echo "   ✅ Frontend ready"
echo ""

echo "=========================================="
echo "  ✅ Frontend Deployment Complete!"
echo "=========================================="
echo ""
echo "Changes applied:"
echo "  • WSL IP support for API calls"
echo "  • Payment Service direct connection (port 3003)"
echo "  • Socket.IO WSL IP support"
echo ""
echo "Test the payment flow:"
echo "  1. ./scripts/show-access-url.sh"
echo "  2. Access frontend from Windows Chrome"
echo "  3. Login and try Toss Payments"
echo ""
