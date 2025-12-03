# 📋 Tiketi MSA 마이그레이션 요구사항 정의서

**문서 버전**: 1.0
**작성일**: 2025-12-03
**프로젝트명**: Tiketi 마이크로서비스 아키텍처(MSA) 전환
**작성자**: Development Team

---

## 📌 1. 프로젝트 개요

### 1.1 프로젝트 목적

현재 모놀리식 아키텍처로 구성된 Tiketi 티켓팅 플랫폼을 마이크로서비스 아키텍처(MSA)로 전환하여 다음을 달성합니다:

- **확장성 향상**: 트래픽 증가 시 개별 서비스 단위 확장
- **유지보수성 개선**: 서비스 독립적 배포 및 업데이트
- **장애 격리**: 특정 서비스 장애가 전체 시스템에 영향을 미치지 않도록 구성
- **개발 생산성**: 팀별 독립적 개발 및 배포 가능
- **클라우드 네이티브**: Kubernetes 기반 클라우드 환경 최적화

### 1.2 현재 시스템 현황

**아키텍처**: 모놀리식 (단일 Node.js 백엔드)
**기술 스택**:
- Frontend: React 18
- Backend: Node.js + Express
- Database: PostgreSQL 16
- Cache/Queue: DragonflyDB (Redis 호환)
- Real-time: Socket.IO

**주요 기능**:
- 사용자 인증 (JWT 기반)
- 이벤트 조회 및 관리
- 대기열 시스템 (WebSocket)
- 좌석 선택 및 예매
- 결제 처리
- 관리자 대시보드

**현재 문제점**:
1. 트래픽 증가 시 전체 애플리케이션 확장 필요 (비효율적)
2. 단일 서비스 장애 시 전체 시스템 중단
3. 배포 시 전체 시스템 재시작 필요
4. 팀 간 코드 충돌 및 의존성 관리 어려움
5. 특정 기능(대기열, 결제) 독립적 확장 불가

### 1.3 목표 시스템 개요

**타겟 아키텍처**: 마이크로서비스 아키텍처 (6개 독립 서비스)
**배포 환경**: Kubernetes (로컬 Kind → AWS EKS)
**예상 개발 기간**: 8주 (2개월)

---

## 🏗️ 2. 시스템 아키텍처 요구사항

### 2.1 마이크로서비스 분리 전략

#### 서비스 구성 (6개)

```
1. Auth Service       - 인증/인가, JWT 발급, OAuth 2.0
2. Event Service      - 이벤트 조회, 공지사항, 이미지 관리
3. Queue Service      - 대기열 관리, WebSocket 연결
4. Reservation Service - 예매 처리, 좌석 관리
5. Payment Service    - 결제 처리, 포인트 시스템 (신규)
6. Notification Service - 이메일/푸시 알림 (신규)
```

#### 서비스별 독립성 요구사항

**R-ARCH-001**: 각 서비스는 독립적인 Git 저장소 또는 모노레포 내 독립 디렉토리 구조
**R-ARCH-002**: 각 서비스는 자체 package.json 및 의존성 관리
**R-ARCH-003**: 서비스 간 직접 DB 접근 금지, API 통신만 허용
**R-ARCH-004**: 각 서비스는 독립적으로 배포 가능
**R-ARCH-005**: 공통 라이브러리는 shared/ 디렉토리로 분리

### 2.2 데이터베이스 전략

**R-DATA-001**: PostgreSQL 단일 인스턴스 유지 (초기 단계)
**R-DATA-002**: 각 서비스는 자신의 테이블만 관리 (논리적 분리)
**R-DATA-003**: 서비스 간 데이터 조회는 API 호출을 통해서만 수행
**R-DATA-004**: 트랜잭션이 필요한 경우 Saga 패턴 또는 2PC 고려
**R-DATA-005**: Redis는 대기열, 캐싱, 분산 락 용도로 공유 사용

#### 데이터베이스 소유권

| 서비스 | 담당 테이블 |
|--------|------------|
| Auth Service | users |
| Event Service | events, news |
| Reservation Service | reservations, seats |
| Payment Service | payments, points, point_histories |
| Notification Service | (없음, 이벤트 소비만) |

### 2.3 서비스 간 통신

**R-COMM-001**: REST API 기반 동기 통신 (HTTP/JSON)
**R-COMM-002**: 이벤트 기반 비동기 통신 (향후 메시지 큐 도입)
**R-COMM-003**: WebSocket은 Queue Service에서만 관리
**R-COMM-004**: 서비스 디스커버리는 Kubernetes DNS 활용
**R-COMM-005**: API Gateway는 향후 단계에서 도입 검토

---

## 🔐 3. 기능 요구사항

### 3.1 Auth Service (인증/인가)

**R-AUTH-001**: 기존 이메일/비밀번호 로그인 유지
**R-AUTH-002**: 구글 OAuth 2.0 로그인 추가 (신규)
**R-AUTH-003**: JWT 토큰 발급 및 검증
**R-AUTH-004**: 회원가입 및 프로필 관리
**R-AUTH-005**: 비밀번호 암호화 (bcrypt)

**신규 기능**:
- 구글 로그인 시 자동 회원가입
- OAuth provider 정보 저장 (LOCAL/GOOGLE)
- 프로필 이미지 URL 저장

### 3.2 Event Service (이벤트 조회)

**R-EVENT-001**: 이벤트 목록 조회 (필터링, 페이지네이션)
**R-EVENT-002**: 이벤트 상세 정보 조회
**R-EVENT-003**: 공지사항 관리
**R-EVENT-004**: 이미지 업로드 (AWS S3 연동)
**R-EVENT-005**: 이벤트 상태 자동 업데이트 (예정→진행중→종료)

### 3.3 Queue Service (대기열 관리)

**R-QUEUE-001**: Redis Sorted Set 기반 FIFO 대기열
**R-QUEUE-002**: WebSocket 실시간 순번 알림
**R-QUEUE-003**: 새로고침 시 순번 유지
**R-QUEUE-004**: 입장 허가 시 Reservation Service 호출
**R-QUEUE-005**: 대기열 상태 조회 API

### 3.4 Reservation Service (예매 처리)

**R-RSV-001**: 좌석 조회 (실시간 상태 반영)
**R-RSV-002**: 좌석 선택 (분산 락으로 동시성 제어)
**R-RSV-003**: 예매 생성 (PENDING 상태)
**R-RSV-004**: 결제 완료 시 예매 확정 (CONFIRMED)
**R-RSV-005**: 예매 취소 (환불 처리)
**R-RSV-006**: 미결제 예매 자동 취소 (10분 타임아웃)
**R-RSV-007**: 티켓 조회 (예매 내역)

### 3.5 Payment Service (결제 처리) ⭐ 신규

**R-PAY-001**: 외부 PG사 연동 (토스페이먼츠 등)
**R-PAY-002**: 카드 결제 처리
**R-PAY-003**: 포인트 충전 기능 (신규)
**R-PAY-004**: 포인트 사용 기능 (신규)
**R-PAY-005**: 포인트 + 카드 혼합 결제 지원
**R-PAY-006**: 결제 완료 시 Reservation Service로 이벤트 발행
**R-PAY-007**: 환불 처리 (포인트 복원 포함)
**R-PAY-008**: 포인트 거래 이력 관리

#### 포인트 시스템 상세 요구사항

**R-POINT-001**: 사용자당 포인트 잔액 관리 (points 테이블)
**R-POINT-002**: 포인트 충전 시 PG사를 통한 결제 필수
**R-POINT-003**: 포인트 사용 시 잔액 확인 후 차감
**R-POINT-004**: 포인트 거래 이력 기록 (type: CHARGE/USE/REFUND)
**R-POINT-005**: 포인트와 카드 결제 금액 분리 저장
**R-POINT-006**: 예매 취소 시 사용한 포인트 자동 환불
**R-POINT-007**: 포인트 거래는 트랜잭션으로 원자성 보장

### 3.6 Notification Service (알림) ⭐ 신규

**R-NOTI-001**: 이메일 발송 (AWS SES 또는 SendGrid)
**R-NOTI-002**: 예매 완료 알림 이메일
**R-NOTI-003**: 결제 완료 알림 이메일
**R-NOTI-004**: 예매 취소 알림 이메일
**R-NOTI-005**: 이벤트 기반 알림 처리 (비동기)
**R-NOTI-006**: 알림 템플릿 관리
**R-NOTI-007**: (선택) 푸시 알림 (FCM)

---

## 🛡️ 4. 비기능 요구사항

### 4.1 성능 요구사항

**R-PERF-001**: API 응답 시간 평균 200ms 이하
**R-PERF-002**: 대기열 입장 처리 1초에 최소 100명
**R-PERF-003**: 동시 접속자 10,000명 지원
**R-PERF-004**: 좌석 선택 동시성 제어 (분산 락)
**R-PERF-005**: Redis 캐싱으로 DB 부하 최소화

### 4.2 확장성 요구사항

**R-SCALE-001**: 서비스별 독립적 수평 확장 (HPA)
**R-SCALE-002**: Queue Service 우선 확장 (트래픽 집중)
**R-SCALE-003**: Kubernetes Deployment replica 설정
**R-SCALE-004**: PostgreSQL 연결 풀 관리
**R-SCALE-005**: Redis Pub/Sub로 WebSocket 메시지 동기화

### 4.3 가용성 요구사항

**R-AVAIL-001**: 서비스 가동률 99.9% 이상
**R-AVAIL-002**: 단일 서비스 장애 시 타 서비스 정상 동작
**R-AVAIL-003**: Health Check 엔드포인트 제공 (/health)
**R-AVAIL-004**: Kubernetes Liveness/Readiness Probe 설정
**R-AVAIL-005**: Circuit Breaker 패턴 적용 (향후)

### 4.4 보안 요구사항

**R-SEC-001**: JWT 토큰 기반 인증 유지
**R-SEC-002**: HTTPS 통신 (프로덕션)
**R-SEC-003**: 민감 정보 환경 변수로 관리 (Secret)
**R-SEC-004**: SQL Injection 방지 (Parameterized Query)
**R-SEC-005**: CORS 정책 설정
**R-SEC-006**: Rate Limiting (향후)

### 4.5 모니터링 요구사항

**R-MONITOR-001**: Prometheus로 메트릭 수집
**R-MONITOR-002**: Grafana 대시보드 구성
**R-MONITOR-003**: Loki로 로그 중앙화
**R-MONITOR-004**: 각 서비스별 로그 레벨 설정
**R-MONITOR-005**: 에러 로그 집계 및 알림

---

## 🧪 5. 테스트 요구사항

### 5.1 단위 테스트

**R-TEST-001**: 각 서비스 코드 커버리지 70% 이상
**R-TEST-002**: Jest 또는 Mocha 테스트 프레임워크 사용
**R-TEST-003**: 비즈니스 로직 단위 테스트 필수

### 5.2 통합 테스트

**R-TEST-004**: 서비스 간 API 통신 테스트
**R-TEST-005**: 데이터베이스 연동 테스트
**R-TEST-006**: Redis 연동 테스트
**R-TEST-007**: 전체 예매 플로우 E2E 테스트

### 5.3 부하 테스트

**R-TEST-008**: 동시 사용자 10,000명 시나리오
**R-TEST-009**: 대기열 병목 구간 식별
**R-TEST-010**: 데이터베이스 쿼리 성능 측정

---

## 🔄 6. 마이그레이션 전략

### 6.1 단계별 마이그레이션

#### Phase 0: 준비 (1주)
- Kind 클러스터 구축
- PostgreSQL & Redis 배포
- 공통 라이브러리 분리
- CI/CD 파이프라인 설정

#### Phase 1: Auth Service (1주)
- 코드 분리 및 서비스 생성
- 구글 OAuth 구현
- K8s 배포 및 테스트

#### Phase 2: Event Service (1주)
- 코드 분리
- S3 이미지 업로드 구현
- K8s 배포 및 테스트

#### Phase 3: Payment Service (1.5주) ⭐ 중요
- 신규 서비스 생성
- 포인트 시스템 구현
- PG사 연동
- K8s 배포 및 통합 테스트

#### Phase 4: Queue Service (1주)
- WebSocket 분리
- Redis Pub/Sub 설정
- K8s 배포 및 테스트

#### Phase 5: Reservation Service (1.5주)
- 코드 분리
- Payment Service 연동
- 분산 락 구현
- K8s 배포 및 통합 테스트

#### Phase 6: Notification Service (1주)
- 신규 서비스 생성
- 이메일 발송 구현
- 이벤트 소비 로직

#### Phase 7: 개선 및 최적화 (1주)
- Circuit Breaker 추가
- Optimistic Locking
- 전체 통합 테스트

### 6.2 롤백 전략

**R-MIGRATION-001**: 각 Phase 완료 후 Git 태그 생성
**R-MIGRATION-002**: 마이그레이션 실패 시 이전 버전 롤백 가능
**R-MIGRATION-003**: 데이터베이스 마이그레이션 스크립트 관리
**R-MIGRATION-004**: Blue-Green 배포 전략 사용 (프로덕션)

---

## 📊 7. 성공 지표 (KPI)

### 7.1 기술적 지표

- ✅ 6개 마이크로서비스 정상 배포
- ✅ 각 서비스 독립적 확장 가능
- ✅ API 응답 시간 200ms 이하
- ✅ 서비스 가동률 99.9% 이상
- ✅ 코드 커버리지 70% 이상

### 7.2 비즈니스 지표

- ✅ 배포 시간 50% 단축 (전체 재시작 → 개별 서비스 배포)
- ✅ 장애 격리율 100% (특정 서비스 장애 시 타 서비스 정상)
- ✅ 개발 생산성 30% 향상 (팀별 독립 개발)
- ✅ 트래픽 증가 시 자동 확장 성공

### 7.3 사용자 지표

- ✅ 대기열 처리 속도 향상
- ✅ 예매 성공률 유지 또는 향상
- ✅ 시스템 다운타임 최소화

---

## 🚫 8. 제약사항 및 가정

### 8.1 제약사항

**C-001**: 로컬 환경은 Kind 사용 (Minikube 제외)
**C-002**: 데이터베이스는 단일 PostgreSQL 인스턴스 유지
**C-003**: 서비스 간 트랜잭션은 Saga 패턴으로 처리
**C-004**: 초기 단계에서는 API Gateway 미도입
**C-005**: 메시지 큐는 향후 단계에서 도입 (초기는 HTTP 통신)

### 8.2 가정

**A-001**: 개발팀은 Kubernetes 기본 지식 보유
**A-002**: AWS 계정 및 EKS 사용 가능
**A-003**: 구글 OAuth Client ID/Secret 발급 가능
**A-004**: PG사 API 테스트 계정 보유
**A-005**: 이메일 발송 서비스 (SES 또는 SendGrid) 계정 보유

---

## 📝 9. 우선순위

### High (필수)
- Auth Service 분리 및 구글 로그인
- Payment Service 및 포인트 시스템
- Reservation Service 분리
- Queue Service 분리
- 기본 모니터링 (Prometheus + Grafana)

### Medium (중요)
- Event Service 분리
- Notification Service
- Circuit Breaker 구현
- 통합 테스트 자동화

### Low (선택)
- API Gateway 도입
- 메시지 큐 도입 (RabbitMQ, Kafka)
- 서비스 메시 (Istio)
- Advanced 모니터링 (X-Ray, APM)

---

## 📚 10. 참고 문서

- [MSA 마이그레이션 가이드](./msa-migration-guide.md)
- [MSA 로컬 다이어그램](./msa-local-diagrams.md)
- [클라우드 제안서](./cloud-proposal.md)
- [Phase 별 상세 구현 가이드](./phases/)

---

## ✅ 승인 및 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내역 |
|------|------|--------|-----------|
| 1.0 | 2025-12-03 | Development Team | 초안 작성 |

---

**문서 종료**
