import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import './EventForm.css';

function EventForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    venue: '',
    address: '',
    eventDate: '',
    saleStartDate: '',
    saleEndDate: '',
    posterImageUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await adminAPI.createEvent(formData);
      alert('이벤트가 생성되었습니다.');
      navigate('/admin/events');
    } catch (err) {
      const message = err.response?.data?.error || '이벤트 생성에 실패했습니다.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="event-form-page">
      <div className="container">
        <h1 className="page-title">이벤트 생성</h1>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="event-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">이벤트명 *</label>
              <input
                type="text"
                name="title"
                className="form-control"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">설명</label>
              <textarea
                name="description"
                className="form-control"
                value={formData.description}
                onChange={handleChange}
                rows="4"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">장소 *</label>
              <input
                type="text"
                name="venue"
                className="form-control"
                value={formData.venue}
                onChange={handleChange}
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
                required
              />
            </div>
          </div>

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
              <label className="form-label">판매 시작일 *</label>
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
              <label className="form-label">판매 종료일 *</label>
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

          <div className="form-row">
            <div className="form-group">
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

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate('/admin/events')}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? '생성 중...' : '이벤트 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EventForm;

