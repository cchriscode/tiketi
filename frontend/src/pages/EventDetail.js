import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI, reservationsAPI } from '../services/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useCountdown } from '../hooks/useCountdown';
import { useTicketUpdates } from '../hooks/useSocket';
import WaitingRoomModal from '../components/WaitingRoomModal';
import ConnectionStatus from '../components/ConnectionStatus';
import api from '../services/api';
import { EVENT_STATUS, EVENT_STATUS_MESSAGES } from '../shared/constants';
import './EventDetail.css';

function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const ticketSectionRef = useRef(null);

  const fetchEventDetail = useCallback(async () => {
    try {
      setLoading(true);
      const response = await eventsAPI.getById(id);
      setEvent(response.data.event);
      setTicketTypes(response.data.ticketTypes);
    } catch (err) {
      setError('이벤트 정보를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEventDetail();
    checkQueueStatus(); // 대기열 상태 확인
  }, [fetchEventDetail]);

  // 대기열 상태 확인
  const checkQueueStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) return; // 로그인 안 한 경우 체크하지 않음

    try {
      const response = await api.post(`/queue/check/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data;

      // 대기열에 있으면 모달 표시
      if (data.queued) {
        setShowQueueModal(true);
      }
    } catch (err) {
      console.error('Queue check error:', err);
      // 에러 발생 시 대기열 없는 것으로 처리 (정상 진행)
    }
  };

  // 대기열 입장 허용 시
  const handleQueueEntryAllowed = () => {
    setShowQueueModal(false);
    fetchEventDetail(); // 최신 데이터 다시 로드
  };

  // 대기열 닫기
  const handleQueueClose = () => {
    setShowQueueModal(false);
    navigate('/'); // 홈으로 이동
  };

  // 실시간 티켓 재고 업데이트
  const handleTicketUpdate = useCallback((data) => {
    const { ticketTypeId, availableQuantity } = data;

    setTicketTypes((prevTickets) =>
      prevTickets.map((ticket) =>
        ticket.id === ticketTypeId
          ? { ...ticket, available_quantity: availableQuantity }
          : ticket
      )
    );

    console.log(`✅ Ticket ${ticketTypeId} updated: ${availableQuantity} remaining`);
  }, []);

  // WebSocket 연결 및 실시간 업데이트 구독
  const { isConnected, isReconnecting } = useTicketUpdates(id, handleTicketUpdate);

  // 카운트다운이 종료되면 자동으로 이벤트 정보 새로고침
  const handleCountdownExpire = useCallback(() => {
    console.log('⏰ 카운트다운 종료 - 이벤트 정보 새로고침');
    fetchEventDetail();
  }, [fetchEventDetail]);

  // 카운트다운 훅 - 상태에 따라 콜백 전달 (단순화)
  const saleStartCountdown = useCountdown(
    event?.sale_start_date,
    event?.status === EVENT_STATUS.UPCOMING ? handleCountdownExpire : null
  );

  const saleEndCountdown = useCountdown(
    event?.sale_end_date,
    event?.status === EVENT_STATUS.ON_SALE ? handleCountdownExpire : null
  );

  const handleQuantityChange = (ticketTypeId, quantity) => {
    setSelectedTickets((prev) => {
      if (quantity <= 0) {
        const newState = { ...prev };
        delete newState[ticketTypeId];
        return newState;
      }
      return {
        ...prev,
        [ticketTypeId]: quantity,
      };
    });
  };

  const calculateTotal = () => {
    return ticketTypes.reduce((total, ticket) => {
      const quantity = selectedTickets[ticket.id] || 0;
      return total + ticket.price * quantity;
    }, 0);
  };

  const getTotalQuantity = () => {
    return Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0);
  };

  const scrollToTickets = () => {
    if (ticketSectionRef.current) {
      ticketSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const formatCountdownValue = (countdown) => {
    if (!countdown) return '';
    const parts = [];
    if (countdown.months && countdown.months > 0) {
      parts.push(`${countdown.months}개월`);
    }
    if (countdown.days && countdown.days > 0) {
      parts.push(`${countdown.days}일`);
    }
    parts.push(`${countdown.hours || 0}시간`);
    parts.push(`${countdown.minutes || 0}분`);
    parts.push(`${countdown.seconds || 0}초`);
    return parts.join(' ');
  };

  const getCountdownChip = () => {
    if (!event) return null;

    if (
      event.status === EVENT_STATUS.UPCOMING &&
      saleStartCountdown &&
      !saleStartCountdown.isExpired
    ) {
      return {
        label: '판매 시작까지',
        value: formatCountdownValue(saleStartCountdown),
        variant: 'upcoming',
      };
    }

    if (
      event.status === EVENT_STATUS.ON_SALE &&
      saleEndCountdown &&
      !saleEndCountdown.isExpired
    ) {
      return {
        label: '판매 종료까지',
        value: formatCountdownValue(saleEndCountdown),
        variant: 'on-sale',
      };
    }

    return null;
  };

  const handleReservation = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    // Check if this event has seat selection
    if (event.seat_layout_id) {
      // Navigate to seat selection page
      navigate(`/events/${id}/seats`);
      return;
    }

    // For events without seat selection, check ticket selection
    if (getTotalQuantity() === 0) {
      alert('티켓을 선택해주세요.');
      return;
    }

    // Create reservation directly for non-seat events
    try {
      setSubmitting(true);
      setError(null);

      const items = Object.entries(selectedTickets).map(([ticketTypeId, quantity]) => ({
        ticketTypeId,
        quantity,
      }));

      const response = await reservationsAPI.create({
        eventId: id,
        items,
      });

      setSuccess('예매가 완료되었습니다!');
      setTimeout(() => {
        navigate('/my-reservations');
      }, 2000);
    } catch (err) {
      const message = err.response?.data?.error || '예매에 실패했습니다.';
      setError(message);
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'yyyy년 M월 d일 (eee) HH:mm', { locale: ko });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container">
        <div className="alert alert-error">이벤트를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const isOnSale = event.status === EVENT_STATUS.ON_SALE;
  const isCancelled = event.status === EVENT_STATUS.CANCELLED;
  const totalQuantity = getTotalQuantity();
  const hasSelection = totalQuantity > 0;
  const totalPrice = calculateTotal();
  const statusMessage = EVENT_STATUS_MESSAGES[event.status];
  const countdownChip = getCountdownChip();

  const topButtonLabel = (() => {
    if (isCancelled) return '예매 불가';
    if (!isOnSale) return statusMessage || '예매 불가';
    if (event.seat_layout_id) return '좌석 선택하기';
    return hasSelection
      ? `예매하기 · ₩${formatPrice(totalPrice)}`
      : '티켓 선택하기';
  })();

  const topButtonDisabled = isCancelled || !isOnSale;

  const handleTopCTAClick = () => {
    if (topButtonDisabled) return;

    if (event.seat_layout_id) {
      handleReservation();
      return;
    }

    if (!hasSelection) {
      scrollToTickets();
      return;
    }

    handleReservation();
  };

  return (
    <div className="event-detail-page">
      {/* WebSocket 연결 상태 표시 (ALB 멀티 인스턴스 대비) */}
      <ConnectionStatus isConnected={isConnected} isReconnecting={isReconnecting} />

      <div className="event-detail-hero">
        <div className="event-detail-hero-inner">
          <div className="event-detail-header">
            <div className="event-poster">
              {event.poster_image_url ? (
                <img src={event.poster_image_url} alt={event.title} />
              ) : (
                <div className="poster-placeholder">🎭</div>
              )}
            </div>

            <div className="event-info-section">
              <h1 className="event-detail-title">{event.title}</h1>
              {countdownChip && (
                <div className={`countdown-chip ${countdownChip.variant}`}>
                  <span className="countdown-chip-label">{countdownChip.label}</span>
                  <span className="countdown-chip-value">{countdownChip.value}</span>
                </div>
              )}

              <div className="hero-primary-action">
                <button
                  type="button"
                  className="btn btn-primary hero-primary-button"
                  disabled={topButtonDisabled}
                  onClick={handleTopCTAClick}
                >
                  {topButtonLabel}
                </button>
              </div>

              <div className="event-detail-info">
                <div className="info-row">
                  <span className="info-label">장소</span>
                  <span className="info-value">{event.venue}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">주소</span>
                  <span className="info-value">{event.address}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">날짜</span>
                  <span className="info-value">{formatDate(event.event_date)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">예매 기간</span>
                  <span className="info-value">
                    {formatDate(event.sale_start_date)} ~ {formatDate(event.sale_end_date)}
                  </span>
                </div>
              </div>

              {event.description && (
                <div className="event-description">
                  <h3>이벤트 소개</h3>
                  <p>{event.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="event-detail-content">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* 티켓 타입 선택 (좌석 없는 경우) */}
        {event.status !== EVENT_STATUS.CANCELLED && !event.seat_layout_id && (
          <>
            <div ref={ticketSectionRef} className="ticket-selection-section">
              <h2>티켓 선택</h2>
              <div className="ticket-types-list">
                {ticketTypes.map((ticket) => (
                  <div key={ticket.id} className="ticket-type-card">
                    <div className="ticket-type-info">
                      <h3 className="ticket-type-name">{ticket.name}</h3>
                      {ticket.description && (
                        <p className="ticket-type-description">{ticket.description}</p>
                      )}
                      <div className="ticket-type-price">₩{formatPrice(ticket.price)}</div>
                      <div className="ticket-type-stock">
                        잔여 {ticket.available_quantity} / {ticket.total_quantity}
                      </div>
                    </div>

                    <div className="ticket-type-quantity">
                      <button
                        className="qty-btn"
                        onClick={() =>
                          handleQuantityChange(
                            ticket.id,
                            (selectedTickets[ticket.id] || 0) - 1
                          )
                        }
                        disabled={!selectedTickets[ticket.id] || selectedTickets[ticket.id] <= 0}
                      >
                        -
                      </button>
                      <span className="qty-value">{selectedTickets[ticket.id] || 0}</span>
                      <button
                        className="qty-btn"
                        onClick={() =>
                          handleQuantityChange(
                            ticket.id,
                            (selectedTickets[ticket.id] || 0) + 1
                          )
                        }
                        disabled={
                          (selectedTickets[ticket.id] || 0) >= ticket.available_quantity ||
                          ticket.available_quantity === 0
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {ticketTypes.length === 0 && (
                <div className="empty-state">티켓 정보가 없습니다.</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 대기열 모달 */}
      {showQueueModal && (
        <WaitingRoomModal
          eventId={id}
          onEntryAllowed={handleQueueEntryAllowed}
          onClose={handleQueueClose}
        />
      )}
    </div>
  );
}

export default EventDetail;

