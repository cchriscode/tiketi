#!/bin/bash

echo "🎫 TIKETI 티켓팅 시스템 시작 🎫"
echo "================================"
echo ""

# Docker 실행 확인
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker가 실행되지 않았습니다!"
    echo "👉 Docker Desktop을 실행해주세요."
    exit 1
fi

echo "✅ Docker 실행 확인"
echo ""

# 서비스 시작
echo "🚀 서비스 시작 중..."
docker-compose up -d

echo ""
echo "⏳ 서비스 초기화 대기 중 (30초)..."
sleep 30

echo ""
echo "================================"
echo "✅ TIKETI 시작 완료!"
echo "================================"
echo ""
echo "📱 프론트엔드: http://localhost:3000"
echo "🔧 백엔드 API: http://localhost:3001"
echo ""
echo "👤 테스트 계정:"
echo "   이메일: admin@tiketi.gg"
echo "   비밀번호: admin123"
echo ""
echo "🛑 중지: docker-compose down"
echo "📊 로그: docker-compose logs -f"
echo ""

