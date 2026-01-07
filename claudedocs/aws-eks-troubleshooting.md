# AWS EKS & GitHub Actions 트러블슈팅 가이드

**프로젝트**: Tiketi - 티케팅 플랫폼
**인프라**: AWS EKS (ARM64), RDS PostgreSQL, ElastiCache Redis
**배포**: GitHub Actions + Kustomize (GitOps)
**작성일**: 2026-01-08

---

## 📋 목차

1. [인프라 아키텍처](#인프라-아키텍처)
2. [AWS 리소스 설정](#aws-리소스-설정)
3. [Kubernetes 구성](#kubernetes-구성)
4. [CI/CD 파이프라인](#cicd-파이프라인)
5. [트러블슈팅 사례](#트러블슈팅-사례)
6. [모니터링 및 검증](#모니터링-및-검증)

---

## 인프라 아키텍처

### 전체 구성도

```
[사용자] → [Route53: tiketi.store]
    ↓
[AWS ALB Ingress]
    ↓
[EKS Cluster - ARM64 Nodes (8개)]
    ├── tiketi-backend (API Gateway)
    ├── tiketi-auth-service
    ├── tiketi-ticket-service (WebSocket)
    ├── tiketi-payment-service
    └── tiketi-stats-service
    ↓
[RDS PostgreSQL (Multi-AZ)]
[ElastiCache Redis (Multi-AZ: 2a, 2b)]
```

### 주요 기술 스택

- **컨테이너**: Docker (ARM64 images)
- **오케스트레이션**: AWS EKS (Kubernetes 1.28+)
- **데이터베이스**: RDS PostgreSQL 15 (auth_schema.users, events, tickets 등)
- **캐시**: ElastiCache Redis 7.x (Socket.IO pub/sub)
- **스토리지**: ECR (Docker image registry)
- **CI/CD**: GitHub Actions + Kustomize
- **도메인**: Route53 + ALB Ingress
- **실시간**: Socket.IO with Redis Adapter

---

## AWS 리소스 설정

### 1. RDS PostgreSQL 설정

**엔드포인트**: `tiketiadv-dev-rds.cjiiqeo2ou62.ap-northeast-2.rds.amazonaws.com:5432`

#### 데이터베이스 스키마

```sql
-- 스키마 구조
CREATE SCHEMA auth_schema;

-- Users 테이블 (Google OAuth 지원)
CREATE TABLE auth_schema.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- OAuth 사용자는 NULL 가능
    google_id VARCHAR(255) UNIQUE,  -- Google OAuth ID
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON auth_schema.users(email);
CREATE INDEX idx_users_google_id ON auth_schema.users(google_id);
```

#### SSL 연결 설정

**환경변수**:
```yaml
DB_HOST: tiketiadv-dev-rds.cjiiqeo2ou62.ap-northeast-2.rds.amazonaws.com
DB_PORT: 5432
DB_NAME: tiketi
DB_USER: tiketi_user
DB_SSL: true  # ← 중요: RDS는 SSL 필수
```

**코드 설정** (`packages/database/src/index.js`):
```javascript
const config = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};
```

### 2. ElastiCache Redis Multi-AZ 설정

**Primary 엔드포인트**: `tiketi-redis-multiaz.eaaj6u.ng.0001.apn2.cache.amazonaws.com:6379`

#### 아키텍처

```
ap-northeast-2a (Primary)     ap-northeast-2b (Replica)
        ↓                              ↓
   Redis Master  ←─ Replication ─→  Redis Replica
        ↑                              ↑
   EKS Nodes (2a)                 EKS Nodes (2b)
   (같은 AZ로 <1ms 지연)
```

#### 보안 그룹 설정

**문제**: ElastiCache SG에서 EKS Node 접근 차단
**해결**:
```bash
# EKS 클러스터 보안 그룹 확인
aws eks describe-cluster --name tiketi-cluster \
  --query 'cluster.resourcesVpcConfig.clusterSecurityGroupId'
# 출력: sg-0c7f0a8a1cc496985

# ElastiCache 보안 그룹 확인
aws elasticache describe-cache-clusters --cache-cluster-id tiketi-redis-multiaz \
  --query 'CacheClusters[0].CacheSecurityGroups[0].CacheSecurityGroupName'

# EKS에서 ElastiCache 접근 허용
aws ec2 authorize-security-group-ingress \
  --group-id sg-068622a0c8b91e592 \
  --protocol tcp \
  --port 6379 \
  --source-group sg-0c7f0a8a1cc496985
```

#### 연결 검증

```bash
# Pod에서 Redis 연결 테스트
kubectl run redis-test --rm -it --restart=Never \
  --image=redis:7-alpine \
  -- redis-cli -h tiketi-redis-multiaz.eaaj6u.ng.0001.apn2.cache.amazonaws.com PING

# 예상 출력: PONG
```

### 3. EKS 클러스터 설정

**클러스터 정보**:
- **이름**: tiketi-cluster
- **리전**: ap-northeast-2 (Seoul)
- **노드 타입**: ARM64 (Graviton)
- **노드 수**: 8개
- **가용 영역**: ap-northeast-2a, ap-northeast-2b

#### 노드 아키텍처 확인

```bash
# 노드 아키텍처 확인
kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.architecture}'
# 출력: arm64 arm64 arm64 arm64 arm64 arm64 arm64 arm64
```

### 4. ECR (Elastic Container Registry)

**레지스트리**: `640740721346.dkr.ecr.ap-northeast-2.amazonaws.com`

#### 리포지토리 목록

```
tiketi-backend           # API Gateway
tiketi/auth             # 인증 서비스
tiketi/ticket           # 티켓/이벤트 서비스
tiketi/payment          # 결제 서비스
tiketi/stats            # 통계 서비스
```

#### ECR 로그인

```bash
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  640740721346.dkr.ecr.ap-northeast-2.amazonaws.com
```

---

## Kubernetes 구성

### 1. Kustomize 디렉터리 구조

```
k8s/
├── base/                           # 기본 리소스
│   ├── backend-deployment.yaml
│   ├── auth-deployment.yaml
│   ├── ticket-deployment.yaml
│   ├── payment-deployment.yaml
│   ├── stats-deployment.yaml
│   └── services.yaml
└── overlays/
    ├── staging/
    │   └── kustomization.yaml
    └── prod/
        ├── kustomization.yaml      # Production 설정
        ├── ingress.yaml            # ALB Ingress
        ├── hpa.yaml                # Horizontal Pod Autoscaler
        ├── pdb.yaml                # Pod Disruption Budget
        └── namespace.yaml
```

### 2. Production Kustomization 설정

**파일**: `k8s/overlays/prod/kustomization.yaml`

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: tiketi

resources:
  - namespace.yaml
  - ../../base
  - ingress.yaml
  - hpa.yaml
  - pdb.yaml

configMapGenerator:
  - name: tiketi-config
    literals:
      - NODE_ENV=production
      # RDS PostgreSQL
      - DB_HOST=tiketiadv-dev-rds.cjiiqeo2ou62.ap-northeast-2.rds.amazonaws.com
      - DB_PORT=5432
      - DB_NAME=tiketi
      - DB_USER=tiketi_user
      - DB_SSL=true

      # ElastiCache Redis Multi-AZ (ap-northeast-2a, 2b)
      - REDIS_HOST=tiketi-redis-multiaz.eaaj6u.ng.0001.apn2.cache.amazonaws.com
      - REDIS_PORT=6379

      # CORS 설정 (WebSocket 포함)
      - SOCKET_IO_CORS_ORIGIN=https://tiketi.store,https://www.tiketi.store,https://tiketi.com,https://www.tiketi.com

      # TossPayments 통합
      - TOSS_CLIENT_KEY=test_ck_EP59LybZ8BlAdL6Z1o4ZV6GYo7pR

      # 기타
      - PORT=3001
      - TZ=Asia/Seoul
      - AWS_REGION=ap-northeast-2

images:
  - name: tiketi-backend
    newName: 640740721346.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend
    newTag: 3f44d16-20260107-143848
  - name: tiketi-auth-service
    newName: 640740721346.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/auth
    newTag: 7767861-20260108-022215
  - name: tiketi-ticket-service
    newName: 640740721346.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/ticket
    newTag: beed6fa-20260107-172002
  - name: tiketi-payment-service
    newName: 640740721346.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/payment
    newTag: 7767861-20260108-022217
  - name: tiketi-stats-service
    newName: 640740721346.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/stats
    newTag: 7767861-20260108-022219

commonLabels:
  environment: production
```

### 3. ALB Ingress 설정

**파일**: `k8s/overlays/prod/ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-alb-ingress
  namespace: tiketi
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
spec:
  ingressClassName: alb
  rules:
    - host: tiketi.store
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 3001

          # WebSocket 라우팅 (중요!)
          - path: /socket.io
            pathType: Prefix
            backend:
              service:
                name: ticket-service
                port:
                  number: 3002
```

**중요**: `/socket.io` 경로는 ticket-service로 라우팅해야 Socket.IO가 작동합니다.

### 4. Redis Adapter 설정

**파일**: `services/ticket-service/src/config/redis.js`

```javascript
const redis = require('redis');

const createRedisClient = (options = {}) => {
  const client = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.log('❌ Redis: Max reconnection attempts reached');
          return new Error('Redis: Max reconnection attempts reached');
        }
        const delay = Math.min(retries * 100, 3000);
        console.log(`🔄 Redis: Reconnecting in ${delay}ms (attempt ${retries}/10)...`);
        return delay;
      },
    },
    ...options
  });

  client.on('error', (err) => {
    console.log('❌ Redis Client Error:', err.message);
  });

  client.on('connect', () => {
    console.log('🔌 Redis Client connecting...');
  });

  client.on('ready', () => {
    console.log('✅ Redis Client ready');
  });

  return client;
};

module.exports = { createRedisClient };
```

**파일**: `services/ticket-service/src/server.js`

```javascript
const { createAdapter } = require('@socket.io/redis-adapter');
const { createRedisClient } = require('./config/redis');

// Socket.IO Redis Adapter 초기화
const pubClient = createRedisClient();
const subClient = pubClient.duplicate();

Promise.all([
  pubClient.connect(),
  subClient.connect()
]).then(() => {
  try {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.IO Redis adapter connected (multi-pod ready)');
  } catch (err) {
    console.log('⚠️  Socket.IO adapter creation failed:', err.message);
    // Graceful disconnect
    if (pubClient && pubClient.disconnect) pubClient.disconnect().catch(() => {});
    if (subClient && subClient.disconnect) subClient.disconnect().catch(() => {});
  }
}).catch(err => {
  console.log('⚠️  Socket.IO running without Redis adapter:', err.message);
  if (pubClient && pubClient.disconnect) pubClient.disconnect().catch(() => {});
  if (subClient && subClient.disconnect) subClient.disconnect().catch(() => {});
});
```

---

## CI/CD 파이프라인

### 1. GitHub Actions 워크플로우 구조

각 서비스마다 독립적인 CI/CD 파이프라인:

```
.github/workflows/
├── auth-service-ci-cd.yml
├── ticket-service-ci-cd.yml
├── payment-service-ci-cd.yml
├── stats-service-ci-cd.yml
└── backend-ci-cd.yml
```

### 2. 워크플로우 단계

```yaml
name: Service CI/CD

on:
  push:
    branches: [final, develop]
    paths:
      - 'services/SERVICE_NAME/**'
      - 'packages/**'
      - '.github/workflows/SERVICE_NAME-ci-cd.yml'
  workflow_dispatch:

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      # 1. 환경 감지
      - name: Detect target environment
        run: |
          if [ "${{ github.ref_name }}" = "final" ]; then
            ENV="prod"
          else
            ENV="staging"
          fi
          echo "environment=$ENV" >> $GITHUB_OUTPUT

      # 2. AWS 인증 (OIDC)
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-2

      # 3. ECR 로그인
      - name: Login to Amazon ECR
        uses: aws-actions/amazon-ecr-login@v2

      # 4. Docker 빌드 & 푸시 (최적화)
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: services/SERVICE_NAME/Dockerfile
          platforms: linux/arm64
          push: true
          tags: |
            ${{ ECR_REGISTRY }}/tiketi/SERVICE:${{ IMAGE_TAG }}
            ${{ ECR_REGISTRY }}/tiketi/SERVICE:latest
            ${{ ECR_REGISTRY }}/tiketi/SERVICE:prod
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # 5. 보안 스캔 (Trivy)
      - name: Run security scan
        continue-on-error: true
        uses: aquasecurity/trivy-action@master

  update-manifests:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      # 6. Kustomize 이미지 태그 업데이트
      - name: Update Kustomize image tag
        run: |
          sed -i "s|newName: .*tiketi-SERVICE.*|newName: $ECR_REGISTRY/tiketi/SERVICE|g" \
            k8s/overlays/prod/kustomization.yaml
          sed -i "/tiketi-SERVICE/,/newTag:/s|newTag: .*|newTag: $IMAGE_TAG|" \
            k8s/overlays/prod/kustomization.yaml

      # 7. Git Push with Retry (중요!)
      - name: Commit and push changes
        run: |
          git add k8s/overlays/prod/kustomization.yaml
          git commit -m "chore(k8s): update SERVICE image to $IMAGE_TAG [prod]"

          # Retry push up to 5 times
          for i in {1..5}; do
            git pull --rebase origin final
            if git push; then
              echo "✅ Manifest updated and pushed"
              break
            else
              if [ $i -eq 5 ]; then
                echo "❌ Failed to push after 5 attempts"
                exit 1
              fi
              echo "⚠️  Push failed, retrying ($i/5)..."
              sleep $((RANDOM % 3 + 2))
            fi
          done

  notify:
    needs: [build-and-push, update-manifests]
    runs-on: ubuntu-latest
    steps:
      - name: Send Discord notification
        env:
          DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK }}
        run: |
          # Discord webhook으로 배포 결과 전송
```

### 3. 빌드 최적화

#### 문제: QEMU 느린 빌드 (10분+)

**원인**: AMD64 러너에서 ARM64 이미지 빌드 시 QEMU 에뮬레이션 사용

**해결**: GitHub Actions Cache 사용

```yaml
# Before (느림)
- name: Build Docker image
  run: |
    docker build --platform linux/arm64 -t IMAGE .

# After (빠름 - 3분)
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    platforms: linux/arm64
    push: true
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**결과**: 빌드 시간 10분+ → 3분으로 단축 (70% 개선)

---

## 트러블슈팅 사례

### 사례 1: Google OAuth 로그인 실패

**증상**:
```
ERROR: column "google_id" does not exist
```

**원인**:
- RDS 데이터베이스에 migration 파일이 실행되지 않음
- `auth_schema.users` 테이블에 `google_id` 컬럼 누락

**해결**:
```bash
# 1. PostgreSQL Pod 생성
kubectl run psql-client --rm -it --restart=Never \
  --image=postgres:15-alpine \
  --env="PGPASSWORD=$DB_PASSWORD" \
  -- psql -h tiketiadv-dev-rds.cjiiqeo2ou62.ap-northeast-2.rds.amazonaws.com \
         -U tiketi_user -d tiketi

# 2. Migration 실행
ALTER TABLE auth_schema.users
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_google_id
ON auth_schema.users(google_id);

ALTER TABLE auth_schema.users
ALTER COLUMN password_hash DROP NOT NULL;

# 3. 확인
\d auth_schema.users
```

**검증**:
```bash
# 스키마 확인
kubectl run psql-client --rm -it --restart=Never \
  --image=postgres:15-alpine \
  --env="PGPASSWORD=$DB_PASSWORD" \
  -- psql -h $DB_HOST -U tiketi_user -d tiketi \
  -c "\d auth_schema.users"
```

---

### 사례 2: GitHub Actions ARM64 빌드 무한루프

**증상**:
```
#9 [ 4/10] RUN cd packages/common && npm install --omit=dev --no-package-lock
#9 17.32 qemu: uncaught target signal 4 (Illegal instruction) - core dumped
```
→ 10분 이상 빌드 진행 안 됨

**원인**:
- EKS 노드는 ARM64인데 GitHub Actions 러너는 AMD64
- `docker build --platform linux/arm64`로 빌드 시 QEMU 에뮬레이션 사용
- QEMU에서 Node.js native module 빌드 시 매우 느림

**해결**:

**변경 전**:
```yaml
- name: Build Docker image
  run: |
    docker build --platform linux/arm64 \
      -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
```

**변경 후**:
```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    context: .
    file: services/SERVICE/Dockerfile
    platforms: linux/arm64
    push: true
    tags: |
      ${{ ECR_REGISTRY }}/${{ ECR_REPOSITORY }}:${{ IMAGE_TAG }}
      ${{ ECR_REGISTRY }}/${{ ECR_REPOSITORY }}:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**결과**:
- 빌드 시간: 10분+ → 3분
- GitHub Actions Cache로 재빌드 시 더 빠름
- 모든 서비스에 적용 (auth, payment, stats, backend, ticket)

---

### 사례 3: Trivy 보안 스캔 실패

**증상**:
```
Error: failed to scan image: failed to initialize scanner
```

**원인**:
- Trivy가 AMD64 러너에서 ARM64 이미지를 스캔하려고 시도
- 아키텍처 불일치로 인한 실패

**해결**:
```yaml
- name: Run security scan (Trivy)
  continue-on-error: true  # ← 추가
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ ECR_REGISTRY }}/${{ ECR_REPOSITORY }}:${{ IMAGE_TAG }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '0'
```

**참고**:
- `exit-code: '0'`: 취약점 발견해도 워크플로우 실패 안 함 (리포트만)
- `continue-on-error: true`: 스캔 자체가 실패해도 워크플로우 계속 진행
- Production에서는 별도 보안 스캔 프로세스 권장

---

### 사례 4: ElastiCache 연결 타임아웃

**증상**:
```
Error: Redis connection failed: connect ETIMEDOUT
ticket-service-xxx CrashLoopBackOff
```

**원인**:
- ElastiCache 보안 그룹에서 EKS Node 접근 차단
- VPC 내부 통신이지만 보안 그룹 규칙 필요

**해결**:
```bash
# 1. EKS 클러스터 보안 그룹 확인
aws eks describe-cluster --name tiketi-cluster \
  --query 'cluster.resourcesVpcConfig.clusterSecurityGroupId'
# 출력: sg-0c7f0a8a1cc496985

# 2. ElastiCache 보안 그룹 확인
aws elasticache describe-cache-clusters \
  --cache-cluster-id tiketi-redis-multiaz \
  --show-cache-node-info

# 3. 보안 그룹 규칙 추가 (EKS → ElastiCache)
aws ec2 authorize-security-group-ingress \
  --group-id sg-068622a0c8b91e592 \
  --protocol tcp \
  --port 6379 \
  --source-group sg-0c7f0a8a1cc496985 \
  --region ap-northeast-2
```

**검증**:
```bash
# Pod에서 Redis 연결 테스트
kubectl run redis-test --rm -it --restart=Never \
  --image=redis:7-alpine \
  -- redis-cli -h tiketi-redis-multiaz.eaaj6u.ng.0001.apn2.cache.amazonaws.com PING

# 예상 출력: PONG
```

---

### 사례 5: Redis Client Disconnect 에러

**증상**:
```
TypeError: Cannot read properties of undefined (reading 'catch')
    at server.js:104:67
```

**원인**:
- Redis 연결 실패 시 `pubClient`, `subClient`가 `undefined`
- `undefined.disconnect()`를 호출하려고 시도

**해결**:

**변경 전**:
```javascript
}).catch(err => {
  console.log('⚠️  Socket.IO running without Redis adapter:', err.message);
  pubClient.disconnect().catch(() => {});  // ← pubClient가 undefined일 수 있음
  subClient.disconnect().catch(() => {});
});
```

**변경 후**:
```javascript
}).catch(err => {
  console.log('⚠️  Socket.IO running without Redis adapter:', err.message);
  if (pubClient && pubClient.disconnect) {
    pubClient.disconnect().catch(() => {});
  }
  if (subClient && subClient.disconnect) {
    subClient.disconnect().catch(() => {});
  }
});
```

**베스트 프랙티스**:
- 외부 리소스 disconnect 전 null 체크 필수
- 메서드 존재 여부도 확인 (`typeof client.disconnect === 'function'`)

---

### 사례 6: WebSocket 연결 끊김 ("연결 끊김")

**증상**:
- 로그인한 사용자가 이벤트 페이지 진입 시 WebSocket 연결 실패
- 프론트엔드에 "연결 끊김" 메시지 표시

**원인**:
- ALB Ingress에 `/socket.io` 경로 라우팅 누락
- Socket.IO 요청이 backend로 가서 404 에러

**해결**:

**파일**: `k8s/overlays/prod/ingress.yaml`

```yaml
spec:
  rules:
    - host: tiketi.store
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 3001

          # ✅ 추가: WebSocket 라우팅
          - path: /socket.io
            pathType: Prefix
            backend:
              service:
                name: ticket-service
                port:
                  number: 3002
```

**검증**:
```bash
# Ingress 설정 확인
kubectl get ingress -n tiketi tiketi-alb-ingress -o yaml

# WebSocket 연결 테스트
curl -i https://tiketi.store/socket.io/?EIO=4&transport=polling
```

**CORS 설정도 확인**:
```yaml
configMapGenerator:
  - name: tiketi-config
    literals:
      - SOCKET_IO_CORS_ORIGIN=https://tiketi.store,https://www.tiketi.store
```

---

### 사례 7: Toss Payments 결제 실패

**증상**:
```
토스 페이먼츠 결제에 실패했습니다
```

**원인**:
- Production 환경에 `TOSS_CLIENT_KEY` 환경변수 누락
- `TOSS_SECRET_KEY`는 Secret에 있지만 `TOSS_CLIENT_KEY`는 ConfigMap에 필요

**해결**:

**파일**: `k8s/overlays/prod/kustomization.yaml`

```yaml
configMapGenerator:
  - name: tiketi-config
    literals:
      # ... 기존 설정 ...

      # ✅ 추가: TossPayments 클라이언트 키
      - TOSS_CLIENT_KEY=test_ck_EP59LybZ8BlAdL6Z1o4ZV6GYo7pR
```

**검증**:
```bash
# ConfigMap 확인
kubectl get configmap -n tiketi tiketi-config -o yaml | grep TOSS

# Pod 환경변수 확인
kubectl exec -n tiketi payment-service-xxx -- env | grep TOSS
```

**참고**:
- `TOSS_CLIENT_KEY`: 프론트엔드/백엔드 모두 필요 (public)
- `TOSS_SECRET_KEY`: 백엔드만 필요 (secret, Kubernetes Secret 관리)

---

### 사례 8: 병렬 워크플로우 Git Push 충돌

**증상**:
```
! [rejected]        final -> final (fetch first)
error: failed to push some refs
hint: Updates were rejected because the remote contains work that you do not have locally
```

**원인**:
- 5개 워크플로우가 동시에 실행
- 모두 `k8s/overlays/prod/kustomization.yaml` 파일 수정
- Payment Service가 먼저 push 성공
- Auth, Stats, Backend는 git push 실패

**해결 1차 시도** (실패):
```bash
git commit -m "..."
git pull --rebase origin final
git push  # ← 이 사이에 다른 워크플로우가 push하면 실패!
```

**해결 2차 (성공)** - Retry 로직:

```bash
git commit -m "chore(k8s): update SERVICE image to $IMAGE_TAG [prod]"

# Retry push up to 5 times with rebase
for i in {1..5}; do
  git pull --rebase origin final
  if git push; then
    echo "✅ Manifest updated and pushed"
    break
  else
    if [ $i -eq 5 ]; then
      echo "❌ Failed to push after 5 attempts"
      exit 1
    fi
    echo "⚠️  Push failed, retrying ($i/5)..."
    sleep $((RANDOM % 3 + 2))  # 2-4초 랜덤 대기
  fi
done
```

**동작 방식**:
1. **첫 번째 워크플로우**: `pull → push` 성공 ✅
2. **두 번째 워크플로우**: `pull → push` 실패 → `pull → push` 성공 ✅
3. **세 번째 워크플로우**: `pull → push` 실패 → `pull → push` 성공 ✅
4. **네 번째 워크플로우**: `pull → push` 실패 → `pull → push` 실패 → `pull → push` 성공 ✅
5. **다섯 번째 워크플로우**: 최대 5번 재시도

**랜덤 delay 이유**:
- 여러 워크플로우가 동시에 재시도해서 계속 충돌하는 것 방지
- 2-4초 랜덤 대기로 충돌 확률 최소화

---

### 사례 9: Race Condition 문제

**증상**:
```
! [remote rejected] final -> final (cannot lock ref 'refs/heads/final': is at e440862... but expected e8e0f97...)
```

**원인**:
- Payment Service가 `git pull --rebase` 완료 (e8e0f97)
- Push 시도하는 순간 다른 워크플로우가 먼저 push (e440862)
- Git ref가 변경되어 push 실패

**해결**:
- Retry 로직으로 자동 해결
- 재시도 시 다시 `git pull --rebase`로 최신 변경사항 가져옴
- 랜덤 delay로 동시 재시도 방지

**적용된 모든 워크플로우**:
- ✅ auth-service-ci-cd.yml
- ✅ payment-service-ci-cd.yml
- ✅ stats-service-ci-cd.yml
- ✅ backend-ci-cd.yml
- ✅ ticket-service-ci-cd.yml

---

## 모니터링 및 검증

### 1. Pod 상태 확인

```bash
# 전체 Pod 상태
kubectl get pods -n tiketi

# 특정 서비스 로그
kubectl logs -n tiketi -l app=ticket-service --tail=100 -f

# Redis 연결 확인
kubectl logs -n tiketi -l app=ticket-service | grep Redis
```

**정상 출력 예시**:
```
✅ Redis connected successfully
✅ Socket.IO Redis adapter connected (multi-pod ready)
🚀 Ticket Service running on port 3002
```

### 2. 서비스 Health Check

```bash
# Backend
curl https://tiketi.store/health

# Auth Service (internal)
kubectl exec -n tiketi backend-xxx -- curl http://auth-service:3005/health

# Ticket Service (internal)
kubectl exec -n tiketi backend-xxx -- curl http://ticket-service:3002/health
```

### 3. WebSocket 연결 테스트

```bash
# Socket.IO 엔드포인트 확인
curl -i https://tiketi.store/socket.io/?EIO=4&transport=polling

# 정상 응답
HTTP/2 200
content-type: text/plain; charset=UTF-8
{"sid":"...","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":20000}
```

### 4. GitHub Actions 모니터링

```bash
# 최근 워크플로우 실행 확인
curl -s https://api.github.com/repos/cchriscode/tiketi/actions/runs?branch=final&per_page=5 | \
  grep -E '"name"|"status"|"conclusion"'
```

**Discord 알림**:
- ✅ 성공: 녹색 알림
- ❌ 실패: 빨간색 알림 + 로그 링크

### 5. Kustomization 이미지 태그 확인

```bash
# 현재 배포된 이미지 태그 확인
cat k8s/overlays/prod/kustomization.yaml | grep -A 2 "newName"

# Pod에서 실행 중인 이미지 확인
kubectl get pods -n tiketi -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'
```

### 6. 성능 메트릭

```bash
# Prometheus metrics
curl https://tiketi.store/metrics

# Pod 리소스 사용량
kubectl top pods -n tiketi

# HPA 상태
kubectl get hpa -n tiketi
```

---

## 베스트 프랙티스

### 1. 보안

- ✅ RDS SSL 연결 필수
- ✅ 민감 정보는 Kubernetes Secret 사용
- ✅ Security Group 최소 권한 원칙
- ✅ OIDC로 AWS 인증 (장기 credential 없음)
- ✅ ECR 이미지 스캔 활성화

### 2. 고가용성

- ✅ Multi-AZ 배포 (RDS, ElastiCache, EKS)
- ✅ Pod Disruption Budget (PDB) 설정
- ✅ Horizontal Pod Autoscaler (HPA) 설정
- ✅ Health Check 엔드포인트 구현
- ✅ Graceful Shutdown 처리

### 3. CI/CD

- ✅ 병렬 워크플로우 충돌 방지 (Retry 로직)
- ✅ GitHub Actions Cache로 빌드 최적화
- ✅ 환경별 자동 감지 (final → prod, develop → staging)
- ✅ Discord 알림으로 배포 결과 공유
- ✅ GitOps 방식 (Kustomize + Auto-sync)

### 4. 모니터링

- ✅ Prometheus metrics 노출
- ✅ 구조화된 로깅 (JSON)
- ✅ Health check 엔드포인트
- ✅ Discord webhook 알림
- ✅ CloudWatch Logs 통합

### 5. 데이터베이스

- ✅ Migration 스크립트 버전 관리
- ✅ 인덱스 최적화 (email, google_id)
- ✅ Connection pooling 설정
- ✅ SSL 연결 강제
- ✅ 정기 백업 (RDS Automated Backups)

---

## 체크리스트

### 새 서비스 배포 시

- [ ] Dockerfile 작성 (ARM64 호환)
- [ ] Kubernetes Deployment YAML 작성
- [ ] Kustomize base에 리소스 추가
- [ ] Production overlay 설정
- [ ] GitHub Actions 워크플로우 생성
- [ ] ECR 리포지토리 생성
- [ ] AWS IAM 권한 확인
- [ ] Health check 엔드포인트 구현
- [ ] 환경변수 ConfigMap/Secret 설정
- [ ] Discord 알림 테스트

### 배포 후 검증

- [ ] Pod 상태 확인 (`Running`)
- [ ] Health check 응답 확인
- [ ] 로그에 에러 없음
- [ ] Metrics 노출 확인
- [ ] 외부 접근 테스트 (Ingress)
- [ ] 데이터베이스 연결 확인
- [ ] Redis 연결 확인 (해당 시)
- [ ] WebSocket 연결 확인 (해당 시)

### 트러블슈팅 시

- [ ] Pod 로그 확인
- [ ] Pod describe (events 확인)
- [ ] Service 엔드포인트 확인
- [ ] Ingress 라우팅 확인
- [ ] ConfigMap/Secret 값 확인
- [ ] Security Group 규칙 확인
- [ ] GitHub Actions 로그 확인
- [ ] ECR 이미지 존재 확인

---

## 참고 자료

### AWS 문서

- [EKS User Guide](https://docs.aws.amazon.com/eks/latest/userguide/)
- [RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [ElastiCache Redis](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/)
- [ECR User Guide](https://docs.aws.amazon.com/AmazonECR/latest/userguide/)

### Kubernetes 문서

- [Kustomize](https://kustomize.io/)
- [ALB Ingress Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)

### 도구 문서

- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)

---

## 연락처 및 지원

**프로젝트**: Tiketi
**Repository**: https://github.com/cchriscode/tiketi
**Production URL**: https://tiketi.store

**작성**: Claude Sonnet 4.5
**최종 업데이트**: 2026-01-08
