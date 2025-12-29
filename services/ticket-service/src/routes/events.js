const express = require('express');
const db = require('../config/database');
const { client: redisClient } = require('../config/redis');
const {
  CACHE_KEYS,
  CACHE_SETTINGS,
  PAGINATION_DEFAULTS,
} = require('@tiketi/common');
const { logger } = require('@tiketi/common');
const { CustomError } = require('@tiketi/common');
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
 * /api/v1/events:
 *   get:
 *     summary: 이벤트 목록 조회
 *     tags: [Events]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [upcoming, on_sale, sold_out, ended, cancelled]
 *         description: 이벤트 상태 필터
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: 검색어
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 페이지당 항목 수
 *     responses:
 *       200:
 *         description: 이벤트 목록
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      status,
      q: searchQuery,
      page = PAGINATION_DEFAULTS.PAGE,
      limit = PAGINATION_DEFAULTS.EVENTS_LIMIT
    } = req.query;
    const offset = (page - 1) * limit;

    const cacheKey = CACHE_KEYS.EVENTS_LIST(status, page, limit, searchQuery);
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    let query = `
      SELECT
        e.id, e.title, e.description, e.venue, e.address,
        e.event_date, e.sale_start_date, e.sale_end_date,
        e.poster_image_url, e.status, e.artist_name,
        COUNT(DISTINCT tt.id) as ticket_type_count,
        MIN(tt.price) as min_price,
        MAX(tt.price) as max_price
      FROM events e
      LEFT JOIN ticket_types tt ON e.id = tt.event_id
    `;

    const params = [];
    const whereConditions = [];

    if (status) {
      whereConditions.push(`e.status = $${params.length + 1}`);
      params.push(status);
    }

    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim();
      let searchTerms = [searchTerm];

      try {
        const mappingResult = await db.query(`
          SELECT DISTINCT english FROM keyword_mappings WHERE korean ILIKE $1
          UNION
          SELECT DISTINCT korean FROM keyword_mappings WHERE english ILIKE $1
        `, [`%${searchTerm}%`]);

        searchTerms = [searchTerm, ...mappingResult.rows.map(row => row.english || row.korean)];
      } catch (err) {
        logger.debug('keyword_mappings 테이블 없음, 기본 검색만 사용');
      }

      const searchConditions = searchTerms.map((term, index) => {
        params.push(`%${term}%`);
        return `(
          COALESCE(e.title, '') || ' ' ||
          COALESCE(e.artist_name, '') || ' ' ||
          COALESCE(e.venue, '') || ' ' ||
          COALESCE(e.address, '')
        ) ILIKE $${params.length}`;
      });

      whereConditions.push(`(${searchConditions.join(' OR ')})`);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' GROUP BY e.id ORDER BY e.sale_start_date ASC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);

    let countQuery = 'SELECT COUNT(*) FROM events e';
    const countParams = [];
    const countWhereConditions = [];

    if (status) {
      countWhereConditions.push(`e.status = $${countParams.length + 1}`);
      countParams.push(status);
    }

    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim();
      let countSearchTerms = [searchTerm];

      try {
        const countMappingResult = await db.query(`
          SELECT DISTINCT english FROM keyword_mappings WHERE korean ILIKE $1
          UNION
          SELECT DISTINCT korean FROM keyword_mappings WHERE english ILIKE $1
        `, [`%${searchTerm}%`]);

        countSearchTerms = [searchTerm, ...countMappingResult.rows.map(row => row.english || row.korean)];
      } catch (err) {
        logger.debug('keyword_mappings 테이블 없음 (count), 기본 검색만 사용');
      }

      const countSearchConditions = countSearchTerms.map((term, index) => {
        countParams.push(`%${term}%`);
        return `(
          COALESCE(e.title, '') || ' ' ||
          COALESCE(e.artist_name, '') || ' ' ||
          COALESCE(e.venue, '') || ' ' ||
          COALESCE(e.address, '')
        ) ILIKE $${countParams.length}`;
      });

      countWhereConditions.push(`(${countSearchConditions.join(' OR ')})`);
    }

    if (countWhereConditions.length > 0) {
      countQuery += ' WHERE ' + countWhereConditions.join(' AND ');
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const response = {
      events: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      }
    };

    await redisClient.setEx(cacheKey, CACHE_SETTINGS.EVENTS_LIST_TTL, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    next(new CustomError(500, error.message, error));
  }
});

/**
 * @swagger
 * /api/v1/events/{id}:
 *   get:
 *     summary: 이벤트 상세 조회
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 이벤트 ID
 *     responses:
 *       200:
 *         description: 이벤트 상세 정보
 *       404:
 *         description: 이벤트를 찾을 수 없음
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureUUID(id, res)) return;

    const cacheKey = CACHE_KEYS.EVENT(id);
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const eventResult = await db.query(
      'SELECT * FROM events WHERE id = $1',
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
    }

    const ticketTypesResult = await db.query(
      `SELECT 
        id, name, price, total_quantity, available_quantity, description
      FROM ticket_types 
      WHERE event_id = $1 
      ORDER BY price DESC`,
      [id]
    );

    const response = {
      event: eventResult.rows[0],
      ticketTypes: ticketTypesResult.rows,
    };

    await redisClient.setEx(cacheKey, CACHE_SETTINGS.EVENT_DETAIL_TTL, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    error.status = 500;
    error.message = '이벤트 정보를 불러오는데 실패했습니다.';
    next(error);
  }
});

module.exports = router;
