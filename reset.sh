#!/bin/bash

echo "⚠️  TIKETI 완전 초기화"
echo "================================"
echo ""
echo "주의: 모든 데이터가 삭제됩니다!"
echo ""
read -p "계속하시겠습니까? (y/N): " confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "취소되었습니다."
    exit 0
fi

echo ""
echo "🗑️  모든 컨테이너 및 볼륨 삭제 중..."
docker-compose down -v

echo ""
echo "🚀 새로 시작 중..."
docker-compose up -d

echo ""
echo "⏳ 서비스 초기화 대기 중 (30초)..."
sleep 30

echo ""
echo "✅ 초기화 완료!"
echo ""
echo "📱 http://localhost:3000 에서 확인하세요."
echo ""

