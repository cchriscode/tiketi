/**
 * EventCard Component
 * 이벤트 카드 with 실시간 카운트다운
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import './EventCard.css';

const EventCard = ({ event, onCountdownExpire }) => {
  // 판매 종료까지 남은 시간 (예매 중)
  const saleEndCountdown = useCountdown(event.sale_end_date, onCountdownExpire);
  
  // 판매 시작까지 남은 시간 (오픈 예정)
  const saleStartCountdown = useCountdown(event.sale_start_date, onCountdownExpire);

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

  const renderCountdown = () => {
    // 예매 중: 판매 종료까지 남은 시간
    if (event.status === 'on_sale') {
      if (saleEndCountdown.isExpired) {
        return (
          <div className="countdown expired">
            <span className="countdown-icon">⏰</span>
            <span className="countdown-text">판매 종료</span>
          </div>
        );
      }
      
      return (
        <div className="countdown on-sale">
          <span className="countdown-icon">⏰</span>
          <span className="countdown-label">판매 종료까지</span>
          <span className="countdown-time">
            {formatCountdown(saleEndCountdown, false)}
          </span>
        </div>
      );
    }

    // 오픈 예정: 판매 시작까지 남은 시간
    if (event.status === 'upcoming') {
      if (saleStartCountdown.isExpired) {
        return (
          <div className="countdown expired">
            <span className="countdown-icon">🎉</span>
            <span className="countdown-text">판매 시작!</span>
          </div>
        );
      }

      return (
        <div className="countdown upcoming">
          <span className="countdown-icon">🎯</span>
          <span className="countdown-label">오픈까지</span>
          <span className="countdown-time">
            {formatCountdown(saleStartCountdown, true)}
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <Link to={`/events/${event.id}`} className="event-card-link">
      <div className="event-card">
        {/* 포스터 이미지 */}
        <div className="event-card-image">
          {event.poster_image_url ? (
            <img src={event.poster_image_url} alt={event.title} />
          ) : (
            <div className="event-card-placeholder">
              <span>🎭</span>
            </div>
          )}
          {/* 상태 배지 */}
          <div className="event-card-badge">
            {getStatusBadge(event.status)}
          </div>
        </div>

        {/* 카운트다운 */}
        {(event.status === 'on_sale' || event.status === 'upcoming') && (
          <div className="event-card-countdown">
            {renderCountdown()}
          </div>
        )}

        {/* 이벤트 정보 */}
        <div className="event-card-content">
          <h3 className="event-card-title">{event.title}</h3>
          
          <div className="event-card-info">
            <div className="event-info-item">
              <span className="info-icon">📍</span>
              <span className="info-text">{event.venue}</span>
            </div>
            
            <div className="event-info-item">
              <span className="info-icon">📅</span>
              <span className="info-text">{formatDate(event.event_date)}</span>
            </div>
            
            {event.min_price && event.max_price && (
              <div className="event-info-item">
                <span className="info-icon">💰</span>
                <span className="info-text">
                  {formatPrice(event.min_price)}원 ~ {formatPrice(event.max_price)}원
                </span>
              </div>
            )}
          </div>

          <div className="event-card-footer">
            <button className="event-card-btn">
              {event.status === 'on_sale' ? '예매하기' : '자세히 보기'}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default EventCard;

