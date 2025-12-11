# Kind 로컬 Kubernetes 배포 가이드

## 📋 개요

이 브랜치(`mono-k3s`)는 Tiketi 애플리케이션을 **모놀리식 구조 그대로** Kind 로컬 Kubernetes 클러스터에 배포하기 위한 설정입니다.

### 아키텍처
- **구조**: 모놀리식 (Monolithic)
- **배포 환경**: Kind 로컬 Kubernetes
- **컴포넌트**:
  - Backend (Node.js Express) - 단일 Pod
  - PostgreSQL 15 - StatefulSet
  - DragonflyDB (Redis 호환) - StatefulSet
  - Grafana + Loki + Promtail - 모니터링 스택

---

## 🛠️ 사전 준비

### 필수 도구 설치

```bash
# 1. Docker Desktop 설치
# https://www.docker.com/products/docker-desktop

# 2. kubectl 설치
# Windows (Chocolatey)
choco install kubernetes-cli

# macOS (Homebrew)
brew install kubectl

# 3. Kind 설치
# Windows (Chocolatey)
choco install kind

# macOS (Homebrew)
brew install kind

# Linux
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
```

### 버전 확인

```bash
docker --version    # Docker 20.10+
kubectl version     # Kubernetes 1.27+
kind version        # Kind 0.20+
```

---

## 🚀 빠른 시작

### 1단계: 클러스터 생성

```bash
# 스크립트에 실행 권한 부여 (Linux/Mac)
chmod +x scripts/*.sh

# Kind 클러스터 생성
./scripts/kind-cluster-create.sh
```

생성되는 클러스터 구성:
- **Control Plane**: 1개 노드
- **Worker Nodes**: 2개 노드
- **Port Mapping**:
  - 3001 → Backend API
  - 3000 → Frontend (선택)
  - 3002 → Grafana
  - 5432 → PostgreSQL (디버깅용)

### 2단계: Docker 이미지 빌드 및 로드

```bash
# Backend 이미지 빌드 및 Kind에 로드
./scripts/build-and-load-images.sh

# Frontend도 빌드하려면 스크립트 실행 중 'y' 입력
```

### 3단계: 전체 서비스 배포

```bash
# 모든 Kubernetes 리소스 배포
./scripts/deploy-all.sh

# Pod 상태 확인
kubectl get pods -n tiketi -w
```

### 4단계: 포트 포워딩 설정

```bash
# 별도 터미널에서 실행
./scripts/port-forward-all.sh

# 또는 백그라운드로 실행
nohup ./scripts/port-forward-all.sh &
```

---

## 📡 접속 정보

포트 포워딩 후 다음 URL로 접속 가능:

| 서비스 | URL | 설명 |
|--------|-----|------|
| **Backend API** | http://localhost:3001 | REST API 엔드포인트 |
| **Health Check** | http://localhost:3001/api/health | 헬스 체크 |
| **Swagger API Docs** | http://localhost:3001/api-docs | API 문서 |
| **Frontend** | http://localhost:3000 | React 앱 (배포 시) |
| **Grafana** | http://localhost:3002 | 모니터링 대시보드 |
| **PostgreSQL** | localhost:5432 | DB 직접 접속 (디버깅) |
| **DragonflyDB** | localhost:6379 | Redis 직접 접속 (디버깅) |

### Grafana 로그인
- **Username**: `admin`
- **Password**: `admin`

---

## 📊 상태 확인

### Pod 상태 확인

```bash
# 모든 Pod 확인
kubectl get pods -n tiketi

# 특정 Pod 로그 확인
kubectl logs -n tiketi -l app=backend -f
kubectl logs -n tiketi -l app=postgres -f

# Pod 상세 정보
kubectl describe pod -n tiketi <pod-name>
```

### 서비스 확인

```bash
# 모든 서비스 확인
kubectl get svc -n tiketi

# 엔드포인트 확인
kubectl get endpoints -n tiketi
```

### 리소스 사용량

```bash
# Node 리소스 사용량
kubectl top nodes

# Pod 리소스 사용량
kubectl top pods -n tiketi
```

---

## 🔧 데이터베이스 초기화

### PostgreSQL 초기 데이터 로드

```bash
# PostgreSQL Pod에 접속
kubectl exec -it -n tiketi deployment/postgres -- psql -U tiketi_user -d tiketi

# 또는 로컬에서 직접 연결 (포트 포워딩 후)
psql -h localhost -p 5432 -U tiketi_user -d tiketi

# 초기 스크립트 실행
kubectl exec -it -n tiketi deployment/postgres -- psql -U tiketi_user -d tiketi -f /docker-entrypoint-initdb.d/init.sql
```

### DragonflyDB 확인

```bash
# Redis CLI로 연결
kubectl exec -it -n tiketi deployment/dragonfly -- redis-cli

# 또는 로컬에서
redis-cli -h localhost -p 6379
```

---

## 🛠️ 트러블슈팅

### Pod이 Running 상태가 안 될 때

```bash
# Pod 상태 확인
kubectl get pods -n tiketi

# 이벤트 확인
kubectl get events -n tiketi --sort-by='.lastTimestamp'

# Pod 로그 확인
kubectl logs -n tiketi <pod-name>

# Pod describe로 상세 정보 확인
kubectl describe pod -n tiketi <pod-name>
```

### 이미지 Pull 에러

```bash
# Kind 클러스터 내부에 이미지가 로드되었는지 확인
docker exec -it tiketi-local-control-plane crictl images

# 이미지 다시 로드
kind load docker-image tiketi-backend:local --name tiketi-local
```

### 데이터베이스 연결 실패

```bash
# PostgreSQL Pod가 Ready 상태인지 확인
kubectl get pods -n tiketi -l app=postgres

# PostgreSQL 로그 확인
kubectl logs -n tiketi -l app=postgres

# 서비스 연결 테스트
kubectl run test-pod --image=postgres:15-alpine -it --rm --restart=Never -- \
  psql -h postgres-service.tiketi.svc.cluster.local -U tiketi_user -d tiketi
```

### Backend가 시작 안 될 때

```bash
# Init Container 로그 확인
kubectl logs -n tiketi <backend-pod-name> -c wait-for-postgres
kubectl logs -n tiketi <backend-pod-name> -c wait-for-dragonfly

# Backend 로그 확인
kubectl logs -n tiketi -l app=backend -f

# 환경 변수 확인
kubectl exec -it -n tiketi deployment/backend -- env | grep -E 'DB_|REDIS_'
```

---

## 🗑️ 정리

### 전체 리소스 삭제

```bash
# Namespace 삭제 (모든 리소스 삭제)
kubectl delete namespace tiketi

# 또는 개별 삭제
kubectl delete -f k8s/
```

### 클러스터 삭제

```bash
# 클러스터 완전 삭제
./scripts/kind-cluster-delete.sh

# 또는 직접 삭제
kind delete cluster --name tiketi-local
```

---

## 📁 프로젝트 구조

```
project-ticketing/
├── k8s/                              # Kubernetes Manifests
│   ├── 00-namespace.yaml             # tiketi namespace
│   ├── 01-configmap.yaml             # 환경 변수
│   ├── 02-secret.yaml                # 민감 정보
│   ├── 03-pvc.yaml                   # PersistentVolumeClaim
│   ├── 04-postgres.yaml              # PostgreSQL
│   ├── 05-dragonfly.yaml             # DragonflyDB
│   ├── 06-backend.yaml               # Backend
│   ├── 07-frontend.yaml              # Frontend (선택)
│   ├── 08-loki.yaml                  # Loki
│   ├── 09-promtail.yaml              # Promtail
│   └── 10-grafana.yaml               # Grafana
│
├── scripts/                          # 배포 스크립트
│   ├── kind-cluster-create.sh        # 클러스터 생성
│   ├── kind-cluster-delete.sh        # 클러스터 삭제
│   ├── build-and-load-images.sh      # 이미지 빌드 및 로드
│   ├── deploy-all.sh                 # 전체 배포
│   └── port-forward-all.sh           # 포트 포워딩
│
├── kind-config.yaml                  # Kind 클러스터 설정
├── backend/                          # Backend 소스
├── frontend/                         # Frontend 소스
└── claudedocs/                       # 마이그레이션 문서
    └── KIND_LOCAL_MIGRATION_PLAN.md  # 상세 계획
```

---

## 🔄 개발 워크플로우

### 코드 수정 후 재배포

```bash
# 1. Backend 코드 수정

# 2. 이미지 재빌드 및 로드
cd backend
docker build -t tiketi-backend:local .
kind load docker-image tiketi-backend:local --name tiketi-local

# 3. Pod 재시작
kubectl rollout restart deployment/backend -n tiketi

# 4. 로그 확인
kubectl logs -n tiketi -l app=backend -f
```

### 환경 변수 수정

```bash
# ConfigMap 또는 Secret 수정
kubectl edit configmap tiketi-config -n tiketi
kubectl edit secret tiketi-secret -n tiketi

# Pod 재시작 (환경 변수 적용)
kubectl rollout restart deployment/backend -n tiketi
```

---

## 📚 추가 문서

- [KIND_LOCAL_MIGRATION_PLAN.md](./claudedocs/KIND_LOCAL_MIGRATION_PLAN.md) - 상세 마이그레이션 계획
- [K8S_MSA_STEP_BY_STEP_MIGRATION_GUIDE.md](./claudedocs/K8S_MSA_STEP_BY_STEP_MIGRATION_GUIDE.md) - 단계별 가이드
- [REALISTIC_K8S_MIGRATION_ROADMAP.md](./claudedocs/REALISTIC_K8S_MIGRATION_ROADMAP.md) - 로드맵

---

## ⚠️ 주의사항

1. **로컬 개발 전용**: 이 설정은 로컬 개발 환경을 위한 것입니다.
2. **프로덕션 부적합**: 실제 프로덕션 환경에는 적합하지 않습니다.
3. **데이터 영속성**: Kind 클러스터 삭제 시 모든 데이터가 삭제됩니다.
4. **리소스 사용**: Docker Desktop에 최소 4GB RAM 할당 권장합니다.

---

## 🆘 도움말

### 주요 명령어

```bash
# 클러스터 정보
kubectl cluster-info

# 현재 context 확인
kubectl config current-context

# Context 변경
kubectl config use-context kind-tiketi-local

# Namespace 전환
kubectl config set-context --current --namespace=tiketi

# 모든 리소스 확인
kubectl get all -n tiketi
```

### 유용한 Alias

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가
alias k='kubectl'
alias kgp='kubectl get pods -n tiketi'
alias kgs='kubectl get svc -n tiketi'
alias kl='kubectl logs -n tiketi'
alias kd='kubectl describe -n tiketi'
```

---

**작성일**: 2025-12-11
**브랜치**: mono-k3s
**환경**: Kind 로컬 Kubernetes
**아키텍처**: 모놀리식 (Monolithic)
