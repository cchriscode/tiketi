const express = require('express');
const queueManager = require('../services/queue-manager');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { emitToQueue } = require('../config/socket');
const router = express.Router();
const { logger } = require('../utils/logger');
const CustomError = require('../utils/custom-error');
const { validate: isUUID } = require('uuid');

// 메트릭 import 추가
const { queueUsers } = require('../metrics');

const ensureValidEventId = (eventId, res) => {
  if (!isUUID(eventId)) {
    res.status(400).json({ error: 'Invalid event ID format' });
    return false;
  }
  return true;
};

/**
 * @swagger
 * /api/queue/check/{eventId}:
 *   post:
 *     summary: 대기열 진입 확인
 *     tags: [Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 이벤트 ID
 *     responses:
 *       200:
 *         description: 대기열 진입 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.post('/check/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    const userId = req.user.id || req.user.userId;
    // 이벤트 정보 조회 (캐싱 권장)
    const eventInfo = await getEventInfo(eventId);

    const result = await queueManager.checkQueueEntry(eventId, userId);
    
    // 메트릭 업데이트 (이벤트 정보 포함)
    const queueSize = await queueManager.getQueueSize(eventId);
    queueUsers.labels(
      eventId, 
      eventInfo.title || 'Unknown',
      eventInfo.artist || 'Unknown'
    ).set(queueSize);
    
    res.json(result);
  } catch (error) {
    next(new CustomError(500, '대기열 확인에 실패했습니다.', error));
  }
});

// 이벤트 정보 캐싱 함수
const eventCache = new Map();
async function getEventInfo(eventId) {
  if (eventCache.has(eventId)) {
    return eventCache.get(eventId);
  }
  
  const result = await db.query(
    'SELECT title, artist FROM events WHERE id = $1',
    [eventId]
  );
  
  const info = result.rows[0] || { title: 'Unknown', artist: 'Unknown' };
  eventCache.set(eventId, info);
  
  // 5분 후 캐시 만료
  setTimeout(() => eventCache.delete(eventId), 5 * 60 * 1000);
  
  return info;
}

/**
 * @swagger
 * /api/queue/status/{eventId}:
 *   get:
 *     summary: 대기열 상태 조회
 *     tags: [Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 이벤트 ID
 *     responses:
 *       200:
 *         description: 대기열 상태
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/status/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    const userId = req.user.id || req.user.userId;
    const status = await queueManager.getQueueStatus(eventId, userId);
    
    // 메트릭 업데이트
    const queueSize = await queueManager.getQueueSize(eventId);
    queueUsers.labels(eventId).set(queueSize);
    
    res.json(status);
  } catch (error) {
    next(new CustomError(500, '대기열 상태 조회에 실패했습니다.', error));
  }
});

/**
 * @swagger
 * /api/queue/leave/{eventId}:
 *   post:
 *     summary: 대기열에서 나가기
 *     tags: [Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 이벤트 ID
 *     responses:
 *       200:
 *         description: 대기열 나가기 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post('/leave/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    const userId = req.user.id || req.user.userId;
    await queueManager.removeFromQueue(eventId, userId);
    await queueManager.removeActiveUser(eventId, userId);
    
    // 메트릭 업데이트
    const queueSize = await queueManager.getQueueSize(eventId);
    queueUsers.labels(eventId).set(queueSize);
    
    res.json({ message: '대기열에서 나왔습니다.' });
  } catch (error) {
    next(new CustomError(500, '대기열 나가기에 실패했습니다.', error));
  }
});

/**
 * @swagger
 * /api/queue/admin/{eventId}:
 *   get:
 *     summary: 대기열 정보 조회 (관리자)
 *     tags: [Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 이벤트 ID
 *     responses:
 *       200:
 *         description: 대기열 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 eventId:
 *                   type: string
 *                   format: uuid
 *                 queueSize:
 *                   type: integer
 *                 currentUsers:
 *                   type: integer
 *                 threshold:
 *                   type: integer
 *                 available:
 *                   type: integer
 */
router.get('/admin/:eventId', authenticate, async (req, res, next) => {
  try {
    // TODO: 관리자 권한 체크 추가
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    const queueSize = await queueManager.getQueueSize(eventId);
    const currentUsers = await queueManager.getCurrentUsers(eventId);
    const threshold = await queueManager.getThreshold(eventId);
    
    // 메트릭 업데이트
    queueUsers.labels(eventId).set(queueSize);
    
    res.json({
      eventId,
      queueSize,
      currentUsers,
      threshold,
      available: threshold - currentUsers,
    });
  } catch (error) {
    next(new CustomError(500, '대기열 정보 조회에 실패했습니다.', error));
  }
});

/**
 * @swagger
 * /api/queue/admin/clear/{eventId}:
 *   post:
 *     summary: 대기열 초기화 (관리자)
 *     tags: [Queue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 이벤트 ID
 *     responses:
 *       200:
 *         description: 대기열 초기화 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post('/admin/clear/:eventId', authenticate, async (req, res, next) => {
  try {
    // TODO: 관리자 권한 체크 추가
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    await queueManager.clearQueue(eventId);
    
    // 메트릭 초기화
    queueUsers.labels(eventId).set(0);
    
    // 대기열 사용자들에게 알림
    const io = req.app.locals.io;
    emitToQueue(io, eventId, 'queue-cleared', {
      message: '관리자가 대기열을 초기화했습니다.',
    });
    res.json({ message: '대기열이 초기화되었습니다.' });
  } catch (error) {
    next(new CustomError(500, '대기열 초기화에 실패했습니다.', error));
  }
});

module.exports = router;
