# TIKETI 아키텍처 다이어그램 Part 2: 보안 & MSA

> **작성일:** 2025-12-03
> **연결:** Architecture-Diagrams-Presentation.md의 연속

---

## 7. 보안 구성도 (Security Architecture)

### 🔐 다층 보안 아키텍처

```
┌────────────────────────────────────────────────────────────────────┐
│                     보안 계층 (Defense in Depth)                    │
└────────────────────────────────────────────────────────────────────┘

레이어 1: 네트워크 보안
┌──────────────────────────────────────────────────────────────────┐
│  🌐 CloudFront (WAF)                                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ AWS WAF (Web Application Firewall)                         │ │
│  │  • SQL Injection 차단                                      │ │
│  │  • XSS (Cross-Site Scripting) 차단                         │ │
│  │  • Rate Limiting: 사용자당 100 req/min                     │ │
│  │  • 지역 차단: 한국/미국/일본만 허용                        │ │
│  │  • DDoS Protection (Shield Standard 기본 포함)             │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                          ↓
레이어 2: VPC 네트워크 격리
┌──────────────────────────────────────────────────────────────────┐
│  🔒 VPC (10.0.0.0/16)                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Security Groups (Stateful Firewall)                        │ │
│  │                                                            │ │
│  │ ALB Security Group:                                        │ │
│  │  Inbound: 0.0.0.0/0:443 (HTTPS)                           │ │
│  │  Outbound: EKS Pods SG:3010-3015                          │ │
│  │                                                            │ │
│  │ EKS Pods Security Group:                                   │ │
│  │  Inbound: ALB SG:3010-3015, Self (Pod 간 통신)           │ │
│  │  Outbound: RDS SG:5432, Redis SG:6379, 0.0.0.0/0:443     │ │
│  │                                                            │ │
│  │ RDS Security Group:                                        │ │
│  │  Inbound: EKS Pods SG:5432, Bastion SG:5432              │ │
│  │  Outbound: None (DB는 아웃바운드 불필요)                  │ │
│  │                                                            │ │
│  │ ElastiCache Security Group:                                │ │
│  │  Inbound: EKS Pods SG:6379                                │ │
│  │  Outbound: None                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Network ACLs (Stateless Firewall)                         │ │
│  │  • Subnet 레벨 추가 보호                                  │ │
│  │  • 의심스러운 IP 블랙리스트                               │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                          ↓
레이어 3: 애플리케이션 보안
┌──────────────────────────────────────────────────────────────────┐
│  🔑 인증 & 인가                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ JWT (JSON Web Token)                                       │ │
│  │  • 알고리즘: RS256 (비대칭 암호화)                         │ │
│  │  • 만료 시간: 7일                                          │ │
│  │  • Refresh Token: 30일                                     │ │
│  │  • Payload:                                                │ │
│  │    {                                                       │ │
│  │      userId: "uuid",                                       │ │
│  │      email: "user@example.com",                            │ │
│  │      role: "user" | "admin",                               │ │
│  │      iat: 1701234567,                                      │ │
│  │      exp: 1701838367                                       │ │
│  │    }                                                       │ │
│  │                                                            │ │
│  │ 검증 위치:                                                 │ │
│  │  1. Nginx Ingress (auth_request 모듈)                     │ │
│  │  2. 각 서비스 미들웨어 (2차 검증)                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ RBAC (Role-Based Access Control)                           │ │
│  │  • user: 이벤트 조회, 예매, 결제                          │ │
│  │  • admin: 모든 권한 + 이벤트 생성/수정/삭제               │ │
│  │                                                            │ │
│  │ Kubernetes RBAC:                                           │ │
│  │  • ServiceAccount 별 권한 분리                            │ │
│  │  • Pod는 자신의 Namespace만 접근 가능                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                          ↓
레이어 4: 데이터 보안
┌──────────────────────────────────────────────────────────────────┐
│  🔐 암호화                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 전송 중 암호화 (In-Transit)                                │ │
│  │  • HTTPS: TLS 1.3 (ALB → CloudFront)                      │ │
│  │  • mTLS: Pod 간 통신 암호화 (Service Mesh, 선택적)        │ │
│  │  • SSL/TLS: RDS, ElastiCache 연결 암호화                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 저장 시 암호화 (At-Rest)                                   │ │
│  │  • RDS Aurora: AES-256 암호화 (KMS 키)                    │ │
│  │  • ElastiCache: AES-256 암호화                            │ │
│  │  • S3: Server-Side Encryption (SSE-S3)                    │ │
│  │  • EBS 볼륨: AES-256 암호화                               │ │
│  │  • 비밀번호: bcrypt (10 rounds)                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 비밀 키 관리                                                │ │
│  │  AWS Secrets Manager:                                      │ │
│  │   • DB 비밀번호                                            │ │
│  │   • Redis Auth Token                                       │ │
│  │   • JWT Secret Key                                         │ │
│  │   • 결제 API 키 (토스페이먼츠)                             │ │
│  │                                                            │ │
│  │  Kubernetes Secrets:                                       │ │
│  │   • 환경 변수로 주입 (volumeMount 금지)                    │ │
│  │   • Base64 인코딩 (etcd 자동 암호화)                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                          ↓
레이어 5: 감사 & 모니터링
┌──────────────────────────────────────────────────────────────────┐
│  📊 보안 로깅 & 감사                                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ CloudTrail (AWS API 감사)                                  │ │
│  │  • 모든 AWS API 호출 기록                                  │ │
│  │  • S3에 저장, Athena로 분석                                │ │
│  │  • 보관 기간: 1년                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Application Logs (보안 이벤트)                             │ │
│  │  • 로그인 실패 (5회 이상 → 계정 잠금)                     │ │
│  │  • 비정상 API 호출 (429 Too Many Requests)                │ │
│  │  • 권한 에러 (403 Forbidden)                               │ │
│  │  • SQL Injection 시도 감지                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ GuardDuty (위협 탐지)                                      │ │
│  │  • ML 기반 이상 행동 탐지                                  │ │
│  │  • 악의적 IP 접근 자동 차단                                │ │
│  │  • 크립토마이닝 탐지                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 🛡️ 보안 체크리스트

| 항목 | 구현 여부 | 상세 |
|------|----------|------|
| **네트워크** | ✅ | WAF, Security Groups, Private Subnets |
| **인증** | ✅ | JWT, Refresh Token, RBAC |
| **암호화 (전송)** | ✅ | HTTPS, TLS 1.3, SSL (DB/Cache) |
| **암호화 (저장)** | ✅ | AES-256 (RDS, S3, EBS), bcrypt (비밀번호) |
| **비밀 키 관리** | ✅ | Secrets Manager, K8s Secrets |
| **감사 로깅** | ✅ | CloudTrail, Application Logs |
| **DDoS 방어** | ✅ | CloudFront + Shield Standard |
| **SQL Injection** | ✅ | WAF + Parameterized Queries |
| **XSS 방어** | ✅ | WAF + Content Security Policy |
| **Rate Limiting** | ✅ | WAF (100 req/min) |
| **2FA** | ⚠️ | 관리자 계정에만 적용 예정 |
| **Penetration Test** | 📅 | 분기 1회 계획 |

### 🚨 보안 인시던트 대응

```
1단계: 감지 (Detection)
├─ CloudWatch Alarm 발동
├─ GuardDuty 알림
└─ 비정상 로그 패턴 발견

2단계: 격리 (Containment)
├─ Security Group 규칙 즉시 변경 (의심 IP 차단)
├─ 해당 Pod 즉시 종료 (kubectl delete pod)
└─ WAF 규칙 업데이트 (자동 차단)

3단계: 분석 (Analysis)
├─ CloudTrail 로그 분석
├─ Application 로그 분석
└─ 영향 범위 파악

4단계: 복구 (Recovery)
├─ 취약점 패치
├─ 새 이미지 빌드 및 배포
└─ 데이터 무결성 검증

5단계: 사후 대응 (Post-Incident)
├─ 인시던트 리포트 작성
├─ 재발 방지 대책 수립
└─ 보안 정책 업데이트
```

---

## 8. 마이크로서비스 아키텍처 다이어그램 (MSA)

### 🏗️ 전체 MSA 구조 (서비스 의존성 맵)

```
┌────────────────────────────────────────────────────────────────────┐
│                         사용자 (브라우저)                           │
└────────────────────────────────────────────────────────────────────┘
                             │
                             ↓
┌────────────────────────────────────────────────────────────────────┐
│                    Nginx Ingress Controller                        │
│               (API Gateway, 라우팅, Rate Limiting)                 │
└────────────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ↓                    ↓                    ↓

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│              │      │              │      │              │
│ Auth Service │      │Event Service │      │Queue Service │
│              │      │              │      │              │
│ Port: 3010   │      │ Port: 3011   │      │ Port: 3012   │
│              │      │              │      │              │
│ 책임:        │      │ 책임:        │      │ 책임:        │
│ • 회원가입   │      │ • 이벤트 조회│      │ • 대기열 관리│
│ • 로그인     │      │ • 좌석 배치도│      │ • WebSocket  │
│ • JWT 발급   │      │ • 캐싱       │      │ • 순번 업데이트│
│              │      │              │      │              │
│ DB:          │      │ DB:          │      │ Cache:       │
│ • users      │      │ • events     │      │ • queue:*    │
│              │      │ • seats      │      │ • active:*   │
│              │      │              │      │              │
│ 의존성:      │      │ 의존성:      │      │ 의존성:      │
│ • 없음       │◄─────│ • Auth (JWT) │      │ • 없음       │
│              │      │              │      │              │
│ Replica:2-10 │      │ Replica:2-20 │      │ Replica:3-100│
└──────────────┘      └──────────────┘      └──────────────┘
                             │
                             │ (이벤트 정보)
                             ↓
        ┌────────────────────┼────────────────────┐
        ↓                    ↓                    ↓

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│              │      │              │      │              │
│ Reservation  │      │Payment       │      │Admin         │
│ Service      │      │Service       │      │Service       │
│              │      │              │      │              │
│ Port: 3013   │      │ Port: 3014   │      │ Port: 3015   │
│              │      │              │      │              │
│ 책임:        │      │ 책임:        │      │ 책임:        │
│ • 예매 생성  │      │ • 결제 처리  │      │ • 이벤트 관리│
│ • 좌석 락    │      │ • 환불       │      │ • 예매 관리  │
│ • 예매 취소  │      │ • 결제 로그  │      │ • 통계       │
│ • Saga패턴   │      │ • 외부 API   │      │              │
│              │      │              │      │              │
│ DB:          │      │ DB:          │      │ DB:          │
│ • reserv     │      │ • payments   │      │ • 모든 테이블│
│ • reserv_    │      │              │      │   (읽기 전용)│
│   items      │      │              │      │              │
│              │      │              │      │              │
│ 의존성:      │      │ 의존성:      │      │ 의존성:      │
│ • Auth (JWT) │      │ • Auth (JWT) │      │ • Auth (JWT) │
│ • Event      │◄─────│ • Reservation│      │ • 모든 서비스│
│   (이벤트    │      │   (예매정보) │      │              │
│    정보)     │      │              │      │              │
│              │      │              │      │              │
│ Replica:3-50 │      │ Replica:2-10 │      │ Replica:1-2  │
└──────┬───────┘      └──────┬───────┘      └──────────────┘
       │                     │
       │ (이벤트 발행)       │ (이벤트 발행)
       └─────────┬───────────┘
                 ↓
┌────────────────────────────────────────────────────────────────────┐
│          Message Queue (RabbitMQ or Kafka) - 선택적               │
│                                                                    │
│  이벤트:                                                           │
│  • ReservationCreated   → Payment Service 구독                    │
│  • PaymentCompleted     → Reservation Service 구독                │
│  • PaymentFailed        → Reservation Service 구독 (보상 트랜잭션)│
│  • TicketSoldOut        → Event Service 구독 (캐시 무효화)        │
└────────────────────────────────────────────────────────────────────┘
```

### 📊 서비스별 상세 스펙

```
┌────────────────────────────────────────────────────────────────────┐
│                     Auth Service (인증)                            │
├────────────────────────────────────────────────────────────────────┤
│ 언어/프레임워크: Node.js 18, Express 4.18                          │
│ 컨테이너: Docker, 이미지 크기 ~150MB                              │
│ 리소스:                                                            │
│  • CPU: 100m (요청), 500m (제한)                                  │
│  • 메모리: 128Mi (요청), 512Mi (제한)                             │
│ 스케일링:                                                          │
│  • HPA: CPU 70%, Memory 80%                                       │
│  • Min: 2, Max: 10                                                │
│ 데이터베이스:                                                      │
│  • 테이블: users (UUID PK, email UNIQUE)                          │
│  • Connection Pool: 10                                             │
│ 캐시: 없음 (Stateless)                                            │
│ 외부 의존성: 없음                                                  │
│ API 엔드포인트:                                                    │
│  POST /api/v1/auth/register                                       │
│  POST /api/v1/auth/login                                          │
│  POST /api/v1/auth/refresh-token                                  │
│  GET  /api/v1/auth/me                                             │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                  Event Service (이벤트 조회)                       │
├────────────────────────────────────────────────────────────────────┤
│ 언어/프레임워크: Node.js 18, Express 4.18                          │
│ 컨테이너: Docker, 이미지 크기 ~200MB                              │
│ 리소스:                                                            │
│  • CPU: 200m (요청), 1000m (제한)                                 │
│  • 메모리: 256Mi (요청), 1Gi (제한)                               │
│ 스케일링:                                                          │
│  • HPA: CPU 70%                                                   │
│  • Min: 2, Max: 20 (트래픽 많음)                                  │
│ 데이터베이스:                                                      │
│  • 테이블: events, seats, seat_layouts                            │
│  • Connection Pool: 20 (RDS Reader 사용)                          │
│ 캐시: Redis (이벤트 목록, 상세, 좌석 배치도)                       │
│  • TTL: 30초                                                       │
│  • Cache Hit Rate 목표: >90%                                      │
│ 외부 의존성:                                                       │
│  • Auth Service (JWT 검증, 선택적)                                │
│ API 엔드포인트:                                                    │
│  GET  /api/v1/events (목록, 검색, 필터)                           │
│  GET  /api/v1/events/:id (상세)                                   │
│  GET  /api/v1/seats/events/:eventId (좌석 배치도)                 │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                  Queue Service (대기열)                            │
├────────────────────────────────────────────────────────────────────┤
│ 언어/프레임워크: Node.js 18, Express 4.18, Socket.IO 4.7          │
│ 컨테이너: Docker, 이미지 크기 ~180MB                              │
│ 리소스:                                                            │
│  • CPU: 500m (요청), 2000m (제한)                                 │
│  • 메모리: 512Mi (요청), 2Gi (제한)                               │
│ 스케일링:                                                          │
│  • HPA: Custom Metric (대기열 길이)                               │
│  • Min: 3, Max: 100 (가장 많이 확장)                              │
│  • Metric: queue_size > 10,000 → Scale Out                        │
│ 데이터베이스: 없음                                                 │
│ 캐시: Redis (대기열 데이터)                                        │
│  • queue:{eventId} → Sorted Set (FIFO)                            │
│  • active:{eventId} → Set (활성 사용자)                           │
│ WebSocket:                                                         │
│  • Socket.IO with Redis Adapter (멀티 인스턴스)                   │
│  • Sticky Session (ALB)                                            │
│ 외부 의존성: 없음                                                  │
│ API 엔드포인트:                                                    │
│  POST /api/v1/queue/join/:eventId                                 │
│  GET  /api/v1/queue/status/:eventId                               │
│  POST /api/v1/queue/leave/:eventId                                │
│  WS   socket.on('queue:update')                                   │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│              Reservation Service (예매 코어) 🔥                    │
├────────────────────────────────────────────────────────────────────┤
│ 언어/프레임워크: Node.js 18, Express 4.18                          │
│ 컨테이너: Docker, 이미지 크기 ~250MB                              │
│ 리소스:                                                            │
│  • CPU: 1000m (요청), 4000m (제한)                                │
│  • 메모리: 1Gi (요청), 4Gi (제한)                                 │
│ 스케일링:                                                          │
│  • HPA: CPU 80%, Memory 85%                                       │
│  • Min: 3, Max: 50 (두 번째로 많이 확장)                          │
│ 데이터베이스:                                                      │
│  • 테이블: reservations, reservation_items                        │
│  • Connection Pool: 100 (RDS Writer 사용)                         │
│  • 트랜잭션: ACID 보장 (BEGIN ~ COMMIT)                           │
│ 캐시: Redis (좌석 락, 재고)                                        │
│  • lock:seat:{eventId}:{seatId} → TTL 10초                        │
│  • lock:ticket:{ticketTypeId} → TTL 10초                          │
│ 외부 의존성:                                                       │
│  • Auth Service (JWT 검증)                                        │
│  • Event Service (이벤트 정보 조회)                               │
│  • Message Queue (이벤트 발행)                                     │
│ 패턴:                                                              │
│  • Saga Pattern (분산 트랜잭션)                                   │
│  • 2-Phase Commit (좌석 락)                                       │
│ API 엔드포인트:                                                    │
│  POST /api/v1/reservations                                        │
│  GET  /api/v1/reservations/my                                     │
│  GET  /api/v1/reservations/:id                                    │
│  POST /api/v1/reservations/:id/cancel                             │
│  POST /api/v1/seats/lock                                          │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                  Payment Service (결제)                            │
├────────────────────────────────────────────────────────────────────┤
│ 언어/프레임워크: Node.js 18, Express 4.18                          │
│ 컨테이너: Docker, 이미지 크기 ~180MB                              │
│ 리소스:                                                            │
│  • CPU: 200m (요청), 1000m (제한)                                 │
│  • 메모리: 256Mi (요청), 1Gi (제한)                               │
│ 스케일링:                                                          │
│  • HPA: CPU 70%                                                   │
│  • Min: 2, Max: 10                                                │
│ 데이터베이스:                                                      │
│  • 테이블: payments, payment_logs                                 │
│  • Connection Pool: 20                                             │
│ 캐시: 없음                                                         │
│ 외부 의존성:                                                       │
│  • Auth Service (JWT 검증)                                        │
│  • Reservation Service (예매 정보)                                │
│  • 토스페이먼츠 API (외부)                                         │
│  • Message Queue (이벤트 발행/구독)                                │
│ 패턴:                                                              │
│  • Circuit Breaker (외부 API 장애 대응)                           │
│  • Idempotency (중복 결제 방지)                                   │
│ API 엔드포인트:                                                    │
│  POST /api/v1/payments/prepare                                    │
│  POST /api/v1/payments/confirm                                    │
│  POST /api/v1/payments/cancel                                     │
│  GET  /api/v1/payments/:id/status                                 │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                  Admin Service (관리자)                            │
├────────────────────────────────────────────────────────────────────┤
│ 언어/프레임워크: Node.js 18, Express 4.18                          │
│ 컨테이너: Docker, 이미지 크기 ~200MB                              │
│ 리소스:                                                            │
│  • CPU: 200m (요청), 500m (제한)                                  │
│  • 메모리: 256Mi (요청), 512Mi (제한)                             │
│ 스케일링:                                                          │
│  • Fixed: 1-2 Replicas (트래픽 적음)                              │
│ 데이터베이스:                                                      │
│  • 모든 테이블 (읽기 전용, RDS Reader 사용)                        │
│  • Connection Pool: 10                                             │
│ 캐시: 없음                                                         │
│ 외부 의존성:                                                       │
│  • Auth Service (JWT 검증, 관리자 권한 확인)                      │
│ API 엔드포인트:                                                    │
│  GET  /api/v1/admin/dashboard/stats                               │
│  POST /api/v1/admin/events                                        │
│  PUT  /api/v1/admin/events/:id                                    │
│  DELETE /api/v1/admin/events/:id                                  │
│  GET  /api/v1/admin/reservations                                  │
└────────────────────────────────────────────────────────────────────┘
```

### 🔄 서비스 간 통신 패턴

```
동기 통신 (REST API):
┌─────────────────┐     HTTP/JSON      ┌─────────────────┐
│  Reservation    │ ──────────────────> │  Event Service  │
│  Service        │ <────────────────── │                 │
│                 │   이벤트 정보 조회  │                 │
└─────────────────┘                     └─────────────────┘

특징:
✅ 즉시 응답 필요
✅ 트랜잭션 일관성 보장
⚠️ 네트워크 지연 (5-50ms)
⚠️ 서비스 장애 시 영향

비동기 통신 (Message Queue):
┌─────────────────┐                     ┌─────────────────┐
│  Reservation    │  ReservationCreated │  Payment        │
│  Service        │ ───────────────────>│  Service        │
│                 │   (메시지 큐)       │                 │
└─────────────────┘                     └─────────────────┘
        ↑                                        │
        │          PaymentCompleted              │
        └────────────────────────────────────────┘

특징:
✅ 즉시 응답 (메시지 발행 후 바로 반환)
✅ 장애 격리 (Payment 장애 시 Reservation 정상)
✅ 재시도 메커니즘
⚠️ 최종 일관성 (Eventual Consistency)
```

### 📈 서비스별 트래픽 분포 (피크 시)

```
┌────────────────────────────────────────────────────────────────┐
│               서비스별 트래픽 (BTS 콘서트 오픈 기준)           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Event Service      ████████████████████████ 50,000 req/s    │
│  (이벤트 조회)                                                │
│                                                                │
│  Queue Service      ████████████████████ 40,000 req/s         │
│  (대기열 상태)                                                │
│                                                                │
│  Reservation Svc    ████████████ 20,000 req/s 🔥              │
│  (예매 생성)                                                  │
│                                                                │
│  Payment Service    ████ 5,000 req/s                          │
│  (결제 처리)                                                  │
│                                                                │
│  Auth Service       ██ 2,000 req/s                            │
│  (로그인)                                                     │
│                                                                │
│  Admin Service      ▌ 10 req/s                                │
│  (관리)                                                       │
└────────────────────────────────────────────────────────────────┘

비율:
- Event: 42% (읽기 중심, 캐싱으로 부하 분산)
- Queue: 33% (WebSocket, 실시간 업데이트)
- Reservation: 17% (쓰기 중심, CPU/DB 집약적)
- Payment: 4%
- Auth: 2%
- Admin: <1%

확장 우선순위:
1. Queue Service (100 Replicas)
2. Reservation Service (50 Replicas)
3. Event Service (20 Replicas)
```

---

## 9. 최종 요약: 한 장으로 보는 TIKETI 아키텍처

```
┌──────────────────────────────────────────────────────────────────┐
│                     TIKETI MSA 아키텍처 전체                     │
└──────────────────────────────────────────────────────────────────┘

🌍 사용자 계층
  └─ React SPA (S3 + CloudFront)
      ↓ HTTPS
🌐 엣지 계층
  ├─ Route 53 (DNS)
  ├─ CloudFront (CDN, WAF)
  └─ ALB (Load Balancer, SSL)
      ↓
🐳 컨테이너 오케스트레이션
  └─ EKS (Kubernetes)
      ├─ Control Plane (AWS 관리)
      └─ Worker Nodes (EC2 Auto Scaling)
          ↓
📦 마이크로서비스 (6개)
  ├─ Auth Service (인증, JWT)
  ├─ Event Service (이벤트 조회, 캐싱)
  ├─ Queue Service (대기열, WebSocket)
  ├─ Reservation Service (예매, 트랜잭션)
  ├─ Payment Service (결제, Circuit Breaker)
  └─ Admin Service (관리)
      ↓
💾 데이터 계층
  ├─ RDS Aurora PostgreSQL (1 Writer + 8 Readers)
  ├─ ElastiCache Redis (6 Shards Cluster)
  └─ S3 (이미지 저장)
      ↓
📊 운영 계층
  ├─ CloudWatch (로그, 메트릭, 알림)
  ├─ Prometheus + Grafana (모니터링)
  ├─ X-Ray (분산 추적)
  └─ GitHub Actions (CI/CD)

🔐 보안 계층
  ├─ WAF (SQL Injection, XSS 차단)
  ├─ Security Groups (네트워크 격리)
  ├─ Secrets Manager (비밀 키 관리)
  ├─ TLS 1.3 (전송 암호화)
  └─ AES-256 (저장 암호화)

💰 월 비용: $805
⚡ 처리량: 100,000 TPS (피크)
🎯 가용성: 99.99%
🚀 배포 시간: 5분 (무중단)
```

---

## 📝 발표 자료 활용 가이드

### 슬라이드 구성 제안

```
1. 표지
   - TIKETI MSA 아키텍처
   - 수십만 동시 접속자를 위한 확장 가능한 시스템

2. 현재 문제점 (1장)
   - 단일 EC2의 한계
   - 확장 불가, 장애 위험

3. 마이그레이션 경로 (1장)
   - EC2 → K3s → EKS
   - 왜 K3s를 거치는가?

4. 클라우드 구성도 (1장)
   - AWS 서비스 전체 맵
   - 사용 서비스 목록

5. 마이크로서비스 구조 (1-2장)
   - 6개 서비스 설명
   - 서비스 간 통신 패턴

6. 네트워크 아키텍처 (1장)
   - VPC 3-Tier 구조
   - Security Groups

7. 데이터베이스 구조 (1장)
   - RDS Aurora (Writer + Readers)
   - ElastiCache Redis Cluster

8. 보안 아키텍처 (1장)
   - 다층 보안 (Defense in Depth)
   - WAF, Encryption, Secrets

9. 운영 및 모니터링 (1장)
   - CI/CD 파이프라인
   - Prometheus + Grafana

10. 성능 및 비용 (1장)
    - 처리량: 100K TPS
    - 월 비용: $805
    - 가용성: 99.99%

11. Q&A
```

---

**발표 자료 완성! 🎉**

이 다이어그램들은 복사해서 바로 발표 자료에 사용할 수 있습니다!