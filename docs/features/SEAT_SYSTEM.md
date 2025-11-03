# 🎫 좌석 선택 시스템

> 실시간 좌석 동기화 + 분산 락 기반 동시성 제어

---

## 📋 시스템 개요

### 핵심 기능
- 🪑 **실시간 좌석 선택**: 다른 사용자가 선택한 좌석 즉시 반영
- 🔒 **분산 락 기반 동시성 제어**: Race Condition 완벽 방지
- ⏰ **5분 임시 예약**: 결제 대기 시간 자동 관리
- 🧹 **자동 정리**: 만료된 임시 예약 자동 취소
- 💳 **결제 시스템**: 네이버페이/카카오페이/계좌이체 (목업)

### 전체 흐름
```
1. 관리자: 이벤트 생성 시 좌석 레이아웃 선택
   ↓
2. 시스템: 선택된 레이아웃에 따라 좌석 자동 생성
   ↓
3. 사용자: 이벤트 페이지에서 좌석 배치도 확인
   ↓
4. 사용자: 원하는 좌석 클릭 (최대 4석)
   ↓
5. 시스템: 분산 락으로 동시성 체크
   - 이미 예약됨? → "이미 예약된 좌석입니다" 알림
   - 선택 가능? → 5분 임시 예약
   ↓
6. 사용자: 결제 페이지로 이동
   ↓
7. 사용자: 결제 수단 선택 및 결제
   ↓
8. 시스템: 결제 완료 처리
   ↓
9. 완료: 예약 확정
```

---

## 🗄️ 데이터베이스 설계

### 1. 좌석 레이아웃 템플릿 (seat_layouts)
```sql
CREATE TABLE seat_layouts (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,              -- "소극장", "대극장", "스포츠 경기장"
    description TEXT,
    total_seats INTEGER,                     -- 총 좌석 수
    layout_config JSONB,                     -- 좌석 배치 정보
    created_at TIMESTAMP DEFAULT NOW()
);
```

**샘플 레이아웃**:
- **소극장**: 300석 (VIP 30석, R석 75석, S석 160석)
- **대극장**: 1,500석 (VIP 100석, R석 300석, S석 450석, A석 400석)
- **스포츠 경기장**: 5,000석 (1층 1,000석, 2층 1,800석, 3층 2,100석)

### 2. 실제 좌석 (seats)
```sql
CREATE TABLE seats (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id),

    section VARCHAR(50),        -- 구역 (예: "VIP", "R석")
    row_number INTEGER,         -- 행 번호
    seat_number INTEGER,        -- 좌석 번호
    seat_label VARCHAR(20),     -- 표시용 라벨 (예: "VIP-1-5")

    price INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'available',  -- available, reserved, locked

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(event_id, section, row_number, seat_number)
);
```

### 3. 예약 정보 (reservations)
```sql
-- 기존 테이블에 추가된 컬럼
ALTER TABLE reservations
ADD COLUMN payment_method VARCHAR(50),     -- naver_pay, kakao_pay, bank_transfer
ADD COLUMN expires_at TIMESTAMP;           -- 임시 예약 만료 시간 (5분)

-- reservation_items에 좌석 정보 추가
ALTER TABLE reservation_items
ADD COLUMN seat_id UUID REFERENCES seats(id);
```

---

## 🔒 동시성 제어

### 분산 락 시스템
```javascript
// DragonflyDB 기반 락
const seatLockKey = `seat:${eventId}:${seatId}`;
const locked = await acquireLock(seatLockKey, 10000);  // 10초

if (!locked) {
  return res.status(409).json({
    error: '다른 사용자가 선택 중인 좌석입니다. 잠시 후 다시 시도해주세요.'
  });
}
```

### Race Condition 방지 시나리오
```
User A: 좌석 A-1 선택
  ↓
DragonflyDB 락 획득 성공
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
"다른 사용자가 선택 중입니다" 메시지
```

---

## 🧹 자동 정리 시스템

### Reservation Cleaner
백엔드 서버 시작 시 자동 실행:

```javascript
// 30초마다 체크
setInterval(async () => {
  // 5분 경과한 임시 예약 찾기
  const expiredReservations = await pool.query(`
    SELECT id FROM reservations
    WHERE payment_status = 'pending'
    AND expires_at < NOW()
  `);

  for (const reservation of expiredReservations.rows) {
    // 좌석 상태를 'available'로 복구
    await pool.query(`
      UPDATE seats SET status = 'available'
      WHERE id IN (
        SELECT seat_id FROM reservation_items
        WHERE reservation_id = $1
      )
    `, [reservation.id]);

    // 예약을 'expired'로 변경
    await pool.query(
      'UPDATE reservations SET status = $1 WHERE id = $2',
      ['expired', reservation.id]
    );

    // WebSocket으로 좌석 해제 알림
    io.to(`event:${eventId}`).emit('seat:released', { seatIds });
  }
}, 30000);
```

**로그 확인**:
```
🧹 Starting reservation cleaner (interval: 30s)
🧹 Cleaning 3 expired reservations...
✅ Cleaned 3 expired reservations
```

---

## 🎨 프론트엔드 UI

### 좌석 배치도 컴포넌트

**파일**: `frontend/src/pages/SeatSelection.js`

```jsx
<div className="seat-map">
  {/* 무대/스크린 */}
  <div className="stage">STAGE</div>

  {/* 구역별 좌석 */}
  {sections.map(section => (
    <div className="section" key={section.name}>
      <h3>{section.name} - {section.price.toLocaleString()}원</h3>

      {section.rows.map(row => (
        <div className="seat-row" key={row.number}>
          <span className="row-label">{row.number}열</span>

          {row.seats.map(seat => (
            <button
              key={seat.id}
              className={`seat ${seat.status}`}
              onClick={() => handleSeatClick(seat)}
              disabled={seat.status !== 'available'}
            >
              {seat.seatNumber}
            </button>
          ))}
        </div>
      ))}
    </div>
  ))}
</div>
```

### 좌석 상태별 색상
```css
/* 선택 가능 */
.seat.available {
  background: #4CAF50;  /* 초록 */
  cursor: pointer;
}

/* 내가 선택한 좌석 */
.seat.selected {
  background: #2196F3;  /* 파랑 */
  border: 2px solid #0d47a1;
}

/* 이미 예약됨 */
.seat.reserved {
  background: #9E9E9E;  /* 회색 */
  cursor: not-allowed;
}

/* 다른 사람이 선택 중 */
.seat.locked {
  background: #FF9800;  /* 주황 */
  cursor: not-allowed;
  animation: blink 1s infinite;
}
```

### 실시간 동기화 훅
```javascript
// useSeatUpdates 훅 사용
const { seats, updateSeats } = useSeatUpdates(eventId);

// WebSocket으로 실시간 업데이트 수신
socket.on('seat:selected', ({ seatIds }) => {
  updateSeats(seatIds, 'locked');
});

socket.on('seat:released', ({ seatIds }) => {
  updateSeats(seatIds, 'available');
});
```

---

## 💳 결제 시스템

### 결제 페이지

**파일**: `frontend/src/pages/Payment.js`

**구성 요소**:
1. **예약 정보**: 이벤트명, 선택 좌석, 총 금액
2. **5분 타이머**: 실시간 카운트다운
3. **결제 수단 선택**: 네이버페이/카카오페이/계좌이체
4. **결제 버튼**: 결제 처리

```jsx
<div className="payment-page">
  {/* 예약 요약 */}
  <div className="reservation-summary">
    <h2>예약 정보</h2>
    <div className="seat-info">
      {selectedSeats.map(seat => (
        <div key={seat.id}>
          {seat.seatLabel} - {seat.price.toLocaleString()}원
        </div>
      ))}
    </div>
    <div className="total">
      <strong>총 결제 금액</strong>
      <span>{totalAmount.toLocaleString()}원</span>
    </div>
  </div>

  {/* 결제 수단 */}
  <div className="payment-methods">
    <label className={paymentMethod === 'naver_pay' ? 'selected' : ''}>
      <input type="radio" value="naver_pay" />
      네이버페이
    </label>
    <label className={paymentMethod === 'kakao_pay' ? 'selected' : ''}>
      <input type="radio" value="kakao_pay" />
      카카오페이
    </label>
    <label className={paymentMethod === 'bank_transfer' ? 'selected' : ''}>
      <input type="radio" value="bank_transfer" />
      계좌이체
    </label>
  </div>

  {/* 타이머 */}
  <div className="timer">
    ⏰ 남은 시간: {formatTime(remainingTime)}
    <p>시간 내에 결제하지 않으면 좌석이 자동 취소됩니다.</p>
  </div>

  {/* 결제 버튼 */}
  <button onClick={handlePayment} disabled={!paymentMethod}>
    {totalAmount.toLocaleString()}원 결제하기
  </button>
</div>
```

---

## 🔄 API 엔드포인트

### 좌석 조회
```
GET /api/seats/:eventId

Response:
{
  "seats": [
    {
      "id": "seat-uuid-1",
      "section": "VIP",
      "rowNumber": 1,
      "seatNumber": 5,
      "seatLabel": "VIP-1-5",
      "price": 150000,
      "status": "available"
    }
  ],
  "layout": { ... }
}
```

### 좌석 예약 (임시)
```
POST /api/seats/reserve

Request:
{
  "eventId": "event-uuid",
  "seatIds": ["seat-uuid-1", "seat-uuid-2"]
}

Response (성공):
{
  "reservationId": "reservation-uuid",
  "expiresAt": "2024-12-01T10:05:00Z",
  "seats": [...],
  "totalAmount": 300000
}

Response (실패):
{
  "error": "이미 예약된 좌석이 포함되어 있습니다.",
  "unavailableSeats": ["seat-uuid-1"]
}
```

### 결제 처리
```
POST /api/payments/process

Request:
{
  "reservationId": "reservation-uuid",
  "paymentMethod": "naver_pay"
}

Response:
{
  "success": true,
  "paymentId": "payment-uuid",
  "message": "결제가 완료되었습니다.",
  "reservation": { ... }
}
```

---

## 🚀 사용 방법

### 관리자 - 이벤트 생성

1. 관리자 로그인 (admin@tiketi.gg)
2. `/admin/events/new` 접속
3. 이벤트 정보 입력
4. **좌석 레이아웃 선택**: 소극장/대극장/스포츠 경기장
5. 이벤트 생성 → 좌석 자동 생성

### 사용자 - 좌석 선택 및 예매

1. 이벤트 상세 페이지에서 "좌석 선택하기" 클릭
2. 좌석 배치도에서 원하는 좌석 클릭 (최대 4석)
3. 색상 확인:
   - 🟢 초록색: 선택 가능
   - 🔵 파란색: 내가 선택함
   - ⚫ 회색: 이미 예약됨
   - 🟠 주황색: 다른 사용자가 선택 중
4. "결제하기" 버튼 클릭
5. 5분 내에 결제 수단 선택 및 결제
6. 예약 완료!

---

## 🧪 테스트 시나리오

### 시나리오 1: 정상 예약
1. 사용자 A가 좌석 선택
2. 결제 페이지로 이동
3. 5분 내에 결제 완료
4. 예약 확정 ✅

### 시나리오 2: 동시 선택 (Race Condition)
1. 사용자 A와 B가 동시에 같은 좌석 선택
2. A만 성공, B는 "선택 중" 메시지 ❌
3. A가 결제 완료 또는 만료
4. B가 다시 시도 가능

### 시나리오 3: 타임아웃
1. 사용자가 좌석 선택
2. 결제 페이지에서 5분 초과
3. 자동으로 예약 취소
4. 좌석 상태 복구 ✅

---

## 🐛 문제 해결

### 좌석이 보이지 않을 때
1. 이벤트에 좌석 레이아웃이 설정되었는지 확인
2. 마이그레이션이 완료되었는지 확인
3. DB 확인:
   ```sql
   SELECT COUNT(*) FROM seats WHERE event_id = 'YOUR_EVENT_ID';
   ```

### 결제가 안될 때
1. 좌석이 'locked' 상태인지 확인
2. 5분 타이머가 남아있는지 확인
3. 로그인 상태인지 확인

### 임시 예약이 자동 취소되지 않을 때
1. 백엔드 서버 실행 중인지 확인
2. 서버 로그에서 Cleaner 메시지 확인
3. `expires_at` 컬럼이 올바르게 설정되었는지 확인

---

## 📁 관련 파일

### 백엔드
- `backend/src/routes/seats.js` - 좌석 API
- `backend/src/routes/payments.js` - 결제 API
- `backend/src/services/seat-generator.js` - 좌석 자동 생성
- `backend/src/services/reservation-cleaner.js` - 만료 예약 정리
- `backend/src/middleware/seat-lock.js` - 좌석 락 미들웨어

### 프론트엔드
- `frontend/src/pages/SeatSelection.js` - 좌석 선택 페이지
- `frontend/src/pages/Payment.js` - 결제 페이지
- `frontend/src/pages/PaymentSuccess.js` - 결제 완료 페이지
- `frontend/src/hooks/useSeatUpdates.js` - 좌석 실시간 업데이트 훅

### 데이터베이스
- `database/migrations/002_add_seats.sql` - 좌석 관련 테이블

---

## ✅ 구현 완료 체크리스트

- [x] 좌석 레이아웃 시스템
- [x] 좌석 자동 생성
- [x] 실시간 좌석 동기화
- [x] 분산 락 동시성 제어
- [x] 5분 임시 예약
- [x] 자동 정리 시스템
- [x] 결제 시스템 (목업)
- [x] 관리자 좌석 관리

---

**전체 티켓팅 시스템이 완벽하게 작동합니다!** 🎉
