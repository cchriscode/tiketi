# TIKETI MSA + Kubernetes 마이그레이션 가이드 (Part 1)
## 개요 및 현재 아키텍처 문제점 분석

---

## 📋 목차

1. [현재 아키텍처 분석](#1-현재-아키텍처-분석)
2. [단일 EC2 아키텍처의 한계](#2-단일-ec2-아키텍처의-한계)
3. [수십만 동시 접속 시나리오 분석](#3-수십만-동시-접속-시나리오-분석)
4. [MSA + Kubernetes가 필요한 이유](#4-msa--kubernetes가-필요한-이유)
5. [목표 아키텍처 개요](#5-목표-아키텍처-개요)

---

## 1. 현재 아키텍처 분석

### 1.1 현재 배포 구조

```
┌─────────────────────────────────────────────────────────┐
│                     단일 EC2 Instance                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Frontend   │  │   Backend    │  │  PostgreSQL  │  │
│  │   (React)    │  │  (Node.js)   │  │              │  │
│  │   Port 3000  │  │  Port 3001   │  │   Port 5432  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │  DragonflyDB │  │  Monitoring  │                     │
│  │   (Redis)    │  │   Stack      │                     │
│  │   Port 6379  │  │ Grafana/Loki │                     │
│  └──────────────┘  └──────────────┘                     │
│                                                           │
│  Instance Type: t3.medium or t3.large                    │
│  vCPU: 2-4, Memory: 4-8GB                               │
└─────────────────────────────────────────────────────────┘
```

**특징:**
- 모든 서비스가 하나의 EC2 인스턴스에서 실행
- Docker Compose로 컨테이너 오케스트레이션
- 수직 확장(Scale-up)만 가능
- 단일 장애점(Single Point of Failure)

---

## 2. 단일 EC2 아키텍처의 한계

### 2.1 성능 병목 현상 시뮬레이션

#### 시나리오 1: 인기 아티스트 티켓 오픈 (10,000명 동시 접속)

```javascript
// 현재 시스템 리소스 소비 계산

총 메모리 사용량:
- Node.js Backend: 512MB (기본) + 50MB/1000 connections
  → 10,000 connections = 512MB + 500MB = 1,012MB
- PostgreSQL: 1GB (shared_buffers 256MB + 작업 메모리)
- Redis/DragonflyDB: 512MB
- Monitoring Stack: 512MB
- Frontend (Nginx): 100MB
─────────────────────────────────────────────────────
총 예상 메모리: 3.1GB

vCPU 사용량:
- WebSocket 연결 처리: ~60% CPU
- Database 쿼리 처리: ~30% CPU
- Redis 캐시 처리: ~10% CPU
─────────────────────────────────────────────────────
총 예상 CPU: 100% (포화 상태)
```

**결과:**
- ⚠️ **메모리 부족**: t3.medium(4GB)에서는 OOM(Out of Memory) 발생
- ⚠️ **CPU 포화**: 응답 시간 급격히 증가 (100ms → 5초+)
- ⚠️ **연결 거부**: WebSocket 연결 실패 (max connections 초과)

---

#### 시나리오 2: 대형 이벤트 (100,000명 동시 접속)

```
t3.xlarge (4 vCPU, 16GB)로 업그레이드해도:

┌─────────────────────────────────────────────────────┐
│ 문제 1: PostgreSQL Connection Pool 고갈             │
├─────────────────────────────────────────────────────┤
│ 현재 설정: max 20 connections                        │
│ 필요 연결: 100,000 requests / 1초 = 100,000 qps     │
│                                                      │
│ 결과: Connection timeout 대량 발생                   │
│       "remaining connection slots are reserved"     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 문제 2: WebSocket 연결 한계                         │
├─────────────────────────────────────────────────────┤
│ 단일 Node.js 프로세스 한계: ~10,000 connections    │
│ 실제 안정 운영: ~5,000 connections                  │
│                                                      │
│ 100,000명 접속 시:                                  │
│ - 95,000명 연결 실패                                │
│ - Socket.IO handshake timeout                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 문제 3: 큐 시스템 과부하                            │
├─────────────────────────────────────────────────────┤
│ 현재: 1초마다 50명 처리 (queueManager)              │
│ 100,000명 대기열 → 2,000초 = 33분 대기             │
│                                                      │
│ 사용자 이탈률 95% 예상                              │
└─────────────────────────────────────────────────────┘
```

---

### 2.2 실제 장애 시나리오 (Troubleshooting Case Study)

#### Case 1: 메모리 부족으로 인한 서비스 다운

```bash
# 실제 발생 가능한 로그
[2024-12-02 14:23:45] ERROR: FATAL: out of memory
[2024-12-02 14:23:45] PostgreSQL process killed by OOM killer
[2024-12-02 14:23:46] Backend: Error: connect ECONNREFUSED 127.0.0.1:5432
[2024-12-02 14:23:46] All services DOWN - Instance restarting
```

**영향:**
- 전체 서비스 중단 (Frontend + Backend + DB 모두 다운)
- 진행 중인 모든 예약 트랜잭션 손실
- 복구 시간: 5-10분 (DB 재시작 + 데이터 정합성 체크)
- **매출 손실**: 10분 × 1,000명/분 = 10,000건 예약 손실

**왜 이런 일이 발생하는가?**
```
단일 EC2에서 모든 서비스가 메모리를 공유
→ PostgreSQL이 대량 쿼리 처리 중 메모리 사용 급증
→ OS가 OOM Killer 실행 (가장 메모리 많이 쓰는 프로세스 강제 종료)
→ PostgreSQL 종료 → Backend 연결 실패
→ 전체 서비스 중단
```

**MSA 환경이라면?**
```
각 서비스가 별도 Pod에서 실행 (메모리 격리)
→ Database만 별도 RDS에서 실행 (완전 격리)
→ DB 과부하 발생해도 Backend는 계속 실행
→ Circuit Breaker가 DB 연결 실패 감지
→ 사용자에게 "잠시 후 다시 시도" 메시지 표시
→ 나머지 서비스는 정상 운영
```

---

#### Case 2: CPU 포화로 인한 응답 지연

```javascript
// 부하 테스트 결과 (k6로 시뮬레이션)

동시 사용자: 5,000명
┌─────────────────────────────────────────────┐
│ Metric          │ Current │ Acceptable      │
├─────────────────────────────────────────────┤
│ Response Time   │ 8.5s    │ < 500ms        │
│ Error Rate      │ 23%     │ < 1%           │
│ CPU Usage       │ 98%     │ < 70%          │
│ Memory Usage    │ 87%     │ < 80%          │
└─────────────────────────────────────────────┘

주요 지연 구간:
- WebSocket handshake: 2.3s (정상: 50ms)
- Database query: 4.1s (정상: 100ms)
- Redis lock acquire: 1.8s (정상: 10ms)
- API response: 0.3s (정상: 50ms)
```

**사용자 경험:**
- 좌석 선택 후 8초 뒤에 "이미 선택된 좌석" 메시지
- 결제 완료 후 30초 뒤에 확인 페이지 로딩
- 대기열 위치 업데이트 10초 지연 → 사용자 혼란

**왜 이렇게 느려지는가?**
```
CPU 4코어에서 모든 작업 처리
→ WebSocket 이벤트 처리 (2코어)
→ HTTP API 요청 처리 (1코어)
→ Database 쿼리 처리 (0.5코어)
→ Redis 캐시 처리 (0.5코어)
→ CPU 스케줄링 오버헤드 증가
→ Context switching 비용 급증
→ 모든 작업이 순차 대기
```

**MSA + Kubernetes라면?**
```
각 서비스가 독립적으로 Auto Scaling
→ Queue Service: 10 Pods (CPU 최적화)
→ Ticket Service: 20 Pods (메모리 최적화)
→ Payment Service: 5 Pods (네트워크 최적화)
→ 병렬 처리로 응답 시간 100ms 이하 유지
```

---

### 2.3 확장성 문제

#### 수평 확장(Scale-out) 불가능

```
현재: 단일 EC2 인스턴스
↓
부하 증가 시 선택지:
1. 인스턴스 타입 업그레이드 (t3.medium → t3.xlarge)
   - 서비스 중단 필요 (5-10분 다운타임)
   - 비용 4배 증가
   - 여전히 한계 존재 (t3.2xlarge가 최대)

2. 다중 인스턴스 배포 시도
   - ❌ WebSocket sticky session 문제
   - ❌ Redis Pub/Sub 동기화 복잡도
   - ❌ Database 연결 분산 어려움
   - ❌ 파일 업로드 동기화 (S3 필수)
```

**실제 티켓팅 사이트(Ticketmaster, Interpark) 방식:**
```
마이크로서비스 아키텍처로 각 기능 독립 확장
┌────────────────────────────────────────────┐
│ User Service        → 10 instances         │
│ Event Service       → 5 instances          │
│ Queue Service       → 50 instances (피크타임) │
│ Ticket Service      → 30 instances         │
│ Payment Service     → 15 instances         │
│ Notification Service→ 5 instances          │
└────────────────────────────────────────────┘

총 115 instances가 독립적으로 확장
→ 부하에 따라 자동으로 증감
→ 서비스 중단 없이 배포 가능
```

---

## 3. 수십만 동시 접속 시나리오 분석

### 3.1 실제 트래픽 패턴 (BTS 콘서트 티켓 오픈 시뮬레이션)

```
티켓 오픈 시각: 2024-12-15 20:00:00

시간대별 접속자 수:
19:50:00  →    5,000명 (대기 중)
19:55:00  →   50,000명 (새로고침 반복)
19:59:30  →  150,000명 (초당 10,000명 증가)
20:00:00  →  300,000명 (피크)
20:00:30  →  280,000명 (일부 이탈)
20:05:00  →  200,000명 (구매 진행 중)
20:30:00  →   50,000명 (마감 임박)
```

### 3.2 현재 시스템에서의 처리 능력

```javascript
// 단일 EC2 (t3.2xlarge - 8 vCPU, 32GB)의 한계

최대 처리 가능 동시 접속:
- WebSocket connections: 10,000명
- HTTP requests: 5,000 req/sec
- Database transactions: 500 tps

300,000명 접속 시:
- 290,000명 연결 실패
- 서버 즉시 다운 (OOM + CPU overload)
- 복구 불가능 (재시작해도 즉시 다운)

┌──────────────────────────────────────────┐
│         시스템 붕괴 메커니즘              │
├──────────────────────────────────────────┤
│ 1. 20:00:00 - 300,000명 접속 시도        │
│ 2. 0.5초 - TCP SYN flood (포트 고갈)     │
│ 3. 1초 - Node.js event loop 블록         │
│ 4. 2초 - PostgreSQL max connections 초과 │
│ 5. 3초 - Redis memory full               │
│ 6. 4초 - OOM Killer 실행                 │
│ 7. 5초 - 전체 서비스 다운                │
└──────────────────────────────────────────┘
```

---

### 3.3 필요한 인프라 규모 계산

#### 리소스 요구사항 계산식

```python
# 300,000 동시 접속자 처리 계산

# 1. WebSocket 서버
websocket_connections_per_pod = 5000  # 안정적 운영 기준
websocket_pods = 300000 / 5000 = 60 pods

# 2. API 서버
api_requests_per_sec = 300000 * 0.1  # 10%가 동시 API 호출
api_capacity_per_pod = 500  # req/sec
api_pods = 30000 / 500 = 60 pods

# 3. Queue 처리 서버
queue_size = 300000 * 0.8  # 80%가 대기열 진입
processing_rate_per_pod = 100  # users/sec
queue_pods = (240000 / 100) / 60 = 40 pods (1분 내 처리 목표)

# 4. Database
database_tps = 5000  # 초당 트랜잭션
db_instances = RDS r6g.4xlarge (16 vCPU, 128GB)
read_replicas = 3  # 읽기 부하 분산

# 5. Redis/Cache
cache_memory = 300000 * 10KB  # 세션당 10KB
cache_required = 3GB
cache_instances = ElastiCache r6g.large (2 replicas)
```

**총 리소스:**
- Kubernetes Nodes: 30개 (m6i.2xlarge - 8 vCPU, 32GB)
- Total Pods: 200개 (모든 서비스 합산)
- RDS: 1 primary + 3 read replicas
- ElastiCache: 1 cluster (3 nodes)

**비용 비교:**
```
단일 EC2 방식 (불가능):
- t3.2xlarge × 1 = $0.33/hour
- 실제 처리 가능: 10,000명
- 처리 비율: 3.3%

MSA + Kubernetes 방식:
- EKS Cluster + EC2 Nodes = $50/hour (피크 타임)
- Auto Scaling으로 평시 $10/hour
- 실제 처리 가능: 300,000명
- 처리 비율: 100%

→ 비용은 15배이지만, 처리량은 30배
→ 사용자 1명당 비용은 1/2로 감소
```

---

## 4. MSA + Kubernetes가 필요한 이유

### 4.1 Monolith vs MSA 비교

| 항목 | 현재 (Monolith) | MSA + Kubernetes |
|------|----------------|------------------|
| **배포** | 전체 서비스 재시작 필요 | 개별 서비스만 배포 |
| **확장성** | 수직 확장만 가능 | 서비스별 독립 확장 |
| **장애 격리** | 하나의 버그가 전체 다운 | 장애 서비스만 영향 |
| **기술 스택** | 전체 동일해야 함 | 서비스별 최적 기술 선택 |
| **개발 속도** | 코드베이스 커질수록 느림 | 팀별 독립 개발 |
| **모니터링** | 전체 시스템 단위 | 서비스별 세분화 모니터링 |
| **비용** | 고정 비용 (과잉 프로비저닝) | 사용량 기반 Auto Scaling |

### 4.2 실제 트러블슈팅 케이스로 보는 MSA 필요성

#### Case Study 1: Payment 서비스 버그

**Monolith 환경:**
```javascript
// backend/src/routes/payments.js에 버그 발생
app.post('/api/payments/process', async (req, res) => {
  // 버그: 무한 루프
  while(true) {
    await processPayment();
  }
});

결과:
1. Payment API 호출 시 CPU 100% 점유
2. Event Loop 블록 → 모든 API 응답 중단
3. Queue 시스템도 멈춤 (같은 프로세스)
4. WebSocket 연결 끊김
5. 전체 서비스 다운

복구:
- 전체 서비스 재시작 필요
- 다운타임: 10분
- 영향 받은 사용자: 100%
```

**MSA 환경:**
```yaml
# Payment Service만 격리되어 실행
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
spec:
  replicas: 5
  resources:
    limits:
      cpu: 500m  # CPU 제한
      memory: 512Mi

결과:
1. Payment Service의 한 Pod만 CPU 100% 도달
2. Kubernetes가 자동으로 해당 Pod 재시작
3. 나머지 4개 Pod는 정상 동작
4. 다른 서비스 (Queue, Ticket)는 영향 없음
5. Circuit Breaker가 Payment 실패 감지
6. 사용자에게 "결제 일시 중단" 알림

복구:
- 자동 복구 (30초 이내)
- 영향 받은 사용자: 20% (1/5 Pod)
- 나머지 80%는 정상 이용
```

---

#### Case Study 2: Database 슬로우 쿼리

**Monolith 환경:**
```sql
-- 잘못된 쿼리 (인덱스 없음)
SELECT * FROM reservations
WHERE created_at > '2024-01-01'
ORDER BY created_at DESC;

-- 100만 건 스캔 → 30초 소요

결과:
1. PostgreSQL connection pool 고갈 (20개 전부 점유)
2. 모든 API가 "connection timeout" 에러
3. Queue 시스템도 DB 연결 불가
4. 사용자는 아무 작업도 못함

해결:
- 수동으로 쿼리 kill
- Connection pool 재시작
- 다운타임: 5분
```

**MSA 환경:**
```
Admin Service만 슬로우 쿼리 실행
→ Admin Service의 connection pool만 영향
→ Ticket Service, Queue Service는 별도 pool 사용
→ 일반 사용자는 영향 없음

추가 대책:
- Read Replica로 분리 (Admin 전용 DB)
- Query timeout 설정 (10초)
- Circuit Breaker로 자동 차단
```

---

### 4.3 Kubernetes가 해결하는 문제

#### 1. 자동 복구 (Self-Healing)

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 5
```

**시나리오:**
```
1. Backend Pod가 메모리 부족으로 응답 없음
2. Liveness Probe 실패 (3회 연속)
3. Kubernetes가 자동으로 Pod 재시작
4. 새 Pod 생성 → Readiness Probe 통과
5. 트래픽 라우팅 (기존 Pod 제거)
6. 전체 소요 시간: 30초
7. 사용자 영향: 0% (다른 Pod가 처리)
```

#### 2. 자동 확장 (Auto Scaling)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: queue-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: queue-service
  minReplicas: 5
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: queue_length
      target:
        type: AverageValue
        averageValue: "1000"
```

**시나리오:**
```
19:50 - Queue 길이: 500 → Pods: 5개
19:55 - Queue 길이: 5,000 → Pods: 25개 (Auto Scale Up)
20:00 - Queue 길이: 50,000 → Pods: 50개
20:05 - Queue 길이: 10,000 → Pods: 50개 (유지)
20:30 - Queue 길이: 1,000 → Pods: 10개 (Scale Down)
21:00 - Queue 길이: 100 → Pods: 5개

비용 절감: 피크 타임 외 80% 비용 절감
```

#### 3. 무중단 배포 (Rolling Update)

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0  # 최소 가용성 보장
    maxSurge: 1        # 한 번에 1개씩 업데이트
```

**배포 과정:**
```
현재: Pod 1, 2, 3 (v1.0)
↓
1. Pod 4 생성 (v1.1) → Readiness Probe 대기
2. Pod 4 준비 완료 → 트래픽 받기 시작
3. Pod 1 종료 (v1.0)
4. Pod 5 생성 (v1.1) → 준비 완료
5. Pod 2 종료 (v1.0)
6. Pod 6 생성 (v1.1) → 준비 완료
7. Pod 3 종료 (v1.0)
8. 완료: Pod 4, 5, 6 (v1.1)

다운타임: 0초
```

---

## 5. 목표 아키텍처 개요

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Global Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Route 53     │→│ CloudFront   │→│   WAF        │          │
│  │ (DNS)        │  │ (CDN)        │  │ (DDoS 방어)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ AWS API Gateway / Application Load Balancer (ALB)        │  │
│  │ - Rate Limiting (10,000 req/sec per IP)                  │  │
│  │ - SSL Termination                                        │  │
│  │ - Path-based Routing (/api/events → Event Service)      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EKS Cluster (Kubernetes)                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ Queue        │ │ Ticket       │ │ Payment      │           │
│  │ Service      │ │ Service      │ │ Service      │           │
│  │ (50 Pods)    │ │ (30 Pods)    │ │ (15 Pods)    │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ Event        │ │ User         │ │ Notification │           │
│  │ Service      │ │ Service      │ │ Service      │           │
│  │ (10 Pods)    │ │ (10 Pods)    │ │ (5 Pods)     │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ RDS          │ │ ElastiCache  │ │ S3           │           │
│  │ PostgreSQL   │ │ Redis        │ │ (Images)     │           │
│  │ Multi-AZ     │ │ Cluster      │ │              │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐                             │
│  │ MSK          │ │ OpenSearch   │                             │
│  │ (Kafka)      │ │ (Logs/검색)   │                             │
│  └──────────────┘ └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 처리 능력 비교

| 지표 | 현재 (단일 EC2) | 목표 (MSA + K8s) | 개선율 |
|------|-----------------|------------------|--------|
| 동시 접속 | 10,000명 | 500,000명 | 50배 |
| API 처리량 | 1,000 req/s | 50,000 req/s | 50배 |
| DB 트랜잭션 | 500 tps | 10,000 tps | 20배 |
| 응답 시간 | 500ms (평균) | 100ms (p99) | 5배 |
| 가용성 | 95% (월 36시간 다운) | 99.95% (월 22분) | 263배 |
| 복구 시간 | 10분 (수동) | 30초 (자동) | 20배 |

---

## 다음 단계

이제 구체적인 서비스 분리 전략을 알아봅니다.

👉 **[Part 2: MSA 서비스 분리 전략으로 이동](./msa-migration-guide-02-service-decomposition.md)**

