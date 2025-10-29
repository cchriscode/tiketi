const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

/**
 * Socket.IO 초기화 (AWS 멀티 인스턴스 대비)
 *
 * Redis Adapter를 사용하여 여러 서버 인스턴스 간 WebSocket 메시지 동기화
 *
 * 현재 환경: 단일 서버 (Docker Compose)
 * AWS 환경: ALB + 여러 EC2 인스턴스 → Redis Pub/Sub로 자동 동기화
 */
function initializeSocketIO(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Connection options
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Redis Adapter 설정 (AWS 확장 대비)
  const setupRedisAdapter = async () => {
    try {
      const pubClient = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
        },
      });

      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      io.adapter(createAdapter(pubClient, subClient));

      console.log('✅ Socket.IO Redis Adapter connected (Multi-instance ready)');
    } catch (error) {
      console.error('❌ Redis Adapter connection failed:', error.message);
      console.log('⚠️  Running Socket.IO in single-instance mode');
    }
  };

  setupRedisAdapter();

  // Connection handling
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // 이벤트 룸 입장
    socket.on('join-event', ({ eventId }) => {
      socket.join(`event:${eventId}`);
      console.log(`👤 ${socket.id} joined event:${eventId}`);

      // 현재 룸에 몇 명 있는지 알림
      const roomSize = io.sockets.adapter.rooms.get(`event:${eventId}`)?.size || 0;
      io.to(`event:${eventId}`).emit('room-info', {
        eventId,
        userCount: roomSize,
      });
    });

    // 이벤트 룸 떠나기
    socket.on('leave-event', ({ eventId }) => {
      socket.leave(`event:${eventId}`);
      console.log(`👋 ${socket.id} left event:${eventId}`);

      const roomSize = io.sockets.adapter.rooms.get(`event:${eventId}`)?.size || 0;
      io.to(`event:${eventId}`).emit('room-info', {
        eventId,
        userCount: roomSize,
      });
    });

    // 대기열 입장
    socket.on('join-queue', ({ eventId, userId }) => {
      socket.join(`queue:${eventId}`);
      socket.data.userId = userId;
      socket.data.eventId = eventId;
      console.log(`⏳ ${socket.id} (user:${userId}) joined queue:${eventId}`);
    });

    // 좌석 선택 페이지 입장
    socket.on('join-seat-selection', ({ eventId }) => {
      socket.join(`seats:${eventId}`);
      console.log(`🪑 ${socket.id} joined seats:${eventId}`);
    });

    // 연결 해제
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * 특정 이벤트의 모든 사용자에게 브로드캐스트
 */
function emitToEvent(io, eventId, event, data) {
  io.to(`event:${eventId}`).emit(event, data);
}

/**
 * 대기열에 있는 모든 사용자에게 브로드캐스트
 */
function emitToQueue(io, eventId, event, data) {
  io.to(`queue:${eventId}`).emit(event, data);
}

/**
 * 좌석 선택 중인 사용자에게 브로드캐스트
 */
function emitToSeats(io, eventId, event, data) {
  io.to(`seats:${eventId}`).emit(event, data);
}

module.exports = {
  initializeSocketIO,
  emitToEvent,
  emitToQueue,
  emitToSeats,
};
