import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

function TossPaymentFail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const code = searchParams.get('code');
  const message = searchParams.get('message');

  return (
    <div className="payment-container" style={{ textAlign: 'center', padding: '50px' }}>
      <div className="error-container">
        <h2>❌ 결제 실패</h2>
        <p>{message || '결제에 실패했습니다.'}</p>
        {code && <p style={{ fontSize: '0.9em', color: '#666' }}>오류 코드: {code}</p>}
        <button onClick={() => navigate('/')}>홈으로 돌아가기</button>
      </div>
    </div>
  );
}

export default TossPaymentFail;
