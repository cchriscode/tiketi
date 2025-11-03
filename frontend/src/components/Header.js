import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Header.css';

function Header() {
  const [user, setUser] = useState(null);
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchText.trim();
    navigate(query ? `/?q=${encodeURIComponent(query)}` : '/');
  };

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="brand">
            <Link to="/" className="logo">
              <span className="logo-text">티케티 TIKETI</span>
            </Link>
            <div className="brand-subtitle">가장 빠른 티켓팅</div>
          </div>

          <form className="search" onSubmit={handleSearchSubmit} role="search">
            <input
              type="search"
              className="search-input"
              placeholder="콘서트 이름 검색"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              aria-label="콘서트 이름 검색"
            />
            <button type="submit" className="btn search-btn">검색</button>
          </form>

          <nav className="nav">
            <Link to="/" className="nav-link">이벤트</Link>
            {user ? (
              <>
                <Link to="/my-reservations" className="nav-link">내 예매</Link>
                {user.role === 'admin' && (
                  <Link to="/admin" className="nav-link admin-link">관리자</Link>
                )}
                <div className="user-menu">
                  <span className="user-name">{user.name}</span>
                  <button onClick={handleLogout} className="btn btn-sm btn-outline">로그아웃</button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">로그인</Link>
                <Link to="/register" className="btn btn-primary btn-sm">회원가입</Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;

