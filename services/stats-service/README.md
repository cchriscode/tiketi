# Stats Service 📊

Stats Service는 Tiketi 프로젝트의 MSA 아키텍처 중 통계, 집계, 리포팅을 담당하는 마이크로서비스입니다.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (공유 데이터베이스)
- 관리자 권한 필요

### Installation

```bash
# 설치
npm install

# .env 파일 설정
cp .env.example .env

# 개발 모드 실행
npm run dev

# 프로덕션 모드 실행
npm start
```

### Service Verification

```bash
# 헬스 체크
curl http://localhost:3004/health

# 대시보드 통계 (JWT 토큰 필요)
curl -H "Authorization: Bearer {token}" http://localhost:3004/api/v1/stats/dashboard
```

## ✨ Features

- ✅ **대시보드 통계**: 이벤트, 예매, 매출, 일일 예매 요약
- ✅ **이벤트별 분석**: 이벤트별 예매 현황 및 매출 분석
- ✅ **시계열 통계**: 기간별 매출 현황 (일별, 주별, 월별)
- ✅ **순위 통계**: 상위 이벤트 조회 (매출 또는 예매수 기준)
- ✅ **결제 수단 분석**: 결제 방법별 분포
- ✅ **읽기 전용 쿼리**: 데이터 무결성 보장
- ✅ **관리자 전용**: 인증 및 권한 검증

## 📖 API Documentation

### 1. 대시보드 통계
**Endpoint**: `GET /api/v1/stats/dashboard`

**Authentication**: Required (Bearer Token, Admin role)

**Response** (200):
```json
{
  "stats": {
    "totalEvents": 45,
    "totalReservations": 3200,
    "totalRevenue": 156000000,
    "todayReservations": 125
  },
  "recentReservations": [
    {
      "id": "rsv-uuid",
      "reservation_number": "RSV-20231219-0001",
      "total_amount": 50000,
      "status": "confirmed",
      "user_name": "김철수",
      "user_email": "kim@example.com",
      "event_title": "보이밴드 콘서트",
      "created_at": "2023-12-19T10:30:00.000Z"
    }
  ]
}
```

---

### 2. 이벤트별 통계
**Endpoint**: `GET /api/v1/stats/events/:eventId`

**Authentication**: Required (Bearer Token, Admin role)

**Response** (200):
```json
{
  "event": {
    "id": "event-uuid",
    "title": "보이밴드 콘서트",
    "event_date": "2023-12-25T19:00:00.000Z",
    "venue": "올림픽 체조경기장"
  },
  "reservations": {
    "total": 320,
    "byStatus": {
      "confirmed": {
        "count": 300,
        "revenue": 150000000
      },
      "pending": {
        "count": 15,
        "revenue": 7500000
      },
      "cancelled": {
        "count": 5,
        "revenue": 2500000
      }
    },
    "totalRevenue": 160000000
  },
  "tickets": [
    {
      "id": "ticket-uuid",
      "name": "VIP",
      "price": 150000,
      "totalQuantity": 500,
      "availableQuantity": 180,
      "soldQuantity": 320,
      "sellPercentage": 64
    }
  ]
}
```

---

### 3. 시계열 매출 통계
**Endpoint**: `GET /api/v1/stats/revenue`

**Authentication**: Required (Bearer Token, Admin role)

**Query Parameters**:
- `granularity`: `daily`, `weekly`, `monthly` (기본: daily)
- `startDate`: YYYY-MM-DD 형식
- `endDate`: YYYY-MM-DD 형식

**Example**: 
```
GET /api/v1/stats/revenue?granularity=daily&startDate=2023-12-01&endDate=2023-12-31
```

**Response** (200):
```json
{
  "granularity": "daily",
  "startDate": "2023-12-01",
  "endDate": "2023-12-31",
  "data": [
    {
      "period": "2023-12-19",
      "reservationCount": 125,
      "totalRevenue": 6250000,
      "avgPrice": "50000",
      "uniqueUsers": 120
    },
    {
      "period": "2023-12-18",
      "reservationCount": 98,
      "totalRevenue": 4900000,
      "avgPrice": "50000",
      "uniqueUsers": 95
    }
  ]
}
```

---

### 4. 상위 이벤트 통계
**Endpoint**: `GET /api/v1/stats/top-events`

**Authentication**: Required (Bearer Token, Admin role)

**Query Parameters**:
- `metric`: `revenue` (기본) 또는 `reservations`
- `limit`: 1-100 (기본: 10)

**Example**:
```
GET /api/v1/stats/top-events?metric=revenue&limit=10
```

**Response** (200):
```json
{
  "metric": "revenue",
  "limit": 10,
  "data": [
    {
      "id": "event-uuid",
      "title": "보이밴드 콘서트",
      "eventDate": "2023-12-25T19:00:00.000Z",
      "venue": "올림픽 체조경기장",
      "totalReservations": 320,
      "totalRevenue": 160000000
    }
  ]
}
```

---

### 5. 결제 수단별 통계
**Endpoint**: `GET /api/v1/stats/payment-methods`

**Authentication**: Required (Bearer Token, Admin role)

**Response** (200):
```json
{
  "data": [
    {
      "paymentMethod": "naver_pay",
      "count": 1250,
      "totalRevenue": 62500000
    },
    {
      "paymentMethod": "kakao_pay",
      "count": 950,
      "totalRevenue": 47500000
    },
    {
      "paymentMethod": "bank_transfer",
      "count": 450,
      "totalRevenue": 22500000
    }
  ]
}
```

---

### 6. 헬스 체크
**Endpoint**: `GET /health`

**Response** (200):
```json
{
  "status": "ok",
  "service": "stats-service"
}
```

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3004` | 서비스 포트 |
| `NODE_ENV` | `development` | 실행 환경 |
| `DB_HOST` | `localhost` | PostgreSQL 호스트 |
| `DB_PORT` | `5432` | PostgreSQL 포트 |
| `DB_NAME` | `tiketi` | 데이터베이스 이름 |
| `DB_USER` | `postgres` | 데이터베이스 사용자 |
| `DB_PASSWORD` | `password` | 데이터베이스 비밀번호 |
| `JWT_SECRET` | `your-secret-key...` | JWT 서명 키 |

---

## 🐳 Docker

### Build Image
```bash
docker build -t tiketi/stats-service:latest .
```

### Run Container
```bash
docker run -d \
  --name stats-service \
  -p 3004:3004 \
  -e DB_HOST=postgres \
  -e DB_NAME=tiketi \
  -e JWT_SECRET=your-secret \
  tiketi/stats-service:latest
```

---

## 📚 Project Structure

```
services/stats-service/
├── src/
│   ├── config/
│   │   └── database.js          # PostgreSQL 연결 풀
│   ├── middleware/
│   │   ├── auth.js              # JWT 인증
│   │   ├── error-handler.js     # 에러 처리
│   │   └── request-logger.js    # 요청 로깅
│   ├── routes/
│   │   └── stats.js             # 통계 라우터
│   ├── services/
│   │   └── stats-queries.js     # 통계 쿼리 로직
│   ├── shared/
│   │   └── constants.js         # 상수
│   ├── utils/
│   │   ├── logger.js            # Winston 로거
│   │   └── custom-error.js      # 커스텀 에러 클래스
│   └── server.js                # 메인 서버
├── .env.example                 # 환경변수 템플릿
├── .gitignore
├── Dockerfile
├── package.json
└── README.md
```

---

## 🔄 데이터 흐름

```
Frontend (Admin Dashboard)
  ↓
Stats Service (port 3004)
  ├── JWT 토큰 검증 (auth middleware)
  ├── Admin 권한 확인
  ├── 통계 쿼리 실행 (stats-queries.js)
  └── 읽기 전용 SELECT 쿼리
  ↓
PostgreSQL (공유 DB - 읽기 전용)
  ↓
JSON 응답 반환
```

**주요 특징**:
- ✅ **읽기 전용**: INSERT/UPDATE/DELETE 없음
- ✅ **권한 검증**: Admin 사용자만 접근
- ✅ **캐시 미사용**: 실시간 데이터 제공
- ✅ **서비스 격리**: 다른 서비스와 독립적

---

## 🔐 보안

- JWT 토큰 기반 인증
- Admin 역할 필수 검증
- 읽기 전용 쿼리 (데이터 변조 방지)
- 모든 API 응답에 에러 처리

---

## 📈 향후 확장 포인트

### 현재 (Phase 2 Step 2)
- 기존 Backend의 통계 쿼리를 Stats Service로 이전
- 읽기 전용 조회 API

### 향후 (Phase 3+)
- **이벤트 기반 통계**: Payment/Ticket 이벤트 소비
- **집계 데이터 저장**: 통계 전용 테이블 생성
- **배치 처리**: 정기적인 통계 집계
- **실시간 대시보드**: WebSocket 또는 Server-Sent Events
- **데이터 웨어하우스**: 별도의 분석 DB

---

## ⚙️ npm Scripts

```bash
# 개발 모드 (nodemon으로 자동 재시작)
npm run dev

# 프로덕션 모드
npm start

# 테스트 (향후 구현)
npm test
```

---

## 🛠️ 기술 스택

| 기술 | 버전 | 목적 |
|------|------|------|
| Node.js | 18+ | 런타임 |
| Express | 4.18.2 | 웹 프레임워크 |
| PostgreSQL (pg) | 8.11.3 | 데이터베이스 |
| JWT | 9.0.2 | 인증 |
| Winston | 3.18.3 | 로깅 |
| CORS | 2.8.5 | CORS 처리 |

---

## 🚨 Troubleshooting

### 1. 포트 3004가 이미 사용 중
```bash
# 다른 포트 사용
PORT=3005 npm run dev

# 또는 현재 포트 사용 중인 프로세스 확인
lsof -i :3004
```

### 2. "Connection refused" (DB 접속 실패)
```bash
# .env 파일의 DB_HOST, DB_PORT 확인
# PostgreSQL 서버 실행 상태 확인
psql -h localhost -U postgres -d tiketi
```

### 3. "unauthorized" 또는 "permission denied"
- JWT 토큰이 유효한지 확인
- 사용자의 role이 'admin'인지 확인
- JWT_SECRET이 Auth Service와 일치하는지 확인

---
