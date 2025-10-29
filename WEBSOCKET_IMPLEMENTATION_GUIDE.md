# WebSocket 구현 가이드

## 완료된 작업 ✅

### 1. 백엔드 (Backend)

#### 설치된 패키지
- `socket.io`: WebSocket 서버
- `@socket.io/redis-adapter`: AWS 멀티 인스턴스 동기화 (Redis Pub/Sub)

#### 생성/수정된 파일
```
backend/
├── package.json                         # socket.io 패키지 추가 ✅
├── src/
│   ├── server.js                       # HTTP 서버 + Socket.IO 통합 ✅
│   ├── config/
│   │   └── socket.js                   # Socket.IO 초기화 (Redis Adapter 포함) ✅
│   ├── services/
│   │   └── queue-manager.js            # 대기열 관리 시스템 ✅
│   └── routes/
│       ├── queue.js                    # 대기열 API ✅
│       └── reservations.js             # 실시간 티켓 재고 브로드캐스트 추가 ✅
```

#### 구현된 기능
1. **Socket.IO 서버 설정**
   - Redis Adapter로 AWS 멀티 인스턴스 대비
   - 자동 재연결, 핑/퐁 설정
   - CORS 설정

2. **대기열 시스템**
   - Redis Sorted Set 기반 FIFO 대기열
   - 동시 접속자 임계값 관리
   - 자동 입장 처리 (1초마다)
   - 대기열 순번/예상 대기시간 계산

3. **실시간 티켓 재고 업데이트**
   - 예매 완료 시 자동 브로드캐스트
   - 예매 취소 시 자동 브로드캐스트
   - 해당 이벤트를 보는 모든 사용자에게 즉시 반영

### 2. 프론트엔드 (Frontend)

#### 설치된 패키지
- `socket.io-client`: Socket 클라이언트

#### 생성/수정된 파일
```
frontend/
├── package.json                         # socket.io-client 추가 ✅
├── src/
│   ├── hooks/
│   │   └── useSocket.js                # Socket 커스텀 훅 3종 ✅
│   └── pages/
│       └── EventDetail.js              # 실시간 재고 업데이트 적용 ✅
```

#### 구현된 훅
1. **useSocket**: 기본 Socket 연결 관리
2. **useTicketUpdates**: 티켓 재고 실시간 업데이트
3. **useQueueUpdates**: 대기열 실시간 업데이트
4. **useSeatUpdates**: 좌석 선택 실시간 동기화 (기본 구조만)

---

## 다음 단계: 테스트 및 실행

### Step 1: 패키지 설치

```bash
# 백엔드
cd backend
npm install

# 프론트엔드
cd ../frontend
npm install
```

### Step 2: 환경변수 설정 (선택)

`.env` 파일에 추가 (이미 있으면 넘어가도 OK):

```env
# Frontend URL (CORS)
FRONTEND_URL=http://localhost:3000

# Redis 설정 (기존 DragonflyDB 사용)
REDIS_HOST=dragonfly
REDIS_PORT=6379
```

### Step 3: Docker Compose로 실행

```bash
# 프로젝트 루트에서
docker-compose up --build
```

### Step 4: 실시간 기능 테스트

#### 테스트 1: 티켓 재고 실시간 업데이트

1. **브라우저 2개 열기**
   - Chrome: `http://localhost:3000/events/{이벤트ID}`
   - Firefox: `http://localhost:3000/events/{이벤트ID}`

2. **Chrome에서 로그인 → 티켓 구매**

3. **Firefox 화면 확인**
   - 자동으로 재고가 줄어드는지 확인 ✅
   - F12 콘솔: "✅ Ticket ... updated: X remaining" 메시지 확인

#### 테스트 2: 대기열 시스템 (API 테스트)

```bash
# 대기열 진입 확인
curl -X POST http://localhost:3001/api/queue/check/{eventId} \
  -H "Authorization: Bearer {토큰}" \
  -H "Content-Type: application/json"

# 대기열 상태 조회
curl http://localhost:3001/api/queue/status/{eventId} \
  -H "Authorization: Bearer {토큰}"
```

---

## AWS 확장 시나리오

### 현재 구조 (로컬)
```
클라이언트 → Backend (Socket.IO + Redis Adapter)
                       → DragonflyDB
                       → PostgreSQL
```

### AWS 확장 구조 (자동 지원!)
```
                    ┌─ EC2-1 (Backend + Socket.IO) ─┐
클라이언트 → ALB ───┼─ EC2-2 (Backend + Socket.IO) ─┼─→ ElastiCache Redis (Pub/Sub)
                    └─ EC2-3 (Backend + Socket.IO) ─┘   → RDS PostgreSQL
```

**추가 작업 불필요!**
- Redis Adapter가 이미 설정되어 있음
- 여러 서버 간 WebSocket 메시지 자동 동기화
- ALB Sticky Session만 설정하면 OK

### ALB 설정 (나중에)

```bash
# Target Group에 Stickiness 활성화
aws elbv2 modify-target-group-attributes \
  --target-group-arn {ARN} \
  --attributes Key=stickiness.enabled,Value=true \
               Key=stickiness.type,Value=lb_cookie \
               Key=stickiness.lb_cookie.duration_seconds,Value=86400
```

---

## 구현 예정 기능

### 1. 대기열 UI (WaitingRoom.js)

```javascript
// frontend/src/pages/WaitingRoom.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQueueUpdates } from '../hooks/useSocket';

function WaitingRoom() {
  const { eventId } = useParams();
  const userId = localStorage.getItem('userId');
  const [queueInfo, setQueueInfo] = useState(null);

  const { isConnected } = useQueueUpdates(
    eventId,
    userId,
    (data) => {
      // 대기열 업데이트
      fetchQueueStatus();
    },
    (data) => {
      // 입장 허용
      window.location.href = `/events/${eventId}`;
    }
  );

  // 5초마다 순번 확인
  useEffect(() => {
    const interval = setInterval(fetchQueueStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchQueueStatus = async () => {
    const res = await api.get(`/api/queue/status/${eventId}`);
    setQueueInfo(res.data);
  };

  return (
    <div className="waiting-room">
      <h1>⏳ 대기열</h1>
      {queueInfo && (
        <>
          <div className="queue-position">{queueInfo.position}번째</div>
          <div className="estimated-wait">
            예상 대기시간: {Math.floor(queueInfo.estimatedWait / 60)}분
          </div>
        </>
      )}
    </div>
  );
}
```

### 2. 좌석 선택 실시간 동기화 (seats.js 수정)

```javascript
// backend/src/routes/seats.js에 추가

const { emitToSeats } = require('../config/socket');

// 좌석 선택 시
await client.query(
  `UPDATE seats SET status = $1 WHERE id = $2`,
  [SEAT_STATUS.RESERVED, seatId]
);

// 실시간 브로드캐스트
const io = req.app.locals.io;
emitToSeats(io, eventId, 'seat-selected', {
  seatId,
  userId,
  timestamp: new Date(),
});
```

---

## 트러블슈팅

### 문제: Socket 연결 안 됨

```
Access to XMLHttpRequest at 'http://localhost:3001/socket.io/...'
from origin 'http://localhost:3000' has been blocked by CORS
```

**해결책**: `backend/src/config/socket.js`에서 CORS 설정 확인

```javascript
cors: {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true,
},
```

### 문제: Redis Adapter 연결 실패

```
❌ Redis Adapter connection failed: ECONNREFUSED
⚠️  Running Socket.IO in single-instance mode
```

**원인**: DragonflyDB가 아직 시작 안 됨
**해결**: 정상 동작함 (단일 서버 모드로 fallback)

### 문제: 티켓 재고가 실시간 업데이트 안 됨

1. **F12 콘솔 확인**: "🔌 Socket connected" 메시지 있는지
2. **백엔드 로그 확인**: "🎫 Ticket updated" 메시지 있는지
3. **이벤트 ID 확인**: 올바른 이벤트에 join했는지

---

## 성능 최적화 팁

### 1. 불필요한 재연결 방지

```javascript
// 컴포넌트 언마운트 시 자동으로 disconnect됨
// useEffect cleanup 함수에서 처리
return () => {
  socket.disconnect();
};
```

### 2. 메모리 누수 방지

```javascript
// 이벤트 리스너 cleanup 필수
useEffect(() => {
  socket.on('ticket-updated', handleUpdate);

  return () => {
    socket.off('ticket-updated'); // ⭐ 중요!
  };
}, []);
```

### 3. 배치 업데이트

```javascript
// 여러 티켓 타입이 동시에 변경되면 한 번에 처리
const updatedTickets = {};

for (const item of items) {
  updatedTickets[item.ticketTypeId] = item.availableQuantity;
}

io.to(`event:${eventId}`).emit('tickets-batch-updated', updatedTickets);
```

---

## 다음 구현 우선순위

1. **대기열 UI** (1-2일)
   - WaitingRoom.js 페이지
   - 순번 표시, 프로그레스 바
   - 자동 입장 처리

2. **좌석 선택 실시간 동기화** (2-3일)
   - seats.js에 브로드캐스트 추가
   - SeatSelection.js에 실시간 업데이트 적용

3. **대기열 자동 활성화** (1일)
   - 이벤트 설정에 `queue_enabled`, `queue_threshold` 추가
   - 트래픽 모니터링 시작

4. **관리자 대시보드** (3-4일)
   - 실시간 접속자 수 표시
   - 대기열 현황 차트
   - 강제 대기열 활성화/비활성화

---

## 참고 자료

- [Socket.IO 공식 문서](https://socket.io/docs/v4/)
- [Redis Adapter 문서](https://socket.io/docs/v4/redis-adapter/)
- [AWS ALB WebSocket 가이드](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html)

---

**구현 완료 날짜**: 2025년 (구현 시작)
**AWS 배포 예정**: Phase 2 인프라 구축 시
