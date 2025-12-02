# TIKETI MSA + Kubernetes 마이그레이션 가이드 (Part 2)
## MSA 서비스 분리 전략

---

## 📋 목차

1. [서비스 분리 원칙](#1-서비스-분리-원칙)
2. [TIKETI 서비스 도메인 분석](#2-tiketi-서비스-도메인-분석)
3. [마이크로서비스 아키텍처 설계](#3-마이크로서비스-아키텍처-설계)
4. [서비스별 상세 설계](#4-서비스별-상세-설계)
5. [서비스 간 통신 전략](#5-서비스-간-통신-전략)
6. [데이터베이스 분리 전략](#6-데이터베이스-분리-전략)

---

## 1. 서비스 분리 원칙

### 1.1 Domain-Driven Design (DDD) 기반 분리

**Bounded Context 식별:**
```
티켓팅 비즈니스 도메인 맵:

┌─────────────────────────────────────────────────────────┐
│                   Core Domain (핵심)                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  티켓 판매 (Ticketing)                            │  │
│  │  - 좌석 선택/예약                                  │  │
│  │  - 재고 관리                                       │  │
│  │  - 동시성 제어                                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  대기열 관리 (Queue)                              │  │
│  │  - 트래픽 제어                                     │  │
│  │  - 공정한 순서 보장                                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                Supporting Domain (지원)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ 결제     │ │ 알림     │ │ 이벤트   │               │
│  │ Payment  │ │ Notify   │ │ Event    │               │
│  └──────────┘ └──────────┘ └──────────┘               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                Generic Domain (범용)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ 사용자   │ │ 검색     │ │ 파일     │               │
│  │ User     │ │ Search   │ │ Storage  │               │
│  └──────────┘ └──────────┘ └──────────┘               │
└─────────────────────────────────────────────────────────┘
```

### 1.2 실제 티켓팅 사이트의 서비스 구조 분석

#### Ticketmaster 아키텍처 (참고)

```
1. Fan Experience Services (고객 대면)
   - Discovery API (이벤트 검색)
   - Seat Selection Service
   - Virtual Waiting Room (대기열)

2. Inventory Services (재고 관리)
   - Ticket Inventory Service
   - Hold Management (임시 예약)
   - Release Management (반환)

3. Transaction Services (거래 처리)
   - Order Service
   - Payment Gateway
   - Pricing Engine

4. Platform Services (플랫폼)
   - Identity & Access
   - Notification Hub
   - Analytics & Reporting
```

#### Interpark Ticket 구조 (추정)

```
1. 티켓 판매 서비스
   - 좌석 배치 서비스
   - 예매 처리 서비스
   - 취소/환불 서비스

2. 대기열 서비스 (자체 개발)
   - 대기 순번 관리
   - 진입 제어

3. 결제 서비스
   - PG 연동 (NicePay, KCP)
   - 에스크로 처리

4. 회원 서비스
   - SSO 인증
   - 등급 관리
```

### 1.3 TIKETI에 적용할 분리 기준

**Single Responsibility Principle 적용:**
```javascript
// ❌ 잘못된 예: 하나의 서비스가 너무 많은 책임
class TicketService {
  async purchaseTicket() {
    await this.checkQueue();      // 대기열 검증
    await this.validateUser();     // 사용자 검증
    await this.lockSeat();         // 좌석 잠금
    await this.processPayment();   // 결제 처리
    await this.sendEmail();        // 이메일 발송
    await this.updateAnalytics();  // 분석 데이터 업데이트
  }
}

// ✅ 올바른 예: 각 책임을 독립 서비스로 분리
QueueService.checkPosition()      → 대기열 전용
UserService.validate()             → 사용자 관리 전용
TicketService.reserveSeat()        → 티켓 예약 전용
PaymentService.process()           → 결제 전용
NotificationService.sendEmail()    → 알림 전용
AnalyticsService.track()           → 분석 전용
```

**분리 시 고려사항:**
1. **트래픽 패턴**: 대기열은 피크 타임에 50배 확장, 이벤트 조회는 2배만 필요
2. **변경 빈도**: 결제 로직은 자주 변경, 사용자 인증은 안정적
3. **장애 격리**: 알림 실패가 티켓 구매를 막으면 안 됨
4. **데이터 일관성**: 좌석 예약은 강한 일관성, 알림은 최종 일관성 허용
5. **팀 구조**: 서비스당 2-3명 팀이 독립 개발 가능해야 함

---

## 2. TIKETI 서비스 도메인 분석

### 2.1 현재 Monolith의 API 엔드포인트 그룹화

```javascript
// 현재 backend/src/routes/ 분석

┌──────────────────────────────────────────────────────┐
│ auth.js (인증/인가)                                   │
├──────────────────────────────────────────────────────┤
│ POST /api/auth/register                              │
│ POST /api/auth/login                                 │
│ → User Service로 분리                                │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ events.js (이벤트 관리)                               │
├──────────────────────────────────────────────────────┤
│ GET  /api/events                                     │
│ GET  /api/events/:id                                 │
│ → Event Service로 분리                               │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ tickets.js (티켓 정보)                                │
├──────────────────────────────────────────────────────┤
│ GET  /api/tickets/event/:eventId                     │
│ GET  /api/tickets/availability/:ticketTypeId         │
│ → Ticket Service에 통합 (예약 기능과 함께)           │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ seats.js (좌석 관리) - 핵심 도메인                    │
├──────────────────────────────────────────────────────┤
│ GET  /api/seats/events/:eventId                      │
│ POST /api/seats/reserve  ← 동시성 이슈 많음          │
│ → Ticket Service (독립 서비스로 분리)                │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ reservations.js (예약 관리)                           │
├──────────────────────────────────────────────────────┤
│ POST   /api/reservations                             │
│ GET    /api/reservations/my                          │
│ POST   /api/reservations/:id/cancel                  │
│ → Order Service로 분리 (예약 = 주문)                 │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ queue.js (대기열) - 핵심 도메인                       │
├──────────────────────────────────────────────────────┤
│ POST /api/queue/check/:eventId                       │
│ GET  /api/queue/status/:eventId                      │
│ → Queue Service (독립 서비스, 최대 확장 필요)        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ payments.js (결제)                                    │
├──────────────────────────────────────────────────────┤
│ POST /api/payments/process                           │
│ → Payment Service (PG 연동 복잡도 높음)              │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ admin.js (관리자)                                     │
├──────────────────────────────────────────────────────┤
│ GET    /api/admin/dashboard/stats                    │
│ POST   /api/admin/events                             │
│ PUT    /api/admin/events/:id                         │
│ DELETE /api/admin/events/:id                         │
│ → Admin Service (BFF 패턴으로 구성)                  │
└──────────────────────────────────────────────────────┘
```

### 2.2 트래픽 패턴 분석

```javascript
// 실제 트래픽 분포 예측 (피크 타임 기준)

서비스별 트래픽 비율:
┌─────────────────────────────────────────────┐
│ Queue Service         │ 40% │ ████████      │
│ Ticket Service        │ 25% │ █████         │
│ Event Service         │ 15% │ ███           │
│ Order Service         │ 10% │ ██            │
│ Payment Service       │  5% │ █             │
│ User Service          │  3% │ ▌             │
│ Notification Service  │  2% │ ▌             │
└─────────────────────────────────────────────┘

확장 우선순위:
1순위: Queue Service (대기열이 전체 시스템 보호)
2순위: Ticket Service (재고 관리 핵심)
3순위: Payment Service (매출 직결)
4순위: Order Service (주문 처리)
5순위: 나머지 서비스
```

### 2.3 데이터 의존성 분석

```
현재 Database Schema의 테이블 간 관계:

users (사용자)
  ↓ (created_by)
events (이벤트)
  ↓ (event_id)
ticket_types (티켓 타입)
  ↓ (ticket_type_id)
reservation_items (예약 항목)
  ↑ (reservation_id)
reservations (예약)
  ↑ (user_id)
users

seats (좌석)
  ↓ (seat_id)
reservation_items
  ↑ (event_id)
events

강결합 관계:
- reservations ↔ reservation_items (트랜잭션 필수)
- seats ↔ events (좌석은 이벤트에 종속)
- ticket_types ↔ events (티켓 타입도 이벤트에 종속)

약결합 가능:
- users → reservations (이벤트 기반 참조)
- events → ticket_types (캐싱 가능)
```

---

## 3. 마이크로서비스 아키텍처 설계

### 3.1 최종 서비스 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Web App      │  │ Mobile App   │  │ Admin Panel  │          │
│  │ (React)      │  │ (향후)        │  │ (React)      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Kong / AWS API Gateway                                    │  │
│  │ - Authentication (JWT 검증)                               │  │
│  │ - Rate Limiting (사용자별, IP별)                          │  │
│  │ - Request Routing                                         │  │
│  │ - Response Caching                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Microservices (EKS)                           │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ User Service     │  │ Event Service    │                    │
│  │ (인증/회원관리)   │  │ (이벤트 조회)     │                    │
│  │ 10 Pods          │  │ 10 Pods          │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Queue Service    │  │ Ticket Service   │                    │
│  │ (대기열 관리)     │  │ (예약/좌석)       │                    │
│  │ 5-100 Pods ⚡    │  │ 10-50 Pods ⚡    │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Order Service    │  │ Payment Service  │                    │
│  │ (주문/예약)       │  │ (결제 처리)       │                    │
│  │ 10-30 Pods ⚡    │  │ 5-20 Pods ⚡     │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Notification     │  │ Analytics        │                    │
│  │ Service          │  │ Service          │                    │
│  │ 5 Pods           │  │ 3 Pods           │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │ Admin BFF        │  ← Backend for Frontend 패턴             │
│  │ Service          │                                           │
│  │ 3 Pods           │                                           │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Event Bus (Async)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ AWS MSK (Managed Kafka)                                   │  │
│  │ - order.created                                           │  │
│  │ - ticket.reserved                                         │  │
│  │ - payment.completed                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ User DB    │ │ Event DB   │ │ Ticket DB  │                 │
│  │ (RDS)      │ │ (RDS)      │ │ (RDS)      │                 │
│  └────────────┘ └────────────┘ └────────────┘                 │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│  │ Queue      │ │ Cache      │ │ S3         │                 │
│  │ (Redis)    │ │ (Redis)    │ │ (Images)   │                 │
│  └────────────┘ └────────────┘ └────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 서비스 개수 및 책임 정의

| # | 서비스명 | 책임 | Pod 수 (최소/최대) | DB |
|---|---------|------|-------------------|-----|
| 1 | **User Service** | 회원가입, 로그인, JWT 발급 | 5 / 15 | user_db |
| 2 | **Event Service** | 이벤트 조회, 검색, 캐싱 | 5 / 15 | event_db |
| 3 | **Queue Service** | 대기열 관리, 진입 제어 | 10 / 100 | Redis |
| 4 | **Ticket Service** | 좌석/티켓 예약, 재고 관리 | 10 / 50 | ticket_db |
| 5 | **Order Service** | 주문 생성, 조회, 취소 | 5 / 30 | order_db |
| 6 | **Payment Service** | 결제 처리, PG 연동 | 5 / 20 | payment_db |
| 7 | **Notification Service** | 이메일, SMS, Push 발송 | 3 / 10 | - |
| 8 | **Analytics Service** | 이벤트 추적, 대시보드 | 2 / 5 | analytics_db |
| 9 | **Admin BFF** | 관리자 API 통합 | 2 / 5 | - |

**총 Pod 수:**
- 평시: 47 Pods
- 피크: 250 Pods (5배 확장)

---

## 4. 서비스별 상세 설계

### 4.1 User Service (사용자 관리)

**책임:**
```
✅ 회원가입 (이메일 중복 체크, 비밀번호 해시)
✅ 로그인 (JWT 토큰 발급)
✅ 토큰 검증 (다른 서비스에서 호출)
✅ 사용자 정보 조회/수정
✅ 프로필 관리
```

**API 엔드포인트:**
```javascript
POST   /api/users/register
POST   /api/users/login
POST   /api/users/refresh-token
GET    /api/users/me
PUT    /api/users/me
GET    /api/users/:id  (내부 서비스용)
POST   /internal/users/validate-token  (내부 전용)
```

**데이터베이스 스키마:**
```sql
-- user_db (독립 RDS 인스턴스)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

**기술 스택:**
```yaml
언어: Node.js (TypeScript로 변환 권장)
프레임워크: Express.js
인증: JWT (RS256 - 비대칭 키)
보안: bcrypt (10 rounds)
캐시: Redis (토큰 블랙리스트, 세션)
```

**확장 전략:**
```yaml
# HPA (Horizontal Pod Autoscaler)
minReplicas: 5
maxReplicas: 15
targetCPUUtilization: 70%

# 확장 트리거
- CPU 사용률 70% 이상
- 메모리 사용률 80% 이상
- 평균 응답 시간 200ms 초과
```

**장애 시나리오 및 대응:**
```
시나리오 1: JWT 검증 서비스 다운
→ 대응: API Gateway에서 Public Key로 직접 검증
→ User Service는 발급만 담당

시나리오 2: 대량 회원가입 시도 (봇 공격)
→ 대응: Rate Limiting (IP당 10 req/min)
→ reCAPTCHA 추가

시나리오 3: DB 연결 실패
→ 대응: Circuit Breaker (3회 실패 시 30초 차단)
→ Read Replica로 조회 기능 유지
```

---

### 4.2 Event Service (이벤트 조회)

**책임:**
```
✅ 이벤트 목록 조회 (페이징, 필터링)
✅ 이벤트 상세 정보
✅ 검색 (한글/영문 키워드)
✅ 이벤트 상태 자동 업데이트 (on_sale, ended 등)
✅ 캐싱으로 DB 부하 최소화
```

**API 엔드포인트:**
```javascript
GET    /api/events?page=1&limit=20&status=on_sale
GET    /api/events/:id
GET    /api/events/search?q=BTS
GET    /api/events/:id/ticket-types
GET    /internal/events/:id  (캐시 없이 최신 데이터)
```

**캐싱 전략:**
```javascript
// Redis 캐시 레이어
const cacheStrategy = {
  'event:list': {
    ttl: 60,  // 1분 (자주 변경됨)
    pattern: 'event:list:page:{page}:status:{status}'
  },
  'event:detail': {
    ttl: 300,  // 5분
    pattern: 'event:{id}',
    invalidateOn: ['event.updated', 'event.cancelled']
  },
  'event:search': {
    ttl: 180,  // 3분
    pattern: 'search:{query}:page:{page}'
  }
};

// Cache-Aside 패턴
async function getEvent(id) {
  // 1. 캐시 확인
  const cached = await redis.get(`event:${id}`);
  if (cached) return JSON.parse(cached);

  // 2. DB 조회
  const event = await db.query('SELECT * FROM events WHERE id = $1', [id]);

  // 3. 캐시 저장
  await redis.setex(`event:${id}`, 300, JSON.stringify(event));

  return event;
}
```

**데이터베이스 스키마:**
```sql
-- event_db (독립 RDS 인스턴스)
CREATE TABLE events (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  venue VARCHAR(255),
  event_date TIMESTAMP NOT NULL,
  sale_start_date TIMESTAMP,
  sale_end_date TIMESTAMP,
  status VARCHAR(20) DEFAULT 'upcoming',
  poster_image_url VARCHAR(500),
  created_by UUID,  -- User ID (외래 키 아님, 이벤트 참조만)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ticket_types (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  name VARCHAR(100),
  price DECIMAL(10,2),
  total_quantity INTEGER,
  description TEXT
);

-- 검색 최적화
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_sale_dates ON events(sale_start_date, sale_end_date);
CREATE INDEX idx_events_search ON events USING gin(to_tsvector('english', title));
```

**Event Status Updater (Background Job):**
```javascript
// Kubernetes CronJob으로 실행 (매 5분마다)
apiVersion: batch/v1
kind: CronJob
metadata:
  name: event-status-updater
spec:
  schedule: "*/5 * * * *"  # 5분마다
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: updater
            image: tiketi/event-service:latest
            command: ["node", "jobs/update-status.js"]
```

---

### 4.3 Queue Service (대기열 관리) ⭐ 핵심

**책임:**
```
✅ 대기열 진입 (이벤트별 threshold 체크)
✅ 대기 순번 관리 (Redis Sorted Set)
✅ 자동 진입 처리 (capacity 기반)
✅ 대기 시간 추정
✅ 세션 복원 (페이지 새로고침 시)
✅ WebSocket 실시간 순번 업데이트
```

**왜 독립 서비스로 분리하는가?**
```
문제: 단일 서비스에서 대기열 처리
→ 30만 명 접속 시 메모리/CPU 폭증
→ 다른 기능(티켓 예약, 결제)까지 영향
→ 전체 서비스 다운

해결: Queue Service 독립 분리
→ 독립적으로 100 Pods까지 확장
→ 다른 서비스는 영향 없음
→ Queue 장애 시에도 직접 접속자는 정상 이용
```

**아키텍처:**
```
┌─────────────────────────────────────────────────────┐
│              Queue Service Architecture              │
│                                                      │
│  ┌──────────────┐      ┌──────────────┐            │
│  │  API Server  │      │  WebSocket   │            │
│  │  (Express)   │◄────►│  Server      │            │
│  │              │      │  (Socket.IO) │            │
│  └──────────────┘      └──────────────┘            │
│         │                      │                    │
│         └──────────┬───────────┘                    │
│                    ↓                                │
│         ┌──────────────────────┐                    │
│         │   Queue Manager      │                    │
│         │   (Business Logic)   │                    │
│         └──────────────────────┘                    │
│                    ↓                                │
│         ┌──────────────────────┐                    │
│         │   Redis Cluster      │                    │
│         │   - Sorted Sets      │                    │
│         │   - Active Users     │                    │
│         │   - Session Data     │                    │
│         └──────────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

**Redis 데이터 구조:**
```javascript
// 1. 대기열 (Sorted Set - FIFO 순서 보장)
ZADD queue:event:{eventId} {timestamp} {userId}
// 예: ZADD queue:event:123 1701504000 user-abc
//     Score = 진입 시간 (timestamp), Member = userId

// 2. 활성 사용자 (Set)
SADD active:event:{eventId} {userId}
EXPIRE active:event:{eventId} 3600  // 1시간 TTL

// 3. 사용자 세션 (Hash)
HSET session:{userId} eventId {eventId} joinedAt {timestamp}
EXPIRE session:{userId} 7200  // 2시간 TTL

// 4. 이벤트 설정 (Hash)
HSET event:config:{eventId} threshold 1000 processingRate 50
```

**대기열 처리 로직:**
```javascript
class QueueManager {
  // 1. 대기열 진입 체크
  async checkQueueEntry(userId, eventId) {
    const activeCount = await redis.scard(`active:event:${eventId}`);
    const threshold = await this.getThreshold(eventId);

    // 임계값 미만이면 즉시 진입
    if (activeCount < threshold) {
      await redis.sadd(`active:event:${eventId}`, userId);
      return { allowed: true, position: 0 };
    }

    // 대기열 추가
    const timestamp = Date.now();
    await redis.zadd(`queue:event:${eventId}`, timestamp, userId);

    // 순번 조회 (0-based index)
    const position = await redis.zrank(`queue:event:${eventId}`, userId);
    const queueLength = await redis.zcard(`queue:event:${eventId}`);

    return {
      allowed: false,
      position: position + 1,  // 1-based
      estimatedWaitTime: this.calculateWaitTime(position)
    };
  }

  // 2. 자동 진입 처리 (1초마다 실행)
  async processQueue(eventId) {
    const activeCount = await redis.scard(`active:event:${eventId}`);
    const threshold = await this.getThreshold(eventId);
    const available = threshold - activeCount;

    if (available <= 0) return;

    // FIFO로 사용자 꺼내기
    const users = await redis.zpopmin(`queue:event:${eventId}`, available);

    for (const [userId, score] of users) {
      // 활성 사용자로 이동
      await redis.sadd(`active:event:${eventId}`, userId);

      // WebSocket으로 진입 알림
      io.to(userId).emit('queue-entry-allowed', { eventId });
    }
  }

  // 3. 대기 시간 계산
  calculateWaitTime(position) {
    const processingRate = 50;  // 초당 50명 처리
    return Math.ceil(position / processingRate);  // 초 단위
  }
}

// Background Job: 1초마다 모든 이벤트 큐 처리
setInterval(async () => {
  const eventIds = await redis.keys('queue:event:*');
  for (const key of eventIds) {
    const eventId = key.split(':')[2];
    await queueManager.processQueue(eventId);
  }
}, 1000);
```

**확장 전략:**
```yaml
# HPA 설정
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: queue-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: queue-service
  minReplicas: 10
  maxReplicas: 100
  metrics:
  # CPU 기반
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  # 메모리 기반
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  # 커스텀 메트릭: 대기열 길이
  - type: Pods
    pods:
      metric:
        name: queue_length
      target:
        type: AverageValue
        averageValue: "1000"  # Pod당 1000명 처리
  # 커스텀 메트릭: WebSocket 연결 수
  - type: Pods
    pods:
      metric:
        name: websocket_connections
      target:
        type: AverageValue
        averageValue: "5000"  # Pod당 5000 연결
```

**Prometheus 메트릭 수집:**
```javascript
const client = require('prom-client');

const queueLengthGauge = new client.Gauge({
  name: 'queue_length',
  help: 'Current queue length per event',
  labelNames: ['event_id']
});

const websocketConnectionsGauge = new client.Gauge({
  name: 'websocket_connections',
  help: 'Active WebSocket connections'
});

// 메트릭 업데이트 (10초마다)
setInterval(async () => {
  const events = await redis.keys('queue:event:*');
  for (const key of events) {
    const eventId = key.split(':')[2];
    const length = await redis.zcard(key);
    queueLengthGauge.set({ event_id: eventId }, length);
  }

  const wsConnections = io.engine.clientsCount;
  websocketConnectionsGauge.set(wsConnections);
}, 10000);
```

---

### 4.4 Ticket Service (티켓 예약) ⭐ 핵심

**책임:**
```
✅ 좌석/티켓 조회
✅ 좌석 임시 예약 (5분 잠금)
✅ 좌석 확정 (결제 완료 시)
✅ 재고 관리 (동시성 제어)
✅ 좌석 배치도 생성
✅ 실시간 좌석 상태 동기화 (WebSocket)
```

**왜 독립 서비스로 분리하는가?**
```
핵심 비즈니스 로직:
- 티켓 overselling 방지 (재고 관리의 핵심)
- 동시성 제어 (Distributed Lock 필수)
- 높은 트랜잭션 부하

독립 분리 이점:
- Database Connection Pool 독립 할당
- Distributed Lock 전용 Redis
- 장애 격리 (결제 실패해도 좌석 조회는 가능)
```

**아키텍처:**
```
┌─────────────────────────────────────────────────────┐
│           Ticket Service Architecture                │
│                                                      │
│  ┌──────────────┐      ┌──────────────┐            │
│  │  API Server  │      │  WebSocket   │            │
│  │  (Fastify)   │◄────►│  Server      │            │
│  │  성능 최적화  │      │  (Socket.IO) │            │
│  └──────────────┘      └──────────────┘            │
│         │                      │                    │
│         └──────────┬───────────┘                    │
│                    ↓                                │
│         ┌──────────────────────┐                    │
│         │ Reservation Manager  │                    │
│         │ - Lock Acquisition   │                    │
│         │ - Inventory Update   │                    │
│         └──────────────────────┘                    │
│                    ↓                                │
│    ┌───────────────┴───────────────┐               │
│    ↓                               ↓               │
│ ┌──────────┐               ┌──────────┐            │
│ │ Ticket DB│               │ Lock     │            │
│ │ (RDS)    │               │ Redis    │            │
│ └──────────┘               └──────────┘            │
└─────────────────────────────────────────────────────┘
```

**데이터베이스 스키마:**
```sql
-- ticket_db (독립 RDS 인스턴스)
CREATE TABLE seats (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL,
  section VARCHAR(50) NOT NULL,
  row_number INTEGER NOT NULL,
  seat_number INTEGER NOT NULL,
  seat_label VARCHAR(20) NOT NULL,  -- 'VIP-1-5'
  price DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'available',  -- available, locked, reserved
  locked_at TIMESTAMP,  -- 임시 예약 시간
  locked_by UUID,       -- 예약한 사용자 ID
  reservation_id UUID,  -- 확정 예약 ID
  created_at TIMESTAMP DEFAULT NOW()
);

-- 복합 유니크 제약 (같은 좌석 중복 방지)
CREATE UNIQUE INDEX idx_seats_unique ON seats(event_id, section, row_number, seat_number);

-- 성능 최적화 인덱스
CREATE INDEX idx_seats_event_status ON seats(event_id, status);
CREATE INDEX idx_seats_locked_at ON seats(locked_at) WHERE status = 'locked';
```

**좌석 예약 로직 (Distributed Lock):**
```javascript
class ReservationManager {
  async reserveSeat(userId, eventId, seatIds) {
    const lockKeys = seatIds.map(id => `lock:seat:${id}`);
    const lockValues = [];

    try {
      // 1. 분산 락 획득 (Redlock 알고리즘)
      for (const lockKey of lockKeys) {
        const lockValue = uuidv4();
        const acquired = await this.acquireLock(lockKey, lockValue, 10000);

        if (!acquired) {
          throw new Error('SEAT_ALREADY_LOCKED');
        }
        lockValues.push({ key: lockKey, value: lockValue });
      }

      // 2. DB 트랜잭션 시작
      const client = await pool.connect();
      await client.query('BEGIN');

      try {
        // 3. 좌석 상태 확인 (FOR UPDATE로 행 잠금)
        const result = await client.query(`
          SELECT id, status FROM seats
          WHERE id = ANY($1) AND event_id = $2
          FOR UPDATE
        `, [seatIds, eventId]);

        // 4. 이미 예약된 좌석 체크
        const unavailable = result.rows.filter(s => s.status !== 'available');
        if (unavailable.length > 0) {
          throw new Error('SEAT_NOT_AVAILABLE');
        }

        // 5. 좌석 상태 업데이트 (locked)
        await client.query(`
          UPDATE seats
          SET status = 'locked',
              locked_at = NOW(),
              locked_by = $1
          WHERE id = ANY($2)
        `, [userId, seatIds]);

        // 6. 임시 예약 생성
        const reservationId = uuidv4();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);  // 5분

        await client.query(`
          INSERT INTO temp_reservations (id, user_id, event_id, seat_ids, expires_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [reservationId, userId, eventId, seatIds, expiresAt]);

        // 7. 커밋
        await client.query('COMMIT');

        // 8. WebSocket으로 다른 사용자에게 알림
        io.to(`event:${eventId}:seats`).emit('seat-locked', {
          seatIds,
          userId
        });

        return { reservationId, expiresAt };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } finally {
      // 9. 분산 락 해제
      for (const { key, value } of lockValues) {
        await this.releaseLock(key, value);
      }
    }
  }

  // Redlock 알고리즘 (단순화 버전)
  async acquireLock(key, value, ttl) {
    const result = await redis.set(key, value, 'PX', ttl, 'NX');
    return result === 'OK';
  }

  async releaseLock(key, value) {
    // Lua 스크립트로 원자적 삭제 (자신이 건 락만 해제)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(script, 1, key, value);
  }
}
```

**만료된 예약 자동 정리 (Kubernetes CronJob):**
```javascript
// jobs/cleanup-expired-reservations.js
async function cleanupExpiredReservations() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 만료된 임시 예약 조회
    const result = await client.query(`
      SELECT id, seat_ids FROM temp_reservations
      WHERE expires_at < NOW() AND status = 'pending'
    `);

    for (const row of result.rows) {
      // 2. 좌석 상태 복원
      await client.query(`
        UPDATE seats
        SET status = 'available',
            locked_at = NULL,
            locked_by = NULL
        WHERE id = ANY($1)
      `, [row.seat_ids]);

      // 3. 임시 예약 만료 처리
      await client.query(`
        UPDATE temp_reservations
        SET status = 'expired'
        WHERE id = $1
      `, [row.id]);

      // 4. WebSocket으로 좌석 해제 알림
      io.to(`event:${row.event_id}:seats`).emit('seat-released', {
        seatIds: row.seat_ids
      });
    }

    await client.query('COMMIT');
    console.log(`Cleaned up ${result.rows.length} expired reservations`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cleanup failed:', error);
  } finally {
    client.release();
  }
}

// 30초마다 실행
setInterval(cleanupExpiredReservations, 30000);
```

---

### 4.5 Order Service (주문 관리)

**책임:**
```
✅ 주문 생성 (결제 전 임시 주문)
✅ 주문 확정 (결제 완료 후)
✅ 주문 조회 (사용자별)
✅ 주문 취소/환불
✅ 주문 이력 관리
```

**API 엔드포인트:**
```javascript
POST   /api/orders                    // 주문 생성
GET    /api/orders/my                 // 내 주문 목록
GET    /api/orders/:id                // 주문 상세
POST   /api/orders/:id/cancel         // 주문 취소
PUT    /api/orders/:id/confirm        // 주문 확정 (내부 API)
```

**데이터베이스 스키마:**
```sql
-- order_db (독립 RDS 인스턴스)
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,  -- 'ORD-20241202-123456'
  user_id UUID NOT NULL,
  event_id UUID NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, confirmed, cancelled, refunded
  payment_status VARCHAR(20) DEFAULT 'pending',
  temp_reservation_id UUID,  -- Ticket Service의 임시 예약 ID
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  seat_id UUID NOT NULL,
  seat_label VARCHAR(20) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

**Saga 패턴으로 분산 트랜잭션 처리:**
```javascript
// 주문 생성 플로우 (Orchestration 방식)
class OrderSaga {
  async createOrder(userId, eventId, seatIds) {
    const sagaId = uuidv4();
    const compensations = [];  // 보상 트랜잭션 스택

    try {
      // Step 1: Ticket Service에서 좌석 임시 예약
      const reservation = await ticketServiceClient.reserveSeats({
        userId,
        eventId,
        seatIds
      });
      compensations.push(() => ticketServiceClient.releaseSeats(reservation.id));

      // Step 2: Order 생성
      const order = await this.createOrderRecord({
        userId,
        eventId,
        seatIds,
        tempReservationId: reservation.id,
        totalAmount: reservation.totalPrice
      });
      compensations.push(() => this.cancelOrder(order.id));

      // Step 3: Kafka 이벤트 발행
      await kafka.publish('order.created', {
        orderId: order.id,
        userId,
        eventId,
        amount: order.totalAmount
      });

      return order;

    } catch (error) {
      // 보상 트랜잭션 실행 (역순)
      console.error(`Saga ${sagaId} failed, executing compensations`);
      for (const compensate of compensations.reverse()) {
        try {
          await compensate();
        } catch (compError) {
          console.error('Compensation failed:', compError);
          // Dead Letter Queue로 전송
          await dlq.send({ sagaId, error: compError });
        }
      }
      throw error;
    }
  }
}
```

---

### 4.6 Payment Service (결제 처리)

**책임:**
```
✅ 결제 처리 (PG 연동)
✅ 결제 결과 검증
✅ 환불 처리
✅ 결제 이력 저장
✅ PG 웹훅 처리
```

**PG 연동 (실제 티켓팅 사이트 방식):**
```javascript
// 결제 플로우 (Naver Pay, Kakao Pay, 신용카드)
class PaymentService {
  async initiatePayment(orderId, amount, method) {
    const order = await orderServiceClient.getOrder(orderId);

    // 1. PG사에 결제 요청
    const pgResponse = await this.callPG(method, {
      merchantId: process.env.PG_MERCHANT_ID,
      orderId: order.orderNumber,
      amount: amount,
      productName: `이벤트 티켓 - ${order.eventId}`,
      returnUrl: `${process.env.FRONTEND_URL}/payment/callback`,
      cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel`
    });

    // 2. 결제 세션 저장
    await redis.setex(
      `payment:session:${pgResponse.sessionId}`,
      1800,  // 30분
      JSON.stringify({ orderId, amount, method })
    );

    return {
      paymentUrl: pgResponse.redirectUrl,
      sessionId: pgResponse.sessionId
    };
  }

  // 3. PG Callback 처리
  async handleCallback(sessionId, pgResult) {
    const session = await redis.get(`payment:session:${sessionId}`);
    const { orderId, amount } = JSON.parse(session);

    // 결제 금액 검증 (변조 방지)
    if (pgResult.amount !== amount) {
      throw new Error('AMOUNT_MISMATCH');
    }

    // PG사 결과 재확인 (위변조 방지)
    const verified = await this.verifyPayment(pgResult.transactionId);

    if (verified.status === 'SUCCESS') {
      // Kafka 이벤트 발행
      await kafka.publish('payment.completed', {
        orderId,
        transactionId: pgResult.transactionId,
        amount,
        method: pgResult.method
      });

      return { success: true };
    }
  }
}
```

**환불 처리:**
```javascript
async refundPayment(orderId, reason) {
  const payment = await this.getPaymentByOrderId(orderId);

  // PG사에 환불 요청
  const refundResult = await this.callPGRefund({
    transactionId: payment.transactionId,
    amount: payment.amount,
    reason
  });

  // 환불 이벤트 발행
  await kafka.publish('payment.refunded', {
    orderId,
    amount: payment.amount,
    reason
  });
}
```

---

## 5. 서비스 간 통신 전략

### 5.1 동기 통신 (REST API)

**사용 케이스:**
- User Service ← Auth 정보 조회 (다른 서비스에서)
- Event Service ← 이벤트 상세 정보 (Order Service에서)
- Ticket Service ← 좌석 가용성 체크 (실시간 필요)

**Circuit Breaker 패턴:**
```javascript
const CircuitBreaker = require('opossum');

const options = {
  timeout: 3000,  // 3초 타임아웃
  errorThresholdPercentage: 50,  // 50% 실패 시 차단
  resetTimeout: 30000  // 30초 후 재시도
};

const breaker = new CircuitBreaker(ticketServiceClient.getAvailability, options);

breaker.fallback(() => ({
  available: false,
  message: 'Ticket service temporarily unavailable'
}));

breaker.on('open', () => {
  console.error('Circuit breaker opened - too many failures');
  metrics.increment('circuit_breaker.open');
});
```

### 5.2 비동기 통신 (Event-Driven)

**사용 케이스:**
- 주문 생성 → 결제 처리 → 티켓 확정 → 알림 발송
- 이벤트 취소 → 모든 주문 환불 → 사용자 알림

**Kafka Topics:**
```yaml
Topics:
  # Order 도메인
  - order.created
  - order.confirmed
  - order.cancelled

  # Payment 도메인
  - payment.initiated
  - payment.completed
  - payment.failed
  - payment.refunded

  # Ticket 도메인
  - ticket.reserved
  - ticket.released
  - ticket.confirmed

  # Event 도메인
  - event.created
  - event.cancelled

  # Notification 도메인
  - notification.email.send
  - notification.sms.send
```

**Consumer 예시:**
```javascript
// Notification Service에서 구독
kafka.subscribe(['payment.completed', 'order.cancelled']);

kafka.on('payment.completed', async (message) => {
  const { orderId, userId } = message.value;

  // 주문 정보 조회
  const order = await orderServiceClient.getOrder(orderId);

  // 이메일 발송
  await emailService.send({
    to: order.userEmail,
    template: 'payment-confirmation',
    data: { order }
  });
});
```

---

## 6. 데이터베이스 분리 전략

### 6.1 Database per Service 패턴

```
현재 (Monolith):
┌─────────────────────────────────────┐
│      PostgreSQL (단일 DB)           │
│  - users                            │
│  - events                           │
│  - tickets                          │
│  - seats                            │
│  - reservations                     │
│  - payments                         │
└─────────────────────────────────────┘

목표 (MSA):
┌──────────┐ ┌──────────┐ ┌──────────┐
│ User DB  │ │ Event DB │ │ Ticket DB│
│ - users  │ │ - events │ │ - seats  │
└──────────┘ └──────────┘ └──────────┘

┌──────────┐ ┌──────────┐
│ Order DB │ │ Pay DB   │
│ - orders │ │ -payments│
└──────────┘ └──────────┘
```

### 6.2 데이터 일관성 문제 해결

**Saga 패턴 + Eventual Consistency:**
```javascript
// 시나리오: 주문 생성 후 결제 실패 시
// 1. Order Service: 주문 생성 (성공)
// 2. Payment Service: 결제 시도 (실패)
// 3. Order Service: 주문 취소 (보상 트랜잭션)
// 4. Ticket Service: 좌석 해제 (이벤트 기반)

// Kafka로 이벤트 체인 구성
payment.failed → order.cancel.requested → ticket.release.requested
```

**CQRS (Command Query Responsibility Segregation):**
```
Write (Command):
- Order Service → order_db에 직접 쓰기

Read (Query):
- Analytics Service → 별도 Read Model
- Event Sourcing으로 모든 이벤트 저장
- Materialized View로 조회 최적화
```

---

## 다음 단계

서비스 분리 전략을 이해했으니, 이제 AWS 인프라 설계로 넘어갑니다.

👉 **[Part 3: AWS 아키텍처 설계로 이동](./msa-migration-guide-03-aws-architecture.md)**
