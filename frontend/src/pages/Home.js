import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import './Home.css';

function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('on_sale');

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = filter ? { status: filter } : {};
      const response = await eventsAPI.getAll(params);
      setEvents(response.data.events);
    } catch (err) {
      setError('이벤트를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'yyyy년 M월 d일 (eee) HH:mm', { locale: ko });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  const getStatusBadge = (status) => {
    const badges = {
      upcoming: { text: '오픈 예정', class: 'badge-info' },
      on_sale: { text: '예매 중', class: 'badge-success' },
      sold_out: { text: '매진', class: 'badge-danger' },
      ended: { text: '종료', class: 'badge-secondary' },
      cancelled: { text: '취소', class: 'badge-danger' },
    };
    const badge = badges[status] || badges.upcoming;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
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
              <Link
                to={`/events/${event.id}`}
                key={event.id}
                className="event-card"
              >
                <div className="event-image">
                  {event.poster_image_url ? (
                    <img src={event.poster_image_url} alt={event.title} />
                  ) : (
                    <div className="event-image-placeholder">
                      <span>🎭</span>
                    </div>
                  )}
                  <div className="event-status">
                    {getStatusBadge(event.status)}
                  </div>
                </div>

                <div className="event-content">
                  <h3 className="event-title">{event.title}</h3>
                  <div className="event-info">
                    <div className="event-info-item">
                      <span className="icon">📍</span>
                      <span>{event.venue}</span>
                    </div>
                    <div className="event-info-item">
                      <span className="icon">📅</span>
                      <span>{formatDate(event.event_date)}</span>
                    </div>
                    {event.min_price && (
                      <div className="event-price">
                        {event.min_price === event.max_price ? (
                          <span>₩{formatPrice(event.min_price)}</span>
                        ) : (
                          <span>₩{formatPrice(event.min_price)} ~ ₩{formatPrice(event.max_price)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;

