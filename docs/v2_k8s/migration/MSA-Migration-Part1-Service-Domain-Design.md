# MSA 마이그레이션 가이드 Part 1: 서비스 도메인 설계

> **작성일:** 2025-12-03
> **프로젝트:** TIKETI - 실시간 티켓팅 플랫폼
> **목적:** 수십만 동시 접속자를 처리할 수 있는 MSA 아키텍처 전환 가이드

---

## 목차
1. [현재 모놀리식 아키텍처 분석](#현재-모놀리식-아키텍처-분석)
2. [MSA 전환이 필요한 이유](#msa-전환이-필요한-이유)
3. [티켓팅 도메인 특성 분석](#티켓팅-도메인-특성-분석)
4. [서비스 분리 전략](#서비스-분리-전략)
5. [각 마이크로서비스 상세 설계](#각-마이크로서비스-상세-설계)
6. [서비스 간 통신 패턴](#서비스-간-통신-패턴)
7. [데이터베이스 분리 전략](#데이터베이스-분리-전략)

---

## 1. 현재 모놀리식 아키텍처 분석

### 1.1 현재 구조

```
┌─────────────────────────────────────────────────────┐
│              Single Node.js Application             │
│                                                     │
│  ┌────────────────────────────────────────────┐   │
│  │ Routes (모든 기능이 하나의 프로세스)       │   │
│  │                                            │   │
│  │  • /api/auth          (인증)              │   │
│  │  • /api/events        (이벤트)            │   │
│  │  • /api/reservations  (예매)              │   │
│  │  • /api/payments      (결제)              │   │
│  │  • /api/queue         (대기열)            │   │
│  │  • /api/seats         (좌석)              │   │
│  │  • /api/admin         (관리자)            │   │
│  └────────────────────────────────────────────┘   │
│                                                     │
│  ┌────────────────────────────────────────────┐   │
│  │ Services (비즈니스 로직 공유)              │   │
│  │                                            │   │
│  │  • queue-manager.js                       │   │
│  │  • reservation-cleaner.js                 │   │
│  │  • socket-session-manager.js              │   │
│  └────────────────────────────────────────────┘   │
│                                                     │
│  ┌────────────────────────────────────────────┐   │
│  │ Shared Resources (공유 자원)               │   │
│  │                                            │   │
│  │  • PostgreSQL Connection Pool (단일)      │   │
│  │  • Redis Client (단일)                    │   │
│  │  • Socket.IO Instance (단일)              │   │
│  └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
           ↓                    ↓
    ┌─────────────┐      ┌──────────────┐
    │ PostgreSQL  │      │ DragonflyDB  │
    │ (모든 테이블)│      │ (모든 캐시)  │
    └─────────────┘      └──────────────┘
```

### 1.2 현재 아키텍처의 문제점

#### 🔴 **문제 1: 확장성 제약 (Scalability Bottleneck)**

**현상:**
```javascript
// 예매 트래픽이 증가하면
Reservation Route (CPU 90%)
  ↓ 영향
Event Route (응답 지연)
Payment Route (타임아웃)
Queue Route (연결 끊김)
// 모든 기능이 동시에 성능 저하
```

**왜 문제인가?**
- 인기 이벤트 오픈 시 예매 API만 폭주하는데, 전체 서버를 스케일 아웃해야 함
- 결제 처리가 느려지면 이벤트 조회까지 영향
- CPU/메모리를 많이 쓰는 기능(이미지 처리, 좌석 생성)이 전체 성능에 영향

**실제 티켓팅 사이트 사례:**
- 인터파크: 예매 서비스 독립 스케일링 (100배 확장)
- 멜론티켓: 대기열 전담 서버 (1000만명 동시 처리)
- 티켓링크: 결제 서비스 분리 (장애 격리)

---

#### 🔴 **문제 2: 장애 전파 (Failure Propagation)**

**현상:**
```javascript
// 결제 게이트웨이 장애 발생
Payment Service Down (토스페이먼츠 타임아웃)
  ↓ 메모리 누수
전체 Node.js 프로세스 크래시
  ↓ 영향
이벤트 조회 불가
대기열 시스템 중단
관리자 대시보드 접속 불가
```

**왜 문제인가?**
- 하나의 기능 장애가 전체 시스템 다운으로 이어짐
- 외부 API 장애(토스페이먼츠, S3)가 전체 서비스에 영향
- 복구 시간이 길어짐 (전체 재시작 필요)

**장애 격리 필요성:**
```
MSA 환경에서는:
결제 서비스 장애 → 다른 서비스는 정상 운영
이벤트 조회, 예매 조회, 관리자 기능 모두 정상
```

---

#### 🔴 **문제 3: 배포 위험 (Deployment Risk)**

**현상:**
```bash
# 결제 로직 수정 후 배포
git push origin main
  ↓
전체 서버 재시작
  ↓ 5분간
- 모든 WebSocket 연결 끊김 (10만명 대기열 손실)
- 진행 중인 예매 세션 소실
- 좌석 선택 상태 불일치
```

**왜 문제인가?**
- 작은 기능 변경도 전체 배포 필요
- 롤백 시 전체 시스템 롤백
- 무중단 배포 어려움
- A/B 테스트 불가

**MSA 환경에서는:**
```
결제 서비스만 업데이트 → 다른 서비스 무중단
Blue-Green 배포, Canary 배포 가능
```

---

#### 🟠 **문제 4: 데이터베이스 경합 (Database Contention)**

**현상:**
```sql
-- 단일 PostgreSQL에서
Event 조회 쿼리 (1000 TPS)
Reservation 생성 쿼리 (500 TPS) + 트랜잭션 락
Payment 로그 쓰기 (500 TPS)
Admin 통계 쿼리 (복잡한 JOIN, 10초 소요)
  ↓ 결과
Connection Pool 고갈 (max 20개)
쿼리 대기 시간 증가
Deadlock 발생 가능성
```

**왜 문제인가?**
- 읽기 전용(이벤트 조회)과 쓰기 중심(예매)이 같은 DB 사용
- 분석 쿼리(관리자 통계)가 트랜잭션에 영향
- 테이블 레벨 락 경합

**해결 방향:**
```
서비스별 DB 분리:
- Event Service DB: 읽기 최적화 (Replica 3대)
- Reservation Service DB: 쓰기 최적화 (트랜잭션)
- Analytics Service DB: 별도 Data Warehouse (CQRS)
```

---

#### 🟠 **문제 5: 코드 복잡도 증가 (Code Complexity)**

**현상:**
```javascript
// routes/reservations.js (538줄)
// 예매 로직에 모든 책임이 집중
router.post('/', async (req, res) => {
  // 1. 인증 확인
  // 2. 대기열 상태 확인 (queue-manager 의존)
  // 3. 티켓 재고 확인 (events 테이블 접근)
  // 4. 좌석 락 (seats 테이블 접근)
  // 5. 예매 생성 (reservations 테이블)
  // 6. 결제 준비 (payment 로직 포함)
  // 7. WebSocket 이벤트 (socket.io 직접 호출)
  // 8. 캐시 갱신 (redis 직접 조작)
  // 9. 메트릭 기록 (prometheus)
  // 10. 로그 기록
});
// 너무 많은 책임 → 테스트 어려움, 유지보수 복잡
```

**왜 문제인가?**
- 단일 라우트가 너무 많은 책임
- 의존성 파악 어려움
- 단위 테스트 작성 불가
- 새로운 개발자 온보딩 시간 증가

---

### 1.3 스케일 시뮬레이션

#### **시나리오: BTS 콘서트 티켓 오픈 (100만명 동시 접속)**

**현재 모놀리식 아키텍처:**
```
상황:
- 10:00:00 티켓 오픈
- 100만명이 새로고침 (Event 조회)
- 대기열 20만명 활성화 (Queue 처리)
- 1만명이 동시 예매 시도 (Reservation 생성)

결과:
┌───────────────────────────────────────────┐
│ EC2 Instance (t3.large, 2 vCPU, 8GB RAM) │
│                                           │
│ CPU: 100% (병목)                         │
│ Memory: 7.2GB / 8GB (90%)                │
│ Network: 1Gbps 포화                      │
│                                           │
│ Event API: 응답시간 15초 (목표 1초)      │
│ Queue API: 타임아웃 50%                  │
│ Reservation API: 에러율 30%              │
│                                           │
│ PostgreSQL:                               │
│  - Connection Pool 고갈 (20/20)          │
│  - 대기 쿼리 5,000개                     │
│  - Deadlock 발생                          │
│                                           │
│ 결과: 서버 크래시, 전체 서비스 다운      │
└───────────────────────────────────────────┘
```

**Auto Scaling 시도 시:**
```
문제:
1. EC2 10대로 확장해도 효율 낮음
   - Event 조회는 CPU 10% 사용
   - Reservation은 CPU 80% 사용
   - 결제는 대부분 대기 (I/O bound)
   → 비효율적인 리소스 사용

2. PostgreSQL이 새로운 병목
   - DB Connection Pool 부족
   - 단일 Master DB → 쓰기 병목

3. 비용 폭발
   - EC2 10대 × $0.1/시간 = $1/시간
   - 실제로 필요한 것은 Reservation 서비스만 확장
```

---

**MSA 아키텍처 (목표):**
```
상황: 동일 (100만명 동시 접속)

결과:
┌──────────────────────────────────────────────┐
│ Service별 독립 스케일링                      │
│                                              │
│ Event Service:                               │
│  - EC2 3대 (읽기 전용, CPU 30%)            │
│  - CloudFront CDN (캐시 히트율 90%)        │
│  - 응답시간: 200ms ✅                        │
│                                              │
│ Queue Service:                               │
│  - EC2 8대 (대기열 전담, CPU 60%)          │
│  - Redis Cluster (6 노드)                   │
│  - WebSocket 연결 안정적 ✅                 │
│                                              │
│ Reservation Service:                         │
│  - EC2 10대 (예매 집중, CPU 70%)           │
│  - 독립 DB (Connection Pool 200)            │
│  - 에러율 0.1% ✅                            │
│                                              │
│ Payment Service:                             │
│  - EC2 2대 (I/O bound, CPU 20%)            │
│  - Circuit Breaker (장애 격리)             │
│  - 외부 API 타임아웃 영향 없음 ✅           │
│                                              │
│ 비용:                                        │
│  - 총 EC2 23대 (평소 8대, 피크시 자동 증가)│
│  - 하지만 효율적 리소스 사용                │
│  - 평소 비용 $0.8/h, 피크 $2.3/h           │
│                                              │
│ 결과: 안정적 운영, 에러율 <0.5% ✅          │
└──────────────────────────────────────────────┘
```

---

## 2. MSA 전환이 필요한 이유

### 2.1 실제 티켓팅 사이트 벤치마크

#### **인터파크 티켓 아키텍처 (공개 자료 기반)**

```
┌─────────────────────────────────────────────────────┐
│              Load Balancer (L7 + L4)                │
└───────────┬─────────────────────────────────────────┘
            ├─── Event Catalog Service (조회 전담)
            │    └─ EC2 Auto Scaling: 5-20대
            │    └─ ElastiCache Redis (캐시 히트 95%)
            │    └─ CloudFront CDN
            │
            ├─── Queue Management Service (대기열)
            │    └─ EC2 Auto Scaling: 10-100대 🔥
            │    └─ Redis Cluster (6-24 샤드)
            │    └─ WebSocket 전담
            │
            ├─── Reservation Service (예매 코어)
            │    └─ EC2 Auto Scaling: 20-200대 🔥🔥
            │    └─ RDS Aurora (Multi-AZ, 16 Replica)
            │    └─ 분산 트랜잭션 (Saga Pattern)
            │
            ├─── Payment Gateway Service (결제)
            │    └─ EC2 2-10대
            │    └─ Circuit Breaker (KCP, 나이스페이)
            │    └─ 독립 DB (결제 로그)
            │
            └─── Notification Service (알림)
                 └─ Lambda (이벤트 기반)
                 └─ SQS + SNS
                 └─ 카카오톡, SMS, 이메일

특징:
- 예매 서비스는 평소 20대 → 피크 200대 자동 확장
- 대기열 서비스는 Redis Cluster로 1000만명 동시 처리
- 결제 장애 시 다른 서비스는 정상 운영
```

#### **멜론티켓 (카카오엔터테인먼트)**

```
핵심 전략:
1. API Gateway (Kong)
   - Rate Limiting (사용자당 초당 10 요청)
   - JWT 검증 중앙화
   - Circuit Breaker

2. Event Sourcing
   - 모든 예매 이벤트 Kafka로 저장
   - 장애 복구 시 이벤트 재생
   - 실시간 통계 (Kafka Streams)

3. CQRS
   - 쓰기: Reservation Service → PostgreSQL
   - 읽기: Query Service → Elasticsearch
   - 비동기 동기화 (Kafka)

4. Cache-Aside Pattern
   - Redis 3단 캐시 (L1, L2, L3)
   - TTL 전략: 5초, 30초, 5분
   - Cache Warming (사전 로딩)

결과:
- 2023년 1월 블랙핑크 콘서트: 500만명 동시 접속 안정 처리
- 평균 응답시간: 100ms 이하
- 가용성: 99.99%
```

---

### 2.2 MSA의 구체적 이점 (티켓팅 관점)

#### ✅ **이점 1: 독립적 스케일링 (비용 최적화)**

**현재 (모놀리식):**
```
평소 트래픽:
- Event 조회: 100 req/s
- Reservation: 10 req/s
- Payment: 5 req/s

필요한 서버: EC2 2대 (t3.medium)
비용: $0.08/h × 2 = $0.16/h

피크 트래픽 (티켓 오픈):
- Event 조회: 10,000 req/s 🔥
- Reservation: 1,000 req/s 🔥
- Payment: 100 req/s

필요한 서버: EC2 20대 (모든 서비스 함께 확장)
비용: $0.08/h × 20 = $1.6/h
월 비용: $1,200 (평소 $120, 피크 시간 대부분)
```

**MSA 환경:**
```
평소 트래픽:
- Event Service: EC2 1대 (t3.small) = $0.02/h
- Reservation Service: EC2 1대 (t3.medium) = $0.04/h
- Payment Service: EC2 1대 (t3.small) = $0.02/h
총: $0.08/h

피크 트래픽:
- Event Service: EC2 5대 (CloudFront 캐시로 절감) = $0.1/h
- Reservation Service: EC2 15대 (집중 확장) = $0.6/h
- Payment Service: EC2 2대 = $0.04/h
총: $0.74/h

월 비용: $600 (50% 절감 ✅)
```

**ROI 계산:**
```
연간 절감:
($1,200 - $600) × 12개월 = $7,200

MSA 전환 비용:
- 개발 인력: 2개월 × 2명 = $20,000
- AWS 마이그레이션: $5,000

투자 회수 기간: 25,000 / 7,200 = 3.5개월
```

---

#### ✅ **이점 2: 장애 격리 및 가용성 향상**

**시나리오: 결제 게이트웨이 장애**

**현재 (모놀리식):**
```javascript
// Payment Route에서 토스페이먼츠 타임아웃
POST /api/payments/process
  ↓ 60초 타임아웃 × 100 동시 요청
Node.js 이벤트 루프 블로킹
  ↓
모든 API 응답 지연
  ↓
전체 서비스 다운 (99.9% → 90% 가용성)

영향:
- 이벤트 조회 불가 ❌
- 예매 내역 확인 불가 ❌
- 관리자 대시보드 접속 불가 ❌
- 대기열 시스템 중단 ❌
```

**MSA 환경:**
```javascript
// Payment Service에 Circuit Breaker 적용
Payment Service Down (타임아웃 감지)
  ↓
Circuit Open (빠른 실패, fallback 응답)
  ↓ 다른 서비스는 정상
Event Service: 정상 ✅
Reservation Service: 정상 ✅ (예매 생성 후 PENDING 상태)
Queue Service: 정상 ✅

사용자 경험:
- "결제는 일시적으로 지연됩니다. 예매는 완료되었습니다."
- 예매 내역 확인 가능
- 나중에 결제 재시도 가능

가용성: 99.9% 유지 ✅
```

**Circuit Breaker 패턴:**
```javascript
// Payment Service
const circuitBreaker = new CircuitBreaker(
  tossPaymentAPI,
  {
    timeout: 3000,        // 3초 타임아웃
    errorThreshold: 50,   // 50% 에러율
    resetTimeout: 30000   // 30초 후 재시도
  }
);

// 장애 감지 시
if (circuitBreaker.isOpen()) {
  // Fallback: 예매는 PENDING, 나중에 결제
  return {
    status: 'payment_delayed',
    message: '예매가 확정되었습니다. 결제는 5분 내 완료해주세요.',
    reservationId: reservation.id
  };
}
```

---

#### ✅ **이점 3: 무중단 배포 및 빠른 출시**

**현재 (모놀리식):**
```bash
# 결제 로직 버그 수정
git commit -m "Fix payment rounding error"
git push

배포 과정:
1. 전체 서버 Blue-Green 배포
   - Blue (현재): EC2 10대
   - Green (새): EC2 10대 (2배 리소스 필요)
   - 전환 시간: 5분

2. 배포 중 영향:
   - WebSocket 연결 10만개 끊김
   - 대기열 상태 손실 가능성
   - 진행 중인 예매 세션 소실

3. 롤백 리스크:
   - 문제 발견 시 전체 롤백
   - 이벤트 조회 기능도 함께 롤백 (불필요)
```

**MSA 환경:**
```bash
# Payment Service만 업데이트
git commit -m "Fix payment rounding error"
git push

배포 과정:
1. Payment Service만 Blue-Green
   - Blue: EC2 2대
   - Green: EC2 2대
   - 다른 서비스는 그대로 운영 ✅

2. Canary 배포:
   - 10% 트래픽 → Green (10분 모니터링)
   - 에러 없으면 50% → 100% 점진적 전환

3. 영향 범위:
   - Event Service: 무중단 ✅
   - Reservation Service: 무중단 ✅
   - Queue Service: 무중단 ✅
   - WebSocket 연결 유지 ✅

4. 롤백:
   - Payment Service만 롤백 (30초)
   - 다른 서비스 영향 없음
```

**A/B 테스트 가능:**
```
새로운 결제 UI 테스트:
- 50% 사용자 → 기존 Payment Service
- 50% 사용자 → 새 Payment Service (v2)
- 전환율 비교 후 우승자 선택
```

---

#### ✅ **이점 4: 기술 스택 다양화**

**현재 (모놀리식):**
```
모든 서비스 = Node.js/Express
  ↓ 제약
- CPU 집약적 작업 (이미지 처리) 느림
- 통계 쿼리 (복잡한 집계) 비효율
- ML 모델 (추천 시스템) 통합 어려움
```

**MSA 환경:**
```
각 서비스에 최적 기술 선택:

Event Service: Node.js ✅
  - 빠른 응답
  - 비동기 I/O

Reservation Service: Go 🚀
  - 높은 동시성
  - 낮은 메모리 사용
  - 빠른 트랜잭션 처리

Analytics Service: Python 📊
  - pandas, numpy (데이터 분석)
  - 복잡한 통계 계산
  - ML 모델 통합

Image Processing Service: Rust/C++ ⚡
  - 초고속 이미지 리사이징
  - 낮은 CPU 사용

Search Service: Elasticsearch 🔍
  - 전문 검색
  - 자동완성
  - 한글 형태소 분석
```

---

## 3. 티켓팅 도메인 특성 분석

### 3.1 트래픽 패턴 분석

#### **일반 서비스 vs 티켓팅 서비스**

```
일반 전자상거래 (쿠팡, 11번가):
┌────────────────────────────────────┐
│ 트래픽 패턴: 완만한 곡선            │
│                                    │
│     │                              │
│  T  │        ___________           │
│  r  │      _/           \_         │
│  a  │    _/               \_       │
│  f  │  _/                   \_     │
│  f  │_/                       \__  │
│  i  ├─────────────────────────────│
│  c  │ 6am  12pm  6pm  12am        │
│     └─────────────────────────────│
│                                    │
│ 특징:                              │
│ - 점진적 증가/감소                 │
│ - 예측 가능                        │
│ - Auto Scaling 여유 있음           │
└────────────────────────────────────┘

티켓팅 서비스 (인터파크, 멜론):
┌────────────────────────────────────┐
│ 트래픽 패턴: 극단적 스파이크 🔥     │
│                                    │
│     │        🚀                    │
│  T  │        │ 100만 TPS           │
│  r  │        │                     │
│  a  │        │                     │
│  f  │        │                     │
│  f  │        │                     │
│  i  │________│___________________  │
│  c  │ 09:59  10:00  10:05  평소  │
│     └─────────────────────────────│
│                                    │
│ 특징:                              │
│ - 0 → 100만 TPS (5초 이내) 🚀     │
│ - 예측 불가능한 폭발                │
│ - 사전 준비 필수 (Pre-Scaling)     │
│ - 대기열 시스템 필수                │
└────────────────────────────────────┘
```

#### **트래픽 분석 (BTS 콘서트 티켓 오픈 기준)**

```
타임라인 분석:

09:30 - 사전 접속 시작
├─ Event 조회: 1,000 → 50,000 TPS (50배 증가)
├─ 필요한 처리:
│  └─ CloudFront 캐시 Warming
│  └─ ElastiCache 사전 로딩
│  └─ EC2 Pre-Scaling (예상 트래픽 80%)
└─ 대기열 시스템 활성화 (100만명 대기)

09:59:50 - 티켓 오픈 10초 전
├─ Event 조회: 500,000 TPS 🔥
├─ Queue 진입: 1,000,000명 → Sorted Set 추가
├─ WebSocket 연결: 500,000개 동시
└─ 시스템 상태:
   ├─ Queue Service: EC2 100대 (최대)
   ├─ Event Service: EC2 20대
   └─ Reservation Service: EC2 50대 (대기)

10:00:00 - 티켓 오픈
├─ Reservation 생성: 0 → 10,000 TPS (즉시 폭발) 🚀
├─ Seat 락: 100,000 동시 요청
├─ Payment 준비: 5,000 TPS
├─ 병목 지점:
│  ├─ PostgreSQL Write (가장 위험) ⚠️
│  ├─ Redis Lock (분산 락 경합)
│  └─ WebSocket Broadcast (메모리 급증)
└─ 필요한 처리:
   ├─ DB Connection Pool 확장 (20 → 500)
   ├─ Redis Cluster (단일 → 6 샤드)
   └─ Socket.IO Redis Adapter (멀티 인스턴스)

10:00:30 - 초반 30초
├─ Reservation: 10,000 → 5,000 TPS (절반 감소)
├─ 이유: 좌석 선택 시간 소요
├─ Queue 처리: 1,000,000 → 500,000명 (50% 처리)
└─ 시스템 상태: 안정화 단계

10:05:00 - 5분 경과
├─ Reservation: 1,000 TPS (안정)
├─ Payment: 3,000 TPS (예매 완료 후 결제 집중)
├─ Queue: 거의 비움 (20,000명 잔여)
└─ Auto Scaling Down 시작

10:30:00 - 티켓 매진
├─ Reservation: 10 TPS (대기 취소, 환불)
├─ Event 상태: on_sale → sold_out
├─ Queue: 비활성화
└─ EC2 Scale Down: 200대 → 10대 (정상)
```

---

### 3.2 도메인 핵심 기능 분석

#### **기능별 중요도 및 트래픽 특성**

| 기능 | 중요도 | 트래픽 패턴 | RPS (피크) | 지연 허용 | 일관성 요구 |
|------|--------|------------|-----------|----------|------------|
| **이벤트 조회** | 🔥🔥🔥🔥🔥 | 폭발적 읽기 | 500K | <100ms | Eventual |
| **대기열** | 🔥🔥🔥🔥🔥 | 지속적 | 100K | <500ms | Strong |
| **예매 생성** | 🔥🔥🔥🔥🔥 | 폭발적 쓰기 | 10K | <1s | Strong |
| **좌석 선택** | 🔥🔥🔥🔥 | 폭발적 | 100K | <300ms | Strong |
| **결제 처리** | 🔥🔥🔥🔥 | 중간 | 5K | <3s | Strong |
| **예매 조회** | 🔥🔥🔥 | 완만 | 1K | <500ms | Eventual |
| **관리자** | 🔥🔥 | 낮음 | 10 | <2s | Eventual |
| **통계/분석** | 🔥 | 낮음 | 1 | <10s | Eventual |

**중요도 기준:**
- 🔥🔥🔥🔥🔥 Critical: 장애 시 비즈니스 중단
- 🔥🔥🔥🔥 High: 장애 시 사용자 경험 큰 저하
- 🔥🔥🔥 Medium: 장애 시 일부 기능 제한
- 🔥🔥 Low: 장애 시 운영 불편
- 🔥 Optional: 장애 시 영향 미미

---

### 3.3 데이터 일관성 요구사항

#### **강한 일관성 (Strong Consistency) 필요**

```
1. 좌석 선택 (Double Booking 방지)
   사용자 A가 좌석 A-1 선택
   동시에 사용자 B가 좌석 A-1 선택
   → 한 명만 성공해야 함 (분산 락 필수)

   해결책:
   - DragonflyDB SET NX (원자적 락)
   - PostgreSQL SELECT FOR UPDATE (행 레벨 락)
   - 2-Phase Commit (분산 환경)

2. 티켓 재고 (Overselling 방지)
   VIP석 100매 → 101매 판매되면 안 됨

   해결책:
   - DB 트랜잭션 (FOR UPDATE)
   - Optimistic Lock (버전 관리)
   - 재고 예약 시스템 (Inventory Reserve Pattern)

3. 결제 처리 (중복 결제 방지)
   사용자가 "결제" 버튼 연타
   → 1번만 처리되어야 함

   해결책:
   - Idempotency Key (UUID)
   - 결제 상태 머신 (State Machine)
   - 멱등성 보장 (Idempotent API)
```

#### **최종 일관성 (Eventual Consistency) 허용**

```
1. 이벤트 목록 (약간의 지연 허용)
   새 이벤트 생성 → 5초 후 목록에 표시 OK

   이점:
   - CloudFront CDN 캐시 (TTL 5초)
   - ElastiCache Redis (TTL 30초)
   - DB 부하 99% 감소

2. 통계 데이터 (실시간 아님)
   관리자 대시보드 "오늘 예매 수"
   → 1분 지연 OK

   이점:
   - Data Warehouse (별도 DB)
   - 배치 집계 (1분마다)
   - OLTP DB에 영향 없음

3. 검색 인덱스 (Elasticsearch)
   이벤트 제목 변경 → 10초 후 검색 반영 OK

   이점:
   - CDC (Change Data Capture)
   - 비동기 동기화
   - 검색 성능 최적화
```

---

## 4. 서비스 분리 전략

### 4.1 서비스 식별 기준

#### **DDD (Domain-Driven Design) 적용**

```
Bounded Context 분석:

1. User Context (사용자 도메인)
   ├─ Entities: User
   ├─ Value Objects: Email, Password
   ├─ Services: Authentication, Authorization
   └─ 특징: 독립적, 다른 도메인과 느슨한 결합

2. Event Context (이벤트 도메인)
   ├─ Entities: Event, SeatLayout, Seat
   ├─ Aggregates: Event + Seats
   ├─ Services: EventManagement, SeatGeneration
   └─ 특징: 읽기 중심, 캐시 친화적

3. Reservation Context (예매 도메인) 🔥 핵심
   ├─ Entities: Reservation, ReservationItem
   ├─ Aggregates: Reservation + Items + Seats
   ├─ Services: ReservationCreation, Cancellation
   └─ 특징: 트랜잭션 중심, 강한 일관성

4. Payment Context (결제 도메인)
   ├─ Entities: Payment, PaymentLog
   ├─ External: TossPayments, KakaoPay
   ├─ Services: PaymentProcessing, Refund
   └─ 특징: 외부 의존, Circuit Breaker 필수

5. Queue Context (대기열 도메인)
   ├─ Entities: QueueEntry
   ├─ Services: QueueManagement, Admission
   └─ 특징: 실시간, Redis 중심

6. Notification Context (알림 도메인)
   ├─ Entities: Notification, Template
   ├─ External: Email, SMS, Push
   └─ 특징: 비동기, 이벤트 기반
```

---

### 4.2 권장 마이크로서비스 구조 (6개 핵심 + 3개 부가)

#### **Phase 1: 핵심 서비스 (필수)**

```
1. Auth Service (인증/인가)
   Port: 3010
   DB: PostgreSQL (users 테이블만)
   Cache: Redis (세션, JWT 블랙리스트)
   책임:
   - 회원가입, 로그인
   - JWT 토큰 발급/검증
   - 사용자 프로필 관리
   - 관리자 권한 확인

   API:
   POST   /auth/register
   POST   /auth/login
   POST   /auth/refresh-token
   GET    /auth/me
   POST   /auth/logout

   확장성: 2-4 인스턴스 (CPU 기반)

2. Event Service (이벤트 관리)
   Port: 3011
   DB: PostgreSQL (events, seat_layouts, seats)
   Cache: Redis (이벤트 목록, 상세)
   CDN: CloudFront (정적 이미지)
   책임:
   - 이벤트 CRUD
   - 좌석 레이아웃 조회
   - 이벤트 검색
   - 이미지 업로드 (S3)

   API:
   GET    /events (목록, 검색, 필터)
   GET    /events/:id (상세)
   POST   /events (관리자)
   PUT    /events/:id (관리자)
   DELETE /events/:id (관리자)
   GET    /events/:id/seats (좌석 배치도)

   확장성: 2-20 인스턴스 (피크 시 급증)
   캐시 전략: CloudFront (5분) + Redis (30초)

3. Queue Service (대기열)
   Port: 3012
   DB: Redis Cluster (6-24 샤드)
   WebSocket: Socket.IO (전담)
   책임:
   - 대기열 진입/이탈
   - 순번 관리 (FIFO)
   - 입장 허용 (50명/초)
   - 실시간 순번 업데이트

   API:
   POST   /queue/join/:eventId
   GET    /queue/status/:eventId/:userId
   POST   /queue/leave/:eventId
   WS     socket.on('queue:update')

   확장성: 10-100 인스턴스 (큐 크기 기반)
   핵심 메트릭: 큐 크기, 대기 시간

4. Reservation Service (예매 코어) 🔥
   Port: 3013
   DB: PostgreSQL (reservations, reservation_items)
   Cache: Redis (좌석 락, 재고)
   Queue: RabbitMQ (이벤트 발행)
   책임:
   - 예매 생성 (트랜잭션)
   - 좌석 선택/락
   - 예매 취소
   - 만료 처리

   API:
   POST   /reservations
   GET    /reservations/my
   GET    /reservations/:id
   POST   /reservations/:id/cancel
   POST   /seats/lock
   POST   /seats/release

   확장성: 20-200 인스턴스 (최대 확장)
   트랜잭션: 2-Phase Commit (Saga Pattern)
   이벤트: ReservationCreated, ReservationCancelled

5. Payment Service (결제)
   Port: 3014
   DB: PostgreSQL (payments, payment_logs)
   External: TossPayments, KakaoPay API
   Queue: RabbitMQ (이벤트 구독)
   책임:
   - 결제 요청
   - 결제 승인/실패
   - 환불 처리
   - 결제 로그

   API:
   POST   /payments/prepare
   POST   /payments/confirm
   POST   /payments/cancel
   GET    /payments/:id/status

   확장성: 2-10 인스턴스
   Circuit Breaker: 외부 API 타임아웃 대응
   Idempotency: 중복 결제 방지

6. API Gateway
   Port: 443 (HTTPS)
   Platform: Kong, AWS API Gateway
   책임:
   - 라우팅 (서비스별 분배)
   - 인증 검증 (JWT)
   - Rate Limiting (DDoS 방지)
   - Request/Response Logging
   - CORS 처리

   라우팅:
   /api/auth/*         → Auth Service
   /api/events/*       → Event Service
   /api/queue/*        → Queue Service
   /api/reservations/* → Reservation Service
   /api/payments/*     → Payment Service

   Rate Limiting:
   - 인증 사용자: 100 req/min
   - 비인증: 10 req/min
   - Admin: unlimited
```

---

#### **Phase 2: 부가 서비스 (선택적)**

```
7. Notification Service
   Trigger: 이벤트 기반 (RabbitMQ 구독)
   External: 카카오톡, SMS, Email
   책임:
   - 예매 확인 알림
   - 결제 완료 알림
   - 대기열 입장 알림
   - 이벤트 오픈 알림

   이벤트 구독:
   - ReservationCreated → 예매 확인 메일
   - PaymentCompleted → 결제 완료 메일
   - QueueEntryAllowed → 입장 허용 알림

   확장: Lambda (서버리스)

8. Analytics Service
   DB: Redshift, BigQuery (Data Warehouse)
   Dashboard: Grafana, Tableau
   책임:
   - 실시간 대시보드
   - 매출 통계
   - 사용자 행동 분석
   - 예측 모델링

   데이터 파이프라인:
   PostgreSQL → CDC (Debezium) → Kafka → Redshift

   확장: EMR (배치 처리)

9. Search Service
   DB: Elasticsearch
   책임:
   - 이벤트 전문 검색
   - 자동완성
   - 한글 형태소 분석
   - 연관 검색어

   동기화:
   Event Service → Kafka → Elasticsearch

   확장: ES Cluster (3-9 노드)
```

---

### 4.3 서비스 책임 매트릭스

| 서비스 | 주요 책임 | 외부 의존성 | 확장 전략 | 가용성 목표 |
|--------|----------|------------|----------|------------|
| **Auth** | JWT 발급, 사용자 인증 | - | CPU 기반 (2-4) | 99.9% |
| **Event** | 이벤트 조회, 검색 | S3, CloudFront | Request 기반 (2-20) | 99.95% |
| **Queue** | 대기열, 입장 제어 | Redis Cluster | Queue Size 기반 (10-100) | 99.99% |
| **Reservation** | 예매, 좌석 락 | PostgreSQL, Redis | Request 기반 (20-200) | 99.99% |
| **Payment** | 결제 처리 | Toss, Kakao | Request 기반 (2-10) | 99.9% |
| **Notification** | 알림 발송 | 카카오톡, SMS | 이벤트 기반 (Lambda) | 99.5% |
| **Analytics** | 통계, 대시보드 | Redshift | 배치 (1-5) | 95% |
| **Search** | 전문 검색 | Elasticsearch | Cluster (3-9) | 99% |

---

계속해서 Part 2 (AWS 아키텍처 설계)를 작성하겠습니다...