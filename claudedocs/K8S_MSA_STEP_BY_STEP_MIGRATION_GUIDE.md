# K8s MSA 마이그레이션 실전 가이드

## 📋 개요

이 가이드는 현재 Tiketi 모놀리식 백엔드를 K8s 기반 마이크로서비스로 전환하는 **실제 작업 순서**를 단계별로 설명합니다.

**현재 상태 (AS-IS)**:
- 단일 Node.js 백엔드 (`backend/src/`)
- 단일 PostgreSQL 데이터베이스
- 단일 Redis 인스턴스
- Docker Compose 배포

**목표 상태 (TO-BE)**:
- 8개 마이크로서비스
- 서비스별 독립 데이터베이스
- K8s 클러스터 배포
- CI/CD 자동화

---

## 🎯 전체 로드맵 (10주)

```
Phase 1: 준비 및 인프라 (Week 1-2)
├─ Week 1: AWS 인프라 구축
└─ Week 2: 데이터베이스 분리 계획

Phase 2: 코어 서비스 분리 (Week 3-5)
├─ Week 3: User Service, Event Service
├─ Week 4: Reservation Service, Payment Service
└─ Week 5: Queue Service, Media Service

Phase 3: 신규 기능 개발 (Week 6-7)
├─ Week 6: Analytics Service, Google OAuth
└─ Week 7: Toss Payments 통합

Phase 4: 통합 및 배포 (Week 8-10)
├─ Week 8: Admin Service, CI/CD
├─ Week 9: 통합 테스트, 성능 최적화
└─ Week 10: 프로덕션 배포
```

---

## 📂 현재 프로젝트 구조 분석

### 백엔드 코드 구조

```
backend/src/
├── config/
│   ├── database.js          # PostgreSQL 연결
│   ├── redis.js             # Redis 연결
│   ├── socket.js            # Socket.IO 설정
│   ├── swagger.js           # API 문서
│   ├── init-admin.js        # 관리자 계정 초기화
│   └── init-seats.js        # 좌석 초기화
├── routes/
│   ├── auth.js              # 로그인/회원가입
│   ├── events.js            # 이벤트 CRUD
│   ├── reservations.js      # 예약 관리
│   ├── seats.js             # 좌석 조회
│   ├── tickets.js           # 티켓 조회
│   ├── payments.js          # 결제 처리
│   ├── admin.js             # 관리자 기능
│   ├── queue.js             # 대기열 API
│   ├── news.js              # 뉴스 관리
│   ├── image.js             # 이미지 업로드
│   └── health.js            # 헬스체크
├── services/
│   ├── reservation-cleaner.js    # 예약 타임아웃 처리
│   ├── event-status-updater.js   # 이벤트 상태 업데이트
│   ├── queue-manager.js          # 대기열 관리
│   ├── seat-generator.js         # 좌석 생성
│   └── socket-session-manager.js # 소켓 세션 관리
├── middleware/
│   ├── auth.js              # JWT 인증
│   ├── error-handler.js     # 에러 핸들링
│   └── request-logger.js    # 요청 로깅
├── metrics/
│   ├── index.js             # Prometheus 메트릭
│   ├── middleware.js        # 메트릭 수집 미들웨어
│   ├── aggregator.js        # 메트릭 집계
│   └── db.js                # DB 메트릭
├── utils/
│   ├── logger.js            # Winston 로거
│   ├── custom-error.js      # 커스텀 에러
│   ├── transaction-helpers.js  # 트랜잭션 헬퍼
│   └── header-info-extractor.js
├── shared/
│   └── constants.js         # 상수 정의
└── server.js                # 메인 엔트리포인트
```

### 데이터베이스 스키마

```sql
핵심 테이블:
- users                    # 사용자
- events                   # 이벤트
- seat_layouts             # 좌석 레이아웃
- seats                    # 개별 좌석
- ticket_types             # 티켓 타입
- reservations             # 예약
- reservation_items        # 예약 아이템
- news                     # 뉴스
- keyword_mappings         # 키워드 매핑
```

---

## 🚀 Phase 1: 준비 및 인프라 (Week 1-2)

### Week 1: AWS 인프라 구축

#### Day 1-2: VPC 및 EKS 클러스터 생성

**1.1 VPC 생성**

```bash
# AWS CLI를 사용한 VPC 생성
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=tiketi-vpc}]'

# Subnet 생성
# Public Subnet A (ap-northeast-2a)
aws ec2 create-subnet \
  --vpc-id <VPC_ID> \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ap-northeast-2a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=tiketi-public-a}]'

# Public Subnet C (ap-northeast-2c)
aws ec2 create-subnet \
  --vpc-id <VPC_ID> \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ap-northeast-2c \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=tiketi-public-c}]'

# Private Subnet A
aws ec2 create-subnet \
  --vpc-id <VPC_ID> \
  --cidr-block 10.0.10.0/24 \
  --availability-zone ap-northeast-2a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=tiketi-private-a}]'

# Private Subnet C
aws ec2 create-subnet \
  --vpc-id <VPC_ID> \
  --cidr-block 10.0.11.0/24 \
  --availability-zone ap-northeast-2c \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=tiketi-private-c}]'

# Internet Gateway 생성 및 연결
aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=tiketi-igw}]'

aws ec2 attach-internet-gateway \
  --internet-gateway-id <IGW_ID> \
  --vpc-id <VPC_ID>

# NAT Gateway 생성 (Public Subnet A에)
aws ec2 allocate-address --domain vpc  # EIP 할당
aws ec2 create-nat-gateway \
  --subnet-id <PUBLIC_SUBNET_A_ID> \
  --allocation-id <EIP_ALLOCATION_ID> \
  --tag-specifications 'ResourceType=nat-gateway,Tags=[{Key=Name,Value=tiketi-nat-a}]'
```

**1.2 EKS 클러스터 생성**

```bash
# eksctl 설치 (Windows - PowerShell)
choco install eksctl

# eksctl을 사용한 클러스터 생성
eksctl create cluster \
  --name tiketi-prod \
  --region ap-northeast-2 \
  --vpc-public-subnets <PUBLIC_SUBNET_IDS> \
  --vpc-private-subnets <PRIVATE_SUBNET_IDS> \
  --without-nodegroup

# kubectl 설정
aws eks update-kubeconfig --region ap-northeast-2 --name tiketi-prod

# 클러스터 확인
kubectl get nodes
kubectl get namespaces
```

**1.3 노드 그룹 생성**

```bash
# Application Node Group
eksctl create nodegroup \
  --cluster tiketi-prod \
  --name tiketi-app-nodes \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 10 \
  --node-private-networking \
  --ssh-access \
  --ssh-public-key <YOUR_KEY_NAME>

# Stateful Node Group
eksctl create nodegroup \
  --cluster tiketi-prod \
  --name tiketi-stateful-nodes \
  --node-type t3.small \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 5 \
  --node-private-networking

# Data Node Group
eksctl create nodegroup \
  --cluster tiketi-prod \
  --name tiketi-data-nodes \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 4 \
  --node-private-networking

# System Node Group
eksctl create nodegroup \
  --cluster tiketi-prod \
  --name tiketi-system-nodes \
  --node-type t3.small \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 3 \
  --node-private-networking
```

#### Day 3-4: 네임스페이스 및 기본 설정

**1.4 네임스페이스 생성**

```bash
# 네임스페이스 생성 스크립트 작성
mkdir -p k8s/namespaces
cat > k8s/namespaces/namespaces.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: tiketi-production
---
apiVersion: v1
kind: Namespace
metadata:
  name: tiketi-data
---
apiVersion: v1
kind: Namespace
metadata:
  name: tiketi-monitoring
---
apiVersion: v1
kind: Namespace
metadata:
  name: tiketi-system
EOF

# 적용
kubectl apply -f k8s/namespaces/namespaces.yaml

# 확인
kubectl get namespaces
```

**1.5 Ingress Controller 설치**

```bash
# NGINX Ingress Controller 설치
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/aws/deploy.yaml

# 확인
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx
```

**1.6 Cert-Manager 설치 (SSL 인증서)**

```bash
# Cert-Manager 설치
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# ClusterIssuer 생성 (Let's Encrypt)
cat > k8s/cert-manager/cluster-issuer.yaml <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@tiketi.gg
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

kubectl apply -f k8s/cert-manager/cluster-issuer.yaml
```

#### Day 5: RDS 및 ElastiCache 생성

**1.7 RDS PostgreSQL 생성**

```bash
# RDS Subnet Group 생성
aws rds create-db-subnet-group \
  --db-subnet-group-name tiketi-db-subnet \
  --db-subnet-group-description "Tiketi DB Subnet Group" \
  --subnet-ids <PRIVATE_SUBNET_A_ID> <PRIVATE_SUBNET_C_ID>

# Security Group 생성
aws ec2 create-security-group \
  --group-name tiketi-rds-sg \
  --description "Tiketi RDS Security Group" \
  --vpc-id <VPC_ID>

# Ingress 규칙 추가 (EKS 노드에서만 접근 허용)
aws ec2 authorize-security-group-ingress \
  --group-id <RDS_SG_ID> \
  --protocol tcp \
  --port 5432 \
  --source-group <EKS_NODE_SG_ID>

# RDS 인스턴스 생성
aws rds create-db-instance \
  --db-instance-identifier tiketi-prod-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username tiketi_admin \
  --master-user-password <STRONG_PASSWORD> \
  --allocated-storage 20 \
  --storage-type gp3 \
  --db-subnet-group-name tiketi-db-subnet \
  --vpc-security-group-ids <RDS_SG_ID> \
  --multi-az \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "Mon:04:00-Mon:05:00" \
  --no-publicly-accessible

# 생성 확인 (5-10분 소요)
aws rds describe-db-instances --db-instance-identifier tiketi-prod-db
```

**1.8 ElastiCache Redis 생성**

```bash
# ElastiCache Subnet Group 생성
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name tiketi-redis-subnet \
  --cache-subnet-group-description "Tiketi Redis Subnet Group" \
  --subnet-ids <PRIVATE_SUBNET_A_ID> <PRIVATE_SUBNET_C_ID>

# Security Group 생성
aws ec2 create-security-group \
  --group-name tiketi-redis-sg \
  --description "Tiketi Redis Security Group" \
  --vpc-id <VPC_ID>

# Ingress 규칙
aws ec2 authorize-security-group-ingress \
  --group-id <REDIS_SG_ID> \
  --protocol tcp \
  --port 6379 \
  --source-group <EKS_NODE_SG_ID>

# Redis Cluster 생성
aws elasticache create-replication-group \
  --replication-group-id tiketi-redis-cluster \
  --replication-group-description "Tiketi Redis Cluster" \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-clusters 3 \
  --cache-subnet-group-name tiketi-redis-subnet \
  --security-group-ids <REDIS_SG_ID> \
  --automatic-failover-enabled \
  --multi-az-enabled

# 생성 확인
aws elasticache describe-replication-groups \
  --replication-group-id tiketi-redis-cluster
```

### Week 2: 데이터베이스 마이그레이션 준비

#### Day 1-2: 데이터베이스 스키마 분리 계획

**2.1 서비스별 데이터베이스 분리 매핑**

현재 테이블을 서비스별로 분리:

```
User Service (users_db):
- users
- oauth_providers (신규)

Event Service (events_db):
- events
- seat_layouts
- ticket_types
- keyword_mappings

Reservation Service (reservations_db):
- reservations
- reservation_items
- seats

Payment Service (payments_db):
- payments (신규)
- refunds (신규)

Analytics Service (analytics_db):
- analytics_events (신규)
- daily_stats (신규)
- artist_traffic (신규)
- revenue_stats (신규)

Admin Service (admin_db):
- news
- admin_logs (신규)
```

**2.2 데이터베이스 분리 스크립트 작성**

```bash
# 데이터베이스 마이그레이션 디렉토리 생성
mkdir -p database/migrations-msa
```

```sql
-- database/migrations-msa/01_create_service_databases.sql

-- User Service Database
CREATE DATABASE users_db;

-- Event Service Database
CREATE DATABASE events_db;

-- Reservation Service Database
CREATE DATABASE reservations_db;

-- Payment Service Database
CREATE DATABASE payments_db;

-- Analytics Service Database
CREATE DATABASE analytics_db;

-- Admin Service Database
CREATE DATABASE admin_db;
```

**2.3 각 서비스별 스키마 파일 작성**

```bash
# User Service Schema
cat > database/migrations-msa/users_db_schema.sql <<EOF
-- Connect to users_db
\c users_db

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    email_verified BOOLEAN DEFAULT FALSE,
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OAuth Providers table (NEW for Google Login)
CREATE TABLE oauth_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google', 'kakao', 'naver'
    provider_user_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_user_id)
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_oauth_providers_user_id ON oauth_providers(user_id);
CREATE INDEX idx_oauth_providers_provider ON oauth_providers(provider, provider_user_id);

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_providers_updated_at BEFORE UPDATE ON oauth_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EOF
```

```bash
# Payment Service Schema
cat > database/migrations-msa/payments_db_schema.sql <<EOF
-- Connect to payments_db
\c payments_db

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Payments table (NEW for Toss Payments)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL, -- Foreign key는 논리적으로만 연결
    user_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    provider VARCHAR(50) NOT NULL DEFAULT 'TOSS', -- 'TOSS', 'CARD', etc
    payment_key VARCHAR(255), -- Toss Payment Key
    order_id VARCHAR(255) UNIQUE,
    approved_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refunds table (NEW)
CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    reason VARCHAR(255),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    refunded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_payments_reservation_id ON payments(reservation_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);
EOF
```

```bash
# Analytics Service Schema
cat > database/migrations-msa/analytics_db_schema.sql <<EOF
-- Connect to analytics_db
\c analytics_db

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable TimescaleDB extension (if using TimescaleDB)
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Analytics Events table (Event Store)
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL, -- 'page_view', 'payment_completed', etc
    aggregate_id VARCHAR(255) NOT NULL, -- artist_id, event_id, etc
    data JSONB NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily Stats table (Aggregated)
CREATE TABLE daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    artist_id UUID,
    event_id UUID,
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    reservations_count INTEGER DEFAULT 0,
    revenue INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, artist_id, event_id)
);

-- Artist Traffic table (NEW for Admin Dashboard)
CREATE TABLE artist_traffic (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL,
    artist_name VARCHAR(255),
    date DATE NOT NULL,
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    avg_session_duration INTEGER DEFAULT 0, -- seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(artist_id, date)
);

-- Revenue Stats table (NEW for Admin Dashboard)
CREATE TABLE revenue_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    period_start DATE NOT NULL,
    total_revenue INTEGER DEFAULT 0,
    tickets_sold INTEGER DEFAULT 0,
    avg_ticket_price INTEGER DEFAULT 0,
    top_artist_id UUID,
    top_artist_revenue INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(period_type, period_start)
);

-- Indexes
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX idx_daily_stats_date ON daily_stats(date DESC);
CREATE INDEX idx_daily_stats_artist ON daily_stats(artist_id, date DESC);
CREATE INDEX idx_artist_traffic_date ON artist_traffic(date DESC);
CREATE INDEX idx_artist_traffic_artist ON artist_traffic(artist_id, date DESC);
CREATE INDEX idx_revenue_stats_period ON revenue_stats(period_type, period_start DESC);

-- Convert to hypertable (if using TimescaleDB)
-- SELECT create_hypertable('analytics_events', 'timestamp');
-- SELECT create_hypertable('daily_stats', 'date');
EOF
```

#### Day 3-4: 기존 데이터 마이그레이션 스크립트

**2.4 데이터 마이그레이션 스크립트**

```bash
# 데이터 마이그레이션 스크립트 작성
cat > database/migrations-msa/migrate_data.sql <<EOF
-- ===============================================
-- Data Migration Script: Monolith → MSA
-- ===============================================

-- Step 1: Migrate Users
INSERT INTO users_db.users
SELECT * FROM tiketi.users;

-- Step 2: Migrate Events
INSERT INTO events_db.events
SELECT * FROM tiketi.events;

INSERT INTO events_db.seat_layouts
SELECT * FROM tiketi.seat_layouts;

INSERT INTO events_db.ticket_types
SELECT * FROM tiketi.ticket_types;

INSERT INTO events_db.keyword_mappings
SELECT * FROM tiketi.keyword_mappings;

-- Step 3: Migrate Reservations
INSERT INTO reservations_db.reservations
SELECT * FROM tiketi.reservations;

INSERT INTO reservations_db.reservation_items
SELECT * FROM tiketi.reservation_items;

INSERT INTO reservations_db.seats
SELECT * FROM tiketi.seats;

-- Step 4: Admin Data
INSERT INTO admin_db.news
SELECT * FROM tiketi.news;

-- Note: Payments and Analytics are new tables (no migration needed)
EOF
```

#### Day 5: ConfigMap & Secrets 준비

**2.5 K8s ConfigMap 작성**

```bash
mkdir -p k8s/config
cat > k8s/config/configmap.yaml <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: tiketi-production
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  CORS_ORIGIN: "https://tiketi.gg"

  # Database Hosts (RDS Endpoints)
  USERS_DB_HOST: "<RDS_ENDPOINT>"
  EVENTS_DB_HOST: "<RDS_ENDPOINT>"
  RESERVATIONS_DB_HOST: "<RDS_ENDPOINT>"
  PAYMENTS_DB_HOST: "<RDS_ENDPOINT>"
  ANALYTICS_DB_HOST: "<RDS_ENDPOINT>"
  ADMIN_DB_HOST: "<RDS_ENDPOINT>"

  # Database Names
  USERS_DB_NAME: "users_db"
  EVENTS_DB_NAME: "events_db"
  RESERVATIONS_DB_NAME: "reservations_db"
  PAYMENTS_DB_NAME: "payments_db"
  ANALYTICS_DB_NAME: "analytics_db"
  ADMIN_DB_NAME: "admin_db"

  # Redis
  REDIS_HOST: "<ELASTICACHE_ENDPOINT>"
  REDIS_PORT: "6379"

  # AWS S3
  S3_BUCKET: "tiketi-media-prod"
  S3_REGION: "ap-northeast-2"

  # Service URLs (Internal)
  USER_SERVICE_URL: "http://user-service.tiketi-production.svc.cluster.local"
  EVENT_SERVICE_URL: "http://event-service.tiketi-production.svc.cluster.local"
  RESERVATION_SERVICE_URL: "http://reservation-service.tiketi-production.svc.cluster.local"
  PAYMENT_SERVICE_URL: "http://payment-service.tiketi-production.svc.cluster.local"
  ANALYTICS_SERVICE_URL: "http://analytics-service.tiketi-production.svc.cluster.local"
EOF
```

**2.6 K8s Secrets 작성**

```bash
# Secrets를 base64 인코딩
cat > k8s/config/secrets.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: tiketi-production
type: Opaque
stringData:
  # Database
  DB_USER: "tiketi_admin"
  DB_PASSWORD: "<YOUR_DB_PASSWORD>"

  # JWT
  JWT_SECRET: "<YOUR_JWT_SECRET>"

  # Redis (if password enabled)
  REDIS_PASSWORD: ""

  # Toss Payments
  TOSS_SECRET_KEY: "<YOUR_TOSS_SECRET_KEY>"
  TOSS_CLIENT_KEY: "<YOUR_TOSS_CLIENT_KEY>"

  # Google OAuth
  GOOGLE_CLIENT_ID: "<YOUR_GOOGLE_CLIENT_ID>"
  GOOGLE_CLIENT_SECRET: "<YOUR_GOOGLE_CLIENT_SECRET>"

  # AWS Credentials
  AWS_ACCESS_KEY_ID: "<YOUR_AWS_ACCESS_KEY>"
  AWS_SECRET_ACCESS_KEY: "<YOUR_AWS_SECRET_KEY>"
EOF

# 적용
kubectl apply -f k8s/config/configmap.yaml
kubectl apply -f k8s/config/secrets.yaml
```

---

## 🔧 Phase 2: 코어 서비스 분리 (Week 3-5)

### Week 3: User Service & Event Service

#### User Service 분리

**Step 1: 서비스 디렉토리 생성**

```bash
mkdir -p services/user-service
cd services/user-service

# 프로젝트 초기화
npm init -y

# 의존성 설치
npm install express cors dotenv pg bcrypt jsonwebtoken express-validator passport passport-google-oauth20 winston prom-client
npm install --save-dev nodemon
```

**Step 2: 코드 복사 및 수정**

```bash
# 기본 구조 생성
mkdir -p src/{routes,config,middleware,utils}

# 기존 코드에서 필요한 파일 복사
cp ../../backend/src/routes/auth.js src/routes/
cp ../../backend/src/config/database.js src/config/
cp ../../backend/src/middleware/auth.js src/middleware/
cp ../../backend/src/utils/logger.js src/utils/
cp ../../backend/src/utils/custom-error.js src/utils/
cp ../../backend/src/shared/constants.js src/shared/
```

**Step 3: User Service 메인 파일 작성**

```javascript
// services/user-service/src/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const passport = require('passport');
const { logger } = require('./utils/logger');
const authRoutes = require('./routes/auth');
const errorHandler = require('./middleware/error-handler');
require('./config/passport'); // Google OAuth 설정

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Routes
app.use('/api/users', authRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'user-service' });
});

app.get('/ready', (req, res) => {
  // DB 연결 확인
  res.json({ status: 'READY' });
});

// Prometheus metrics
app.get('/metrics', async (req, res) => {
  const { register } = require('./metrics');
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`🚀 User Service running on port ${PORT}`);
});
```

**Step 4: Google OAuth 설정**

```javascript
// services/user-service/src/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./database');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/users/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // 기존 사용자 확인
    let userResult = await db.query(`
      SELECT u.* FROM users u
      JOIN oauth_providers op ON u.id = op.user_id
      WHERE op.provider = 'google' AND op.provider_user_id = $1
    `, [profile.id]);

    let user;

    if (userResult.rows.length === 0) {
      // 신규 사용자 생성
      const newUser = await db.query(`
        INSERT INTO users (email, name, email_verified, profile_image)
        VALUES ($1, $2, true, $3)
        RETURNING *
      `, [
        profile.emails[0].value,
        profile.displayName,
        profile.photos[0]?.value
      ]);

      user = newUser.rows[0];

      // OAuth 연결 정보 저장
      await db.query(`
        INSERT INTO oauth_providers (user_id, provider, provider_user_id, access_token)
        VALUES ($1, 'google', $2, $3)
      `, [user.id, profile.id, accessToken]);
    } else {
      user = userResult.rows[0];

      // 토큰 업데이트
      await db.query(`
        UPDATE oauth_providers
        SET access_token = $1, updated_at = NOW()
        WHERE user_id = $2 AND provider = 'google'
      `, [accessToken, user.id]);
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));
```

**Step 5: 라우트 업데이트 (Google Login 추가)**

```javascript
// services/user-service/src/routes/auth.js
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();

// 기존 /register, /login 라우트는 그대로 유지...

// Google Login
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// Google Callback
router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    // JWT 토큰 발급
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 프론트엔드로 리다이렉트
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

module.exports = router;
```

**Step 6: Dockerfile 작성**

```dockerfile
# services/user-service/Dockerfile
FROM node:20-alpine

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 복사
COPY src ./src

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

EXPOSE 3001

CMD ["node", "src/server.js"]
```

**Step 7: K8s 매니페스트 작성**

```yaml
# services/user-service/k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: tiketi-production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
        version: v1
    spec:
      containers:
      - name: user-service
        image: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/user-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: PORT
          value: "3001"
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: USERS_DB_HOST
        - name: DB_NAME
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: USERS_DB_NAME
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_USER
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: JWT_SECRET
        - name: GOOGLE_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: GOOGLE_CLIENT_ID
        - name: GOOGLE_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: GOOGLE_CLIENT_SECRET
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: tiketi-production
spec:
  selector:
    app: user-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service-hpa
  namespace: tiketi-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**Step 8: 빌드 및 배포**

```bash
# ECR에 푸시
aws ecr create-repository --repository-name user-service

# Docker 이미지 빌드
docker build -t user-service:latest .

# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com

# 태그 및 푸시
docker tag user-service:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/user-service:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/user-service:latest

# K8s 배포
kubectl apply -f k8s/deployment.yaml

# 확인
kubectl get pods -n tiketi-production -l app=user-service
kubectl logs -n tiketi-production <POD_NAME>
```

#### Event Service 분리

**동일한 패턴으로 진행**:
1. `services/event-service` 디렉토리 생성
2. `backend/src/routes/events.js` 복사
3. DB 연결을 `events_db`로 변경
4. Dockerfile 작성
5. K8s 매니페스트 작성
6. 빌드 및 배포

### Week 4: Reservation Service & Payment Service

#### Reservation Service 분리

**특별 고려사항**:
- Redis 분산 락 사용
- Event Service와 통신 필요
- 트랜잭션 관리

**서비스 간 통신 구현**:

```javascript
// services/reservation-service/src/clients/event-client.js
const axios = require('axios');

class EventClient {
  constructor() {
    this.baseURL = process.env.EVENT_SERVICE_URL || 'http://event-service';
  }

  async getEvent(eventId) {
    const response = await axios.get(`${this.baseURL}/api/events/${eventId}`);
    return response.data;
  }

  async getAvailableSeats(eventId) {
    const response = await axios.get(`${this.baseURL}/api/seats/event/${eventId}`);
    return response.data;
  }
}

module.exports = new EventClient();
```

#### Payment Service 분리 (Toss Payments 통합)

**Step 1: Payment Service 생성**

```bash
mkdir -p services/payment-service/src/{routes,config,services}
cd services/payment-service

npm init -y
npm install express dotenv pg @tosspayments/payment-sdk-node axios winston
```

**Step 2: Toss Payments 통합**

```javascript
// services/payment-service/src/services/toss-client.js
const axios = require('axios');

class TossPaymentsClient {
  constructor() {
    this.secretKey = process.env.TOSS_SECRET_KEY;
    this.clientKey = process.env.TOSS_CLIENT_KEY;
    this.baseURL = 'https://api.tosspayments.com/v1';
  }

  // 결제 승인
  async confirmPayment({ paymentKey, orderId, amount }) {
    const response = await axios.post(
      `${this.baseURL}/payments/confirm`,
      { paymentKey, orderId, amount },
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }

  // 결제 취소 (환불)
  async cancelPayment({ paymentKey, cancelReason }) {
    const response = await axios.post(
      `${this.baseURL}/payments/${paymentKey}/cancel`,
      { cancelReason },
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }
}

module.exports = new TossPaymentsClient();
```

**Step 3: Payment Routes**

```javascript
// services/payment-service/src/routes/payments.js
const express = require('express');
const db = require('../config/database');
const tossClient = require('../services/toss-client');
const router = express.Router();

// 결제 요청
router.post('/toss/request', async (req, res, next) => {
  try {
    const { reservationId, amount, customerName, customerEmail } = req.body;

    // 결제 요청 저장
    const result = await db.query(`
      INSERT INTO payments (reservation_id, amount, status, provider, order_id)
      VALUES ($1, $2, 'PENDING', 'TOSS', $3)
      RETURNING *
    `, [reservationId, amount, `ORDER_${Date.now()}_${reservationId}`]);

    const payment = result.rows[0];

    // Toss 결제 URL 생성
    const paymentUrl = `https://pay.toss.im/web?
      amount=${amount}
      &orderId=${payment.order_id}
      &orderName=티켓예매
      &customerName=${customerName}
      &customerEmail=${customerEmail}
      &successUrl=${process.env.PAYMENT_SUCCESS_URL}
      &failUrl=${process.env.PAYMENT_FAIL_URL}
      &clientKey=${tossClient.clientKey}
    `.replace(/\s/g, '');

    res.json({
      paymentId: payment.id,
      paymentUrl,
      orderId: payment.order_id
    });
  } catch (error) {
    next(error);
  }
});

// 결제 승인
router.post('/toss/confirm', async (req, res, next) => {
  try {
    const { paymentKey, orderId, amount } = req.body;

    // Toss API 호출
    const result = await tossClient.confirmPayment({
      paymentKey,
      orderId,
      amount
    });

    // 결제 상태 업데이트
    await db.query(`
      UPDATE payments
      SET status = 'COMPLETED',
          payment_key = $1,
          approved_at = NOW()
      WHERE order_id = $2
    `, [paymentKey, orderId]);

    // Reservation Service에 알림 (메시지 큐 or 직접 호출)
    // TODO: RabbitMQ publish

    res.json({
      success: true,
      paymentKey,
      approvedAt: result.approvedAt
    });
  } catch (error) {
    // 실패 시 결제 상태 업데이트
    await db.query(`
      UPDATE payments
      SET status = 'FAILED',
          error_message = $1
      WHERE order_id = $2
    `, [error.message, orderId]);

    next(error);
  }
});

// Webhook (환불 등)
router.post('/toss/webhook', async (req, res) => {
  const { eventType, data } = req.body;

  if (eventType === 'PAYMENT_CANCELED') {
    // 환불 처리
    await db.query(`
      UPDATE payments
      SET status = 'CANCELLED'
      WHERE payment_key = $1
    `, [data.paymentKey]);
  }

  res.json({ received: true });
});

module.exports = router;
```

### Week 5: Queue Service, Media Service, Analytics Service

#### Queue Service (Socket.IO)

**특징**: Stateful 서비스 - Sticky Session 필요

```yaml
# services/queue-service/k8s/deployment.yaml
apiVersion: v1
kind: Service
metadata:
  name: queue-service
  namespace: tiketi-production
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
spec:
  selector:
    app: queue-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: LoadBalancer
  sessionAffinity: ClientIP  # Sticky Session
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800  # 3 hours
```

#### Analytics Service (신규 개발)

**Step 1: Analytics Service 생성**

```bash
mkdir -p services/analytics-service/src/{routes,services,cron}
cd services/analytics-service
npm init -y
npm install express dotenv pg redis axios winston node-cron
```

**Step 2: 이벤트 수집 API**

```javascript
// services/analytics-service/src/routes/analytics.js
const express = require('express');
const db = require('../config/database');
const redis = require('../config/redis');
const router = express.Router();

// 이벤트 트래킹
router.post('/track', async (req, res) => {
  try {
    const { eventType, artistId, eventId, metadata } = req.body;

    // 이벤트 저장
    await db.query(`
      INSERT INTO analytics_events (event_type, aggregate_id, data)
      VALUES ($1, $2, $3)
    `, [eventType, artistId, JSON.stringify({ eventId, ...metadata })]);

    // Redis 실시간 카운터 증가
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    await redis.incr(`artist:${artistId}:views:${today}`);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 가수별 트래픽 조회
router.get('/artist/:artistId/traffic', async (req, res) => {
  try {
    const { artistId } = req.params;
    const { startDate, endDate } = req.query;

    const result = await db.query(`
      SELECT
        date,
        page_views,
        unique_visitors,
        avg_session_duration
      FROM artist_traffic
      WHERE artist_id = $1
        AND date BETWEEN $2 AND $3
      ORDER BY date ASC
    `, [artistId, startDate, endDate]);

    res.json({
      artistId,
      traffic: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 매출 통계 조회
router.get('/revenue/stats', async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    const result = await db.query(`
      SELECT
        period_start,
        total_revenue,
        tickets_sold,
        avg_ticket_price
      FROM revenue_stats
      WHERE period_type = $1
      ORDER BY period_start DESC
      LIMIT 12
    `, [period]);

    res.json({
      period,
      data: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

**Step 3: 주기적 집계 Cron Job**

```javascript
// services/analytics-service/src/cron/aggregator.js
const cron = require('node-cron');
const db = require('../config/database');
const redis = require('../config/redis');
const { logger } = require('../utils/logger');

// 매 시간 집계
cron.schedule('0 * * * *', async () => {
  try {
    logger.info('🔄 Starting hourly aggregation...');

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Redis에서 모든 카운터 가져오기
    const keys = await redis.keys('artist:*:views:*');

    for (const key of keys) {
      const match = key.match(/artist:(.+):views:(\d+)/);
      if (!match) continue;

      const [_, artistId, dateStr] = match;
      const views = await redis.get(key);

      // DB에 저장
      await db.query(`
        INSERT INTO artist_traffic (artist_id, date, page_views)
        VALUES ($1, $2, $3)
        ON CONFLICT (artist_id, date)
        DO UPDATE SET page_views = artist_traffic.page_views + EXCLUDED.page_views
      `, [artistId, dateStr, parseInt(views)]);

      // 어제 데이터는 Redis에서 삭제
      if (dateStr < today.replace(/-/g, '')) {
        await redis.del(key);
      }
    }

    logger.info('✅ Hourly aggregation completed');
  } catch (error) {
    logger.error('❌ Hourly aggregation failed:', error);
  }
});

module.exports = { start: () => logger.info('📊 Analytics aggregator started') };
```

---

## 🌟 Phase 3: 신규 기능 및 통합 (Week 6-7)

### Week 6: 통합 테스트 및 API Gateway 설정

#### Ingress 설정 (API Gateway)

```yaml
# k8s/ingress/api-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-api-ingress
  namespace: tiketi-production
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - api.tiketi.gg
    secretName: tiketi-api-tls
  rules:
  - host: api.tiketi.gg
    http:
      paths:
      # User Service
      - path: /api/users
        pathType: Prefix
        backend:
          service:
            name: user-service
            port:
              number: 80

      # Event Service
      - path: /api/events
        pathType: Prefix
        backend:
          service:
            name: event-service
            port:
              number: 80

      # Reservation Service
      - path: /api/reservations
        pathType: Prefix
        backend:
          service:
            name: reservation-service
            port:
              number: 80

      - path: /api/seats
        pathType: Prefix
        backend:
          service:
            name: reservation-service
            port:
              number: 80

      # Payment Service
      - path: /api/payments
        pathType: Prefix
        backend:
          service:
            name: payment-service
            port:
              number: 80

      # Analytics Service
      - path: /api/analytics
        pathType: Prefix
        backend:
          service:
            name: analytics-service
            port:
              number: 80

      # Admin Service
      - path: /api/admin
        pathType: Prefix
        backend:
          service:
            name: admin-service
            port:
              number: 80

      # Media Service
      - path: /api/media
        pathType: Prefix
        backend:
          service:
            name: media-service
            port:
              number: 80
```

### Week 7: CI/CD 파이프라인

#### GitHub Actions Workflow

```yaml
# .github/workflows/deploy-user-service.yml
name: Deploy User Service

on:
  push:
    branches: [main]
    paths:
      - 'services/user-service/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

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
          ECR_REPOSITORY: user-service
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd services/user-service
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --region ap-northeast-2 --name tiketi-prod

      - name: Deploy to EKS
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          kubectl set image deployment/user-service \
            user-service=$ECR_REGISTRY/user-service:$IMAGE_TAG \
            -n tiketi-production

          kubectl rollout status deployment/user-service -n tiketi-production
```

---

## 📊 Phase 4: 모니터링 및 최적화 (Week 8-10)

### Week 8: 모니터링 스택 설치

#### Prometheus & Grafana

```bash
# Prometheus 설치
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace tiketi-monitoring \
  --create-namespace

# Grafana 접속
kubectl port-forward -n tiketi-monitoring svc/prometheus-grafana 3000:80

# 로그인: admin / prom-operator
```

### Week 9-10: 프로덕션 배포

#### Blue/Green 배포 전략

```bash
# Green 환경 배포 (새 버전)
kubectl apply -f k8s/production/green/

# 트래픽 확인
kubectl get ingress -n tiketi-production

# 테스트 후 트래픽 전환
kubectl patch ingress tiketi-api-ingress -n tiketi-production \
  --type='json' -p='[{"op": "replace", "path": "/spec/rules/0/http/paths/0/backend/service/name", "value":"user-service-green"}]'

# 확인 후 Blue 환경 제거
kubectl delete -f k8s/production/blue/
```

---

## ✅ 최종 체크리스트

### 인프라
- [ ] EKS 클러스터 생성
- [ ] VPC 및 Subnet 구성
- [ ] RDS PostgreSQL 생성
- [ ] ElastiCache Redis 생성
- [ ] S3 Bucket 생성
- [ ] Ingress Controller 설치
- [ ] Cert-Manager 설치

### 서비스 개발
- [ ] User Service (+ Google OAuth)
- [ ] Event Service
- [ ] Reservation Service
- [ ] Payment Service (+ Toss Payments)
- [ ] Queue Service
- [ ] Analytics Service (신규)
- [ ] Admin Service
- [ ] Media Service

### 데이터베이스
- [ ] 서비스별 DB 스키마 작성
- [ ] 데이터 마이그레이션
- [ ] Foreign Key 제거 (서비스 간 독립성)
- [ ] 인덱스 최적화

### CI/CD
- [ ] GitHub Actions 워크플로우
- [ ] ECR Repository 생성
- [ ] K8s 매니페스트 작성
- [ ] Secrets 관리

### 테스트
- [ ] Unit Test
- [ ] Integration Test
- [ ] E2E Test
- [ ] Load Test (k6)

### 배포
- [ ] Staging 환경 배포
- [ ] 성능 테스트
- [ ] Production 배포 (Blue/Green)
- [ ] 모니터링 설정

---

**작성일**: 2025-12-05
**작성자**: Claude
**버전**: 1.0
