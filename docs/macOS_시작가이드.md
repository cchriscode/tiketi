# 🍎 TIKETI - macOS 시작 가이드

## ⚡ 3분 시작

### 1️⃣ Docker Desktop 설치

#### Homebrew 사용 (권장)
```bash
brew install --cask docker
```

#### 직접 다운로드
https://www.docker.com/products/docker-desktop/

설치 후 **Docker Desktop 실행** (상단 메뉴바에 고래 아이콘 확인)

---

### 2️⃣ 프로젝트 클론
```bash
git clone <저장소-주소>
cd tiketi
```

---

### 3️⃣ 실행

#### 방법 1: 스크립트 사용 (간편!)
```bash
chmod +x start.sh
./start.sh
```

#### 방법 2: 직접 실행
```bash
docker-compose up -d
```

---

### 4️⃣ 접속
브라우저에서 http://localhost:3000

**관리자 계정**:
- 이메일: `admin@tiketi.gg`
- 비밀번호: `admin123`

---

## 🛠️ macOS 전용 스크립트

| 파일 | 명령어 | 용도 |
|------|--------|------|
| `start.sh` | `./start.sh` | 서비스 시작 |
| `stop.sh` | `./stop.sh` | 서비스 중지 |
| `logs.sh` | `./logs.sh` | 로그 확인 |
| `reset.sh` | `./reset.sh` | 완전 초기화 |

**처음 한 번만 권한 설정**:
```bash
chmod +x start.sh stop.sh logs.sh reset.sh
```

---

## 🖥️ Apple Silicon (M1/M2/M3) 지원

### ✅ 완벽 호환
이 프로젝트는 **ARM64 네이티브**로 실행됩니다.

```yaml
# 모든 이미지가 Apple Silicon 지원
postgres:15-alpine     ← ARM64 ✅
node:18-alpine        ← ARM64 ✅
dragonflydb          ← ARM64 ✅
```

**Rosetta 2 불필요!** 네이티브 속도로 실행됩니다.

---

## 🔍 상태 확인

### 서비스 상태
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
./logs.sh
# 또는
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Docker Desktop GUI
- 상단 메뉴바 → Docker 아이콘 → Dashboard
- 컨테이너 4개 실행 중 확인

---

## 🐛 macOS 특화 문제 해결

### "Permission denied" 에러
```bash
chmod +x start.sh
```

### 포트 충돌
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :3000
lsof -i :3001
lsof -i :5432

# 종료
kill -9 <PID>
```

### Docker Desktop이 느릴 때
1. Docker Desktop → Preferences → Resources
2. CPUs: 4 (권장)
3. Memory: 4GB (최소), 8GB (권장)
4. Apply & Restart

### M1/M2에서 "platform mismatch" 경고
```bash
# docker-compose.yml에 추가 (이미 포함됨)
platform: linux/arm64
```

### 파일 감시 제한 (ENOSPC)
```bash
# macOS는 기본적으로 충분함
# 문제 발생 시:
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## 💻 개발 모드 (선택사항)

Docker 없이 로컬에서 개발하려면:

### 1️⃣ PostgreSQL & Redis 설치
```bash
# Homebrew 사용
brew install postgresql@15
brew install redis

# 또는 Docker로만 DB 실행
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=tiketi_pass postgres:15
docker run -d -p 6379:6379 docker.dragonflydb.io/dragonflydb/dragonfly
```

### 2️⃣ Node.js 설치
```bash
brew install node@18
# 또는 nvm 사용
nvm install 18
nvm use 18
```

### 3️⃣ 백엔드 실행
```bash
cd backend
npm install
npm run dev
```

### 4️⃣ 프론트엔드 실행
```bash
cd frontend
npm install
npm start
```

---

## 🎨 VS Code 설정 (권장)

### 추천 확장
```bash
# VS Code 열기
code .

# 확장 설치
- Docker (ms-azuretools.vscode-docker)
- ESLint
- Prettier
- GitLens
```

### 터미널 통합
VS Code 내장 터미널에서 바로 실행:
```bash
Cmd + J  # 터미널 열기
./start.sh
```

---

## 📊 성능 팁

### Docker Desktop 최적화
```bash
# ~/.docker/daemon.json
{
  "experimental": true,
  "builder": {
    "gc": {
      "enabled": true
    }
  }
}
```

### 볼륨 캐시 (개발 시)
```yaml
# docker-compose.yml에 이미 적용됨
volumes:
  - ./backend:/app:cached  # 읽기 속도 향상
```

---

## 🔄 일반적인 작업 흐름

### 아침에 시작
```bash
./start.sh
```

### 코드 수정
- 백엔드: nodemon이 자동 재시작
- 프론트: React Hot Reload

### 로그 확인
```bash
./logs.sh
```

### 퇴근 시
```bash
./stop.sh
```

### 문제 발생 시
```bash
./reset.sh  # 완전 초기화
```

---

## 🌐 네트워크 설정

### localhost 별칭 추가 (선택)
```bash
sudo nano /etc/hosts

# 추가
127.0.0.1   tiketi.local
```

이제 `http://tiketi.local:3000`으로 접속 가능!

---

## 🎯 단축키 (iTerm2 / Terminal)

### 유용한 alias 추가
```bash
# ~/.zshrc 또는 ~/.bash_profile
alias tiketi-start="cd ~/tiketi && ./start.sh"
alias tiketi-stop="cd ~/tiketi && ./stop.sh"
alias tiketi-logs="cd ~/tiketi && ./logs.sh"
alias tiketi-reset="cd ~/tiketi && ./reset.sh"

# 적용
source ~/.zshrc
```

이제 어디서든:
```bash
tiketi-start
```

---

## 📱 모바일 테스트 (같은 Wi-Fi)

### Mac의 IP 확인
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

예: `192.168.0.100`

### 모바일에서 접속
```
http://192.168.0.100:3000
```

**주의**: `docker-compose.yml`에서 `REACT_APP_API_URL`을 Mac IP로 변경 필요

---

## 🔐 보안 (개발 환경)

### macOS 방화벽
시스템 설정 → 네트워크 → 방화벽

Docker Desktop 허용 확인

### Keychain 통합
```bash
# Git 자격증명 저장
git config --global credential.helper osxkeychain
```

---

## 🎓 학습 리소스

### macOS Docker 최적화
- https://docs.docker.com/desktop/settings/mac/

### Homebrew
- https://brew.sh/

### iTerm2 (추천 터미널)
- https://iterm2.com/

---

## ✅ macOS 체크리스트

시작 전:
- [ ] Docker Desktop 설치 및 실행
- [ ] Homebrew 설치 (선택)
- [ ] Git 설치 (`git --version`)
- [ ] 충분한 디스크 공간 (최소 5GB)

처음 실행:
- [ ] `chmod +x *.sh` 권한 설정
- [ ] `./start.sh` 실행
- [ ] http://localhost:3000 접속 성공
- [ ] 관리자 로그인 성공

---

## 🆚 Windows vs macOS

| 항목 | Windows | macOS |
|------|---------|-------|
| 스크립트 | `.bat` | `.sh` |
| 터미널 | PowerShell/CMD | Terminal/iTerm2 |
| 실행 | `start.bat` | `./start.sh` |
| 권한 | 불필요 | `chmod +x` 필요 |
| 성능 | WSL2 필요 | 네이티브 |
| Docker | Hyper-V | HyperKit |

**결론**: 둘 다 동일하게 작동! 🎉

---

## 💡 팁

### 터미널 테마
```bash
# Oh My Zsh 설치
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

### Docker 명령어 자동완성
```bash
# Oh My Zsh plugins에 추가
plugins=(git docker docker-compose)
```

### 빠른 재시작
```bash
docker-compose restart backend
# 또는
docker-compose restart frontend
```

---

## 🎉 완료!

이제 macOS에서도 완벽하게 실행됩니다!

문제가 생기면:
1. `./logs.sh`로 로그 확인
2. `./reset.sh`로 초기화
3. Docker Desktop 재시작

**즐거운 개발 되세요!** 🚀

