import React from 'react';
import './ConnectionStatus.css';

/**
 * WebSocket 연결 상태 표시 컴포넌트
 *
 * ALB 멀티 인스턴스 환경에서 사용자에게 연결 상태를 시각적으로 표시
 * - 연결됨: 초록색
 * - 재연결 중: 노란색
 * - 연결 끊김: 빨간색
 */
function ConnectionStatus({ isConnected, isReconnecting }) {
  // 연결 상태에 따라 다른 스타일 적용
  const getStatusClass = () => {
    if (isConnected) return 'status-connected';
    if (isReconnecting) return 'status-reconnecting';
    return 'status-disconnected';
  };

  const getStatusText = () => {
    if (isConnected) return '연결됨';
    if (isReconnecting) return '재연결 중...';
    return '연결 끊김';
  };

  const getStatusIcon = () => {
    if (isConnected) return '🟢';
    if (isReconnecting) return '🟡';
    return '🔴';
  };

  // 연결이 정상이면 표시하지 않음 (UX 개선)
  if (isConnected) {
    return null;
  }

  return (
    <div className={`connection-status ${getStatusClass()}`}>
      <span className="status-icon">{getStatusIcon()}</span>
      <span className="status-text">{getStatusText()}</span>
      {isReconnecting && (
        <div className="spinner"></div>
      )}
    </div>
  );
}

export default ConnectionStatus;
