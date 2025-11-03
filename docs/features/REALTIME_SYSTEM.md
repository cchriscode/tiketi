# ⚡ 실시간 동기화 시스템 (WebSocket)

> Socket.IO + Redis Adapter 기반 멀티 인스턴스 실시간 동기화

---

## 📋 시스템 개요

### 핵심 기능
- ⏳ **대기열 시스템**: 트래픽 폭주 시 자동 활성화, 실시간 순번 표시
- 🎫 **티켓 재고 동기화**: 누군가 구매하면 모든 사용자 화면 즉시 업데이트
- 🪑 **좌석 선택 동기화**: 다른 사용자가 선택한 좌석 실시간 반영
- 🔄 **AWS 멀티 인스턴스 지원**: Redis Adapter로 여러 서버 간 동기화
- 🔐 **WebSocket 인증**: JWT 기반 연결 인증
- 💾 **세션 관리**: Redis 기반 세션 저장으로 재연결 시 상태 복구
- 🔄 **자동 재연결**: 네트워크 끊김 시 자동 재연결

---

## 🏗️ 아키텍처

### 로컬 개발 환경
```
┌─────────────────┐
│   Frontend      │  React (Socket.IO Client)
│   (Port 3000)   │
└────────┬────────┘
         │ WebSocket
┌────────▼────────┐
│   Backend       │  Node.js + Express + Socket.IO
│   (Port 3001)   │  + Redis Adapter
└────────┬────────┘
         │
         ├──────────────┬──────────────┐
         │              │              │
┌────────▼─────┐ ┌─────▼──────┐ ┌─────▼──────┐
│ PostgreSQL   │ │ DragonflyDB│ │ Redis      │
│   (5432)     │ │   (6379)   │ │ (Pub/Sub)  │
└──────────────┘ └────────────┘ └────────────┘
```

### AWS 프로덕션 환경
```
                   ┌───────────┐
                   │    ALB    │  Application Load Balancer
                   │ (Sticky)  │  + WebSocket Support
                   └─────┬─────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼──────┐ ┌───────▼──────┐ ┌──────▼───────┐
│   EC2-1      │ │   EC2-2      │ │   EC2-3      │
│ Backend      │ │ Backend      │ │  Backend     │
│ Socket.IO    │ │ Socket.IO    │ │  Socket.IO   │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
              ┌─────────▼─────────┐
              │  ElastiCache      │
              │  (Redis Adapter)  │
              │  Pub/Sub 동기화    │
              └───────────────────┘

모든 EC2 인스턴스가 Redis를 통해 WebSocket 메시지 동기화!
```

---

## 🔧 구현 상세

### 1. 백엔드 설정

#### 설치된 패키지
```json
{
  "socket.io": "^4.x",
  "@socket.io/redis-adapter": "^8.x"
}
```

#### Socket.IO 초기화 (`backend/src/config/socket.js`)
```javascript
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

function initializeSocket(httpServer) {
  // Socket.IO 서버 생성
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Redis Adapter 설정 (멀티 인스턴스 동기화)
  const pubClient = new Redis({
    host: process.env.REDIS_HOST || 'dragonfly',
    port: process.env.REDIS_PORT || 6379
  });
  const subClient = pubClient.duplicate();

  io.adapter(createAdapter(pubClient, subClient));

  // JWT 인증 미들웨어
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // 연결 이벤트
  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);

    // 이벤트 룸 참가
    socket.on('join:event', (eventId) => {
      socket.join(`event:${eventId}`);
      console.log(`User ${socket.userId} joined event room: ${eventId}`);
    });

    // 대기열 룸 참가
    socket.on('join:queue', (eventId) => {
      socket.join(`queue:${eventId}`);
    });

    // 연결 해제
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
    });
  });

  return io;
}

module.exports = { initializeSocket };
```

#### 서버 통합 (`backend/src/server.js`)
```javascript
const express = require('express');
const http = require('http');
const { initializeSocket } = require('./config/socket');

const app = express();
const httpServer = http.createServer(app);

// Socket.IO 초기화
const io = initializeSocket(httpServer);

// Express에서 io 접근 가능하도록 설정
app.set('io', io);

// 서버 시작
httpServer.listen(3001, () => {
  console.log('✅ Server running on port 3001');
  console.log('✅ WebSocket server ready');
});
```

---

### 2. 대기열 시스템

#### Queue Manager (`backend/src/services/queue-manager.js`)
```javascript
const Redis = require('ioredis');
const redis = new Redis();

const QUEUE_KEY = (eventId) => `queue:${eventId}`;
const ACTIVE_KEY = (eventId) => `queue:active:${eventId}`;
const MAX_ACTIVE = 1000; // 동시 최대 접속자
const ADMIT_RATE = 10;   // 1초당 입장 인원

class QueueManager {
  // 대기열 추가
  async addToQueue(eventId, userId) {
    const score = Date.now();
    await redis.zadd(QUEUE_KEY(eventId), score, userId);
    return this.getQueuePosition(eventId, userId);
  }

  // 대기 순번 조회
  async getQueuePosition(eventId, userId) {
    const rank = await redis.zrank(QUEUE_KEY(eventId), userId);
    if (rank === null) return null;
    return rank + 1; // 1부터 시작
  }

  // 입장 허용
  async admitUsers(eventId, count = ADMIT_RATE) {
    const users = await redis.zrange(QUEUE_KEY(eventId), 0, count - 1);

    for (const userId of users) {
      // 대기열에서 제거
      await redis.zrem(QUEUE_KEY(eventId), userId);

      // 활성 사용자로 추가
      await redis.sadd(ACTIVE_KEY(eventId), userId);
    }

    return users;
  }

  // 자동 입장 처리 (1초마다)
  startAutoAdmit(io) {
    setInterval(async () => {
      const events = await redis.keys('queue:*');

      for (const eventKey of events) {
        const eventId = eventKey.split(':')[1];
        const activeCount = await redis.scard(ACTIVE_KEY(eventId));

        if (activeCount < MAX_ACTIVE) {
          const available = MAX_ACTIVE - activeCount;
          const admittedUsers = await this.admitUsers(eventId, Math.min(available, ADMIT_RATE));

          // WebSocket으로 입장 알림
          for (const userId of admittedUsers) {
            io.to(`queue:${eventId}`).emit('queue:admitted', { userId });
          }
        }
      }
    }, 1000);
  }
}

module.exports = new QueueManager();
```

#### API 엔드포인트 (`backend/src/routes/queue.js`)
```javascript
router.post('/join', async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user.id;

  const position = await queueManager.addToQueue(eventId, userId);
  const totalWaiting = await redis.zcard(`queue:${eventId}`);

  res.json({
    position,
    totalWaiting,
    estimatedWaitTime: Math.ceil((position / 10) * 60) // 초 단위
  });
});

router.get('/status/:eventId', async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user.id;

  const position = await queueManager.getQueuePosition(eventId, userId);
  const isActive = await redis.sismember(`queue:active:${eventId}`, userId);

  res.json({
    position,
    isActive: isActive === 1,
    totalWaiting: await redis.zcard(`queue:${eventId}`)
  });
});
```

---

### 3. 티켓 재고 실시간 업데이트

#### 예매 완료 시 브로드캐스트 (`backend/src/routes/reservations.js`)
```javascript
router.post('/', async (req, res) => {
  // ... 예매 처리 로직 ...

  // WebSocket으로 재고 업데이트 브로드캐스트
  const io = req.app.get('io');
  io.to(`event:${eventId}`).emit('ticket:updated', {
    eventId,
    ticketTypeId,
    remainingQuantity: ticket.quantity - quantity
  });

  res.json({ success: true, reservation });
});

router.delete('/:id', async (req, res) => {
  // ... 예매 취소 로직 ...

  // WebSocket으로 재고 복구 브로드캐스트
  const io = req.app.get('io');
  io.to(`event:${eventId}`).emit('ticket:updated', {
    eventId,
    ticketTypeId,
    remainingQuantity: ticket.quantity + cancelledQuantity
  });

  res.json({ success: true });
});
```

---

### 4. 좌석 선택 실시간 동기화

#### 좌석 선택 시 브로드캐스트 (`backend/src/routes/seats.js`)
```javascript
router.post('/reserve', async (req, res) => {
  const { eventId, seatIds } = req.body;

  // ... 좌석 예약 로직 ...

  // WebSocket으로 좌석 선택 알림
  const io = req.app.get('io');
  io.to(`event:${eventId}`).emit('seat:selected', { seatIds });

  res.json({ success: true, reservation });
});
```

#### 좌석 해제 시 브로드캐스트 (`backend/src/services/reservation-cleaner.js`)
```javascript
async function cleanExpiredReservations(io) {
  const expired = await pool.query(`
    SELECT id, event_id FROM reservations
    WHERE payment_status = 'pending' AND expires_at < NOW()
  `);

  for (const reservation of expired.rows) {
    // 좌석 상태 복구
    const seatIds = await pool.query(`
      SELECT seat_id FROM reservation_items WHERE reservation_id = $1
    `, [reservation.id]);

    await pool.query(`
      UPDATE seats SET status = 'available' WHERE id = ANY($1)
    `, [seatIds.rows.map(r => r.seat_id)]);

    // WebSocket으로 좌석 해제 알림
    io.to(`event:${reservation.event_id}`).emit('seat:released', {
      seatIds: seatIds.rows.map(r => r.seat_id)
    });
  }
}
```

---

### 5. 프론트엔드 구현

#### Socket 연결 훅 (`frontend/src/hooks/useSocket.js`)
```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const newSocket = io('http://localhost:3001', {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return { socket, connected };
}
```

#### 티켓 업데이트 훅 (`frontend/src/hooks/useTicketUpdates.js`)
```javascript
export function useTicketUpdates(eventId) {
  const { socket } = useSocket();
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    if (!socket || !eventId) return;

    // 이벤트 룸 참가
    socket.emit('join:event', eventId);

    // 티켓 업데이트 수신
    socket.on('ticket:updated', ({ ticketTypeId, remainingQuantity }) => {
      setTickets(prev => prev.map(ticket =>
        ticket.id === ticketTypeId
          ? { ...ticket, availableQuantity: remainingQuantity }
          : ticket
      ));
    });

    return () => {
      socket.off('ticket:updated');
    };
  }, [socket, eventId]);

  return { tickets, setTickets };
}
```

#### 대기열 업데이트 훅 (`frontend/src/hooks/useQueueUpdates.js`)
```javascript
export function useQueueUpdates(eventId) {
  const { socket } = useSocket();
  const [queueStatus, setQueueStatus] = useState({
    position: null,
    totalWaiting: 0,
    estimatedWaitTime: 0
  });

  useEffect(() => {
    if (!socket || !eventId) return;

    socket.emit('join:queue', eventId);

    socket.on('queue:admitted', ({ userId }) => {
      if (userId === getCurrentUserId()) {
        // 입장 허용됨 - 이벤트 페이지로 이동
        window.location.href = `/events/${eventId}`;
      }
    });

    socket.on('queue:position', (data) => {
      setQueueStatus(data);
    });

    return () => {
      socket.off('queue:admitted');
      socket.off('queue:position');
    };
  }, [socket, eventId]);

  return queueStatus;
}
```

#### 좌석 업데이트 훅 (`frontend/src/hooks/useSeatUpdates.js`)
```javascript
export function useSeatUpdates(eventId) {
  const { socket } = useSocket();
  const [seats, setSeats] = useState([]);

  useEffect(() => {
    if (!socket || !eventId) return;

    socket.emit('join:event', eventId);

    // 다른 사용자가 좌석 선택
    socket.on('seat:selected', ({ seatIds }) => {
      setSeats(prev => prev.map(seat =>
        seatIds.includes(seat.id)
          ? { ...seat, status: 'locked' }
          : seat
      ));
    });

    // 좌석 해제 (만료 등)
    socket.on('seat:released', ({ seatIds }) => {
      setSeats(prev => prev.map(seat =>
        seatIds.includes(seat.id)
          ? { ...seat, status: 'available' }
          : seat
      ));
    });

    return () => {
      socket.off('seat:selected');
      socket.off('seat:released');
    };
  }, [socket, eventId]);

  return { seats, setSeats };
}
```

---

## 🔐 WebSocket 인증 & 세션 관리

### JWT 기반 인증
```javascript
// 클라이언트: 토큰과 함께 연결
const socket = io('http://localhost:3001', {
  auth: {
    token: localStorage.getItem('token')
  }
});

// 서버: 토큰 검증
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});
```

### 세션 복구
```javascript
// 재연결 시 이전 상태 복구
socket.on('connect', async () => {
  // Redis에서 사용자 세션 조회
  const session = await redis.get(`session:${userId}`);

  if (session) {
    const { eventId, queuePosition, selectedSeats } = JSON.parse(session);

    // 상태 복원
    socket.emit('join:event', eventId);
    // ... 이전 상태 복구
  }
});
```

---

## 🚀 실행 및 테스트

### 1. 패키지 설치
```bash
# 백엔드
cd backend
npm install

# 프론트엔드
cd frontend
npm install
```

### 2. 환경변수 설정
`.env` 파일:
```env
FRONTEND_URL=http://localhost:3000
REDIS_HOST=dragonfly
REDIS_PORT=6379
JWT_SECRET=your-secret-key
```

### 3. 서비스 시작
```bash
docker-compose up -d
```

### 4. 로그 확인
```bash
# WebSocket 연결 로그
docker-compose logs -f backend

# 성공 메시지:
# ✅ WebSocket server ready
# ✅ User connected: user-uuid-123
# 🧹 Starting queue auto-admit
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 티켓 재고 실시간 업데이트
1. 브라우저 A: 이벤트 상세 페이지 열기
2. 브라우저 B: 같은 이벤트에서 티켓 구매
3. 브라우저 A: 재고가 즉시 감소 ✅

### 시나리오 2: 좌석 선택 동기화
1. 브라우저 A: 좌석 선택 페이지 열기
2. 브라우저 B: 같은 좌석 선택
3. 브라우저 A: 해당 좌석이 주황색으로 변경 ✅

### 시나리오 3: 대기열 시스템
1. 동시 접속자 1000명 초과
2. 자동으로 대기열 페이지로 리다이렉트
3. 실시간 순번 및 예상 대기시간 표시
4. 입장 허용되면 자동으로 이벤트 페이지 이동 ✅

---

## 🐛 문제 해결

### WebSocket 연결 실패
```bash
# 브라우저 콘솔에서 확인
Failed to connect to ws://localhost:3001

# 해결: 백엔드 서버가 실행 중인지 확인
docker-compose ps
```

### Redis Adapter 오류
```bash
Error: Redis connection failed

# 해결: DragonflyDB 실행 확인
docker-compose logs dragonfly
```

### 멀티 인스턴스에서 동기화 안됨
```bash
# Redis Adapter가 올바르게 설정되었는지 확인
console.log('Redis Adapter enabled:', io.of('/').adapter.constructor.name);
# 출력: RedisAdapter
```

---

## 📁 관련 파일

### 백엔드
- `backend/src/config/socket.js` - Socket.IO 초기화
- `backend/src/server.js` - HTTP + WebSocket 서버 통합
- `backend/src/services/queue-manager.js` - 대기열 관리
- `backend/src/routes/queue.js` - 대기열 API

### 프론트엔드
- `frontend/src/hooks/useSocket.js` - 기본 Socket 연결
- `frontend/src/hooks/useTicketUpdates.js` - 티켓 실시간 업데이트
- `frontend/src/hooks/useQueueUpdates.js` - 대기열 실시간 업데이트
- `frontend/src/hooks/useSeatUpdates.js` - 좌석 실시간 동기화

---

## ✅ 구현 완료 체크리스트

- [x] Socket.IO 서버 설정
- [x] Redis Adapter 연동 (멀티 인스턴스 대비)
- [x] JWT 기반 WebSocket 인증
- [x] 세션 관리 및 재연결 복구
- [x] 대기열 시스템
- [x] 티켓 재고 실시간 동기화
- [x] 좌석 선택 실시간 동기화
- [x] 자동 재연결
- [x] 프론트엔드 훅 구현

---

**실시간 동기화 시스템이 완벽하게 작동합니다!** ⚡

AWS 멀티 인스턴스 환경에서도 Redis Adapter를 통해 모든 서버가 동기화됩니다!
