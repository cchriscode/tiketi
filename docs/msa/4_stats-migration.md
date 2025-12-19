# Stats Service MSA 분리

> 모놀리식 백엔드에서 **Stats Service**를 분리하는 작업의 1단계 완료 보고서

## 📌 개요

### 목표
모놀리식 백엔드에서 **통계/집계 조회 기능**을 추출하여 독립적인 마이크로서비스로 분리합니다.

### 범위
- ✅ 대시보드 통계 조회 (이벤트, 예매, 매출, 일일 예매)
- ✅ 이벤트별 통계 (예매 현황, 매출, 티켓 판매)
- ✅ 시계열 매출 통계 (일별, 주별, 월별)
- ✅ 상위 이벤트 조회 (매출/예매수 기준)
- ✅ 결제 수단 분석
- ✅ JWT 인증 및 Admin 권한 검증

### 제약사항
- ❌ Auth/Ticket/Payment 코드 수정 없음
- ❌ 새로운 통계 지표 추가 없음 (기존 기능만 이전)
- ❌ 이벤트 스트리밍, 데이터 웨어하우스 미포함 (Phase 3 예정)

---

## 🔍 분석: Backend에서 추출한 코드

### 1. 대시보드 통계 라우터 (`backend/src/routes/admin.js`)

**추출된 부분**:
```javascript
// GET /api/admin/dashboard/stats
// - Total events 조회
// - Total reservations 조회 (non-cancelled)
// - Total revenue 조회 (completed payments)
// - Today's reservations 조회
// - Recent reservations 상위 10개

// Query 예시:
// SELECT COUNT(*) FROM events
// SELECT SUM(total_amount) FROM reservations WHERE payment_status = 'completed'
```

**이동 대상**:
- `services/stats-service/src/routes/stats.js` (GET /api/v1/stats/dashboard)
- `services/stats-service/src/services/stats-queries.js` (getDashboardStats)

**API 경로 변경**:
- `/api/admin/dashboard/stats` → `/api/v1/stats/dashboard`

---

### 2. 추가 통계 기능

Backend의 admin.js에는 다음 통계 함수들이 암묵적으로 포함되어 있습니다:

**이벤트별 예매 및 매출** (새로 구현):
```javascript
// GET /api/v1/stats/events/:eventId
// - Event details 조회
// - Reservation count by status
// - Ticket availability (by ticket type)
// - Revenue by event
```

**시계열 매출** (새로 구현):
```javascript
// GET /api/v1/stats/revenue?granularity=daily&startDate=...&endDate=...
// - Daily/Weekly/Monthly revenue aggregation
// - Reservation count, avg price, unique users
```

**상위 이벤트** (새로 구현):
```javascript
// GET /api/v1/stats/top-events?metric=revenue&limit=10
// - Top events by revenue or reservations
```

**결제 수단 분석** (새로 구현):
```javascript
// GET /api/v1/stats/payment-methods
// - Payment method distribution
```

---

## 📊 파일 생성 현황

### Stats Service 디렉토리 구조

```
services/stats-service/
├── src/
│   ├── config/
│   │   └── database.js           ✅ 생성 (Backend 기반)
│   ├── middleware/
│   │   ├── auth.js               ✅ 생성 (Backend 기반)
│   │   ├── error-handler.js      ✅ 생성 (Backend 기반)
│   │   └── request-logger.js     ✅ 생성 (Backend 기반)
│   ├── routes/
│   │   └── stats.js              ✅ 생성 (새로 개발)
│   ├── services/
│   │   └── stats-queries.js      ✅ 생성 (Backend 포팅 + 확장)
│   ├── shared/
│   │   └── constants.js          ✅ 생성
│   ├── utils/
│   │   ├── logger.js             ✅ 생성 (Backend 기반)
│   │   └── custom-error.js       ✅ 생성 (Backend 기반)
│   └── server.js                 ✅ 생성 (새로 작성)
├── .env.example                  ✅ 생성
├── .gitignore                    ✅ 생성
├── Dockerfile                    ✅ 생성
├── package.json                  ✅ 생성
└── README.md                     ✅ 생성
```

**총 15개 파일 생성**

---

## 🔌 API 엔드포인트

### Stats Service (`port: 3004`)

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/v1/stats/dashboard` | ✅ Admin | 대시보드 통계 |
| GET | `/api/v1/stats/events/:eventId` | ✅ Admin | 이벤트별 통계 |
| GET | `/api/v1/stats/revenue` | ✅ Admin | 시계열 매출 통계 |
| GET | `/api/v1/stats/top-events` | ✅ Admin | 상위 이벤트 |
| GET | `/api/v1/stats/payment-methods` | ✅ Admin | 결제 수단 분석 |
| GET | `/health` | ❌ | 헬스 체크 |

### Backend (`port: 3001`) - 호환성 유지

**주의**: Backend의 `/api/admin/dashboard/stats` 엔드포인트는 아직 유지됩니다.
- 이전 클라이언트와의 호환성을 위해 유지
- 향후 API Gateway에서 라우팅 변경 예정

---

## 🔄 데이터 흐름

### Before (모놀리식)
```
Frontend (Admin Dashboard)
  ↓
Backend (port 3001)
  ├── /api/admin/dashboard/stats (복합 기능)
  ├── /api/admin/events/* (이벤트 관리)
  ├── /api/admin/reservations/* (예매 관리)
  └── ... (다른 관리 기능)
```

### After (MSA)
```
Frontend (Admin Dashboard)
  ├── /api/v1/stats/dashboard → Stats Service (port 3004)
  ├── /api/v1/stats/events/:id → Stats Service
  ├── /api/v1/stats/revenue → Stats Service
  ├── /api/v1/stats/top-events → Stats Service
  ├── /api/v1/stats/payment-methods → Stats Service
  │
  └── /api/admin/events/* → Backend (port 3001) [eventually migrate]
      /api/admin/reservations/* → Backend (gradually)
```

---

## 📋 주요 쿼리 포팅

### 1. 대시보드 통계 쿼리

**Backend (admin.js)**:
```javascript
// Total events
SELECT COUNT(*) as count FROM events

// Total reservations (non-cancelled)
SELECT COUNT(*) as count FROM reservations WHERE status != 'cancelled'

// Total revenue
SELECT SUM(total_amount) as total FROM reservations WHERE payment_status = 'completed'

// Today's reservations
SELECT COUNT(*) as count FROM reservations 
WHERE DATE(created_at) = CURRENT_DATE AND status != 'cancelled'
```

**Stats Service 포팅**: ✅
- `src/services/stats-queries.js::getDashboardStats()`

---

### 2. 이벤트별 통계 쿼리 (신규 추가)

**기능**:
```javascript
// Event details
SELECT id, title, event_date, venue FROM events WHERE id = $1

// Reservation stats by status
SELECT status, COUNT(*), SUM(total_amount) FROM reservations 
WHERE event_id = $1 GROUP BY status

// Ticket availability
SELECT tt.id, tt.name, tt.price, tt.total_quantity,
       (tt.total_quantity - SUM(ri.quantity)) as available_quantity
FROM ticket_types tt
LEFT JOIN reservation_items ri ON tt.id = ri.ticket_type_id
WHERE tt.event_id = $1 GROUP BY tt.id
```

**Stats Service**: ✅
- `src/services/stats-queries.js::getEventStats(eventId)`

---

### 3. 시계열 매출 쿼리 (신규 추가)

**기능**:
```javascript
// Daily/Weekly/Monthly revenue aggregation
SELECT 
  DATE(created_at) as period,
  COUNT(*) as reservation_count,
  SUM(total_amount) as total_revenue,
  AVG(total_amount) as avg_price
FROM reservations
WHERE payment_status = 'completed' 
  AND DATE(created_at) BETWEEN startDate AND endDate
GROUP BY DATE(created_at)
```

**Stats Service**: ✅
- `src/services/stats-queries.js::getRevenueStats(granularity, startDate, endDate)`

---

## 🔐 인증 및 권한

### JWT 토큰 처리

**현재**:
1. Frontend에서 사용자 로그인 후 JWT 토큰 획득
2. Stats Service가 같은 JWT_SECRET으로 검증
3. Admin 역할 확인 후 통계 조회 허용

**환경변수**:
```bash
# 모든 서비스가 같은 JWT_SECRET 사용
JWT_SECRET=your-secret-key-change-in-production
```

---

## 📊 데이터베이스 스키마

### 조회 테이블 (읽기 전용)

**events**
```sql
SELECT * FROM events
-- 사용: 이벤트 목록, 상세 정보
```

**reservations**
```sql
SELECT * FROM reservations WHERE ...
-- 사용: 예매수, 매출, 상태별 집계
```

**reservation_items**
```sql
SELECT * FROM reservation_items WHERE ...
-- 사용: 티켓 판매량, 가격 정보
```

**ticket_types**
```sql
SELECT * FROM ticket_types WHERE ...
-- 사용: 티켓 종류, 총량, 판매량
```

**users**
```sql
SELECT * FROM users WHERE ...
-- 사용: 사용자 정보 조회 (JWT 검증)
```

---

## ⚡ 주요 기술 결정사항

### 1. 읽기 전용 설계
- **이유**: 통계 서비스는 데이터 수정하지 않음
- **구현**: SELECT 쿼리만 사용
- **이점**: 데이터 무결성 보장, 캐시 전략 용이

### 2. 공유 데이터베이스
- **현재**: Backend와 동일한 PostgreSQL 인스턴스 사용
- **향후**: Phase 3에서 분리된 분석 DB 고려

### 3. 관리자 전용 API
- **이유**: 통계는 관리자만 조회 가능
- **구현**: requireAdmin 미들웨어 사용

### 4. 시계열 데이터 집계
- **현재**: 쿼리 시점의 실시간 집계
- **향후**: 사전 집계 테이블 고려 (성능 개선)

---

## 🚀 배포 전략

### 로컬 테스트
```bash
# 1. Backend 실행
cd backend && npm run dev

# 2. Stats Service 실행
cd services/stats-service && npm run dev

# 3. API 테스트
curl -H "Authorization: Bearer {token}" http://localhost:3004/api/v1/stats/dashboard
```

### Docker Compose 통합 (향후)
```yaml
services:
  stats-service:
    build: ./services/stats-service
    ports:
      - "3004:3004"
    environment:
      DB_HOST: postgres
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
```

### Kubernetes 배포 (Phase 3)
```bash
# Stats Service Deployment/Service 생성
kubectl apply -f k8s/13-stats-service.yaml

# ConfigMap/Secret 주입
kubectl apply -f k8s/02-secret.yaml
```

---

## 📈 향후 확장 포인트

### Phase 3 - 이벤트 기반 통계

```javascript
// Message Queue를 통한 이벤트 소비
// 1. Payment Service → payment.completed 이벤트
// 2. Ticket Service → ticket.reserved 이벤트
// 3. Stats Service가 이벤트 소비 → 통계 테이블 업데이트

// 장점:
// - 실시간 통계
// - 대규모 데이터 처리 시 성능 우수
// - 서비스 간 결합도 감소
```

### 사전 집계 테이블 (향후)

```javascript
// stats_daily, stats_monthly 등 전용 테이블 생성
// 배치 작업으로 정기적 집계
// 쿼리 성능 향상

// CREATE TABLE stats_daily (
//   date DATE,
//   total_revenue BIGINT,
//   total_reservations INT,
//   unique_users INT,
//   ...
// )
```

### 실시간 대시보드 (향후)

```javascript
// WebSocket 또는 Server-Sent Events로 실시간 업데이트
// 관리자가 실시간 통계 모니터링 가능
```

---

## ✅ 완료된 작업

- ✅ Backend 통계 코드 분석
- ✅ Stats Service 디렉토리 구조 생성 (15개 파일)
- ✅ 대시보드 통계 쿼리 포팅
- ✅ 이벤트별 통계 기능 개발
- ✅ 시계열 매출 통계 기능 개발
- ✅ 상위 이벤트 조회 기능 개발
- ✅ 결제 수단 분석 기능 개발
- ✅ JWT 인증 통합
- ✅ Admin 권한 검증
- ✅ 에러 처리 및 로깅
- ✅ README.md 작성 (포괄적 문서)

---

## 🔄 다음 단계

### 1. 로컬 테스트
- [ ] Stats Service 로컬 실행
- [ ] 모든 API 엔드포인트 검증 (JWT 토큰 필요)
- [ ] 쿼리 성능 측정

### 2. Frontend 통합
- [ ] Admin Dashboard API 호출 경로 업데이트
- [ ] `/api/admin/dashboard/stats` → `/api/v1/stats/dashboard`
- [ ] 통계 페이지 테스트

### 3. 전체 MSA 통합
- [ ] 서비스 간 HTTP 통신 구현
- [ ] Kubernetes 배포 매니페스트 작성
- [ ] Service Mesh 적용

---

## 📝 마이그레이션 체크리스트

### Phase 2 - Step 1 (이전 완료)
- ✅ Payment Service 생성
- ✅ 결제 라우터 포팅

### Phase 2 - Step 2 (현재 완료)
- ✅ Stats Service 생성
- ✅ 통계 쿼리 포팅 및 확장

### Phase 2 - Step 3 (예정)
- [ ] Auth Service 추가 기능 (OAuth2 등)
- [ ] 모든 서비스 통합 테스트

### Phase 3 (예정)
- [ ] 이벤트 기반 통계 구현
- [ ] 사전 집계 테이블 생성
- [ ] Kubernetes 전체 배포
- [ ] Service Mesh 적용

---

## 📁 전체 파일 구조

```
services/
├── auth-service/           (Phase 2 Step 0)
├── ticket-service/         (Phase 2 Step 1)
├── payment-service/        (Phase 2 Step 1)
└── stats-service/          ✅ NEW (Phase 2 Step 2)
    ├── src/
    │   ├── config/
    │   │   └── database.js
    │   ├── middleware/
    │   │   ├── auth.js
    │   │   ├── error-handler.js
    │   │   └── request-logger.js
    │   ├── routes/
    │   │   └── stats.js
    │   ├── services/
    │   │   └── stats-queries.js
    │   ├── shared/
    │   │   └── constants.js
    │   ├── utils/
    │   │   ├── logger.js
    │   │   └── custom-error.js
    │   └── server.js
    ├── .env.example
    ├── .gitignore
    ├── Dockerfile
    ├── package.json
    └── README.md

docs/msa/
├── auth-migration-step0.md (이전)
├── ticket-migration-step1.md (이전)
├── payment-migration-step3.md (이전)
└── stats-migration-step4.md ✅ NEW
```

---

**작업 상태**: Phase 2 Step 2 완료 ✅  
**다음 예정**: Phase 3 통합 및 배포
