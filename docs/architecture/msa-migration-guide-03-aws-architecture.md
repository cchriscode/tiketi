# TIKETI MSA + Kubernetes 마이그레이션 가이드 (Part 3)
## AWS 아키텍처 설계

---

## 📋 목차

1. [AWS 서비스 선택 및 이유](#1-aws-서비스-선택-및-이유)
2. [네트워크 아키텍처 (VPC 설계)](#2-네트워크-아키텍처-vpc-설계)
3. [Kubernetes 인프라 (EKS)](#3-kubernetes-인프라-eks)
4. [데이터 레이어 설계](#4-데이터-레이어-설계)
5. [CDN 및 정적 자산 전략](#5-cdn-및-정적-자산-전략)
6. [보안 아키텍처](#6-보안-아키텍처)
7. [고가용성 및 재해 복구](#7-고가용성-및-재해-복구)

---

## 1. AWS 서비스 선택 및 이유

### 1.1 컴퓨팅 레이어

| 서비스 | 역할 | 선택 이유 | 대안 비교 |
|--------|------|-----------|----------|
| **Amazon EKS** | Kubernetes 관리 | - 관리형 Control Plane<br>- AWS 서비스 네이티브 통합<br>- Auto Scaling 용이 | ECS: 덜 유연함<br>EC2 직접 관리: 운영 부담 |
| **EC2 (m6i.xlarge)** | Worker Nodes | - 범용 워크로드에 최적<br>- 4 vCPU, 16GB 메모리<br>- 네트워크 성능 우수 | Fargate: 비용 2배, 제약 많음<br>Spot: 안정성 낮음 (50% 혼용) |
| **AWS Lambda** | 비동기 처리 | - 이벤트 기반 작업<br>- 서버리스 (관리 불필요)<br>- 사용량 기반 과금 | ECS Task: 항상 실행<br>K8s CronJob: 리소스 낭비 |

**왜 EKS를 선택하는가?**
```
❌ 직접 Kubernetes 관리 (EC2 + kubeadm)
문제점:
- Control Plane 직접 운영 (Master Nodes 3대 필요)
- etcd 백업/복구 직접 구현
- Kubernetes 업그레이드 위험 (다운타임 발생)
- 보안 패치 수동 적용

✅ Amazon EKS 사용
장점:
- Control Plane은 AWS가 관리 (99.95% SLA)
- etcd 자동 백업
- 무중단 버전 업그레이드
- AWS 보안팀이 패치 관리
- 비용: Control Plane $0.10/hour = 월 $72만 추가
```

**EC2 인스턴스 타입 선택 기준:**
```javascript
// 서비스별 리소스 요구사항

Queue Service (WebSocket 위주):
- vCPU: 높음 (이벤트 루프 처리)
- Memory: 중간
- Network: 매우 높음 (동시 연결 많음)
→ 추천: c6i.xlarge (vCPU 최적화)

Ticket Service (DB 트랜잭션 위주):
- vCPU: 중간
- Memory: 높음 (연결 풀, 캐시)
- Network: 중간
→ 추천: r6i.large (메모리 최적화)

일반 서비스:
→ m6i.xlarge (범용)
```

### 1.2 데이터 레이어

| 서비스 | 역할 | 선택 이유 | 설정 |
|--------|------|-----------|------|
| **Amazon RDS PostgreSQL** | 주 데이터베이스 | - Multi-AZ 자동 복제<br>- 자동 백업/복구<br>- Read Replica 쉬운 추가 | db.r6g.xlarge<br>4 vCPU, 32GB<br>Multi-AZ |
| **Amazon ElastiCache Redis** | 캐시 + 세션 + 큐 | - Cluster Mode로 확장<br>- 자동 failover<br>- 메모리 최적화 인스턴스 | cache.r6g.large<br>Cluster Mode<br>3 샤드 × 2 복제본 |
| **Amazon S3** | 이미지/파일 저장 | - 무제한 저장 용량<br>- CloudFront 통합<br>- 저렴한 비용 | Standard 클래스<br>Lifecycle 정책 |
| **Amazon MSK** | 이벤트 스트리밍 | - 관리형 Kafka<br>- 3개 AZ 분산<br>- Auto Scaling | kafka.m5.large × 3<br>3개 AZ<br>스토리지 100GB |

**왜 RDS를 선택하는가?**
```
❌ EC2에 직접 PostgreSQL 설치
문제점:
- 백업 스크립트 직접 작성
- Failover 로직 구현 필요
- 디스크 용량 모니터링/확장 수동
- 보안 패치 직접 적용

✅ Amazon RDS 사용
장점:
- 매일 자동 백업 (35일 보관)
- Multi-AZ로 자동 failover (1-2분)
- 스토리지 자동 확장 (Auto Scaling Storage)
- 패치 자동 적용 (유지보수 윈도우 설정)
- Performance Insights로 쿼리 분석
- 비용 차이: EC2 대비 30% 높지만 운영 비용 90% 절감
```

**왜 ElastiCache를 선택하는가?**
```
❌ EC2에 Redis 직접 설치
문제점:
- Cluster 구성 복잡
- 메모리 관리 수동
- 데이터 샤딩 직접 구현

✅ Amazon ElastiCache 사용
장점:
- Cluster Mode로 자동 샤딩
- 메모리 부족 시 자동 eviction
- 자동 패치 적용
- CloudWatch 통합 모니터링
```

### 1.3 네트워킹 & CDN

| 서비스 | 역할 | 선택 이유 |
|--------|------|-----------|
| **Application Load Balancer (ALB)** | L7 로드 밸런서 | - Path 기반 라우팅<br>- WebSocket 지원<br>- SSL Termination |
| **Amazon CloudFront** | CDN | - 전 세계 엣지 로케이션<br>- S3 통합<br>- DDoS 보호 |
| **Route 53** | DNS | - Health Check 기반 라우팅<br>- Geo Routing<br>- 낮은 지연시간 |
| **AWS WAF** | 방화벽 | - SQL Injection 차단<br>- Rate Limiting<br>- IP 차단 |

### 1.4 모니터링 & 로깅

| 서비스 | 역할 | 대안 대비 장점 |
|--------|------|----------------|
| **Amazon CloudWatch** | 메트릭 수집 | AWS 네이티브 통합 |
| **AWS X-Ray** | 분산 추적 | EKS와 자동 통합 |
| **CloudWatch Logs** | 로그 집계 | Kubernetes 로그 자동 수집 |
| **Amazon Managed Grafana** | 시각화 | Prometheus 데이터 소스 통합 |
| **Amazon Managed Prometheus** | 메트릭 저장소 | 장기 보관, 무제한 확장 |

**Self-Hosted vs Managed 비교:**
```
Self-Hosted (EKS 내부에 Prometheus + Grafana):
비용: 낮음 (EC2 리소스만)
운영: 높음 (버전 업그레이드, 스토리지 관리, 백업)
확장성: 제한적 (단일 Prometheus 인스턴스)

Managed (Amazon Managed Prometheus + Grafana):
비용: 높음 (메트릭 수집량 기반)
운영: 낮음 (AWS가 관리)
확장성: 무제한
→ 추천: 초기에는 Self-Hosted, 규모 커지면 Managed로 전환
```

---

## 2. 네트워크 아키텍처 (VPC 설계)

### 2.1 VPC 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                  VPC (10.0.0.0/16)                              │
│                  Region: ap-northeast-2 (Seoul)                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Availability Zone A (ap-northeast-2a)          │    │
│  │                                                         │    │
│  │  ┌──────────────────┐  ┌──────────────────┐           │    │
│  │  │ Public Subnet A  │  │ Private Subnet A │           │    │
│  │  │ 10.0.1.0/24      │  │ 10.0.11.0/24     │           │    │
│  │  │                  │  │                  │           │    │
│  │  │ - NAT Gateway    │  │ - EKS Nodes      │           │    │
│  │  │ - ALB            │  │ - App Pods       │           │    │
│  │  └──────────────────┘  └──────────────────┘           │    │
│  │                                                         │    │
│  │  ┌──────────────────────────────────────┐             │    │
│  │  │ Database Subnet A (10.0.21.0/24)     │             │    │
│  │  │ - RDS Primary                         │             │    │
│  │  │ - ElastiCache Node 1                  │             │    │
│  │  └──────────────────────────────────────┘             │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Availability Zone C (ap-northeast-2c)          │    │
│  │                                                         │    │
│  │  ┌──────────────────┐  ┌──────────────────┐           │    │
│  │  │ Public Subnet C  │  │ Private Subnet C │           │    │
│  │  │ 10.0.2.0/24      │  │ 10.0.12.0/24     │           │    │
│  │  │                  │  │                  │           │    │
│  │  │ - NAT Gateway    │  │ - EKS Nodes      │           │    │
│  │  │ - ALB            │  │ - App Pods       │           │    │
│  │  └──────────────────┘  └──────────────────┘           │    │
│  │                                                         │    │
│  │  ┌──────────────────────────────────────┐             │    │
│  │  │ Database Subnet C (10.0.22.0/24)     │             │    │
│  │  │ - RDS Standby (Multi-AZ)              │             │    │
│  │  │ - ElastiCache Node 2                  │             │    │
│  │  └──────────────────────────────────────┘             │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Internet Gateway (IGW)                                  │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 서브넷 설계 이유

**왜 3계층 서브넷 구조를 사용하는가?**

```
1계층: Public Subnet (인터넷 게이트웨이 직접 연결)
용도: NAT Gateway, ALB, Bastion Host
이유:
- 외부에서 직접 접근 가능
- 고정 Public IP 필요
- 트래픽 진입점

2계층: Private Subnet (NAT Gateway 통해 아웃바운드만)
용도: EKS Worker Nodes, 애플리케이션 Pod
이유:
- 인터넷 노출 차단 (보안)
- 외부 API 호출 가능 (NAT 통해)
- 비용 절감 (Public IP 불필요)

3계층: Database Subnet (완전 격리)
용도: RDS, ElastiCache
이유:
- 인터넷 접근 완전 차단
- 애플리케이션에서만 접근
- 규정 준수 (데이터 보호)
```

**트러블슈팅 케이스:**
```
❌ 잘못된 설계: RDS를 Public Subnet에 배치
결과:
- 인터넷에서 RDS 접근 가능 (보안 위험)
- DDoS 공격 대상
- 규정 위반 (개인정보보호법)

✅ 올바른 설계: RDS를 Database Subnet에 배치
결과:
- VPC 내부에서만 접근 가능
- Security Group으로 추가 제어
- 규정 준수
```

### 2.3 라우팅 테이블

```yaml
# Public Subnet 라우팅 테이블
Destination: 0.0.0.0/0 → Target: Internet Gateway
Destination: 10.0.0.0/16 → Target: Local

# Private Subnet 라우팅 테이블
Destination: 0.0.0.0/0 → Target: NAT Gateway (각 AZ별)
Destination: 10.0.0.0/16 → Target: Local

# Database Subnet 라우팅 테이블
Destination: 10.0.0.0/16 → Target: Local (인터넷 접근 없음)
```

### 2.4 Security Group 설계

```yaml
# ALB Security Group
Name: tiketi-alb-sg
Inbound:
  - Port 443 (HTTPS) from 0.0.0.0/0
  - Port 80 (HTTP) from 0.0.0.0/0 (301 redirect to HTTPS)
Outbound:
  - All traffic to EKS Node SG

# EKS Node Security Group
Name: tiketi-eks-node-sg
Inbound:
  - Port 30000-32767 (NodePort) from ALB SG
  - Port 443 from Control Plane SG
  - All traffic from same SG (Node 간 통신)
Outbound:
  - All traffic to 0.0.0.0/0 (외부 API 호출)
  - Port 5432 to RDS SG
  - Port 6379 to ElastiCache SG

# RDS Security Group
Name: tiketi-rds-sg
Inbound:
  - Port 5432 from EKS Node SG
  - Port 5432 from Bastion SG (운영 목적)
Outbound:
  - None

# ElastiCache Security Group
Name: tiketi-redis-sg
Inbound:
  - Port 6379 from EKS Node SG
Outbound:
  - None
```

---

## 3. Kubernetes 인프라 (EKS)

### 3.1 EKS 클러스터 구성

```yaml
# eksctl로 클러스터 생성
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: tiketi-production
  region: ap-northeast-2
  version: "1.28"

vpc:
  id: vpc-xxxxxxxx
  subnets:
    private:
      ap-northeast-2a: { id: subnet-private-a }
      ap-northeast-2c: { id: subnet-private-c }

iam:
  withOIDC: true  # IAM Roles for Service Accounts (IRSA)
  serviceAccounts:
    - metadata:
        name: aws-load-balancer-controller
        namespace: kube-system
      attachPolicyARNs:
        - arn:aws:iam::aws:policy/AWSLoadBalancerControllerIAMPolicy
    - metadata:
        name: cluster-autoscaler
        namespace: kube-system
      attachPolicyARNs:
        - arn:aws:iam::ACCOUNT_ID:policy/ClusterAutoscalerPolicy

managedNodeGroups:
  # 일반 애플리케이션용 (On-Demand)
  - name: app-nodes
    instanceType: m6i.xlarge
    desiredCapacity: 10
    minSize: 5
    maxSize: 50
    privateNetworking: true
    labels:
      workload: application
    tags:
      k8s.io/cluster-autoscaler/enabled: "true"
      k8s.io/cluster-autoscaler/tiketi-production: "owned"

  # WebSocket 워크로드용 (CPU 최적화)
  - name: websocket-nodes
    instanceType: c6i.2xlarge
    desiredCapacity: 5
    minSize: 3
    maxSize: 30
    privateNetworking: true
    labels:
      workload: websocket
    taints:
      - key: workload
        value: websocket
        effect: NoSchedule

  # Spot 인스턴스 (비용 절감, 비중요 워크로드)
  - name: spot-nodes
    instanceTypes:
      - m6i.xlarge
      - m6i.2xlarge
      - m5.xlarge
    desiredCapacity: 3
    minSize: 0
    maxSize: 20
    privateNetworking: true
    spot: true
    labels:
      workload: batch
    taints:
      - key: spot
        value: "true"
        effect: NoSchedule

cloudWatch:
  clusterLogging:
    enableTypes:
      - api
      - audit
      - authenticator
      - controllerManager
      - scheduler
```

**왜 Node Group을 분리하는가?**
```
문제: 단일 Node Group 사용
→ WebSocket 서비스가 CPU 많이 사용
→ 같은 노드의 다른 Pod도 영향 받음
→ 전체 성능 저하

해결: Workload별 Node Group 분리
→ WebSocket은 CPU 최적화 인스턴스에 배치
→ DB 트랜잭션은 메모리 최적화 인스턴스
→ 배치 작업은 Spot 인스턴스 (비용 70% 절감)
→ Taint/Toleration으로 격리
```

### 3.2 Cluster Autoscaler 설정

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
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
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.28.0
        name: cluster-autoscaler
        command:
          - ./cluster-autoscaler
          - --v=4
          - --stderrthreshold=info
          - --cloud-provider=aws
          - --skip-nodes-with-local-storage=false
          - --expander=least-waste
          - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/tiketi-production
          - --balance-similar-node-groups
          - --skip-nodes-with-system-pods=false
          - --scale-down-delay-after-add=5m
          - --scale-down-unneeded-time=5m
        env:
          - name: AWS_REGION
            value: ap-northeast-2
```

**Autoscaler 동작 과정:**
```
1. Pod 생성 요청 (kubectl apply)
2. Scheduler가 배치 시도
3. 리소스 부족으로 Pending 상태
4. Cluster Autoscaler 감지 (30초 이내)
5. AWS Auto Scaling Group에 노드 추가 요청
6. 새 EC2 인스턴스 시작 (2-3분)
7. kubelet이 Control Plane에 등록
8. Scheduler가 Pending Pod를 새 노드에 배치
9. Pod Running 상태 전환
```

### 3.3 AWS Load Balancer Controller

```yaml
# Helm으로 설치
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=tiketi-production \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=ap-northeast-2 \
  --set vpcId=vpc-xxxxxxxx

# Ingress로 ALB 생성
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:...
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '30'
    alb.ingress.kubernetes.io/success-codes: '200'
spec:
  rules:
  - host: api.tiketi.com
    http:
      paths:
      - path: /api/users
        pathType: Prefix
        backend:
          service:
            name: user-service
            port:
              number: 80
      - path: /api/events
        pathType: Prefix
        backend:
          service:
            name: event-service
            port:
              number: 80
      - path: /api/queue
        pathType: Prefix
        backend:
          service:
            name: queue-service
            port:
              number: 80
```

**ALB vs NLB 선택 이유:**
```
Network Load Balancer (L4):
장점: 낮은 지연시간, WebSocket 안정적
단점: Path 기반 라우팅 불가

Application Load Balancer (L7):
장점:
- Path 기반 라우팅 (/api/users → User Service)
- Host 기반 라우팅 (api.tiketi.com, admin.tiketi.com)
- SSL Termination (서비스는 HTTP만 처리)
- WebSocket 지원 (Upgrade 헤더 인식)
단점: 약간 높은 지연시간 (5-10ms)

→ 선택: ALB (마이크로서비스에 필수)
```

---

## 4. 데이터 레이어 설계

### 4.1 RDS PostgreSQL 구성

```yaml
# Terraform으로 RDS 생성
resource "aws_db_instance" "tiketi_main" {
  identifier = "tiketi-production"

  # 엔진 설정
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.r6g.xlarge"  # 4 vCPU, 32GB

  # 스토리지
  allocated_storage     = 100  # GB
  max_allocated_storage = 1000  # Auto Scaling
  storage_type         = "gp3"
  storage_encrypted    = true
  kms_key_id           = aws_kms_key.rds.arn

  # 고가용성
  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.database.name

  # 백업
  backup_retention_period = 35  # 35일 보관
  backup_window          = "03:00-04:00"  # UTC (한국 시간 12:00-13:00)
  maintenance_window     = "sun:04:00-sun:05:00"

  # 보안
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # 성능 모니터링
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  performance_insights_enabled    = true
  performance_insights_retention_period = 7

  # 파라미터 그룹 (성능 최적화)
  parameter_group_name = aws_db_parameter_group.postgres15.name

  tags = {
    Name = "tiketi-production-db"
  }
}

# Read Replica (읽기 부하 분산)
resource "aws_db_instance" "tiketi_read_replica" {
  identifier             = "tiketi-production-read-1"
  replicate_source_db    = aws_db_instance.tiketi_main.identifier
  instance_class         = "db.r6g.large"  # Primary보다 작게
  publicly_accessible    = false

  # Read Replica는 다른 AZ에 배치 (재해 복구)
  availability_zone      = "ap-northeast-2c"

  tags = {
    Name = "tiketi-production-read-replica"
  }
}

# PostgreSQL 파라미터 그룹 (성능 최적화)
resource "aws_db_parameter_group" "postgres15" {
  name   = "tiketi-postgres15"
  family = "postgres15"

  # Connection Pool 최적화
  parameter {
    name  = "max_connections"
    value = "500"  # 기본 100에서 증가
  }

  # 메모리 최적화
  parameter {
    name  = "shared_buffers"
    value = "8GB"  # 총 메모리의 25%
  }

  parameter {
    name  = "effective_cache_size"
    value = "24GB"  # 총 메모리의 75%
  }

  # 쿼리 성능 최적화
  parameter {
    name  = "work_mem"
    value = "16MB"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "2GB"
  }

  # WAL 설정 (복제 성능)
  parameter {
    name  = "wal_buffers"
    value = "16MB"
  }

  # 슬로우 쿼리 로깅
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # 1초 이상 쿼리 로깅
  }
}
```

**왜 Read Replica를 사용하는가?**
```
시나리오: 100,000명 접속 시 읽기/쓰기 비율
- 읽기: 90% (이벤트 조회, 좌석 조회)
- 쓰기: 10% (예약, 결제)

Read Replica 없이:
- Primary에 모든 부하 집중
- Connection Pool 고갈
- 쓰기 쿼리도 느려짐 (읽기 때문에)

Read Replica 사용:
- 읽기 쿼리는 Replica로 분산
- Primary는 쓰기에만 집중
- Connection Pool 여유
- 응답 시간 50% 감소
```

### 4.2 ElastiCache Redis 구성

```yaml
# Terraform으로 ElastiCache 생성
resource "aws_elasticache_replication_group" "tiketi_redis" {
  replication_group_id       = "tiketi-production"
  replication_group_description = "Redis for TIKETI - Cache, Session, Queue"

  # 엔진 설정
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.r6g.large"  # 13.07 GB 메모리

  # Cluster Mode (샤딩 지원)
  num_node_groups         = 3  # 3개 샤드
  replicas_per_node_group = 1  # 샤드당 1개 복제본

  # 고가용성
  multi_az_enabled       = true
  automatic_failover_enabled = true

  # 네트워크
  subnet_group_name      = aws_elasticache_subnet_group.redis.name
  security_group_ids     = [aws_security_group.redis.id]

  # 백업
  snapshot_retention_limit = 5
  snapshot_window         = "03:00-05:00"

  # 파라미터 그룹
  parameter_group_name = aws_elasticache_parameter_group.redis7.name

  # 알림
  notification_topic_arn = aws_sns_topic.redis_alerts.arn

  tags = {
    Name = "tiketi-production-redis"
  }
}

# Redis 파라미터 그룹
resource "aws_elasticache_parameter_group" "redis7" {
  name   = "tiketi-redis7"
  family = "redis7"

  # 메모리 관리 (LRU eviction)
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  # Timeout 설정
  parameter {
    name  = "timeout"
    value = "300"  # 5분
  }

  # Pub/Sub (WebSocket 동기화용)
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"  # Expired 이벤트 활성화
  }
}
```

**Cluster Mode vs Non-Cluster Mode:**
```
Non-Cluster Mode (단일 샤드):
- 최대 메모리: 6TB (cache.r6g.16xlarge)
- 확장: 수직만 가능
- 비용: 낮음
- 처리량: 제한적

Cluster Mode (다중 샤드):
- 최대 메모리: 무제한 (샤드 추가)
- 확장: 수평 확장 가능
- 비용: 높음
- 처리량: 샤드 수에 비례
- **단점: Redis Cluster 지원 라이브러리 필요**

→ 선택: Cluster Mode (대규모 트래픽 대비)
```

### 4.3 데이터베이스 연결 관리

**Connection Pool 설정:**
```javascript
// Queue Service (대량 연결)
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: 'queue_db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Pool 설정
  max: 50,  // 최대 50개 연결 (Pod당)
  min: 10,  // 최소 10개 유지
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,

  // 재시도 로직
  retryDelay: 1000,
  maxRetries: 3
});

// 연결 상태 모니터링
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  metrics.increment('db.pool.error');
});

pool.on('connect', (client) => {
  metrics.increment('db.pool.connect');
});
```

**RDS Proxy 사용 (권장):**
```yaml
# RDS Proxy로 연결 관리 위임
resource "aws_db_proxy" "tiketi" {
  name                   = "tiketi-proxy"
  engine_family          = "POSTGRESQL"
  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db_password.arn
  }

  role_arn               = aws_iam_role.proxy.arn
  vpc_subnet_ids         = [subnet-private-a, subnet-private-c]

  # Connection Pooling 설정
  idle_client_timeout    = 1800  # 30분
  max_connections_percent = 100
  max_idle_connections_percent = 50
}

# 장점:
# 1. Connection Pool 자동 관리
# 2. 장애 시 자동 재연결
# 3. IAM 인증 지원
# 4. Lambda와 통합 용이
```

---

## 5. CDN 및 정적 자산 전략

### 5.1 CloudFront 배포

```yaml
resource "aws_cloudfront_distribution" "tiketi_frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "TIKETI Frontend Distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_200"  # US, EU, Asia

  # S3 오리진 (Frontend 정적 파일)
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "S3-Frontend"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.frontend.cloudfront_access_identity_path
    }
  }

  # ALB 오리진 (Backend API)
  origin {
    domain_name = aws_lb.api.dns_name
    origin_id   = "ALB-API"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # 기본 동작 (Frontend)
  default_cache_behavior {
    target_origin_id       = "S3-Frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600    # 1시간
    max_ttl     = 86400   # 24시간
  }

  # API 경로 (캐싱 없음)
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "ALB-API"
    viewer_protocol_policy = "https-only"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = false

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Accept", "Content-Type"]
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0  # 캐싱 안 함
    max_ttl     = 0
  }

  # SSL 인증서
  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.tiketi.arn
    ssl_support_method  = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # 커스텀 도메인
  aliases = ["tiketi.com", "www.tiketi.com"]

  # 지역 제한 (선택 사항)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}
```

**왜 CloudFront를 사용하는가?**
```
S3 Direct Access:
- 서울 리전에서만 빠름
- 미국 사용자: 200ms+ 지연
- DDoS 취약
- 비용: S3 전송 비용 ($0.126/GB)

CloudFront + S3:
- 전 세계 엣지 로케이션에서 제공
- 미국 사용자: 50ms 지연
- AWS Shield Standard 자동 적용 (DDoS 방어)
- 비용: CloudFront 전송 비용 ($0.085/GB)
- 캐시 히트율 80%면 S3 요청 80% 감소
```

### 5.2 S3 버킷 구성

```yaml
resource "aws_s3_bucket" "frontend" {
  bucket = "tiketi-frontend-production"

  tags = {
    Name = "TIKETI Frontend Assets"
  }
}

# 버전 관리 (롤백 용이)
resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

# 암호화
resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Public Access 차단 (CloudFront만 접근)
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront OAI 정책
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOAI"
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.frontend.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })
}

# Lifecycle 정책 (오래된 버전 삭제)
resource "aws_s3_bucket_lifecycle_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}
```

---

## 6. 보안 아키텍처

### 6.1 AWS WAF 규칙

```yaml
resource "aws_wafv2_web_acl" "tiketi" {
  name  = "tiketi-protection"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # 규칙 1: Rate Limiting (IP당 요청 제한)
  rule {
    name     = "rate-limit-per-ip"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000  # 5분당 2000 요청
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "RateLimitRule"
      sampled_requests_enabled  = true
    }
  }

  # 규칙 2: SQL Injection 차단
  rule {
    name     = "block-sql-injection"
    priority = 2

    action {
      block {}
    }

    statement {
      sqli_match_statement {
        field_to_match {
          body {}
        }
        text_transformation {
          priority = 1
          type     = "URL_DECODE"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "SQLiRule"
      sampled_requests_enabled  = true
    }
  }

  # 규칙 3: 지역 차단 (선택 사항)
  rule {
    name     = "geo-blocking"
    priority = 3

    action {
      block {}
    }

    statement {
      geo_match_statement {
        country_codes = ["KP"]  # 북한 차단
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "GeoBlockRule"
      sampled_requests_enabled  = true
    }
  }
}
```

### 6.2 Secrets Manager

```yaml
# DB 비밀번호 관리
resource "aws_secretsmanager_secret" "db_password" {
  name = "tiketi/production/db-password"

  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = jsonencode({
    username = "tiketi_admin"
    password = random_password.db.result
    host     = aws_db_instance.tiketi_main.address
    port     = 5432
    database = "tiketi_production"
  })
}

# EKS에서 사용 (External Secrets Operator)
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-2
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets
    kind: SecretStore
  target:
    name: db-credentials
    creationPolicy: Owner
  data:
  - secretKey: DB_HOST
    remoteRef:
      key: tiketi/production/db-password
      property: host
  - secretKey: DB_PASSWORD
    remoteRef:
      key: tiketi/production/db-password
      property: password
```

---

## 7. 고가용성 및 재해 복구

### 7.1 Multi-AZ 전략

```
┌────────────────────────────────────────────────────┐
│ Availability Zone A                                │
├────────────────────────────────────────────────────┤
│ - EKS Nodes: 5개                                   │
│ - RDS Primary                                      │
│ - ElastiCache Node 1, 3, 5                        │
│ - NAT Gateway A                                    │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ Availability Zone C                                │
├────────────────────────────────────────────────────┤
│ - EKS Nodes: 5개                                   │
│ - RDS Standby (자동 failover)                      │
│ - ElastiCache Node 2, 4, 6                        │
│ - NAT Gateway C                                    │
└────────────────────────────────────────────────────┘

장애 시나리오:
1. AZ-A 전체 장애 발생
2. RDS Standby (AZ-C)가 Primary로 승격 (1-2분)
3. ElastiCache 자동 failover (30초)
4. EKS Pod는 AZ-C 노드로 재배치 (1분)
5. 전체 복구 시간: 2-3분
6. 사용자 영향: 최소 (자동 재시도로 대부분 성공)
```

### 7.2 백업 전략

```yaml
# RDS 자동 백업
Backup Retention: 35일
Backup Window: 03:00-04:00 UTC (한국 시간 12:00-13:00)
Snapshot: 주 1회 수동 스냅샷 (무기한 보관)

# ElastiCache 백업
Snapshot Retention: 5일
Snapshot Window: 03:00-05:00 UTC

# S3 버전 관리
Versioning: Enabled
Lifecycle: 90일 후 이전 버전 삭제

# EKS etcd 백업
AWS가 자동 관리 (3개 AZ 복제)
```

---

## 다음 단계

AWS 인프라 설계를 완료했습니다. 이제 Kubernetes 설정과 배포 전략으로 넘어갑니다.

👉 **[Part 4: Kubernetes 설정 및 배포로 이동](./msa-migration-guide-04-kubernetes.md)**
