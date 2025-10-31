# 🎫 TIKETI - 실시간 티켓팅 플랫폼

> **WebSocket 기반 실시간 동기화 지원**
> 대기열 시스템 · 좌석 선택 · 티켓 재고 실시간 업데이트

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

### AWS 프로덕션 아키텍처 (확장)

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
   └─────────────┘     └───────┬───────┘   └──────────────┘
                               │ Sticky Session
                    ┌──────────┼──────────┐
                    │          │          │
             ┌──────▼────┐ ┌──▼─────────┐ ┌─────────────┐
             │  EC2-1    │ │  EC2-2    │ │  EC2-3      │
             │ Backend   │ │ Backend   │ │  Backend    │
             │ Socket.IO │ │ Socket.IO │ │  Socket.IO  │
             └─────┬─────┘ └─────┬─────┘ └──────┬──────┘
                   │             │               │
                   └─────────────┼───────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
   ┌──────▼──────┐      ┌────────▼────────┐    ┌───────▼──────┐
   │ RDS (Aurora)│      │ ElastiCache     │    │  S3 Bucket   │
   │ PostgreSQL  │      │    (Redis)      │    │  (이미지)    │
   │  Multi-AZ   │      │ - Pub/Sub (Socket)   │  (로그/백업) │
   └─────────────┘      │ - Queue (대기열)│    └──────────────┘
                        │ - Cache (세션)  │
                        └─────────────────┘
```

**핵심 포인트**:
- **Sticky Session**: ALB가 같은 사용자를 같은 EC2로 라우팅 (WebSocket 유지)
- **Redis Pub/Sub**: EC2-1에서 emit → 모든 EC2가 동기화 (Redis Adapter)
- **Auto Scaling**: 트래픽 증가 시 자동으로 EC2 추가
- **Multi-AZ**: 가용성 보장 (RDS, ElastiCache)

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

> 📖 **상세 가이드**: [팀원용_시작가이드.md](./docs/팀원용_시작가이드.md) | [macOS_시작가이드.md](./docs/macOS_시작가이드.md)

---

## 📁 프로젝트 구조

```
project-ticketing/
├── backend/
│   ├── src/
│   │   ├── server.js                     # Express + Socket.IO 서버
│   │   ├── config/
│   │   │   ├── socket.js                 # Socket.IO 설정 (인증 + Redis Adapter)
│   │   │   ├── database.js               # PostgreSQL 연결
│   │   │   └── redis.js                  # Redis/DragonflyDB 연결
│   │   ├── routes/
│   │   │   ├── auth.js                   # 인증 (JWT)
│   │   │   ├── events.js                 # 이벤트 관리
│   │   │   ├── seats.js                  # 좌석 선택
│   │   │   ├── reservations.js           # 예매 처리
│   │   │   ├── queue.js                  # 대기열 API
│   │   │   └── admin.js                  # 관리자 기능
│   │   ├── services/
│   │   │   ├── queue-manager.js          # 대기열 관리 (Redis Sorted Set)
│   │   │   ├── reservation-cleaner.js    # 예약 만료 처리 (5분 타이머)
│   │   │   └── socket-session-manager.js # WebSocket 세션 관리 (NEW)
│   │   └── middleware/
│   │       └── auth.js                   # JWT 인증 미들웨어
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── hooks/
│   │   │   ├── useSocket.js              # Socket.IO 커스텀 훅 (인증 + 재연결)
│   │   │   └── useCountdown.js           # 카운트다운 훅
│   │   ├── components/
│   │   │   ├── Header.js
│   │   │   ├── WaitingRoomModal.js       # 대기열 모달 (풀스크린 오버레이)
│   │   │   └── ConnectionStatus.js       # 연결 상태 표시 컴포넌트 (NEW)
│   │   ├── pages/
│   │   │   ├── Home.js                   # 이벤트 목록
│   │   │   ├── EventDetail.js            # 이벤트 상세/예매 (실시간 재고)
│   │   │   ├── SeatSelection.js          # 좌석 선택 (실시간 동기화)
│   │   │   ├── MyReservations.js
│   │   │   └── admin/
│   │   │       ├── Dashboard.js
│   │   │       └── Events.js
│   │   └── services/
│   │       └── api.js                    # Axios HTTP 클라이언트
│   └── package.json
├── database/
│   └── init.sql                       # DB 초기화 스크립트
├── docker-compose.yml
├── 대기열_모달_사용법.md                  # 대기열 기능 상세 가이드
├── WEBSOCKET_IMPLEMENTATION_GUIDE.md     # WebSocket 구현 가이드
├── REALTIME_FEATURES_완료.md             # 실시간 기능 완료 보고서
├── ALB_WEBSOCKET_AUTH_GUIDE.md           # ALB 스티키 세션 & WebSocket 인증 가이드 (NEW)
└── docs/
    ├── PRODUCTION_ROADMAP.md             # AWS 배포 로드맵
    ├── SEAT_SYSTEM_GUIDE.md              # 좌석 시스템 가이드
    └── TODO.md
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
- 백엔드: `backend/src/services/queue-manager.js:line44-64`
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
- 훅: `frontend/src/hooks/useSocket.js:line60-80`

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
- 백엔드: `backend/src/routes/reservations.js:line176-189` (예매 생성 시)
- 백엔드: `backend/src/routes/reservations.js:line280-293` (예매 취소 시)
- 프론트엔드: `frontend/src/pages/EventDetail.js:line78-91`
- 훅: `frontend/src/hooks/useSocket.js:line34-52`

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
- 백엔드 인증: `backend/src/config/socket.js:line37-58`
- 세션 관리: `backend/src/services/socket-session-manager.js`
- 프론트엔드: `frontend/src/hooks/useSocket.js:line24-42`

**보안 개선**:
- ❌ 이전: 클라이언트가 userId 직접 전송 (사칭 가능)
- ✅ 현재: 서버가 JWT에서 userId 추출 (검증됨)

**시나리오**:
1. 사용자가 대기열 50번째 대기 중
2. 지하철 타면서 네트워크 끊김
3. 자동 재연결 성공
4. **Redis에서 이전 세션 조회 → 대기열 50번째 위치 그대로 유지!**

**특징**:
- ✅ ALB 멀티 인스턴스 환경에서 완벽 동작
- ✅ 재연결 시 사용자 경험 손실 없음
- ✅ 보안 강화 (인증 없는 연결 차단)

---

### 5. WebSocket 멀티 인스턴스 동기화 (Redis Adapter)

**문제**: AWS ALB가 사용자를 여러 EC2로 분산 → EC2-1에서 emit한 메시지가 EC2-2 사용자에게 안 감

**해결**: Socket.IO Redis Adapter
```javascript
// EC2-1에서 emit
io.to('event:123').emit('ticket-updated', data);

// Redis Pub/Sub
// → EC2-1의 Redis Client가 'event:123' 채널에 publish
// → EC2-2, EC2-3의 Redis Client가 subscribe로 메시지 받음
// → EC2-2, EC2-3도 자신의 Socket.IO 클라이언트에게 emit

// 결과: 모든 EC2의 모든 사용자가 메시지 받음!
```

**핵심 코드**: `backend/src/config/socket.js:line60-83`

**특징**:
- ✅ AWS 멀티 인스턴스에서 자동 동작
- ✅ 추가 코드 수정 없이 확장 가능
- ✅ ALB Sticky Session만 설정하면 완료

---

## ☁️ AWS 연동 계획 (상세)

### 1️⃣ VPC & 네트워크 구성

#### VPC 설계
```
VPC: 10.0.0.0/16 (Seoul: ap-northeast-2)

Public Subnet (ALB, NAT Gateway):
├─ ap-northeast-2a: 10.0.1.0/24
└─ ap-northeast-2c: 10.0.2.0/24

Private Subnet (EC2, RDS, Redis):
├─ ap-northeast-2a: 10.0.10.0/24
└─ ap-northeast-2c: 10.0.11.0/24
```

#### Security Groups
```bash
# alb-sg (ALB)
Inbound:
  - 80/tcp from 0.0.0.0/0
  - 443/tcp from 0.0.0.0/0

# ec2-sg (Backend Instances)
Inbound:
  - 3001/tcp from alb-sg
  - 22/tcp from Bastion-SG (관리용)

# rds-sg (PostgreSQL)
Inbound:
  - 5432/tcp from ec2-sg

# redis-sg (ElastiCache)
Inbound:
  - 6379/tcp from ec2-sg
```

#### 생성 명령어
```bash
# VPC 생성
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=tiketi-vpc}]'

# Subnet 생성
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24 --availability-zone ap-northeast-2a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=tiketi-public-2a}]'

# Internet Gateway 연결
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=tiketi-igw}]'
aws ec2 attach-internet-gateway --internet-gateway-id igw-xxx --vpc-id vpc-xxx

# NAT Gateway 생성 (Public Subnet에)
aws ec2 create-nat-gateway --subnet-id subnet-public-2a --allocation-id eipalloc-xxx
```

**예상 비용**: NAT Gateway ₩5,000/월

---

### 2️⃣ 컴퓨팅 (EC2 + ALB + Auto Scaling)

#### Application Load Balancer
```bash
# ALB 생성
aws elbv2 create-load-balancer \
  --name tiketi-alb \
  --subnets subnet-public-2a subnet-public-2c \
  --security-groups sg-alb \
  --scheme internet-facing

# Target Group 생성
aws elbv2 create-target-group \
  --name tiketi-backend-tg \
  --protocol HTTP \
  --port 3001 \
  --vpc-id vpc-xxx \
  --health-check-path /health \
  --health-check-interval-seconds 30

# Sticky Session 활성화 (WebSocket용)
aws elbv2 modify-target-group-attributes \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --attributes Key=stickiness.enabled,Value=true \
               Key=stickiness.type,Value=lb_cookie \
               Key=stickiness.lb_cookie.duration_seconds,Value=86400

# HTTPS Listener 생성
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...

# HTTP → HTTPS 리다이렉트
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}
```

**예상 비용**: ₩27,000/월

---

#### EC2 Instances (Docker Compose 방식)

**User Data (초기 설정 스크립트)**:
```bash
#!/bin/bash
# Amazon Linux 2023

# Docker Engine 설치
dnf update -y
dnf install -y docker
systemctl start docker
systemctl enable docker

# Docker Compose 설치
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Git 설치 및 프로젝트 클론
dnf install -y git
cd /home/ec2-user
git clone https://github.com/yourusername/tiketi.git
cd tiketi

# 환경변수 설정 (.env 파일)
cat > .env << EOF
NODE_ENV=production
POSTGRES_HOST=tiketi-db.cluster-xxx.ap-northeast-2.rds.amazonaws.com
POSTGRES_PORT=5432
POSTGRES_DB=tiketi
POSTGRES_USER=tiketi_user
POSTGRES_PASSWORD=$(aws secretsmanager get-secret-value --secret-id tiketi/db-password --query SecretString --output text)

REDIS_HOST=tiketi-redis.xxx.cache.amazonaws.com
REDIS_PORT=6379

JWT_SECRET=$(aws secretsmanager get-secret-value --secret-id tiketi/jwt-secret --query SecretString --output text)

FRONTEND_URL=https://tiketi.gg
EOF

# Docker Compose 실행
docker-compose -f docker-compose.prod.yml up -d

# CloudWatch Agent 설치
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

# CloudWatch Agent 설정
cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json << 'CWCONFIG'
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/home/ec2-user/tiketi/logs/*.log",
            "log_group_name": "/aws/ec2/tiketi/backend",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "TIKETI",
    "metrics_collected": {
      "cpu": {
        "measurement": [{"name": "cpu_usage_idle", "unit": "Percent"}],
        "metrics_collection_interval": 60
      },
      "mem": {
        "measurement": [{"name": "mem_used_percent"}],
        "metrics_collection_interval": 60
      }
    }
  }
}
CWCONFIG

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json \
  -s
```

**docker-compose.prod.yml** (프로덕션용):
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    restart: always
    environment:
      - NODE_ENV=production
      - POSTGRES_HOST=${POSTGRES_HOST}
      - POSTGRES_PORT=${POSTGRES_PORT}
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - REDIS_HOST=${REDIS_HOST}
      - REDIS_PORT=${REDIS_PORT}
      - JWT_SECRET=${JWT_SECRET}
      - FRONTEND_URL=${FRONTEND_URL}
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"

  frontend:
    build:
      context: ./frontend
      args:
        - REACT_APP_API_URL=https://api.tiketi.gg
        - REACT_APP_SOCKET_URL=https://api.tiketi.gg
    restart: always
    ports:
      - "3000:3000"
```

**Launch Template 생성**:
```bash
aws ec2 create-launch-template \
  --launch-template-name tiketi-backend-template \
  --version-description "v1.0" \
  --launch-template-data '{
    "ImageId": "ami-0c9c942bd7bf113a2",
    "InstanceType": "t3.medium",
    "KeyName": "tiketi-key",
    "SecurityGroupIds": ["sg-ec2"],
    "IamInstanceProfile": {"Arn": "arn:aws:iam::123456789012:instance-profile/TiketiEC2Role"},
    "UserData": "'$(base64 -w0 user-data.sh)'",
    "TagSpecifications": [{
      "ResourceType": "instance",
      "Tags": [{"Key": "Name", "Value": "tiketi-backend"}]
    }]
  }'
```

**예상 비용**: t3.medium ₩40,000/월, t3.small ₩20,000/월

---

#### Auto Scaling Group
```bash
# Auto Scaling Group 생성
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name tiketi-asg \
  --launch-template LaunchTemplateName=tiketi-backend-template,Version='$Latest' \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 3 \
  --target-group-arns arn:aws:elasticloadbalancing:... \
  --health-check-type ELB \
  --health-check-grace-period 300 \
  --vpc-zone-identifier "subnet-private-2a,subnet-private-2c"

# Scaling Policy (CPU 기반)
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name tiketi-asg \
  --policy-name scale-out-cpu \
  --scaling-adjustment 2 \
  --adjustment-type ChangeInCapacity \
  --cooldown 300

# CloudWatch Alarm (CPU > 70%)
aws cloudwatch put-metric-alarm \
  --alarm-name tiketi-cpu-high \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --period 300 \
  --statistic Average \
  --threshold 70.0 \
  --alarm-actions arn:aws:autoscaling:...
```

**예상 추가 비용**: 트래픽 증가 시 인스턴스당 ₩20-40k/월

---

### 3️⃣ 데이터베이스 (RDS PostgreSQL)

#### RDS 생성
```bash
# DB Subnet Group 생성
aws rds create-db-subnet-group \
  --db-subnet-group-name tiketi-db-subnet \
  --db-subnet-group-description "TIKETI Private Subnets" \
  --subnet-ids subnet-private-2a subnet-private-2c

# RDS PostgreSQL 생성 (Multi-AZ)
aws rds create-db-instance \
  --db-instance-identifier tiketi-db \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 15.4 \
  --master-username tiketi_user \
  --master-user-password $(aws secretsmanager get-secret-value --secret-id tiketi/db-password --query SecretString --output text) \
  --allocated-storage 50 \
  --storage-type gp3 \
  --storage-encrypted \
  --vpc-security-group-ids sg-rds \
  --db-subnet-group-name tiketi-db-subnet \
  --multi-az \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --enable-cloudwatch-logs-exports '["postgresql"]' \
  --publicly-accessible false
```

#### 데이터 마이그레이션
```bash
# 로컬 DB 덤프
pg_dump -h localhost -U postgres -d tiketi > tiketi_backup.sql

# RDS로 복원 (Bastion Host 또는 EC2에서)
psql -h tiketi-db.cluster-xxx.ap-northeast-2.rds.amazonaws.com \
     -U tiketi_user \
     -d tiketi \
     -f tiketi_backup.sql
```

**예상 비용**: db.t3.small Multi-AZ ₩60,000/월

---

### 4️⃣ 캐시 & 대기열 (ElastiCache Redis)

#### Redis Cluster 생성
```bash
# Subnet Group 생성
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name tiketi-redis-subnet \
  --cache-subnet-group-description "TIKETI Redis Private Subnets" \
  --subnet-ids subnet-private-2a subnet-private-2c

# Redis Cluster 생성 (Cluster Mode Enabled)
aws elasticache create-replication-group \
  --replication-group-id tiketi-redis \
  --replication-group-description "TIKETI Redis Cluster" \
  --engine redis \
  --engine-version 7.0 \
  --cache-node-type cache.t3.small \
  --num-node-groups 2 \
  --replicas-per-node-group 1 \
  --cache-subnet-group-name tiketi-redis-subnet \
  --security-group-ids sg-redis \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --snapshot-retention-limit 5 \
  --snapshot-window "03:00-05:00"
```

**용도**:
- Socket.IO Redis Adapter (Pub/Sub)
- 대기열 시스템 (Sorted Set)
- 세션 캐싱
- API 응답 캐싱

**예상 비용**: cache.t3.small × 4노드 (2샤드 × 2레플리카) ₩80,000/월

---

### 5️⃣ 스토리지 & CDN

#### S3 Buckets 생성
```bash
# 정적 파일 버킷 (React 빌드)
aws s3 mb s3://tiketi-static --region ap-northeast-2
aws s3 website s3://tiketi-static --index-document index.html --error-document index.html

# 업로드 파일 버킷 (이벤트 포스터, 프로필 사진)
aws s3 mb s3://tiketi-uploads --region ap-northeast-2

# 로그 버킷
aws s3 mb s3://tiketi-logs --region ap-northeast-2

# 백업 버킷
aws s3 mb s3://tiketi-backups --region ap-northeast-2

# Lifecycle Policy 설정 (로그는 30일 후 Glacier로)
aws s3api put-bucket-lifecycle-configuration \
  --bucket tiketi-logs \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "Move to Glacier",
      "Status": "Enabled",
      "Transitions": [{
        "Days": 30,
        "StorageClass": "GLACIER"
      }]
    }]
  }'
```

**예상 비용**: 50GB ₩2,000/월

---

#### CloudFront CDN 설정
```bash
# CloudFront Distribution 생성
aws cloudfront create-distribution \
  --distribution-config '{
    "Origins": {
      "Quantity": 2,
      "Items": [
        {
          "Id": "S3-tiketi-static",
          "DomainName": "tiketi-static.s3.ap-northeast-2.amazonaws.com",
          "S3OriginConfig": {
            "OriginAccessIdentity": "origin-access-identity/cloudfront/E1ABCDEFG..."
          }
        },
        {
          "Id": "ALB-backend",
          "DomainName": "tiketi-alb-123.ap-northeast-2.elb.amazonaws.com",
          "CustomOriginConfig": {
            "HTTPPort": 80,
            "HTTPSPort": 443,
            "OriginProtocolPolicy": "https-only"
          }
        }
      ]
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "S3-tiketi-static",
      "ViewerProtocolPolicy": "redirect-to-https",
      "Compress": true,
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
    },
    "CacheBehaviors": {
      "Quantity": 1,
      "Items": [{
        "PathPattern": "/api/*",
        "TargetOriginId": "ALB-backend",
        "ViewerProtocolPolicy": "https-only",
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
      }]
    },
    "Aliases": {
      "Quantity": 1,
      "Items": ["tiketi.gg", "www.tiketi.gg"]
    },
    "ViewerCertificate": {
      "ACMCertificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/...",
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021"
    }
  }'
```

**예상 비용**: FREE (1TB 프리티어)

---

### 6️⃣ DNS & SSL (Route 53 + ACM)

#### Route 53 도메인 설정
```bash
# Hosted Zone 생성
aws route53 create-hosted-zone \
  --name tiketi.gg \
  --caller-reference $(date +%s)

# A Record (Alias to CloudFront)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "tiketi.gg",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d111111abcdef8.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'

# CNAME for www
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.tiketi.gg",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "tiketi.gg"}]
      }
    }]
  }'
```

**예상 비용**: ₩500/월

---

#### ACM SSL 인증서 발급
```bash
# 인증서 요청 (CloudFront용 - us-east-1에서!)
aws acm request-certificate \
  --domain-name tiketi.gg \
  --subject-alternative-names www.tiketi.gg \
  --validation-method DNS \
  --region us-east-1

# ALB용 인증서 (Seoul)
aws acm request-certificate \
  --domain-name api.tiketi.gg \
  --validation-method DNS \
  --region ap-northeast-2

# DNS 검증 레코드를 Route 53에 추가 (자동 완료)
```

**예상 비용**: FREE

---

### 7️⃣ 보안 (Secrets Manager + IAM)

#### Secrets Manager 설정
```bash
# DB 비밀번호 저장
aws secretsmanager create-secret \
  --name tiketi/db-password \
  --description "TIKETI Database Password" \
  --secret-string "your-secure-password-here"

# JWT Secret 저장
aws secretsmanager create-secret \
  --name tiketi/jwt-secret \
  --description "TIKETI JWT Secret" \
  --secret-string "$(openssl rand -base64 32)"

# 자동 로테이션 설정 (선택)
aws secretsmanager rotate-secret \
  --secret-id tiketi/db-password \
  --rotation-lambda-arn arn:aws:lambda:ap-northeast-2:123456789012:function:SecretsManagerRDSPostgreSQLRotation \
  --rotation-rules AutomaticallyAfterDays=90
```

**예상 비용**: ₩2,000/월

---

#### IAM Role 생성
```bash
# EC2 Instance Role (S3, Secrets Manager, CloudWatch 접근)
aws iam create-role \
  --role-name TiketiEC2Role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# 정책 연결
aws iam attach-role-policy \
  --role-name TiketiEC2Role \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

aws iam attach-role-policy \
  --role-name TiketiEC2Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

aws iam put-role-policy \
  --role-name TiketiEC2Role \
  --policy-name SecretsManagerReadOnly \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:ap-northeast-2:*:secret:tiketi/*"
    }]
  }'

# Instance Profile 생성
aws iam create-instance-profile --instance-profile-name TiketiEC2Role
aws iam add-role-to-instance-profile --instance-profile-name TiketiEC2Role --role-name TiketiEC2Role
```

---

### 8️⃣ 모니터링 (CloudWatch)

#### CloudWatch Alarms 설정
```bash
# ALB 5xx 에러
aws cloudwatch put-metric-alarm \
  --alarm-name tiketi-alb-5xx \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --period 60 \
  --statistic Sum \
  --threshold 10 \
  --alarm-actions arn:aws:sns:ap-northeast-2:123456789012:tiketi-alerts

# RDS CPU > 80%
aws cloudwatch put-metric-alarm \
  --alarm-name tiketi-rds-cpu \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --period 300 \
  --statistic Average \
  --threshold 80.0 \
  --dimensions Name=DBInstanceIdentifier,Value=tiketi-db \
  --alarm-actions arn:aws:sns:ap-northeast-2:123456789012:tiketi-alerts

# ElastiCache Memory > 90%
aws cloudwatch put-metric-alarm \
  --alarm-name tiketi-redis-memory \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --metric-name DatabaseMemoryUsagePercentage \
  --namespace AWS/ElastiCache \
  --period 60 \
  --statistic Average \
  --threshold 90.0 \
  --dimensions Name=ReplicationGroupId,Value=tiketi-redis \
  --alarm-actions arn:aws:sns:ap-northeast-2:123456789012:tiketi-alerts
```

#### SNS 알림 설정
```bash
# SNS Topic 생성
aws sns create-topic --name tiketi-alerts

# 이메일 구독
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-2:123456789012:tiketi-alerts \
  --protocol email \
  --notification-endpoint admin@tiketi.gg

# Slack Webhook (Lambda로 전송)
aws lambda create-function \
  --function-name tiketi-sns-to-slack \
  --runtime python3.11 \
  --handler index.handler \
  --role arn:aws:iam::123456789012:role/lambda-sns-role \
  --zip-file fileb://sns-to-slack.zip \
  --environment Variables={SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...}

aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-2:123456789012:tiketi-alerts \
  --protocol lambda \
  --notification-endpoint arn:aws:lambda:ap-northeast-2:123456789012:function:tiketi-sns-to-slack
```

**예상 비용**: FREE (기본 알림), CloudWatch Logs ₩2,000/월

---

### 9️⃣ CI/CD (GitHub Actions)

#### GitHub Actions Workflow
`.github/workflows/deploy.yml`:
```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-2

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: tiketi-backend
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG ./backend
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

      - name: Deploy to EC2 (Blue/Green)
        run: |
          aws ssm send-command \
            --document-name "AWS-RunShellScript" \
            --targets "Key=tag:Name,Values=tiketi-backend" \
            --parameters 'commands=["cd /home/ec2-user/tiketi && git pull && docker-compose -f docker-compose.prod.yml up -d --no-deps --build backend"]'

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Build React app
        working-directory: ./frontend
        env:
          REACT_APP_API_URL: https://api.tiketi.gg
          REACT_APP_SOCKET_URL: https://api.tiketi.gg
        run: npm run build

      - name: Deploy to S3
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-2

      - run: |
          aws s3 sync ./frontend/build s3://tiketi-static --delete
          aws cloudfront create-invalidation --distribution-id E1ABCDEFG --paths "/*"
```

---

## 💰 AWS 예상 비용 정리

### 월간 비용 (프로덕션, 5,000명 사용자 기준)

| 항목 | 서비스 | 사양 | 월 비용 | 비고 |
|------|--------|------|---------|------|
| **컴퓨팅** |
| EC2 Backend | t3.medium × 2 | 2 vCPU, 4GB RAM | ₩80,000 | Docker Compose |
| ALB | Application Load Balancer | - | ₩27,000 | Sticky Session |
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
| CloudWatch | Logs + Alarms | 10GB 로그 | ₩3,000 | |
| SNS | 알림 | 1,000건/월 | FREE | |
| **합계** | | | **₩264,500/월** | **약 $198/월** |

### 트래픽 증가 시 추가 비용

| 트래픽 레벨 | 예상 사용자 | 추가 리소스 | 추가 비용 |
|------------|------------|------------|----------|
| **Low** (현재) | 5,000명 | 없음 | ₩0 |
| **Medium** | 10,000명 | EC2 +1 (Auto Scaling) | +₩40,000 |
| **High** | 50,000명 | EC2 +3, RDS Upgrade (db.t3.medium) | +₩150,000 |
| **Very High** | 100,000명 | EC2 +5, RDS db.r5.large, Redis Cluster 확장 | +₩400,000 |

### 비용 최적화 팁
- ✅ Reserved Instances (1년 약정 → 30-40% 할인)
- ✅ Savings Plans (1-3년 약정 → 최대 72% 할인)
- ✅ NAT Gateway 대신 VPC Endpoint 활용 (S3, DynamoDB)
- ✅ CloudWatch Logs 보관 기간 단축 (30일 → Glacier)
- ✅ 개발/스테이징 환경은 야간/주말 자동 종료

---

## 🛠️ 개발 가이드

### 로컬 개발 환경

#### 백엔드 개발 (Docker 없이)
```bash
cd backend
npm install
npm run dev
```

#### 프론트엔드 개발
```bash
cd frontend
npm install
npm start
```

#### 데이터베이스 (Docker로 실행)
```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=tiketi_pass postgres:15
docker run -d -p 6379:6379 docker.dragonflydb.io/dragonflydb/dragonfly
```

---

### API 엔드포인트

#### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인

#### 이벤트
- `GET /api/events` - 이벤트 목록
- `GET /api/events/:id` - 이벤트 상세

#### 대기열
- `POST /api/queue/check/:eventId` - 대기열 진입 확인
- `GET /api/queue/status/:eventId` - 대기열 상태 조회
- `POST /api/queue/leave/:eventId` - 대기열 나가기

#### 좌석 선택
- `GET /api/seats/:eventId` - 좌석 목록 조회
- `POST /api/seats/lock` - 좌석 선택 (5분 임시 잠금)

#### 예매
- `POST /api/reservations` - 예매 생성
- `GET /api/reservations/my` - 내 예매 목록
- `POST /api/reservations/:id/cancel` - 예매 취소

> 📖 **상세 API 문서**: [API.md](./docs/API.md)

---

### WebSocket 이벤트

#### 연결 및 인증
```javascript
// 연결 시 JWT 토큰 자동 전달
const socket = io(SOCKET_URL, {
  auth: { token: localStorage.getItem('token') }
});

// 인증 성공 후 자동으로 이전 세션 복구
socket.on('session-restored', (data) => {
  console.log('복구된 세션:', data.eventId, data.selectedSeats);
});
```

#### 클라이언트 → 서버
```javascript
socket.emit('join-event', { eventId });
socket.emit('join-queue', { eventId });  // userId는 서버가 JWT에서 추출
socket.emit('join-seat-selection', { eventId });
socket.emit('seat-selection-changed', { eventId, seats }); // 좌석 선택 상태 저장
```

#### 서버 → 클라이언트
```javascript
socket.on('ticket-updated', (data) => { ... });         // 티켓 재고 변경
socket.on('seat-locked', (data) => { ... });            // 좌석 선택됨
socket.on('seat-released', (data) => { ... });          // 좌석 해제됨
socket.on('queue-updated', (data) => { ... });          // 대기열 순번 변경
socket.on('queue-entry-allowed', (data) => { ... });    // 입장 허용
socket.on('session-restored', (data) => { ... });       // 재연결 시 세션 복구
```

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
- **AWS**: VPC, EC2, ALB, RDS, ElastiCache, S3, CloudFront, Route 53
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

### ✅ 완료된 작업 (2025-10-31)
- [x] **WebSocket 인증 시스템** - JWT 기반 WebSocket 연결 인증
- [x] **세션 관리 시스템** - Redis 기반 세션 저장으로 재연결 시 자동 복구
- [x] **재연결 로직** - 네트워크 끊김 시 자동 재연결 및 이전 상태 복구
- [x] **연결 상태 UI** - 사용자에게 실시간 연결 상태 시각화
- [x] **보안 강화** - 클라이언트가 userId 조작 불가 (서버가 JWT에서 추출)
- [x] **ALB 멀티 인스턴스 대비** - AWS 확장을 위한 모든 준비 완료

### Phase 1: 기능 완성 (2-3주)
- [ ] 결제 시스템 연동 (토스페이먼츠)
- [ ] 이메일 알림 (SendGrid/AWS SES)
- [ ] 이벤트 검색 & 필터
- [ ] 이미지 업로드 (로컬: Multer, AWS: S3)
- [ ] 모바일 반응형 개선
- [ ] 좌석 선택 실시간 동기화 강화

### Phase 2: AWS 배포 (3-4주)
- [ ] VPC & 네트워크 구성
- [ ] RDS PostgreSQL 마이그레이션
- [ ] ElastiCache Redis 설정 (세션 관리 활용)
- [ ] EC2 + ALB + Auto Scaling 구성 (스티키 세션 설정)
- [ ] S3 + CloudFront 배포
- [ ] Route 53 + ACM (SSL)
- [ ] Secrets Manager 설정
- [ ] **WebSocket 인증 통합 테스트** (멀티 인스턴스 환경)

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
- [ ] WebSocket 연결 품질 모니터링 (지연 시간, 재연결 빈도)

> 📖 **상세 로드맵**: [PRODUCTION_ROADMAP.md](./docs/PRODUCTION_ROADMAP.md)

---

## 📚 문서

### 실시간 기능 & WebSocket
- [WEBSOCKET_IMPLEMENTATION_GUIDE.md](./WEBSOCKET_IMPLEMENTATION_GUIDE.md) - WebSocket 구현 가이드
- [ALB_WEBSOCKET_AUTH_GUIDE.md](./ALB_WEBSOCKET_AUTH_GUIDE.md) - **ALB 스티키 세션 & WebSocket 인증 가이드** 🆕
- [REALTIME_FEATURES_완료.md](./REALTIME_FEATURES_완료.md) - 실시간 기능 완료 보고서
- [대기열_모달_사용법.md](./대기열_모달_사용법.md) - 대기열 기능 상세 가이드

### 시스템 & 배포
- [docs/SEAT_SYSTEM_GUIDE.md](./docs/SEAT_SYSTEM_GUIDE.md) - 좌석 시스템 가이드
- [docs/PRODUCTION_ROADMAP.md](./docs/PRODUCTION_ROADMAP.md) - AWS 배포 로드맵

### 개발 가이드
- [docs/팀원용_시작가이드.md](./docs/팀원용_시작가이드.md) - Windows 시작 가이드
- [docs/macOS_시작가이드.md](./docs/macOS_시작가이드.md) - macOS 시작 가이드

---

## 👨‍💻 개발자

티케티 개발팀

---

**Made with ❤️ for real-time ticketing experience**
