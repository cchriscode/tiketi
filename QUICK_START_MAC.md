# TIKETI Quick Start Guide for Mac 🚀

> Mac 사용자를 위한 완벽한 설치 가이드

## 📋 목차

1. [빠른 시작 (자동 설치)](#빠른-시작-자동-설치) ⚡ **권장**
2. [사전 요구사항](#사전-요구사항)
3. [수동 설치 (상세)](#수동-설치-상세)
4. [접속 및 테스트](#접속-및-테스트)
5. [문제 해결](#문제-해결)

---

## 빠른 시작 (자동 설치)

### 원스텝 설치 🎯

Mac에서는 간단합니다! 터미널에서 한 줄만 실행하세요:

```bash
# 프로젝트 루트에서 실행
./scripts/setup-tiketi.sh
```

이 스크립트는 다음을 자동으로 수행합니다:
1. ✅ Kind 클러스터 생성
2. ✅ PostgreSQL 배포 및 스키마 설정
3. ✅ 모든 Docker 이미지 빌드
4. ✅ 모든 서비스 배포
5. ✅ 준비 완료 확인

**소요 시간**: 약 5-10분 (M1/M2는 더 빠름!)

### 접속하기

설치 완료 후:

```bash
# 포트포워딩 시작
./scripts/port-forward-all.sh
```

**브라우저에서 접속:**
```
http://localhost:3000
```

✅ **끝!** 이제 TIKETI를 사용할 수 있습니다.

---

## 사전 요구사항

### 필수 소프트웨어

Mac에서는 **WSL이 필요 없습니다!** 다음만 설치하면 됩니다:

1. **Homebrew** (Mac 패키지 관리자)
2. **Docker Desktop for Mac**
3. **kubectl** (Kubernetes CLI)
4. **Kind** (Kubernetes in Docker)
5. **Node.js** v18 이상

### 1. Homebrew 설치

```bash
# Homebrew가 없다면 설치
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 설치 확인
brew --version
```

### 2. Docker Desktop for Mac 설치

**방법 A: Homebrew 사용 (권장)**
```bash
brew install --cask docker

# Docker Desktop 실행
open -a Docker
```

**방법 B: 공식 사이트에서 다운로드**
- Intel Mac: https://docs.docker.com/desktop/install/mac-install/
- M1/M2 (Apple Silicon): Docker Desktop for Mac (Apple Silicon) 다운로드

**Docker 시작 확인:**
```bash
docker --version
docker ps  # 에러 없이 실행되어야 함
```

### 3. kubectl 설치

```bash
# Homebrew로 설치
brew install kubectl

# 설치 확인
kubectl version --client
```

### 4. Kind 설치

```bash
# Homebrew로 설치
brew install kind

# 설치 확인
kind version
```

### 5. Node.js 설치

```bash
# Homebrew로 설치 (v18 이상)
brew install node@18

# 또는 nvm 사용 (권장)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# 설치 확인
node --version  # v18 이상
npm --version
```

### 설치 확인

모든 도구가 설치되었는지 확인:

```bash
docker --version      # Docker version 24.x.x
kubectl version --client  # Client Version: v1.28.x
kind version          # kind v0.20.0 go1.21.x
node --version        # v18.x.x
npm --version         # 9.x.x
```

---

## 수동 설치 (상세)

> 💡 **권장**: 위의 [빠른 시작](#빠른-시작-자동-설치) 자동화 스크립트를 사용하세요.
>
> 아래는 각 단계를 수동으로 실행하려는 경우를 위한 상세 가이드입니다.

### 1. 프로젝트 클론

```bash
# 원하는 디렉토리로 이동
cd ~/Projects  # 또는 원하는 경로

# 프로젝트 클론
git clone https://github.com/your-org/project-ticketing.git
cd project-ticketing
```

### 2. Kind 클러스터 생성

```bash
# Kind 클러스터 생성 (3-node cluster)
kind create cluster --name tiketi-local --config k8s/kind-config.yaml

# 클러스터 확인
kubectl cluster-info --context kind-tiketi-local
kubectl get nodes
```

**예상 결과:**
```
NAME                         STATUS   ROLES           AGE   VERSION
tiketi-local-control-plane   Ready    control-plane   1m    v1.27.0
tiketi-local-worker          Ready    <none>          1m    v1.27.0
tiketi-local-worker2         Ready    <none>          1m    v1.27.0
```

### 3. Kubernetes Namespace & Config 생성

```bash
# Namespace 생성
kubectl create namespace tiketi

# ConfigMap & Secret 생성
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secret.yaml
```

### 4. PostgreSQL 배포

```bash
# PVC 및 PostgreSQL 배포
kubectl apply -f k8s/03-pvc.yaml
kubectl apply -f k8s/04-postgres.yaml

# Pod 실행 대기 (약 30초)
kubectl wait --for=condition=ready pod -l app=postgres -n tiketi --timeout=120s

# 상태 확인
kubectl get pods -n tiketi
```

### 5. Database 초기화

**중요**: 반드시 아래 순서대로 실행하세요!

```bash
# Pod 이름 변수 저장 (간편함)
POSTGRES_POD=$(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}')

# 1. 기본 스키마 및 샘플 데이터 생성
cat database/init.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi

# 2. MSA 스키마 마이그레이션
cat database/migrations/auth-service-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi
cat database/migrations/ticket-service-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi
cat database/migrations/stats-service-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi
cat database/migrations/payment-service-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi

# 3. Search Path 설정
cat database/set_search_path.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi
```

**결과 확인:**
```bash
# 이벤트 데이터 확인
kubectl exec -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi -c "SELECT COUNT(*) FROM events"
# 25개 이상의 샘플 이벤트가 있어야 함
```

### 6. 공통 패키지 설치

```bash
# Monorepo 패키지 설치
cd packages/common && npm install && cd ../..
cd packages/database && npm install && cd ../..
cd packages/metrics && npm install && cd ../..
```

### 7. Docker 이미지 빌드

```bash
# Auth Service
docker build -t tiketi-auth-service:local -f services/auth-service/Dockerfile .
kind load docker-image tiketi-auth-service:local --name tiketi-local

# Ticket Service
docker build -t tiketi-ticket-service:local -f services/ticket-service/Dockerfile .
kind load docker-image tiketi-ticket-service:local --name tiketi-local

# Stats Service
docker build -t tiketi-stats-service:local -f services/stats-service/Dockerfile .
kind load docker-image tiketi-stats-service:local --name tiketi-local

# Payment Service
docker build -t tiketi-payment-service:local -f services/payment-service/Dockerfile .
kind load docker-image tiketi-payment-service:local --name tiketi-local

# Backend (Legacy)
docker build -t tiketi-backend:local -f backend/Dockerfile backend
kind load docker-image tiketi-backend:local --name tiketi-local

# Frontend
docker build -t tiketi-frontend:local -f frontend/Dockerfile frontend
kind load docker-image tiketi-frontend:local --name tiketi-local
```

**💡 Tip**: 모든 이미지를 한 번에 빌드하려면:
```bash
chmod +x scripts/build-all-images.sh
./scripts/build-all-images.sh
```

**M1/M2 Mac 사용자 주의사항:**
- Docker 이미지가 ARM64 아키텍처로 빌드됩니다
- 호환성 문제는 거의 없지만, 일부 Node.js 네이티브 모듈에서 발생 가능
- 문제 발생 시: `docker build --platform linux/amd64` 옵션 추가

### 8. 인프라 서비스 배포

```bash
# Dragonfly (Redis), 모니터링 스택
kubectl apply -f k8s/05-dragonfly.yaml
kubectl apply -f k8s/08-loki.yaml
kubectl apply -f k8s/09-promtail.yaml
kubectl apply -f k8s/10-grafana.yaml
```

### 9. 애플리케이션 서비스 배포

```bash
# Backend & MSA 서비스 배포
kubectl apply -f k8s/06-backend.yaml
kubectl apply -f k8s/12-auth-service.yaml
kubectl apply -f k8s/13-ticket-service.yaml
kubectl apply -f k8s/14-stats-service.yaml
kubectl apply -f k8s/11-payment-service.yaml
kubectl apply -f k8s/07-frontend.yaml

# 배포 상태 확인 (모든 Pod가 Running 될 때까지 대기)
kubectl get pods -n tiketi -w
```

**Ctrl+C로 종료 후 최종 확인:**
```bash
kubectl get pods -n tiketi
```

**모든 Pod가 Running 상태여야 합니다!**

---

## 접속 및 테스트

### 1. Port-Forward 설정

**자동 스크립트 사용 (권장):**
```bash
chmod +x scripts/port-forward-all.sh
./scripts/port-forward-all.sh
```

이 스크립트는 백그라운드로 실행되며, 다음 포트를 포워딩합니다:
- PostgreSQL: 5432
- Backend: 3001
- Auth: 3002
- Payment: 3003
- Ticket: 3004
- Stats: 3005
- Frontend: 3000

**수동 설정 (선택사항):**
```bash
# 각각 별도의 터미널에서 실행하거나 백그라운드로 실행
kubectl port-forward -n tiketi svc/postgres-service 5432:5432 &
kubectl port-forward -n tiketi svc/backend-service 3001:3001 &
kubectl port-forward -n tiketi svc/auth-service 3002:3002 &
kubectl port-forward -n tiketi svc/payment-service 3003:3003 &
kubectl port-forward -n tiketi svc/ticket-service 3004:3004 &
kubectl port-forward -n tiketi svc/stats-service 3005:3005 &
kubectl port-forward -n tiketi svc/frontend-service 3000:80 &
```

### 2. 접속 URL

| 서비스 | URL | 설명 |
|--------|-----|------|
| **Frontend** | http://localhost:3000 | 메인 사용자 웹사이트 |
| **Backend API** | http://localhost:3001 | Legacy API (Admin 등) |
| **Auth Service** | http://localhost:3002 | 인증 서비스 |
| **Payment Service** | http://localhost:3003 | 결제 서비스 |
| **Ticket Service** | http://localhost:3004 | 티켓 예매 서비스 |
| **Stats Service** | http://localhost:3005 | 통계 서비스 |

### 3. 기본 테스트

#### A. Health Check

```bash
# 모든 서비스 Health 확인
curl http://localhost:3001/health  # Backend
curl http://localhost:3002/health  # Auth
curl http://localhost:3003/health  # Payment
curl http://localhost:3004/health  # Ticket
curl http://localhost:3005/health  # Stats
```

모든 서비스가 `{"status":"ok"}` 응답을 반환해야 합니다.

#### B. 회원가입 & 로그인

1. 브라우저에서 http://localhost:3000 접속
2. 우측 상단 "회원가입" 클릭
3. 정보 입력 후 가입
4. 로그인

#### C. 티켓 예매 플로우

1. 메인 페이지에서 이벤트 선택
2. 좌석 선택 (실시간 동기화 확인 - 여러 탭에서 동시 접속 테스트)
3. 결제 진행
4. "내 예약" 페이지에서 확인

#### D. 관리자 기능

1. http://localhost:3000/admin 접속
2. Admin 로그인:
   - Email: `admin@tiketi.gg`
   - Password: `admin123`
3. Dashboard 확인
4. Statistics 페이지에서 통계 확인

---

## 문제 해결

### Docker Desktop이 시작되지 않을 때

```bash
# Docker Desktop 재시작
killall Docker
open -a Docker

# 또는 시스템 재부팅 후 다시 시도
```

### Pod가 CrashLoopBackOff 상태일 때

```bash
# 로그 확인
kubectl logs -n tiketi <pod-name>

# 이전 컨테이너 로그 확인
kubectl logs -n tiketi <pod-name> --previous

# Pod 상세 정보
kubectl describe pod -n tiketi <pod-name>
```

**일반적인 원인:**
- Database 연결 실패 → PostgreSQL Pod 상태 확인
- 환경 변수 누락 → ConfigMap/Secret 확인
- 이미지 Pull 실패 → `kind load docker-image` 재실행

### Database 연결 실패

```bash
# PostgreSQL Pod 로그 확인
kubectl logs -n tiketi -l app=postgres

# PostgreSQL 직접 접속 테스트
POSTGRES_POD=$(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi

# 스키마 확인
\dn

# 테이블 확인
SET search_path TO auth_schema, ticket_schema, stats_schema, payment_schema, public;
\dt
```

### Port-Forward 끊김

Mac에서는 네트워크 변경 시 (Wi-Fi 변경 등) 포트 포워딩이 끊어질 수 있습니다.

```bash
# 모든 port-forward 프로세스 종료
pkill -f "kubectl port-forward"

# 또는
killall kubectl

# 재시작
./scripts/port-forward-all.sh
```

### M1/M2 특정 이슈

**ARM64 아키텍처 문제:**
```bash
# 일부 이미지는 AMD64로 빌드 필요할 수 있음
docker build --platform linux/amd64 -t tiketi-auth-service:local -f services/auth-service/Dockerfile .
```

**Node.js 네이티브 모듈 문제:**
```bash
# node_modules 재설치
cd services/auth-service
rm -rf node_modules package-lock.json
npm install
```

### Frontend가 백엔드 API 호출 실패

```bash
# Frontend 로그 확인
kubectl logs -n tiketi -l app=frontend

# 브라우저 개발자 도구에서 네트워크 탭 확인
# CORS 에러인 경우: ConfigMap에서 FRONTEND_URL 확인
```

### 전체 재시작

```bash
# 모든 Deployment 재시작
kubectl rollout restart deployment -n tiketi

# 특정 서비스만 재시작
kubectl rollout restart deployment/auth-service -n tiketi
```

---

## 전체 초기화 & 재시작

시스템을 완전히 초기화하고 다시 시작하려면:

### Cleanup 스크립트 사용 (권장)

```bash
./scripts/cleanup.sh
```

이 스크립트는 다음을 정리합니다:
- ✅ 실행 중인 port-forward 프로세스
- ✅ Kind cluster 삭제
- ✅ Docker images 삭제 (선택사항)
- ✅ node_modules 폴더 삭제 (선택사항)

### 수동 정리

```bash
# 1. 포트 포워딩 중지
pkill -f "kubectl port-forward"

# 2. Kind 클러스터 삭제
kind delete cluster --name tiketi-local

# 3. Docker 이미지 정리 (선택사항)
docker images | grep tiketi | awk '{print $3}' | xargs docker rmi -f

# 4. 처음부터 다시 시작
./scripts/setup-tiketi.sh
```

---

## 개발 모드

Kubernetes 없이 로컬에서 직접 실행 (개발 시 유용):

### 1. PostgreSQL만 K8s에서 실행

```bash
# PostgreSQL 포트포워딩
kubectl port-forward -n tiketi svc/postgres-service 5432:5432 &
```

### 2. 각 서비스 로컬 실행

**새 터미널 탭/윈도우를 각각 열어서 실행:**

```bash
# 탭 1: Backend
cd backend
npm install
npm run dev  # Port 3001

# 탭 2: Auth Service
cd services/auth-service
npm install
npm run dev  # Port 3002

# 탭 3: Ticket Service
cd services/ticket-service
npm install
npm run dev  # Port 3004

# 탭 4: Payment Service
cd services/payment-service
npm install
npm run dev  # Port 3003

# 탭 5: Stats Service
cd services/stats-service
npm install
npm run dev  # Port 3005

# 탭 6: Frontend
cd frontend
npm install
npm start  # Port 3000
```

**장점:**
- 코드 수정 시 즉시 반영 (Hot Reload)
- 디버깅 쉬움
- 빠른 개발 사이클

**단점:**
- 여러 터미널 관리 필요
- Redis가 필요한 기능은 별도 설정 필요

---

## 유용한 명령어 모음

```bash
# 모든 Pod 상태 확인
kubectl get pods -n tiketi

# 모든 Service 확인
kubectl get svc -n tiketi

# 특정 서비스 로그 실시간 확인
kubectl logs -n tiketi -f deployment/auth-service

# ConfigMap 확인
kubectl get configmap tiketi-config -n tiketi -o yaml

# Secret 확인 (Base64 디코딩)
kubectl get secret tiketi-secret -n tiketi -o jsonpath='{.data.DB_PASSWORD}' | base64 -d

# 리소스 사용량 확인
kubectl top pods -n tiketi
kubectl top nodes

# 클러스터 전체 정보
kubectl get all -n tiketi

# Pod에 직접 접속
kubectl exec -it -n tiketi <pod-name> -- /bin/sh

# PostgreSQL 접속
POSTGRES_POD=$(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi
```

---

## Mac 특화 팁

### iTerm2 사용자

iTerm2를 사용하면 더 편리합니다:

**Split Panes로 여러 로그 동시 확인:**
```bash
# Cmd+D로 수직 분할, Cmd+Shift+D로 수평 분할

# 각 Pane에서:
kubectl logs -n tiketi -f deployment/auth-service
kubectl logs -n tiketi -f deployment/ticket-service
kubectl logs -n tiketi -f deployment/payment-service
```

### Oh My Zsh 사용자

`.zshrc`에 alias 추가:

```bash
# ~/.zshrc에 추가
alias k='kubectl'
alias kgp='kubectl get pods -n tiketi'
alias kgs='kubectl get svc -n tiketi'
alias klf='kubectl logs -n tiketi -f'
alias tiketi-start='cd ~/Projects/project-ticketing && ./scripts/setup-tiketi.sh'
alias tiketi-port='cd ~/Projects/project-ticketing && ./scripts/port-forward-all.sh'
alias tiketi-clean='cd ~/Projects/project-ticketing && ./scripts/cleanup.sh'

# 적용
source ~/.zshrc
```

### Docker Desktop 메모리 설정

Mac에서 Docker Desktop 메모리 부족 시:

1. Docker Desktop 설정 열기
2. Resources → Advanced
3. Memory를 4GB 이상으로 설정 (권장: 6GB)
4. Apply & Restart

### M1/M2 성능 최적화

Apple Silicon Mac은 매우 빠르지만, Rosetta 에뮬레이션을 피하기 위해:

```bash
# ARM64 네이티브 이미지 사용 확인
docker images --format "{{.Repository}}:{{.Tag}}" | xargs -I {} docker inspect {} | grep Architecture

# 모두 "arm64"여야 최적
```

---

## 추가 문서

- **프로젝트 분석 보고서**: [claudedocs/TIKETI_PROJECT_ANALYSIS_PART1.md](./claudedocs/TIKETI_PROJECT_ANALYSIS_PART1.md)
- **MSA 아키텍처**: [MSA_ARCHITECTURE.md](./MSA_ARCHITECTURE.md)
- **면접 준비 QnA**: [claudedocs/TIKETI_PROJECT_ANALYSIS_PART2.md](./claudedocs/TIKETI_PROJECT_ANALYSIS_PART2.md)

---

## Windows 팀원과 협업

Windows 팀원은 `QUICK_START.md`를 참고하세요.

주요 차이점:
- Mac: bash 스크립트 사용 (`./scripts/*.sh`)
- Windows: PowerShell 스크립트 사용 (`.\*.ps1`)
- Mac: WSL 불필요, 네이티브 Unix 환경
- Windows: WSL2 + Docker Desktop 필요

---

## 라이선스

MIT License

---

**Happy Ticketing! 🎫**

*Made with ❤️ for Mac*
