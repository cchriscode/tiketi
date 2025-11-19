import React, { useState, useEffect, useCallback } from 'react';
import debounce from 'lodash.debounce';
import { eventsAPI } from '../services/api';
import EventCard from '../components/EventCard';
import './Home.css';

// 간단한 슬라이드 데이터
const slides = [
  { id: 1, title: '티켓 오픈 알림', subtitle: '인기 공연을 가장 먼저 예매하세요', theme: 'sky' },
  { id: 2, title: '실시간 좌석 선택', subtitle: '남아있는 좌석을 지금 즉시 잡으세요', theme: 'mint' },
  { id: 3, title: '얼리버드 · 패키지 혜택', subtitle: '티케티 단독 할인으로 더 알뜰하게', theme: 'lemon' }
];

function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('on_sale');
  const [current, setCurrent] = useState(0);

  // 중복 호출 방지를 위해 debounce 처리
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchEvents = useCallback(debounce(async () => {
      console.log('fetch Event!');
      const params = filter ? { status: filter } : {};
      const response = await eventsAPI.getAll(params);
      setEvents(response.data.events);
  }, 500), [filter]);

  const fetchEventsWithSpinner = useCallback(async () => {
    try {
      setLoading(true);
      await fetchEvents();
      setError(null);
    } catch (err) {
      setError('이벤트를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchEvents])

  // 자동 새로고침용 (로딩 스피너 없이 조용히 업데이트)
  const fetchEventsQuietly = useCallback(async () => {
    
    // 종료된 이벤트만 호출하는 경우 onCountdownExpired를 통해 재요청할 필요 없으므로 무시
    if(filter === 'ended') return;

    try {
      await fetchEvents();
      console.log('🔄 이벤트 목록 자동 새로고침 완료');
    } catch (err) {
      console.error('자동 새로고침 실패:', err);
    }
  }, [fetchEvents, filter]);

  const go = (dir) => {
    setCurrent((c) => (c + dir + slides.length) % slides.length);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);


  useEffect(() => {
    fetchEventsWithSpinner();
  }, [fetchEventsWithSpinner]);

  return (
    <div className="home-page">
      <div className="hero-slider">
        <div className="container">
          <div className="slider-frame">
            <button className="slider-arrow left" onClick={() => go(-1)} aria-label="이전 배너">‹</button>
            <div className="slides" style={{ transform: `translateX(-${current * 100}%)` }}>
              {slides.map((s) => (
                <div className={`slide theme-${s.theme}`} key={s.id}>
                  <div className="slide-inner">
                    <h1 className="hero-title">{s.title}</h1>
                    <p className="hero-subtitle">{s.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="slider-arrow right" onClick={() => go(1)} aria-label="다음 배너">›</button>
            <div className="slider-dots">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  className={`dot ${idx === current ? 'active' : ''}`}
                  onClick={() => setCurrent(idx)}
                  aria-label={`배너 ${idx + 1}`}
                />
              ))}
            </div>
          </div>
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
                onCountdownExpire={fetchEventsQuietly}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;

