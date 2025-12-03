# 🎯 Tiketi MSA 마이그레이션 완전 가이드

## 📊 현재 프로젝트 구조 분석

### 현재 모놀리식 구조

```
tiketi/
├── backend (단일 Node.js 서비스)
│   ├── routes/
│   │   ├── auth.js          # 인증/인가
│   │   ├── events.js        # 이벤트 조회
│   │   ├── queue.js         # 대기열 관리
│   │   ├── reservations.js  # 예매 처리
│   │   ├── payments.js      # 결제 처리
│   │   ├── seats.js         # 좌석 관리
│   │   ├── tickets.js       # 티켓 조회
│   │   ├── news.js          # 공지사항
│   │   ├── admin.js         # 관리자
│   │   └── image.js         # 이미지 업로드
│   └── services/
│       ├── queue-manager.js
│       ├── reservation-cleaner.js
│       ├── event-status-updater.js
│       └── socket-session-manager.js
├── frontend (React)
├── postgres (DB)
└── dragonfly (Redis)
```

---

## 🏗️ MSA 서비스 분리 전략

### 1. 최종 MSA 구조 (6개 서비스)

```
services/
├── 1. auth-service/          # 인증/인가 (신규: 구글 로그인 추가)
├── 2. event-service/         # 이벤트 조회, 공지사항
├── 3. queue-service/         # 대기열 관리
├── 4. reservation-service/   # 예매 처리, 좌석 관리
├── 5. payment-service/       # 결제, 포인트 시스템 (신규)
└── 6. notification-service/  # 알림 발송 (이메일, 푸시)
```

### 2. 서비스별 책임 (Bounded Context)

#### **Auth Service** (인증/인가)

```
📦 auth-service/
├── routes/
│   ├── login.js          # 이메일/비밀번호 로그인
│   ├── register.js       # 회원가입
│   ├── google-oauth.js   # ✨ 구글 로그인 (신규)
│   └── verify.js         # JWT 검증
├── models/
│   └── User.js           # users 테이블
└── services/
    ├── jwt-manager.js
    └── oauth-manager.js  # ✨ OAuth 2.0 처리 (신규)

🗃️ 담당 테이블: users
📡 외부 의존: 없음 (독립적)
```

#### **Event Service** (이벤트 조회)

```
📦 event-service/
├── routes/
│   ├── events.js         # 이벤트 목록, 상세
│   ├── news.js           # 공지사항
│   └── images.js         # 이미지 업로드 (S3)
├── models/
│   ├── Event.js          # events 테이블
│   └── News.js           # news 테이블
└── services/
    ├── event-status-updater.js  # 이벤트 상태 자동 업데이트
    └── s3-uploader.js

🗃️ 담당 테이블: events, news
📡 외부 의존: S3 (이미지 저장)
```

#### **Queue Service** (대기열 관리)

```
📦 queue-service/
├── routes/
│   └── queue.js          # 대기열 입장, 상태 조회
├── services/
│   ├── queue-manager.js  # Redis Sorted Set FIFO
│   └── socket-handler.js # WebSocket 실시간 알림
└── config/
    └── socket.js

🗃️ 담당 테이블: 없음 (Redis Only)
📡 외부 의존: Redis, Socket.IO
🔗 통신: Reservation Service (입장 허가 요청)
```

#### **Reservation Service** (예매 처리)

```
📦 reservation-service/
├── routes/
│   ├── reservations.js   # 예매 생성, 취소
│   ├── seats.js          # 좌석 조회, 선택
│   └── tickets.js        # 티켓 조회
├── models/
│   ├── Reservation.js    # reservations 테이블
│   └── Seat.js           # seats 테이블
└── services/
    ├── reservation-cleaner.js  # 미결제 예매 자동 취소
    ├── seat-generator.js       # 좌석 자동 생성
    └── distributed-lock.js     # Redis Lock (동시성 제어)

🗃️ 담당 테이블: reservations, seats
📡 외부 의존: Redis (분산 락)
🔗 통신:
  - Payment Service (결제 완료 이벤트 수신)
  - Queue Service (입장 가능 여부 확인)
```

#### **Payment Service** (결제, 포인트) ✨ 신규

```
📦 payment-service/
├── routes/
│   ├── payments.js       # 결제 처리 (토스페이먼츠 등)
│   ├── points.js         # ✨ 포인트 충전, 사용, 조회
│   └── refunds.js        # 환불 처리
├── models/
│   ├── Payment.js        # payments 테이블
│   ├── Point.js          # ✨ points 테이블 (신규)
│   └── PointHistory.js   # ✨ point_histories 테이블 (신규)
└── services/
    ├── payment-gateway.js    # 외부 PG사 연동
    ├── point-manager.js      # ✨ 포인트 충전/사용 로직
    └── refund-processor.js

🗃️ 담당 테이블: payments, points, point_histories
📡 외부 의존: 토스페이먼츠 API (또는 아임포트)
🔗 통신: Reservation Service (결제 완료 → 예매 확정)
```

#### **Notification Service** (알림 발송)

```
📦 notification-service/
├── routes/
│   └── notifications.js  # 알림 발송 요청
├── services/
│   ├── email-sender.js   # 이메일 발송 (SES, SendGrid)
│   ├── sms-sender.js     # SMS 발송 (선택)
│   └── push-sender.js    # 푸시 알림 (FCM)
└── workers/
    └── sqs-consumer.js   # SQS에서 메시지 소비

🗃️ 담당 테이블: 없음 (이벤트 소비)
📡 외부 의존: SQS, SES, FCM
🔗 통신: 모든 서비스 (이벤트 수신)
```

---

## 💳 결제/포인트 시스템 설계 (신규)

### 1. 포인트 시스템 DB 스키마

```sql
-- 사용자별 포인트 잔액
CREATE TABLE points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,  -- 현재 포인트 잔액
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 포인트 사용 이력 (충전, 사용, 환불)
CREATE TABLE point_histories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(20) NOT NULL,  -- 'CHARGE', 'USE', 'REFUND', 'CANCEL'
    amount INTEGER NOT NULL,    -- 금액 (양수: 충전, 음수: 사용)
    balance_after INTEGER NOT NULL,  -- 거래 후 잔액
    reference_type VARCHAR(50),  -- 'PAYMENT', 'RESERVATION', 'MANUAL'
    reference_id INTEGER,        -- 관련 레코드 ID
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 결제 테이블 (기존 payments 테이블 확장)
ALTER TABLE payments ADD COLUMN payment_method VARCHAR(20);  -- 'CARD', 'POINT', 'MIXED'
ALTER TABLE payments ADD COLUMN point_used INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN card_amount INTEGER DEFAULT 0;
```

### 2. 포인트 API 설계

```javascript
// 포인트 충전 (POST /api/points/charge)
{
  "amount": 10000,
  "payment_method": "CARD",  // 카드로 충전
  "pg_token": "toss_token_xxx"
}

// 포인트 사용 (예매 시 자동 차감)
{
  "reservation_id": 123,
  "total_price": 50000,
  "point_used": 10000,       // 포인트 1만원 사용
  "card_amount": 40000       // 카드 4만원 결제
}

// 포인트 조회 (GET /api/points/balance)
{
  "user_id": 456,
  "balance": 25000,
  "histories": [...]
}
```

### 3. 포인트 사용 흐름

```
1. 사용자가 예매 시도 (총 5만원)
   ↓
2. Reservation Service가 좌석 선택 완료 → 결제 요청
   ↓
3. Payment Service로 결제 요청:
   {
     "total": 50000,
     "point_used": 10000,  // 포인트 사용
     "card_amount": 40000   // 카드 결제
   }
   ↓
4. Payment Service:
   a) Point 잔액 확인 (10,000 이상 있는지)
   b) 포인트 차감 (트랜잭션)
   c) 카드 결제 (PG사 API 호출)
   d) point_histories 기록
   ↓
5. 성공 → Reservation Service로 이벤트 발행
   ↓
6. Reservation status = 'CONFIRMED'
```

---

## 🔐 구글 로그인 (OAuth 2.0) 설계

### 1. 구글 OAuth 흐름

```
1. 프론트엔드: 구글 로그인 버튼 클릭
   ↓
2. 구글 OAuth 페이지로 리다이렉트
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id=YOUR_CLIENT_ID&
     redirect_uri=http://localhost:3000/auth/google/callback&
     response_type=code&
     scope=openid email profile
   ↓
3. 사용자가 구글 계정으로 로그인 & 동의
   ↓
4. 구글이 redirect_uri로 authorization code 전달
   ↓
5. 프론트엔드 → Auth Service로 code 전송
   POST /api/auth/google
   { "code": "google_auth_code_xxx" }
   ↓
6. Auth Service:
   a) 구글 API로 code → access_token 교환
   b) access_token으로 사용자 정보 조회 (email, name, picture)
   c) DB에서 email로 사용자 조회
      - 있으면: 로그인
      - 없으면: 회원가입 (자동)
   d) JWT 발급
   ↓
7. JWT 반환 → 프론트엔드 저장
```

### 2. Auth Service 구현 (OAuth)

```javascript
// auth-service/routes/google-oauth.js
const router = require('express').Router();
const axios = require('axios');

router.post('/google', async (req, res) => {
  try {
    const { code } = req.body;

    // 1. 구글 OAuth 토큰 교환
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const { access_token } = tokenResponse.data;

    // 2. 구글 사용자 정보 조회
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { email, name, picture } = userInfoResponse.data;

    // 3. DB에서 사용자 조회 또는 생성
    let user = await db.query('SELECT * FROM users WHERE email = $1', [email]);

    if (user.rows.length === 0) {
      // 신규 사용자 자동 회원가입
      user = await db.query(
        'INSERT INTO users (email, name, provider, profile_image) VALUES ($1, $2, $3, $4) RETURNING *',
        [email, name, 'GOOGLE', picture]
      );
    }

    // 4. JWT 발급
    const jwt = generateJWT(user.rows[0]);

    res.json({ token: jwt, user: user.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3. Users 테이블 확장

```sql
ALTER TABLE users ADD COLUMN provider VARCHAR(20) DEFAULT 'LOCAL';  -- 'LOCAL', 'GOOGLE'
ALTER TABLE users ADD COLUMN profile_image VARCHAR(255);
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;  -- OAuth는 비밀번호 없음
```

---

## 🐳 로컬 Kubernetes 환경 구성

### 1. 로컬 K8s 도구 선택

**추천: Kind (Kubernetes in Docker)**

```bash
# Kind 설치 (Windows)
choco install kind

# 또는
curl -Lo kind.exe https://kind.sigs.k8s.io/dl/v0.20.0/kind-windows-amd64
move kind.exe C:\Windows\System32\

# Kubectl 설치
choco install kubernetes-cli

# Kind 클러스터 생성
kind create cluster --name tiketi-local --config kind-config.yaml
```

### 2. Kind 클러스터 설정 (kind-config.yaml)

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: tiketi-local
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30000  # Auth Service
        hostPort: 3001
      - containerPort: 30001  # Event Service
        hostPort: 3002
      - containerPort: 30002  # Queue Service
        hostPort: 3003
      - containerPort: 30003  # Reservation Service
        hostPort: 3004
      - containerPort: 30004  # Payment Service
        hostPort: 3005
      - containerPort: 30005  # Notification Service
        hostPort: 3006
  - role: worker
  - role: worker
```

### 3. 로컬 Docker Registry 설정

```bash
# 로컬 Docker Registry 실행
docker run -d -p 5000:5000 --name local-registry registry:2

# Kind와 연결
docker network connect kind local-registry
```

---

## 🚀 단계별 마이그레이션 계획

### **Phase 0: 준비 단계** (1주)

**목표**: 공통 라이브러리 분리 + 로컬 환경 구축

```bash
# 1. 공통 라이브러리 생성
mkdir -p shared/
cp -r backend/src/utils shared/
cp -r backend/src/middleware shared/
cp -r backend/src/config shared/

# 2. Kind 클러스터 생성
kind create cluster --name tiketi-local --config kind-config.yaml

# 3. 로컬 Registry 연결
docker run -d -p 5000:5000 --name local-registry registry:2
docker network connect kind local-registry

# 4. PostgreSQL & Redis 배포 (K8s)
kubectl apply -f k8s/base/postgres.yaml
kubectl apply -f k8s/base/redis.yaml
```

**완료 조건**:
- ✅ Kind 클러스터 정상 동작
- ✅ Postgres & Redis Pod 실행 중
- ✅ shared/ 디렉토리 생성

---

### **Phase 1: Auth Service 분리** (1주)

**목표**: 가장 독립적인 서비스부터 분리 + 구글 로그인 추가

```bash
# 1. Auth Service 디렉토리 생성
mkdir -p services/auth-service/src

# 2. 코드 이동
cp backend/src/routes/auth.js services/auth-service/src/routes/
cp -r backend/src/models/User.js services/auth-service/src/models/

# 3. 구글 OAuth 구현 ✨
# services/auth-service/src/routes/google-oauth.js 작성

# 4. Dockerfile & package.json 작성

# 5. 로컬 빌드 & 테스트
cd services/auth-service
docker build -t localhost:5000/auth-service:v1 .
docker push localhost:5000/auth-service:v1

# 6. K8s 배포
kubectl apply -f k8s/base/auth-service.yaml

# 7. 테스트
curl http://localhost:3001/api/auth/login
curl http://localhost:3001/api/auth/google  # ✨ 구글 로그인
```

**완료 조건**:
- ✅ Auth Service Pod 실행 중
- ✅ 이메일 로그인 동작
- ✅ 구글 로그인 동작 ✨
- ✅ JWT 발급 정상

---

### 나머지 Phase 2~7

자세한 내용은 [msa-local-diagrams.md](./msa-local-diagrams.md) 참고

---

## 📋 마이그레이션 체크리스트

### Phase 0 (준비)
- [ ] Kind 클러스터 생성
- [ ] Postgres & Redis 배포
- [ ] 로컬 Registry 연결

### Phase 1 (Auth)
- [ ] Auth Service 코드 분리
- [ ] 구글 OAuth 구현 ✨
- [ ] K8s 배포
- [ ] 로그인 테스트

### Phase 2~7
자세한 체크리스트는 [msa-local-diagrams.md](./msa-local-diagrams.md) 참고

---

## 🎯 최종 목표 달성 조건

1. ✅ **6개 마이크로서비스 정상 동작**
2. ✅ **구글 로그인 동작** ✨
3. ✅ **포인트 충전/사용 동작** ✨
4. ✅ **로컬 K8s 환경에서 전체 플로우 정상**
5. ✅ **Circuit Breaker, X-Ray, Optimistic Lock 적용**

---

## 📚 참고 문서

- [MSA 로컬 다이어그램 (Mermaid)](./msa-local-diagrams.md)
- [Phase 별 상세 가이드](./phases/)

**예상 기간**: 약 **8주 (2개월)**

각 Phase별로 단계적으로 진행하면서 테스트를 철저히 하는 것이 핵심입니다!
