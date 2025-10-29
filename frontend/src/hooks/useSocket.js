import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

/**
 * Socket.IO 연결 및 이벤트 관리 훅
 *
 * AWS 멀티 인스턴스 환경에서도 작동 (백엔드의 Redis Adapter가 동기화 처리)
 *
 * @param {string} eventId - 구독할 이벤트 ID
 * @returns {object} socket 인스턴스 및 연결 상태
 */
export function useSocket(eventId) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomInfo, setRoomInfo] = useState({ userCount: 0 });

  useEffect(() => {
    // Socket 연결
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // 연결 이벤트
    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
      setIsConnected(true);

      // 이벤트 룸 입장
      if (eventId) {
        socket.emit('join-event', { eventId });
      }
    });

    // 연결 해제
    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setIsConnected(false);
    });

    // 룸 정보 업데이트
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
    roomInfo,
  };
}

/**
 * 티켓 재고 실시간 업데이트 훅
 *
 * @param {string} eventId - 이벤트 ID
 * @param {function} onTicketUpdate - 재고 업데이트 콜백
 */
export function useTicketUpdates(eventId, onTicketUpdate) {
  const { socket, isConnected } = useSocket(eventId);

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

  return { socket, isConnected };
}

/**
 * 대기열 실시간 업데이트 훅
 *
 * @param {string} eventId - 이벤트 ID
 * @param {function} onQueueUpdate - 대기열 업데이트 콜백
 * @param {function} onEntryAllowed - 입장 허용 콜백
 */
export function useQueueUpdates(eventId, userId, onQueueUpdate, onEntryAllowed) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⏳ Queue socket connected:', socket.id);
      setIsConnected(true);

      // 대기열 입장
      socket.emit('join-queue', { eventId, userId });
    });

    socket.on('disconnect', () => {
      console.log('⏳ Queue socket disconnected');
      setIsConnected(false);
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
      if (data.userId === userId && onEntryAllowed) {
        onEntryAllowed(data);
      }
    });

    // 대기열 초기화
    socket.on('queue-cleared', (data) => {
      console.log('🧹 Queue cleared:', data);
      // 사용자에게 알림
      alert(data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [eventId, userId, onQueueUpdate, onEntryAllowed]);

  return {
    socket: socketRef.current,
    isConnected,
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
