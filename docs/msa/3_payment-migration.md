# Payment Service MSA 분리

## 📌 개요

### 목표
모놀리식 백엔드에서 **결제 관련 최소 기능**을 추출하여 독립적인 마이크로서비스로 분리합니다.

### 범위
- ✅ 결제 처리 (POST /api/v1/payments/process)
- ✅ 결제 수단 조회 (GET /api/v1/payments/methods)
- ✅ 결제 상태 업데이트
- ✅ JWT 인증
- ✅ 트랜잭션 관리

### 제약사항
- ❌ Auth Service 코드 수정 없음
- ❌ Ticket Service 코드 수정 없음
- ❌ Stats Service 구현 (Phase 3 예정)
- ❌ 외부 결제 게이트웨이 연동 변경 없음 (향후 진행)

---

## 🔍 분석: Backend에서 추출한 코드

### 1. 결제 라우터 (`backend/src/routes/payments.js`)

**추출된 부분**:
```javascript
// POST /api/payments/process
// - 예약 조회 (FOR UPDATE)
// - 결제 상태 검증 (이미 결제됨, 만료됨)
// - 결제 처리 (모의)
// - 예약 상태 업데이트 (pending → confirmed)
// - 좌석 상태 업데이트 (locked → reserved)

// GET /api/payments/methods
// - 사용 가능한 결제 방법 목록 반환
```

**이동 대상**:
- `services/payment-service/src/routes/payments.js`

**API 경로 변경**:
- `/api/payments/*` → `/api/v1/payments/*`

---

### 2. 공유 상수 (`backend/src/shared/constants.js`)

**추출된 상수**:
```javascript
PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
}

PAYMENT_METHODS = {
  NAVER_PAY: 'naver_pay',
  KAKAO_PAY: 'kakao_pay',
  BANK_TRANSFER: 'bank_transfer',
}

PAYMENT_SETTINGS = {
  MOCK_MIN_DELAY_MS: 500,
  MOCK_MAX_DELAY_MS: 1500,
}
```

**이동 대상**:
- `services/payment-service/src/shared/constants.js`

**Backend 상수 유지**:
- ✅ Backend에서도 유지 (다른 서비스에서 참조할 수 있음)

---

### 3. 유틸리티 함수 (`backend/src/utils/transaction-helpers.js`)

**추출된 함수**:
```javascript
// withTransaction(callback)
// - BEGIN, COMMIT, ROLLBACK 자동 처리
```

**이동 대상**:
- `services/payment-service/src/utils/transaction-helpers.js`

**수정 사항**:
- Redis 락 함수 제거 (Payment Service에서는 필요 없음)

---

### 4. 인증 미들웨어 (`backend/src/middleware/auth.js`)

**추출된 함수**:
```javascript
// authenticateToken(req, res, next)
// - JWT 토큰 검증
// - 사용자 DB 조회
```

**이동 대상**:
- `services/payment-service/src/middleware/auth.js`

**주의사항**:
- JWT_SECRET이 일치해야 함 (환경변수 공유)

---

### 5. 데이터베이스 설정 (`backend/src/config/database.js`)

**추출된 설정**:
```javascript
// PostgreSQL 연결 풀
// - 호스트, 포트, 사용자, 암호 설정
// - 에러 핸들링
```

**이동 대상**:
- `services/payment-service/src/config/database.js`

**공유 데이터베이스**:
- 같은 PostgreSQL 인스턴스 사용
- 같은 `reservations`, `seats` 테이블 사용

---

## 📊 파일 생성 현황

### Payment Service 디렉토리 구조

```
services/payment-service/
├── src/
│   ├── config/
│   │   ├── database.js           ✅ 생성 (Backend 기반)
│   │   └── redis.js              ✅ 생성 (향후 확장용)
│   ├── middleware/
│   │   ├── auth.js               ✅ 생성 (Backend 기반)
│   │   ├── error-handler.js      ✅ 생성 (Backend 기반)
│   │   └── request-logger.js     ✅ 생성 (Backend 기반)
│   ├── routes/
│   │   └── payments.js           ✅ 생성 (Backend 포트)
│   ├── shared/
│   │   └── constants.js          ✅ 생성 (Backend 추출)
│   ├── utils/
│   │   ├── logger.js             ✅ 생성 (Backend 기반)
│   │   ├── custom-error.js       ✅ 생성 (Backend 기반)
│   │   └── transaction-helpers.js ✅ 생성 (Backend 기반)
│   └── server.js                 ✅ 생성 (새로 작성)
├── .env.example                  ✅ 생성
├── .gitignore                    ✅ 생성
├── Dockerfile                    ✅ 생성
├── package.json                  ✅ 생성
└── README.md                     ✅ 생성 (포괄적 문서)
```

**총 15개 파일 생성**

---

## 🔌 API 엔드포인트

### Payment Service (`port: 3003`)

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/v1/payments/process` | ✅ Required | 결제 처리 |
| GET | `/api/v1/payments/methods` | ❌ Not required | 결제 수단 조회 |
| GET | `/health` | ❌ Not required | 헬스 체크 |

### Backend (`port: 3001`) - 변경 없음

**주의**: 아직 Backend의 `/api/payments/*` 엔드포인트는 유지됩니다.
- 실제 프로덕션 전환은 이후 Phase 3에서 수행
- 현재는 Payment Service와 Backend가 **공존**

---

## 🔄 데이터 흐름

### Before (모놀리식)
```
Frontend
  ↓
Backend (port 3001)
  ├── /api/payments/process
  ├── /api/payments/methods
  └── ... (다른 서비스)
```

### After (MSA)
```
Frontend
  ↓
  ├── /api/v1/payments/* → Payment Service (port 3003)
  ├── /api/v1/tickets/*  → Ticket Service (port 3002)
  ├── /api/v1/auth/*     → Auth Service (port 3010)
  └── /api/*             → Backend (port 3001) [gradually phased out]
```

---

## 🔐 인증 통합

### JWT 토큰 처리

**현재 상황**:
1. Auth Service (port 3010)에서 토큰 발급
2. Payment Service가 같은 JWT_SECRET으로 검증
3. Backend도 같은 JWT_SECRET 사용

**환경변수 설정**:
```bash
# 모든 서비스가 같은 JWT_SECRET 사용
JWT_SECRET=your-secret-key-change-in-production
```

**향후 개선** (Phase 3):
- Auth Service를 호출하여 토큰 검증 (현재는 로컬 검증)
- OAuth2 통합

---

## 📊 데이터베이스 스키마

### 공유 테이블

**reservations**
```sql
CREATE TABLE reservations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  event_id UUID NOT NULL,
  reservation_number VARCHAR(50) UNIQUE,
  total_amount INTEGER,
  status VARCHAR(20), -- pending, confirmed, cancelled, expired
  payment_status VARCHAR(20), -- pending, completed, failed, refunded
  payment_method VARCHAR(50), -- naver_pay, kakao_pay, bank_transfer
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  ...
);
```

**seats**
```sql
CREATE TABLE seats (
  id UUID PRIMARY KEY,
  event_id UUID,
  status VARCHAR(20), -- available, reserved, locked
  ...
);
```

**reservation_items**
```sql
CREATE TABLE reservation_items (
  id UUID PRIMARY KEY,
  reservation_id UUID,
  seat_id UUID,
  ticket_type_id UUID,
  unit_price INTEGER,
  ...
);
```

**주의**:
- Payment Service는 이 테이블들을 **읽고 쓰기** 수행
- 트랜잭션 격리 (FOR UPDATE) 사용하여 동시성 제어

---

## ⚡ 주요 기술 결정사항

### 1. 공유 데이터베이스 사용
**이유**: Phase 2에서는 별도 DB 분리하지 않음  
**향후**: Phase 3에서 Payment Service 전용 DB 고려

### 2. JWT 로컬 검증
**현재**: CONFIG.JWT_SECRET으로 로컬 검증  
**향후**: Auth Service HTTP 호출로 검증

### 3. 모의 결제
**현재**: 500-1500ms 지연 시뮬레이션  
**향후**: 토스페이먼츠 실제 연동

### 4. 트랜잭션 기반 원자성
**방식**: PostgreSQL BEGIN/COMMIT/ROLLBACK  
**이점**: 동시성 제어, 데이터 무결성

---

## 🚀 배포 전략

### 로컬 테스트
```bash
# 1. Backend 실행
cd backend && npm run dev

# 2. Payment Service 실행
cd services/payment-service && npm run dev

# 3. Frontend 테스트
cd frontend && npm start
```

### Docker Compose 통합 (향후)
```yaml
services:
  payment-service:
    build: ./services/payment-service
    ports:
      - "3003:3003"
    environment:
      DB_HOST: postgres
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
```

### Kubernetes 배포 (Phase 3)
```bash
# Payment Service Deployment/Service 생성
kubectl apply -f k8s/12-payment-service.yaml

# ConfigMap/Secret 주입
kubectl apply -f k8s/02-secret.yaml
```

---

## ✅ 완료된 작업

- ✅ Backend 결제 코드 분석
- ✅ Payment Service 디렉토리 구조 생성 (15개 파일)
- ✅ 결제 처리 라우터 포팅
- ✅ 상수 및 유틸 함수 추출
- ✅ 인증 미들웨어 통합
- ✅ 데이터베이스 연결 설정
- ✅ 에러 처리 및 로깅
- ✅ 포괄적 README.md 작성

---

## 🔄 다음 단계 (Phase 2 - Step 2)

### 1. 로컬 테스트
- [ ] Payment Service 로컬 실행 테스트
- [ ] API 엔드포인트 검증 (Postman/curl)
- [ ] 트랜잭션 동작 확인

### 2. Frontend 통합
- [ ] Frontend API 호출 경로 업데이트 (`/api/` → `/api/v1/`)
- [ ] Payment 페이지 결제 버튼 테스트
- [ ] 에러 처리 검증

### 3. Stats Service 분리 (Phase 2 - Step 3)
- [ ] Backend의 통계 관련 코드 분석
- [ ] Stats Service 디렉토리 생성
- [ ] API 엔드포인트 이전

### 4. 전체 MSA 통합 (Phase 3)
- [ ] 서비스 간 통신 구현 (HTTP/gRPC)
- [ ] Auth Service 통합
- [ ] Kubernetes 배포 매니페스트 작성
- [ ] Service Mesh (Istio) 적용

---

## 📝 마이그레이션 체크리스트

### Phase 2 - Step 1 (현재)
- ✅ Payment Service 디렉토리 구조 생성
- ✅ 결제 라우터 포팅
- ✅ 유틸 함수 추출
- ✅ 문서 작성

### Phase 2 - Step 2 (예정)
- [ ] 로컬 테스트 완료
- [ ] Frontend 통합 완료
- [ ] 에러 처리 검증

### Phase 2 - Step 3 (예정)
- [ ] Stats Service 분리

### Phase 3 (예정)
- [ ] 서비스 간 통신 구현
- [ ] Kubernetes 배포
- [ ] 성능 최적화
- [ ] 모니터링 설정

---

## 🔗 관련 링크

- [Payment Service README](./services/payment-service/README.md)
- [Ticket Service 마이그레이션](./docs/msa/ticket-migration-step2.md)
- [Auth Service README](./services/auth-service/README.md)
- [최종 아키텍처 기획서](./docs/final/(최종)아키텍처기획서.md)
