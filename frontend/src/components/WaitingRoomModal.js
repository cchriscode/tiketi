import React, { useState, useEffect, useCallback } from 'react';
import { useQueueUpdates } from '../hooks/useSocket';
import ConnectionStatus from './ConnectionStatus';
import api from '../services/api';
import './WaitingRoomModal.css';

/**
 * 대기열 모달 컴포넌트
 * 이벤트 페이지 위에 오버레이로 표시됨
 */
function WaitingRoomModal({ eventId, onEntryAllowed, onClose }) {
  const [queueInfo, setQueueInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 사용자 정보
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const userId = user?.id;

  // 대기열 상태 조회
  const fetchQueueStatus = useCallback(async () => {
    try {
      const response = await api.get(`/queue/status/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data;
      setQueueInfo(data);
      setLoading(false);

      // 대기열에 없으면 (이미 입장한 경우) 모달 닫기
      if (!data.queued) {
        console.log('✅ Entry allowed, closing modal...');
        if (onEntryAllowed) {
          onEntryAllowed();
        }
      }
    } catch (err) {
      console.error('Queue status error:', err);
      setError('대기열 상태를 불러오는데 실패했습니다.');
      setLoading(false);
    }
  }, [eventId, token, onEntryAllowed]);

  // 대기열 업데이트 콜백
  const handleQueueUpdate = useCallback((data) => {
    console.log('⏳ Queue updated:', data);
    fetchQueueStatus();
  }, [fetchQueueStatus]);

  // 입장 허용 콜백
  const handleEntryAllowedSocket = useCallback((data) => {
    if (data?.eventId && data.eventId !== eventId) {
      return;
    }
    if (data?.userId && userId && data.userId !== userId) {
      return;
    }
    console.log('✅ Entry allowed from socket!', data);

    // 축하 메시지
    setTimeout(() => {
      if (onEntryAllowed) {
        onEntryAllowed();
      }
    }, 500);
  }, [eventId, onEntryAllowed, userId]);

  // WebSocket 연결 (userId는 서버가 JWT에서 추출)
  const { isConnected, isReconnecting } = useQueueUpdates(
    eventId,
    handleQueueUpdate,
    handleEntryAllowedSocket
  );

  // 초기 로드 및 주기적 폴링 (fallback)
  useEffect(() => {
    if (!token || !userId) {
      setError('로그인이 필요합니다.');
      return;
    }

    // 초기 상태 조회
    fetchQueueStatus();

    // 5초마다 폴링 (WebSocket이 끊겼을 때 fallback)
    const interval = setInterval(() => {
      fetchQueueStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [token, userId, fetchQueueStatus]);

  // 프로그레스 바 계산
  const getProgress = () => {
    if (!queueInfo) return 0;
    const { position, queueSize } = queueInfo;
    if (queueSize === 0) return 100;
    return Math.max(0, Math.min(100, ((queueSize - position) / queueSize) * 100));
  };

  // 예상 대기시간 포맷
  const formatWaitTime = (seconds) => {
    if (seconds < 60) return `약 ${seconds}초`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0 ? `약 ${minutes}분 ${remainingSeconds}초` : `약 ${minutes}분`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `약 ${hours}시간 ${remainingMinutes}분`;
  };

  // 대기열 나가기
  const handleLeave = async () => {
    if (window.confirm('대기열에서 나가시겠습니까?')) {
      try {
        await api.post(`/queue/leave/${eventId}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (onClose) {
          onClose();
        }
      } catch (err) {
        console.error('Leave queue error:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="waiting-room-modal-overlay">
        <div className="waiting-room-modal">
          <div className="loading-spinner"></div>
          <p>대기열 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="waiting-room-modal-overlay">
        <div className="waiting-room-modal">
          <div className="error-message">
            <h2>❌ 오류</h2>
            <p>{error}</p>
            <button onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="waiting-room-modal-overlay">
      <div className="waiting-room-modal">
        {/* WebSocket 연결 상태 표시 */}
        <ConnectionStatus isConnected={isConnected} isReconnecting={isReconnecting} />

        {/* 헤더 */}
        <div className="modal-header">
          <h1>⏳ 대기열</h1>
          <p className="subtitle">잠시만 기다려주세요</p>
        </div>

        {queueInfo && (
          <>
            {/* 순번 표시 */}
            <div className="queue-position-section">
              <div className="position-circle">
                <div className="position-number">{queueInfo.position}</div>
                <div className="position-label">번째</div>
              </div>
              <p className="position-description">현재 대기 순번</p>
            </div>

            {/* 예상 대기시간 */}
            <div className="wait-time-section">
              <div className="wait-time-card">
                <div className="wait-time-icon">⏱️</div>
                <div className="wait-time-content">
                  <div className="wait-time-label">예상 대기시간</div>
                  <div className="wait-time-value">
                    {formatWaitTime(queueInfo.estimatedWait)}
                  </div>
                </div>
              </div>
            </div>

            {/* 프로그레스 바 */}
            <div className="progress-section">
              <div className="progress-info">
                <span>대기 중</span>
                <span>{Math.round(getProgress())}%</span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${getProgress()}%` }}
                >
                  <div className="progress-bar-shine"></div>
                </div>
              </div>
            </div>

            {/* 통계 정보 */}
            <div className="queue-stats">
              <div className="stat-item">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <div className="stat-label">전체 대기 인원</div>
                  <div className="stat-value">{queueInfo.queueSize.toLocaleString()}명</div>
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-icon">🎫</div>
                <div className="stat-content">
                  <div className="stat-label">현재 접속 중</div>
                  <div className="stat-value">{queueInfo.currentUsers.toLocaleString()}명</div>
                </div>
              </div>
            </div>

            {/* 안내 메시지 */}
            <div className="queue-notice">
              <p><strong>📢 안내사항</strong></p>
              <ul>
                <li>순차적으로 입장하고 있습니다. 잠시만 기다려주세요.</li>
                <li>페이지를 새로고침해도 순번이 유지됩니다.</li>
                <li>입장이 허용되면 자동으로 모달이 닫힙니다.</li>
                <li>창을 닫으면 순번이 취소될 수 있습니다.</li>
              </ul>
            </div>

            {/* 취소 버튼 */}
            <div className="queue-actions">
              <button className="btn-cancel" onClick={handleLeave}>
                대기열 나가기
              </button>
            </div>
          </>
        )}

        {/* 배경 애니메이션 */}
        <div className="background-animation">
          <div className="circle circle-1"></div>
          <div className="circle circle-2"></div>
          <div className="circle circle-3"></div>
        </div>
      </div>
    </div>
  );
}

export default WaitingRoomModal;
