// src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info', // info 레벨 이상만 출력
    format: winston.format.combine(
        winston.format.timestamp(), // 시간 기록
        winston.format.json()       // ★핵심: JSON 형태로 출력
    ),
    transports: [
        new winston.transports.Console() // Docker 환경이므로 콘솔(stdout)에 출력하면 Promtail이 가져감
    ],
});

module.exports = logger;