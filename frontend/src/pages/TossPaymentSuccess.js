import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import axios from 'axios';

function TossPaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    const confirmPayment = async () => {
      const paymentKey = searchParams.get('paymentKey');
      const orderId = searchParams.get('orderId');
      const amount = searchParams.get('amount');
      const reservationId = searchParams.get('reservationId');

      if (!paymentKey || !orderId || !amount) {
        setError('결제 정보가 올바르지 않습니다.');
        setStatus('error');
        return;
      }

      try {
        // Get Payment Service URL (port 3003)
        const hostname = window.location.hostname;
        let paymentServiceUrl;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          paymentServiceUrl = 'http://localhost:3003';
        } else if (hostname.match(/^(172\.|192\.168\.|10\.)/)) {
          // WSL IP or local network
          paymentServiceUrl = `http://${hostname}:3003`;
        } else {
          // Production
          paymentServiceUrl = `${window.location.protocol}//${hostname}:3003`;
        }

        // Payment Service에 결제 승인 요청
        const token = localStorage.getItem('token');
        const response = await axios.post(`${paymentServiceUrl}/payments/confirm`, {
          paymentKey,
          orderId,
          amount: parseInt(amount),
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.data.success) {
          setStatus('success');
          // 2초 후 예약 상세 페이지로 이동
          setTimeout(() => {
            navigate(`/payment-success/${reservationId}`);
          }, 2000);
        }
      } catch (error) {
        console.error('Payment confirmation failed:', error);
        setError(error.response?.data?.message || '결제 승인에 실패했습니다.');
        setStatus('error');
      }
    };

    confirmPayment();
  }, [searchParams, navigate]);

  if (status === 'processing') {
    return (
      <div className="payment-container" style={{ textAlign: 'center', padding: '50px' }}>
        <div className="loading">
          <h2>결제를 처리하고 있습니다...</h2>
          <p>잠시만 기다려주세요.</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="payment-container" style={{ textAlign: 'center', padding: '50px' }}>
        <div className="success">
          <h2>✅ 결제가 완료되었습니다!</h2>
          <p>예약 상세 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="payment-container" style={{ textAlign: 'center', padding: '50px' }}>
        <div className="error-container">
          <h2>❌ 결제 처리 실패</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')}>홈으로 돌아가기</button>
        </div>
      </div>
    );
  }

  return null;
}

export default TossPaymentSuccess;
