@echo off
chcp 65001 >nul
echo 🎫 TIKETI 티켓팅 시스템 시작 🎫
echo ================================
echo.

REM Docker 실행 확인
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker가 실행되지 않았습니다!
    echo 👉 Docker Desktop을 실행해주세요.
    pause
    exit /b 1
)

echo ✅ Docker 실행 확인
echo.

REM 서비스 시작
echo 🚀 서비스 시작 중...
docker-compose up -d

echo.
echo ⏳ 서비스 초기화 대기 중 (30초)...
timeout /t 30 /nobreak >nul

echo.
echo ================================
echo ✅ TIKETI 시작 완료!
echo ================================
echo.
echo 📱 프론트엔드: http://localhost:3000
echo 🔧 백엔드 API: http://localhost:3001
echo.
echo 👤 테스트 계정:
echo    이메일: admin@tiketi.gg
echo    비밀번호: admin123
echo.
echo 🛑 중지: docker-compose down
echo 📊 로그: docker-compose logs -f
echo.
echo 브라우저가 자동으로 열립니다...
timeout /t 3 /nobreak >nul
start http://localhost:3000

pause

