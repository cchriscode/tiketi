# 🎫 TIKETI - 이벤트 티켓 예매 플랫폼

> MSA 기반 실시간 티켓 예매 시스템 with Kubernetes & GitOps

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.28+-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![ArgoCD](https://img.shields.io/badge/ArgoCD-GitOps-F05032?logo=argo&logoColor=white)](https://argoproj.github.io/cd/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)

## 📖 목차

- [소개](#-소개)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [시스템 아키텍처](#-시스템-아키텍처)
- [빠른 시작](#-빠른-시작)
- [프로젝트 구조](#-프로젝트-구조)
- [API 문서](#-api-문서)
- [모니터링](#-모니터링)
- [배포](#-배포)
- [문서](#-문서)
- [기여](#-기여)
- [라이선스](#-라이선스)

---

## 🎯 소개

**TIKETI**는 콘서트, 뮤지컬, 스포츠 경기 등 다양한 이벤트의 티켓을 실시간으로 예매할 수 있는 **MSA(Microservices Architecture) 기반 플랫폼**입니다.

### 핵심 특징

- ✨ **Microservices Architecture**: 5개 독립 서비스로 구성
- 🚀 **GitOps with ArgoCD**: 선언적 배포 및 자동 동기화
- 🔄 **Real-time Sync**: WebSocket 기반 실시간 좌석 상태 동기화
- 📊 **Full Observability**: Prometheus, Grafana, Loki 통합 모니터링
- ☁️ **Cloud Native**: Kubernetes (EKS) & AWS 서비스 완전 활용
- 🔐 **Secure by Default**: JWT 인증, Secret 관리, HTTPS
- ⚡ **High Performance**: Redis 캐싱, Connection Pooling, HPA

---

## ✨ 주요 기능

### 사용자 기능
- 🔐 **회원 인증**: JWT 기반 로그인/회원가입
- 🔍 **이벤트 검색**: 카테고리, 날짜, 장소별 검색
- 🪑 **실시간 좌석 선택**: WebSocket 기반 좌석 상태 실시간 동기화
- ⏳ **대기열 시스템**: Redis 기반 공정한 티켓팅 대기열
- 💳 **다양한 결제 수단**: Toss Payments, Naver Pay, Kakao Pay
- 📱 **예약 관리**: 내 예약 조회, 취소, 환불

### 관리자 기능
- 📊 **실시간 대시보드**: 매출, 예약, 이벤트 통계
- 🎭 **이벤트 관리**: 생성, 수정, 삭제, 좌석 배치
- 👥 **예약 관리**: 전체 예약 조회, 상태 변경
- 📈 **통계 분석**: 일별/시간별 매출, 전환율, 결제 수단별 분석

---

## 🛠 기술 스택

### Frontend
![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=black)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-010101?logo=socket.io)
![Recharts](https://img.shields.io/badge/Recharts-3.6-22B5BF)
![Axios](https://img.shields.io/badge/Axios-1.6-5A29E4)

- **React 18.2** - UI 프레임워크
- **React Router 6** - 클라이언트 라우팅
- **Socket.IO Client** - 실시간 통신
- **Recharts** - 데이터 시각화
- **Toss Payments SDK** - 결제 연동

### Backend (Microservices)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/DragonflyDB-Redis-D82C20)

- **Node.js 18+** - 런타임
- **Express.js** - 웹 프레임워크
- **PostgreSQL 15** - 주 데이터베이스 (MSA 스키마 분리)
- **DragonflyDB** - Redis 호환 캐시/대기열
- **Socket.IO** - WebSocket 서버
- **JWT** - 인증 토큰
- **Winston** - 구조화된 로깅

### Infrastructure
![Kubernetes](https://img.shields.io/badge/Kubernetes-1.28+-326CE5?logo=kubernetes&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-24+-2496ED?logo=docker&logoColor=white)
![ArgoCD](https://img.shields.io/badge/ArgoCD-2.9+-EF7B4D?logo=argo)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-CI/CD-2088FF?logo=github-actions&logoColor=white)

- **Kubernetes 1.28+** - 컨테이너 오케스트레이션
- **ArgoCD** - GitOps 배포
- **GitHub Actions** - CI/CD 자동화
- **Kustomize** - K8s 매니페스트 관리
- **Kind** - 로컬 K8s 클러스터

### Monitoring
![Prometheus](https://img.shields.io/badge/Prometheus-2.47-E6522C?logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-10.2-F46800?logo=grafana&logoColor=white)
![Loki](https://img.shields.io/badge/Loki-2.9-F46800)

- **Prometheus** - 메트릭 수집
- **Grafana** - 시각화 대시보드
- **Loki** - 로그 집계
- **Promtail** - 로그 수집

### AWS Services (Production)
- **EKS** - Managed Kubernetes
- **RDS (PostgreSQL)** - Managed Database
- **ElastiCache (Redis)** - Managed Cache
- **S3** - 이미지 스토리지
- **ECR** - Docker Registry
- **ALB** - Load Balancer
- **Route53** - DNS
- **CloudWatch** - 추가 모니터링

---

## 🏗 시스템 아키텍처

### MSA 서비스 구성

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (React SPA)                    │
│                  Nginx + React 18                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│            Backend API Gateway (Express)                 │
│              Proxy + Admin API                          │
└───┬─────────┬─────────┬─────────┬─────────┬────────────┘
    │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼
┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
│  Auth  ││ Ticket ││Payment ││ Stats  ││Backend │
│Service ││Service ││Service ││Service ││(Legacy)│
│        ││        ││        ││        ││        │
│ :3005  ││ :3002  ││ :3003  ││ :3004  ││ :3001  │
└────┬───┘└────┬───┘└────┬───┘└────┬───┘└────┬───┘
     │         │         │         │         │
     └─────────┴─────────┴─────────┴─────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌────────────┐ ┌────────────┐
│  PostgreSQL  │ │ DragonflyDB│ │     S3     │
│    (RDS)     │ │  (Redis)   │ │  (Images)  │
└──────────────┘ └────────────┘ └────────────┘
```

### 서비스 책임

| 서비스 | 포트 | 책임 | 데이터베이스 |
|--------|------|------|--------------|
| **Auth Service** | 3005 | 인증, 회원가입, 사용자 관리 | `auth_schema` |
| **Ticket Service** | 3002 | 이벤트, 좌석, 예약, 대기열 | `ticket_schema` |
| **Payment Service** | 3003 | 결제 처리, PG 연동 | `payment_schema` |
| **Stats Service** | 3004 | 통계, 리포팅 (Read-Only) | `stats_schema` |
| **Backend** | 3001 | API Gateway, Admin, 이미지 | All schemas |

---

## 🚀 빠른 시작

### 사전 요구사항

- **Docker Desktop** (v4.0+)
- **Kubernetes** (kubectl)
- **Kind** (로컬) 또는 **EKS** (프로덕션)
- **Node.js** (v18+)
- **Git**

### 로컬 환경 설정

#### Windows
```powershell
# 1. 프로젝트 클론
git clone https://github.com/YOUR_ORG/project-ticketing.git
cd project-ticketing

# 2. 자동 설치 (Kind 클러스터 + 전체 배포)
.\setup-tiketi.ps1

# 3. 포트 포워딩 시작
.\start_port_forwards.ps1

# 4. 브라우저에서 접속
# http://localhost:3000
```

#### macOS / Linux
```bash
# 1. 프로젝트 클론
git clone https://github.com/YOUR_ORG/project-ticketing.git
cd project-ticketing

# 2. 자동 설치 (Kind 클러스터 + 전체 배포)
chmod +x scripts/setup-tiketi.sh
./scripts/setup-tiketi.sh

# 3. 포트 포워딩 시작
./scripts/port-forward-all.sh

# 4. 브라우저에서 접속
# http://localhost:3000
```

### 단계별 실행 (선택사항)

```bash
# 1단계: 클러스터 생성
./scripts/1-setup-cluster.sh

# 2단계: Database 설정
./scripts/2-setup-database.sh

# 3단계: 빌드 & 배포
./scripts/3-build-and-deploy.sh
```

### 기본 계정

#### 관리자
- **Email**: `admin@tiketi.gg`
- **Password**: `admin123`
- **URL**: http://localhost:3000/admin

---

## 📁 프로젝트 구조

```
project-ticketing/
├── .github/workflows/        # GitHub Actions CI/CD
│   ├── backend-ci-cd.yml
│   ├── auth-service-ci-cd.yml
│   ├── ticket-service-ci-cd.yml
│   ├── payment-service-ci-cd.yml
│   └── stats-service-ci-cd.yml
│
├── argocd/                   # ArgoCD GitOps 설정
│   ├── projects/             # ArgoCD Projects
│   └── applications/         # App of Apps
│
├── backend/                  # Backend (API Gateway)
│   ├── src/
│   │   ├── routes/          # API 라우트 (Proxy + Admin)
│   │   ├── middleware/      # 인증, 로깅
│   │   └── services/        # 비즈니스 로직
│   └── Dockerfile
│
├── services/                 # 마이크로서비스
│   ├── auth-service/        # 인증 서비스
│   ├── ticket-service/      # 티켓 서비스 (핵심)
│   ├── payment-service/     # 결제 서비스
│   └── stats-service/       # 통계 서비스
│
├── frontend/                 # React Frontend
│   ├── src/
│   │   ├── pages/           # 페이지 컴포넌트
│   │   ├── components/      # 재사용 컴포넌트
│   │   ├── services/        # API 클라이언트
│   │   └── hooks/           # 커스텀 훅 (Socket.IO)
│   └── Dockerfile
│
├── packages/                 # 공유 패키지 (Monorepo)
│   ├── common/              # 공통 유틸리티
│   ├── database/            # DB 연결 풀
│   └── metrics/             # Prometheus 메트릭
│
├── database/                 # Database 스크립트
│   ├── init.sql             # 초기 데이터
│   └── migrations/          # MSA 스키마 마이그레이션
│
├── k8s/                      # Kubernetes 매니페스트
│   ├── base/                # Kustomize Base
│   └── overlays/            # 환경별 오버레이
│       ├── dev/
│       ├── staging/
│       └── prod/
│
├── scripts/                  # 자동화 스크립트
│   ├── 1-setup-cluster.sh
│   ├── 2-setup-database.sh
│   └── 3-build-and-deploy.sh
│
├── QUICK_START.md           # 빠른 시작 (Windows)
├── QUICK_START_MAC.md       # 빠른 시작 (macOS)
├── PROJECT_SPECIFICATION.md # 프로젝트 상세 명세서
└── README.md                # 본 문서
```

---

## 📚 API 문서

### 주요 엔드포인트

#### 인증 (Auth Service)
```
POST /api/auth/register      # 회원가입
POST /api/auth/login         # 로그인
GET  /api/auth/me            # 내 정보 조회
```

#### 이벤트 (Ticket Service)
```
GET  /api/events             # 이벤트 목록
GET  /api/events/:id         # 이벤트 상세
GET  /api/seats/events/:id   # 좌석 조회
POST /api/seats/reserve      # 좌석 예약
```

#### 예약 (Ticket Service)
```
GET  /api/reservations/my           # 내 예약 목록
GET  /api/reservations/:id          # 예약 상세
POST /api/reservations/:id/cancel   # 예약 취소
```

#### 결제 (Payment Service)
```
POST /api/payments/prepare   # 결제 준비
POST /api/payments/confirm   # 결제 승인
POST /api/payments/process   # 간편 결제 처리
```

#### 통계 (Stats Service)
```
GET  /api/stats/overview     # 전체 통계
GET  /api/stats/daily        # 일별 통계
GET  /api/stats/events       # 이벤트별 통계
```

### Swagger UI
```
http://localhost:3001/api-docs
```

자세한 API 명세는 [PROJECT_SPECIFICATION.md](./PROJECT_SPECIFICATION.md#7-api-명세)를 참고하세요.

---

## 📊 모니터링

### Grafana 대시보드
```
URL: http://localhost:30006
기본 계정: admin / admin
```

#### 대시보드
- **시스템 개요**: Pod 상태, CPU/Memory, 네트워크
- **애플리케이션 메트릭**: Request Rate, Response Time, Error Rate
- **비즈니스 메트릭**: 매출, 예약 건수, 전환율
- **로그 검색**: Loki 통합 로그 뷰어

### Prometheus Metrics
```
URL: http://localhost:3001/metrics  (각 서비스별)
```

#### 주요 메트릭
- `http_request_duration_seconds` - API 응답 시간
- `tiketi_daily_revenue` - 일별 매출
- `tiketi_reservations_total` - 총 예약 건수
- `tiketi_seats_available` - 이벤트별 잔여 좌석

---

## 🚢 배포

### GitOps with ArgoCD

#### 배포 흐름
```
1. 코드 Push (main/develop)
   ↓
2. GitHub Actions 실행
   - Docker 이미지 빌드
   - ECR에 푸시
   - Kustomize 매니페스트 업데이트
   ↓
3. Git 커밋 & 푸시
   ↓
4. ArgoCD가 변경 감지 (3분마다 폴링)
   ↓
5. 자동 배포 (dev/staging) 또는 수동 승인 (prod)
   ↓
6. Kubernetes에 Apply (Rolling Update)
```

#### ArgoCD 설치
```bash
# ArgoCD 설치
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# App of Apps 배포
kubectl apply -f argocd/applications/app-of-apps.yaml

# ArgoCD UI 접속
kubectl port-forward svc/argocd-server -n argocd 8080:443
# URL: https://localhost:8080
```

### CI/CD 환경 변수

GitHub Secrets에 다음 변수 설정 필요:

```
AWS_ACCOUNT_ID          # AWS 계정 ID
AWS_ROLE_ARN            # OIDC Role ARN
DISCORD_WEBHOOK         # Discord 알림 (선택)
```

---

## 📖 문서

### 주요 문서
- **[QUICK_START.md](./QUICK_START.md)** - Windows 환경 빠른 시작
- **[QUICK_START_MAC.md](./QUICK_START_MAC.md)** - macOS 환경 빠른 시작
- **[PROJECT_SPECIFICATION.md](./PROJECT_SPECIFICATION.md)** - 프로젝트 상세 명세서
  - 기술 스택, 아키텍처, API 명세, DB 설계
  - 포트/네트워크, Kubernetes, CI/CD, GitOps
  - 모니터링, 보안, 성능 최적화
- **[KIND_DEPLOYMENT_GUIDE.md](./KIND_DEPLOYMENT_GUIDE.md)** - Kind 배포 가이드
- **[TROUBLESHOOTING_COMPLETE_GUIDE.md](./TROUBLESHOOTING_COMPLETE_GUIDE.md)** - 문제 해결

### 기술 문서 (claudedocs/)
- `MSA_SYSTEM_SPEC.md` - MSA 상세 스펙
- `ARGOCD_IMPLEMENTATION_ROADMAP.md` - ArgoCD 구현 로드맵
- `K8S_KUSTOMIZE_MIGRATION_COMPLETE.md` - Kustomize 마이그레이션
- `GITHUB_ACTIONS_ARGOCD_COMPLETE.md` - GitHub Actions + ArgoCD

---

## 🧪 테스트

### 단위 테스트
```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test

# 각 서비스
cd services/ticket-service
npm test
```

### E2E 테스트 (향후 구현)
```bash
# Playwright 또는 Cypress 사용 예정
npm run test:e2e
```

### 헬스 체크
```bash
# 모든 서비스 Health 확인
curl http://localhost:3001/health  # Backend
curl http://localhost:3005/health  # Auth
curl http://localhost:3002/health  # Ticket
curl http://localhost:3003/health  # Payment
curl http://localhost:3004/health  # Stats
```

---

## 🤝 기여

### 브랜치 전략
- `main` - Production 배포
- `develop` - Staging 배포
- `feature/*` - 기능 개발
- `bugfix/*` - 버그 수정

### 커밋 컨벤션
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 코드
chore: 빌드, 설정 변경
```

### Pull Request
1. Feature 브랜치 생성
2. 변경사항 커밋
3. PR 생성 (develop 브랜치로)
4. 코드 리뷰 & CI 통과
5. Merge

---

## 📝 라이선스

MIT License

Copyright (c) 2024 TIKETI Team

---

## 🔗 링크

- **프로젝트 Wiki**: [GitHub Wiki](https://github.com/YOUR_ORG/project-ticketing/wiki)
- **Issue Tracker**: [GitHub Issues](https://github.com/YOUR_ORG/project-ticketing/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_ORG/project-ticketing/discussions)

---

## 👥 팀

### Contributors
- 프로젝트 관리 & 아키텍처 설계
- Backend/MSA 개발
- Frontend 개발
- DevOps & Infrastructure

---

## 📞 문의

- **Email**: support@tiketi.gg
- **Slack**: [TIKETI Workspace](https://tiketi.slack.com)
- **Discord**: [TIKETI Community](https://discord.gg/tiketi)

---

**Built with ❤️ by TIKETI Team**

*Powered by Kubernetes, ArgoCD, and Cloud Native Technologies*
