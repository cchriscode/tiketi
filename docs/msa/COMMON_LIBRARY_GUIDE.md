# 공통 라이브러리 통합 가이드

## 📋 목차
1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [구현 과정](#구현-과정)
4. [트러블슈팅](#트러블슈팅)
5. [사용 방법](#사용-방법)
6. [모범 사례](#모범-사례)

---

## 개요

### 목적
MSA 환경에서 여러 마이크로서비스 간 중복 코드를 제거하고 일관성을 유지하기 위해 공통 라이브러리(`tiketi-common`)를 구축했습니다.

### 해결한 문제
- ❌ 각 서비스마다 동일한 로깅, 인증, 에러 처리 코드 중복
- ❌ 상수 값 불일치로 인한 버그 발생
- ❌ 코드 수정 시 모든 서비스를 개별적으로 업데이트해야 하는 비효율

### 달성한 결과
- ✅ 로깅 방식 통일: 모든 서비스에서 동일한 JSON 형식 로그
- ✅ 인증/인가 로직 중앙화
- ✅ 에러 처리 표준화
- ✅ 데이터베이스 연결 풀 공유

---

## 아키텍처

### 전체 프로젝트 구조
```
tiketi/
├── services/                    # 마이크로서비스들
│   ├── auth-service/           # 인증 서비스
│   ├── ticket-service/         # 티켓 서비스
│   ├── payment-service/        # 결제 서비스
│   └── stats-service/          # 통계 서비스
├── tiketi-common/              # 🎯 공통 라이브러리
├── frontend/                    # React 프론트엔드
├── k8s/                        # Kubernetes 매니페스트
└── docs/                       # 문서
```

### tiketi-common 상세 구조
```
tiketi-common/
├── package.json              # 의존성 관리
├── README.md
└── src/
    ├── index.js              # 진입점 (모든 모듈 export)
    ├── config/               # 설정
    │   └── database.js       # PostgreSQL 연결 풀
    ├── middleware/           # Express 미들웨어
    │   ├── auth.js           # JWT 인증/인가
    │   └── error-handler.js  # 전역 에러 핸들러
    └── utils/                # 유틸리티
        ├── constants.js      # 상수 (상태, 설정 등)
        ├── custom-error.js   # 커스텀 에러 클래스
        ├── logger.js         # Winston 기반 로거
        └── transaction-helpers.js  # DB 트랜잭션 헬퍼
```

### 각 서비스 구조 (예: auth-service)
```
services/auth-service/
├── Dockerfile
├── package.json
└── src/
    ├── index.js              # 서버 시작점
    ├── server.js             # Express 앱 설정
    ├── config/
    │   ├── database.js       # (제거됨 → tiketi-common 사용)
    │   └── init-admin.js     # Admin 초기화
    └── routes/
        ├── index.js
        └── auth.js           # 인증 라우트
```

### 의존성
```json
{
  "dependencies": {
    "winston": "^3.11.0",       // 로깅
    "jsonwebtoken": "^9.0.2",   // JWT 인증
    "bcrypt": "^5.1.1",         // 비밀번호 해싱
    "pg": "^8.11.3",            // PostgreSQL 클라이언트
    "ioredis": "^5.3.2"         // Redis 클라이언트
  }
}
```

---

## 구현 과정

### Step 1: 공통 라이브러리 생성

#### 1.1 디렉토리 초기화
```bash
mkdir -p tiketi-common/src/{utils,middleware,config}
cd tiketi-common
npm init -y
npm install winston jsonwebtoken bcrypt pg ioredis
```

#### 1.2 핵심 모듈 구현

**utils/logger.js** - 구조화된 로깅
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// HTTP 요청 로깅 헬퍼
logger.logRequest = (req) => {
  logger.info('API Request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
};

module.exports = { logger };
```

**utils/custom-error.js** - 표준화된 에러 처리
```javascript
class CustomError extends Error {
  constructor(statusCode, message, cause) {
    super(message);
    this.statusCode = statusCode;
    this.cause = cause;
    this.name = 'CustomError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { CustomError };
```

**utils/constants.js** - 중앙화된 상수 관리
```javascript
const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_EXPIRES_IN: '7d',
  BCRYPT_SALT_ROUNDS: 10,
  DB_POOL_MAX: 20,
};

const EVENT_STATUS = {
  UPCOMING: 'upcoming',
  ON_SALE: 'on_sale',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
  SOLD_OUT: 'sold_out',
};

const SEAT_STATUS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  LOCKED: 'locked',
};

const PAGINATION_DEFAULTS = {
  PAGE: 1,
  EVENTS_LIMIT: 10,
  RESERVATIONS_LIMIT: 20,
};

const CACHE_KEYS = {
  EVENT: (eventId) => `event:${eventId}`,
  EVENTS_LIST: (status, page, limit, searchQuery) => 
    `events:${status || 'all'}:${page}:${limit}:${searchQuery || 'none'}`,
};

module.exports = {
  CONFIG,
  EVENT_STATUS,
  SEAT_STATUS,
  PAGINATION_DEFAULTS,
  CACHE_KEYS,
  // ... 기타 상수들
};
```

**middleware/auth.js** - JWT 인증 미들웨어
```javascript
const jwt = require('jsonwebtoken');
const { CustomError } = require('../utils/custom-error');
const { CONFIG } = require('../utils/constants');

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    throw new CustomError(401, '인증 토큰이 필요합니다.');
  }

  jwt.verify(token, CONFIG.JWT_SECRET, (err, user) => {
    if (err) {
      throw new CustomError(403, '유효하지 않은 토큰입니다.');
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    throw new CustomError(403, '관리자 권한이 필요합니다.');
  }
  next();
};

module.exports = { authenticateToken, requireAdmin };
```

**middleware/error-handler.js** - 전역 에러 핸들러
```javascript
const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // CustomError 처리
  if (err.name === 'CustomError' || err.statusCode) {
    logger.error(err.message, {
      statusCode: err.statusCode || 500,
      stack: err.stack,
      cause: err.cause,
    });
    
    return res.status(err.statusCode || 500).json({
      error: err.message,
    });
  }

  // 기본 에러 처리
  logger.error('Original Error Cause:', {
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: err.message || 'Internal Server Error',
  });
};

module.exports = { errorHandler };
```

**config/database.js** - DB 연결 풀
```javascript
const { Pool } = require('pg');
const { CONFIG, logger } = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tiketi',
  user: process.env.DB_USER || 'tiketi_user',
  password: process.env.DB_PASSWORD || 'tiketi_password',
  max: CONFIG.DB_POOL_MAX,
  idleTimeoutMillis: CONFIG.DB_IDLE_TIMEOUT_MS,
});

pool.on('connect', () => {
  logger.info('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('❌ PostgreSQL pool error:', err);
});

module.exports = { pool };
```

**utils/transaction-helpers.js** - 트랜잭션 헬퍼
```javascript
const { pool } = require('../config/database');

const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { withTransaction };
```

#### 1.3 index.js - 통합 Export
```javascript
const { logger } = require('./utils/logger');
const { CustomError } = require('./utils/custom-error');
const {
  CONFIG,
  USER_ROLES,
  EVENT_STATUS,
  SEAT_STATUS,
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  LOCK_SETTINGS,
  RESERVATION_SETTINGS,
  CACHE_SETTINGS,
  PAGINATION_DEFAULTS,
  PAYMENT_SETTINGS,
  CACHE_KEYS,
  LOCK_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} = require('./utils/constants');
const { withTransaction } = require('./utils/transaction-helpers');
const { authenticateToken, requireAdmin } = require('./middleware/auth');
const { errorHandler } = require('./middleware/error-handler');
const db = require('./config/database');

module.exports = {
  // Utils
  logger,
  CustomError,
  withTransaction,
  
  // Constants
  CONFIG,
  USER_ROLES,
  EVENT_STATUS,
  SEAT_STATUS,
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  LOCK_SETTINGS,
  RESERVATION_SETTINGS,
  CACHE_SETTINGS,
  PAGINATION_DEFAULTS,
  PAYMENT_SETTINGS,
  CACHE_KEYS,
  LOCK_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  
  // Middleware
  authenticateToken,
  requireAdmin,
  errorHandler,
  
  // Database
  db,
};
```

---

### Step 2: 각 서비스에 적용

#### 2.1 Dockerfile 수정
**핵심:** 공통 라이브러리를 각 서비스 컨테이너에 포함시키기
```dockerfile
FROM node:18-alpine
WORKDIR /app

# 1. 공통 라이브러리 먼저 설치
COPY tiketi-common/package.json /tiketi-common/package.json
WORKDIR /tiketi-common
RUN npm install --omit=dev --no-package-lock

# 2. 공통 라이브러리 소스 복사
COPY tiketi-common/src /tiketi-common/src

# 3. 서비스 의존성 설치
WORKDIR /app
COPY services/auth-service/package.json ./
RUN npm install --omit=dev --no-package-lock

# 4. 심볼릭 링크로 공통 라이브러리 연결
RUN ln -s /tiketi-common ./node_modules/@tiketi/common

# 5. 서비스 소스 복사
COPY services/auth-service/src ./src

EXPOSE 3010
CMD ["node", "src/index.js"]
```

**왜 심볼릭 링크?**
- `require('@tiketi/common')`으로 import 가능
- node_modules 구조 유지
- 빌드 시간 단축

#### 2.2 서비스 코드 마이그레이션

**Before** - 개별 utils 사용:
```javascript
// services/auth-service/src/routes/auth.js
const logger = require('../utils/logger');
const CustomError = require('../utils/custom-error');
const { CONFIG } = require('../shared/constants');
const db = require('../config/database');
```

**After** - 공통 라이브러리 사용:
```javascript
// services/auth-service/src/routes/auth.js
const { logger, CustomError, CONFIG, db } = require('@tiketi/common');
```

#### 2.3 일괄 변환 방법

**수동 변환:**
```bash
# 1. 기존 utils, middleware, shared 디렉토리 삭제
rm -rf services/auth-service/src/utils
rm -rf services/auth-service/src/middleware
rm -rf services/auth-service/src/shared

# 2. import 경로 일괄 변경
find services/auth-service/src -name "*.js" -type f -exec \
  sed -i '' "s|require('../utils/logger')|require('@tiketi/common')|g" {} \;

find services/auth-service/src -name "*.js" -type f -exec \
  sed -i '' "s|require('../middleware/auth')|require('@tiketi/common')|g" {} \;

find services/auth-service/src -name "*.js" -type f -exec \
  sed -i '' "s|require('../shared/constants')|require('@tiketi/common')|g" {} \;
```

**자동 스크립트:**
```bash
#!/bin/bash
# migrate-to-common.sh

SERVICES=("auth" "ticket" "payment" "stats")

for service in "${SERVICES[@]}"; do
  echo "🔄 Migrating ${service}-service..."
  
  # Import 경로 변경
  find services/${service}-service/src -name "*.js" -exec \
    sed -i '' "s|require('../utils/logger')|require('@tiketi/common')|g" {} \;
  
  find services/${service}-service/src -name "*.js" -exec \
    sed -i '' "s|require('../utils/custom-error')|require('@tiketi/common')|g" {} \;
    
  # ... 기타 변경사항
  
  echo "✅ ${service}-service migration complete"
done
```

---

## 트러블슈팅

### 문제 1: `CustomError is not a constructor`

**증상:**
```javascript
TypeError: CustomError is not a constructor
    at /app/src/routes/auth.js:191:10
```

**원인:**
```javascript
// custom-error.js
module.exports = CustomError;  // ❌ default export

// index.js
const { CustomError } = require('./utils/custom-error');  // named import
```

**해결:**
```javascript
// custom-error.js
module.exports = { CustomError };  // ✅ named export
```

---

### 문제 2: Docker 이미지가 업데이트 안 됨

**증상:**
- 로컬 파일은 수정했는데 컨테이너는 이전 코드 실행

**원인:**
- Docker 빌드 캐시
- Kind 클러스터에 오래된 이미지 로드

**해결 체크리스트:**
```bash
# 1. 로컬 파일 확인
cat services/auth-service/src/server.js | grep "authRoutes"

# 2. 완전히 새로 빌드
docker build --no-cache --pull \
  -f services/auth-service/Dockerfile \
  -t tiketi-auth-service:local .

# 3. 빌드된 이미지 검증 ⭐ 중요!
docker run --rm tiketi-auth-service:local \
  cat /app/src/server.js | grep "authRoutes"

# 4. Kind에 로드
kind load docker-image tiketi-auth-service:local --name tiketi-cluster

# 5. Pod 재시작
kubectl delete pod -n tiketi -l app=auth-service

# 6. 새 Pod에서 확인
kubectl exec -n tiketi deployment/auth-service -- \
  cat /app/src/server.js | grep "authRoutes"
```

---

### 문제 3: Deployment 이미지 태그 불일치

**증상:**
```bash
# Pod가 :latest 사용
kubectl get pod -n tiketi -l app=auth-service \
  -o jsonpath='{.items[0].spec.containers[0].image}'
# 출력: tiketi-auth-service:latest

# 빌드한 이미지는 :local
docker images | grep tiketi-auth-service
# 출력: tiketi-auth-service:local
```

**원인:**
- Deployment YAML에 하드코딩된 이미지 태그

**해결:**
```bash
# Deployment 이미지 업데이트
kubectl set image deployment/auth-service -n tiketi \
  auth-service=tiketi-auth-service:local

# imagePullPolicy 확인
kubectl get deployment -n tiketi auth-service \
  -o jsonpath='{.spec.template.spec.containers[0].imagePullPolicy}'
# IfNotPresent 또는 Always여야 함
```

---

### 문제 4: DB 컬럼명 불일치

**증상:**
```
Error: column "password" does not exist
```

**원인:**
```sql
-- DB 스키마
CREATE TABLE users (
  password_hash VARCHAR(255),  -- ✅ 실제 컬럼명
  ...
);
```
```javascript
// 코드
const user = result.rows[0];
const match = await bcrypt.compare(password, user.password);  // ❌
```

**해결:**
```bash
# 1. DB 스키마 확인
kubectl exec -n tiketi deployment/postgres -- \
  psql -U tiketi_user -d tiketi -c "\d users"

# 2. 코드 수정
sed -i '' 's/user\.password/user.password_hash/g' \
  services/auth-service/src/routes/auth.js
```

---

### 문제 5: Auth Service 404 에러

**증상:**
```bash
curl http://localhost:8080/api/v1/auth/login
# {"error":"Not found"}
```

**원인 분석:**
```javascript
// server.js
app.use('/', authRoutes);  // ❌

// Ingress가 /api/v1/auth/login을 보냄
// 하지만 라우트는 /login만 정의됨
// 결과: /api/v1/auth/login을 찾지 못함
```

**해결 방법 1:** 라우트 경로 수정 (권장)
```javascript
// server.js
app.use('/api/v1/auth', authRoutes);  // ✅
```

**해결 방법 2:** Ingress rewrite
```yaml
# k8s/14-ingress.yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  rules:
  - http:
      paths:
      - path: /api/v1/auth(/|$)(.*)  # regex 사용
        pathType: ImplementationSpecific
```

---

### 문제 6: init-admin.js INSERT 실패

**증상:**
```
✅ Admin user already exists
# 하지만 실제 DB에는 더미 데이터
```

**원인:**
```javascript
// init-admin.js
await db.pool.query(
  `INSERT INTO users (email, password, name, phone, role) ...`
  //                           ^^^^^^^^ ❌ 컬럼명 틀림
);
```

**해결:**
```javascript
await db.pool.query(
  `INSERT INTO users (email, password_hash, name, phone, role) ...`
  //                           ^^^^^^^^^^^^^ ✅
);
```

---

## 사용 방법

### 새 서비스 생성 시

#### 1. package.json 설정
```json
{
  "name": "my-new-service",
  "dependencies": {
    "express": "^4.18.2",
    "@tiketi/common": "file:../../tiketi-common"
  }
}
```

#### 2. Import
```javascript
const {
  logger,
  CustomError,
  authenticateToken,
  requireAdmin,
  errorHandler,
  CONFIG,
  EVENT_STATUS,
  db
} = require('@tiketi/common');
```

#### 3. Express 서버 구성
```javascript
const express = require('express');
const { logger, errorHandler } = require('@tiketi/common');

const app = express();

// 1. 요청 로깅
app.use((req, res, next) => {
  logger.logRequest(req);
  next();
});

// 2. Body parser
app.use(express.json());

// 3. 라우트
app.use('/api/v1/users', userRoutes);

// 4. 에러 핸들러 (반드시 마지막!)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`🚀 Server started on port ${PORT}`);
});
```

#### 4. 인증이 필요한 라우트
```javascript
const { authenticateToken, requireAdmin } = require('@tiketi/common');

// 일반 사용자 인증
router.get('/profile', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// 관리자 권한 필요
router.delete('/users/:id', 
  authenticateToken, 
  requireAdmin, 
  async (req, res, next) => {
    try {
      // 관리자만 접근 가능
      await deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);
```

---

## 모범 사례

### 1. 로깅
```javascript
const { logger } = require('@tiketi/common');

// ✅ Good: 구조화된 로그
logger.info('User logged in', { 
  userId: user.id, 
  email: user.email,
  ip: req.ip 
});

// ❌ Bad: 비구조화된 로그
console.log('User logged in: ' + user.email);
```

### 2. 에러 처리
```javascript
const { CustomError } = require('@tiketi/common');

// ✅ Good: 명확한 HTTP 상태 코드
if (!user) {
  throw new CustomError(404, '사용자를 찾을 수 없습니다.');
}

if (user.role !== 'admin') {
  throw new CustomError(403, '관리자 권한이 필요합니다.');
}

// ❌ Bad: Generic error
throw new Error('User not found');
```

### 3. 상수 사용
```javascript
const { EVENT_STATUS, SEAT_STATUS } = require('@tiketi/common');

// ✅ Good: 공통 상수 사용
if (event.status === EVENT_STATUS.ON_SALE) {
  // ...
}

if (seat.status === SEAT_STATUS.AVAILABLE) {
  // ...
}

// ❌ Bad: 하드코딩
if (event.status === 'on_sale') {  // 오타 가능성
  // ...
}
```

### 4. DB 트랜잭션
```javascript
const { withTransaction } = require('@tiketi/common');

// ✅ Good: 트랜잭션 헬퍼
await withTransaction(async (client) => {
  await client.query('UPDATE seats SET status = $1 WHERE id = $2', 
    ['reserved', seatId]);
  await client.query('INSERT INTO reservations (user_id, seat_id) VALUES ($1, $2)', 
    [userId, seatId]);
});

// ❌ Bad: 수동 트랜잭션 관리 (실수 가능성 높음)
const client = await db.pool.connect();
try {
  await client.query('BEGIN');
  await client.query('UPDATE ...');
  await client.query('INSERT ...');
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

### 5. 캐시 키 일관성
```javascript
const { CACHE_KEYS } = require('@tiketi/common');

// ✅ Good: 정의된 키 패턴 사용
const cacheKey = CACHE_KEYS.EVENT(eventId);
await redis.set(cacheKey, JSON.stringify(event));

// ❌ Bad: 하드코딩 (불일치 가능성)
await redis.set(`event_${eventId}`, JSON.stringify(event));
```

---

## 배포 체크리스트

### Docker 빌드 전
- [ ] 로컬 코드 수정 완료
- [ ] `grep`으로 코드 검증
- [ ] `--no-cache` 플래그 사용

### 빌드 후
- [ ] `docker run` 으로 이미지 내부 파일 확인
- [ ] Kind 클러스터에 로드
- [ ] Deployment 이미지 태그 확인

### 배포 후
- [ ] Pod 로그 확인
- [ ] `kubectl exec`로 실제 파일 확인
- [ ] API 테스트

---

## 참고 자료
- [Winston Logger](https://github.com/winstonjs/winston)
- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [PostgreSQL Connection Pooling](https://node-postgres.com/features/pooling)
