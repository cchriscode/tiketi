# Tiketi K8s MSA 아키텍처 다이어그램 (Mermaid)

## 📐 목차
1. [전체 시스템 아키텍처](#전체-시스템-아키텍처)
2. [마이크로서비스 아키텍처](#마이크로서비스-아키텍처)
3. [K8s 클러스터 아키텍처](#k8s-클러스터-아키텍처)
4. [서비스별 상세 아키텍처](#서비스별-상세-아키텍처)
5. [데이터 플로우](#데이터-플로우)
6. [배포 아키텍처](#배포-아키텍처)
7. [모니터링 아키텍처](#모니터링-아키텍처)

---

## 🌐 전체 시스템 아키텍처

### High-Level Architecture

```mermaid
graph TB
    Internet([Internet])

    Internet --> Route53[Route 53<br/>DNS: tiketi.gg]
    Internet --> CloudFront[CloudFront<br/>CDN]
    Internet --> ExtAPI[External APIs<br/>- Google OAuth<br/>- Toss Payment]

    CloudFront --> S3[S3 Bucket<br/>Static Files]

    Route53 --> ALB

    subgraph VPC["AWS VPC (10.0.0.0/16)"]
        subgraph PublicSubnet["Public Subnet (10.0.1.0/24)"]
            ALB[Application Load Balancer<br/>- SSL/TLS Termination<br/>- Health Checks<br/>- Sticky Sessions]
        end

        subgraph PrivateSubnet["Private Subnet (10.0.10.0/24)"]
            subgraph EKS["EKS Cluster (tiketi-prod)"]
                subgraph Microservices["Microservices (Pods)"]
                    UserSvc[User Service × 3]
                    EventSvc[Event Service × 3]
                    ReservSvc[Reservation Svc × 3]
                    PaymentSvc[Payment Service × 3]
                    QueueSvc[Queue Service × 2]
                    AnalyticsSvc[Analytics Svc × 2]
                    AdminSvc[Admin Service × 2]
                    MediaSvc[Media Service × 2]
                end

                subgraph DataLayer["Data Layer"]
                    PostgreSQL[("PostgreSQL<br/>(StatefulSet)<br/>- users_db<br/>- events_db<br/>- reservations_db<br/>- payments_db<br/>- analytics_db")]

                    Redis[("Redis Cluster<br/>- Session Cache<br/>- Distributed Lock<br/>- Queue<br/>- Real-time Counter")]
                end

                subgraph SystemServices["System Services"]
                    Prometheus[Prometheus<br/>Monitoring]
                    Grafana[Grafana<br/>Visualization]
                    Loki[Loki<br/>Logging]
                    Jaeger[Jaeger<br/>Tracing]
                end
            end
        end
    end

    ALB --> Microservices
    Microservices --> DataLayer

    style Internet fill:#e1f5ff
    style VPC fill:#fff4e6
    style EKS fill:#f0f0f0
    style DataLayer fill:#e8f5e9
    style SystemServices fill:#fce4ec
```

---

## 🎨 마이크로서비스 아키텍처

### Service Mesh Architecture

```mermaid
graph TB
    Client[Client Applications]

    Client --> APIGateway[API Gateway Ingress<br/>- Rate Limiting<br/>- Authentication<br/>- Request Routing]

    APIGateway --> UserService
    APIGateway --> EventService
    APIGateway --> ReservationService

    subgraph UserService["User Service"]
        U_API[REST API]
        U_BL[Business Logic]
        U_DA[Data Access]
        U_DB[("users_db")]

        U_API --> U_BL --> U_DA --> U_DB
    end

    subgraph EventService["Event Service"]
        E_API[REST API]
        E_BL[Business Logic]
        E_DA[Data Access]
        E_DB[("events_db")]

        E_API --> E_BL --> E_DA --> E_DB
    end

    subgraph ReservationService["Reservation Service"]
        R_API[REST API]
        R_BL[Business Logic]
        R_DA[Data Access]
        R_DB[("reserv_db")]

        R_API --> R_BL --> R_DA --> R_DB
    end

    UserService -.-> MQ
    EventService -.-> MQ
    ReservationService -.-> MQ

    MQ[Message Queue<br/>RabbitMQ<br/>Event Publish/Subscribe]

    MQ --> PaymentService
    MQ --> AnalyticsService
    MQ --> QueueService

    subgraph PaymentService["Payment Service"]
        P_API["- Toss API<br/>- Refund<br/>- Webhook"]
        P_DB[("payments_db")]
        P_API --> P_DB
    end

    subgraph AnalyticsService["Analytics Service (NEW)"]
        A_API["- Traffic Stats<br/>- Revenue Stats<br/>- Dashboard Data"]
        A_DB[("analytics_db<br/>(TimescaleDB)")]
        A_API --> A_DB
    end

    subgraph QueueService["Queue Service"]
        Q_API["- Socket.IO<br/>- WebSocket<br/>- Real-time Queue"]
    end

    AdminService[Admin Service<br/>- Dashboard<br/>- Stats Query]
    MediaService[Media Service<br/>- S3 Upload<br/>- Image Optimize]

    style APIGateway fill:#e3f2fd
    style MQ fill:#fff3e0
    style UserService fill:#e8f5e9
    style EventService fill:#e8f5e9
    style ReservationService fill:#e8f5e9
    style PaymentService fill:#fce4ec
    style AnalyticsService fill:#f3e5f5
    style QueueService fill:#e0f2f1
```

### Service Communication - Reservation Flow Example

```mermaid
sequenceDiagram
    participant Client
    participant APIGateway as API Gateway
    participant ReservSvc as Reservation Service
    participant EventSvc as Event Service
    participant Redis
    participant PostgreSQL as PostgreSQL
    participant MQ as Message Queue
    participant Analytics as Analytics Service
    participant Payment as Payment Service
    participant Toss as Toss Payments

    Client->>APIGateway: 1. POST /api/reservations
    APIGateway->>ReservSvc: 2. Route to Reservation Service

    ReservSvc->>EventSvc: 3. GET /api/events/:id (Internal)
    EventSvc-->>ReservSvc: 4. Event Info

    ReservSvc->>Redis: 5. Acquire Lock
    Redis-->>ReservSvc: 6. Lock Acquired

    ReservSvc->>PostgreSQL: 7. Create Reservation (DB)
    PostgreSQL-->>ReservSvc: 8. Reservation Created

    ReservSvc->>MQ: 9. Publish Event: reservation.created
    MQ->>Analytics: 10. Subscribe
    Analytics->>Analytics: 11. Update Stats

    ReservSvc->>Payment: 12. Request Payment
    Payment->>Toss: 13. Call Toss API
    Toss-->>Payment: 14. Payment URL
    Payment-->>ReservSvc: 15. Payment URL

    ReservSvc-->>Client: 16. Redirect to Payment
    Client->>Toss: Open Toss Payment Page
```

---

## ☸️ K8s 클러스터 아키텍처

### Cluster Topology

```mermaid
graph TB
    ControlPlane[Control Plane Managed<br/>- API Server<br/>- etcd<br/>- Controller Manager<br/>- Scheduler]

    ControlPlane --> NodeGroup1
    ControlPlane --> NodeGroup2
    ControlPlane --> NodeGroup3
    ControlPlane --> NodeGroup4

    subgraph NodeGroup1["Node Group 1 - Application<br/>t3.medium × 3"]
        Node1[Node 1<br/>User Svc<br/>Event Svc<br/>Reserv Svc]
        Node2[Node 2<br/>Payment Svc<br/>Analytics Svc]
        Node3[Node 3<br/>Admin Svc<br/>Media Svc]
    end

    subgraph NodeGroup2["Node Group 2 - Stateful<br/>t3.small × 2"]
        Node4[Node 4<br/>Queue Service<br/>Pod 1]
        Node5[Node 5<br/>Queue Service<br/>Pod 2]
    end

    subgraph NodeGroup3["Node Group 3 - Data<br/>t3.medium × 2"]
        Node6[Node 6<br/>PostgreSQL<br/>StatefulSet<br/>Redis Cluster]
        Node7[Node 7<br/>PostgreSQL<br/>Replica]
    end

    subgraph NodeGroup4["Node Group 4 - System<br/>t3.small × 2"]
        Node8[Node 8<br/>Prometheus<br/>Loki<br/>NGINX Ingress]
        Node9[Node 9<br/>Grafana<br/>Jaeger<br/>RabbitMQ]
    end

    style ControlPlane fill:#e3f2fd
    style NodeGroup1 fill:#e8f5e9
    style NodeGroup2 fill:#fff3e0
    style NodeGroup3 fill:#fce4ec
    style NodeGroup4 fill:#f3e5f5
```

### Namespace Isolation

```mermaid
graph TB
    subgraph Cluster["K8s Cluster"]
        subgraph NS_Prod["tiketi-production<br/>Production Services"]
            P_User[user-service]
            P_Event[event-service]
            P_Reservation[reservation-service]
            P_Payment[payment-service]
            P_Queue[queue-service]
            P_Analytics[analytics-service]
            P_Admin[admin-service]
            P_Media[media-service]
        end

        subgraph NS_Data["tiketi-data<br/>Data Layer"]
            D_Postgres[postgres-statefulset]
            D_Redis[redis-cluster]
            D_RabbitMQ[rabbitmq]
        end

        subgraph NS_Monitoring["tiketi-monitoring<br/>Observability"]
            M_Prometheus[prometheus]
            M_Grafana[grafana]
            M_Loki[loki]
            M_Jaeger[jaeger]
        end

        subgraph NS_System["tiketi-system<br/>System Services"]
            S_Ingress[ingress-nginx]
            S_Cert[cert-manager]
            S_DNS[external-dns]
        end

        subgraph NS_Staging["tiketi-staging<br/>Staging Environment"]
            ST_Services[All services<br/>same as production]
        end
    end

    style NS_Prod fill:#e8f5e9
    style NS_Data fill:#fce4ec
    style NS_Monitoring fill:#f3e5f5
    style NS_System fill:#fff3e0
    style NS_Staging fill:#e1f5ff
```

---

## 🔍 서비스별 상세 아키텍처

### Payment Service Architecture

```mermaid
graph TB
    Client[Client]

    Client -->|1. POST /api/payments/toss/request| PaymentService

    subgraph PaymentService["Payment Service (Pod)"]
        subgraph API_Layer["API Layer"]
            API_Request[POST /request]
            API_Confirm[POST /confirm]
        end

        subgraph BL["Business Logic Layer"]
            BL_Validate[Validate Reservation]
            BL_Create[Create Payment Request]
            BL_Callback[Handle Toss Callback]
            BL_Update[Update Payment Status]
            BL_Refund[Trigger Refund]
        end

        subgraph Integration["Integration Layer"]
            Toss_SDK[Toss SDK Client]
            Webhook[Webhook Handler]
        end

        subgraph DA["Data Access Layer"]
            DA_Payments[payments table]
            DA_Refunds[refunds table]
        end

        API_Layer --> BL
        BL --> Integration
        Integration --> DA
    end

    DA --> PaymentsDB[("payments_db")]
    DA --> Redis_Session[("Redis<br/>Session")]
    DA --> RabbitMQ_Event[("RabbitMQ<br/>Event Publish")]

    Integration --> TossAPI[Toss Payments API]
    RabbitMQ_Event --> ReservationSvc[Reservation Svc<br/>Confirm/Cancel]
    RabbitMQ_Event --> AnalyticsSvc[Analytics Svc<br/>Revenue Stats]

    style PaymentService fill:#fce4ec
    style API_Layer fill:#e3f2fd
    style BL fill:#e8f5e9
    style Integration fill:#fff3e0
    style DA fill:#f3e5f5
```

### Payment Flow Sequence

```mermaid
sequenceDiagram
    participant Client
    participant Payment as Payment Service
    participant Toss as Toss API
    participant Reserv as Reservation Svc

    Client->>Payment: 1. Request Payment
    Payment->>Reserv: 2. Validate Reservation
    Reserv-->>Payment: 3. Reservation OK

    Payment->>Payment: 4. Create Payment (Save to DB)

    Payment->>Toss: 5. Get Payment URL
    Toss-->>Payment: 6. Payment URL

    Payment-->>Client: 7. Return Payment URL

    Client->>Toss: 8. Redirect to Toss
    Client->>Toss: 9. User Pays

    Toss-->>Client: 10. Redirect to Success URL

    Client->>Payment: 11. Confirm Payment
    Payment->>Toss: 12. Approve Payment
    Toss-->>Payment: 13. Approved

    Payment->>Payment: 14. Update Payment Status
    Payment->>Reserv: 15. Confirm Reservation

    Payment-->>Client: 16. Payment Success
```

### Analytics Service Architecture

```mermaid
graph TB
    subgraph Collection["Data Collection Layer"]
        ClientEvents[Client Events]
        ServiceEvents[Services Events]
        MessageQueue[Message Queue]
    end

    Collection --> TrackAPI[POST /api/analytics/track]

    subgraph AnalyticsService["Analytics Service (Pod)"]
        subgraph Ingestion["Ingestion Layer"]
            I_Validate[Event Validation]
            I_RateLimit[Rate Limiting]
            I_Enrich[Data Enrichment]
        end

        subgraph Processing["Processing Layer"]
            P_Realtime[Real-time Counter<br/>Redis Incr]
            P_Batch[Batch Processing<br/>Cron Jobs<br/>- Hourly Agg<br/>- Daily Agg<br/>- Monthly Agg]
        end

        subgraph Storage["Storage Layer"]
            S_EventStore[Event Store<br/>Raw Events]
            S_Aggregated[Aggregated Data]
        end

        subgraph QueryAPI["Query API Layer"]
            Q_Traffic[GET /api/analytics/artist/:id/traffic]
            Q_Daily[GET /api/analytics/revenue/daily]
            Q_Monthly[GET /api/analytics/revenue/monthly]
            Q_Dashboard[GET /api/analytics/dashboard]
        end

        TrackAPI --> Ingestion
        Ingestion --> Processing
        Processing --> Storage
        Storage --> QueryAPI
    end

    P_Realtime --> Redis_Counter[("Redis<br/>Counter")]
    Storage --> AnalyticsDB[("analytics_db<br/>(TimescaleDB)")]

    style Collection fill:#e1f5ff
    style AnalyticsService fill:#f3e5f5
    style Ingestion fill:#e3f2fd
    style Processing fill:#e8f5e9
    style Storage fill:#fff3e0
    style QueryAPI fill:#fce4ec
```

### Data Aggregation Pipeline

```mermaid
sequenceDiagram
    participant Stream as Event Stream
    participant Redis as Redis Counter
    participant Cron as Cron Job
    participant PG as PostgreSQL

    Note over Stream,Redis: Real-time Events
    Stream->>Redis: page_view event
    Redis->>Redis: INCR artist:123:views:20251205

    Stream->>Redis: payment_completed
    Redis->>Redis: INCR revenue:20251205:total
    Redis->>Redis: INCR revenue:20251205:count

    Note over Cron,PG: Every Hour
    Cron->>Redis: 1. Fetch Counters
    Redis-->>Cron: 2. Counter Values

    Cron->>PG: 3. INSERT INTO hourly_stats
    PG-->>PG: Store aggregated data

    Cron->>Redis: 4. Delete Old Counters
```

---

## 🔄 데이터 플로우

### Complete Ticket Reservation Flow

```mermaid
sequenceDiagram
    participant Client
    participant Event as Event Service
    participant Reserv as Reservation Service
    participant Redis
    participant DB as PostgreSQL
    participant Payment as Payment Service
    participant Toss
    participant MQ as RabbitMQ
    participant Analytics
    participant Email

    Note over Client,Event: Step 1: Browse Events
    Client->>Event: GET /api/events
    Event->>DB: SELECT * FROM events
    DB-->>Event: event list
    Event-->>Client: Return event list

    Note over Client,Reserv: Step 2: Select Seats
    Client->>Reserv: GET /api/seats/event/:eventId
    Reserv->>Redis: GET cached_seats:event_123
    alt Cache miss
        Reserv->>DB: Query reservations_db
    end
    Reserv-->>Client: Return available seats

    Note over Client,Reserv: Step 3: Reserve Seats
    Client->>Reserv: POST /api/reservations<br/>{eventId, seatIds, userId}

    Reserv->>Event: Validate Event
    Event-->>Reserv: event details

    Reserv->>Redis: SET lock:seat:A-12 EX 300
    Redis-->>Reserv: OK (lock acquired)

    Reserv->>DB: Check Seat Availability
    DB-->>Reserv: status = 'available'

    Reserv->>DB: INSERT INTO reservations<br/>status='PENDING'
    DB-->>Reserv: reservation_id = 789

    Reserv->>DB: UPDATE seats<br/>status='reserved'
    Reserv->>Redis: SET timeout:reservation:789 EX 300

    Reserv-->>Client: {reservationId: 789, expiresAt}

    Note over Client,Toss: Step 4: Payment
    Client->>Payment: POST /api/payments/toss/request
    Payment->>Reserv: Validate Reservation
    Payment->>DB: INSERT INTO payments
    Payment->>Toss: POST /v1/payments
    Toss-->>Payment: paymentUrl
    Payment-->>Client: {paymentUrl, orderId}

    Client->>Toss: Redirect to Toss Payment Page
    Toss->>Client: User Completes Payment
    Client->>Payment: POST /api/payments/toss/confirm

    Payment->>Toss: POST /v1/payments/confirm
    Toss-->>Payment: approved

    Payment->>DB: UPDATE payments<br/>status='COMPLETED'
    Payment->>MQ: Publish 'payment.completed'

    par Event Processing
        MQ->>Reserv: Subscribe
        Reserv->>DB: Confirm Reservation
    and
        MQ->>Analytics: Subscribe
        Analytics->>DB: Update Stats
    and
        MQ->>Email: Subscribe
        Email->>Email: Send Email
    end

    Payment-->>Client: Payment Success

    Note over Client,Email: Final State:<br/>- Reservation: CONFIRMED<br/>- Payment: COMPLETED<br/>- Ticket: ISSUED
```

---

## 🚀 배포 아키텍처

### CI/CD Pipeline

```mermaid
graph TB
    Dev[Developer]
    Dev -->|git push| GitHub

    subgraph GitHub["GitHub Repository<br/>tiketi-msa"]
        Repo[services/<br/>- user-service/<br/>- event-service/<br/>- payment-service/]
        Workflows[.github/workflows/<br/>- deploy-user-service.yml<br/>- deploy-event-service.yml]
    end

    GitHub -->|Webhook Trigger| Actions

    subgraph Actions["GitHub Actions Runner"]
        Job1[Job 1: Build & Test<br/>- Checkout code<br/>- Setup Node.js<br/>- npm install<br/>- npm test<br/>- npm run lint]

        Job2[Job 2: Build Docker Image<br/>- docker build<br/>- docker tag]

        Job3[Job 3: Push to ECR<br/>- aws ecr login<br/>- docker push]

        Job4[Job 4: Update K8s<br/>- kubectl set image<br/>- kubectl rollout status]

        Job1 --> Job2 --> Job3 --> Job4
    end

    Job3 --> ECR[Amazon ECR<br/>Container Repo]
    Job4 --> EKS

    subgraph EKS["EKS Cluster"]
        Deployment[Deployment: user-service<br/>- Rolling Update<br/>- Max Surge: 1<br/>- Max Unavailable: 0]

        subgraph OldPods["Old Pods: v1.0.0"]
            Old1[v1]
            Old2[v1]
            Old3[v1]
        end

        subgraph NewPods["New Pods: v1.0.1"]
            New1[v2]
            New2[v2]
            New3[v2]
        end

        Deployment --> NewPods
    end

    style Dev fill:#e3f2fd
    style GitHub fill:#f3e5f5
    style Actions fill:#e8f5e9
    style ECR fill:#fff3e0
    style EKS fill:#fce4ec
    style NewPods fill:#c8e6c9
```

### Deployment Strategies

```mermaid
graph TB
    subgraph Strategy1["Strategy 1: Rolling Update (Default)"]
        R1[Zero Downtime]
        R2[Gradual rollout 25% at a time]
        R3[Automatic rollback on failure]
    end

    subgraph Strategy2["Strategy 2: Blue/Green (Critical Services)"]
        B1[Two identical environments]
        B2[Instant switch]
        B3[Easy rollback]
    end

    subgraph Strategy3["Strategy 3: Canary (High Risk)"]
        C1[10% traffic to new version]
        C2[Monitor metrics]
        C3[Gradual increase<br/>10% → 50% → 100%]
    end

    style Strategy1 fill:#e8f5e9
    style Strategy2 fill:#e3f2fd
    style Strategy3 fill:#fff3e0
```

### Multi-Environment Architecture

```mermaid
graph LR
    subgraph Dev["Development Environment"]
        D1[Local Docker Compose<br/>localhost:3000 frontend<br/>localhost:3001 backend<br/>PostgreSQL local<br/>Redis local]
    end

    subgraph Staging["Staging Environment K8s"]
        S1[EKS: tiketi-staging<br/>Namespace: tiketi-staging<br/>Domain: staging.tiketi.gg<br/>2 × t3.small spot<br/>RDS db.t3.micro<br/>Redis t3.micro × 1<br/>Cost: ~$150/month]
    end

    subgraph Prod["Production Environment K8s"]
        P1[EKS: tiketi-prod<br/>Namespace: tiketi-production<br/>Domain: api.tiketi.gg<br/>Node Pools:<br/>- App: 3 × t3.medium<br/>- Stateful: 2 × t3.small<br/>- Data: 2 × t3.medium<br/>RDS db.t3.medium Multi-AZ<br/>Redis t3.micro × 3<br/>Cost: ~$580/month]
    end

    Dev -->|Deploy| Staging
    Staging -->|Promote| Prod

    style Dev fill:#e3f2fd
    style Staging fill:#fff3e0
    style Prod fill:#c8e6c9
```

---

## 📊 모니터링 아키텍처

### Observability Stack

```mermaid
graph TB
    Services[Services<br/>All Pods]

    Services -->|Metrics| Prometheus
    Services -->|Logs| Loki
    Services -->|Traces| Jaeger

    subgraph Prometheus_Stack["Prometheus"]
        P1[- Scrape /metrics<br/>- Alerting]
    end

    subgraph Loki_Stack["Loki"]
        L1[- Log Aggregation<br/>- Query]
    end

    subgraph Jaeger_Stack["Jaeger"]
        J1[- Distributed Tracing<br/>- Span Data]
    end

    Prometheus --> Grafana
    Loki --> Grafana
    Jaeger --> Grafana

    subgraph Grafana_Stack["Grafana"]
        G1[- Dashboards<br/>- Alerts<br/>- Metrics Viz<br/>- Log Explorer<br/>- Trace View]
    end

    style Prometheus_Stack fill:#e3f2fd
    style Loki_Stack fill:#fff3e0
    style Jaeger_Stack fill:#f3e5f5
    style Grafana_Stack fill:#c8e6c9
```

### Monitoring Dashboard Example

```mermaid
graph TB
    subgraph Dashboard["Key Metrics Dashboard"]
        subgraph ServiceHealth["Service Health"]
            SH1["user-service: 🟢 99.95% | 245 RPS | 145ms P95 | 0.1% Error"]
            SH2["event-service: 🟢 99.98% | 523 RPS | 98ms P95 | 0.0% Error"]
            SH3["reservation-svc: 🟡 99.85% | 412 RPS | 256ms P95 | 0.3% Error"]
            SH4["payment-service: 🟢 99.99% | 189 RPS | 432ms P95 | 0.0% Error"]
        end

        subgraph ResourceUsage["Resource Usage"]
            RU1["user-service: CPU 45% | Memory 65% | Pods 3/10 | Normal"]
            RU2["event-service: CPU 38% | Memory 52% | Pods 3/10 | Normal"]
            RU3["reservation-svc: CPU 72% | Memory 78% | Pods 5/10 | Scaling Up"]
            RU4["payment-service: CPU 51% | Memory 61% | Pods 3/10 | Normal"]
        end

        subgraph Database["Database Metrics"]
            DB1["users_db: CPU 35% | Memory 68% | Conn 45/100 | QPS 1,234"]
            DB2["events_db: CPU 42% | Memory 71% | Conn 52/100 | QPS 2,456"]
            DB3["reservations_db: CPU 68% | Memory 82% | Conn 78/100 | QPS 3,789"]
            DB4["redis-cluster: CPU 25% | Memory 45% | Conn 234 | QPS 12,456"]
        end
    end

    style ServiceHealth fill:#e8f5e9
    style ResourceUsage fill:#fff3e0
    style Database fill:#fce4ec
    style SH3 fill:#fff9c4
```

---

**작성일**: 2025-12-11
**버전**: 1.0 (Mermaid)
**변환**: ASCII → Mermaid Diagrams
**작성자**: Claude
