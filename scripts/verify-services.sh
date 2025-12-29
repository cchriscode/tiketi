#!/bin/bash

# TIKETI - Service Verification Script
# Verifies all services are accessible and healthy

echo "=========================================="
echo "  TIKETI Service Verification"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to test HTTP endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "Testing $name... "

    # Use curl with timeout
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 "$url" 2>/dev/null)

    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP ${response:-timeout})"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Function to test TCP port
test_port() {
    local name=$1
    local host=$2
    local port=$3

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "Testing $name... "

    if timeout 3 bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null; then
        echo -e "${GREEN}✓ PASS${NC} (port $port open)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL${NC} (port $port not reachable)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Frontend Service"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Frontend" "http://localhost:3000" "200"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Backend Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Backend Health" "http://localhost:3001/health" "200"
test_endpoint "Auth Health" "http://localhost:3002/health" "200"
test_endpoint "Payment Health" "http://localhost:3003/health" "200"
test_endpoint "Ticket Health" "http://localhost:3004/health" "200"
test_endpoint "Stats Health" "http://localhost:3005/health" "200"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 Database Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_port "PostgreSQL" "localhost" "5432"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All services are healthy!${NC}"
    echo ""
    echo "🎉 You can now access:"
    echo "   Frontend: http://localhost:3000"
    echo "   Login with: admin@tiketi.gg / admin123"
    exit 0
else
    echo -e "${RED}✗ Some services failed health checks${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if port forwarding is running:"
    echo "     ps aux | grep 'port-forward'"
    echo ""
    echo "  2. Check pod status:"
    echo "     kubectl get pods -n tiketi"
    echo ""
    echo "  3. Check pod logs:"
    echo "     kubectl logs -n tiketi deployment/<service-name>"
    echo ""
    echo "  4. Restart port forwarding:"
    echo "     ./scripts/port-forward-all.sh"
    exit 1
fi
