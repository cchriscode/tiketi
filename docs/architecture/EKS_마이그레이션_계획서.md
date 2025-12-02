# 🚀 Tiketi EKS 마이그레이션 상세 계획서

> **티켓팅 서비스 특성에 최적화된 Kubernetes 아키텍처 설계**

## 📋 목차

1. [현재 아키텍처 분석](#1-현재-아키텍처-분석)
2. [문제점 및 요구사항](#2-문제점-및-요구사항)
3. [EKS 아키텍처 설계](#3-eks-아키텍처-설계)
4. [티켓팅 특성에 맞는 최적화](#4-티켓팅-특성에-맞는-최적화)
5. [마이그레이션 로드맵](#5-마이그레이션-로드맵)
6. [비용 분석](#6-비용-분석)

---

## 1. 현재 아키텍처 분석

### 1.1 현재 구성 (Docker Compose)

```
┌─────────────────────────────────────────┐
│         Docker Compose 환경              │
│                                         │
│  ┌──────────┐  ┌──────────┐           │
│  │ Frontend │  │ Backend  │           │
│  │  React   │  │ Node.js  │           │
│  │  :3000   │  │  :3001   │           │
│  └──────────┘  └────┬─────┘           │
│                     │                  │
│         ┌───────────┴────────┐        │
│         ▼                    ▼        │
│  ┌─────────────┐      ┌──────────┐   │
│  │ PostgreSQL  │      │ Dragonfly│   │
│  │   :5432     │      │   :6379  │   │
│  └─────────────┘      └──────────┘   │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │   Monitoring Stack              │ │
│  │   Prometheus | Grafana | Loki   │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 1.2 주요 컴포넌트

| 컴포넌트 | 기술 스택 | 현재 배포 방식 | 리소스 |
|---------|----------|--------------|--------|
| **Frontend** | React 18 | Docker Container | 단일 컨테이너 |
| **Backend** | Node.js 18 + Express | Docker Container | 단일 컨테이너 |
| **Database** | PostgreSQL 15 | Docker Volume | 단일 인스턴스 |
| **Cache** | DragonflyDB (Redis) | Docker Container | 단일 인스턴스 |
| **WebSocket** | Socket.IO + Redis Adapter | Backend 내장 | N/A |
| **Monitoring** | Prometheus, Grafana, Loki | Docker Compose | 로컬 |

---

## 2. 문제점 및 요구사항

### 2.1 현재 아키텍처의 문제점

#### 🚨 Critical Issues

| 문제 | 현재 상태 | 비즈니스 임팩트 | 우선순위 |
|-----|----------|----------------|---------|
| **단일 장애점 (SPOF)** | Backend 1개 Pod 장애 시 전체 서비스 중단 | 🔴 매출 손실 | P0 |
| **수평 확장 불가** | 수동 스케일링만 가능 | 🔴 티켓 오픈 시 접속 불가 | P0 |
| **WebSocket 세션 유실** | 재배포 시 모든 연결 끊김 | 🟡 사용자 경험 저하 | P1 |
| **DB 확장성 부족** | PostgreSQL 단일 인스턴스 | 🟡 성능 병목 | P1 |
| **자동 복구 없음** | 컨테이너 죽으면 수동 재시작 | 🔴 가용성 저하 | P0 |
| **리소스 비효율** | 고정된 리소스 할당 | 🟢 비용 낭비 | P2 |

#### 📊 티켓팅 서비스 특성

```
티켓 오픈 시나리오:

T-30분: 평균 접속자 1,000명 (대기)
T-10분: 평균 접속자 5,000명 (급증)
T-0분:  평균 접속자 50,000명 (폭발적 증가)
T+5분:  평균 접속자 20,000명 (구매 진행 중)
T+30분: 평균 접속자 3,000명 (구매 완료)

현재 시스템 처리 능력: 1,000 TPS (단일 Backend)
필요 처리 능력: 10,000 TPS (티켓 오픈 시)
```

### 2.2 요구사항 정의

#### 기능 요구사항

| 요구사항 | 목표 | 현재 | 우선순위 |
|---------|------|------|---------|
| **최대 동시 접속자** | 100,000명 | 1,000명 | P0 |
| **TPS (Transactions Per Second)** | 10,000 | 100 | P0 |
| **WebSocket 동시 연결** | 50,000 | 500 | P0 |
| **API 응답 시간 (P95)** | < 200ms | 500ms | P1 |
| **가용성 (SLA)** | 99.9% | 95% | P0 |
| **배포 중단 시간** | 0초 (무중단) | 5분 | P1 |

#### 비기능 요구사항

1. **자동 스케일링**: 트래픽에 따라 1분 이내 자동 확장
2. **자동 복구**: Pod 장애 시 30초 이내 자동 재시작
3. **WebSocket 세션 유지**: 배포 시에도 연결 유지
4. **대기열 기반 스케일링**: Redis 대기열 크기 기반 예측 스케일링
5. **Multi-AZ 배포**: 가용 영역 장애에도 서비스 지속

---

## 3. EKS 아키텍처 설계

### 3.1 전체 아키텍처 개요

```
                          Internet
                             │
                             │
                  ┌──────────▼──────────┐
                  │   Route 53 (DNS)    │
                  │    tiketi.gg        │
                  └──────────┬──────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
   ┌──────────▼─────────┐        ┌─────────▼────────┐
   │   CloudFront       │        │  AWS Global      │
   │   (Static Files)   │        │  Accelerator     │
   │                    │        │  (WebSocket)     │
   └──────────┬─────────┘        └─────────┬────────┘
              │                             │
   ┌──────────▼─────────┐        ┌─────────▼────────┐
   │   S3 Bucket        │        │   NLB            │
   │   Frontend Build   │        │   (Layer 4)      │
   └────────────────────┘        │   Sticky Session │
                                 └─────────┬────────┘
                                           │
        ┌──────────────────────────────────┴────────────────┐
        │                   VPC (10.0.0.0/16)               │
        │                                                   │
        │  ┌─────────────────────────────────────────────┐ │
        │  │         EKS Cluster (k8s 1.28)              │ │
        │  │                                             │ │
        │  │  ┌────────────────────────────────────┐    │ │
        │  │  │    Managed Node Group (Spot)       │    │ │
        │  │  │    - t3.medium × 2~10 nodes        │    │ │
        │  │  │    - Cluster Autoscaler            │    │ │
        │  │  └────────────────────────────────────┘    │ │
        │  │                                             │ │
        │  │  ┌──────────────────────────────────────┐  │ │
        │  │  │     Backend Pods (Node.js)           │  │ │
        │  │  │     - Deployment: 2~50 replicas      │  │ │
        │  │  │     - HPA (CPU 70%, Memory 70%,      │  │ │
        │  │  │            Queue Size)               │  │ │
        │  │  │     - Resources: 500m CPU, 1Gi RAM   │  │ │
        │  │  └──────────────────────────────────────┘  │ │
        │  │                                             │ │
        │  │  ┌──────────────────────────────────────┐  │ │
        │  │  │     Supporting Services              │  │ │
        │  │  │     - Metrics Server                 │  │ │
        │  │  │     - Cluster Autoscaler             │  │ │
        │  │  │     - AWS Load Balancer Controller   │  │ │
        │  │  │     - External DNS                   │  │ │
        │  │  └──────────────────────────────────────┘  │ │
        │  └─────────────────────────────────────────────┘ │
        │                                                   │
        │  ┌──────────────────────────────────────────┐    │
        │  │         Data Layer                       │    │
        │  │                                          │    │
        │  │  ┌────────────────┐  ┌────────────────┐ │    │
        │  │  │ RDS PostgreSQL │  │  ElastiCache   │ │    │
        │  │  │   Multi-AZ     │  │  Redis Cluster │ │    │
        │  │  │  db.r6g.large  │  │  cache.r6g.large│ │   │
        │  │  │  Primary +     │  │  3 shards ×    │ │    │
        │  │  │  Standby       │  │  2 replicas    │ │    │
        │  │  └────────────────┘  └────────────────┘ │    │
        │  └──────────────────────────────────────────┘    │
        └───────────────────────────────────────────────────┘
```

### 3.2 EKS Cluster 설정

#### Cluster 기본 구성

```yaml
# cluster-config.yaml (eksctl)
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: tiketi-prod-cluster
  region: ap-northeast-2
  version: "1.28"

vpc:
  cidr: 10.0.0.0/16
  nat:
    gateway: HighlyAvailable  # Multi-AZ NAT Gateway

availabilityZones:
  - ap-northeast-2a
  - ap-northeast-2b
  - ap-northeast-2c

# IAM OIDC Provider (필수: IRSA 사용)
iam:
  withOIDC: true
  serviceAccounts:
    - metadata:
        name: cluster-autoscaler
        namespace: kube-system
      wellKnownPolicies:
        autoScaler: true
    - metadata:
        name: aws-load-balancer-controller
        namespace: kube-system
      wellKnownPolicies:
        awsLoadBalancerController: true
    - metadata:
        name: external-dns
        namespace: kube-system
      wellKnownPolicies:
        externalDNS: true

# Managed Node Group
managedNodeGroups:
  # 1. On-Demand Node Group (안정성 우선)
  - name: tiketi-ng-ondemand
    instanceType: t3.medium
    desiredCapacity: 2
    minSize: 2
    maxSize: 5
    volumeSize: 30
    volumeType: gp3
    labels:
      role: stable
      workload: backend
    tags:
      k8s.io/cluster-autoscaler/enabled: "true"
      k8s.io/cluster-autoscaler/tiketi-prod-cluster: "owned"
    iam:
      withAddonPolicies:
        autoScaler: true
        cloudWatch: true
        ebs: true

  # 2. Spot Node Group (비용 절감)
  - name: tiketi-ng-spot
    instanceTypes:
      - t3.medium
      - t3a.medium
      - t2.medium
    spot: true
    desiredCapacity: 0
    minSize: 0
    maxSize: 10
    volumeSize: 30
    volumeType: gp3
    labels:
      role: scalable
      workload: backend
    taints:
      - key: spot
        value: "true"
        effect: NoSchedule
    tags:
      k8s.io/cluster-autoscaler/enabled: "true"
      k8s.io/cluster-autoscaler/tiketi-prod-cluster: "owned"

# CloudWatch Logging
cloudWatch:
  clusterLogging:
    enableTypes:
      - api
      - audit
      - authenticator
      - controllerManager
      - scheduler
```

### 3.3 Node Group 전략

#### 노드 타입별 역할

| Node Group | 타입 | 용도 | 최소/최대 | 워크로드 |
|-----------|------|------|----------|---------|
| **tiketi-ng-ondemand** | On-Demand | 안정적인 서비스 유지 | 2 / 5 | 핵심 Backend Pods |
| **tiketi-ng-spot** | Spot | 트래픽 급증 대응 | 0 / 10 | 스케일 아웃 시 추가 Pods |

#### 노드 리소스 계산

```
t3.medium 스펙:
- vCPU: 2 cores
- Memory: 4 GB
- Network: Up to 5 Gbps

가용 리소스 (Kubernetes 오버헤드 제외):
- Allocatable CPU: 1.93 vCPU (약 1930m)
- Allocatable Memory: 3.5 GB (약 3584 MiB)

Backend Pod 리소스 요청:
- CPU Request: 500m (0.5 vCPU)
- Memory Request: 1024Mi (1 GB)
- CPU Limit: 1000m (1 vCPU)
- Memory Limit: 2048Mi (2 GB)

노드당 Pod 수:
- CPU 기준: 1930m ÷ 500m = 3.86 → 3 Pods
- Memory 기준: 3584Mi ÷ 1024Mi = 3.5 → 3 Pods
- 결론: t3.medium 1대당 Backend Pod 3개 배치 가능
```

---

## 4. 티켓팅 특성에 맞는 최적화

### 4.1 트래픽 패턴 분석

#### 티켓팅 서비스의 트래픽 특성

```
┌────────────────────────────────────────────────────────┐
│         티켓 오픈 시 트래픽 패턴                         │
│                                                        │
│  동시접속자                                             │
│    50k ┤                    ╭─╮                       │
│        │                   ╱   ╲                      │
│    40k ┤                  ╱     ╲                     │
│        │                 ╱       ╲                    │
│    30k ┤                ╱         ╲                   │
│        │               ╱           ╲                  │
│    20k ┤         ╭────╯             ╰────╮           │
│        │        ╱                         ╲          │
│    10k ┤    ╭──╯                           ╰──╮      │
│        │   ╱                                   ╲     │
│     5k ┤──╯                                     ╰─── │
│        │                                             │
│        └─┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬─ │
│         T-30 T-20 T-10 T-0  T+5 T+10T+20T+30T+60    │
│                       (분)                           │
└────────────────────────────────────────────────────────┘

핵심 구간:
- T-30 ~ T-10: 점진적 증가 (Pre-warming 필요)
- T-10 ~ T-0:  급격한 증가 (예측 스케일링 필수)
- T-0 ~ T+5:   피크 구간 (최대 리소스 필요)
- T+5 ~ T+30:  점진적 감소 (Scale-In 시작)
```

### 4.2 파드 리소스 할당 전략

#### Backend Pod 리소스 설정

```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiketi-backend
  namespace: tiketi-prod
  labels:
    app: backend
    tier: application
spec:
  replicas: 2  # HPA가 관리
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 50%        # 피크 시간 빠른 스케일 아웃
      maxUnavailable: 0    # 무중단 배포 보장
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3001"
        prometheus.io/path: "/metrics"
    spec:
      # Node Affinity: Spot과 On-Demand 모두 사용
      affinity:
        nodeAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            # On-Demand 노드 선호 (가중치 100)
            - weight: 100
              preference:
                matchExpressions:
                  - key: role
                    operator: In
                    values:
                      - stable
            # Spot 노드도 사용 가능 (가중치 50)
            - weight: 50
              preference:
                matchExpressions:
                  - key: role
                    operator: In
                    values:
                      - scalable

        # Pod Anti-Affinity: 같은 노드에 여러 Pod 분산
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - backend
                topologyKey: kubernetes.io/hostname

      # Spot 노드의 Taint 허용
      tolerations:
        - key: spot
          operator: Equal
          value: "true"
          effect: NoSchedule

      containers:
        - name: backend
          image: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend:latest
          imagePullPolicy: Always

          ports:
            - name: http
              containerPort: 3001
              protocol: TCP

          # ✅ 리소스 요청/제한 (티켓팅 특성 반영)
          resources:
            requests:
              cpu: 500m        # 0.5 vCPU (최소 보장)
              memory: 1024Mi   # 1 GB (최소 보장)
            limits:
              cpu: 1000m       # 1 vCPU (최대 사용)
              memory: 2048Mi   # 2 GB (최대 사용)

          # ✅ Health Check (중요!)
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3

          # Graceful Shutdown (WebSocket 연결 정리)
          lifecycle:
            preStop:
              exec:
                command:
                  - /bin/sh
                  - -c
                  - |
                    # WebSocket 연결에게 재연결 알림 전송
                    echo "Graceful shutdown starting..."
                    # 30초 대기 (클라이언트 재연결 시간)
                    sleep 30

          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3001"

            # PostgreSQL 연결
            - name: DB_HOST
              valueFrom:
                secretKeyRef:
                  name: tiketi-secrets
                  key: db-host
            - name: DB_PORT
              value: "5432"
            - name: DB_NAME
              valueFrom:
                secretKeyRef:
                  name: tiketi-secrets
                  key: db-name
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: tiketi-secrets
                  key: db-user
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: tiketi-secrets
                  key: db-password

            # Redis 연결
            - name: REDIS_HOST
              valueFrom:
                secretKeyRef:
                  name: tiketi-secrets
                  key: redis-host
            - name: REDIS_PORT
              value: "6379"

            # JWT Secret
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: tiketi-secrets
                  key: jwt-secret

            # Pod 정보 (로깅용)
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: POD_IP
              valueFrom:
                fieldRef:
                  fieldPath: status.podIP

      # Termination Grace Period (WebSocket 연결 정리)
      terminationGracePeriodSeconds: 60
```

### 4.3 Horizontal Pod Autoscaler (HPA) 설정

#### 티켓팅 특성 반영 HPA

```yaml
# backend-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tiketi-backend-hpa
  namespace: tiketi-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tiketi-backend

  minReplicas: 2   # 최소 2개 (고가용성)
  maxReplicas: 50  # 최대 50개 (극한 트래픽 대응)

  # ✅ 스케일링 동작 (티켓팅 특성 반영)
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0  # 즉시 스케일 아웃 (대기 없음)
      policies:
        - type: Percent
          value: 100        # 현재 Pod 수의 100% 추가 (2배로 증가)
          periodSeconds: 15  # 15초마다 평가
        - type: Pods
          value: 10         # 한 번에 최대 10개 Pod 추가
          periodSeconds: 15
      selectPolicy: Max     # 가장 적극적인 정책 선택

    scaleDown:
      stabilizationWindowSeconds: 300  # 5분 대기 (급격한 축소 방지)
      policies:
        - type: Percent
          value: 50         # 현재 Pod 수의 50%만 제거
          periodSeconds: 60  # 1분마다 평가
        - type: Pods
          value: 5          # 한 번에 최대 5개 Pod 제거
          periodSeconds: 60
      selectPolicy: Min     # 가장 보수적인 정책 선택

  # ✅ 메트릭 기반 스케일링
  metrics:
    # 1. CPU 사용률 (기본)
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70  # CPU 70% 시 스케일 아웃

    # 2. Memory 사용률 (기본)
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 70  # Memory 70% 시 스케일 아웃

    # 3. 커스텀 메트릭: 대기열 크기 (티켓팅 특화)
    - type: External
      external:
        metric:
          name: redis_queue_size
          selector:
            matchLabels:
              app: tiketi
        target:
          type: AverageValue
          averageValue: "100"  # Pod당 대기열 100명 처리
```

#### 커스텀 메트릭 수집 (Redis Queue Size)

```yaml
# custom-metrics-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiketi-metrics-collector
  namespace: tiketi-prod
spec:
  replicas: 1
  selector:
    matchLabels:
      app: metrics-collector
  template:
    metadata:
      labels:
        app: metrics-collector
    spec:
      containers:
        - name: collector
          image: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-metrics-collector:latest
          env:
            - name: REDIS_HOST
              valueFrom:
                secretKeyRef:
                  name: tiketi-secrets
                  key: redis-host
            - name: REDIS_PORT
              value: "6379"
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 200m
              memory: 256Mi
```

**메트릭 수집 스크립트** (컨테이너 내부):

```javascript
// metrics-collector/index.js
const express = require('express');
const Redis = require('redis');
const promClient = require('prom-client');

const app = express();
const redis = Redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

// Prometheus 레지스트리
const register = new promClient.Registry();

// 커스텀 메트릭: 대기열 크기
const queueSizeGauge = new promClient.Gauge({
  name: 'redis_queue_size',
  help: 'Total number of users in queue across all events',
  labelNames: ['app'],
  registers: [register]
});

// 1분마다 대기열 크기 수집
setInterval(async () => {
  try {
    // 모든 이벤트의 대기열 크기 합산
    const eventIds = await redis.sMembers('active-events');
    let totalQueueSize = 0;

    for (const eventId of eventIds) {
      const size = await redis.zCard(`queue:event:${eventId}`);
      totalQueueSize += size;
    }

    queueSizeGauge.set({ app: 'tiketi' }, totalQueueSize);
    console.log(`[Metrics] Queue size: ${totalQueueSize}`);
  } catch (error) {
    console.error('[Metrics] Error:', error);
  }
}, 60000); // 1분마다

// Prometheus 메트릭 엔드포인트
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(8080, () => {
  console.log('Metrics collector running on port 8080');
});
```

### 4.4 Cluster Autoscaler 설정

```yaml
# cluster-autoscaler-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
  labels:
    app: cluster-autoscaler
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cluster-autoscaler
  template:
    metadata:
      labels:
        app: cluster-autoscaler
    spec:
      serviceAccountName: cluster-autoscaler
      containers:
        - name: cluster-autoscaler
          image: registry.k8s.io/autoscaling/cluster-autoscaler:v1.28.0
          command:
            - ./cluster-autoscaler
            - --v=4
            - --stderrthreshold=info
            - --cloud-provider=aws
            - --skip-nodes-with-local-storage=false
            - --expander=least-waste
            - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/tiketi-prod-cluster
            - --balance-similar-node-groups
            - --skip-nodes-with-system-pods=false
            # 티켓팅 특성: 빠른 스케일 아웃
            - --scale-down-delay-after-add=5m
            - --scale-down-unneeded-time=5m
            - --scale-down-utilization-threshold=0.5
          resources:
            requests:
              cpu: 100m
              memory: 300Mi
            limits:
              cpu: 100m
              memory: 300Mi
          env:
            - name: AWS_REGION
              value: ap-northeast-2
```

### 4.5 Service 설정 (WebSocket Sticky Session)

#### NLB (Network Load Balancer) - WebSocket 최적화

```yaml
# backend-service-nlb.yaml
apiVersion: v1
kind: Service
metadata:
  name: tiketi-backend-nlb
  namespace: tiketi-prod
  annotations:
    # NLB 설정 (Layer 4, WebSocket 최적화)
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-scheme: "internet-facing"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"

    # Sticky Session (WebSocket 유지)
    service.beta.kubernetes.io/aws-load-balancer-target-group-attributes: "stickiness.enabled=true,stickiness.type=source_ip"

    # Health Check
    service.beta.kubernetes.io/aws-load-balancer-healthcheck-protocol: "HTTP"
    service.beta.kubernetes.io/aws-load-balancer-healthcheck-path: "/health"
    service.beta.kubernetes.io/aws-load-balancer-healthcheck-port: "3001"
    service.beta.kubernetes.io/aws-load-balancer-healthcheck-interval: "10"
    service.beta.kubernetes.io/aws-load-balancer-healthcheck-timeout: "5"
    service.beta.kubernetes.io/aws-load-balancer-healthcheck-healthy-threshold: "2"
    service.beta.kubernetes.io/aws-load-balancer-healthcheck-unhealthy-threshold: "2"

    # Connection Draining (Graceful Shutdown)
    service.beta.kubernetes.io/aws-load-balancer-connection-draining-enabled: "true"
    service.beta.kubernetes.io/aws-load-balancer-connection-draining-timeout: "60"

    # External DNS
    external-dns.alpha.kubernetes.io/hostname: "api.tiketi.gg"

spec:
  type: LoadBalancer
  selector:
    app: backend
  ports:
    - name: http
      port: 80
      targetPort: 3001
      protocol: TCP
    - name: https
      port: 443
      targetPort: 3001
      protocol: TCP
  sessionAffinity: ClientIP  # K8s 레벨 Sticky Session
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 3600  # 1시간
```

### 4.6 배포 전략

#### Rolling Update (기본 배포)

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 50%        # 기존 Pod의 50% 추가 생성 가능
    maxUnavailable: 0    # 항상 최소 replicas 유지 (무중단)
```

**동작 방식**:
```
시나리오: 10개 Pod 업데이트

1. maxSurge=50% → 5개 신규 Pod 생성 (총 15개)
2. 신규 5개 Ready → 기존 5개 Terminate
3. 추가 5개 신규 Pod 생성 (총 15개)
4. 신규 5개 Ready → 나머지 기존 5개 Terminate
5. 완료 (총 10개, 모두 신규 버전)

장점: 무중단 배포, WebSocket 연결 최소 영향
단점: 일시적 리소스 1.5배 필요
```

#### Blue/Green 배포 (선택적, 중요 업데이트 시)

```yaml
# 1. Green Deployment 생성
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiketi-backend-green
  namespace: tiketi-prod
spec:
  replicas: 10
  selector:
    matchLabels:
      app: backend
      version: green
  template:
    metadata:
      labels:
        app: backend
        version: green
    spec:
      # ... (동일한 spec)
---
# 2. Service 트래픽 전환
apiVersion: v1
kind: Service
metadata:
  name: tiketi-backend-nlb
spec:
  selector:
    app: backend
    version: green  # Blue → Green 전환
```

**전환 시나리오**:
```
1. Green Deployment 배포 (기존 Blue와 별도)
2. Green이 모두 Ready 상태 확인
3. Service selector를 Blue → Green 전환
4. 트래픽 모니터링 (5분)
5. 문제 없으면 Blue Deployment 삭제
6. 문제 발생 시 즉시 Blue로 롤백
```

---

## 5. 마이그레이션 로드맵

### 5.1 Phase 1: 인프라 준비 (Week 1-2)

#### Week 1: VPC 및 EKS Cluster 구축

**Day 1-2: VPC 및 네트워크**

```bash
# 1. VPC 생성 (eksctl이 자동 생성하지만 수동 설정도 가능)
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=tiketi-vpc}]'

# 2. Subnet 생성 (Public × 3, Private × 3)
# Public Subnet (NAT Gateway, Load Balancer)
aws ec2 create-subnet --vpc-id <VPC_ID> --cidr-block 10.0.1.0/24 --availability-zone ap-northeast-2a
aws ec2 create-subnet --vpc-id <VPC_ID> --cidr-block 10.0.2.0/24 --availability-zone ap-northeast-2b
aws ec2 create-subnet --vpc-id <VPC_ID> --cidr-block 10.0.3.0/24 --availability-zone ap-northeast-2c

# Private Subnet (EKS Nodes, Pods)
aws ec2 create-subnet --vpc-id <VPC_ID> --cidr-block 10.0.11.0/24 --availability-zone ap-northeast-2a
aws ec2 create-subnet --vpc-id <VPC_ID> --cidr-block 10.0.12.0/24 --availability-zone ap-northeast-2b
aws ec2 create-subnet --vpc-id <VPC_ID> --cidr-block 10.0.13.0/24 --availability-zone ap-northeast-2c

# 3. Internet Gateway 생성
aws ec2 create-internet-gateway
aws ec2 attach-internet-gateway --vpc-id <VPC_ID> --internet-gateway-id <IGW_ID>

# 4. NAT Gateway 생성 (Multi-AZ)
aws ec2 allocate-address --domain vpc  # EIP for NAT-A
aws ec2 create-nat-gateway --subnet-id <PUBLIC_SUBNET_A> --allocation-id <EIP_A>
aws ec2 create-nat-gateway --subnet-id <PUBLIC_SUBNET_B> --allocation-id <EIP_B>
```

**Day 3-5: EKS Cluster 생성**

```bash
# eksctl로 Cluster 생성 (권장)
eksctl create cluster -f cluster-config.yaml

# 생성 확인 (약 15-20분 소요)
kubectl get nodes
kubectl get pods -A
```

**Day 6-7: Add-on 설치**

```bash
# 1. AWS Load Balancer Controller
kubectl apply -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller//crds?ref=master"
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=tiketi-prod-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller

# 2. Metrics Server (HPA 필수)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 3. Cluster Autoscaler
kubectl apply -f cluster-autoscaler-deployment.yaml

# 4. External DNS (선택)
kubectl apply -f external-dns-deployment.yaml

# 5. Prometheus + Grafana (모니터링)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace
```

---

#### Week 2: 데이터베이스 마이그레이션

**Day 1-3: RDS PostgreSQL 구축**

```bash
# 1. DB Subnet Group 생성
aws rds create-db-subnet-group \
  --db-subnet-group-name tiketi-db-subnet \
  --db-subnet-group-description "Tiketi DB Subnet Group" \
  --subnet-ids subnet-xxx subnet-yyy subnet-zzz

# 2. RDS 인스턴스 생성
aws rds create-db-instance \
  --db-instance-identifier tiketi-prod-db \
  --db-instance-class db.r6g.large \
  --engine postgres \
  --engine-version 15.4 \
  --master-username tiketi_admin \
  --master-user-password <STRONG_PASSWORD> \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --multi-az \
  --db-subnet-group-name tiketi-db-subnet \
  --vpc-security-group-ids sg-xxx \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "Mon:04:00-Mon:05:00" \
  --enable-performance-insights \
  --performance-insights-retention-period 7 \
  --tags Key=Name,Value=tiketi-prod-db

# 3. Read Replica 생성 (선택)
aws rds create-db-instance-read-replica \
  --db-instance-identifier tiketi-prod-db-replica \
  --source-db-instance-identifier tiketi-prod-db \
  --db-instance-class db.r6g.large
```

**Day 4-5: 데이터 마이그레이션**

```bash
# 1. 기존 PostgreSQL 백업
docker exec tiketi-postgres pg_dump -U tiketi_user tiketi_db > tiketi_backup.sql

# 2. RDS로 복원
psql -h <RDS_ENDPOINT> -U tiketi_admin -d tiketi_db < tiketi_backup.sql

# 3. 연결 테스트
psql -h <RDS_ENDPOINT> -U tiketi_admin -d tiketi_db -c "SELECT COUNT(*) FROM events;"
```

**Day 6-7: ElastiCache Redis 구축**

```bash
# 1. Cache Subnet Group 생성
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name tiketi-redis-subnet \
  --cache-subnet-group-description "Tiketi Redis Subnet" \
  --subnet-ids subnet-xxx subnet-yyy subnet-zzz

# 2. Redis Cluster 생성
aws elasticache create-replication-group \
  --replication-group-id tiketi-prod-redis \
  --replication-group-description "Tiketi Production Redis" \
  --engine redis \
  --engine-version 7.0 \
  --cache-node-type cache.r6g.large \
  --num-node-groups 3 \
  --replicas-per-node-group 2 \
  --cache-subnet-group-name tiketi-redis-subnet \
  --security-group-ids sg-yyy \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token <REDIS_PASSWORD> \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --snapshot-retention-limit 3 \
  --snapshot-window "04:00-05:00"

# 3. 연결 테스트
redis-cli -h <REDIS_ENDPOINT> -a <REDIS_PASSWORD> PING
```

---

### 5.2 Phase 2: 애플리케이션 컨테이너화 (Week 3)

**Day 1-2: Dockerfile 최적화**

```dockerfile
# backend/Dockerfile.prod
FROM node:18-alpine AS builder

WORKDIR /app

# 의존성 설치 (캐싱 최적화)
COPY package*.json ./
RUN npm ci --only=production

# 소스 복사
COPY . .

# 프로덕션 이미지
FROM node:18-alpine

WORKDIR /app

# 보안: non-root 사용자
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 빌드 산출물 복사
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 3001

# Health check endpoint 확인
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "src/server.js"]
```

**Day 3-4: ECR 및 이미지 빌드**

```bash
# 1. ECR Repository 생성
aws ecr create-repository \
  --repository-name tiketi-backend \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

# 2. Docker 이미지 빌드
docker build -t tiketi-backend:latest -f backend/Dockerfile.prod backend/

# 3. ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com

# 4. 이미지 태깅 및 푸시
docker tag tiketi-backend:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend:latest
```

**Day 5-7: Kubernetes Manifests 작성**

```bash
# Kubernetes 리소스 구조
k8s/
├── base/
│   ├── namespace.yaml
│   ├── secrets.yaml
│   ├── configmap.yaml
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── backend-hpa.yaml
│   └── ingress.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml
    └── prod/
        └── kustomization.yaml
```

---

### 5.3 Phase 3: 배포 및 테스트 (Week 4)

**Day 1-2: Dev 환경 배포**

```bash
# 1. Namespace 생성
kubectl create namespace tiketi-dev

# 2. Secrets 생성
kubectl create secret generic tiketi-secrets \
  --from-literal=db-host=<RDS_ENDPOINT> \
  --from-literal=db-name=tiketi_db \
  --from-literal=db-user=tiketi_admin \
  --from-literal=db-password=<DB_PASSWORD> \
  --from-literal=redis-host=<REDIS_ENDPOINT> \
  --from-literal=jwt-secret=<JWT_SECRET> \
  -n tiketi-dev

# 3. Deployment 배포
kubectl apply -f k8s/base/backend-deployment.yaml -n tiketi-dev
kubectl apply -f k8s/base/backend-service.yaml -n tiketi-dev
kubectl apply -f k8s/base/backend-hpa.yaml -n tiketi-dev

# 4. 배포 확인
kubectl get pods -n tiketi-dev
kubectl get svc -n tiketi-dev
kubectl get hpa -n tiketi-dev
```

**Day 3-4: 부하 테스트**

```bash
# Apache Bench로 간단한 부하 테스트
ab -n 10000 -c 100 http://<NLB_ENDPOINT>/health

# K6로 WebSocket 부하 테스트
k6 run --vus 1000 --duration 5m websocket-loadtest.js
```

**k6 WebSocket 테스트 스크립트**:

```javascript
// websocket-loadtest.js
import ws from 'k6/ws';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 1000 },  // 2분간 1000명까지 증가
    { duration: '5m', target: 1000 },  // 5분간 1000명 유지
    { duration: '2m', target: 0 },     // 2분간 0명으로 감소
  ],
};

export default function () {
  const url = 'ws://<NLB_ENDPOINT>';
  const params = { tags: { my_tag: 'websocket' } };

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', () => console.log('connected'));

    socket.on('message', (data) => console.log('Message received: ', data));

    socket.on('close', () => console.log('disconnected'));

    socket.setTimeout(function () {
      socket.send(JSON.stringify({ event: 'ping' }));
    }, 1000);
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
```

**Day 5-7: Production 배포**

```bash
# 1. Production Namespace
kubectl create namespace tiketi-prod

# 2. Secrets (Production)
kubectl create secret generic tiketi-secrets \
  --from-literal=db-host=<RDS_PROD_ENDPOINT> \
  --from-literal=db-name=tiketi_db \
  --from-literal=db-user=tiketi_admin \
  --from-literal=db-password=<DB_PASSWORD> \
  --from-literal=redis-host=<REDIS_PROD_ENDPOINT> \
  --from-literal=jwt-secret=<JWT_SECRET> \
  -n tiketi-prod

# 3. Production 배포
kubectl apply -f k8s/overlays/prod/ -n tiketi-prod

# 4. DNS 전환 (Route 53)
aws route53 change-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
  --change-batch file://dns-change.json
```

---

### 5.4 Phase 4: CI/CD 구축 (Week 5)

**GitHub Actions Workflow**

```yaml
# .github/workflows/deploy-eks.yml
name: Deploy to EKS

on:
  push:
    branches:
      - main
    paths:
      - 'backend/**'

env:
  AWS_REGION: ap-northeast-2
  ECR_REPOSITORY: tiketi-backend
  EKS_CLUSTER: tiketi-prod-cluster

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
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build, tag, and push image to Amazon ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG -f backend/Dockerfile.prod backend/
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --name ${{ env.EKS_CLUSTER }} --region ${{ env.AWS_REGION }}

      - name: Deploy to EKS
        env:
          IMAGE: ${{ steps.build-image.outputs.image }}
        run: |
          kubectl set image deployment/tiketi-backend backend=$IMAGE -n tiketi-prod
          kubectl rollout status deployment/tiketi-backend -n tiketi-prod

      - name: Verify deployment
        run: |
          kubectl get pods -n tiketi-prod
          kubectl get svc -n tiketi-prod
```

---

## 6. 비용 분석

### 6.1 월간 예상 비용 (Production)

| 항목 | 서비스 | 사양 | 시간당 | 월간 (USD) | 비고 |
|-----|--------|------|--------|-----------|------|
| **EKS Control Plane** | EKS | 1 Cluster | $0.10 | $73 | 고정 비용 |
| **Worker Nodes (On-Demand)** | EC2 t3.medium | 2대 상시 | $0.0416 × 2 | $60 | 최소 가용성 |
| **Worker Nodes (Spot)** | EC2 t3.medium | 평균 3대 | $0.0125 × 3 | $27 | 70% 할인 |
| **NAT Gateway** | NAT | Multi-AZ (2대) | $0.045 × 2 | $65 | + 데이터 전송 |
| **Application Load Balancer** | NLB | 1개 | $0.0225 | $16 | + LCU 비용 |
| **RDS PostgreSQL** | db.r6g.large | Multi-AZ | $0.312 | $227 | 2 vCPU, 16GB |
| **RDS Read Replica** | db.r6g.large | Single-AZ | $0.156 | $113 | 선택 사항 |
| **ElastiCache Redis** | cache.r6g.large | 3샤드 × 2레플리카 | $0.202 × 6 | $878 | 고성능 |
| **S3** | S3 Standard | 100GB | - | $2 | 정적 파일 |
| **CloudFront** | CDN | 1TB 전송 | - | $85 | 글로벌 CDN |
| **ECR** | Container Registry | 50GB | - | $5 | 이미지 저장 |
| **CloudWatch** | Logs + Metrics | 50GB 로그 | - | $25 | 모니터링 |
| **Data Transfer** | Internet Out | 500GB | $0.09/GB | $45 | |
| **합계** | | | | **$1,621/월** | |

### 6.2 비용 최적화 방안

#### 1. Spot Instance 활용 (70% 절감)

```yaml
# Spot 노드만 사용 (안정성 감소)
managedNodeGroups:
  - name: tiketi-ng-spot-only
    instanceTypes: [t3.medium, t3a.medium, t2.medium]
    spot: true
    minSize: 2
    maxSize: 20
```

**절감 효과**: $60 → $18/월 (Worker Nodes)

#### 2. Karpenter 사용 (Cluster Autoscaler 대체)

```bash
# Karpenter 설치
helm install karpenter oci://public.ecr.aws/karpenter/karpenter \
  --version v0.32.0 \
  -n karpenter --create-namespace
```

**장점**:
- 더 빠른 스케일링 (30초 vs 3분)
- Spot + On-Demand 혼합 전략
- 노드 통합 (Bin Packing 최적화)

#### 3. Savings Plans (30% 절감)

```
RDS + ElastiCache 1년 약정:
- RDS: $227 → $159/월
- ElastiCache: $878 → $615/월
절감: $331/월
```

#### 4. Reserved Instances (EC2)

```
t3.medium 1년 약정 (On-Demand):
- $60/월 → $39/월 (35% 절감)
절감: $21/월
```

### 6.3 최적화 후 비용

| 최적화 | 절감 금액 | 비고 |
|-------|----------|------|
| Spot Instance 활용 | -$42/월 | 70% 할인 |
| Savings Plans (RDS + Redis) | -$331/월 | 1년 약정 |
| Reserved Instances (EC2) | -$21/월 | 1년 약정 |
| **합계** | **-$394/월** | |

**최종 비용**: $1,621 - $394 = **$1,227/월 (약 $1,200)**

---

## 7. 모니터링 및 운영

### 7.1 Prometheus + Grafana 대시보드

#### 주요 메트릭

```promql
# 1. Pod CPU 사용률
sum(rate(container_cpu_usage_seconds_total{namespace="tiketi-prod",pod=~"tiketi-backend.*"}[5m])) by (pod)

# 2. Pod Memory 사용률
sum(container_memory_working_set_bytes{namespace="tiketi-prod",pod=~"tiketi-backend.*"}) by (pod) / 1024 / 1024

# 3. HPA Replicas
kube_horizontalpodautoscaler_status_current_replicas{namespace="tiketi-prod"}

# 4. 대기열 크기
redis_queue_size{app="tiketi"}

# 5. Request Rate (QPS)
sum(rate(http_requests_total{namespace="tiketi-prod"}[1m]))

# 6. Response Time (P95)
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="tiketi-prod"}[5m])) by (le))
```

### 7.2 Alert Rules

```yaml
# prometheus-alerts.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-alerts
  namespace: monitoring
data:
  alerts.yml: |
    groups:
      - name: tiketi-backend
        interval: 30s
        rules:
          # Critical: Pod Crash
          - alert: PodCrashLooping
            expr: rate(kube_pod_container_status_restarts_total{namespace="tiketi-prod"}[15m]) > 0
            for: 5m
            labels:
              severity: critical
            annotations:
              summary: "Pod {{ $labels.pod }} is crash looping"

          # Critical: High CPU
          - alert: HighCPUUsage
            expr: sum(rate(container_cpu_usage_seconds_total{namespace="tiketi-prod"}[5m])) by (pod) > 0.9
            for: 5m
            labels:
              severity: warning
            annotations:
              summary: "Pod {{ $labels.pod }} CPU > 90%"

          # Critical: 대기열 폭발
          - alert: QueueExplosion
            expr: redis_queue_size{app="tiketi"} > 10000
            for: 2m
            labels:
              severity: critical
            annotations:
              summary: "Queue size exceeded 10,000 users"

          # Warning: HPA Max Replicas
          - alert: HPAMaxedOut
            expr: kube_horizontalpodautoscaler_status_current_replicas{namespace="tiketi-prod"} >= kube_horizontalpodautoscaler_spec_max_replicas{namespace="tiketi-prod"}
            for: 10m
            labels:
              severity: warning
            annotations:
              summary: "HPA reached max replicas"
```

---

## 8. 체크리스트

### 8.1 마이그레이션 전

- [ ] 현재 시스템 전체 백업
- [ ] AWS 계정 및 권한 설정
- [ ] 도메인 및 SSL 인증서 준비
- [ ] 팀원 Kubernetes 교육
- [ ] 롤백 계획 수립

### 8.2 마이그레이션 중

- [ ] VPC 및 Subnet 구성
- [ ] EKS Cluster 생성
- [ ] Node Group 설정
- [ ] RDS PostgreSQL 마이그레이션
- [ ] ElastiCache Redis 설정
- [ ] ECR 이미지 빌드 및 푸시
- [ ] Kubernetes Manifests 배포
- [ ] HPA 및 Cluster Autoscaler 설정
- [ ] NLB 및 DNS 설정
- [ ] 부하 테스트 완료

### 8.3 마이그레이션 후

- [ ] 프로덕션 트래픽 전환
- [ ] 모니터링 대시보드 확인
- [ ] Alert 설정 검증
- [ ] 성능 메트릭 수집
- [ ] 비용 모니터링
- [ ] 운영 문서 작성
- [ ] 팀 교육 및 핸드오버

---

## 9. 핵심 요약

### 9.1 티켓팅 서비스 최적화 포인트

| 항목 | 전략 | 이유 |
|-----|------|------|
| **스케일링 속도** | HPA stabilizationWindow=0, maxSurge=100% | 트래픽 폭발 시 즉시 대응 |
| **노드 전략** | On-Demand 2대 + Spot 0~10대 | 비용 절감 + 안정성 |
| **WebSocket 유지** | NLB Sticky Session + Pod Anti-Affinity | 연결 끊김 최소화 |
| **대기열 기반 HPA** | Redis Queue Size 메트릭 | 실제 사용자 대기 상황 반영 |
| **Graceful Shutdown** | terminationGracePeriod=60s | WebSocket 연결 정리 |
| **배포 전략** | Rolling Update (maxUnavailable=0) | 무중단 배포 |

### 9.2 예상 성능 개선

| 지표 | Before (Docker Compose) | After (EKS) | 개선율 |
|-----|------------------------|-------------|--------|
| **최대 TPS** | 100 | 10,000+ | **10,000%** ↑ |
| **동시 접속** | 1,000명 | 100,000명+ | **10,000%** ↑ |
| **가용성** | 95% | 99.9% | **5%** ↑ |
| **스케일링 시간** | 수동 (10분+) | 자동 (1분) | **90%** ↓ |
| **배포 중단 시간** | 5분 | 0초 | **100%** ↓ |

---

**작성일**: 2025-12-02
**버전**: 1.0
**작성자**: Tiketi DevOps Team
