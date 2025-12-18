# Tiketi Auth Service

인증 서비스 - 사용자 회원가입, 로그인, JWT 토큰 관리

## 빠른 시작

### 개발 환경

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일 수정 (필수: DB 연결 정보)

# 3. 개발 모드 실행
npm run dev
```

### 서비스 확인

```bash
# Health check
curl http://localhost:3010/health

# 회원가입
curl -X POST http://localhost:3010/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

## 주요 기능

- ✅ User registration (이메일, 비밀번호, 이름)
- ✅ User login (JWT 토큰 발급)
- ✅ JWT token verification
- ✅ Admin account auto-initialization
- ✅ Password hashing (bcrypt)
- ✅ Input validation

## API 문서

### POST /api/auth/register
회원가입

**Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name",
  "phone": "010-1234-5678"
}
```

**Response** (201):
```json
{
  "message": "회원가입이 완료되었습니다.",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name",
    "role": "user"
  }
}
```

### POST /api/auth/login
로그인

**Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response** (200):
```json
{
  "message": "로그인 성공",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name",
    "role": "user"
  }
}
```

### GET /health
서비스 상태 확인

**Response** (200):
```json
{
  "status": "ok",
  "service": "auth-service"
}
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | 3010 | 서비스 포트 |
| `NODE_ENV` | development | 실행 환경 |
| `DB_HOST` | postgres-service | PostgreSQL 호스트 |
| `DB_PORT` | 5432 | PostgreSQL 포트 |
| `DB_NAME` | tiketi | 데이터베이스 이름 |
| `DB_USER` | tiketi_user | 데이터베이스 사용자 |
| `DB_PASSWORD` | tiketi_pass | 데이터베이스 비밀번호 |
| `JWT_SECRET` | (변경 필수) | JWT 서명 시크릿 |
| `JWT_EXPIRES_IN` | 7d | 토큰 만료 시간 |
| `ADMIN_EMAIL` | admin@tiketi.gg | Admin 이메일 |
| `ADMIN_PASSWORD` | admin123 | Admin 비밀번호 |

## Docker 빌드 및 실행

```bash
# 이미지 빌드
docker build -t tiketi-auth-service:1.0.0 .

# 컨테이너 실행
docker run -d \
  -p 3010:3010 \
  -e DB_HOST=postgres \
  -e DB_USER=tiketi_user \
  -e DB_PASSWORD=tiketi_pass \
  -e JWT_SECRET=your-secret-key \
  --name auth-service \
  tiketi-auth-service:1.0.0

# 로그 확인
docker logs -f auth-service
```

## npm 스크립트

```bash
npm run dev      # 개발 모드 (nodemon)
npm start        # 프로덕션 모드
npm test         # 테스트 실행 (jest)
```

## 프로젝트 구조

```
src/
├── index.js              # 진입점 (서버 시작)
├── server.js             # Express 앱 설정
├── routes/
│   ├── index.js         # 라우트 모음
│   └── auth.js          # 인증 엔드포인트
├── middleware/
│   ├── auth.js          # JWT 검증 미들웨어
│   └── error-handler.js # 에러 처리
├── config/
│   ├── database.js      # PostgreSQL 커넥션
│   └── init-admin.js    # Admin 계정 초기화
└── utils/
    ├── constants.js     # 상수
    ├── logger.js        # Winston 로거
    └── custom-error.js  # 커스텀 에러 클래스
```

## 개발 팀 워크플로우

### Phase 1 (현재)
- Auth Service 기본 기능만 구현
- Backend와 공유 DB 사용
- Backend auth 엔드포인트 유지

### Phase 2
- Ticket Service 분리
- Database 분리 (각 서비스 독립 DB)
- API Gateway 추가

### Phase 3
- Payment Service, Stats Service 분리
- Backend에서 auth 엔드포인트 제거
- Kubernetes 배포

## 문제 해결

### DB 연결 오류
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
→ PostgreSQL 서버 실행 확인, DB 연결 정보 확인

### JWT 검증 실패
```
Error: invalid signature
```
→ JWT_SECRET이 일치하는지 확인

### 포트 이미 사용 중
```bash
PORT=3011 npm run dev  # 다른 포트에서 실행
```

## 기여하기

1. Feature 브랜치 생성
2. 코드 작성
3. 테스트 실행
4. PR 작성

## 라이센스

MIT

---

**서비스 포트**: 3010  
**버전**: 1.0.0  
**마지막 업데이트**: 2024
