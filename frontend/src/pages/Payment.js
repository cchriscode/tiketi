import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_DISPLAY,
  RESERVATION_SETTINGS,
  API_ENDPOINTS,
} from '../shared/constants';
import './Payment.css';

function Payment() {
  const { reservationId } = useParams();
  const navigate = useNavigate();

  const [reservation, setReservation] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReservation();
  }, [reservationId]);

  useEffect(() => {
    if (reservation && reservation.expires_at) {
      const interval = setInterval(() => {
        const now = new Date();
        const expiresAt = new Date(reservation.expires_at);
        const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
        
        setTimeRemaining(remaining);
        
        if (remaining === 0) {
          clearInterval(interval);
          alert('예약 시간이 만료되었습니다.');
          navigate('/');
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [reservation, navigate]);

  const fetchReservation = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.GET_RESERVATION(reservationId));
      setReservation(response.data.reservation);
      
      // Check if expired
      if (response.data.reservation.isExpired) {
        alert('예약 시간이 만료되었습니다.');
        navigate('/');
        return;
      }

      // Check if already paid
      if (response.data.reservation.payment_status === 'completed') {
        navigate(`/payment-success/${reservationId}`);
        return;
      }

      setError(null);
    } catch (error) {
      console.error('Failed to fetch reservation:', error);
      setError('예약 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      alert('결제 수단을 선택해주세요.');
      return;
    }

    try {
      setProcessing(true);
      const response = await api.post(API_ENDPOINTS.PROCESS_PAYMENT, {
        reservationId,
        paymentMethod,
      });

      if (response.data.success) {
        navigate(`/payment-success/${reservationId}`);
      }
    } catch (error) {
      console.error('Payment failed:', error);
      alert(error.response?.data?.error || '결제에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
    <div className="payment-container">
      <div className="payment-content">
        {/* Timer */}
        <div className={`payment-timer ${timeRemaining < 60 ? 'warning' : ''}`}>
          <span className="timer-label">⏰ 남은 시간</span>
          <span className="timer-value">{formatTime(timeRemaining)}</span>
          <p className="timer-warning">
            시간 내에 결제하지 않으면 좌석이 자동으로 취소됩니다.
          </p>
        </div>

        {/* Reservation Info */}
        <div className="reservation-info-section">
          <h2>예약 정보</h2>
          
          <div className="event-info-card">
            <h3>{reservation.event_title}</h3>
            <div className="info-item">
              <span className="label">장소</span>
              <span className="value">{reservation.venue}</span>
            </div>
            <div className="info-item">
              <span className="label">일시</span>
              <span className="value">
                {new Date(reservation.event_date).toLocaleString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          <div className="seats-info-card">
            <h4>선택한 좌석</h4>
            <div className="seats-list">
              {reservation.seats.map((seat, index) => (
                <div key={index} className="seat-item">
                  <span className="seat-label">{seat.seatLabel}</span>
                  <span className="seat-price">{seat.price?.toLocaleString()}원</span>
                </div>
              ))}
            </div>
            <div className="total-line">
              <span className="label">총 결제 금액</span>
              <span className="amount">{reservation.total_amount?.toLocaleString()}원</span>
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="payment-method-section">
          <h2>결제 수단 선택</h2>
          
          <div className="payment-methods">
            <label className={`payment-option ${paymentMethod === PAYMENT_METHODS.NAVER_PAY ? 'selected' : ''}`}>
              <input
                type="radio"
                name="paymentMethod"
                value={PAYMENT_METHODS.NAVER_PAY}
                checked={paymentMethod === PAYMENT_METHODS.NAVER_PAY}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <div className="option-content">
                <div className="option-icon naver">N</div>
                <span className="option-name">{PAYMENT_METHOD_DISPLAY[PAYMENT_METHODS.NAVER_PAY]}</span>
              </div>
            </label>

            <label className={`payment-option ${paymentMethod === PAYMENT_METHODS.KAKAO_PAY ? 'selected' : ''}`}>
              <input
                type="radio"
                name="paymentMethod"
                value={PAYMENT_METHODS.KAKAO_PAY}
                checked={paymentMethod === PAYMENT_METHODS.KAKAO_PAY}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <div className="option-content">
                <div className="option-icon kakao">K</div>
                <span className="option-name">{PAYMENT_METHOD_DISPLAY[PAYMENT_METHODS.KAKAO_PAY]}</span>
              </div>
            </label>

            <label className={`payment-option ${paymentMethod === PAYMENT_METHODS.BANK_TRANSFER ? 'selected' : ''}`}>
              <input
                type="radio"
                name="paymentMethod"
                value={PAYMENT_METHODS.BANK_TRANSFER}
                checked={paymentMethod === PAYMENT_METHODS.BANK_TRANSFER}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <div className="option-content">
                <div className="option-icon bank">🏦</div>
                <span className="option-name">{PAYMENT_METHOD_DISPLAY[PAYMENT_METHODS.BANK_TRANSFER]}</span>
              </div>
            </label>
          </div>
        </div>

        {/* Payment Button */}
        <button
          className="payment-btn"
          onClick={handlePayment}
          disabled={!paymentMethod || processing}
        >
          {processing
            ? '결제 처리 중...'
            : `${reservation.total_amount?.toLocaleString()}원 결제하기`}
        </button>

        <p className="payment-notice">
          * 이 결제는 실제 결제가 진행되지 않는 목업입니다.
        </p>
      </div>
    </div>
  );
}

export default Payment;

