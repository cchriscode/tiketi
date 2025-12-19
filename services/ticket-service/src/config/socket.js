const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const { CONFIG } = require('../shared/constants');

/**
 * Socket.IO 초기화 (AWS 멀티 인스턴스 대비)
 * 
 * Redis Adapter를 사용하여 여러 서버 인스턴스 간 WebSocket 메시지 동기화
 * 주로 대기열 시스템의 실시간 업데이트에 사용됨
 */
function initializeSocketIO(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // WebSocket 인증 미들웨어
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // JWT 검증
      const decoded = jwt.verify(token, CONFIG.JWT_SECRET);

      socket.data.userId = decoded.userId;
      socket.data.userRole = decoded.role;

      logger.info(`✅ Socket authenticated: ${socket.id} (user:${decoded.userId})`);
      next();
    } catch (error) {
      logger.error('❌ Socket authentication failed:', error.message);
      next(new Error('Invalid authentication token'));
    }
  });

  // Redis Adapter 설정
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

      logger.info('✅ Socket.IO Redis Adapter connected (Multi-instance ready)');
    } catch (error) {
      logger.error('❌ Redis Adapter connection failed:', error.message);
      logger.info('⚠️  Running Socket.IO in single-instance mode');
    }
  };

  setupRedisAdapter();

  // Connection handling
  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    logger.info(`🔌 Client connected: ${socket.id} (user:${userId})`);

    // Queue 관련 이벤트들
    socket.on('join-queue', async ({ eventId }) => {
      socket.join(`queue:${eventId}`);
      socket.data.queueEventId = eventId;
      logger.info(`⏳ ${socket.id} (user:${userId}) joined queue:${eventId}`);
    });

    socket.on('leave-queue', async ({ eventId }) => {
      socket.leave(`queue:${eventId}`);
      socket.data.queueEventId = null;
      logger.info(`👋 ${socket.id} left queue:${eventId}`);
    });

    // Event 관련 이벤트들
    socket.on('join-event', async ({ eventId }) => {
      socket.join(`event:${eventId}`);
      socket.data.eventId = eventId;
      logger.info(`👤 ${socket.id} joined event:${eventId}`);

      const roomSize = io.sockets.adapter.rooms.get(`event:${eventId}`)?.size || 0;
      io.to(`event:${eventId}`).emit('room-info', {
        eventId,
        userCount: roomSize,
      });
    });

    socket.on('leave-event', async ({ eventId }) => {
      socket.leave(`event:${eventId}`);
      socket.data.eventId = null;
      logger.info(`👋 ${socket.id} left event:${eventId}`);

      const roomSize = io.sockets.adapter.rooms.get(`event:${eventId}`)?.size || 0;
      io.to(`event:${eventId}`).emit('room-info', {
        eventId,
        userCount: roomSize,
      });
    });

    // Seats 관련 이벤트들
    socket.on('join-seat-selection', async ({ eventId }) => {
      socket.join(`seats:${eventId}`);
      socket.data.seatEventId = eventId;
      logger.info(`🪑 ${socket.id} joined seats:${eventId}`);
    });

    socket.on('seat-selection-changed', async ({ eventId, seats }) => {
      // Broadcast to other users in the same seat selection room
      socket.broadcast.to(`seats:${eventId}`).emit('seat-update', {
        userId,
        seats
      });
    });

    socket.on('disconnect', async () => {
      logger.info(`🔌 Client disconnected: ${socket.id} (user:${userId})`);
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
