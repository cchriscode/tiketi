class CustomError extends Error {
    /**
     * @param {number} statusCode - HTTP 상태 코드 (예: 400, 404, 500)
     * @param {string} message - 클라이언트에게 보여줄 친절한 메시지
     * @param {any} [cause] - (선택) 실제 발생한 에러 원인 or 개발자용 상세 메시지
     */
    constructor(statusCode, message, cause) {
        super(message);
        this.statusCode = statusCode;
        this.cause = cause;
        this.isOperational = true;
        this.name = 'CustomError';
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = { CustomError };
