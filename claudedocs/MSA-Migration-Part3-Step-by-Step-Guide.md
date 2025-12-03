# MSA 마이그레이션 가이드 Part 3: 단계별 실행 가이드

> **작성일:** 2025-12-03
> **전제 조건:** Part 1 (서비스 도메인 설계), Part 2 (AWS 아키텍처) 완료
> **목적:** 실제 마이그레이션 실행 로드맵

---

## 목차
1. [마이그레이션 전체 로드맵](#마이그레이션-전체-로드맵)
2. [Phase 0: 사전 준비 (1-2주)](#phase-0-사전-준비)
3. [Phase 1: 인프라 구축 (2-3주)](#phase-1-인프라-구축)
4. [Phase 2: Auth Service 분리 (1주)](#phase-2-auth-service-분리)
5. [Phase 3: Event Service 분리 (1-2주)](#phase-3-event-service-분리)
6. [Phase 4: Queue Service 분리 (2주)](#phase-4-queue-service-분리)
7. [Phase 5: Reservation Service 분리 (3-4주)](#phase-5-reservation-service-분리)
8. [Phase 6: Payment Service 분리 (2주)](#phase-6-payment-service-분리)
9. [Phase 7: 모놀리스 완전 제거 (1주)](#phase-7-모놀리스-완전-제거)
10. [Phase 8: 최적화 및 확장 (지속)](#phase-8-최적화-및-확장)

---

## 1. 마이그레이션 전체 로드맵

### 1.1 타임라인 (총 12-15주, 3-4개월)

```
┌─────────────────────────────────────────────────────────────────┐
│                     마이그레이션 타임라인                        │
└─────────────────────────────────────────────────────────────────┘

Week 1-2:  Phase 0 - 사전 준비
├─ AWS 계정 설정
├─ VPC, 서브넷 설계
├─ CI/CD 파이프라인
└─ 모니터링 구축

Week 3-5:  Phase 1 - 인프라 구축
├─ RDS Aurora 마이그레이션
├─ ElastiCache Redis 설정
├─ ALB 구성
└─ ECS Fargate 클러스터

Week 6:    Phase 2 - Auth Service 분리
├─ JWT 검증 독립화
├─ User DB 분리
└─ API Gateway 통합

Week 7-8:  Phase 3 - Event Service 분리
├─ 이벤트 DB 분리
├─ CloudFront CDN 연동
└─ 읽기 최적화

Week 9-10: Phase 4 - Queue Service 분리
├─ Redis Cluster 전용화
├─ WebSocket 독립
└─ 대기열 알고리즘 개선

Week 11-14: Phase 5 - Reservation Service 분리 🔥
├─ 예매 DB 분리
├─ Saga Pattern 구현
├─ 이벤트 기반 통신
└─ 부하 테스트

Week 15:   Phase 6 - Payment Service 분리
├─ 결제 DB 분리
├─ Circuit Breaker
└─ Idempotency 보장

Week 16:   Phase 7 - 모놀리스 제거
├─ 트래픽 100% 전환
├─ 모놀리스 서버 종료
└─ DNS 완전 전환

Week 17+:  Phase 8 - 최적화
├─ Auto Scaling 튜닝
├─ 비용 최적화
├─ 성능 모니터링
└─ 추가 서비스 (Notification, Analytics)
```

---

### 1.2 Strangler Fig 패턴 (점진적 전환)

```
┌─────────────────────────────────────────────────────────────┐
│              Strangler Fig Pattern 개념                     │
│                                                             │
│  기존 모놀리스를 점진적으로 교체하는 패턴                   │
│  - 새 기능은 마이크로서비스로 개발                          │
│  - 기존 기능은 하나씩 옮김                                  │
│  - 양쪽 시스템이 공존하다가 최종적으로 모놀리스 제거        │
└─────────────────────────────────────────────────────────────┘

Phase 0-1: 모놀리스 100%
┌───────────────────────────┐
│      Monolith             │
│  ┌─────────────────────┐  │
│  │ All Routes          │  │
│  │ - Auth              │  │
│  │ - Event             │  │
│  │ - Queue             │  │
│  │ - Reservation       │  │
│  │ - Payment           │  │
│  └─────────────────────┘  │
└───────────────────────────┘

Phase 2: Auth 분리 (20%)
┌──────────────┐  ┌─────────────────┐
│Auth Service  │  │  Monolith       │
│    20%       │  │  ┌───────────┐  │
└──────────────┘  │  │ Event     │  │
                  │  │ Queue     │  │
                  │  │ Reserv    │  │
                  │  │ Payment   │  │
                  │  └───────────┘  │
                  └─────────────────┘

Phase 3: Event 분리 (40%)
┌──────────────┐  ┌──────────────┐  ┌─────────────┐
│Auth Service  │  │Event Service │  │ Monolith    │
│    20%       │  │    20%       │  │ ┌─────────┐ │
└──────────────┘  └──────────────┘  │ │ Queue   │ │
                                    │ │ Reserv  │ │
                                    │ │ Payment │ │
                                    │ └─────────┘ │
                                    └─────────────┘

Phase 5: Reservation 분리 (80%)
┌─────┐  ┌─────┐  ┌─────┐  ┌─────────┐  ┌────────┐
│Auth │  │Event│  │Queue│  │Reserv   │  │Monolith│
│ 20% │  │ 20% │  │ 20% │  │  20%    │  │ ┌────┐ │
└─────┘  └─────┘  └─────┘  └─────────┘  │ │Pay │ │
                                         │ └────┘ │
                                         └────────┘

Phase 7: 완전 마이그레이션 (100%)
┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
│Auth │  │Event│  │Queue│  │Reserv│  │Pay  │
│ 20% │  │ 20% │  │ 20% │  │ 20% │  │ 20% │
└─────┘  └─────┘  └─────┘  └─────┘  └─────┘

모놀리스 제거 완료! ✅
```

---

## 2. Phase 0: 사전 준비 (1-2주)

### 2.1 AWS 계정 및 환경 설정

#### **Step 1: AWS Organization 구성**

```bash
# AWS Organizations 구조
Root
├─ Production Account (프로덕션)
├─ Staging Account (스테이징)
└─ Development Account (개발)

왜 분리하는가?
✅ 환경 격리 (개발 실수로 프로덕션 영향 X)
✅ 비용 추적 명확
✅ IAM 권한 최소화
✅ Compliance (보안 감사)

설정:
1. AWS Console → Organizations → Create organization
2. Invite accounts (production, staging, dev)
3. Service Control Policies (SCP) 적용
   - Production: 삭제 방지 정책
   - Development: 리소스 제한 (비용 절감)
```

#### **Step 2: VPC 설계**

```
┌─────────────────────────────────────────────────────────────┐
│                  VPC: 10.0.0.0/16                           │
│                  tiketi-prod-vpc                            │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Public Subnets (ALB, NAT Gateway)                      ││
│  │                                                         ││
│  │ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ ││
│  │ │ us-east-1a   │  │ us-east-1b   │  │ us-east-1c   │ ││
│  │ │ 10.0.1.0/24  │  │ 10.0.2.0/24  │  │ 10.0.3.0/24  │ ││
│  │ │ ALB, NAT-1   │  │ ALB, NAT-2   │  │ ALB, NAT-3   │ ││
│  │ └──────────────┘  └──────────────┘  └──────────────┘ ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Private Subnets - App (ECS Tasks)                      ││
│  │                                                         ││
│  │ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ ││
│  │ │ us-east-1a   │  │ us-east-1b   │  │ us-east-1c   │ ││
│  │ │ 10.0.11.0/24 │  │ 10.0.12.0/24 │  │ 10.0.13.0/24 │ ││
│  │ │ ECS Tasks    │  │ ECS Tasks    │  │ ECS Tasks    │ ││
│  │ └──────────────┘  └──────────────┘  └──────────────┘ ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Private Subnets - Data (RDS, ElastiCache)              ││
│  │                                                         ││
│  │ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ ││
│  │ │ us-east-1a   │  │ us-east-1b   │  │ us-east-1c   │ ││
│  │ │ 10.0.21.0/24 │  │ 10.0.22.0/24 │  │ 10.0.23.0/24 │ ││
│  │ │ RDS, Redis   │  │ RDS, Redis   │  │ RDS, Redis   │ ││
│  │ └──────────────┘  └──────────────┘  └──────────────┘ ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
│  Internet Gateway → Public Subnets                         │
│  NAT Gateway (Public) → Private Subnets → Internet        │
└─────────────────────────────────────────────────────────────┘

Terraform 코드:
```

```hcl
# vpc.tf
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "tiketi-prod-vpc"
    Environment = "production"
  }
}

# Public Subnets
resource "aws_subnet" "public" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "tiketi-public-${count.index + 1}"
    Type = "Public"
  }
}

# Private Subnets - App
resource "aws_subnet" "private_app" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 11}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "tiketi-private-app-${count.index + 1}"
    Type = "Private-App"
  }
}

# Private Subnets - Data
resource "aws_subnet" "private_data" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 21}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "tiketi-private-data-${count.index + 1}"
    Type = "Private-Data"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "tiketi-igw"
  }
}

# NAT Gateway (각 AZ마다)
resource "aws_eip" "nat" {
  count  = 3
  domain = "vpc"

  tags = {
    Name = "tiketi-nat-eip-${count.index + 1}"
  }
}

resource "aws_nat_gateway" "main" {
  count         = 3
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "tiketi-nat-${count.index + 1}"
  }
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "tiketi-public-rt"
  }
}

resource "aws_route_table" "private_app" {
  count  = 3
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name = "tiketi-private-app-rt-${count.index + 1}"
  }
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count          = 3
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_app" {
  count          = 3
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app[count.index].id
}
```

---

#### **Step 3: Security Groups 설계**

```hcl
# security-groups.tf

# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "tiketi-alb-sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.main.id

  # HTTPS from Internet
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP (redirect to HTTPS)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "tiketi-alb-sg"
  }
}

# ECS Tasks Security Group
resource "aws_security_group" "ecs_tasks" {
  name        = "tiketi-ecs-tasks-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  # Allow from ALB only
  ingress {
    from_port       = 3010  # Auth Service
    to_port         = 3014  # Payment Service
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Allow inter-service communication
  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "tiketi-ecs-tasks-sg"
  }
}

# RDS Security Group
resource "aws_security_group" "rds" {
  name        = "tiketi-rds-sg"
  description = "Security group for RDS Aurora"
  vpc_id      = aws_vpc.main.id

  # Allow from ECS tasks only
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  # Bastion host (optional, for debugging)
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion.id]
  }

  tags = {
    Name = "tiketi-rds-sg"
  }
}

# ElastiCache Security Group
resource "aws_security_group" "redis" {
  name        = "tiketi-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  tags = {
    Name = "tiketi-redis-sg"
  }
}
```

---

### 2.2 CI/CD 파이프라인 구축

#### **GitHub Actions 워크플로우**

```yaml
# .github/workflows/deploy-event-service.yml
name: Deploy Event Service

on:
  push:
    branches: [main]
    paths:
      - 'services/event-service/**'
      - '.github/workflows/deploy-event-service.yml'

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: tiketi/event-service
  ECS_CLUSTER: tiketi-prod
  ECS_SERVICE: event-service
  CONTAINER_NAME: event-service

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: ./services/event-service
        run: npm ci

      - name: Run tests
        working-directory: ./services/event-service
        run: npm test

      - name: Run linting
        working-directory: ./services/event-service
        run: npm run lint

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build, tag, and push image to Amazon ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        working-directory: ./services/event-service
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Fill in the new image ID in the Amazon ECS task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: ./services/event-service/task-definition.json
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.build-image.outputs.image }}

      - name: Deploy Amazon ECS task definition
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: |
            Event Service 배포: ${{ job.status }}
            Commit: ${{ github.sha }}
            Image: ${{ steps.build-image.outputs.image }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

### 2.3 모니터링 구축

#### **CloudWatch Dashboards**

```javascript
// cloudwatch-dashboard.js - AWS SDK로 생성
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch({ region: 'us-east-1' });

const dashboard = {
  DashboardName: 'Tiketi-Production',
  DashboardBody: JSON.stringify({
    widgets: [
      {
        type: 'metric',
        properties: {
          metrics: [
            ['AWS/ApplicationELB', 'TargetResponseTime', { stat: 'Average' }],
            ['...', { stat: 'p99' }]
          ],
          period: 300,
          stat: 'Average',
          region: 'us-east-1',
          title: 'ALB Response Time',
          yAxis: {
            left: {
              min: 0,
              max: 5000
            }
          }
        }
      },
      {
        type: 'metric',
        properties: {
          metrics: [
            ['AWS/ECS', 'CPUUtilization', { serviceName: 'event-service' }],
            ['...', { serviceName: 'queue-service' }],
            ['...', { serviceName: 'reservation-service' }]
          ],
          period: 60,
          stat: 'Average',
          region: 'us-east-1',
          title: 'ECS Service CPU',
          yAxis: {
            left: {
              min: 0,
              max: 100
            }
          }
        }
      },
      {
        type: 'metric',
        properties: {
          metrics: [
            ['AWS/RDS', 'DatabaseConnections', { DBClusterIdentifier: 'tiketi-prod-cluster' }],
            ['...', 'CPUUtilization']
          ],
          period: 300,
          stat: 'Average',
          region: 'us-east-1',
          title: 'RDS Aurora Metrics'
        }
      },
      {
        type: 'metric',
        properties: {
          metrics: [
            ['AWS/ElastiCache', 'CPUUtilization', { CacheClusterId: 'tiketi-prod-redis-001' }],
            ['...', 'NetworkBytesIn'],
            ['...', 'NetworkBytesOut']
          ],
          period: 60,
          stat: 'Average',
          region: 'us-east-1',
          title: 'Redis Metrics'
        }
      },
      {
        type: 'log',
        properties: {
          query: `
            SOURCE '/ecs/reservation-service'
            | fields @timestamp, @message
            | filter @message like /ERROR/
            | stats count() by bin(5m)
          `,
          region: 'us-east-1',
          title: 'Error Logs (Last 1 hour)'
        }
      }
    ]
  })
};

cloudwatch.putDashboard(dashboard, (err, data) => {
  if (err) console.error(err);
  else console.log('Dashboard created:', data);
});
```

---

## 3. Phase 1: 인프라 구축 (2-3주)

### 3.1 RDS Aurora 마이그레이션

#### **Step 1: 현재 PostgreSQL 데이터 백업**

```bash
# 로컬 Docker PostgreSQL 데이터 덤프
docker exec -t postgres-container pg_dump -U postgres -d tiketi > tiketi_backup.sql

# 압축
gzip tiketi_backup.sql

# S3 업로드
aws s3 cp tiketi_backup.sql.gz s3://tiketi-migrations/postgres-backup-$(date +%Y%m%d).sql.gz

# 백업 검증
aws s3 ls s3://tiketi-migrations/
```

---

#### **Step 2: Aurora Cluster 생성**

```bash
# Terraform으로 생성
terraform apply -target=aws_rds_cluster.main

# 또는 AWS CLI
aws rds create-db-cluster \
  --db-cluster-identifier tiketi-prod-cluster \
  --engine aurora-postgresql \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password $(aws secretsmanager get-secret-value --secret-id prod/db-password --query SecretString --output text) \
  --database-name tiketi \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name tiketi-db-subnet \
  --backup-retention-period 7 \
  --preferred-backup-window 03:00-04:00 \
  --preferred-maintenance-window sun:04:00-sun:05:00 \
  --enable-cloudwatch-logs-exports postgresql \
  --deletion-protection

# Writer Instance 생성
aws rds create-db-instance \
  --db-instance-identifier tiketi-prod-writer \
  --db-instance-class db.r6g.2xlarge \
  --engine aurora-postgresql \
  --db-cluster-identifier tiketi-prod-cluster

# Read Replica 생성
aws rds create-db-instance \
  --db-instance-identifier tiketi-prod-reader-1 \
  --db-instance-class db.r6g.xlarge \
  --engine aurora-postgresql \
  --db-cluster-identifier tiketi-prod-cluster \
  --promotion-tier 1
```

---

#### **Step 3: 데이터 마이그레이션**

```bash
# 백업 다운로드
aws s3 cp s3://tiketi-migrations/postgres-backup-20251203.sql.gz .
gunzip tiketi_backup.sql.gz

# Aurora로 복원
psql -h tiketi-prod-cluster.cluster-xxx.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d tiketi \
     -f tiketi_backup.sql

# 데이터 검증
psql -h tiketi-prod-cluster.cluster-xxx.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d tiketi \
     -c "SELECT COUNT(*) FROM users;"
# 예상: 1000 rows

psql -h ... -c "SELECT COUNT(*) FROM events;"
# 예상: 50 rows

psql -h ... -c "SELECT COUNT(*) FROM reservations;"
# 예상: 500 rows

# 테이블 크기 확인
psql -h ... -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

---

#### **Step 4: Connection Pool 설정 (Application 쪽)**

```javascript
// services/common/database.js
const { Pool } = require('pg');

// Writer Pool (쓰기 전용)
const writerPool = new Pool({
  host: process.env.DB_WRITER_HOST,  // tiketi-prod-cluster.cluster-xxx
  port: 5432,
  database: 'tiketi',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 200,  // 최대 연결 수
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('./rds-ca-2019-root.pem')  # RDS SSL 인증서
  }
});

// Reader Pool (읽기 전용)
const readerPool = new Pool({
  host: process.env.DB_READER_HOST,  // tiketi-prod-cluster.cluster-ro-xxx
  port: 5432,
  database: 'tiketi',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 100,  // 읽기는 더 적은 커넥션
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 5000,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('./rds-ca-2019-root.pem')
  }
});

// Helper Functions
async function queryWriter(text, params) {
  const start = Date.now();
  const client = await writerPool.connect();
  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    // Prometheus Metric
    dbQueryDuration.labels('write').observe(duration);

    return result;
  } finally {
    client.release();
  }
}

async function queryReader(text, params) {
  const start = Date.now();
  const client = await readerPool.connect();
  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    dbQueryDuration.labels('read').observe(duration);

    return result;
  } finally {
    client.release();
  }
}

module.exports = {
  queryWriter,
  queryReader,
  writerPool,
  readerPool
};
```

---

### 3.2 ElastiCache Redis 설정

#### **Step 1: Redis Cluster 생성**

```bash
# Cluster Mode Enabled (권장)
aws elasticache create-replication-group \
  --replication-group-id tiketi-prod-redis \
  --replication-group-description "Production Redis Cluster" \
  --engine redis \
  --engine-version 7.0 \
  --cache-node-type cache.r6g.xlarge \
  --num-node-groups 6 \
  --replicas-per-node-group 1 \
  --cache-parameter-group-name default.redis7.cluster.on \
  --cache-subnet-group-name tiketi-cache-subnet \
  --security-group-ids sg-redis \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token $(aws secretsmanager get-secret-value --secret-id prod/redis-auth --query SecretString --output text) \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --snapshot-retention-limit 7 \
  --snapshot-window "03:00-05:00" \
  --preferred-maintenance-window "sun:05:00-sun:07:00" \
  --notification-topic-arn arn:aws:sns:us-east-1:123456789012:redis-alerts \
  --log-delivery-configurations \
    'LogType=slow-log,DestinationType=cloudwatch-logs,DestinationDetails={CloudWatchLogsDetails={LogGroup=/aws/elasticache/tiketi-prod-redis}},LogFormat=json'

# 생성 완료 대기 (10-15분 소요)
aws elasticache describe-replication-groups \
  --replication-group-id tiketi-prod-redis \
  --query 'ReplicationGroups[0].Status'
# 출력: "available"
```

---

#### **Step 2: 기존 DragonflyDB 데이터 마이그레이션**

```bash
# 현재 DragonflyDB 데이터 백업 (RDB 형식)
docker exec dragonfly-container redis-cli --rdb /data/backup.rdb

# 호스트로 복사
docker cp dragonfly-container:/data/backup.rdb ./redis_backup.rdb

# S3 업로드
aws s3 cp redis_backup.rdb s3://tiketi-migrations/redis-backup-$(date +%Y%m%d).rdb

# ElastiCache로 복원 (Import)
# 참고: ElastiCache는 직접 RDB import 불가, 수동 이관 필요

# Python 스크립트로 마이그레이션
python3 << 'EOF'
import redis

# Source (DragonflyDB)
source = redis.Redis(host='localhost', port=7379, decode_responses=True)

# Destination (ElastiCache)
from redis.cluster import RedisCluster

dest = RedisCluster(
    startup_nodes=[{
        "host": "tiketi-prod-redis.xxx.clustercfg.use1.cache.amazonaws.com",
        "port": 6379
    }],
    password="your-auth-token",
    ssl=True,
    decode_responses=True
)

# 모든 키 마이그레이션
for key in source.scan_iter("*", count=1000):
    key_type = source.type(key)
    ttl = source.ttl(key)

    if key_type == 'string':
        dest.set(key, source.get(key))
    elif key_type == 'hash':
        dest.hset(key, mapping=source.hgetall(key))
    elif key_type == 'list':
        dest.rpush(key, *source.lrange(key, 0, -1))
    elif key_type == 'set':
        dest.sadd(key, *source.smembers(key))
    elif key_type == 'zset':
        dest.zadd(key, {member: score for member, score in source.zrange(key, 0, -1, withscores=True)})

    if ttl > 0:
        dest.expire(key, ttl)

    print(f"Migrated: {key}")

print("Migration complete!")
EOF
```

---

#### **Step 3: Application Redis 클라이언트 업데이트**

```javascript
// services/common/redis.js
const Redis = require('ioredis');

// ElastiCache Cluster Mode
const redis = new Redis.Cluster(
  [
    {
      host: process.env.REDIS_HOST,  // tiketi-prod-redis.xxx.clustercfg.use1.cache.amazonaws.com
      port: 6379
    }
  ],
  {
    redisOptions: {
      password: process.env.REDIS_AUTH_TOKEN,
      tls: {
        checkServerIdentity: () => undefined,
        ca: fs.readFileSync('./redis-ca-cert.pem')
      },
      connectTimeout: 5000,
      maxRetriesPerRequest: 3
    },
    clusterRetryStrategy: (times) => {
      const delay = Math.min(100 * Math.pow(2, times), 3000);
      return delay;
    },
    enableReadyCheck: true,
    enableOfflineQueue: true,
    scaleReads: 'slave',  // Read from replicas
    slotsRefreshTimeout: 10000
  }
);

// Event Listeners
redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
  // Prometheus Metric
  redisErrors.inc();
});

redis.on('ready', () => {
  console.log('Redis ready');
});

// Distributed Lock Helper
async function acquireLock(key, ttl = 10000) {
  const lockKey = `lock:${key}`;
  const lockValue = `${process.env.POD_NAME || 'local'}-${Date.now()}`;

  const result = await redis.set(lockKey, lockValue, 'PX', ttl, 'NX');

  if (result === 'OK') {
    // Lock acquired
    return {
      acquired: true,
      unlock: async () => {
        // Lua script for safe unlock (check owner)
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await redis.eval(script, 1, lockKey, lockValue);
      }
    };
  }

  return { acquired: false };
}

module.exports = {
  redis,
  acquireLock
};
```

---

### 3.3 ALB 및 ECS Fargate 구성

#### **Step 1: ALB 생성**

```bash
# ALB 생성
aws elbv2 create-load-balancer \
  --name tiketi-prod-alb \
  --type application \
  --scheme internet-facing \
  --ip-address-type ipv4 \
  --subnets subnet-public-1a subnet-public-1b subnet-public-1c \
  --security-groups sg-alb \
  --tags Key=Environment,Value=production

# SSL 인증서 발급 (ACM)
aws acm request-certificate \
  --domain-name tiketi.gg \
  --subject-alternative-names api.tiketi.gg admin.tiketi.gg \
  --validation-method DNS

# DNS 검증 (Route 53에 CNAME 추가)
# ...

# HTTPS Listener 생성
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:...:loadbalancer/app/tiketi-prod-alb/xxx \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/xxx \
  --default-actions Type=fixed-response,FixedResponseConfig='{StatusCode=404,ContentType="text/plain",MessageBody="Not Found"}'

# HTTP → HTTPS Redirect
aws elbv2 create-listener \
  --load-balancer-arn ... \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig='{Protocol="HTTPS",Port="443",StatusCode="HTTP_301"}'
```

---

계속해서 Phase 2-8의 실제 마이그레이션 단계를 작성하겠습니다...