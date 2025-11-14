const express = require('express');
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

const router = express.Router();

process.env.AWS_ACCESS_KEY_ID
process.env.AWS_SECRET_ACCESS_KEY
process.env.AWS_REGION

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

router.get('/test', (req, res) => {
  res.json({ message: 'Image route is working' });
});

router.post('/upload', upload.single('image'), async (req, res) => {
  console.log(req.file); // 업로드된 파일 정보 확인

  // S3에 저장된 파일의 위치(URL)를 프론트엔드에 돌려줍니다.
  return res.status(200).json({
    url: req.file.location, // S3 접근 URL
    key: req.file.key       // S3 저장 경로
  });
})

module.exports = router;
