# 클라우드 네이티브 심화 프로젝트 RFP
> 4팀 - 티켓팅 예약관리 플랫폼 “티케티(Tiketi)”

## 1. 프로젝트 개요

### 목적
- Docker Compose → Kubernetes/EKS 전환으로 무한 확장성 확보
- MSA 아키텍처 도입으로 서비스별 독립적 확장
- 대기열 시스템 고도화로 10,000명 동시접속 처리
- ArgoCD 도입으로 GitOps 기반 자동 배포 완성

### 범위
- 반응형 웹 구현 (모바일/데스크톱)
- K8s/EKS 마이그레이션 및 MSA 전환
- Redis 기반 대기열 시스템 구현
- Service Mesh(Istio) 및 GitOps(ArgoCD) 도입
- PG 연동을 통한 모의 결제 환경 구현

## 2. 현재 상태 (As-Is) vs 목표 상태 (To-Be)

| 구분 | As-Is | To-Be |
|------|-------|--------|
| **인프라** | Docker Compose (단일 EC2) | AWS EKS (Multi-AZ) |
| **아키텍처** | 모놀리식 | MSA (Auth/Ticket/Payment/Stats) |
| **확장성** | 수동 스케일링 | HPA/KEDA 자동 스케일링 |
| **동시접속** | 500명 | 10,000명 |
| **처리량** | 50 TPS | 1,000 TPS |
| **CI/CD** | GitHub Actions | GitHub Actions + ArgoCD |
| **모니터링** | Grafana (별도) | 통합 대시보드 |
| **결제** | 미구현 | 토스페이먼츠 샌드박스 연동 |

## 3. 핵심 요구사항

### 기능 요구사항
1. **대기열 시스템**: Redis Sorted Set 기반, 실시간 순번/예상시간
2. **고급 통계**: 시간대별/공연별 분석, 인기 좌석 히트맵
3. **캐싱**: 세션 관리, DB 부하 분산, 캐시 히트율 80%+
4. **MSA 서비스**: Auth, Ticket(Queue 포함), Payment, Stats Service 분리
5. **결제 시스템**: 토스페이먼츠 API 연동, Webhook 처리

### 비기능 요구사항
1. **성능**: 10,000 동시접속, 1,000 TPS, 응답시간 200ms (p95)
2. **가용성**: 99.9% SLA, RTO 5분, RPO 1분
3. **확장성**: 자동 스케일링 30초 내 작동
4. **보안**: mTLS, API Rate Limiting, DDoS 방어

## 4. 서비스 구조 및 산출물

### 1) MSA 아키텍처
- **Auth Service**: JWT 인증, OAuth 2.0, 사용자 관리
- **Ticket Service**: 공연/좌석 관리, 예매 처리, 대기열 관리
- **Payment Service**: 토스페이먼츠 연동, 결제 관리, Webhook 처리
- **Stats Service**: 실시간 통계, 분석 대시보드, 리포트 생성

### 2) 대기열 시스템
- 초기에는 Ticket Service 내 모듈로 구현, 필요시 독립 서비스로 분리 예정
- Redis 기반 실시간 대기열 (50K 동시 대기)
- KEDA 연동 큐 기반 오토스케일링
- WebSocket 실시간 순번 업데이트

### 3) Kubernetes/EKS
- Multi-AZ 고가용성 구성
- 오토스케일링: HPA + Cluster Autoscaler
- 리소스 최적화: VPA 분석으로 적정 리소스 산정
- Service Mesh (Istio) - mTLS, Circuit Breaker
- Helm Charts 패키징

### 4) GitOps(CI/CD)
- ArgoCD 자동 배포
- Blue/Green, Canary 배포 전략
- 배포 시간 5분 이내

### 5) 모니터링
- Prometheus + Loki + Grafana
- 통합 대시보드 (관리자 콘솔 임베드)
- 실시간 알림 및 자동 대응

### 6) 성능 요구사항 달성
- 목표: 10K 동시접속, 1K TPS 지원
- Auto Scaling 구성으로 부하 대응
- 실시간 모니터링으로 성능 추적
- 부하 테스트 결과 반영한 최적화

## 5. 프로젝트 일정

| 주차 | 일정 | 주요 작업 | 상세 내용 | 검증 기준 |
|------|------|-----------|--------------|-----------|
| **1주차** | ~12/12 | K8s 아키텍처 준비 | - 모놀리식 컨테이너화<br>- 서비스 분리 설계 | 로컬 K8s 환경에서 모든 Pod Running |
| **2주차** | ~12/19 | MSA 분리 시작 | - Auth Service 분리<br>- Ticket Service 분리 (Queue 모듈 포함) | Auth/Ticket Service API 테스트 통과<br>JWT 인증 동작 확인 |
| **3주차** | ~12/26 | 추가 MSA 구현 | - Payment Service 분리<br>- Stats Service 분리<br>- 서비스 간 통신 구현 | 테스트 결제 성공<br>통계 대시보드 동작 |
| **4주차** | ~1/2 | EKS 배포 및 안정화 | - 전체 MSA 통합<br>- ArgoCD 설정<br>- Service Mesh 적용 | EKS 프로덕션 배포 완료<br>부하 테스트 (1K TPS) 달성 |
| **5주차** | ~1/7 | 최종 점검 및 문서화 | - 성능 최적화<br>- Queue 분리 검토*<br>- 문서 작성 | 10K 동시접속 처리<br>Failover 30초 내 복구 |

\* Queue 분리 검토 기준:
  - 대기열 처리가 전체 성능의 병목인 경우
  - 독립적 스케일링 필요성이 확인된 경우
  - 프로젝트 일정에 여유가 있는 경우

## 6. 기술 스택

### 프론트엔드
- React 18 (반응형 웹)
- Socket.IO Client
- TailwindCSS/MUI

### 백엔드
- Node.js + Express
- Socket.IO Server
- JWT Authentication
- TypeScript

### 데이터베이스
- PostgreSQL (RDS)
- Redis/ElastiCache
- S3 (정적 파일)

### 인프라/DevOps
- AWS EKS
- Kubernetes 1.28+
- Istio Service Mesh (Jaeger 포함)
- ArgoCD GitOps
- Terraform IaC
- ECR (컨테이너 레지스트리)
- Secrets Manager 

### 모니터링
- Prometheus
- Loki
- Grafana
- CloudWatch (인프라 모니터링)

## 7. 성공 기준
### 기술적 성공 기준
- MSA 4개 서비스 정상 동작
- 10,000 동시접속 처리
- 1,000 TPS 달성
- 응답시간 200ms 이하 (p95)
- 가용성 99.9%
- 자동 스케일링 30초 내 작동

### 운영적 성공 기준
- 무중단 배포 실현
- GitOps 자동 배포 성공
- 운영 자동화 80% 이상
- 예매 성공률 95% 이상

## 8. 리스크 관리

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| 기술 학습 | 높음 | 팀 스터디, 단계적 전환, 템플릿 활용 |
| MSA 통합 복잡도 | 높음 | 서비스별 Mock API 구현, 단계별 통합 |
| 일정 지연 | 중간 | MVP 우선 개발, 버퍼 시간 확보 |
| 성능 목표 미달 | 높음 | 주차별 성능 테스트, 조기 최적화 |
| 비용 초과 | 낮음 | 일일 모니터링, Spot Instance 활용 |

## 9. 작업 정보
| 구분 |	URL |	비고 |
|---|---|---|
|🎨 Frontend |	https://tiketi.store	| |
|📘 API Documentation	| https://api.tiketi.store/api-docs/	| |
|📈 Grafana	| https://grafana.tiketi.store	| 관리자 접속: admin / tiketi123 |
|💻 Github Repository |	https://github.com/cchriscode/tiketi	|