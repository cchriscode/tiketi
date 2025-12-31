import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { paymentsAPI } from '../services/api';
import './PaymentCallback.css';

function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, failed
  const [message, setMessage] = useState('결제를 처리하고 있습니다...');
  const [paymentInfo, setPaymentInfo] = useState(null);

  useEffect(() => {
    const confirmPayment = async () => {
      const paymentKey = searchParams.get('paymentKey');
      const orderId = searchParams.get('orderId');
      const amount = searchParams.get('amount');

      // Fail URL로 왔을 경우
      if (!paymentKey) {
        const code = searchParams.get('code');
        const errorMessage = searchParams.get('message');
        setStatus('failed');
        setMessage(errorMessage || '결제에 실패했습니다.');
        return;
      }

      try {
        // 결제 승인 API 호출 (통합 API 사용)
        const response = await paymentsAPI.confirm({
          paymentKey,
          orderId,
          amount: parseInt(amount),
        });

        if (response.data.success) {
          setStatus('success');
          setMessage('결제가 완료되었습니다!');
          setPaymentInfo(response.data.payment);

          // 3초 후 예매 내역으로 이동
          setTimeout(() => {
            navigate('/my-reservations');
          }, 3000);
        } else {
          throw new Error('Payment confirmation failed');
        }
      } catch (error) {
        console.error('Payment confirmation error:', error);
        setStatus('failed');
        setMessage(error.response?.data?.message || '결제 승인 중 오류가 발생했습니다.');
      }
    };

    confirmPayment();
  }, [searchParams, navigate]);

  return (
    <div className="payment-callback-container">
      <div className="callback-content">
        {status === 'processing' && (
          <>
            <div className="spinner"></div>
            <h2>{message}</h2>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="success-icon">✓</div>
            <h2 className="success-message">{message}</h2>
            {paymentInfo && (
              <div className="payment-details">
                <div className="detail-item">
                  <span className="label">주문번호</span>
                  <span className="value">{paymentInfo.orderId}</span>
                </div>
                <div className="detail-item">
                  <span className="label">결제금액</span>
                  <span className="value">{paymentInfo.amount?.toLocaleString()}원</span>
                </div>
                <div className="detail-item">
                  <span className="label">결제수단</span>
                  <span className="value">{paymentInfo.method}</span>
                </div>
                {paymentInfo.receiptUrl && (
                  <div className="detail-item">
                    <a
                      href={paymentInfo.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="receipt-link"
                    >
                      영수증 보기
                    </a>
                  </div>
                )}
              </div>
            )}
            <p className="redirect-message">잠시 후 예매 내역으로 이동합니다...</p>
            <button onClick={() => navigate('/my-reservations')} className="btn-primary">
              예매 내역 보기
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="error-icon">✕</div>
            <h2 className="error-message">결제 실패</h2>
            <p className="error-detail">{message}</p>
            <div className="button-group">
              <button onClick={() => navigate(-1)} className="btn-secondary">
                다시 시도
              </button>
              <button onClick={() => navigate('/')} className="btn-primary">
                홈으로
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentCallback;
