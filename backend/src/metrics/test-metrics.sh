#!/bin/bash

echo "🔥 API 부하 테스트 시작..."

# 100번 요청
for i in {1..100}; do
  curl -s http://localhost:3001/api/events > /dev/null
  curl -s http://localhost:3001/api/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test","password":"test"}' > /dev/null
  echo -n "."
done

echo ""
echo "✅ 100개 요청 완료!"
echo "📊 메트릭 확인: curl http://localhost:3001/metrics | grep http_request"