# tiketi.gg - 비용 최적화 티켓팅 아키텍처 분석

## 📋 개요
- **월 비용**: ₩152,000
- **배포 방식**: Docker Compose
- **타겟 사용자**: 5,000명
- **리전**: Seoul (ap-northeast-2)

---

## 🏗️ 아키텍처 구성

### 1️⃣ 엣지 & DNS 레이어

#### Route 53 (₩500/월)
- **역할**: DNS 서비스
- **도메인**: tiketi.gg
- **기능**: 사용자 요청을 CloudFront로 라우팅

#### CloudFront CDN (무료)
- **비용**: FREE (1TB 프리티어)
- **역할**: 엣지 캐싱, 글로벌 콘텐츠 배포
- **장점**: 
  - 정적 자산 캐싱으로 응답 속도 향상
  - S3를 오리진으로 사용
  - TLS 인증서: ACM (us-east-1)

#### AWS WAF (선택사항)
- **역할**: 봇 차단, DDoS 방어
- **특징**: CloudFront에 연결되어 보안 필터링

---

### 2️⃣ 네트워크 레이어 (VPC)

#### VPC 구성
- **CIDR**: 10.0.0.0/16
- **Internet Gateway**: VPC와 인터넷 간 통신
- **NAT Gateway**: ₩5,000/월 (Single AZ - 비용 절감)
  - ⚠️ Multi-AZ 대비 ₩5k 절약
  - 소규모 프로젝트에 적합
  - 향후 확장 가능

#### 서브넷 구조

**Public Subnet (10.0.1.0/24, 10.0.2.0/24)**
- ALB (Application Load Balancer)
- NAT Gateway
- Route Table: 0.0.0.0/0 → IGW

**Private Subnet (10.0.10.0/24, 10.0.11.0/24)**
- EC2 인스턴스들
- DragonflyDB
- Aurora Serverless v2
- Route Table: 0.0.0.0/0 → NAT

#### 보안 계층
1. **NACL (Network ACL)**: 서브넷 수준, Stateless
2. **Security Group**: 인스턴스 수준, Stateful
3. **WAF**: 애플리케이션 레벨
4. **IAM Role**: API 레벨

---

### 3️⃣ 컴퓨팅 레이어

#### Application Load Balancer (₩27,000/월)
- **포트**: HTTPS 443 / HTTP 80
- **역할**: 
  - 트래픽 분산
  - Health Check
  - HTTPS 종료 (ACM Seoul)
- **보안**: alb-sg Security Group

#### Auto Scaling Group
- **최소**: 2 인스턴스
- **목표**: 3 인스턴스
- **최대**: 10 인스턴스
- **스케일링 조건**: 
  - CloudWatch CPU > 70% → +2 인스턴스
  - Target Group health checks
  - `docker-compose --scale inventory=5`

#### EC2-1: Frontend (₩40,000/월)
- **타입**: t3.medium
- **컨테이너**:
  - `gateway`: API 게이트웨이
  - `inventory×3`: 재고 관리 서비스 (3개 복제본)

#### EC2-2: Backend (₩20,000/월)
- **타입**: t3.small
- **컨테이너**:
  - `merged`: 통합 서비스 (auth+event+notify)
    - ✅ 500MB RAM 절약
    - 작은 인스턴스 타입 사용 가능
  - `order`: 주문 서비스
- **추가 역할**: Prometheus + Grafana + Loki 호스팅

#### EC2-N (Auto-scaled)
- 필요시 자동으로 생성되는 추가 인스턴스
- Docker Compose로 동일 구성 배포

---

### 4️⃣ 데이터 레이어

#### DragonflyDB (무료 - Self-hosted)
- **포트**: 6379
- **역할**: 
  - **캐시**: 빠른 데이터 조회
  - **분산 락**: 좌석 예약 동시성 제어
  - **큐**: 비동기 작업
- **비용 절감**: ElastiCache 대비 ₩11,000/월 절약
- **특징**: Redis 호환, EC2에서 자체 호스팅

#### Aurora Serverless v2 (₩57,000/월)
- **데이터베이스**: PostgreSQL
- **ACU**: 0.5 - 2 (Auto-scaling)
- **비용**: 초 단위 과금
- **비용 절감**: Provisioned RDS 대비 ₩93,000/월 절약
- **기능**:
  - 풀텍스트 검색 (PostgreSQL 내장)
    - OpenSearch 대비 ₩45,000/월 절약
    - 10만 건 이하 이벤트에 충분

#### S3 Buckets (₩3,000/월)
- **용량**: 50GB
- **용도**:
  - 정적 파일 (static)
  - 로그 (logs)
  - 백업 (backups)
- **접근 방식**:
  - CloudFront → S3 (CDN 오리진)
  - EC2 → VPC Endpoint → S3 (NAT 비용 없음)

#### VPC Endpoint (무료)
- **타입**: S3 Gateway Endpoint
- **장점**: 
  - NAT Gateway 경유 불필요
  - 데이터 전송 비용 ₩18,000/월 절약

---

### 5️⃣ 모니터링 (Self-hosted - 무료)

**EC2-2에서 호스팅**
- **Prometheus**: 메트릭 수집
- **Grafana**: 대시보드 시각화
- **Loki**: 로그 수집 및 분석

**비용 절감**: DataDog 대비 ₩40,000/월 절약
**리소스**: ~400MB RAM 사용

---

## 💰 월간 비용 상세 내역

### COMPUTE: ₩87,000
- EC2 t3.medium × 1: ₩40,000
- EC2 t3.small × 1: ₩20,000
- ALB: ₩27,000

### DATABASE: ₩57,000
- Aurora Serverless v2: ₩57,000

### STORAGE & CDN: ₩2,000
- S3 (50GB): ₩2,000
- CloudFront: ₩0 (무료)

### NETWORK: ₩5,500
- NAT Gateway: ₩5,000
- Data Transfer: ₩500

### OTHER: ₩2,500
- Route 53: ₩500
- Secrets Manager: ₩2,000

### **총계: ₩154,000/월**

### 무료 서비스
- DragonflyDB (자체 호스팅)
- Prometheus + Grafana + Loki
- VPC Endpoints (Gateway)
- ACM Certificates

---

## 🔄 요청 흐름 (Request Flow)

### INGRESS (사용자 → 애플리케이션)

```
❶ User → Internet
   ↓ HTTPS 요청
❷ Internet → Route 53
   ↓ DNS 쿼리 (tiketi.gg)
❸ Route 53 → CloudFront
   ↓ CDN (캐시 확인)
❹ CloudFront → WAF
   ↓ 보안 필터링
❺ WAF → Internet Gateway
   ↓ VPC 진입
❻ IGW → Route Table
   ↓ 라우팅 룩업
❼ Route Table → Router
   ↓ 패킷 전달
❽ Router → NACL
   ↓ 네트워크 ACL (Stateless)
❾ NACL → ALB
   ↓ Security Group 확인
❿ ALB → EC2
   ↓ Health check + 라우팅
⓫ EC2 → DragonflyDB
   ↓ 분산 락 (좌석 예약)
⓬ EC2 → Aurora
   ↓ 데이터베이스 쿼리/업데이트
```

### EGRESS (Private → Internet)
```
EC2 → NACL → Router → Private RT → NAT → IGW → Internet
```

### CDN ORIGIN
```
CloudFront → S3 (정적 자산)
EC2 → VPC Endpoint → S3 (NAT 비용 없음)
```

---

## 💡 주요 아키텍처 결정 사항

### 1. Docker Compose vs Kubernetes
- **절감**: ₩203,000/월
- **이유**:
  - 간단한 배포
  - 5,000명 사용자에게 충분
  - 복잡도 감소
- **마이그레이션 기준**: 월 매출 > ₩10,000,000

### 2. DragonflyDB vs ElastiCache
- **절감**: ₩11,000/월
- **장점**:
  - Redis 호환
  - EC2에서 자체 호스팅
  - 소규모 프로젝트에 완벽

### 3. Aurora Serverless v2
- **절감**: ₩93,000/월 (vs Provisioned RDS)
- **장점**:
  - Auto-scaling (0.5-2 ACU)
  - 초 단위 과금
  - 트래픽에 따라 자동 확장/축소

### 4. Single NAT Gateway
- **절감**: ₩5,000/월
- **트레이드오프**: 
  - Single Point of Failure
  - 소규모 프로젝트에는 허용 가능한 리스크
  - 향후 Multi-AZ 추가 가능

### 5. 서비스 통합
- **통합 서비스**: auth + event + notify → 1개 컨테이너
- **절감**: 500MB RAM
- **효과**: 더 작은 인스턴스 타입 사용 가능

### 6. PostgreSQL 풀텍스트 검색
- **절감**: ₩45,000/월 (vs OpenSearch)
- **적합 범위**: 10만 건 이하 이벤트
- **장점**: 내장 기능, 추가 인프라 불필요

### 7. Self-hosted 모니터링
- **절감**: ₩40,000/월 (vs DataDog)
- **스택**: Prometheus + Grafana + Loki
- **리소스**: EC2-2에서 ~400MB RAM 사용

### 8. VPC Endpoints
- **타입**: S3 Gateway (무료)
- **절감**: ₩18,000/월 (데이터 전송 비용)
- **장점**: NAT Gateway 경유 불필요

### 9. Auto Scaling
- **방식**: 
  - `docker-compose --scale inventory=5`
  - CloudWatch 알람 기반 스케일 아웃
  - Blue/Green 배포: Target Group 전환

---

## 🎯 적용 시나리오

### 좌석 예약 프로세스

```
1. 사용자가 좌석 선택
   ↓
2. CloudFront 캐시 확인 (정적 자산)
   ↓
3. ALB → EC2 (inventory 컨테이너)
   ↓
4. DragonflyDB로 분산 락 획득
   "seat:A-12" 키로 락 설정
   ↓
5. Aurora에서 좌석 상태 확인
   SELECT status FROM seats WHERE seat_id = 'A-12'
   ↓
6. 예약 가능하면:
   - Aurora에 예약 기록
   - DragonflyDB 캐시 업데이트
   - 락 해제
   ↓
7. 응답 반환 (200ms 이내)
```

### 동시성 제어
- **DragonflyDB 분산 락**: 동일 좌석 동시 예약 방지
- **TTL**: 5분 (결제 타임아웃)
- **재시도 로직**: 락 획득 실패 시 3회 재시도

---

## 📊 성능 예측

### 처리 용량
- **초당 요청**: ~100 RPS (5,000명 동시 접속 가정)
- **피크 타임**: Auto Scaling으로 10개 인스턴스까지 확장
- **응답 시간**: 
  - 정적 자산: <50ms (CloudFront)
  - API 호출: <200ms (ALB → EC2 → Aurora)

### 병목 지점
1. **Aurora ACU**: 2 ACU 상한
   - 해결: ACU 상한 증가 (추가 비용)
2. **NAT Gateway**: Single AZ
   - 해결: Multi-AZ NAT 추가 (₩5k/월)
3. **EC2 CPU**: 70% 임계값
   - 해결: Auto Scaling (자동)

---

## 🔒 보안 체계

### 4계층 보안
1. **WAF**: DDoS, 봇 차단
2. **NACL**: 서브넷 레벨 (Stateless)
3. **Security Group**: 인스턴스 레벨 (Stateful)
4. **IAM Role**: API 레벨 권한 제어

### TLS 인증서
- **CloudFront**: ACM (us-east-1) - 무료
- **ALB**: ACM (Seoul) - 무료

### 네트워크 격리
- **Public Subnet**: ALB만 노출
- **Private Subnet**: 모든 애플리케이션, DB
- **Egress**: NAT Gateway를 통한 제어된 외부 접근

---

## 🚀 확장 계획

### Phase 1: 현재 (5,000명)
- ✅ Docker Compose
- ✅ Single NAT
- ✅ Self-hosted 모니터링

### Phase 2: 성장 (50,000명)
- Multi-AZ NAT Gateway (+₩5k/월)
- Aurora ACU 증가 (2 → 8)
- EC2 인스턴스 타입 업그레이드

### Phase 3: 대규모 (500,000명)
- EKS 마이그레이션
- ElastiCache Redis 전환
- CloudWatch + X-Ray 프로페셔널
- Multi-Region 배포

---

## ✅ 핵심 장점 요약

| 항목 | 선택 | 절감 금액 | 근거 |
|------|------|-----------|------|
| 오케스트레이션 | Docker Compose | ₩203k/월 | 5k 사용자에 충분 |
| 캐시/락 | DragonflyDB | ₩11k/월 | 자체 호스팅 |
| DB | Aurora Serverless v2 | ₩93k/월 | Auto-scaling |
| NAT | Single AZ | ₩5k/월 | 허용 가능한 리스크 |
| 검색 | PostgreSQL FTS | ₩45k/월 | 내장 기능 |
| 모니터링 | Self-hosted | ₩40k/월 | Prometheus 스택 |
| S3 접근 | VPC Endpoint | ₩18k/월 | 데이터 전송 비용 |

**총 절감**: ₩415,000/월

---

## 🎓 학습 포인트

### AWS 서비스 이해
1. **VPC 구조**: Public/Private Subnet, Route Table, NACL
2. **로드 밸런싱**: ALB, Target Group, Health Check
3. **Auto Scaling**: CloudWatch 메트릭 기반
4. **서버리스 DB**: Aurora Serverless v2의 ACU 개념
5. **VPC Endpoint**: Gateway vs Interface 차이

### 비용 최적화 전략
1. **Right Sizing**: 워크로드에 맞는 인스턴스 선택
2. **Serverless 활용**: 사용량 기반 과금
3. **Self-hosting 고려**: 모니터링, 캐시 등
4. **프리티어 극대화**: CloudFront, VPC Endpoint
5. **서비스 통합**: 불필요한 마이크로서비스 분리 지양

### 아키텍처 설계 원칙
1. **단순성 우선**: 복잡도는 비용이다
2. **측정 가능성**: 메트릭 기반 의사결정
3. **점진적 확장**: 필요할 때 업그레이드
4. **비용 인식**: 모든 선택에 비용 고려
5. **보안 계층화**: Defense in Depth

---

## 📝 결론

이 아키텍처는 **₩154k/월**로 5,000명의 동시 사용자를 지원하는 티켓팅 시스템을 구축합니다.

**핵심 철학**:
- 🎯 **적정 기술**: 과도한 엔지니어링 지양
- 💰 **비용 효율**: 불필요한 지출 최소화
- 📈 **확장 가능**: 성장에 따라 업그레이드
- 🔒 **보안 우선**: 다층 보안 체계

**이 설계가 적합한 경우**:
- 초기 스타트업
- MVP (Minimum Viable Product)
- 예산 제약이 있는 프로젝트
- 점진적 성장 예상

**주의사항**:
- Single NAT는 가용성 리스크 존재
- Self-hosted 모니터링은 운영 부담 증가
- 트래픽 급증 시 Aurora ACU 상한 확인 필요

