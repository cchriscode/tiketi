# Tiketi - 이벤트 티켓팅 시스템
## 프로젝트 발표 자료 (완전 명세서)

**작성일:** 2026-01-05
**버전:** 1.0.0
**작성자:** Claude Code

---

## 📋 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [마이크로서비스 아키텍처](#3-마이크로서비스-아키텍처)
4. [서비스별 상세 명세](#4-서비스별-상세-명세)
5. [데이터베이스 설계](#5-데이터베이스-설계)
6. [API 명세](#6-api-명세)
7. [인증 및 보안](#7-인증-및-보안)
8. [실시간 통신](#8-실시간-통신)
9. [Kubernetes 인프라](#9-kubernetes-인프라)
10. [GitOps 파이프라인](#10-gitops-파이프라인)
11. [모니터링 및 로깅](#11-모니터링-및-로깅)
12. [배포 전략](#12-배포-전략)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 소개

**Tiketi**는 **마이크로서비스 아키텍처(MSA)** 기반의 **이벤트 티켓팅 시스템**입니다.

**핵심 기능:**
- 🎫 이벤트 검색 및 조회
- 💺 실시간 좌석 선택 및 예약
- ⏱️ 대기열 관리 (트래픽 제어)
- 💳 TossPayments 결제 연동
- 📊 관리자 대시보드 및 통계
- 📱 실시간 알림 (WebSocket)

**비즈니스 목표:**
- 대규모 트래픽 처리 (티켓 오픈 시)
- 고가용성 및 확장성
- 마이크로서비스 독립 배포
- DevOps/GitOps 자동화

---

### 1.2 프로젝트 구조

```
project-ticketing/
│
├── backend/                    # API Gateway (포트 3001)
├── frontend/                   # React SPA (포트 3000)
│
├── services/                   # 마이크로서비스
│   ├── auth-service/          # 인증 서비스 (3005)
│   ├── ticket-service/        # 티켓/예매 (3002)
│   ├── payment-service/       # 결제 (3003)
│   └── stats-service/         # 통계 (3004)
│
├── packages/                   # 공유 라이브러리
│   ├── common/                # @tiketi/common
│   ├── database/              # @tiketi/database
│   └── metrics/               # @tiketi/metrics
│
├── database/                   # DB 초기화 스크립트
├── k8s/                       # Kubernetes 매니페스트
│   ├── base/                  # 공통 리소스
│   └── overlays/              # 환경별 설정
│       ├── dev/               # 로컬 Kind
│       ├── staging/           # EKS Staging
│       └── prod/              # EKS Production
│
├── .github/workflows/         # GitHub Actions CI/CD
├── argocd/                    # ArgoCD GitOps
└── claudedocs/                # 프로젝트 문서
```

**핵심 설계 원칙:**
- ✅ **단일 책임 원칙** - 각 서비스는 하나의 비즈니스 도메인 담당
- ✅ **느슨한 결합** - HTTP/REST + WebSocket으로 통신
- ✅ **독립 배포** - 각 서비스 독립적으로 빌드/배포
- ✅ **데이터베이스 분리** - PostgreSQL 스키마 분리로 격리
- ✅ **GitOps** - Git을 Single Source of Truth로 사용

---

## 2. 기술 스택

### 2.1 Backend

| 영역 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **Runtime** | Node.js | 18.x | JavaScript 런타임 |
| **Framework** | Express.js | 4.18 | REST API 프레임워크 |
| **Language** | JavaScript | ES6+ | 개발 언어 |
| **Database** | PostgreSQL | 15.x | 관계형 데이터베이스 |
| **Cache** | Redis / DragonflyDB | 7.x | 캐싱, 세션, 대기열 |
| **ORM** | pg (node-postgres) | 8.11 | PostgreSQL 클라이언트 |
| **Authentication** | jsonwebtoken | 9.x | JWT 토큰 |
| **WebSocket** | Socket.IO | 4.7 | 실시간 양방향 통신 |
| **HTTP Client** | Axios | 1.6 | 서비스 간 통신 |
| **Validation** | express-validator | 7.x | 입력 검증 |
| **Logging** | Winston | 3.x | 구조화된 로깅 |
| **Monitoring** | prom-client | 15.x | Prometheus 메트릭 |
| **Payment** | TossPayments API | v1 | 결제 처리 |

### 2.2 Frontend

| 영역 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **Framework** | React | 18.2 | UI 라이브러리 |
| **Router** | React Router | 6.x | 클라이언트 라우팅 |
| **State** | React Hooks | - | 상태 관리 |
| **HTTP** | Axios | 1.6 | API 클라이언트 |
| **WebSocket** | Socket.IO Client | 4.7 | 실시간 통신 |
| **UI** | Custom CSS | - | 스타일링 |
| **OAuth** | Google OAuth2 | - | 소셜 로그인 |

### 2.3 DevOps & Infrastructure

| 영역 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **Container** | Docker | 24.x | 컨테이너화 |
| **Orchestration** | Kubernetes | 1.28 | 컨테이너 오케스트레이션 |
| **Local K8s** | Kind | 0.20 | 로컬 개발 클러스터 |
| **Cloud K8s** | AWS EKS | 1.28 | 프로덕션 클러스터 |
| **Config Mgmt** | Kustomize | 5.x | K8s 설정 관리 |
| **GitOps** | ArgoCD | 2.9 | 지속적 배포 |
| **CI/CD** | GitHub Actions | - | 빌드/배포 자동화 |
| **Registry** | AWS ECR | - | 컨테이너 이미지 저장소 |
| **Secrets** | Sealed Secrets | 0.24 | 암호화된 시크릿 관리 |
| **Monitoring** | Prometheus + Grafana | - | 메트릭 수집/시각화 |
| **Logging** | Loki + Promtail | - | 로그 수집/조회 |
| **Load Balancer** | AWS ALB | - | L7 로드 밸런싱 |
| **WAF** | AWS WAF | - | 웹 방화벽 (Prod) |

### 2.4 데이터베이스

| 유형 | 기술 | 용도 |
|------|------|------|
| **Primary DB** | PostgreSQL 15 | 메인 데이터 저장 |
| **Cache** | Redis 7 / DragonflyDB | 캐싱, 세션, 대기열 |
| **Managed DB (Staging/Prod)** | AWS RDS PostgreSQL | 관리형 데이터베이스 |
| **Managed Cache (Staging/Prod)** | AWS ElastiCache Redis | 관리형 캐시 |

---

## 3. 마이크로서비스 아키텍처

### 3.1 시스템 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client Browser                            │
│                     (React SPA - Port 3000)                         │
└────────────────────┬────────────────────────────────────────────────┘
                     │ HTTP/HTTPS + WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API Gateway (Backend)                            │
│                         Port 3001                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  - JWT 인증 검증                                              │  │
│  │  - 요청 라우팅 (프록시)                                       │  │
│  │  - WebSocket 관리 (Socket.IO)                                │  │
│  │  - 관리자 기능 (로컬)                                         │  │
│  │  - Prometheus 메트릭 집계                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────┬──────────┬──────────┬──────────┬────────────────────┬──────┘
         │          │          │          │                    │
         ▼          ▼          ▼          ▼                    ▼
    ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        ┌──────────┐
    │  Auth  │ │ Ticket │ │Payment │ │ Stats  │        │ PostgreSQL│
    │Service │ │Service │ │Service │ │Service │        │   (RDS)   │
    │  3005  │ │  3002  │ │  3003  │ │  3004  │        │           │
    └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘        └─────┬─────┘
        │          │          │          │                    │
        └──────────┴──────────┴──────────┴────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Redis / Dragonfly│
                    │  (ElastiCache)   │
                    └──────────────────┘
```

### 3.2 서비스 간 통신

#### 동기 통신 (HTTP/REST)
```
Client → Backend (API Gateway) → Microservices

예시:
1. GET /api/events
   Client → Backend:3001 → Ticket Service:3002

2. POST /api/auth/login
   Client → Backend:3001 → Auth Service:3005

3. POST /api/payments/confirm
   Client → Backend:3001 → Payment Service:3003 → Ticket Service:3002
```

#### 비동기 통신 (WebSocket)
```
Client ←WebSocket→ Backend ←WebSocket→ Ticket Service
                            (Socket.IO + Redis Adapter)

이벤트:
- seat-reserved: 좌석 예약됨
- seat-released: 좌석 해제됨
- reservation-expired: 예약 만료
- queue-updated: 대기열 위치 변경
- event-status-changed: 이벤트 상태 변경
```

### 3.3 서비스 포트 맵

| 서비스 | 포트 | 프로토콜 | 용도 |
|--------|------|----------|------|
| Frontend | 3000 | HTTP | React 개발 서버 |
| Backend (Gateway) | 3001 | HTTP + WS | API 게이트웨이 |
| Ticket Service | 3002 | HTTP + WS | 티켓/예매 |
| Payment Service | 3003 | HTTP | 결제 |
| Stats Service | 3004 | HTTP | 통계 |
| Auth Service | 3005 | HTTP | 인증 |
| PostgreSQL | 5432 | PostgreSQL | 데이터베이스 |
| Redis/Dragonfly | 6379 | Redis | 캐시/대기열 |
| Loki | 3100 | HTTP | 로그 수집 |
| Grafana | 3030 | HTTP | 대시보드 |

---

## 4. 서비스별 상세 명세

### 4.1 Backend (API Gateway)

**위치:** `C:\Users\USER\project-ticketing\backend\`
**포트:** 3001
**언어:** Node.js + Express

#### 책임 (Responsibilities)

1. **API 게이트웨이**
   - 모든 클라이언트 요청의 단일 진입점
   - 마이크로서비스로 요청 라우팅 (프록시)
   - JWT 인증 검증
   - CORS 설정

2. **WebSocket 관리**
   - Socket.IO 서버
   - 실시간 이벤트 브로드캐스팅
   - Redis Adapter로 다중 포드 지원

3. **관리자 기능 (로컬)**
   - 이벤트 생성/수정/삭제
   - 예약 관리
   - 사용자 관리

4. **뉴스 관리 (로컬)**
   - 공지사항 CRUD
   - 핀 기능

5. **이미지 업로드 (로컬)**
   - S3 업로드
   - 이미지 URL 반환

6. **모니터링**
   - Prometheus 메트릭 집계
   - 헬스체크 종합

#### 디렉토리 구조

```
backend/
├── src/
│   ├── server.js                # Express 앱 초기화
│   ├── config/
│   │   ├── database.js         # PostgreSQL 풀
│   │   ├── redis.js            # Redis 클라이언트
│   │   ├── socket.js           # Socket.IO 설정
│   │   ├── swagger.js          # API 문서
│   │   ├── init-admin.js       # 관리자 초기화
│   │   └── init-seats.js       # 좌석 초기화
│   ├── middleware/
│   │   ├── auth.js             # JWT 검증
│   │   ├── error-handler.js    # 에러 처리
│   │   └── request-logger.js   # 요청 로깅
│   ├── routes/
│   │   ├── auth-proxy.js       # → Auth Service:3005
│   │   ├── ticket-proxy.js     # → Ticket Service:3002
│   │   ├── payment-proxy.js    # → Payment Service:3003
│   │   ├── stats-proxy.js      # → Stats Service:3004
│   │   ├── admin.js            # 관리자 엔드포인트
│   │   ├── news.js             # 뉴스 관리
│   │   ├── image.js            # 이미지 업로드
│   │   └── health.js           # 헬스체크
│   ├── metrics/
│   │   ├── middleware.js       # 메트릭 수집
│   │   ├── aggregator.js       # 메트릭 집계
│   │   └── db.js               # DB 메트릭
│   └── utils/
│       └── logger.js           # Winston 로거
└── Dockerfile
```

#### 주요 API 엔드포인트

**프록시 엔드포인트:**
```
POST   /api/auth/register          → auth-service:3005
POST   /api/auth/login             → auth-service:3005
GET    /api/events                 → ticket-service:3002
POST   /api/reservations           → ticket-service:3002
POST   /api/payments/prepare       → payment-service:3003
GET    /api/stats                  → stats-service:3004
```

**로컬 엔드포인트:**
```
GET    /api/admin/events           # 이벤트 관리
POST   /api/admin/events
PUT    /api/admin/events/:id
DELETE /api/admin/events/:id

GET    /api/news                   # 뉴스
POST   /api/news
PUT    /api/news/:id
DELETE /api/news/:id

POST   /api/image/upload           # 이미지 업로드 (S3)

GET    /health                     # 헬스체크
GET    /health/db                  # DB 연결 확인
GET    /health/redis               # Redis 확인
GET    /health/all                 # 전체 시스템 상태
GET    /metrics                    # Prometheus 메트릭
```

#### 환경변수

```bash
NODE_ENV=production
PORT=3001

# Database
DB_HOST=postgres-service
DB_PORT=5432
DB_NAME=tiketi
DB_USER=tiketi_user
DB_PASSWORD=${DB_PASSWORD}

# Redis
REDIS_URL=redis://dragonfly-service:6379

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# 마이크로서비스 URL (K8s 내부)
AUTH_SERVICE_URL=http://auth-service:3005
TICKET_SERVICE_URL=http://ticket-service:3002
PAYMENT_SERVICE_URL=http://payment-service:3003
STATS_SERVICE_URL=http://stats-service:3004

# AWS S3
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=tiketi-assets

# Google OAuth
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}

# Socket.IO
SOCKET_IO_CORS_ORIGIN=http://localhost:3000
```

---

### 4.2 Auth Service

**위치:** `C:\Users\USER\project-ticketing\services\auth-service\`
**포트:** 3005
**언어:** Node.js + Express

#### 책임

1. **사용자 인증**
   - 회원가입 (이메일 + 비밀번호)
   - 로그인 (JWT 발급)
   - Google OAuth2 인증
   - 토큰 갱신

2. **사용자 관리**
   - 사용자 정보 조회/수정
   - 역할 관리 (user/admin)

3. **보안**
   - 비밀번호 해싱 (bcrypt)
   - JWT 검증

#### API 엔드포인트

```
POST   /api/auth/register          # 회원가입
POST   /api/auth/login             # 로그인
POST   /api/auth/google            # Google OAuth
POST   /api/auth/refresh           # 토큰 갱신
GET    /api/auth/me                # 내 정보
PUT    /api/auth/profile           # 프로필 수정
GET    /health                     # 헬스체크
GET    /metrics                    # Prometheus 메트릭
```

#### 데이터베이스 스키마

**auth_schema.users**
```sql
CREATE TABLE auth_schema.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 인증 흐름

```
1. 회원가입:
   Client → POST /api/auth/register
   {email, password, name, phone}
   → bcrypt.hash(password)
   → INSERT INTO auth_schema.users
   → JWT 토큰 발급
   → 토큰 반환

2. 로그인:
   Client → POST /api/auth/login
   {email, password}
   → SELECT FROM auth_schema.users WHERE email = ?
   → bcrypt.compare(password, password_hash)
   → JWT 토큰 발급
   → 토큰 반환

3. Google OAuth:
   Client → POST /api/auth/google
   {credential (Google ID Token)}
   → OAuth2Client.verifyIdToken()
   → 이메일로 사용자 조회
   → 없으면 자동 회원가입
   → JWT 토큰 발급
   → 토큰 반환
```

---

### 4.3 Ticket Service

**위치:** `C:\Users\USER\project-ticketing\services\ticket-service\`
**포트:** 3002
**언어:** Node.js + Express + Socket.IO

#### 책임

1. **이벤트 관리**
   - 이벤트 조회 (검색, 필터링, 페이지네이션)
   - 이벤트 상세 정보
   - 티켓 타입 조회
   - Redis 캐싱

2. **좌석 관리**
   - 좌석 목록 조회
   - 좌석 예약/해제
   - 실시간 좌석 상태 동기화 (WebSocket)

3. **예약 관리**
   - 예약 생성
   - 예약 조회 (내 예약)
   - 예약 만료 처리 (15분)
   - 예약 취소

4. **대기열 관리**
   - 대기열 추가
   - 대기열 위치 조회
   - 대기열 처리 (배경 작업)

5. **배경 작업**
   - Queue Processor: 대기열 처리
   - Reservation Cleaner: 예약 만료 정리
   - Event Status Updater: 이벤트 상태 자동 업데이트

6. **WebSocket 이벤트**
   - `seat-reserved`: 좌석 예약됨
   - `seat-released`: 좌석 해제됨
   - `reservation-expired`: 예약 만료
   - `queue-updated`: 대기열 위치 변경
   - `event-status-changed`: 이벤트 상태 변경

#### 디렉토리 구조

```
ticket-service/
├── src/
│   ├── server.js               # Express + Socket.IO 서버
│   ├── config/
│   │   ├── database.js        # PostgreSQL
│   │   └── redis.js           # Redis 클라이언트
│   ├── middleware/
│   │   └── auth.js            # JWT 검증
│   ├── routes/
│   │   ├── events.js          # 이벤트 조회
│   │   ├── tickets.js         # 티켓 조회
│   │   ├── seats.js           # 좌석 관리
│   │   ├── reservations.js    # 예약 관리
│   │   ├── queue.js           # 대기열 관리
│   │   └── internal.js        # 내부 서비스 통신
│   └── services/
│       ├── queue-processor.js         # 대기열 처리
│       ├── reservation-cleaner.js     # 예약 만료 정리
│       └── event-status-updater.js    # 이벤트 상태 업데이트
└── Dockerfile
```

#### API 엔드포인트

**이벤트:**
```
GET    /api/events                # 이벤트 목록
GET    /api/events/:id            # 이벤트 상세
GET    /api/tickets/event/:id     # 이벤트별 티켓 타입
```

**좌석:**
```
GET    /api/seats/:eventId        # 좌석 목록
POST   /api/seats/reserve         # 좌석 예약 (임시 잠금)
POST   /api/seats/release         # 좌석 해제
```

**예약:**
```
POST   /api/reservations          # 예약 생성
GET    /api/reservations/my       # 내 예약 목록
GET    /api/reservations/:id      # 예약 상세
PUT    /api/reservations/:id/cancel  # 예약 취소
```

**대기열:**
```
POST   /api/queue                 # 대기열 추가
GET    /api/queue/position/:id    # 대기열 위치
```

**내부 (서비스 간 통신):**
```
POST   /internal/reservations/:id/confirm   # 결제 완료 시 예약 확정
GET    /internal/reservations/:id           # 예약 조회 (Payment Service용)
```

#### 데이터베이스 스키마

**ticket_schema.events**
```sql
CREATE TABLE ticket_schema.events (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    venue VARCHAR(255),
    address TEXT,
    event_date TIMESTAMP NOT NULL,
    sale_start_date TIMESTAMP NOT NULL,
    sale_end_date TIMESTAMP NOT NULL,
    poster_image_url TEXT,
    status VARCHAR(50) DEFAULT 'upcoming',
    seat_layout_id UUID,
    artist_name VARCHAR(255),
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**ticket_schema.seats**
```sql
CREATE TABLE ticket_schema.seats (
    id UUID PRIMARY KEY,
    event_id UUID REFERENCES ticket_schema.events(id),
    section VARCHAR(50),
    row_number VARCHAR(10),
    seat_number VARCHAR(10),
    seat_label VARCHAR(50),
    price DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'available',
    reserved_by UUID,
    reserved_at TIMESTAMP,
    UNIQUE(event_id, section, row_number, seat_number)
);
```

**ticket_schema.reservations**
```sql
CREATE TABLE ticket_schema.reservations (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    event_id UUID REFERENCES ticket_schema.events(id),
    reservation_number VARCHAR(50) UNIQUE,
    total_amount DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'pending',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 배경 작업 상세

**1. Queue Processor (`queue-processor.js`)**
```javascript
// 30초마다 실행
setInterval(async () => {
  // 대기열에서 사용자 꺼내기
  const users = await redis.zrange(`queue:${eventId}`, 0, BATCH_SIZE);

  for (const user of users) {
    // WebSocket으로 "입장 허용" 알림
    io.to(user.socketId).emit('queue-admitted');

    // 대기열에서 제거
    await redis.zrem(`queue:${eventId}`, user.id);
  }
}, 30000);
```

**2. Reservation Cleaner (`reservation-cleaner.js`)**
```javascript
// 1분마다 실행
setInterval(async () => {
  // 만료된 예약 조회
  const expiredReservations = await pool.query(`
    SELECT * FROM ticket_schema.reservations
    WHERE status = 'pending' AND expires_at < NOW()
  `);

  for (const reservation of expiredReservations.rows) {
    // 예약 취소
    await cancelReservation(reservation.id);

    // WebSocket으로 알림
    io.to(reservation.user_id).emit('reservation-expired', {
      reservationId: reservation.id
    });
  }
}, 60000);
```

**3. Event Status Updater (`event-status-updater.js`)**
```javascript
// 5분마다 실행
setInterval(async () => {
  const now = new Date();

  // upcoming → on_sale
  await pool.query(`
    UPDATE ticket_schema.events
    SET status = 'on_sale'
    WHERE status = 'upcoming' AND sale_start_date <= $1
  `, [now]);

  // on_sale → ended
  await pool.query(`
    UPDATE ticket_schema.events
    SET status = 'ended'
    WHERE status = 'on_sale' AND event_date < $1
  `, [now]);
}, 300000);
```

---

### 4.4 Payment Service

**위치:** `C:\Users\USER\project-ticketing\services\payment-service\`
**포트:** 3003
**언어:** Node.js + Express

#### 책임

1. **결제 처리**
   - TossPayments 결제 주문 생성
   - 결제 확인 및 검증
   - 결제 상태 관리

2. **예약 연동**
   - 결제 완료 시 Ticket Service에 예약 확정 요청
   - 결제 실패 시 예약 취소

#### API 엔드포인트

```
POST   /api/payments/prepare       # 결제 준비 (orderId 생성)
POST   /api/payments/confirm       # 결제 확인
GET    /api/payments/:id           # 결제 상태 조회
GET    /health                     # 헬스체크
GET    /metrics                    # Prometheus 메트릭
```

#### 결제 흐름

```
1. 결제 준비:
   Client → POST /api/payments/prepare
   {reservationId, amount}
   → orderId 생성 (UUID)
   → INSERT INTO payment_schema.payments (status: pending)
   → 반환 {orderId, amount}

2. TossPayments 위젯:
   Client → TossPayments 위젯 표시
   → 사용자 결제 진행
   → paymentKey, orderId, amount 획득

3. 결제 확인:
   Client → POST /api/payments/confirm
   {paymentKey, orderId, amount}

   → TossPayments API 호출 (확인)
   POST https://api.tosspayments.com/v1/payments/confirm
   {paymentKey, orderId, amount}

   → 성공 시:
     - UPDATE payments SET status = 'confirmed'
     - Ticket Service에 예약 확정 요청
       POST http://ticket-service:3002/internal/reservations/:id/confirm
     - 반환 {success: true}

   → 실패 시:
     - UPDATE payments SET status = 'failed'
     - 예약 취소 (Ticket Service)
     - 반환 {error}
```

#### 데이터베이스 스키마

**payment_schema.payments**
```sql
CREATE TABLE payment_schema.payments (
    id UUID PRIMARY KEY,
    reservation_id UUID NOT NULL,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    payment_key VARCHAR(200),
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 4.5 Stats Service

**위치:** `C:\Users\USER\project-ticketing\services\stats-service\`
**포트:** 3004
**언어:** Node.js + Express

#### 책임

1. **통계 데이터 제공**
   - 전체 통계 (이벤트 수, 예약 수, 매출)
   - 이벤트별 통계
   - 매출 통계 (일별, 월별)

2. **대시보드 데이터**
   - 관리자 대시보드용 집계 데이터

#### API 엔드포인트

```
GET    /api/stats                  # 전체 통계
GET    /api/stats/events           # 이벤트별 통계
GET    /api/stats/revenue          # 매출 통계
GET    /api/stats/dashboard        # 대시보드 데이터
GET    /health                     # 헬스체크
GET    /metrics                    # Prometheus 메트릭
```

#### 통계 데이터 예시

```json
{
  "totalEvents": 50,
  "totalReservations": 1200,
  "totalRevenue": 45000000,
  "todayReservations": 35,
  "todayRevenue": 1250000,
  "eventStats": [
    {
      "eventId": "uuid-1",
      "eventTitle": "콘서트 A",
      "totalReservations": 250,
      "totalRevenue": 8750000,
      "availableSeats": 50
    }
  ],
  "revenueByDate": [
    {"date": "2026-01-01", "revenue": 2500000},
    {"date": "2026-01-02", "revenue": 3200000}
  ]
}
```

---

### 4.6 Frontend (React SPA)

**위치:** `C:\Users\USER\project-ticketing\frontend\`
**포트:** 3000 (개발), S3+CloudFront (프로덕션)

#### 주요 페이지

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | Home.js | 홈 페이지 (이벤트 목록) |
| `/login` | Login.js | 로그인 |
| `/register` | Register.js | 회원가입 |
| `/events/:id` | EventDetail.js | 이벤트 상세 |
| `/events/:id/seats` | SeatSelection.js | 좌석 선택 |
| `/payment` | Payment.js | 결제 |
| `/my-reservations` | MyReservations.js | 내 예약 |
| `/news` | News.js | 뉴스 |
| `/admin` | Dashboard.js | 관리자 대시보드 |
| `/admin/events` | Events.js | 이벤트 관리 |
| `/admin/reservations` | Reservations.js | 예약 관리 |
| `/admin/statistics` | Statistics.js | 통계 |

#### API 클라이언트 (api.js)

```javascript
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor (JWT 토큰 자동 추가)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor (에러 처리)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  googleLogin: (credential) => api.post('/auth/google', {credential})
};

export const eventsAPI = {
  getAll: (params) => api.get('/events', {params}),
  getById: (id) => api.get(`/events/${id}`)
};

export const seatsAPI = {
  getByEvent: (eventId) => api.get(`/seats/${eventId}`),
  reserve: (data) => api.post('/seats/reserve', data),
  release: (data) => api.post('/seats/release', data)
};

export const reservationsAPI = {
  create: (data) => api.post('/reservations', data),
  getMy: () => api.get('/reservations/my'),
  cancel: (id) => api.put(`/reservations/${id}/cancel`)
};

export const paymentsAPI = {
  prepare: (data) => api.post('/payments/prepare', data),
  confirm: (data) => api.post('/payments/confirm', data)
};
```

#### WebSocket 사용 (useSocket.js)

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

export const useSocket = (eventId) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    socketInstance.on('connect', () => {
      setConnected(true);
      if (eventId) {
        socketInstance.emit('join-event', eventId);
      }
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => socketInstance.disconnect();
  }, [eventId]);

  return { socket, connected };
};

// 사용 예시:
function SeatSelection({ eventId }) {
  const { socket, connected } = useSocket(eventId);

  useEffect(() => {
    if (!socket) return;

    socket.on('seat-reserved', (data) => {
      // 좌석 상태 업데이트
      updateSeatStatus(data.seatId, 'reserved');
    });

    socket.on('seat-released', (data) => {
      updateSeatStatus(data.seatId, 'available');
    });
  }, [socket]);

  return <div>...</div>;
}
```

---

## 5. 데이터베이스 설계

### 5.1 스키마 분리 전략

PostgreSQL의 **스키마(Schema)** 기능을 활용하여 서비스별 데이터 격리:

```
tiketi (Database)
├── public                  # 공유 테이블
│   ├── users
│   ├── seat_layouts
│   ├── keyword_mappings
│   └── news
│
├── auth_schema            # Auth Service 소유
│   └── users (인증 정보)
│
├── ticket_schema          # Ticket Service 소유
│   ├── events
│   ├── ticket_types
│   ├── seats
│   ├── reservations
│   └── reservation_items
│
├── payment_schema         # Payment Service 소유
│   └── payments
│
└── stats_schema           # Stats Service 소유
    └── (동적 통계 테이블)
```

**장점:**
- ✅ 서비스별 데이터 격리
- ✅ 단일 PostgreSQL 인스턴스 사용 (비용 절감)
- ✅ 조인 가능 (필요시)
- ✅ 백업/복구 단순화

### 5.2 ER 다이어그램

```
┌──────────────┐         ┌──────────────┐
│    users     │         │    events    │
├──────────────┤         ├──────────────┤
│ id (PK)      │         │ id (PK)      │
│ email        │◄────────│ created_by   │
│ password_hash│         │ title        │
│ name         │         │ event_date   │
│ role         │         │ status       │
└──────────────┘         └──────┬───────┘
                                │
                                │ 1:N
                                ▼
                         ┌──────────────┐
                         │    seats     │
                         ├──────────────┤
                         │ id (PK)      │
                         │ event_id (FK)│
                         │ section      │
                         │ price        │
                         │ status       │
                         └──────┬───────┘
                                │
                                │ N:1
                                ▼
┌──────────────┐         ┌──────────────┐
│ reservations │◄────────│ reservation_ │
├──────────────┤         │   items      │
│ id (PK)      │         ├──────────────┤
│ user_id (FK) │◄────┐   │ id (PK)      │
│ event_id (FK)│     │   │ reservation  │
│ total_amount │     │   │   _id (FK)   │
│ status       │     │   │ seat_id (FK) │
└──────┬───────┘     │   │ price        │
       │             │   └──────────────┘
       │ 1:1         │
       ▼             │
┌──────────────┐     │
│   payments   │     │
├──────────────┤     │
│ id (PK)      │     │
│ reservation  │─────┘
│   _id (FK)   │
│ order_id     │
│ payment_key  │
│ amount       │
│ status       │
└──────────────┘
```

### 5.3 주요 테이블 DDL

#### users (공유)

```sql
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
```

#### events (ticket_schema)

```sql
CREATE TABLE ticket_schema.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    venue VARCHAR(255) NOT NULL,
    address TEXT,
    event_date TIMESTAMP NOT NULL,
    sale_start_date TIMESTAMP NOT NULL,
    sale_end_date TIMESTAMP NOT NULL,
    poster_image_url TEXT,
    status VARCHAR(50) DEFAULT 'upcoming'
           CHECK (status IN ('upcoming', 'on_sale', 'sold_out', 'ended', 'cancelled')),
    seat_layout_id UUID,
    artist_name VARCHAR(255),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_status ON ticket_schema.events(status);
CREATE INDEX idx_events_event_date ON ticket_schema.events(event_date);
CREATE INDEX idx_events_sale_dates ON ticket_schema.events(sale_start_date, sale_end_date);
```

#### seats (ticket_schema)

```sql
CREATE TABLE ticket_schema.seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES ticket_schema.events(id) ON DELETE CASCADE,
    section VARCHAR(50) NOT NULL,  -- 'VIP', 'R석', 'S석'
    row_number VARCHAR(10) NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    seat_label VARCHAR(50) NOT NULL,  -- 'VIP-A-1'
    price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'available'
           CHECK (status IN ('available', 'reserved', 'locked')),
    reserved_by UUID,
    reserved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, section, row_number, seat_number)
);

CREATE INDEX idx_seats_event_id ON ticket_schema.seats(event_id);
CREATE INDEX idx_seats_status ON ticket_schema.seats(status);
CREATE INDEX idx_seats_event_status ON ticket_schema.seats(event_id, status);
```

#### reservations (ticket_schema)

```sql
CREATE TABLE ticket_schema.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    event_id UUID NOT NULL REFERENCES ticket_schema.events(id),
    reservation_number VARCHAR(50) UNIQUE NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending'
           CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    payment_status VARCHAR(50) DEFAULT 'pending'
           CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    expires_at TIMESTAMP NOT NULL,  -- 15분 후
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reservations_user_id ON ticket_schema.reservations(user_id);
CREATE INDEX idx_reservations_status ON ticket_schema.reservations(status);
CREATE INDEX idx_reservations_expires_at ON ticket_schema.reservations(expires_at);
```

#### reservation_items (ticket_schema)

```sql
CREATE TABLE ticket_schema.reservation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES ticket_schema.reservations(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES ticket_schema.seats(id),
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(reservation_id, seat_id)
);

CREATE INDEX idx_reservation_items_reservation_id ON ticket_schema.reservation_items(reservation_id);
```

#### payments (payment_schema)

```sql
CREATE TABLE payment_schema.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL,  -- ticket_schema.reservations.id
    order_id VARCHAR(100) UNIQUE NOT NULL,
    payment_key VARCHAR(200),  -- TossPayments paymentKey
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending'
           CHECK (status IN ('pending', 'confirmed', 'cancelled', 'failed')),
    payment_method VARCHAR(50),  -- 'card', 'bank_transfer', etc.
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_reservation_id ON payment_schema.payments(reservation_id);
CREATE INDEX idx_payments_order_id ON payment_schema.payments(order_id);
CREATE INDEX idx_payments_status ON payment_schema.payments(status);
```

### 5.4 캐싱 전략 (Redis)

**캐시 키 네이밍:**
```
events:list:{status}:{page}:{limit}:{query}      # 이벤트 목록 (TTL: 5분)
event:{eventId}                                   # 이벤트 상세 (TTL: 1분)
tickets:{eventId}                                 # 티켓 타입 (TTL: 5분)
seats:{eventId}                                   # 좌석 정보 (TTL: 30초)
queue:{eventId}                                   # 대기열 (Sorted Set, no TTL)
reservation:lock:{seatId}                         # 좌석 잠금 (TTL: 15분)
```

**캐시 무효화:**
```javascript
// 이벤트 수정 시
await redis.del(`event:${eventId}`);
await redis.del(`events:list:*`);  // 패턴 매칭

// 좌석 예약 시
await redis.del(`seats:${eventId}`);

// 예약 확정 시
await redis.del(`seats:${eventId}`);
await redis.del(`event:${eventId}`);
```

---

## 6. API 명세

### 6.1 API 라우팅 맵

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (React)                           │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP + WebSocket
                         │ http://localhost:3001/api
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (API Gateway)                         │
│                      Port 3001                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /api/auth/*        ──→  Auth Service (3005)                   │
│  /api/events/*      ──→  Ticket Service (3002)                 │
│  /api/tickets/*     ──→  Ticket Service (3002)                 │
│  /api/seats/*       ──→  Ticket Service (3002)                 │
│  /api/reservations/*──→  Ticket Service (3002)                 │
│  /api/queue/*       ──→  Ticket Service (3002)                 │
│  /api/payments/*    ──→  Payment Service (3003)                │
│  /api/stats/*       ──→  Stats Service (3004)                  │
│                                                                 │
│  /api/admin/*       ──→  Backend (로컬)                        │
│  /api/news/*        ──→  Backend (로컬)                        │
│  /api/image/*       ──→  Backend (로컬, S3 업로드)             │
│                                                                 │
│  /health            ──→  Backend (헬스체크)                    │
│  /metrics           ──→  Backend (Prometheus)                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 인증 API (Auth Service)

#### POST /api/auth/register

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "홍길동",
  "phone": "010-1234-5678"
}
```

**Response (201):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-1",
    "email": "user@example.com",
    "name": "홍길동",
    "role": "user"
  }
}
```

#### POST /api/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-1",
    "email": "user@example.com",
    "name": "홍길동",
    "role": "user"
  }
}
```

#### POST /api/auth/google

**Request:**
```json
{
  "credential": "Google_ID_Token_Here..."
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-2",
    "email": "user@gmail.com",
    "name": "김철수",
    "role": "user"
  }
}
```

---

### 6.3 이벤트 API (Ticket Service)

#### GET /api/events

**Query Parameters:**
```
page: 페이지 번호 (기본값: 1)
limit: 페이지 크기 (기본값: 10)
status: 이벤트 상태 (upcoming, on_sale, ended)
search: 검색어 (제목, 아티스트)
```

**Request:**
```
GET /api/events?page=1&limit=10&status=on_sale&search=콘서트
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "title": "아이유 콘서트 2026",
      "description": "아이유 전국 투어 서울 공연",
      "venue": "고척스카이돔",
      "eventDate": "2026-03-15T19:00:00Z",
      "saleStartDate": "2026-01-01T12:00:00Z",
      "saleEndDate": "2026-03-14T23:59:59Z",
      "posterImageUrl": "https://s3.../poster.jpg",
      "status": "on_sale",
      "artistName": "아이유"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

#### GET /api/events/:id

**Response (200):**
```json
{
  "success": true,
  "event": {
    "id": "uuid-1",
    "title": "아이유 콘서트 2026",
    "description": "상세 설명...",
    "venue": "고척스카이돔",
    "address": "서울 구로구...",
    "eventDate": "2026-03-15T19:00:00Z",
    "saleStartDate": "2026-01-01T12:00:00Z",
    "saleEndDate": "2026-03-14T23:59:59Z",
    "posterImageUrl": "https://s3.../poster.jpg",
    "status": "on_sale",
    "artistName": "아이유",
    "ticketTypes": [
      {
        "id": "uuid-tt-1",
        "section": "VIP",
        "price": 150000,
        "availableSeats": 50
      },
      {
        "id": "uuid-tt-2",
        "section": "R석",
        "price": 120000,
        "availableSeats": 200
      }
    ]
  }
}
```

---

### 6.4 좌석 API (Ticket Service)

#### GET /api/seats/:eventId

**Response (200):**
```json
{
  "success": true,
  "seats": [
    {
      "id": "uuid-seat-1",
      "eventId": "uuid-1",
      "section": "VIP",
      "rowNumber": "A",
      "seatNumber": "1",
      "seatLabel": "VIP-A-1",
      "price": 150000,
      "status": "available"
    },
    {
      "id": "uuid-seat-2",
      "eventId": "uuid-1",
      "section": "VIP",
      "rowNumber": "A",
      "seatNumber": "2",
      "seatLabel": "VIP-A-2",
      "price": 150000,
      "status": "reserved"
    }
  ]
}
```

#### POST /api/seats/reserve

**Request:**
```json
{
  "seatIds": ["uuid-seat-1", "uuid-seat-3"]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Seats reserved temporarily",
  "expiresIn": 900  // 15분 (초)
}
```

**Response (409 - Conflict):**
```json
{
  "success": false,
  "error": "Some seats are already reserved",
  "unavailableSeats": ["uuid-seat-3"]
}
```

---

### 6.5 예약 API (Ticket Service)

#### POST /api/reservations

**Request:**
```json
{
  "eventId": "uuid-1",
  "seatIds": ["uuid-seat-1", "uuid-seat-2"]
}
```

**Response (201):**
```json
{
  "success": true,
  "reservation": {
    "id": "uuid-res-1",
    "reservationNumber": "TKT-20260105-00001",
    "eventId": "uuid-1",
    "userId": "uuid-user-1",
    "seats": [
      {
        "seatId": "uuid-seat-1",
        "seatLabel": "VIP-A-1",
        "price": 150000
      },
      {
        "seatId": "uuid-seat-2",
        "seatLabel": "VIP-A-2",
        "price": 150000
      }
    ],
    "totalAmount": 300000,
    "status": "pending",
    "paymentStatus": "pending",
    "expiresAt": "2026-01-05T14:15:00Z"
  }
}
```

#### GET /api/reservations/my

**Response (200):**
```json
{
  "success": true,
  "reservations": [
    {
      "id": "uuid-res-1",
      "reservationNumber": "TKT-20260105-00001",
      "event": {
        "id": "uuid-1",
        "title": "아이유 콘서트 2026",
        "eventDate": "2026-03-15T19:00:00Z"
      },
      "totalAmount": 300000,
      "status": "confirmed",
      "paymentStatus": "completed",
      "createdAt": "2026-01-05T14:00:00Z"
    }
  ]
}
```

---

### 6.6 대기열 API (Ticket Service)

#### POST /api/queue

**Request:**
```json
{
  "eventId": "uuid-1"
}
```

**Response (200):**
```json
{
  "success": true,
  "queueId": "uuid-queue-1",
  "position": 150,
  "estimatedWait": 450  // 초 (약 7.5분)
}
```

#### GET /api/queue/position/:queueId

**Response (200):**
```json
{
  "success": true,
  "queueId": "uuid-queue-1",
  "position": 75,
  "estimatedWait": 225  // 초
}
```

---

### 6.7 결제 API (Payment Service)

#### POST /api/payments/prepare

**Request:**
```json
{
  "reservationId": "uuid-res-1",
  "amount": 300000
}
```

**Response (200):**
```json
{
  "success": true,
  "orderId": "ORDER-uuid-1",
  "amount": 300000
}
```

#### POST /api/payments/confirm

**Request:**
```json
{
  "paymentKey": "toss-payment-key-123",
  "orderId": "ORDER-uuid-1",
  "amount": 300000
}
```

**Response (200):**
```json
{
  "success": true,
  "payment": {
    "id": "uuid-payment-1",
    "orderId": "ORDER-uuid-1",
    "amount": 300000,
    "status": "confirmed",
    "approvedAt": "2026-01-05T14:10:00Z"
  },
  "reservation": {
    "id": "uuid-res-1",
    "status": "confirmed",
    "paymentStatus": "completed"
  }
}
```

---

### 6.8 통계 API (Stats Service)

#### GET /api/stats

**Response (200):**
```json
{
  "success": true,
  "stats": {
    "totalEvents": 50,
    "totalReservations": 1200,
    "totalRevenue": 45000000,
    "todayReservations": 35,
    "todayRevenue": 1250000
  }
}
```

#### GET /api/stats/events

**Response (200):**
```json
{
  "success": true,
  "eventStats": [
    {
      "eventId": "uuid-1",
      "eventTitle": "아이유 콘서트 2026",
      "totalReservations": 250,
      "totalRevenue": 8750000,
      "availableSeats": 50,
      "soldOutPercentage": 83.3
    }
  ]
}
```

---

## 7. 인증 및 보안

### 7.1 JWT 인증

**토큰 구조:**
```javascript
{
  "userId": "uuid-user-1",
  "email": "user@example.com",
  "role": "user",  // 'user' or 'admin'
  "iat": 1704441600,
  "exp": 1705046400  // 7일 후
}
```

**토큰 발급:**
```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  {
    userId: user.id,
    email: user.email,
    role: user.role
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
```

**토큰 검증 (미들웨어):**
```javascript
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

### 7.2 비밀번호 해싱

**bcrypt 사용:**
```javascript
const bcrypt = require('bcrypt');

// 회원가입 시
const passwordHash = await bcrypt.hash(password, 10);

// 로그인 시
const isValid = await bcrypt.compare(password, user.password_hash);
```

### 7.3 Google OAuth2

**흐름:**
```
1. Client → Google OAuth2 로그인
2. Google → ID Token 반환
3. Client → Backend: POST /api/auth/google {credential: ID_Token}
4. Backend → Google API: verifyIdToken(ID_Token)
5. Google → User info (email, name)
6. Backend → DB: 사용자 조회/생성
7. Backend → JWT 발급
8. Backend → Client: {token, user}
```

**구현 (Auth Service):**
```javascript
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  const { credential } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    // 사용자 조회 또는 생성
    let user = await findUserByEmail(email);
    if (!user) {
      user = await createUser({ email, name, password_hash: 'OAUTH' });
    }

    const token = jwt.sign({ userId: user.id, email, role: user.role }, JWT_SECRET);

    res.json({ success: true, token, user });
  } catch (error) {
    res.status(401).json({ error: 'Invalid Google token' });
  }
});
```

### 7.4 관리자 권한 체크

```javascript
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// 사용 예시:
router.post('/admin/events', authMiddleware, adminMiddleware, createEvent);
```

---

## 8. 실시간 통신

### 8.1 Socket.IO 아키텍처

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Client 1   │◄───WS──►│   Backend   │◄───WS──►│   Ticket    │
│ (Browser)   │         │   (3001)    │         │   Service   │
└─────────────┘         │  Socket.IO  │         │   (3002)    │
                        │   Server    │         │  Socket.IO  │
┌─────────────┐         │             │         │   Server    │
│  Client 2   │◄───WS──►│  Redis      │◄────────│             │
│ (Browser)   │         │  Adapter    │         │  Redis      │
└─────────────┘         │             │         │  Adapter    │
                        └─────────────┘         └─────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │    Redis    │
                        │  (Pub/Sub)  │
                        └─────────────┘
```

**Redis Adapter 사용 이유:**
- Kubernetes에서 Backend/Ticket Service가 여러 Pod로 실행
- Redis Pub/Sub으로 모든 Pod 간 이벤트 동기화
- 클라이언트가 어느 Pod에 연결되어도 동일한 이벤트 수신

### 8.2 Socket.IO 서버 설정

**Backend (`backend/src/config/socket.js`):**
```javascript
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.SOCKET_IO_CORS_ORIGIN,
      credentials: true
    }
  });

  // Redis Adapter 설정
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
  });

  // JWT 인증
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // 이벤트 입장
    socket.on('join-event', (eventId) => {
      socket.join(`event:${eventId}`);
    });

    // 대기열 입장
    socket.on('join-queue', (queueId) => {
      socket.join(`queue:${queueId}`);
    });

    // 좌석 선택 페이지 입장
    socket.on('join-seat-selection', (eventId) => {
      socket.join(`seats:${eventId}`);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
}
```

**Ticket Service (`ticket-service/src/server.js`):**
```javascript
const io = initializeSocket(server);

// 좌석 예약 시 이벤트 발생
async function reserveSeat(seatId, userId) {
  // ... DB 업데이트 ...

  // WebSocket으로 모든 클라이언트에 알림
  io.to(`seats:${seat.eventId}`).emit('seat-reserved', {
    seatId,
    userId
  });
}

// 예약 만료 시 이벤트 발생
async function expireReservation(reservationId) {
  // ... DB 업데이트 ...

  const reservation = await getReservation(reservationId);

  // 사용자에게 알림
  io.to(reservation.userId).emit('reservation-expired', {
    reservationId,
    message: '15분이 경과하여 예약이 만료되었습니다.'
  });

  // 좌석 상태 업데이트
  for (const item of reservation.items) {
    io.to(`seats:${reservation.eventId}`).emit('seat-released', {
      seatId: item.seatId
    });
  }
}
```

### 8.3 클라이언트 연결 (React)

**useSocket Hook:**
```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

export const useSocket = (eventId) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    socketInstance.on('connect', () => {
      console.log('Connected to socket');
      setConnected(true);

      if (eventId) {
        socketInstance.emit('join-event', eventId);
        socketInstance.emit('join-seat-selection', eventId);
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from socket');
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [eventId]);

  return { socket, connected };
};
```

**SeatSelection 컴포넌트:**
```javascript
import { useSocket } from '../hooks/useSocket';

function SeatSelection({ eventId }) {
  const [seats, setSeats] = useState([]);
  const { socket, connected } = useSocket(eventId);

  useEffect(() => {
    if (!socket) return;

    // 좌석 예약 이벤트
    socket.on('seat-reserved', ({ seatId }) => {
      setSeats(prev => prev.map(seat =>
        seat.id === seatId ? { ...seat, status: 'reserved' } : seat
      ));
    });

    // 좌석 해제 이벤트
    socket.on('seat-released', ({ seatId }) => {
      setSeats(prev => prev.map(seat =>
        seat.id === seatId ? { ...seat, status: 'available' } : seat
      ));
    });

    // 예약 만료 이벤트
    socket.on('reservation-expired', ({ message }) => {
      alert(message);
      navigate('/events');
    });

    return () => {
      socket.off('seat-reserved');
      socket.off('seat-released');
      socket.off('reservation-expired');
    };
  }, [socket]);

  return (
    <div>
      <ConnectionStatus connected={connected} />
      <SeatMap seats={seats} />
    </div>
  );
}
```

### 8.4 WebSocket 이벤트 목록

| 이벤트명 | 방향 | 설명 | Payload |
|---------|------|------|---------|
| `connect` | S→C | 연결 성공 | - |
| `disconnect` | S→C | 연결 끊김 | - |
| `join-event` | C→S | 이벤트 입장 | `{eventId}` |
| `join-queue` | C→S | 대기열 입장 | `{queueId}` |
| `join-seat-selection` | C→S | 좌석 선택 입장 | `{eventId}` |
| `seat-reserved` | S→C | 좌석 예약됨 | `{seatId, userId}` |
| `seat-released` | S→C | 좌석 해제됨 | `{seatId}` |
| `reservation-expired` | S→C | 예약 만료 | `{reservationId, message}` |
| `queue-updated` | S→C | 대기열 위치 변경 | `{queueId, position}` |
| `queue-admitted` | S→C | 대기열 통과 | `{eventId, message}` |
| `event-status-changed` | S→C | 이벤트 상태 변경 | `{eventId, status}` |

---

## 9. Kubernetes 인프라

### 9.1 Kustomize 구조

```
k8s/
├── base/                          # 공통 리소스 (환경 독립적)
│   ├── kustomization.yaml        # Base 설정
│   ├── backend/
│   │   ├── deployment.yaml       # Backend Deployment
│   │   ├── service.yaml          # Backend Service
│   │   └── kustomization.yaml
│   ├── auth-service/
│   ├── ticket-service/
│   ├── payment-service/
│   ├── stats-service/
│   ├── postgres/                 # Dev 전용 (base에 포함, overlay에서 제외)
│   └── dragonfly/                # Dev 전용
│
└── overlays/                      # 환경별 설정
    ├── dev/                      # 로컬 Kind 클러스터
    │   ├── kustomization.yaml
    │   ├── namespace.yaml        # tiketi namespace
    │   ├── config.env            # ConfigMap (literals → envs)
    │   ├── secrets.env           # Secret (plain text, .gitignore)
    │   ├── service-nodeport-patches.yaml  # NodePort (30000-30004)
    │   └── wait-deps-patch.yaml  # initContainers (DB/Redis 대기)
    │
    ├── staging/                  # AWS EKS Staging
    │   ├── kustomization.yaml
    │   ├── namespace.yaml        # tiketi-staging namespace
    │   ├── secrets.enc.yaml      # SealedSecret (암호화)
    │   ├── ingress.yaml          # ALB Ingress
    │   ├── hpa.yaml              # Horizontal Pod Autoscaler (4개)
    │   ├── resource-patches.yaml # Resource requests/limits
    │   └── replicas-patch.yaml   # Replicas (2-3)
    │
    └── prod/                     # AWS EKS Production
        ├── kustomization.yaml
        ├── namespace.yaml        # tiketi namespace
        ├── secrets.enc.yaml      # SealedSecret (암호화)
        ├── ingress.yaml          # ALB + WAF
        ├── hpa.yaml              # HPA (5개, 더 높은 limit)
        ├── pdb.yaml              # Pod Disruption Budget (HA)
        ├── resource-patches.yaml # Production resource limits
        └── replicas-patch.yaml   # Replicas (3-5)
```

### 9.2 환경별 차이점

| 항목 | Dev (Kind) | Staging (EKS) | Prod (EKS) |
|------|------------|---------------|------------|
| **Namespace** | tiketi | tiketi-staging | tiketi |
| **Database** | In-cluster PostgreSQL | AWS RDS (Single-AZ) | AWS RDS (Multi-AZ) |
| **Cache** | In-cluster Dragonfly | AWS ElastiCache | AWS ElastiCache |
| **Networking** | NodePort (30000-30006) | ALB Ingress | ALB + WAF |
| **Replicas** | 1 (고정) | 2-3 | 3-5 |
| **HPA** | ❌ | ✅ (max 10-20) | ✅ (max 15-30) |
| **PDB** | ❌ | ❌ | ✅ |
| **Resource Limits** | 256Mi-512Mi | 512Mi-2Gi | 1Gi-4Gi |
| **Secrets** | Plain text (.env) | SealedSecret | SealedSecret |
| **Images** | `tiketi-*:local` | ECR (SHA-timestamp) | ECR (SHA-timestamp) |

### 9.3 Dev Overlay 상세 (로컬 Kind)

#### kustomization.yaml

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: tiketi

resources:
  - namespace.yaml         # Dev namespace (tiketi)
  - ../../base
  - ../../base/postgres    # PostgreSQL 포함
  - ../../base/dragonfly   # Dragonfly 포함

configMapGenerator:
  - name: tiketi-config
    envs:
      - config.env  # 파일 기반

secretGenerator:
  - name: tiketi-secret
    envs:
      - secrets.env  # 파일 기반 (.gitignore)

patches:
  - path: service-nodeport-patches.yaml  # NodePort 패치
  - path: wait-deps-patch.yaml           # initContainers 패치

images:
  - name: tiketi-backend
    newTag: local
  - name: tiketi-auth-service
    newTag: local
  - name: tiketi-ticket-service
    newTag: local
  - name: tiketi-payment-service
    newTag: local
  - name: tiketi-stats-service
    newTag: local

commonLabels:
  environment: development
```

#### config.env

```bash
NODE_ENV=development
DB_HOST=postgres-service
DB_PORT=5432
DB_NAME=tiketi
DB_USER=tiketi_user
REDIS_HOST=dragonfly-service
REDIS_PORT=6379
PORT=3001
SOCKET_IO_CORS_ORIGIN=http://localhost:3000
AWS_REGION=ap-northeast-2
GOOGLE_CLIENT_ID=721028631258-dhjgd4gquphib49fsoitiubusbo3t9e9.apps.googleusercontent.com
```

#### secrets.env (.gitignore)

```bash
POSTGRES_PASSWORD=tiketi_password
DB_PASSWORD=tiketi_password
JWT_SECRET=dev-jwt-secret-change-in-production
ADMIN_PASSWORD=admin123
INTERNAL_API_TOKEN=dev-internal-token-12345
```

#### wait-deps-patch.yaml (Dev 전용)

```yaml
# Backend - PostgreSQL + Dragonfly 대기
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  template:
    spec:
      initContainers:
        - name: wait-for-database
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              echo "Waiting for database at $DB_HOST:$DB_PORT..."
              until nc -z $DB_HOST $DB_PORT; do
                sleep 2
              done
          env:
            - name: DB_HOST
              valueFrom:
                configMapKeyRef:
                  name: tiketi-config
                  key: DB_HOST
            - name: DB_PORT
              valueFrom:
                configMapKeyRef:
                  name: tiketi-config
                  key: DB_PORT
        - name: wait-for-cache
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              echo "Waiting for cache at $REDIS_HOST:$REDIS_PORT..."
              until nc -z $REDIS_HOST $REDIS_PORT; do
                sleep 2
              done
          env:
            - name: REDIS_HOST
              valueFrom:
                configMapKeyRef:
                  name: tiketi-config
                  key: REDIS_HOST
            - name: REDIS_PORT
              valueFrom:
                configMapKeyRef:
                  name: tiketi-config
                  key: REDIS_PORT
---
# 다른 서비스도 동일한 패턴...
```

**이유:**
- Dev에서는 PostgreSQL/Dragonfly가 in-cluster로 실행되므로 준비 대기 필요
- Staging/Prod에서는 RDS/ElastiCache가 이미 실행 중이므로 대기 불필요
- Base에서 제거하고 Dev overlay에만 패치로 추가

### 9.4 Staging/Prod Overlay 상세

#### Staging kustomization.yaml

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: tiketi-staging

resources:
  - namespace.yaml     # tiketi-staging namespace
  - ../../base
  - ingress.yaml       # ALB Ingress
  - hpa.yaml           # HPA (4개)
  - secrets.enc.yaml   # SealedSecret

configMapGenerator:
  - name: tiketi-config
    literals:
      - NODE_ENV=staging
      - DB_HOST=tiketi-staging.abcdefg.ap-northeast-2.rds.amazonaws.com
      - DB_PORT=5432
      - DB_NAME=tiketi
      - DB_USER=tiketi_user
      - REDIS_HOST=tiketi-staging.abcdefg.cache.amazonaws.com
      - REDIS_PORT=6379
      - SOCKET_IO_CORS_ORIGIN=https://staging.tiketi.com

patches:
  - path: resource-patches.yaml   # Resource limits
  - path: replicas-patch.yaml     # Replicas 2-3

images:
  - name: tiketi-backend
    newName: 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend
    # newTag는 GitHub Actions에서 설정

commonLabels:
  environment: staging
```

#### secrets.enc.yaml (SealedSecret)

```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: tiketi-secret
  namespace: tiketi-staging
spec:
  encryptedData:
    DB_PASSWORD: AgBQRVBMQUNFSE9MREVSX0VOQ1JZUFRFRF9EQVRBLi4uCg==
    JWT_SECRET: AgBQRVBMQUNFSE9MREVSX0VOQ1JZUFRFRF9EQVRBLi4uCg==
    ADMIN_PASSWORD: AgBQRVBMQUNFSE9MREVSX0VOQ1JZUFRFRF9EQVRBLi4uCg==
    INTERNAL_API_TOKEN: AgBQRVBMQUNFSE9MREVSX0VOQ1JZUFRFRF9EQVRBLi4uCg==
  template:
    metadata:
      name: tiketi-secret
      namespace: tiketi-staging
    type: Opaque
```

**생성 방법:**
```bash
# 1. Sealed Secrets Controller 설치 (EKS)
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# 2. Public key 가져오기
kubeseal --fetch-cert > pub-cert.pem

# 3. Strong secrets 생성
export DB_PASSWORD=$(openssl rand -base64 48)
export JWT_SECRET=$(openssl rand -base64 48)

# 4. Plain Secret 생성
kubectl create secret generic tiketi-secret \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --namespace=tiketi-staging \
  --dry-run=client -o yaml > plain-secret.yaml

# 5. Kubeseal로 암호화
kubeseal --format=yaml --cert=pub-cert.pem \
  < plain-secret.yaml > secrets.enc.yaml

# 6. Plain secret 삭제
shred -u plain-secret.yaml

# 7. Git commit (암호화된 파일만)
git add k8s/overlays/staging/secrets.enc.yaml
git commit -m "feat(k8s): add encrypted staging secrets"
```

#### ingress.yaml (ALB)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:123456789012:certificate/abcd1234
spec:
  rules:
  - host: api-staging.tiketi.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 3001
```

#### hpa.yaml (Horizontal Pod Autoscaler)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ticket-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ticket-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### pdb.yaml (Pod Disruption Budget - Prod 전용)

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ticket-service-pdb
spec:
  minAvailable: 3  # 최소 3개 Pod는 항상 실행
  selector:
    matchLabels:
      app: ticket-service
```

---

## 10. GitOps 파이프라인

### 10.1 GitOps 플로우

```
┌───────────────────────────────────────────────────────────────┐
│                  Developer (로컬)                             │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     │ git push
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GitHub Repository                             │
│                  (Single Source of Truth)                       │
└──────────┬────────────────────┬─────────────────────────────────┘
           │                    │
           │ Trigger            │ Watch
           ▼                    ▼
┌──────────────────────┐  ┌──────────────────────┐
│  GitHub Actions      │  │     ArgoCD           │
│  (CI/CD)             │  │   (CD Only)          │
├──────────────────────┤  ├──────────────────────┤
│ 1. Docker Build      │  │ 1. Git Poll (3min)   │
│ 2. Trivy Scan        │  │ 2. Detect Changes    │
│ 3. ECR Push          │  │ 3. Kustomize Build   │
│ 4. Update Kustomize  │  │ 4. Apply to K8s      │
│ 5. Git Commit        │──┤ 5. Health Check      │
└──────────────────────┘  └───────────┬──────────┘
                                      │
                                      │ kubectl apply
                                      ▼
                          ┌──────────────────────┐
                          │   Kubernetes (EKS)   │
                          ├──────────────────────┤
                          │ - Rolling Update     │
                          │ - Health Check       │
                          │ - Self-Healing       │
                          └──────────────────────┘
```

### 10.2 GitHub Actions CI/CD

**위치:** `.github/workflows/`

**워크플로우 목록:**
- `backend-ci-cd.yml`
- `auth-service-ci-cd.yml`
- `ticket-service-ci-cd.yml`
- `payment-service-ci-cd.yml`
- `stats-service-ci-cd.yml`

#### 예시: ticket-service-ci-cd.yml

```yaml
name: Ticket Service CI/CD

on:
  push:
    branches: [main, develop]
    paths:
      - 'services/ticket-service/**'
      - 'packages/common/**'
      - '.github/workflows/ticket-service-ci-cd.yml'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - prod

env:
  AWS_REGION: ap-northeast-2
  SERVICE_NAME: ticket-service
  ECR_REPOSITORY: tiketi-ticket-service

jobs:
  build-and-push:
    name: Build & Push to ECR
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # OIDC
      contents: write  # Git push

    outputs:
      image-tag: ${{ steps.meta.outputs.image-tag }}
      environment: ${{ steps.detect-env.outputs.environment }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect target environment
        id: detect-env
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            ENV="${{ github.event.inputs.environment }}"
          elif [ "${{ github.ref_name }}" = "main" ]; then
            ENV="prod"
          else
            ENV="staging"
          fi
          echo "environment=$ENV" >> $GITHUB_OUTPUT

      - name: Generate image metadata
        id: meta
        run: |
          SHORT_SHA=$(echo ${{ github.sha }} | cut -c1-7)
          IMAGE_TAG="${SHORT_SHA}-$(date +%Y%m%d-%H%M%S)"
          echo "image-tag=$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ steps.meta.outputs.image-tag }}
        run: |
          cd services/ticket-service
          docker build \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:latest \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:${{ steps.detect-env.outputs.environment }} \
            .

      - name: Run security scan (Trivy)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ steps.meta.outputs.image-tag }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '0'  # Report only

      - name: Push to ECR
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ steps.meta.outputs.image-tag }}
        run: |
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:${{ steps.detect-env.outputs.environment }}

  update-manifests:
    name: Update Kustomize Manifests
    needs: build-and-push
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Update Kustomize image tag
        env:
          ENVIRONMENT: ${{ needs.build-and-push.outputs.environment }}
          IMAGE_TAG: ${{ needs.build-and-push.outputs.image-tag }}
          ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.${{ env.AWS_REGION }}.amazonaws.com
        run: |
          KUSTOMIZE_FILE="k8s/overlays/$ENVIRONMENT/kustomization.yaml"

          sed -i "s|newName: .*tiketi-${{ env.SERVICE_NAME }}.*|newName: $ECR_REGISTRY/${{ env.ECR_REPOSITORY }}|g" "$KUSTOMIZE_FILE"
          sed -i "/tiketi-${{ env.SERVICE_NAME }}/,/newTag:/s|newTag: .*|newTag: $IMAGE_TAG|" "$KUSTOMIZE_FILE"

      - name: Commit and push changes
        env:
          ENVIRONMENT: ${{ needs.build-and-push.outputs.environment }}
          IMAGE_TAG: ${{ needs.build-and-push.outputs.image-tag }}
        run: |
          if [ -n "$(git status --porcelain)" ]; then
            git add k8s/overlays/$ENVIRONMENT/kustomization.yaml
            git commit -m "chore(k8s): update ${{ env.SERVICE_NAME }} image to $IMAGE_TAG [$ENVIRONMENT]"
            git push
          fi
```

**트리거 조건:**
```
develop 브랜치 푸시 → Staging 배포
main 브랜치 푸시    → Production 배포
workflow_dispatch   → 수동 선택
```

**빌드 프로세스:**
1. 코드 체크아웃
2. 환경 감지 (develop→staging, main→prod)
3. 이미지 태그 생성 (`{short-sha}-{timestamp}`)
4. AWS OIDC 인증
5. Docker 이미지 빌드 (3개 태그)
6. Trivy 보안 스캔
7. ECR 푸시
8. Kustomize manifest 업데이트 (`newTag` 변경)
9. Git commit & push
10. ArgoCD가 변경 감지 → 배포

### 10.3 ArgoCD 설정

**위치:** `argocd/`

#### ArgoCD Project

```yaml
# argocd/projects/tiketi-project.yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: tiketi
  namespace: argocd
spec:
  description: Tiketi - Event Ticketing Platform

  sourceRepos:
    - 'https://github.com/ORGANIZATION/project-ticketing.git'

  destinations:
    - namespace: tiketi
      server: https://kubernetes.default.svc
    - namespace: tiketi-staging
      server: https://kubernetes.default.svc
    - namespace: '*'
      server: '*'

  clusterResourceWhitelist:
    - group: ''
      kind: Namespace
    - group: rbac.authorization.k8s.io
      kind: ClusterRole

  roles:
    - name: developer
      policies:
        - p, proj:tiketi:developer, applications, get, tiketi/*, allow
        - p, proj:tiketi:developer, applications, sync, tiketi/*, allow
      groups:
        - tiketi-developers

    - name: admin
      policies:
        - p, proj:tiketi:admin, applications, *, tiketi/*, allow
      groups:
        - tiketi-admins
```

#### ArgoCD Applications

**Staging:**
```yaml
# argocd/applications/tiketi-staging.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tiketi-staging
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  labels:
    environment: staging
spec:
  project: tiketi

  source:
    repoURL: https://github.com/ORGANIZATION/project-ticketing.git
    targetRevision: develop  # Staging tracks develop
    path: k8s/overlays/staging

  destination:
    server: https://kubernetes.default.svc
    namespace: tiketi-staging

  syncPolicy:
    automated:
      prune: true      # 자동 리소스 삭제
      selfHeal: true   # 자동 복구
      allowEmpty: false

    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
      - ApplyOutOfSyncOnly=true
      - ServerSideApply=true

    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 5m

  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas  # HPA 관리

    - group: autoscaling
      kind: HorizontalPodAutoscaler
      jsonPointers:
        - /status
```

**Production:**
```yaml
# argocd/applications/tiketi-prod.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tiketi-prod
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
  labels:
    environment: production
  annotations:
    # ArgoCD Notifications
    notifications.argoproj.io/subscribe.on-deployed.slack: tiketi-prod-deployments
    notifications.argoproj.io/subscribe.on-health-degraded.slack: tiketi-prod-alerts
spec:
  project: tiketi

  source:
    repoURL: https://github.com/ORGANIZATION/project-ticketing.git
    targetRevision: main  # Production tracks main
    path: k8s/overlays/prod

  destination:
    server: https://kubernetes.default.svc
    namespace: tiketi

  syncPolicy:
    # MANUAL sync for production
    # automated: 비활성화 (안전을 위해)

    syncOptions:
      - CreateNamespace=false  # Namespace must pre-exist
      - PrunePropagationPolicy=foreground
      - PruneLast=true
      - ApplyOutOfSyncOnly=true
      - ServerSideApply=true

    retry:
      limit: 3
      backoff:
        duration: 10s
        factor: 2
        maxDuration: 10m
```

**Production 배포 방법:**
```bash
# ArgoCD CLI로 수동 sync
argocd app sync tiketi-prod

# 또는 ArgoCD UI에서:
# Applications → tiketi-prod → SYNC 버튼 클릭
```

#### App of Apps

```yaml
# argocd/applications/app-of-apps.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tiketi-app-of-apps
  namespace: argocd
spec:
  project: tiketi

  source:
    repoURL: https://github.com/ORGANIZATION/project-ticketing.git
    targetRevision: main
    path: argocd/applications

  destination:
    server: https://kubernetes.default.svc
    namespace: argocd

  syncPolicy:
    automated:
      prune: false
      selfHeal: true
```

**배포:**
```bash
kubectl apply -f argocd/applications/app-of-apps.yaml

# App of Apps가 자동으로 다음을 생성:
# - tiketi-dev
# - tiketi-staging
# - tiketi-prod
```

---

## 11. 모니터링 및 로깅

### 11.1 Prometheus 메트릭

**수집 메트릭:**

```javascript
// HTTP 메트릭
http_requests_total             // 카운터 (총 요청 수)
http_request_duration_seconds   // 히스토그램 (응답 시간)

// 비즈니스 메트릭
tiketi_reservations_created_total      // 카운터 (예약 생성)
tiketi_seats_reserved_total            // 카운터 (좌석 예약)
tiketi_queue_users_total               // 게이지 (대기열 사용자 수)
tiketi_payments_processed_total        // 카운터 (결제 처리)
tiketi_events_created_total            // 카운터 (이벤트 생성)

// 시스템 메트릭
nodejs_heap_size_total_bytes    // Node.js 힙 사이즈
nodejs_heap_size_used_bytes     // 사용 중인 힙
process_cpu_user_seconds_total  // CPU 사용 시간
```

**메트릭 수집 (Backend aggregator.js):**
```javascript
const axios = require('axios');
const { register } = require('prom-client');

async function collectMetrics() {
  const services = [
    'http://auth-service:3005/metrics',
    'http://ticket-service:3002/metrics',
    'http://payment-service:3003/metrics',
    'http://stats-service:3004/metrics'
  ];

  for (const url of services) {
    try {
      const { data } = await axios.get(url);
      // 메트릭 집계
    } catch (error) {
      console.error(`Failed to fetch metrics from ${url}`);
    }
  }
}

setInterval(collectMetrics, 30000);  // 30초마다
```

### 11.2 Grafana 대시보드

**기본 대시보드:**
- HTTP 요청 수 (서비스별)
- 응답 시간 (P50, P95, P99)
- 에러율
- 예약 생성 추이
- 대기열 현황
- 결제 성공률

**Prometheus Query 예시:**
```promql
# 서비스별 초당 요청 수
rate(http_requests_total[5m])

# 평균 응답 시간
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# P95 응답 시간
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# 에러율
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

### 11.3 Loki + Promtail (로깅)

**Loki:** 로그 수집 및 저장
**Promtail:** Pod 로그 수집 에이전트

**로그 쿼리 (LogQL):**
```logql
# Backend 로그
{namespace="tiketi", app="backend"}

# 에러 로그만
{namespace="tiketi"} |= "error"

# 특정 사용자 로그
{namespace="tiketi", app="ticket-service"} |= "userId: uuid-1"

# 시간대별 에러 수
sum(rate({namespace="tiketi"} |= "error" [5m])) by (app)
```

**Winston 로그 구조:**
```javascript
const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
});

logger.info('User login', {
  userId: 'uuid-1',
  email: 'user@example.com',
  timestamp: new Date().toISOString()
});

// 출력:
// {"level":"info","message":"User login","userId":"uuid-1","email":"user@example.com","timestamp":"2026-01-05T14:00:00.000Z"}
```

---

## 12. 배포 전략

### 12.1 환경 분리

```
Developer Laptop (로컬)
    └─> Kind 클러스터 (dev)
        └─> 테스트 및 검증

GitHub
    │
    ├─> develop 브랜치
    │   └─> GitHub Actions
    │       └─> EKS Staging (tiketi-staging)
    │           └─> ArgoCD Auto Sync
    │
    └─> main 브랜치
        └─> GitHub Actions
            └─> EKS Production (tiketi)
                └─> ArgoCD Manual Sync (승인 필요)
```

### 12.2 배포 플로우

#### Dev (로컬)

```bash
# 1. Kind 클러스터 생성
kind create cluster --name tiketi-local --config k8s/kind-config.yaml

# 2. Docker 이미지 빌드 & 로드
./scripts/build-all-images.sh

# 3. Dev overlay 배포
kubectl apply -k k8s/overlays/dev

# 4. 확인
kubectl get pods -n tiketi
```

#### Staging (자동 배포)

```bash
# 1. develop 브랜치에 푸시
git checkout develop
git add .
git commit -m "feat: new feature"
git push origin develop

# 2. GitHub Actions 자동 실행
#    - Docker 빌드
#    - ECR 푸시
#    - Kustomize 업데이트
#    - Git push

# 3. ArgoCD 자동 sync (약 3분 이내)
#    - Git 변경 감지
#    - Kustomize build
#    - kubectl apply
#    - Health check

# 4. 배포 확인
argocd app get tiketi-staging
kubectl get pods -n tiketi-staging
```

#### Production (수동 승인)

```bash
# 1. develop → main PR 생성
git checkout develop
git pull
git checkout main
git merge develop
git push origin main

# 2. GitHub Actions 자동 실행
#    - Docker 빌드
#    - ECR 푸시
#    - Kustomize 업데이트
#    - Git push

# 3. ArgoCD에서 OutOfSync 상태 확인
argocd app get tiketi-prod

# 4. 수동 sync (승인)
argocd app sync tiketi-prod
# 또는 ArgoCD UI에서 SYNC 버튼 클릭

# 5. 배포 확인
kubectl get pods -n tiketi -w
kubectl rollout status deployment/ticket-service -n tiketi
```

### 12.3 Rolling Update

**Deployment 설정:**
```yaml
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 최대 1개 추가 Pod
      maxUnavailable: 1  # 최대 1개 Pod 다운 허용
```

**배포 과정:**
```
기존: Pod-1, Pod-2, Pod-3 (v1)

Step 1: Pod-4 생성 (v2)
        Pod-1, Pod-2, Pod-3 (v1) + Pod-4 (v2) ✅

Step 2: Pod-1 종료
        Pod-2, Pod-3 (v1) + Pod-4 (v2)

Step 3: Pod-5 생성 (v2)
        Pod-2, Pod-3 (v1) + Pod-4, Pod-5 (v2) ✅

Step 4: Pod-2 종료
        Pod-3 (v1) + Pod-4, Pod-5 (v2)

Step 5: Pod-6 생성 (v2)
        Pod-3 (v1) + Pod-4, Pod-5, Pod-6 (v2) ✅

Step 6: Pod-3 종료
        Pod-4, Pod-5, Pod-6 (v2) ✅ 완료
```

### 12.4 Rollback

**ArgoCD Rollback:**
```bash
# 이전 버전 확인
argocd app history tiketi-prod

# 특정 버전으로 롤백
argocd app rollback tiketi-prod {revision-id}
```

**Kubectl Rollback:**
```bash
# 이전 버전으로 롤백
kubectl rollout undo deployment/ticket-service -n tiketi

# 특정 리비전으로 롤백
kubectl rollout undo deployment/ticket-service --to-revision=2 -n tiketi

# 롤아웃 이력 확인
kubectl rollout history deployment/ticket-service -n tiketi
```

**Git Revert (권장):**
```bash
# Kustomize manifest를 이전 커밋으로 되돌림
git revert HEAD
git push

# ArgoCD가 자동 감지하여 이전 버전 배포
```

---

## 📊 요약

### 프로젝트 통계

| 항목 | 수치 |
|------|------|
| **전체 서비스 수** | 6개 (Backend + 5 서비스) |
| **총 API 엔드포인트** | 50+ |
| **데이터베이스 테이블** | 15개 |
| **Docker 이미지** | 6개 |
| **Kubernetes Manifests** | 100+ 파일 |
| **GitHub Actions 워크플로우** | 5개 |
| **ArgoCD Applications** | 3개 (dev/staging/prod) |
| **코드 라인 수 (추정)** | 15,000+ |

### 핵심 성과

1. ✅ **마이크로서비스 아키텍처** - 독립 배포 가능한 5개 서비스
2. ✅ **GitOps 파이프라인** - GitHub Actions + ArgoCD 완전 자동화
3. ✅ **Kustomize Base + Overlays** - 환경별 설정 분리 (dev/staging/prod)
4. ✅ **실시간 통신** - Socket.IO + Redis Adapter (다중 Pod 지원)
5. ✅ **보안 강화** - JWT, bcrypt, Sealed Secrets
6. ✅ **고가용성** - HPA, PDB, Multi-AZ
7. ✅ **모니터링** - Prometheus + Grafana + Loki
8. ✅ **결제 연동** - TossPayments API

### 기술적 챌린지 해결

| 챌린지 | 해결 방안 |
|--------|----------|
| **대규모 트래픽** | HPA, 대기열 시스템, Redis 캐싱 |
| **실시간 좌석 동기화** | Socket.IO + Redis Pub/Sub |
| **서비스 간 통신** | API Gateway 패턴, HTTP/REST |
| **데이터 격리** | PostgreSQL 스키마 분리 |
| **환경별 설정** | Kustomize Overlays |
| **비밀 관리** | Sealed Secrets (암호화) |
| **자동 배포** | GitOps (ArgoCD) |
| **롤백** | ArgoCD History, Git Revert |

---

**작성일:** 2026-01-05
**버전:** 1.0.0
**총 페이지:** 세부 명세 포함 전체 문서

이 문서는 Tiketi 프로젝트의 **완전한 기술 명세서**로, 발표 및 기술 문서로 활용 가능합니다.
