import React, { useState, useEffect } from 'react';
import { eventsAPI } from '../services/api';
import EventCard from '../components/EventCard';
import './Home.css';

function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('on_sale');

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = filter ? { status: filter } : {};
      const response = await eventsAPI.getAll(params);
      setEvents(response.data.events);
      setError(null);
    } catch (err) {
      setError('이벤트를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 자동 새로고침용 (로딩 스피너 없이 조용히 업데이트)
  const fetchEventsQuietly = async () => {
    try {
      const params = filter ? { status: filter } : {};
      const response = await eventsAPI.getAll(params);
      setEvents(response.data.events);
      console.log('🔄 이벤트 목록 자동 새로고침 완료');
    } catch (err) {
      console.error('자동 새로고침 실패:', err);
    }
  };


  return (
    <div className="home-page">
      <div className="hero-section">
        <div className="container">
          <h1 className="hero-title">🎫 TIKETI</h1>
          <p className="hero-subtitle">간편하고 빠른 티켓 예매</p>
        </div>
      </div>

      <div className="container">
        <div className="filter-section">
          <button
            className={`filter-btn ${filter === 'on_sale' ? 'active' : ''}`}
            onClick={() => setFilter('on_sale')}
          >
            예매 중
          </button>
          <button
            className={`filter-btn ${filter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setFilter('upcoming')}
          >
            오픈 예정
          </button>
          <button
            className={`filter-btn ${filter === 'ended' ? 'active' : ''}`}
            onClick={() => setFilter('ended')}
          >
            예매 종료
          </button>
          <button
            className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setFilter('cancelled')}
          >
            취소됨
          </button>
          <button
            className={`filter-btn ${filter === '' ? 'active' : ''}`}
            onClick={() => setFilter('')}
          >
            전체
          </button>
        </div>

        {loading ? (
          <div className="spinner"></div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <p>이벤트가 없습니다.</p>
          </div>
        ) : (
          <div className="events-grid">
            {events.map((event) => (
              <EventCard 
                key={event.id} 
                event={event} 
                onCountdownExpire={() => fetchEventsQuietly()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;

