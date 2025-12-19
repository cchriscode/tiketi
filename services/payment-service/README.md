# Payment Service

Payment Service는 Tiketi 프로젝트의 MSA 아키텍처 중 결제 처리를 담당하는 마이크로서비스입니다.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (공유 데이터베이스)
- Redis/Dragonfly (선택사항, 향후 확장용)

### Installation

```bash
# 설치
npm install

# .env 파일 설정
cp .env.example .env
# .env 파일을 프로젝트 환경에 맞게 수정

# 개발 모드 실행
npm run dev

# 프로덕션 모드 실행
npm start
```

### Service Verification

```bash
# 헬스 체크
curl http://localhost:3003/health

# 결제 수단 조회 (인증 불필요)
curl http://localhost:3003/api/v1/payments/methods
```

## ✨ Features

- ✅ **결제 처리**: 예약에 대한 결제 처리 및 상태 업데이트
- ✅ **결제 수단 관리**: 사용 가능한 결제 방법 조회
- ✅ **트랜잭션 관리**: 데이터베이스 트랜잭션을 통한 원자성 보장
- ✅ **JWT 인증**: Bearer 토큰 기반 사용자 인증
- ✅ **구조화된 로깅**: Winston을 이용한 JSON 형식의 구조화된 로그
- ✅ **에러 처리**: CustomError를 통한 일관된 에러 응답
- ✅ **모의 결제**: 개발 환경에서의 모의 결제 처리

## 📖 API Documentation

### 1. 결제 처리
**Endpoint**: `POST /api/v1/payments/process`

**Authentication**: Required (Bearer Token)

**Request**:
```json
{
  "reservationId": "550e8400-e29b-41d4-a716-446655440000",
  "paymentMethod": "naver_pay"
}
```

**Response** (Success - 200):
```json
{
  "success": true,
  "message": "결제가 완료되었습니다.",
  "payment": {
    "reservationId": "550e8400-e29b-41d4-a716-446655440000",
    "reservationNumber": "RSV-20231219-0001",
    "paymentMethod": "네이버페이",
    "totalAmount": 50000,
    "paidAt": "2023-12-19T10:30:00.000Z"
  },
  "reservation": {
    "event": {
      "title": "보이밴드 콘서트",
      "venue": "올림픽 체조경기장",
      "event_date": "2023-12-25T19:00:00.000Z"
    },
    "seats": [
      {
        "id": "seat-001",
        "seat_label": "A1",
        "section": "VIP",
        "row_number": 1,
        "seat_number": 1,
        "unit_price": 50000
      }
    ]
  }
}
```

**Response** (Error - 400):
```json
{
  "error": "유효하지 않은 결제 수단입니다.",
  "statusCode": 400
}
```

**Possible Errors**:
- 404: 예약을 찾을 수 없습니다.
- 400: 예약이 만료되었습니다.
- 400: 이미 결제된 예약입니다.
- 400: 유효하지 않은 결제 수단입니다.
- 401: 인증이 필요합니다.

**Payment Methods**:
- `naver_pay`: 네이버페이
- `kakao_pay`: 카카오페이
- `bank_transfer`: 계좌이체

---

### 2. 결제 수단 조회
**Endpoint**: `GET /api/v1/payments/methods`

**Authentication**: Not required

**Response** (200):
```json
{
  "methods": [
    {
      "id": "naver_pay",
      "name": "네이버페이",
      "description": "네이버페이로 간편 결제",
      "icon": "/images/naver-pay.png"
    },
    {
      "id": "kakao_pay",
      "name": "카카오페이",
      "description": "카카오페이로 간편 결제",
      "icon": "/images/kakao-pay.png"
    },
    {
      "id": "bank_transfer",
      "name": "계좌이체",
      "description": "계좌이체로 결제",
      "icon": "/images/bank-transfer.png"
    }
  ]
}
```

---

### 3. 헬스 체크
**Endpoint**: `GET /health`

**Response** (200):
```json
{
  "status": "ok",
  "service": "payment-service"
}
```

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3003` | 서비스 포트 |
| `NODE_ENV` | `development` | 실행 환경 |
| `DB_HOST` | `localhost` | PostgreSQL 호스트 |
| `DB_PORT` | `5432` | PostgreSQL 포트 |
| `DB_NAME` | `tiketi` | 데이터베이스 이름 |
| `DB_USER` | `postgres` | 데이터베이스 사용자 |
| `DB_PASSWORD` | `password` | 데이터베이스 비밀번호 |
| `REDIS_HOST` | `localhost` | Redis 호스트 (선택사항) |
| `REDIS_PORT` | `6379` | Redis 포트 (선택사항) |
| `REDIS_PASSWORD` | `` | Redis 비밀번호 (선택사항) |
| `JWT_SECRET` | `your-secret-key-change-in-production` | JWT 서명 키 |

---

## 🐳 Docker

### Build Image
```bash
docker build -t tiketi/payment-service:latest .
```

### Run Container
```bash
docker run -d \
  --name payment-service \
  -p 3003:3003 \
  -e DB_HOST=db \
  -e DB_NAME=tiketi \
  -e JWT_SECRET=your-secret \
  tiketi/payment-service:latest
```

### With Docker Compose
```yaml
services:
  payment-service:
    build: ./services/payment-service
    ports:
      - "3003:3003"
    environment:
      DB_HOST: postgres
      DB_NAME: tiketi
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
```

---

## 📚 Project Structure

```
services/payment-service/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL 연결 풀
│   │   └── redis.js             # Redis 클라이언트 (향후 확장용)
│   ├── middleware/
│   │   ├── auth.js              # JWT 인증 미들웨어
│   │   ├── error-handler.js     # 전역 에러 핸들러
│   │   └── request-logger.js    # 요청 로깅
│   ├── routes/
│   │   └── payments.js          # 결제 라우터
│   ├── shared/
│   │   └── constants.js         # 상수 (상태, 메시지, 설정값)
│   ├── utils/
│   │   ├── logger.js            # Winston 로거
│   │   ├── custom-error.js      # 커스텀 에러 클래스
│   │   └── transaction-helpers.js # 트랜잭션 래퍼
│   └── server.js                # 메인 서버 파일
├── .env.example                 # 환경 변수 템플릿
├── .gitignore                   # Git 무시 파일
├── Dockerfile                   # 컨테이너 이미지
├── package.json                 # 의존성
└── README.md                    # 이 파일
```

---

## 🔄 결제 흐름

```
1. 사용자가 Frontend에서 "결제" 버튼 클릭
   ↓
2. Frontend가 /api/v1/payments/process 호출
   ↓
3. Payment Service가 JWT 토큰 검증
   ↓
4. 예약 정보 조회 및 상태 확인
   - 예약 존재 여부
   - 이미 결제되지 않았는지
   - 예약이 만료되지 않았는지
   ↓
5. 모의 결제 처리 (실제 연동은 향후 구현)
   ↓
6. 데이터베이스 트랜잭션 처리:
   - 예약 상태: pending → confirmed
   - 결제 상태: pending → completed
   - 좌석 상태: locked → reserved
   ↓
7. 응답 반환
   - 결제 정보
   - 예약 정보
   - 좌석 정보
```

---

## ⚙️ npm Scripts

```bash
# 개발 모드 (nodemon으로 자동 재시작)
npm run dev

# 프로덕션 모드
npm start

# 테스트 (향후 구현 예정)
npm test
```

---

## 🛠️ 기술 스택

| 기술 | 버전 | 목적 |
|------|------|------|
| Node.js | 18+ | 런타임 |
| Express | 4.18.2 | 웹 프레임워크 |
| PostgreSQL (pg) | 8.11.3 | 데이터베이스 |
| Redis | 4.6.11 | 캐시 & 분산 락 |
| JWT | 9.0.2 | 인증 |
| Winston | 3.18.3 | 로깅 |
| CORS | 2.8.5 | CORS 처리 |
| UUID | 9.0.1 | UUID 생성 |

---

## 🚨 Troubleshooting

### 1. "Cannot find module 'pg'" 에러
```bash
npm install pg
```

### 2. "Connection refused" (DB 접속 실패)
```bash
# .env 파일의 DB_HOST, DB_PORT 확인
# PostgreSQL 서버 실행 상태 확인
psql -h localhost -U postgres -d tiketi
```

### 3. "Invalid token" (JWT 인증 실패)
```bash
# .env의 JWT_SECRET이 Auth Service와 일치하는지 확인
# Authorization 헤더 포맷 확인: "Bearer {token}"
```

### 4. 포트 3003이 이미 사용 중
```bash
# 다른 포트 사용
PORT=3004 npm run dev

# 또는 현재 포트 사용 중인 프로세스 확인
lsof -i :3003
```

---

## 📝 관련 문서

- [마이그레이션 가이드](../../docs/msa/payment-migration-step3.md)
- [전체 MSA 아키텍처](../../docs/final/(최종)아키텍처기획서.md)
- [Backend 코드 분석](../../backend/README.md)

