# Tiketi AWS 클라우드 아키텍처 계획서

## 📋 목차
1. [현재 아키텍처 (Docker Compose)](#현재-아키텍처)
2. [AWS 아키텍처 설계](#aws-아키텍처-설계)
3. [서비스별 상세 계획](#서비스별-상세-계획)
4. [비용 분석](#비용-분석)
5. [마이그레이션 로드맵](#마이그레이션-로드맵)
6. [성능 개선 예상](#성능-개선-예상)

---

## 🏗️ 현재 아키텍처 (Docker Compose)

### 구성 요소
```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTP/WS
┌──────▼──────────────────────┐
│  Frontend (React)           │
│  Port: 3000                 │
└──────┬──────────────────────┘
       │ API/WebSocket
┌──────▼──────────────────────┐
│  Backend (Node.js)          │
│  Port: 3001                 │
│  - REST API                 │
│  - WebSocket (Socket.IO)    │
│  - 분산 락 관리              │
└──────┬──────────────────────┘
       │
   ┌───┴────┐
   │        │
┌──▼──┐  ┌─▼──────┐
│ PG  │  │ Redis  │
│5432 │  │ 6379   │
└─────┘  └────────┘
```

### 한계점
- ❌ 단일 서버 (SPOF - Single Point of Failure)
- ❌ 수동 스케일링 (트래픽 급증 대응 불가)
- ❌ 수동 백업 (재해 복구 어려움)
- ❌ 글로벌 배포 불가 (CDN 없음)
- ❌ 모니터링 부족 (수동 로그 확인)

---

## 🌐 AWS 아키텍처 설계

### 전체 아키텍처 개요

```
                    Internet
                       │
                       │
            ┌──────────▼──────────┐
            │   Route 53 (DNS)    │
            │  tiketi.gg          │
            └──────────┬──────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        │                             │
┌───────▼─────────┐          ┌───────▼─────────┐
│  CloudFront     │          │  CloudFront     │
│  (Global CDN)   │          │  (API Gateway)  │
│  - 정적 파일     │          │  - API 캐싱     │
└───────┬─────────┘          └───────┬─────────┘
        │                             │
┌───────▼─────────┐          ┌───────▼─────────┐
│  S3 Bucket      │          │  ALB (ELB)      │
│  - React Build  │          │  - SSL/TLS      │
│  - 정적 자산    │          │  - Health Check │
└─────────────────┘          │  - Sticky Sess. │
                             └───────┬─────────┘
                                     │
                          ┌──────────┴──────────┐
                          │   VPC               │
                          │  (10.0.0.0/16)      │
                          │                     │
                    ┌─────┴─────┐         ┌─────┴─────┐
                    │  Public   │         │  Private  │
                    │  Subnet   │         │  Subnet   │
                    │           │         │           │
              ┌─────▼─────┐     │   ┌─────▼─────┐    │
              │    NAT    │     │   │    ECS    │    │
              │  Gateway  │     │   │  Fargate  │    │
              └───────────┘     │   │ (Backend) │    │
                                │   │  - API    │    │
                                │   │  - WS     │    │
                                │   └─────┬─────┘    │
                                │         │          │
                                │   ┌─────▼─────┐    │
                                │   │ElastiCache│    │
                                │   │  Redis    │    │
                                │   │ (Cluster) │    │
                                │   └───────────┘    │
                                │                    │
                                │   ┌──────────┐     │
                                │   │   RDS    │     │
                                │   │PostgreSQL│     │
                                │   │(Multi-AZ)│     │
                                │   └──────────┘     │
                                └────────────────────┘
```

### 핵심 설계 원칙

1. **고가용성 (HA)**: Multi-AZ 배포
2. **확장성**: Auto Scaling (수평 확장)
3. **보안**: VPC, Security Groups, Private Subnet
4. **성능**: CDN, 캐싱, Read Replica
5. **모니터링**: CloudWatch, X-Ray
6. **비용 최적화**: Spot Instances, Reserved Instances

---

## 🔧 서비스별 상세 계획

### 1. Frontend (S3 + CloudFront)

#### S3 Bucket
```
Bucket Name: tiketi-frontend-prod
Region: ap-northeast-2 (서울)
Versioning: Enabled (롤백 가능)
Encryption: AES-256 (S3 Managed)
Lifecycle: 30일 이전 버전 삭제
```

**파일 구조**:
```
tiketi-frontend-prod/
├── index.html
├── static/
│   ├── css/
│   ├── js/
│   └── media/
└── manifest.json
```

#### CloudFront Distribution
```
Origin: tiketi-frontend-prod.s3.ap-northeast-2.amazonaws.com
SSL Certificate: ACM (*.tiketi.gg)
Price Class: Use All Edge Locations (글로벌)
Default TTL: 86400 (24시간)
Compress: Enabled (Gzip)
HTTP Version: HTTP/2
```

**캐싱 정책**:
- HTML: 5분 (자주 업데이트)
- JS/CSS: 1년 (해시 기반 파일명)
- 이미지: 1주일

**예상 비용**: ~$5/월 (1TB 전송)

---

### 2. Backend (ECS Fargate + ALB)

#### Application Load Balancer (ALB)
```
Name: tiketi-alb-prod
Scheme: Internet-facing
IP Address Type: IPv4
Listeners:
  - HTTP (80) → HTTPS (443) 리다이렉트
  - HTTPS (443) → Target Group

Health Check:
  Path: /health
  Interval: 30초
  Timeout: 5초
  Healthy Threshold: 2
  Unhealthy Threshold: 3

Sticky Session: Enabled (WebSocket 지원)
Duration: 300초
```

#### ECS Fargate Cluster
```
Cluster Name: tiketi-cluster-prod
Launch Type: Fargate (서버리스)

Task Definition:
  Family: tiketi-backend
  CPU: 2 vCPU (2048)
  Memory: 4 GB (4096)
  Network Mode: awsvpc

Container Definition:
  Name: tiketi-backend-container
  Image: <ECR_REPO>/tiketi-backend:latest
  Port: 3001

Environment Variables:
  - NODE_ENV=production
  - DB_HOST=<RDS_ENDPOINT>
  - REDIS_HOST=<ELASTICACHE_ENDPOINT>
  - JWT_SECRET (Secrets Manager)
```

#### Auto Scaling
```
Service: tiketi-backend-service
Desired Count: 2 (최소 가용성)
Minimum: 2
Maximum: 10

Scaling Policy:
  - Target Tracking (CPU 70%)
  - Target Tracking (Memory 70%)
  - Target Tracking (ALB Request Count > 1000/min)

Scale Out: 1분 대기 후 스케일
Scale In: 5분 대기 후 스케일 (안정성)
```

**예상 비용**:
- 2 Tasks 상시: ~$100/월
- 피크 시간 (5 Tasks): ~$250/월

---

### 3. Database (RDS PostgreSQL)

#### RDS Instance
```
Engine: PostgreSQL 15
Instance Class: db.t3.medium
  - vCPU: 2
  - RAM: 4 GB
  - Network: Moderate

Storage:
  Type: gp3 (General Purpose SSD)
  Size: 20 GB (Auto Scaling → 50 GB)
  IOPS: 3000 (기본)
  Throughput: 125 MB/s

Deployment:
  Multi-AZ: Enabled (고가용성)
  Standby: 동기식 복제 (자동 failover)

Backup:
  Automated Backup: Enabled
  Retention: 7일
  Backup Window: 03:00-04:00 KST (새벽)

Maintenance:
  Window: 월요일 04:00-05:00 KST
  Auto Minor Version Upgrade: Enabled

Parameter Group:
  timezone: Asia/Seoul
  log_statement: all (초기 디버깅용)
  max_connections: 100
```

#### Read Replica (선택 사항)
```
읽기 트래픽 70% 이상 시 추가:
  Instance: db.t3.small
  Region: Same (ap-northeast-2)
  복제 지연: < 1초

용도:
  - 이벤트 목록 조회
  - 좌석 상태 조회
  - 통계 쿼리
```

**예상 비용**:
- Primary: ~$80/월
- Read Replica (선택): ~$40/월

---

### 4. Cache (ElastiCache Redis)

#### Redis Cluster
```
Engine: Redis 7.0
Node Type: cache.t3.micro
  - vCPU: 2
  - RAM: 0.5 GB
  - Network: Low to Moderate

Cluster Mode: Enabled
Shards: 2 (데이터 분산)
Replicas: 1 per Shard (읽기 확장)

Total Nodes: 4
  - 2 Primary (Shard 1, 2)
  - 2 Replica (각 Shard당 1개)

Deployment:
  Multi-AZ: Enabled
  Auto Failover: Enabled

Snapshot:
  Daily Backup: Enabled
  Retention: 3일
  Window: 04:00-05:00 KST

Eviction Policy: volatile-lru (TTL 있는 키만 삭제)
```

**데이터 분산 전략**:
```
Shard 1: 이벤트 캐시 (event:*, events:*)
Shard 2: 세션, 분산 락 (seat:*, session:*)
```

**예상 비용**: ~$30/월 (4 노드)

---

### 5. 네트워크 (VPC & Security)

#### VPC
```
CIDR Block: 10.0.0.0/16 (65,536 IP)

Availability Zones: 2개 (ap-northeast-2a, 2c)

Subnets:
  Public Subnet A:  10.0.1.0/24 (256 IP) - AZ-a
  Public Subnet C:  10.0.2.0/24 (256 IP) - AZ-c
  Private Subnet A: 10.0.11.0/24 (256 IP) - AZ-a
  Private Subnet C: 10.0.12.0/24 (256 IP) - AZ-c

Internet Gateway: tiketi-igw (Public Subnet 연결)
NAT Gateway: tiketi-nat-a, tiketi-nat-c (각 AZ)
```

#### Security Groups

**ALB Security Group**:
```
Inbound:
  - Port 80 (HTTP) from 0.0.0.0/0
  - Port 443 (HTTPS) from 0.0.0.0/0

Outbound:
  - All Traffic to ECS Security Group
```

**ECS Security Group**:
```
Inbound:
  - Port 3001 from ALB Security Group

Outbound:
  - Port 5432 to RDS Security Group
  - Port 6379 to ElastiCache Security Group
  - Port 443 to 0.0.0.0/0 (외부 API 호출)
```

**RDS Security Group**:
```
Inbound:
  - Port 5432 from ECS Security Group

Outbound:
  - None (필요 없음)
```

**ElastiCache Security Group**:
```
Inbound:
  - Port 6379 from ECS Security Group

Outbound:
  - None (필요 없음)
```

---

### 6. CI/CD (GitHub Actions + ECR)

#### ECR (Elastic Container Registry)
```
Repository: tiketi-backend
Lifecycle Policy:
  - 최신 10개 이미지만 유지
  - 30일 이상 된 이미지 삭제

Image Tagging:
  - latest (최신 프로덕션)
  - <git-commit-sha> (추적 가능)
  - v1.0.0 (릴리스 버전)
```

#### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    - Build React
    - Upload to S3
    - Invalidate CloudFront Cache

  deploy-backend:
    - Build Docker Image
    - Push to ECR
    - Update ECS Service (Rolling Update)
```

**배포 전략**:
- Rolling Update (무중단 배포)
- Blue/Green Deployment (선택 사항)

---

### 7. 모니터링 & 로깅

#### CloudWatch

**Metrics**:
```
ECS:
  - CPU Utilization
  - Memory Utilization
  - Task Count

ALB:
  - Request Count
  - Target Response Time
  - HTTP 5xx Errors

RDS:
  - CPU Utilization
  - Database Connections
  - Read/Write IOPS

ElastiCache:
  - CPU Utilization
  - Cache Hit Rate
  - Evictions
```

**Alarms**:
```
Critical (SMS + Email):
  - ECS CPU > 90% (5분)
  - RDS Connection > 90/100
  - ALB 5xx > 10/min

Warning (Email):
  - ECS CPU > 70% (10분)
  - Cache Hit Rate < 80%
  - RDS Storage < 20%
```

#### CloudWatch Logs
```
Log Groups:
  - /ecs/tiketi-backend (Application 로그)
  - /rds/tiketi-db (Slow Query 로그)
  - /elasticache/tiketi-redis (Redis 로그)

Retention: 7일 (개발), 30일 (프로덕션)
```

#### X-Ray (분산 추적)
```
Services:
  - ALB → ECS → RDS
  - ALB → ECS → ElastiCache

Tracing:
  - API 응답 시간
  - DB 쿼리 시간
  - 병목 지점 식별
```

**예상 비용**: ~$10/월

---

### 8. 보안 (IAM & Secrets Manager)

#### IAM Roles

**ECS Task Role**:
```
Permissions:
  - ECR (이미지 Pull)
  - CloudWatch Logs (로그 전송)
  - Secrets Manager (비밀 정보 조회)
  - X-Ray (추적 데이터 전송)
```

**CodeDeploy Role**:
```
Permissions:
  - ECS (서비스 업데이트)
  - ECR (이미지 조회)
  - CloudWatch (배포 모니터링)
```

#### Secrets Manager
```
Secrets:
  - tiketi/db/password
  - tiketi/jwt/secret
  - tiketi/redis/password (선택)

Rotation: 90일 자동 로테이션
```

**예상 비용**: ~$2/월

---

## 💰 비용 분석

### 월간 예상 비용 (서울 리전 기준)

| 서비스 | 스펙 | 비용 (USD) | 비고 |
|--------|------|-----------|------|
| **CloudFront** | 1TB 전송 | $5 | 글로벌 CDN |
| **S3** | 10GB 저장 | $0.25 | 정적 파일 |
| **ALB** | 1개 | $23 | 기본 요금 + 트래픽 |
| **ECS Fargate** | 2 Tasks 상시 | $100 | 2 vCPU, 4GB RAM |
| **RDS PostgreSQL** | db.t3.medium, Multi-AZ | $80 | 20GB gp3 |
| **ElastiCache Redis** | cache.t3.micro × 4 | $30 | Cluster Mode |
| **NAT Gateway** | 2개 (Multi-AZ) | $70 | 100GB 전송 |
| **CloudWatch** | Logs + Metrics | $10 | 7일 보관 |
| **Secrets Manager** | 3 Secrets | $2 | 비밀 정보 관리 |
| **Route 53** | 1 Hosted Zone | $0.50 | DNS |
| **ECR** | 10GB 이미지 | $1 | 컨테이너 저장소 |
| **예비비** | - | $28.25 | 10% 버퍼 |
| **합계** | | **$350/월** | |

### 비용 최적화 방안

#### 1. Reserved Instances (1년 약정)
```
RDS: $80/월 → $55/월 (31% 절감)
ElastiCache: $30/월 → $20/월 (33% 절감)

절감: $35/월 × 12개월 = $420/년
```

#### 2. Savings Plans (ECS Fargate)
```
ECS: $100/월 → $70/월 (30% 절감)

절감: $30/월 × 12개월 = $360/년
```

#### 3. 개발 환경 비용 절감
```
- Single-AZ (Multi-AZ 비활성화)
- 작은 인스턴스 (db.t3.micro, cache.t3.nano)
- NAT Gateway 1개만

개발 환경: ~$100/월 (프로덕션의 30%)
```

#### 4. Auto Scaling 최적화
```
- 평소: 2 Tasks ($100/월)
- 피크 타임 (1시간/일): 5 Tasks (+$5/월)
- 심야: 1 Task (-$25/월)

실제 비용: ~$80/월 (20% 절감)
```

### 최종 예상 비용

| 환경 | 최적화 전 | 최적화 후 | 절감률 |
|------|----------|----------|--------|
| **개발** | $150/월 | $100/월 | 33% |
| **프로덕션** | $350/월 | $250/월 | 29% |
| **합계** | $500/월 | $350/월 | 30% |

---

## 📈 성능 개선 예상

### Before (Docker Compose) vs After (AWS)

| 지표 | Before | After | 개선율 |
|------|--------|-------|--------|
| **가용성** | 95% (단일 서버) | 99.95% (Multi-AZ) | **5% ↑** |
| **응답 시간 (P95)** | 500ms | 150ms | **70% ↓** |
| **최대 TPS** | 100 | 1000+ | **1000% ↑** |
| **동시 접속** | 500명 | 10,000명+ | **2000% ↑** |
| **배포 시간** | 5분 (중단) | 3분 (무중단) | **무중단** |
| **복구 시간 (RTO)** | 30분 (수동) | 1분 (자동) | **97% ↓** |
| **데이터 손실 (RPO)** | 1일 | 0 (동기 복제) | **100% ↓** |
| **글로벌 지연** | 500ms+ | 50ms (CDN) | **90% ↓** |

---

## 🚀 마이그레이션 로드맵

### Phase 1: 인프라 준비 (Week 1)

**Day 1-2: VPC 및 네트워크**
- [ ] VPC 생성 (10.0.0.0/16)
- [ ] Subnet 생성 (Public × 2, Private × 2)
- [ ] Internet Gateway 연결
- [ ] NAT Gateway 생성 (2개, Multi-AZ)
- [ ] Route Table 구성

**Day 3-4: 데이터베이스**
- [ ] RDS PostgreSQL 생성 (Multi-AZ)
- [ ] Parameter Group 설정 (timezone: Asia/Seoul)
- [ ] Security Group 구성
- [ ] 초기 데이터 마이그레이션 (dump → restore)

**Day 5: 캐시**
- [ ] ElastiCache Redis Cluster 생성
- [ ] Security Group 구성
- [ ] 연결 테스트

---

### Phase 2: 애플리케이션 배포 (Week 2)

**Day 1-2: 컨테이너화**
- [ ] Dockerfile 최적화 (멀티 스테이지 빌드)
- [ ] ECR Repository 생성
- [ ] Docker 이미지 빌드 및 푸시

**Day 3-4: ECS 설정**
- [ ] ECS Cluster 생성
- [ ] Task Definition 작성
- [ ] Service 생성 (Desired: 2)
- [ ] Auto Scaling 정책 설정

**Day 5: 로드 밸런서**
- [ ] ALB 생성
- [ ] Target Group 설정
- [ ] Health Check 구성
- [ ] Sticky Session 활성화

---

### Phase 3: 프론트엔드 배포 (Week 2)

**Day 1-2: S3 + CloudFront**
- [ ] S3 Bucket 생성 (Static Website Hosting)
- [ ] React 빌드 업로드
- [ ] CloudFront Distribution 생성
- [ ] SSL 인증서 발급 (ACM)

**Day 3: DNS 설정**
- [ ] Route 53 Hosted Zone 생성
- [ ] A Record 생성 (CloudFront, ALB)
- [ ] 도메인 연결

---

### Phase 4: CI/CD 구축 (Week 3)

**Day 1-2: GitHub Actions**
- [ ] Workflow 파일 작성 (.github/workflows/deploy.yml)
- [ ] AWS Credentials 설정 (GitHub Secrets)
- [ ] 배포 자동화 테스트

**Day 3: 모니터링**
- [ ] CloudWatch Dashboard 생성
- [ ] Alarm 설정 (CPU, Memory, 5xx)
- [ ] SNS Topic 생성 (이메일 알림)

**Day 4: 로깅**
- [ ] CloudWatch Logs 설정
- [ ] Log Insights 쿼리 작성
- [ ] X-Ray 활성화 (분산 추적)

---

### Phase 5: 부하 테스트 및 최적화 (Week 3)

**Day 1-2: 부하 테스트**
- [ ] Apache Bench / wrk로 부하 테스트
- [ ] 목표 TPS: 1000
- [ ] 응답 시간 측정 (P50, P95, P99)

**Day 3: 성능 최적화**
- [ ] Auto Scaling 튜닝
- [ ] 캐시 전략 최적화 (TTL 조정)
- [ ] DB 쿼리 최적화 (Slow Query 분석)

**Day 4: 보안 점검**
- [ ] Security Group 최소 권한 적용
- [ ] IAM Role 권한 검토
- [ ] Secrets Manager 로테이션 설정

---

### Phase 6: 프로덕션 전환 (Week 4)

**Day 1: Dry Run**
- [ ] 개발 환경에서 전체 테스트
- [ ] 롤백 계획 수립
- [ ] 체크리스트 작성

**Day 2: 프로덕션 배포**
- [ ] DNS 전환 (Route 53)
- [ ] 트래픽 모니터링
- [ ] 에러 로그 확인

**Day 3-4: 안정화**
- [ ] 24시간 모니터링
- [ ] 성능 지표 수집
- [ ] 사용자 피드백 수집

**Day 5: 최종 점검**
- [ ] 비용 확인 (Cost Explorer)
- [ ] 문서화 (운영 가이드)
- [ ] 팀 교육 (AWS Console 사용법)

---

## 🔐 보안 체크리스트

### 네트워크 보안
- [ ] VPC Private Subnet에 모든 데이터 리소스 배치
- [ ] Security Group 최소 권한 원칙 적용
- [ ] Network ACL 구성 (선택)
- [ ] VPC Flow Logs 활성화

### 애플리케이션 보안
- [ ] ALB에 SSL/TLS 적용 (ACM 인증서)
- [ ] HTTP → HTTPS 리다이렉트
- [ ] JWT Secret을 Secrets Manager에 저장
- [ ] 환경 변수에 민감 정보 노출 방지

### 데이터 보안
- [ ] RDS 암호화 (AES-256)
- [ ] 자동 백업 활성화 (7일 보관)
- [ ] S3 Versioning 활성화 (롤백 가능)
- [ ] CloudTrail 활성화 (감사 로그)

### 접근 제어
- [ ] IAM 최소 권한 원칙
- [ ] MFA 활성화 (Root 계정)
- [ ] IAM Password Policy 설정
- [ ] 미사용 Access Key 삭제

---

## 📚 참고 자료

### AWS 공식 문서
- [ECS Fargate Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [RDS PostgreSQL Performance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [ElastiCache for Redis Best Practices](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/BestPractices.html)
- [ALB Access Logs](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html)

### 아키텍처 패턴
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Three-Tier Architecture on AWS](https://docs.aws.amazon.com/whitepapers/latest/web-application-hosting-best-practices/an-aws-cloud-architecture-for-web-hosting.html)
- [Microservices on AWS](https://d1.awsstatic.com/whitepapers/microservices-on-aws.pdf)

---

## ✅ 최종 체크리스트

### 마이그레이션 전
- [ ] 현재 시스템 백업 완료
- [ ] AWS 계정 생성 및 결제 설정
- [ ] 도메인 구매 (tiketi.gg)
- [ ] 팀원 교육 완료

### 마이그레이션 중
- [ ] 인프라 생성 (Terraform/CloudFormation 권장)
- [ ] 데이터 마이그레이션 테스트
- [ ] 배포 자동화 구축
- [ ] 모니터링 설정

### 마이그레이션 후
- [ ] 성능 테스트 완료
- [ ] 비용 최적화 적용
- [ ] 문서화 완료
- [ ] 운영 프로세스 수립

---

<div align="center">

**🌐 Tiketi AWS 클라우드 전환 프로젝트**

*"Docker Compose MVP → AWS 프로덕션 전환 완료"*

**작성일**: 2025년 10월 31일

</div>
