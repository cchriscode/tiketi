const express = require('express');
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/image/upload:
 *   post:
 *     summary: 이미지 업로드 (AWS S3)
 *     tags: [Image]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: 업로드할 이미지 파일
 *     responses:
 *       200:
 *         description: 이미지 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: S3 이미지 URL
 *                 key:
 *                   type: string
 *                   description: S3 저장 경로
 */

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE, // 파일의 MimeType(이미지/png 등) 자동 설정
    key: function (req, file, cb) {
      // S3에 저장될 파일명 설정
      // 예: uploads/1730123456789_cat.jpg
      const ext = path.extname(file.originalname); // 확장자 추출
      const fileName = `files/${Date.now()}_${path.basename(file.originalname, ext)}${ext}`;
      cb(null, fileName);
    }
  }),
  // 파일 크기 제한 설정 (선택 사항, 예: 5MB)
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/upload', (req, res, next) => {
  // 필수 설정 누락 시 안전하게 차단
  if (!process.env.AWS_S3_BUCKET || !process.env.AWS_REGION) {
    return res.status(500).json({ error: 'S3 configuration is missing' });
  }

  upload.single('image')(req, res, (err) => {
    if (err) {
      logger.error('S3 upload error:', err.message);
      return res.status(500).json({ error: '이미지 업로드에 실패했습니다.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '이미지 파일이 필요합니다.' });
    }

    try {
      logger.info('File uploaded:', req.file); // 업로드된 파일 정보 로깅

      return res.status(200).json({
        url: req.file.location, // S3 접근 URL
        key: req.file.key       // S3 저장 경로
      });
    } catch (e) {
      logger.error('S3 upload response error:', e.message);
      return res.status(500).json({ error: '이미지 업로드에 실패했습니다.' });
    }
  });
});

module.exports = router;
