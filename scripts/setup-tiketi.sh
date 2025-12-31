#!/bin/bash
set -e

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_DIR"

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║                                                ║"
echo "║       TIKETI - Complete Setup Script          ║"
echo "║                                                ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "This script will:"
echo "  1. Create Kind cluster (3 nodes) and namespace"
echo "  2. Setup PostgreSQL with base data and MSA schemas"
echo "  3. Build all Docker images (6 images)"
echo "  4. Deploy all services to Kubernetes"
echo "  5. Verify system health"
echo ""
echo "Estimated time: 5-10 minutes"
echo "Requirements: Docker, Kind, kubectl, npm"
echo ""

# Check requirements
echo "🔍 Checking requirements..."

if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed"
  exit 1
fi

if ! command -v kind &> /dev/null; then
  echo "❌ Kind is not installed"
  exit 1
fi

if ! command -v kubectl &> /dev/null; then
  echo "❌ kubectl is not installed"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "❌ npm is not installed"
  exit 1
fi

echo "✅ All requirements met"
echo ""

# Confirm
if [ -t 0 ]; then
  read -p "Continue? (Y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

echo ""
START_TIME=$(date +%s)

# Step 1: Cluster Setup
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 1/4: Cluster Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ! bash "$SCRIPT_DIR/1-setup-cluster.sh"; then
  echo ""
  echo "❌ Cluster setup failed"
  exit 1
fi

# Step 2: Database Setup
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 2/4: Database Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ! bash "$SCRIPT_DIR/2-setup-database.sh"; then
  echo ""
  echo "❌ Database setup failed"
  exit 1
fi

# Step 3: Build & Deploy
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 3/4: Build & Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ! bash "$SCRIPT_DIR/3-build-and-deploy.sh"; then
  echo ""
  echo "❌ Build and deploy failed"
  exit 1
fi

# Step 4: Verification
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 4/4: System Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔍 Verifying all services..."

# Get database pod
POSTGRES_POD=$(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -z "$POSTGRES_POD" ]; then
  echo "⚠️  PostgreSQL pod not found"
else
  # Check database
  EVENT_COUNT=$(kubectl exec -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi -t -c "SELECT COUNT(*) FROM ticket_schema.events" 2>/dev/null | tr -d ' ' || echo "0")

  if [ "$EVENT_COUNT" -ge 20 ]; then
    echo "✅ Database: $EVENT_COUNT events"
  else
    echo "⚠️  Database: Only $EVENT_COUNT events (expected 20+)"
  fi
fi

# Check all pods
echo ""
echo "📊 Pod Status:"
kubectl get pods -n tiketi

# Count ready pods
TOTAL_PODS=$(kubectl get pods -n tiketi --no-headers 2>/dev/null | wc -l | tr -d ' ')
READY_PODS=$(kubectl get pods -n tiketi --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')

echo ""
if [ "$READY_PODS" -eq "$TOTAL_PODS" ] && [ "$TOTAL_PODS" -ge 10 ]; then
  echo "✅ All pods running ($READY_PODS/$TOTAL_PODS)"
else
  echo "⚠️  Some pods not ready ($READY_PODS/$TOTAL_PODS)"
fi

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║                                                ║"
echo "║         🎉 TIKETI Setup Complete! 🎉          ║"
echo "║                                                ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "⏱️  Total time: ${MINUTES}m ${SECONDS}s"
echo ""
echo "📊 System Summary:"
echo "  • Cluster: tiketi-local (3 nodes)"
echo "  • Namespace: tiketi"
echo "  • Running Pods: $READY_PODS/$TOTAL_PODS"
echo "  • Database Events: $EVENT_COUNT"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "  1. Start port-forwarding:"
echo "     Windows: .\\start_port_forwards.ps1"
echo "     Linux:   ./scripts/port-forward-all.sh"
echo ""
echo "  2. Verify all services:"
echo "     ./scripts/verify-services.sh"
echo ""
echo "  3. Access the application:"
echo "     🌐 Frontend:  http://localhost:3000"
echo "     🔧 Backend:   http://localhost:3001"
echo "     🔐 Auth:      http://localhost:3005"
echo "     💳 Payment:   http://localhost:3003"
echo "     🎫 Ticket:    http://localhost:3002"
echo "     📊 Stats:     http://localhost:3004"
echo ""
echo "  4. Admin Login:"
echo "     Email:    admin@tiketi.gg"
echo "     Password: admin123"
echo ""
echo "  5. View all available scripts:"
echo "     See SCRIPTS.md for complete reference"
echo ""
echo "  6. View logs (if needed):"
echo "     kubectl logs -n tiketi <pod-name>"
echo ""
echo "  7. To reset everything:"
echo "     ./scripts/cleanup.sh"
echo ""
echo "Happy ticketing! 🎫"
echo ""
