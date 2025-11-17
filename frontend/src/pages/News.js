import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './News.css';
import { ReactComponent as LogoIcon } from '../images/tiketi-logo.svg';

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
      // TODO: API 호출로 변경
      // const response = await newsAPI.getAll();
      // setNewsList(response.data.news);

      // 임시 데이터
      setNewsList([
        {
          id: 1,
          title: 'TiKETI 서비스 정식 오픈!',
          content: '티케티가 정식으로 오픈했습니다. 많은 이용 부탁드립니다.',
          author: '관리자',
          createdAt: new Date().toISOString(),
          views: 125
        },
        {
          id: 2,
          title: '2024년 연말 콘서트 티켓 오픈 안내',
          content: '12월 연말 콘서트 티켓이 순차적으로 오픈됩니다.',
          author: '관리자',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          views: 89
        }
      ]);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    try {
      // TODO: API 호출로 변경
      // await newsAPI.create(formData);

      // 임시로 목록에 추가
      const newPost = {
        id: newsList.length + 1,
        ...formData,
        author: '사용자',
        createdAt: new Date().toISOString(),
        views: 0
      };
      setNewsList([newPost, ...newsList]);

      setFormData({ title: '', content: '' });
      setShowWriteForm(false);
      alert('게시글이 등록되었습니다.');
    } catch (err) {
      alert('게시글 등록에 실패했습니다.');
      console.error(err);
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
