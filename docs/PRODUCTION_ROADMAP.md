# 🚀 TIKETI - 프로덕션 배포 로드맵

> 목업(현재) → 프로덕션(AWS 인프라) 마이그레이션 가이드

**목표 아키텍처**: 월 ₩152k, 5,000명 사용자 지원, Seoul Region

---

## 📊 현재 상태 (Phase 0: 로컬 목업)

✅ **완료된 것**
- [x] Docker Compose 기반 로컬 환경
- [x] PostgreSQL + DragonflyDB
- [x] React 프론트엔드 (기본 UI)
- [x] Express 백엔드 (기본 API)
- [x] JWT 인증
- [x] 예매 시스템 (분산 락)
- [x] 관리자 대시보드
- [x] Git 버전 관리

---

## 🎯 Phase 1: 웹사이트 기능 완성 (2-3주)

### 1.1 사용자 기능 강화

#### 🔐 인증/회원
- [ ] 이메일 인증 (회원가입 시)
- [ ] 비밀번호 찾기/재설정
- [ ] 소셜 로그인 (카카오, 네이버, Google)
- [ ] 회원 프로필 수정
- [ ] 회원 탈퇴

#### 🎫 예매 기능 고도화
- [ ] 좌석 선택 UI (좌석 배치도)
  - Canvas/SVG 기반 좌석 맵
  - 실시간 예약 상태 표시
  - 드래그 선택 지원
- [ ] 예매 타이머 (5분 제한)
  - Redis TTL 활용
  - 타이머 UI 표시
  - 시간 초과 시 자동 취소
- [ ] 대기열 시스템 (트래픽 폭주 대비)
  - Bull Queue 사용
  - 대기 순번 표시
  - 입장 알림
- [ ] 예매 확인증 다운로드 (PDF)
- [ ] 티켓 QR 코드 생성

#### 🔍 검색 & 필터
- [ ] 이벤트 검색 (제목, 장소, 날짜)
  - PostgreSQL Full-Text Search
  - 자동완성 (Autocomplete)
- [ ] 고급 필터링
  - 카테고리별 (콘서트, 뮤지컬, 스포츠 등)
  - 가격대별
  - 날짜 범위
  - 지역별
- [ ] 정렬 (인기순, 최신순, 가격순)

#### 📱 반응형 UI 개선
- [ ] 모바일 최적화
  - 햄버거 메뉴
  - 터치 제스처
  - 모바일 결제 UI
- [ ] 태블릿 레이아웃
- [ ] 다크 모드
- [ ] 접근성 (WCAG 2.1 AA)

---

### 1.2 관리자 기능 강화

#### 📊 대시보드 고도화
- [ ] 실시간 통계 차트
  - Chart.js / Recharts
  - 일별/주별/월별 매출
  - 이벤트별 판매 현황
- [ ] 실시간 예매 현황 모니터
- [ ] 환불 관리
- [ ] 사용자 관리
  - 검색, 필터링
  - 계정 정지/해제
  - 예매 내역 조회

#### 🎭 이벤트 관리 고도화
- [ ] 이미지 업로드
  - Multer + AWS S3
  - 이미지 리사이징 (Sharp)
  - 썸네일 자동 생성
- [ ] 카테고리 관리
- [ ] 좌석 배치도 에디터
- [ ] 이벤트 복제 기능
- [ ] 대량 티켓 생성 (CSV 업로드)

#### 📈 리포트 & 분석
- [ ] 매출 리포트 (일/월/년)
- [ ] 이벤트별 수익 분석
- [ ] 고객 분석 (재방문율 등)
- [ ] CSV/Excel 내보내기

---

### 1.3 결제 시스템 연동

#### 💳 PG사 연동
- [ ] **토스페이먼츠** 연동 (추천)
  ```javascript
  - 카드 결제
  - 간편 결제 (토스페이, 카카오페이, 네이버페이)
  - 계좌이체
  - 가상계좌
  ```
- [ ] 결제 웹훅 처리
- [ ] 결제 실패 처리
- [ ] 자동 환불 시스템
- [ ] 결제 내역 관리
- [ ] 영수증 발행

**예상 비용**: 결제 수수료 3.3%

---

### 1.4 알림 시스템

#### 📧 이메일 알림
- [ ] SendGrid / AWS SES 연동
- [ ] 예매 확인 이메일
- [ ] 예매 취소 이메일
- [ ] 이벤트 리마인더 (D-1, D-7)
- [ ] 이메일 템플릿 (HTML)

#### 📱 푸시 알림
- [ ] 웹 푸시 (Progressive Web App)
- [ ] 예매 성공 알림
- [ ] 대기열 입장 알림

#### 💬 SMS 알림 (선택)
- [ ] 예매 확인 문자
- [ ] 이벤트 리마인더

**예상 비용**: 이메일 ₩1k/월, SMS ₩3k/월

---

### 1.5 추가 기능

- [ ] **쿠폰 & 할인**
  - 쿠폰 코드 시스템
  - 조기예매 할인
  - 회원 등급별 할인
- [ ] **리뷰 & 평점**
  - 이벤트 종료 후 리뷰 작성
  - 별점 시스템
  - 포토 리뷰
- [ ] **위시리스트 (찜하기)**
  - 관심 이벤트 저장
  - 판매 시작 알림
- [ ] **공유 기능**
  - SNS 공유 (카카오톡, 페이스북)
  - Open Graph 메타 태그
- [ ] **FAQ & 고객센터**
  - 자주 묻는 질문
  - 1:1 문의
  - 공지사항

---

## ☁️ Phase 2: AWS 인프라 구축 (3-4주)

### 2.1 네트워크 & DNS

#### Route 53
- [ ] 도메인 구매 (`tiketi.gg`)
- [ ] Hosted Zone 생성
- [ ] DNS 레코드 설정
  - A Record → CloudFront
  - CNAME → www

**비용**: ₩500/월

---

#### CloudFront CDN
- [ ] Distribution 생성
- [ ] Origin 설정
  - S3 (정적 파일)
  - ALB (동적 콘텐츠)
- [ ] 캐시 정책 설정
  - 정적 파일: 1년
  - API: No-cache
- [ ] HTTPS 설정 (ACM 인증서)
- [ ] Gzip 압축
- [ ] 커스텀 에러 페이지

**비용**: FREE (1TB까지)

---

#### ACM (Certificate Manager)
- [ ] SSL/TLS 인증서 발급
  - CloudFront용 (us-east-1)
  - ALB용 (ap-northeast-2)
- [ ] 자동 갱신 설정

**비용**: FREE

---

### 2.2 VPC 구성

#### VPC 생성
```
10.0.0.0/16
├── Public Subnet (10.0.1.0/24, 10.0.2.0/24)
│   ├── ALB
│   └── NAT Gateway
└── Private Subnet (10.0.10.0/24, 10.0.11.0/24)
    ├── EC2 Instances
    ├── Aurora
    └── DragonflyDB
```

- [ ] VPC 생성 (10.0.0.0/16)
- [ ] Public Subnet × 2 (Multi-AZ)
- [ ] Private Subnet × 2 (Multi-AZ)
- [ ] Internet Gateway
- [ ] NAT Gateway (Single AZ)
  - 비용 절감: 1개만 사용
  - 향후 Multi-AZ 확장 가능
- [ ] Route Tables 설정
- [ ] Security Groups 설정
  ```
  alb-sg: 80, 443 → 0.0.0.0/0
  ec2-sg: 3001 → alb-sg
  db-sg: 5432 → ec2-sg
  redis-sg: 6379 → ec2-sg
  ```
- [ ] NACL 설정

**비용**: NAT Gateway ₩5k/월

---

### 2.3 컴퓨팅 (EC2)

#### Application Load Balancer
- [ ] ALB 생성 (Public Subnet)
- [ ] Target Groups 설정
  - Frontend (포트 3000)
  - Backend API (포트 3001)
- [ ] Health Check 설정
- [ ] HTTPS 리스너 (443)
- [ ] HTTP → HTTPS 리다이렉트
- [ ] Sticky Session 설정

**비용**: ₩27k/월

---

#### EC2 Instances (Docker Compose)

**EC2-1: Frontend + Inventory**
- [ ] t3.medium 인스턴스 생성
- [ ] Amazon Linux 2023
- [ ] Docker Engine 설치
- [ ] docker-compose 설치
- [ ] 프로젝트 배포
  ```yaml
  services:
    gateway:
    inventory: (×3 replicas)
  ```
- [ ] CloudWatch Agent 설치
- [ ] IAM Role 연결 (S3, CloudWatch)

**비용**: ₩40k/월

---

**EC2-2: Backend Services + Monitoring**
- [ ] t3.small 인스턴스 생성
- [ ] Docker Compose 설정
  ```yaml
  services:
    backend: (merged: auth+event+notify)
    order:
    prometheus:
    grafana:
    loki:
  ```
- [ ] 모니터링 스택 설정

**비용**: ₩20k/월

---

#### Auto Scaling Group
- [ ] Launch Template 생성
- [ ] ASG 설정
  - Min: 2, Desired: 3, Max: 10
- [ ] Scaling Policy
  - CPU > 70% → +2 instances
  - CPU < 30% → -1 instance
- [ ] CloudWatch Alarms
- [ ] `docker-compose --scale` 스크립트

**추가 비용**: 트래픽 증가 시 인스턴스당 ₩20k-40k

---

### 2.4 데이터베이스

#### Aurora Serverless v2 (PostgreSQL)
- [ ] DB Cluster 생성
- [ ] Subnet Group (Private Subnet)
- [ ] Security Group 설정
- [ ] ACU 설정 (0.5 - 2)
- [ ] 백업 설정 (7일 보관)
- [ ] 스냅샷 자동화
- [ ] Parameter Group 튜닝
- [ ] 마이그레이션
  ```bash
  pg_dump → Aurora 복원
  ```

**비용**: ₩57k/월

---

#### DragonflyDB (Self-hosted)
- [ ] EC2-2에 Docker로 설치
- [ ] 데이터 영속성 설정
- [ ] 백업 스크립트
- [ ] 메모리 제한 설정

**비용**: FREE (EC2에 포함)

---

### 2.5 스토리지

#### S3 Buckets
- [ ] `tiketi-static` (정적 파일)
  - React 빌드 파일
  - 이미지, CSS, JS
  - CloudFront Origin
- [ ] `tiketi-uploads` (사용자 업로드)
  - 이벤트 포스터
  - 프로필 사진
- [ ] `tiketi-logs` (로그 저장)
- [ ] `tiketi-backups` (DB 백업)
- [ ] Lifecycle Policy 설정
  - 30일 후 Glacier로 이동
- [ ] Versioning 활성화

**비용**: ₩2k/월 (50GB)

---

#### VPC Endpoint (S3 Gateway)
- [ ] S3 Gateway Endpoint 생성
- [ ] Route Table 연결
- [ ] NAT 비용 절감

**비용**: FREE

---

### 2.6 보안

#### AWS WAF (선택)
- [ ] WebACL 생성
- [ ] CloudFront 연결
- [ ] 규칙 설정
  - Rate Limiting (100 req/5min)
  - SQL Injection 차단
  - XSS 차단
  - Bot Control

**비용**: ₩5k/월 (최소) → 초기에는 생략 가능

---

#### AWS Secrets Manager
- [ ] DB 비밀번호 저장
- [ ] JWT Secret 저장
- [ ] PG API Key 저장
- [ ] 자동 로테이션 설정

**비용**: ₩2k/월

---

#### IAM 설정
- [ ] EC2 Role (S3, CloudWatch 접근)
- [ ] Lambda Role (있을 경우)
- [ ] 최소 권한 원칙 적용
- [ ] MFA 활성화 (Root 계정)

---

### 2.7 모니터링 (Self-hosted)

#### Prometheus
- [ ] EC2-2에 Docker로 설치
- [ ] Node Exporter 설치
- [ ] Target 설정 (EC2-1, EC2-2)
- [ ] Alert Rules 설정

#### Grafana
- [ ] Prometheus 연동
- [ ] 대시보드 구성
  - 시스템 메트릭
  - 애플리케이션 메트릭
  - 비즈니스 메트릭 (예매 수, 매출)

#### Loki
- [ ] 로그 수집 설정
- [ ] Docker 로그 연동
- [ ] Grafana 연동

**비용**: FREE (vs DataDog ₩40k/월 절약)

---

## 🚢 Phase 3: CI/CD 파이프라인 (1-2주)

### 3.1 GitHub Actions

#### 백엔드 파이프라인
```yaml
.github/workflows/backend.yml
```
- [ ] 코드 푸시 시 자동 테스트
- [ ] Docker 이미지 빌드
- [ ] ECR에 푸시
- [ ] EC2 배포 트리거

#### 프론트엔드 파이프라인
```yaml
.github/workflows/frontend.yml
```
- [ ] 코드 푸시 시 자동 테스트
- [ ] React 빌드
- [ ] S3 업로드
- [ ] CloudFront 캐시 무효화

---

### 3.2 Blue/Green 배포

- [ ] Target Group 2개 생성
  - Blue (현재 버전)
  - Green (새 버전)
- [ ] 배포 스크립트
  ```bash
  1. Green에 새 버전 배포
  2. Health Check 통과 확인
  3. ALB 트래픽 Green으로 전환
  4. Blue 종료
  ```
- [ ] 롤백 스크립트

---

### 3.3 데이터베이스 마이그레이션

- [ ] **Flyway** 또는 **Sequelize Migrations**
- [ ] 버전 관리
- [ ] 자동 마이그레이션 (배포 시)
- [ ] 롤백 전략

---

## 📊 Phase 4: 성능 최적화 (1주)

### 4.1 캐싱 전략 고도화

#### Redis (DragonflyDB)
- [ ] 캐시 워밍 (서버 시작 시)
- [ ] Cache-Aside 패턴 적용
- [ ] TTL 최적화
  - 이벤트 목록: 5분
  - 이벤트 상세: 2분
  - 사용자 세션: 7일
- [ ] Cache Stampede 방지

#### CloudFront
- [ ] 캐시 키 최적화
- [ ] Query String 처리
- [ ] Cookie 처리
- [ ] Compression 활성화

---

### 4.2 데이터베이스 최적화

- [ ] **인덱스 최적화**
  ```sql
  CREATE INDEX idx_events_date_status ON events(event_date, status);
  CREATE INDEX idx_reservations_user_date ON reservations(user_id, created_at);
  ```
- [ ] **쿼리 최적화**
  - N+1 문제 해결 (JOIN 사용)
  - EXPLAIN ANALYZE
- [ ] **Connection Pool 튜닝**
  - Max: 20 → 50
- [ ] **Read Replica** (향후)

---

### 4.3 이미지 최적화

- [ ] WebP 포맷 변환
- [ ] 이미지 리사이징
  - 썸네일: 300×300
  - 중간: 800×600
  - 원본: 1920×1080
- [ ] Lazy Loading
- [ ] CloudFront Image Optimization

---

### 4.4 코드 최적화

#### 프론트엔드
- [ ] Code Splitting
- [ ] Tree Shaking
- [ ] Lazy Loading (React.lazy)
- [ ] Memoization (useMemo, React.memo)
- [ ] 번들 크기 분석 (webpack-bundle-analyzer)

#### 백엔드
- [ ] 비동기 처리 (async/await)
- [ ] Streaming (대량 데이터)
- [ ] Rate Limiting
- [ ] Request Timeout 설정

---

## 🔒 Phase 5: 보안 강화 (1주)

### 5.1 애플리케이션 보안

- [ ] **Helmet.js** (Express)
  - XSS 방지
  - CSRF 방지
  - Clickjacking 방지
- [ ] **Rate Limiting**
  - 로그인: 5회/분
  - API: 100회/분
  - 예매: 10회/분
- [ ] **Input Validation**
  - Joi 또는 Yup
  - 모든 API 엔드포인트
- [ ] **SQL Injection 방지**
  - Parameterized Query (이미 적용)
- [ ] **CORS 정책**
  - 허용 도메인 명시
- [ ] **JWT 보안**
  - Refresh Token 도입
  - 토큰 블랙리스트

---

### 5.2 인프라 보안

- [ ] **Security Group 최소화**
  - 불필요한 포트 차단
  - Source IP 제한
- [ ] **VPC Flow Logs**
  - 네트워크 트래픽 모니터링
- [ ] **CloudTrail**
  - AWS API 호출 기록
- [ ] **AWS Config**
  - 리소스 변경 추적
- [ ] **GuardDuty** (선택)
  - 위협 탐지

---

### 5.3 데이터 보안

- [ ] **암호화**
  - RDS: At-rest encryption
  - S3: Server-side encryption
  - 전송 중: TLS 1.3
- [ ] **백업**
  - Aurora: 자동 백업 (7일)
  - S3: Versioning
  - 정기 스냅샷
- [ ] **개인정보 보호**
  - 비밀번호: bcrypt (이미 적용)
  - 개인정보: 마스킹
  - GDPR 준수 (EU 사용자 대상 시)

---

## 📈 Phase 6: 모니터링 & 알림 (1주)

### 6.1 애플리케이션 모니터링

#### Prometheus + Grafana
- [ ] 커스텀 메트릭
  ```javascript
  - 예매 성공/실패율
  - API 응답 시간
  - DB 쿼리 시간
  - 분산 락 대기 시간
  ```
- [ ] 대시보드
  - 실시간 예매 현황
  - 트래픽 모니터링
  - 에러율
  - 시스템 리소스

#### Loki
- [ ] 로그 수집
  - 애플리케이션 로그
  - 액세스 로그
  - 에러 로그
- [ ] 로그 레벨 설정
- [ ] 로그 검색 & 필터

---

### 6.2 인프라 모니터링

#### CloudWatch
- [ ] EC2 메트릭
  - CPU, Memory, Disk
- [ ] ALB 메트릭
  - Request Count, Latency
- [ ] Aurora 메트릭
  - Connections, CPU
- [ ] Custom Metrics
  - 예매 수, 매출

#### CloudWatch Alarms
- [ ] CPU > 80% (5분)
- [ ] ALB 5xx > 10 (1분)
- [ ] DB Connection > 80%
- [ ] Disk > 90%

---

### 6.3 알림 설정

- [ ] SNS Topic 생성
- [ ] 이메일 구독
- [ ] Slack 연동 (Webhook)
- [ ] PagerDuty (선택)

---

## 🧪 Phase 7: 테스트 & QA (2주)

### 7.1 자동화 테스트

#### 백엔드
- [ ] **Unit Test** (Jest)
  - 각 함수별 테스트
  - 커버리지 80% 이상
- [ ] **Integration Test**
  - API 엔드포인트 테스트
  - DB 연동 테스트
- [ ] **E2E Test** (Supertest)
  - 전체 플로우 테스트

#### 프론트엔드
- [ ] **Unit Test** (Jest + React Testing Library)
  - 컴포넌트별 테스트
- [ ] **E2E Test** (Cypress)
  - 회원가입 → 로그인 → 예매
  - 관리자 플로우

---

### 7.2 성능 테스트

- [ ] **Load Test** (Artillery, k6)
  - 5,000명 동시 접속
  - 100 TPS 처리
- [ ] **Stress Test**
  - 한계점 찾기
  - 병목 지점 파악
- [ ] **Spike Test**
  - 순간 트래픽 폭증 대응

---

### 7.3 보안 테스트

- [ ] **Penetration Test**
  - SQL Injection
  - XSS
  - CSRF
- [ ] **Dependency Scan**
  - npm audit
  - Snyk
- [ ] **OWASP Top 10 점검**

---

## 📱 Phase 8: 추가 기능 (선택, 2-4주)

### 8.1 Progressive Web App (PWA)
- [ ] Service Worker
- [ ] Offline 지원
- [ ] 홈 화면 추가
- [ ] 웹 푸시 알림

### 8.2 실시간 기능 (WebSocket)
- [ ] Socket.io 연동
- [ ] 실시간 좌석 현황
- [ ] 실시간 대기열
- [ ] 채팅 상담

### 8.3 다국어 지원 (i18n)
- [ ] react-i18next
- [ ] 한국어, 영어
- [ ] 언어 전환 UI

### 8.4 앱 개발 (향후)
- [ ] React Native
- [ ] Flutter
- [ ] App Store / Play Store 출시

---

## 💰 예상 비용 정리

### 월간 비용 (프로덕션)

| 항목 | 비용 | 비고 |
|------|------|------|
| **컴퓨팅** |
| EC2 t3.medium × 1 | ₩40,000 | Frontend + Inventory |
| EC2 t3.small × 1 | ₩20,000 | Backend + Monitoring |
| ALB | ₩27,000 | |
| **데이터베이스** |
| Aurora Serverless v2 | ₩57,000 | 0.5-2 ACU |
| **스토리지 & CDN** |
| S3 (50GB) | ₩2,000 | |
| CloudFront | ₩0 | 1TB 프리티어 |
| **네트워크** |
| NAT Gateway | ₩5,000 | Single AZ |
| Data Transfer | ₩500 | |
| **기타** |
| Route 53 | ₩500 | |
| Secrets Manager | ₩2,000 | |
| **합계** | **₩154,000/월** | |

### 추가 비용 (트래픽 증가 시)

| 항목 | 예상 비용 |
|------|----------|
| Auto Scaling (EC2 추가) | ₩20-40k/인스턴스 |
| WAF | ₩5k-20k |
| 결제 수수료 | 거래액의 3.3% |
| 이메일 (SendGrid) | ₩1k |
| SMS | ₩3k |

---

## 📅 전체 일정 요약

| Phase | 기간 | 주요 작업 |
|-------|------|----------|
| **Phase 1** | 2-3주 | 웹사이트 기능 완성 |
| **Phase 2** | 3-4주 | AWS 인프라 구축 |
| **Phase 3** | 1-2주 | CI/CD 파이프라인 |
| **Phase 4** | 1주 | 성능 최적화 |
| **Phase 5** | 1주 | 보안 강화 |
| **Phase 6** | 1주 | 모니터링 설정 |
| **Phase 7** | 2주 | 테스트 & QA |
| **Phase 8** | 2-4주 | 추가 기능 (선택) |
| **총계** | **11-18주** | **(약 3-4개월)** |

---

## 🎯 우선순위

### 🔥 High Priority (필수)
1. 결제 시스템 연동
2. AWS 인프라 마이그레이션
3. CI/CD 파이프라인
4. 모니터링 설정
5. 보안 강화

### 🟡 Medium Priority (중요)
1. 좌석 선택 UI
2. 이메일 알림
3. 검색 & 필터
4. 성능 최적화
5. 자동화 테스트

### 🟢 Low Priority (선택)
1. 쿠폰 시스템
2. 리뷰 & 평점
3. PWA
4. 실시간 기능
5. 다국어 지원

---

## 📝 다음 단계

### 1단계: Phase 1 시작
```bash
# 결제 시스템부터 시작 추천
1. 토스페이먼츠 가입
2. 테스트 환경 구축
3. 결제 API 연동
4. 웹훅 처리
```

### 2단계: AWS 계정 준비
```bash
1. AWS 계정 생성
2. 결제 정보 등록
3. 비용 알림 설정
4. IAM 사용자 생성
```

### 3단계: 도메인 구매
```bash
1. tiketi.gg 도메인 확인
2. 가비아 또는 AWS Route 53에서 구매
3. DNS 설정 준비
```

---

## 🚀 시작하기

현재 목업에서 바로 시작할 수 있는 것:

### 즉시 시작 가능
- [ ] 좌석 선택 UI 구현
- [ ] 검색 기능 추가
- [ ] 모바일 반응형 개선
- [ ] 이미지 업로드 (로컬 S3 Minio)
- [ ] 단위 테스트 작성

### 외부 계정 필요
- [ ] 토스페이먼츠 연동 → 개발자 등록
- [ ] 카카오/네이버 로그인 → 애플리케이션 등록
- [ ] AWS 계정 → 생성 후 진행
- [ ] 도메인 구매 → tiketi.gg 확인

---

**다음 작업을 선택하세요!** 🎯

어떤 Phase부터 시작할까요?

