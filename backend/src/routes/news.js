const express = require('express');
const db = require('../config/database');
const { logger } = require('../utils/logger');
const CustomError = require('../utils/custom-error');
const { authenticateToken } = require('../middleware/auth');
const { validate: isUUID } = require('uuid');

const router = express.Router();

const ensureUUID = (value, res, field = 'id') => {
  if (!isUUID(value)) {
    res.status(400).json({ error: `Invalid ${field} format` });
    return false;
  }
  return true;
};

/**
 * @swagger
 * /api/news:
 *   get:
 *     summary: 뉴스 목록 조회
 *     tags: [News]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: 뉴스 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 news:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/News'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT id, title, content, author, author_id, views, is_pinned, created_at, updated_at
       FROM ticket_schema.news
       ORDER BY is_pinned DESC, created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );

    const countResult = await db.query('SELECT COUNT(*) FROM ticket_schema.news');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      news: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(new CustomError(500, '뉴스 목록을 불러오는데 실패했습니다.', error));
  }
});

/**
 * @swagger
 * /api/news/{id}:
 *   get:
 *     summary: 뉴스 상세 조회
 *     tags: [News]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 뉴스 ID
 *     responses:
 *       200:
 *         description: 뉴스 상세 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 news:
 *                   $ref: '#/components/schemas/News'
 *       404:
 *         description: 뉴스를 찾을 수 없음
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureUUID(id, res)) return;

    // Increment views
    await db.query(
      'UPDATE ticket_schema.news SET views = views + 1 WHERE id = $1',
      [id]
    );

    // Get news
    const result = await db.query(
      `SELECT id, title, content, author, author_id, views, is_pinned, created_at, updated_at
       FROM ticket_schema.news
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '뉴스를 찾을 수 없습니다.' });
    }

    res.json({ news: result.rows[0] });
  } catch (error) {
    next(new CustomError(500, '뉴스를 불러오는데 실패했습니다.', error));
  }
});

/**
 * @swagger
 * /api/news:
 *   post:
 *     summary: 뉴스 작성
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *               - author
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               author:
 *                 type: string
 *               author_id:
 *                 type: string
 *                 format: uuid
 *               is_pinned:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: 뉴스 작성 성공
 *       400:
 *         description: 잘못된 요청
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { title, content, author, author_id, is_pinned = false } = req.body;

    if (!title || !content || !author) {
      return res.status(400).json({ error: '제목, 내용, 작성자는 필수입니다.' });
    }

    if (author_id) {
      if (!isUUID(author_id)) {
        return res.status(400).json({ error: 'Invalid author_id format' });
      }
      // Ensure author exists to avoid FK violation
      const userCheck = await db.query('SELECT 1 FROM auth_schema.users WHERE id = $1', [author_id]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: '존재하지 않는 작성자입니다.' });
      }
    }

    const result = await db.query(
      `INSERT INTO ticket_schema.news (title, content, author, author_id, is_pinned)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, content, author, author_id, views, is_pinned, created_at, updated_at`,
      [title, content, author, author_id || null, is_pinned]
    );

    res.status(201).json({ news: result.rows[0] });
  } catch (error) {
    next(new CustomError(500, '뉴스 작성에 실패했습니다.', error));
  }
});

/**
 * @swagger
 * /api/news/{id}:
 *   put:
 *     summary: 뉴스 수정
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 뉴스 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               is_pinned:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 뉴스 수정 성공
 *       400:
 *         description: 잘못된 요청
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 뉴스를 찾을 수 없음
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureUUID(id, res)) return;

    const { title, content, is_pinned } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
    }

    // Check if news exists and verify ownership
    const newsCheck = await db.query(
      'SELECT author_id FROM ticket_schema.news WHERE id = $1',
      [id]
    );

    if (newsCheck.rows.length === 0) {
      return res.status(404).json({ error: '뉴스를 찾을 수 없습니다.' });
    }

    // Verify permission: only owner can edit (admin cannot edit)
    const isOwner = newsCheck.rows[0].author_id === req.user.userId;

    if (!isOwner) {
      return res.status(403).json({ error: '작성자만 수정할 수 있습니다.' });
    }

    // Build dynamic query based on whether is_pinned is provided
    let query, params;
    if (is_pinned !== undefined) {
      query = `UPDATE ticket_schema.news
               SET title = $1, content = $2, is_pinned = $3
               WHERE id = $4
               RETURNING id, title, content, author, author_id, views, is_pinned, created_at, updated_at`;
      params = [title, content, is_pinned, id];
    } else {
      query = `UPDATE ticket_schema.news
               SET title = $1, content = $2
               WHERE id = $3
               RETURNING id, title, content, author, author_id, views, is_pinned, created_at, updated_at`;
      params = [title, content, id];
    }

    const result = await db.query(query, params);

    res.json({ news: result.rows[0] });
  } catch (error) {
    next(new CustomError(500, '뉴스 수정에 실패했습니다.', error));
  }
});

/**
 * @swagger
 * /api/news/{id}:
 *   delete:
 *     summary: 뉴스 삭제
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 뉴스 ID
 *     responses:
 *       200:
 *         description: 뉴스 삭제 성공
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 뉴스를 찾을 수 없음
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureUUID(id, res)) return;

    // Check if news exists and verify ownership
    const newsCheck = await db.query(
      'SELECT author_id FROM ticket_schema.news WHERE id = $1',
      [id]
    );

    if (newsCheck.rows.length === 0) {
      return res.status(404).json({ error: '뉴스를 찾을 수 없습니다.' });
    }

    // Verify permission: admin or owner
    const isAdmin = req.user.role === 'admin';
    const isOwner = newsCheck.rows[0].author_id === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    // Delete news
    await db.query('DELETE FROM ticket_schema.news WHERE id = $1', [id]);

    res.json({ message: '뉴스가 삭제되었습니다.' });
  } catch (error) {
    next(new CustomError(500, '뉴스 삭제에 실패했습니다.', error));
  }
});

module.exports = router;
