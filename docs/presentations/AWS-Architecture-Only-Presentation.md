# TIKETI AWS 아키텍처 설명 대본
> **Draw.io 다이어그램 기반 AWS 서비스 상세 설명**

---

## 🎯 발표 시작

안녕하세요, 오늘은 TIKETI 티켓팅 플랫폼의 AWS 프로덕션 아키텍처를 설명드리겠습니다.

특히 **각 AWS 서비스가 어떤 역할을 하고, 어떻게 연결되는지**에 집중해서 말씀드리겠습니다.

---

## 1️⃣ 전체 아키텍처 개요

### 📊 다이어그램 상단: 사용자 접속 경로

```
사용자 (tiketi.gg 입력)
    ↓
[Route 53] DNS 조회
    ↓
[CloudFront] 전세계 CDN
    ↓
┌──────────────┬────────────────┐
│  [S3 Bucket] │  [Internet GW] │
│   React 앱   │   → [ALB]      │
└──────────────┴────────────────┘
```

### 📊 다이어그램 중앙: VPC 내부 구조

```
[VPC] 10.0.0.0/16
│
├─ [Availability Zone A]
│  ├─ Public Subnet (10.0.1.0/24)
│  │  └─ [NAT Gateway]
│  │
│  ├─ Private Subnet (10.0.11.0/24)
│  │  ├─ [EC2-1] Backend
│  │  ├─ [EC2-2] Backend
│  │  ├─ [EC2-3] Backend
│  │  └─ [ElastiCache] Redis Primary
│  │
│  └─ DB Subnet (10.0.21.0/24)
│     └─ [RDS Aurora] Primary
│
└─ [Availability Zone B]
   ├─ Public Subnet (10.0.2.0/24)
   │  └─ [NAT Gateway]
   │
   ├─ Private Subnet (10.0.12.0/24)
   │  ├─ [EC2-4] Backend
   │  ├─ [EC2-5] Backend
   │  └─ [ElastiCache] Redis Replica
   │
   └─ DB Subnet (10.0.22.0/24)
      └─ [RDS Aurora] Replica
```

### 📊 다이어그램 하단: Auto Scaling 시스템

```
[Lambda] Queue Monitor
    ↓ (1분마다 대기열 측정)
[CloudWatch] Alarms
    ↓ (임계값 초과 시)
[Auto Scaling Group]
    ↓ (EC2 추가/제거)
[EC2 Instances]
```

---

## 2️⃣ Route 53 - DNS 서비스

### 🎯 역할

**도메인 이름을 IP 주소로 변환**하는 AWS의 DNS 서비스입니다.

```
사용자가 브라우저에 입력: tiketi.gg
    ↓
Route 53이 응답: "d123abc.cloudfront.net으로 가세요"
```

### ⚙️ 설정

```json
{
  "HostedZone": {
    "Name": "tiketi.gg",
    "Type": "Public"
  },
  "RecordSets": [
    {
      "Name": "tiketi.gg",
      "Type": "A",
      "AliasTarget": {
        "DNSName": "d123abc.cloudfront.net",
        "HostedZoneId": "Z2FDTNDATAQYW2"
      }
    }
  ]
}
```

### 💡 핵심 포인트

- **글로벌 서비스**: 전세계 어디서든 빠른 DNS 조회
- **헬스 체크**: 장애 감지 시 자동으로 다른 엔드포인트로 라우팅
- **비용**: 월 ₩500 (Hosted Zone 1개)

---

## 3️⃣ CloudFront - CDN (Content Delivery Network)

### 🎯 역할

**전세계 엣지 로케이션에서 정적 파일을 캐싱**하여 빠르게 제공합니다.

```
서울 사용자 → 서울 엣지 (10ms)
LA 사용자 → LA 엣지 (15ms)
런던 사용자 → 런던 엣지 (20ms)
```

S3가 서울에만 있어도, CloudFront가 전세계에 복사해두기 때문에 모두 빠릅니다!

### ⚙️ 동작 방식

```
1. 사용자: "tiketi.gg/index.html 요청"
   ↓
2. CloudFront: "가장 가까운 엣지 로케이션 확인"
   ↓
3. 엣지 로케이션: "캐시 확인"
   ├─ 있음 → 즉시 응답 (10ms)
   └─ 없음 → S3에서 가져와 캐싱 (100ms)
   ↓
4. 이후 요청: 캐시된 파일 제공 (10ms)
```

### ⚙️ 설정

```json
{
  "Origins": [
    {
      "Id": "S3-React",
      "DomainName": "tiketi-frontend.s3.ap-northeast-2.amazonaws.com"
    },
    {
      "Id": "ALB-API",
      "DomainName": "tiketi-alb-123.ap-northeast-2.elb.amazonaws.com"
    }
  ],
  "Behaviors": [
    {
      "PathPattern": "/",
      "TargetOriginId": "S3-React",
      "ViewerProtocolPolicy": "redirect-to-https",
      "Compress": true,
      "DefaultTTL": 86400
    },
    {
      "PathPattern": "/api/*",
      "TargetOriginId": "ALB-API",
      "ViewerProtocolPolicy": "https-only",
      "AllowedMethods": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    }
  ]
}
```

### 💡 핵심 포인트

- **정적 파일만 캐싱**: React 빌드 파일 (HTML, CSS, JS, 이미지)
- **동적 API는 ALB로**: `/api/*` 경로는 캐싱 없이 바로 ALB로 전달
- **HTTPS 강제**: 모든 HTTP 요청을 HTTPS로 자동 리디렉션
- **압축**: Gzip/Brotli로 파일 크기 70% 감소
- **비용**: 1TB 전송 시 무료 (프리티어)

---

## 4️⃣ S3 - 정적 파일 저장소

### 🎯 역할

**React 빌드 파일과 사용자 업로드 파일**을 저장합니다.

### 📦 두 가지 버킷

**1) tiketi-frontend-bucket (프론트엔드)**
```
/index.html
/static/css/main.abc123.css
/static/js/main.abc123.js
/static/media/logo.svg
```

**2) tiketi-uploads-bucket (사용자 업로드)**
```
/events/event-123/poster.jpg
/events/event-456/poster.jpg
```

### ⚙️ 설정

```json
{
  "BucketName": "tiketi-frontend-bucket",
  "Region": "ap-northeast-2",
  "Versioning": "Enabled",
  "PublicAccessBlock": {
    "BlockPublicAcls": false
  },
  "CorsConfiguration": {
    "CorsRules": [
      {
        "AllowedOrigins": ["https://tiketi.gg"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedHeaders": ["*"]
      }
    ]
  }
}
```

### 💡 핵심 포인트

- **정적 웹사이트 호스팅**: 서버 없이 React 앱 배포
- **버전 관리**: 이전 버전 파일 자동 보관
- **비용**: 50GB 저장 시 ₩2,000/월
- **CloudFront Origin**: CloudFront가 여기서 파일을 가져감

---

## 5️⃣ VPC - 가상 네트워크

### 🎯 역할

**AWS 클라우드에서 논리적으로 격리된 우리만의 네트워크 공간**입니다.

```
VPC (10.0.0.0/16)
├─ 약 65,536개 IP 주소 사용 가능
└─ 우리 서버, DB, 캐시 모두 이 네트워크 안에 있음
```

### 📐 CIDR 블록 설계

```
VPC:         10.0.0.0/16    (전체)

Public Subnet A:   10.0.1.0/24     (256개 IP)
Public Subnet B:   10.0.2.0/24     (256개 IP)

Private Subnet A:  10.0.11.0/24    (256개 IP)
Private Subnet B:  10.0.12.0/24    (256개 IP)

DB Subnet A:       10.0.21.0/24    (256개 IP)
DB Subnet B:       10.0.22.0/24    (256개 IP)
```

### 🔐 3층 보안 계층

```
1층 (Public Subnet):
   - 외부에서 접근 가능
   - ALB, NAT Gateway 배치
   - 인터넷과 직접 통신

2층 (Private Subnet):
   - 외부에서 접근 불가
   - EC2, ElastiCache 배치
   - ALB를 통해서만 접근

3층 (DB Subnet):
   - 최고 보안 영역
   - RDS Aurora 배치
   - EC2에서만 접근 가능
```

### 💡 핵심 포인트

- **격리**: 다른 AWS 고객과 완전히 분리된 네트워크
- **보안**: Security Group으로 트래픽 제어
- **확장성**: 서브넷 추가로 쉽게 확장

---

## 6️⃣ Multi-AZ (가용 영역) 구성

### 🎯 역할

**물리적으로 분리된 데이터센터에 리소스를 분산**하여 장애 대응합니다.

### 🏢 가용 영역이란?

```
서울 리전 (ap-northeast-2)
├─ AZ-A (ap-northeast-2a): 첫 번째 데이터센터
│  - 독립적인 전력, 네트워크, 냉각 시스템
│  - 위치: 서울 북부 지역 (추정)
│
└─ AZ-B (ap-northeast-2b): 두 번째 데이터센터
   - 독립적인 전력, 네트워크, 냉각 시스템
   - 위치: 서울 남부 지역 (추정)
   - AZ-A와 물리적으로 수km 이상 떨어짐
```

### 📊 리소스 분산

```
AZ-A (50%)                    AZ-B (50%)
├─ EC2-1, 2, 3               ├─ EC2-4, 5
├─ Redis Primary             ├─ Redis Replica
└─ RDS Primary               └─ RDS Replica

장애 시:
AZ-A 다운 → AZ-B가 모든 트래픽 처리
```

### 🔄 자동 페일오버

```
정상 상태:
  AZ-A (Primary) ←→ AZ-B (Replica)
  실시간 복제 (1초 이내)

장애 발생:
  AZ-A ✗ (전체 장애)
  ↓
  AZ-B Replica → Primary로 승격 (30초)
  ↓
  모든 트래픽 AZ-B로 라우팅
  ↓
  서비스 계속 운영!
```

### 💡 핵심 포인트

- **고가용성**: 99.9% → 99.99% (다운타임 10배 감소)
- **데이터 손실 없음**: 실시간 동기 복제
- **자동 복구**: 사람 개입 없이 30초 내 자동 복구
- **비용**: 1.5배 (2배 아님)

---

## 7️⃣ Internet Gateway

### 🎯 역할

**VPC와 인터넷을 연결하는 관문**입니다.

```
인터넷 ←→ [Internet Gateway] ←→ VPC
```

### ⚙️ 동작 방식

```
외부 → VPC (Inbound):
  사용자 요청 → Internet Gateway → ALB

VPC → 외부 (Outbound):
  NAT Gateway → Internet Gateway → 인터넷
```

### 💡 핵심 포인트

- **VPC당 1개**: 하나의 VPC에 하나의 IGW
- **고가용성**: AWS가 자동으로 Multi-AZ 구성
- **무료**: 비용 없음
- **상태 관리 없음**: Stateless, 무한 확장 가능

---

## 8️⃣ ALB (Application Load Balancer)

### 🎯 역할

**여러 EC2 인스턴스에 트래픽을 분산**하고 **WebSocket 연결을 유지**합니다.

### 📊 트래픽 분산

```
[사용자 10,000명]
    ↓
  [ALB]
    ├─→ EC2-1 (2,000명)
    ├─→ EC2-2 (2,000명)
    ├─→ EC2-3 (2,000명)
    ├─→ EC2-4 (2,000명)
    └─→ EC2-5 (2,000명)
```

### 🍪 Sticky Session (WebSocket 연결 유지)

```
1. 사용자 A가 첫 요청
   ↓
2. ALB가 EC2-1로 라우팅
   ↓
3. ALB가 쿠키 생성: AWSALB=ec2-1-identifier
   ↓
4. 브라우저가 쿠키 저장
   ↓
5. 이후 모든 요청에 쿠키 포함
   ↓
6. ALB: "이 쿠키는 EC2-1이구나"
   ↓
7. 계속 EC2-1로 라우팅 (WebSocket 유지)
```

### 🏥 헬스 체크

```
ALB가 30초마다 모든 EC2에 요청:
  GET /health HTTP/1.1
  ↓
EC2 응답:
  200 OK → Healthy (트래픽 보냄)
  500 Error → Unhealthy (트래픽 차단)

2번 연속 실패 → Unhealthy로 표시
3번 연속 성공 → Healthy로 복귀
```

### ⚙️ 설정

```json
{
  "LoadBalancerName": "tiketi-alb",
  "Scheme": "internet-facing",
  "IpAddressType": "ipv4",
  "Subnets": [
    "subnet-public-a",
    "subnet-public-b"
  ],
  "SecurityGroups": ["sg-alb"],
  "TargetGroup": {
    "Protocol": "HTTP",
    "Port": 3001,
    "HealthCheckPath": "/health",
    "HealthCheckInterval": 30,
    "Stickiness": {
      "Enabled": true,
      "Type": "lb_cookie",
      "DurationSeconds": 86400
    }
  }
}
```

### 💡 핵심 포인트

- **Layer 7 로드밸런서**: HTTP/HTTPS 프로토콜 이해
- **WebSocket 지원**: Sticky Session으로 연결 유지
- **자동 확장**: 트래픽 증가 시 ALB 용량 자동 증가
- **Multi-AZ**: 자동으로 두 AZ에 배치
- **비용**: ₩27,000/월

---

## 9️⃣ NAT Gateway

### 🎯 역할

**Private Subnet의 EC2가 외부 인터넷에 접근**할 수 있게 해줍니다.

### 📊 동작 방식

```
Private Subnet의 EC2:
  "npm 패키지 다운로드하고 싶어요!"
  ↓
NAT Gateway:
  "알겠어, 대신 가져올게"
  ↓
Internet Gateway → 인터넷
  ↓
NPM Registry에서 패키지 다운로드
  ↓
NAT Gateway → Private EC2
  ↓
설치 완료!
```

### 🔒 보안 특징

```
외부 → NAT Gateway → EC2: ✗ 차단 (Inbound 불가)
EC2 → NAT Gateway → 외부: ✓ 허용 (Outbound만 가능)
```

**즉, 외부에서는 EC2에 접근할 수 없지만, EC2는 외부로 나갈 수 있습니다!**

### 💰 대안: S3 VPC Endpoint

**문제:** NAT Gateway는 비쌉니다 (시간당 ₩50 + 데이터 전송료)

**해결:** S3 VPC Endpoint 사용

```
Before (NAT 경유):
  EC2 → NAT Gateway → Internet GW → S3
  비용: ₩41,500/월 (100GB 기준)

After (VPC Endpoint):
  EC2 → S3 VPC Endpoint → S3
  비용: ₩0/월 (무료!)

절감: 100%
```

### 💡 핵심 포인트

- **각 AZ에 1개씩**: 고가용성 (AZ-A NAT 다운 → AZ-B NAT 사용)
- **Elastic IP**: 고정 IP 주소 할당
- **비용 최적화**: S3 VPC Endpoint로 NAT 우회
- **비용**: ₩36,500/월 (단일 NAT)

---

## 🔟 EC2 - 백엔드 서버

### 🎯 역할

**Node.js + Express + Socket.IO 백엔드 서버**를 실행합니다.

### 💻 인스턴스 스펙

```
Instance Type: t3.medium
vCPU: 2개
Memory: 4GB RAM
Network: Up to 5 Gbps
Storage: 20GB gp3 SSD

예상 처리 능력:
- 동시 접속: 1,000명/대
- API 처리: 1,000 req/sec/대
- WebSocket: 500 연결/대
```

### 📦 인스턴스 구성

```
AZ-A:
  ├─ EC2-1 (10.0.11.10)
  ├─ EC2-2 (10.0.11.11)
  └─ EC2-3 (10.0.11.12)

AZ-B:
  ├─ EC2-4 (10.0.12.10)
  └─ EC2-5 (10.0.12.11)

평상시: 2대 운영 (EC2-1, EC2-4)
피크: 10대로 확장 (Auto Scaling)
```

### ⚙️ User Data (자동 설정)

```bash
#!/bin/bash
# 인스턴스 시작 시 자동 실행

# 1. 시스템 업데이트
yum update -y
yum install -y nodejs npm git

# 2. 애플리케이션 배포
cd /home/ec2-user
git clone https://github.com/your-org/tiketi.git
cd tiketi/backend

# 3. 환경 변수 (Secrets Manager에서)
aws secretsmanager get-secret-value \
  --secret-id tiketi/prod/backend \
  --region ap-northeast-2 \
  --query SecretString \
  --output text > .env

# 4. 의존성 설치
npm install --production

# 5. PM2로 서버 시작
npm install -g pm2
pm2 start src/server.js --name tiketi-backend
pm2 startup
pm2 save

# 6. CloudWatch Logs 에이전트
yum install -y amazon-cloudwatch-agent
```

### 🔐 Security Group

```json
{
  "GroupName": "tiketi-ec2-sg",
  "InboundRules": [
    {
      "IpProtocol": "tcp",
      "FromPort": 3001,
      "ToPort": 3001,
      "SourceSecurityGroupId": "sg-alb"
    }
  ],
  "OutboundRules": [
    {
      "IpProtocol": "-1",
      "CidrIp": "0.0.0.0/0"
    }
  ]
}
```

**중요:** EC2는 ALB에서 오는 요청만 받을 수 있습니다!

### 💡 핵심 포인트

- **Private Subnet**: 외부에서 직접 접근 불가
- **Auto Scaling**: 2대 → 10대 자동 확장
- **비용**: t3.medium ₩40,000/월/대

---

## 1️⃣1️⃣ ElastiCache Redis

### 🎯 역할

**3가지 핵심 기능을 담당**합니다:
1. **Pub/Sub**: WebSocket 메시지 동기화
2. **Queue**: 대기열 관리
3. **Cache**: 세션, 임시 데이터

### 📊 Cluster 구성

```
Cluster Mode Enabled (고가용성)

Shard 1:
  ├─ Primary (AZ-A)   - 읽기/쓰기
  └─ Replica (AZ-B)   - 읽기 전용

Shard 2:
  ├─ Primary (AZ-A)   - 읽기/쓰기
  └─ Replica (AZ-B)   - 읽기 전용

자동 샤딩: 키를 해시하여 Shard 분산
자동 페일오버: Primary 장애 시 Replica 승격 (10~30초)
```

### 🔧 역할 1: Pub/Sub (실시간 동기화)

```
Socket.IO Redis Adapter가 사용:

EC2-1에서 이벤트 발생:
  io.emit('ticket-sold', data);
  ↓
Redis Pub/Sub:
  PUBLISH socket.io#/# "{...}"
  ↓
모든 EC2가 구독:
  EC2-1 ← 메시지
  EC2-2 ← 메시지
  EC2-3 ← 메시지
  EC2-4 ← 메시지
  EC2-5 ← 메시지
  ↓
각 EC2가 자신의 클라이언트에게 전달
  → 모든 사용자가 실시간으로 받음!
```

### 🔧 역할 2: Queue (대기열)

```
Redis Sorted Set 사용:

대기열 추가:
  ZADD queue:event-123 1699900000000 user-456
  (timestamp를 score로, userId를 member로)

순번 조회:
  ZRANK queue:event-123 user-456
  → 8244 (8,245번째)

대기 인원:
  ZCARD queue:event-123
  → 20000명

앞 50명 꺼내기:
  ZRANGE queue:event-123 0 49
  ZREMRANGEBYRANK queue:event-123 0 49
```

### 🔧 역할 3: Cache (세션, 임시 데이터)

```
세션 저장 (1시간 TTL):
  SET session:user-456 "{...}" EX 3600

좌석 임시 예약 (5분 TTL):
  SET seat:A-1:locked user-456 EX 300

API 응답 캐싱 (1분 TTL):
  SET events:list "[...]" EX 60
```

### ⚙️ 설정

```json
{
  "ReplicationGroupId": "tiketi-redis",
  "Engine": "redis",
  "EngineVersion": "7.0",
  "CacheNodeType": "cache.t4g.micro",
  "NumNodeGroups": 2,
  "ReplicasPerNodeGroup": 1,
  "AutomaticFailoverEnabled": true,
  "MultiAZEnabled": true,
  "AtRestEncryptionEnabled": true,
  "TransitEncryptionEnabled": true,
  "SnapshotRetentionLimit": 5
}
```

### 💡 핵심 포인트

- **인메모리**: PostgreSQL보다 100배 빠름
- **Multi-AZ**: 자동 페일오버 (10~30초)
- **자동 백업**: 매일 스냅샷
- **비용**: cache.t4g.micro × 4 = ₩40,000/월

---

## 1️⃣2️⃣ RDS Aurora PostgreSQL

### 🎯 역할

**영구 데이터를 저장**하는 관리형 데이터베이스입니다.

### 📊 Aurora vs 일반 RDS

| 기능 | RDS PostgreSQL | Aurora |
|------|---------------|---------|
| 성능 | 1x | **5x** |
| 스토리지 | 수동 확장 (최대 64TB) | **자동 확장 (최대 128TB)** |
| Read Replica | 최대 5개 | **최대 15개** |
| 페일오버 | 1~2분 | **30초** |
| 백업 영향 | 성능 저하 | **성능 영향 없음** |
| 비용 | 저렴 | 약 20% 비쌈 |

**Aurora 선택 이유:** 성능 + 가용성이 비용보다 중요

### 📊 Multi-AZ 구성

```
Writer Endpoint (읽기/쓰기):
  tiketi-db.cluster-abc123.ap-northeast-2.rds.amazonaws.com
  ↓
  Primary (AZ-A)
    - 모든 쓰기 작업
    - 읽기 작업도 가능
    - 실시간 복제 → Replica

Reader Endpoint (읽기 전용):
  tiketi-db.cluster-ro-abc123.ap-northeast-2.rds.amazonaws.com
  ↓
  Replica (AZ-B)
    - 읽기만 가능
    - Primary와 동기화 (1초 이내)
    - Primary 장애 시 승격
```

### 🔄 자동 페일오버

```
정상:
  Primary (AZ-A) ─────→ Replica (AZ-B)
  [실시간 복제]

장애 발생:
  20:15:00 - Primary 하드웨어 장애
  20:15:05 - Aurora 페일오버 시작
  20:15:30 - Replica → Primary 승격
  20:15:35 - DNS 자동 업데이트
  20:16:00 - 모든 EC2 재연결 완료

다운타임: 약 1분
데이터 손실: 0건
```

### 📦 저장 데이터

```sql
users           - 사용자 정보
events          - 이벤트 정보
tickets         - 티켓 타입
seats           - 좌석 배치
reservations    - 예매 내역
payments        - 결제 기록
```

### ⚙️ 설정

```json
{
  "DBClusterIdentifier": "tiketi-db",
  "Engine": "aurora-postgresql",
  "EngineVersion": "15.3",
  "DBClusterInstanceClass": "db.t4g.medium",
  "MultiAZ": true,
  "BackupRetentionPeriod": 7,
  "PreferredBackupWindow": "03:00-04:00",
  "PreferredMaintenanceWindow": "sun:04:00-sun:05:00",
  "StorageEncrypted": true,
  "DeletionProtection": true
}
```

### 🔐 Security Group

```json
{
  "GroupName": "tiketi-rds-sg",
  "InboundRules": [
    {
      "IpProtocol": "tcp",
      "FromPort": 5432,
      "ToPort": 5432,
      "SourceSecurityGroupId": "sg-ec2"
    }
  ]
}
```

**중요:** RDS는 EC2에서만 접근 가능!

### 💡 핵심 포인트

- **자동 백업**: 매일 스냅샷 + Point-in-Time Recovery
- **자동 스토리지 확장**: 10GB → 128TB 자동
- **읽기/쓰기 분리**: Writer/Reader Endpoint
- **비용**: db.t4g.medium Multi-AZ = ₩60,000/월

---

## 1️⃣3️⃣ Lambda - Queue Monitor

### 🎯 역할

**Redis 대기열 크기를 1분마다 측정**하여 CloudWatch로 전송합니다.

### 📊 동작 흐름

```
EventBridge (1분 주기)
    ↓
Lambda 함수 실행
    ↓
Redis에 연결
    ↓
ZCARD queue:event-123 (대기열 크기 조회)
SCARD active:event-123 (활성 사용자 조회)
    ↓
CloudWatch에 메트릭 전송
    ↓
CloudWatch Alarm 평가
    ├─ Queue > 5,000 → Scale Out
    └─ Queue < 1,000 → Scale In
```

### 📝 Lambda 함수 코드

```javascript
const Redis = require('ioredis');
const { CloudWatch } = require('@aws-sdk/client-cloudwatch');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379
});

const cloudwatch = new CloudWatch({ region: 'ap-northeast-2' });

exports.handler = async (event) => {
  // 활성 이벤트 목록 조회
  const activeEvents = await redis.smembers('active-events');

  for (const eventId of activeEvents) {
    // 대기열 크기
    const queueSize = await redis.zcard(`queue:${eventId}`);

    // 활성 사용자
    const activeUsers = await redis.scard(`active:${eventId}`);

    // CloudWatch 메트릭 전송
    await cloudwatch.putMetricData({
      Namespace: 'Tiketi/Queue',
      MetricData: [
        {
          MetricName: 'QueueSize',
          Value: queueSize,
          Unit: 'Count',
          Dimensions: [{ Name: 'EventId', Value: eventId }]
        },
        {
          MetricName: 'ActiveUsers',
          Value: activeUsers,
          Unit: 'Count',
          Dimensions: [{ Name: 'EventId', Value: eventId }]
        }
      ]
    });

    console.log(`[${eventId}] Queue: ${queueSize}, Active: ${activeUsers}`);
  }

  return { statusCode: 200 };
};
```

### ⚙️ 설정

```json
{
  "FunctionName": "tiketi-queue-monitor",
  "Runtime": "nodejs18.x",
  "Handler": "index.handler",
  "Timeout": 60,
  "MemorySize": 256,
  "Environment": {
    "Variables": {
      "REDIS_HOST": "tiketi-redis.abc123.ng.0001.apn2.cache.amazonaws.com"
    }
  },
  "VpcConfig": {
    "SubnetIds": ["subnet-private-a", "subnet-private-b"],
    "SecurityGroupIds": ["sg-lambda"]
  }
}
```

### ⏰ EventBridge 스케줄

```json
{
  "Name": "tiketi-queue-monitor-schedule",
  "ScheduleExpression": "rate(1 minute)",
  "State": "ENABLED",
  "Target": {
    "Arn": "arn:aws:lambda:ap-northeast-2:123456789012:function:tiketi-queue-monitor"
  }
}
```

### 💡 핵심 포인트

- **서버리스**: 인프라 관리 불필요
- **비용 효율적**: 실행 시간만 과금 (월 ₩1,000)
- **격리**: EC2 장애와 무관하게 동작
- **VPC 내부**: ElastiCache에 직접 접근

---

## 1️⃣4️⃣ CloudWatch - 모니터링 & 알람

### 🎯 역할

**메트릭 수집, 알람 발동, 로그 관리**를 담당합니다.

### 📊 Custom Metrics (Lambda가 전송)

```
Namespace: Tiketi/Queue

Metrics:
  ├─ QueueSize (대기열 크기)
  │  Dimensions: EventId
  │  Unit: Count
  │
  └─ ActiveUsers (활성 사용자)
     Dimensions: EventId
     Unit: Count
```

### 🚨 Alarms

**1) Scale Out Alarm (대기열 > 5,000명)**
```json
{
  "AlarmName": "tiketi-queue-scale-out",
  "MetricName": "QueueSize",
  "Namespace": "Tiketi/Queue",
  "Statistic": "Average",
  "Period": 60,
  "EvaluationPeriods": 1,
  "Threshold": 5000.0,
  "ComparisonOperator": "GreaterThanThreshold",
  "AlarmActions": [
    "arn:aws:autoscaling:...:scalingPolicy/tiketi-scale-out"
  ]
}
```

**2) Scale Out Aggressive (대기열 > 20,000명)**
```json
{
  "AlarmName": "tiketi-queue-scale-out-aggressive",
  "Threshold": 20000.0,
  "AlarmActions": [
    "arn:aws:autoscaling:...:scalingPolicy/tiketi-scale-out-aggressive"
  ]
}
```

**3) Scale In Alarm (대기열 < 1,000명)**
```json
{
  "AlarmName": "tiketi-queue-scale-in",
  "Threshold": 1000.0,
  "ComparisonOperator": "LessThanThreshold",
  "EvaluationPeriods": 2,
  "Period": 300,
  "AlarmActions": [
    "arn:aws:autoscaling:...:scalingPolicy/tiketi-scale-in"
  ]
}
```

### 📊 Dashboard

```
┌─────────────────────────────────────────┐
│  TIKETI 실시간 모니터링 대시보드        │
├─────────────────────────────────────────┤
│  [대기열 크기] ───────────────────────  │
│   20,000명 (Graph)                      │
│                                         │
│  [활성 사용자] ───────────────────────  │
│   8,234명 (Graph)                       │
│                                         │
│  [EC2 인스턴스 수] ───────────────────  │
│   9대 (Number)                          │
│                                         │
│  [API 응답 시간] ────────────────────  │
│   P95: 120ms (Graph)                    │
│                                         │
│  [에러율] ───────────────────────────  │
│   0.02% (Number)                        │
└─────────────────────────────────────────┘
```

### 💡 핵심 포인트

- **Custom Metrics**: Lambda가 비즈니스 메트릭 전송
- **알람 액션**: Auto Scaling, SNS, Lambda 트리거
- **비용**: ₩5,000/월 (10GB 로그 + 알람)

---

## 1️⃣5️⃣ Auto Scaling Group

### 🎯 역할

**대기열 크기에 따라 EC2 인스턴스를 자동으로 추가/제거**합니다.

### ⚙️ ASG 설정

```json
{
  "AutoScalingGroupName": "tiketi-backend-asg",
  "MinSize": 2,
  "MaxSize": 10,
  "DesiredCapacity": 2,
  "LaunchTemplate": {
    "LaunchTemplateId": "lt-abc123",
    "Version": "$Latest"
  },
  "VPCZoneIdentifier": "subnet-private-a,subnet-private-b",
  "TargetGroupARNs": [
    "arn:aws:elasticloadbalancing:...:targetgroup/tiketi-backend/..."
  ],
  "HealthCheckType": "ELB",
  "HealthCheckGracePeriod": 300
}
```

### 📊 Scaling Policies

**1) Scale Out Policy (EC2 +2)**
```json
{
  "PolicyName": "tiketi-scale-out",
  "AdjustmentType": "ChangeInCapacity",
  "ScalingAdjustment": 2,
  "Cooldown": 180
}
```

**2) Scale Out Aggressive (EC2 +5)**
```json
{
  "PolicyName": "tiketi-scale-out-aggressive",
  "AdjustmentType": "ChangeInCapacity",
  "ScalingAdjustment": 5,
  "Cooldown": 300
}
```

**3) Scale In Policy (EC2 -1)**
```json
{
  "PolicyName": "tiketi-scale-in",
  "AdjustmentType": "ChangeInCapacity",
  "ScalingAdjustment": -1,
  "Cooldown": 600
}
```

### 📊 실제 동작 시나리오

```
시간        대기열      EC2    액션
─────────────────────────────────────
19:30      0명        2대    정상
19:50      3,000명    2대    정상 (임계값 미만)
19:55      8,000명    2대    🚨 Scale Out! (+2)
19:58      25,000명   4대    🚨 Aggressive! (+5)
20:00      20,000명   9대    ✅ 안정적 처리
20:30      800명      9대    정상 (처리 중)
20:35      500명      9대    Scale In 시작 (-1)
20:45      200명      8대    Scale In (-1)
21:00      0명        2대    최소 구성 복귀
```

### 🛡️ Connection Draining

**EC2 제거 시:**
```
1. ASG: "EC2-9 제거 시작"
   ↓
2. ALB: EC2-9를 "Draining" 상태로
   ↓
3. 새 요청은 EC2-9로 안 보냄
   ↓
4. 기존 연결 5분간 유지
   ↓
5. 5분 후 EC2-9 완전 종료
```

**WebSocket 재연결:**
```
EC2-9 연결이 끊김
  ↓
프론트엔드 자동 재연결 (3~5회 시도)
  ↓
ALB가 다른 EC2로 라우팅 (EC2-1~8)
  ↓
Redis에서 세션 복구
  ↓
대기열 순번, 좌석 선택 유지!
```

### 💡 핵심 포인트

- **대기열 기반**: CPU가 아닌 실제 사용자 수 기반
- **사전 예방**: 부하 발생 전에 확장
- **비용 효율**: 필요할 때만 확장 (월 ₩9,000 추가)
- **Cooldown**: 무분별한 확장 방지

---

## 1️⃣6️⃣ S3 VPC Endpoint

### 🎯 역할

**Private Subnet의 EC2가 NAT Gateway 없이 S3에 직접 접근**합니다.

### 📊 Before vs After

**Before (NAT Gateway 경유):**
```
EC2 (Private)
  ↓
NAT Gateway (비용: 시간당 ₩50)
  ↓
Internet Gateway
  ↓
S3
  ↓
데이터 전송료: GB당 ₩50

월 100GB 업로드 시:
  NAT 비용: ₩36,500
  전송료: ₩5,000
  합계: ₩41,500
```

**After (VPC Endpoint):**
```
EC2 (Private)
  ↓
S3 VPC Endpoint (무료!)
  ↓
S3
  ↓
VPC 내부 트래픽: 무료

월 100GB 업로드 시:
  VPC Endpoint: ₩0
  전송료: ₩0
  합계: ₩0

절감: 100% (₩41,500)
```

### ⚙️ 설정

**VPC Endpoint 생성:**
```bash
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-12345678 \
  --service-name com.amazonaws.ap-northeast-2.s3 \
  --route-table-ids rtb-private-a rtb-private-b \
  --vpc-endpoint-type Gateway
```

**Route Table 자동 업데이트:**
```
Route Table (Private Subnet):
├─ 10.0.0.0/16 → local (VPC 내부)
├─ 0.0.0.0/0 → nat-gateway (외부 인터넷)
└─ pl-78a54011 → vpce-abc123 (S3 VPC Endpoint)
      ↑
      S3 Prefix List (AWS 관리)
```

### 💰 비용 절감

```
연간 절감:
  ₩41,500/월 × 12개월 = ₩498,000/년

5년 절감:
  ₩498,000 × 5 = ₩2,490,000
```

### 💡 핵심 포인트

- **Gateway Type**: 무료
- **코드 변경 불필요**: 자동으로 라우팅 최적화
- **S3 전용**: 다른 AWS 서비스는 Interface Endpoint 필요
- **보안**: VPC 내부 트래픽, 외부 노출 없음

---

## 🎯 전체 데이터 흐름 정리

### 📊 사용자 → 프론트엔드

```
1. 사용자: "tiketi.gg 입력"
   ↓
2. [Route 53]: "d123abc.cloudfront.net으로 가세요"
   ↓
3. [CloudFront]: "서울 엣지에서 캐시 확인"
   ├─ 있음 → 즉시 응답
   └─ 없음 → [S3]에서 가져와 캐싱
   ↓
4. 브라우저: React 앱 로드 완료
```

### 📊 프론트엔드 → 백엔드 API

```
5. 브라우저: "API 요청 (https://tiketi.gg/api/events)"
   ↓
6. [CloudFront]: "/api/*는 캐싱 안 함, ALB로 전달"
   ↓
7. [Internet Gateway]: VPC 진입
   ↓
8. [ALB]:
   - Sticky Session 확인 (쿠키)
   - 헬스 체크된 EC2 중 선택
   - Target Group으로 라우팅
   ↓
9. [EC2] (Private Subnet):
   - Express 서버에서 요청 처리
   - [Redis]에서 캐시 확인
   - 없으면 [RDS Aurora]에서 조회
   ↓
10. 응답: EC2 → ALB → CloudFront → 브라우저
```

### 📊 WebSocket 실시간 동기화

```
11. 사용자 A (EC2-1 연결): "티켓 구매"
    ↓
12. [EC2-1]:
    - [RDS]에 예매 기록
    - [Redis]에 재고 업데이트
    - Socket.IO: io.emit('ticket-sold')
    ↓
13. [Redis Pub/Sub]:
    - EC2-1이 PUBLISH
    - 모든 EC2가 SUBSCRIBE
    ↓
14. 모든 EC2가 자신의 클라이언트에게 전송:
    - EC2-1 → 사용자 A, B, C
    - EC2-2 → 사용자 D, E, F
    - EC2-3 → 사용자 G, H, I
    ↓
15. 모든 사용자 화면 즉시 업데이트!
```

### 📊 Auto Scaling

```
16. [Lambda] (1분마다):
    - [Redis]에서 대기열 크기 조회
    - [CloudWatch]에 메트릭 전송
    ↓
17. [CloudWatch Alarms]:
    - Queue > 5,000 → Scale Out 알람
    ↓
18. [Auto Scaling Group]:
    - EC2 +2대 시작
    - [ALB] Target Group에 자동 등록
    ↓
19. 3~5분 후:
    - 새 EC2 가동
    - 헬스 체크 통과
    - 트래픽 분산 시작
```

---

## 💰 비용 분석

### 월간 비용 (5,000 동시 접속 기준)

```
컴퓨팅:
  ├─ EC2 (t3.medium × 2)        ₩80,000
  ├─ ALB                         ₩27,000
  └─ Lambda (Queue Monitor)      ₩1,000
                               ──────────
                                 ₩108,000

데이터베이스:
  ├─ RDS Aurora (Multi-AZ)       ₩60,000
  └─ ElastiCache (Multi-AZ)      ₩40,000
                               ──────────
                                 ₩100,000

스토리지 & CDN:
  ├─ S3 (50GB)                   ₩2,000
  └─ CloudFront (1TB)            FREE
                               ──────────
                                  ₩2,000

네트워크:
  ├─ NAT Gateway                 ₩36,500
  ├─ Data Transfer (500GB)       ₩5,000
  └─ S3 VPC Endpoint             FREE
                               ──────────
                                 ₩41,500

보안 & 모니터링:
  ├─ Route 53                    ₩500
  ├─ ACM (SSL)                   FREE
  ├─ Secrets Manager             ₩2,000
  └─ CloudWatch                  ₩5,000
                               ──────────
                                  ₩7,500

═══════════════════════════════════════
총 월간 비용:                    ₩259,000
                                (~$195)

피크 타임 추가 (월 20시간):      ₩9,000
═══════════════════════════════════════
총 예상 비용:                    ₩268,000
                                (~$200)
```

### 비용 최적화

```
1. S3 VPC Endpoint:
   Before: ₩41,500
   After: ₩0
   절감: ₩41,500/월

2. Reserved Instances (1년):
   Before: ₩80,000
   After: ₩48,000 (40% 할인)
   절감: ₩32,000/월

3. Auto Scaling:
   24/7 10대: ₩720,000
   ASG 2→10대: ₩108,000
   절감: ₩612,000/월

═══════════════════════════════════
최종 최적화 비용:    ₩154,500/월
                   (~$115)
원래 대비 절감:      42%
```

---

## 🏆 핵심 아키텍처 포인트

### 1️⃣ Multi-AZ 고가용성

```
✅ 모든 컴포넌트를 2개 AZ에 분산
✅ 하나의 AZ 장애에도 서비스 지속
✅ 자동 페일오버: 30초 ~ 1분
✅ 데이터 손실: 0건
```

### 2️⃣ 3층 보안 계층

```
Public Subnet (ALB)
  ↓ ALB에서만 허용
Private Subnet (EC2, Redis)
  ↓ EC2에서만 허용
DB Subnet (RDS)

🔒 해커가 DB 접근하려면 5단계 침투 필요
```

### 3️⃣ WebSocket 멀티 인스턴스 동기화

```
Socket.IO + Redis Adapter
  ↓
EC2-1에서 emit → Redis Pub/Sub → 모든 EC2
  ↓
모든 사용자가 실시간으로 메시지 받음
```

### 4️⃣ 대기열 기반 Auto Scaling

```
Lambda → Redis 대기열 측정
  ↓
CloudWatch Alarms
  ↓
Auto Scaling Group (2→10대)

🎯 CPU가 아닌 실제 사용자 수 기반
🎯 사전 예방적 확장
```

### 5️⃣ 비용 최적화

```
✅ S3 VPC Endpoint: NAT 비용 100% 절감
✅ Auto Scaling: 필요할 때만 확장 (86% 절감)
✅ Reserved Instances: 고정 비용 40% 절감
✅ CloudFront 캐싱: 오리진 요청 90% 감소

최종: 월 ₩154,500 (~$115)
```

---

## 📊 예상 성능 지표

```
동시 접속:      10,000명 (EC2 10대)
API 응답:       P95 < 200ms
WebSocket:      실시간 (<100ms)
대기열 처리:    초당 50명
가용성:         99.9% (다운타임 <9시간/년)
데이터 손실:    0건 (Multi-AZ 동기 복제)
```

---

## ❓ Q&A

### Q1: "왜 ElastiCache를 쓰나요? Redis 직접 설치하면 안 되나요?"

**A:** ElastiCache는 AWS 관리형 서비스로:
- ✅ 자동 백업, 자동 페일오버
- ✅ 패치 관리, 보안 업데이트 자동
- ✅ Multi-AZ 고가용성
- ✅ CloudWatch 네이티브 통합
- ✅ 관리 부담 제로

직접 설치하면 이 모든 걸 수동으로 해야 합니다.

### Q2: "Multi-AZ가 정말 필요한가요?"

**A:** 티켓팅 특성상 필수입니다:
- 1시간 서비스 중단 = ₩10,000,000 손실
- Multi-AZ 추가 비용 = ₩50,000/월
- **ROI: 200배**

### Q3: "Auto Scaling으로 서버가 계속 늘면 비용 폭탄 아닌가요?"

**A:**
- **Max Size 제한**: 최대 10대 (절대 초과 안 함)
- **Cooldown**: 3~5분 간격으로만 확장
- **빠른 Scale In**: 10분마다 1대씩 축소
- **실제 비용**: 월 ₩9,000 추가 (20시간 피크)
- 24/7 10대보다 **86% 저렴**

### Q4: "Lambda 대신 EC2에서 모니터링하면 안 되나요?"

**A:** Lambda가 더 적합합니다:
- **비용**: 실행 시간만 과금 (거의 무료)
- **격리**: EC2 장애와 무관
- **서버리스**: 인프라 관리 불필요
- **자동 확장**: 동시 실행 자동 처리

### Q5: "WebSocket 연결이 끊어지면 어떻게 되나요?"

**A:** 자동 재연결 + 세션 복구:
```
1. WebSocket 끊김 감지
2. 자동 재연결 시도 (3~5회)
3. Redis에서 세션 조회
4. 대기열 순번, 좌석 선택 복원
5. 사용자는 거의 영향 없음
```

---

## 🎯 발표 종료

이상으로 TIKETI의 AWS 프로덕션 아키텍처 설명을 마치겠습니다.

**핵심 메시지:**
- ✅ Multi-AZ로 99.9% 가용성 보장
- ✅ Redis Pub/Sub로 실시간 동기화
- ✅ 대기열 기반 Auto Scaling으로 안정적 확장
- ✅ 3층 보안 + VPC로 데이터 보호
- ✅ 월 ₩154,500로 수만 명 동시 접속 지원

**질문 있으시면 말씀해주세요!**
