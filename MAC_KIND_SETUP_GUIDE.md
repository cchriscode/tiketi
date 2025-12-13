# Mac에서 Kind 실행 가이드

## 📋 목차
1. [사전 준비](#1-사전-준비)
2. [필수 도구 설치](#2-필수-도구-설치)
3. [프로젝트 클론](#3-프로젝트-클론)
4. [Kind 클러스터 실행](#4-kind-클러스터-실행)
5. [서비스 테스트](#5-서비스-테스트)
6. [트러블슈팅](#6-트러블슈팅)

---

## 1. 사전 준비

### Docker Desktop for Mac 설치

1. https://www.docker.com/products/docker-desktop 에서 다운로드
2. 설치 후 실행
3. Docker Desktop이 실행 중인지 확인 (상단 메뉴바에 고래 아이콘)

```bash
# 터미널에서 Docker 확인
docker --version

# 정상 출력:
# Docker version 24.0.6, build ed223bc
```

---

## 2. 필수 도구 설치

### Homebrew로 한 번에 설치

```bash
# Homebrew가 없다면 먼저 설치
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# kubectl 설치
brew install kubectl

# Kind 설치
brew install kind

# 설치 확인
echo "=== Docker ===" && docker --version
echo "=== kubectl ===" && kubectl version --client --short
echo "=== Kind ===" && kind version
```

**정상 출력**:
```
=== Docker ===
Docker version 24.0.6, build ed223bc

=== kubectl ===
Client Version: v1.28.4

=== Kind ===
kind v0.20.0 go1.20.4 darwin/amd64
```

---

## 3. 프로젝트 클론

```bash
# 원하는 위치로 이동 (예: 홈 디렉토리)
cd ~

# 프로젝트 클론
git clone <repository-url> project-ticketing

# 또는 이미 클론했다면 해당 경로로 이동
cd ~/project-ticketing

# mono-kind 브랜치로 체크아웃
git checkout mono-kind

# 현재 브랜치 확인
git branch
# * mono-kind

# 파일 확인
ls -la
# kind-config.yaml, k8s/, scripts/ 등이 보여야 함
```

---

## 4. Kind 클러스터 실행

### Step 4-1: 스크립트 실행 권한 부여

```bash
# 프로젝트 루트에서
chmod +x scripts/*.sh
```

### Step 4-2: Kind 클러스터 생성

```bash
# 클러스터 생성
./scripts/kind-cluster-create.sh
```

**진행 과정**:
```
🚀 Creating Kind cluster for Tiketi...
📦 Creating cluster with config file...
Creating cluster "tiketi-local" ...
 ✓ Ensuring node image (kindest/node:v1.27.3) 🖼
 ✓ Preparing nodes 📦 📦 📦
 ✓ Writing configuration 📜
 ✓ Starting control-plane 🕹️
 ✓ Installing CNI 🔌
 ✓ Installing StorageClass 💾
 ✓ Joining worker nodes 🚜

✅ Kind cluster 'tiketi-local' created successfully!
```

**클러스터 확인**:
```bash
# 클러스터 정보
kubectl cluster-info

# 노드 확인
kubectl get nodes

# 3개 노드가 모두 Ready 상태여야 함
```

### Step 4-3: Docker 이미지 빌드 및 로드

```bash
# Backend 이미지 빌드 및 Kind에 로드
./scripts/build-and-load-images.sh

# Frontend 빌드 물어보면 'y' 입력 (1-2분 소요)
```

**진행 과정**:
```
🏗️  Building Docker images...

📦 Building Backend image...
✅ Backend image built: tiketi-backend:local

📦 Building Frontend image (optional)...
Do you want to build the frontend image? (y/n): n

📤 Loading images into Kind cluster...
✅ Backend image loaded into cluster

✅ All images loaded successfully!
```

### Step 4-4: 전체 서비스 배포

```bash
# 모든 Kubernetes 리소스 배포
./scripts/deploy-all.sh

# Frontend 배포 물어보면 'y' 입력
```

**진행 과정**:
```
🚀 Deploying all services to Kind cluster...

📝 Applying Kubernetes manifests...
  1️⃣  Creating namespace...
  2️⃣  Creating ConfigMap and Secret...
  3️⃣  Creating PersistentVolumeClaims...
  4️⃣  Deploying PostgreSQL...
  5️⃣  Deploying DragonflyDB...
  6️⃣  Deploying Backend...
  8️⃣  Deploying Monitoring stack...

✅ All services deployed!
```

### Step 4-5: Pod 상태 확인

```bash
# Pod 상태 확인 (실시간)
kubectl get pods -n tiketi -w

# 모든 Pod이 Running이 될 때까지 대기 (2-3분)
# Ctrl+C로 종료
```

**정상 상태**:
```
NAME                         READY   STATUS    RESTARTS   AGE
backend-xxx                  1/1     Running   0          2m
frontend-xxx                 1/1     Running   0          2m
dragonfly-xxx                1/1     Running   0          3m
grafana-xxx                  1/1     Running   0          2m
loki-xxx                     1/1     Running   0          2m
postgres-xxx                 1/1     Running   0          3m
promtail-xxx                 1/1     Running   0          2m
```

### Step 4-6: 데이터베이스 초기화 🔥 **중요!**

**모든 Pod이 Running 상태가 되면, 데이터베이스 스키마를 초기화해야 합니다.**

```bash
# PostgreSQL Pod 이름 확인
kubectl get pods -n tiketi -l app=postgres

# 출력 예시:
# NAME                        READY   STATUS    RESTARTS   AGE
# postgres-548647c6fd-dpgrm   1/1     Running   0          5m

# 데이터베이스 스키마 적용 (Pod 이름을 실제 이름으로 변경)
cat database/init.sql | kubectl exec -i -n tiketi postgres-548647c6fd-dpgrm -- psql -U tiketi_user -d tiketi

# 정상 출력:
# CREATE EXTENSION
# CREATE TABLE
# CREATE TABLE
# ...
# INSERT 0 25  (샘플 데이터 25개 삽입)
```

**추가 마이그레이션 적용:**
```bash
# 뉴스 기능 추가
cat database/migration_add_news_and_keyword_mappings.sql | kubectl exec -i -n tiketi postgres-548647c6fd-dpgrm -- psql -U tiketi_user -d tiketi

# 뉴스 고정 기능 추가
cat database/migration_add_news_pinned.sql | kubectl exec -i -n tiketi postgres-548647c6fd-dpgrm -- psql -U tiketi_user -d tiketi

# 예약 외래키 설정
cat database/migrations/2025-11-21-alter-reservations-event-on-delete-set-null.sql | kubectl exec -i -n tiketi postgres-548647c6fd-dpgrm -- psql -U tiketi_user -d tiketi
```

**데이터베이스 초기화 확인:**
```bash
# 테이블 목록 확인
kubectl exec -n tiketi postgres-548647c6fd-dpgrm -- psql -U tiketi_user -d tiketi -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"

# 이벤트 개수 확인 (25개여야 함)
kubectl exec -n tiketi postgres-548647c6fd-dpgrm -- psql -U tiketi_user -d tiketi -c "SELECT COUNT(*) FROM events;"

# 관리자 계정 확인
kubectl exec -n tiketi postgres-548647c6fd-dpgrm -- psql -U tiketi_user -d tiketi -c "SELECT email, role FROM users;"

# 출력:
#      email      | role
# ----------------+-------
#  admin@tiketi.gg | admin
```

**Backend 재시작 (데이터베이스 반영):**
```bash
# Backend를 재시작하여 데이터베이스 연결 갱신
kubectl rollout restart deployment/backend -n tiketi

# Backend가 다시 Ready될 때까지 대기
kubectl wait --for=condition=ready pod -l app=backend -n tiketi --timeout=60s

# Backend 로그 확인 (에러가 없어야 함)
kubectl logs -n tiketi -l app=backend --tail=20
```

**✅ 이제 데이터베이스가 완전히 설정되었습니다!**
- 관리자 계정: `admin@tiketi.gg` / `admin123`
- 샘플 이벤트: 25개 (10CM, 싸이, 아이유, BTS, BLACKPINK 등)

---

## 5. 서비스 테스트

### Step 5-1: 포트 포워딩 설정

**새 터미널 창 열기** (⌘ + T):

```bash
# 프로젝트로 이동
cd ~/project-ticketing

# 포트 포워딩 실행 (이 터미널은 계속 열어둠)
./scripts/port-forward-all.sh
```

**출력**:
```
🔌 Setting up port forwarding for Tiketi services...

✅ Port forwarding active!

🌐 Access URLs:
  - Frontend UI: http://localhost:3000
  - Backend API: http://localhost:3001
  - Grafana: http://localhost:3002 (admin/admin)

💡 Press Ctrl+C to stop all port forwards
```

### Step 5-2: Backend API 테스트

**새 터미널에서**:

```bash
# Health Check
curl http://localhost:3001/api/health

# 정상 응답:
# {"status":"healthy","timestamp":"2025-12-11T..."}
```

**브라우저에서**:
- 🎨 Frontend UI: http://localhost:3000
- 🌐 Backend: http://localhost:3001/api/health
- 📖 API 문서: http://localhost:3001/api-docs
- 📊 Grafana: http://localhost:3002 (admin/admin)

### Step 5-3: PostgreSQL 접속

```bash
# PostgreSQL 클라이언트 설치 (최초 1회)
brew install postgresql

# PostgreSQL 접속
PGPASSWORD=tiketi_pass psql -h localhost -p 5432 -U tiketi_user -d tiketi

# 접속 후 테이블 확인
tiketi=# \dt

# 종료
tiketi=# \q
```

### Step 5-4: 로그 확인

```bash
# Backend 로그
kubectl logs -n tiketi -l app=backend -f

# 정상이면 이런 로그:
# ✅ Connected to PostgreSQL database
# ✅ Connected to DragonflyDB (Redis)
# 🚀 Server running on port 3001

# Ctrl+C로 종료
```

---

## 6. 트러블슈팅

### 문제 1: Docker가 동작 안 함

**증상**:
```bash
$ docker ps
Cannot connect to the Docker daemon
```

**해결**:
1. Docker Desktop 실행 확인 (상단 메뉴바 고래 아이콘)
2. Docker Desktop 재시작
3. 터미널 재시작

### 문제 2: Pod이 ImagePullBackOff

**증상**:
```bash
$ kubectl get pods -n tiketi
backend-xxx    0/1     ImagePullBackOff
```

**해결**:
```bash
# 이미지 다시 빌드
cd ~/project-ticketing
docker build -t tiketi-backend:local ./backend

# Kind에 로드
kind load docker-image tiketi-backend:local --name tiketi-local

# Pod 재시작
kubectl rollout restart deployment/backend -n tiketi
```

### 문제 3: 포트 충돌 (5432 등)

**증상**:
```
Error: bind: address already in use
```

**해결**:
```bash
# 5432 포트 사용 프로세스 확인
sudo lsof -i :5432

# PostgreSQL 중지
brew services stop postgresql

# 다시 클러스터 생성
kind delete cluster --name tiketi-local
./scripts/kind-cluster-create.sh
```

### 문제 4: Pod이 CrashLoopBackOff

**증상**:
```bash
$ kubectl get pods -n tiketi
backend-xxx    0/1     CrashLoopBackOff
```

**해결**:
```bash
# 로그 확인
kubectl logs -n tiketi <pod-name>

# 이전 로그 확인
kubectl logs -n tiketi <pod-name> --previous

# Pod 상세 정보
kubectl describe pod -n tiketi <pod-name>

# 일반적으로 DB 연결 문제
# PostgreSQL Pod이 먼저 Ready인지 확인
kubectl get pods -n tiketi -l app=postgres
```

---

## 7. 유용한 명령어

### 클러스터 관리
```bash
# 클러스터 목록
kind get clusters

# 클러스터 삭제
kind delete cluster --name tiketi-local

# 클러스터 재생성
./scripts/kind-cluster-create.sh
```

### Pod 관리
```bash
# 모든 Pod 확인
kubectl get pods -n tiketi

# Pod 재시작
kubectl rollout restart deployment/backend -n tiketi

# Pod 내부 접속
kubectl exec -it -n tiketi <pod-name> -- /bin/sh
```

### 로그 확인
```bash
# 실시간 로그
kubectl logs -n tiketi -l app=backend -f

# 최근 100줄
kubectl logs -n tiketi -l app=backend --tail=100
```

---

## 8. 완전 초기화

모든 것을 처음부터 다시 시작:

```bash
# 1. 포트 포워딩 중지 (실행 중인 터미널에서 Ctrl+C)

# 2. 클러스터 삭제
kind delete cluster --name tiketi-local

# 3. Docker 이미지 삭제 (선택)
docker rmi tiketi-backend:local

# 4. 처음부터 다시
cd ~/project-ticketing
./scripts/kind-cluster-create.sh
./scripts/build-and-load-images.sh
./scripts/deploy-all.sh

# 5. 데이터베이스 초기화 (🔥 중요!)
cat database/init.sql | kubectl exec -i -n tiketi <postgres-pod> -- psql -U tiketi_user -d tiketi
cat database/migration_add_news_and_keyword_mappings.sql | kubectl exec -i -n tiketi <postgres-pod> -- psql -U tiketi_user -d tiketi
cat database/migration_add_news_pinned.sql | kubectl exec -i -n tiketi <postgres-pod> -- psql -U tiketi_user -d tiketi
cat database/migrations/2025-11-21-alter-reservations-event-on-delete-set-null.sql | kubectl exec -i -n tiketi <postgres-pod> -- psql -U tiketi_user -d tiketi
kubectl rollout restart deployment/backend -n tiketi

# 6. 포트 포워딩 (새 터미널)
./scripts/port-forward-all.sh

# 7. 테스트
curl http://localhost:3001/health
```

---

## 9. Windows와의 차이점

| 항목 | Windows (WSL2) | Mac |
|------|----------------|-----|
| **환경** | WSL2 Ubuntu 필요 | 네이티브 터미널 |
| **Docker** | Docker Desktop + WSL Integration | Docker Desktop for Mac |
| **설치** | apt-get | Homebrew |
| **경로** | `/mnt/c/Users/...` | `~/...` |
| **줄바꿈** | dos2unix 필요 | 불필요 |
| **권한** | chmod 필요 | chmod 필요 |

---

## 10. 빠른 참조

### 체크리스트

**실행 전**:
- [ ] Docker Desktop 실행 중
- [ ] kubectl, kind 설치 완료
- [ ] 프로젝트 클론 및 mono-kind 브랜치

**배포 순서**:
1. [ ] `./scripts/kind-cluster-create.sh`
2. [ ] `./scripts/build-and-load-images.sh`
3. [ ] `./scripts/deploy-all.sh`
4. [ ] `kubectl get pods -n tiketi -w` (모두 Running)
5. [ ] 데이터베이스 초기화 (🔥 중요!)
   ```bash
   cat database/init.sql | kubectl exec -i -n tiketi <postgres-pod> -- psql -U tiketi_user -d tiketi
   cat database/migration_add_news_and_keyword_mappings.sql | kubectl exec -i -n tiketi <postgres-pod> -- psql -U tiketi_user -d tiketi
   cat database/migration_add_news_pinned.sql | kubectl exec -i -n tiketi <postgres-pod> -- psql -U tiketi_user -d tiketi
   cat database/migrations/2025-11-21-alter-reservations-event-on-delete-set-null.sql | kubectl exec -i -n tiketi <postgres-pod> -- psql -U tiketi_user -d tiketi
   kubectl rollout restart deployment/backend -n tiketi
   ```
6. [ ] `./scripts/port-forward-all.sh` (새 터미널)
7. [ ] `curl http://localhost:3001/health`

**접속 정보**:
- Backend: http://localhost:3001
- Grafana: http://localhost:3002 (admin/admin)
- PostgreSQL: localhost:5432

---

## 11. 유용한 Alias

`~/.zshrc` (또는 `~/.bash_profile`)에 추가:

```bash
# 편집
nano ~/.zshrc

# 아래 내용 추가
alias k='kubectl'
alias kgp='kubectl get pods -n tiketi'
alias kgs='kubectl get svc -n tiketi'
alias kl='kubectl logs -n tiketi'
alias kd='kubectl describe -n tiketi'

# 저장 후
source ~/.zshrc
```

---

**Mac은 Windows보다 훨씬 간단합니다!** 🎉

WSL2 없이 바로 터미널에서 실행하면 됩니다.

```bash
# Mac에서 시작하기
cd ~/project-ticketing
git checkout mono-kind
chmod +x scripts/*.sh
./scripts/kind-cluster-create.sh
```

행운을 빕니다! 🚀
