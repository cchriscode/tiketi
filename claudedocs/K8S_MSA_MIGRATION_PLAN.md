# Tiketi K8s 기반 MSA 마이그레이션 계획서

## 📋 목차
1. [개요](#개요)
2. [현재 아키텍처 분석](#현재-아키텍처-분석)
3. [MSA 서비스 분리 전략](#msa-서비스-분리-전략)
4. [K8s 아키텍처 설계](#k8s-아키텍처-설계)
5. [새로운 기능 통합](#새로운-기능-통합)
6. [데이터베이스 전략](#데이터베이스-전략)
7. [마이그레이션 로드맵](#마이그레이션-로드맵)
8. [비용 분석](#비용-분석)
9. [기술 스택](#기술-스택)

---

## 🎯 개요

### 목표
Docker Compose 기반 모놀리식 아키텍처를 Kubernetes 기반 마이크로서비스 아키텍처(MSA)로 전환하고, 다음 3가지 신규 기능을 추가합니다:

1. **관리자 페이지 통계 기능**
   - 가수별 트래픽 그래프
   - 평균 매출 통계
   - 실시간 대시보드

2. **토스페이먼츠 연동**
   - 카드 결제
   - 간편 결제
   - 자동 환불

3. **구글 로그인 연동**
   - OAuth 2.0 인증
   - 소셜 회원가입

### 마이그레이션 기대 효과
- ✅ **확장성**: 서비스별 독립적 스케일링
- ✅ **안정성**: 장애 격리 및 서비스 복원력 향상
- ✅ **배포 속도**: 서비스별 독립 배포로 배포 주기 단축
- ✅ **유지보수성**: 서비스별 코드베이스 분리로 개발 생산성 향상
- ✅ **기술 다양성**: 서비스별 최적 기술 스택 선택 가능

---

## 🏗️ 현재 아키텍처 분석

### 현재 구조 (Docker Compose)

```
┌──────────────────────────────────────┐
│        Frontend (React)              │
│        Port: 3000                    │
└──────────────┬───────────────────────┘
               │ HTTP/WebSocket
┌──────────────▼───────────────────────┐
│     Backend (Node.js Monolith)       │
│     Port: 3001                       │
│                                      │
│  ┌─────────────────────────────┐   │
│  │ Routes:                      │   │
│  │ - /auth                      │   │
│  │ - /events                    │   │
│  │ - /reservations              │   │
│  │ - /seats                     │   │
│  │ - /tickets                   │   │
│  │ - /payments                  │   │
│  │ - /admin                     │   │
│  │ - /queue                     │   │
│  │ - /news                      │   │
│  │ - /image                     │   │
│  └─────────────────────────────┘   │
└──────────────┬───────────────────────┘
               │
       ┌───────┴────────┐
       │                │
   ┌───▼───┐      ┌────▼────┐
   │  PG   │      │  Redis  │
   │ 5432  │      │  6379   │
   └───────┘      └─────────┘
```

### 현재 서비스별 책임 분석

| 라우트 | 주요 기능 | 데이터베이스 테이블 | 외부 의존성 |
|--------|----------|-------------------|------------|
| `/auth` | 회원가입, 로그인, JWT 발급 | users | - |
| `/events` | 이벤트 CRUD, 검색 | events | S3 (이미지) |
| `/reservations` | 예약 생성/조회 | reservations | Redis (락) |
| `/seats` | 좌석 조회/관리 | seats | Redis (캐시) |
| `/tickets` | 티켓 발급/조회 | tickets | - |
| `/payments` | 결제 처리 | payments | - |
| `/admin` | 관리자 기능 | 모든 테이블 | - |
| `/queue` | 대기열 관리 | - | Redis, Socket.IO |
| `/news` | 뉴스 관리 | news | - |
| `/image` | 이미지 업로드 | - | S3 |

### 한계점
- ❌ **단일 배포 단위**: 모든 기능이 하나의 배포 패키지
- ❌ **스케일링 제약**: 전체 서비스를 함께 스케일링해야 함
- ❌ **기술 스택 고정**: 모든 기능이 동일한 Node.js/Express 스택
- ❌ **장애 전파**: 한 기능의 장애가 전체 시스템 영향
- ❌ **개발 병목**: 여러 팀이 동시 개발 시 충돌

---

## 🎨 MSA 서비스 분리 전략

### 서비스 분리 원칙

1. **비즈니스 도메인 기반 분리** (Domain-Driven Design)
2. **느슨한 결합** (Loose Coupling)
3. **높은 응집도** (High Cohesion)
4. **독립적 배포 가능** (Independently Deployable)
5. **데이터 소유권** (Database per Service)

### 마이크로서비스 구성

#### 1. **User Service** (사용자 인증)
```yaml
책임:
  - 회원가입, 로그인, 로그아웃
  - 구글 OAuth 로그인 (신규 기능)
  - JWT 토큰 발급/검증
  - 프로필 관리
  - 비밀번호 찾기/변경

데이터:
  - users 테이블
  - oauth_providers 테이블 (신규)

API 엔드포인트:
  - POST /api/users/register
  - POST /api/users/login
  - POST /api/users/google-login (신규)
  - GET /api/users/profile
  - PUT /api/users/profile

기술 스택:
  - Node.js + Express
  - PostgreSQL
  - Redis (세션 캐시)
  - Passport.js (OAuth)
```

#### 2. **Event Service** (이벤트 관리)
```yaml
책임:
  - 이벤트 CRUD
  - 이벤트 검색 (Full-Text Search)
  - 카테고리 관리
  - 이벤트 이미지 메타데이터 관리

데이터:
  - events 테이블
  - categories 테이블
  - event_images 테이블

API 엔드포인트:
  - GET /api/events
  - GET /api/events/:id
  - POST /api/events (admin)
  - PUT /api/events/:id (admin)
  - DELETE /api/events/:id (admin)
  - GET /api/events/search?q=keyword

기술 스택:
  - Node.js + Express
  - PostgreSQL (Full-Text Search)
  - Redis (검색 결과 캐시)
```

#### 3. **Reservation Service** (예약 관리)
```yaml
책임:
  - 예약 생성/조회/취소
  - 좌석 선택/잠금
  - 예약 타임아웃 관리
  - 티켓 발급

데이터:
  - reservations 테이블
  - tickets 테이블
  - seats 테이블

API 엔드포인트:
  - POST /api/reservations
  - GET /api/reservations/:id
  - GET /api/reservations/user/:userId
  - DELETE /api/reservations/:id
  - GET /api/seats/event/:eventId

기술 스택:
  - Node.js + Express
  - PostgreSQL
  - Redis (분산 락, 좌석 캐시)

외부 의존성:
  - Payment Service (결제 확인)
  - Event Service (이벤트 정보)
```

#### 4. **Payment Service** (결제)
```yaml
책임:
  - 토스페이먼츠 연동 (신규 기능)
  - 결제 요청/승인/취소
  - 자동 환불 처리
  - 결제 내역 관리
  - Webhook 처리

데이터:
  - payments 테이블
  - refunds 테이블

API 엔드포인트:
  - POST /api/payments/toss/request (신규)
  - POST /api/payments/toss/confirm (신규)
  - POST /api/payments/toss/webhook (신규)
  - POST /api/payments/:id/refund
  - GET /api/payments/:id

기술 스택:
  - Node.js + Express
  - PostgreSQL
  - Redis (결제 세션)
  - Toss Payments SDK

외부 의존성:
  - Toss Payments API
  - Reservation Service (예약 확인)
```

#### 5. **Queue Service** (대기열)
```yaml
책임:
  - 실시간 대기열 관리
  - WebSocket 연결 관리
  - 대기열 순서 할당
  - 입장 토큰 발급

데이터:
  - Redis Sorted Set (대기열)

API 엔드포인트:
  - WebSocket /queue
  - POST /api/queue/join
  - GET /api/queue/position

기술 스택:
  - Node.js
  - Socket.IO
  - Redis (대기열)

특징:
  - Stateful Service
  - Sticky Session 필요
```

#### 6. **Analytics Service** (통계/분석) - 신규
```yaml
책임:
  - 가수별 트래픽 분석 (신규 기능)
  - 매출 통계 (신규 기능)
  - 실시간 대시보드 데이터
  - 이벤트 로그 수집
  - 집계 데이터 생성

데이터:
  - analytics_events 테이블
  - daily_stats 테이블 (집계)
  - artist_traffic 테이블 (신규)
  - revenue_stats 테이블 (신규)

API 엔드포인트:
  - POST /api/analytics/track (이벤트 수집)
  - GET /api/analytics/artist/:artistId/traffic (신규)
  - GET /api/analytics/revenue/daily (신규)
  - GET /api/analytics/revenue/monthly (신규)
  - GET /api/analytics/dashboard (신규)

기술 스택:
  - Node.js + Express
  - PostgreSQL (시계열 데이터)
  - Redis (실시간 카운터)
  - ClickHouse or TimescaleDB (대안)

처리 방식:
  - 비동기 이벤트 수집 (Kafka/RabbitMQ)
  - 주기적 집계 (Cron Job)
```

#### 7. **Admin Service** (관리자)
```yaml
책임:
  - 관리자 대시보드
  - 시스템 설정
  - 뉴스/공지 관리
  - 통계 데이터 조회

데이터:
  - admin_users 테이블
  - news 테이블
  - system_config 테이블

API 엔드포인트:
  - GET /api/admin/dashboard
  - GET /api/admin/news
  - POST /api/admin/news
  - GET /api/admin/settings

기술 스택:
  - Node.js + Express
  - PostgreSQL

외부 의존성:
  - Analytics Service (통계 데이터)
  - 모든 서비스 (관리 권한)
```

#### 8. **Media Service** (미디어/파일)
```yaml
책임:
  - 이미지 업로드
  - 파일 저장 (S3)
  - 이미지 최적화 (WebP 변환)
  - CDN URL 생성

데이터:
  - media_files 테이블

API 엔드포인트:
  - POST /api/media/upload
  - GET /api/media/:id
  - DELETE /api/media/:id

기술 스택:
  - Node.js + Express
  - AWS S3
  - Sharp (이미지 처리)
```

### 서비스 간 통신 패턴

#### 동기 통신 (Synchronous)
- REST API (서비스간 직접 호출)
- API Gateway를 통한 라우팅

```
Client → API Gateway → Service
Service A → Service B (Internal)
```

#### 비동기 통신 (Asynchronous)
- 메시지 큐 (RabbitMQ/Kafka)
- 이벤트 기반 아키텍처

```
예약 완료 → 메시지 큐 → 결제 Service
결제 완료 → 메시지 큐 → Analytics Service
```

#### 주요 통신 흐름

**1. 예약 프로세스**
```
Client → API Gateway
       → Reservation Service
       → Event Service (이벤트 조회)
       → Reservation Service (좌석 잠금)
       → Payment Service (결제 요청)
       → Payment Service → Toss API
       → Payment Service (결제 확인)
       → Reservation Service (예약 완료)
       → [Message Queue] → Analytics Service (통계 수집)
```

**2. 구글 로그인 프로세스**
```
Client → API Gateway
       → User Service
       → Google OAuth API
       → User Service (토큰 발급)
       → Client
```

**3. 통계 조회 프로세스**
```
Admin Client → API Gateway
             → Admin Service
             → Analytics Service (통계 데이터)
             → Admin Service
             → Client
```

---

## ☸️ K8s 아키텍처 설계

### 클러스터 구성

#### 노드 그룹 전략

```yaml
노드 그룹 1: Application Nodes
  - 용도: 일반 서비스 (Stateless)
  - 인스턴스: t3.medium × 3
  - 배포: User, Event, Reservation, Payment, Admin, Media

노드 그룹 2: Stateful Nodes
  - 용도: Stateful 서비스
  - 인스턴스: t3.small × 2
  - 배포: Queue Service (Socket.IO)

노드 그룹 3: Data Nodes
  - 용도: 데이터 저장소
  - 인스턴스: t3.medium × 2
  - 배포: PostgreSQL, Redis

노드 그룹 4: System Nodes
  - 용도: 시스템 서비스
  - 인스턴스: t3.small × 2
  - 배포: Ingress Controller, Monitoring, Analytics
```

### 네임스페이스 구조

```yaml
# 네임스페이스 분리
namespaces:
  - tiketi-production      # 프로덕션 서비스
  - tiketi-staging         # 스테이징 환경
  - tiketi-data            # 데이터베이스/캐시
  - tiketi-system          # 시스템 서비스
  - tiketi-monitoring      # 모니터링 스택
```

### 서비스별 K8s 리소스

#### User Service
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: tiketi-production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
        version: v1
    spec:
      containers:
      - name: user-service
        image: tiketi/user-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: db-config
              key: postgres-host
        - name: GOOGLE_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: oauth-secrets
              key: google-client-id
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: tiketi-production
spec:
  selector:
    app: user-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service-hpa
  namespace: tiketi-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 2
  maxReplicas: 10
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
```

#### API Gateway (Ingress)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-ingress
  namespace: tiketi-production
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - api.tiketi.gg
    secretName: tiketi-tls
  rules:
  - host: api.tiketi.gg
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
      - path: /api/reservations
        pathType: Prefix
        backend:
          service:
            name: reservation-service
            port:
              number: 80
      - path: /api/payments
        pathType: Prefix
        backend:
          service:
            name: payment-service
            port:
              number: 80
      - path: /api/analytics
        pathType: Prefix
        backend:
          service:
            name: analytics-service
            port:
              number: 80
      - path: /api/admin
        pathType: Prefix
        backend:
          service:
            name: admin-service
            port:
              number: 80
      - path: /api/media
        pathType: Prefix
        backend:
          service:
            name: media-service
            port:
              number: 80
      - path: /queue
        pathType: Prefix
        backend:
          service:
            name: queue-service
            port:
              number: 80
```

### 데이터 저장소 배포

#### PostgreSQL (StatefulSet)
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: tiketi-data
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: gp3
      resources:
        requests:
          storage: 20Gi
```

#### Redis (StatefulSet with Cluster)
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: tiketi-data
spec:
  serviceName: redis
  replicas: 3
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        - containerPort: 16379
        command:
        - redis-server
        - --cluster-enabled yes
        - --cluster-config-file /data/nodes.conf
        - --appendonly yes
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
  volumeClaimTemplates:
  - metadata:
      name: redis-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: gp3
      resources:
        requests:
          storage: 5Gi
```

### ConfigMap & Secrets

#### ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: tiketi-production
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  CORS_ORIGIN: "https://tiketi.gg"
  POSTGRES_HOST: "postgres.tiketi-data.svc.cluster.local"
  REDIS_HOST: "redis.tiketi-data.svc.cluster.local"
  S3_BUCKET: "tiketi-media-prod"
  S3_REGION: "ap-northeast-2"
```

#### Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: tiketi-production
type: Opaque
stringData:
  JWT_SECRET: "your-jwt-secret-key"
  POSTGRES_PASSWORD: "your-db-password"
  REDIS_PASSWORD: "your-redis-password"
  TOSS_SECRET_KEY: "your-toss-secret-key"
  GOOGLE_CLIENT_ID: "your-google-client-id"
  GOOGLE_CLIENT_SECRET: "your-google-client-secret"
  AWS_ACCESS_KEY_ID: "your-aws-access-key"
  AWS_SECRET_ACCESS_KEY: "your-aws-secret-key"
```

---

## 🆕 새로운 기능 통합

### 1. 관리자 페이지 통계 기능

#### Analytics Service 상세 설계

**데이터 수집 방식**
```javascript
// 이벤트 트래킹 (비동기)
POST /api/analytics/track
{
  "eventType": "page_view",
  "artistId": "artist_123",
  "eventId": "event_456",
  "timestamp": "2025-12-05T10:30:00Z",
  "metadata": {
    "userAgent": "...",
    "ip": "..."
  }
}

// 실시간 카운터 (Redis)
INCR artist:artist_123:views:20251205
INCR event:event_456:views:20251205
```

**통계 API**
```javascript
// 가수별 트래픽
GET /api/analytics/artist/:artistId/traffic
Query Params:
  - startDate: 2025-12-01
  - endDate: 2025-12-31
  - granularity: daily | weekly | monthly

Response:
{
  "artistId": "artist_123",
  "artistName": "아이유",
  "period": {
    "start": "2025-12-01",
    "end": "2025-12-31"
  },
  "traffic": [
    {
      "date": "2025-12-01",
      "pageViews": 15234,
      "uniqueVisitors": 8921,
      "avgSessionDuration": 245
    },
    ...
  ],
  "total": {
    "pageViews": 452341,
    "uniqueVisitors": 89234
  }
}

// 평균 매출 통계
GET /api/analytics/revenue/stats
Query Params:
  - period: daily | weekly | monthly
  - artistId: (optional)

Response:
{
  "period": "monthly",
  "data": [
    {
      "month": "2025-12",
      "revenue": 45000000,
      "ticketsSold": 1234,
      "avgTicketPrice": 36450,
      "topArtist": {
        "id": "artist_123",
        "name": "아이유",
        "revenue": 25000000
      }
    },
    ...
  ],
  "summary": {
    "totalRevenue": 450000000,
    "avgMonthlyRevenue": 37500000,
    "growthRate": 15.3
  }
}
```

**대시보드 데이터 집계**
```javascript
// Cron Job (매 시간 실행)
async function aggregateHourlyStats() {
  // Redis에서 실시간 카운터 수집
  const views = await redis.get(`artist:*:views:${today}`);

  // PostgreSQL에 집계 저장
  await db.query(`
    INSERT INTO hourly_stats (timestamp, artist_id, page_views)
    VALUES ($1, $2, $3)
    ON CONFLICT (timestamp, artist_id)
    DO UPDATE SET page_views = EXCLUDED.page_views
  `);

  // Redis 카운터 정리
  await redis.del(`artist:*:views:${yesterday}`);
}
```

**Frontend 대시보드 컴포넌트**
```jsx
// Admin Dashboard - Analytics Tab
function AnalyticsDashboard() {
  const [trafficData, setTrafficData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);

  useEffect(() => {
    // 가수별 트래픽 차트
    fetchArtistTraffic();
    // 매출 통계 차트
    fetchRevenueStats();
  }, []);

  return (
    <div className="analytics-dashboard">
      <LineChart
        data={trafficData}
        title="가수별 트래픽"
        xAxis="date"
        yAxis="pageViews"
      />
      <BarChart
        data={revenueData}
        title="월별 매출"
        xAxis="month"
        yAxis="revenue"
      />
      <StatCards
        totalRevenue={revenueData.summary.totalRevenue}
        avgRevenue={revenueData.summary.avgMonthlyRevenue}
        growthRate={revenueData.summary.growthRate}
      />
    </div>
  );
}
```

### 2. 토스페이먼츠 연동

#### Payment Service 상세 설계

**토스페이먼츠 SDK 설정**
```javascript
// payment-service/src/config/toss.js
const TossPayments = require('@tosspayments/payment-sdk-node');

const tossPayments = new TossPayments({
  secretKey: process.env.TOSS_SECRET_KEY,
  clientKey: process.env.TOSS_CLIENT_KEY
});

module.exports = tossPayments;
```

**결제 요청 플로우**
```javascript
// POST /api/payments/toss/request
async function requestPayment(req, res) {
  const { reservationId, amount, customerName, customerEmail } = req.body;

  // 1. 예약 정보 확인 (Reservation Service 호출)
  const reservation = await reservationService.get(reservationId);

  // 2. 결제 요청 생성
  const paymentRequest = await db.query(`
    INSERT INTO payments (
      reservation_id,
      amount,
      status,
      provider
    ) VALUES ($1, $2, 'PENDING', 'TOSS')
    RETURNING *
  `, [reservationId, amount]);

  const orderId = `ORDER_${paymentRequest.id}_${Date.now()}`;

  // 3. 토스 결제 위젯 URL 생성
  const paymentUrl = tossPayments.createPaymentUrl({
    amount,
    orderId,
    orderName: `${reservation.eventName} 티켓`,
    customerName,
    customerEmail,
    successUrl: `https://api.tiketi.gg/api/payments/toss/success`,
    failUrl: `https://tiketi.gg/payment/fail`
  });

  return res.json({
    paymentId: paymentRequest.id,
    paymentUrl,
    orderId
  });
}

// POST /api/payments/toss/confirm
async function confirmPayment(req, res) {
  const { paymentKey, orderId, amount } = req.body;

  try {
    // 1. 토스 결제 승인 요청
    const result = await tossPayments.confirm({
      paymentKey,
      orderId,
      amount
    });

    // 2. 결제 상태 업데이트
    await db.query(`
      UPDATE payments
      SET status = 'COMPLETED',
          payment_key = $1,
          approved_at = NOW()
      WHERE order_id = $2
    `, [paymentKey, orderId]);

    // 3. 예약 확정 (Message Queue)
    await messageQueue.publish('reservation.confirmed', {
      reservationId: result.reservationId,
      paymentId: result.paymentId
    });

    // 4. 통계 업데이트 (Analytics Service)
    await messageQueue.publish('payment.completed', {
      amount,
      timestamp: new Date()
    });

    return res.json({
      success: true,
      paymentKey,
      approvedAt: result.approvedAt
    });

  } catch (error) {
    // 결제 실패 처리
    await db.query(`
      UPDATE payments
      SET status = 'FAILED',
          error_message = $1
      WHERE order_id = $2
    `, [error.message, orderId]);

    throw error;
  }
}

// POST /api/payments/toss/webhook
async function handleWebhook(req, res) {
  const { eventType, data } = req.body;

  switch (eventType) {
    case 'PAYMENT_CANCELED':
      await handlePaymentCanceled(data);
      break;
    case 'PAYMENT_FAILED':
      await handlePaymentFailed(data);
      break;
  }

  return res.json({ received: true });
}

// 자동 환불
async function refundPayment(paymentId, reason) {
  const payment = await db.query(`
    SELECT * FROM payments WHERE id = $1
  `, [paymentId]);

  // 토스 환불 API 호출
  const result = await tossPayments.cancel({
    paymentKey: payment.payment_key,
    cancelReason: reason
  });

  // 환불 기록 저장
  await db.query(`
    INSERT INTO refunds (
      payment_id,
      amount,
      reason,
      status,
      refunded_at
    ) VALUES ($1, $2, $3, 'COMPLETED', NOW())
  `, [paymentId, payment.amount, reason]);

  // 예약 취소 처리
  await messageQueue.publish('reservation.canceled', {
    reservationId: payment.reservation_id
  });
}
```

**Frontend 결제 플로우**
```jsx
// components/PaymentButton.jsx
import { loadTossPayments } from '@tosspayments/payment-sdk';

function PaymentButton({ reservation }) {
  const handlePayment = async () => {
    // 1. 결제 요청
    const { paymentUrl, orderId } = await fetch('/api/payments/toss/request', {
      method: 'POST',
      body: JSON.stringify({
        reservationId: reservation.id,
        amount: reservation.totalPrice,
        customerName: user.name,
        customerEmail: user.email
      })
    }).then(res => res.json());

    // 2. 토스 결제 위젯 리다이렉트
    window.location.href = paymentUrl;
  };

  return (
    <button onClick={handlePayment}>
      토스페이 결제하기
    </button>
  );
}

// pages/PaymentSuccess.jsx
function PaymentSuccess() {
  const { paymentKey, orderId, amount } = useQuery();

  useEffect(() => {
    // 결제 승인 요청
    confirmPayment();
  }, []);

  const confirmPayment = async () => {
    try {
      await fetch('/api/payments/toss/confirm', {
        method: 'POST',
        body: JSON.stringify({ paymentKey, orderId, amount })
      });

      // 예매 완료 페이지로 이동
      navigate('/reservations/complete');
    } catch (error) {
      alert('결제 승인 실패');
      navigate('/payment/fail');
    }
  };

  return <div>결제 처리 중...</div>;
}
```

### 3. 구글 로그인 연동

#### User Service OAuth 구현

**Passport.js Google Strategy**
```javascript
// user-service/src/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/users/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // 기존 사용자 확인
    let user = await db.query(`
      SELECT u.* FROM users u
      JOIN oauth_providers op ON u.id = op.user_id
      WHERE op.provider = 'google' AND op.provider_user_id = $1
    `, [profile.id]);

    if (!user) {
      // 신규 사용자 생성
      user = await db.query(`
        INSERT INTO users (email, name, email_verified)
        VALUES ($1, $2, true)
        RETURNING *
      `, [profile.emails[0].value, profile.displayName]);

      // OAuth 연결 정보 저장
      await db.query(`
        INSERT INTO oauth_providers (
          user_id,
          provider,
          provider_user_id,
          access_token
        ) VALUES ($1, 'google', $2, $3)
      `, [user.id, profile.id, accessToken]);
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));
```

**Google Login Routes**
```javascript
// user-service/src/routes/auth.js
const router = require('express').Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

// 구글 로그인 시작
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// 구글 콜백
router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    // JWT 토큰 발급
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 프론트엔드로 리다이렉트 (토큰 전달)
    res.redirect(`https://tiketi.gg/auth/callback?token=${token}`);
  }
);

// 토큰 검증
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});
```

**Database Schema**
```sql
-- OAuth 제공자 테이블
CREATE TABLE oauth_providers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'google', 'kakao', 'naver'
  provider_user_id VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

-- users 테이블에 컬럼 추가
ALTER TABLE users
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN profile_image VARCHAR(255);
```

**Frontend 구현**
```jsx
// components/GoogleLoginButton.jsx
function GoogleLoginButton() {
  const handleGoogleLogin = () => {
    // Google OAuth 플로우 시작
    window.location.href = 'https://api.tiketi.gg/api/users/google';
  };

  return (
    <button onClick={handleGoogleLogin} className="google-login-btn">
      <img src="/google-icon.svg" alt="Google" />
      Google로 계속하기
    </button>
  );
}

// pages/AuthCallback.jsx
function AuthCallback() {
  const { token } = useQuery();

  useEffect(() => {
    if (token) {
      // 토큰 저장
      localStorage.setItem('accessToken', token);

      // 사용자 정보 조회
      fetchUserProfile();

      // 메인 페이지로 이동
      navigate('/');
    }
  }, [token]);

  const fetchUserProfile = async () => {
    const response = await fetch('/api/users/verify', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const { user } = await response.json();
    setUser(user);
  };

  return <div>로그인 중...</div>;
}
```

---

## 🗄️ 데이터베이스 전략

### Database per Service 원칙

각 마이크로서비스는 자신의 데이터베이스를 소유합니다.

```
User Service      → users_db
Event Service     → events_db
Reservation Service → reservations_db
Payment Service   → payments_db
Analytics Service → analytics_db
Admin Service     → admin_db (shared, read-only)
```

### PostgreSQL 멀티 데이터베이스 구성

**Option 1: Single PostgreSQL Instance + Multiple Databases**
```yaml
PostgreSQL Instance (Single)
├── users_db
├── events_db
├── reservations_db
├── payments_db
└── analytics_db

장점:
  - 운영 복잡도 낮음
  - 비용 효율적
  - 백업/복구 간단

단점:
  - 리소스 격리 불완전
  - 확장성 제한
```

**Option 2: Multiple PostgreSQL Instances (권장)**
```yaml
PostgreSQL Instance 1 (Core)
├── users_db
└── events_db

PostgreSQL Instance 2 (Transactional)
├── reservations_db
└── payments_db

PostgreSQL Instance 3 (Analytics)
└── analytics_db (TimescaleDB)

장점:
  - 완전한 격리
  - 서비스별 최적화 가능
  - 확장성 우수

단점:
  - 비용 증가
  - 운영 복잡도 증가
```

### 데이터 일관성 전략

#### Saga Pattern (분산 트랜잭션)

**예약 프로세스 Saga**
```
1. Reservation Service: 예약 생성 (PENDING)
   ↓ (Success)
2. Payment Service: 결제 처리
   ↓ (Success)
3. Reservation Service: 예약 확정 (CONFIRMED)
   ↓ (Success)
4. Analytics Service: 통계 업데이트

만약 Step 2 실패 시 (Compensating Transaction):
   - Reservation Service: 예약 취소
   - 좌석 잠금 해제
```

**구현 예시**
```javascript
// saga-orchestrator.js
async function createReservationSaga(data) {
  const sagaState = {
    reservationId: null,
    paymentId: null,
    status: 'STARTED'
  };

  try {
    // Step 1: 예약 생성
    sagaState.reservationId = await reservationService.create(data);
    sagaState.status = 'RESERVATION_CREATED';

    // Step 2: 결제 처리
    sagaState.paymentId = await paymentService.process({
      reservationId: sagaState.reservationId,
      amount: data.amount
    });
    sagaState.status = 'PAYMENT_COMPLETED';

    // Step 3: 예약 확정
    await reservationService.confirm(sagaState.reservationId);
    sagaState.status = 'RESERVATION_CONFIRMED';

    // Step 4: 통계 업데이트 (비동기)
    await messageQueue.publish('reservation.completed', {
      reservationId: sagaState.reservationId,
      paymentId: sagaState.paymentId
    });

    sagaState.status = 'COMPLETED';
    return sagaState;

  } catch (error) {
    // Compensating Transactions
    await compensate(sagaState, error);
    throw error;
  }
}

async function compensate(sagaState, error) {
  console.error('Saga failed, compensating...', error);

  // Step 2 실패 시: 예약 취소
  if (sagaState.status === 'RESERVATION_CREATED') {
    await reservationService.cancel(sagaState.reservationId);
  }

  // Step 3 실패 시: 결제 환불
  if (sagaState.status === 'PAYMENT_COMPLETED') {
    await paymentService.refund(sagaState.paymentId);
    await reservationService.cancel(sagaState.reservationId);
  }
}
```

#### Event Sourcing (선택)

Analytics Service에서 이벤트 기반 데이터 수집:

```javascript
// analytics-service/src/services/event-store.js
async function storeEvent(event) {
  await db.query(`
    INSERT INTO event_store (
      event_type,
      aggregate_id,
      data,
      timestamp
    ) VALUES ($1, $2, $3, NOW())
  `, [event.type, event.aggregateId, JSON.stringify(event.data)]);

  // 실시간 집계
  await updateAggregates(event);
}

// 이벤트 재생으로 집계 재구성 가능
async function rebuildAggregates(startDate, endDate) {
  const events = await db.query(`
    SELECT * FROM event_store
    WHERE timestamp BETWEEN $1 AND $2
    ORDER BY timestamp ASC
  `, [startDate, endDate]);

  for (const event of events) {
    await updateAggregates(event);
  }
}
```

---

## 🚀 마이그레이션 로드맵

### Phase 1: 준비 (2주)

#### Week 1: 인프라 구축
- [x] EKS 클러스터 생성
  ```bash
  eksctl create cluster \
    --name tiketi-prod \
    --region ap-northeast-2 \
    --node-type t3.medium \
    --nodes 3 \
    --nodes-min 2 \
    --nodes-max 10
  ```
- [ ] 네임스페이스 생성
- [ ] Ingress Controller 설치 (NGINX)
- [ ] Cert-Manager 설치 (SSL 인증서)
- [ ] Monitoring Stack 설치 (Prometheus + Grafana)

#### Week 2: 데이터베이스 마이그레이션
- [ ] RDS PostgreSQL 인스턴스 생성
- [ ] 데이터베이스 스키마 분리
- [ ] 데이터 마이그레이션 스크립트 작성
- [ ] Redis Cluster 구성

### Phase 2: 서비스 분리 및 컨테이너화 (3주)

#### Week 3: Core Services
- [ ] User Service 분리
  - [ ] 코드 분리
  - [ ] Dockerfile 작성
  - [ ] K8s 매니페스트 작성
  - [ ] 배포 및 테스트
- [ ] Event Service 분리
- [ ] Reservation Service 분리

#### Week 4: Payment & Queue Services
- [ ] Payment Service 분리
  - [ ] 토스페이먼츠 SDK 통합
  - [ ] Webhook 엔드포인트 구현
- [ ] Queue Service 분리
  - [ ] StatefulSet 구성
  - [ ] Sticky Session 설정

#### Week 5: Analytics & Admin Services
- [ ] Analytics Service 개발 (신규)
  - [ ] 데이터 수집 파이프라인
  - [ ] 집계 로직 구현
  - [ ] API 개발
- [ ] Admin Service 분리
- [ ] Media Service 분리

### Phase 3: 새로운 기능 개발 (2주)

#### Week 6: OAuth & Analytics
- [ ] 구글 OAuth 구현
  - [ ] Passport.js 설정
  - [ ] Frontend 통합
- [ ] 통계 대시보드 개발
  - [ ] 가수별 트래픽 차트
  - [ ] 매출 통계 차트

#### Week 7: Payment Integration
- [ ] 토스페이먼츠 완전 통합
  - [ ] 결제 플로우 테스트
  - [ ] 자동 환불 로직
  - [ ] Webhook 핸들링

### Phase 4: 통합 테스트 및 최적화 (2주)

#### Week 8: E2E 테스트
- [ ] 전체 예약 플로우 테스트
- [ ] 부하 테스트 (k6)
- [ ] 장애 시나리오 테스트

#### Week 9: 성능 최적화
- [ ] API 응답 시간 최적화
- [ ] 데이터베이스 쿼리 최적화
- [ ] 캐싱 전략 개선
- [ ] HPA 튜닝

### Phase 5: 프로덕션 배포 (1주)

#### Week 10: 점진적 마이그레이션
- [ ] Blue/Green 배포 설정
- [ ] Canary 배포 (10% 트래픽)
- [ ] 모니터링 및 롤백 계획
- [ ] 100% 트래픽 전환

---

## 💰 비용 분석

### K8s 기반 MSA 월간 예상 비용

#### 컴퓨팅 리소스

| 리소스 | 스펙 | 수량 | 단가 | 월 비용 |
|--------|------|------|------|---------|
| **EKS Control Plane** | - | 1 | $73/월 | **$73** |
| **Worker Nodes (App)** | t3.medium | 3 | $30/월 | **$90** |
| **Worker Nodes (Stateful)** | t3.small | 2 | $15/월 | **$30** |
| **Worker Nodes (Data)** | t3.medium | 2 | $30/월 | **$60** |
| **Worker Nodes (System)** | t3.small | 2 | $15/월 | **$30** |
| **EBS Volumes (gp3)** | 20GB × 9 | 180GB | $0.08/GB | **$14** |
| **소계** | | | | **$297** |

#### 데이터베이스

| 서비스 | 스펙 | 비용 |
|--------|------|------|
| **RDS PostgreSQL (Primary)** | db.t3.medium, Multi-AZ | **$80** |
| **RDS PostgreSQL (Analytics)** | db.t3.small | **$40** |
| **ElastiCache Redis** | cache.t3.micro × 3 | **$30** |
| **소계** | | **$150** |

#### 네트워크 & 스토리지

| 서비스 | 비용 |
|--------|------|
| **ALB (Ingress)** | **$23** |
| **NAT Gateway** | **$35** |
| **CloudFront CDN** | **$5** |
| **S3 Storage (50GB)** | **$2** |
| **Route 53** | **$1** |
| **소계** | **$66** |

#### 모니터링 & 기타

| 서비스 | 비용 |
|--------|------|
| **CloudWatch Logs** | **$10** |
| **Secrets Manager** | **$2** |
| **ECR (Container Registry)** | **$3** |
| **예비비 (10%)** | **$53** |
| **소계** | **$68** |

### 총 월간 비용

| 카테고리 | 비용 |
|----------|------|
| 컴퓨팅 | $297 |
| 데이터베이스 | $150 |
| 네트워크 & 스토리지 | $66 |
| 모니터링 & 기타 | $68 |
| **총계** | **$581/월** |
| **원화 환산 (1,300원/달러)** | **₩755,300/월** |

### 비용 최적화 방안

#### 1. Reserved Instances (1년 약정)
- RDS: $120/월 → $80/월 (33% 절감)
- ElastiCache: $30/월 → $20/월 (33% 절감)
- **절감: $50/월**

#### 2. Savings Plans (3년 약정)
- EC2: $283/월 → $170/월 (40% 절감)
- **절감: $113/월**

#### 3. Spot Instances (개발/스테이징)
- 개발 환경을 Spot으로 전환
- **절감: $100/월**

#### 4. 최적화 후 총 비용
- 최적화 전: $581/월
- 최적화 후: $318/월
- **절감률: 45%**
- **원화: ₩413,400/월**

---

## 🛠️ 기술 스택

### 마이크로서비스 프레임워크
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js
- **Language**: JavaScript (TypeScript 선택 가능)

### 데이터 저장소
- **Primary DB**: PostgreSQL 15 (RDS)
- **Analytics DB**: TimescaleDB or ClickHouse (선택)
- **Cache**: Redis 7.0 (ElastiCache)
- **Object Storage**: AWS S3

### 컨테이너 & 오케스트레이션
- **Container Runtime**: Docker
- **Orchestration**: Kubernetes (EKS)
- **Service Mesh**: Istio (선택)
- **Ingress**: NGINX Ingress Controller

### 메시징 & 이벤트
- **Message Queue**: RabbitMQ or AWS SQS
- **Event Streaming**: Apache Kafka (대용량 시)

### 모니터링 & 로깅
- **Metrics**: Prometheus + Grafana
- **Logging**: Loki or ELK Stack
- **Tracing**: Jaeger or AWS X-Ray
- **APM**: New Relic or DataDog (선택)

### CI/CD
- **Source Control**: GitHub
- **CI/CD**: GitHub Actions
- **Container Registry**: Amazon ECR
- **GitOps**: ArgoCD or Flux (선택)

### 보안
- **Secrets Management**: AWS Secrets Manager
- **Certificate Management**: Cert-Manager (Let's Encrypt)
- **Authentication**: JWT + Passport.js
- **OAuth**: Google OAuth 2.0

### 개발 도구
- **API Documentation**: Swagger/OpenAPI
- **Load Testing**: k6 or Artillery
- **E2E Testing**: Cypress
- **Unit Testing**: Jest

### 외부 서비스
- **Payment**: Toss Payments
- **OAuth**: Google Identity Platform
- **Email**: SendGrid or AWS SES
- **SMS**: Twilio or AWS SNS (선택)

---

## 📊 성능 목표

### SLA (Service Level Agreement)

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| **가용성** | 99.9% (월 43분 다운타임) | Uptime monitoring |
| **응답 시간 (P95)** | < 200ms | APM tracing |
| **응답 시간 (P99)** | < 500ms | APM tracing |
| **처리량** | > 1000 RPS | Load testing |
| **에러율** | < 0.1% | Error tracking |

### 확장성 목표

- **동시 사용자**: 10,000명
- **피크 TPS**: 2,000 req/sec
- **데이터베이스**: 1백만 레코드 이상
- **Auto Scaling**: CPU 70% 기준

---

## ✅ 체크리스트

### 인프라
- [ ] EKS 클러스터 생성
- [ ] VPC & Subnet 구성
- [ ] RDS PostgreSQL 인스턴스
- [ ] ElastiCache Redis Cluster
- [ ] S3 Bucket
- [ ] CloudFront Distribution

### 서비스 개발
- [ ] User Service (+ Google OAuth)
- [ ] Event Service
- [ ] Reservation Service
- [ ] Payment Service (+ Toss Payments)
- [ ] Queue Service
- [ ] Analytics Service (신규)
- [ ] Admin Service
- [ ] Media Service

### 배포
- [ ] Dockerfile 작성
- [ ] K8s 매니페스트 작성
- [ ] CI/CD 파이프라인
- [ ] Monitoring 설정
- [ ] Logging 설정

### 테스트
- [ ] Unit Test
- [ ] Integration Test
- [ ] E2E Test
- [ ] Load Test
- [ ] Security Test

---

**작성일**: 2025-12-05
**버전**: 1.0
**작성자**: Claude
