@echo off
chcp 65001 >nul
echo 📤 Git에 프로젝트 업로드하기
echo ================================
echo.

REM Git 설치 확인
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git이 설치되지 않았습니다!
    echo 👉 https://git-scm.com/download/win 에서 다운로드하세요.
    pause
    exit /b 1
)

echo ✅ Git 설치 확인
echo.

REM Git 초기화 확인
if not exist .git (
    echo 🆕 Git 초기화 중...
    git init
    git branch -M main
    echo.
)

REM 상태 확인
echo 📋 현재 상태:
git status
echo.

REM 사용자 확인
set /p confirm="모든 변경사항을 커밋하시겠습니까? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo 취소되었습니다.
    pause
    exit /b 0
)

echo.
echo 📝 커밋 메시지를 입력하세요:
set /p message="메시지: "

if "%message%"=="" (
    set message=Update: 프로젝트 업데이트
)

echo.
echo 💾 변경사항 추가 중...
git add .

echo ✍️  커밋 중...
git commit -m "%message%"

echo.
echo 📡 원격 저장소 확인...
git remote -v

REM 원격 저장소가 없으면 추가 안내
git remote | findstr origin >nul
if errorlevel 1 (
    echo.
    echo ⚠️  원격 저장소가 설정되지 않았습니다!
    echo.
    echo 다음 명령어를 실행하세요:
    echo git remote add origin https://github.com/본인계정/저장소명.git
    echo git push -u origin main
    echo.
    pause
    exit /b 0
)

echo.
set /p push="GitHub에 푸시하시겠습니까? (Y/N): "
if /i not "%push%"=="Y" (
    echo 커밋만 완료되었습니다.
    pause
    exit /b 0
)

echo.
echo 🚀 푸시 중...
git push

if errorlevel 1 (
    echo.
    echo ⚠️  푸시 실패! 다음을 시도하세요:
    echo git push -u origin main
    echo.
) else (
    echo.
    echo ================================
    echo ✅ GitHub 업로드 완료!
    echo ================================
)

echo.
pause

