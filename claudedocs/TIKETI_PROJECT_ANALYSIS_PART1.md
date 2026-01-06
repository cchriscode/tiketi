# TIKETI 프로젝트 종합 분석 보고서 (Part 1)

> 티켓 예매 시스템의 모놀리식에서 MSA로의 전환 프로젝트
>
> 작성일: 2025-12-29

---

## 목차 (Part 1)

1. [프로젝트 개요](#1-프로젝트-개요)
2. [프로젝트 구조](#2-프로젝트-구조)
3. [MSA 아키텍처 분석](#3-msa-아키텍처-분석)
4. [데이터베이스 설계](#4-데이터베이스-설계)
5. [공통 모듈 및 의존성 관리](#5-공통-모듈-및-의존성-관리)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 소개

**TIKETI**는 콘서트, 공연, 스포츠 경기 등의 티켓을 온라인으로 예매할 수 있는 플랫폼입니다.

**핵심 비즈니스 기능:**
- 이벤트 조회 및 검색
- 실시간 좌석 선택
- 대기열 시스템 (트래픽 제어)
- 온라인 결제 (TossPayments 연동)
- 예매 내역 관리
- 관리자 대시보드

### 1.2 기술 스택

**Frontend:**
- React 18
- React Router v6
- Socket.IO Client (실시간 통신)
- Axios (HTTP 클라이언트)
- Recharts (통계 차트)
- TossPayments SDK

**Backend:**
- Node.js v18+
- Express.js
- PostgreSQL 16 (Schema-based Multi-tenancy)
- Redis (DragonflyDB) - 캐싱, 대기열, Socket.IO Adapter
- Socket.IO (실시간 통신)
- JWT (인증)
- bcrypt (비밀번호 해싱)

**Infrastructure:**
- Docker
- Kubernetes (Kind - Local Development)
- Nginx (프론트엔드 서빙)
- Prometheus (메트릭)
- Loki + Promtail (로깅)
- Grafana (모니터링)

### 1.3 프로젝트 현황

**마이그레이션 상태:**
- ✅ 모놀리식 → MSA 마이그레이션 80% 완료
- ✅ 4개 마이크로서비스 분리 (Auth, Ticket, Payment, Stats)
- ✅ 데이터베이스 스키마 분리
- ✅ 공통 패키지 라이브러리화 (@tiketi/common, @tiketi/database, @tiketi/metrics)
- ✅ Kubernetes 배포 환경 구축

**미완료 영역:**
- ⚠️ API Gateway 미구현 (현재 각 서비스 직접 호출)
- ⚠️ 서비스 간 HTTP 통신 미구현 (크로스 스키마 DB 쿼리로 대체)
- ⚠️ 이벤트 기반 비동기 통신 미구현
- ⚠️ Circuit Breaker 패턴 미적용
- ⚠️ 분산 트레이싱 미구현

---

## 2. 프로젝트 구조

### 2.1 디렉토리 구조

```
C:\Users\USER\project-ticketing\
├── backend/                    # 레거시 모놀리식 백엔드 (포트 3001)
│   ├── src/
│   │   ├── routes/            # API 라우트
│   │   ├── services/          # 비즈니스 로직
│   │   ├── config/            # 설정 파일
│   │   └── server.js          # 진입점
│   ├── package.json
│   └── Dockerfile
│
├── frontend/                   # React 프론트엔드 (포트 3000)
│   ├── src/
│   │   ├── components/        # 재사용 컴포넌트
│   │   ├── pages/             # 페이지 컴포넌트
│   │   ├── hooks/             # Custom Hooks
│   │   ├── services/          # API 클라이언트
│   │   └── App.js
│   ├── public/
│   ├── package.json
│   └── Dockerfile (Nginx)
│
├── services/                   # MSA 마이크로서비스들
│   ├── auth-service/          # 인증 서비스 (포트 3002)
│   │   ├── src/
│   │   │   ├── routes/        # auth.js
│   │   │   ├── config/        # database.js
│   │   │   └── server.js
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── ticket-service/        # 티켓/이벤트 서비스 (포트 3004)
│   │   ├── src/
│   │   │   ├── routes/        # events, tickets, seats, queue
│   │   │   ├── services/      # queue-processor (백그라운드)
│   │   │   └── server.js      # Socket.IO 포함
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── payment-service/       # 결제 서비스 (포트 3003)
│   │   ├── src/
│   │   │   ├── routes/        # payments.js
│   │   │   ├── services/      # tosspayments.js
│   │   │   └── server.js
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── stats-service/         # 통계 서비스 (포트 3005)
│       ├── src/
│       │   ├── routes/        # stats.js
│       │   └── server.js
│       ├── package.json
│       └── Dockerfile
│
├── packages/                  # 공유 모노레포 패키지
│   ├── common/               # 공통 유틸리티
│   │   ├── src/
│   │   │   ├── constants.js
│   │   │   ├── errors.js
│   │   │   ├── middleware/
│   │   │   └── utils/
│   │   └── package.json      # @tiketi/common
│   │
│   ├── database/             # DB 커넥션 헬퍼
│   │   ├── src/
│   │   │   └── index.js      # createPostgresPool, createRedisClient
│   │   └── package.json      # @tiketi/database
│   │
│   └── metrics/              # Prometheus 메트릭
│       ├── src/
│       │   └── index.js      # metricsMiddleware
│       └── package.json      # @tiketi/metrics
│
├── k8s/                      # Kubernetes 매니페스트
│   ├── 00-namespace.yaml
│   ├── 01-configmap.yaml
│   ├── 02-secret.yaml
│   ├── 04-postgres.yaml
│   ├── 05-dragonfly.yaml
│   ├── 06-backend.yaml       # 레거시 백엔드
│   ├── 07-frontend.yaml      # Nginx + React
│   ├── 12-auth-service.yaml
│   ├── 13-ticket-service.yaml
│   ├── 11-payment-service.yaml
│   └── 14-stats-service.yaml
│
├── database/                 # DB 스키마 및 마이그레이션
│   ├── init.sql             # 초기 스키마 (레거시)
│   ├── migrations/
│   │   ├── auth-service-schema.sql
│   │   ├── ticket-service-schema.sql
│   │   ├── payment-service-schema.sql
│   │   └── stats-service-schema.sql
│   └── insert_sample_events.sql
│
├── scripts/                  # 자동화 스크립트
│   ├── 1-setup-cluster.sh
│   ├── 2-setup-database.sh
│   ├── 3-build-and-deploy.sh
│   └── port-forward-all.sh
│
├── claudedocs/              # 프로젝트 문서
│   └── TIKETI_PROJECT_ANALYSIS_PART1.md (이 파일)
│
└── README.md
```

### 2.2 서비스 포트 매핑

| 서비스 | 내부 포트 | NodePort | URL |
|--------|-----------|----------|-----|
| Frontend (Nginx) | 3000 | 30005 | http://localhost:30005 |
| Backend (Legacy) | 3001 | 30000 | http://localhost:30000 |
| Auth Service | 3002 | 30001 | http://localhost:30001 |
| Payment Service | 3003 | 30003 | http://localhost:30003 |
| Ticket Service | 3004 | 30004 | http://localhost:30004 |
| Stats Service | 3005 | 30002 | http://localhost:30002 |
| PostgreSQL | 5432 | - | (ClusterIP) |
| DragonflyDB (Redis) | 6379 | - | (ClusterIP) |

---

## 3. MSA 아키텍처 분석

### 3.1 서비스 분리 전략

**도메인 기반 분리 (Domain-Driven Design):**

TIKETI 프로젝트는 다음과 같이 비즈니스 도메인별로 서비스를 분리했습니다:

1. **Auth Service** - 사용자 인증 및 권한 관리
2. **Ticket Service** - 이벤트, 티켓, 좌석, 예약 관리
3. **Payment Service** - 결제 처리
4. **Stats Service** - 통계 및 리포팅

### 3.2 각 서비스 상세 분석

#### 3.2.1 Auth Service (인증 서비스)

**책임 범위:**
- 사용자 회원가입/로그인
- Google OAuth 인증
- JWT 토큰 발급 및 검증
- 사용자 정보 관리

**API 엔드포인트:**
```
POST /auth/register        # 회원가입
POST /auth/login           # 로그인
POST /auth/google          # Google OAuth 로그인
POST /auth/verify-token    # 토큰 검증 (서비스 간 통신용)
GET  /auth/me              # 현재 사용자 정보
```

**주요 구현 특징:**

1. **비밀번호 보안:**
   - bcrypt를 이용한 해싱 (SALT_ROUNDS=10)
   - 평문 비밀번호 절대 저장 안 함

2. **JWT 토큰:**
   ```javascript
   // Payload 구조
   {
     userId: "uuid",
     email: "user@example.com",
     role: "user" | "admin"
   }

   // 만료 시간: 7일 (JWT_EXPIRES_IN)
   ```

3. **공통 라이브러리 활용:**
   ```javascript
   const { ValidationError, NotFoundError, ConflictError,
           AuthenticationError, validateRequired, validateEmail
   } = require('@tiketi/common');
   ```

**데이터베이스:**
- 스키마: `auth_schema`
- 테이블: `users`

**파일 경로:**
- `services/auth-service/src/server.js:1`
- `services/auth-service/src/routes/auth.js:1`

---

#### 3.2.2 Ticket Service (티켓/이벤트 서비스)

**책임 범위:**
- 이벤트 CRUD (생성, 조회, 수정, 삭제)
- 티켓 타입 관리 (VIP, R석, S석 등)
- 좌석 생성/조회/잠금/예약
- 예약 생성 및 관리
- 대기열 시스템 (Queue Management)
- 실시간 좌석 상태 업데이트 (Socket.IO)

**API 엔드포인트:**
```
# Events
GET    /events              # 이벤트 목록
GET    /events/:id          # 이벤트 상세
POST   /events              # 이벤트 생성 (관리자)
PUT    /events/:id          # 이벤트 수정
DELETE /events/:id          # 이벤트 삭제

# Tickets
GET    /tickets/event/:eventId   # 이벤트별 티켓 타입
POST   /tickets                   # 티켓 타입 생성

# Seats
GET    /seats/event/:eventId     # 이벤트 좌석 조회
POST   /seats/lock               # 좌석 잠금 (임시 예약)
POST   /seats/unlock             # 좌석 잠금 해제
POST   /seats/reserve            # 좌석 최종 예약

# Queue
POST   /queue/join               # 대기열 참가
GET    /queue/position/:eventId  # 내 대기 순번
POST   /queue/process            # 대기열 처리 (자동/수동)
```

**WebSocket 이벤트:**
```javascript
// 클라이언트 → 서버
socket.emit('join-event', { eventId })
socket.emit('join-queue', { eventId })

// 서버 → 클라이언트
socket.on('seat-locked', (data) => { /* 좌석 잠금 알림 */ })
socket.on('seat-available', (data) => { /* 좌석 가용 알림 */ })
socket.on('queue-updated', (data) => { /* 대기열 업데이트 */ })
socket.on('queue-entry-allowed', (data) => { /* 입장 허용 */ })
```

**주요 구현 특징:**

1. **Socket.IO 서버 통합:**
   ```javascript
   const io = new Server(server, {
     cors: {
       origin: process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:3000',
       methods: ['GET', 'POST'],
     },
   });

   // Express app에 io 인스턴스 공유
   app.locals.io = io;
   ```

2. **백그라운드 서비스:**
   - `queue-processor.js`: 대기열 자동 처리 (주기적으로 대기자를 입장시킴)
   - 서버 시작 시 자동 실행, SIGTERM/SIGINT 시 Graceful Shutdown

3. **Redis 활용:**
   - 좌석 잠금 관리 (TTL 설정)
   - 대기열 관리 (Sorted Set)
   - Socket.IO Adapter (멀티 인스턴스 동기화)

**데이터베이스:**
- 스키마: `ticket_schema`
- 테이블:
  - `seat_layouts` (좌석 레이아웃 템플릿)
  - `events` (이벤트)
  - `ticket_types` (티켓 등급)
  - `seats` (개별 좌석)
  - `reservations` (예약)
  - `reservation_items` (예약 상세)
  - `keyword_mappings` (검색 키워드)
  - `news` (뉴스/공지사항)

**파일 경로:**
- `services/ticket-service/src/server.js:1`
- `services/ticket-service/src/routes/events.js`
- `services/ticket-service/src/routes/seats.js`
- `services/ticket-service/src/routes/queue.js`
- `services/ticket-service/src/services/queue-processor.js`

---

#### 3.2.3 Payment Service (결제 서비스)

**책임 범위:**
- TossPayments API 연동
- 결제 요청 생성 (orderId 발급)
- 결제 승인/취소/환불
- 결제 로그 기록
- 결제 검증

**API 엔드포인트:**
```
POST   /payments/prepare            # 결제 준비 (orderId 생성)
POST   /payments/confirm             # 결제 승인 (TossPayments confirm API)
POST   /:paymentKey/cancel           # 결제 취소
GET    /payments/order/:orderId      # 결제 조회 (orderId로)
GET    /payments/user/me             # 내 결제 내역
```

**TossPayments 연동 흐름:**

```
[클라이언트]                [Payment Service]           [TossPayments API]
    |                              |                            |
    | 1. POST /prepare             |                            |
    |----------------------------->|                            |
    |                              | orderId 생성               |
    |                              | DB에 pending 상태 저장     |
    |<-----------------------------|                            |
    | { orderId, clientKey }       |                            |
    |                              |                            |
    | 2. TossPayments SDK 결제창  |                            |
    |------------------------------------------------------------>|
    |                              |                            | 사용자 결제 진행
    |<------------------------------------------------------------|
    | { paymentKey, orderId }      |                            |
    |                              |                            |
    | 3. POST /confirm             |                            |
    |----------------------------->|                            |
    |                              | 4. POST /v1/payments/confirm
    |                              |---------------------------->|
    |                              |                            | 결제 승인
    |                              |<----------------------------|
    |                              | { status, approvedAt, ... }|
    |                              |                            |
    |                              | 5. DB 업데이트:            |
    |                              |   - payments.status = confirmed
    |                              |   - reservations.status = confirmed
    |                              |                            |
    |<-----------------------------|                            |
    | { success: true }            |                            |
```

**주요 구현 특징:**

1. **트랜잭션 관리:**
   ```javascript
   const client = await db.pool.connect();
   try {
     await client.query('BEGIN');

     // 1. Payment 조회 (FOR UPDATE - 락)
     // 2. TossPayments API 호출
     // 3. Payment 업데이트
     // 4. Reservation 업데이트

     await client.query('COMMIT');
   } catch (error) {
     await client.query('ROLLBACK');
     throw error;
   } finally {
     client.release();
   }
   ```

2. **API 로깅:**
   - 모든 TossPayments API 요청/응답을 `payment_logs` 테이블에 기록
   - 에러 코드, 에러 메시지 저장
   - 디버깅 및 감사 추적 용이

3. **금액 검증:**
   - 클라이언트가 전달한 amount와 DB의 reservation.total_amount 비교
   - 불일치 시 결제 거부 (Amount mismatch)

4. **멱등성 보장:**
   - 동일한 orderId로 중복 결제 방지
   - 이미 confirmed 상태인 결제는 재승인 불가

**데이터베이스:**
- 스키마: `payment_schema`
- 테이블:
  - `payments` (결제 정보)
  - `payment_logs` (API 요청/응답 로그)

**크로스 스키마 참조:**
```sql
-- Payment Service는 다른 스키마의 테이블도 조회 가능
SELECT * FROM ticket_schema.reservations WHERE id = $1;
UPDATE ticket_schema.reservations SET status = 'confirmed' WHERE id = $1;
```

**파일 경로:**
- `services/payment-service/src/server.js:1`
- `services/payment-service/src/routes/payments.js:1`
- `services/payment-service/src/services/tosspayments.js`

---

#### 3.2.4 Stats Service (통계 서비스)

**책임 범위:**
- 전체 대시보드 통계
- 일별/주별/월별 통계
- 이벤트별 통계
- 결제 수단별 통계
- 매출 분석
- 사용자 행동 분석
- 실시간 현황
- 전환율 분석
- 취소/환불 분석
- 좌석 선호도 분석

**API 엔드포인트:**
```
GET /stats/overview           # 전체 개요
GET /stats/daily              # 일별 통계
GET /stats/events             # 이벤트별 통계
GET /stats/events/:eventId    # 특정 이벤트 상세
GET /stats/payments           # 결제 수단별 통계
GET /stats/revenue            # 매출 통계
GET /stats/users              # 사용자 통계
GET /stats/hourly-traffic     # 시간대별 트래픽
GET /stats/conversion         # 전환율 분석
GET /stats/cancellations      # 취소/환불 분석
GET /stats/realtime           # 실시간 현황
GET /stats/seat-preferences   # 좌석 선호도
GET /stats/user-behavior      # 사용자 행동 패턴
GET /stats/performance        # 성능 메트릭
```

**주요 구현 특징:**

1. **크로스 스키마 집계 쿼리:**
   ```sql
   SELECT
     e.id,
     e.title,
     COUNT(DISTINCT r.id) as total_reservations,
     SUM(p.amount) as total_revenue
   FROM ticket_schema.events e
   LEFT JOIN ticket_schema.reservations r ON e.id = r.event_id
   LEFT JOIN payment_schema.payments p ON r.id = p.reservation_id
   WHERE p.status = 'confirmed'
   GROUP BY e.id, e.title;
   ```

2. **통계 캐싱:**
   - `stats_schema.daily_stats` - 일별 통계 캐시
   - `stats_schema.event_stats` - 이벤트별 통계 캐시
   - 성능 최적화를 위해 미리 계산된 통계 저장

3. **관리자 전용:**
   - 모든 엔드포인트는 관리자 권한 필요
   - JWT 토큰의 role 확인

**데이터베이스:**
- 스키마: `stats_schema`
- 테이블:
  - `daily_stats` (일별 통계 캐시)
  - `event_stats` (이벤트별 통계 캐시)

**파일 경로:**
- `services/stats-service/src/server.js:1`
- `services/stats-service/src/routes/stats.js`

---

### 3.3 서비스 간 통신

#### 3.3.1 현재 구현 방식 (크로스 스키마 DB 쿼리)

```javascript
// Payment Service에서 Ticket Service 데이터 접근
const reservationResult = await db.query(
  `SELECT id, user_id, event_id, total_amount, status
   FROM ticket_schema.reservations  -- 다른 스키마 접근
   WHERE id = $1`,
  [reservationId]
);
```

**장점:**
- 구현이 간단함
- 트랜잭션 관리 용이 (단일 DB)
- 네트워크 오버헤드 없음

**단점:**
- 서비스 간 강한 결합 (Tight Coupling)
- 독립적인 데이터베이스 분리 불가
- 마이크로서비스의 독립성 훼손
- 스키마 변경 시 여러 서비스 영향

#### 3.3.2 향후 개선 방안

**1. RESTful API 호출 (동기 통신):**
```javascript
// Payment Service → Ticket Service
const reservationResponse = await axios.get(
  `http://ticket-service:3004/reservations/${reservationId}`
);
```

**2. 이벤트 기반 비동기 통신 (메시지 큐):**
```javascript
// Payment Service에서 이벤트 발행
await eventBus.publish('PaymentConfirmed', {
  reservationId,
  paymentId,
  amount,
});

// Ticket Service에서 이벤트 구독
eventBus.subscribe('PaymentConfirmed', async (event) => {
  await updateReservationStatus(event.reservationId, 'confirmed');
});
```

**권장 메시지 브로커:**
- RabbitMQ (간단한 큐잉)
- Apache Kafka (대용량 이벤트 스트리밍)
- Redis Pub/Sub (간단한 실시간 이벤트)

---

## 4. 데이터베이스 설계

### 4.1 스키마 분리 전략

TIKETI는 **Schema-based Multi-tenancy** 패턴을 사용합니다.

**구조:**
```
tiketi (PostgreSQL Database)
├── public                    # 공통 확장 (uuid-ossp, pg_trgm)
├── auth_schema               # Auth Service 전용 스키마
├── ticket_schema             # Ticket Service 전용 스키마
├── payment_schema            # Payment Service 전용 스키마
└── stats_schema              # Stats Service 전용 스키마 (캐시용)
```

**장점:**
- 서비스별 논리적 분리
- 단일 DB 인스턴스로 관리 간소화
- 크로스 스키마 JOIN 가능 (통계 서비스)
- 백업/복구 용이
- 비용 효율적

**단점:**
- 물리적 분리 불가 (진정한 독립성 부족)
- 스키마 간 의존성 발생 가능
- 확장성 제한 (수평 확장 어려움)

### 4.2 Search Path 설정

모든 서비스는 DB 연결 시 자동으로 search_path를 설정하여 크로스 스키마 접근이 가능합니다:

```javascript
// @tiketi/database 패키지
pool.on('connect', async (client) => {
  await client.query(`
    SET search_path TO ticket_schema, auth_schema, payment_schema, stats_schema, public
  `);
});
```

이를 통해 다른 스키마의 테이블을 스키마명 없이 직접 접근할 수 있습니다:
```sql
-- 스키마명 명시 (명확함)
SELECT * FROM auth_schema.users WHERE id = $1;

-- search_path 덕분에 생략 가능 (편리함)
SELECT * FROM users WHERE id = $1;
```

### 4.3 각 스키마별 테이블 구조

#### 4.3.1 Auth Schema

```sql
auth_schema.users
├── id (UUID, PK)
├── email (VARCHAR, UNIQUE)
├── password_hash (VARCHAR)
├── name (VARCHAR)
├── phone (VARCHAR, nullable)
├── role (VARCHAR: 'user' | 'admin')
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

-- 인덱스
idx_auth_users_email (email)
idx_auth_users_role (role)
```

**파일 경로:** `database/migrations/auth-service-schema.sql:1`

---

#### 4.3.2 Ticket Schema

```sql
ticket_schema.seat_layouts       # 좌석 레이아웃 템플릿
├── id (UUID, PK)
├── name (VARCHAR, UNIQUE)
├── description (TEXT)
├── total_seats (INTEGER)
├── layout_config (JSONB)        # JSON 형태의 좌석 배치 설정
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

ticket_schema.events             # 이벤트
├── id (UUID, PK)
├── title (VARCHAR)
├── description (TEXT)
├── venue (VARCHAR)
├── address (TEXT)
├── event_date (TIMESTAMP)
├── sale_start_date (TIMESTAMP)
├── sale_end_date (TIMESTAMP)
├── poster_image_url (TEXT)
├── status (VARCHAR: upcoming|on_sale|sold_out|ended|cancelled)
├── seat_layout_id (UUID, FK → seat_layouts)
├── artist_name (VARCHAR)
├── pre_scaled (BOOLEAN)         # 예상 트래픽에 따른 사전 스케일링 플래그
├── created_by (UUID)            # FK → auth_schema.users (논리적 참조)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

ticket_schema.ticket_types       # 티켓 등급 (VIP, R석, S석 등)
├── id (UUID, PK)
├── event_id (UUID, FK → events)
├── name (VARCHAR)
├── price (INTEGER)
├── total_quantity (INTEGER)
├── available_quantity (INTEGER)
├── description (TEXT)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

ticket_schema.seats              # 개별 좌석
├── id (UUID, PK)
├── event_id (UUID, FK → events)
├── section (VARCHAR)            # 구역 (A, B, C 등)
├── row_number (INTEGER)
├── seat_number (INTEGER)
├── seat_label (VARCHAR)         # 표시용 레이블 (A-1, B-12 등)
├── price (INTEGER)
├── status (VARCHAR: available|reserved|locked)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── UNIQUE(event_id, section, row_number, seat_number)

ticket_schema.reservations       # 예약
├── id (UUID, PK)
├── user_id (UUID)               # FK → auth_schema.users (논리적 참조)
├── event_id (UUID, FK → events)
├── reservation_number (VARCHAR, UNIQUE)
├── total_amount (INTEGER)
├── status (VARCHAR: pending|confirmed|cancelled|expired)
├── payment_method (VARCHAR)
├── payment_status (VARCHAR: pending|completed|failed|refunded)
├── expires_at (TIMESTAMP)       # 예약 만료 시간 (보통 15분)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

ticket_schema.reservation_items  # 예약 상세 (좌석별)
├── id (UUID, PK)
├── reservation_id (UUID, FK → reservations)
├── ticket_type_id (UUID, FK → ticket_types)
├── seat_id (UUID, FK → seats)
├── quantity (INTEGER)
├── unit_price (INTEGER)
├── subtotal (INTEGER)
└── created_at (TIMESTAMP)

ticket_schema.keyword_mappings   # 한글-영어 검색 매핑
├── id (UUID, PK)
├── korean (VARCHAR)
├── english (VARCHAR)
├── entity_type (VARCHAR)
└── created_at (TIMESTAMP)

ticket_schema.news               # 뉴스/공지사항
├── id (UUID, PK)
├── title (VARCHAR)
├── content (TEXT)
├── author (VARCHAR)
├── author_id (UUID)             # FK → auth_schema.users (논리적 참조)
├── views (INTEGER)
├── is_pinned (BOOLEAN)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

-- 주요 인덱스
idx_ticket_events_event_date (event_date)
idx_ticket_events_status (status)
idx_ticket_events_artist (artist_name)
idx_ticket_seats_event (event_id)
idx_ticket_seats_status (event_id, status)
idx_ticket_reservations_user_id (user_id)
idx_ticket_reservations_status (status)
idx_ticket_reservations_expires_at (expires_at)  -- 만료 예약 정리용
```

**파일 경로:** `database/migrations/ticket-service-schema.sql:1`

---

#### 4.3.3 Payment Schema

```sql
payment_schema.payments          # 결제 정보
├── id (UUID, PK)
├── reservation_id (UUID)        # FK → ticket_schema.reservations
├── user_id (UUID)               # FK → auth_schema.users
├── event_id (UUID)              # FK → ticket_schema.events (캐시)
├── order_id (VARCHAR, UNIQUE)   # TossPayments 주문 ID (6-64자)
├── payment_key (VARCHAR, UNIQUE) # TossPayments 결제 키
├── amount (INTEGER)
├── method (VARCHAR)             # 결제 수단 (카드, 가상계좌, 간편결제 등)
├── status (VARCHAR: pending|confirmed|failed|cancelled|refunded)
├── toss_order_name (VARCHAR)
├── toss_status (VARCHAR)
├── toss_requested_at (TIMESTAMP)
├── toss_approved_at (TIMESTAMP)
├── toss_receipt_url (TEXT)
├── toss_checkout_url (TEXT)
├── toss_response (JSONB)        # TossPayments API 전체 응답
├── refund_amount (INTEGER)
├── refund_reason (TEXT)
├── refunded_at (TIMESTAMP)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

payment_schema.payment_logs      # API 요청/응답 로그
├── id (UUID, PK)
├── payment_id (UUID, FK → payments)
├── action (VARCHAR)             # confirm, cancel, refund 등
├── endpoint (VARCHAR)           # API 엔드포인트
├── method (VARCHAR)             # HTTP method
├── request_headers (JSONB)
├── request_body (JSONB)
├── response_status (INTEGER)
├── response_body (JSONB)
├── error_code (VARCHAR)
├── error_message (TEXT)
└── created_at (TIMESTAMP)

-- 주요 인덱스
idx_payment_reservation (reservation_id)
idx_payment_user (user_id)
idx_payment_order_id (order_id)
idx_payment_payment_key (payment_key)
idx_payment_status (status)
idx_payment_logs_payment (payment_id)
idx_payment_logs_action (action)
```

**파일 경로:** `database/migrations/payment-service-schema.sql:1`

---

#### 4.3.4 Stats Schema

```sql
stats_schema.daily_stats         # 일별 통계 캐시
├── id (UUID, PK)
├── date (DATE, UNIQUE)
├── total_reservations (INTEGER)
├── total_revenue (INTEGER)
├── total_users (INTEGER)
├── metrics (JSONB)              # 기타 통계 데이터
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

stats_schema.event_stats         # 이벤트별 통계 캐시
├── id (UUID, PK)
├── event_id (UUID, UNIQUE)
├── total_reservations (INTEGER)
├── total_revenue (INTEGER)
├── conversion_rate (DECIMAL)
├── metrics (JSONB)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

**파일 경로:** `database/migrations/stats-service-schema.sql`

---

### 4.4 데이터 마이그레이션 전략

각 스키마 마이그레이션 SQL 파일은 다음과 같은 구조를 따릅니다:

```sql
-- 1. 스키마 생성
CREATE SCHEMA IF NOT EXISTS auth_schema;

-- 2. 확장 기능 활성화 (public 스키마)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Search path 설정
SET search_path TO auth_schema, public;

-- 4. 테이블 생성
CREATE TABLE IF NOT EXISTS auth_schema.users (...);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_schema.users(email);

-- 6. 트리거 생성 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION auth_schema.update_updated_at_column() ...
CREATE TRIGGER update_auth_users_updated_at ...

-- 7. 데이터 마이그레이션 (레거시 public 스키마 → 새 스키마)
DO $$
BEGIN
  IF EXISTS (SELECT FROM public.users)
  AND NOT EXISTS (SELECT FROM auth_schema.users LIMIT 1)
  THEN
    INSERT INTO auth_schema.users SELECT * FROM public.users;
  END IF;
END $$;

-- 8. 권한 설정
GRANT USAGE ON SCHEMA auth_schema TO tiketi_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth_schema TO tiketi_user;

-- 9. 검증 쿼리
SELECT 'auth_schema.users' as table_name, COUNT(*) as row_count FROM auth_schema.users;
```

---

## 5. 공통 모듈 및 의존성 관리

### 5.1 모노레포 패키지 구조

TIKETI는 공통 기능을 재사용 가능한 npm 패키지로 분리하여 관리합니다.

```
packages/
├── common/              # @tiketi/common
├── database/            # @tiketi/database
└── metrics/             # @tiketi/metrics
```

각 마이크로서비스는 이 패키지들을 `package.json`에서 로컬 의존성으로 참조합니다:

```json
{
  "dependencies": {
    "@tiketi/common": "file:../../packages/common",
    "@tiketi/database": "file:../../packages/database",
    "@tiketi/metrics": "file:../../packages/metrics"
  }
}
```

### 5.2 @tiketi/common

**위치:** `packages/common/src/index.js:1`

**제공 기능:**

1. **Constants (상수):**
   - HTTP 상태 코드
   - 에러 메시지
   - 공통 상수

2. **Custom Errors (커스텀 에러):**
   ```javascript
   class CustomError extends Error {
     constructor(message, statusCode) {
       super(message);
       this.statusCode = statusCode;
     }
   }

   class ValidationError extends CustomError {
     constructor(message) {
       super(message, 400);
     }
   }

   class NotFoundError extends CustomError {
     constructor(resource) {
       super(`${resource} not found`, 404);
     }
   }

   class ConflictError extends CustomError {
     constructor(message) {
       super(message, 409);
     }
   }

   class AuthenticationError extends CustomError {
     constructor(message) {
       super(message, 401);
     }
   }
   ```

3. **Error Handler Middleware:**
   ```javascript
   function errorHandler(err, req, res, next) {
     const statusCode = err.statusCode || 500;

     res.status(statusCode).json({
       error: err.message,
       code: err.code,
       ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
     });
   }
   ```

4. **Validators (유효성 검증):**
   ```javascript
   function validateRequired(fields, data) {
     for (const field of fields) {
       if (!data[field]) {
         throw new ValidationError(`${field} is required`);
       }
     }
   }

   function validateEmail(email) {
     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(email)) {
       throw new ValidationError('Invalid email format');
     }
   }
   ```

**사용 예시:**
```javascript
// services/auth-service/src/routes/auth.js:9
const {
  ValidationError,
  NotFoundError,
  ConflictError,
  AuthenticationError,
  validateRequired,
  validateEmail,
} = require('@tiketi/common');

router.post('/register', async (req, res, next) => {
  try {
    validateRequired(['email', 'password', 'name'], req.body);
    validateEmail(req.body.email);

    // ... 비즈니스 로직
  } catch (error) {
    next(error); // errorHandler 미들웨어가 처리
  }
});
```

---

### 5.3 @tiketi/database

**위치:** `packages/database/src/index.js:1`

**제공 기능:**

1. **PostgreSQL 커넥션 풀 생성:**
   ```javascript
   const { Pool } = require('pg');

   function createPostgresPool(config) {
     const pool = new Pool({
       host: config.host || process.env.DB_HOST,
       port: config.port || process.env.DB_PORT || 5432,
       database: config.database || process.env.DB_NAME,
       user: config.user || process.env.DB_USER,
       password: config.password || process.env.DB_PASSWORD,
       max: config.max || 20,
       idleTimeoutMillis: 30000,
       connectionTimeoutMillis: 2000,
     });

     // 중요: 모든 커넥션에 search_path 자동 설정
     pool.on('connect', async (client) => {
       try {
         await client.query(`
           SET search_path TO ticket_schema, auth_schema, payment_schema, stats_schema, public
         `);
       } catch (err) {
         console.error('Failed to set search_path:', err.message);
       }
     });

     return pool;
   }
   ```

2. **Redis 클라이언트 생성:**
   ```javascript
   const Redis = require('ioredis');

   function createRedisClient(url) {
     const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';
     return new Redis(redisUrl);
   }
   ```

3. **트랜잭션 헬퍼:**
   ```javascript
   async function withTransaction(pool, callback) {
     const client = await pool.connect();

     try {
       await client.query('BEGIN');
       const result = await callback(client);
       await client.query('COMMIT');
       return result;
     } catch (error) {
       await client.query('ROLLBACK');
       throw error;
     } finally {
       client.release();
     }
   }
   ```

4. **캐시 매니저:**
   ```javascript
   class CacheManager {
     constructor(redisClient) {
       this.redis = redisClient;
     }

     async get(key) {
       const value = await this.redis.get(key);
       return value ? JSON.parse(value) : null;
     }

     async set(key, value, ttl = 3600) {
       await this.redis.setex(key, ttl, JSON.stringify(value));
     }

     async del(key) {
       await this.redis.del(key);
     }

     async invalidatePattern(pattern) {
       const keys = await this.redis.keys(pattern);
       if (keys.length > 0) {
         await this.redis.del(...keys);
       }
     }
   }
   ```

**사용 예시:**
```javascript
// services/auth-service/src/config/database.js
const { createPostgresPool } = require('@tiketi/database');

const pool = createPostgresPool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = { pool, query: (text, params) => pool.query(text, params) };
```

---

### 5.4 @tiketi/metrics

**위치:** `packages/metrics/src/index.js`

**제공 기능:**

1. **Prometheus 메트릭 미들웨어:**
   ```javascript
   const promClient = require('prom-client');

   // 기본 메트릭 수집
   promClient.collectDefaultMetrics();

   // HTTP 요청 카운터
   const httpRequestCounter = new promClient.Counter({
     name: 'http_requests_total',
     help: 'Total number of HTTP requests',
     labelNames: ['method', 'route', 'status_code', 'service'],
   });

   // HTTP 응답 시간 히스토그램
   const httpRequestDuration = new promClient.Histogram({
     name: 'http_request_duration_seconds',
     help: 'Duration of HTTP requests in seconds',
     labelNames: ['method', 'route', 'status_code', 'service'],
     buckets: [0.1, 0.5, 1, 2, 5],
   });

   function metricsMiddleware(serviceName) {
     return (req, res, next) => {
       const start = Date.now();

       res.on('finish', () => {
         const duration = (Date.now() - start) / 1000;
         const route = req.route?.path || req.path;

         httpRequestCounter.inc({
           method: req.method,
           route,
           status_code: res.statusCode,
           service: serviceName,
         });

         httpRequestDuration.observe({
           method: req.method,
           route,
           status_code: res.statusCode,
           service: serviceName,
         }, duration);
       });

       next();
     };
   }

   module.exports = {
     metricsMiddleware,
     register: promClient.register,
   };
   ```

**사용 예시:**
```javascript
// services/auth-service/src/server.js:9
const { metricsMiddleware, register } = require('@tiketi/metrics');

app.use(metricsMiddleware('auth-service'));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**수집되는 메트릭:**
- `http_requests_total` - 총 HTTP 요청 수
- `http_request_duration_seconds` - HTTP 요청 처리 시간
- `process_cpu_user_seconds_total` - 프로세스 CPU 사용 시간
- `process_resident_memory_bytes` - 프로세스 메모리 사용량
- `nodejs_eventloop_lag_seconds` - Node.js 이벤트 루프 지연

---

### 5.5 의존성 관리 전략

**1. 공통 패키지 업데이트 시:**
```bash
# packages/common 수정 후
cd services/auth-service
npm install  # 로컬 패키지 재설치
```

**2. 버전 관리:**
- 현재는 `file:` 프로토콜로 로컬 패키지 직접 참조
- 향후 private npm registry (Verdaccio 등) 도입 고려

**3. 빌드 순서:**
```bash
# 1. 공통 패키지 먼저 빌드 (필요 시)
cd packages/common && npm run build

# 2. 각 서비스 빌드
cd services/auth-service && npm run build
```

---

## 다음 파트에서 계속...

Part 2에서는 다음 내용을 다룹니다:
- 6. Frontend 아키텍처 분석
- 7. Kubernetes 배포 전략
- 8. 코드 품질 및 장단점 분석
- 9. 아키텍처 다이어그램
- 10. 기술적 의사결정 분석
- 11. 면접 질문 및 QnA
