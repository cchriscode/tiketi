# 🚀 TIKETI - 시작 가이드

> 빠르게 시작하는 티켓팅 플랫폼 개발 환경 구축

---

## 📋 사전 요구사항

### 필수 설치
- **Docker Desktop** (Windows/Mac/Linux)
- **Git**

### 권장 사항
- Node.js 18+ (로컬 개발 시)
- VS Code + Docker 확장

---

## ⚡ 3분 빠른 시작

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd project-ticketing
```

### 2. 환경변수 설정 (선택)
```bash
# .env 파일이 없다면 예제 복사
cp .env.example .env
```

### 3. Docker Compose 실행
```bash
docker-compose up -d
```

이 명령어는 다음을 자동으로 실행합니다:
- PostgreSQL 데이터베이스 (포트 5432)
- DragonflyDB/Redis (포트 7379)
- 백엔드 API 서버 (포트 3001)
- 프론트엔드 앱 (포트 3000)

### 4. 서비스 확인

**프론트엔드**: http://localhost:3000
**백엔드 API**: http://localhost:3001/health (응답: `{"status":"OK"}`)

### 5. 관리자 로그인
```
이메일: admin@tiketi.gg
비밀번호: admin123
```

---

## 🖥️ OS별 가이드

### Windows

#### Docker Desktop 설치
https://www.docker.com/products/docker-desktop/

#### 실행 스크립트
```cmd
# 시작
start.bat

# 중지
stop.bat

# 로그 확인
docker-compose logs -f
```

#### 포트 충돌 확인
```cmd
netstat -ano | findstr :3000
netstat -ano | findstr :3001
```

---

### macOS

#### Docker Desktop 설치 (Homebrew)
```bash
brew install --cask docker
```

또는 직접 다운로드: https://www.docker.com/products/docker-desktop/

#### 실행 스크립트
```bash
# 권한 설정 (최초 1회)
chmod +x start.sh stop.sh logs.sh reset.sh

# 시작
./start.sh

# 중지
./stop.sh

# 로그 확인
./logs.sh

# 완전 초기화
./reset.sh
```

#### Apple Silicon (M1/M2/M3) 지원
모든 이미지가 ARM64 네이티브 지원! Rosetta 2 불필요 ✅

#### 포트 충돌 확인
```bash
lsof -i :3000
lsof -i :3001

# 프로세스 종료
kill -9 <PID>
```

#### 유용한 Alias 추가
```bash
# ~/.zshrc 또는 ~/.bash_profile
alias tiketi-start="cd ~/project-ticketing && ./start.sh"
alias tiketi-stop="cd ~/project-ticketing && ./stop.sh"
alias tiketi-logs="cd ~/project-ticketing && ./logs.sh"

# 적용
source ~/.zshrc
```

---

### Linux

#### Docker 설치
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install docker.io docker-compose

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER
```

#### 실행 방법
```bash
chmod +x start.sh stop.sh
./start.sh
```

---

## 🔍 서비스 상태 확인

### 컨테이너 상태
```bash
docker-compose ps
```

정상 실행 중이면:
```
NAME                  STATUS
tiketi-postgres       Up
tiketi-dragonfly      Up
tiketi-backend        Up
tiketi-frontend       Up
```

### 로그 확인
```bash
# 모든 서비스
docker-compose logs -f

# 특정 서비스
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### 백엔드 초기화 성공 메시지
```
✅ PostgreSQL is ready!
✅ Admin account created successfully
✅ Generated 265 seats for: 2024 콘서트 투어
🧹 Starting reservation cleaner
```

---

## 🎯 주요 기능 테스트

### 일반 사용자
1. **회원가입**: http://localhost:3000/register
2. **이벤트 보기**: 홈 페이지에서 샘플 이벤트 확인
3. **좌석 선택**: 이벤트 상세 → "좌석 선택하기"
4. **티켓 예매**: 좌석 선택 → 결제 수단 선택 → 결제
5. **예매 확인**: "내 예매" 메뉴에서 확인
6. **예매 취소**: 예매 상세 → "취소" 버튼

### 관리자
1. **대시보드**: http://localhost:3000/admin
2. **이벤트 생성**: "이벤트 관리" → "+ 새 이벤트"
3. **좌석 레이아웃 선택**: 소극장/대극장/스포츠 경기장
4. **예매 관리**: 모든 예매 내역 확인

---

## 💻 개발 모드 (선택사항)

Docker 없이 로컬에서 개발하려면:

### 1. PostgreSQL & Redis 실행 (Docker)
```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=tiketi_pass postgres:15
docker run -d -p 6379:6379 docker.dragonflydb.io/dragonflydb/dragonfly
```

### 2. 백엔드 실행
```bash
cd backend
npm install
npm run dev
```

### 3. 프론트엔드 실행
```bash
cd frontend
npm install
npm start
```

---

## 🐛 문제 해결

### 포트 충돌
다른 애플리케이션이 포트를 사용 중이면:
1. `docker-compose.yml`에서 포트 변경
2. 프론트엔드 `.env`의 `REACT_APP_API_URL`도 함께 변경

### Docker Desktop이 실행되지 않음
- Windows: "Cannot connect to Docker daemon" 에러
- 해결: Docker Desktop 실행 후 다시 시도

### 데이터베이스 초기화 실패
```bash
docker-compose down -v
docker-compose up -d
```
⚠️ 주의: 모든 데이터가 삭제됩니다!

### 컨테이너가 계속 재시작됨
```bash
docker-compose logs <service-name>
```
로그에서 오류 메시지 확인

### 코드 수정이 반영 안 됨
```bash
# 특정 서비스 재시작
docker-compose restart backend
docker-compose restart frontend

# 전체 재빌드
docker-compose up --build
```

### macOS에서 Docker가 느림
Docker Desktop → Preferences → Resources
- CPUs: 4 (권장)
- Memory: 8GB (권장)
- Apply & Restart

---

## 💡 개발 팁

### 데이터 완전 초기화
```bash
docker-compose down -v
docker volume prune
docker-compose up -d
```

### 핫 리로드 (코드 수정 시 자동 재시작)
- **백엔드**: nodemon이 변경사항 감지
- **프론트엔드**: React 개발 서버 자동 리로드

### 데이터베이스 직접 접속
```bash
docker exec -it tiketi-postgres psql -U tiketi_user -d tiketi

# 예: 이벤트 조회
SELECT * FROM events;

# 종료
\q
```

### Redis 캐시 확인
```bash
docker exec -it tiketi-dragonfly redis-cli

KEYS *                          # 모든 키 확인
GET events:on_sale:1:10         # 특정 캐시 확인
exit
```

### VS Code 통합 터미널
```bash
# 터미널 열기: Cmd/Ctrl + J
docker-compose up -d
```

---

## 📊 샘플 데이터

초기 데이터베이스에는 다음이 포함됩니다:
- 관리자 계정 1개
- 샘플 이벤트 3개 (콘서트, 뮤지컬, 스포츠)
- 각 이벤트별 좌석 자동 생성
- 좌석 레이아웃 템플릿 3개

---

## 📚 다음 단계

- [README.md](../README.md) - 전체 프로젝트 문서
- [ENV_VARIABLES.md](./03_ENV_VARIABLES.md) - 환경변수 설명
- [REALTIME_SYSTEM.md](./features/REALTIME_SYSTEM.md) - 실시간 기능
- [SEAT_SYSTEM.md](./features/SEAT_SYSTEM.md) - 좌석 시스템
- [GIT_GUIDE.md](./02_GIT_GUIDE.md) - Git 사용법

---

## ✅ 체크리스트

### 시작 전
- [ ] Docker Desktop 설치 및 실행
- [ ] Git 설치 확인
- [ ] 포트 3000, 3001, 5432, 6379 비어있음
- [ ] 충분한 디스크 공간 (최소 5GB)

### 첫 실행
- [ ] `docker-compose up -d` 성공
- [ ] http://localhost:3000 접속 성공
- [ ] admin@tiketi.gg로 로그인 성공
- [ ] 샘플 이벤트 3개 표시됨

---

## 🎉 완료!

이제 개발을 시작할 준비가 되었습니다!

문제가 발생하면:
1. 로그 확인: `docker-compose logs -f`
2. 완전 초기화: `docker-compose down -v && docker-compose up -d`
3. [GitHub Issues](repository-url/issues)에 문의
