# ✅ TIKETI - TODO 체크리스트

빠른 참조용 체크리스트입니다. 상세 내용은 `PRODUCTION_ROADMAP.md` 참고

---

## 🎯 Phase 1: 웹사이트 기능 완성

### 인증/회원
- [ ] 이메일 인증
- [ ] 비밀번호 찾기
- [ ] 소셜 로그인 (카카오, 네이버)
- [ ] 회원 프로필 수정

### 예매 기능
- [ ] 좌석 선택 UI (Canvas/SVG)
- [ ] 예매 타이머 (5분)
- [ ] 대기열 시스템
- [ ] QR 코드 생성
- [ ] PDF 다운로드

### 검색 & UI
- [ ] 이벤트 검색 (Full-Text Search)
- [ ] 고급 필터링 (카테고리, 가격, 날짜)
- [ ] 모바일 최적화
- [ ] 다크 모드

### 관리자
- [ ] 이미지 업로드 (S3)
- [ ] 차트/통계 (Chart.js)
- [ ] 좌석 배치도 에디터
- [ ] 매출 리포트

### 결제 시스템 ⭐ 중요
- [ ] 토스페이먼츠 연동
- [ ] 카드/간편결제
- [ ] 자동 환불
- [ ] 영수증 발행

### 알림
- [ ] 이메일 (SendGrid/SES)
- [ ] 웹 푸시
- [ ] SMS (선택)

---

## ☁️ Phase 2: AWS 인프라

### 네트워크
- [ ] Route 53 (도메인)
- [ ] CloudFront (CDN)
- [ ] ACM (SSL 인증서)
- [ ] VPC 구성
- [ ] NAT Gateway

### 컴퓨팅
- [ ] ALB 설정
- [ ] EC2-1 (Frontend, t3.medium)
- [ ] EC2-2 (Backend, t3.small)
- [ ] Auto Scaling Group
- [ ] Docker Compose 배포

### 데이터베이스
- [ ] Aurora Serverless v2 마이그레이션
- [ ] 백업 설정
- [ ] DragonflyDB (Self-hosted)

### 스토리지
- [ ] S3 Buckets (static, uploads, logs, backups)
- [ ] VPC Endpoint (S3 Gateway)
- [ ] Lifecycle Policy

### 보안
- [ ] WAF (선택)
- [ ] Secrets Manager
- [ ] IAM 역할
- [ ] Security Groups

### 모니터링
- [ ] Prometheus
- [ ] Grafana
- [ ] Loki
- [ ] CloudWatch Alarms

---

## 🚢 Phase 3: CI/CD

- [ ] GitHub Actions (Backend)
- [ ] GitHub Actions (Frontend)
- [ ] Blue/Green 배포
- [ ] DB 마이그레이션 자동화

---

## 📊 Phase 4: 성능 최적화

- [ ] Redis 캐싱 고도화
- [ ] DB 인덱스 최적화
- [ ] 이미지 최적화 (WebP)
- [ ] Code Splitting
- [ ] Rate Limiting

---

## 🔒 Phase 5: 보안 강화

- [ ] Helmet.js
- [ ] Input Validation (Joi)
- [ ] CORS 정책
- [ ] Refresh Token
- [ ] VPC Flow Logs

---

## 📈 Phase 6: 모니터링

- [ ] 커스텀 메트릭
- [ ] 대시보드 구성
- [ ] 알림 설정 (SNS, Slack)
- [ ] CloudWatch Alarms

---

## 🧪 Phase 7: 테스트

- [ ] Unit Test (Jest)
- [ ] Integration Test
- [ ] E2E Test (Cypress)
- [ ] Load Test (k6)
- [ ] Security Test (OWASP)

---

## 📱 Phase 8: 추가 기능 (선택)

- [ ] PWA
- [ ] WebSocket (실시간)
- [ ] 다국어 (i18n)
- [ ] 쿠폰 시스템
- [ ] 리뷰 & 평점

---

## 🔥 즉시 시작 가능 (로컬에서)

- [ ] 좌석 선택 UI
- [ ] 검색 기능
- [ ] 모바일 반응형
- [ ] 단위 테스트
- [ ] 이미지 업로드 (Minio)

---

## 💰 예산 준비

- [ ] AWS 계정 (₩154k/월)
- [ ] 도메인 구매 (tiketi.gg)
- [ ] 토스페이먼츠 (수수료 3.3%)
- [ ] 이메일 서비스 (₩1k/월)

---

## 📅 예상 일정

- Phase 1: 2-3주
- Phase 2: 3-4주
- Phase 3-7: 5-6주
- **총 3-4개월**

---

**현재 진행도**: Phase 0 완료 (로컬 목업) ✅
**다음 단계**: Phase 1 시작 🚀

