#!/bin/bash

# Test script - Frontend port forward only
echo "Testing Frontend port forward..."

# Kill existing
pkill -f "kubectl port-forward" 2>/dev/null || true
sleep 2

# Check service exists
echo "Checking if frontend-service exists..."
kubectl get service/frontend-service -n tiketi

# Start port forward in foreground for testing
echo ""
echo "Starting port forward (foreground - Ctrl+C to stop)..."
echo "kubectl port-forward -n tiketi service/frontend-service 3000:3000"
echo ""

kubectl port-forward -n tiketi service/frontend-service 3000:3000
