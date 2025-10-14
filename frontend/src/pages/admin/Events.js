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

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await eventsAPI.getAll({});
      setEvents(response.data.events);
    } catch (err) {
      setError('이벤트 목록을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
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

        {error && <div className="alert alert-error">{error}</div>}

        {events.length === 0 ? (
          <div className="empty-state">
            <p>등록된 이벤트가 없습니다.</p>
            <Link to="/admin/events/new" className="btn btn-primary">
              첫 이벤트 만들기
            </Link>
          </div>
        ) : (
          <div className="events-table">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>이벤트명</th>
                  <th>장소</th>
                  <th>공연일</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="event-title">{event.title}</td>
                    <td>{event.venue}</td>
                    <td>{formatDate(event.event_date)}</td>
                    <td>
                      <span className={`status-badge status-${event.status}`}>
                        {event.status === 'upcoming' && '오픈 예정'}
                        {event.status === 'on_sale' && '예매 중'}
                        {event.status === 'sold_out' && '매진'}
                        {event.status === 'ended' && '종료'}
                        {event.status === 'cancelled' && '취소'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
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
                    </td>
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

export default Events;

