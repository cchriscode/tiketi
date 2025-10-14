import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reservationsAPI } from '../services/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import './ReservationDetail.css';

function ReservationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReservationDetail();
  }, [id]);

  const fetchReservationDetail = async () => {
    try {
      setLoading(true);
      const response = await reservationsAPI.getById(id);
      setReservation(response.data.reservation);
    } catch (err) {
      setError('예매 정보를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('정말 예매를 취소하시겠습니까?')) {
      return;
    }

    try {
      setCancelling(true);
      await reservationsAPI.cancel(id);
      alert('예매가 취소되었습니다.');
      navigate('/my-reservations');
    } catch (err) {
      const message = err.response?.data?.error || '예매 취소에 실패했습니다.';
      alert(message);
    } finally {
      setCancelling(false);
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

  if (!reservation) {
    return (
      <div className="container">
        <div className="alert alert-error">예매 정보를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const canCancel = reservation.status !== 'cancelled' && reservation.payment_status !== 'refunded';

  return (
    <div className="reservation-detail-page">
      <div className="container">
        <div className="detail-header">
          <h1 className="detail-title">예매 상세</h1>
          {canCancel && (
            <button
              className="btn btn-danger"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? '취소 중...' : '예매 취소'}
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="detail-card">
          <div className="detail-section">
            <h2 className="section-title">예매 정보</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">예매번호</span>
                <span className="info-value">{reservation.reservation_number}</span>
              </div>
              <div className="info-item">
                <span className="info-label">예매일시</span>
                <span className="info-value">{formatDate(reservation.created_at)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">예매상태</span>
                <span className="info-value">
                  {reservation.status === 'pending' && '결제 대기'}
                  {reservation.status === 'confirmed' && '예매 완료'}
                  {reservation.status === 'cancelled' && '취소됨'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">결제상태</span>
                <span className="info-value">
                  {reservation.payment_status === 'pending' && '결제 대기'}
                  {reservation.payment_status === 'completed' && '결제 완료'}
                  {reservation.payment_status === 'failed' && '결제 실패'}
                  {reservation.payment_status === 'refunded' && '환불 완료'}
                </span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h2 className="section-title">이벤트 정보</h2>
            <div className="info-grid">
              <div className="info-item full-width">
                <span className="info-label">이벤트명</span>
                <span className="info-value">{reservation.event_title}</span>
              </div>
              <div className="info-item">
                <span className="info-label">장소</span>
                <span className="info-value">{reservation.venue}</span>
              </div>
              <div className="info-item">
                <span className="info-label">주소</span>
                <span className="info-value">{reservation.address}</span>
              </div>
              <div className="info-item full-width">
                <span className="info-label">공연일시</span>
                <span className="info-value">{formatDate(reservation.event_date)}</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h2 className="section-title">티켓 정보</h2>
            <div className="tickets-table">
              <div className="table-header">
                <span>티켓 종류</span>
                <span>수량</span>
                <span>단가</span>
                <span>금액</span>
              </div>
              {reservation.items.map((item, index) => (
                <div key={index} className="table-row">
                  <span>{item.ticketTypeName}</span>
                  <span>{item.quantity}매</span>
                  <span>₩{formatPrice(item.unitPrice)}</span>
                  <span>₩{formatPrice(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="detail-total">
            <span className="total-label">총 결제금액</span>
            <span className="total-amount">₩{formatPrice(reservation.total_amount)}</span>
          </div>
        </div>

        <div className="detail-actions">
          <button className="btn btn-outline" onClick={() => navigate('/my-reservations')}>
            목록으로
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReservationDetail;

