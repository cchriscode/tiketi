const express = require('express');
const db = require('../config/database');
const { logger } = require('../utils/logger');
const CustomError = require('../utils/custom-error');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all news (with pagination)
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT id, title, content, author, author_id, views, is_pinned, created_at, updated_at
       FROM news
       ORDER BY is_pinned DESC, created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );

    const countResult = await db.query('SELECT COUNT(*) FROM news');
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

// Get single news by ID (and increment views)
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Increment views
    await db.query(
      'UPDATE news SET views = views + 1 WHERE id = $1',
      [id]
    );

    // Get news
    const result = await db.query(
      `SELECT id, title, content, author, author_id, views, is_pinned, created_at, updated_at
       FROM news
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

// Create new news (requires authentication)
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { title, content, author, author_id, is_pinned = false } = req.body;

    if (!title || !content || !author) {
      return res.status(400).json({ error: '제목, 내용, 작성자는 필수입니다.' });
    }

    const result = await db.query(
      `INSERT INTO news (title, content, author, author_id, is_pinned)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, content, author, author_id, views, is_pinned, created_at, updated_at`,
      [title, content, author, author_id || null, is_pinned]
    );

    res.status(201).json({ news: result.rows[0] });
  } catch (error) {
    next(new CustomError(500, '뉴스 작성에 실패했습니다.', error));
  }
});

// Update news (requires authentication and ownership)
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, is_pinned } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
    }

    // Check if news exists and verify ownership
    const newsCheck = await db.query(
      'SELECT author_id FROM news WHERE id = $1',
      [id]
    );

    if (newsCheck.rows.length === 0) {
      return res.status(404).json({ error: '뉴스를 찾을 수 없습니다.' });
    }

    // Verify permission: admin or owner
    const isAdmin = req.user.role === 'admin';
    const isOwner = newsCheck.rows[0].author_id === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: '수정 권한이 없습니다.' });
    }

    // Build dynamic query based on whether is_pinned is provided
    let query, params;
    if (is_pinned !== undefined) {
      query = `UPDATE news
               SET title = $1, content = $2, is_pinned = $3
               WHERE id = $4
               RETURNING id, title, content, author, author_id, views, is_pinned, created_at, updated_at`;
      params = [title, content, is_pinned, id];
    } else {
      query = `UPDATE news
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

// Delete news (requires authentication and ownership)
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if news exists and verify ownership
    const newsCheck = await db.query(
      'SELECT author_id FROM news WHERE id = $1',
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
    await db.query('DELETE FROM news WHERE id = $1', [id]);

    res.json({ message: '뉴스가 삭제되었습니다.' });
  } catch (error) {
    next(new CustomError(500, '뉴스 삭제에 실패했습니다.', error));
  }
});

module.exports = router;
