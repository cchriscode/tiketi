# Auth Service 마이그레이션 1단계

## 개요

Auth Service는 Tiketi의 MSA 아키텍처 1단계에서 분리된 첫 번째 마이크로서비스입니다.

**목표**: 사용자 인증 및 JWT 토큰 관리를 독립적인 서비스로 분리

**포트**: 3010

**의존성**: PostgreSQL (공유 DB, Phase 1)

## 구현 범위

### ✅ 포함된 기능
- User registration (`POST /api/auth/register`)
- User login (`POST /api/auth/login`)
- JWT token generation and verification
- Admin account initialization
- Input validation (email format, password strength)
- Password hashing with bcrypt
- Error handling and logging

### ❌ 제외된 기능 (Phase 2+)
- Google OAuth / Social login
- Refresh token mechanism
- Email verification
- Password reset
- Multi-factor authentication (MFA)
- User profile management
- Role-based access control (RBAC) - 기본 admin role only

## 디렉터리 구조

```
services/auth-service/
├── src/
│   ├── index.js                 # Entry point
│   ├── server.js               # Express app setup
│   ├── routes/
│   │   ├── index.js           # Route aggregator
│   │   └── auth.js            # Auth endpoints (register, login)
│   ├── middleware/
│   │   ├── auth.js            # JWT verification middleware
│   │   └── error-handler.js    # Global error handler
│   ├── config/
│   │   ├── database.js         # PostgreSQL pool
│   │   └── init-admin.js       # Admin account initialization
│   └── utils/
│       ├── constants.js        # Configuration constants
│       ├── logger.js           # Winston logger
│       └── custom-error.js     # Custom error class
├── package.json                # Dependencies
├── Dockerfile                  # Docker image definition
├── .env.example               # Environment variables template
└── README.md                  # Service documentation

```

## API 엔드포인트

### Register - POST /api/auth/register
사용자 회원가입

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe",
  "phone": "010-1234-5678"  // optional
}
```

**Response (201)**:
```json
{
  "message": "회원가입이 완료되었습니다.",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "userId": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

**Validation**:
- Email: valid email format required
- Password: minimum 6 characters
- Name: non-empty string required

### Login - POST /api/auth/login
사용자 로그인

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200)**:
```json
{
  "message": "로그인 성공",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "userId": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

**Error (401)**: Invalid credentials

### Health Check - GET /health
서비스 상태 확인

**Response (200)**:
```json
{
  "status": "ok",
  "service": "auth-service"
}
```

## JWT Token Structure

```javascript
{
  userId: 1,
  email: "user@example.com",
  role: "user",
  iat: 1234567890,      // issued at
  exp: 1234654290       // expires at (7 days)
}
```

## 환경 변수

`.env.example` 참고

핵심 변수:
- `JWT_SECRET`: JWT 서명 시크릿 (production에서 변경 필수)
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `PORT`: Service port (default: 3010)
- `ADMIN_EMAIL`: Default admin email
- `ADMIN_PASSWORD`: Default admin password

## 로컬 개발 실행

```bash
# 1. 디렉터리 이동
cd services/auth-service

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일 수정 (필요시)

# 3. 의존성 설치
npm install

# 4. 개발 모드 실행
npm run dev

# 5. 테스트
curl -X POST http://localhost:3010/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

## Docker 배포

```bash
# 1. 이미지 빌드
docker build -t tiketi-auth-service:1.0.0 .

# 2. 컨테이너 실행
docker run -d \
  -p 3010:3010 \
  -e DB_HOST=postgres \
  -e DB_USER=tiketi_user \
  -e DB_PASSWORD=tiketi_pass \
  -e JWT_SECRET=your-secret-key \
  --name auth-service \
  tiketi-auth-service:1.0.0

# 3. 상태 확인
docker logs auth-service
curl http://localhost:3010/health
```

## 데이터베이스

**공유 PostgreSQL 사용 (Phase 1)**

필요한 테이블:
- `users` table (기존 backend에서 사용)
  - id (serial primary key)
  - email (varchar unique)
  - password_hash (varchar)
  - name (varchar)
  - phone (varchar, optional)
  - role (varchar, default: 'user')
  - created_at (timestamp)
  - updated_at (timestamp)

## 마이그레이션 경로

### 이 단계에서 변경된 사항:
1. ✅ `services/auth-service/` 디렉터리 생성
2. ✅ Auth 관련 코드 복사 및 최소화
3. ✅ package.json, Dockerfile, .env.example 생성
4. ✅ Health check endpoint 추가

### 다음 단계 (Phase 2):
- [ ] Ticket Service 분리 (포트 3011)
- [ ] Shared library (@tiketi/common) 생성
- [ ] Database 분리 (각 서비스 독립 DB)
- [ ] API Gateway 추가
- [ ] Service-to-service communication (gRPC/REST)
- [ ] Docker Compose 통합

### Phase 3+:
- [ ] Backend에서 auth 엔드포인트 제거
- [ ] Payment Service 분리
- [ ] Stats Service 분리
- [ ] Kubernetes deployment manifests

## 주의사항

1. **Phase 1 호환성**: Backend의 auth 엔드포인트는 아직 유지됨 (Phase 3에서 제거)
2. **Database 공유**: 현재는 같은 DB 사용 (향후 분리 예정)
3. **API 호환성**: Auth Service의 응답 형식은 기존 backend과 동일
4. **JWT Secret**: production에서는 환경 변수로 설정해야 함
5. **Admin 초기화**: 서비스 시작 시 자동으로 admin 계정 생성/확인

## 테스트 시나리오

### 1. Admin 로그인
```bash
curl -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tiketi.gg",
    "password": "admin123"
  }'
```

### 2. 일반 사용자 회원가입
```bash
curl -X POST http://localhost:3010/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123",
    "name": "New User"
  }'
```

### 3. 일반 사용자 로그인
```bash
curl -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123"
  }'
```

### 4. JWT 토큰 검증 (Ticket Service에서 사용)
```bash
curl http://localhost:3010/health \
  -H "Authorization: Bearer <token_from_login>"
```

## 문제 해결

### 포트 충돌
```bash
# 다른 포트에서 실행
PORT=3011 npm run dev
```

### Database 연결 오류
- DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD 확인
- PostgreSQL 서버가 실행 중인지 확인
- 네트워크 연결 확인

### JWT 토큰 검증 실패
- JWT_SECRET이 일치하는지 확인
- 토큰 만료 여부 확인
- Bearer 토큰 형식 확인: `Authorization: Bearer <token>`

## 참고 문서

- [RFP 기획서](../../docs/final/(최종)프로젝트기획서_RFP.md)
- [아키텍처 설계](../../docs/final/(최종)아키텍처기획서.md)
- [MSA 마이그레이션 계획](../../claudedocs/K8S_MSA_MIGRATION_PLAN.md)