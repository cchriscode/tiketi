# TIKETI MSA 마이그레이션 가이드 - 전체 요약

> **작성일:** 2025-12-03
> **프로젝트:** TIKETI - 실시간 티켓팅 플랫폼
> **목표:** 수십만 동시 접속자 처리 가능한 MSA 아키텍처 전환

---

## 📚 문서 구성

이 가이드는 4개의 상세 문서로 구성되어 있습니다:

1. **Part 1: 서비스 도메인 설계** (`MSA-Migration-Part1-Service-Domain-Design.md`)
   - 현재 모놀리식 아키텍처 문제점 분석
   - MSA 전환이 필요한 이유 (실제 티켓팅 사이트 벤치마크)
   - 6개 핵심 마이크로서비스 설계

2. **Part 2: AWS 아키텍처 설계** (`MSA-Migration-Part2-AWS-Architecture.md`)
   - 전체 AWS 아키텍처 다이어그램
   - 각 AWS 서비스 선정 이유 및 상세 설정
   - 네트워크, 데이터베이스, Auto Scaling 전략

3. **Part 3: 단계별 마이그레이션 가이드** (`MSA-Migration-Part3-Step-by-Step-Guide.md`)
   - 12-15주 마이그레이션 로드맵
   - Phase 0-8 단계별 실행 가이드
   - 실제 코드 예시 및 트러블슈팅

4. **이 문서 (Summary):** 핵심 내용 요약 및 빠른 참조

---

## 🎯 핵심 요약

### 왜 MSA로 전환해야 하는가?

#### **현재 모놀리식의 치명적 문제점**

| 문제 | 현상 | 비즈니스 영향 |
|------|------|---------------|
| **확장성 제약** | 예매 트래픽 증가 시 전체 서버 확장 필요 | 비용 2배, 효율 50% |
| **장애 전파** | 결제 장애 시 전체 시스템 다운 | 가용성 99.9% → 90% |
| **배포 위험** | 작은 변경도 전체 재시작 | WebSocket 10만 연결 끊김 |
| **DB 경합** | 모든 서비스가 단일 DB 사용 | Connection Pool 고갈 |

#### **MSA 전환 후 기대 효과**

```
비용 절감: 월 $1,200 → $600 (50% 절감)
가용성: 99.9% → 99.99% (장애 격리)
배포 속도: 5분 → 30초 (서비스별 독립 배포)
확장성: 필요한 서비스만 확장 (비용 효율)
```

---

## 🏗️ 마이크로서비스 구조

### 6개 핵심 서비스

```
┌─────────────────────────────────────────────────────────┐
│                    API Gateway (Kong)                   │
│  - JWT 검증, Rate Limiting, Circuit Breaker            │
└───────────────┬─────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬─────────────┬──────────┐
    ↓           ↓           ↓             ↓          ↓
┌─────────┐ ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────┐
│  Auth   │ │ Event   │ │  Queue   │ │Reserv  │ │Payment │
│Service  │ │ Service │ │ Service  │ │Service │ │Service │
│         │ │         │ │          │ │        │ │        │
│Port3010 │ │Port3011 │ │Port3012  │ │Port3013│ │Port3014│
│EC2: 2-4 │ │EC2:2-20 │ │EC2:10-100│ │EC2:20- │ │EC2:2-10│
│         │ │         │ │   🔥🔥   │ │200 🔥🔥│ │        │
└────┬────┘ └────┬────┘ └────┬─────┘ └───┬────┘ └───┬────┘
     │           │           │            │          │
     ↓           ↓           ↓            ↓          ↓
┌─────────────────────────────────────────────────────────┐
│              Database Layer (분리됨)                    │
│                                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ Auth DB  │ │Event DB  │ │Redis     │ │Reserv DB │  │
│ │(users)   │ │(events,  │ │Cluster   │ │(reserv)  │  │
│ │          │ │ seats)   │ │(queue,   │ │          │  │
│ │RDS Aurora│ │RDS Aurora│ │ locks)   │ │RDS Aurora│  │
│ │Writer: 1 │ │Writer: 1 │ │6 Shards  │ │Writer: 1 │  │
│ │Reader: 2 │ │Reader: 8 │ │12 Nodes  │ │Reader: 4 │  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 서비스별 책임

| 서비스 | 핵심 책임 | 확장 기준 | 가용성 목표 |
|--------|----------|----------|------------|
| **Auth** | JWT 발급, 사용자 인증 | CPU 70% | 99.9% |
| **Event** | 이벤트 조회, 검색, 좌석 배치도 | Request/s | 99.95% |
| **Queue** | 대기열 진입/이탈, 순번 관리, WebSocket | Queue Size | 99.99% |
| **Reservation** | 예매 생성/취소, 좌석 락, 재고 관리 | Request/s, CPU 80% | 99.99% |
| **Payment** | 결제 처리, 환불, 외부 API 연동 | Request/s | 99.9% |

---

## ☁️ AWS 아키텍처

### 주요 AWS 서비스

```
Compute:
├─ ECS Fargate (권장 초기) 또는 EKS (대규모)
├─ ALB (Application Load Balancer)
└─ API Gateway (선택적, Kong으로 대체 가능)

Database:
├─ RDS Aurora PostgreSQL (서비스별 Cluster)
│  └─ 1 Writer + 1-8 Read Replicas (Auto Scaling)
└─ ElastiCache Redis (Cluster Mode)
   └─ 6 Shards × (1 Primary + 1 Replica)

Storage:
├─ S3 (이미지, 정적 파일)
└─ CloudFront (CDN)

Monitoring:
├─ CloudWatch (로그, 메트릭)
├─ X-Ray (분산 추적)
└─ SNS/SQS (알림, 이벤트)

Networking:
├─ VPC (10.0.0.0/16)
├─ 3 AZ (Multi-AZ)
├─ Public Subnets (ALB, NAT)
├─ Private App Subnets (ECS Tasks)
└─ Private Data Subnets (RDS, Redis)
```

### 월 예상 비용

```
ECS Fargate (평소):
- Auth: 2 Tasks × $0.099/h × 720h = $142/월
- Event: 2 Tasks × $0.099/h × 720h = $142/월
- Queue: 10 Tasks × $0.198/h × 720h = $1,426/월
- Reservation: 20 Tasks × $0.396/h × 720h = $5,702/월
- Payment: 2 Tasks × $0.099/h × 720h = $142/월
소계: $7,554/월

RDS Aurora:
- Event DB: Writer + 8 Readers = $1,138/월
- Reservation DB: Writer + 4 Readers = $830/월
- Auth DB: Writer + 2 Readers = $691/월
소계: $2,659/월

ElastiCache Redis:
- 12 Nodes × cache.r6g.xlarge (Reserved) = $1,641/월

ALB:
- $16/월 + $0.008/LCU-h × 720h × 10 LCU = $73/월

CloudFront:
- 10TB 데이터 전송 = $850/월

S3:
- 500GB 저장 + 전송 = $15/월

총 월 비용: $12,792/월

피크 시 (티켓 오픈 10시간):
- ECS Auto Scaling: +$1,500
- RDS Replica Auto Scaling: +$400

월 총 비용 (피크 포함): ~$14,700/월
```

**비용 절감 전략:**
- Reserved Instances (RDS, ElastiCache): 40% 절감
- Savings Plans (ECS Fargate): 30% 절감
- Spot Instances (EKS 환경): 70% 절감
- CloudFront 캐싱 최적화: 데이터 전송비 50% 절감

**최적화 후 예상 비용: $8,000-9,000/월**

---

## 📅 마이그레이션 로드맵

### 전체 타임라인 (12-15주)

| Phase | 기간 | 핵심 작업 | 완료 기준 |
|-------|------|----------|----------|
| **Phase 0** | 1-2주 | AWS 계정, VPC, CI/CD, 모니터링 구축 | Terraform 코드 완성 |
| **Phase 1** | 2-3주 | RDS Aurora, ElastiCache, ALB 구성 | 인프라 Health Check OK |
| **Phase 2** | 1주 | Auth Service 분리 | JWT 검증 독립 동작 |
| **Phase 3** | 1-2주 | Event Service 분리 | CloudFront 캐싱 적용 |
| **Phase 4** | 2주 | Queue Service 분리 | WebSocket 실시간 동작 |
| **Phase 5** | 3-4주 | Reservation Service 분리 | Saga Pattern 구현 |
| **Phase 6** | 2주 | Payment Service 분리 | Circuit Breaker 적용 |
| **Phase 7** | 1주 | 모놀리스 완전 제거 | 트래픽 100% 전환 |
| **Phase 8** | 지속 | 최적화 및 확장 | SLA 99.99% 달성 |

### Strangler Fig 패턴

```
모놀리스를 점진적으로 교체:

Week 0:   모놀리스 100%
Week 6:   Auth 분리 (20% MSA)
Week 8:   Event 분리 (40% MSA)
Week 10:  Queue 분리 (60% MSA)
Week 14:  Reservation 분리 (80% MSA)
Week 15:  Payment 분리 (100% MSA)
Week 16:  모놀리스 종료 ✅
```

---

## 🔥 핵심 전환 포인트

### 1. 데이터베이스 분리 전략

**Database per Service 패턴:**

```sql
-- 기존 단일 DB
tiketi (PostgreSQL)
├─ users
├─ events
├─ seats
├─ reservations
├─ payments
└─ ...

-- MSA 환경 (서비스별 분리)
tiketi-auth (PostgreSQL)
└─ users

tiketi-event (PostgreSQL)
├─ events
├─ seats
└─ seat_layouts

tiketi-reservation (PostgreSQL)
├─ reservations
└─ reservation_items

tiketi-payment (PostgreSQL)
├─ payments
└─ payment_logs
```

**데이터 동기화:**
- 이벤트 기반 (RabbitMQ, Kafka)
- API 호출 (서비스 간 REST)
- Read Replica (동일 데이터 공유 시)

---

### 2. 서비스 간 통신 패턴

#### **동기 통신 (REST API)**

```
사용자 → API Gateway → Reservation Service
                           ↓ GET /api/v1/events/:id
                       Event Service (HTTP 요청)
                           ↓ 응답
                       Reservation Service
                           ↓
                       사용자
```

**언제 사용:**
- 즉시 응답 필요 (이벤트 조회, 좌석 상태)
- 트랜잭션 일관성 필요
- 단순한 CRUD 작업

**단점:**
- 서비스 간 결합도 증가
- 네트워크 지연
- Cascading 장애 가능성

---

#### **비동기 통신 (이벤트 기반)**

```
Reservation Service
  ├─ 예매 생성 (DB 저장)
  ├─ ReservationCreated 이벤트 발행 (RabbitMQ)
  └─ 즉시 응답 (HTTP 201)

        ↓ (메시지 큐)

Payment Service (구독)
  ├─ 이벤트 수신
  ├─ 결제 처리 (비동기)
  └─ PaymentCompleted 이벤트 발행

        ↓

Notification Service (구독)
  ├─ 이벤트 수신
  └─ 이메일/SMS 발송
```

**언제 사용:**
- 즉시 응답 불필요 (결제, 알림)
- 장애 격리 필요
- 높은 처리량 필요

**장점:**
- 느슨한 결합 (Decoupled)
- 장애 격리 (하나 실패해도 다른 서비스 정상)
- 확장성 (처리량 독립적)

---

### 3. Saga Pattern (분산 트랜잭션)

**문제:** MSA 환경에서는 여러 서비스에 걸친 트랜잭션 불가

**해결책:** Choreography Saga

```
┌──────────────────────────────────────────────────────┐
│              예매 생성 Saga Flow                      │
└──────────────────────────────────────────────────────┘

성공 시나리오:

1. Reservation Service
   ├─ 예매 생성 (상태: PENDING)
   └─ ReservationCreated 이벤트 발행
        ↓
2. Payment Service (구독)
   ├─ 결제 처리
   ├─ 성공 → PaymentCompleted 이벤트
   └─ Reservation Service 업데이트 (상태: CONFIRMED)

실패 시나리오 (보상 트랜잭션):

1. Reservation Service
   ├─ 예매 생성 (상태: PENDING)
   └─ ReservationCreated 이벤트
        ↓
2. Payment Service (구독)
   ├─ 결제 처리
   ├─ 실패 → PaymentFailed 이벤트 🔴
   └─ Reservation Service 보상 트랜잭션
        ↓
3. Reservation Service (보상)
   ├─ 예매 취소 (상태: CANCELLED)
   ├─ 좌석 해제
   └─ 재고 복구
```

**코드 예시:**

```javascript
// Reservation Service
async function createReservation(userId, eventId, seatIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 예매 생성 (PENDING 상태)
    const reservation = await client.query(`
      INSERT INTO reservations (user_id, event_id, status, total_amount)
      VALUES ($1, $2, 'PENDING', $3)
      RETURNING *
    `, [userId, eventId, totalAmount]);

    // 좌석 락
    await client.query(`
      UPDATE seats
      SET status = 'reserved'
      WHERE id = ANY($1)
    `, [seatIds]);

    await client.query('COMMIT');

    // 이벤트 발행 (비동기)
    await publishEvent('ReservationCreated', {
      reservationId: reservation.id,
      userId,
      eventId,
      totalAmount,
      timestamp: new Date()
    });

    return { status: 'pending', reservationId: reservation.id };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Payment Service (이벤트 구독)
messageQueue.subscribe('ReservationCreated', async (event) => {
  const { reservationId, totalAmount } = event;

  try {
    // 결제 처리
    const payment = await processPayment(reservationId, totalAmount);

    // 성공 이벤트 발행
    await publishEvent('PaymentCompleted', {
      reservationId,
      paymentId: payment.id,
      timestamp: new Date()
    });

  } catch (error) {
    // 실패 이벤트 발행 (보상 트랜잭션 트리거)
    await publishEvent('PaymentFailed', {
      reservationId,
      reason: error.message,
      timestamp: new Date()
    });
  }
});

// Reservation Service (보상 트랜잭션)
messageQueue.subscribe('PaymentFailed', async (event) => {
  const { reservationId } = event;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 예매 취소
    await client.query(`
      UPDATE reservations
      SET status = 'CANCELLED'
      WHERE id = $1
    `, [reservationId]);

    // 좌석 해제
    await client.query(`
      UPDATE seats
      SET status = 'available'
      WHERE id IN (
        SELECT seat_id FROM reservation_items WHERE reservation_id = $1
      )
    `, [reservationId]);

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    // 보상 트랜잭션 실패 → Dead Letter Queue로 전송
    await sendToDeadLetterQueue(event);
  } finally {
    client.release();
  }
});
```

---

### 4. Circuit Breaker 패턴

**문제:** 외부 API 장애 시 전체 시스템 영향

**해결책:** Circuit Breaker (Hystrix)

```javascript
// Payment Service - Circuit Breaker
const CircuitBreaker = require('opossum');

const tossPaymentAPI = async (reservationId, amount) => {
  const response = await axios.post('https://api.tosspayments.com/v1/payments', {
    orderId: reservationId,
    amount,
    method: 'CARD'
  }, {
    timeout: 3000  // 3초 타임아웃
  });

  if (response.status !== 200) {
    throw new Error('Payment failed');
  }

  return response.data;
};

// Circuit Breaker 설정
const breaker = new CircuitBreaker(tossPaymentAPI, {
  timeout: 3000,          // 3초 타임아웃
  errorThresholdPercentage: 50,  // 50% 에러율
  resetTimeout: 30000,    // 30초 후 재시도
  volumeThreshold: 10     // 최소 10번 요청 후 판단
});

// 이벤트 리스너
breaker.on('open', () => {
  console.error('Circuit Open - Too many failures');
  // Prometheus Metric
  circuitBreakerOpens.inc();
});

breaker.on('halfOpen', () => {
  console.log('Circuit Half-Open - Trying...');
});

breaker.on('close', () => {
  console.log('Circuit Closed - Back to normal');
});

// Fallback 설정
breaker.fallback((reservationId, amount) => {
  // 대체 로직: 예매는 PENDING, 나중에 결제
  return {
    status: 'payment_delayed',
    message: '결제는 5분 내 완료해주세요.',
    reservationId,
    retryUrl: `/payments/retry/${reservationId}`
  };
});

// 사용
async function processPayment(reservationId, amount) {
  try {
    const result = await breaker.fire(reservationId, amount);
    return result;
  } catch (error) {
    if (error.code === 'EOPENBREAKER') {
      // Circuit Open 상태 → Fallback 실행됨
      return error.fallbackValue;
    }
    throw error;
  }
}
```

---

## 🎯 실행 우선순위

### 즉시 시작해야 할 작업 (Week 1-2)

```bash
# 1. AWS 계정 설정
aws configure --profile tiketi-prod

# 2. Terraform 프로젝트 구조 생성
mkdir -p infrastructure/terraform/{vpc,ecs,rds,elasticache,alb}

# 3. VPC 생성
cd infrastructure/terraform/vpc
terraform init
terraform apply

# 4. CI/CD 파이프라인 구축
# GitHub Actions 워크플로우 작성
mkdir -p .github/workflows
# deploy-event-service.yml, deploy-queue-service.yml 등 작성

# 5. 모니터링 대시보드 생성
# CloudWatch Dashboard, Grafana 설정
```

### 단계별 검증 체크리스트

#### **Phase 1 완료 기준:**
- [ ] RDS Aurora Writer/Reader 정상 동작
- [ ] ElastiCache Redis Cluster 연결 성공
- [ ] ALB Health Check 통과
- [ ] ECS Fargate Task 실행 성공

#### **Phase 2 완료 기준:**
- [ ] Auth Service 독립 배포
- [ ] JWT 토큰 발급/검증 정상
- [ ] API Gateway 라우팅 동작
- [ ] Load Test 100 req/s 통과

#### **Phase 5 완료 기준 (가장 중요):**
- [ ] Reservation Service 독립 동작
- [ ] Saga Pattern 성공/실패 시나리오 검증
- [ ] 동시성 테스트 (1만 TPS) 통과
- [ ] 에러율 < 0.1%

---

## 📊 성능 목표

### SLA (Service Level Agreement)

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| **가용성** | 99.99% (월 4분 다운타임) | CloudWatch Uptime |
| **응답시간** | p50 < 100ms, p99 < 500ms | ALB Target Response Time |
| **에러율** | < 0.1% | 5xx errors / total requests |
| **처리량** | 피크 10,000 TPS | CloudWatch Request Count |

### 부하 테스트 시나리오

```bash
# Artillery로 부하 테스트
artillery run load-test.yml

# load-test.yml
config:
  target: "https://api.tiketi.gg"
  phases:
    - duration: 60
      arrivalRate: 10      # Warm-up
    - duration: 300
      arrivalRate: 1000    # 1000 req/s
    - duration: 300
      arrivalRate: 5000    # 5000 req/s (피크)
    - duration: 60
      arrivalRate: 10      # Cool-down

  scenarios:
    - name: "이벤트 조회"
      weight: 60
      flow:
        - get:
            url: "/api/v1/events"

    - name: "예매 생성"
      weight: 30
      flow:
        - post:
            url: "/api/v1/reservations"
            json:
              eventId: "{{eventId}}"
              seatIds: ["{{seatId}}"]

    - name: "대기열 진입"
      weight: 10
      flow:
        - post:
            url: "/api/v1/queue/join/{{eventId}}"
```

---

## 🚨 주의사항 및 트러블슈팅

### 1. 데이터 일관성 문제

**증상:** 예매 생성 후 이벤트 조회 시 재고가 반영 안 됨

**원인:** Event Service가 캐시된 데이터 반환

**해결:**
```javascript
// Reservation Service: 예매 생성 후
await redis.del(`event:${eventId}`);  // 캐시 무효화
await publishEvent('TicketSoldOut', { eventId });  // Event Service에 알림

// Event Service: 이벤트 구독
messageQueue.subscribe('TicketSoldOut', async ({ eventId }) => {
  await redis.del(`event:${eventId}`);  // 캐시 삭제
  await redis.del(`events:all:*`);  // 목록 캐시도 삭제
});
```

---

### 2. Circuit Breaker 오작동

**증상:** 결제 API가 정상인데도 Circuit Open

**원인:** 타임아웃 설정이 너무 짧음 (1초)

**해결:**
```javascript
const breaker = new CircuitBreaker(paymentAPI, {
  timeout: 5000,  // 1초 → 5초로 증가
  errorThresholdPercentage: 70,  // 50% → 70%로 완화
  volumeThreshold: 20  // 10 → 20 (더 많은 샘플 수집)
});
```

---

### 3. Database Connection Pool 고갈

**증상:** `Error: remaining connection slots are reserved`

**원인:** EC2 인스턴스 증가 시 총 커넥션 수 초과

**해결:**
```javascript
// 각 EC2당 커넥션 수 계산
// Aurora max_connections = 5000
// EC2 인스턴스 수 = 50
// 인스턴스당 max = 5000 / 50 = 100

const pool = new Pool({
  max: 100,  // 200 → 100으로 감소
  // ...
});

// 또는 Aurora Auto Scaling으로 Writer/Reader 증가
```

---

## 📚 참고 자료

### 실제 티켓팅 사이트 아키텍처

1. **인터파크 티켓**
   - AWS re:Invent 2019 발표
   - 100만 동시 접속 처리
   - ECS + Aurora + ElastiCache

2. **멜론티켓**
   - Kafka 기반 Event Sourcing
   - CQRS 패턴
   - Elasticsearch 검색

3. **티켓링크**
   - Kubernetes (EKS)
   - Istio Service Mesh
   - gRPC 내부 통신

### AWS 문서

- [ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [Aurora Performance](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.BestPractices.html)
- [ElastiCache Redis Best Practices](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/BestPractices.html)

### MSA 패턴

- [Microservices.io](https://microservices.io/patterns/)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)

---

## ✅ 체크리스트: 마이그레이션 준비도

### 기술적 준비

- [ ] Docker 컨테이너화 완료
- [ ] 환경 변수 분리 (Secrets Manager)
- [ ] 로그 구조화 (JSON 포맷)
- [ ] Health Check 엔드포인트 구현
- [ ] Graceful Shutdown 처리
- [ ] Connection Pool 설정
- [ ] 에러 처리 중앙화
- [ ] Prometheus 메트릭 추가

### 인프라 준비

- [ ] AWS 계정 생성
- [ ] VPC 설계 완료
- [ ] Security Group 정의
- [ ] IAM Role/Policy 설정
- [ ] Terraform 코드 작성
- [ ] CI/CD 파이프라인 구축

### 팀 준비

- [ ] DevOps 엔지니어 확보
- [ ] AWS 교육 이수
- [ ] Terraform 학습
- [ ] 비상 대응 계획 수립
- [ ] 롤백 절차 문서화

---

## 🎉 결론

이 가이드는 TIKETI 프로젝트를 **12-15주 내에 MSA 아키텍처로 전환**하는 실행 가능한 로드맵을 제공합니다.

### 핵심 성공 요인

1. **점진적 전환 (Strangler Fig)**: 한 번에 전체를 바꾸지 않고 서비스별로 점진적으로 마이그레이션
2. **충분한 테스트**: 각 Phase마다 부하 테스트 및 검증
3. **모니터링 우선**: 문제를 빠르게 감지하고 대응
4. **팀 역량**: DevOps, MSA 패턴 학습 투자

### 예상 결과

```
마이그레이션 전:
- 가용성: 99.9%
- 피크 처리량: 5,000 TPS (한계)
- 배포 시간: 5분 (전체 재시작)
- 월 비용: $1,200

마이그레이션 후:
- 가용성: 99.99% ✅
- 피크 처리량: 50,000 TPS ✅
- 배포 시간: 30초 (서비스별) ✅
- 월 비용: $8,000 (하지만 처리량 10배) ✅
```

**ROI:** 3-4개월 내 투자 회수 가능

---

**문의 및 지원:**
- 상세 가이드: `MSA-Migration-Part1/2/3.md` 참조
- 코드 예시: `services/*/` 디렉토리
- Terraform: `infrastructure/terraform/` 디렉토리

**Good Luck! 🚀**