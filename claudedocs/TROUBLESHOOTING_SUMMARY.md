# TIKETI 시스템 트러블슈팅 전체 정리

**작성일**: 2025-12-31
**시스템**: TIKETI MSA 티케팅 시스템 (Kind + Kubernetes)

---

## 🎯 문제 요약

| 우선순위 | 문제 | 증상 | 해결 상태 |
|---------|------|------|----------|
| 🔴 Critical | Auth Service 크래시 | CrashLoopBackOff | ✅ 해결 |
| 🔴 Critical | Ticket Service 크래시 | CrashLoopBackOff | ✅ 해결 |
| 🟡 High | Stats API 실패 | 관리자 통계 페이지 로드 실패 | ✅ 해결 |
| 🟡 High | Payment API 실패 | Toss 결제 승인 실패 | ✅ 해결 |
| 🟢 Medium | Frontend News 탭 숨김 | 헤더에 News 링크 없음 | ✅ 해결 |
| 🟢 Medium | Quick Start 가이드 부정확 | 포트 불일치, 누락된 설명 | ✅ 해결 |

---

## 1️⃣ Auth Service 크래시 문제

### 🐛 증상
```bash
NAME                               READY   STATUS             RESTARTS
auth-service-xxxxxx                0/1     CrashLoopBackOff   5
```

**에러 로그**:
```
Error: Cannot find module 'google-auth-library'
```

### 🔍 원인 분석

**services/auth-service/Dockerfile:17**
```dockerfile
# Dockerfile에서 printf로 package.json 생성
RUN printf '{"name":"tiketi-auth-service",...,"dependencies":{
  "bcrypt":"^5.1.1",
  "cors":"^2.8.5",
  "dotenv":"^16.3.1",
  "express":"^4.18.2",
  "jsonwebtoken":"^9.0.2"  # ❌ google-auth-library 누락
}}' > package.json
```

**services/auth-service/package.json** (실제 소스)
```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "google-auth-library": "^9.0.0",  // ✅ 실제로는 필요함
    "jsonwebtoken": "^9.0.2"
  }
}
```

**핵심 원인**: Dockerfile의 인라인 package.json이 실제 소스 코드의 package.json과 불일치

### ✅ 해결 방법

**1. google-auth-library 의존성 추가**
```dockerfile
# services/auth-service/Dockerfile:17
RUN printf '{"name":"tiketi-auth-service",...,"dependencies":{
  "bcrypt":"^5.1.1",
  "cors":"^2.8.5",
  "dotenv":"^16.3.1",
  "express":"^4.18.2",
  "google-auth-library":"^9.0.0",  # ← 추가
  "jsonwebtoken":"^9.0.2"
}}' > package.json
```

**2. 포트 수정** (3002 → 3005)
```dockerfile
# services/auth-service/Dockerfile:30
EXPOSE 3005  # ← 3002에서 수정

# services/auth-service/Dockerfile:34
HEALTHCHECK ... CMD node -e "require('http').get('http://localhost:3005/health', ...)"
```

**3. 재배포**
```bash
docker build -t tiketi-auth-service:local -f services/auth-service/Dockerfile services/auth-service
kind load docker-image tiketi-auth-service:local --name tiketi-local
kubectl rollout restart deployment/auth-service -n tiketi
```

**결과**: Auth Service 정상 실행 ✅

---

## 2️⃣ Ticket Service 크래시 문제

### 🐛 증상
```bash
NAME                               READY   STATUS             RESTARTS
ticket-service-xxxxxx              0/1     CrashLoopBackOff   3
```

**에러 로그**:
```
Error: Cannot find module '@socket.io/redis-adapter'
```

### 🔍 원인 분석

**services/ticket-service/Dockerfile:17**
```dockerfile
RUN printf '{"name":"tiketi-ticket-service",...,"dependencies":{
  ...
  "socket.io-redis":"^6.1.1"  # ❌ 잘못된 패키지 (deprecated)
}}' > package.json
```

**services/ticket-service/package.json** (실제 소스)
```json
{
  "dependencies": {
    ...
    "@socket.io/redis-adapter": "^8.2.1"  // ✅ 실제 사용 패키지
  }
}
```

**추가 문제**: 포트도 3004로 잘못 설정 (정확한 포트: 3002)

### ✅ 해결 방법

**1. Redis adapter 패키지명 수정**
```dockerfile
# services/ticket-service/Dockerfile:17
RUN printf '{"name":"tiketi-ticket-service",...,"dependencies":{
  ...
  "@socket.io/redis-adapter":"^8.2.1"  # ← 수정
}}' > package.json
```

**2. 포트 수정** (3004 → 3002)
```dockerfile
# services/ticket-service/Dockerfile:30
EXPOSE 3002  # ← 3004에서 수정

# services/ticket-service/Dockerfile:34
HEALTHCHECK ... CMD node -e "require('http').get('http://localhost:3002/health', ...)"
```

**3. 재배포**
```bash
docker build -t tiketi-ticket-service:local -f services/ticket-service/Dockerfile services/ticket-service
kind load docker-image tiketi-ticket-service:local --name tiketi-local
kubectl rollout restart deployment/ticket-service -n tiketi
```

**결과**: Ticket Service 정상 실행 ✅

---

## 3️⃣ Stats API 실패 문제

### 🐛 증상
- Frontend 관리자 페이지 접속 시 통계 데이터 로드 실패
- Browser Console: `GET http://localhost:3001/api/stats/overview 404 Not Found`

### 🔍 원인 분석

**Frontend API 호출 구조**:
```javascript
// frontend/src/services/api.js
const api = axios.create({
  baseURL: 'http://localhost:3001/api',  // Backend Gateway
});

// Stats API 호출
statsAPI.getOverview()
  → GET http://localhost:3001/api/stats/overview
```

**MSA 아키텍처**:
```
Frontend (3000)
    ↓ 모든 API 요청
Backend Gateway (3001)  ← 단일 진입점
    ↓ 프록시 필요
    ├─ Stats Service (3004)     ← /api/stats/* 프록시 없음 ❌
    ├─ Payment Service (3003)
    ├─ Auth Service (3005)
    └─ Ticket Service (3002)
```

**핵심 원인**: Backend가 MSA Gateway 역할을 하지만 Stats Service로 프록시하는 라우트가 없음

### ✅ 해결 방법

**1. Stats 프록시 라우트 생성**

**backend/src/routes/stats-proxy.js** (신규 파일)
```javascript
const express = require('express');
const axios = require('axios');
const router = express.Router();

const STATS_SERVICE_URL = process.env.STATS_SERVICE_URL || 'http://stats-service:3004';

// Proxy all /api/stats/* requests to Stats Service
router.all('/*', async (req, res) => {
  try {
    const targetUrl = `${STATS_SERVICE_URL}/api/stats${req.path}`;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        ...req.headers,
        host: 'stats-service:3004',
      },
      data: req.body,
      params: req.query,
      validateStatus: () => true,
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    res.status(503).json({
      error: 'Stats Service unavailable',
      message: error.message,
    });
  }
});

module.exports = router;
```

**2. Backend server.js에 프록시 등록**

**backend/src/server.js:50-51**
```javascript
// MSA Service Proxies
app.use('/api/stats', require('./routes/stats-proxy'));  // ← 추가
```

**3. axios 의존성 추가**

**backend/package.json:19**
```json
"dependencies": {
  "@aws-sdk/client-s3": "^3.929.0",
  "@socket.io/redis-adapter": "^8.2.1",
  "axios": "^1.6.0",  // ← 추가
  ...
}
```

**4. Backend 재배포**
```bash
docker build -t tiketi-backend:local -f backend/Dockerfile backend
kind load docker-image tiketi-backend:local --name tiketi-local
kubectl rollout restart deployment/backend -n tiketi
```

**결과**: Stats API 정상 작동 ✅

**API 흐름 (수정 후)**:
```
Frontend
  → GET http://localhost:3001/api/stats/overview
  → Backend Gateway (3001)
  → Stats Proxy
  → GET http://stats-service:3004/api/stats/overview
  → Stats Service (3004)
  → PostgreSQL (stats_schema)
  → Response
```

---

## 4️⃣ Toss Payments API 실패 문제

### 🐛 증상
- Toss Payments 결제 승인 시 실패
- Browser Console: `POST http://localhost:3001/api/payments/confirm 404 Not Found`

### 🔍 원인 분석

**Frontend API 호출**:
```javascript
// Toss Payments 결제 승인
paymentsAPI.confirm({ paymentKey, orderId, amount })
  → POST http://localhost:3001/api/payments/confirm
```

**Backend 기존 상태**:
```javascript
// backend/src/routes/payments.js
// ❌ /confirm, /prepare 엔드포인트 없음
// Payment Service로 프록시하는 라우트가 없어서 404 발생
```

**핵심 원인**: Backend에 Payment Service의 confirm/prepare 엔드포인트를 프록시하는 라우트 없음

### ✅ 해결 방법

**backend/src/routes/payments.js:304-360** (추가)
```javascript
/**
 * POST /api/payments/confirm
 * Toss Payments 결제 승인 (Payment Service로 프록시)
 */
router.post('/confirm', async (req, res, next) => {
  try {
    const axios = require('axios');
    const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3003';

    const response = await axios.post(
      `${PAYMENT_SERVICE_URL}/api/payments/confirm`,
      req.body,
      {
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Payment Service proxy error:', error);
    next(new CustomError(503, 'Payment Service unavailable'));
  }
});

/**
 * POST /api/payments/prepare
 * Toss Payments 결제 준비 (Payment Service로 프록시)
 */
router.post('/prepare', async (req, res, next) => {
  try {
    const axios = require('axios');
    const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3003';

    const response = await axios.post(
      `${PAYMENT_SERVICE_URL}/api/payments/prepare`,
      req.body,
      {
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Payment Service proxy error:', error);
    next(new CustomError(503, 'Payment Service unavailable'));
  }
});
```

**재배포**: Backend 이미 재배포됨 (Stats 문제 해결 시)

**결과**: Toss Payments API 정상 작동 ✅

**API 흐름 (수정 후)**:
```
Frontend
  → POST http://localhost:3001/api/payments/confirm
  → Backend Gateway (3001)
  → Payments confirm 프록시
  → POST http://payment-service:3003/api/payments/confirm
  → Payment Service (3003)
  → Toss Payments API
  → PostgreSQL (payment_schema)
  → Response
```

---

## 5️⃣ Frontend News 탭 숨김 문제

### 🐛 증상
- Frontend 헤더에 News 링크가 표시되지 않음
- 하지만 직접 `/news` URL 접속 시 페이지는 정상 작동

### 🔍 원인 분석

**frontend/src/components/Header.js:58-59**
```javascript
<nav className="nav">
  {/* TODO: Re-enable when /news endpoints are migrated to microservices */}
  {/* <Link to="/news" className="nav-link">News</Link> */}
  {user ? (
```

**실제 상태**:
- ✅ Backend API 정상 작동 (`backend/src/routes/news.js`)
- ✅ App.js에 라우트 등록됨 (line 53-54)
- ✅ News.js, NewsDetail.js 컴포넌트 존재
- ❌ Header에서만 주석 처리되어 있음

**핵심 원인**: TODO 주석으로 News 링크가 숨겨져 있었지만, 실제로는 MSA 마이그레이션이 필요 없음 (Backend가 직접 처리)

### ✅ 해결 방법

**frontend/src/components/Header.js:58**
```javascript
// Before
{/* TODO: Re-enable when /news endpoints are migrated to microservices */}
{/* <Link to="/news" className="nav-link">News</Link> */}

// After
<Link to="/news" className="nav-link">News</Link>
```

**재배포**:
```bash
docker build -t tiketi-frontend:local -f frontend/Dockerfile frontend
kind load docker-image tiketi-frontend:local --name tiketi-local
kubectl rollout restart deployment/frontend -n tiketi
```

**결과**: News 탭 정상 표시 ✅

---

## 6️⃣ Quick Start 가이드 부정확 문제

### 🐛 증상
- 사용자가 처음부터 설치 시 포트포워딩이 실패
- Frontend 접속 시 포트 불일치로 연결 안 됨
- WSL IP 주소 하드코딩으로 재시작 시 접속 불가

### 🔍 원인 분석

**1. Frontend 포트 불일치**
```bash
# QUICK_START.md 기존 내용
kubectl port-forward -n tiketi svc/frontend-service 3000:80 &
```
- ❌ Frontend는 80이 아닌 3000 포트 사용 (k8s/07-frontend.yaml)
- 실제: `containerPort: 3000`

**2. WSL IP 하드코딩**
```markdown
# 기존
브라우저 접속: http://172.17.40.29:3000
```
- ❌ WSL IP는 재시작 시 변경될 수 있음

**3. 불명확한 setup 순서**
- 포트포워딩 전에 필요한 사전 작업 설명 부족
- 각 스크립트가 무엇을 하는지 설명 없음

### ✅ 해결 방법

**QUICK_START.md 수정 사항**:

**1. "시작하기 전에" 섹션 추가**
```markdown
## ⚠️ 시작하기 전에

**필수 확인사항:**
1. ✅ Docker Desktop 실행 중
2. ✅ WSL2 터미널 열기
3. ✅ 프로젝트 디렉토리로 이동: `cd /mnt/c/Users/USER/project-ticketing`

**전체 정리 후 재시작하려면:**
```bash
# Windows (PowerShell)
.\cleanup.ps1

# 또는 WSL
./scripts/cleanup.sh
```
```

**2. Frontend 포트 수정**
```bash
# Before
kubectl port-forward -n tiketi svc/frontend-service 3000:80 &

# After
kubectl port-forward -n tiketi svc/frontend-service 3000:3000 &
```

**3. WSL IP 하드코딩 제거**
```markdown
# Before
브라우저 접속: http://172.17.40.29:3000

# After
브라우저 접속: http://<WSL-IP>:3000
(스크립트가 표시한 IP 사용, 예: http://172.17.40.29:3000)
```

**4. 각 스크립트 설명 추가**
```markdown
#### setup-tiketi.ps1이 자동으로:
1. ✅ dos2unix로 스크립트 줄바꿈 변환
2. ✅ WSL에서 setup-tiketi.sh 실행
   - Kind 클러스터 생성 (tiketi-local)
   - PostgreSQL 배포
   - Database 스키마 생성
   - Docker 이미지 빌드 (6개)
   - Kind 클러스터에 이미지 로드
   - 인프라 서비스 배포
   - 애플리케이션 서비스 배포
   - 모든 Pod Ready 상태 확인
```

**동일한 수정을 QUICK_START_MAC.md에도 적용**

**결과**: 처음부터 설치 가능한 정확한 가이드 완성 ✅

---

## 📊 최종 시스템 상태

```bash
kubectl get pods -n tiketi
```

```
NAME                               READY   STATUS    RESTARTS   AGE
auth-service-6f699575b-qvcln       1/1     Running   0          20m  ✅
backend-766b44c44f-6qcbt           1/1     Running   0          20m  ✅
dragonfly-ccf64544c-6zxxq          1/1     Running   0          21m  ✅
frontend-58d54c96d7-hwdj6          1/1     Running   0          5m   ✅
grafana-7cf676b45-97c6x            1/1     Running   0          21m  ✅
loki-7d95bddf47-lvx2m              1/1     Running   0          21m  ✅
payment-service-6bbf9cbb9d-689h5   1/1     Running   0          20m  ✅
postgres-679c56656f-n5pp6          1/1     Running   0          26m  ✅
promtail-2txwj                     1/1     Running   0          21m  ✅
promtail-qwx49                     1/1     Running   0          21m  ✅
stats-service-6966db8958-hvhhj     1/1     Running   0          20m  ✅
ticket-service-7d56c47c64-f7ndj    1/1     Running   0          20m  ✅
```

**전체 서비스 정상 작동 ✅**

---

## 🎓 배운 교훈

### 1. Dockerfile 의존성 관리
**문제**: Dockerfile에서 printf로 package.json을 생성하면 실제 소스와 불일치 발생
**해결**: Source of Truth는 항상 실제 package.json 파일
**교훈**: 멀티스테이지 빌드 시 `COPY package*.json ./` 방식 사용 권장

### 2. MSA Gateway 패턴
**문제**: Frontend가 각 MSA 서비스 URL을 알 필요 없도록 단일 진입점 필요
**해결**: Backend가 API Gateway 역할, 모든 MSA 서비스로 프록시
**교훈**:
- Frontend는 Backend만 알면 됨
- 서비스 추가/변경 시 Frontend 수정 불필요
- 프록시 라우트 누락 시 404 발생

### 3. Kubernetes Service Discovery
**문제**: MSA 간 통신 시 IP 주소를 어떻게 알 수 있나?
**해결**: Kubernetes DNS를 통한 서비스명 자동 해석
**교훈**:
- `http://stats-service:3004` → 자동으로 Stats Service Pod로 연결
- 별도 IP 주소 관리 불필요
- 환경변수로 URL 설정 가능 (`STATS_SERVICE_URL`)

### 4. 포트 일관성
**문제**: Dockerfile, k8s manifest, 환경변수 간 포트 불일치
**해결**: 모든 설정에서 동일한 포트 사용
**교훈**:
- Auth: 3005
- Ticket: 3002
- Payment: 3003
- Stats: 3004
- EXPOSE, HEALTHCHECK, Service 모두 일치 필요

### 5. 문서화의 중요성
**문제**: Quick Start 가이드가 부정확하면 처음 설치 시 실패
**해결**: 단계별 설명, 각 스크립트가 하는 일 명시
**교훈**:
- 사전 준비사항 명시 필수
- 예상 소요 시간 제공
- Cleanup 방법도 문서화

---

## 🔄 향후 개선 방향

### 1. Dockerfile 개선
**현재**: `RUN printf '...' > package.json`로 인라인 생성
**개선**: `COPY package.json ./` 방식으로 Source of Truth 사용

### 2. API Gateway 전용 서비스
**현재**: Backend가 Gateway + 비즈니스 로직 모두 처리
**개선**:
- API Gateway 전용 서비스 분리
- Kong, Nginx, Traefik 등 전문 Gateway 사용
- Rate Limiting, Authentication 통합 관리

### 3. Service Mesh 도입
**현재**: 수동 프록시 라우트 작성
**개선**:
- Istio, Linkerd 등 Service Mesh
- 자동 프록시, Circuit Breaker, Retry
- Observability (Metrics, Tracing)

### 4. Health Check 강화
**현재**: 단순 HTTP 200 체크
**개선**:
- DB 연결 체크
- Dependency 체크 (Redis, PostgreSQL)
- Readiness vs Liveness 구분

---

**트러블슈팅 완료 시각**: 2025-12-31
**검증자**: Claude Code (Sonnet 4.5)
**전체 소요 시간**: 약 1시간
**해결된 이슈**: 6개 (Critical 2, High 2, Medium 2)
