import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminAPI, eventsAPI } from '../../services/api';
import api from '../../services/api';
import './EventForm.css';

function EventForm() {
  const navigate = useNavigate();
  const { id: eventId } = useParams(); // URL에서 이벤트 ID 가져오기
  const isEditMode = !!eventId;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    venue: '',
    address: '',
    eventDate: '',
    saleStartDate: '',
    saleEndDate: '',
    posterImageUrl: '',
    artistName: '',
    seatLayoutId: '',
    useSeatSelection: false,
    status: 'upcoming',
  });
  const [seatLayouts, setSeatLayouts] = useState([]);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const [error, setError] = useState(null);

  // 좌석 레이아웃 목록 가져오기
  useEffect(() => {
    const loadData = async () => {
      await fetchSeatLayouts();
    };
    loadData();
  }, []);

  // 수정 모드일 때 이벤트 데이터 가져오기 (레이아웃 목록 로드 후)
  useEffect(() => {
    if (isEditMode && seatLayouts.length > 0) {
      fetchEventData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, seatLayouts.length]);

  const fetchSeatLayouts = async () => {
    try {
      const response = await api.get('/seats/layouts');
      setSeatLayouts(response.data.layouts || []);
    } catch (err) {
      console.error('Failed to fetch seat layouts:', err);
    }
  };

  const fetchEventData = async () => {
    try {
      setLoading(true);
      console.log('📥 이벤트 데이터 로드 중...', eventId);
      
      const response = await eventsAPI.getById(eventId);
      const event = response.data.event; // 백엔드는 { event: {...}, ticketTypes: [...] } 형식으로 반환
      
      console.log('✅ 이벤트 데이터:', event);

      // UTC 시간을 한국 시간(KST, UTC+9)으로 변환하여 datetime-local input에 설정
      const newFormData = {
        title: event.title || '',
        description: event.description || '',
        venue: event.venue || '',
        address: event.address || '',
        eventDate: formatDateForInput(event.event_date),
        saleStartDate: formatDateForInput(event.sale_start_date),
        saleEndDate: formatDateForInput(event.sale_end_date),
        posterImageUrl: event.poster_image_url || '',
        artistName: event.artist_name || '',
        seatLayoutId: event.seat_layout_id || '',
        useSeatSelection: !!event.seat_layout_id,
        status: event.status || 'upcoming', // 읽기 전용, 표시용
      };
      
      console.log('📝 폼 데이터 설정:', newFormData);
      setFormData(newFormData);

      // 선택된 레이아웃 정보 설정
      if (event.seat_layout_id && seatLayouts.length > 0) {
        const layout = seatLayouts.find(l => l.id === event.seat_layout_id);
        console.log('🪑 좌석 레이아웃:', layout);
        setSelectedLayout(layout || null);
      }

      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch event:', err);
      setError('이벤트 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 서버에서 받은 UTC 날짜를 datetime-local input 형식으로 변환 (한국 시간 기준)
   * @param {string} dateString - ISO 날짜 문자열 (UTC)
   * @returns {string} - 'YYYY-MM-DDTHH:mm' 형식 (KST)
   */
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    
    // UTC 시간을 파싱
    const utcDate = new Date(dateString);
    
    // 한국 시간(UTC+9)으로 변환 - 9시간 추가
    const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
    
    // 'YYYY-MM-DDTHH:mm' 형식으로 포맷팅
    const year = kstDate.getUTCFullYear();
    const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getUTCDate()).padStart(2, '0');
    const hours = String(kstDate.getUTCHours()).padStart(2, '0');
    const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  /**
   * datetime-local input의 값을 서버로 보낼 UTC ISO 문자열로 변환
   * @param {string} inputValue - 'YYYY-MM-DDTHH:mm' 형식 (KST)
   * @returns {string} - ISO 날짜 문자열 (UTC)
   */
  const formatDateForServer = (inputValue) => {
    if (!inputValue) return '';
    
    // 입력값 파싱
    const [datePart, timePart] = inputValue.split('T');
    const [year, month, day] = datePart.split('-');
    const [hours, minutes] = timePart.split(':');
    
    // 한국 시간으로 Date 객체 생성 (UTC로 해석하되 실제론 KST)
    const kstDate = new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes)
    ));
    
    // 한국 시간(UTC+9)을 UTC로 변환하기 위해 9시간 빼기
    const utcDate = new Date(kstDate.getTime() - (9 * 60 * 60 * 1000));
    
    return utcDate.toISOString();
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSeatLayoutChange = (e) => {
    const layoutId = e.target.value;
    setFormData({ ...formData, seatLayoutId: layoutId });
    
    // 선택된 레이아웃 정보 찾기
    const layout = seatLayouts.find(l => l.id === layoutId);
    setSelectedLayout(layout);
  };

  const handleUseSeatSelectionChange = (e) => {
    const useSeat = e.target.checked;
    setFormData({
      ...formData,
      useSeatSelection: useSeat,
      seatLayoutId: useSeat ? formData.seatLayoutId : '',
    });
    if (!useSeat) {
      setSelectedLayout(null);
    }
  };

  const addTicketType = () => {
    setTicketTypes([
      ...ticketTypes,
      { name: '', price: '', totalQuantity: '', description: '' }
    ]);
  };

  const removeTicketType = (index) => {
    setTicketTypes(ticketTypes.filter((_, i) => i !== index));
  };

  const handleTicketTypeChange = (index, field, value) => {
    const updated = [...ticketTypes];
    updated[index][field] = value;
    setTicketTypes(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        venue: formData.venue,
        address: formData.address,
        eventDate: formatDateForServer(formData.eventDate),
        saleStartDate: formatDateForServer(formData.saleStartDate),
        saleEndDate: formatDateForServer(formData.saleEndDate),
        posterImageUrl: formData.posterImageUrl,
        artistName: formData.artistName,
        // status는 서버에서 자동으로 관리되므로 제외
      };

      if (isEditMode) {
        // 수정 모드: 기본 정보만 업데이트 (상태는 자동, 좌석/티켓 정보는 수정 불가)
        await adminAPI.updateEvent(eventId, payload);
        alert('이벤트가 수정되었습니다.');
      } else {
        // 생성 모드: 좌석/티켓 정보 포함
        payload.seatLayoutId = formData.useSeatSelection ? formData.seatLayoutId : null;
        payload.ticketTypes = formData.useSeatSelection ? [] : ticketTypes;
        
        await adminAPI.createEvent(payload);
        alert('이벤트가 생성되었습니다.');
      }

      navigate('/admin/events');
    } catch (err) {
      const message = err.response?.data?.error || (isEditMode ? '이벤트 수정에 실패했습니다.' : '이벤트 생성에 실패했습니다.');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEvent = async () => {
    if (!window.confirm('정말 이 이벤트를 취소하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없으며, 모든 예약이 취소됩니다.')) {
      return;
    }

    try {
      setCancelling(true);
      await adminAPI.cancelEvent(eventId);
      alert('이벤트가 취소되었습니다.');
      navigate('/admin/events');
    } catch (err) {
      const message = err.response?.data?.error || '이벤트 취소에 실패했습니다.';
      alert(message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="event-form-page">
        <div className="container">
          <div className="spinner"></div>
          <p style={{ textAlign: 'center', marginTop: '20px' }}>이벤트 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="event-form-page">
      <div className="container">
        <h1 className="page-title">{isEditMode ? '이벤트 수정' : '이벤트 생성'}</h1>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="event-form">
          {/* 기본 정보 */}
          <div className="form-section">
            <h2 className="section-title">기본 정보</h2>
            
            <div className="form-row">
              <div className="form-group full-width">
                <label className="form-label">이벤트명 *</label>
                <input
                  type="text"
                  name="title"
                  className="form-control"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="예: 아이유 2024 콘서트"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label className="form-label">아티스트/공연자</label>
                <input
                  type="text"
                  name="artistName"
                  className="form-control"
                  value={formData.artistName}
                  onChange={handleChange}
                  placeholder="예: 아이유"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label className="form-label">설명</label>
                <textarea
                  name="description"
                  className="form-control"
                  value={formData.description}
                  onChange={handleChange}
                  rows="4"
                  placeholder="이벤트에 대한 자세한 설명을 입력하세요"
                />
              </div>
            </div>
          </div>

          {/* 장소 정보 */}
          <div className="form-section">
            <h2 className="section-title">장소 정보</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">장소명 *</label>
                <input
                  type="text"
                  name="venue"
                  className="form-control"
                  value={formData.venue}
                  onChange={handleChange}
                  placeholder="예: 고척스카이돔"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">주소 *</label>
                <input
                  type="text"
                  name="address"
                  className="form-control"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="예: 서울특별시 구로구 경인로 430"
                  required
                />
              </div>
            </div>
          </div>

          {/* 일정 정보 */}
          <div className="form-section">
            <h2 className="section-title">일정 정보</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">공연일시 *</label>
                <input
                  type="datetime-local"
                  name="eventDate"
                  className="form-control"
                  value={formData.eventDate}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">판매 시작일시 *</label>
                <input
                  type="datetime-local"
                  name="saleStartDate"
                  className="form-control"
                  value={formData.saleStartDate}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">판매 종료일시 *</label>
                <input
                  type="datetime-local"
                  name="saleEndDate"
                  className="form-control"
                  value={formData.saleEndDate}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* 현재 상태 표시 (수정 모드에서만 표시) */}
          {isEditMode && (
            <div className="form-section">
              <h2 className="section-title">현재 상태</h2>
              
              <div className="status-display">
                <div className="status-badge-large">
                  <span className={`badge status-${formData.status}`}>
                    {formData.status === 'upcoming' && '⏰ 오픈 예정'}
                    {formData.status === 'on_sale' && '🎫 예매 중'}
                    {formData.status === 'sold_out' && '🚫 매진'}
                    {formData.status === 'ended' && '✅ 종료'}
                    {formData.status === 'cancelled' && '❌ 취소됨'}
                  </span>
                </div>
                <p className="status-info">
                  ℹ️ 이벤트 상태는 판매 시작/종료 시간에 따라 자동으로 업데이트됩니다.
                </p>
              </div>
            </div>
          )}

          {/* 좌석/티켓 설정 (생성 모드에서만 표시) */}
          {!isEditMode && (
            <div className="form-section">
            <h2 className="section-title">좌석/티켓 설정</h2>
            
            <div className="form-row">
              <div className="form-group full-width">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.useSeatSelection}
                    onChange={handleUseSeatSelectionChange}
                  />
                  <span>좌석 선택 방식 사용 (개별 좌석 선택)</span>
                </label>
                <p className="form-help">
                  체크 시: 사용자가 개별 좌석을 선택<br />
                  체크 해제 시: 티켓 등급(VIP, R석 등)으로 수량 선택
                </p>
              </div>
            </div>

            {formData.useSeatSelection ? (
              // 좌석 선택 방식
              <>
                <div className="form-row">
                  <div className="form-group full-width">
                    <label className="form-label">좌석 레이아웃 *</label>
                    <select
                      className="form-control"
                      value={formData.seatLayoutId}
                      onChange={handleSeatLayoutChange}
                      required
                    >
                      <option value="">레이아웃을 선택하세요</option>
                      {seatLayouts.map(layout => (
                        <option key={layout.id} value={layout.id}>
                          {layout.name} - {layout.description} ({layout.total_seats}석)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedLayout && (
                  <div className="layout-preview">
                    <h3>선택된 레이아웃 정보</h3>
                    <div className="layout-info">
                      <p><strong>이름:</strong> {selectedLayout.name}</p>
                      <p><strong>설명:</strong> {selectedLayout.description}</p>
                      <p><strong>총 좌석 수:</strong> {selectedLayout.total_seats}석</p>
                      <div className="sections-info">
                        <strong>구역별 가격:</strong>
                        <ul>
                          {selectedLayout.layout_config.sections.map((section, idx) => (
                            <li key={idx}>
                              {section.name}: {section.price.toLocaleString()}원 
                              ({section.rows}행 × {section.seatsPerRow}석)
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // 티켓 등급 방식
              <>
                <div className="ticket-types-section">
                  <div className="section-header">
                    <h3>티켓 등급</h3>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={addTicketType}
                    >
                      + 티켓 등급 추가
                    </button>
                  </div>

                  {ticketTypes.length === 0 && (
                    <p className="empty-message">
                      티켓 등급을 추가해주세요 (예: VIP석, R석, S석)
                    </p>
                  )}

                  {ticketTypes.map((ticket, index) => (
                    <div key={index} className="ticket-type-item">
                      <div className="ticket-type-header">
                        <h4>티켓 등급 {index + 1}</h4>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => removeTicketType(index)}
                        >
                          삭제
                        </button>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">등급명 *</label>
                          <input
                            type="text"
                            className="form-control"
                            value={ticket.name}
                            onChange={(e) => handleTicketTypeChange(index, 'name', e.target.value)}
                            placeholder="예: VIP석"
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">가격 *</label>
                          <input
                            type="number"
                            className="form-control"
                            value={ticket.price}
                            onChange={(e) => handleTicketTypeChange(index, 'price', e.target.value)}
                            placeholder="150000"
                            min="0"
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">총 수량 *</label>
                          <input
                            type="number"
                            className="form-control"
                            value={ticket.totalQuantity}
                            onChange={(e) => handleTicketTypeChange(index, 'totalQuantity', e.target.value)}
                            placeholder="100"
                            min="1"
                            required
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group full-width">
                          <label className="form-label">설명</label>
                          <input
                            type="text"
                            className="form-control"
                            value={ticket.description}
                            onChange={(e) => handleTicketTypeChange(index, 'description', e.target.value)}
                            placeholder="예: 최상의 시야와 사운드"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            </div>
          )}

          {/* 포스터 이미지 */}
          <div className="form-section">
            <h2 className="section-title">포스터 이미지</h2>
            
            <div className="form-row">
              <div className="form-group full-width">
                <label className="form-label">포스터 이미지 URL</label>
                <input
                  type="url"
                  name="posterImageUrl"
                  className="form-control"
                  value={formData.posterImageUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/poster.jpg"
                />
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate('/admin/events')}
            >
              돌아가기
            </button>
            
            {isEditMode && formData.status !== 'cancelled' && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCancelEvent}
                disabled={cancelling || submitting}
              >
                {cancelling ? '취소 처리 중...' : '🚫 이벤트 취소'}
              </button>
            )}
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || cancelling}
            >
              {submitting 
                ? (isEditMode ? '수정 중...' : '생성 중...') 
                : (isEditMode ? '✏️ 이벤트 수정' : '➕ 이벤트 생성')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EventForm;
