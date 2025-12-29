# Tiketi MSA 배포 가이드 (Kind Local)

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [사전 요구사항](#사전-요구사항)
3. [아키텍처](#아키텍처)
4. [배포 순서](#배포-순서)
5. [트러블슈팅](#트러블슈팅)
6. [API 테스트](#api-테스트)

---

## 프로젝트 개요

### MSA 서비스 구성
```
tiketi/
├── services/
│   ├── auth-service (3010)      # 인증/회원가입
│   ├── ticket-service (3002)    # 이벤트/예약/좌석/큐
│   ├── payment-service (3003)   # 결제 처리
│   └── stats-service (3004)     # 통계/관리자
├── frontend/                     # React 프론트엔드
├── k8s/                         # K8s Manifests
└── database/                    # DB 초기화 스크립트
```

### 기술 스택
- **Container**: Docker, Kind
- **Orchestration**: Kubernetes
- **Ingress**: Nginx Ingress Controller
- **Database**: PostgreSQL 16
- **Cache**: DragonflyDB (Redis compatible)
- **Backend**: Node.js 18
- **Frontend**: React

---

## 사전 요구사항

### 필수 도구
```bash
# Docker Desktop
brew install --cask docker

# Kind
brew install kind

# kubectl
brew install kubectl

# Node.js
brew install node@18
```

### 버전 확인
```bash
docker --version          # Docker version 24.x+
kind --version           # kind v0.20.0+
kubectl version --client # v1.28.0+
node --version          # v18.x+
```

---

## 아키텍처

### 네트워크 구조
```
[User] 
  ↓
[localhost:8080] (Host)
  ↓
[Nginx Ingress Controller] (Kind Cluster)
  ↓
  ├─→ /api/auth/*        → Auth Service (3010)
  ├─→ /api/events/*      → Ticket Service (3002)
  ├─→ /api/payments/*    → Payment Service (3003)
  ├─→ /api/admin/*       → Stats Service (3004)
  └─→ /*                 → Frontend (3000)
```

### 데이터베이스
```
PostgreSQL (5432)
├── users
├── events
├── reservations
├── payments
└── ... (총 9개 테이블)
```

---

## 배포 순서

### 1. 프로젝트 클론
```bash
cd ~/
git clone <your-repo>
cd tiketi
```

### 2. Kind 클러스터 생성
```bash
kind create cluster --config kind-config.yaml

# 확인
kind get clusters
# 출력: tiketi-local
```

### 3. Nginx Ingress 설치
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# 준비 대기
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

### 4. Docker 이미지 빌드
```bash
chmod +x scripts/build-msa-images.sh
./scripts/build-msa-images.sh
```

**빌드 과정:**
```bash
# 개별 빌드 (참고용)
docker build -t tiketi-auth-service:local services/auth-service/
docker build -t tiketi-ticket-service:local services/ticket-service/
docker build -t tiketi-payment-service:local services/payment-service/
docker build -t tiketi-stats-service:local services/stats-service/
docker build -t tiketi-frontend:local frontend/

# Kind에 로드
kind load docker-image tiketi-auth-service:local --name tiketi-local
kind load docker-image tiketi-ticket-service:local --name tiketi-local
kind load docker-image tiketi-payment-service:local --name tiketi-local
kind load docker-image tiketi-stats-service:local --name tiketi-local
kind load docker-image tiketi-frontend:local --name tiketi-local
```

### 5. K8s 리소스 배포
```bash
# Namespace
kubectl apply -f k8s/00-namespace.yaml

# ConfigMap & Secret
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secret.yaml

# Storage
kubectl apply -f k8s/03-pvc.yaml

# Database
kubectl apply -f k8s/04-postgres.yaml
kubectl apply -f k8s/05-dragonfly.yaml

# 데이터베이스 준비 대기 (중요!)
sleep 30

# MSA Services
kubectl apply -f k8s/06-auth-service.yaml
kubectl apply -f k8s/07-ticket-service.yaml
kubectl apply -f k8s/08-payment-service.yaml
kubectl apply -f k8s/09-stats-service.yaml

# Frontend
kubectl apply -f k8s/10-frontend.yaml

# Ingress
kubectl apply -f k8s/14-ingress.yaml
```

### 6. DB 초기화
```bash
# ConfigMap에 init.sql 추가
kubectl create configmap postgres-init-script \
  --from-file=init.sql=database/init.sql \
  -n tiketi \
  --dry-run=client -o yaml | kubectl apply -f -

# 수동 실행
kubectl exec -n tiketi deployment/postgres -i -- \
  psql -U tiketi_user -d tiketi < database/init.sql

# 테이블 확인
kubectl exec -n tiketi deployment/postgres -- \
  psql -U tiketi_user -d tiketi -c "\dt"
```

**예상 출력:**
```
                List of relations
 Schema |       Name        | Type  |    Owner    
--------+-------------------+-------+-------------
 public | events            | table | tiketi_user
 public | users             | table | tiketi_user
 ... (총 9개 테이블)
```

### 7. 포트포워딩
```bash
# Ingress 포트포워딩 (백그라운드)
kubectl port-forward -n ingress-nginx \
  svc/ingress-nginx-controller 8080:80 &

# 또는 별도 터미널에서 실행
kubectl port-forward -n ingress-nginx \
  svc/ingress-nginx-controller 8080:80
```

### 8. 배포 확인
```bash
# Pod 상태
kubectl get pods -n tiketi

# 예상 출력:
# NAME                              READY   STATUS    RESTARTS   AGE
# auth-service-xxx                  1/1     Running   0          2m
# ticket-service-xxx                1/1     Running   0          2m
# payment-service-xxx               1/1     Running   0          2m
# stats-service-xxx                 1/1     Running   0          2m
# postgres-xxx                      1/1     Running   0          3m
# dragonfly-xxx                     1/1     Running   0          3m
# frontend-xxx                      1/1     Running   0          2m

# Service 확인
kubectl get svc -n tiketi

# Ingress 확인
kubectl get ingress -n tiketi
```

---

## API 테스트

### 1. Health Check
```bash
# Auth Service
curl http://localhost:8080/api/auth/health

# Ticket Service
curl http://localhost:8080/api/events/health

# Payment Service
curl http://localhost:8080/api/payments/health

# Stats Service
curl http://localhost:8080/api/admin/health
```

### 2. 회원가입
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test1234",
    "name": "Test User"
  }'
```

**성공 응답:**
```json
{
  "message": "회원가입이 완료되었습니다.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "test@example.com",
    "name": "Test User",
    "role": "user"
  }
}
```

### 3. 로그인
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test1234"
  }'
```

### 4. Admin 로그인
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tiketi.gg",
    "password": "admin123"
  }'
```

### 5. 이벤트 목록
```bash
curl http://localhost:8080/api/events
```

**성공 응답:**
```json
{
  "events": [
    {
      "id": "...",
      "title": "2024 콘서트 투어 in 서울",
      "venue": "올림픽공원 체조경기장",
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

---

## 트러블슈팅

### 1. Pod가 CrashLoopBackOff
```bash
# 로그 확인
kubectl logs -n tiketi <pod-name>

# 일반적인 원인:
# - DB 연결 실패 → PostgreSQL Pod 상태 확인
# - 환경변수 누락 → ConfigMap/Secret 확인
# - 포트 충돌 → server.js에서 app.listen() 중복 확인
```

### 2. "relation does not exist" 에러
```bash
# DB 초기화 필요
kubectl exec -n tiketi deployment/postgres -i -- \
  psql -U tiketi_user -d tiketi < database/init.sql
```

### 3. Ingress 404 에러
```bash
# Ingress 설정 확인
kubectl describe ingress -n tiketi tiketi-ingress

# 서비스 prefix 확인
# - Auth Service: app.use('/', authRoutes)  ← /api/auth 없이!
# - Ticket Service: app.use('/events', ...)  ← /api/v1 없이!
```

### 4. 이미지 로드 실패
```bash
# Kind 클러스터 내 이미지 확인
docker exec -it tiketi-local-control-plane crictl images | grep tiketi

# 없으면 다시 로드
kind load docker-image tiketi-auth-service:local --name tiketi-local
```

### 5. 포트포워딩 충돌
```bash
# 기존 프로세스 종료
pkill -f "port-forward"

# 또는 특정 포트 확인
lsof -ti:8080 | xargs kill -9

# 재시작
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80 &
```

---

## 유용한 명령어

### 로그 확인
```bash
# 특정 서비스 로그
kubectl logs -n tiketi -l app=auth-service --tail=50

# 실시간 로그
kubectl logs -n tiketi -l app=auth-service -f

# 전체 Pod 로그
kubectl logs -n tiketi --all-containers=true
```

### 재시작
```bash
# 특정 서비스 재시작
kubectl rollout restart deployment -n tiketi auth-service

# 전체 재시작
kubectl rollout restart deployment -n tiketi
```

### 디버깅
```bash
# Pod 내부 접속
kubectl exec -n tiketi deployment/auth-service -it -- /bin/sh

# PostgreSQL 접속
kubectl exec -n tiketi deployment/postgres -it -- \
  psql -U tiketi_user -d tiketi

# 환경변수 확인
kubectl exec -n tiketi deployment/auth-service -- printenv | grep DB_
```

### 정리
```bash
# 전체 삭제
kubectl delete namespace tiketi

# Kind 클러스터 삭제
kind delete cluster --name tiketi-local

# Docker 이미지 삭제
docker rmi tiketi-auth-service:local
docker rmi tiketi-ticket-service:local
docker rmi tiketi-payment-service:local
docker rmi tiketi-stats-service:local
docker rmi tiketi-frontend:local
```

---

## 다음 단계

1. ✅ MSA 4개 서비스 배포 완료
2. �� Frontend 연결 테스트
3. 🔄 실제 예매 플로우 테스트
4. ⏰ Google OAuth 연동 (3주차)
5. ⏰ 토스페이먼츠 연동 (3주차)
6. ⏰ EKS 마이그레이션 (선택)

---

## 참고 문서

- [Kind Documentation](https://kind.sigs.k8s.io/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Nginx Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
