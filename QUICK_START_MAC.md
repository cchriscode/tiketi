# TIKETI Quick Start Guide (macOS)

> macOS에서 TIKETI 시스템을 로컬에서 실행하는 간단 가이드

## 📋 목차

1. [빠른 시작 (자동 설치)](#빠른-시작-자동-설치) ⭐ **권장**
2. [사전 요구사항](#사전-요구사항)
3. [접속 및 테스트](#접속-및-테스트)
4. [문제 해결](#문제-해결)

---

## ⚡ 시작하기 전에

**필수 확인사항:**
1. ✅ Docker Desktop 실행 중
2. ✅ 프로젝트 디렉터리로 이동: `cd /path/to/project-ticketing`

**전체 삭제 후 재시작하려면:**
```bash
./scripts/cleanup.sh
```

---

## 빠른 시작 (자동 설치)

### 시스템 설치 1회

**터미널에서 실행:**
```bash
# 프로젝트 루트에서 실행
chmod +x scripts/setup-tiketi.sh
./scripts/setup-tiketi.sh
```

**이 스크립트가 자동으로 실행:**
1. ✅ Kind 클러스터 생성
2. ✅ PostgreSQL 배포 및 스키마 설정
3. ✅ 모든 Docker 이미지 빌드
4. ✅ 모든 서비스 배포
5. ✅ 준비 완료 확인

**소요 시간:** 5-10분

완료 후 포트포워딩만 실행하면 됩니다!

---

## 포트포워딩 시작

**터미널에서 실행:**
```bash
./scripts/port-forward-all.sh
```

**이 스크립트가 실행:**
- 사용 중인 포트 자동 정리
- 7개 서비스 포트포워드 시작
- Health Check 자동 실행
- 접속 URL 표시

**브라우저에서 접속:**
```
http://localhost:3000
```

---

## 접속 및 테스트

### 1. 접속 URL

| 서비스 | URL | 설명 |
|--------|-----|------|
| **Frontend** | http://localhost:3000 | 메인 사용자 웹사이트 |
| **Backend API** | http://localhost:3001 | Legacy API (Admin 등) |
| **Auth Service** | http://localhost:3005 | 인증 서비스(MSA) |
| **Ticket Service** | http://localhost:3002 | 티켓 판매 서비스 |
| **Payment Service** | http://localhost:3003 | 결제 서비스 |
| **Stats Service** | http://localhost:3004 | 통계 서비스 |
| **PostgreSQL** | localhost:5432 | 데이터베이스 |

### 2. 기본 테스트

#### A. 회원가입 & 로그인
1. http://localhost:3000 접속
2. 회원가입(우측 상단)
3. 로그인

#### B. 티켓 판매 플로우
1. 메인 페이지에서 이벤트 선택
2. 좌석 선택
3. 결제 수단 선택
   - Naver Pay (Mock)
   - Kakao Pay (Mock)
   - 계좌이체 (Mock)
4. 판매 완료 확인

#### C. 관리자 기능
1. http://localhost:3000/admin 접속
2. Admin 로그인
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

## 사전 요구사항

### 필수 소프트웨어
- **Docker Desktop** (v4.0 이상)
- **Homebrew** (패키지 관리자)
- **Node.js** v18 이상
- **Git**

### 설치 확인
```bash
docker --version
kubectl version --client
kind version
node --version
```

### 필요 시 설치 (Homebrew)
```bash
# Homebrew 설치 (없는 경우)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# kubectl 설치
brew install kubectl

# kind 설치
brew install kind

# Node.js 설치
brew install node
```

---

## 단계별 실행 (선택사항)

자동 스크립트 대신 단계별로 실행하려면:

```bash
# 1단계: 클러스터 설정
./scripts/1-setup-cluster.sh

# 2단계: Database 설정
./scripts/2-setup-database.sh

# 3단계: 빌드 & 배포
./scripts/3-build-and-deploy.sh
```

---

## 문제 해결

### Pod가 CrashLoopBackOff 상태인 경우

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

# 재시 로드
kind load docker-image tiketi-auth-service:local --name tiketi-local
kind load docker-image tiketi-ticket-service:local --name tiketi-local
kind load docker-image tiketi-payment-service:local --name tiketi-local
kind load docker-image tiketi-stats-service:local --name tiketi-local
kind load docker-image tiketi-backend:local --name tiketi-local
kind load docker-image tiketi-frontend:local --name tiketi-local
```

### Port-Forward 중단

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
kubectl exec -it -n tiketi $(kubectl get pod -n tiketi -l app=frontend -o jsonpath='{.items[0].metadata.name}') -- wget -O- http://backend-service:3001/health
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

시스템을 완전히 초기화하고 재시작하려면:

```bash
# 전체 삭제
./scripts/cleanup.sh

# 재시작
./scripts/setup-tiketi.sh
./scripts/port-forward-all.sh
```

**cleanup.sh가 정리:**
- ✅ 실행 중인 port-forward 프로세스
- ✅ Kind cluster 전체 삭제
- ✅ Docker images 삭제 (선택사항)
- ✅ node_modules 폴더 삭제 (선택사항)

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

## 개발 모드

개발 중에는 로컬에서 직접 실행하는 것이 더 편리합니다:

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

이 경우 PostgreSQL은 여전히 K8s에서 실행되어야 하며, `localhost:5432`로 port-forward 필요.

---

## 추가 문서

- **MSA 아키텍처**: [MSA_ARCHITECTURE.md](./MSA_ARCHITECTURE.md)
- **마이그레이션 계획**: [MSA_MIGRATION_PLAN.md](./MSA_MIGRATION_PLAN.md)
- **API 문서**: [fix_backend_api.md](./fix_backend_api.md)

---

**Happy Ticketing! 🎫**
