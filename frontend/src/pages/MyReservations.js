import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reservationsAPI } from '../services/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import './MyReservations.css';

function MyReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const response = await reservationsAPI.getMy();
      setReservations(response.data.reservations);
    } catch (err) {
      setError('예매 내역을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'yyyy.MM.dd HH:mm', { locale: ko });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: '결제 대기', class: 'badge-warning' },
      confirmed: { text: '예매 완료', class: 'badge-success' },
      cancelled: { text: '취소됨', class: 'badge-danger' },
    };
    const badge = badges[status] || badges.pending;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const getPaymentStatusBadge = (status) => {
    const badges = {
      pending: { text: '결제 대기', class: 'badge-warning' },
      completed: { text: '결제 완료', class: 'badge-success' },
      failed: { text: '결제 실패', class: 'badge-danger' },
      refunded: { text: '환불 완료', class: 'badge-info' },
    };
    const badge = badges[status] || badges.pending;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  if (loading) {
    return (
      <div className="container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="my-reservations-page">
      <div className="container">
        <h1 className="page-title">내 예매 내역</h1>

        {error && <div className="alert alert-error">{error}</div>}

        {reservations.length === 0 ? (
          <div className="empty-state">
            <p>예매 내역이 없습니다.</p>
            <Link to="/" className="btn btn-primary">
              이벤트 보러가기
            </Link>
          </div>
        ) : (
          <div className="reservations-list">
            {reservations.map((reservation) => (
              <Link
                to={`/reservations/${reservation.id}`}
                key={reservation.id}
                className="reservation-card"
              >
                <div className="reservation-header">
                  <div>
                    <h3 className="reservation-event-title">
                      {reservation.event_title}
                    </h3>
                    <p className="reservation-number">
                      예매번호: {reservation.reservation_number}
                    </p>
                  </div>
                  <div className="reservation-badges">
                    {getStatusBadge(reservation.status)}
                    {getPaymentStatusBadge(reservation.payment_status)}
                  </div>
                </div>

                <div className="reservation-info">
                  <div className="reservation-info-item">
                    <span className="label">장소</span>
                    <span className="value">{reservation.venue}</span>
                  </div>
                  <div className="reservation-info-item">
                    <span className="label">공연일</span>
                    <span className="value">
                      {formatDate(reservation.event_date)}
                    </span>
                  </div>
                  <div className="reservation-info-item">
                    <span className="label">예매일</span>
                    <span className="value">
                      {formatDate(reservation.created_at)}
                    </span>
                  </div>
                </div>

                <div className="reservation-items">
                  {reservation.items.map((item, index) => (
                    <div key={index} className="item">
                      <span>
                        {item.ticketTypeName} × {item.quantity}
                      </span>
                      <span>₩{formatPrice(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="reservation-total">
                  <span className="total-label">총 결제금액</span>
                  <span className="total-amount">
                    ₩{formatPrice(reservation.total_amount)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyReservations;

