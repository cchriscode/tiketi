# MSA 마이그레이션 가이드 Part 2: AWS 아키텍처 설계

> **작성일:** 2025-12-03
> **전제 조건:** Part 1 (서비스 도메인 설계) 완료
> **목적:** 수십만 동시 접속자를 처리하는 AWS 인프라 설계

---

## 목차
1. [전체 AWS 아키텍처 다이어그램](#전체-aws-아키텍처-다이어그램)
2. [각 AWS 서비스 선정 이유 및 설정](#각-aws-서비스-선정-이유-및-설정)
3. [네트워크 아키텍처](#네트워크-아키텍처)
4. [데이터베이스 아키텍처](#데이터베이스-아키텍처)
5. [Auto Scaling 전략](#auto-scaling-전략)
6. [모니터링 및 로깅](#모니터링-및-로깅)
7. [비용 최적화 전략](#비용-최적화-전략)

---

## 1. 전체 AWS 아키텍처 다이어그램

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users (100만+ 동시 접속)                 │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS
                     ↓
         ┌───────────────────────┐
         │   Route 53 (DNS)      │
         │   tiketi.gg          │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         ↓                       ↓
┌────────────────────┐  ┌────────────────────┐
│  CloudFront (CDN)  │  │  CloudFront (CDN)  │
│  정적 파일         │  │  API 캐싱          │
│  - React SPA       │  │  - 이벤트 목록     │
│  - 이미지, CSS     │  │  - 좌석 배치도     │
│  TTL: 24h          │  │  TTL: 30s          │
└────────┬───────────┘  └────────┬───────────┘
         │                       │
         ↓                       ↓
┌────────────────────────────────────────────┐
│         S3 Bucket (정적 호스팅)            │
│         tiketi-frontend-prod               │
└────────────────────────────────────────────┘
                                 │
                                 ↓
                 ┌───────────────────────────┐
                 │  ALB (Application LB)     │
                 │  Port: 443 (HTTPS)       │
                 │  - SSL 터미네이션        │
                 │  - Sticky Session        │
                 │  - Health Check          │
                 └───────────┬───────────────┘
                             │
      ┌──────────────────────┼──────────────────────┐
      ↓                      ↓                      ↓
┌─────────────┐     ┌─────────────┐       ┌─────────────┐
│  Target     │     │  Target     │       │  Target     │
│  Group 1    │     │  Group 2    │       │  Group 3    │
│  (Event)    │     │  (Queue)    │       │  (Reserve)  │
└─────────────┘     └─────────────┘       └─────────────┘
      │                      │                      │
      ↓                      ↓                      ↓
┌───────────────────────────────────────────────────────────┐
│           Auto Scaling Groups (각 서비스별)               │
│                                                           │
│  ┌───────────────────┐  ┌────────────────────┐          │
│  │ Event Service     │  │ Queue Service      │          │
│  │ EC2: 2-20대       │  │ EC2: 10-100대 🔥   │          │
│  │ Type: t3.medium   │  │ Type: c6i.xlarge   │          │
│  └───────────────────┘  └────────────────────┘          │
│                                                           │
│  ┌───────────────────┐  ┌────────────────────┐          │
│  │ Reservation Svc   │  │ Payment Service    │          │
│  │ EC2: 20-200대 🔥🔥│  │ EC2: 2-10대        │          │
│  │ Type: c6i.2xlarge │  │ Type: t3.medium    │          │
│  └───────────────────┘  └────────────────────┘          │
│                                                           │
│  ┌───────────────────┐  ┌────────────────────┐          │
│  │ Auth Service      │  │ Admin Service      │          │
│  │ EC2: 2-4대        │  │ EC2: 1-2대         │          │
│  │ Type: t3.small    │  │ Type: t3.small     │          │
│  └───────────────────┘  └────────────────────┘          │
└───────────────────────────────────────────────────────────┘
                     │
      ┌──────────────┼──────────────┐
      ↓              ↓              ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ RDS Aurora   │ │ ElastiCache  │ │ S3 Bucket    │
│ PostgreSQL   │ │ Redis        │ │ (이미지)     │
│              │ │              │ │              │
│ - Multi-AZ   │ │ - Cluster    │ │ - Versioning │
│ - 1 Writer   │ │ - 6 Shards   │ │ - Lifecycle  │
│ - 8 Readers  │ │ - 2 Replicas │ │ - CloudFront │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

### 1.2 세부 서비스 아키텍처

```
┌──────────────────────────────────────────────────────────────────┐
│                        API Gateway Layer                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │              Kong API Gateway (EC2 2대)                    ││
│  │                                                             ││
│  │  기능:                                                      ││
│  │  ✓ JWT 검증 (Auth Service 위임)                           ││
│  │  ✓ Rate Limiting (Redis 기반)                             ││
│  │    - 인증 사용자: 100 req/min                             ││
│  │    - 비인증: 10 req/min                                   ││
│  │  ✓ Request Logging (CloudWatch)                           ││
│  │  ✓ Circuit Breaker (Hystrix)                              ││
│  │  ✓ API Versioning (/v1, /v2)                              ││
│  │                                                             ││
│  │  라우팅:                                                    ││
│  │  /api/v1/auth/*         → Auth Service (Port 3010)        ││
│  │  /api/v1/events/*       → Event Service (Port 3011)       ││
│  │  /api/v1/queue/*        → Queue Service (Port 3012)       ││
│  │  /api/v1/reservations/* → Reservation Svc (Port 3013)     ││
│  │  /api/v1/payments/*     → Payment Service (Port 3014)     ││
│  └────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ↓               ↓               ↓
┌──────────────────────────────────────────────────────────────────┐
│                     Service Mesh (선택적)                        │
│                                                                  │
│  AWS App Mesh 또는 Istio (Kubernetes 환경)                      │
│  - 서비스 간 mTLS                                               │
│  - Observability (분산 추적)                                     │
│  - Traffic Management (Canary, Blue-Green)                      │
└──────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ↓                       ↓                       ↓
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│ Event Service  │     │ Queue Service  │     │ Reservation    │
│ (ECS Fargate)  │     │ (ECS Fargate)  │     │ Service        │
│                │     │                │     │ (ECS Fargate)  │
│ Task: 2-20개   │     │ Task: 10-100개 │     │ Task: 20-200개 │
│ CPU: 2 vCPU    │     │ CPU: 4 vCPU    │     │ CPU: 8 vCPU    │
│ RAM: 4 GB      │     │ RAM: 8 GB      │     │ RAM: 16 GB     │
└────────────────┘     └────────────────┘     └────────────────┘

또는

┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│ Event Service  │     │ Queue Service  │     │ Reservation    │
│ (EKS Pod)      │     │ (EKS Pod)      │     │ Service        │
│                │     │                │     │ (EKS Pod)      │
│ Replica: 2-20  │     │ Replica: 10-100│     │ Replica: 20-200│
│ HPA: CPU 70%   │     │ HPA: Queue길이 │     │ HPA: CPU 80%   │
└────────────────┘     └────────────────┘     └────────────────┘
```

---

## 2. 각 AWS 서비스 선정 이유 및 설정

### 2.1 Compute (컴퓨팅)

#### **Option 1: ECS Fargate (권장 - 초기 단계)**

**선정 이유:**
```
✅ 서버리스 컨테이너 (서버 관리 불필요)
✅ 빠른 스케일링 (30초 이내)
✅ 자동 패치 및 보안 업데이트
✅ 비용 효율적 (사용한 만큼만 과금)
✅ Auto Scaling 쉬움
✅ CloudWatch 통합

⚠️ 단점:
- 초당 수백 개 스케일링은 EKS보다 느림
- 네트워크 세밀한 제어 어려움
```

**설정 예시:**
```yaml
# Event Service Task Definition
{
  "family": "event-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",  # 2 vCPU
  "memory": "4096",  # 4 GB
  "containerDefinitions": [
    {
      "name": "event-service",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/event-service:latest",
      "portMappings": [
        {
          "containerPort": 3011,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "DB_HOST",
          "value": "event-db.cluster-xxx.us-east-1.rds.amazonaws.com"
        }
      ],
      "secrets": [
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/event-service",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3011/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}

# Service Definition
{
  "serviceName": "event-service",
  "taskDefinition": "event-service:5",
  "desiredCount": 2,
  "launchType": "FARGATE",
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:...",
      "containerName": "event-service",
      "containerPort": 3011
    }
  ],
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-xxx", "subnet-yyy"],
      "securityGroups": ["sg-event-service"],
      "assignPublicIp": "DISABLED"
    }
  },
  "autoScalingPolicy": {
    "targetTrackingScaling": {
      "targetValue": 70.0,
      "predefinedMetricType": "ECSServiceAverageCPUUtilization",
      "scaleOutCooldown": 60,
      "scaleInCooldown": 300
    }
  }
}
```

**비용 예상:**
```
Event Service (평소):
- Task: 2개
- 2 vCPU × $0.04048/h = $0.081/h
- 4 GB RAM × $0.004445/GB/h = $0.018/h
- 총: $0.099/h × 2 = $0.198/h

Event Service (피크):
- Task: 20개
- 총: $0.099/h × 20 = $1.98/h

월 비용 (평소 720h, 피크 10h):
- 평소: $0.198 × 720 = $142.56
- 피크: $1.98 × 10 = $19.80
- 총: $162.36/월
```

---

#### **Option 2: EKS (권장 - 대규모 확장)**

**선정 이유:**
```
✅ 초고속 스케일링 (초당 수백 Pod)
✅ 세밀한 제어 (네트워크, 스토리지)
✅ Multi-Cloud 전략 (GKE, AKS 호환)
✅ 강력한 생태계 (Helm, Istio, ArgoCD)
✅ 비용 효율적 (Spot Instance 활용)

⚠️ 단점:
- 운영 복잡도 높음 (K8s 전문 지식 필요)
- 초기 설정 시간 오래 걸림
- Control Plane 비용 ($0.10/h)
```

**설정 예시:**
```yaml
# Event Service Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: event-service
  namespace: tiketi-prod
spec:
  replicas: 2
  selector:
    matchLabels:
      app: event-service
  template:
    metadata:
      labels:
        app: event-service
        version: v1
    spec:
      containers:
      - name: event-service
        image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/event-service:latest
        ports:
        - containerPort: 3011
        resources:
          requests:
            cpu: "1000m"      # 1 vCPU
            memory: "2Gi"
          limits:
            cpu: "2000m"      # 2 vCPU
            memory: "4Gi"
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: host
        livenessProbe:
          httpGet:
            path: /health
            port: 3011
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3011
          initialDelaySeconds: 5
          periodSeconds: 5

---
# HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: event-service-hpa
  namespace: tiketi-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: event-service
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0  # 즉시 스케일 업
      policies:
      - type: Percent
        value: 100  # 2배씩 증가
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300  # 5분 관찰
      policies:
      - type: Percent
        value: 50  # 절반씩 감소
        periodSeconds: 60

---
# Service (ClusterIP)
apiVersion: v1
kind: Service
metadata:
  name: event-service
  namespace: tiketi-prod
spec:
  selector:
    app: event-service
  ports:
  - port: 3011
    targetPort: 3011
  type: ClusterIP

---
# Ingress (ALB Ingress Controller)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-ingress
  namespace: tiketi-prod
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:123456789012:certificate/xxx
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
spec:
  rules:
  - host: api.tiketi.gg
    http:
      paths:
      - path: /api/v1/events
        pathType: Prefix
        backend:
          service:
            name: event-service
            port:
              number: 3011
      - path: /api/v1/queue
        pathType: Prefix
        backend:
          service:
            name: queue-service
            port:
              number: 3012
```

**비용 예상:**
```
EKS Control Plane: $0.10/h × 720h = $72/월

Worker Nodes (t3.large × 3대, 평소):
- $0.0832/h × 3 × 720h = $179.71/월

Worker Nodes (피크, Cluster Autoscaler):
- 추가 15대 × $0.0832/h × 10h = $12.48

총 월 비용: $264.19/월
```

---

#### **비교 및 권장사항**

| 항목 | ECS Fargate | EKS |
|------|------------|-----|
| **운영 복잡도** | ⭐⭐ (낮음) | ⭐⭐⭐⭐⭐ (높음) |
| **스케일링 속도** | 30초-1분 | 10-20초 |
| **비용 (소규모)** | 저렴 ($150-200/월) | 비쌈 ($250-300/월) |
| **비용 (대규모)** | 중간 ($500-1000/월) | 저렴 ($400-700/월, Spot) |
| **학습 곡선** | 낮음 | 높음 |
| **권장 시점** | 초기 6개월, MVP | 트래픽 안정 후 |

**권장 전략:**
```
Phase 1 (0-6개월): ECS Fargate
- 빠른 출시, 안정화 집중
- 운영 부담 최소화

Phase 2 (6-12개월): EKS 마이그레이션
- 트래픽 패턴 파악 후
- DevOps 팀 구성 후
- 비용 최적화 (Spot Instance)
```

---

### 2.2 Load Balancing

#### **ALB (Application Load Balancer)**

**선정 이유:**
```
✅ Layer 7 (HTTP/HTTPS) 지원
✅ Path-based 라우팅 (/api/events → Event Service)
✅ Host-based 라우팅 (api.tiketi.gg, admin.tiketi.gg)
✅ WebSocket 지원 (Queue Service 필수)
✅ Sticky Session (대기열 유지)
✅ SSL/TLS 터미네이션 (ACM 통합)
✅ Health Check (자동 장애 감지)
✅ CloudWatch 메트릭

대안:
❌ NLB: Layer 4만 지원, Path 라우팅 불가
❌ Classic LB: 레거시, WebSocket 제한적
```

**설정 예시:**
```json
{
  "LoadBalancerName": "tiketi-prod-alb",
  "Scheme": "internet-facing",
  "IpAddressType": "ipv4",
  "Subnets": [
    "subnet-public-1a",
    "subnet-public-1b",
    "subnet-public-1c"
  ],
  "SecurityGroups": ["sg-alb"],
  "Tags": [
    {
      "Key": "Environment",
      "Value": "production"
    }
  ]
}

# Target Group - Event Service
{
  "TargetGroupName": "event-service-tg",
  "Protocol": "HTTP",
  "Port": 3011,
  "VpcId": "vpc-xxx",
  "HealthCheckProtocol": "HTTP",
  "HealthCheckPath": "/health",
  "HealthCheckIntervalSeconds": 30,
  "HealthCheckTimeoutSeconds": 5,
  "HealthyThresholdCount": 2,
  "UnhealthyThresholdCount": 3,
  "TargetType": "ip",  # Fargate의 경우
  "Matcher": {
    "HttpCode": "200"
  }
}

# Listener Rules
{
  "Listeners": [
    {
      "Port": 443,
      "Protocol": "HTTPS",
      "Certificates": [
        {
          "CertificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/xxx"
        }
      ],
      "DefaultActions": [
        {
          "Type": "fixed-response",
          "FixedResponseConfig": {
            "StatusCode": "404",
            "ContentType": "text/plain",
            "MessageBody": "Not Found"
          }
        }
      ],
      "Rules": [
        {
          "Priority": 1,
          "Conditions": [
            {
              "Field": "path-pattern",
              "Values": ["/api/v1/events*"]
            }
          ],
          "Actions": [
            {
              "Type": "forward",
              "TargetGroupArn": "arn:aws:elasticloadbalancing:...:targetgroup/event-service-tg"
            }
          ]
        },
        {
          "Priority": 2,
          "Conditions": [
            {
              "Field": "path-pattern",
              "Values": ["/api/v1/queue*"]
            }
          ],
          "Actions": [
            {
              "Type": "forward",
              "TargetGroupArn": "arn:aws:elasticloadbalancing:...:targetgroup/queue-service-tg"
            }
          ]
        },
        {
          "Priority": 10,
          "Conditions": [
            {
              "Field": "path-pattern",
              "Values": ["/api/v1/reservations*"]
            }
          ],
          "Actions": [
            {
              "Type": "forward",
              "TargetGroupArn": "arn:aws:elasticloadbalancing:...:targetgroup/reservation-service-tg",
              "ForwardConfig": {
                "TargetGroups": [
                  {
                    "TargetGroupArn": "...",
                    "Weight": 100
                  }
                ],
                "TargetGroupStickinessConfig": {
                  "Enabled": true,
                  "DurationSeconds": 3600
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Sticky Session 설정 (중요):**
```
왜 필요한가?
- Queue Service: 동일 사용자가 같은 인스턴스로 라우팅되어야 WebSocket 연결 유지
- Reservation Service: 좌석 선택 중 세션 유지

설정:
{
  "TargetGroupAttributes": [
    {
      "Key": "stickiness.enabled",
      "Value": "true"
    },
    {
      "Key": "stickiness.type",
      "Value": "lb_cookie"  # ALB가 AWSALB 쿠키 발급
    },
    {
      "Key": "stickiness.lb_cookie.duration_seconds",
      "Value": "3600"  # 1시간
    }
  ]
}

주의:
- Sticky Session은 트래픽 불균형 유발 가능
- Queue Service만 적용 (다른 서비스는 stateless)
```

---

### 2.3 Database

#### **RDS Aurora PostgreSQL (권장)**

**선정 이유:**
```
✅ MySQL/PostgreSQL 호환 (코드 변경 최소)
✅ 자동 백업, Point-in-Time Recovery
✅ Multi-AZ (고가용성 99.99%)
✅ Auto Scaling Storage (10GB → 128TB)
✅ Read Replica (최대 15개, 자동 장애 조치)
✅ 성능: 표준 PostgreSQL 대비 3배
✅ Serverless 옵션 (트래픽 변동 대응)

대안:
❌ RDS PostgreSQL: Read Replica 5개 제한
❌ 자체 운영 PostgreSQL: 운영 부담
```

**아키텍처 설계:**
```
┌─────────────────────────────────────────────────────┐
│          Aurora PostgreSQL Cluster                  │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │         Writer Instance (Primary)             │ │
│  │         db.r6g.2xlarge (8 vCPU, 64GB RAM)    │ │
│  │         us-east-1a                            │ │
│  └───────────────────────┬───────────────────────┘ │
│                          │ 동기 복제               │
│                          ↓                          │
│  ┌───────────────────────────────────────────────┐ │
│  │         Standby Instance (Failover)           │ │
│  │         db.r6g.2xlarge                        │ │
│  │         us-east-1b                            │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │         Read Replica 1 (Event Service)        │ │
│  │         db.r6g.xlarge (4 vCPU, 32GB RAM)     │ │
│  │         us-east-1a                            │ │
│  │         Endpoint: event-db-ro.cluster-xxx     │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │         Read Replica 2-8 (Auto Scaling)       │ │
│  │         db.r6g.xlarge × 7개                   │ │
│  │         Trigger: CPU > 70% or Conn > 1000    │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  공유 스토리지: 최대 128TB, 자동 확장              │
└─────────────────────────────────────────────────────┘

사용 패턴:
- Reservation Service (쓰기) → Writer Endpoint
- Event Service (읽기) → Reader Endpoint (Round Robin)
- Analytics (대량 읽기) → 전용 Read Replica
```

**설정 예시:**
```json
{
  "DBClusterIdentifier": "tiketi-prod-cluster",
  "Engine": "aurora-postgresql",
  "EngineVersion": "15.4",
  "EngineMode": "provisioned",  # 또는 "serverless" (v2)
  "MasterUsername": "postgres",
  "MasterUserPassword": "{{secrets-manager}}",
  "DatabaseName": "tiketi",
  "Port": 5432,

  "DBClusterParameterGroupName": "tiketi-cluster-pg",
  "DBSubnetGroupName": "tiketi-db-subnet",
  "VpcSecurityGroupIds": ["sg-aurora"],

  "BackupRetentionPeriod": 7,  # 7일 백업 보관
  "PreferredBackupWindow": "03:00-04:00",  # UTC
  "PreferredMaintenanceWindow": "sun:04:00-sun:05:00",

  "EnableCloudwatchLogsExports": ["postgresql"],
  "EnableIAMDatabaseAuthentication": true,
  "DeletionProtection": true,

  "ScalingConfiguration": {  # Serverless v2
    "MinCapacity": 0.5,  # 최소 0.5 ACU
    "MaxCapacity": 16,   # 최대 16 ACU
    "AutoPause": false
  }
}

# Read Replica Auto Scaling
{
  "ServiceNamespace": "rds",
  "ResourceId": "cluster:tiketi-prod-cluster",
  "ScalableDimension": "rds:cluster:ReadReplicaCount",
  "MinCapacity": 1,
  "MaxCapacity": 8,
  "TargetTrackingScalingPolicyConfiguration": {
    "TargetValue": 70.0,
    "PredefinedMetricType": "RDSReaderAverageCPUUtilization",
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }
}
```

**Connection Pool 설정:**
```javascript
// Reservation Service (쓰기 중심)
const writerPool = new Pool({
  host: 'tiketi-prod-cluster.cluster-xxx.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'tiketi_reservation',
  user: 'reservation_user',
  password: process.env.DB_PASSWORD,
  max: 200,  # EC2 1대당 10개 × 20대 = 200
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Event Service (읽기 전용)
const readerPool = new Pool({
  host: 'tiketi-prod-cluster.cluster-ro-xxx.us-east-1.rds.amazonaws.com',  # Read Replica Endpoint
  port: 5432,
  database: 'tiketi_event',
  user: 'event_user',
  max: 50,  # 읽기는 적은 커넥션
  idleTimeoutMillis: 60000
});
```

**비용 예상:**
```
Writer Instance (db.r6g.2xlarge):
- 온디맨드: $0.96/h × 720h = $691.20/월
- Reserved (1년): $0.576/h × 720h = $414.72/월 (40% 절감)

Read Replica (평소 2개):
- db.r6g.xlarge × 2: $0.48/h × 2 × 720h = $691.20/월

Read Replica (피크 8개):
- db.r6g.xlarge × 8 × 10h = $38.40

스토리지 (100GB):
- $0.10/GB/월 × 100 = $10/월

I/O (100만 요청):
- $0.20/백만 요청 × 100 = $20/월

백업 (100GB):
- $0.021/GB/월 × 100 = $2.10/월

총 월 비용:
- Writer + Reader + 스토리지 + I/O + 백업
- $414.72 + $691.20 + $10 + $20 + $2.10 = $1,138.02/월
```

---

### 2.4 Cache

#### **ElastiCache for Redis (권장)**

**선정 이유:**
```
✅ 완전 관리형 (패치, 백업 자동)
✅ Cluster Mode (샤딩, 최대 500 노드)
✅ Multi-AZ (자동 장애 조치)
✅ Read Replica (읽기 확장)
✅ 저지연 (<1ms)
✅ Persistence 옵션 (RDB, AOF)

대안:
❌ DragonflyDB: AWS에서 직접 운영 필요
✅ Redis OSS: ElastiCache가 더 나은 선택
```

**아키텍처 설계:**
```
┌──────────────────────────────────────────────────────┐
│       ElastiCache Redis Cluster (Cluster Mode)       │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │  Shard 1 (대기열: queue:*)                     │ │
│  │  Primary: cache.r6g.xlarge (us-east-1a)       │ │
│  │  Replica: cache.r6g.xlarge (us-east-1b)       │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │  Shard 2 (락: lock:*)                          │ │
│  │  Primary: cache.r6g.xlarge                     │ │
│  │  Replica: cache.r6g.xlarge                     │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │  Shard 3-6 (캐시: event:*, reservation:*)     │ │
│  │  Primary × 4                                   │ │
│  │  Replica × 4                                   │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  총: 6 샤드 × (1 Primary + 1 Replica) = 12 노드   │
│  메모리: 12 × 26.32 GB = 315.84 GB               │
└──────────────────────────────────────────────────────┘

Key 분산:
- queue:eventId → Shard 1 (대기열 전담, 높은 처리량)
- lock:seat:* → Shard 2 (락 전담, 낮은 지연)
- event:* → Shard 3-6 (캐시, 균등 분산)
```

**설정 예시:**
```json
{
  "ReplicationGroupId": "tiketi-prod-redis",
  "ReplicationGroupDescription": "Production Redis Cluster",
  "Engine": "redis",
  "EngineVersion": "7.0",
  "CacheNodeType": "cache.r6g.xlarge",  # 26.32 GB RAM, 네트워크 최적화

  "NumNodeGroups": 6,  # 샤드 수
  "ReplicasPerNodeGroup": 1,  # 각 샤드당 Replica 1개

  "CacheParameterGroupName": "tiketi-redis-7",
  "CacheSubnetGroupName": "tiketi-cache-subnet",
  "SecurityGroupIds": ["sg-redis"],

  "AtRestEncryptionEnabled": true,
  "TransitEncryptionEnabled": true,
  "AuthToken": "{{secrets-manager}}",

  "AutomaticFailoverEnabled": true,  # Multi-AZ
  "MultiAZEnabled": true,

  "SnapshotRetentionLimit": 7,  # 7일 백업
  "SnapshotWindow": "03:00-05:00",
  "PreferredMaintenanceWindow": "sun:05:00-sun:07:00",

  "NotificationTopicArn": "arn:aws:sns:us-east-1:123456789012:redis-alerts",

  "LogDeliveryConfigurations": [
    {
      "LogType": "slow-log",
      "DestinationType": "cloudwatch-logs",
      "DestinationDetails": {
        "CloudWatchLogsDetails": {
          "LogGroup": "/aws/elasticache/tiketi-prod-redis"
        }
      },
      "LogFormat": "json"
    }
  ]
}
```

**클라이언트 설정:**
```javascript
// Node.js - ioredis (Cluster 지원)
const Redis = require('ioredis');

const redis = new Redis.Cluster(
  [
    {
      host: 'tiketi-prod-redis.xxx.clustercfg.use1.cache.amazonaws.com',
      port: 6379
    }
  ],
  {
    redisOptions: {
      password: process.env.REDIS_AUTH_TOKEN,
      tls: {
        checkServerIdentity: () => undefined  # AWS 인증서 검증
      }
    },
    clusterRetryStrategy: (times) => {
      return Math.min(100 * Math.pow(2, times), 3000);
    },
    enableReadyCheck: true,
    maxRetriesPerRequest: 3
  }
);

// 대기열 작업 (Shard 1)
await redis.zadd(`queue:${eventId}`, Date.now(), userId);

// 락 획득 (Shard 2)
const lockKey = `lock:seat:${eventId}:${seatId}`;
const locked = await redis.set(lockKey, userId, 'EX', 10, 'NX');

// 캐시 조회 (Shard 3-6, 자동 분산)
const event = await redis.get(`event:${eventId}`);
```

**비용 예상:**
```
cache.r6g.xlarge (26.32 GB RAM):
- 온디맨드: $0.315/h × 12 노드 × 720h = $2,721.60/월
- Reserved (1년): $0.189/h × 12 × 720h = $1,632.96/월 (40% 절감)

백업 (100GB):
- $0.085/GB/월 × 100 = $8.50/월

총 월 비용:
- Reserved + 백업 = $1,641.46/월
```

---

계속해서 Part 3 (단계별 마이그레이션 가이드)를 작성하겠습니다...