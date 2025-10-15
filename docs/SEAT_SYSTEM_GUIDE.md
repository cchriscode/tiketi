# 🎫 좌석 선택 시스템 사용 가이드

## ✨ 새로 추가된 기능

### 1. 좌석 선택 및 예약
- 이벤트별로 좌석 배치도 확인
- 실시간 좌석 상태 확인 (선택 가능/예약됨/선택 중)
- 최대 4석까지 동시 선택 가능
- 분산 락을 통한 동시성 제어

### 2. 결제 시스템
- 5분 임시 예약 시스템
- 네이버페이/카카오페이/계좌이체 선택 (목업)
- 실시간 타이머 표시
- 결제 완료 확인 페이지

### 3. 관리자 기능
- 좌석 레이아웃 템플릿 관리
- 이벤트 생성 시 좌석 유형 선택
- 자동 좌석 생성

---

## 🚀 시작하기

### 1단계: 데이터베이스 마이그레이션 실행

**Windows:**
```bash
cd database
node apply-migrations.js
```

**Mac/Linux:**
```bash
cd database
node apply-migrations.js
```

마이그레이션이 완료되면 다음과 같은 메시지가 표시됩니다:
```
✅ Successfully applied: 002_add_seats.sql
✅ All migrations completed successfully!
```

### 2단계: 서버 재시작

**Windows:**
```bash
stop.bat
start.bat
```

**Mac/Linux:**
```bash
./stop.sh
./start.sh
```

---

## 📋 사용 방법

### 관리자 - 이벤트 생성 (좌석 선택 포함)

1. **관리자 로그인**
   - 이메일: `admin@tiketi.gg`
   - 비밀번호: `admin123`

2. **이벤트 생성 페이지**
   - `/admin/events/new` 접속
   - 기본 정보 입력
   - **아티스트명** 입력 (예: "임영웅")
   - **좌석 레이아웃 선택**
     - 소극장 (300석)
     - 대극장 (1,500석)
     - 스포츠 경기장 (5,000석)

3. **이벤트 생성**
   - 이벤트 생성 시 선택한 레이아웃에 따라 자동으로 좌석 생성
   - 예: 대극장 선택 → 1,500개 좌석 자동 생성

### 사용자 - 좌석 선택 및 결제

1. **이벤트 상세 페이지**
   - 홈에서 이벤트 선택
   - "좌석 선택하기" 버튼 클릭

2. **좌석 선택**
   - 좌석 배치도에서 원하는 좌석 클릭
   - 색상 의미:
     - 🟢 **초록색**: 선택 가능
     - 🔵 **파란색**: 내가 선택함
     - ⚫ **회색**: 이미 예약됨
     - 🟠 **주황색**: 다른 사용자가 선택 중
   - 최대 4석까지 선택 가능
   - "결제하기" 버튼 클릭

3. **결제**
   - 5분 타이머 표시
   - 결제 수단 선택:
     - 네이버페이
     - 카카오페이
     - 계좌이체
   - "결제하기" 버튼 클릭

4. **결제 완료**
   - 예약 번호 확인
   - 선택한 좌석 확인
   - "내 예약 확인" 또는 "홈으로 돌아가기"

---

## 🔐 동시성 제어 (Race Condition 방지)

### 시나리오: 두 사용자가 동시에 같은 좌석 선택

```
User A: 좌석 A-1 선택
  ↓
DragonflyDB에서 락 획득 성공
  ↓
DB에서 좌석 상태 확인 (FOR UPDATE)
  ↓
좌석 상태를 'locked'로 변경
  ↓
예약 생성
  ↓
락 해제

User B: 동시에 좌석 A-1 선택
  ↓
락 획득 시도 → ❌ 실패
  ↓
"다른 사용자가 선택 중입니다" 메시지 표시
```

### 임시 예약 자동 정리

```
5분 후 결제하지 않은 경우:
  ↓
백그라운드 작업이 자동으로 감지 (30초마다 체크)
  ↓
좌석 상태를 'available'로 복구
  ↓
예약 상태를 'expired'로 변경
```

---

## 📊 데이터베이스 구조

### 새로 추가된 테이블

#### 1. `seat_layouts` - 좌석 레이아웃 템플릿
```sql
- id: UUID
- name: 레이아웃 이름 (예: "대극장")
- description: 설명
- total_seats: 총 좌석 수
- layout_config: JSONB (구역/행/좌석 정보)
```

#### 2. `seats` - 이벤트별 실제 좌석
```sql
- id: UUID
- event_id: 이벤트 ID
- section: 구역 (예: "VIP", "R석")
- row_number: 행 번호
- seat_number: 좌석 번호
- seat_label: 표시용 라벨 (예: "VIP-1-5")
- price: 가격
- status: 상태 ('available', 'reserved', 'locked')
```

#### 3. `events` - 수정된 컬럼
```sql
+ seat_layout_id: 좌석 레이아웃 ID
+ artist_name: 아티스트명
+ pre_scaled: EC2 사전 확장 여부
```

#### 4. `reservations` - 수정된 컬럼
```sql
+ payment_method: 결제 수단
+ expires_at: 임시 예약 만료 시간
```

---

## 🎨 UI 컴포넌트

### 1. `SeatSelection.js` - 좌석 선택 페이지
- 좌석 배치도 렌더링
- 실시간 좌석 상태 표시
- 좌석 선택/해제
- 선택 요약 및 결제 버튼

### 2. `Payment.js` - 결제 페이지
- 예약 정보 표시
- 5분 타이머
- 결제 수단 선택
- 결제 처리

### 3. `PaymentSuccess.js` - 결제 완료 페이지
- 예약 번호 표시
- 이벤트/좌석 정보
- 결제 정보
- 내 예약 확인 링크

---

## 🛠️ API 엔드포인트

### 좌석 관련
- `GET /api/seats/:eventId` - 좌석 조회
- `POST /api/seats/reserve` - 좌석 예약 (임시)
- `GET /api/seats/reservation/:reservationId` - 예약 상세

### 결제 관련
- `POST /api/payments/process` - 결제 처리 (목업)
- `GET /api/payments/methods` - 결제 수단 목록

### 관리자 전용
- `GET /api/admin/seat-layouts` - 좌석 레이아웃 목록
- `POST /api/admin/events` - 이벤트 생성 (좌석 자동 생성 포함)

---

## 🧹 자동 정리 시스템

### Reservation Cleaner

백엔드 서버 시작 시 자동으로 실행:

```javascript
// 30초마다 체크
- 5분 경과한 임시 예약 찾기
- 좌석 상태를 'available'로 복구
- 예약 상태를 'expired'로 변경
```

서버 로그에서 확인 가능:
```
🧹 Starting reservation cleaner (interval: 30s)
🧹 Cleaning 3 expired reservations...
✅ Cleaned 3 expired reservations
```

---

## 📝 상수 관리 (One Source of Truth)

### 백엔드: `backend/src/shared/constants.js`
```javascript
SEAT_STATUS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  LOCKED: 'locked',
}

PAYMENT_METHODS = {
  NAVER_PAY: 'naver_pay',
  KAKAO_PAY: 'kakao_pay',
  BANK_TRANSFER: 'bank_transfer',
}
```

### 프론트엔드: `frontend/src/shared/constants.js`
```javascript
// 백엔드와 동일한 값 사용
export const SEAT_STATUS = { ... }
export const PAYMENT_METHODS = { ... }
```

---

## 🔧 문제 해결

### 좌석이 보이지 않을 때

1. 이벤트에 좌석 레이아웃이 설정되었는지 확인
2. 마이그레이션이 정상적으로 완료되었는지 확인
3. DB에 좌석 데이터가 있는지 확인:
   ```sql
   SELECT COUNT(*) FROM seats WHERE event_id = 'YOUR_EVENT_ID';
   ```

### 결제가 안될 때

1. 좌석이 'locked' 상태인지 확인
2. 5분 타이머가 남아있는지 확인
3. 로그인 상태인지 확인

### 임시 예약이 자동 취소되지 않을 때

1. 백엔드 서버가 실행 중인지 확인
2. 서버 로그에서 Reservation Cleaner 메시지 확인
3. `expires_at` 컬럼이 올바르게 설정되었는지 확인

---

## 🎯 테스트 시나리오

### 시나리오 1: 정상 예약
1. 사용자 A가 좌석 선택
2. 결제 페이지로 이동
3. 5분 내에 결제 완료
4. 예약 확정

### 시나리오 2: 동시 선택 (Race Condition)
1. 사용자 A와 B가 동시에 같은 좌석 선택
2. A만 성공, B는 "선택 중" 메시지 표시
3. A가 결제 완료 또는 만료
4. B가 다시 시도 가능

### 시나리오 3: 타임아웃
1. 사용자가 좌석 선택
2. 결제 페이지에서 5분 초과
3. 자동으로 예약 취소
4. 좌석 상태 복구

---

**구현 완료!** 🎉

이제 전체 티켓팅 시스템이 작동합니다:
- ✅ 좌석 선택
- ✅ 분산 락을 통한 동시성 제어
- ✅ 임시 예약 및 자동 정리
- ✅ 결제 시스템 (목업)
- ✅ 관리자 좌석 관리

