@echo off
chcp 65001 >nul
echo 📊 TIKETI 로그 확인
echo ================================
echo.
echo 로그를 보려면 Ctrl+C로 종료하세요.
echo.

docker-compose logs -f

