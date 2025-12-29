import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import axios from 'axios';
import './Auth.css';

function Login() {
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Google Sign-In 초기화
  useEffect(() => {
    // Google Identity Services 스크립트가 로드될 때까지 대기
    const initializeGoogleSignIn = () => {
      if (window.google && googleButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        });

        window.google.accounts.id.renderButton(
          googleButtonRef.current,
          {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            width: googleButtonRef.current.offsetWidth,
          }
        );
      }
    };

    // 스크립트 로드 확인
    if (window.google) {
      initializeGoogleSignIn();
    } else {
      window.addEventListener('load', initializeGoogleSignIn);
      return () => window.removeEventListener('load', initializeGoogleSignIn);
    }
  }, []);

  // Google 로그인 응답 처리
  const handleGoogleResponse = async (response) => {
    try {
      setLoading(true);
      setError(null);

      // Backend로 Google credential 전송
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const result = await axios.post(`${apiUrl}/api/auth/google`, {
        credential: response.credential,
      });

      const { token, user } = result.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // Redirect based on role
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }

      window.location.reload();
    } catch (err) {
      console.error('Google login error:', err);
      const message = err.response?.data?.error || '구글 로그인에 실패했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await authAPI.login(formData);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // Redirect based on role
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }

      window.location.reload();
    } catch (err) {
      const message = err.response?.data?.error || '로그인에 실패했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">로그인</h1>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">이메일</label>
              <input
                type="email"
                name="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="email@example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <input
                type="password"
                name="password"
                className="form-control"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="social-login-divider">
            <span>또는</span>
          </div>

          {/* Google Sign-In Button */}
          <div ref={googleButtonRef} className="google-signin-button"></div>

          <div className="auth-footer">
            <p>
              계정이 없으신가요?{' '}
              <Link to="/register" className="auth-link">
                회원가입
              </Link>
            </p>
          </div>

          <div className="demo-info">
            <p className="demo-title">테스트 계정</p>
            <p>관리자: admin@tiketi.gg / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

