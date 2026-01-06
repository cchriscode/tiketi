# TIKETI 프로젝트 상세 명세서

> 팀원 공유 및 발표용 기술 문서

**작성일:** 2026-01-06
**버전:** 1.0
**프로젝트:** TIKETI - 이벤트 티켓 예매 플랫폼

---

## 📋 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [기술 스택](#3-기술-스택)
4. [프로젝트 구조](#4-프로젝트-구조)
5. [마이크로서비스 구성](#5-마이크로서비스-구성)
6. [데이터베이스 설계](#6-데이터베이스-설계)
7. [API 명세](#7-api-명세)
8. [포트 및 네트워크](#8-포트-및-네트워크)
9. [Kubernetes 인프라](#9-kubernetes-인프라)
10. [CI/CD 파이프라인](#10-cicd-파이프라인)
11. [GitOps (ArgoCD)](#11-gitops-argocd)
12. [모니터링 및 로깅](#12-모니터링-및-로깅)
13. [보안](#13-보안)
14. [성능 및 확장성](#14-성능-및-확장성)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 소개
TIKETI는 **이벤트 티켓 예매 플랫폼**으로, 콘서트, 뮤지컬, 스포츠 경기 등 다양한 이벤트의 티켓을 실시간으로 예매할 수 있는 시스템입니다.

### 1.2 주요 기능
- ✅ **회원 인증**: JWT 기반 로그인/회원가입
- ✅ **이벤트 검색**: 카테고리, 날짜, 장소별 이벤트 검색
- ✅ **실시간 좌석 선택**: WebSocket 기반 실시간 좌석 상태 동기화
- ✅ **대기열 시스템**: Redis 기반 공정한 티켓팅 대기열
- ✅ **결제 통합**: Toss Payments, Naver Pay, Kakao Pay 지원
- ✅ **관리자 대시보드**: 통계, 이벤트 관리, 예약 관리
- ✅ **실시간 모니터링**: Prometheus + Grafana + Loki 스택

### 1.3 핵심 특징
- **MSA(Microservices Architecture)**: 5개 독립 서비스
- **GitOps**: ArgoCD 기반 선언적 배포
- **CI/CD**: GitHub Actions 자동화 파이프라인
- **Container Orchestration**: Kubernetes (EKS/Kind)
- **실시간 통신**: Socket.IO + Redis Pub/Sub
- **관측성**: Metrics, Logs, Traces 완벽 구현

---

## 2. 시스템 아키텍처

### 2.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                          Users (Browsers)                        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React SPA)                          │
│                    Nginx + React 18                              │
│                    Port: 3000                                    │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                Backend API Gateway (Express)                     │
│                    Port: 3001                                    │
│   ┌──────────────────────────────────────────────────────┐     │
│   │  Routes:                                              │     │
│   │  - /api/auth    → Auth Service Proxy                 │     │
│   │  - /api/events  → Ticket Service Proxy               │     │
│   │  - /api/seats   → Ticket Service Proxy               │     │
│   │  - /api/payments → Payment Service Proxy             │     │
│   │  - /api/stats   → Stats Service Proxy                │     │
│   │  - /api/admin   → Backend Direct (Legacy)            │     │
│   └──────────────────────────────────────────────────────┘     │
└────────────────┬────────────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┬──────────────┬──────────────┐
    ▼            ▼            ▼              ▼              ▼
┌────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Auth   │  │Ticket  │  │ Payment  │  │  Stats   │  │ Backend  │
│Service │  │Service │  │ Service  │  │ Service  │  │(Legacy)  │
│        │  │        │  │          │  │          │  │          │
│:3005   │  │:3002   │  │ :3003    │  │ :3004    │  │  :3001   │
└───┬────┘  └───┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
    │           │              │             │             │
    └───────────┴──────────────┴─────────────┴─────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌──────────────┐ ┌────────────┐ ┌────────────┐
        │  PostgreSQL  │ │ DragonflyDB│ │   S3/EFS   │
        │              │ │  (Redis)   │ │  (Storage) │
        │   :5432      │ │   :6379    │ │            │
        └──────────────┘ └────────────┘ └────────────┘
```

### 2.2 MSA 서비스 분리 전략

#### 도메인 기반 분리
```
┌─────────────────────────────────────────────────────────┐
│                    Auth Service                          │
│  책임: 인증/인가, 사용자 관리                              │
│  스키마: auth_schema (users)                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   Ticket Service                         │
│  책임: 이벤트, 좌석, 예약, 대기열                          │
│  스키마: ticket_schema (events, seats, reservations)     │
│  실시간: Socket.IO (좌석 상태 동기화)                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  Payment Service                         │
│  책임: 결제 처리, PG 연동                                 │
│  스키마: payment_schema (payments, transactions)         │
│  연동: Toss Payments API                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   Stats Service                          │
│  책임: 통계, 분석, 리포팅 (Read-Only)                     │
│  스키마: stats_schema (daily_stats, event_stats)         │
│  패턴: CQRS - Query Side                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              Backend (Legacy/Gateway)                    │
│  책임: Admin API, 이미지 업로드, News 관리                │
│  스키마: All schemas (search_path 설정)                  │
│  역할: API Gateway + Legacy features                    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 기술 스택

### 3.1 Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| **React** | 18.2.0 | UI 프레임워크 |
| **React Router** | 6.20.1 | 클라이언트 라우팅 |
| **Axios** | 1.6.2 | HTTP 클라이언트 |
| **Socket.IO Client** | 4.7.2 | 실시간 통신 |
| **Recharts** | 3.6.0 | 차트/그래프 |
| **Date-fns** | 3.0.0 | 날짜 처리 |
| **Toss Payments SDK** | 1.9.2 | 결제 연동 |

### 3.2 Backend (All Services)
| 기술 | 버전 | 용도 |
|------|------|------|
| **Node.js** | 18+ | 런타임 환경 |
| **Express.js** | 4.18.2 | 웹 프레임워크 |
| **PostgreSQL** | 15 | 주 데이터베이스 |
| **DragonflyDB** | latest | Redis 호환 캐시 |
| **Socket.IO** | 4.7.2 | WebSocket 서버 |
| **JWT** | 9.0.2 | 인증 토큰 |
| **Bcrypt** | 5.1.1 | 비밀번호 해싱 |
| **Winston** | 3.18.3 | 로깅 |
| **Prom-client** | 15.1.3 | Prometheus 메트릭 |

### 3.3 Infrastructure
| 기술 | 버전 | 용도 |
|------|------|------|
| **Kubernetes** | 1.28+ | 컨테이너 오케스트레이션 |
| **Kind** | latest | 로컬 K8s 클러스터 |
| **Docker** | 24+ | 컨테이너화 |
| **ArgoCD** | 2.9+ | GitOps CD |
| **GitHub Actions** | - | CI/CD 파이프라인 |
| **Kustomize** | 5.0+ | K8s 매니페스트 관리 |

### 3.4 Monitoring Stack
| 기술 | 버전 | 용도 |
|------|------|------|
| **Prometheus** | 2.47+ | 메트릭 수집 |
| **Grafana** | 10.2+ | 시각화 대시보드 |
| **Loki** | 2.9+ | 로그 집계 |
| **Promtail** | 2.9+ | 로그 수집 |

### 3.5 AWS Services (Production)
| 서비스 | 용도 |
|--------|------|
| **EKS** | Managed Kubernetes |
| **RDS (PostgreSQL)** | Managed Database |
| **ElastiCache (Redis)** | Managed Cache |
| **S3** | 이미지 스토리지 |
| **ECR** | Docker 이미지 레지스트리 |
| **ALB** | 로드 밸런서 |
| **Route53** | DNS 관리 |
| **ACM** | SSL/TLS 인증서 |
| **CloudWatch** | 추가 모니터링 |

---

## 4. 프로젝트 구조

### 4.1 전체 디렉토리 구조

```
project-ticketing/
├── .github/
│   └── workflows/               # GitHub Actions CI/CD
│       ├── backend-ci-cd.yml
│       ├── auth-service-ci-cd.yml
│       ├── ticket-service-ci-cd.yml
│       ├── payment-service-ci-cd.yml
│       └── stats-service-ci-cd.yml
│
├── argocd/                      # ArgoCD GitOps 설정
│   ├── projects/
│   │   └── tiketi-project.yaml
│   └── applications/
│       ├── app-of-apps.yaml     # App of Apps 패턴
│       ├── tiketi-dev.yaml
│       ├── tiketi-staging.yaml
│       └── tiketi-prod.yaml
│
├── backend/                     # Backend (Legacy/Gateway)
│   ├── src/
│   │   ├── config/              # DB, Redis, S3 설정
│   │   ├── middleware/          # 인증, 로깅, 에러 핸들러
│   │   ├── routes/              # API 라우트
│   │   │   ├── admin.js         # 관리자 API
│   │   │   ├── news.js          # 뉴스 관리
│   │   │   ├── auth-proxy.js    # Auth Service Proxy
│   │   │   ├── ticket-proxy.js  # Ticket Service Proxy
│   │   │   ├── payment-proxy.js # Payment Service Proxy
│   │   │   └── stats-proxy.js   # Stats Service Proxy
│   │   ├── services/            # 비즈니스 로직
│   │   ├── metrics/             # Prometheus 메트릭
│   │   └── utils/               # 유틸리티
│   ├── Dockerfile
│   └── package.json
│
├── services/                    # 마이크로서비스
│   ├── auth-service/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   └── auth.js      # 로그인, 회원가입
│   │   │   ├── middleware/
│   │   │   │   └── auth.js      # JWT 검증
│   │   │   └── config/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── ticket-service/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── events.js    # 이벤트 조회
│   │   │   │   ├── seats.js     # 좌석 조회/선택
│   │   │   │   ├── reservations.js # 예약 생성/취소
│   │   │   │   └── queue.js     # 대기열 관리
│   │   │   ├── services/
│   │   │   │   ├── reservation-cleaner.js # 만료 예약 정리
│   │   │   │   ├── event-status-updater.js # 이벤트 상태 자동 업데이트
│   │   │   │   ├── seat-generator.js # 좌석 자동 생성
│   │   │   │   └── queue-processor.js # 대기열 처리
│   │   │   └── config/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── payment-service/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   └── payments.js  # 결제 처리
│   │   │   ├── services/
│   │   │   │   ├── toss-payments.js # Toss Payments 연동
│   │   │   │   └── webhook-handler.js # 결제 웹훅
│   │   │   └── config/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── stats-service/
│       ├── src/
│       │   ├── routes/
│       │   │   └── stats.js     # 통계 API (Read-Only)
│       │   ├── services/
│       │   │   └── aggregator.js # 통계 집계
│       │   └── config/
│       ├── Dockerfile
│       └── package.json
│
├── frontend/                    # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/          # 재사용 컴포넌트
│   │   ├── pages/               # 페이지 컴포넌트
│   │   │   ├── Home.js
│   │   │   ├── EventDetail.js
│   │   │   ├── SeatSelection.js
│   │   │   ├── Payment.js
│   │   │   ├── MyReservations.js
│   │   │   └── admin/           # 관리자 페이지
│   │   ├── services/
│   │   │   └── api.js           # API 클라이언트
│   │   ├── hooks/
│   │   │   └── useSocket.js     # Socket.IO 훅
│   │   └── App.js
│   ├── Dockerfile
│   ├── nginx.conf               # Nginx 설정
│   └── package.json
│
├── packages/                    # 공유 패키지 (Monorepo)
│   ├── common/
│   │   ├── src/
│   │   │   ├── constants/       # 공통 상수
│   │   │   ├── errors/          # 커스텀 에러 클래스
│   │   │   ├── middleware/      # 공통 미들웨어
│   │   │   └── utils/           # 유틸리티 함수
│   │   └── package.json
│   │
│   ├── database/
│   │   ├── src/
│   │   │   └── pool.js          # DB 연결 풀
│   │   └── package.json
│   │
│   └── metrics/
│       ├── src/
│       │   └── prometheus.js    # 메트릭 정의
│       └── package.json
│
├── database/                    # Database 스크립트
│   ├── init.sql                 # 초기 데이터
│   ├── set_search_path.sql      # 스키마 경로 설정
│   ├── cleanup-public-schema.sql # 마이그레이션 정리
│   └── migrations/
│       ├── auth-service-schema.sql
│       ├── ticket-service-schema.sql
│       ├── payment-service-schema.sql
│       └── stats-service-schema.sql
│
├── k8s/                         # Kubernetes 매니페스트
│   ├── base/                    # Kustomize Base
│   │   ├── backend/
│   │   │   ├── deployment.yaml
│   │   │   └── service.yaml
│   │   ├── auth-service/
│   │   ├── ticket-service/
│   │   ├── payment-service/
│   │   ├── stats-service/
│   │   └── kustomization.yaml
│   │
│   └── overlays/                # 환경별 오버레이
│       ├── dev/
│       │   ├── postgres/        # Dev 전용 PostgreSQL
│       │   ├── dragonfly/       # Dev 전용 DragonflyDB
│       │   ├── frontend/
│       │   ├── grafana/
│       │   ├── loki/
│       │   ├── secrets.env      # Dev Secret
│       │   └── kustomization.yaml
│       │
│       ├── staging/
│       │   ├── configmap.yaml
│       │   └── kustomization.yaml
│       │
│       └── prod/
│           ├── configmap.yaml
│           ├── hpa.yaml         # HPA 설정
│           └── kustomization.yaml
│
├── scripts/                     # 자동화 스크립트
│   ├── 1-setup-cluster.sh
│   ├── 2-setup-database.sh
│   ├── 3-build-and-deploy.sh
│   ├── port-forward-all.sh
│   ├── cleanup.sh
│   └── verify-services.sh
│
├── docs/                        # 문서
│   └── api/
│
├── kind-config.yaml             # Kind 클러스터 설정
├── QUICK_START.md               # Windows 빠른 시작
├── QUICK_START_MAC.md           # macOS 빠른 시작
└── PROJECT_SPECIFICATION.md     # 본 문서
```

---

## 5. 마이크로서비스 구성

### 5.1 서비스별 상세 스펙

#### Auth Service (인증 서비스)
```yaml
이름: auth-service
포트: 3005
NodePort: 30001
책임:
  - 회원가입 (이메일/비밀번호)
  - 로그인 (JWT 발급)
  - 토큰 검증
  - 사용자 프로필 관리

주요 API:
  POST /api/auth/register     # 회원가입
  POST /api/auth/login        # 로그인
  GET  /api/auth/me           # 내 정보 조회
  PUT  /api/auth/profile      # 프로필 수정

Database:
  Schema: auth_schema
  Tables:
    - users (id, email, password_hash, name, role)

Dependencies:
  - PostgreSQL
  - bcrypt (비밀번호 해싱)
  - jsonwebtoken (JWT)

리소스:
  CPU Request: 200m
  CPU Limit: 1000m
  Memory Request: 256Mi
  Memory Limit: 512Mi
```

#### Ticket Service (티켓 서비스)
```yaml
이름: ticket-service
포트: 3002
NodePort: 30004
책임:
  - 이벤트 조회/검색
  - 좌석 조회/선택 (실시간)
  - 예약 생성/취소
  - 대기열 관리
  - WebSocket 통신

주요 API:
  GET    /api/events              # 이벤트 목록
  GET    /api/events/:id          # 이벤트 상세
  GET    /api/seats/events/:id    # 좌석 조회
  POST   /api/seats/reserve       # 좌석 예약
  GET    /api/reservations/my     # 내 예약 목록
  POST   /api/reservations/:id/cancel  # 예약 취소
  POST   /api/queue/check/:eventId     # 대기열 진입

WebSocket Events:
  - seat-locked     # 좌석 잠금
  - seat-released   # 좌석 해제
  - queue-position  # 대기열 순번

Database:
  Schema: ticket_schema
  Tables:
    - events
    - seats
    - reservations
    - reservation_items
    - seat_layouts
    - ticket_types
    - keyword_mappings

Background Jobs:
  - reservation-cleaner  # 만료 예약 자동 정리 (30초마다)
  - event-status-updater # 이벤트 상태 자동 변경 (스마트 타이머)
  - queue-processor      # 대기열 처리 (10초마다)

Dependencies:
  - PostgreSQL
  - DragonflyDB (대기열, 캐시)
  - Socket.IO (실시간)
  - Redis Pub/Sub (멀티 Pod)

리소스:
  CPU Request: 200m
  CPU Limit: 1000m
  Memory Request: 256Mi
  Memory Limit: 512Mi
```

#### Payment Service (결제 서비스)
```yaml
이름: payment-service
포트: 3003
NodePort: 30003
책임:
  - 결제 준비
  - 결제 승인
  - 결제 취소/환불
  - PG사 연동 (Toss Payments)
  - 웹훅 처리

주요 API:
  POST /api/payments/prepare   # 결제 준비
  POST /api/payments/confirm   # 결제 승인
  POST /api/payments/process   # 간편 결제 처리
  POST /api/payments/webhook   # PG 웹훅

외부 연동:
  - Toss Payments API
  - (미래) Naver Pay, Kakao Pay

Database:
  Schema: payment_schema
  Tables:
    - payments (id, reservation_id, amount, status, pg_transaction_id)
    - transactions (결제 이력)

Dependencies:
  - PostgreSQL
  - Axios (PG API 호출)

리소스:
  CPU Request: 200m
  CPU Limit: 1000m
  Memory Request: 256Mi
  Memory Limit: 512Mi
```

#### Stats Service (통계 서비스)
```yaml
이름: stats-service
포트: 3004
NodePort: 30002
책임:
  - 통계 데이터 조회 (Read-Only)
  - 대시보드 데이터 제공
  - 리포트 생성

주요 API:
  GET /api/stats/overview          # 전체 통계
  GET /api/stats/daily             # 일별 통계
  GET /api/stats/events            # 이벤트별 통계
  GET /api/stats/revenue           # 매출 통계
  GET /api/stats/conversion        # 전환율 통계

Database:
  Schema: stats_schema (+ 다른 스키마 읽기)
  Tables:
    - daily_stats
    - event_stats

패턴:
  - CQRS Query Side
  - Read Replica 사용 가능

Dependencies:
  - PostgreSQL (Read-Only)

리소스:
  CPU Request: 100m
  CPU Limit: 500m
  Memory Request: 256Mi
  Memory Limit: 512Mi
```

#### Backend (API Gateway + Legacy)
```yaml
이름: backend
포트: 3001
NodePort: 30000
책임:
  - API Gateway (Proxy)
  - Admin API
  - 이미지 업로드 (S3)
  - News 관리
  - 메트릭 집계

주요 API:
  # Proxy Routes
  /api/auth/*        → Auth Service
  /api/events/*      → Ticket Service
  /api/seats/*       → Ticket Service
  /api/reservations/* → Ticket Service
  /api/queue/*       → Ticket Service
  /api/payments/*    → Payment Service
  /api/stats/*       → Stats Service

  # Direct Routes (Legacy)
  GET  /api/admin/dashboard/stats
  GET  /api/admin/reservations
  POST /api/admin/events
  POST /api/image/upload
  GET  /api/news

Database:
  Schema: All (search_path 설정)

Background Jobs:
  - metrics-aggregator  # Prometheus 메트릭 (1분마다)

Dependencies:
  - PostgreSQL
  - DragonflyDB
  - AWS S3 (이미지)
  - Socket.IO

리소스:
  CPU Request: 200m
  CPU Limit: 1000m
  Memory Request: 256Mi
  Memory Limit: 512Mi
```

---

## 6. 데이터베이스 설계

### 6.1 Schema 분리 전략

```sql
-- MSA 스키마 분리
tiketi=# \dn

      List of schemas
      Name       |  Owner
-----------------+------------
 auth_schema     | tiketi_user
 ticket_schema   | tiketi_user
 payment_schema  | tiketi_user
 stats_schema    | tiketi_user
 public          | postgres
```

### 6.2 주요 테이블

#### auth_schema.users
```sql
CREATE TABLE auth_schema.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',  -- 'user', 'admin'
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### ticket_schema.events
```sql
CREATE TABLE ticket_schema.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),  -- 'concert', 'musical', 'sports', 'etc'
  venue VARCHAR(255),
  address TEXT,
  event_date TIMESTAMP NOT NULL,
  sale_start_date TIMESTAMP NOT NULL,
  sale_end_date TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'upcoming',  -- 'upcoming', 'on_sale', 'sold_out', 'ended', 'cancelled'
  poster_url TEXT,
  seat_layout_id UUID,  -- FK to seat_layouts
  created_by UUID,      -- FK to auth_schema.users
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### ticket_schema.seats
```sql
CREATE TABLE ticket_schema.seats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES ticket_schema.events(id),
  section VARCHAR(50),
  row_number INT,
  seat_number INT,
  seat_label VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'available',  -- 'available', 'locked', 'reserved'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### ticket_schema.reservations
```sql
CREATE TABLE ticket_schema.reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,  -- FK to auth_schema.users
  event_id UUID NOT NULL REFERENCES ticket_schema.events(id),
  reservation_number VARCHAR(50) UNIQUE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'confirmed', 'cancelled', 'expired'
  payment_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'completed', 'failed', 'refunded'
  payment_method VARCHAR(50),
  expires_at TIMESTAMP,  -- 예약 만료 시간 (5분)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### payment_schema.payments
```sql
CREATE TABLE payment_schema.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL,  -- FK to ticket_schema.reservations
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'completed', 'failed', 'refunded'
  payment_method VARCHAR(50),
  pg_provider VARCHAR(50),  -- 'toss', 'naver', 'kakao'
  pg_transaction_id VARCHAR(255),
  pg_response JSON,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 6.3 Search Path 설정
```sql
-- 모든 서비스가 스키마 우선순위를 갖도록 설정
ALTER ROLE tiketi_user SET search_path TO
  ticket_schema, auth_schema, payment_schema, stats_schema, public;
```

**중요:** 코드에서는 명시적 스키마 사용 권장
```javascript
// ❌ 나쁜 예 (search_path 의존)
db.query('SELECT * FROM users WHERE id = $1', [userId]);

// ✅ 좋은 예 (명시적 스키마)
db.query('SELECT * FROM auth_schema.users WHERE id = $1', [userId]);
```

---

## 7. API 명세

### 7.1 인증 API (Auth Service)

#### POST /api/auth/register
회원가입

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "홍길동",
  "phone": "010-1234-5678"
}
```

**Response (201):**
```json
{
  "message": "회원가입이 완료되었습니다.",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "홍길동",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST /api/auth/login
로그인

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "홍길동",
    "role": "user"
  }
}
```

### 7.2 이벤트 API (Ticket Service)

#### GET /api/events
이벤트 목록 조회

**Query Parameters:**
- `status`: 'on_sale', 'upcoming', 'ended'
- `category`: 'concert', 'musical', 'sports'
- `limit`: 기본 20
- `offset`: 기본 0

**Response (200):**
```json
{
  "events": [
    {
      "id": "uuid",
      "title": "BTS WORLD TOUR 2024",
      "category": "concert",
      "venue": "잠실 종합운동장",
      "event_date": "2024-12-31T19:00:00Z",
      "status": "on_sale",
      "poster_url": "https://...",
      "min_price": 88000,
      "max_price": 165000
    }
  ],
  "total": 25
}
```

#### GET /api/events/:id
이벤트 상세 조회

**Response (200):**
```json
{
  "event": {
    "id": "uuid",
    "title": "BTS WORLD TOUR 2024",
    "description": "...",
    "category": "concert",
    "venue": "잠실 종합운동장",
    "address": "서울시 송파구...",
    "event_date": "2024-12-31T19:00:00Z",
    "sale_start_date": "2024-12-01T00:00:00Z",
    "sale_end_date": "2024-12-30T23:59:59Z",
    "status": "on_sale",
    "poster_url": "https://...",
    "seat_layout_id": "uuid",
    "created_at": "2024-11-01T00:00:00Z"
  }
}
```

### 7.3 좌석 API (Ticket Service)

#### GET /api/seats/events/:eventId
이벤트 좌석 조회

**Response (200):**
```json
{
  "seats": [
    {
      "id": "uuid",
      "section": "VIP",
      "row_number": 1,
      "seat_number": 5,
      "seat_label": "VIP-1-5",
      "price": 165000,
      "status": "available"
    },
    {
      "id": "uuid",
      "section": "VIP",
      "row_number": 1,
      "seat_number": 6,
      "seat_label": "VIP-1-6",
      "price": 165000,
      "status": "locked"  // 다른 사용자가 선택 중
    }
  ],
  "layout": {
    "sections": [
      {
        "name": "VIP",
        "rows": 5,
        "seatsPerRow": 20,
        "price": 165000
      }
    ]
  }
}
```

#### POST /api/seats/reserve
좌석 예약 (임시 잠금)

**Request:**
```json
{
  "eventId": "uuid",
  "seatIds": ["uuid1", "uuid2"]
}
```

**Response (201):**
```json
{
  "message": "좌석이 임시 예약되었습니다.",
  "reservation": {
    "id": "uuid",
    "reservation_number": "R1234567890",
    "total_amount": 330000,
    "expires_at": "2024-12-25T10:15:00Z",  // 5분 후
    "status": "pending",
    "payment_status": "pending"
  }
}
```

### 7.4 예약 API (Ticket Service)

#### GET /api/reservations/my
내 예약 목록

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "reservations": [
    {
      "id": "uuid",
      "reservation_number": "R1234567890",
      "event_title": "BTS WORLD TOUR 2024",
      "venue": "잠실 종합운동장",
      "event_date": "2024-12-31T19:00:00Z",
      "total_amount": 330000,
      "status": "confirmed",
      "payment_status": "completed",
      "created_at": "2024-12-25T10:10:00Z",
      "items": [
        {
          "ticketTypeName": "VIP",
          "quantity": 2,
          "unitPrice": 165000,
          "subtotal": 330000
        }
      ]
    }
  ]
}
```

#### POST /api/reservations/:id/cancel
예약 취소

**Response (200):**
```json
{
  "message": "예약이 취소되었습니다.",
  "reservation": {
    "id": "uuid",
    "status": "cancelled"
  }
}
```

### 7.5 결제 API (Payment Service)

#### POST /api/payments/process
결제 처리 (간편 결제)

**Request:**
```json
{
  "reservationId": "uuid",
  "paymentMethod": "naver_pay"  // 'naver_pay', 'kakao_pay', 'bank_transfer', 'toss'
}
```

**Response (200):**
```json
{
  "message": "결제가 완료되었습니다.",
  "payment": {
    "id": "uuid",
    "amount": 330000,
    "status": "completed",
    "payment_method": "naver_pay",
    "pg_transaction_id": "TOSS_TX_12345"
  }
}
```

### 7.6 통계 API (Stats Service)

#### GET /api/stats/overview
전체 통계

**Response (200):**
```json
{
  "stats": {
    "totalRevenue": 45000000,
    "totalReservations": 523,
    "totalEvents": 25,
    "activeEvents": 8,
    "todayRevenue": 3300000,
    "todayReservations": 42
  }
}
```

---

## 8. 포트 및 네트워크

### 8.1 서비스 포트 매핑

| 서비스 | Container Port | Service Port | NodePort | Port Forward | 용도 |
|--------|---------------|--------------|----------|--------------|------|
| **Frontend** | 3000 | 3000 | 30005 | 3000 | React 앱 |
| **Backend** | 3001 | 3001 | 30000 | 3001 | API Gateway |
| **Ticket Service** | 3002 | 3002 | 30004 | 3002 | 티켓 관리 |
| **Payment Service** | 3003 | 3003 | 30003 | 3003 | 결제 처리 |
| **Stats Service** | 3004 | 3004 | 30002 | 3004 | 통계 |
| **Auth Service** | 3005 | 3005 | 30001 | 3005 | 인증 |
| **PostgreSQL** | 5432 | 5432 | - | 5432 | Database |
| **DragonflyDB** | 6379 | 6379 | - | 6379 | Cache/Queue |
| **Grafana** | 3000 | 3000 | 30006 | 3010 | 모니터링 |
| **Loki** | 3100 | 3100 | - | - | 로그 집계 |

### 8.2 네트워크 흐름

```
User Browser
    ↓ http://localhost:3000
Frontend (Port 3000)
    ↓ API calls
Backend API Gateway (Port 3001)
    ↓ Proxy routing
    ├→ Auth Service (Port 3005)      ─→ PostgreSQL (auth_schema)
    ├→ Ticket Service (Port 3002)    ─→ PostgreSQL (ticket_schema)
    │   ├→ WebSocket (Socket.IO)     ─→ DragonflyDB (Pub/Sub)
    │   └→ Queue System              ─→ DragonflyDB (Queue)
    ├→ Payment Service (Port 3003)   ─→ PostgreSQL (payment_schema)
    │   └→ Toss Payments API (External)
    └→ Stats Service (Port 3004)     ─→ PostgreSQL (stats_schema, Read-Only)
```

### 8.3 Kubernetes Service Types

```yaml
# ClusterIP (내부 통신)
- postgres-service: ClusterIP
- dragonfly-service: ClusterIP
- loki-service: ClusterIP

# NodePort (외부 접근 가능)
- frontend-service: NodePort 30005
- backend-service: NodePort 30000
- auth-service: NodePort 30001
- ticket-service: NodePort 30004
- payment-service: NodePort 30003
- stats-service: NodePort 30002
- grafana-service: NodePort 30006
```

---

## 9. Kubernetes 인프라

### 9.1 클러스터 구성

#### Kind 클러스터 (로컬 개발)
```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: tiketi-local

nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30000  # Backend
        hostPort: 30000
      - containerPort: 30005  # Frontend
        hostPort: 30005
      - containerPort: 30006  # Grafana
        hostPort: 30006

  - role: worker
  - role: worker
```

#### EKS 클러스터 (Production)
```yaml
클러스터 이름: tiketi-prod
리전: ap-northeast-2 (서울)
Kubernetes 버전: 1.28+

노드 그룹:
  - 이름: tiketi-app-nodes
    인스턴스 타입: t3.medium
    최소 노드: 2
    최대 노드: 10
    디스크: 30GB gp3

  - 이름: tiketi-db-nodes (선택사항)
    인스턴스 타입: r6i.large
    최소 노드: 1
    최대 노드: 3
    테인트: dedicated=database:NoSchedule
```

### 9.2 리소스 할당

#### Pod 리소스 (각 서비스)
```yaml
# 일반 서비스 (auth, ticket, payment, stats, backend)
resources:
  requests:
    cpu: 200m        # 0.2 core
    memory: 256Mi
  limits:
    cpu: 1000m       # 1 core
    memory: 512Mi

# Stats Service (Read-only, 더 적은 리소스)
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

# PostgreSQL (Stateful)
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 2Gi

# DragonflyDB (Cache)
resources:
  requests:
    cpu: 200m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

#### HPA (Horizontal Pod Autoscaler) - Production
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ticket-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ticket-service
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

### 9.3 Persistent Storage

#### PostgreSQL PVC
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
  storageClassName: standard  # Kind: standard, EKS: gp3
```

### 9.4 ConfigMap & Secrets

#### ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: tiketi-config
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"

  # Database
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "tiketi"
  DB_USER: "tiketi_user"

  # Redis
  REDIS_HOST: "dragonfly-service"
  REDIS_PORT: "6379"

  # Service URLs (internal)
  AUTH_SERVICE_URL: "http://auth-service:3005"
  TICKET_SERVICE_URL: "http://ticket-service:3002"
  PAYMENT_SERVICE_URL: "http://payment-service:3003"
  STATS_SERVICE_URL: "http://stats-service:3004"
```

#### Secrets (환경별)
```yaml
# k8s/overlays/dev/secrets.env
DB_PASSWORD=dev_password_123
JWT_SECRET=dev-secret-key
TOSS_CLIENT_KEY=test_ck_XXXXXXXXX
TOSS_SECRET_KEY=test_sk_XXXXXXXXX

# k8s/overlays/prod/secrets.env (AWS Secrets Manager에서 가져옴)
DB_PASSWORD=${AWS_SECRET:tiketi-db-password}
JWT_SECRET=${AWS_SECRET:tiketi-jwt-secret}
TOSS_CLIENT_KEY=${AWS_SECRET:toss-client-key}
TOSS_SECRET_KEY=${AWS_SECRET:toss-secret-key}
```

---

## 10. CI/CD 파이프라인

### 10.1 GitHub Actions 워크플로우

#### 전체 파이프라인 흐름
```
코드 Push (main/develop)
    ↓
GitHub Actions Trigger
    ↓
┌─────────────────────────────────────┐
│  Job 1: Build & Push to ECR         │
│  1. Checkout code                   │
│  2. Detect environment              │
│     - main branch → prod            │
│     - develop branch → staging      │
│  3. Generate image tag              │
│     - Format: {sha}-{timestamp}     │
│  4. AWS OIDC 인증                    │
│  5. Login to ECR                    │
│  6. Build Docker image              │
│  7. Security scan (Trivy)           │
│  8. Push to ECR                     │
│     - {tag}                         │
│     - latest                        │
│     - {environment}                 │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Job 2: Update Kustomize Manifests  │
│  1. Checkout code                   │
│  2. Update kustomization.yaml       │
│     Path: k8s/overlays/{env}/       │
│  3. Commit & push changes           │
│  4. ArgoCD auto-sync 트리거          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Job 3: Notify Discord              │
│  - 배포 결과 알림                     │
│  - 성공/실패 여부                     │
│  - 이미지 태그, 환경 정보             │
└─────────────────────────────────────┘
```

#### 워크플로우 트리거
```yaml
on:
  push:
    branches: [main, develop]
    paths:
      - 'services/ticket-service/**'
      - 'packages/common/**'
      - '.github/workflows/ticket-service-ci-cd.yml'

  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options:
          - staging
          - prod
```

### 10.2 서비스별 워크플로우

각 마이크로서비스는 독립적인 CI/CD 파이프라인을 가짐:

| 워크플로우 | 트리거 경로 | ECR 리포지토리 |
|-----------|------------|---------------|
| `backend-ci-cd.yml` | `backend/**` | `tiketi-backend` |
| `auth-service-ci-cd.yml` | `services/auth-service/**` | `tiketi-auth-service` |
| `ticket-service-ci-cd.yml` | `services/ticket-service/**` | `tiketi-ticket-service` |
| `payment-service-ci-cd.yml` | `services/payment-service/**` | `tiketi-payment-service` |
| `stats-service-ci-cd.yml` | `services/stats-service/**` | `tiketi-stats-service` |

### 10.3 이미지 태깅 전략

```bash
# 예시
ECR_REGISTRY=123456789.dkr.ecr.ap-northeast-2.amazonaws.com
IMAGE_TAG=a1b2c3d-20240101-120000

# 3개의 태그로 푸시
${ECR_REGISTRY}/tiketi-ticket-service:a1b2c3d-20240101-120000  # Unique tag
${ECR_REGISTRY}/tiketi-ticket-service:latest                   # Latest
${ECR_REGISTRY}/tiketi-ticket-service:staging                  # Environment tag
```

### 10.4 보안 스캔 (Trivy)

```yaml
- name: Run security scan (Trivy)
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ ECR_IMAGE }}:${{ IMAGE_TAG }}
    format: 'sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '0'  # Report만 하고 실패하지 않음
```

---

## 11. GitOps (ArgoCD)

### 11.1 ArgoCD 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│              ArgoCD (App of Apps Pattern)                │
│                                                          │
│  tiketi-app-of-apps                                     │
│    ├── tiketi-dev        (auto-sync: true)             │
│    ├── tiketi-staging    (auto-sync: true)             │
│    └── tiketi-prod       (auto-sync: false, manual)    │
└─────────────────────────────────────────────────────────┘
         │
         ├──> GitHub Repository
         │    └── k8s/overlays/{env}/kustomization.yaml
         │
         └──> Kubernetes Cluster
              └── Namespace: tiketi / tiketi-staging / tiketi-prod
```

### 11.2 ArgoCD Application 정의

#### App of Apps (메타 애플리케이션)
```yaml
# argocd/applications/app-of-apps.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tiketi-app-of-apps
  namespace: argocd
spec:
  project: tiketi
  source:
    repoURL: https://github.com/ORG/project-ticketing.git
    targetRevision: main
    path: argocd/applications
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: false
      selfHeal: true
```

#### 환경별 Application

**Dev Environment:**
```yaml
# argocd/applications/tiketi-dev.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tiketi-dev
  namespace: argocd
spec:
  project: tiketi
  source:
    repoURL: https://github.com/ORG/project-ticketing.git
    targetRevision: develop
    path: k8s/overlays/dev
  destination:
    server: https://kubernetes.default.svc
    namespace: tiketi
  syncPolicy:
    automated:
      prune: true      # 자동 삭제
      selfHeal: true   # 자동 복구
    syncOptions:
      - CreateNamespace=true
```

**Production Environment:**
```yaml
# argocd/applications/tiketi-prod.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tiketi-prod
  namespace: argocd
spec:
  project: tiketi
  source:
    repoURL: https://github.com/ORG/project-ticketing.git
    targetRevision: main
    path: k8s/overlays/prod
  destination:
    server: https://kubernetes.default.svc
    namespace: tiketi
  syncPolicy:
    automated:
      prune: false     # 수동 삭제
      selfHeal: false  # 수동 복구 (안전)
    syncOptions:
      - CreateNamespace=true
```

### 11.3 ArgoCD Project (RBAC)
```yaml
# argocd/projects/tiketi-project.yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: tiketi
  namespace: argocd
spec:
  description: TIKETI 티켓 예매 플랫폼

  sourceRepos:
    - 'https://github.com/ORG/project-ticketing.git'

  destinations:
    - namespace: 'tiketi*'
      server: https://kubernetes.default.svc

  clusterResourceWhitelist:
    - group: ''
      kind: Namespace

  namespaceResourceWhitelist:
    - group: '*'
      kind: '*'
```

### 11.4 배포 프로세스

```
1. 개발자가 코드 푸시
   └─> GitHub (main/develop branch)

2. GitHub Actions 실행
   ├─> Docker 이미지 빌드
   ├─> ECR에 푸시
   └─> k8s/overlays/{env}/kustomization.yaml 업데이트
       └─> 새로운 이미지 태그 반영

3. Git 커밋 & 푸시
   └─> "chore(k8s): update ticket-service image to a1b2c3d-20240101"

4. ArgoCD가 Git 변경 감지 (3분마다 폴링)
   └─> Manifest 변경 확인

5. ArgoCD Auto-Sync (환경별 정책에 따라)
   ├─> Dev/Staging: 자동 배포
   └─> Prod: 수동 승인 후 배포

6. Kubernetes에 Apply
   └─> Rolling Update 시작
       ├─> 새 Pod 생성
       ├─> Health Check 통과 확인
       ├─> 이전 Pod 종료
       └─> 배포 완료
```

---

## 12. 모니터링 및 로깅

### 12.1 모니터링 스택

```
┌──────────────────────────────────────────────────┐
│               Grafana Dashboard                   │
│            http://localhost:30006                 │
│  ┌────────────────────────────────────────────┐  │
│  │  - System Metrics (CPU, Memory, Network)   │  │
│  │  - Application Metrics (Requests, Errors)  │  │
│  │  - Business Metrics (Revenue, Bookings)    │  │
│  │  - Logs (Loki)                             │  │
│  └────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│ Prometheus  │  │    Loki     │
│   :9090     │  │   :3100     │
│             │  │             │
│ - Scrapes   │  │ - Aggregates│
│   metrics   │  │   logs      │
│   from pods │  │   from pods │
└──────┬──────┘  └──────┬──────┘
       │                │
   Metrics          Logs
       │                │
       └────────┬───────┘
                ▼
   ┌─────────────────────────┐
   │   Application Pods       │
   │                         │
   │  - /metrics (Prom)      │
   │  - stdout (Logs)        │
   └─────────────────────────┘
```

### 12.2 Prometheus Metrics

#### 시스템 메트릭
```javascript
// prom-client를 통해 자동 수집
- process_cpu_seconds_total
- process_resident_memory_bytes
- nodejs_heap_size_total_bytes
- nodejs_heap_size_used_bytes
- nodejs_eventloop_lag_seconds
```

#### 애플리케이션 메트릭
```javascript
// backend/src/metrics/index.js
const { Counter, Gauge, Histogram } = require('prom-client');

// HTTP 요청 메트릭
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// 비즈니스 메트릭
const dailyRevenue = new Gauge({
  name: 'tiketi_daily_revenue',
  help: 'Daily revenue in KRW'
});

const reservationsTotal = new Counter({
  name: 'tiketi_reservations_total',
  help: 'Total number of reservations',
  labelNames: ['event_id', 'status']
});

const seatsAvailable = new Gauge({
  name: 'tiketi_seats_available',
  help: 'Number of available seats',
  labelNames: ['event_id']
});
```

#### 커스텀 메트릭 예시
```javascript
// Ticket Service에서 좌석 상태 추적
seatsAvailable.labels(eventId).set(availableCount);
seatsReserved.labels(eventId).inc(reservedCount);

// Payment Service에서 결제 성공률 추적
paymentsSuccessTotal.labels(paymentMethod).inc();
paymentsFailedTotal.labels(paymentMethod, errorType).inc();
```

### 12.3 Grafana 대시보드

#### 대시보드 구성
1. **시스템 개요** (`tiketi-system-overview`)
   - 전체 Pod 상태
   - CPU/Memory 사용률
   - 네트워크 트래픽

2. **애플리케이션 메트릭** (`tiketi-app-metrics`)
   - HTTP Request Rate
   - Response Time (p50, p95, p99)
   - Error Rate
   - WebSocket 연결 수

3. **비즈니스 메트릭** (`tiketi-business`)
   - 일별/시간별 매출
   - 예약 건수
   - 이벤트별 판매율
   - 결제 수단별 통계

4. **로그 검색** (`tiketi-logs`)
   - Loki 통합
   - 서비스별 로그 필터
   - 에러 로그 하이라이트

### 12.4 로깅 전략

#### Winston 설정
```javascript
// backend/src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'backend',
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
```

#### 로그 레벨
```
ERROR - 시스템 에러 (DB 연결 실패, 외부 API 오류)
WARN  - 경고 (재시도, deprecated API 사용)
INFO  - 중요 이벤트 (사용자 로그인, 예약 생성, 결제 완료)
DEBUG - 디버깅 정보 (쿼리 실행, 함수 호출)
```

#### 로그 포맷 (JSON)
```json
{
  "level": "info",
  "message": "예약 생성 완료",
  "timestamp": "2024-12-25T10:15:30.123Z",
  "service": "ticket-service",
  "userId": "uuid",
  "reservationId": "uuid",
  "eventId": "uuid",
  "totalAmount": 330000
}
```

### 12.5 Loki + Promtail

#### Promtail 설정
```yaml
# Kubernetes에서 모든 Pod 로그 수집
scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        target_label: app
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
    pipeline_stages:
      - json:
          expressions:
            level: level
            message: message
            timestamp: timestamp
```

---

## 13. 보안

### 13.1 인증 및 인가

#### JWT 토큰 구조
```javascript
// Payload
{
  userId: 'uuid',
  email: 'user@example.com',
  role: 'user',  // 'user', 'admin'
  iat: 1703511330,  // Issued At
  exp: 1704720930   // Expires (14일)
}

// Header
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 미들웨어 인증
```javascript
// services/*/src/middleware/auth.js
const authenticateToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // DB에서 사용자 존재 확인
    const user = await db.query(
      'SELECT id, email, role FROM auth_schema.users WHERE id = $1',
      [decoded.userId]
    );

    if (!user.rows[0]) {
      return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    req.user = decoded;
    req.userInfo = user.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
  }
};
```

### 13.2 비밀번호 보안

```javascript
// 회원가입 시 bcrypt 해싱
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

// 로그인 시 비교
const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
```

### 13.3 환경 변수 및 Secrets

#### Kubernetes Secrets
```bash
# Secret 생성
kubectl create secret generic tiketi-secret \
  --from-env-file=k8s/overlays/prod/secrets.env \
  -n tiketi

# Secret 조회 (Base64 디코딩)
kubectl get secret tiketi-secret -n tiketi -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

#### AWS Secrets Manager 통합 (Production)
```javascript
// External Secrets Operator 사용
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: tiketi-aws-secrets
spec:
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: tiketi-secret
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: tiketi/db-password
    - secretKey: JWT_SECRET
      remoteRef:
        key: tiketi/jwt-secret
```

### 13.4 CORS 설정

```javascript
// backend/src/server.js
const cors = require('cors');

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://tiketi.gg',
    'https://www.tiketi.gg'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 13.5 Rate Limiting

```javascript
// Express Rate Limit (향후 구현)
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15분
  max: 5,  // 5번 시도
  message: '로그인 시도 횟수를 초과했습니다. 나중에 다시 시도해주세요.'
});

app.post('/api/auth/login', loginLimiter, loginHandler);
```

### 13.6 SQL Injection 방지

```javascript
// ❌ 나쁜 예 (SQL Injection 취약)
db.query(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ 좋은 예 (Parameterized Query)
db.query('SELECT * FROM auth_schema.users WHERE email = $1', [email]);
```

---

## 14. 성능 및 확장성

### 14.1 캐싱 전략

#### Redis (DragonflyDB) 사용
```javascript
// 이벤트 목록 캐싱 (5분)
const cacheKey = `events:status:${status}:page:${page}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const events = await db.query('SELECT...');
await redis.setex(cacheKey, 300, JSON.stringify(events));
```

#### 캐시 무효화
```javascript
// 이벤트 생성/수정 시 관련 캐시 삭제
await redis.del('events:*');
await redis.del(`event:${eventId}`);
```

### 14.2 데이터베이스 최적화

#### 인덱스
```sql
-- 자주 조회되는 컬럼에 인덱스
CREATE INDEX idx_events_status ON ticket_schema.events(status);
CREATE INDEX idx_events_category ON ticket_schema.events(category);
CREATE INDEX idx_events_event_date ON ticket_schema.events(event_date);
CREATE INDEX idx_seats_event_id ON ticket_schema.seats(event_id);
CREATE INDEX idx_reservations_user_id ON ticket_schema.reservations(user_id);

-- 복합 인덱스
CREATE INDEX idx_seats_event_status ON ticket_schema.seats(event_id, status);
```

#### Connection Pooling
```javascript
// packages/database/src/pool.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,              // 최대 연결 수
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 14.3 실시간 동기화 (WebSocket)

#### Socket.IO + Redis Adapter
```javascript
// Multi-pod 환경에서 WebSocket 이벤트 동기화
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const io = new Server(server);

const pubClient = createClient({ url: 'redis://dragonfly-service:6379' });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));

// 좌석 선택 시 모든 클라이언트에 브로드캐스트
io.to(`seats:${eventId}`).emit('seat-locked', {
  seatId,
  userId,
  expiresAt
});
```

### 14.4 대기열 시스템

#### Redis Sorted Set 기반
```javascript
// 대기열 진입
const score = Date.now();  // 타임스탬프
await redis.zadd(`queue:${eventId}`, score, userId);

// 대기 순번 조회
const rank = await redis.zrank(`queue:${eventId}`, userId);
const position = rank + 1;

// 대기열에서 꺼내기 (FIFO)
const users = await redis.zpopmin(`queue:${eventId}`, 10);  // 10명씩
```

### 14.5 Horizontal Scaling

#### Production 구성
```yaml
# 서비스별 Pod 수
auth-service: 2개 (최소) → 5개 (최대)
ticket-service: 3개 (최소) → 10개 (최대)  # WebSocket 부하 고려
payment-service: 2개 (최소) → 5개 (최대)
stats-service: 1개 (최소) → 3개 (최대)
backend: 2개 (최소) → 5개 (최대)

# Database
PostgreSQL: RDS Multi-AZ (HA)
  - Master: ap-northeast-2a
  - Standby: ap-northeast-2c
  - Read Replica: 2개 (Stats Service 전용)

DragonflyDB: ElastiCache Cluster Mode
  - 3 Shards × 2 Replicas = 6 Nodes
```

### 14.6 성능 메트릭 목표

| 메트릭 | 목표 |
|--------|------|
| **API Response Time (p95)** | < 200ms |
| **API Response Time (p99)** | < 500ms |
| **WebSocket Latency** | < 100ms |
| **Database Query Time (p95)** | < 50ms |
| **좌석 선택 동기화** | < 1초 |
| **결제 처리 시간** | < 3초 |
| **동시 접속자** | 10,000명 이상 |
| **TPS (초당 트랜잭션)** | 1,000+ |

---

## 15. 배포 및 운영

### 15.1 배포 전략

#### Rolling Update (기본)
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0      # 항상 최소 1개 Pod 유지
    maxSurge: 1            # 최대 1개 추가 Pod
```

#### Blue-Green Deployment (선택사항)
```bash
# ArgoCD에서 수동 전환
kubectl patch svc ticket-service -p '{"spec":{"selector":{"version":"v2"}}}'
```

### 15.2 헬스 체크

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3002
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3002
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

### 15.3 백업 전략

#### PostgreSQL 백업
```bash
# 일일 백업 (Cron Job)
0 2 * * * kubectl exec -n tiketi deployment/postgres -- \
  pg_dump -U tiketi_user tiketi | \
  gzip > /backups/tiketi-$(date +\%Y\%m\%d).sql.gz

# AWS RDS 자동 백업 (Production)
- 스냅샷: 매일 02:00 KST
- 보관 기간: 7일
- Point-in-Time Recovery: 활성화
```

### 15.4 Disaster Recovery

```
RTO (Recovery Time Objective): 1시간
RPO (Recovery Point Objective): 5분

절차:
1. Database Restore (RDS 스냅샷)
2. ArgoCD Sync (Kubernetes 리소스 복구)
3. DNS Failover (Route53)
4. Health Check 확인
```

---

## 부록

### A. 유용한 명령어

#### Kubernetes
```bash
# 전체 리소스 조회
kubectl get all -n tiketi

# 특정 서비스 로그
kubectl logs -f deployment/ticket-service -n tiketi

# Pod 재시작
kubectl rollout restart deployment/ticket-service -n tiketi

# Secret 조회
kubectl get secret tiketi-secret -n tiketi -o yaml

# Port Forward
kubectl port-forward -n tiketi svc/ticket-service 3002:3002
```

#### Docker
```bash
# 로컬 빌드 & Kind 로드
docker build -t tiketi-ticket-service:local -f services/ticket-service/Dockerfile .
kind load docker-image tiketi-ticket-service:local --name tiketi-local

# 실행 중인 컨테이너 확인
docker ps

# 로그 확인
docker logs <container-id>
```

#### Database
```bash
# PostgreSQL 접속
kubectl exec -it -n tiketi deployment/postgres -- psql -U tiketi_user -d tiketi

# 스키마 확인
\dn

# 테이블 확인
SET search_path TO ticket_schema;
\dt

# 예약 현황 조회
SELECT status, COUNT(*) FROM ticket_schema.reservations GROUP BY status;
```

### B. 트러블슈팅

#### Pod가 시작하지 않는 경우
```bash
# Pod 상태 확인
kubectl describe pod <pod-name> -n tiketi

# 이벤트 확인
kubectl get events -n tiketi --sort-by='.lastTimestamp'

# 로그 확인 (이전 컨테이너)
kubectl logs <pod-name> -n tiketi --previous
```

#### Database 연결 실패
```bash
# PostgreSQL Pod 확인
kubectl get pods -n tiketi -l app=postgres

# PostgreSQL 로그
kubectl logs -n tiketi deployment/postgres

# 직접 연결 테스트
kubectl exec -it -n tiketi deployment/postgres -- psql -U tiketi_user -d tiketi -c "SELECT 1"
```

### C. 참고 문서

- [QUICK_START.md](./QUICK_START.md) - Windows 빠른 시작
- [QUICK_START_MAC.md](./QUICK_START_MAC.md) - macOS 빠른 시작
- [KIND_DEPLOYMENT_GUIDE.md](./KIND_DEPLOYMENT_GUIDE.md) - Kind 배포 가이드
- [TROUBLESHOOTING_COMPLETE_GUIDE.md](./TROUBLESHOOTING_COMPLETE_GUIDE.md) - 문제 해결
- [claudedocs/MSA_SYSTEM_SPEC.md](./claudedocs/MSA_SYSTEM_SPEC.md) - MSA 상세 스펙

---

**문서 작성:** Claude Code
**최종 수정:** 2026-01-06
**버전:** 1.0
