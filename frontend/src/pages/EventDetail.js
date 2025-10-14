import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI, reservationsAPI } from '../services/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
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

  useEffect(() => {
    fetchEventDetail();
  }, [id]);

  const fetchEventDetail = async () => {
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
  };

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

  const handleReservation = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    if (getTotalQuantity() === 0) {
      alert('티켓을 선택해주세요.');
      return;
    }

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

  return (
    <div className="event-detail-page">
      <div className="container">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

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

        <div className="ticket-selection-section">
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

        {getTotalQuantity() > 0 && (
          <div className="reservation-summary">
            <div className="summary-content">
              <div className="summary-info">
                <span className="summary-label">총 {getTotalQuantity()}매</span>
                <span className="summary-total">₩{formatPrice(calculateTotal())}</span>
              </div>
              <button
                className="btn btn-primary btn-large"
                onClick={handleReservation}
                disabled={submitting || event.status !== 'on_sale'}
              >
                {submitting ? '처리 중...' : '예매하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EventDetail;

