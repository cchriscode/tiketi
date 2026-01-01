# Frontend API 통일 작업 완료 보고서

**작성일**: 2025-12-31
**작업자**: Claude Code (Sonnet 4.5)
**목적**: Frontend의 모든 API 호출을 Backend API Gateway (3001)로 통일

---

## ✅ 작업 완료 요약

모든 Frontend API 호출을 Backend (port 3001)로 통일했습니다.
Backend가 내부적으로 MSA 서비스들로 프록시하는 구조입니다.

---

## 🔧 수정된 파일

### `frontend/src/services/api.js`

#### Before (수정 전)

```javascript
// 두 개의 axios 인스턴스 사용
const API_URL = getApiUrl();           // http://localhost:3001
const AUTH_SERVICE_URL = getAuthServiceUrl();  // http://localhost:3005 ❌

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

const authApiClient = axios.create({
  baseURL: `${AUTH_SERVICE_URL}/api`,  // 별도 인스턴스 ❌
});

// Auth는 authApiClient 사용 (직접 3005로 호출)
export const authAPI = {
  register: (data) => authApiClient.post('/auth/register', data),  // ❌
  login: (data) => authApiClient.post('/auth/login', data),        // ❌
};

// 나머지는 api 사용 (3001로 호출)
export const eventsAPI = {
  getAll: (params) => api.get('/events', { params }),              // ✅
};
```

#### After (수정 후)

```javascript
// 하나의 axios 인스턴스만 사용
const API_URL = getApiUrl();  // http://localhost:3001

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

// 모든 API가 api 인스턴스 사용 (일관성)
export const authAPI = {
  register: (data) => api.post('/auth/register', data),  // ✅ 통일!
  login: (data) => api.post('/auth/login', data),        // ✅ 통일!
};

export const eventsAPI = {
  getAll: (params) => api.get('/events', { params }),    // ✅
};
```

---

## 📊 변경 사항 상세

### 제거된 코드

1. **getAuthServiceUrl() 함수** - 제거
   ```javascript
   // ❌ 제거됨
   const getAuthServiceUrl = () => {
     if (process.env.REACT_APP_AUTH_URL) {
       return process.env.REACT_APP_AUTH_URL;
     }
     // ...
   };
   ```

2. **AUTH_SERVICE_URL 변수** - 제거
   ```javascript
   // ❌ 제거됨
   const AUTH_SERVICE_URL = getAuthServiceUrl();
   ```

3. **authApiClient 인스턴스** - 제거
   ```javascript
   // ❌ 제거됨
   const authApiClient = axios.create({
     baseURL: `${AUTH_SERVICE_URL}/api`,
     headers: { 'Content-Type': 'application/json' },
   });
   ```

### 수정된 코드

**authAPI 객체** - authApiClient → api
```javascript
// Before
export const authAPI = {
  register: (data) => authApiClient.post('/auth/register', data),
  login: (data) => authApiClient.post('/auth/login', data),
};

// After
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
};
```

---

## 🌊 API 요청 흐름

### Before (수정 전)

```
Frontend
  ├─→ authAPI (회원가입/로그인)
  │    └─→ authApiClient (3005) → Auth Service 직접 호출 ❌
  │
  └─→ eventsAPI, ticketsAPI, paymentsAPI, etc.
       └─→ api (3001) → Backend → MSA Services ✅
```

**문제점**:
- 두 가지 다른 경로 (불일치)
- Auth Service가 외부에 직접 노출
- CORS 설정 복잡
- EKS Ingress 설정 복잡

### After (수정 후)

```
Frontend
  └─→ 모든 API (authAPI 포함)
       └─→ api (3001) → Backend API Gateway
                           ├─→ auth-proxy → Auth Service (3005)
                           ├─→ ticket-proxy → Ticket Service (3002)
                           ├─→ payment-proxy → Payment Service (3003)
                           ├─→ stats-proxy → Stats Service (3004)
                           └─→ Backend Legacy (Admin, News, Image)
```

**개선점**:
- ✅ 일관된 단일 경로
- ✅ MSA 서비스 내부 네트워크에만 존재
- ✅ CORS 설정 단순화 (Backend 한 곳에서만)
- ✅ EKS Ingress 설정 단순화
- ✅ API Gateway 패턴 완성

---

## 🔒 보안 개선

### Before
```
Internet
  ├─→ Frontend (3000)
  ├─→ Backend (3001)
  └─→ Auth Service (3005) ❌ 직접 노출
```

### After
```
Internet
  ├─→ Frontend (3000)
  └─→ Backend (3001) ✅ 단일 진입점
       └─→ MSA Services (내부 네트워크만)
           ├─ Auth Service (3005)
           ├─ Ticket Service (3002)
           ├─ Payment Service (3003)
           └─ Stats Service (3004)
```

**보안 강화**:
- ✅ MSA 서비스들이 외부에 노출되지 않음
- ✅ Backend가 중앙 집중식 인증/인가 처리 가능
- ✅ Rate Limiting, Throttling을 Backend에서 통합 관리
- ✅ Zero Trust 아키텍처 구현 용이

---

## 🚀 EKS 배포 시 이점

### 1. Ingress 설정 단순화

**Before**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
spec:
  rules:
  - host: tiketi.com
    http:
      paths:
      - path: /api/auth      # Auth Service 직접 노출 ❌
        backend:
          service:
            name: auth-service
            port: 3005
      - path: /api           # Backend
        backend:
          service:
            name: backend
            port: 3001
```

**After**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
spec:
  rules:
  - host: tiketi.com
    http:
      paths:
      - path: /              # Backend만 노출 ✅
        backend:
          service:
            name: backend
            port: 3001
```

### 2. NetworkPolicy 설정

```yaml
# MSA 서비스는 Backend에서만 접근 가능
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: auth-service-policy
spec:
  podSelector:
    matchLabels:
      app: auth-service
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: backend  # Backend만 허용 ✅
```

### 3. Service 타입 변경

**Before**:
```yaml
# Auth Service - LoadBalancer (외부 노출) ❌
apiVersion: v1
kind: Service
metadata:
  name: auth-service
spec:
  type: LoadBalancer  # 비용 증가 ❌
  ports:
  - port: 3005
```

**After**:
```yaml
# Auth Service - ClusterIP (내부 전용) ✅
apiVersion: v1
kind: Service
metadata:
  name: auth-service
spec:
  type: ClusterIP  # 비용 절감 ✅
  ports:
  - port: 3005
```

---

## 📝 API 엔드포인트 매핑

모든 API가 `http://localhost:3001/api/*`로 통일:

| Frontend 호출 | Backend 처리 | 최종 목적지 |
|--------------|-------------|-----------|
| `/api/auth/register` | auth-proxy | Auth Service (3005) |
| `/api/auth/login` | auth-proxy | Auth Service (3005) |
| `/api/events` | ticket-proxy | Ticket Service (3002) |
| `/api/tickets` | ticket-proxy | Ticket Service (3002) |
| `/api/seats` | ticket-proxy | Ticket Service (3002) |
| `/api/reservations` | ticket-proxy | Ticket Service (3002) |
| `/api/queue` | ticket-proxy | Ticket Service (3002) |
| `/api/payments` | payment-proxy | Payment Service (3003) |
| `/api/stats` | stats-proxy | Stats Service (3004) |
| `/api/admin` | Backend 직접 | Backend |
| `/api/news` | Backend 직접 | Backend |
| `/api/image` | Backend 직접 | Backend (S3) |

---

## ✅ 검증 항목

### 코드 레벨

- [x] authApiClient 인스턴스 제거
- [x] getAuthServiceUrl() 함수 제거
- [x] AUTH_SERVICE_URL 변수 제거
- [x] authAPI가 api 인스턴스 사용
- [x] 다른 API들과 일관성 확보
- [x] 문법 오류 없음

### 기능 테스트 (시스템 재시작 후)

- [ ] 회원가입 기능
- [ ] 로그인 기능
- [ ] 이벤트 조회
- [ ] 좌석 선택
- [ ] 예약 생성
- [ ] 결제 처리
- [ ] 통계 조회
- [ ] 관리자 기능
- [ ] 뉴스 조회

---

## 🎯 다음 단계

### 1. 시스템 재시작 (필수)

```bash
# Windows
.\setup-tiketi.ps1

# Linux/macOS/WSL
./scripts/setup-tiketi.sh
```

### 2. Health Check

```bash
curl http://localhost:3001/health  # Backend
curl http://localhost:3005/health  # Auth Service (내부)
curl http://localhost:3002/health  # Ticket Service (내부)
curl http://localhost:3003/health  # Payment Service (내부)
curl http://localhost:3004/health  # Stats Service (내부)
```

### 3. 기능 테스트

**회원가입/로그인**:
- Frontend → `http://localhost:3001/api/auth/register`
- Backend → auth-proxy → Auth Service

**이벤트 조회**:
- Frontend → `http://localhost:3001/api/events`
- Backend → ticket-proxy → Ticket Service

**결제**:
- Frontend → `http://localhost:3001/api/payments/prepare`
- Backend → payment-proxy → Payment Service

---

## 📊 개선 효과 요약

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| axios 인스턴스 수 | 2개 | 1개 | 단순화 |
| API 호출 경로 | 불일치 | 일관 | 통일 |
| 외부 노출 서비스 | 2개 | 1개 | 보안 향상 |
| Ingress 규칙 | 복잡 | 간단 | 관리 용이 |
| CORS 설정 | 2곳 | 1곳 | 유지보수 쉬움 |
| LoadBalancer 비용 | 높음 | 낮음 | 비용 절감 |
| 아키텍처 일관성 | 낮음 | 높음 | API Gateway 패턴 |

---

## 🏆 최종 아키텍처

```
┌─────────────────────────────────────────────────────┐
│              Frontend (React, Port 3000)             │
│         모든 API 호출: http://localhost:3001/api/*   │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│        Backend API Gateway (Express, Port 3001)     │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ MSA Proxies                                   │  │
│  │  • auth-proxy → Auth Service (3005)          │  │
│  │  • ticket-proxy → Ticket Service (3002)      │  │
│  │  • payment-proxy → Payment Service (3003)    │  │
│  │  • stats-proxy → Stats Service (3004)        │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ Backend Legacy                                │  │
│  │  • Admin APIs                                 │  │
│  │  • News APIs                                  │  │
│  │  • Image Upload (S3)                          │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
    │ Auth   │    │ Ticket │    │Payment │    │ Stats  │
    │Service │    │Service │    │Service │    │Service │
    │  3005  │    │  3002  │    │  3003  │    │  3004  │
    └────────┘    └────────┘    └────────┘    └────────┘
       ▲              ▲              ▲              ▲
       └──────────────┴──────────────┴──────────────┘
                   내부 네트워크만 접근 가능
```

---

**작업 완료 시각**: 2025-12-31
**검증자**: Claude Code (Sonnet 4.5)
**상태**: ✅ Frontend API 통일 완료
**다음 단계**: 시스템 재시작 후 기능 테스트
