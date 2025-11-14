class CustomError extends Error {
    /**
     * @param {number} statusCode - HTTP 상태 코드 (예: 400, 404, 500)
     * @param {string} message - 클라이언트에게 보여줄 친절한 메시지
     * @param {any} [cause] - (선택) 실제 발생한 에러 원인 or 개발자용 상세 메시지
     */
    constructor(statusCode, message, cause) {
        super(message); // 부모(Error)의 message는 클라이언트용 메시지로 설정

        this.statusCode = statusCode;
        this.cause = cause; // 여기에 진짜 에러 내용(DB 에러 객체 등)을 담습니다.
        this.isOperational = true; // "우리가 예상하고 만든 에러다"라는 표시

        // 스택 트레이스 캡처
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = CustomError;