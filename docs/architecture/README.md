# TIKETI MSA + Kubernetes 마이그레이션 완전 가이드

> 단일 EC2에서 수십만 명 동시 접속 가능한 확장 가능한 MSA 아키텍처로의 전환 가이드

---

## 📚 가이드 구성

이 가이드는 **TIKETI 티켓팅 플랫폼**을 현재의 단일 EC2 Monolith 아키텍처에서 **AWS EKS 기반 마이크로서비스 아키텍처**로 마이그레이션하는 전체 과정을 다룹니다.

### Part 1: 개요 및 현재 아키텍처 문제점 분석
**[📖 읽기](./msa-migration-guide-01-overview.md)**

- 현재 단일 EC2 아키텍처의 한계
- 수십만 동시 접속 시나리오 분석
- 실제 장애 시나리오 (Troubleshooting Case Study)
- MSA + Kubernetes가 필요한 이유
- 목표 아키텍처 개요

**핵심 내용:**
- 현재 시스템은 최대 10,000명까지만 처리 가능
- 300,000명 접속 시 시스템 붕괴 메커니즘 상세 분석
- Monolith vs MSA 비교 (장애 격리, 확장성, 비용)

---

### Part 2: MSA 서비스 분리 전략
**[📖 읽기](./msa-migration-guide-02-service-decomposition.md)**

- Domain-Driven Design (DDD) 기반 서비스 분리
- 실제 티켓팅 사이트 (Ticketmaster, Interpark) 아키텍처 분석
- TIKETI에 맞는 9개 마이크로서비스 설계
- 서비스별 상세 설계 (Queue, Ticket, Payment 등)
- 서비스 간 통신 전략 (동기/비동기)
- 데이터베이스 분리 전략

**핵심 서비스:**
1. **User Service** - 인증/회원관리
2. **Event Service** - 이벤트 조회
3. **Queue Service** - 대기열 관리 (핵심)
4. **Ticket Service** - 티켓 예약 (핵심)
5. **Order Service** - 주문 관리
6. **Payment Service** - 결제 처리
7. **Notification Service** - 알림 발송
8. **Analytics Service** - 데이터 분석
9. **Admin BFF** - 관리자 API

---

### Part 3: AWS 아키텍처 설계
**[📖 읽기](./msa-migration-guide-03-aws-architecture.md)**

- AWS 서비스 선택 및 이유
- VPC 네트워크 아키텍처 (Multi-AZ)
- EKS 클러스터 구성
- RDS PostgreSQL + Read Replica 설계
- ElastiCache Redis Cluster 설계
- CloudFront + S3 CDN 전략
- 보안 아키텍처 (WAF, Secrets Manager)
- 고가용성 및 재해 복구

**주요 AWS 서비스:**
- **Amazon EKS** - Kubernetes 관리
- **RDS PostgreSQL** - 주 데이터베이스
- **ElastiCache Redis** - 캐시 + 세션 + 큐
- **CloudFront** - CDN
- **AWS WAF** - 보안
- **Route 53** - DNS

---

### Part 4: Kubernetes 설정 및 배포
**[📖 읽기](./msa-migration-guide-04-kubernetes.md)**

- 서비스별 Kubernetes 매니페스트
- ConfigMap과 Secret 관리
- Ingress 및 ALB 설정
- Horizontal Pod Autoscaler (HPA) 전략
- 배포 전략 (Rolling Update, Blue-Green, Canary)
- Helm Charts 구성

**핵심 설정:**
- HPA: CPU, 메모리, 커스텀 메트릭 (대기열 길이, WebSocket 연결 수)
- PodDisruptionBudget: 최소 가용성 보장
- Graceful Shutdown: WebSocket 연결 안전하게 종료
- Network Policy: 서비스 간 통신 제어

---

### Part 5: 마이그레이션 단계별 실행 가이드
**[📖 읽기](./msa-migration-guide-05-migration-steps.md)**

- Strangler Fig 패턴 (점진적 마이그레이션)
- Phase 1: 인프라 준비 (1-2주)
- Phase 2: 서비스 분리 (3-4주)
- Phase 3: 데이터베이스 마이그레이션 (2-3주)
- Phase 4: 트래픽 전환 (1주)
- Phase 5: 최적화 및 안정화 (2-4주)
- 롤백 계획

**마이그레이션 순서:**
1. User Service (학습용, 위험 낮음)
2. Event Service (읽기 전용, 안전)
3. Queue Service (독립적, 확장 필요)
4. Ticket Service (핵심 로직, 신중)
5. Order Service (Payment와 연계)
6. Payment Service (가장 민감, 마지막)

**총 소요 기간: 12-13주**

---

### Part 6: 모니터링 및 비용 최적화
**[📖 읽기](./msa-migration-guide-06-monitoring-optimization.md)**

- 4-Layer 모니터링 아키텍처
- Prometheus + Grafana 스택
- 핵심 메트릭 및 알람 (Golden Signals)
- 분산 추적 (Jaeger)
- 로그 집계 (Loki)
- 비용 최적화 전략 (Spot 인스턴스, Savings Plans)
- SRE Best Practices
- TCO 및 ROI 분석

**비용 최적화 결과:**
- 최적화 전: $3,892/month
- 최적화 후: $1,784/month (54% 절감)
- 연간 절감: $21,192

---

## 🎯 핵심 성과 지표

### 성능 개선
| 지표 | 현재 (Monolith) | 목표 (MSA + K8s) | 개선율 |
|------|----------------|------------------|--------|
| 동시 접속 | 10,000명 | 300,000명 | **30배** |
| API 처리량 | 1,000 req/s | 50,000 req/s | **50배** |
| 응답 시간 (P99) | 500ms | 100ms | **80% 개선** |
| 가용성 | 95% | 99.9% | **263배** |
| 복구 시간 | 10분 (수동) | 30초 (자동) | **20배** |

### 비용 효율
- **TCO**: $5,550 → $3,784 (32% 절감)
- **사용자당 비용**: $0.555 → $0.0126 (44배 저렴)
- **연간 ROI**: 42%
- **투자 회수 기간**: 2.4년

### 운영 효율
- **배포 시간**: 30분 → 5분 (83% 단축)
- **배포 빈도**: 주 1회 → 일 5회 (자동화)
- **엔지니어 시간**: 70h/month → 30h/month (57% 절감)

---

## 🚀 시작하기

### Prerequisites
- AWS 계정 (Administrator 권한)
- Docker, kubectl, Helm 설치
- Kubernetes 기본 지식
- 예산: 초기 $50,000 (마이그레이션 비용), 월 $2,000-$4,000 (운영 비용)

### Quick Start

```bash
# 1. 저장소 클론
git clone https://github.com/your-org/tiketi
cd tiketi

# 2. 환경 변수 설정
cp .env.example .env
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY 등 설정

# 3. Terraform으로 인프라 생성
cd infrastructure/terraform
terraform init
terraform apply

# 4. EKS 클러스터 생성
cd ../eks
eksctl create cluster -f cluster.yaml

# 5. 서비스 배포 (Helm)
cd ../../
helm install tiketi charts/tiketi -f charts/tiketi/values-production.yaml

# 6. 트래픽 전환 (Canary)
kubectl apply -f canary/
```

### 마이그레이션 체크리스트

**Pre-Migration**
- [ ] AWS 계정 준비 완료
- [ ] 예산 승인 ($50k 초기 + $2-4k/월)
- [ ] 팀 교육 완료 (Kubernetes, Docker)
- [ ] 롤백 계획 수립
- [ ] 비즈니스 팀과 일정 조율

**Phase 1: 인프라 (Week 1-2)**
- [ ] VPC 생성 완료
- [ ] EKS 클러스터 실행 중
- [ ] RDS 생성 및 연결 테스트
- [ ] ElastiCache 생성 및 연결 테스트
- [ ] CI/CD 파이프라인 동작 확인

**Phase 2-5: 서비스 마이그레이션 (Week 3-13)**
- [ ] User Service 100% 전환
- [ ] Event Service 100% 전환
- [ ] Queue Service 100% 전환
- [ ] Ticket Service 100% 전환
- [ ] Order Service 100% 전환
- [ ] Payment Service 100% 전환

**Post-Migration**
- [ ] Monolith 서버 종료
- [ ] 비용 최적화 완료
- [ ] 문서화 완료
- [ ] 팀 회고

---

## 📊 아키텍처 다이어그램

### 현재 아키텍처 (Before)
```
┌─────────────────────────────────────────────┐
│            단일 EC2 Instance                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Frontend │  │ Backend  │  │ Database │  │
│  │ (React)  │  │ (Node.js)│  │(Postgres)│  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                              │
│  최대 처리: 10,000명 동시 접속                │
│  가용성: 95% (월 36시간 다운)                 │
└─────────────────────────────────────────────┘
```

### 목표 아키텍처 (After)
```
┌─────────────────────────────────────────────────────────┐
│                   CloudFront (CDN)                       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│              ALB (Application Load Balancer)             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│            EKS Cluster (Kubernetes)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Queue    │ │ Ticket   │ │ Order    │ │ Payment  │  │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │  │
│  │ (50 Pods)│ │ (30 Pods)│ │ (20 Pods)│ │ (15 Pods)│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ User     │ │ Event    │ │ Notify   │  + 2 more    │
│  │ Service  │ │ Service  │ │ Service  │               │
│  └──────────┘ └──────────┘ └──────────┘               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│                   Data Layer                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ RDS      │ │ElastiCache│ │ S3       │ │ MSK      │  │
│  │Postgres  │ │  Redis    │ │ (Images) │ │ (Kafka)  │  │
│  │ Multi-AZ │ │ Cluster   │ │          │ │          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘

최대 처리: 300,000명 동시 접속 (30배)
가용성: 99.9% (월 43분 다운)
```

---

## 🛠️ 기술 스택

### Frontend
- React 18.2.0
- Socket.IO Client 4.7.2
- Deployed to: S3 + CloudFront

### Backend (Microservices)
- Node.js 18 + Express
- Socket.IO 4.7.2 (WebSocket)
- PostgreSQL 15 (RDS)
- Redis 7 (ElastiCache)
- Kafka (MSK)

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes (Amazon EKS)
- **CI/CD**: GitHub Actions + ArgoCD
- **Monitoring**: Prometheus + Grafana
- **Logging**: Loki + Promtail
- **Tracing**: Jaeger
- **IaC**: Terraform + Helm

### AWS Services
- EKS, RDS, ElastiCache, MSK
- ALB, CloudFront, Route 53, WAF
- S3, Secrets Manager, CloudWatch

---

## 📖 참고 자료

### 공식 문서
- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)

### 서적
- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [Microservices Patterns - Chris Richardson](https://microservices.io/patterns/)
- [Designing Data-Intensive Applications - Martin Kleppmann](https://dataintensive.net/)

### 실제 사례
- [Ticketmaster Tech Blog](https://tech.ticketmaster.com/)
- [Spotify Engineering](https://engineering.atspotify.com/)
- [Netflix Tech Blog](https://netflixtechblog.com/)

---

## 🤝 기여

이 가이드는 실제 프로젝트 경험을 바탕으로 작성되었습니다. 개선 사항이나 질문이 있다면:

1. Issue를 생성하거나
2. Pull Request를 제출하거나
3. [이메일](mailto:team@tiketi.com)로 문의해주세요

---

## 📝 라이선스

이 문서는 [MIT License](../../LICENSE)로 배포됩니다.

---

## 👥 Authors

- **Architecture Team** - TIKETI Engineering
- **Contact**: team@tiketi.com

---

**마지막 업데이트**: 2024-12-02

**버전**: 1.0.0

**상태**: ✅ Production Ready
