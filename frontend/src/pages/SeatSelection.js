import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useSeatUpdates } from '../hooks/useSocket';
import {
  SEAT_STATUS,
  SEAT_STATUS_DISPLAY,
  SEAT_STATUS_COLORS,
  RESERVATION_SETTINGS,
  ERROR_MESSAGES,
  API_ENDPOINTS,
} from '../shared/constants';
import './SeatSelection.css';

function SeatSelection() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState(null);
  const [layout, setLayout] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState(null);

  // 실시간 좌석 상태 업데이트 콜백
  const handleSeatUpdate = useCallback((data) => {
    const { seatId, status } = data;

    setSeats((prevSeats) =>
      prevSeats.map((seat) =>
        seat.id === seatId ? { ...seat, status } : seat
      )
    );

    // 선택한 좌석이 다른 사람에게 예약되면 선택 해제
    if (status === SEAT_STATUS.LOCKED || status === SEAT_STATUS.RESERVED) {
      setSelectedSeats((prev) => prev.filter((s) => s.id !== seatId));
    }

    console.log(`🪑 Seat ${seatId} updated: ${status}`);
  }, []);

  // WebSocket 연결 및 실시간 업데이트 구독
  useSeatUpdates(eventId, handleSeatUpdate);

  const fetchSeats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.GET_SEATS(eventId));
      setEvent(response.data.event);
      setLayout(response.data.layout);
      setSeats(response.data.seats);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch seats:', error);
      setError('좌석 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchSeats();
  }, [fetchSeats]);

  const handleSeatClick = (seat) => {
    // Cannot select if reserved or locked
    if (seat.status === SEAT_STATUS.RESERVED || seat.status === SEAT_STATUS.LOCKED) {
      alert(SEAT_STATUS_DISPLAY[seat.status]);
      return;
    }

    const isSelected = selectedSeats.find(s => s.id === seat.id);

    if (isSelected) {
      // Deselect
      setSelectedSeats(selectedSeats.filter(s => s.id !== seat.id));
    } else {
      // Check max seats limit
      if (selectedSeats.length >= RESERVATION_SETTINGS.MAX_SEATS_PER_RESERVATION) {
        alert(ERROR_MESSAGES.MAX_SEATS_EXCEEDED);
        return;
      }
      // Select
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  const handleReserve = async () => {
    if (selectedSeats.length === 0) {
      alert(ERROR_MESSAGES.NO_SEAT_SELECTED);
      return;
    }

    try {
      setReserving(true);
      const response = await api.post(API_ENDPOINTS.RESERVE_SEATS, {
        eventId,
        seatIds: selectedSeats.map(s => s.id),
      });

      // Navigate to payment page
      navigate(`/payment/${response.data.reservation.id}`);
    } catch (error) {
      console.error('Failed to reserve seats:', error);
      alert(error.response?.data?.error || '좌석 예약에 실패했습니다.');
      // Refresh seats to get updated status
      fetchSeats();
      setSelectedSeats([]);
    } finally {
      setReserving(false);
    }
  };

  const getTotalAmount = () => {
    return selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
  };

  const groupSeatsBySection = () => {
    if (!layout || !seats.length) return {};

    const grouped = {};

    layout.sections.forEach(section => {
      const sectionSeats = seats.filter(s => s.section === section.name);
      
      // Group by row
      const rowsMap = {};
      sectionSeats.forEach(seat => {
        if (!rowsMap[seat.row_number]) {
          rowsMap[seat.row_number] = [];
        }
        rowsMap[seat.row_number].push(seat);
      });

      // Sort seats in each row
      Object.keys(rowsMap).forEach(rowNum => {
        rowsMap[rowNum].sort((a, b) => a.seat_number - b.seat_number);
      });

      grouped[section.name] = {
        ...section,
        rows: rowsMap,
      };
    });

    return grouped;
  };

  const getSeatDisplayStatus = (seat) => {
    const isSelected = selectedSeats.find(s => s.id === seat.id);
    return isSelected ? SEAT_STATUS.SELECTED : seat.status;
  };

  if (loading) {
    return <div className="loading">좌석 정보를 불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={() => navigate(`/events/${eventId}`)}>이벤트로 돌아가기</button>
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="error-container">
        <p>이 이벤트는 좌석 선택이 불가능합니다.</p>
        <button onClick={() => navigate(`/events/${eventId}`)}>이벤트로 돌아가기</button>
      </div>
    );
  }

  const sectionedSeats = groupSeatsBySection();

  return (
    <div className="seat-selection-container">
      <header className="seat-selection-header">
        <div className="header-content">
          <h1>{event?.title}</h1>
          <p className="seat-selection-guide">
            💡 좌석을 클릭하여 선택하세요 (최대 {RESERVATION_SETTINGS.MAX_SEATS_PER_RESERVATION}석)
          </p>
        </div>
        <button className="back-btn" onClick={() => navigate(`/events/${eventId}`)}>
          ← 뒤로가기
        </button>
      </header>

      <div className="seat-map-container">
        {/* Stage */}
        <div className="stage">
          <div className="stage-label">STAGE</div>
        </div>

        {/* Sections */}
        <div className="sections-container">
          {Object.entries(sectionedSeats).map(([sectionName, section]) => (
            <div key={sectionName} className="section">
              <h3 className="section-title">
                {sectionName} - {section.price?.toLocaleString()}원
              </h3>
              
              <div className="seat-grid">
                {Object.entries(section.rows).map(([rowNum, rowSeats]) => (
                  <div key={rowNum} className="seat-row">
                    <span className="row-label">{rowNum}열</span>
                    <div className="seats">
                      {rowSeats.map(seat => {
                        const displayStatus = getSeatDisplayStatus(seat);
                        return (
                          <button
                            key={seat.id}
                            className={`seat seat-${displayStatus}`}
                            style={{
                              backgroundColor: SEAT_STATUS_COLORS[displayStatus],
                            }}
                            onClick={() => handleSeatClick(seat)}
                            disabled={
                              seat.status === SEAT_STATUS.RESERVED ||
                              seat.status === SEAT_STATUS.LOCKED ||
                              reserving
                            }
                            title={`${seat.seat_label} - ${SEAT_STATUS_DISPLAY[displayStatus]}`}
                          >
                            {seat.seat_number}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Selection Summary */}
      <div className="selection-summary">
        {/* Legend */}
        <div className="seat-legend">
          {Object.entries(SEAT_STATUS).map(([key, value]) => (
            <div key={value} className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: SEAT_STATUS_COLORS[value] }}
              ></div>
              <span>{SEAT_STATUS_DISPLAY[value]}</span>
            </div>
          ))}
        </div>

        <div className="summary-content">
          <div className="selected-seats-info">
            <h3>선택한 좌석 ({selectedSeats.length}개)</h3>
            {selectedSeats.length > 0 ? (
              <div className="selected-seats-list">
                {selectedSeats.map(seat => (
                  <span key={seat.id} className="selected-seat-tag">
                    {seat.seat_label}
                    <button
                      className="remove-seat-btn"
                      onClick={() => handleSeatClick(seat)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="no-selection">좌석을 선택해주세요</p>
            )}
          </div>

          <div className="summary-actions">
            <div className="total-amount">
              <span className="label">총 결제금액</span>
              <span className="amount">{getTotalAmount().toLocaleString()}원</span>
            </div>
            <button
              className="reserve-btn"
              onClick={handleReserve}
              disabled={selectedSeats.length === 0 || reserving}
            >
              {reserving ? '예약 처리 중...' : '결제하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SeatSelection;

