# Tiketi MSA 로컬 아키텍처 다이어그램

## 📊 1. 로컬 Kubernetes 전체 아키텍처

```mermaid
graph TB
    subgraph "Local Machine"
        Browser["🌐 Browser<br/>(localhost:3000)"]
    end

    subgraph "Kind Cluster (tiketi-local)"
        subgraph "Frontend Namespace"
            Frontend["React Frontend<br/>Port: 3000"]
        end

        subgraph "Backend Namespace (tiketi)"
            subgraph "Microservices"
                Auth["🔐 Auth Service<br/>Port: 3001<br/>────────<br/>• 이메일 로그인<br/>• 구글 OAuth ✨<br/>• JWT 발급"]
                Event["📅 Event Service<br/>Port: 3002<br/>────────<br/>• 이벤트 조회<br/>• 공지사항<br/>• 이미지 업로드"]
                Queue["⏳ Queue Service<br/>Port: 3003<br/>────────<br/>• 대기열 관리<br/>• WebSocket<br/>• 실시간 알림"]
                Reservation["🎫 Reservation Service<br/>Port: 3004<br/>────────<br/>• 예매 처리<br/>• 좌석 관리<br/>• 분산 락"]
                Payment["💳 Payment Service ✨<br/>Port: 3005<br/>────────<br/>• 결제 처리<br/>• 포인트 충전<br/>• 포인트 사용"]
                Notification["🔔 Notification Service<br/>Port: 3006<br/>────────<br/>• 이메일 발송<br/>• 푸시 알림<br/>• SQS 소비"]
            end

            subgraph "Data Layer"
                Postgres[("🐘 PostgreSQL<br/>Port: 5432<br/>────────<br/>• users<br/>• events<br/>• reservations<br/>• payments<br/>• points ✨")]
                Redis[("🔴 Redis<br/>Port: 6379<br/>────────<br/>• 대기열 (Sorted Set)<br/>• 세션 (Socket.IO)<br/>• 분산 락")]
            end

            subgraph "Monitoring"
                Prometheus["📊 Prometheus<br/>Port: 9090"]
                Grafana["📈 Grafana<br/>Port: 3002"]
                Loki["📋 Loki<br/>Port: 3100"]
            end
        end
    end

    subgraph "External Services"
        Google["🔐 Google OAuth"]
        S3["☁️ AWS S3"]
        PG["💳 PG (토스페이먼츠)"]
        SES["📧 AWS SES"]
    end

    %% Frontend connections
    Browser --> Frontend
    Frontend --> Auth
    Frontend --> Event
    Frontend --> Queue
    Frontend --> Reservation
    Frontend --> Payment

    %% Service to Service
    Queue -.->|입장 허가 확인| Reservation
    Reservation -->|결제 요청| Payment
    Payment -.->|결제 완료| Reservation
    Reservation -->|알림 발행| Notification
    Payment -->|알림 발행| Notification

    %% Data Layer connections
    Auth --> Postgres
    Event --> Postgres
    Reservation --> Postgres
    Payment --> Postgres

    Queue --> Redis
    Reservation --> Redis
    Payment --> Redis

    %% External connections
    Auth -.->|OAuth| Google
    Event -.->|이미지| S3
    Payment -.->|결제| PG
    Notification -.->|이메일| SES

    %% Monitoring connections
    Auth -.-> Prometheus
    Event -.-> Prometheus
    Queue -.-> Prometheus
    Reservation -.-> Prometheus
    Payment -.-> Prometheus
    Notification -.-> Prometheus

    Prometheus --> Grafana
    Auth -.-> Loki
    Event -.-> Loki
    Queue -.-> Loki
    Reservation -.-> Loki
    Payment -.-> Loki
    Notification -.-> Loki
```

---

## 🔄 2. 서비스 간 통신 흐름 (예매 플로우)

```mermaid
sequenceDiagram
    actor User as 👤 사용자
    participant FE as React Frontend
    participant Auth as 🔐 Auth Service
    participant Queue as ⏳ Queue Service
    participant Rsv as 🎫 Reservation Service
    participant Pay as 💳 Payment Service
    participant Noti as 🔔 Notification Service
    participant Redis as 🔴 Redis
    participant DB as 🐘 PostgreSQL

    %% 1. 로그인
    User->>FE: 1. 로그인 요청
    FE->>Auth: POST /api/auth/login
    Auth->>DB: 사용자 인증
    DB-->>Auth: 사용자 정보
    Auth-->>FE: JWT 토큰
    FE-->>User: 로그인 성공

    %% 2. 대기열 진입
    User->>FE: 2. 이벤트 페이지 접속
    FE->>Queue: POST /api/queue/enter
    Queue->>Redis: ZADD queue event_id
    Redis-->>Queue: OK
    Queue-->>FE: 대기열 순번 1523

    Note over Queue,Redis: 1초마다 processQueue 실행

    Queue->>Redis: ZRANGE queue
    Redis-->>Queue: users list
    Queue->>FE: WebSocket 입장 가능
    FE-->>User: 입장 화면 표시

    %% 3. 좌석 선택
    User->>FE: 3. 좌석 선택
    FE->>Rsv: POST /api/reservations
    Rsv->>Redis: SET lock
    Redis-->>Rsv: OK
    Rsv->>DB: INSERT reservations PENDING
    DB-->>Rsv: reservation_id=456
    Rsv-->>FE: 예매 임시 생성
    FE-->>User: 결제 대기 화면

    %% 4. 포인트 사용 + 결제
    User->>FE: 4. 결제 진행
    FE->>Pay: POST /api/payments

    Pay->>DB: SELECT balance FROM points WHERE user_id=1
    DB-->>Pay: balance=25000

    alt 포인트 잔액 충분
        Pay->>DB: BEGIN TRANSACTION
        Pay->>DB: UPDATE points balance
        Pay->>DB: INSERT point_histories
        Pay->>DB: COMMIT

        Pay->>Pay: 외부 PG사 API 호출
        Pay->>DB: INSERT payments
        DB-->>Pay: payment_id=789

        Pay->>Rsv: payment_completed 이벤트
        Rsv->>DB: UPDATE reservations CONFIRMED
        Rsv->>Redis: DEL lock

        Pay-->>FE: 결제 성공
        FE-->>User: 예매 완료!

        Pay->>Noti: SQS 이벤트 발행
        Noti->>Noti: 이메일 발송
        Noti-->>User: 예매 완료 메일
    else 포인트 잔액 부족
        Pay-->>FE: 포인트 부족 에러
        FE-->>User: 포인트 충전 필요
    end
```

---

## 💰 3. 포인트 시스템 플로우

```mermaid
graph TB
    subgraph "포인트 충전 플로우"
        A1[포인트 충전 요청] --> B1[Payment Service]
        B1 --> C1{PG사 결제}
        C1 -->|성공| D1[points balance 증가]
        C1 -->|실패| E1[충전 실패]
        D1 --> F1[point_histories 기록]
        F1 --> G1[충전 성공]
    end

    subgraph "포인트 사용 플로우"
        A2[예매 + 포인트 사용] --> B2[Payment Service]
        B2 --> C2{포인트 잔액 확인}
        C2 -->|충분| D2[Transaction 시작]
        C2 -->|부족| E2[에러 응답]

        D2 --> F2[balance 차감]
        F2 --> G2[histories 기록]
        G2 --> H2{카드 결제}
        H2 -->|성공| I2[COMMIT]
        H2 -->|실패| J2[ROLLBACK]

        I2 --> K2[예매 확정]
        J2 --> L2[결제 실패]
    end

    subgraph "포인트 환불 플로우"
        A3[예매 취소] --> B3[Reservation Service]
        B3 --> C3[Payment 환불 요청]
        C3 --> D3[balance 증가]
        D3 --> E3[histories 기록]
        E3 --> F3[환불 완료]
    end
```

---

## 🔐 4. 구글 OAuth 로그인 플로우

```mermaid
sequenceDiagram
    actor User as 👤 사용자
    participant FE as React Frontend
    participant Google as 🔐 Google OAuth
    participant Auth as Auth Service
    participant DB as PostgreSQL

    User->>FE: 1. 구글 로그인 버튼 클릭
    FE->>Google: 2. OAuth 페이지 리다이렉트

    User->>Google: 3. 구글 계정 로그인
    User->>Google: 4. 권한 동의

    Google->>FE: 5. 콜백 리다이렉트

    FE->>Auth: 6. POST /api/auth/google

    Auth->>Google: 7. 토큰 교환 요청
    Google-->>Auth: 8. access_token 반환

    Auth->>Google: 9. 사용자 정보 조회
    Google-->>Auth: 10. email, name, picture

    Auth->>DB: 11. SELECT * FROM users WHERE email

    alt 신규 사용자
        Auth->>DB: 12a. INSERT INTO users
        DB-->>Auth: user_id=123
        Note over Auth,DB: 자동 회원가입
    else 기존 사용자
        DB-->>Auth: 12b. user_id=456
        Note over Auth,DB: 기존 계정 로그인
    end

    Auth->>Auth: 13. JWT 생성
    Auth-->>FE: 14. token 반환

    FE->>FE: 15. localStorage 저장
    FE-->>User: 16. 로그인 완료

    rect rgb(230, 245, 255)
        Note over User,DB: 구글 OAuth 2.0 안전 인증
    end
```

---

## 📅 5. MSA 마이그레이션 타임라인 (8주)

```mermaid
gantt
    title Tiketi MSA 마이그레이션 로드맵 (8주)
    dateFormat YYYY-MM-DD
    section Phase 0: 준비
    Kind 클러스터 생성           :p0-1, 2025-01-01, 2d
    Postgres & Redis 배포        :p0-2, after p0-1, 2d
    공통 라이브러리 분리           :p0-3, after p0-2, 3d

    section Phase 1: Auth Service
    코드 분리 및 구조 설계         :p1-1, 2025-01-08, 2d
    구글 OAuth 구현 ✨           :crit, p1-2, after p1-1, 3d
    K8s 배포 및 테스트            :p1-3, after p1-2, 2d

    section Phase 2: Event Service
    코드 분리                    :p2-1, 2025-01-15, 2d
    S3 이미지 업로드 구현         :p2-2, after p2-1, 2d
    K8s 배포 및 테스트            :p2-3, after p2-2, 3d

    section Phase 3: Payment Service ✨
    Payment Service 생성         :crit, p3-1, 2025-01-22, 2d
    포인트 DB 스키마 설계         :crit, p3-2, after p3-1, 1d
    포인트 충전 API 구현          :crit, p3-3, after p3-2, 3d
    포인트 사용 로직 구현         :crit, p3-4, after p3-3, 3d
    K8s 배포 및 통합 테스트        :p3-5, after p3-4, 2d

    section Phase 4: Queue Service
    코드 분리 (WebSocket)        :p4-1, 2025-02-01, 3d
    Redis Pub/Sub 설정           :p4-2, after p4-1, 2d
    K8s 배포 및 테스트            :p4-3, after p4-2, 2d

    section Phase 5: Reservation Service
    코드 분리                    :p5-1, 2025-02-08, 3d
    Payment Service 연동         :p5-2, after p5-1, 3d
    분산 락 구현                 :p5-3, after p5-2, 2d
    K8s 배포 및 통합 테스트        :p5-4, after p5-3, 3d

    section Phase 6: Notification Service
    Service 생성 및 SQS 연동      :p6-1, 2025-02-18, 4d
    이메일 발송 구현 (SES)        :p6-2, after p6-1, 3d

    section Phase 7: 개선사항
    Circuit Breaker 추가         :p7-1, 2025-02-25, 2d
    X-Ray 연동                  :p7-2, after p7-1, 2d
    Optimistic Locking 추가      :p7-3, after p7-2, 2d
    전체 통합 테스트              :p7-4, after p7-3, 1d
```

---

## 🏗️ 6. 로컬 개발 환경 구조

```mermaid
graph LR
    subgraph "Developer Machine"
        IDE["💻 VS Code<br/>────────<br/>• 서비스별 폴더<br/>• Git 브랜치 관리<br/>• 실시간 코드 수정"]
        Docker["🐳 Docker Desktop<br/>────────<br/>• Kind 클러스터 실행<br/>• 로컬 Registry<br/>• 이미지 빌드/푸시"]
        Kubectl["⚙️ Kubectl<br/>────────<br/>• 서비스 배포<br/>• 로그 확인<br/>• 디버깅"]
    end

    subgraph "Kind Cluster"
        subgraph "Control Plane Node"
            API["Kubernetes API Server"]
        end

        subgraph "Worker Node 1"
            Auth1["Auth Pod"]
            Event1["Event Pod"]
            Queue1["Queue Pod"]
        end

        subgraph "Worker Node 2"
            Rsv1["Reservation Pod"]
            Pay1["Payment Pod"]
            Noti1["Notification Pod"]
        end

        subgraph "Data Node"
            PG["PostgreSQL Pod"]
            RD["Redis Pod"]
        end
    end

    subgraph "Port Forwarding"
        P3001["localhost:3001 → Auth"]
        P3002["localhost:3002 → Event"]
        P3003["localhost:3003 → Queue"]
        P3004["localhost:3004 → Reservation"]
        P3005["localhost:3005 → Payment"]
        P3006["localhost:3006 → Notification"]
    end

    IDE --> Docker
    Docker --> API
    Kubectl --> API

    API --> Worker1
    API --> Worker2
    API --> DataNode

    Auth1 --> P3001
    Event1 --> P3002
    Queue1 --> P3003
    Rsv1 --> P3004
    Pay1 --> P3005
    Noti1 --> P3006

    style IDE fill:#E3F2FD,stroke:#1976D2,stroke-width:3px
    style Docker fill:#2496ED,stroke:#2496ED,stroke-width:3px,color:#fff
    style Kubectl fill:#326CE5,stroke:#326CE5,stroke-width:3px,color:#fff
    style API fill:#FF6B6B,stroke:#FF6B6B,stroke-width:3px,color:#fff
```

---

## 🔧 7. 서비스 배포 흐름

```mermaid
flowchart TD
    A[개발자: 코드 수정] --> B{로컬 테스트}
    B -->|성공| C[Docker 이미지 빌드]
    B -->|실패| A

    C --> D[로컬 Registry에 Push<br/>localhost:5000/service:v1]
    D --> E[Kubernetes Manifest 작성<br/>service.yaml]

    E --> F[kubectl apply -f service.yaml]
    F --> G{Pod 상태 확인}

    G -->|Running| H[서비스 테스트<br/>curl localhost:300X]
    G -->|Error| I[로그 확인<br/>kubectl logs pod-name]

    I --> J{문제 파악}
    J -->|코드 문제| A
    J -->|설정 문제| E

    H --> K{통합 테스트}
    K -->|성공| L[✅ 배포 완료]
    K -->|실패| M[디버깅]
    M --> A

    L --> N[Git Commit & Push]
    N --> O[Phase 완료 체크]

    style A fill:#E3F2FD,stroke:#1976D2,stroke-width:2px
    style C fill:#FFF3E0,stroke:#F57C00,stroke-width:2px
    style F fill:#E8F5E9,stroke:#43A047,stroke-width:2px
    style L fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
    style O fill:#FFD54F,stroke:#F9A825,stroke-width:3px
```

---

## 📊 8. 데이터베이스 구조 (MSA 관점)

```mermaid
erDiagram
    USERS ||--o{ RESERVATIONS : "makes"
    USERS ||--o{ PAYMENTS : "makes"
    USERS ||--o| POINTS : "has"
    USERS ||--o{ POINT_HISTORIES : "has"

    EVENTS ||--o{ RESERVATIONS : "has"
    EVENTS ||--o{ SEATS : "has"

    RESERVATIONS ||--|| PAYMENTS : "linked to"
    RESERVATIONS }o--|| SEATS : "reserves"

    PAYMENTS ||--o{ POINT_HISTORIES : "creates"

    USERS {
        int id PK
        string email
        string password "nullable (OAuth)"
        string name
        string provider "LOCAL/GOOGLE"
        string profile_image "nullable"
        timestamp created_at
    }

    POINTS {
        int id PK
        int user_id FK
        int balance "포인트 잔액"
        timestamp created_at
        timestamp updated_at
    }

    POINT_HISTORIES {
        int id PK
        int user_id FK
        string type "CHARGE/USE/REFUND"
        int amount "양수: 충전, 음수: 사용"
        int balance_after
        string reference_type "PAYMENT/RESERVATION"
        int reference_id
        string description
        timestamp created_at
    }

    EVENTS {
        int id PK
        string title
        timestamp event_date
        int capacity
        int price
    }

    RESERVATIONS {
        int id PK
        int user_id FK
        int event_id FK
        int seat_id FK
        string status "PENDING/CONFIRMED/CANCELLED"
        int version "Optimistic Lock"
        timestamp created_at
    }

    SEATS {
        int id PK
        int event_id FK
        string seat_number
        string status "AVAILABLE/RESERVED/LOCKED"
    }

    PAYMENTS {
        int id PK
        int user_id FK
        int reservation_id FK
        int amount
        string payment_method "CARD/POINT/MIXED"
        int point_used "0 if not used"
        int card_amount "0 if only points"
        string status "SUCCESS/FAILED/REFUNDED"
        timestamp created_at
    }
```

---

## 🎯 9. 마이그레이션 체크포인트

```mermaid
mindmap
  root((Tiketi MSA<br/>마이그레이션))
    Phase 0: 준비
      Kind 클러스터
      PostgreSQL
      Redis
      공통 라이브러리
    Phase 1: Auth
      이메일 로그인
      ::icon(fa fa-envelope)
      구글 OAuth ✨
      ::icon(fa fa-google)
      JWT 발급
    Phase 2: Event
      이벤트 조회
      공지사항
      S3 이미지 업로드
      ::icon(fa fa-cloud)
    Phase 3: Payment ✨
      결제 처리
      ::icon(fa fa-credit-card)
      포인트 충전
      ::icon(fa fa-coins)
      포인트 사용
      PG 연동
    Phase 4: Queue
      대기열 관리
      ::icon(fa fa-clock)
      WebSocket
      ::icon(fa fa-plug)
      Redis Pub/Sub
    Phase 5: Reservation
      예매 처리
      ::icon(fa fa-ticket)
      좌석 관리
      분산 락
      ::icon(fa fa-lock)
    Phase 6: Notification
      이메일 발송
      ::icon(fa fa-envelope)
      SQS 소비
      ::icon(fa fa-list)
    Phase 7: 개선
      Circuit Breaker
      ::icon(fa fa-shield-alt)
      X-Ray Tracing
      ::icon(fa fa-search)
      Optimistic Lock
      ::icon(fa fa-database)
```

---

## ✅ 마이그레이션 완료 기준

```mermaid
graph TD
    Start([마이그레이션 시작]) --> P0{Phase 0 완료?}
    P0 -->|Yes| P1{Phase 1 완료?}
    P0 -->|No| Fix0[환경 설정 재확인]
    Fix0 --> P0

    P1 -->|Yes| P2{Phase 2 완료?}
    P1 -->|No| Fix1[Auth 디버깅]
    Fix1 --> P1

    P2 -->|Yes| P3{Phase 3 완료?}
    P2 -->|No| Fix2[Event 디버깅]
    Fix2 --> P2

    P3 -->|Yes| P4{Phase 4 완료?}
    P3 -->|No| Fix3[Payment 디버깅<br/>포인트 테스트]
    Fix3 --> P3

    P4 -->|Yes| P5{Phase 5 완료?}
    P4 -->|No| Fix4[Queue 디버깅<br/>WebSocket 확인]
    Fix4 --> P4

    P5 -->|Yes| P6{Phase 6 완료?}
    P5 -->|No| Fix5[Reservation 디버깅<br/>서비스 간 통신 확인]
    Fix5 --> P5

    P6 -->|Yes| P7{Phase 7 완료?}
    P6 -->|No| Fix6[Notification 디버깅]
    Fix6 --> P6

    P7 -->|Yes| Test[전체 통합 테스트]
    P7 -->|No| Fix7[Circuit Breaker 등<br/>개선사항 적용]
    Fix7 --> P7

    Test --> Result{모든 테스트 통과?}
    Result -->|Yes| Success[🎉 마이그레이션 완료!]
    Result -->|No| Debug[디버깅 및 수정]
    Debug --> Test

    Success --> Prod[AWS EKS 배포 준비]

    style Start fill:#E3F2FD,stroke:#1976D2,stroke-width:3px
    style Success fill:#C8E6C9,stroke:#2E7D32,stroke-width:4px
    style Prod fill:#FFD54F,stroke:#F9A825,stroke-width:3px
    style P3 fill:#FFE5B4,stroke:#FF8C00,stroke-width:3px
```

---

## 📚 참고 문서

- [Phase 0: 로컬 환경 구축](./phase0-local-setup.md)
- [Phase 1: Auth Service 마이그레이션](./phase1-auth-service.md)
- [Phase 2: Event Service 마이그레이션](./phase2-event-service.md)
- [Phase 3: Payment Service 구현 (포인트 시스템)](./phase3-payment-service.md)
- [Phase 4: Queue Service 마이그레이션](./phase4-queue-service.md)
- [Phase 5: Reservation Service 마이그레이션](./phase5-reservation-service.md)
- [Phase 6: Notification Service 구현](./phase6-notification-service.md)
- [Phase 7: Circuit Breaker & X-Ray 추가](./phase7-improvements.md)
