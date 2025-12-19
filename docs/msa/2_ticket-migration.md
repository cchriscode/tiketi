# Ticket Service MSA 분리

## 📋 개요

모놀리식 backend에서 **Ticket Service**를 마이크로서비스로 분리하는 작업을 완료했습니다.

- **분리 범위**: 이벤트, 티켓, 좌석, 예약, 대기열 관련 모든 기능
- **제외 사항**: 결제(Payment Service), 통계(Stats Service), 관리자 기능 일부
- **포트**: 3002 (기존 backend: 3001)
- **API 버전**: `/api/v1/` 형식 사용

---

## 🎯 작업 내용

### 1. 디렉터리 구조 생성

```
services/ticket-service/
├── src/
│   ├── server.js                 # 메인 엔트리포인트
│   ├── config/
│   │   ├── database.js           # PostgreSQL 연결
│   │   ├── redis.js              # Redis (대기열) 연결
│   │   └── socket.js             # Socket.IO 설정
│   ├── routes/
│   │   ├── events.js             # 이벤트 조회
│   │   ├── tickets.js            # 티켓 타입 조회
│   │   ├── seats.js              # 좌석 선택 & 예약
│   │   ├── reservations.js       # 예매 관리
│   │   └── queue.js              # 대기열 관리
│   ├── services/
│   │   └── queue-manager.js      # 대기열 비즈니스 로직
│   ├── middleware/
│   │   ├── auth.js               # JWT 인증 미들웨어
│   │   ├── error-handler.js      # 에러 처리
│   │   └── request-logger.js     # 요청 로깅
│   ├── socket/
│   │   └── (WebSocket 이벤트 핸들러 - socket.js에 포함)
│   ├── utils/
│   │   ├── logger.js             # Winston 로거
│   │   ├── custom-error.js       # 커스텀 에러 클래스
│   │   └── transaction-helpers.js # 트랜잭션 & 락 헬퍼
│   └── shared/
│       └── constants.js          # 공유 상수 (Ticket Service 전용)
├── package.json
├── Dockerfile
├── .env.example
└── .gitignore
```

---

## 📦 생성된 파일 목록

### 핵심 파일
- ✅ `src/server.js` - Ticket Service 메인 서버
- ✅ `src/config/database.js` - PostgreSQL 풀 설정
- ✅ `src/config/redis.js` - Redis 클라이언트
- ✅ `src/config/socket.js` - Socket.IO 초기화 및 이벤트 핸들러

### Routes (모두 `/api/v1/` 경로 사용)
- ✅ `src/routes/events.js` - 이벤트 목록/상세 조회
- ✅ `src/routes/tickets.js` - 티켓 타입 조회 및 재고 확인
- ✅ `src/routes/seats.js` - 좌석 레이아웃 조회, 좌석 선택 및 임시 예약
- ✅ `src/routes/reservations.js` - 예매 생성, 조회, 취소
- ✅ `src/routes/queue.js` - 대기열 진입, 상태 조회, 대기열 관리

### Services
- ✅ `src/services/queue-manager.js` - Redis 기반 대기열 관리 (FIFO)

### Middleware & Utils
- ✅ `src/middleware/auth.js` - JWT 인증 (Auth Service 통합 준비)
- ✅ `src/middleware/error-handler.js` - 전역 에러 처리
- ✅ `src/middleware/request-logger.js` - 요청 로깅
- ✅ `src/utils/logger.js` - Winston 기반 로거
- ✅ `src/utils/custom-error.js` - 커스텀 에러 클래스
- ✅ `src/utils/transaction-helpers.js` - DB 트랜잭션 & 분산 락 헬퍼

### 설정 파일
- ✅ `src/shared/constants.js` - 공유 상수 (Ticket Service 전용)
- ✅ `package.json` - 의존성 명시
- ✅ `Dockerfile` - Docker 이미지 빌드 설정
- ✅ `.env.example` - 환경변수 예제
- ✅ `.gitignore` - Git 무시 파일

---

## 🔄 API 엔드포인트

### Events (`/api/v1/events`)
```
GET  /                           이벤트 목록 조회 (필터, 검색, 페이지네이션)
GET  /{id}                       이벤트 상세 조회 (캐싱 포함)
```

### Tickets (`/api/v1/tickets`)
```
GET  /event/{eventId}            이벤트의 티켓 타입 목록
GET  /availability/{ticketTypeId} 티켓 재고 확인
```

### Seats (`/api/v1/seats`)
```
GET  /layouts                    좌석 레이아웃 목록
GET  /events/{eventId}           이벤트 좌석 정보
POST /reserve                    좌석 예약 (5분 TTL, 분산 락)
GET  /reservation/{reservationId} 좌석 예약 상세 조회
```

### Reservations (`/api/v1/reservations`)
```
POST /                           예매하기 (티켓 타입 기반)
GET  /my                         내 예매 목록
GET  /{id}                       예매 상세 조회
POST /{id}/cancel                예매 취소
```

### Queue (`/api/v1/queue`)
```
POST /check/{eventId}            대기열 진입 확인
GET  /status/{eventId}           대기열 상태 조회
POST /leave/{eventId}            대기열 나가기
GET  /admin/{eventId}            대기열 정보 (관리자)
POST /admin/clear/{eventId}      대기열 초기화 (관리자)
```

---

## 🔌 Socket.IO 이벤트

### Client → Server
- `join-event` - 이벤트 입장
- `leave-event` - 이벤트 퇴장
- `join-queue` - 대기열 입장
- `leave-queue` - 대기열 퇴장
- `join-seat-selection` - 좌석 선택 페이지 입장
- `seat-selection-changed` - 선택한 좌석 변경 알림

### Server → Client
- `room-info` - 룸 정보 (사용자 수 등)
- `seat-locked` - 좌석 잠금 알림 (실시간)
- `seat-update` - 다른 사용자의 좌석 선택
- `queue-entry-allowed` - 대기열 통과 알림
- `queue-updated` - 대기열 상태 업데이트
- `queue-cleared` - 대기열 초기화 알림
- `ticket-updated` - 티켓 재고 변경 (실시간)

---

## 🔐 인증 및 권한

- **JWT 기반 인증**: `Authorization: Bearer <token>` 헤더 사용
- **보호된 엔드포인트**: 대부분의 API가 인증 필요
- **관리자 기능**: `/admin/` 엔드포인트에서 별도 권한 체크 (향후 구현)

---

## 💾 데이터베이스 공유

**Ticket Service와 기존 backend가 동일한 PostgreSQL 사용**

### Ticket Service가 접근하는 테이블
- `events` - 이벤트 정보
- `ticket_types` - 티켓 타입 및 재고
- `seats` - 좌석 정보 및 상태
- `reservations` - 예매 정보
- `reservation_items` - 예매 항목
- `seat_layouts` - 좌석 레이아웃 (읽기 전용)
- `keyword_mappings` - 검색 키워드 매핑 (옵션)

---

## 🔄 Queue 시스템 구현

### 핵심 특징
- **Redis Sorted Set** 기반 FIFO 대기열
- **TTL 기반 자동 제거** (300초)
- **실시간 순번 업데이트** (Socket.IO)
- **분산 환경 지원** (Redis Pub/Sub Adapter)

### 동작 흐름
1. 사용자 접속 → `queue-check` 호출
2. 동시 접속 임계값 확인
   - 미달 시: 즉시 입장
   - 초과 시: 대기열 추가
3. 입장 가능 시 `queue-entry-allowed` 이벤트 전송
4. TTL 초과 시 자동 제거

---

## ⚠️ 알려진 제약사항 및 TODO

### 1. Auth Service 통합 (향후)
```javascript
// src/middleware/auth.js - TODO 주석 참고
// TODO: Auth Service 호출하여 사용자 정보 검증
```

### 2. 결제 연동 (Payment Service에서 구현)
- 현재: 예매 생성 시 `payment_status = PENDING`으로 설정
- 향후: Payment Service에서 `payment_status` 업데이트

### 3. 관리자 권한 체크
```javascript
// src/routes/queue.js L134, 173
// TODO: 관리자 권한 체크 추가
```

### 4. 메트릭 수집 제거
- 기존 backend: Prometheus 메트릭 수집
- Ticket Service: 현재 메트릭 미포함 (향후 추가 가능)

---

## 🚀 배포 및 실행

### 로컬 개발 환경
```bash
cd services/ticket-service
npm install
npm run dev
```

### Docker 빌드
```bash
docker build -t tiketi-ticket-service:latest .
```

### Kubernetes 배포 (향후)
- Service YAML: `k8s/11-ticket-service.yaml` (신규 생성 필요)
- ConfigMap/Secret 연동
- PostgreSQL, Redis 네트워크 설정

---

## 🔄 기존 Backend와의 동시 운영

### Phase 2 (현재 상태)
- ✅ Auth Service: 분리 완료 (`services/auth-service/`)
- ✅ Ticket Service: 분리 완료 (`services/ticket-service/`)
- ⏳ Backend (모놀리식): 여전히 실행 중
  - Ticket 관련 엔드포인트 병렬 제공
  - 점진적으로 Ticket Service로 트래픽 전환 계획

### Phase 3 (향후)
- 모든 서비스 분리 완료 후 기존 backend 종료
- Frontend 업데이트: `/api/` → `/api/v1/` 경로 변경
- API Gateway 추가 (선택사항)

---

## 📝 마이그레이션 체크리스트

- ✅ Ticket Service 기본 구조 생성
- ✅ Routes 파일 복사 및 최소화
- ✅ 설정 파일 (DB, Redis, Socket.IO)
- ✅ Middleware (Auth, Error, Logger)
- ✅ Utilities (Logger, Custom Error, Transaction Helper)
- ✅ Constants (Ticket Service 전용)
- ✅ Queue Manager 복사
- ✅ Dockerfile 생성
- ✅ package.json 명시
- ⏳ 테스트 (수동 테스트 필요)
- ⏳ CI/CD 통합
- ⏳ K8s 매니페스트 생성
- ⏳ Frontend 통합 테스트

---

## 📚 참고 문서

- 아키텍처 기획서: `docs/final/(최종)아키텍처기획서.md`
- 프로젝트 기획서: `docs/final/(최종)프로젝트기획서_RFP.md`
- Auth Service 분리 예시: `services/auth-service/`

---

## ✅ 다음 단계

1. **로컬 테스트**: Ticket Service 단독 실행 및 기본 엔드포인트 테스트
2. **통합 테스트**: Auth Service와의 연동 테스트
3. **K8s 배포**: Kubernetes 환경에서 배포 테스트
4. **트래픽 전환**: 점진적으로 요청을 Ticket Service로 라우팅
5. **Payment Service**: 다음 단계에서 분리 진행

---

## 작업 확인

- Ticket Service Port: **3002**
- Health Check: `http://localhost:3002/health`
- API Base: `http://localhost:3002/api/v1/`
- WebSocket: `ws://localhost:3002`