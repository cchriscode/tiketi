# 🎫 TIKETI - 실시간 티켓팅 플랫폼

> **WebSocket 기반 실시간 동기화 지원**
> 대기열 시스템 · 좌석 선택 · 티켓 재고 실시간 업데이트

## 📊 프로젝트 현황

**코드 품질 평가**: ⭐⭐⭐⭐☆ (4.0/5.0) - 프로덕션 준비도 80%
**기술 스택**: Node.js, React, PostgreSQL, Redis, Socket.IO, Docker
**아키텍처**: 레이어 분리, 일관된 에러 처리, 중앙화된 상수 관리
**파일 수**: Backend 22개, Frontend 23개 (45개 JavaScript 파일)

---

## 📋 핵심 기능

### ⚡ 실시간 기능 (WebSocket)
- ⏳ **대기열 시스템**: 트래픽 폭주 시 자동 활성화, 실시간 순번 표시, 새로고침 대응
- 🎫 **티켓 재고 동기화**: 누군가 구매하면 모든 사용자 화면 즉시 업데이트
- 🪑 **좌석 선택 동기화**: 다른 사용자가 선택한 좌석 실시간 반영
- 🔄 **AWS 멀티 인스턴스 지원**: Redis Adapter로 여러 서버 간 WebSocket 메시지 동기화
- 🔐 **WebSocket 인증**: JWT 기반 WebSocket 연결 인증 (ALB 멀티 인스턴스 대비)
- 💾 **세션 관리**: Redis 기반 세션 저장으로 재연결 시 자동 상태 복구
- 🔄 **자동 재연결**: 네트워크 끊김 시 자동 재연결 및 이전 상태 복구
- 📊 **연결 상태 표시**: 사용자에게 실시간 연결 상태 시각화 (연결됨/재연결 중/끊김)

### 👤 사용자 기능
- ✅ 회원가입/로그인 (JWT 인증)
- ✅ 이벤트 목록 및 상세 조회
- ✅ 좌석 선택 (실시간 동기화)
- ✅ 티켓 선택 및 예매
- ✅ 예매 내역 조회/취소
- ✅ 결제 처리

### 🛠️ 관리자 기능
- ✅ 대시보드 (통계, 매출, 실시간 현황)
- ✅ 이벤트 생성/수정/삭제
- ✅ 좌석 레이아웃 설정
- ✅ 티켓 타입 관리
- ✅ 예매 내역 관리

### 🔒 기술적 특징
- ✅ **Socket.IO + Redis Adapter**: 멀티 인스턴스 WebSocket 동기화
- ✅ **WebSocket 인증 & 세션 관리**: JWT 인증 + Redis 세션 저장으로 ALB 환경 대비
- ✅ **자동 재연결 복구**: 네트워크 끊김 시 이전 대기열/좌석 선택 상태 자동 복원
- ✅ **Redis 대기열**: FIFO 보장, 새로고침 시 순번 유지
- ✅ **PostgreSQL 트랜잭션**: 데이터 일관성 보장
- ✅ **분산 락 (DragonflyDB)**: 동시성 제어
- ✅ **Docker Compose**: 간편한 로컬 개발 환경

---

## 🏗️ 아키텍처

### 현재 아키텍처 (로컬 개발)

```
┌─────────────────┐
│   Frontend      │  React (Port 3000)
│   (React)       │  - WebSocket Client (Socket.IO)
└────────┬────────┘
         │
┌────────▼────────┐
│   Backend       │  Node.js + Express (Port 3001)
│   (Express)     │  - Socket.IO Server + Redis Adapter
└────────┬────────┘  - REST API
         │
         ├──────────────┬──────────────┐
         │              │              │
┌────────▼─────┐ ┌─────▼──────┐ ┌─────▼──────┐
│ PostgreSQL   │ │ DragonflyDB│ │ Redis      │
│   (5432)     │ │   (6379)   │ │ (Adapter)  │
│              │ │ 분산 락     │ │ 대기열/캐싱│
└──────────────┘ └────────────┘ └────────────┘
```

---

### AWS 프로덕션 아키텍처 (큐 기반 Auto Scaling)

```
                       ┌───────────────┐
                       │  Route 53     │  DNS
                       │  (tiketi.gg)  │
                       └───────┬───────┘
                               │
                       ┌───────▼───────┐
                       │  CloudFront   │  CDN (정적 파일)
                       └───────┬───────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
   ┌──────▼──────┐     ┌───────▼───────┐   ┌───────▼──────┐
   │     S3      │     │      ALB      │   │  CloudWatch  │
   │ (React 빌드)│     │ (Load Balancer)│   │  (모니터링)  │
   └─────────────┘     │ - Sticky Sess.│   └──────┬───────┘
                       └───────┬───────┘          │
                               │                  │
                ┌──────────────┴─────────┐        │
                │                        │        │
         ┌──────▼────┐            ┌──────▼────┐  │
         │ Target    │            │   Auto    │  │
         │ Group     │◄───────────┤  Scaling  │◄─┘
         │           │            │   Group   │
         └──────┬────┘            └───────────┘
                │                      ▲
    ┌───────────┼───────────┐         │
    │           │           │         │ 큐 크기 기반
┌───▼────┐ ┌───▼────┐ ┌───▼────┐    │ 스케일링
│ EC2-1  │ │ EC2-2  │ │ EC2-3  │    │
│Backend │ │Backend │ │Backend │    │
│Socket  │ │Socket  │ │Socket  │    │
└───┬────┘ └───┬────┘ └───┬────┘    │
    └──────────┼──────────┘          │
               │                     │
    ┌──────────┼─────────────────────┼────────┐
    │          │                     │        │
┌───▼──────────▼───┐         ┌───────▼──────┐ │
│ ElastiCache      │         │   Lambda     │ │
│    (Redis)       │◄────────┤ Queue Monitor│ │
│ - Pub/Sub        │         │              │ │
│ - Queue (대기열) │         │ 큐 크기 측정  │ │
│ - Cache (세션)   │         │ → CloudWatch │ │
└──────────┬───────┘         └──────────────┘ │
           │                                   │
    ┌──────▼────────┐                ┌────────▼──┐
    │ RDS (Aurora)  │                │ S3 Bucket │
    │  PostgreSQL   │                │ (이미지)  │
    │   Multi-AZ    │                │ (로그)    │
    └───────────────┘                └───────────┘
```

**핵심 포인트**:

#### 1️⃣ 큐(대기열) 기반 Auto Scaling
- **Lambda Queue Monitor**: Redis 대기열 크기를 1분마다 측정 → CloudWatch Metrics 전송
- **CloudWatch Alarm**:
  - 대기열 > 5,000명 → Scale Out (EC2 +2)
  - 대기열 < 1,000명 → Scale In (EC2 -1)
- **사전 예측 스케일링**: 과거 데이터 기반 평균 계산으로 티켓 오픈 30분 전 자동 확장

#### 2️⃣ 대기열 시스템과 Auto Scaling 통합
```
트래픽 급증 시나리오:

1. 티켓 오픈 30분 전
   - 과거 데이터 조회: 평균 15,000명 접속 예상
   - Auto Scaling: EC2 2대 → 10대 (8분 소요)
   - 대기열 임계값: 12,000명 설정

2. 티켓 오픈 시점
   - 0~12,000명: ✅ 바로 접속 (대기열 없음)
   - 12,001~18,000명: ⏳ 대기열 진입 (평균 30초)

3. 예상 초과 (20,000명)
   - Lambda가 대기열 크기 감지: 8,000명
   - CloudWatch Alarm 트리거
   - Auto Scaling: EC2 +2 (10대 → 12대)
   - 3~5분 후 처리 능력 증가 → 대기열 해소

4. 트래픽 감소
   - 대기열 < 1,000명
   - Auto Scaling: EC2 -1 (점진적 축소)
```

#### 3️⃣ WebSocket 멀티 인스턴스 동기화
- **Sticky Session**: ALB가 같은 사용자를 같은 EC2로 라우팅 (WebSocket 유지)
- **Redis Pub/Sub**: EC2-1에서 emit → 모든 EC2가 동기화 (Redis Adapter)
- **세션 복구**: 재연결 시 Redis에서 이전 상태 자동 복구

#### 4️⃣ 과거 데이터 기반 예측 스케일링
```sql
-- 아티스트별 과거 평균 동시 접속자 조회
SELECT artist_name, AVG(concurrent_users) as avg_users
FROM traffic_logs
WHERE artist_name = '임영웅'
GROUP BY artist_name;

-- 필요 EC2 수 계산
필요 EC2 = CEILING(평균 동시 접속자 / 1,500)
```

---

## 🚀 빠른 시작

### 1. 저장소 클론
```bash
git clone <repository-url>
cd project-ticketing
```

### 2. 한 줄로 실행
```bash
# Windows
start.bat

# Mac/Linux
chmod +x start.sh && ./start.sh
```

### 3. 서비스 접속
- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:3001
- **관리자**: admin@tiketi.gg / admin123

> 📖 **상세 가이드**: [docs/01_GETTING_STARTED.md](./docs/01_GETTING_STARTED.md)

---

## 📁 프로젝트 구조

```
project-ticketing/
├── backend/                      # Node.js + Express 백엔드
│   ├── src/
│   │   ├── config/               # 설정 (DB, Redis, Socket.IO)
│   │   │   ├── database.js       # PostgreSQL 연결
│   │   │   ├── redis.js          # Redis/DragonflyDB 연결
│   │   │   └── socket.js         # Socket.IO + Redis Adapter
│   │   ├── middleware/           # 인증 미들웨어
│   │   │   └── auth.js           # JWT 인증
│   │   ├── routes/               # API 라우트 (8개)
│   │   │   ├── auth.js           # 인증
│   │   │   ├── events.js         # 이벤트 관리
│   │   │   ├── seats.js          # 좌석 선택
│   │   │   ├── reservations.js   # 예매 처리
│   │   │   └── queue.js          # 대기열 API
│   │   ├── services/             # 비즈니스 로직
│   │   │   ├── queue-manager.js  # 대기열 관리
│   │   │   ├── reservation-cleaner.js  # 예약 만료 처리
│   │   │   └── socket-session-manager.js  # WebSocket 세션
│   │   ├── shared/               # 공유 상수
│   │   │   └── constants.js      # SSOT (Single Source of Truth)
│   │   └── utils/                # 유틸리티
│   │       └── transaction-helpers.js  # 트랜잭션 래퍼
│   └── package.json
│
├── frontend/                     # React 프론트엔드
│   ├── src/
│   │   ├── components/           # 재사용 컴포넌트
│   │   │   ├── Header.js
│   │   │   ├── WaitingRoomModal.js  # 대기열 모달
│   │   │   └── ConnectionStatus.js  # 연결 상태 표시
│   │   ├── hooks/                # 커스텀 훅
│   │   │   ├── useSocket.js      # Socket.IO 훅
│   │   │   └── useCountdown.js   # 카운트다운 훅
│   │   ├── pages/                # 페이지 컴포넌트
│   │   │   ├── Home.js           # 이벤트 목록
│   │   │   ├── EventDetail.js    # 이벤트 상세/예매
│   │   │   ├── SeatSelection.js  # 좌석 선택
│   │   │   └── admin/            # 관리자 페이지
│   │   ├── services/             # API 통신
│   │   │   └── api.js            # Axios + 인터셉터
│   │   └── shared/               # 공유 상수
│   │       └── constants.js      # 프론트엔드 상수
│   └── package.json
│
├── database/                     # 데이터베이스
│   └── init.sql                  # DB 초기화 스크립트
│
├── docs/                         # 문서
│   ├── architecture/             # 아키텍처 문서
│   │   ├── AWS_아키텍처_계획서.md
│   │   └── PREDICTIVE_SCALING_DESIGN.md  # 큐 기반 ASG 설계
│   ├── features/                 # 기능 가이드
│   │   ├── QUEUE_MODAL.md        # 대기열 시스템
│   │   ├── REALTIME_SYSTEM.md    # 실시간 기능
│   │   └── AWS_WEBSOCKET_AUTH.md # WebSocket 인증
│   └── planning/                 # 계획 문서
│       └── PRODUCTION_ROADMAP.md # AWS 배포 로드맵
│
├── claudedocs/                   # 코드 분석 보고서
│   ├── CODE_ANALYSIS_REPORT.md   # 종합 분석 (4.0/5.0)
│   └── ANALYSIS_EXECUTIVE_SUMMARY.md
│
├── docker-compose.yml            # 로컬 개발 환경
└── README.md                     # 이 파일
```

---

## 🎯 주요 기능 상세

### 1. 대기열 시스템 (WaitingRoomModal)

**동작 방식**:
```
1. 사용자가 이벤트 접속
2. checkQueueStatus() 호출 → 임계값 확인
3. 임계값 초과 → 대기열 진입 (Redis Sorted Set)
4. 모달 팝업 (같은 페이지에 풀스크린 오버레이)
5. WebSocket으로 실시간 순번 업데이트
6. 입장 허용 → 모달 자동 닫힘
```

**핵심 코드**:
- 백엔드: `backend/src/services/queue-manager.js:44-64`
- 프론트엔드: `frontend/src/components/WaitingRoomModal.js`
- API: POST `/api/queue/check/:eventId`, GET `/api/queue/status/:eventId`

**특징**:
- ✅ Redis Sorted Set으로 FIFO 보장
- ✅ 새로고침해도 순번 유지 (userId 기반)
- ✅ WebSocket 끊겨도 5초마다 폴링 fallback
- ✅ 실시간 대기 인원, 예상 시간 표시

---

### 2. 좌석 선택 실시간 동기화 (SeatSelection)

**동작 방식**:
```
1. 사용자 A가 좌석 선택
2. 백엔드에서 seat-locked 이벤트 emit
3. Redis Pub/Sub → 모든 EC2가 메시지 받음
4. Socket.IO → 모든 연결된 클라이언트에게 브로드캐스트
5. 사용자 B의 화면에서 해당 좌석 즉시 "예약 중" 상태로 변경
```

**핵심 코드**:
- 백엔드: `backend/src/routes/seats.js` (좌석 lock 시 emit)
- 백엔드: `backend/src/services/reservation-cleaner.js` (5분 후 해제 시 emit)
- 프론트엔드: `frontend/src/pages/SeatSelection.js` (useSeatUpdates 훅)
- 훅: `frontend/src/hooks/useSocket.js:60-80`

**특징**:
- ✅ 좌석 선택 즉시 다른 사용자에게 반영
- ✅ 5분 타이머 만료 → 자동 해제 (실시간 반영)
- ✅ 중복 선택 방지 (분산 락 + 실시간 동기화)

---

### 3. 티켓 재고 실시간 업데이트 (EventDetail)

**동작 방식**:
```
1. 사용자 A가 티켓 구매
2. 백엔드에서 재고 차감
3. ticket-updated 이벤트 emit
4. 해당 이벤트를 보는 모든 사용자 화면 즉시 업데이트
```

**핵심 코드**:
- 백엔드: `backend/src/routes/reservations.js:176-189` (예매 생성 시)
- 백엔드: `backend/src/routes/reservations.js:280-293` (예매 취소 시)
- 프론트엔드: `frontend/src/pages/EventDetail.js:78-91`
- 훅: `frontend/src/hooks/useSocket.js:34-52`

**특징**:
- ✅ 누군가 구매하면 모든 사용자 화면 즉시 업데이트
- ✅ 취소 시에도 실시간 반영
- ✅ F12 콘솔에서 "✅ Ticket updated" 메시지 확인 가능

---

### 4. WebSocket 인증 & 세션 관리 (ALB 멀티 인스턴스 대비) 🆕

**문제 1**: WebSocket 연결 시 인증 없음 → 보안 취약
**문제 2**: 재연결 시 이전 상태(대기열 순번, 선택 좌석) 손실

**해결**: JWT 인증 + Redis 세션 저장

```javascript
// 1. 클라이언트: WebSocket 연결 시 JWT 토큰 자동 전달
const socket = io(SOCKET_URL, {
  auth: { token: localStorage.getItem('token') }
});

// 2. 서버: JWT 검증 후 연결 허용
io.use(async (socket, next) => {
  const decoded = jwt.verify(socket.handshake.auth.token, JWT_SECRET);
  socket.data.userId = decoded.userId; // 검증된 userId
  next();
});

// 3. 서버: 사용자 상태를 Redis에 저장
await saveUserSession(userId, {
  eventId: 123,
  queueEventId: 123,
  selectedSeats: [1, 2, 3]
});

// 4. 재연결 시 자동 복구
const previousSession = await getUserSession(userId);
socket.emit('session-restored', previousSession);
```

**핵심 코드**:
- 백엔드 인증: `backend/src/config/socket.js:37-58`
- 세션 관리: `backend/src/services/socket-session-manager.js`
- 프론트엔드: `frontend/src/hooks/useSocket.js:24-42`

**시나리오**:
1. 사용자가 대기열 50번째 대기 중
2. 지하철 타면서 네트워크 끊김
3. 자동 재연결 성공
4. **Redis에서 이전 세션 조회 → 대기열 50번째 위치 그대로 유지!**

---

## ☁️ AWS 배포 준비 (큐 기반 Auto Scaling)

### Lambda Queue Monitor 구현

**목적**: Redis 대기열 크기를 CloudWatch Metrics로 전송

```javascript
// lambda/queue-monitor.js
const Redis = require('ioredis');
const { CloudWatch } = require('@aws-sdk/client-cloudwatch');

const redis = new Redis(process.env.REDIS_URL);
const cloudwatch = new CloudWatch();

exports.handler = async (event) => {
  // 모든 이벤트의 대기열 크기 조회
  const eventIds = await redis.smembers('active-events');

  for (const eventId of eventIds) {
    const queueSize = await redis.zcard(`queue:event:${eventId}`);

    // CloudWatch Metrics 전송
    await cloudwatch.putMetricData({
      Namespace: 'TIKETI/Queue',
      MetricData: [{
        MetricName: 'QueueSize',
        Value: queueSize,
        Unit: 'Count',
        Dimensions: [{
          Name: 'EventId',
          Value: eventId
        }]
      }]
    });
  }

  return { statusCode: 200, body: 'OK' };
};
```

### CloudWatch Alarm 설정

```bash
# 대기열 5,000명 초과 → Scale Out
aws cloudwatch put-metric-alarm \
  --alarm-name tiketi-queue-scale-out \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --metric-name QueueSize \
  --namespace TIKETI/Queue \
  --period 60 \
  --statistic Average \
  --threshold 5000.0 \
  --alarm-actions arn:aws:autoscaling:...:scalingPolicy/tiketi-scale-out

# 대기열 1,000명 미만 → Scale In
aws cloudwatch put-metric-alarm \
  --alarm-name tiketi-queue-scale-in \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 5 \
  --metric-name QueueSize \
  --namespace TIKETI/Queue \
  --period 60 \
  --statistic Average \
  --threshold 1000.0 \
  --alarm-actions arn:aws:autoscaling:...:scalingPolicy/tiketi-scale-in
```

### Auto Scaling Policy

```bash
# Target Tracking Scaling (권장)
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name tiketi-asg \
  --policy-name target-queue-size \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "CustomizedMetricSpecification": {
      "MetricName": "QueueSize",
      "Namespace": "TIKETI/Queue",
      "Statistic": "Average"
    },
    "TargetValue": 2000.0
  }'
```

**동작 방식**:
- 대기열이 2,000명을 목표로 유지
- 초과 시 자동으로 EC2 추가 (Scale Out)
- 미달 시 자동으로 EC2 제거 (Scale In)

---

## 💰 AWS 예상 비용 정리

### 월간 비용 (프로덕션, 5,000명 사용자 기준)

| 항목 | 서비스 | 사양 | 월 비용 | 비고 |
|------|--------|------|---------|------|
| **컴퓨팅** |
| EC2 Backend | t3.medium × 2 | 2 vCPU, 4GB RAM | ₩80,000 | Auto Scaling |
| ALB | Application Load Balancer | - | ₩27,000 | Sticky Session |
| Lambda | Queue Monitor | 1분 주기 실행 | ₩1,000 | 큐 크기 측정 |
| **데이터베이스** |
| RDS PostgreSQL | db.t3.small Multi-AZ | 2 vCPU, 2GB RAM, 50GB | ₩60,000 | 자동 백업 |
| ElastiCache Redis | cache.t3.small × 4 | Cluster Mode | ₩80,000 | 2샤드 × 2레플리카 |
| **스토리지 & CDN** |
| S3 | 50GB | 정적파일/업로드/로그 | ₩2,000 | |
| CloudFront | 1TB | CDN | FREE | 프리티어 |
| **네트워크** |
| NAT Gateway | Single AZ | - | ₩5,000 | |
| Data Transfer | 500GB/월 | - | ₩5,000 | |
| **DNS & 보안** |
| Route 53 | 1 Hosted Zone | - | ₩500 | |
| ACM | SSL/TLS 인증서 | - | FREE | |
| Secrets Manager | 3 secrets | - | ₩2,000 | |
| **모니터링** |
| CloudWatch | Logs + Alarms + Custom Metrics | 10GB 로그 | ₩5,000 | 큐 메트릭 포함 |
| SNS | 알림 | 1,000건/월 | FREE | |
| **합계** | | | **₩267,500/월** | **약 $200/월** |

### 트래픽 증가 시 추가 비용

| 트래픽 레벨 | 예상 사용자 | Auto Scaling 동작 | 추가 비용 |
|------------|------------|------------------|----------|
| **Low** (현재) | 5,000명 | EC2 2대 유지 | ₩0 |
| **Medium** | 10,000명 | 큐 크기 증가 → EC2 +1 | +₩40,000 |
| **High** | 50,000명 | 큐 > 5,000명 → EC2 +5 | +₩200,000 |
| **Very High** | 100,000명 | EC2 최대 10대 + RDS 업그레이드 | +₩500,000 |

**큐 기반 ASG의 장점**:
- ✅ 실제 사용자 대기 상황 기반으로 정확한 스케일링
- ✅ 과도한 스케일링 방지 (대기열이 버퍼 역할)
- ✅ 비용 최적화 (필요한 만큼만 확장)

---

## 🔑 핵심 기술 스택

### 백엔드
- **Node.js** 18 + **Express**
- **Socket.IO** 4.7 + **Redis Adapter** (멀티 인스턴스 동기화)
- **PostgreSQL** 15 (메인 DB)
- **DragonflyDB** (Redis 호환, 분산 락)
- **JWT** (인증), **bcrypt** (비밀번호 암호화)

### 프론트엔드
- **React** 18
- **Socket.IO Client** (WebSocket)
- **React Router** (클라이언트 라우팅)
- **Axios** (HTTP 클라이언트)
- **date-fns** (날짜 포맷팅)

### 인프라
- **Docker** & **Docker Compose**
- **AWS**: VPC, EC2, ALB (Sticky Session), RDS, ElastiCache, S3, CloudFront
- **Auto Scaling**: 큐 기반 Target Tracking
- **Lambda**: Queue Monitor (CloudWatch Metrics 전송)
- **CloudWatch**: Alarms, Logs, Custom Metrics
- **CI/CD**: GitHub Actions

---

## 🐛 트러블슈팅

### WebSocket 연결 안 됨
```bash
# 증상
F12 콘솔: "Access to XMLHttpRequest blocked by CORS"

# 해결
backend/src/config/socket.js 확인:
cors: {
  origin: 'http://localhost:3000', // 프론트엔드 URL
  methods: ['GET', 'POST'],
  credentials: true,
}
```

### 대기열 모달이 안 뜸
```bash
# 원인
임계값이 너무 높음 (기본값: 1000명)

# 해결 (테스트용)
backend/src/services/queue-manager.js:
async getThreshold(eventId) {
  return 2; // 2명만 입장 가능
}
```

### 좌석 선택이 다른 사용자에게 안 보임
```bash
# 원인
Socket.IO가 제대로 초기화 안 됨

# 확인
백엔드 로그: "🔌 WebSocket ready on port 3001" 있는지 확인
F12 콘솔: "🔌 Socket connected" 있는지 확인

# 해결
docker-compose down -v && docker-compose up --build
```

---

## 📝 다음 단계 (TODO)

### ✅ 완료된 작업
- [x] **WebSocket 인증 시스템** - JWT 기반 WebSocket 연결 인증
- [x] **세션 관리 시스템** - Redis 기반 세션 저장으로 재연결 시 자동 복구
- [x] **재연결 로직** - 네트워크 끊김 시 자동 재연결 및 이전 상태 복구
- [x] **연결 상태 UI** - 사용자에게 실시간 연결 상태 시각화
- [x] **보안 강화** - 클라이언트가 userId 조작 불가 (서버가 JWT에서 추출)
- [x] **ALB 멀티 인스턴스 대비** - AWS 확장을 위한 모든 준비 완료
- [x] **코드 품질 분석** - 4.0/5.0 (프로덕션 준비도 80%)

### Phase 1: 기능 완성 (2-3주)
- [ ] 결제 시스템 연동 (토스페이먼츠)
- [ ] 이메일 알림 (SendGrid/AWS SES)
- [ ] 이벤트 검색 & 필터
- [ ] 이미지 업로드 (로컬: Multer, AWS: S3)
- [ ] 모바일 반응형 개선

### Phase 2: AWS 배포 (3-4주)
- [ ] VPC & 네트워크 구성
- [ ] RDS PostgreSQL 마이그레이션
- [ ] ElastiCache Redis 설정
- [ ] EC2 + ALB + Auto Scaling 구성
- [ ] Lambda Queue Monitor 배포 (큐 기반 ASG)
- [ ] S3 + CloudFront 배포
- [ ] Route 53 + ACM (SSL)
- [ ] Secrets Manager 설정

### Phase 3: CI/CD (1-2주)
- [ ] GitHub Actions 파이프라인
- [ ] ECR (Docker Registry)
- [ ] Blue/Green 배포
- [ ] 자동화 테스트 추가

### Phase 4: 모니터링 & 최적화 (1주)
- [ ] CloudWatch 대시보드
- [ ] Alarms & SNS 알림
- [ ] 성능 최적화 (캐싱, 쿼리)
- [ ] 보안 강화 (WAF, GuardDuty)
- [ ] 큐 크기 모니터링 및 임계값 최적화

> 📖 **상세 로드맵**: [docs/planning/PRODUCTION_ROADMAP.md](./docs/planning/PRODUCTION_ROADMAP.md)

---

## 📚 문서

### 실시간 기능 & WebSocket
- [docs/features/REALTIME_SYSTEM.md](./docs/features/REALTIME_SYSTEM.md) - 실시간 기능 완료 보고서
- [docs/features/AWS_WEBSOCKET_AUTH.md](./docs/features/AWS_WEBSOCKET_AUTH.md) - ALB 스티키 세션 & WebSocket 인증 가이드
- [docs/features/QUEUE_MODAL.md](./docs/features/QUEUE_MODAL.md) - 대기열 기능 상세 가이드

### 아키텍처 & 배포
- [docs/architecture/AWS_아키텍처_계획서.md](./docs/architecture/AWS_아키텍처_계획서.md) - AWS 전체 아키텍처
- [docs/architecture/PREDICTIVE_SCALING_DESIGN.md](./docs/architecture/PREDICTIVE_SCALING_DESIGN.md) - 큐 기반 Auto Scaling 설계
- [docs/planning/PRODUCTION_ROADMAP.md](./docs/planning/PRODUCTION_ROADMAP.md) - AWS 배포 로드맵

### 코드 품질
- [claudedocs/CODE_ANALYSIS_REPORT.md](./claudedocs/CODE_ANALYSIS_REPORT.md) - 종합 코드 분석 (4.0/5.0)
- [claudedocs/ANALYSIS_EXECUTIVE_SUMMARY.md](./claudedocs/ANALYSIS_EXECUTIVE_SUMMARY.md) - 분석 요약

### 시스템 & 기능
- [docs/features/SEAT_SYSTEM.md](./docs/features/SEAT_SYSTEM.md) - 좌석 시스템 가이드

### 개발 가이드
- [docs/01_GETTING_STARTED.md](./docs/01_GETTING_STARTED.md) - 시작 가이드
- [docs/02_GIT_GUIDE.md](./docs/02_GIT_GUIDE.md) - Git 워크플로우
- [docs/03_ENV_VARIABLES.md](./docs/03_ENV_VARIABLES.md) - 환경 변수 설정

---

## 👨‍💻 개발자

티케티 개발팀

---

**Made with ❤️ for real-time ticketing experience**
