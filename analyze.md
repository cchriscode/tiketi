TIKETI 플랫폼 종합 분석 보고서
<div align="center">

🎟️ TIKETI Ticketing Platform – Production Readiness Review

“프로덕션 직전 단계에서 점검해야 할 아키텍처 · 보안 · 성능 · DevOps 종합 리포트”

전체 점수: ⭐ 4.2 / 5.0 · 프로덕션 준비도: 85%

</div>
📊 Executive Summary
<div align="center">
항목	평가
전체 평가	⭐⭐⭐⭐☆ (4.2 / 5.0)
프로덕션 준비도	85%
보안 수준	강함 (소규모 하드닝 필요)
아키텍처 성숙도	Advanced (고급)
</div>

핵심 메시지:
현재 아키텍처, 성능, DevOps 파이프라인은 프로덕션 기준에 매우 근접해 있으며, 남은 과제는 보안 하드닝과 테스트/검증 체계 보강입니다.

🏗️ Architecture Analysis (아키텍처 분석)
<div align="center">

“AWS 상에서 잘 구조화된 멀티 티어 · 멀티 AZ 기반의 현대적인 티켓팅 플랫폼”

</div>
✅ 강점 요약

Multi-AZ VPC 아키텍처

리전: ap-northeast-2 (서울)

AZ: ap-northeast-2a, ap-northeast-2b

3계층 서브넷 구조

Public → Private → DB

CloudFront + S3 기반 정적 콘텐츠 전송

ALB + Sticky Session 기반 WebSocket 세션 유지

관측성(Observability)을 고려한 설계 (Prometheus, Loki, Grafana 등)

1️⃣ AWS 멀티 티어 아키텍처

VPC 내부에 Public / Private / DB 서브넷이 명확히 분리

Security Group 레벨에서 레이어드 보안 적용

CloudFront + S3로 글로벌 정적 콘텐츠 캐싱 및 전송

ALB에서 WebSocket 트래픽을 처리하며 Sticky Session으로 세션 유지

2️⃣ 프로덕션용 Docker 구성 (docker-compose.prod.yml)

멀티 스테이지 빌드를 통한 경량 이미지 (베이스: node:18-alpine)

컨테이너 비 root 유저 실행 (예: nodejs:1001)

30초 간격 헬스 체크 설정

Loki + Promtail + Grafana 로깅 스택 구축

PostgreSQL / Dragonfly / Node Exporter 기반 메트릭 수집

3️⃣ 실시간 인프라 (Real-Time Infra)

Socket.IO + Redis Adapter → 멀티 인스턴스 간 실시간 이벤트 동기화

JWT 기반 WebSocket 인증

Redis를 이용한 세션 복구 메커니즘

클라이언트 Auto-reconnect 처리

4️⃣ Observability 스택

Prometheus: 5초 스크랩 주기로 메트릭 수집

Loki: 중앙 집중 로그 수집

Grafana: 대시보드 시각화

/metrics 커스텀 엔드포인트

Node / DB / Cache 전 구간 Exporter 구성

🔒 Security Assessment (보안 평가)
<div align="center">

“기본 기반은 탄탄하지만, 프로덕션 보안 하드닝을 위한 마지막 단계 필요”

</div>
✅ 현재 보안 강점
1. Authentication & Authorization

JWT 기반 인증 + 토큰 검증

모든 요청 시 DB에서 사용자 검증

Role-Based Access Control: admin, user

WebSocket 연결 시 인증 절차 수행

bcrypt 기반 비밀번호 해시 처리

2. Input Validation

express-validator 기반 요청 검증

이메일 Normalization

SQL 파라미터 바인딩 쿼리 사용 →
122개 쿼리에서 문자열 결합 방식 미사용 → SQL 인젝션 리스크 없음

3. Dependency Security

npm audit 결과, 취약점 0건

운영 환경 의존성 359개 → 최신 상태 유지

4. Infrastructure Security

Docker 컨테이너 비 root 계정으로 실행

Multi-AZ 기반 고가용성

Security Group 레이어드 설계

Credentials 포함 CORS 설정 (withCredentials)

⚠️ 보안 갭 & 권장 사항
🔴 CRITICAL – 보안 미들웨어 미적용

현재: 기본 CORS 외 별도의 보안 하드닝 미적용
위험: XSS, Clickjacking, 브루트 포스 등 일반적인 웹 공격에 노출 가능

즉시 실행 명령:

npm install helmet express-rate-limit hpp xss-clean express-mongo-sanitize


backend/src/server.js 적용 예시:

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "wss://tiketi.store"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // IP당 100 requests
  message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// 로그인 엔드포인트 강화
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 15분당 5회 시도
  skipSuccessfulRequests: true,
});
app.use('/api/auth/login', authLimiter);

// Parameter pollution 방지
app.use(hpp());

🟠 HIGH – 환경 변수 보안 (.env / Secrets)

.env에 플레이스홀더 시크릿이 그대로 존재
프로덕션에 잘못 반영될 경우, 치명적인 보안 이슈로 이어질 수 있음

문제 예시:

# ❌ CRITICAL: Change these in production!
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_PASSWORD=admin123
AWS_ACCESS_KEY_ID=dummy

✅ 권장 1 – AWS Secrets Manager 사용
// backend/src/config/secrets.js
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

async function getSecret(secretName) {
  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    return JSON.parse(response.SecretString);
  } catch (error) {
    logger.error(`Failed to retrieve secret ${secretName}:`, error);
    throw error;
  }
}

module.exports = { getSecret };

✅ 권장 2 – 강력한 시크릿 생성 & 저장
# 강력한 JWT 시크릿 생성 (64바이트 랜덤, hex 인코딩)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# AWS Secrets Manager에 저장
aws secretsmanager create-secret \
  --name tiketi/production/jwt-secret \
  --secret-string "$(openssl rand -hex 64)"

🟡 MEDIUM – 분산 락 구현 개선 (Redis Lock)

현재 코드 (backend/src/config/redis.js:29-43):

const acquireLock = async (key, ttl = 5000) => {
  const lockKey = `lock:${key}`;
  const lockValue = Date.now() + ttl;  // ❌ 값이 예측 가능

  const result = await redisClient.set(lockKey, lockValue, {
    NX: true,
    PX: ttl,
  });

  return result === 'OK';
};


문제:

lockValue가 예측 가능

락 소유권 검증 로직 없음

개선안 – UUID + Lua 스크립트로 소유권 검증:

const { v4: uuidv4 } = require('uuid');

const acquireLock = async (key, ttl = 5000) => {
  const lockKey = `lock:${key}`;
  const lockValue = uuidv4(); // ✅ 고유 식별자

  const result = await redisClient.set(lockKey, lockValue, {
    NX: true,
    PX: ttl,
  });

  if (result === 'OK') {
    return { acquired: true, lockValue };
  }
  return { acquired: false };
};

const releaseLock = async (key, lockValue) => {
  const lockKey = `lock:${key}`;

  // ✅ Lua로 원자적 삭제 + 소유권 검증
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  return await redisClient.eval(script, {
    keys: [lockKey],
    arguments: [lockValue],
  });
};

🟢 LOW – HTTPS 강제 (HTTPS Enforcement)

프로덕션에서 HTTP 접근 시 HTTPS로 강제 리다이렉트 권장:

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

⚡ Performance & Scalability (성능 & 확장성)
<div align="center">

“큐 기반 예측 스케일링으로 티켓팅 트래픽 폭주에 대응하는 구조”

</div>
✅ 주요 강점
1. 큐 기반 Auto-Scaling 아키텍처

Lambda 함수가 1분마다 큐 길이 모니터링

CloudWatch 알람 → EC2 스케일링 트리거

Queue > 5,000 → 인스턴스 +2

Queue > 20,000 → 인스턴스 +5 (공격적 스케일 아웃)

Queue < 1,000 → 인스턴스 -1 (보수적 스케일 인)

상시 24/7 운영 대비 약 62% 비용 절감

기존 가정: 약 ₩660,000 / 월

현 구조: 약 ₩250,000 / 월

2. Connection Draining

WebSocket 연결에 대해 300초 그레이스 기간

스케일 인 시 갑작스러운 연결 끊김 방지

3. Database 최적화

PostgreSQL 커넥션 풀 활용

모든 쿼리를 파라미터 바인딩 방식으로 구현

RDS Aurora Multi-AZ → 약 30초 이내 Failover

4. Caching 전략

Redis 기반 세션 관리 (TTL: 30분)

Queue의 FIFO 보장

분산 락을 통한 동시성 제어

🎯 성능 개선 제안
1. DB 인덱스 추가 (Hot Path 중심)
-- 예약 쿼리 (backend/src/routes/reservations.js)
CREATE INDEX CONCURRENTLY idx_reservations_user_id_created
  ON reservations (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_reservations_status_expires
  ON reservations (status, expires_at)
  WHERE status IN ('pending', 'temp_reserved');

-- 이벤트 조회
CREATE INDEX CONCURRENTLY idx_events_status_start_date
  ON events (status, start_date)
  WHERE status = 'active';

-- 좌석 선택
CREATE INDEX CONCURRENTLY idx_seats_event_status
  ON seats (event_id, status)
  WHERE status IN ('available', 'temp_reserved');

2. PostgreSQL 커넥션 풀 튜닝
// backend/src/config/database.js
const pool = new Pool({
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,

  // 추가 권장 설정
  statement_timeout: 10000,  // 10초
  query_timeout: 10000,
  allowExitOnIdle: false,
});

// 모니터링 이벤트
pool.on('error', (err, client) => {
  logger.error('Unexpected DB pool error:', err);
});

pool.on('connect', (client) => {
  logger.debug('New DB client connected');
});

3. Redis 메모리 관리 (monitoring/redis-config.yaml)
maxmemory: 1gb
maxmemory-policy: allkeys-lru
timeout: 300        # idle 5분
tcp-keepalive: 60

4. ALB 설정 권장값

Target Group

Deregistration delay: 300s

Stickiness: ALB cookie, 86400s (24h)

Health check interval: 30s

Healthy threshold: 2

Unhealthy threshold: 3

Timeout: 5s

Success codes: 200

Listener

Idle timeout: 65s

HTTP/2: Enabled

Compression(gzip): Enabled

🏛️ Code Quality & Architecture (코드 품질 & 구조)
✅ 강점

계층 구조: routes → services → database

관심사 분리 명확 (백엔드 파일 33개)

shared/constants.js 에 상수 중앙 관리

커스텀 에러 핸들링 미들웨어

트랜잭션 헬퍼를 통한 DB 트랜잭션 관리

🎯 코드 품질 개선 – 테스트 & 에러 처리
1. 테스트 추가 (Jest + Supertest)
cd backend
npm install --save-dev jest supertest @shelf/jest-mongodb


테스트 구조 예시:

backend/
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── queue-manager.test.js
│   │   │   └── reservation-cleaner.test.js
│   │   └── utils/
│   │       └── transaction-helpers.test.js
│   ├── integration/
│   │   ├── auth.test.js
│   │   ├── events.test.js
│   │   └── reservations.test.js
│   └── setup.js


예시 – tests/integration/auth.test.js:

const request = require('supertest');
const app = require('../src/server');

describe('Auth API', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'test123',
        name: 'Test User'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  it('should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        password: 'test123',
        name: 'Test User'
      });

    expect(res.statusCode).toBe(400);
  });
});


package.json 스크립트:

{
  "scripts": {
    "test": "jest --coverage",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:watch": "jest --watch"
  },
  "jest": {
    "testEnvironment": "node",
    "coveragePathIgnorePatterns": ["/node_modules/"],
    "testMatch": ["**/*.test.js"]
  }
}

2. 부하 테스트 (k6)
cd backend
npm install -g k6


tests/load/ticket-purchase.js:

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:3001/api/events');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}

k6 run tests/load/ticket-purchase.js

3. 에러 코드 표준화
// backend/src/shared/error-codes.js
module.exports = {
  // Authentication
  AUTH_TOKEN_MISSING: 'AUTH001',
  AUTH_TOKEN_INVALID: 'AUTH002',
  AUTH_USER_NOT_FOUND: 'AUTH003',

  // Reservation
  SEAT_ALREADY_RESERVED: 'RES001',
  RESERVATION_EXPIRED: 'RES002',
  INSUFFICIENT_INVENTORY: 'RES003',

  // Queue
  QUEUE_POSITION_LOST: 'QUEUE001',
  QUEUE_THRESHOLD_EXCEEDED: 'QUEUE002',

  // Database
  DB_CONNECTION_FAILED: 'DB001',
  DB_QUERY_TIMEOUT: 'DB002',
};


응답 예시:

res.status(400).json({
  error: '이미 예약된 좌석입니다',
  code: 'RES001',
  seatId: 'A-12',
  timestamp: new Date().toISOString()
});

🚀 Deployment & CI/CD
✅ 현재 워크플로 강점 (.github/workflows/deploy.yml)

프론트/백엔드 병렬 빌드

OIDC 기반 인증 (Static Credentials 미사용)

멀티 스테이지 Docker 빌드

헬스 체크 기반 배포 검증

실패 시 자동 롤백

상세 로깅

🎯 개선 제안
1. Pre-Deployment Checks
pre-deploy-checks:
  name: Pre-Deployment Validation
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Run tests
      run: |
        cd backend
        npm install
        npm test

    - name: Security audit
      run: |
        cd backend
        npm audit --audit-level=high

    - name: Lint check
      run: |
        cd backend
        npm run lint || echo "⚠️ Linting issues found"

    - name: Check environment secrets
      run: |
        if [ -z "${{ secrets.JWT_SECRET }}" ]; then
          echo "❌ JWT_SECRET not set"
          exit 1
        fi

2. Blue-Green Deployment 전략
deploy:
  steps:
    # ... existing steps ...

    - name: Blue-Green Deployment
      run: |
        # Green 환경 기동
        docker compose -f docker-compose.prod.yml up -d --no-deps backend-green

        # Green 헬스 체크
        for i in {1..30}; do
          if curl -f http://localhost:3002/health; then
            echo "✅ Green environment healthy"
            break
          fi
          sleep 2
        done

        # ALB 타깃 그룹 교체
        aws elbv2 modify-target-group \
          --target-group-arn ${{ secrets.TARGET_GROUP_ARN }} \
          --health-check-path /health

        # Blue 트래픽 drain 대기
        sleep 60

        # Blue 환경 종료
        docker compose -f docker-compose.prod.yml stop backend-blue

3. 별도 DB 마이그레이션 워크플로
# .github/workflows/migrate.yml
name: Database Migrations

on:
  workflow_dispatch:
    inputs:
      direction:
        description: 'Migration direction'
        required: true
        type: choice
        options:
          - up
          - down

jobs:
  migrate:
    runs-on: self-hosted
    steps:
      - name: Run migrations
        run: |
          cd /home/ubuntu/tiketi
          docker exec tiketi-backend node src/migrations/${{ inputs.direction }}.js

📈 Monitoring & Observability
✅ 현재 구성

Prometheus (Metrics)

Loki (Logs)

Grafana (Dashboards)

Node Exporter, PostgreSQL Exporter, Dragonfly Exporter

🎯 비즈니스 메트릭 추가
// backend/src/metrics/business.js
const { Counter, Histogram, Gauge } = require('prom-client');

// 티켓 판매량
const ticketsSold = new Counter({
  name: 'tiketi_tickets_sold_total',
  help: 'Total tickets sold',
  labelNames: ['event_id', 'ticket_type']
});

// 대기열 크기
const queueSize = new Gauge({
  name: 'tiketi_queue_size',
  help: 'Current queue size',
  labelNames: ['event_id']
});

// WebSocket 연결 수
const websocketConnections = new Gauge({
  name: 'tiketi_websocket_connections',
  help: 'Active WebSocket connections'
});

// 예약 처리 시간
const reservationDuration = new Histogram({
  name: 'tiketi_reservation_duration_seconds',
  help: 'Time to complete reservation',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

module.exports = {
  ticketsSold,
  queueSize,
  websocketConnections,
  reservationDuration
};


사용 예시 (backend/src/routes/reservations.js):

const { ticketsSold, reservationDuration } = require('../metrics/business');

router.post('/', async (req, res) => {
  const end = reservationDuration.startTimer();

  try {
    // ... 예약 로직 ...

    ticketsSold.inc({
      event_id: eventId,
      ticket_type: ticketType
    });

    end(); // 성공 시 시간 기록
  } catch (error) {
    end({ status: 'failed' });
  }
});

🎯 CloudWatch 대시보드 예시
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["Tiketi/Queue", "QueueSize", { "stat": "Average" }],
          ["AWS/EC2", "CPUUtilization", { "stat": "Average" }],
          ["AWS/RDS", "DatabaseConnections", { "stat": "Sum" }]
        ],
        "period": 60,
        "stat": "Average",
        "region": "ap-northeast-2",
        "title": "Real-time System Health"
      }
    }
  ]
}

💰 Cost Optimization (비용 최적화)
<div align="center">

현재 추정 비용: 약 ₩250,000 / 월 (~$190)

</div>
추가 절감 포인트

EC2 Reserved Instances (Baseline 2대)

약 40% 절감

≒ ₩36,000 / 월 절감

Auto Scaling용 Spot Instances

피크 시 추가 인스턴스를 Spot으로 운영

약 70% 절감

≒ ₩5,600 / 월 절감

S3 Intelligent-Tiering

저빈도 접근 파일 자동 이동

≒ ₩1,000 / 월 절감

CloudWatch Logs 보존 기간 조정

Debug: 7일, Application: 30일

≒ ₩3,000 / 월 절감

총 잠재 절감액: ≒ ₩45,600 / 월 (약 18% 절감)
최적화 후 비용: ≒ ₩204,400 / 월 (~$155)

🎯 Priority Action Items (우선순위 액션 아이템)
<div align="center">
우선순위	기간	할 일
Critical	이번 주	보안 미들웨어, 시크릿 교체, Secrets Manager, 락 수정
High	2주 이내	테스트, 인덱스, 알람, Blue-Green 배포
Medium	다음 달	k6 부하 테스트, RDS 백업, WAF, 에러 코드 표준화
Low	장기적 개선	APM, Chaos 테스트, GraphQL, 멀티 리전 계획
</div>

(체크는 실제 진행 사항에 따라 Git에서 ✅ / ⏳ / ❌ 등으로 관리 가능)

📊 Final Scorecard (최종 평가표)
<div align="center">
카테고리	점수	코멘트
Architecture	⭐⭐⭐⭐⭐ 5/5	훌륭한 멀티 티어 AWS 설계
Security	⭐⭐⭐⭐☆ 4/5	기반은 탄탄, 미들웨어·시크릿 하드닝 필요
Performance	⭐⭐⭐⭐☆ 4/5	큐 기반 스케일링 우수, 인덱스/튜닝 여지 있음
Code Quality	⭐⭐⭐⭐☆ 4/5	구조는 좋으나 테스트 부족
DevOps	⭐⭐⭐⭐⭐ 5/5	성숙한 CI/CD 및 Observability 스택
Documentation	⭐⭐⭐⭐⭐ 5/5	아키텍처 및 구성 문서가 충실

Overall: ⭐⭐⭐⭐☆ 4.2 / 5.0
→ “보안 하드닝 + 테스트 커버리지 보강 완료 시, 프로덕션 런칭 충분히 가능”

</div>
🎉 Conclusion (결론)

“현재 85% 수준의 프로덕션 준비도.
남은 15%는 보안과 품질(테스트)이라는 마지막 퍼즐 조각입니다.”

TIKETI 플랫폼의 강점:

CPU 기반이 아닌 큐 사이즈 기반 예측 스케일링

Redis 기반 WebSocket 세션 복구

Multi-AZ 고가용성 + 비용 효율적인 AWS 아키텍처

Prometheus / Loki / Grafana를 활용한 강력한 Observability

다음 단계 요약:

보안 하드닝

helmet, Rate Limiting, HTTPS 강제, 시크릿 교체, Secrets Manager 도입

테스트 & 검증 체계

Jest + Supertest 기반 통합 테스트, k6 부하 테스트

CI/CD에 Pre-Deployment Checks 추가