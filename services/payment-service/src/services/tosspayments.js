/**
 * TossPayments API 연동 서비스
 * 공식 문서: https://docs.tosspayments.com/reference
 */

const axios = require('axios');

class TossPaymentsService {
  constructor() {
    this.secretKey = process.env.TOSS_SECRET_KEY;
    this.clientKey = process.env.TOSS_CLIENT_KEY;
    this.apiUrl = process.env.TOSS_API_URL || 'https://api.tosspayments.com';

    // Secret Key를 Base64로 인코딩 (시크릿 키 뒤에 : 추가)
    this.encodedSecretKey = Buffer.from(`${this.secretKey}:`).toString('base64');

    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Basic ${this.encodedSecretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 결제 승인
   * POST /v1/payments/confirm
   *
   * @param {string} paymentKey - TossPayments에서 발급한 결제 키
   * @param {string} orderId - 가맹점에서 생성한 주문 ID (6-64자)
   * @param {number} amount - 결제 금액
   * @returns {Promise<Object>} 결제 승인 결과
   */
  async confirmPayment(paymentKey, orderId, amount) {
    try {
      const response = await this.axiosInstance.post('/v1/payments/confirm', {
        paymentKey,
        orderId,
        amount,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('TossPayments 결제 승인 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'UNKNOWN_ERROR',
          message: error.response?.data?.message || error.message,
          data: error.response?.data,
        },
      };
    }
  }

  /**
   * 결제 조회
   * GET /v1/payments/{paymentKey}
   *
   * @param {string} paymentKey - 결제 키
   * @returns {Promise<Object>} 결제 정보
   */
  async getPayment(paymentKey) {
    try {
      const response = await this.axiosInstance.get(`/v1/payments/${paymentKey}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('TossPayments 결제 조회 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'UNKNOWN_ERROR',
          message: error.response?.data?.message || error.message,
        },
      };
    }
  }

  /**
   * 결제 취소 (환불)
   * POST /v1/payments/{paymentKey}/cancel
   *
   * @param {string} paymentKey - 결제 키
   * @param {string} cancelReason - 취소 사유
   * @param {number} cancelAmount - 취소 금액 (부분 취소 시)
   * @returns {Promise<Object>} 취소 결과
   */
  async cancelPayment(paymentKey, cancelReason, cancelAmount = null) {
    try {
      const payload = {
        cancelReason,
      };

      if (cancelAmount) {
        payload.cancelAmount = cancelAmount;
      }

      const response = await this.axiosInstance.post(`/v1/payments/${paymentKey}/cancel`, payload);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('TossPayments 결제 취소 실패:', error.response?.data || error.message);

      return {
        success: false,
        error: {
          code: error.response?.data?.code || 'UNKNOWN_ERROR',
          message: error.response?.data?.message || error.message,
        },
      };
    }
  }

  /**
   * OrderId 생성 (6-64자, 영문/숫자/-/_만 허용)
   */
  generateOrderId(prefix = 'ORDER') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * 결제 요청을 위한 클라이언트 키 반환
   */
  getClientKey() {
    return this.clientKey;
  }
}

// Singleton instance
const tossPaymentsService = new TossPaymentsService();

module.exports = tossPaymentsService;
