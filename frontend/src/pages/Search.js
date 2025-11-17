import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import EventCard from '../components/EventCard';
import './Search.css';

function Search() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const location = useLocation();

  const searchQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('q') || '';
  }, [location.search]);

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, searchQuery]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter) params.status = filter;
      if (searchQuery) params.q = searchQuery;

      const response = await eventsAPI.getAll(params);
      setEvents(response.data.events);
      setError(null);
    } catch (err) {
      setError('검색 결과를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 자동 새로고침용 (로딩 스피너 없이 조용히 업데이트)
  const fetchEventsQuietly = async () => {
    try {
      const params = {};
      if (filter) params.status = filter;
      if (searchQuery) params.q = searchQuery;

      const response = await eventsAPI.getAll(params);
      setEvents(response.data.events);
      console.log('🔄 검색 결과 자동 새로고침 완료');
    } catch (err) {
      console.error('자동 새로고침 실패:', err);
    }
  };

  return (
    <div className="search-page">
      {/* Hero Banner */}
      <div className="search-hero">
        <div className="container">
          <h1 className="search-title">검색 결과</h1>
          {searchQuery && (
            <p className="search-query">"{searchQuery}"에 대한 검색 결과입니다.</p>
          )}
        </div>
      </div>

      <div className="container">
        <div className="search-layout">
          {/* Left Sidebar - Filters */}
          <aside className="search-sidebar">
            <h3 className="sidebar-title">필터</h3>
            <div className="filter-list">
              <button
                className={`filter-item ${filter === '' ? 'active' : ''}`}
                onClick={() => setFilter('')}
              >
                <span className="filter-icon">📋</span>
                <span className="filter-label">전체</span>
              </button>
              <button
                className={`filter-item ${filter === 'on_sale' ? 'active' : ''}`}
                onClick={() => setFilter('on_sale')}
              >
                <span className="filter-icon">🎫</span>
                <span className="filter-label">예매 중</span>
              </button>
              <button
                className={`filter-item ${filter === 'upcoming' ? 'active' : ''}`}
                onClick={() => setFilter('upcoming')}
              >
                <span className="filter-icon">⏰</span>
                <span className="filter-label">오픈 예정</span>
              </button>
              <button
                className={`filter-item ${filter === 'ended' ? 'active' : ''}`}
                onClick={() => setFilter('ended')}
              >
                <span className="filter-icon">✅</span>
                <span className="filter-label">예매 종료</span>
              </button>
              <button
                className={`filter-item ${filter === 'cancelled' ? 'active' : ''}`}
                onClick={() => setFilter('cancelled')}
              >
                <span className="filter-icon">❌</span>
                <span className="filter-label">취소됨</span>
              </button>
            </div>
          </aside>

          {/* Right Content - Search Results */}
          <main className="search-content">
            {loading ? (
              <div className="spinner"></div>
            ) : error ? (
              <div className="alert alert-error">{error}</div>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <p className="empty-icon">🔍</p>
                <p className="empty-message">
                  {searchQuery
                    ? `"${searchQuery}"에 대한 검색 결과가 없습니다.`
                    : '검색어를 입력해주세요.'}
                </p>
                <p className="empty-hint">다른 검색어로 다시 시도해보세요.</p>
              </div>
            ) : (
              <>
                <div className="search-result-header">
                  <p className="result-count">총 <strong>{events.length}</strong>개의 콘서트</p>
                </div>
                <div className="events-grid">
                  {events.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onCountdownExpire={() => fetchEventsQuietly()}
                    />
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default Search;
