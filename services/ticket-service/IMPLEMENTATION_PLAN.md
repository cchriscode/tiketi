# Ticket Service - Implementation Plan

## Overview

Ticket Service는 이벤트, 티켓, 좌석 관리 및 대기열 시스템을 담당하는 마이크로서비스입니다.

## 담당 기능

### 1. Events Management
- **이벤트 목록 조회** (검색, 필터링, 페이지네이션)
- **이벤트 상세 정보** (티켓 타입 포함)
- **Redis 캐싱** (성능 최적화)
- **검색 기능** (한글-영어 크로스 검색)

### 2. Tickets Management
- **티켓 타입 조회** (이벤트별)
- **티켓 재고 확인** (실시간)

### 3. Seats Management
- **좌석 레이아웃 조회**
- **이벤트별 좌석 정보**
- **좌석 예약** (임시 잠금, 5분 만료)
- **예약 상세 조회**
- **실시간 좌석 상태 업데이트** (WebSocket)

### 4. Queue Management
- **대기열 진입 관리** (Redis Sorted Set)
- **대기열 상태 조회**
- **자동 입장 처리** (백그라운드 프로세서)
- **관리자 기능** (대기열 조회, 초기화)

### 5. Background Services
- **Queue Processor** - 대기열 자동 처리 (1초 간격)
- **Event Status Updater** - 이벤트 상태 자동 업데이트 (스마트 타이머)
- **Seat Generator** - 좌석 자동 생성

## Database Schema

### ticket_schema Tables

#### 1. events
```sql
- id (UUID, PK)
- title (VARCHAR)
- description (TEXT)
- venue (VARCHAR)
- address (VARCHAR)
- event_date (TIMESTAMP)
- sale_start_date (TIMESTAMP)
- sale_end_date (TIMESTAMP)
- poster_image_url (TEXT)
- status (VARCHAR) - upcoming, on_sale, sold_out, ended, cancelled
- artist_name (VARCHAR)
- seat_layout_id (UUID, FK → seat_layouts)
- created_at, updated_at
```

#### 2. ticket_types
```sql
- id (UUID, PK)
- event_id (UUID, FK → events)
- name (VARCHAR)
- price (INTEGER)
- total_quantity (INTEGER)
- available_quantity (INTEGER)
- description (TEXT)
- created_at, updated_at
```

#### 3. seat_layouts
```sql
- id (UUID, PK)
- name (VARCHAR)
- description (TEXT)
- total_seats (INTEGER)
- layout_config (JSONB) - sections, rows, seatsPerRow
- created_at, updated_at
```

#### 4. seats
```sql
- id (UUID, PK)
- event_id (UUID, FK → events)
- section (VARCHAR)
- row_number (INTEGER)
- seat_number (INTEGER)
- seat_label (VARCHAR)
- price (INTEGER)
- status (VARCHAR) - available, locked, sold
- created_at, updated_at
```

#### 5. reservations
```sql
- id (UUID, PK)
- user_id (UUID, FK → auth_schema.users)
- event_id (UUID, FK → events)
- reservation_number (VARCHAR, UNIQUE)
- total_amount (INTEGER)
- status (VARCHAR) - pending, confirmed, cancelled, expired
- payment_status (VARCHAR) - pending, completed, failed, refunded
- payment_method (VARCHAR)
- expires_at (TIMESTAMP)
- created_at, updated_at
```

#### 6. reservation_items
```sql
- id (UUID, PK)
- reservation_id (UUID, FK → reservations)
- ticket_type_id (UUID, FK → ticket_types, NULLABLE)
- seat_id (UUID, FK → seats, NULLABLE)
- quantity (INTEGER)
- unit_price (INTEGER)
- subtotal (INTEGER)
- created_at
```

## API Endpoints

### Events
- `GET /events` - 이벤트 목록 조회
- `GET /events/:id` - 이벤트 상세 조회

### Tickets
- `GET /tickets/event/:eventId` - 티켓 타입 조회
- `GET /tickets/availability/:ticketTypeId` - 재고 확인

### Seats
- `GET /seats/layouts` - 좌석 레이아웃 목록
- `GET /seats/events/:eventId` - 이벤트 좌석 정보
- `POST /seats/reserve` - 좌석 예약 (인증 필요)
- `GET /seats/reservation/:reservationId` - 예약 조회 (인증 필요)

### Queue
- `POST /queue/check/:eventId` - 대기열 진입 확인 (인증 필요)
- `GET /queue/status/:eventId` - 대기열 상태 조회 (인증 필요)
- `POST /queue/leave/:eventId` - 대기열 나가기 (인증 필요)
- `GET /queue/admin/:eventId` - 대기열 정보 (관리자)
- `POST /queue/admin/clear/:eventId` - 대기열 초기화 (관리자)

## WebSocket Events

### Namespace: `/seats/:eventId`
- `seat-locked` - 좌석 잠금 (다른 사용자가 선택)
- `seat-released` - 좌석 해제 (시간 만료 또는 취소)
- `seat-sold` - 좌석 판매 완료

### Namespace: `/queue/:eventId`
- `queue-entry-allowed` - 입장 허용 알림
- `queue-updated` - 대기열 업데이트
- `queue-position` - 순번 업데이트
- `queue-cleared` - 대기열 초기화

## Redis Data Structures

### Queue Management
```
queue:{eventId}        - Sorted Set (score: timestamp, member: userId)
active:{eventId}       - Set (userId)
```

### Cache Keys
```
events:list:{status}:{page}:{limit}:{search}  - 이벤트 목록
event:{eventId}                                - 이벤트 상세
seats:{eventId}                                - 좌석 정보
```

### Distributed Locks
```
lock:seat:{eventId}:{seatId}  - 좌석 예약 락
```

## Authentication Integration

Ticket Service는 Auth Service와 연동하여 인증을 처리합니다:

1. **JWT 토큰 검증** - Auth Service의 `/auth/verify-token` 엔드포인트 호출
2. **인증 미들웨어** - 요청 헤더의 Bearer 토큰 검증
3. **사용자 정보 추출** - `req.user.userId`, `req.user.email`, `req.user.role`

## Migration Strategy

### Phase 1: DB Schema Migration
1. `ticket_schema` 생성
2. 테이블 생성 (events, ticket_types, seat_layouts, seats, reservations, reservation_items)
3. 기존 데이터 마이그레이션 (public → ticket_schema)
4. 인덱스 및 외래 키 설정

### Phase 2: Service Implementation
1. Express 서버 설정
2. Routes 구현 (events, tickets, seats, queue)
3. Services 구현 (queue-manager, seat-generator, event-status-updater)
4. WebSocket 설정 (Socket.IO with Redis adapter)

### Phase 3: Testing
1. 단위 테스트 (각 route별)
2. 통합 테스트 (실제 DB, Redis 연동)
3. WebSocket 테스트
4. 기존 모놀리식과 동작 비교

## Dependencies

### npm packages
```json
{
  "express": "^4.18.2",
  "socket.io": "^4.6.0",
  "socket.io-redis": "^6.1.1",
  "uuid": "^9.0.0",
  "@tiketi/common": "workspace:*",
  "@tiketi/metrics": "workspace:*",
  "@tiketi/database": "workspace:*"
}
```

## Backward Compatibility

### Response Format
모든 응답 형식은 기존 모놀리식 백엔드와 100% 일치해야 합니다:

- 한글 메시지 사용
- 동일한 JSON 구조
- 동일한 상태 코드
- 동일한 에러 메시지

### Example Response
```json
{
  "events": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

## Performance Considerations

1. **Redis 캐싱** - 이벤트 목록, 상세 정보
2. **DB Connection Pool** - 20개 connections
3. **Distributed Locking** - 좌석 동시성 제어
4. **WebSocket Scaling** - Redis adapter for multi-instance
5. **Pagination** - 기본 10개, 최대 100개

## Monitoring & Metrics

### Prometheus Metrics
- `event_views_total` - 이벤트 조회 수
- `seats_reserved_total` - 좌석 예약 수
- `seats_available` - 가용 좌석 수
- `queue_users` - 대기열 사용자 수
- `queue_wait_time_seconds` - 대기 시간
- `conversion_funnel_rate` - 전환율

## Next Steps

1. ✅ 기존 코드 분석 완료
2. 🔄 DB 스키마 마이그레이션 파일 생성
3. ⏳ Ticket Service 코드 구현
4. ⏳ 단위 테스트 작성
5. ⏳ 통합 테스트 실행
6. ⏳ 기존 모놀리식과 동작 비교
