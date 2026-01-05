import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { PAYMENT_METHOD_DISPLAY, API_ENDPOINTS } from '../shared/constants';
import './PaymentSuccess.css';

function PaymentSuccess() {
  const { reservationId } = useParams();
  const navigate = useNavigate();

  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReservation = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.GET_RESERVATION(reservationId));
      setReservation(response.data.reservation);

      // Check if actually paid
      if (response.data.reservation.payment_status !== 'completed') {
        navigate(`/payment/${reservationId}`);
        return;
      }

      setError(null);
    } catch (error) {
      console.error('Failed to fetch reservation:', error);
      setError('예약 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [reservationId, navigate]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  if (loading) {
    return <div className="loading">예약 정보를 불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={() => navigate('/')}>홈으로 돌아가기</button>
      </div>
    );
  }

  if (!reservation) {
    return <div className="error-container">예약 정보를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="payment-success-container">
      <div className="success-content">
        {/* Success Icon */}
        <div className="success-icon">
          <svg viewBox="0 0 100 100" width="100" height="100">
            <circle cx="50" cy="50" r="45" fill="#4CAF50" />
            <path
              d="M 30 50 L 45 65 L 70 35"
              fill="none"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="success-title">결제가 완료되었습니다!</h1>
        <p className="success-subtitle">예약이 확정되었습니다.</p>

        {/* Reservation Details */}
        <div className="reservation-details">
          <div className="detail-section">
            <h3>예약 번호</h3>
            <p className="reservation-number">{reservation.reservation_number}</p>
          </div>

          <div className="detail-section">
            <h3>이벤트 정보</h3>
            <div className="event-details">
              <p className="event-title">{reservation.event_title}</p>
              <p className="event-venue">{reservation.venue}</p>
              <p className="event-date">
                {new Date(reservation.event_date).toLocaleString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="detail-section">
            <h3>티켓 정보</h3>
            <div className="seats-grid">
              {reservation.seats && reservation.seats.map((seat, index) => (
                <div key={index} className="seat-badge">
                  {seat.seatLabel || `${seat.ticketTypeName} × ${seat.quantity}매`}
                </div>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <h3>결제 정보</h3>
            <div className="payment-details">
              <div className="payment-row">
                <span className="label">결제 수단</span>
                <span className="value">
                  {PAYMENT_METHOD_DISPLAY[reservation.payment_method] || reservation.payment_method}
                </span>
              </div>
              <div className="payment-row total">
                <span className="label">결제 금액</span>
                <span className="value">{reservation.total_amount?.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button className="btn-primary" onClick={() => navigate('/my-reservations')}>
            내 예약 확인
          </button>
          <button className="btn-secondary" onClick={() => navigate('/')}>
            홈으로 돌아가기
          </button>
        </div>

        {/* Notice */}
        <div className="notice-box">
          <h4>📧 예약 확인 메일</h4>
          <p>예약 확인 메일이 등록하신 이메일로 발송되었습니다.</p>
          <p className="notice-sub">
            * 본 시스템은 목업이므로 실제 메일이 발송되지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccess;

