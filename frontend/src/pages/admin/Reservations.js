import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import './Reservations.css';

function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchReservations();
  }, [filter]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const params = filter ? { status: filter } : {};
      const response = await adminAPI.getAllReservations(params);
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

  if (loading) {
    return (
      <div className="container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="admin-reservations-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">예매 관리</h1>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === '' ? 'active' : ''}`}
              onClick={() => setFilter('')}
            >
              전체
            </button>
            <button
              className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              대기
            </button>
            <button
              className={`filter-btn ${filter === 'confirmed' ? 'active' : ''}`}
              onClick={() => setFilter('confirmed')}
            >
              완료
            </button>
            <button
              className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
              onClick={() => setFilter('cancelled')}
            >
              취소
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {reservations.length === 0 ? (
          <div className="empty-state">예매 내역이 없습니다.</div>
        ) : (
          <div className="reservations-table">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>예매번호</th>
                  <th>이벤트</th>
                  <th>사용자</th>
                  <th>장소</th>
                  <th>공연일</th>
                  <th>금액</th>
                  <th>상태</th>
                  <th>예매일</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="reservation-number">
                      {reservation.reservation_number}
                    </td>
                    <td className="event-title">{reservation.event_title}</td>
                    <td>
                      <div>{reservation.user_name}</div>
                      <div className="user-email">{reservation.user_email}</div>
                    </td>
                    <td>{reservation.venue}</td>
                    <td>{formatDate(reservation.event_date)}</td>
                    <td className="amount">₩{formatPrice(reservation.total_amount)}</td>
                    <td>
                      <div className="status-group">
                        <span className={`status-badge status-${reservation.status}`}>
                          {reservation.status === 'pending' && '대기'}
                          {reservation.status === 'confirmed' && '완료'}
                          {reservation.status === 'cancelled' && '취소'}
                        </span>
                        <span className={`status-badge status-${reservation.payment_status}`}>
                          {reservation.payment_status === 'pending' && '결제대기'}
                          {reservation.payment_status === 'completed' && '결제완료'}
                          {reservation.payment_status === 'failed' && '결제실패'}
                          {reservation.payment_status === 'refunded' && '환불'}
                        </span>
                      </div>
                    </td>
                    <td>{formatDate(reservation.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Reservations;

