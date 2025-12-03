# MSA 마이그레이션 가이드 Part 2: K3s → EKS 아키텍처 설계

> **작성일:** 2025-12-03
> **현재 환경:** 단일 EC2 + S3
> **목표:** 현재 EC2 → K3s → EKS 점진적 전환
> **목적:** 수십만 동시 접속자 처리 가능한 Kubernetes 기반 MSA

---

## 목차
1. [전체 마이그레이션 경로](#전체-마이그레이션-경로)
2. [왜 K3s를 중간 단계로 사용하는가?](#왜-k3s를-중간-단계로-사용하는가)
3. [Phase 1: 현재 환경 개선 (RDS, ElastiCache)](#phase-1-현재-환경-개선)
4. [Phase 2: K3s 클러스터 구축](#phase-2-k3s-클러스터-구축)
5. [Phase 3: K3s에서 MSA 구현](#phase-3-k3s에서-msa-구현)
6. [Phase 4: EKS 마이그레이션](#phase-4-eks-마이그레이션)
7. [비용 분석](#비용-분석)

---

## 1. 전체 마이그레이션 경로

### 1.1 3단계 전환 전략

```
┌─────────────────────────────────────────────────────────────────┐
│ Stage 0: 현재 환경 (단일 EC2)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              EC2 Instance (t3.large)                     │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ Docker Compose                                     │ │  │
│  │  │                                                    │ │  │
│  │  │  • Node.js Backend (Port 3001)                    │ │  │
│  │  │  • PostgreSQL (Port 5432)                         │ │  │
│  │  │  • DragonflyDB (Port 7379)                        │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ S3 Bucket (tiketi-frontend)                             │  │
│  │  • React SPA (빌드된 정적 파일)                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓ 2-3주
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: AWS 관리형 서비스로 전환                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ EC2 Instance (동일한 코드, 모놀리스 유지)               │  │
│  │  • Node.js Backend (Port 3001)                          │  │
│  └──────────────┬───────────────────┬───────────────────────┘  │
│                 ↓                   ↓                           │
│  ┌────────────────────┐    ┌────────────────────┐              │
│  │ RDS Aurora         │    │ ElastiCache Redis  │              │
│  │ PostgreSQL         │    │ (Cluster Mode)     │              │
│  │ (관리형 DB) ✅    │    │ (관리형 캐시) ✅  │              │
│  └────────────────────┘    └────────────────────┘              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ S3 + CloudFront (CDN) ✅                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│ 목적: DB/캐시 장애 대응, 백업, Auto Scaling 준비              │
└─────────────────────────────────────────────────────────────────┘
                            ↓ 6-8주
┌─────────────────────────────────────────────────────────────────┐
│ Stage 2: K3s 클러스터 (경량 Kubernetes)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ EC2 Instance 1 (t3.xlarge) - K3s Master + Worker        │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ K3s Cluster                                        │ │  │
│  │  │                                                    │ │  │
│  │  │  Pod: Auth Service      (Replica: 2)              │ │  │
│  │  │  Pod: Event Service     (Replica: 2)              │ │  │
│  │  │  Pod: Queue Service     (Replica: 3)              │ │  │
│  │  │  Pod: Reservation Svc   (Replica: 3)              │ │  │
│  │  │  Pod: Payment Service   (Replica: 2)              │ │  │
│  │  │                                                    │ │  │
│  │  │  Ingress: Traefik (K3s 기본 포함)                 │ │  │
│  │  │  Storage: Local Path Provisioner                  │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ EC2 Instance 2 (t3.large) - K3s Worker (선택적)         │  │
│  │  추가 워커 노드 (트래픽 증가 시)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────────────┐    ┌────────────────────┐              │
│  │ RDS Aurora         │    │ ElastiCache Redis  │              │
│  │ (동일)             │    │ (동일)             │              │
│  └────────────────────┘    └────────────────────┘              │
│                                                                 │
│ 목적: Kubernetes 학습, MSA 전환, YAML 재사용 준비              │
└─────────────────────────────────────────────────────────────────┘
                            ↓ 2-3주
┌─────────────────────────────────────────────────────────────────┐
│ Stage 3: EKS (AWS 관리형 Kubernetes) - 최종 목표                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ EKS Control Plane (AWS 관리형)                           │  │
│  │  • Kubernetes Master (고가용성, Multi-AZ)               │  │
│  │  • etcd 자동 백업                                        │  │
│  │  • 자동 패치 및 업그레이드                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                    ↓                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Worker Nodes (Auto Scaling Group)                        │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ Node 1-3 (t3.xlarge, On-Demand)                   │ │  │
│  │  │  • 기본 워크로드                                  │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ Node 4-20 (c6i.xlarge, Spot 70% 할인) 🔥         │ │  │
│  │  │  • Queue Service (피크 대응)                      │ │  │
│  │  │  • Reservation Service (피크 대응)                │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ALB Ingress Controller                                   │  │
│  │  • /api/v1/auth        → Auth Service                   │  │
│  │  • /api/v1/events      → Event Service                  │  │
│  │  • /api/v1/queue       → Queue Service                  │  │
│  │  • /api/v1/reservations → Reservation Service           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────────────┐    ┌────────────────────┐              │
│  │ RDS Aurora         │    │ ElastiCache Redis  │              │
│  │ (동일)             │    │ (동일)             │              │
│  └────────────────────┘    └────────────────────┘              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 모니터링: Prometheus + Grafana (EKS 애드온)              │  │
│  │ 로깅: CloudWatch Container Insights                      │  │
│  │ Service Mesh: Istio (선택적)                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│ 목적: 대규모 확장, 고가용성, 운영 자동화                      │
└─────────────────────────────────────────────────────────────────┘
```

---

### 1.2 타임라인

```
Month 1:    Stage 0 → Stage 1 (RDS, ElastiCache 마이그레이션)
Month 2-3:  Stage 1 → Stage 2 (K3s 클러스터 구축, MSA 전환)
Month 4:    Stage 2 안정화 (K3s 환경에서 운영)
Month 5:    Stage 2 → Stage 3 (EKS 마이그레이션)
Month 6+:   Stage 3 최적화 (Spot Instance, HPA 튜닝)
```

---

## 2. 왜 K3s를 중간 단계로 사용하는가?

### 2.1 K3s 소개

**K3s = Lightweight Kubernetes**

```
K3s 특징:
✅ 바이너리 크기: 70MB (K8s는 1GB+)
✅ 메모리 사용: 512MB (K8s는 2GB+)
✅ 단일 노드에서 실행 가능 (학습/테스트 최적)
✅ 프로덕션 사용 가능 (Rancher가 관리, CNCF 인증)
✅ 설치 5분 이내 완료
✅ 표준 Kubernetes API (EKS와 100% 호환)

K3s에 포함된 것:
• Containerd (컨테이너 런타임)
• Traefik (Ingress Controller)
• CoreDNS (DNS)
• Flannel (네트워크)
• Local Path Provisioner (스토리지)
• Metrics Server (리소스 모니터링)

제외된 것 (경량화):
- Cloud Provider 통합 (AWS, GCP 등)
- 레거시 컴포넌트
- Docker (containerd 사용)
```

### 2.2 K3s를 사용하는 이유

#### **이유 1: 학습 곡선 완화**

```
ECS Fargate:
- Task Definition (ECS 전용 JSON)
- Service Definition (ECS 전용)
→ EKS 전환 시 모두 버리고 YAML로 재작성 ❌

K3s:
- Deployment, Service (표준 K8s YAML)
- HPA, Ingress (표준 K8s YAML)
→ EKS 전환 시 그대로 복사-붙여넣기 ✅
```

**실제 예시:**

```yaml
# K3s에서 작성한 YAML
apiVersion: apps/v1
kind: Deployment
metadata:
  name: event-service
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: event-service
        image: tiketi/event-service:latest
        ports:
        - containerPort: 3011

# → EKS에 그대로 적용 가능! (kubectl apply -f)
```

---

#### **이유 2: 비용 절감 (초기 단계)**

```
ECS Fargate (초기):
- Auth: 2 Tasks × $0.099/h × 720h = $142/월
- Event: 2 Tasks × $0.099/h × 720h = $142/월
- Queue: 3 Tasks × $0.198/h × 720h = $427/월
- Reservation: 3 Tasks × $0.396/h × 720h = $855/월
- Payment: 2 Tasks × $0.099/h × 720h = $142/월
총: $1,708/월

K3s (초기):
- EC2 1대 (t3.xlarge): $0.1664/h × 720h = $120/월
- 모든 서비스 실행 가능 (12 Pod)
총: $120/월 (85% 절감 🔥)

EKS (나중에 확장 시):
- Control Plane: $72/월
- Worker Nodes (t3.xlarge × 3): $360/월
- Spot Instance (추가 10대): $150/월 (70% 할인)
총: $582/월
```

---

#### **이유 3: 로컬 개발 환경과 동일**

```
개발자 로컬:
- K3s 설치 (Docker Desktop K8s 또는 K3d)
- 동일한 YAML로 테스트
- kubectl 명령어 학습

서버 (EC2):
- 동일한 K3s
- 동일한 YAML 배포
- 동일한 kubectl 명령어

→ 개발/프로덕션 환경 일치 ✅
```

---

#### **이유 4: 점진적 확장**

```
Step 1: 단일 EC2 (t3.xlarge) - K3s Master + Worker
        └─ 12 Pod 실행 가능 (2GB RAM × 12 = 24GB 충분)

Step 2: 트래픽 증가 시 Worker Node 추가
        EC2 1대 (Master) + EC2 1대 (Worker)
        └─ Pod 수 2배로 증가

Step 3: EKS 마이그레이션
        Master → EKS Control Plane (AWS 관리)
        Worker → Auto Scaling Group (3-50대)
        YAML 그대로 재사용 ✅
```

---

### 2.3 K3s vs EKS 비교

| 항목 | K3s (EC2) | EKS (관리형) |
|------|-----------|--------------|
| **학습 곡선** | 낮음 (5분 설치) | 높음 (설정 복잡) |
| **초기 비용** | $120/월 (EC2 1대) | $432/월 (Control Plane + Worker 3대) |
| **확장성** | 수동 (Worker Node 추가) | 자동 (Auto Scaling) |
| **관리 부담** | 직접 관리 (마스터 업그레이드) | AWS 관리 (자동 패치) |
| **고가용성** | 단일 마스터 (SPOF) | Multi-AZ 마스터 |
| **적합한 시기** | 초기 6개월, 학습 | 대규모 확장 (100만+ 접속) |
| **YAML 호환성** | ✅ 100% 동일 | ✅ 100% 동일 |

**권장 전략:**
```
트래픽 < 10만 동시 접속: K3s 충분
트래픽 10-50만: K3s → EKS 전환 고려
트래픽 > 50만: EKS 필수
```

---

## 3. Phase 1: 현재 환경 개선 (RDS, ElastiCache)

### 3.1 목표

```
현재 단일 EC2의 Docker PostgreSQL/DragonflyDB를
AWS 관리형 서비스(RDS Aurora, ElastiCache)로 전환

왜?
✅ 자동 백업, Point-in-Time Recovery
✅ Multi-AZ 고가용성
✅ Auto Scaling (Read Replica)
✅ 장애 시 자동 Failover
✅ 모니터링 및 알림 (CloudWatch)

→ K3s 전환 전에 데이터 레이어 안정화
```

### 3.2 RDS Aurora 마이그레이션

#### **Step 1: Aurora Cluster 생성**

```bash
# Terraform으로 생성
# infrastructure/terraform/rds/main.tf

resource "aws_rds_cluster" "main" {
  cluster_identifier      = "tiketi-dev-cluster"
  engine                  = "aurora-postgresql"
  engine_version          = "15.4"
  database_name           = "tiketi"
  master_username         = "postgres"
  master_password         = var.db_password  # Secrets Manager에서 가져옴

  vpc_security_group_ids  = [aws_security_group.rds.id]
  db_subnet_group_name    = aws_db_subnet_group.main.name

  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00"

  skip_final_snapshot     = false
  final_snapshot_identifier = "tiketi-final-snapshot-${timestamp()}"

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = {
    Environment = "development"
    Stage       = "phase1-rds"
  }
}

# Writer Instance
resource "aws_rds_cluster_instance" "writer" {
  identifier         = "tiketi-dev-writer"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = "db.t4g.medium"  # 저렴한 옵션 (초기)
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version

  publicly_accessible = false
}

# Read Replica (선택적, 초기에는 1개)
resource "aws_rds_cluster_instance" "reader" {
  identifier         = "tiketi-dev-reader-1"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = "db.t4g.medium"
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version

  publicly_accessible = false
}

# Security Group
resource "aws_security_group" "rds" {
  name        = "tiketi-rds-sg"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]  # EC2에서만 접근
  }

  tags = {
    Name = "tiketi-rds-sg"
  }
}
```

#### **Step 2: 데이터 마이그레이션**

```bash
# 1. 현재 PostgreSQL 백업
docker exec postgres-container pg_dump -U postgres tiketi > backup.sql

# 2. Aurora로 복원
psql -h tiketi-dev-cluster.cluster-xxx.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d tiketi \
     -f backup.sql

# 3. 데이터 검증
psql -h tiketi-dev-cluster.cluster-xxx.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d tiketi \
     -c "SELECT COUNT(*) FROM users;"
# 예상 결과: 1000 rows

psql -h ... -c "SELECT COUNT(*) FROM events;"
# 예상 결과: 50 rows
```

#### **Step 3: Application 연결 변경**

```javascript
// backend/.env 수정 전
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=tiketi

// backend/.env 수정 후
DB_HOST=tiketi-dev-cluster.cluster-xxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD={{secrets-manager-value}}
DB_NAME=tiketi
DB_SSL=true  # Aurora는 SSL 필수

// backend/src/config/database.js
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,  # Connection Pool
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: true,
    ca: fs.readFileSync('./rds-ca-2019-root.pem')  # RDS SSL 인증서
  } : false
});

module.exports = pool;
```

---

### 3.3 ElastiCache Redis 마이그레이션

#### **Step 1: Redis Cluster 생성**

```hcl
# infrastructure/terraform/elasticache/main.tf

resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "tiketi-dev-redis"
  replication_group_description = "Development Redis Cluster"

  engine         = "redis"
  engine_version = "7.0"
  node_type      = "cache.t4g.micro"  # 저렴한 옵션 (초기)

  num_cache_clusters = 2  # 1 Primary + 1 Replica

  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  automatic_failover_enabled = true
  multi_az_enabled           = true

  snapshot_retention_limit = 5
  snapshot_window          = "03:00-05:00"

  tags = {
    Environment = "development"
    Stage       = "phase1-redis"
  }
}

resource "aws_security_group" "redis" {
  name   = "tiketi-redis-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }
}
```

#### **Step 2: Application 연결 변경**

```javascript
// backend/src/config/redis.js
const Redis = require('ioredis');

// 수정 전 (DragonflyDB)
const redis = new Redis({
  host: 'localhost',
  port: 7379
});

// 수정 후 (ElastiCache)
const redis = new Redis({
  host: process.env.REDIS_HOST,  // tiketi-dev-redis.xxx.cache.amazonaws.com
  port: 6379,
  password: process.env.REDIS_AUTH_TOKEN,
  tls: {
    checkServerIdentity: () => undefined
  },
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
});

redis.on('connect', () => {
  console.log('✅ Connected to ElastiCache Redis');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

module.exports = redis;
```

---

### 3.4 Phase 1 완료 검증

```bash
# 1. RDS 연결 테스트
psql -h tiketi-dev-cluster.cluster-xxx.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d tiketi \
     -c "SELECT 1;"
# 예상: 1

# 2. Redis 연결 테스트
redis-cli -h tiketi-dev-redis.xxx.cache.amazonaws.com \
          --tls \
          -a {{auth-token}} \
          ping
# 예상: PONG

# 3. Application Health Check
curl http://{{ec2-ip}}:3001/health
# 예상: {"status":"ok","database":"connected","redis":"connected"}

# 4. 부하 테스트 (간단)
ab -n 1000 -c 10 http://{{ec2-ip}}:3001/api/events
# 예상: 모든 요청 성공 (200 OK)
```

**Phase 1 완료 기준:**
- [x] RDS Aurora Writer/Reader 정상 동작
- [x] ElastiCache Redis 연결 성공
- [x] Application이 정상적으로 데이터 읽기/쓰기
- [x] 기존 기능 모두 정상 작동

---

## 4. Phase 2: K3s 클러스터 구축

### 4.1 EC2 인스턴스 준비

#### **Option A: 단일 노드 (초기 학습용)**

```bash
# EC2 Instance 스펙
Instance Type: t3.xlarge
  • vCPU: 4
  • RAM: 16GB
  • 네트워크: 최대 5Gbps
  • 비용: $0.1664/h ($120/월)

# 충분한 이유:
- K3s 자체: 512MB
- 12 Pod × 500MB = 6GB
- 시스템: 2GB
- 여유: 7.5GB
총: 16GB (딱 맞음)
```

#### **Option B: Multi-Node (프로덕션 대비)**

```bash
# Master Node
Instance Type: t3.medium (2 vCPU, 4GB RAM)
역할: K3s Control Plane만 실행
비용: $0.0416/h ($30/월)

# Worker Node 1-2
Instance Type: t3.large (2 vCPU, 8GB RAM)
역할: Pod 실행
비용: $0.0832/h × 2 = $120/월

총 비용: $150/월
```

---

### 4.2 K3s 설치

#### **Master Node 설치 (5분 완료)**

```bash
# SSH로 EC2 접속
ssh -i tiketi-key.pem ubuntu@{{ec2-ip}}

# 1. K3s 설치 (단일 명령어!)
curl -sfL https://get.k3s.io | sh -s - \
  --write-kubeconfig-mode 644 \
  --disable traefik \  # ALB 사용할 예정이라 비활성화
  --node-name master

# 설치 확인
sudo systemctl status k3s
# 예상: active (running)

# kubectl 사용 가능 확인
sudo kubectl get nodes
# NAME     STATUS   ROLES                  AGE   VERSION
# master   Ready    control-plane,master   1m    v1.28.4+k3s1

# kubeconfig 복사 (로컬에서 kubectl 사용하려면)
sudo cat /etc/rancher/k3s/k3s.yaml > ~/.kube/config

# 2. Metrics Server 활성화 확인 (K3s 기본 포함)
kubectl get deployment metrics-server -n kube-system
# 예상: READY 1/1

# 3. Storage Class 확인 (Local Path Provisioner)
kubectl get storageclass
# NAME                   PROVISIONER             RECLAIMPOLICY
# local-path (default)   rancher.io/local-path   Delete
```

---

#### **Worker Node 추가 (선택적)**

```bash
# Master Node에서 토큰 확인
sudo cat /var/lib/rancher/k3s/server/node-token
# 출력: K10xxx...::server:xxx

# Worker Node EC2에 SSH 접속
ssh -i tiketi-key.pem ubuntu@{{worker-ip}}

# K3s Agent 설치
curl -sfL https://get.k3s.io | K3S_URL=https://{{master-ip}}:6443 \
  K3S_TOKEN={{token}} \
  sh -s - \
  --node-name worker-1

# Master Node에서 확인
kubectl get nodes
# NAME       STATUS   ROLES                  AGE   VERSION
# master     Ready    control-plane,master   10m   v1.28.4+k3s1
# worker-1   Ready    <none>                 1m    v1.28.4+k3s1
```

---

### 4.3 필수 애드온 설치

#### **Helm 설치 (패키지 관리자)**

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 버전 확인
helm version
# version.BuildInfo{Version:"v3.13.0", ...}
```

#### **Ingress Controller (AWS ALB 대신 Nginx)**

```bash
# K3s는 Traefik이 기본이지만, Nginx 사용 권장 (EKS 호환성)
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-type"="nlb"

# 설치 확인
kubectl get pods -n ingress-nginx
# NAME                                        READY   STATUS    RESTARTS   AGE
# ingress-nginx-controller-xxx                1/1     Running   0          1m

# External IP 확인 (ALB/NLB DNS)
kubectl get svc -n ingress-nginx
# NAME                                 TYPE           EXTERNAL-IP
# ingress-nginx-controller             LoadBalancer   a1234...elb.amazonaws.com
```

---

#### **Prometheus + Grafana (모니터링)**

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Prometheus Operator 설치 (Grafana 포함)
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=7d \
  --set grafana.adminPassword=admin123

# 설치 확인
kubectl get pods -n monitoring
# prometheus-kube-prometheus-stack-prometheus-0   2/2     Running
# kube-prometheus-stack-grafana-xxx               3/3     Running

# Grafana 접속 (포트 포워딩)
kubectl port-forward -n monitoring \
  svc/kube-prometheus-stack-grafana 3000:80

# 브라우저: http://localhost:3000
# 계정: admin / admin123
```

---

### 4.4 Docker Image 레지스트리

#### **Option A: Docker Hub (무료, 공개)**

```bash
# 로그인
docker login

# 이미지 태그
docker tag tiketi/event-service:latest {{dockerhub-user}}/event-service:latest

# 푸시
docker push {{dockerhub-user}}/event-service:latest
```

#### **Option B: AWS ECR (권장, 프라이빗)**

```bash
# ECR Repository 생성
aws ecr create-repository --repository-name tiketi/event-service

# 로그인
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  {{account-id}}.dkr.ecr.us-east-1.amazonaws.com

# 이미지 태그
docker tag tiketi/event-service:latest \
  {{account-id}}.dkr.ecr.us-east-1.amazonaws.com/tiketi/event-service:latest

# 푸시
docker push {{account-id}}.dkr.ecr.us-east-1.amazonaws.com/tiketi/event-service:latest
```

**K3s에서 ECR 접근 설정:**

```bash
# EC2 인스턴스에 IAM Role 부여
# Role Policy: AmazonEC2ContainerRegistryReadOnly

# 또는 Secret 생성
kubectl create secret docker-registry ecr-secret \
  --docker-server={{account-id}}.dkr.ecr.us-east-1.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region us-east-1)
```

---

계속해서 Part 3 (단계별 마이그레이션 가이드)를 작성하겠습니다...