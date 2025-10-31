import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { eventsAPI, adminAPI } from '../../services/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import './Events.css';

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 상태 필터

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      // 관리자 페이지: 모든 이벤트를 limit 없이 가져오기
      const response = await eventsAPI.getAll({ limit: 1000 });

      // 클라이언트에서 최신순 정렬 (예매 시작일 기준 내림차순)
      const sortedEvents = response.data.events.sort((a, b) => {
        return new Date(b.sale_start_date) - new Date(a.sale_start_date);
      });

      setEvents(sortedEvents);
    } catch (err) {
      setError('이벤트 목록을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 상태별 필터링된 이벤트 목록
  const filteredEvents = statusFilter === 'all'
    ? events
    : events.filter(event => event.status === statusFilter);

  // 상태별 카운트
  const getStatusCount = (status) => {
    if (status === 'all') return events.length;
    return events.filter(event => event.status === status).length;
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('정말 이 이벤트를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await adminAPI.deleteEvent(eventId);
      alert('이벤트가 삭제되었습니다.');
      fetchEvents();
    } catch (err) {
      const message = err.response?.data?.error || '이벤트 삭제에 실패했습니다.';
      alert(message);
    }
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'yyyy.MM.dd HH:mm', { locale: ko });
  };

  if (loading) {
    return (
      <div className="container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="admin-events-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">이벤트 관리</h1>
          <Link to="/admin/events/new" className="btn btn-primary">
            + 새 이벤트
          </Link>
        </div>

        {/* 상태 필터 네비게이션 */}
        <div className="status-filter-nav">
          <button
            className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            전체 <span className="count">({getStatusCount('all')})</span>
          </button>
          <button
            className={`filter-tab ${statusFilter === 'on_sale' ? 'active' : ''}`}
            onClick={() => setStatusFilter('on_sale')}
          >
            예매 중 <span className="count">({getStatusCount('on_sale')})</span>
          </button>
          <button
            className={`filter-tab ${statusFilter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setStatusFilter('upcoming')}
          >
            오픈 예정 <span className="count">({getStatusCount('upcoming')})</span>
          </button>
          <button
            className={`filter-tab ${statusFilter === 'ended' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ended')}
          >
            종료 <span className="count">({getStatusCount('ended')})</span>
          </button>
          <button
            className={`filter-tab ${statusFilter === 'sold_out' ? 'active' : ''}`}
            onClick={() => setStatusFilter('sold_out')}
          >
            매진 <span className="count">({getStatusCount('sold_out')})</span>
          </button>
          <button
            className={`filter-tab ${statusFilter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setStatusFilter('cancelled')}
          >
            취소 <span className="count">({getStatusCount('cancelled')})</span>
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            <p>{statusFilter === 'all' ? '등록된 이벤트가 없습니다.' : '해당 상태의 이벤트가 없습니다.'}</p>
            {statusFilter === 'all' && (
              <Link to="/admin/events/new" className="btn btn-primary">
                첫 이벤트 만들기
              </Link>
            )}
          </div>
        ) : (
          <div className="events-grid">
            {filteredEvents.map((event) => (
              <div key={event.id} className="event-card">
                <div className="event-card-header">
                  <h3 className="event-card-title">{event.title}</h3>
                  <span className={`status-badge status-${event.status}`}>
                    {event.status === 'upcoming' && '오픈 예정'}
                    {event.status === 'on_sale' && '예매 중'}
                    {event.status === 'sold_out' && '매진'}
                    {event.status === 'ended' && '종료'}
                    {event.status === 'cancelled' && '취소'}
                  </span>
                </div>

                <div className="event-card-body">
                  <div className="event-info-row">
                    <span className="info-icon">📍</span>
                    <span className="info-text">{event.venue}</span>
                  </div>
                  <div className="event-info-row">
                    <span className="info-icon">📅</span>
                    <span className="info-text">{formatDate(event.event_date)}</span>
                  </div>
                  {event.artist_name && (
                    <div className="event-info-row">
                      <span className="info-icon">🎤</span>
                      <span className="info-text">{event.artist_name}</span>
                    </div>
                  )}
                </div>

                <div className="event-card-footer">
                  <Link
                    to={`/admin/events/edit/${event.id}`}
                    className="btn-action btn-edit"
                  >
                    수정
                  </Link>
                  <button
                    className="btn-action btn-delete"
                    onClick={() => handleDelete(event.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Events;

