import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { newsAPI } from '../services/api';
import './NewsDetail.css';

function NewsDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });

  useEffect(() => {
    fetchNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await newsAPI.getById(id);
      setNews(response.data.news);
      setFormData({
        title: response.data.news.title,
        content: response.data.news.content
      });
      setLoading(false);
    } catch (err) {
      console.error(err);
      alert('뉴스를 불러오는데 실패했습니다.');
      navigate('/news');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    try {
      await newsAPI.update(id, formData);
      alert('수정되었습니다.');
      setIsEditing(false);
      fetchNews();
    } catch (err) {
      alert('수정에 실패했습니다.');
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('정말 삭제하시겠습니까?')) {
      return;
    }

    try {
      await newsAPI.delete(id);
      alert('삭제되었습니다.');
      navigate('/news');
    } catch (err) {
      alert('삭제에 실패했습니다.');
      console.error(err);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="news-detail-page">
        <div className="container">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!news) {
    return null;
  }

  return (
    <div className="news-detail-page">
      <div className="container">
        <div className="news-detail-content">
          {isEditing ? (
            // Edit Mode
            <div className="edit-form">
              <form onSubmit={handleUpdate}>
                <input
                  type="text"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="제목"
                />
                <textarea
                  className="form-textarea"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="내용"
                  rows="15"
                />
                <div className="form-actions">
                  <button type="button" className="btn-cancel" onClick={() => setIsEditing(false)}>
                    취소
                  </button>
                  <button type="submit" className="btn-submit">
                    저장
                  </button>
                </div>
              </form>
            </div>
          ) : (
            // View Mode
            <>
              <div className="news-header">
                <h1 className="news-title">{news.title}</h1>
                <div className="news-meta">
                  <span className="meta-item">작성자: {news.author}</span>
                  <span className="meta-separator">|</span>
                  <span className="meta-item">작성일: {formatDate(news.created_at)}</span>
                  <span className="meta-separator">|</span>
                  <span className="meta-item">조회: {news.views}</span>
                </div>
              </div>

              <div className="news-body">
                {news.content.split('\n').map((line, index) => (
                  <p key={index}>{line || '\u00A0'}</p>
                ))}
              </div>

              <div className="news-actions">
                <button className="btn-back" onClick={() => navigate('/news')}>
                  목록
                </button>
                <div className="action-buttons">
                  <button className="btn-edit" onClick={() => setIsEditing(true)}>
                    수정
                  </button>
                  <button className="btn-delete" onClick={handleDelete}>
                    삭제
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default NewsDetail;
