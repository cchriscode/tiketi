import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

/**
 * Socket.IO 연결 및 이벤트 관리 훅 (ALB 멀티 인스턴스 대비)
 *
 * - JWT 인증 토큰 자동 전달
 * - 재연결 시 자동 세션 복구
 * - AWS 멀티 인스턴스 환경 지원 (백엔드의 Redis Adapter가 동기화 처리)
 *
 * @param {string} eventId - 구독할 이벤트 ID
 * @returns {object} socket 인스턴스 및 연결 상태
 */
export function useSocket(eventId) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [roomInfo, setRoomInfo] = useState({ userCount: 0 });
  const [restoredSession, setRestoredSession] = useState(null);

  useEffect(() => {
    // JWT 토큰 가져오기
    const token = localStorage.getItem('token');

    if (!token) {
      console.warn('⚠️  No authentication token found');
      return;
    }

    // Socket 연결 (인증 토큰 포함)
    const socket = io(SOCKET_URL, {
      auth: {
        token, // JWT 토큰 전달
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // ============================================
    // 연결 이벤트
    // ============================================
    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
      setIsConnected(true);
      setIsReconnecting(false);

      // 이벤트 룸 입장
      if (eventId) {
        socket.emit('join-event', { eventId });
      }
    });

    // ============================================
    // 재연결 시도 중
    // ============================================
    socket.on('reconnect_attempt', () => {
      console.log('🔄 Attempting to reconnect...');
      setIsReconnecting(true);
    });

    // ============================================
    // 재연결 성공
    // ============================================
    socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setIsReconnecting(false);
    });

    // ============================================
    // 재연결 실패
    // ============================================
    socket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed');
      setIsReconnecting(false);
    });

    // ============================================
    // 세션 복구 (서버에서 전송)
    // ============================================
    socket.on('session-restored', (data) => {
      console.log('🔄 Session restored:', data);
      setRestoredSession(data);
    });

    // ============================================
    // 연결 해제
    // ============================================
    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setIsConnected(false);

      if (reason === 'io server disconnect') {
        // 서버가 강제로 연결을 끊은 경우 (인증 오류 등)
        console.error('❌ Server disconnected the socket');
      }
    });

    // ============================================
    // 인증 오류
    // ============================================
    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);

      if (error.message.includes('authentication')) {
        // 인증 오류 시 로그인 페이지로 리다이렉트
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    });

    // ============================================
    // 룸 정보 업데이트
    // ============================================
    socket.on('room-info', (data) => {
      setRoomInfo(data);
    });

    // Cleanup
    return () => {
      if (eventId) {
        socket.emit('leave-event', { eventId });
      }
      socket.disconnect();
    };
  }, [eventId]);

  return {
    socket: socketRef.current,
    isConnected,
    isReconnecting,
    roomInfo,
    restoredSession,
  };
}

/**
 * 티켓 재고 실시간 업데이트 훅
 *
 * @param {string} eventId - 이벤트 ID
 * @param {function} onTicketUpdate - 재고 업데이트 콜백
 */
export function useTicketUpdates(eventId, onTicketUpdate) {
  const { socket, isConnected, isReconnecting, restoredSession } = useSocket(eventId);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // 티켓 재고 업데이트 이벤트
    socket.on('ticket-updated', (data) => {
      console.log('🎫 Ticket updated:', data);
      if (onTicketUpdate) {
        onTicketUpdate(data);
      }
    });

    return () => {
      socket.off('ticket-updated');
    };
  }, [socket, isConnected, onTicketUpdate]);

  return { socket, isConnected, isReconnecting, restoredSession };
}

/**
 * 대기열 실시간 업데이트 훅 (ALB 멀티 인스턴스 대비)
 *
 * - JWT 인증 토큰 자동 전달
 * - 재연결 시 자동 세션 복구
 * - 서버에서 userId를 추출하므로 클라이언트는 eventId만 전송
 *
 * @param {string} eventId - 이벤트 ID
 * @param {function} onQueueUpdate - 대기열 업데이트 콜백
 * @param {function} onEntryAllowed - 입장 허용 콜백
 */
export function useQueueUpdates(eventId, onQueueUpdate, onEntryAllowed) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    // JWT 토큰 가져오기
    const token = localStorage.getItem('token');

    if (!token) {
      console.warn('⚠️  No authentication token found');
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: {
        token, // JWT 토큰 전달
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⏳ Queue socket connected:', socket.id);
      setIsConnected(true);
      setIsReconnecting(false);

      // 대기열 입장 (userId는 서버가 JWT에서 추출)
      socket.emit('join-queue', { eventId });
    });

    socket.on('reconnect_attempt', () => {
      console.log('🔄 Attempting to reconnect to queue...');
      setIsReconnecting(true);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Queue reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setIsReconnecting(false);
    });

    socket.on('disconnect', () => {
      console.log('⏳ Queue socket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Queue socket connection error:', error.message);

      if (error.message.includes('authentication')) {
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    });

    // 세션 복구
    socket.on('session-restored', (data) => {
      console.log('🔄 Queue session restored:', data);
      // 복구된 대기열 정보를 콜백으로 전달
      if (onQueueUpdate && data.queueEventId) {
        onQueueUpdate({ eventId: data.queueEventId });
      }
    });

    // 대기열 업데이트
    socket.on('queue-updated', (data) => {
      console.log('⏳ Queue updated:', data);
      if (onQueueUpdate) {
        onQueueUpdate(data);
      }
    });

    // 입장 허용
    socket.on('queue-entry-allowed', (data) => {
      console.log('✅ Entry allowed:', data);
      if (onEntryAllowed) {
        onEntryAllowed(data);
      }
    });

    // 대기열 초기화
    socket.on('queue-cleared', (data) => {
      console.log('🧹 Queue cleared:', data);
      alert(data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [eventId, onQueueUpdate, onEntryAllowed]);

  return {
    socket: socketRef.current,
    isConnected,
    isReconnecting,
  };
}

/**
 * 좌석 선택 실시간 동기화 훅
 *
 * @param {string} eventId - 이벤트 ID
 * @param {function} onSeatUpdate - 좌석 상태 업데이트 콜백
 */
export function useSeatUpdates(eventId, onSeatUpdate) {
  const { socket, isConnected } = useSocket(null);

  useEffect(() => {
    if (!socket || !isConnected || !eventId) return;

    // 좌석 선택 페이지 입장
    socket.emit('join-seat-selection', { eventId });

    // 좌석 선택 이벤트
    socket.on('seat-selected', (data) => {
      console.log('🪑 Seat selected:', data);
      if (onSeatUpdate) {
        onSeatUpdate(data);
      }
    });

    // 좌석 해제 이벤트
    socket.on('seat-released', (data) => {
      console.log('🪑 Seat released:', data);
      if (onSeatUpdate) {
        onSeatUpdate(data);
      }
    });

    return () => {
      socket.off('seat-selected');
      socket.off('seat-released');
    };
  }, [socket, isConnected, eventId, onSeatUpdate]);

  return { socket, isConnected };
}
