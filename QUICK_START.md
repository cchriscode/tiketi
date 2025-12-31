# TIKETI Quick Start Guide 🚀

> 처음부터 끝까지 TIKETI 시스템을 로컬에서 실행하는 완벽 가이드

## 📋 목차

1. [빠른 시작 (자동 설치)](#빠른-시작-자동-설치) ⚡ **권장**
2. [사전 요구사항](#사전-요구사항)
3. [수동 설치 (상세)](#수동-설치-상세)
4. [접속 및 테스트](#접속-및-테스트)
5. [문제 해결](#문제-해결)

---

## ⚠️ 시작하기 전에

**필수 확인사항:**
1. ✅ Docker Desktop 실행 중
2. ✅ WSL2 터미널 열기
3. ✅ 프로젝트 디렉토리로 이동: `cd /mnt/c/Users/USER/project-ticketing`

**전체 정리 후 재시작하려면:**
```bash
# Windows (PowerShell)
.\cleanup.ps1

# 또는 WSL
./scripts/cleanup.sh
```

---

## 빠른 시작 (자동 설치)

### 원스텝 설치 🎯

**Windows (PowerShell):**
```powershell
# 프로젝트 루트에서 실행
.\setup-tiketi.ps1
```

**Linux/WSL:**
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

**소요 시간**: 약 5-10분

완료 후 포트포워딩만 실행하면 됩니다:

## 방법 1: WSL에서 전부 완료 (추천!)

**WSL 터미널에서:**
```bash
./scripts/port-forward-all.sh
```

**접속 URL 확인:**
```bash
./scripts/show-access-url.sh
```

**Windows 크롬에서 접속:**
```
http://<WSL-IP>:3000
(스크립트가 표시한 IP 사용, 예: http://172.17.40.29:3000)
```

✅ **이 방법이 가장 간단합니다!**

---

## 방법 2: PowerShell 사용 (localhost 접속)

**PowerShell에서 (Windows 네이티브):**

### 1단계: Windows kubectl 설정 (최초 1회만)
```powershell
.\setup-windows-kubectl.ps1
```

**이 스크립트가 하는 일:**
- Windows용 kubectl 설치 (없을 경우)
- WSL의 kubeconfig를 Windows로 복사
- Kind 클러스터 연결 설정

### 2단계: 포트포워딩 시작
```powershell
.\start_port_forwards.ps1
```

**이 스크립트가 하는 일:**
- 사용 중인 포트 자동 정리
- 7개 서비스 포트포워딩 시작 (백그라운드 PowerShell 창)
- Health Check 자동 실행
- 접속 URL 표시

**Windows 크롬에서 접속:**
```
http://localhost:3000
```

**장점**: Google OAuth 테스트 시 `http://localhost:3000` 사용 가능 (OAuth 리디렉션 설정과 일치)

---

**문제 발생 시:** `FULL_WSL_GUIDE.md` 또는 `WSL_PORT_FORWARD_ISSUE.md` 참고

---

**전부 정리하는 스크립트:**
- Windows (PowerShell): `.\cleanup.ps1`
- Linux/WSL: `./scripts/cleanup.sh`


### 단계별 실행 (선택사항)

자동화 스크립트를 단계별로 실행하려면:

```bash
# 1단계: 클러스터 설정
./scripts/1-setup-cluster.sh

# 2단계: Database 설정
./scripts/2-setup-database.sh

# 3단계: 빌드 & 배포
./scripts/3-build-and-deploy.sh
```

---

## 사전 요구사항

### 필수 소프트웨어
- **WSL2** (Windows Subsystem for Linux 2)
- **Docker Desktop** (WSL2 백엔드 사용)
- **Node.js** v18 이상
- **Git**

### 설치 확인
```bash
# WSL2에서 실행
wsl --version
docker --version
kubectl version --client
kind version
node --version
```

---

## 수동 설치 (상세)

> 💡 **권장**: 위의 [빠른 시작](#빠른-시작-자동-설치) 자동화 스크립트를 사용하세요.
>
> 아래는 각 단계를 수동으로 실행하려는 경우를 위한 상세 가이드입니다.

### 1. Kind 클러스터 생성

```bash
cd /mnt/c/Users/USER/project-ticketing

# Kind 클러스터 생성 (3-node cluster)
kind create cluster --name tiketi-local --config k8s/kind-config.yaml

# 클러스터 확인
kubectl cluster-info --context kind-tiketi-local
kubectl get nodes
```

### 2. Kubernetes Namespace 생성

```bash
# Namespace 생성
kubectl create namespace tiketi

# ConfigMap & Secret 생성
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secret.yaml
```

### 3. Toss Payments API 키 설정 (선택사항)

실제 결제 기능을 사용하려면 [Toss Payments 개발자 센터](https://developers.tosspayments.com/)에서 API 키를 발급받아 설정:

```bash
# k8s/02-secret.yaml 파일 수정
nano k8s/02-secret.yaml

# 다음 값을 실제 API 키로 교체:
# TOSS_CLIENT_KEY: "실제_클라이언트_키"
# TOSS_SECRET_KEY: "실제_시크릿_키"

# Secret 재적용
kubectl apply -f k8s/02-secret.yaml
```

---

## Database 설정

### 1. PostgreSQL 배포

```bash
# PVC 및 PostgreSQL 배포
kubectl apply -f k8s/03-pvc.yaml
kubectl apply -f k8s/04-postgres.yaml

# Pod 실행 대기 (약 30초)
kubectl wait --for=condition=ready pod -l app=postgres -n tiketi --timeout=120s

# 상태 확인
kubectl get pods -n tiketi
```

### 2. Database 초기화 및 스키마 생성

**중요**: 반드시 아래 순서대로 실행하세요!

#### Step 1: 기본 스키마 및 샘플 데이터 생성

```bash
# public 스키마에 기본 테이블과 샘플 데이터 생성 (이벤트, 좌석 레이아웃 등)
cat database/init.sql | \
  kubectl exec -i -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi
```

#### Step 2: MSA 스키마 마이그레이션

```bash
# Auth Service 스키마 (users 테이블 이동)
cat database/migrations/auth-service-schema.sql | \
  kubectl exec -i -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi

# Ticket Service 스키마 (events, seats, reservations 등 이동)
cat database/migrations/ticket-service-schema.sql | \
  kubectl exec -i -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi

# Stats Service 스키마 (통계 테이블 생성)
cat database/migrations/stats-service-schema.sql | \
  kubectl exec -i -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi

# Payment Service 스키마 (결제 테이블 생성)
cat database/migrations/payment-service-schema.sql | \
  kubectl exec -i -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi
```

#### Step 3: Search Path 설정

```bash
# MSA 스키마를 우선하도록 search_path 설정
cat database/set_search_path.sql | \
  kubectl exec -i -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi
```

**결과 확인:**
```bash
# 이벤트 데이터 확인 (25개 이상의 샘플 이벤트가 있어야 함)
kubectl exec -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi -c "SELECT COUNT(*) FROM events"
```

---

## 서비스 빌드 & 배포

### 1. Monorepo 패키지 설치

```bash
# 공통 패키지 설치
cd packages/common && npm install && cd ../..
cd packages/database && npm install && cd ../..
cd packages/metrics && npm install && cd ../..
```

### 2. Docker 이미지 빌드

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

# Backend (Legacy - Admin API 등)
docker build -t tiketi-backend:local -f backend/Dockerfile backend
kind load docker-image tiketi-backend:local --name tiketi-local
```

**💡 Tip**: 모든 이미지를 한 번에 빌드하려면:
```bash
chmod +x scripts/build-all-images.sh
./scripts/build-all-images.sh
```

### 3. 인프라 서비스 배포

```bash
# Dragonfly (Redis), 모니터링 스택
kubectl apply -f k8s/05-dragonfly.yaml
kubectl apply -f k8s/08-loki.yaml
kubectl apply -f k8s/09-promtail.yaml
kubectl apply -f k8s/10-grafana.yaml
```

### 4. 애플리케이션 서비스 배포

```bash
# Backend & MSA 서비스 배포
kubectl apply -f k8s/06-backend.yaml
kubectl apply -f k8s/12-auth-service.yaml
kubectl apply -f k8s/13-ticket-service.yaml
kubectl apply -f k8s/14-stats-service.yaml
kubectl apply -f k8s/11-payment-service.yaml

# 배포 상태 확인 (모든 Pod가 Running 될 때까지 대기)
kubectl get pods -n tiketi -w
```

**예상 Pod 목록:**
```
NAME                               READY   STATUS    RESTARTS   AGE
postgres-xxxxx                     1/1     Running   0          5m
dragonfly-xxxxx                    1/1     Running   0          3m
grafana-xxxxx                      1/1     Running   0          3m
loki-xxxxx                         1/1     Running   0          3m
promtail-xxxxx                     1/1     Running   0          3m
backend-xxxxx                      1/1     Running   0          2m
auth-service-xxxxx                 1/1     Running   0          2m
ticket-service-xxxxx               1/1     Running   0          2m
stats-service-xxxxx                1/1     Running   0          2m
payment-service-xxxxx              1/1     Running   0          2m
```

---

## Frontend 배포

### 1. Frontend 이미지 빌드

```bash
# Frontend 빌드 및 Nginx 이미지 생성
docker build -t tiketi-frontend:local -f frontend/Dockerfile frontend
kind load docker-image tiketi-frontend:local --name tiketi-local
```

### 2. Frontend 배포

```bash
# Frontend Deployment & Service
kubectl apply -f k8s/07-frontend.yaml

# 배포 확인
kubectl get pods -n tiketi | grep frontend
```

---

## 접속 및 테스트

### 1. Port-Forward 설정

**Option A: 자동 스크립트 사용 (Windows)**
```powershell
# PowerShell에서 실행
.\start_port_forwards.ps1
```

**Option B: 자동 스크립트 사용 (WSL/Linux)**
```bash
chmod +x scripts/port-forward-all.sh
./scripts/port-forward-all.sh
```

**Option C: 수동 설정**
```bash
# 각각 별도의 터미널에서 실행
kubectl port-forward -n tiketi svc/postgres-service 5432:5432 &
kubectl port-forward -n tiketi svc/backend-service 3001:3001 &
kubectl port-forward -n tiketi svc/auth-service 3005:3005 &
kubectl port-forward -n tiketi svc/ticket-service 3002:3002 &
kubectl port-forward -n tiketi svc/payment-service 3003:3003 &
kubectl port-forward -n tiketi svc/stats-service 3004:3004 &
kubectl port-forward -n tiketi svc/frontend-service 3000:3000 &
```

**참고**: Auth Service는 NodePort 30006을 사용합니다 (30002는 Grafana가 사용 중)

### 2. 접속 URL

| 서비스 | URL | 설명 |
|--------|-----|------|
| **Frontend** | http://localhost:3000 | 메인 사용자 웹사이트 |
| **Backend API** | http://localhost:3001 | Legacy API (Admin 등) |
| **Auth Service** | http://localhost:3005 | 인증 서비스 (MSA) |
| **Ticket Service** | http://localhost:3002 | 티켓 예매 서비스 (좌석, Socket.IO) |
| **Payment Service** | http://localhost:3003 | 결제 서비스 (TossPayments) |
| **Stats Service** | http://localhost:3004 | 통계 서비스 (Read-only) |
| **Grafana** | http://localhost:30002 | 모니터링 대시보드 (NodePort) |

**참고**: Port-forward 없이 NodePort로 직접 접속 가능:
- Backend: http://localhost:30000
- Frontend: http://localhost:30001
- Grafana: http://localhost:30002
- Payment: http://localhost:30003
- Ticket: http://localhost:30004
- Stats: http://localhost:30005
- Auth: http://localhost:30006
- PostgreSQL: localhost:30432

### 3. 기본 테스트

#### A. 회원가입 & 로그인
1. http://localhost:3000 접속
2. 회원가입 (우측 상단)
3. 로그인

#### B. 티켓 예매 플로우
1. 메인 페이지에서 이벤트 선택
2. 좌석 선택
3. 결제 수단 선택
   - **Toss Payments** (실제 API 키 설정 시 작동)
   - Naver Pay (Mock)
   - Kakao Pay (Mock)
   - 계좌이체 (Mock)
4. 예매 완료 확인

#### C. 관리자 기능
1. http://localhost:3000/admin 접속
2. Admin 로그인:
   - Email: `admin@tiketi.gg`
   - Password: `admin123`
3. Dashboard 확인
4. 통계 페이지 확인 (좌측 메뉴 "Statistics")

#### D. API Health Check
```bash
# 모든 서비스 Health 확인
curl http://localhost:3001/health  # Backend
curl http://localhost:3005/health  # Auth Service
curl http://localhost:3002/health  # Ticket
curl http://localhost:3003/health  # Payment
curl http://localhost:3004/health  # Stats
```

---

## 문제 해결

### Pod가 CrashLoopBackOff 상태일 때

```bash
# 로그 확인
kubectl logs -n tiketi <pod-name>

# 이전 컨테이너 로그 확인
kubectl logs -n tiketi <pod-name> --previous

# Pod 상세 정보
kubectl describe pod -n tiketi <pod-name>
```

### Database 연결 실패

```bash
# PostgreSQL Pod 로그 확인
kubectl logs -n tiketi -l app=postgres

# PostgreSQL 직접 접속 테스트
kubectl exec -it -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- psql -U tiketi_user -d tiketi

# 스키마 확인
\dn
# 테이블 확인
SET search_path TO auth_schema, ticket_schema, stats_schema, payment_schema, public;
\dt
```

### 이미지 Pull 실패

```bash
# 이미지가 Kind 클러스터에 로드되었는지 확인
docker exec -it tiketi-local-control-plane crictl images | grep tiketi

# 다시 로드
kind load docker-image tiketi-auth-service:local --name tiketi-local
# ... (다른 이미지들도)
```

### Port-Forward 끊김

```bash
# 프로세스 확인
ps aux | grep "port-forward"

# 모두 종료 후 재시작
pkill -f "port-forward"
./scripts/port-forward-all.sh
```

### Frontend가 백엔드 API 호출 실패

```bash
# Frontend 로그 확인
kubectl logs -n tiketi -l app=frontend

# Frontend Pod에서 백엔드 접속 테스트
kubectl exec -it -n tiketi $(kubectl get pod -n tiketi -l app=frontend -o jsonpath='{.items[0].metadata.name}') -- wget -O- http://auth-service:3005/health
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

### 방법 1: Cleanup 스크립트 사용 (추천)

**Windows:**
```powershell
.\cleanup.ps1
```

**Linux/WSL:**
```bash
./scripts/cleanup.sh
```

이 스크립트는 다음을 정리합니다:
- ✅ 실행 중인 port-forward 프로세스
- ✅ Kind cluster 삭제
- ✅ Docker images 삭제 (선택사항)
- ✅ node_modules 폴더 삭제 (선택사항)

### 방법 2: 수동 정리

```bash
# 1. 포트 포워딩 중지
pkill -f "kubectl port-forward"

# 2. Kind 클러스터 삭제
kind delete cluster --name tiketi-local

# 3. 처음부터 다시 시작
# 이 가이드의 "초기 설정" 단계부터 다시 진행
```

---

## 개발 모드

개발 중에는 로컬에서 직접 실행하는 것이 더 편리할 수 있습니다:

```bash
# Backend (Legacy)
cd backend
npm install
npm run dev  # Port 3001

# Auth Service
cd services/auth-service
npm install
npm run dev  # Port 3005

# Ticket Service
cd services/ticket-service
npm install
npm run dev  # Port 3002

# Payment Service
cd services/payment-service
npm install
npm run dev  # Port 3003

# Stats Service
cd services/stats-service
npm install
npm run dev  # Port 3004

# Frontend
cd frontend
npm install
npm start  # Port 3000
```

단, 이 경우 PostgreSQL은 여전히 K8s에서 실행되어야 하며, `localhost:5432`로 port-forward 필요.

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
```

---

## 추가 문서

- **MSA 아키텍처**: [MSA_ARCHITECTURE.md](./MSA_ARCHITECTURE.md)
- **마이그레이션 계획**: [MSA_MIGRATION_PLAN.md](./MSA_MIGRATION_PLAN.md)
- **WSL2 & Kind 상세 설정**: [WSL2_KIND_SETUP_GUIDE.md](./WSL2_KIND_SETUP_GUIDE.md)
- **API 문서**: [fix_backend_api.md](./fix_backend_api.md)

---

## 라이선스

MIT License

---

**Happy Ticketing! 🎫**
