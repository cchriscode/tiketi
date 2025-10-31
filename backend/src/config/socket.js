const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const jwt = require('jsonwebtoken');
const { CONFIG } = require('../shared/constants');
const {
  saveUserSession,
  getUserSession,
  mapSocketToUser,
  unmapSocket,
  updateUserSession,
} = require('../services/socket-session-manager');

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

  // ============================================
  // WebSocket 인증 미들웨어 (ALB 멀티 인스턴스 대비)
  // ============================================
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // JWT 검증
      const decoded = jwt.verify(token, CONFIG.JWT_SECRET);

      // Socket에 인증된 사용자 정보 저장
      socket.data.userId = decoded.userId;
      socket.data.userRole = decoded.role;

      console.log(`✅ Socket authenticated: ${socket.id} (user:${decoded.userId})`);
      next();
    } catch (error) {
      console.error('❌ Socket authentication failed:', error.message);
      next(new Error('Invalid authentication token'));
    }
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

  // ============================================
  // Connection handling (세션 관리 포함)
  // ============================================
  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    console.log(`🔌 Client connected: ${socket.id} (user:${userId})`);

    // Socket ID와 User ID 매핑 저장
    await mapSocketToUser(socket.id, userId);

    // ============================================
    // 재연결 시 이전 세션 복구
    // ============================================
    const previousSession = await getUserSession(userId);
    if (previousSession) {
      console.log(`🔄 Restoring session for user:${userId}`, previousSession);

      // 이전에 참여했던 룸에 자동으로 재참여
      if (previousSession.eventId) {
        socket.join(`event:${previousSession.eventId}`);
        socket.data.eventId = previousSession.eventId;
      }

      if (previousSession.queueEventId) {
        socket.join(`queue:${previousSession.queueEventId}`);
        socket.data.queueEventId = previousSession.queueEventId;
      }

      if (previousSession.seatEventId) {
        socket.join(`seats:${previousSession.seatEventId}`);
        socket.data.seatEventId = previousSession.seatEventId;
      }

      // 클라이언트에 복구된 세션 정보 전달
      socket.emit('session-restored', {
        eventId: previousSession.eventId,
        queueEventId: previousSession.queueEventId,
        seatEventId: previousSession.seatEventId,
        selectedSeats: previousSession.selectedSeats,
      });
    }

    // ============================================
    // 이벤트 룸 입장
    // ============================================
    socket.on('join-event', async ({ eventId }) => {
      socket.join(`event:${eventId}`);
      socket.data.eventId = eventId;
      console.log(`👤 ${socket.id} joined event:${eventId}`);

      // 세션에 저장
      await updateUserSession(userId, { eventId });

      // 현재 룸에 몇 명 있는지 알림
      const roomSize = io.sockets.adapter.rooms.get(`event:${eventId}`)?.size || 0;
      io.to(`event:${eventId}`).emit('room-info', {
        eventId,
        userCount: roomSize,
      });
    });

    // ============================================
    // 이벤트 룸 떠나기
    // ============================================
    socket.on('leave-event', async ({ eventId }) => {
      socket.leave(`event:${eventId}`);
      socket.data.eventId = null;
      console.log(`👋 ${socket.id} left event:${eventId}`);

      // 세션에서 제거
      await updateUserSession(userId, { eventId: null });

      const roomSize = io.sockets.adapter.rooms.get(`event:${eventId}`)?.size || 0;
      io.to(`event:${eventId}`).emit('room-info', {
        eventId,
        userCount: roomSize,
      });
    });

    // ============================================
    // 대기열 입장 (userId는 인증된 값 사용)
    // ============================================
    socket.on('join-queue', async ({ eventId }) => {
      socket.join(`queue:${eventId}`);
      socket.data.queueEventId = eventId;
      console.log(`⏳ ${socket.id} (user:${userId}) joined queue:${eventId}`);

      // 세션에 저장
      await updateUserSession(userId, { queueEventId: eventId });
    });

    // ============================================
    // 좌석 선택 페이지 입장
    // ============================================
    socket.on('join-seat-selection', async ({ eventId }) => {
      socket.join(`seats:${eventId}`);
      socket.data.seatEventId = eventId;
      console.log(`🪑 ${socket.id} joined seats:${eventId}`);

      // 세션에 저장
      await updateUserSession(userId, { seatEventId: eventId });
    });

    // ============================================
    // 좌석 선택 상태 저장 (재연결 시 복구 가능)
    // ============================================
    socket.on('seat-selection-changed', async ({ eventId, seats }) => {
      await updateUserSession(userId, {
        seatEventId: eventId,
        selectedSeats: seats
      });
    });

    // ============================================
    // 연결 해제
    // ============================================
    socket.on('disconnect', async () => {
      console.log(`🔌 Client disconnected: ${socket.id} (user:${userId})`);

      // Socket 매핑 제거 (세션은 유지하여 재연결 대비)
      await unmapSocket(socket.id);

      // 참고: 세션은 TTL(1시간) 후 자동 삭제됨
      // 즉시 삭제하지 않아 재연결 시 복구 가능
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
