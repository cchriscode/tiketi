# TIKETI - 실시간 이벤트 티케팅 플랫폼

<div align="center">

**빠르고 안정적인 대규모 티케팅 시스템**

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[빠른 시작](#-빠른-시작) • [기능](#-주요-기능) • [아키텍처](#-시스템-아키텍처) • [배포](#-배포) • [문서](#-문서)

</div>

---

## 📖 소개

**TIKETI**는 **마이크로서비스 아키텍처(MSA)** 기반의 현대적인 이벤트 티케팅 플랫폼입니다. 대규모 트래픽 상황에서도 안정적인 실시간 좌석 예매, 결제 처리, 대기열 관리 기능을 제공합니다.

### 핵심 특징

🚀 **고성능 실시간 시스템**
- WebSocket 기반 실시간 좌석 현황 업데이트
- Redis Pub/Sub을 통한 멀티 Pod 동기화
- 10,000+ 동시 접속자 처리 가능

⚡ **지능형 대기열 시스템**
- 대규모 이벤트를 위한 자동 대기열 관리
- Redis 기반 공정한 선착순 처리
- 실시간 대기 순번 및 진입 알림

💳 **안전한 결제 처리**
- Toss Payments 완전 통합
- 서버 사이드 결제 검증
- 전체 결제 흐름 감사 로그

🎯 **확장 가능한 MSA 구조**
- 4개 독립 마이크로서비스 (Auth, Ticket, Payment, Stats)
- Kubernetes 네이티브 배포
- 수평 확장 준비 완료

📊 **실시간 모니터링**
- Prometheus + Grafana 대시보드
- Loki 중앙 집중식 로깅
- 서비스별 메트릭 수집

---

## 🎯 주요 기능

### 사용자 기능

| 기능 | 설명 |
|------|------|
| **이벤트 검색** | 한글/영문 퍼지 검색, 아티스트/장소별 필터링 |
| **실시간 좌석 선택** | WebSocket 기반 실시간 좌석 현황, 5분 좌석 lock |
| **대기열 시스템** | 고트래픽 이벤트 자동 대기열, 실시간 순번 업데이트 |
| **간편 결제** | Toss Payments 위젯, 카드/계좌이체/간편결제 |
| **예매 내역** | 예매 조회, QR 코드, 결제 영수증 |
| **뉴스** | 이벤트 소식, 공지사항 |

### 관리자 기능

| 기능 | 설명 |
|------|------|
| **이벤트 관리** | 이벤트 생성/수정/삭제, 좌석 배치 설정 |
| **예매 모니터링** | 실시간 예매 현황, 취소/환불 처리 |
| **통계 대시보드** | 일별 매출, 인기 이벤트, 사용자 증가 추이 |
| **대기열 관리** | 대기열 상태 확인, 강제 진입 허용 |
| **뉴스 발행** | 공지사항 및 소식 게시 |

### 기술 기능

- ✅ JWT 인증 + Google OAuth 2.0 소셜 로그인
- ✅ WebSocket 세션 관리 및 자동 재연결
- ✅ 트랜잭션 기반 결제 처리 (ACID 보장)
- ✅ PostgreSQL 스키마 기반 서비스 격리
- ✅ Prometheus 메트릭 수집 및 알림
- ✅ Graceful shutdown 및 Health check
- ✅ AWS S3 이미지 업로드 (선택)

---

## 🏗️ 시스템 아키텍처

### 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Kubernetes Cluster (tiketi namespace)              │
│                                                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐            │
│  │  Frontend   │    │   Backend   │    │Auth Service  │            │
│  │ (Port 3000) │───▶│ (Port 3001) │───▶│ (Port 3005)  │            │
│  │  React SPA  │    │   Gateway   │    │  JWT + OAuth │            │
│  │  + Nginx    │    │   + Admin   │    └──────────────┘            │
│  └─────────────┘    └──────┬──────┘                                 │
│                            │                                         │
│         ┌──────────────────┼──────────────────┐                     │
│         │                  │                  │                     │
│   ┌─────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐              │
│   │  Ticket    │   │  Payment    │   │   Stats     │              │
│   │  Service   │   │  Service    │   │  Service    │              │
│   │ (Port 3002)│   │ (Port 3003) │   │ (Port 3004) │              │
│   │ WebSocket  │   │TossPayments │   │  Analytics  │              │
│   │ + Queue    │   │Integration  │   │  Dashboard  │              │
│   └─────┬──────┘   └──────┬──────┘   └──────┬──────┘              │
│         │                  │                  │                     │
│         └──────────────────┼──────────────────┘                     │
│                            │                                         │
│              ┌─────────────┴─────────────┐                          │
│              │                           │                          │
│        ┌─────▼──────┐           ┌───────▼────────┐                 │
│        │PostgreSQL  │           │   Dragonfly    │                 │
│        │  (5432)    │           │ Redis (6379)   │                 │
│        │            │           │                │                 │
│        │ Schemas:   │           │  • Pub/Sub     │                 │
│        │ - auth_    │           │  • Cache       │                 │
│        │ - ticket_  │           │  • Queue       │                 │
│        │ - payment_ │           └────────────────┘                 │
│        │ - stats_   │                                               │
│        └────────────┘           ┌────────────────┐                 │
│                                  │  Monitoring    │                 │
│                                  │ Loki+Promtail  │                 │
│                                  │   + Grafana    │                 │
│                                  └────────────────┘                 │
└───────────────────────────────────────────────────────────────────────┘
```

### 마이크로서비스 구성

| 서비스 | 포트 | 책임 | 주요 기술 |
|--------|------|------|-----------|
| **Frontend** | 3000 | 사용자 인터페이스 | React 18, Socket.IO Client |
| **Backend** | 3001 | API Gateway, 관리자 기능 | Express, Socket.IO Server |
| **Auth Service** | 3005 | 인증 및 권한 관리 | JWT, bcrypt, Google OAuth |
| **Ticket Service** | 3002 | 이벤트/좌석/예약/대기열 | WebSocket, Redis, UUID |
| **Payment Service** | 3003 | 결제 처리 | Toss Payments API, Axios |
| **Stats Service** | 3004 | 통계 및 분석 | PostgreSQL 집계 쿼리 |

### 데이터베이스 설계

**PostgreSQL 15+ with Schema-based Isolation**

```sql
auth_schema
  ├── users (인증 정보, JWT 사용자)
  └── indexes (email, role)

ticket_schema
  ├── events (이벤트 정보)
  ├── seats (개별 좌석: section/row/number/status)
  ├── seat_layouts (JSONB 좌석 배치 템플릿)
  ├── ticket_types (티켓 종류: VIP, R석, S석 등)
  ├── reservations (예약)
  ├── reservation_items (예약 상세)
  ├── keyword_mappings (한영 검색 매핑)
  └── news (뉴스 기사)

payment_schema
  ├── payments (결제 내역 + Toss API 응답)
  └── payment_logs (결제 API 호출 감사 로그)

stats_schema
  ├── daily_stats (일별 통계)
  └── event_stats (이벤트별 통계)
```

**주요 특징**:
- UUID 기본 키 (분산 환경 친화적)
- JSONB 컬럼으로 유연한 데이터 저장
- pg_trgm 확장으로 퍼지 검색
- ON DELETE CASCADE 참조 무결성
- 자동 updated_at 트리거

---

## 🛠️ 기술 스택

### Backend

| 범주 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **런타임** | Node.js | 20+ | JavaScript 실행 환경 |
| **프레임워크** | Express | 4.18 | REST API 서버 |
| **실시간 통신** | Socket.IO | 4.7.2 | WebSocket 서버 |
| | @socket.io/redis-adapter | 8.2.1 | 멀티 Pod 동기화 |
| **데이터베이스** | PostgreSQL | 15+ | 메인 데이터베이스 |
| | pg | 8.11 | Node.js PostgreSQL 드라이버 |
| **캐시/큐** | Dragonfly | Latest | Redis 호환 캐시 |
| | ioredis | 5.3 | Redis 클라이언트 |
| **인증** | jsonwebtoken | 9.0 | JWT 토큰 발급/검증 |
| | bcrypt | 5.1 | 비밀번호 해싱 |
| | google-auth-library | 9.0 | Google OAuth |
| **결제** | Toss Payments API | v1 | 결제 처리 |
| **모니터링** | prom-client | 15.1 | Prometheus 메트릭 |
| | winston | 3.18 | 구조화 로깅 |

### Frontend

| 범주 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **프레임워크** | React | 18.2 | UI 라이브러리 |
| | React Router | 6.20 | 클라이언트 라우팅 |
| **실시간 통신** | socket.io-client | 4.7 | WebSocket 클라이언트 |
| **결제** | @tosspayments/payment-sdk | 1.9 | Toss 결제 위젯 |
| **차트** | Recharts | 3.6 | 통계 시각화 |
| **유틸리티** | date-fns | 3.0 | 날짜 포맷팅 |
| **웹서버** | Nginx | Alpine | 정적 파일 서빙 |

### Infrastructure

| 범주 | 기술 | 용도 |
|------|------|------|
| **컨테이너** | Docker | 20.10+ | 컨테이너화 |
| **오케스트레이션** | Kubernetes | 1.27+ | 컨테이너 오케스트레이션 |
| **로컬 클러스터** | Kind | 0.20+ | 로컬 Kubernetes 클러스터 |
| **모니터링** | Prometheus | Latest | 메트릭 수집 |
| | Loki | Latest | 로그 집계 |
| | Promtail | Latest | 로그 수집 |
| | Grafana | Latest | 대시보드 시각화 |

---

## 🚀 빠른 시작

### 사전 요구사항

| 항목 | Windows | macOS/Linux |
|------|---------|-------------|
| **Docker Desktop** | ✅ 필수 | ✅ 필수 |
| **Kind** | ✅ 자동 설치 | ✅ 자동 설치 |
| **kubectl** | ✅ 자동 설치 | ✅ 자동 설치 |
| **Git** | ✅ 필수 | ✅ 필수 |
| **WSL2** | ✅ WSL 사용 시 | ❌ 불필요 |

### One-Step 설치 (권장)

**Windows (PowerShell 관리자 권한)**
```powershell
# 1. 프로젝트 클론
git clone https://github.com/your-org/project-ticketing.git
cd project-ticketing

# 2. Docker Desktop 실행 확인

# 3. 전체 시스템 설치 (5-10분 소요)
.\setup-tiketi.ps1

# 4. Windows kubectl 설정 (최초 1회만)
.\setup-windows-kubectl.ps1

# 5. 포트포워딩 시작
.\start_port_forwards.ps1
```

**Linux / macOS / WSL**
```bash
# 1. 프로젝트 클론
git clone https://github.com/your-org/project-ticketing.git
cd project-ticketing

# 2. Docker Desktop 실행 확인

# 3. 전체 시스템 설치 (5-10분 소요)
./scripts/setup-tiketi.sh

# 4. 포트포워딩 시작
./scripts/port-forward-all.sh
```

### 접속 URL

```
🌐 Frontend:     http://localhost:3000
📡 Backend API:  http://localhost:3001
📊 Grafana:      http://localhost:30002  (admin/admin)
📚 API Docs:     http://localhost:3001/api-docs
```

### 기본 관리자 계정

```
Email:    admin@tiketi.gg
Password: admin123
```

---

## 📚 주요 설치 스크립트

### setup-tiketi.sh / setup-tiketi.ps1

**자동으로 수행하는 작업**:

1. ✅ **Kind 클러스터 생성** (`tiketi-local`)
   - 3-node 클러스터 (1 control-plane, 2 workers)
   - HostPort 매핑 설정

2. ✅ **PostgreSQL 배포**
   - StatefulSet 기반 배포
   - 10Gi 영구 볼륨
   - Health check 대기

3. ✅ **데이터베이스 스키마 생성**
   - 4개 서비스 스키마 (auth_, ticket_, payment_, stats_)
   - 마이그레이션 실행
   - 초기 데이터 로드 (25개 이벤트, 관리자 계정)

4. ✅ **Docker 이미지 빌드 (6개)**
   - tiketi-backend:local
   - tiketi-frontend:local
   - tiketi-auth-service:local
   - tiketi-ticket-service:local
   - tiketi-payment-service:local
   - tiketi-stats-service:local

5. ✅ **Kind 클러스터에 이미지 로드**
   - 모든 이미지를 클러스터 내부로 로드

6. ✅ **인프라 서비스 배포**
   - Dragonfly (Redis)
   - Loki (로그 집계)
   - Promtail (로그 수집)
   - Grafana (대시보드)

7. ✅ **애플리케이션 서비스 배포**
   - Backend + Frontend
   - 4개 마이크로서비스

8. ✅ **Pod 준비 상태 확인**
   - 모든 Pod가 Running 상태가 될 때까지 대기

### 배포 확인

```bash
# Pod 상태 확인
kubectl get pods -n tiketi

# 예상 출력:
# NAME                               READY   STATUS    RESTARTS   AGE
# auth-service-xxxxx                 1/1     Running   0          2m
# backend-xxxxx                      1/1     Running   0          2m
# dragonfly-xxxxx                    1/1     Running   0          3m
# frontend-xxxxx                     1/1     Running   0          2m
# grafana-xxxxx                      1/1     Running   0          3m
# loki-xxxxx                         1/1     Running   0          3m
# payment-service-xxxxx              1/1     Running   0          2m
# postgres-0                         1/1     Running   0          5m
# promtail-xxxxx (x2)                1/1     Running   0          3m
# stats-service-xxxxx                1/1     Running   0          2m
# ticket-service-xxxxx               1/1     Running   0          2m

# 서비스 확인
kubectl get svc -n tiketi

# Health Check
curl http://localhost:3001/health  # Backend
curl http://localhost:3005/health  # Auth
curl http://localhost:3002/health  # Ticket
curl http://localhost:3003/health  # Payment
curl http://localhost:3004/health  # Stats
```

---

## 🔧 개발 가이드

### 로컬 개발 환경

**서비스 재빌드**
```bash
# 특정 서비스만 재빌드
docker build -t tiketi-ticket-service:local -f services/ticket-service/Dockerfile .
kind load docker-image tiketi-ticket-service:local --name tiketi-local
kubectl rollout restart deployment/ticket-service -n tiketi

# 모든 서비스 재빌드
./scripts/build-all-images.sh
```

**로그 확인**
```bash
# 특정 Pod 로그
kubectl logs -f deployment/ticket-service -n tiketi

# 모든 서비스 로그 (tail)
kubectl logs -f -l app=backend -n tiketi
kubectl logs -f -l app=ticket-service -n tiketi

# Loki 통합 로그 (Grafana)
http://localhost:30002 → Explore → Loki
```

**데이터베이스 접속**
```bash
# PostgreSQL CLI
kubectl exec -it postgres-0 -n tiketi -- psql -U tiketi_user -d tiketi

# 스키마 확인
\dn

# 테이블 확인
\dt auth_schema.*
\dt ticket_schema.*

# 쿼리 실행
SELECT * FROM ticket_schema.events LIMIT 5;
```

**Redis 접속**
```bash
# Dragonfly CLI
kubectl exec -it deployment/dragonfly -n tiketi -- redis-cli

# 대기열 확인
ZRANGE queue:event-id 0 -1 WITHSCORES

# 활성 사용자 확인
SMEMBERS active:event-id
```

### 환경 변수 설정

**ConfigMap 수정**
```bash
kubectl edit configmap tiketi-config -n tiketi
# 수정 후 Pod 재시작
kubectl rollout restart deployment/<service-name> -n tiketi
```

**Secret 수정**
```bash
kubectl edit secret tiketi-secret -n tiketi
# Base64 인코딩 필요
echo -n "new-secret-value" | base64
```

---

## 📦 배포

### 로컬 환경 (Kind)

상세 가이드: [QUICK_START.md](QUICK_START.md)

### 정리 (Cleanup)

```bash
# Windows
.\cleanup.ps1

# Linux/WSL/macOS
./scripts/cleanup.sh
```

---

## 📊 모니터링 & 운영

### Prometheus 메트릭

**수집 메트릭**:
- HTTP 요청 지연시간 (p50, p95, p99)
- 요청 처리량 (RPS)
- 에러율 (4xx, 5xx)
- 데이터베이스 쿼리 시간
- WebSocket 연결 수
- Redis 명령어 실행 시간

**접속**: Grafana → http://localhost:30002

### Grafana 대시보드

**제공 대시보드**:
1. **System Overview** - 전체 시스템 상태
2. **Service Health** - 서비스별 Health Check
3. **API Performance** - API 지연시간/처리량
4. **Database Metrics** - DB 커넥션/쿼리 시간
5. **Redis Metrics** - Redis 메모리/커맨드
6. **Application Logs** - Loki 통합 로그

---

## 🎯 핵심 워크플로우

### 티켓 예매 플로우

```
1. 사용자: 이벤트 선택
   ↓
2. 시스템: 대기열 체크
   ├─ 활성 사용자 < 1000 → 즉시 입장
   └─ 활성 사용자 ≥ 1000 → 대기열 진입
   ↓
3. 사용자: 좌석 선택 (WebSocket 실시간 업데이트)
   - 좌석 클릭 → 5분간 Lock
   - 다른 사용자에게 실시간 반영
   ↓
4. 사용자: 결제 정보 입력
   - Toss Payments 위젯 호출
   ↓
5. 결제 처리
   - Frontend: Toss SDK로 결제
   - Backend: Toss API 검증
   - DB: 트랜잭션으로 예약 확정 + 좌석 예약됨 처리
   ↓
6. 완료: 예매 확정 + QR 코드 + 영수증
```

### 대기열 시스템 작동 방식

```
[이벤트 페이지 접속]
         ↓
   활성 사용자 수 체크
         ↓
    ┌─────┴─────┐
    │           │
   < 1000     ≥ 1000
    │           │
    ↓           ↓
즉시 입장    대기열 등록
            (Redis Sorted Set)
                │
                ↓
        Queue Processor (10초마다)
                │
                ↓
        사용 가능 슬롯 계산
                │
                ↓
        선착순 사용자에게 WebSocket 알림
                │
                ↓
        사용자: 좌석 선택 화면 진입
```

### 실시간 좌석 업데이트 플로우

```
User A: 좌석 선택
    ↓
Ticket Service: DB 업데이트 (status = locked)
    ↓
Redis Pub/Sub: 모든 Pod에 이벤트 브로드캐스트
    ↓
Socket.IO: event:${eventId} Room에 emit
    ↓
All Connected Clients: 좌석 상태 업데이트
    ↓
User B: 화면에서 좌석이 회색으로 변경 (선택 불가)
```

---

## 🔐 보안

### 인증 & 권한

**JWT 토큰**:
- Algorithm: HS256
- Expiry: 7일
- Storage: localStorage (클라이언트)
- Transmission: Authorization 헤더 (`Bearer <token>`)

**비밀번호 보안**:
- bcrypt 해싱 (10 salt rounds)
- 평문 저장 절대 금지
- OAuth 사용자: 더미 해시 저장

**RBAC (Role-Based Access Control)**:
- Roles: `user`, `admin`
- Admin-only routes: 토큰에서 role 검증

### 결제 보안

- ✅ 서버 사이드 금액 검증 (클라이언트 금액 무시)
- ✅ Payment Key 검증 (Toss API)
- ✅ 멱등성 보장 (중복 결제 방지)
- ✅ 카드 정보 미저장 (PCI DSS 준수)
- ✅ 전체 결제 흐름 감사 로그

---

## 📖 문서

| 문서 | 설명 |
|------|------|
| [QUICK_START.md](QUICK_START.md) | Windows 빠른 시작 가이드 |
| [QUICK_START_MAC.md](QUICK_START_MAC.md) | macOS 빠른 시작 가이드 |
| [KIND_DEPLOYMENT_GUIDE.md](KIND_DEPLOYMENT_GUIDE.md) | Kind 배포 상세 가이드 |
| [claudedocs/TROUBLESHOOTING_SUMMARY.md](claudedocs/TROUBLESHOOTING_SUMMARY.md) | 트러블슈팅 가이드 |
| [claudedocs/MSA_GATEWAY_FIXES.md](claudedocs/MSA_GATEWAY_FIXES.md) | MSA Gateway 프록시 설명 |
| [CHANGELOG.md](CHANGELOG.md) | 버전 히스토리 |
| [API Documentation](http://localhost:3001/api-docs) | Swagger API 문서 (실행 중일 때) |

---

## 🗂️ 프로젝트 구조

```
project-ticketing/
├── backend/                      # Legacy 모놀리스 (MSA 전환 중)
│   ├── src/
│   │   ├── config/              # DB, Redis, Socket.IO 설정
│   │   ├── routes/              # API 라우트 (4,190+ LOC)
│   │   ├── services/            # 백그라운드 서비스
│   │   ├── middleware/          # 인증, 로깅, 에러 핸들링
│   │   └── server.js            # 메인 진입점
│   └── Dockerfile
│
├── frontend/                     # React SPA
│   ├── src/
│   │   ├── components/          # 재사용 가능 컴포넌트
│   │   ├── pages/               # 페이지 컴포넌트
│   │   ├── hooks/               # 커스텀 훅
│   │   ├── services/            # API 클라이언트
│   │   └── App.js
│   └── Dockerfile (multi-stage)
│
├── services/                     # Microservices
│   ├── auth-service/            # 인증 서비스
│   ├── ticket-service/          # 티켓/이벤트/대기열 서비스
│   ├── payment-service/         # 결제 서비스
│   └── stats-service/           # 통계 서비스
│
├── packages/                     # 공유 라이브러리
│   ├── common/                  # 공통 유틸리티
│   ├── database/                # DB 연결 풀
│   └── metrics/                 # Prometheus 메트릭
│
├── database/                     # 데이터베이스
│   └── migrations/              # SQL 마이그레이션 파일
│
├── k8s/                         # Kubernetes 매니페스트 (21개)
│
├── scripts/                     # 자동화 스크립트
│   ├── setup-tiketi.sh          # 전체 설치 스크립트
│   ├── port-forward-all.sh      # 포트포워딩
│   ├── cleanup.sh               # 정리
│   └── verify-services.sh       # 검증
│
├── monitoring/                  # 모니터링 설정
│
├── docs/                        # 추가 문서
├── claudedocs/                  # 분석 문서
└── README.md
```

---

## 🤝 기여하기

프로젝트에 기여를 환영합니다!

### 브랜치 전략

- `main` - 프로덕션 준비 코드
- `mono-kind2` - 개발 브랜치 (현재)
- `feature/*` - 기능 개발 브랜치

### 커밋 메시지 규칙

```
type: description

Types:
- feat: 새로운 기능
- fix: 버그 수정
- docs: 문서 변경
- refactor: 리팩토링
- test: 테스트 추가/수정
- chore: 빌드 설정 등
```

---

## 🛣️ 로드맵

### ✅ Phase 1: MSA 기반 구축 (완료)
- [x] Auth Service 분리
- [x] Ticket Service 분리
- [x] Payment Service 분리
- [x] Stats Service 분리
- [x] Kubernetes 배포 자동화

### 🚧 Phase 2: 프로덕션 준비 (진행 중)
- [ ] AWS EKS 배포
- [ ] RDS PostgreSQL 마이그레이션
- [ ] ElastiCache Redis 전환
- [ ] ALB + HTTPS 설정
- [ ] CI/CD 파이프라인 (GitHub Actions)

### 🔮 Phase 3: 기능 확장 (계획 중)
- [ ] 이메일 알림 (AWS SES)
- [ ] SMS 알림 (AWS SNS)
- [ ] 모바일 앱 (React Native)
- [ ] 추천 시스템
- [ ] 다국어 지원
- [ ] 소셜 미디어 공유

---

## 📄 라이선스

이 프로젝트는 [MIT License](LICENSE) 하에 배포됩니다.

---

## 🙏 감사의 말

이 프로젝트는 다음 오픈소스 프로젝트들을 사용합니다:

- [Node.js](https://nodejs.org/)
- [React](https://reactjs.org/)
- [Express](https://expressjs.com/)
- [Socket.IO](https://socket.io/)
- [PostgreSQL](https://www.postgresql.org/)
- [Kubernetes](https://kubernetes.io/)
- [Prometheus](https://prometheus.io/)
- [Grafana](https://grafana.com/)

---

<div align="center">

**Made with ❤️ by TIKETI Team**

⭐ Star us on GitHub — it motivates us a lot!

</div>
