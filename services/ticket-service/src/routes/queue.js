const express = require('express');
const queueManager = require('../services/queue-manager');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { emitToQueue } = require('../config/socket');
const router = express.Router();
const { logger } = require('../utils/logger');
const CustomError = require('../utils/custom-error');
const { validate: isUUID } = require('uuid');

const ensureValidEventId = (eventId, res) => {
  if (!isUUID(eventId)) {
    res.status(400).json({ error: 'Invalid event ID format' });
    return false;
  }
  return true;
};

/**
 * @swagger
 * /api/v1/queue/check/{eventId}:
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
 */
router.post('/check/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    const userId = req.user.userId;
    const eventInfo = await getEventInfo(eventId);

    const result = await queueManager.checkQueueEntry(eventId, userId);
    const queueSize = await queueManager.getQueueSize(eventId);
    
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
    'SELECT title, artist_name as artist FROM events WHERE id = $1',
    [eventId]
  );
  
  const info = result.rows[0] || { title: 'Unknown', artist: 'Unknown' };
  eventCache.set(eventId, info);
  
  setTimeout(() => eventCache.delete(eventId), 5 * 60 * 1000);
  
  return info;
}

/**
 * @swagger
 * /api/v1/queue/status/{eventId}:
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
 */
router.get('/status/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    const userId = req.user.userId;
    const status = await queueManager.getQueueStatus(eventId, userId);
    
    res.json(status);
  } catch (error) {
    next(new CustomError(500, '대기열 상태 조회에 실패했습니다.', error));
  }
});

/**
 * @swagger
 * /api/v1/queue/leave/{eventId}:
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
 */
router.post('/leave/:eventId', authenticate, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    const userId = req.user.userId;
    await queueManager.removeFromQueue(eventId, userId);
    await queueManager.removeActiveUser(eventId, userId);
    
    res.json({ message: '대기열에서 나왔습니다.' });
  } catch (error) {
    next(new CustomError(500, '대기열 나가기에 실패했습니다.', error));
  }
});

/**
 * @swagger
 * /api/v1/queue/admin/{eventId}:
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
 */
router.get('/admin/:eventId', authenticate, async (req, res, next) => {
  try {
    // TODO: 관리자 권한 체크 추가
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    const queueSize = await queueManager.getQueueSize(eventId);
    const currentUsers = await queueManager.getCurrentUsers(eventId);
    const threshold = await queueManager.getThreshold(eventId);
    
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
 * /api/v1/queue/admin/clear/{eventId}:
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
 */
router.post('/admin/clear/:eventId', authenticate, async (req, res, next) => {
  try {
    // TODO: 관리자 권한 체크 추가
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    await queueManager.clearQueue(eventId);
    
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
