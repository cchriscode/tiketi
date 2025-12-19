# Tiketi Ticket Service

티켓팅 서비스 - 이벤트, 티켓, 좌석, 예매, 대기열 관리

## 빠른 시작

### 개발 환경

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일 수정 (필수: DB, Redis 연결 정보)

# 3. 개발 모드 실행
npm run dev
```

### 서비스 확인

```bash
# Health check
curl http://localhost:3002/health

# 이벤트 목록 조회
curl http://localhost:3002/api/v1/events

# 대기열 진입 확인 (인증 필요)
curl -X POST http://localhost:3002/api/v1/queue/check/{eventId} \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

## 주요 기능

- ✅ Event management (이벤트 조회, 캐싱)
- ✅ Ticket type management (티켓 타입, 재고)
- ✅ Seat selection & reservation (좌석 선택, 임시 예약)
- ✅ Reservation management (예매 생성, 조회, 취소)
- ✅ Queue system (Redis 기반 FIFO 대기열, Socket.IO 실시간 업데이트)
- ✅ Real-time updates via WebSocket (Socket.IO)
- ✅ Distributed locks for concurrent seat reservations
- ✅ Transaction-based operations
- ✅ Input validation

## API 문서

### Events (`/api/v1/events`)

#### GET /
이벤트 목록 조회

**Query Parameters**:
- `status`: [upcoming, on_sale, sold_out, ended, cancelled]
- `q`: 검색어
- `page`: 페이지 번호 (기본: 1)
- `limit`: 페이지당 항목 수 (기본: 10)

**Response** (200):
```json
{
  "events": [
    {
      "id": "uuid",
      "title": "콘서트 제목",
      "artist_name": "아티스트명",
      "venue": "장소",
      "event_date": "2025-12-25T18:00:00Z",
      "poster_image_url": "https://...",
      "status": "on_sale",
      "min_price": 50000,
      "max_price": 150000,
      "ticket_type_count": 3
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

#### GET /{id}
이벤트 상세 조회

**Response** (200):
```json
{
  "event": {
    "id": "uuid",
    "title": "콘서트 제목",
    "description": "상세 설명",
    "artist_name": "아티스트명",
    "venue": "장소",
    "address": "주소",
    "event_date": "2025-12-25T18:00:00Z",
    "sale_start_date": "2025-12-10T10:00:00Z",
    "sale_end_date": "2025-12-25T17:59:59Z",
    "status": "on_sale"
  },
  "ticketTypes": [
    {
      "id": "uuid",
      "name": "R석",
      "price": 150000,
      "available_quantity": 50,
      "total_quantity": 100
    }
  ]
}
```

### Tickets (`/api/v1/tickets`)

#### GET /event/{eventId}
이벤트 티켓 타입 조회

#### GET /availability/{ticketTypeId}
티켓 재고 확인

**Response** (200):
```json
{
  "available_quantity": 50,
  "total_quantity": 100
}
```

### Seats (`/api/v1/seats`)

#### GET /layouts
좌석 레이아웃 목록

#### GET /events/{eventId}
이벤트 좌석 정보

**Response** (200):
```json
{
  "event": {
    "id": "uuid",
    "title": "콘서트 제목"
  },
  "layout": {
    "rows": 10,
    "cols": 20
  },
  "seats": [
    {
      "id": "uuid",
      "section": "A",
      "row_number": 1,
      "seat_number": 1,
      "seat_label": "A-1",
      "price": 150000,
      "status": "available"
    }
  ]
}
```

#### POST /reserve
좌석 선택 및 임시 예약 (5분 TTL, 분산 락)

**Headers**: `Authorization: Bearer <token>`

**Body**:
```json
{
  "eventId": "uuid",
  "seatIds": ["uuid1", "uuid2"]
}
```

**Response** (201):
```json
{
  "message": "좌석이 선택되었습니다.",
  "reservation": {
    "id": "uuid",
    "reservationNumber": "TK123456789ABC",
    "totalAmount": 300000,
    "expiresAt": "2025-12-19T12:35:00Z",
    "seats": [...]
  }
}
```

### Reservations (`/api/v1/reservations`)

#### POST /
예매하기 (티켓 타입 기반)

**Headers**: `Authorization: Bearer <token>`

**Body**:
```json
{
  "eventId": "uuid",
  "items": [
    {
      "ticketTypeId": "uuid",
      "quantity": 2
    }
  ]
}
```

**Response** (201):
```json
{
  "message": "예매가 완료되었습니다.",
  "reservation": {
    "id": "uuid",
    "reservationNumber": "TK123456789ABC",
    "totalAmount": 300000
  }
}
```

#### GET /my
내 예매 목록

**Response** (200):
```json
{
  "reservations": [
    {
      "id": "uuid",
      "reservation_number": "TK...",
      "event_title": "콘서트 제목",
      "total_amount": 300000,
      "status": "pending",
      "payment_status": "pending",
      "created_at": "2025-12-19T12:00:00Z"
    }
  ]
}
```

#### GET /{id}
예매 상세 조회

#### POST /{id}/cancel
예매 취소

### Queue (`/api/v1/queue`)

#### POST /check/{eventId}
대기열 진입 확인

**Response** (200):
```json
{
  "queued": true,
  "position": 45,
  "estimatedWait": 1,
  "threshold": 1000,
  "currentUsers": 955
}
```

#### GET /status/{eventId}
대기열 상태 조회

#### POST /leave/{eventId}
대기열에서 나가기

## Socket.IO 이벤트

### Client → Server

```javascript
// 이벤트 입장
socket.emit('join-event', { eventId: 'uuid' });

// 이벤트 퇴장
socket.emit('leave-event', { eventId: 'uuid' });

// 대기열 입장
socket.emit('join-queue', { eventId: 'uuid' });

// 대기열 퇴장
socket.emit('leave-queue', { eventId: 'uuid' });

// 좌석 선택 페이지 입장
socket.emit('join-seat-selection', { eventId: 'uuid' });

// 좌석 변경 알림
socket.emit('seat-selection-changed', { eventId: 'uuid', seats: ['uuid1', 'uuid2'] });
```

### Server → Client

```javascript
// 룸 정보
socket.on('room-info', (data) => {
  console.log(data.userCount); // 현재 입장한 사용자 수
});

// 좌석 잠금 알림 (실시간)
socket.on('seat-locked', (data) => {
  console.log(data.seatId, data.status); // 다른 사용자가 좌석 선택
});

// 대기열 통과 알림
socket.on('queue-entry-allowed', (data) => {
  console.log(data.message); // 입장 허용
});

// 대기열 상태 업데이트
socket.on('queue-updated', (data) => {
  console.log(data.queueSize); // 남은 대기열 크기
});

// 티켓 재고 변경
socket.on('ticket-updated', (data) => {
  console.log(data.availableQuantity); // 남은 티켓 수
});
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | 3002 | 서비스 포트 |
| `NODE_ENV` | development | 실행 환경 |
| `DB_HOST` | postgres-service | PostgreSQL 호스트 |
| `DB_PORT` | 5432 | PostgreSQL 포트 |
| `DB_NAME` | tiketi | 데이터베이스 이름 |
| `DB_USER` | tiketi_user | 데이터베이스 사용자 |
| `DB_PASSWORD` | tiketi_pass | 데이터베이스 비밀번호 |
| `REDIS_HOST` | dragonfly-service | Redis 호스트 |
| `REDIS_PORT` | 6379 | Redis 포트 |
| `JWT_SECRET` | (변경 필수) | JWT 서명 시크릿 |
| `FRONTEND_URL` | http://localhost:3000 | 프론트엔드 URL (CORS) |
| `AUTH_SERVICE_URL` | http://auth-service:3001 | Auth Service URL |

## Docker 빌드 및 실행

```bash
# 이미지 빌드
docker build -t tiketi-ticket-service:1.0.0 .

# 컨테이너 실행
docker run -d \
  -p 3002:3002 \
  -e DB_HOST=postgres \
  -e DB_USER=tiketi_user \
  -e DB_PASSWORD=tiketi_pass \
  -e REDIS_HOST=redis \
  -e JWT_SECRET=your-secret-key \
  --name ticket-service \
  tiketi-ticket-service:1.0.0

# 로그 확인
docker logs -f ticket-service
```

## npm 스크립트

```bash
npm run dev      # 개발 모드 (nodemon)
npm start        # 프로덕션 모드
```

## 프로젝트 구조

```
src/
├── server.js              # Express 앱 + Socket.IO
├── routes/
│   ├── events.js         # 이벤트 조회
│   ├── tickets.js        # 티켓 조회
│   ├── seats.js          # 좌석 선택 & 예약
│   ├── reservations.js   # 예매 관리
│   └── queue.js          # 대기열 관리
├── services/
│   └── queue-manager.js  # 대기열 비즈니스 로직
├── middleware/
│   ├── auth.js           # JWT 검증
│   ├── error-handler.js  # 에러 처리
│   └── request-logger.js # 요청 로깅
├── config/
│   ├── database.js       # PostgreSQL 커넥션
│   ├── redis.js          # Redis 클라이언트
│   └── socket.js         # Socket.IO 설정
├── utils/
│   ├── logger.js         # Winston 로거
│   ├── custom-error.js   # 커스텀 에러 클래스
│   └── transaction-helpers.js # DB 트랜잭션 & 락 헬퍼
└── shared/
    └── constants.js      # 상수 정의
```

## 대기열 시스템

### 특징
- **Redis Sorted Set** 기반 FIFO 대기열
- **TTL 기반 자동 제거** (300초)
- **실시간 업데이트** (Socket.IO)
- **분산 환경 지원** (Redis Pub/Sub)

### 동작 흐름
1. 사용자 접속 → `/api/v1/queue/check/{eventId}` 호출
2. 동시 접속 임계값 (기본: 1000명) 확인
   - 미만: 즉시 입장 (`queued: false`)
   - 초과: 대기열 추가 (`queued: true`)
3. 입장 가능 시 Socket.IO로 `queue-entry-allowed` 이벤트 전송
4. TTL 초과 시 자동 제거

## 개발 팀 워크플로우

### Phase 1 (완료)
- Auth Service 기본 기능 구현

### Phase 2 (현재)
- Ticket Service 기본 분리 완료
- 이벤트, 티켓, 좌석, 예매, 대기열 관리
- Database 공유 (향후 분리 예정)

### Phase 3 (예정)
- Payment Service, Stats Service 분리
- 각 서비스 독립 DB 구성
- API Gateway 추가

## 문제 해결

### DB 연결 오류
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
→ PostgreSQL 서버 실행 확인, DB 연결 정보 확인

### Redis 연결 오류
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
→ Redis 서버 실행 확인, Redis 연결 정보 확인

### Socket.IO 연결 오류
```
WebSocket connection failed
```
→ CORS 설정 확인, `FRONTEND_URL` 환경변수 확인

### 좌석 예약 실패 (락 타임아웃)
```
Failed to acquire lock: seat:...
```
→ 다른 사용자가 좌석 선택 중, 잠시 후 재시도

## 마이그레이션 문서

전체 MSA 분리 과정은 [ticket-migration-step2.md](../docs/msa/ticket-migration-step2.md) 참고
