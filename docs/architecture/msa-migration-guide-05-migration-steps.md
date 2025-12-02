# TIKETI MSA + Kubernetes 마이그레이션 가이드 (Part 5)
## 마이그레이션 단계별 실행 가이드

---

## 📋 목차

1. [마이그레이션 전략 및 순서](#1-마이그레이션-전략-및-순서)
2. [Phase 1: 인프라 준비 (1-2주)](#2-phase-1-인프라-준비-1-2주)
3. [Phase 2: 서비스 분리 (3-4주)](#3-phase-2-서비스-분리-3-4주)
4. [Phase 3: 데이터베이스 마이그레이션 (2-3주)](#4-phase-3-데이터베이스-마이그레이션-2-3주)
5. [Phase 4: 트래픽 전환 (1주)](#5-phase-4-트래픽-전환-1주)
6. [Phase 5: 최적화 및 안정화 (2-4주)](#6-phase-5-최적화-및-안정화-2-4주)
7. [롤백 계획](#7-롤백-계획)

---

## 1. 마이그레이션 전략 및 순서

### 1.1 Strangler Fig 패턴 (점진적 마이그레이션)

```
┌─────────────────────────────────────────────────────────┐
│             Strangler Fig Pattern                       │
│                                                          │
│  Old System          Transition         New System      │
│  (Monolith)          (Hybrid)          (Microservices) │
│                                                          │
│  ████████            ████████           ░░░░░░░░        │
│  ████████            ████░░░░  →        ░░░░░░░░        │
│  ████████            ████░░░░           ░░░░░░░░        │
│  ████████            ░░░░░░░░           ░░░░░░░░        │
│                                                          │
│  12주 전             6주 경과           12주 완료        │
└─────────────────────────────────────────────────────────┘

주요 원칙:
1. 한 번에 하나의 서비스만 분리
2. 항상 롤백 가능한 상태 유지
3. 실 트래픽으로 검증 후 다음 단계
4. 데이터 정합성 최우선
```

### 1.2 마이그레이션 우선순위

```
우선순위 기준:
1. 비즈니스 영향도 (낮은 것부터)
2. 독립성 (의존성 적은 것부터)
3. 확장 필요성 (높은 것부터)

마이그레이션 순서:

1순위: User Service (인증/회원)
이유:
- 다른 서비스와 독립적
- 변경 빈도 낮음
- 실패해도 영향 제한적
- 학습용으로 적합

2순위: Event Service (이벤트 조회)
이유:
- 읽기 전용 (안전)
- 캐싱 효과 검증 가능
- 부하 많지만 복잡도 낮음

3순위: Queue Service (대기열)
이유:
- 독립적 동작
- 확장 가장 필요한 부분
- 실패 시 직접 접속으로 우회 가능

4순위: Ticket Service (티켓 예약)
이유:
- 핵심 비즈니스 로직
- DB 트랜잭션 복잡
- 신중하게 마이그레이션 필요

5순위: Order Service (주문)
이유:
- Payment와 강결합
- 데이터 일관성 중요

6순위: Payment Service (결제)
이유:
- 가장 민감한 서비스
- 외부 PG 연동
- 마지막에 분리
```

---

## 2. Phase 1: 인프라 준비 (1-2주)

### 2.1 Week 1: AWS 인프라 구축

#### Day 1-2: VPC 및 네트워크

```bash
# 1. Terraform 초기화
cd infrastructure/terraform
terraform init

# 2. VPC 생성
terraform plan -target=module.vpc
terraform apply -target=module.vpc

# 결과 확인:
# - VPC (10.0.0.0/16)
# - Public Subnet × 2 (AZ-A, AZ-C)
# - Private Subnet × 2
# - Database Subnet × 2
# - Internet Gateway
# - NAT Gateway × 2
# - Route Tables

# 3. 검증
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=tiketi-production"
aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-xxxxx"
```

#### Day 3-4: EKS 클러스터 생성

```bash
# 1. EKS 클러스터 생성 (eksctl 사용)
eksctl create cluster -f infrastructure/eks/cluster.yaml

# 클러스터 생성 시간: 15-20분

# 2. kubectl 설정
aws eks update-kubeconfig --region ap-northeast-2 --name tiketi-production

# 3. 확인
kubectl get nodes
# NAME                                            STATUS   ROLES    AGE   VERSION
# ip-10-0-1-123.ap-northeast-2.compute.internal   Ready    <none>   1m    v1.28.x
# ip-10-0-2-456.ap-northeast-2.compute.internal   Ready    <none>   1m    v1.28.x

# 4. 필수 Add-ons 설치
# AWS Load Balancer Controller
kubectl apply -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller/crds?ref=master"
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=tiketi-production

# Cluster Autoscaler
kubectl apply -f infrastructure/k8s/cluster-autoscaler.yaml

# Metrics Server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# External Secrets Operator
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
```

#### Day 5-7: 데이터베이스 준비

```bash
# 1. RDS PostgreSQL 생성
terraform plan -target=module.rds
terraform apply -target=module.rds

# 생성 시간: 10-15분

# 2. 데이터베이스 생성
psql -h tiketi-production.xxxxx.rds.amazonaws.com -U tiketi_admin -d postgres

CREATE DATABASE user_db;
CREATE DATABASE event_db;
CREATE DATABASE ticket_db;
CREATE DATABASE order_db;
CREATE DATABASE payment_db;

# 3. 스키마 마이그레이션 (단계적으로)
# 현재 Monolith DB에서 덤프
pg_dump -h current-ec2-ip -U tiketi_user tiketi > backup.sql

# 새 RDS로 복원 (테스트용)
psql -h tiketi-production.xxxxx.rds.amazonaws.com -U tiketi_admin -d user_db < backup-users.sql

# 4. ElastiCache Redis 생성
terraform apply -target=module.elasticache

# 5. 연결 테스트
redis-cli -h tiketi-redis.xxxxx.cache.amazonaws.com ping
# PONG
```

### 2.2 Week 2: CI/CD 파이프라인 구축

#### Day 1-3: GitHub Actions 설정

```yaml
# .github/workflows/build-and-deploy.yaml
name: Build and Deploy Microservices

on:
  push:
    branches:
      - main
    paths:
      - 'services/**'

env:
  AWS_REGION: ap-northeast-2
  ECR_REGISTRY: 123456789.dkr.ecr.ap-northeast-2.amazonaws.com
  EKS_CLUSTER: tiketi-production

jobs:
  # 변경된 서비스만 빌드
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.filter.outputs.changes }}
    steps:
      - uses: actions/checkout@v3
      - uses: dorny/paths-filter@v2
        id: filter
        with:
          filters: |
            user-service:
              - 'services/user-service/**'
            queue-service:
              - 'services/queue-service/**'
            ticket-service:
              - 'services/ticket-service/**'

  build-and-push:
    needs: detect-changes
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: ${{ fromJSON(needs.detect-changes.outputs.services) }}
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and push Docker image
        working-directory: services/${{ matrix.service }}
        run: |
          IMAGE_TAG=$(git rev-parse --short HEAD)
          docker build -t $ECR_REGISTRY/tiketi/${{ matrix.service }}:$IMAGE_TAG .
          docker push $ECR_REGISTRY/tiketi/${{ matrix.service }}:$IMAGE_TAG
          docker tag $ECR_REGISTRY/tiketi/${{ matrix.service }}:$IMAGE_TAG \
                     $ECR_REGISTRY/tiketi/${{ matrix.service }}:latest
          docker push $ECR_REGISTRY/tiketi/${{ matrix.service }}:latest

      - name: Update Kubernetes manifests
        run: |
          IMAGE_TAG=$(git rev-parse --short HEAD)
          kubectl set image deployment/${{ matrix.service }} \
            ${{ matrix.service }}=$ECR_REGISTRY/tiketi/${{ matrix.service }}:$IMAGE_TAG \
            -n production

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/${{ matrix.service }} -n production --timeout=5m
```

#### Day 4-5: ArgoCD 설정 (GitOps)

```bash
# 1. ArgoCD 설치
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 2. ArgoCD UI 접속
kubectl port-forward svc/argocd-server -n argocd 8080:443

# 3. 초기 비밀번호 확인
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# 4. Application 생성
kubectl apply -f infrastructure/argocd/applications/tiketi-app.yaml
```

```yaml
# infrastructure/argocd/applications/tiketi-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tiketi-production
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/tiketi
    targetRevision: main
    path: kubernetes/production
    helm:
      valueFiles:
        - values-production.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

---

## 3. Phase 2: 서비스 분리 (3-4주)

### 3.1 Week 3: User Service 분리 (첫 번째 서비스)

#### Step 1: 코드 분리

```bash
# 1. 새 디렉토리 구조 생성
mkdir -p services/user-service
cd services/user-service

# 2. 기존 코드에서 추출
cp ../../backend/src/routes/auth.js src/routes/
cp ../../backend/src/middleware/authenticate.js src/middleware/
cp ../../backend/src/models/user.js src/models/

# 3. package.json 생성
npm init -y
npm install express pg bcrypt jsonwebtoken

# 4. 독립 실행 가능하도록 server.js 작성
# services/user-service/src/server.js
const express = require('express');
const authRoutes = require('./routes/auth');

const app = express();

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});
```

#### Step 2: Docker 이미지 빌드

```dockerfile
# services/user-service/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runner

RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -s /bin/sh -D nodejs

WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs
EXPOSE 3001

CMD ["node", "src/server.js"]
```

```bash
# 빌드 및 푸시
docker build -t 123456789.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/user-service:v1.0.0 .
docker push 123456789.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/user-service:v1.0.0
```

#### Step 3: Kubernetes 배포

```bash
# Helm Chart로 배포
helm install user-service charts/user-service \
  -f charts/user-service/values-production.yaml \
  -n production

# 확인
kubectl get pods -n production -l app=user-service
# NAME                            READY   STATUS    RESTARTS   AGE
# user-service-7d8f5b6c9d-abcde   1/1     Running   0          30s
# user-service-7d8f5b6c9d-fghij   1/1     Running   0          30s

# 로그 확인
kubectl logs -f deployment/user-service -n production
```

#### Step 4: 트래픽 라우팅 (Canary)

```yaml
# 기존 Monolith에 80% 트래픽
# 신규 User Service에 20% 트래픽

apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: user-service-route
spec:
  hosts:
  - api.tiketi.com
  http:
  - match:
    - uri:
        prefix: "/api/auth"
    route:
    - destination:
        host: monolith-service
        subset: v1
      weight: 80
    - destination:
        host: user-service
        subset: v1
      weight: 20
```

#### Step 5: 모니터링 및 검증

```bash
# Prometheus 쿼리로 에러율 확인
rate(http_requests_total{service="user-service",status=~"5.."}[5m])

# 응답 시간 확인
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# 성공 기준:
# - 에러율 < 1%
# - P99 응답 시간 < 200ms
# - CPU 사용률 < 70%

# 1주일 모니터링 후 문제 없으면 100% 전환
```

### 3.2 Week 4-5: Event & Queue Service 분리

**동일한 프로세스 반복:**
1. 코드 분리
2. Docker 이미지
3. Kubernetes 배포
4. Canary 전환
5. 모니터링 검증

**Queue Service 특이사항:**
```yaml
# WebSocket 연결 처리 위한 특별 설정

# 1. ALB에서 Sticky Session 활성화
alb.ingress.kubernetes.io/target-group-attributes: |
  stickiness.enabled=true,
  stickiness.lb_cookie.duration_seconds=3600

# 2. Service에서 Session Affinity
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800

# 3. Graceful Shutdown
lifecycle:
  preStop:
    exec:
      command:
      - /bin/sh
      - -c
      - |
        # 기존 연결 정리
        kill -SIGTERM 1
        sleep 30
```

### 3.3 Week 6: Ticket & Order Service 분리

**핵심 비즈니스 로직 - 신중하게 진행**

#### 데이터 정합성 검증

```javascript
// 이중 쓰기 패턴 (Dual Write)으로 안전하게 마이그레이션

class TicketService {
  async reserveSeat(userId, seatId) {
    // 1. Monolith DB에 쓰기 (Primary)
    const monolithResult = await monolithDB.reserveSeat(userId, seatId);

    try {
      // 2. 새 Microservice DB에도 쓰기 (Shadow)
      await microserviceDB.reserveSeat(userId, seatId);

      // 3. 결과 비교 (검증)
      await this.verifyConsistency(monolithResult, microserviceResult);
    } catch (error) {
      // 새 DB 쓰기 실패해도 무시 (Monolith가 Primary)
      logger.error('Shadow write failed', error);
      metrics.increment('shadow_write_error');
    }

    return monolithResult;  // 항상 Monolith 결과 반환
  }

  async verifyConsistency(monolithResult, microserviceResult) {
    if (JSON.stringify(monolithResult) !== JSON.stringify(microserviceResult)) {
      logger.error('Data inconsistency detected', {
        monolith: monolithResult,
        microservice: microserviceResult
      });
      metrics.increment('data_inconsistency');

      // Slack 알림
      await notifySlack('🚨 Data Inconsistency Detected!');
    }
  }
}

// 1주일 검증 후 일관성 확인되면 Primary 전환
```

---

## 4. Phase 3: 데이터베이스 마이그레이션 (2-3주)

### 4.1 Week 7-8: 데이터베이스 분리

#### Step 1: 스키마 분리

```sql
-- 기존 Monolith DB
tiketi_db (단일 데이터베이스)
├── users (User Service로 이동)
├── events (Event Service로 이동)
├── tickets (Ticket Service로 이동)
├── seats (Ticket Service로 이동)
├── reservations (Order Service로 이동)
├── reservation_items (Order Service로 이동)
└── payments (Payment Service로 이동)

-- 새로운 분리 DB
user_db
└── users

event_db
└── events
└── ticket_types

ticket_db
└── seats
└── temp_reservations

order_db
└── orders
└── order_items

payment_db
└── payments
```

#### Step 2: 데이터 마이그레이션 스크립트

```javascript
// scripts/migrate-users.js
const { Pool } = require('pg');

const sourceDB = new Pool({
  host: 'monolith-db.xxxxx.rds.amazonaws.com',
  database: 'tiketi_db',
  user: 'admin',
  password: process.env.SOURCE_DB_PASSWORD
});

const targetDB = new Pool({
  host: 'user-db.xxxxx.rds.amazonaws.com',
  database: 'user_db',
  user: 'admin',
  password: process.env.TARGET_DB_PASSWORD
});

async function migrateUsers() {
  const client = await targetDB.connect();

  try {
    await client.query('BEGIN');

    // 1. 기존 데이터 가져오기 (배치 처리)
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const result = await sourceDB.query(
        'SELECT * FROM users ORDER BY created_at LIMIT $1 OFFSET $2',
        [batchSize, offset]
      );

      if (result.rows.length === 0) break;

      // 2. 새 DB에 삽입 (UPSERT)
      for (const user of result.rows) {
        await client.query(`
          INSERT INTO users (id, email, password_hash, name, phone, role, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            updated_at = EXCLUDED.updated_at
        `, [user.id, user.email, user.password_hash, user.name, user.phone, user.role, user.created_at, user.updated_at]);
      }

      console.log(`Migrated ${offset + result.rows.length} users`);
      offset += batchSize;
    }

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

migrateUsers();
```

#### Step 3: CDC (Change Data Capture)로 실시간 동기화

```yaml
# AWS DMS (Database Migration Service) 사용

# 1. Replication Instance 생성
aws dms create-replication-instance \
  --replication-instance-identifier tiketi-migration \
  --replication-instance-class dms.t3.medium \
  --allocated-storage 50

# 2. Source Endpoint (Monolith DB)
aws dms create-endpoint \
  --endpoint-identifier source-monolith \
  --endpoint-type source \
  --engine-name postgres \
  --server-name monolith-db.xxxxx.rds.amazonaws.com \
  --database-name tiketi_db

# 3. Target Endpoint (User DB)
aws dms create-endpoint \
  --endpoint-identifier target-user-db \
  --endpoint-type target \
  --engine-name postgres \
  --server-name user-db.xxxxx.rds.amazonaws.com \
  --database-name user_db

# 4. Replication Task (실시간 동기화)
aws dms create-replication-task \
  --replication-task-identifier migrate-users \
  --source-endpoint-arn arn:aws:dms:... \
  --target-endpoint-arn arn:aws:dms:... \
  --migration-type full-load-and-cdc \
  --table-mappings file://table-mappings.json
```

```json
// table-mappings.json
{
  "rules": [
    {
      "rule-type": "selection",
      "rule-id": "1",
      "rule-name": "include-users-table",
      "object-locator": {
        "schema-name": "public",
        "table-name": "users"
      },
      "rule-action": "include"
    }
  ]
}
```

---

## 5. Phase 4: 트래픽 전환 (1주)

### 5.1 Week 9: 점진적 트래픽 전환

```
Day 1-2: 10% 트래픽 → 새 시스템
- User Service: 10%
- Event Service: 10%
- Queue Service: 10%

Day 3-4: 50% 트래픽
- 에러율 모니터링
- 응답 시간 비교
- 데이터 정합성 검증

Day 5-6: 100% 트래픽
- Monolith는 Standby로 유지
- 24시간 모니터링

Day 7: Monolith 종료 준비
- 최종 데이터 동기화 확인
- 백업 생성
```

### 5.2 트래픽 전환 스크립트

```bash
# Flagger로 자동 Canary 전환
kubectl apply -f canary/user-service-canary.yaml

# 수동 전환 (긴급 시)
kubectl patch virtualservice user-service-route \
  --type merge \
  -p '{"spec":{"http":[{"route":[{"destination":{"host":"user-service"},"weight":100}]}]}}'
```

---

## 6. Phase 5: 최적화 및 안정화 (2-4주)

### 6.1 Week 10-11: 성능 최적화

#### Database Query 최적화

```sql
-- 1. 슬로우 쿼리 식별
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 100  -- 100ms 이상
ORDER BY total_time DESC
LIMIT 20;

-- 2. 인덱스 추가
CREATE INDEX CONCURRENTLY idx_seats_event_status ON seats(event_id, status);
CREATE INDEX CONCURRENTLY idx_orders_user_created ON orders(user_id, created_at DESC);

-- 3. Vacuum 및 Analyze
VACUUM ANALYZE seats;
ANALYZE orders;
```

#### Cache 전략 최적화

```javascript
// Redis Cache 레이어 추가
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: 6379
});

async function getEvent(id) {
  // 1. Cache Hit Check
  const cached = await client.get(`event:${id}`);
  if (cached) {
    metrics.increment('cache_hit');
    return JSON.parse(cached);
  }

  // 2. DB 조회
  metrics.increment('cache_miss');
  const event = await db.query('SELECT * FROM events WHERE id = $1', [id]);

  // 3. Cache 저장 (5분 TTL)
  await client.setex(`event:${id}`, 300, JSON.stringify(event));

  return event;
}
```

### 6.2 Week 12-13: Auto Scaling 튜닝

```yaml
# HPA 메트릭 조정 (실제 트래픽 기반)

# Queue Service - 대기열 길이 기반
- type: Pods
  pods:
    metric:
      name: queue_length
    target:
      type: AverageValue
      averageValue: "500"  # 기존 1000에서 500으로 하향 (더 빨리 스케일)

# Ticket Service - DB Connection Pool 사용률
- type: Pods
  pods:
    metric:
      name: db_pool_utilization
    target:
      type: AverageValue
      averageValue: "60"  # 70%에서 60%로 하향 (여유 확보)
```

---

## 7. 롤백 계획

### 7.1 긴급 롤백 시나리오

```bash
# 시나리오 1: 특정 서비스 롤백
kubectl rollout undo deployment/user-service -n production

# 시나리오 2: 전체 트래픽을 Monolith로 복귀
kubectl patch virtualservice tiketi-route \
  --type merge \
  -p '{"spec":{"http":[{"route":[{"destination":{"host":"monolith-service"},"weight":100}]}]}}'

# 시나리오 3: Helm 롤백
helm rollback tiketi 1 -n production

# 시나리오 4: ArgoCD 롤백 (GitOps)
argocd app rollback tiketi-production
```

### 7.2 데이터 롤백

```bash
# RDS 스냅샷으로 복원
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier tiketi-restored \
  --db-snapshot-identifier tiketi-backup-20241202

# Point-in-Time Recovery
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier tiketi-production \
  --target-db-instance-identifier tiketi-restored \
  --restore-time 2024-12-02T14:30:00Z
```

---

## 마이그레이션 체크리스트

### Pre-Migration
- [ ] AWS 계정 준비 완료
- [ ] 예산 승인 ($5,000/month)
- [ ] 팀 교육 완료 (Kubernetes, Docker)
- [ ] 롤백 계획 수립
- [ ] 비즈니스 팀과 일정 조율 (피크 시즌 피하기)

### Phase 1: 인프라 (2주)
- [ ] VPC 생성 완료
- [ ] EKS 클러스터 실행 중
- [ ] RDS 생성 및 연결 테스트
- [ ] ElastiCache 생성 및 연결 테스트
- [ ] CI/CD 파이프라인 동작 확인
- [ ] 모니터링 대시보드 구축

### Phase 2: 서비스 분리 (4주)
- [ ] User Service 100% 트래픽 전환
- [ ] Event Service 100% 트래픽 전환
- [ ] Queue Service 100% 트래픽 전환
- [ ] Ticket Service 100% 트래픽 전환
- [ ] Order Service 100% 트래픽 전환
- [ ] Payment Service 100% 트래픽 전환

### Phase 3: 데이터 마이그레이션 (3주)
- [ ] 스키마 분리 완료
- [ ] 데이터 마이그레이션 완료
- [ ] 데이터 정합성 100% 검증
- [ ] CDC 중단 (실시간 동기화 종료)

### Phase 4: 최적화 (4주)
- [ ] 슬로우 쿼리 제거
- [ ] Cache Hit Rate > 80%
- [ ] Auto Scaling 튜닝 완료
- [ ] Load Testing 통과 (100,000 동시 접속)

### Post-Migration
- [ ] Monolith 서버 종료
- [ ] 비용 최적화 완료
- [ ] 문서화 완료
- [ ] 팀 회고 및 개선점 정리

---

## 다음 단계

마이그레이션 단계를 완료했습니다. 마지막으로 모니터링 및 비용 최적화 전략을 확인합니다.

👉 **[Part 6: 모니터링 및 비용 최적화로 이동](./msa-migration-guide-06-monitoring-optimization.md)**
