
# TIKETI UI 설계/기술 문서 (Dev & Interview)

> WebSocket 기반 실시간 티켓팅 서비스 **TIKETI**

---

## 1. 서비스/프론트엔드 개요

### 1.1 서비스 목적
- 대규모 트래픽 상황에서도 **공정하고 안정적인 공연/콘서트 티켓 예매 경험** 제공
- 실시간 좌석/티켓 수량 상태를 WebSocket 으로 반영하여 **새로고침 없이 상태 변화 인지**
- 관리자에게는 **이벤트/좌석/예약/매출에 대한 운영 도구** 제공

### 1.2 주요 사용자 유형
- **일반 사용자 (User)**
  - 이메일/비밀번호로 로그인
  - 공연/콘서트 목록 탐색 및 검색
  - 좌석 기반/비좌석 기반 티켓 예매, 결제, 예약 내역 조회/취소
  - 공지/이벤트 관련 공지(News) 게시글 열람·작성(일반 글)
- **관리자 (Admin)**
  - 관리자 전용 대시보드 접근
  - 이벤트 생성/수정/삭제
  - 좌석 레이아웃 선택 또는 티켓 타입(등급/가격/수량) 설정
  - 전체 예약 목록 조회 및 상태 모니터링
  - 공지글(News) 상단 고정(공지사항) 설정

### 1.3 프론트엔드 기술 스택
- React 18 (함수형 컴포넌트, Hooks)
- React Router v6 (`BrowserRouter`, `Routes`, `Route`, `Navigate`)
- Axios 기반 REST API 클라이언트 (`frontend/src/services/api.js`)
- Socket.IO Client (`frontend/src/hooks/useSocket.js`)
- CSS: 페이지/컴포넌트별 `.css` 파일
- 환경 변수
  - `REACT_APP_API_URL` (REST base URL, 기본 `http://localhost:3001`)
  - `REACT_APP_SOCKET_URL` (WebSocket, 기본 `http://localhost:3001`)

---

## 2. 라우팅 구조 및 접근 제어

### 2.1 라우팅 테이블 (상위 레벨)

정의 위치: `frontend/src/App.js`

| Path | Component | 접근 제어 | 설명 |
|------|-----------|-----------|------|
| `/` | `Home` | Public | 메인 홈, 이벤트 목록/필터 |
| `/search` | `Search` | Public | 검색 결과 |
| `/news` | `News` | Public (작성은 로그인 필요) | 공지/게시판 목록/작성 |
| `/news/:id` | `NewsDetail` | Public (수정/삭제 권한 필요) | 게시글 상세 |
| `/login` | `Login` | Public | 로그인 |
| `/register` | `Register` | Public | 회원가입 |
| `/events/:id` | `EventDetail` | Public | 이벤트 상세 + 예매 CTA |
| `/events/:eventId/seats` | `SeatSelection` | Private | 좌석 선택 |
| `/my-reservations` | `MyReservations` | Private | 나의 예매 목록 |
| `/reservations/:id` | `ReservationDetail` | Private | 예매 상세/취소 |
| `/payment/:reservationId` | `Payment` | Private | 결제 |
| `/payment-success/:reservationId` | `PaymentSuccess` | Private | 결제 완료 |
| `/admin` | `AdminDashboard` | Admin | 관리자 대시보드 |
| `/admin/events` | `AdminEvents` | Admin | 이벤트 목록/관리 |
| `/admin/events/new` | `AdminEventForm` | Admin | 이벤트 생성 |
| `/admin/events/edit/:id` | `AdminEventForm` | Admin | 이벤트 수정 |
| `/admin/reservations` | `AdminReservations` | Admin | 예매 관리 |

### 2.2 접근 제어 구현

위치: `frontend/src/App.js`

- `PrivateRoute`
  - 구현: `localStorage.getItem('token')` 존재 여부로 보호
  - 미로그인 시: `<Navigate to="/login" />`
- `AdminRoute`
  - 조건: `token` + `user.role === 'admin'`
  - 미인가 시: `<Navigate to="/" />`

특징:
- 클라이언트 측에서 최소한의 가드를 제공하고, 실제 권한 검증은 **백엔드 JWT**가 담당.
- 면접 포인트: 프론트 라우팅 가드 + 백엔드 권한 체크 + UI 레벨 버튼 비활성화까지 포함한 다층 방어 구조로 확장 가능.

---

## 3. 전역 구조 및 공통 컴포넌트

### 3.1 글로벌 레이아웃

- **헤더 (`Header`, `frontend/src/components/Header.js`)**
  - 로고(홈 링크)
  - 검색창(공연명 검색 → `/search?q=...`)
  - 내비게이션
    - `News`
    - 로그인/회원가입 또는 사용자명/로그아웃/나의 예매
    - 관리자 계정인 경우 `관리자` 메뉴 노출

- **메인 영역**
  - `<Header />` 아래에 페이지별 콘텐츠가 렌더링
  - 페이지별 `.css` 파일로 스타일링

### 3.2 공통 컴포넌트

위치: `frontend/src/components`

- `Header`
  - 책임: 전역 네비게이션, 검색, 로그인 상태 표시/로그아웃
  - 상태
    - `user`: 로컬 스토리지 `user` 파싱
    - `searchText`: 검색어 입력 값
  - 동작
    - 검색 폼 제출 시 `/search?q=...` 로 이동
    - 로그아웃 시 토큰/유저 삭제 후 홈 이동

- `EventCard`
  - 책임: 홈/검색에서 이벤트 카드 렌더링 + 카운트다운 표시
  - props: `event`, `onCountdownExpire`
  - 내부 사용
    - `useCountdown(event.sale_end_date, onCountdownExpire)`
    - `useCountdown(event.sale_start_date, onCountdownExpire)`
    - 이벤트 상태별 뱃지/카운트다운/CTA 텍스트 처리

- `WaitingRoomModal`
  - 책임: 혼잡 이벤트에서 대기열 정보 UI 제공
  - props: `eventId`, `onEntryAllowed`, `onClose`
  - 데이터 소스
    - WebSocket: `useQueueUpdates(eventId, onQueueUpdate, onEntryAllowed)`
    - REST fallback: `/api/queue/status/:eventId` 5초 간격 폴링
  - 표시 정보
    - 내 순번, 예상 대기 시간, 전체 대기 인원, 현재 접속 인원
    - WebSocket 연결 상태 (`ConnectionStatus` 포함)

- `ConnectionStatus`
  - 책임: WebSocket 연결/재연결/끊김 상태를 사용자에게 표시
  - props: `isConnected`, `isReconnecting`
  - 연결 정상 시에는 UI 숨김(필요 시만 노출)

---

## 4. 주요 유저 플로우 (기능 수준)

### 4.1 일반 사용자 플로우

1. **회원가입/로그인**
   - `/register`: 이메일/비밀번호/이름/전화번호 → 회원가입
   - 가입 성공 시 자동 로그인, 홈 이동 후 `window.location.reload()` 로 상태 초기화
   - `/login`: 이메일/비밀번호로 로그인
     - `role === 'admin'` → `/admin`
     - 그 외 → `/`

2. **이벤트 탐색/검색**
   - 홈(`/`)에서 이벤트 카드 목록 확인
   - 헤더 검색창 입력 → `/search?q=검색어`
   - 검색 페이지에서 상태 필터(on_sale/upcoming/ended/cancelled) 적용
   - 카드 클릭 → `/events/:id` 상세

3. **비좌석형 이벤트 예매**
   - `/events/:id` 진입, `event.seat_layout_id` 없음
   - 티켓 타입별 수량 선택 → 합계 금액/수량 표시
   - "예매하기" 클릭 → `reservationsAPI.create` 호출
   - 성공 시 토스트/alert 후 `/my-reservations` 이동

4. **좌석형 이벤트 예매**
   - `/events/:id` 진입, `event.seat_layout_id` 존재
   - 상단 CTA: "좌석 선택" 버튼 표시
   - 클릭 시 `/events/:eventId/seats` 로 이동
   - 좌석 선택 완료 후 "결제하기" → `/payment/:reservationId`
   - 결제 완료 후 `/payment-success/:reservationId` → 이후 `/my-reservations` 안내

5. **예약 내역 조회/취소**
   - 헤더 "나의 예매" → `/my-reservations`
   - 카드 클릭 → `/reservations/:id`
   - 예매 상태/결제 상태가 취소 가능일 때 "예매 취소" 버튼 활성화

6. **대기열 플로우 (혼잡 이벤트)**
   - `/events/:id` 진입 시 `/queue/check/:eventId` 로 내 대기열 상태 조회
   - 대기 중이면 `WaitingRoomModal` 오버레이 표시
   - WebSocket + 폴링으로 순번/예상 대기시간 업데이트
   - 입장 허용 시 `onEntryAllowed` 콜백 → 모달 닫고 최신 이벤트 데이터 로드

7. **News 게시판**
   - `/news`: 목록/글쓰기
   - 로그인 유저: 제목/내용 입력 후 글 작성 가능
   - 관리자: "공지(상단 고정)" 옵션 사용 가능
   - `/news/:id`: 본인 글 수정/삭제, 관리자 또는 작성자 삭제 가능

### 4.2 관리자 플로우

1. **관리자 로그인**
   - 관리자 계정으로 로그인 시 `/admin` 자동 리다이렉트
   - 헤더에 `관리자` 네비게이션 노출

2. **대시보드**
   - `/admin`: 요약 통계(전체 이벤트/전체 예매/총 매출/오늘 예매) + 최근 예매 목록
   - "이벤트 관리" → `/admin/events`, "예매 관리" → `/admin/reservations`

3. **이벤트 관리**
   - `/admin/events`: 전체 이벤트 목록 + 상태 필터 탭
   - "새 이벤트 만들기" → `/admin/events/new`
   - 카드별 "수정" → `/admin/events/edit/:id`
   - 카드별 "삭제" → 이벤트 삭제
   - 수정 화면에서 "이벤트 취소" → 전체 예약 취소 포함 서버 로직 호출

4. **예약 관리**
   - `/admin/reservations`: 전체 예매 목록
   - 상태 필터(전체/대기/확정/취소) 지원
   - 예매/결제 상태 뱃지로 시각적 상태 표현

---

## 5. 화면별 설계 (코드 기준)

### 5.1 홈 (`/`, `Home`)

위치: `frontend/src/pages/Home.js`

- 상태
  - `events`: 이벤트 목록
  - `filter`: 이벤트 상태 필터 (`on_sale`, `upcoming`, `ended`, `cancelled`, 전체)
  - `loading`, `error`
  - 슬라이더 인덱스 `current`
- 데이터 로딩
  - `eventsAPI.getAll({ status: filter })`
  - debounced fetch + 스피너/조용한 새로고침 패턴 사용
- UI
  - 상단 히어로 슬라이더
  - 필터 버튼 그룹
  - `EventCard` 그리드 (빈 상태/에러/로딩 처리 포함)

### 5.2 검색 (`/search`, `Search`)

위치: `frontend/src/pages/Search.js`

- 상태
  - `events`, `loading`, `error`, `filter`
  - `searchQuery`: URLSearchParams 기반 메모이즈
- 데이터 로딩
  - `eventsAPI.getAll({ status, q })`
  - 검색어/필터 변화에 따른 재요청
- UI
  - 상단 "검색 결과" 히어로
  - 좌측 상태 필터 사이드바
  - 우측 결과 리스트(카드), 결과 없음/에러/로딩 처리

### 5.3 이벤트 상세 (`/events/:id`, `EventDetail`)

위치: `frontend/src/pages/EventDetail.js`

- 상태
  - `event`, `ticketTypes`, `selectedTickets`, `loading`, `error`, `success`
  - `showQueueModal`
  - 카운트다운 상태: `saleStartCountdown`, `saleEndCountdown`
- 실시간 처리
  - `useTicketUpdates(id, handleTicketUpdate)`  
    → `ticket-updated` 이벤트 시 해당 `ticketType`의 `available_quantity` 업데이트
- 로직
  - `getActualEventStatus()` 로 현재 시간 기준 상태 재계산
  - `getCountdownChip()` 으로 판매 시작/종료까지 남은 시간 표시
  - `handleReservation()`  
    - 좌석형: `/events/:id/seats` 로 라우팅  
    - 비좌석형: `reservationsAPI.create({ eventId, items })` 호출
  - 페이지 진입 시 `/queue/check/:id` 호출 → 대기열 여부 확인 후 모달 표시
- UI
  - 상단 `ConnectionStatus`
  - 포스터/기본 정보/판매 기간/설명
  - CTA 버튼 (좌석 선택 / 예매하기 / 비활성 상태)
  - 비좌석형일 때만 하단 티켓 타입 리스트와 수량 선택 UI 렌더링

### 5.4 좌석 선택 (`/events/:eventId/seats`, `SeatSelection`)

위치: `frontend/src/pages/SeatSelection.js`

- 상태
  - `event`, `layout`, `seats`, `selectedSeats`
  - `loading`, `reserving`, `error`
- 데이터 로딩
  - `api.get(API_ENDPOINTS.GET_SEATS(eventId))`  
    → `{ event, layout, seats }` 구조 예상
- 실시간 처리
  - `useSeatUpdates(eventId, handleSeatUpdate)`  
    - `seat-selected`, `seat-released` 이벤트에 따라 좌석 상태/선택 상태 보정
- 예약 처리
  - `handleReserve()` → `api.post(API_ENDPOINTS.RESERVE_SEATS, { eventId, seatIds })`
  - 성공 시 `/payment/:reservationId` 로 이동
- UI
  - 상단 공연 제목 + 안내 + "이벤트로 돌아가기"
  - STAGE 영역 + 섹션/행/좌석 그리드
  - 하단 요약: 상태별 색상 legend, 선택 좌석 리스트, 총 금액, "결제하기" 버튼

### 5.5 결제 (`/payment/:reservationId`, `Payment`)

위치: `frontend/src/pages/Payment.js`

- 상태
  - `reservation`, `paymentMethod`, `loading`, `processing`, `timeRemaining`, `error`
- 데이터 로딩
  - `api.get(API_ENDPOINTS.GET_RESERVATION(reservationId))`
  - 만료/이미 결제 완료 상태에 따른 분기 처리
- 타이머
  - `expires_at` 기준 초 단위 카운트다운
  - 0초 도달 시 alert 후 홈으로 이동
- 결제 처리
  - `api.post(API_ENDPOINTS.PROCESS_PAYMENT, { reservationId, paymentMethod })`
  - 성공 시 `/payment-success/:reservationId`
- UI
  - 상단 타이머/경고 문구
  - 예약 정보(이벤트/좌석/총 금액)
  - 결제 수단 카드형 라디오 UI
  - 하단 결제 버튼(총 금액 표시)

### 5.6 결제 완료 (`/payment-success/:reservationId`, `PaymentSuccess`)

위치: `frontend/src/pages/PaymentSuccess.js`

- 데이터 로딩
  - `GET_RESERVATION` 재호출 후 `payment_status === 'completed'` 아닐 경우 `/payment/:id` 로 리다이렉트
- UI
  - 성공 아이콘 + 메시지
  - 예약 번호, 이벤트 정보, 좌석 리스트, 결제 수단/금액
  - "내 예약 확인" / "홈으로 가기" 버튼
  - 예약 확인 메일 안내(목업)

### 5.7 나의 예매 (`/my-reservations`, `MyReservations`)

위치: `frontend/src/pages/MyReservations.js`

- 데이터
  - `reservationsAPI.getMy()` → 예약 리스트
- UI
  - 예약 카드: 제목, 예매 번호, 공연장, 공연일시, 예매일시
  - 예매 상태/결제 상태 뱃지
  - 아이템 리스트(티켓 타입 × 수량, 소계)
  - 총 결제 금액

### 5.8 예매 상세 (`/reservations/:id`, `ReservationDetail`)

위치: `frontend/src/pages/ReservationDetail.js`

- 데이터
  - `reservationsAPI.getById(id)` → 단일 예약
- 기능
  - `reservationsAPI.cancel(id)` 호출로 예매 취소
  - 취소 가능한 상태(`status !== 'cancelled' && payment_status !== 'refunded'`)일 때만 버튼 노출
- UI
  - 예매 정보(번호/시간/예매/결제 상태)
  - 이벤트 정보(제목/장소/주소/공연일시)
  - 티켓 정보 테이블
  - 총 결제 금액 + "목록으로" 버튼

### 5.9 로그인/회원가입 (`/login`, `/register`)

위치: `frontend/src/pages/Login.js`, `Register.js`

- 로그인
  - `authAPI.login(formData)` 호출, 응답의 `token`, `user` 를 로컬 스토리지에 저장
  - `user.role` 에 따라 `/admin` 또는 `/` 리다이렉트
  - 이후 `window.location.reload()` 로 헤더 상태 갱신
- 회원가입
  - 비밀번호 확인/길이 검증
  - 성공 시 토큰/유저 저장 후 홈 이동 + 전체 리로드

### 5.10 News (`/news`, `/news/:id`)

위치: `frontend/src/pages/News.js`, `NewsDetail.js`

- 목록
  - `newsAPI.getAll()` 로 리스트 로딩
  - 로그인 시 글쓰기 폼 노출, 관리자일 때만 공지(고정) 옵션 사용
- 상세
  - `newsAPI.getById(id)` 로 단일 글 로딩
  - 본인 글 수정/삭제, 관리자 또는 작성자 삭제 기능

### 5.11 관리자 (`/admin`, `/admin/events`, `/admin/events/*`, `/admin/reservations`)

위치: `frontend/src/pages/admin/Dashboard.js`, `Events.js`, `EventForm.js`, `Reservations.js`

- 대시보드
  - `adminAPI.getDashboardStats()` 로 통계 + 최근 예매 리스트 로딩
- 이벤트 목록
  - `eventsAPI.getAll({ limit: 1000 })` 로 전체 이벤트 로딩 후 클라이언트 정렬/필터
- 이벤트 생성/수정
  - 생성: 좌석 레이아웃 사용/미사용에 따라 seat/ticket 설정 분기
  - 수정: 기본 정보만 수정, 상태/좌석/티켓 상세는 서버 규칙 우선
- 예매 관리
  - `adminAPI.getAllReservations(params)` 로 전체 예약 로딩
  - 상태 필터 버튼 제공

---

## 6. 데이터/상태/실시간 처리 설계

### 6.1 REST API 클라이언트

위치: `frontend/src/services/api.js`

- Axios 인스턴스
  - `baseURL = ${REACT_APP_API_URL || 'http://localhost:3001'}/api`
  - Request 인터셉터
    - `localStorage.token` 이 있으면 `Authorization: Bearer` 헤더 자동 삽입
  - Response 인터셉터
    - `401` 응답 시 토큰/유저 제거, alert 메시지 후 `/login` 리다이렉트

- 추상화된 API 모듈
  - `authAPI`, `eventsAPI`, `reservationsAPI`, `seatsAPI`, `paymentsAPI`,
    `adminAPI`, `imageAPI`, `newsAPI`

### 6.2 도메인 상수

위치: `frontend/src/shared/constants.js`

- 이벤트 상태: `upcoming`, `on_sale`, `ended`, `cancelled`, `sold_out`
- 좌석 상태: `available`, `reserved`, `locked`, `selected`
- 좌석 색상: `SEAT_STATUS_COLORS`
- 결제 수단: `naver_pay`, `kakao_pay`, `bank_transfer`
- 예약 설정
  - `MAX_SEATS_PER_RESERVATION = 1`
  - `TEMPORARY_RESERVATION_MINUTES = 5`
- API endpoint helpers: 좌석/결제 관련 path 빌더

### 6.3 WebSocket (Socket.IO) 설계

위치: `frontend/src/hooks/useSocket.js`

- 공통 소켓 훅: `useSocket(eventId)`
  - `SOCKET_URL = REACT_APP_SOCKET_URL || 'http://localhost:3001'`
  - JWT 기반 인증: `auth: { token }`
  - 재연결 정책: `reconnectionAttempts: 5`, 지수형 딜레이
  - 이벤트
    - `connect` / `disconnect`
    - `reconnect_attempt` / `reconnect` / `reconnect_failed`
    - `connect_error` (인증 에러 처리)
    - `session-restored`
    - `room-info` (동시 접속자 수 등)
    - `join-event` (이벤트 방 입장)

- 티켓 실시간 업데이트: `useTicketUpdates(eventId, onTicketUpdate)`
  - `ticket-updated` 이벤트 수신 → 콜백에 `{ ticketTypeId, availableQuantity }` 전달

- 대기열: `useQueueUpdates(eventId, onQueueUpdate, onEntryAllowed)`
  - 별도 소켓 인스턴스 (queue 전용)
  - `join-queue` (입장), `queue-updated`, `queue-entry-allowed`, `queue-cleared`, `session-restored`

- 좌석: `useSeatUpdates(eventId, onSeatUpdate)`
  - 공통 소켓(`useSocket(null)`) 사용
  - `join-seat-selection`, `seat-selected`, `seat-released`

### 6.4 카운트다운/시간 처리

위치: `frontend/src/hooks/useCountdown.js`

- `useCountdown(targetDate, onExpire)`
  - targetDate 까지 남은 시간(개월/일/시/분/초)을 계산해 1초 단위로 업데이트
  - 만료 시 `onExpire` 콜백을 한 번만 호출 (ref 기반 플래그 관리)
- `formatCountdown(timeLeft, showMonths)`
  - 홈/이벤트 카드/상세에서 공통 카운트다운 포맷 문자열 생성

---

## 7. UX 공통 규칙 요약

- **로딩 상태**
  - 주요 API 호출 시 페이지 중앙 또는 영역 내 `spinner` 표시
- **에러 상태**
  - 치명적 에러: 페이지 상단 `alert alert-error`
  - 인증 관련: Axios/Socket 인터셉터에서 alert 후 로그인 페이지로 이동
- **빈 상태**
  - "데이터 없음" 메시지 + 다음 행동 버튼(예: 이벤트 보러가기, 새 이벤트 만들기)
- **WebSocket 상태**
  - 연결 정상: `ConnectionStatus` 숨김
  - 재연결/끊김: 상단에 상태 배너 표시

---

## 8. MVP 범위 및 확장 포인트

- **MVP 포함**
  - 회원가입/로그인/로그아웃
  - 홈/검색/이벤트 상세(좌석/비좌석)
  - 좌석 선택 + 예약 + 결제(Mock)
  - 나의 예매 목록/상세/취소
  - News 게시판 CRUD
  - 대기열(UI + WebSocket + 폴링)
  - 관리자 대시보드/이벤트 관리/예매 관리

- **확장 아이디어**
  - 실제 PG 연동 (카카오페이/네이버페이 SDK, redirect/웹훅 플로우 설계)
  - 모바일/반응형 최적화, 접근성 개선(ARIA, 키보드 내비게이션)
  - WebSocket 연결 상태에 따른 자동 재시도/backoff 전략 고도화
  - optimistic UI, skeleton UI 도입
  - Suspense/React Query 같은 데이터 레이어 도입으로 API 코드 정리
