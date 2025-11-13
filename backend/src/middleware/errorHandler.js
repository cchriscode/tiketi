const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {

    // 1. 기록하고 싶은 헤더 정보 추출
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const requestId = req.headers['x-request-id'] || 'unknown'; // 추적용 ID가 있다면

    // 2. 로그에 남길 데이터 조립 (민감한 정보인 토큰 등은 제외하거나 마스킹하세요!)
    const logData = {
        message: err.message,
        stack: err.stack,           // 에러 스택 트레이스
        method: req.method,         // GET, POST 등
        url: req.originalUrl,       // 요청한 URL
        headers: {
            userAgent: userAgent,
            clientIp: clientIp,
            requestId: requestId,
            // 필요한 다른 헤더가 있다면 여기에 추가: req.headers['my-custom-header']
        },
    };

    // 3. Winston으로 에러 로그 출력
    logger.error(logData);

    // 4. 클라이언트에게 응답 (보안상 상세 스택은 숨기는 게 좋음)
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
};

module.exports = errorHandler;