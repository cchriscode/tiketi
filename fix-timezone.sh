#!/bin/bash

# Fix Timezone Configuration Script
# 한국 시간(Asia/Seoul)으로 통일

set -e

echo ""
echo "=========================================="
echo "  Timezone Fix Script"
echo "  모든 서비스를 한국 시간으로 통일합니다"
echo "=========================================="
echo ""

cd /mnt/c/Users/USER/project-ticketing

# 1. ConfigMap 업데이트
echo "1️⃣  ConfigMap 업데이트 중..."
kubectl apply -k k8s/overlays/dev
echo "   ✅ ConfigMap 업데이트 완료"
echo ""

# 2. PostgreSQL 재시작
echo "2️⃣  PostgreSQL 재시작 중..."
kubectl rollout restart deployment/postgres -n tiketi
kubectl rollout status deployment/postgres -n tiketi --timeout=120s
echo "   ✅ PostgreSQL 재시작 완료"
echo ""

# 3. PostgreSQL timezone 설정 업데이트
echo "3️⃣  PostgreSQL timezone 설정 중..."
sleep 5  # Wait for PostgreSQL to be fully ready

POD_NAME=$(kubectl get pods -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}')
echo "   PostgreSQL Pod: $POD_NAME"

# Set timezone in PostgreSQL
kubectl exec -n tiketi $POD_NAME -- psql -U tiketi_user -d tiketi -c "ALTER DATABASE tiketi SET timezone TO 'Asia/Seoul';"
kubectl exec -n tiketi $POD_NAME -- psql -U tiketi_user -d tiketi -c "SELECT current_setting('TIMEZONE');"

echo "   ✅ PostgreSQL timezone 설정 완료"
echo ""

# 4. 모든 서비스 재시작 (TZ 환경 변수 적용)
echo "4️⃣  모든 서비스 재시작 중..."

DEPLOYMENTS=(
  "backend"
  "auth-service"
  "payment-service"
  "ticket-service"
  "stats-service"
  "frontend"
)

for deployment in "${DEPLOYMENTS[@]}"; do
  echo "   🔄 $deployment 재시작 중..."
  kubectl rollout restart deployment/$deployment -n tiketi 2>/dev/null || echo "   ℹ️  $deployment not found (스킵)"
done

echo ""
echo "   ⏳ 서비스 준비 대기 중..."
sleep 10

echo ""
echo "=========================================="
echo "  ✅ Timezone 설정 완료!"
echo "=========================================="
echo ""
echo "모든 서비스가 한국 시간(Asia/Seoul)을 사용합니다."
echo ""
echo "확인 방법:"
echo "  ./scripts/show-access-url.sh"
echo ""
