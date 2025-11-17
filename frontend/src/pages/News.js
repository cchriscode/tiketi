import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './News.css';
import { ReactComponent as LogoIcon } from '../images/tiketi-logo.svg';
import { newsAPI } from '../services/api';

function News() {
  const [newsList, setNewsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWriteForm, setShowWriteForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await newsAPI.getAll();
      setNewsList(response.data.news);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch news:', err);
      alert('뉴스를 불러오는데 실패했습니다.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    // Check if user is logged in
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.name) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      await newsAPI.create({
        ...formData,
        author: user.name
      });

      setFormData({ title: '', content: '' });
      setShowWriteForm(false);
      alert('게시글이 등록되었습니다.');

      // Refresh the news list
      fetchNews();
    } catch (err) {
      alert('게시글 등록에 실패했습니다.');
      console.error('Failed to create news:', err);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <div className="news-page">
      {/* Hero Section */}
      <div className="news-hero">
        <div className="container">
          <div className="news-hero-content">
            <LogoIcon width={48} height={48} className="news-logo" />
            <h1 className="news-main-title">TiKETI News</h1>
            <p className="news-subtitle">티케티의 새로운 소식을 만나보세요</p>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="news-content">
          {/* Write Button */}
          <div className="news-actions">
            <button
              className="btn-write"
              onClick={() => setShowWriteForm(!showWriteForm)}
            >
              {showWriteForm ? '취소' : '글쓰기'}
            </button>
          </div>

          {/* Write Form */}
          {showWriteForm && (
            <div className="write-form">
              <form onSubmit={handleSubmit}>
                <input
                  type="text"
                  placeholder="제목을 입력하세요"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
                <textarea
                  placeholder="내용을 입력하세요"
                  className="form-textarea"
                  rows="10"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                />
                <div className="form-actions">
                  <button type="submit" className="btn-submit">
                    등록
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* News List */}
          {loading ? (
            <div className="spinner"></div>
          ) : (
            <div className="news-list">
              <div className="news-list-header">
                <span className="col-title">제목</span>
                <span className="col-author">작성자</span>
                <span className="col-date">작성일</span>
                <span className="col-views">조회</span>
              </div>
              {newsList.length === 0 ? (
                <div className="empty-news">
                  <p>아직 등록된 소식이 없습니다.</p>
                </div>
              ) : (
                newsList.map((news) => (
                  <div key={news.id} className="news-item">
                    <div className="news-item-title">
                      <Link to={`/news/${news.id}`} className="news-link">
                        {news.title}
                      </Link>
                    </div>
                    <div className="news-item-author">{news.author}</div>
                    <div className="news-item-date">{formatDate(news.createdAt)}</div>
                    <div className="news-item-views">{news.views}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default News;
