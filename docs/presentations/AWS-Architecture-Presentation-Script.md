# TIKETI AWS 프로덕션 아키텍처 발표 대본
> **실제 프로젝트 코드와 AWS 서비스 연결 중심 설명**

---

## 발표 시작

안녕하세요, 오늘은 저희가 개발한 **TIKETI 실시간 티켓팅 플랫폼**의 AWS 프로덕션 아키텍처를 설명드리겠습니다.

특히 **실제 구현된 코드가 AWS 서비스와 어떻게 연결되는지**, 그리고 **대규모 트래픽 상황에서 어떻게 안정적으로 작동하는지**에 중점을 두고 말씀드리겠습니다.

---

## 1. 프로젝트 개요

### 1.1 TIKETI란?

**실시간 티켓 예매 플랫폼**으로, 다음과 같은 특징이 있습니다:

- **WebSocket 기반 실시간 동기화**: 누군가 티켓을 구매하면 모든 사용자가 즉시 확인
- **대기열 시스템**: 트래픽 폭주 시 공정한 순번 관리
- **좌석 선택 시스템**: 여러 사용자가 동시에 좌석을 선택해도 충돌 방지
- **Multi-AZ 고가용성**: 하나의 데이터센터 장애에도 서비스 지속

### 1.2 기술 스택

**프론트엔드:**
```javascript
// frontend/package.json
{
  "dependencies": {
    "react": "^18.2.0",
    "socket.io-client": "^4.7.2",  // WebSocket 클라이언트
    "axios": "^1.6.2",              // HTTP 클라이언트
    "react-router-dom": "^6.20.1"
  }
}
```

**백엔드:**
```javascript
// backend/package.json
{
  "dependencies": {
    "express": "^4.18.2",                    // REST API
    "socket.io": "^4.7.2",                   // WebSocket 서버
    "@socket.io/redis-adapter": "^8.2.1",    // 멀티 인스턴스 동기화
    "pg": "^8.11.3",                         // PostgreSQL 클라이언트
    "redis": "^4.6.11",                      // Redis 클라이언트
    "jsonwebtoken": "^9.0.2"                 // JWT 인증
  }
}
```

---

## 2. AWS 아키텍처 전체 구조

### 2.1 사용자 요청 흐름

```
사용자 브라우저 (tiketi.gg 입력)
    ↓
Route 53 (DNS 조회)
    ↓
CloudFront (CDN, 전세계 엣지 로케이션)
    ↓
┌─────────────┬─────────────┐
│  S3 Bucket  │  ALB + VPC  │
│  (React)    │  (API)      │
└─────────────┴─────────────┘
```

### 2.2 VPC 내부 구조

```
VPC (10.0.0.0/16) - 서울 리전 (ap-northeast-2)
│
├── Availability Zone A (ap-northeast-2a)
│   ├── Public Subnet (10.0.1.0/24)
│   │   └── NAT Gateway
│   ├── Private Subnet (10.0.11.0/24)
│   │   ├── EC2-1 (Node.js + Socket.IO)
│   │   ├── EC2-2 (Node.js + Socket.IO)
│   │   ├── EC2-3 (Node.js + Socket.IO)
│   │   └── ElastiCache Redis Primary
│   └── DB Subnet (10.0.21.0/24)
│       └── Aurora PostgreSQL Primary
│
└── Availability Zone B (ap-northeast-2b)
    ├── Public Subnet (10.0.2.0/24)
    │   └── NAT Gateway
    ├── Private Subnet (10.0.12.0/24)
    │   ├── EC2-4 (Node.js + Socket.IO)
    │   ├── EC2-5 (Node.js + Socket.IO)
    │   └── ElastiCache Redis Replica
    └── DB Subnet (10.0.22.0/24)
        └── Aurora PostgreSQL Replica
```

---

## 3. 프론트엔드 배포 구조 (React → S3 → CloudFront)

### 3.1 프로젝트 코드의 AWS 연결

**개발 환경 (현재):**
```bash
# frontend/ 디렉토리에서
npm start  # localhost:3000에서 React 실행
```

**프로덕션 환경 (AWS):**
```bash
# 1. React 빌드
cd frontend
npm run build
# → build/ 폴더에 정적 파일 생성

# 2. S3에 업로드
aws s3 sync build/ s3://tiketi-frontend-bucket/

# 3. CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

### 3.2 AWS 서비스 구성

**S3 Bucket 설정:**
```json
{
  "BucketName": "tiketi-frontend-bucket",
  "Region": "ap-northeast-2",
  "StaticWebsiteHosting": {
    "IndexDocument": "index.html",
    "ErrorDocument": "index.html"
  },
  "PublicAccessBlock": {
    "BlockPublicAcls": false,
    "IgnorePublicAcls": false
  }
}
```

**CloudFront 설정:**
```json
{
  "DistributionId": "E1234567890ABC",
  "Origins": [
    {
      "Id": "S3-tiketi-frontend",
      "DomainName": "tiketi-frontend-bucket.s3.ap-northeast-2.amazonaws.com",
      "OriginPath": ""
    }
  ],
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-tiketi-frontend",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": ["GET", "HEAD"],
    "CachedMethods": ["GET", "HEAD"],
    "Compress": true,
    "DefaultTTL": 86400
  }
}
```

**Route 53 설정:**
```json
{
  "HostedZoneId": "Z1234567890ABC",
  "RecordSets": [
    {
      "Name": "tiketi.gg",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z2FDTNDATAQYW2",
        "DNSName": "d123abc.cloudfront.net",
        "EvaluateTargetHealth": false
      }
    }
  ]
}
```

### 3.3 사용자 접속 흐름

```
사용자: "tiketi.gg 입력"
  ↓
Route 53: "CloudFront 주소는 d123abc.cloudfront.net"
  ↓
CloudFront: "서울 엣지 로케이션에서 캐시 확인"
  ├─ 캐시 있음 → 즉시 응답 (10ms)
  └─ 캐시 없음 → S3에서 가져와 캐싱 (100ms)
  ↓
브라우저: React 앱 로드 완료
```

---

## 4. 백엔드 API 구조 (ALB → EC2 → Redis → RDS)

### 4.1 프로젝트 코드의 AWS 연결

**서버 시작 코드:**
```javascript
// backend/src/server.js
const express = require('express');
const { initializeSocketIO } = require('./config/socket');

const app = express();
const server = require('http').createServer(app);

// Socket.IO 초기화 (Redis Adapter 포함)
const io = initializeSocketIO(server);

// REST API 라우트
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/seats', require('./routes/seats'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/queue', require('./routes/queue'));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
```

**AWS 환경 변수 (.env):**
```bash
# 현재 (Docker Compose)
DATABASE_URL=postgresql://user:pass@postgres:5432/tiketi
REDIS_HOST=redis
REDIS_PORT=6379

# AWS 프로덕션
DATABASE_URL=tiketi-db.cluster-abc123.ap-northeast-2.rds.amazonaws.com
REDIS_HOST=tiketi-redis.abc123.ng.0001.apn2.cache.amazonaws.com
REDIS_PORT=6379
```

### 4.2 ALB (Application Load Balancer) 설정

**ALB가 하는 일:**
1. 사용자 요청을 여러 EC2에 분산
2. WebSocket 연결 유지 (Sticky Session)
3. 헬스 체크로 장애 EC2 자동 제외
4. HTTPS 종료 (SSL/TLS)

**ALB 설정:**
```json
{
  "LoadBalancerName": "tiketi-alb",
  "Scheme": "internet-facing",
  "Subnets": [
    "subnet-public-a",
    "subnet-public-b"
  ],
  "SecurityGroups": ["sg-alb"],
  "Listeners": [
    {
      "Protocol": "HTTPS",
      "Port": 443,
      "Certificates": [
        {
          "CertificateArn": "arn:aws:acm:ap-northeast-2:...:certificate/..."
        }
      ],
      "DefaultActions": [
        {
          "Type": "forward",
          "TargetGroupArn": "arn:aws:elasticloadbalancing:..."
        }
      ]
    }
  ]
}
```

**Target Group (Sticky Session 포함):**
```json
{
  "TargetGroupName": "tiketi-backend-targets",
  "Protocol": "HTTP",
  "Port": 3001,
  "VpcId": "vpc-12345678",
  "HealthCheckPath": "/health",
  "HealthCheckInterval": 30,
  "HealthyThresholdCount": 2,
  "UnhealthyThresholdCount": 3,
  "Stickiness": {
    "Enabled": true,
    "Type": "lb_cookie",
    "DurationSeconds": 86400
  }
}
```

**왜 Sticky Session이 필요한가?**

WebSocket은 지속적인 연결입니다. 사용자 A가 EC2-1과 WebSocket 연결을 맺었다면, 이후 모든 요청도 EC2-1로 가야 합니다.

```javascript
// 사용자 A: EC2-1에 연결
const socket = io('https://tiketi.gg');

// ALB가 쿠키로 기억: AWSALB=ec2-1-identifier
// 이후 모든 요청은 EC2-1로 라우팅
socket.emit('join-event', { eventId: 123 });
socket.on('ticket-updated', (data) => {
  // EC2-1에서 받은 메시지
});
```

### 4.3 EC2 인스턴스 구성

**인스턴스 스펙:**
```
Instance Type: t3.medium
vCPU: 2
Memory: 4GB RAM
Storage: 20GB gp3 SSD
OS: Amazon Linux 2023
```

**User Data (인스턴스 시작 시 자동 실행):**
```bash
#!/bin/bash
# 1. 의존성 설치
yum update -y
yum install -y nodejs npm git

# 2. 애플리케이션 배포
cd /home/ec2-user
git clone https://github.com/your-org/tiketi-backend.git
cd tiketi-backend/backend

# 3. 환경 변수 설정 (Secrets Manager에서 가져오기)
aws secretsmanager get-secret-value \
  --secret-id tiketi/prod/backend \
  --region ap-northeast-2 \
  --query SecretString \
  --output text > .env

# 4. 의존성 설치 및 서버 시작
npm install
pm2 start src/server.js --name tiketi-backend
pm2 save
pm2 startup
```

### 4.4 Security Group 설정

**ALB Security Group:**
```json
{
  "GroupName": "tiketi-alb-sg",
  "InboundRules": [
    {
      "IpProtocol": "tcp",
      "FromPort": 80,
      "ToPort": 80,
      "CidrIp": "0.0.0.0/0"
    },
    {
      "IpProtocol": "tcp",
      "FromPort": 443,
      "ToPort": 443,
      "CidrIp": "0.0.0.0/0"
    }
  ]
}
```

**EC2 Security Group:**
```json
{
  "GroupName": "tiketi-ec2-sg",
  "InboundRules": [
    {
      "IpProtocol": "tcp",
      "FromPort": 3001,
      "ToPort": 3001,
      "SourceSecurityGroupId": "sg-alb"
    }
  ]
}
```

**보안 계층:**
```
외부 → ALB (80, 443 허용) → EC2 (ALB에서만 3001 허용) → Redis (EC2에서만 6379 허용) → RDS (EC2에서만 5432 허용)
```

---

## 5. Socket.IO + Redis Adapter: 멀티 인스턴스 동기화의 핵심

### 5.1 실제 구현 코드

**Socket.IO 초기화 (Redis Adapter 포함):**
```javascript
// backend/src/config/socket.js (실제 코드)
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

function initializeSocketIO(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ============================================
  // Redis Adapter 설정 (AWS 확장 대비)
  // ============================================
  const setupRedisAdapter = async () => {
    try {
      // Pub 클라이언트 (발행용)
      const pubClient = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
        },
      });

      // Sub 클라이언트 (구독용)
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      // Socket.IO에 Redis Adapter 연결
      io.adapter(createAdapter(pubClient, subClient));

      console.log('✅ Socket.IO Redis Adapter connected (Multi-instance ready)');
    } catch (error) {
      console.error('❌ Redis Adapter connection failed:', error.message);
      console.log('⚠️  Running Socket.IO in single-instance mode');
    }
  };

  setupRedisAdapter();

  return io;
}
```

### 5.2 동작 방식

**시나리오: 사용자 A가 티켓 구매**

```
1. 사용자 A (EC2-1에 연결): "티켓 구매" 버튼 클릭
   ↓
2. EC2-1에서 티켓 구매 처리
   - DB에 예매 기록 저장
   - 티켓 재고 차감
   ↓
3. Socket.IO로 이벤트 발행
   io.to(`event:123`).emit('ticket-updated', {
     eventId: 123,
     availableTickets: 98
   });
   ↓
4. Redis Adapter가 내부적으로 처리
   - Redis Pub/Sub로 메시지 발행
   - 채널: "socket.io#event:123#"
   - 메시지: { type: 'ticket-updated', data: {...} }
   ↓
5. Redis가 모든 EC2에게 브로드캐스트
   - EC2-1 ← 메시지 받음
   - EC2-2 ← 메시지 받음
   - EC2-3 ← 메시지 받음
   - EC2-4 ← 메시지 받음
   - EC2-5 ← 메시지 받음
   ↓
6. 각 EC2가 자신에게 연결된 클라이언트에게 전송
   - EC2-1 → 사용자 A, B, C
   - EC2-2 → 사용자 D, E, F
   - EC2-3 → 사용자 G, H, I
   - ...
   ↓
7. 모든 사용자의 화면이 즉시 업데이트!
```

**코드로 보는 실시간 동기화:**
```javascript
// backend/src/routes/reservations.js (예매 생성)
router.post('/create', authenticateToken, async (req, res) => {
  const { eventId, seatIds } = req.body;
  const userId = req.user.userId;

  // 트랜잭션으로 예매 처리
  const reservation = await createReservation(userId, eventId, seatIds);

  // 🔥 모든 EC2의 사용자에게 실시간 알림
  const io = req.app.get('io');
  io.to(`event:${eventId}`).emit('ticket-updated', {
    eventId,
    availableTickets: reservation.remainingTickets
  });

  res.json({ success: true, reservation });
});
```

**프론트엔드에서 받는 코드:**
```javascript
// frontend/src/hooks/useSocket.js
useEffect(() => {
  socket.on('ticket-updated', ({ eventId, availableTickets }) => {
    console.log('✅ Ticket updated:', eventId, availableTickets);

    // 화면 즉시 업데이트
    setAvailableTickets(availableTickets);

    // 사용자에게 알림
    toast.info(`남은 티켓: ${availableTickets}장`);
  });

  return () => {
    socket.off('ticket-updated');
  };
}, [socket]);
```

### 5.3 Redis Adapter의 마법

**개발자는 단일 서버처럼 코딩:**
```javascript
// 이 한 줄이면 끝!
io.to(`event:123`).emit('ticket-updated', data);

// Redis Adapter가 자동으로:
// 1. 모든 EC2에게 메시지 전파
// 2. 각 EC2가 자신의 클라이언트에게 전송
// 3. 개발자는 멀티 서버를 신경 쓸 필요 없음!
```

---

## 6. Redis ElastiCache: 3가지 핵심 역할

### 6.1 역할 1: Pub/Sub (실시간 동기화)

방금 설명드린 Socket.IO Redis Adapter가 이것을 사용합니다.

### 6.2 역할 2: Queue (대기열 관리)

**실제 구현 코드:**
```javascript
// backend/src/services/queue-manager.js (실제 코드)
const { client: redisClient } = require('../config/redis');

class QueueManager {
  /**
   * 대기열에 사용자 추가
   */
  async addToQueue(eventId, userId) {
    const key = `queue:${eventId}`;
    const timestamp = Date.now();

    // Redis Sorted Set에 추가 (timestamp를 score로)
    await redisClient.zAdd(key, timestamp, userId);

    console.log(`⏳ User ${userId} added to queue (event:${eventId})`);
  }

  /**
   * 대기 순번 조회
   */
  async getQueuePosition(eventId, userId) {
    const key = `queue:${eventId}`;

    // Sorted Set에서 순위 조회 (0-based)
    const rank = await redisClient.zRank(key, userId);

    return rank !== null ? rank + 1 : null;
  }

  /**
   * 대기열에서 앞 N명 꺼내기
   */
  async popFromQueue(eventId, count) {
    const key = `queue:${eventId}`;

    // 앞에서부터 N명 조회
    const users = await redisClient.zRange(key, 0, count - 1);

    // 조회한 사용자들 제거
    if (users.length > 0) {
      await redisClient.zRemRangeByRank(key, 0, count - 1);
    }

    return users;
  }

  /**
   * 대기열 총 인원
   */
  async getQueueSize(eventId) {
    const key = `queue:${eventId}`;
    return await redisClient.zCard(key);
  }
}
```

**사용자 경험:**
```
사용자: "티켓 구매 버튼 클릭"
  ↓
서버: "현재 활성 사용자 1,000명 (임계값 도달)"
  ↓
서버: "대기열에 등록"
  await queueManager.addToQueue(123, 'user-456');
  ↓
사용자: "현재 8,245번째로 대기 중입니다"
  ↓
사용자: "페이지 새로고침"
  ↓
서버: "대기열에서 순번 조회"
  const position = await queueManager.getQueuePosition(123, 'user-456');
  ↓
사용자: "여전히 8,245번째!" (순번 유지됨)
```

### 6.3 역할 3: Cache (세션 및 임시 데이터)

**세션 저장:**
```javascript
// backend/src/services/socket-session-manager.js
async function saveUserSession(userId, sessionData) {
  const key = `session:${userId}`;

  await redisClient.set(
    key,
    JSON.stringify(sessionData),
    'EX', 3600  // 1시간 후 자동 삭제
  );
}

async function getUserSession(userId) {
  const key = `session:${userId}`;
  const data = await redisClient.get(key);

  return data ? JSON.parse(data) : null;
}
```

**좌석 임시 예약:**
```javascript
// backend/src/routes/seats.js
router.post('/lock', authenticateToken, async (req, res) => {
  const { seatId } = req.body;
  const userId = req.user.userId;

  // Redis에 5분간 임시 예약
  await redisClient.set(
    `seat:${seatId}:locked`,
    userId,
    'EX', 300  // 5분
  );

  // 5분 후 자동 해제됨
});
```

### 6.4 ElastiCache 설정

**Cluster Mode:**
```json
{
  "ReplicationGroupId": "tiketi-redis",
  "ReplicationGroupDescription": "Redis cluster for Tiketi",
  "Engine": "redis",
  "CacheNodeType": "cache.t4g.micro",
  "NumNodeGroups": 2,
  "ReplicasPerNodeGroup": 1,
  "AutomaticFailoverEnabled": true,
  "MultiAZEnabled": true,
  "PreferredMaintenanceWindow": "sun:05:00-sun:06:00",
  "SnapshotRetentionLimit": 5,
  "SnapshotWindow": "03:00-04:00"
}
```

**구성:**
```
Primary Node (AZ-A):
  - 읽기/쓰기 처리
  - 대기열, 세션, 캐시 저장

Replica Node (AZ-B):
  - 읽기만 처리
  - Primary 장애 시 자동 승격 (10~30초)
```

---

## 7. RDS Aurora PostgreSQL: 영구 데이터 저장

### 7.1 프로젝트 데이터베이스 구조

**테이블 구조:**
```sql
-- database/init.sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date TIMESTAMP NOT NULL,
  venue VARCHAR(255),
  artist VARCHAR(255),
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  available INTEGER NOT NULL
);

CREATE TABLE seats (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id),
  section VARCHAR(50),
  row VARCHAR(10),
  number VARCHAR(10),
  price DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'available'
);

CREATE TABLE reservations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  event_id INTEGER REFERENCES events(id),
  seat_id INTEGER REFERENCES seats(id),
  status VARCHAR(50) DEFAULT 'pending',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 7.2 실제 코드의 RDS 연결

**데이터베이스 연결:**
```javascript
// backend/src/config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,         // AWS: tiketi-db.cluster-abc123.ap-northeast-2.rds.amazonaws.com
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,                            // 최대 연결 수
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = { pool };
```

**트랜잭션 예시:**
```javascript
// backend/src/routes/reservations.js
async function createReservation(userId, eventId, seatIds) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 좌석 잠금 (FOR UPDATE로 동시성 제어)
    const seatQuery = `
      SELECT * FROM seats
      WHERE id = ANY($1) AND status = 'available'
      FOR UPDATE
    `;
    const seats = await client.query(seatQuery, [seatIds]);

    if (seats.rows.length !== seatIds.length) {
      throw new Error('일부 좌석이 이미 예약되었습니다');
    }

    // 2. 좌석 상태 변경
    await client.query(
      `UPDATE seats SET status = 'reserved' WHERE id = ANY($1)`,
      [seatIds]
    );

    // 3. 예약 생성
    const reservation = await client.query(
      `INSERT INTO reservations (user_id, event_id, seat_id, expires_at)
       VALUES ($1, $2, UNNEST($3::int[]), NOW() + INTERVAL '5 minutes')
       RETURNING *`,
      [userId, eventId, seatIds]
    );

    await client.query('COMMIT');
    return reservation.rows;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 7.3 Aurora Multi-AZ 고가용성

**구성:**
```
Primary Writer (AZ-A):
  - 읽기/쓰기 처리
  - 엔드포인트: tiketi-db.cluster-abc123.ap-northeast-2.rds.amazonaws.com

Reader Replica (AZ-B):
  - 읽기 전용
  - 엔드포인트: tiketi-db.cluster-ro-abc123.ap-northeast-2.rds.amazonaws.com
  - Primary 장애 시 자동 승격 (30초)
```

**코드에서 읽기/쓰기 분리:**
```javascript
// 쓰기 작업: Primary로
const writerPool = new Pool({
  host: 'tiketi-db.cluster-abc123.ap-northeast-2.rds.amazonaws.com',
  // ...
});

// 읽기 작업: Replica로
const readerPool = new Pool({
  host: 'tiketi-db.cluster-ro-abc123.ap-northeast-2.rds.amazonaws.com',
  // ...
});

// 사용 예시
async function getEvents() {
  // 읽기만 하므로 Replica 사용
  return await readerPool.query('SELECT * FROM events ORDER BY event_date');
}

async function createReservation(data) {
  // 쓰기가 필요하므로 Primary 사용
  return await writerPool.query('INSERT INTO reservations ...');
}
```

---

## 8. Auto Scaling: 대기열 크기 기반 확장

### 8.1 Lambda Queue Monitor

**역할:** Redis 대기열 크기를 CloudWatch로 전송

**Lambda 함수 코드:**
```javascript
// lambda/queue-monitor.js (배포용)
const Redis = require('ioredis');
const { CloudWatch } = require('@aws-sdk/client-cloudwatch');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379
});

const cloudwatch = new CloudWatch({ region: 'ap-northeast-2' });

exports.handler = async (event) => {
  try {
    // 활성 이벤트 목록 조회
    const activeEvents = await redis.smembers('active-events');

    for (const eventId of activeEvents) {
      // 대기열 크기 조회
      const queueSize = await redis.zcard(`queue:${eventId}`);

      // 활성 사용자 수 조회
      const activeUsers = await redis.scard(`active:${eventId}`);

      // CloudWatch에 메트릭 전송
      await cloudwatch.putMetricData({
        Namespace: 'Tiketi/Queue',
        MetricData: [
          {
            MetricName: 'QueueSize',
            Value: queueSize,
            Unit: 'Count',
            Dimensions: [
              { Name: 'EventId', Value: eventId }
            ],
            Timestamp: new Date()
          },
          {
            MetricName: 'ActiveUsers',
            Value: activeUsers,
            Unit: 'Count',
            Dimensions: [
              { Name: 'EventId', Value: eventId }
            ],
            Timestamp: new Date()
          }
        ]
      });

      console.log(`[${eventId}] Queue: ${queueSize}, Active: ${activeUsers}`);
    }

    return { statusCode: 200, body: 'Metrics sent successfully' };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: error.message };
  }
};
```

**EventBridge 스케줄:**
```json
{
  "Name": "tiketi-queue-monitor-schedule",
  "ScheduleExpression": "rate(1 minute)",
  "State": "ENABLED",
  "Targets": [
    {
      "Id": "1",
      "Arn": "arn:aws:lambda:ap-northeast-2:123456789012:function:tiketi-queue-monitor"
    }
  ]
}
```

### 8.2 CloudWatch Alarms

**Scale Out Alarm (대기열 > 5,000명):**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name tiketi-queue-scale-out \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --metric-name QueueSize \
  --namespace Tiketi/Queue \
  --period 60 \
  --statistic Average \
  --threshold 5000.0 \
  --alarm-actions arn:aws:autoscaling:ap-northeast-2:123456789012:scalingPolicy/.../tiketi-scale-out
```

**Scale In Alarm (대기열 < 1,000명):**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name tiketi-queue-scale-in \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 2 \
  --metric-name QueueSize \
  --namespace Tiketi/Queue \
  --period 300 \
  --statistic Average \
  --threshold 1000.0 \
  --alarm-actions arn:aws:autoscaling:ap-northeast-2:123456789012:scalingPolicy/.../tiketi-scale-in
```

### 8.3 Auto Scaling Group

**ASG 설정:**
```json
{
  "AutoScalingGroupName": "tiketi-backend-asg",
  "LaunchTemplate": {
    "LaunchTemplateId": "lt-abc123",
    "Version": "$Latest"
  },
  "MinSize": 2,
  "MaxSize": 10,
  "DesiredCapacity": 2,
  "VPCZoneIdentifier": "subnet-private-a,subnet-private-b",
  "TargetGroupARNs": [
    "arn:aws:elasticloadbalancing:ap-northeast-2:123456789012:targetgroup/tiketi-backend/..."
  ],
  "HealthCheckType": "ELB",
  "HealthCheckGracePeriod": 300
}
```

**Scaling Policies:**
```json
{
  "ScaleOutPolicy": {
    "PolicyName": "tiketi-scale-out",
    "AdjustmentType": "ChangeInCapacity",
    "ScalingAdjustment": 2,
    "Cooldown": 180
  },
  "ScaleInPolicy": {
    "PolicyName": "tiketi-scale-in",
    "AdjustmentType": "ChangeInCapacity",
    "ScalingAdjustment": -1,
    "Cooldown": 600
  }
}
```

### 8.4 실제 동작 시나리오

```
오후 7:50 (티켓 오픈 10분 전)
├─ 대기열: 3,000명
├─ Lambda: QueueSize=3000 → CloudWatch
├─ CloudWatch: 임계값 미만 (< 5,000)
└─ 액션: 없음 (EC2 2대 유지)

오후 7:55 (5분 전)
├─ 대기열: 8,000명
├─ Lambda: QueueSize=8000 → CloudWatch
├─ CloudWatch: 🚨 알람 발동! (> 5,000)
├─ Auto Scaling: EC2 +2대 시작
└─ 3~5분 후: EC2-3, EC2-4 가동

오후 7:58 (2분 전)
├─ 대기열: 25,000명
├─ Lambda: QueueSize=25000 → CloudWatch
├─ CloudWatch: 🚨 Aggressive 알람! (> 20,000)
├─ Auto Scaling: EC2 +5대 시작
└─ 3~5분 후: EC2-5,6,7,8,9 가동

오후 8:00 (티켓 오픈)
├─ 대기열: 20,000명 (처리 중)
├─ 운영 중: EC2 9대
├─ 처리 능력: 9,000명 동시
└─ 상태: ✅ 안정적

오후 8:30 (판매 완료)
├─ 대기열: 800명
├─ Lambda: QueueSize=800 → CloudWatch
├─ CloudWatch: Scale In 조건 확인 중...
└─ 2번 연속 < 1,000 확인 후 축소 시작

오후 9:00 (정상화)
├─ 대기열: 0명
├─ Auto Scaling: 10분마다 EC2 -1대
└─ 최종: EC2 2대로 복귀
```

---

## 9. S3 VPC Endpoint: 비용 77% 절감

### 9.1 문제 상황

**NAT Gateway 경유 시:**
```
EC2 → NAT Gateway → Internet Gateway → S3
│      ↓
│      매우 비쌈!
│      - NAT Gateway 시간당 ₩50
│      - 데이터 전송 GB당 ₩50
│      - 월 100GB = ₩5,000
```

**S3 VPC Endpoint 사용 시:**
```
EC2 → S3 VPC Endpoint → S3
│      ↓
│      무료!
│      - VPC 내부 트래픽
│      - 데이터 전송 무료
│      - 월 100GB = ₩0
```

### 9.2 실제 구현

**VPC Endpoint 생성:**
```bash
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-12345678 \
  --service-name com.amazonaws.ap-northeast-2.s3 \
  --route-table-ids rtb-private-a rtb-private-b \
  --vpc-endpoint-type Gateway
```

**Route Table 자동 업데이트:**
```
Destination: pl-78a54011 (S3 prefix list)
Target: vpce-abc123 (S3 VPC Endpoint)
```

**코드 변경 불필요:**
```javascript
// backend에서 S3 업로드
const AWS = require('aws-sdk');
const s3 = new AWS.S3({ region: 'ap-northeast-2' });

// VPC Endpoint가 자동으로 경로 최적화
await s3.upload({
  Bucket: 'tiketi-uploads',
  Key: 'events/image.jpg',
  Body: fileBuffer
}).promise();

// NAT 경유 없이 직접 S3로!
```

### 9.3 비용 절감 효과

**월간 100GB S3 업로드/다운로드 기준:**

| 구분 | NAT Gateway 경유 | VPC Endpoint |
|------|-----------------|--------------|
| NAT Gateway 비용 | ₩50/시간 × 730시간 = ₩36,500 | ₩0 |
| 데이터 전송 비용 | ₩50/GB × 100GB = ₩5,000 | ₩0 |
| **합계** | **₩41,500** | **₩0** |
| **절감율** | - | **100%** |

**연간 절감액: ₩498,000**

---

## 10. 모니터링 및 장애 대응

### 10.1 CloudWatch 대시보드

**주요 메트릭:**
```javascript
// 1. 비즈니스 메트릭
- QueueSize: 대기열 크기
- ActiveUsers: 활성 사용자 수
- TicketsSoldPerMinute: 분당 판매량

// 2. 인프라 메트릭
- EC2 Instance Count: Auto Scaling 현황
- ALB Request Count: 총 요청 수
- ALB Response Time: P50, P95, P99
- RDS CPU/Memory: 데이터베이스 부하
- ElastiCache CPU/Memory: Redis 부하

// 3. 애플리케이션 메트릭
- WebSocket Connections: 실시간 연결 수
- API Error Rate: 에러 발생률
- Session Restoration Rate: 재연결 성공률
```

### 10.2 알람 설정 예시

**Critical Alarms (즉시 대응):**
```javascript
1. RDS CPU > 80% for 5 minutes
   → SMS + PagerDuty + Slack

2. ALB 5xx Error Rate > 5%
   → SMS + PagerDuty + Slack

3. ElastiCache Memory > 90%
   → SMS + Slack

4. Queue Size > 50,000
   → SMS + Slack (추가 대응 논의)
```

**Warning Alarms (주의 필요):**
```javascript
1. EC2 CPU > 70% for 10 minutes
   → Slack 알림

2. API Response Time P95 > 500ms
   → Slack 알림

3. WebSocket Reconnection Rate > 10%
   → Slack 알림
```

### 10.3 장애 시나리오: AZ-A 전체 장애

**발생:**
```
20:15:00 - Availability Zone A 네트워크 장애
```

**영향받는 리소스:**
```
- EC2-1, EC2-2, EC2-3 (AZ-A)
- RDS Primary (AZ-A)
- ElastiCache Primary (AZ-A)
- NAT Gateway (AZ-A)
```

**자동 복구 타임라인:**
```
20:15:05 - ALB Health Check 실패 감지
         - AZ-A의 EC2들을 Unhealthy로 표시

20:15:10 - ALB가 모든 트래픽을 AZ-B로 라우팅
         - 사용자 요청: EC2-4, EC2-5로만 분산

20:15:15 - RDS 자동 페일오버 시작
         - Replica (AZ-B)가 Primary로 승격

20:15:20 - ElastiCache 자동 페일오버
         - Replica (AZ-B)가 Primary로 승격

20:15:30 - WebSocket 재연결 시작
         - 사용자들이 AZ-B의 EC2로 재연결
         - Redis 세션에서 이전 상태 복구

20:15:40 - Auto Scaling 감지
         - AZ-B에 EC2 4대 추가 시작

20:20:00 - 새 EC2 가동 완료
         - 처리 능력 완전 복구
```

**사용자 영향:**
```
- 20:15:00 ~ 20:15:30 (30초): 일부 요청 타임아웃
- 20:15:30 ~ 20:20:00 (4분 30초): 느린 응답 (처리 능력 50%)
- 20:20:00 이후: 정상 서비스
```

**Total Downtime: 약 30초, 성능 저하: 약 5분**

---

## 11. 비용 분석

### 11.1 월간 비용 (5,000 동시 접속 기준)

| 항목 | 서비스 | 사양 | 월 비용 | 비고 |
|------|--------|------|---------|------|
| **컴퓨팅** |
| EC2 Backend | t3.medium × 2 | 2 vCPU, 4GB RAM | ₩80,000 | 평상시 |
| ALB | Application Load Balancer | - | ₩27,000 | Sticky Session |
| Lambda | Queue Monitor | 1분 주기 | ₩1,000 | 43,200회/월 |
| **데이터베이스** |
| RDS Aurora | db.t4g.medium Multi-AZ | 2 vCPU, 4GB RAM, 50GB | ₩60,000 | 자동 백업 |
| ElastiCache | cache.t4g.micro × 2 | Multi-AZ | ₩40,000 | Primary + Replica |
| **스토리지 & CDN** |
| S3 | 50GB | React 빌드 + 업로드 | ₩2,000 | |
| CloudFront | 1TB | CDN | FREE | 프리티어 |
| **네트워크** |
| NAT Gateway | Single AZ | - | ₩36,500 | 대안 경로 |
| Data Transfer | 500GB/월 | - | ₩5,000 | |
| VPC Endpoint | Gateway | S3 직접 연결 | FREE | |
| **보안 & 모니터링** |
| Route 53 | 1 Hosted Zone | - | ₩500 | DNS |
| ACM | SSL/TLS 인증서 | - | FREE | |
| Secrets Manager | 3 secrets | - | ₩2,000 | 환경 변수 |
| CloudWatch | Logs + Alarms | 10GB 로그 | ₩5,000 | |
| **합계** | | | **₩259,000/월** | **약 $195/월** |

### 11.2 피크 타임 추가 비용

**티켓 오픈 시 (1시간, 월 20회):**
```
EC2 추가 8대:        ₩400/시간 × 20회 = ₩8,000
데이터 전송 증가:    ₩50/시간 × 20회 = ₩1,000
────────────────────────────────────────
피크 추가 비용:                    ₩9,000/월
```

**총 예상 비용: ₩268,000/월 (~$200/월)**

### 11.3 비용 최적화

**1. S3 VPC Endpoint로 NAT 비용 77% 절감**
```
NAT 경유 S3 업로드 (100GB):  ₩41,500
VPC Endpoint 사용:           ₩0
────────────────────────────────────
절감액:                     ₩41,500/월
```

**2. Reserved Instances (1년 약정)**
```
EC2 2대를 1년 예약:
  기존: ₩80,000/월
  예약: ₩48,000/월 (40% 할인)
────────────────────────────────────
절감액:                     ₩32,000/월
```

**3. Auto Scaling으로 비용 절감**
```
24/7 10대 운영:             ₩720,000/월
Auto Scaling (평균 2.5대):  ₩100,000/월
────────────────────────────────────
절감액:                     ₩620,000/월
```

**최종 최적화 비용: ₩154,500/월 (원래 대비 42% 절감)**

---

## 12. 정리 및 핵심 포인트

### 12.1 프로젝트와 AWS 서비스 매핑

| 프로젝트 컴포넌트 | AWS 서비스 | 연결 방식 |
|-----------------|-----------|----------|
| **frontend/** (React) | S3 + CloudFront | `npm run build` → S3 업로드 |
| **backend/src/server.js** | EC2 (t3.medium) | `pm2 start server.js` |
| **backend/src/config/socket.js** | EC2 + ElastiCache | Redis Adapter로 Pub/Sub |
| **backend/src/services/queue-manager.js** | ElastiCache Redis | Sorted Set 사용 |
| **backend/src/config/database.js** | RDS Aurora | PostgreSQL 연결 풀 |
| **database/init.sql** | RDS Aurora | 스키마 초기화 |

### 12.2 핵심 아키텍처 포인트

**1. Multi-AZ 고가용성**
- 모든 컴포넌트를 2개 가용 영역에 분산
- 하나의 AZ 장애에도 서비스 지속
- 자동 페일오버: RDS 30초, ElastiCache 10~30초

**2. WebSocket 멀티 인스턴스 동기화**
- Socket.IO + Redis Adapter로 모든 EC2 간 메시지 동기화
- 사용자 A가 EC2-1에 연결되어도 EC2-2,3,4,5의 사용자도 메시지 받음
- 코드 변경 불필요, 투명한 확장성

**3. 대기열 기반 Auto Scaling**
- Lambda가 1분마다 Redis 대기열 크기 측정
- CloudWatch Alarms로 EC2 자동 확장/축소
- CPU 기반보다 티켓팅에 적합 (사전 예방)

**4. 3층 보안 구조**
- Public Subnet (ALB) → Private Subnet (EC2, Redis) → DB Subnet (RDS)
- Security Group으로 층층이 접근 제어
- 해커가 DB에 접근하려면 5단계 침투 필요

**5. 비용 최적화**
- S3 VPC Endpoint로 NAT 비용 100% 절감
- Auto Scaling으로 평소 최소 구성 유지
- Reserved Instances로 고정 비용 40% 절감
- 결과: 월 ₩154,500 (~$115)

### 12.3 예상 성능 지표

```
동시 접속:      최대 10,000명 (EC2 10대 기준)
대기열 처리:    초당 50명 입장
API 응답:       P95 < 200ms
WebSocket:      실시간 (<100ms)
가용성:         99.9% (연간 다운타임 <9시간)
```

---

## 13. Q&A 예상 질문

### Q1: "왜 DragonflyDB 대신 ElastiCache를 사용하나요?"

**A:**
- **DragonflyDB**: 로컬 개발용 (Redis 호환, 빠른 성능)
- **ElastiCache**: AWS 프로덕션용
  - 자동 백업, 자동 페일오버, 패치 관리
  - Multi-AZ 고가용성 보장
  - CloudWatch와 네이티브 통합
  - 관리 부담 제로

### Q2: "WebSocket이 끊어지면 대기열 순번을 잃나요?"

**A:** 아닙니다!
```javascript
// backend/src/services/socket-session-manager.js
// Redis에 세션 저장 (1시간 유효)
await saveUserSession(userId, {
  queuePosition: 8245,
  eventId: 123
});

// 재연결 시 자동 복구
const session = await getUserSession(userId);
socket.emit('session-restored', session);
```

### Q3: "Auto Scaling으로 서버가 늘어나면 비용 폭탄 아닌가요?"

**A:**
- **Cooldown 설정**: 3분 간격으로만 확장 (무분별한 확장 방지)
- **Max Size 제한**: 최대 10대 (절대 초과 안 함)
- **빠른 Scale In**: 대기열 해소 후 10분마다 1대씩 축소
- **실제 비용**: 월 ₩9,000 추가 (20시간 피크)
- 24/7 10대 운영보다 **86% 저렴**

### Q4: "Redis가 다운되면 어떻게 되나요?"

**A:**
1. **Primary 장애**: Replica 자동 승격 (10~30초)
2. **전체 장애**: PostgreSQL Fallback
   ```javascript
   try {
     return await redis.get('session:123');
   } catch (error) {
     // Fallback to DB
     return await db.query('SELECT * FROM sessions WHERE id = $1', [123]);
   }
   ```
3. **영향**: 성능 저하 (느림), 기능 정상 작동

### Q5: "Multi-AZ가 정말 필요한가요?"

**A:**
- **비용**: RDS/ElastiCache Multi-AZ는 1.5배 (2배 아님)
- **가용성**: 99.9% → 99.99% (다운타임 10배 감소)
- **티켓팅 ROI**:
  - 1시간 서비스 중단 = 월 ₩10,000,000 손실
  - Multi-AZ 추가 비용 = ₩50,000/월
  - **200배 ROI**

---

## 발표 종료

이상으로 TIKETI의 AWS 프로덕션 아키텍처 설명을 마치겠습니다.

**핵심 메시지:**
- 실제 프로젝트 코드가 AWS 서비스와 어떻게 연결되는지 명확히 이해
- Multi-AZ + Auto Scaling + Redis Pub/Sub로 안정적이고 확장 가능한 아키텍처 구현
- 비용 최적화로 월 ₩154,500에 수만 명 동시 접속 지원 가능

**질문 있으시면 말씀해주세요!**

---

## 부록: 실제 배포 체크리스트

### 1단계: 네트워크 구성 (1주)
- [ ] VPC 생성 (10.0.0.0/16)
- [ ] Subnet 생성 (Public, Private, DB)
- [ ] Internet Gateway 연결
- [ ] NAT Gateway 생성 (각 AZ)
- [ ] Route Tables 구성
- [ ] S3 VPC Endpoint 생성

### 2단계: 데이터베이스 (1주)
- [ ] RDS Aurora PostgreSQL 생성 (Multi-AZ)
- [ ] ElastiCache Redis 생성 (Cluster Mode)
- [ ] Security Groups 구성
- [ ] 백업 정책 설정
- [ ] 스키마 마이그레이션 (init.sql 실행)

### 3단계: 컴퓨팅 (1주)
- [ ] AMI 생성 (Node.js + 의존성 설치)
- [ ] Launch Template 생성
- [ ] Auto Scaling Group 생성
- [ ] ALB 생성 (Sticky Session 포함)
- [ ] Target Group 연결

### 4단계: 스토리지 & CDN (3일)
- [ ] S3 Bucket 생성 (프론트엔드)
- [ ] S3 Bucket 생성 (업로드)
- [ ] CloudFront Distribution 생성
- [ ] Route 53 Hosted Zone 생성
- [ ] ACM 인증서 발급

### 5단계: Lambda & Auto Scaling (3일)
- [ ] Lambda 함수 배포 (Queue Monitor)
- [ ] EventBridge 스케줄 생성
- [ ] CloudWatch Alarms 생성
- [ ] Auto Scaling Policies 연결

### 6단계: 보안 & 모니터링 (3일)
- [ ] Secrets Manager 설정
- [ ] IAM Roles 생성
- [ ] CloudWatch Dashboard 구성
- [ ] SNS Topics 생성 (알림)

### 7단계: 테스트 & 최적화 (1주)
- [ ] 부하 테스트 (Artillery, k6)
- [ ] WebSocket 동기화 테스트
- [ ] 장애 시뮬레이션 (Chaos Engineering)
- [ ] 비용 최적화 검토

**총 배포 기간: 약 4~5주**
