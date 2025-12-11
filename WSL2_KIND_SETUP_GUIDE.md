# WSL2 Ubuntu에서 Kind 실행 가이드

## 📋 목차
1. [WSL2 준비](#1-wsl2-준비)
2. [필수 도구 설치](#2-필수-도구-설치)
3. [프로젝트 접근](#3-프로젝트-접근)
4. [Kind 클러스터 실행](#4-kind-클러스터-실행)
5. [서비스 테스트](#5-서비스-테스트)
6. [트러블슈팅](#6-트러블슈팅)

---

## 1. WSL2 준비

### Step 1-1: WSL2 Ubuntu 접속

**Windows PowerShell 또는 터미널에서**:
```powershell
# WSL2 Ubuntu 접속
wsl

# 또는 Ubuntu 앱을 실행
```

접속하면 이런 화면이 나옵니다:
```
USER@DESKTOP-XXX:/mnt/c/Users/USER$
```

### Step 1-2: WSL 버전 확인

```bash
# WSL 버전 확인 (Windows PowerShell에서 실행)
wsl --list --verbose

# 출력 예시:
#   NAME      STATE           VERSION
# * Ubuntu    Running         2        <- VERSION이 2여야 함
```

만약 VERSION이 1이면:
```powershell
# Windows PowerShell에서 WSL2로 변경
wsl --set-version Ubuntu 2
```

---

## 2. 필수 도구 설치

### Step 2-1: Docker 설치 확인

**WSL2 Ubuntu에서**:
```bash
# Docker 버전 확인
docker --version

# Docker가 없으면 설치
# Docker Desktop for Windows를 사용하는 경우:
# - Docker Desktop 설정에서 "Use the WSL 2 based engine" 체크
# - Resources > WSL Integration > Ubuntu 체크
```

**Docker Desktop 설정 (Windows)**:
1. Docker Desktop 실행
2. Settings > General > "Use the WSL 2 based engine" ✅
3. Settings > Resources > WSL Integration
4. "Enable integration with my default WSL distro" ✅
5. Ubuntu 토글 ON ✅
6. Apply & Restart

**Docker 동작 확인**:
```bash
# WSL2에서 확인
docker ps

# 정상이면 이런 출력:
# CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

### Step 2-2: kubectl 설치

```bash
# kubectl 다운로드
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

# 실행 권한 부여
chmod +x kubectl

# /usr/local/bin으로 이동
sudo mv kubectl /usr/local/bin/

# 버전 확인
kubectl version --client

# 출력 예시:
# Client Version: v1.28.x
```

### Step 2-3: Kind 설치

```bash
# Kind 다운로드
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64

# 실행 권한 부여
chmod +x ./kind

# /usr/local/bin으로 이동
sudo mv ./kind /usr/local/bin/kind

# 버전 확인
kind version

# 출력 예시:
# kind v0.20.0 go1.20.4 linux/amd64
```

### Step 2-4: 모든 도구 설치 확인

```bash
# 한 번에 확인
echo "=== Docker ===" && docker --version
echo "=== kubectl ===" && kubectl version --client --short
echo "=== Kind ===" && kind version
```

**정상 출력 예시**:
```
=== Docker ===
Docker version 24.0.6, build ed223bc

=== kubectl ===
Client Version: v1.28.4

=== Kind ===
kind v0.20.0 go1.20.4 linux/amd64
```

---

## 3. 프로젝트 접근

### Step 3-1: Windows 프로젝트 경로로 이동

WSL2에서 Windows 파일은 `/mnt/c/` 아래에 있습니다.

```bash
# 프로젝트 디렉토리로 이동
cd /mnt/c/Users/USER/project-ticketing

# 현재 위치 확인
pwd
# 출력: /mnt/c/Users/USER/project-ticketing

# 파일 확인
ls -la

# kind-config.yaml, k8s/, scripts/ 등이 보여야 함
```

### Step 3-2: Git 브랜치 확인

```bash
# 현재 브랜치 확인
git branch

# mono-k3s 브랜치여야 함
# * mono-k3s
```

만약 다른 브랜치라면:
```bash
git checkout mono-k3s
```

### Step 3-3: 스크립트 실행 권한 확인

```bash
# 스크립트 실행 권한 확인
ls -la scripts/*.sh

# 모두 -rwxr-xr-x (실행 가능) 상태여야 함
# 만약 권한이 없다면:
chmod +x scripts/*.sh
```

---

## 4. Kind 클러스터 실행

### Step 4-1: Kind 클러스터 생성

```bash
# 프로젝트 루트에서 실행
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
Set kubectl context to "kind-tiketi-local"
You can now use your cluster with:

kubectl cluster-info --context kind-tiketi-local

✅ Kind cluster 'tiketi-local' created successfully!
```

**클러스터 확인**:
```bash
# 클러스터 정보
kubectl cluster-info

# 노드 확인
kubectl get nodes

# 출력 예시:
# NAME                          STATUS   ROLES           AGE   VERSION
# tiketi-local-control-plane    Ready    control-plane   2m    v1.27.3
# tiketi-local-worker           Ready    <none>          1m    v1.27.3
# tiketi-local-worker2          Ready    <none>          1m    v1.27.3
```

### Step 4-2: Docker 이미지 빌드 및 로드

```bash
# Backend 이미지 빌드 및 Kind에 로드
./scripts/build-and-load-images.sh
```

**진행 과정**:
```
🏗️  Building Docker images...

📦 Building Backend image...
[+] Building 45.2s (10/10) FINISHED
 => exporting to image
 => => naming to docker.io/library/tiketi-backend:local
✅ Backend image built: tiketi-backend:local

📦 Building Frontend image (optional)...
Do you want to build the frontend image? (y/n): n

📤 Loading images into Kind cluster...
Image: "tiketi-backend:local" with ID "sha256:..." not yet present on node "tiketi-local-control-plane", loading...
✅ Backend image loaded into cluster

✅ All images loaded successfully!
```

**이미지 확인**:
```bash
# Kind 클러스터 내부 이미지 확인
docker exec -it tiketi-local-control-plane crictl images | grep tiketi

# 출력:
# docker.io/library/tiketi-backend    local    xxx    100MB
```

### Step 4-3: 전체 서비스 배포

```bash
# 모든 Kubernetes 리소스 배포
./scripts/deploy-all.sh
```

**진행 과정**:
```
🚀 Deploying all services to Kind cluster...

📝 Applying Kubernetes manifests...
  1️⃣  Creating namespace...
namespace/tiketi created

  2️⃣  Creating ConfigMap and Secret...
configmap/tiketi-config created
secret/tiketi-secret created

  3️⃣  Creating PersistentVolumeClaims...
persistentvolumeclaim/postgres-pvc created
persistentvolumeclaim/dragonfly-pvc created
persistentvolumeclaim/grafana-pvc created
persistentvolumeclaim/loki-pvc created

  4️⃣  Deploying PostgreSQL...
deployment.apps/postgres created
service/postgres-service created

  5️⃣  Deploying DragonflyDB...
deployment.apps/dragonfly created
service/dragonfly-service created

  ⏳ Waiting for databases to be ready...
pod/postgres-xxx condition met
pod/dragonfly-xxx condition met

  6️⃣  Deploying Backend...
deployment.apps/backend created
service/backend-service created

  7️⃣  Deploying Frontend (optional)...
Do you want to deploy the frontend? (y/n): n

  8️⃣  Deploying Monitoring stack...
...

✅ All services deployed!
```

### Step 4-4: Pod 상태 확인

```bash
# Pod 상태 확인 (실시간 감시)
kubectl get pods -n tiketi -w

# 모든 Pod이 Running 상태가 될 때까지 대기
# Ctrl+C로 종료
```

**정상 상태 예시**:
```
NAME                         READY   STATUS    RESTARTS   AGE
backend-xxx                  1/1     Running   0          2m
dragonfly-xxx                1/1     Running   0          3m
grafana-xxx                  1/1     Running   0          2m
loki-xxx                     1/1     Running   0          2m
postgres-xxx                 1/1     Running   0          3m
promtail-xxx                 1/1     Running   0          2m
```

**주의**:
- `ContainerCreating` 상태는 정상입니다 (이미지 다운로드 중)
- `CrashLoopBackOff`가 나오면 문제 발생 (트러블슈팅 참고)

---

## 5. 서비스 테스트

### Step 5-1: 포트 포워딩 설정

**새 터미널 열기 (WSL2 새 세션)**:
```bash
# Windows 터미널에서 새 탭 열기 또는
wsl

# 프로젝트로 이동
cd /mnt/c/Users/USER/project-ticketing

# 포트 포워딩 실행
./scripts/port-forward-all.sh
```

**출력**:
```
🔌 Setting up port forwarding for Tiketi services...

⏳ Waiting for pods to be ready...
pod/backend-xxx condition met
pod/grafana-xxx condition met

🔌 Starting port forwards...

  📡 Backend API: localhost:3001 -> backend-service:3001
Forwarding from 127.0.0.1:3001 -> 3001
Forwarding from [::1]:3001 -> 3001

  📊 Grafana: localhost:3002 -> grafana-service:3000
Forwarding from 127.0.0.1:3002 -> 3000

  🐘 PostgreSQL: localhost:5432 -> postgres-service:5432
Forwarding from 127.0.0.1:5432 -> 5432

✅ Port forwarding active!

🌐 Access URLs:
  - Backend API: http://localhost:3001
  - Grafana: http://localhost:3002 (admin/admin)

💡 Press Ctrl+C to stop all port forwards
```

**이 터미널은 계속 열어둬야 합니다!**

### Step 5-2: Backend API 테스트

**새 터미널 열기 (WSL2 또는 Windows PowerShell)**:

```bash
# Health Check (WSL2에서)
curl http://localhost:3001/api/health

# 또는 Windows PowerShell에서
curl http://localhost:3001/api/health

# 정상 응답:
# {"status":"healthy","timestamp":"2025-12-11T..."}
```

**Windows 브라우저에서 테스트**:
- http://localhost:3001/api/health
- http://localhost:3001/api-docs (Swagger UI)

### Step 5-3: PostgreSQL 접속 테스트

```bash
# PostgreSQL 접속 (WSL2에서)
PGPASSWORD=tiketi_pass psql -h localhost -p 5432 -U tiketi_user -d tiketi

# PostgreSQL이 없다면 설치:
sudo apt-get update
sudo apt-get install -y postgresql-client

# 접속 후:
tiketi=# \dt
# 테이블 목록 확인

tiketi=# SELECT * FROM users LIMIT 5;
# 사용자 데이터 확인

tiketi=# \q
# 종료
```

### Step 5-4: Grafana 접속

**Windows 브라우저에서**:
1. http://localhost:3002 접속
2. 로그인:
   - **Username**: `admin`
   - **Password**: `admin`
3. 첫 로그인 시 비밀번호 변경 요청 (Skip 가능)

**Loki 데이터소스 확인**:
1. 좌측 메뉴 > Connections > Data sources
2. Loki가 자동으로 추가되어 있음
3. "Explore" 탭에서 로그 확인 가능

### Step 5-5: 로그 확인

```bash
# Backend 로그 확인
kubectl logs -n tiketi -l app=backend -f

# PostgreSQL 로그
kubectl logs -n tiketi -l app=postgres -f

# 모든 Pod 로그
kubectl logs -n tiketi --all-containers=true -f

# Ctrl+C로 종료
```

---

## 6. 트러블슈팅

### 문제 1: Docker가 WSL2에서 동작 안 함

**증상**:
```bash
$ docker ps
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```

**해결**:
1. Docker Desktop이 실행 중인지 확인
2. Docker Desktop 설정에서 WSL Integration 활성화:
   - Settings > Resources > WSL Integration
   - Ubuntu 활성화 ✅
3. WSL2 재시작:
   ```bash
   # Windows PowerShell에서
   wsl --shutdown

   # 다시 WSL 접속
   wsl
   ```

### 문제 2: Pod이 ImagePullBackOff 상태

**증상**:
```bash
$ kubectl get pods -n tiketi
NAME                      READY   STATUS             RESTARTS   AGE
backend-xxx               0/1     ImagePullBackOff   0          2m
```

**원인**: Kind 클러스터에 이미지가 로드되지 않음

**해결**:
```bash
# 1. 이미지 다시 빌드
cd /mnt/c/Users/USER/project-ticketing/backend
docker build -t tiketi-backend:local .

# 2. Kind에 로드
kind load docker-image tiketi-backend:local --name tiketi-local

# 3. Pod 재시작
kubectl rollout restart deployment/backend -n tiketi

# 4. 상태 확인
kubectl get pods -n tiketi -w
```

### 문제 3: Pod이 CrashLoopBackOff 상태

**증상**:
```bash
$ kubectl get pods -n tiketi
NAME                      READY   STATUS              RESTARTS   AGE
backend-xxx               0/1     CrashLoopBackOff    5          5m
```

**해결**:
```bash
# 1. 로그 확인
kubectl logs -n tiketi <pod-name>

# 2. 이전 로그 확인
kubectl logs -n tiketi <pod-name> --previous

# 3. Pod 상세 정보
kubectl describe pod -n tiketi <pod-name>

# 4. 일반적인 원인:
# - 데이터베이스 연결 실패
# - 환경 변수 누락
# - Init Container 실패
```

**데이터베이스 연결 확인**:
```bash
# PostgreSQL Pod이 Ready인지 확인
kubectl get pods -n tiketi -l app=postgres

# PostgreSQL 로그 확인
kubectl logs -n tiketi -l app=postgres

# Backend Init Container 로그 확인
kubectl logs -n tiketi <backend-pod> -c wait-for-postgres
```

### 문제 4: 포트 포워딩 안 됨

**증상**:
```bash
$ curl http://localhost:3001/api/health
curl: (7) Failed to connect to localhost port 3001
```

**해결**:
```bash
# 1. 포트 포워딩 프로세스 확인
ps aux | grep "kubectl port-forward"

# 2. 포트 포워딩 재시작
pkill -f "kubectl port-forward"
./scripts/port-forward-all.sh

# 3. 직접 포트 포워딩
kubectl port-forward -n tiketi service/backend-service 3001:3001
```

### 문제 5: "Permission denied" 스크립트 실행 시

**증상**:
```bash
$ ./scripts/kind-cluster-create.sh
-bash: ./scripts/kind-cluster-create.sh: Permission denied
```

**해결**:
```bash
# 실행 권한 부여
chmod +x scripts/*.sh

# 다시 실행
./scripts/kind-cluster-create.sh
```

### 문제 6: WSL2에서 Windows 경로 접근 느림

**증상**: 스크립트 실행이 매우 느림

**해결**:
프로젝트를 WSL2 파일시스템으로 복사:
```bash
# WSL2 홈으로 복사
cp -r /mnt/c/Users/USER/project-ticketing ~/project-ticketing

# 복사한 경로로 이동
cd ~/project-ticketing

# 이후 모든 작업을 여기서 진행
```

---

## 7. 유용한 명령어 모음

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

# Pod 삭제 (자동 재생성)
kubectl delete pod -n tiketi <pod-name>

# Pod 내부 접속
kubectl exec -it -n tiketi <pod-name> -- /bin/sh
```

### 로그 확인
```bash
# 실시간 로그
kubectl logs -n tiketi -l app=backend -f

# 최근 100줄
kubectl logs -n tiketi -l app=backend --tail=100

# 특정 시간 이후
kubectl logs -n tiketi -l app=backend --since=10m
```

### 리소스 확인
```bash
# 모든 리소스
kubectl get all -n tiketi

# 서비스 목록
kubectl get svc -n tiketi

# PVC 상태
kubectl get pvc -n tiketi

# ConfigMap, Secret
kubectl get cm,secret -n tiketi
```

### 디버깅
```bash
# Pod 이벤트 확인
kubectl get events -n tiketi --sort-by='.lastTimestamp'

# Pod 상세 정보
kubectl describe pod -n tiketi <pod-name>

# 서비스 엔드포인트 확인
kubectl get endpoints -n tiketi
```

---

## 8. 완전 초기화 및 재시작

모든 것을 처음부터 다시 시작하려면:

```bash
# 1. 포트 포워딩 중지
pkill -f "kubectl port-forward"

# 2. 클러스터 삭제
kind delete cluster --name tiketi-local

# 3. Docker 이미지 삭제 (선택)
docker rmi tiketi-backend:local
docker rmi tiketi-frontend:local

# 4. 처음부터 다시 시작
cd /mnt/c/Users/USER/project-ticketing

# 5. 클러스터 생성
./scripts/kind-cluster-create.sh

# 6. 이미지 빌드 및 로드
./scripts/build-and-load-images.sh

# 7. 서비스 배포
./scripts/deploy-all.sh

# 8. 포트 포워딩 (새 터미널)
./scripts/port-forward-all.sh

# 9. 테스트
curl http://localhost:3001/api/health
```

---

## 9. 빠른 참조 카드

### 📋 체크리스트

**클러스터 실행 전**:
- [ ] WSL2 Ubuntu 접속
- [ ] Docker Desktop 실행 중
- [ ] Docker, kubectl, Kind 설치 완료
- [ ] 프로젝트 경로 이동 완료

**배포 순서**:
1. [ ] `./scripts/kind-cluster-create.sh`
2. [ ] `./scripts/build-and-load-images.sh`
3. [ ] `./scripts/deploy-all.sh`
4. [ ] `kubectl get pods -n tiketi -w` (모두 Running 확인)
5. [ ] `./scripts/port-forward-all.sh` (새 터미널)
6. [ ] `curl http://localhost:3001/api/health`

**접속 정보**:
- Backend: http://localhost:3001
- Grafana: http://localhost:3002 (admin/admin)
- PostgreSQL: localhost:5432 (tiketi_user/tiketi_pass)

---

## 10. 자주 사용하는 Alias (선택)

`~/.bashrc`에 추가하면 편리합니다:

```bash
# ~/.bashrc 편집
nano ~/.bashrc

# 아래 내용 추가
alias k='kubectl'
alias kgp='kubectl get pods -n tiketi'
alias kgs='kubectl get svc -n tiketi'
alias kl='kubectl logs -n tiketi'
alias kd='kubectl describe -n tiketi'
alias kdel='kubectl delete -n tiketi'
alias kex='kubectl exec -it -n tiketi'

# 저장 후
source ~/.bashrc
```

사용 예시:
```bash
# kubectl get pods -n tiketi 대신
kgp

# kubectl logs -n tiketi -l app=backend -f 대신
kl -l app=backend -f
```

---

**이제 시작하세요! 🚀**

1. WSL2 접속: `wsl`
2. 프로젝트 이동: `cd /mnt/c/Users/USER/project-ticketing`
3. 클러스터 생성: `./scripts/kind-cluster-create.sh`

행운을 빕니다! 문제가 생기면 트러블슈팅 섹션을 참고하세요.
