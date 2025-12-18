import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import './Dashboard.css';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentReservations, setRecentReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getDashboardStats();
      setStats(response.data.stats);
      setRecentReservations(response.data.recentReservations);
    } catch (err) {
      setError('대시보드 정보를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'MM/dd HH:mm', { locale: ko });
  };

  if (loading) {
    return (
      <div className="container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="container">
        <div className="admin-header">
          <h1 className="admin-title">관리자 대시보드</h1>
          <div className="admin-nav">
            <Link to="/admin/events" className="btn btn-primary">
              이벤트 관리
            </Link>
            <Link to="/admin/reservations" className="btn btn-outline">
              예매 관리
            </Link>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {stats && (
          <div className="stats-grid">
            <div className="stat-card stat-primary">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-label">총 이벤트</div>
                <div className="stat-value">{stats.totalEvents}</div>
              </div>
            </div>

            <div className="stat-card stat-success">
              <div className="stat-icon">🎫</div>
              <div className="stat-content">
                <div className="stat-label">총 예매</div>
                <div className="stat-value">{stats.totalReservations}</div>
              </div>
            </div>

            <div className="stat-card stat-warning">
              <div className="stat-icon">💰</div>
              <div className="stat-content">
                <div className="stat-label">총 매출</div>
                <div className="stat-value">₩{formatPrice(stats.totalRevenue)}</div>
              </div>
            </div>

            <div className="stat-card stat-info">
              <div className="stat-icon">📅</div>
              <div className="stat-content">
                <div className="stat-label">오늘 예매</div>
                <div className="stat-value">{stats.todayReservations}</div>
              </div>
            </div>
          </div>
        )}

        <div className="recent-section">
          <h2 className="section-title">최근 예매</h2>
          {recentReservations.length === 0 ? (
            <div className="empty-state">예매 내역이 없습니다.</div>
          ) : (
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>예매번호</th>
                    <th>이벤트</th>
                    <th>사용자</th>
                    <th>금액</th>
                    <th>상태</th>
                    <th>예매일</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td className="reservation-number">{reservation.reservation_number}</td>
                      <td className="event-title">{reservation.event_title}</td>
                      <td>
                        <div>{reservation.user_name}</div>
                        <div className="user-email">{reservation.user_email}</div>
                      </td>
                      <td className="amount">₩{formatPrice(reservation.total_amount)}</td>
                      <td>
                        <span className={`status-badge status-${reservation.status}`}>
                          {reservation.status === 'pending' && '대기'}
                          {reservation.status === 'confirmed' && '완료'}
                          {reservation.status === 'cancelled' && '취소'}
                        </span>
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
    </div>
  );
}

export default Dashboard;

