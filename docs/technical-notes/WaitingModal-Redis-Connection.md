# 대기열 모달과 Redis 연결 완전 가이드
> **프론트엔드 WaitingRoomModal.js ↔ 백엔드 Redis 큐 동작 흐름**

---

## 🎬 전체 흐름 한눈에 보기

```
[사용자 브라우저]                [백엔드 서버]              [Redis]
      │                              │                        │
      │ 1. 이벤트 페이지 접속          │                        │
      ├─────────────────────────────>│                        │
      │                              │ 2. 임계값 체크          │
      │                              ├──────────────────────>│
      │                              │   SCARD active:123     │
      │                              │   (현재 활성 사용자)    │
      │                              │<──────────────────────┤
      │                              │   1,500명 (초과!)      │
      │                              │                        │
      │                              │ 3. 대기열 등록          │
      │                              ├──────────────────────>│
      │                              │   ZADD queue:123       │
      │                              │   timestamp user-456   │
      │                              │<──────────────────────┤
      │                              │   OK                   │
      │                              │                        │
      │                              │ 4. 순번 조회            │
      │                              ├──────────────────────>│
      │                              │   ZRANK queue:123      │
      │                              │   user-456             │
      │                              │<──────────────────────┤
      │                              │   8244 (8,245번째)     │
      │                              │                        │
      │ 5. 대기열 정보 반환            │                        │
      │<─────────────────────────────┤                        │
      │  { queued: true,             │                        │
      │    position: 8245 }          │                        │
      │                              │                        │
      │ 6. 모달 표시 🎨               │                        │
      │  ┌────────────────────────┐  │                        │
      │  │ ⏳ 대기열 입장          │  │                        │
      │  │ 순번: 8,245 / 10,000   │  │                        │
      │  └────────────────────────┘  │                        │
      │                              │                        │
      │ 7. WebSocket 연결 유지 🔌     │                        │
      │<─────────────────────────────┤                        │
      │  (실시간 업데이트)             │                        │
      │                              │                        │
      │                              │ 8. 대기열 프로세서 동작  │
      │                              │    (1초마다)            │
      │                              ├──────────────────────>│
      │                              │   ZRANGE queue:123     │
      │                              │   0 49 (앞 50명 꺼내기)│
      │                              │<──────────────────────┤
      │                              │   [user-1, user-2,...]│
      │                              │                        │
      │                              │   SADD active:123      │
      │                              │   user-1, user-2...    │
      │                              │                        │
      │                              │   ZREM queue:123       │
      │                              │   user-1, user-2...    │
      │                              │                        │
      │ 9. 순번 업데이트 알림 📢       │                        │
      │<─────────────────────────────┤                        │
      │  position: 8,195 (-50)       │                        │
      │                              │                        │
      │  모달 자동 업데이트 ✨         │                        │
      │  순번: 8,195 / 10,000        │                        │
      │                              │                        │
      │ ... (반복)                   │                        │
      │                              │                        │
      │ 10. 입장 허용! 🎉             │                        │
      │<─────────────────────────────┤                        │
      │  queue-enter event           │                        │
      │                              │                        │
      │ 11. 모달 닫힘 ✅              │                        │
      │  이벤트 페이지로 입장          │                        │
```

---

## 📝 단계별 상세 설명

### 1️⃣ 사용자가 이벤트 페이지 접속

**프론트엔드: EventDetail.js**
```javascript
// 사용자가 /events/123 페이지 접속
useEffect(() => {
  // 대기열 체크 API 호출
  checkQueue();
}, [eventId]);

const checkQueue = async () => {
  const response = await api.post(`/api/queue/check/${eventId}`);

  if (response.data.queued) {
    // 대기열에 등록됨!
    setShowWaitingModal(true); // 모달 표시
  }
};
```

### 2️⃣ 백엔드가 Redis에서 임계값 체크

**백엔드: routes/queue.js**
```javascript
// POST /api/queue/check/:eventId
router.post('/check/:eventId', authenticate, async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user.id; // JWT에서 추출

  // queue-manager에게 체크 요청
  const result = await queueManager.checkQueueEntry(eventId, userId);

  res.json(result);
});
```

**백엔드: services/queue-manager.js**
```javascript
async checkQueueEntry(eventId, userId) {
  // 1. 이미 대기열에 있는지 확인
  const inQueue = await this.isInQueue(eventId, userId);
  if (inQueue) {
    // 새로고침한 경우 - 순번 유지
    return await this.getQueueStatus(eventId, userId);
  }

  // 2. 이미 입장한 사용자인지 확인
  const isActive = await this.isActiveUser(eventId, userId);
  if (isActive) {
    return { queued: false };
  }

  // 3. 현재 활성 사용자 수 확인
  const currentUsers = await redis.scard(`active:${eventId}`);
  const threshold = 1000; // 임계값

  if (currentUsers >= threshold) {
    // 대기열로!
    await this.addToQueue(eventId, userId);
    return await this.getQueueStatus(eventId, userId);
  }

  // 4. 바로 입장 가능
  await this.addActiveUser(eventId, userId);
  return { queued: false };
}
```

### 3️⃣ Redis에 대기열 등록

**Redis 명령어 (내부 동작):**
```redis
# 활성 사용자 수 확인
SCARD active:event-123
> 1500  (임계값 1000 초과!)

# 대기열에 추가 (Sorted Set)
ZADD queue:event-123 1699900000000 user-456
# score: timestamp (1699900000000)
# member: userId (user-456)
> (integer) 1

# 순번 확인 (0-based index)
ZRANK queue:event-123 user-456
> (integer) 8244  (8,245번째)

# 전체 대기 인원
ZCARD queue:event-123
> (integer) 10000
```

### 4️⃣ 프론트엔드에 대기열 정보 반환

**백엔드 응답:**
```json
{
  "queued": true,
  "position": 8245,
  "queueSize": 10000,
  "estimatedWait": 330,
  "threshold": 1000,
  "currentUsers": 1500
}
```

### 5️⃣ WaitingRoomModal 표시

**프론트엔드: WaitingRoomModal.js**
```javascript
function WaitingRoomModal({ eventId, onEntryAllowed }) {
  const [queueInfo, setQueueInfo] = useState(null);

  // 초기 상태 조회
  useEffect(() => {
    fetchQueueStatus();
  }, []);

  const fetchQueueStatus = async () => {
    const response = await api.get(`/api/queue/status/${eventId}`);
    setQueueInfo(response.data);

    // 입장 허용되면 모달 닫기
    if (!response.data.queued) {
      onEntryAllowed();
    }
  };

  return (
    <div className="waiting-room-modal-overlay">
      <div className="waiting-room-modal">
        <h2>⏳ 대기열 입장</h2>
        <p>현재 대기 순번: {queueInfo.position} / {queueInfo.queueSize}</p>
        <div className="progress-bar">
          <div style={{ width: `${getProgress()}%` }} />
        </div>
        <p>예상 대기 시간: {formatWaitTime(queueInfo.estimatedWait)}</p>
      </div>
    </div>
  );
}
```

**화면 표시:**
```
┌─────────────────────────────────────┐
│   ⏳ 대기열 입장                     │
├─────────────────────────────────────┤
│                                     │
│   현재 대기 순번: 8,245 / 10,000    │
│                                     │
│   ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░ 82%          │
│                                     │
│   예상 대기 시간: 약 5분 30초        │
│                                     │
│   💡 새로고침해도 순번이 유지돼요   │
│                                     │
└─────────────────────────────────────┘
```

### 6️⃣ WebSocket으로 실시간 업데이트

**프론트엔드: hooks/useSocket.js**
```javascript
export function useQueueUpdates(eventId, onQueueUpdate, onEntryAllowed) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    // 대기열 룸 입장
    socket.emit('join-queue', { eventId });

    // 대기열 업데이트 리스너
    socket.on('queue-updated', (data) => {
      console.log('⏳ Queue position updated:', data);
      onQueueUpdate(data);
    });

    // 입장 허용 리스너
    socket.on('queue-enter', (data) => {
      console.log('✅ Entry allowed!');
      onEntryAllowed(data);
    });

    return () => {
      socket.off('queue-updated');
      socket.off('queue-enter');
    };
  }, [socket, eventId]);

  return { isConnected: socket?.connected };
}
```

**백엔드: services/queue-processor.js (1초마다 실행)**
```javascript
// 대기열 프로세서
setInterval(async () => {
  const eventId = 'event-123';

  // 1. 빈 자리 계산
  const activeUsers = await redis.scard(`active:${eventId}`);
  const threshold = 1000;
  const availableSlots = threshold - activeUsers;

  if (availableSlots > 0) {
    // 2. 대기열에서 앞에서부터 꺼내기
    const users = await redis.zrange(`queue:${eventId}`, 0, availableSlots - 1);

    for (const userId of users) {
      // 3. 활성 사용자로 등록
      await redis.sadd(`active:${eventId}`, userId);

      // 4. WebSocket으로 입장 알림
      io.to(`user:${userId}`).emit('queue-enter', {
        message: '입장이 허용되었습니다!'
      });
    }

    // 5. 대기열에서 제거
    await redis.zremrangebyrank(`queue:${eventId}`, 0, availableSlots - 1);

    // 6. 나머지 대기자들에게 순번 업데이트 알림
    io.to(`queue:${eventId}`).emit('queue-updated', {
      queueSize: await redis.zcard(`queue:${eventId}`)
    });
  }
}, 1000);
```

### 7️⃣ 실시간 순번 업데이트

**프론트엔드 자동 업데이트:**
```javascript
// WebSocket 이벤트 받으면
socket.on('queue-updated', async () => {
  // 최신 상태 다시 조회
  const response = await api.get(`/api/queue/status/${eventId}`);
  setQueueInfo(response.data);

  // 화면 자동 업데이트
  // 8,245 → 8,195 → 8,145 → ...
});
```

### 8️⃣ 입장 허용!

**백엔드가 WebSocket으로 알림:**
```javascript
// 대기열 프로세서에서
io.to(`user:${userId}`).emit('queue-enter', {
  message: '입장이 허용되었습니다!'
});
```

**프론트엔드가 받음:**
```javascript
socket.on('queue-enter', () => {
  console.log('✅ 입장 허용됨!');

  // 모달 닫기
  setShowWaitingModal(false);

  // 축하 메시지
  toast.success('입장이 허용되었습니다!');
});
```

**모달 닫히고 이벤트 페이지 표시:**
```
모달 사라짐 ✅

이벤트 상세 페이지:
┌─────────────────────────────────────┐
│   🎤 아이유 콘서트                   │
├─────────────────────────────────────┤
│   날짜: 2024-12-25                   │
│   장소: 잠실 실내 체육관              │
│                                     │
│   [티켓 선택하기] 버튼 활성화 ✅     │
└─────────────────────────────────────┘
```

---

## 🔄 새로고침 시 순번 유지

**프론트엔드:**
```javascript
// 페이지 새로고침 후
useEffect(() => {
  // 대기열 상태 다시 조회
  fetchQueueStatus();
}, []);
```

**백엔드:**
```javascript
async getQueueStatus(eventId, userId) {
  // 1. 대기열에 있는지 확인
  const position = await redis.zrank(`queue:${eventId}`, userId);

  if (position !== null) {
    // 있음! 순번 반환
    return {
      queued: true,
      position: position + 1,
      queueSize: await redis.zcard(`queue:${eventId}`)
    };
  }

  // 2. 이미 입장했는지 확인
  const isActive = await redis.sismember(`active:${eventId}`, userId);

  if (isActive) {
    // 입장 완료!
    return { queued: false };
  }

  // 3. 둘 다 아니면 (처음 접속)
  return { queued: false };
}
```

**Redis에서:**
```redis
# 새로고침 전
ZRANK queue:event-123 user-456
> 8244

# 새로고침 후
ZRANK queue:event-123 user-456
> 8244  (그대로!)

# Redis에 계속 저장되어 있으니까 순번 유지됨!
```

---

## 🎨 Redis 데이터 구조

### Redis에 실제로 저장된 데이터:

```redis
# 1. 활성 사용자 (Set)
active:event-123
  ├─ user-1
  ├─ user-2
  ├─ user-3
  └─ ... (1,500명)

SCARD active:event-123  → 1500

# 2. 대기열 (Sorted Set)
queue:event-123
  ├─ user-456: 1699900000000  (score = timestamp)
  ├─ user-457: 1699900000100
  ├─ user-458: 1699900000200
  └─ ... (10,000명)

ZRANK queue:event-123 user-456  → 8244 (순번)
ZCARD queue:event-123           → 10000 (전체)
```

---

## 💡 핵심 정리

### 모달과 Redis 연결:

```
1. 사용자 접속
   ↓
2. 백엔드가 Redis 체크
   SCARD active:event-123  (활성 사용자 수)
   ↓
3. 임계값 초과 시
   ZADD queue:event-123 timestamp user-id
   ↓
4. 순번 조회
   ZRANK queue:event-123 user-id
   ↓
5. 프론트엔드에 반환
   { queued: true, position: 8245 }
   ↓
6. WaitingRoomModal 표시
   "8,245번째 대기 중"
   ↓
7. WebSocket으로 실시간 업데이트
   queue-updated → 순번 갱신
   queue-enter → 입장 허용
   ↓
8. Redis에서 대기열 제거
   ZREM queue:event-123 user-id
   SADD active:event-123 user-id
   ↓
9. 모달 닫힘, 이벤트 페이지 표시 ✅
```

### 핵심 포인트:

```
✅ Redis Sorted Set = 대기열의 실체
✅ WaitingRoomModal = 대기열 시각화
✅ WebSocket = 실시간 업데이트 통로
✅ 1초마다 프로세서가 대기열 처리
✅ 새로고침해도 Redis에 저장되어 순번 유지
```

**즉, 모달은 Redis 데이터를 예쁘게 보여주는 창이고,**
**실제 대기열 로직은 모두 Redis Sorted Set에서 작동해요!**
