# 🎫 좌석 선택 & 결제 시스템 설계

> **목표**: 좌석 선택 UI + 분산 락 기반 동시성 제어 + 간단한 결제 목업

---

## 📋 전체 흐름

```
1. 관리자: 좌석 유형 생성 (예: 소극장, 대극장, 스포츠장)
   ↓
2. 관리자: 이벤트 생성 시 좌석 유형 선택
   ↓
3. 시스템: 선택된 유형에 따라 좌석 자동 생성
   ↓
4. 사용자: 이벤트 페이지에서 좌석 배치도 확인
   ↓
5. 사용자: 원하는 좌석 클릭
   ↓
6. 시스템: 분산 락으로 동시성 체크
   - 이미 예약됨? → "이미 예약된 좌석입니다" 알림
   - 선택 가능? → 5분 임시 예약 (결제 대기)
   ↓
7. 사용자: 결제 페이지로 이동
   ↓
8. 사용자: 결제 수단 선택 (네이버페이/카카오페이/계좌이체)
   ↓
9. 사용자: "결제하기" 클릭
   ↓
10. 시스템: 결제 완료 처리 (목업)
    ↓
11. 사용자: "결제 성공" 페이지 표시
```

---

## 🗄️ 데이터베이스 설계

### 1. 좌석 유형 테이블
```sql
-- 관리자가 만든 좌석 레이아웃 템플릿
CREATE TABLE seat_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,              -- 예: "소극장", "대극장", "스포츠 경기장"
    description TEXT,
    total_seats INTEGER,                     -- 총 좌석 수
    layout_config JSONB,                     -- 좌석 배치 정보
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 레이아웃 예시 데이터
INSERT INTO seat_layouts (name, description, total_seats, layout_config) VALUES
('소극장', '300석 규모의 소극장', 300, '{
  "sections": [
    {"name": "VIP", "rows": 3, "seatsPerRow": 10, "price": 150000},
    {"name": "R석", "rows": 5, "seatsPerRow": 15, "price": 100000},
    {"name": "S석", "rows": 8, "seatsPerRow": 20, "price": 70000}
  ]
}'),
('대극장', '1500석 규모의 대극장', 1500, '{
  "sections": [
    {"name": "VIP", "rows": 5, "seatsPerRow": 20, "price": 200000},
    {"name": "R석", "rows": 10, "seatsPerRow": 30, "price": 150000},
    {"name": "S석", "rows": 15, "seatsPerRow": 30, "price": 100000},
    {"name": "A석", "rows": 10, "seatsPerRow": 40, "price": 70000}
  ]
}'),
('스포츠 경기장', '5000석 규모의 스포츠 경기장', 5000, '{
  "sections": [
    {"name": "1층석", "rows": 20, "seatsPerRow": 50, "price": 80000},
    {"name": "2층석", "rows": 30, "seatsPerRow": 60, "price": 50000},
    {"name": "3층석", "rows": 30, "seatsPerRow": 70, "price": 30000}
  ]
}');
```

### 2. 이벤트 테이블 수정
```sql
-- events 테이블에 컬럼 추가
ALTER TABLE events ADD COLUMN seat_layout_id UUID REFERENCES seat_layouts(id);
```

### 3. 좌석 테이블
```sql
-- 각 이벤트의 실제 좌석
CREATE TABLE seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    section VARCHAR(50),        -- 구역 (예: "VIP", "R석", "S석")
    row_number INTEGER,         -- 행 (예: 1, 2, 3)
    seat_number INTEGER,        -- 좌석 번호 (예: 1, 2, 3)
    seat_label VARCHAR(20),     -- 표시용 라벨 (예: "VIP-1A", "R-3-15")
    
    price INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'available',  -- available, reserved, locked
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(event_id, section, row_number, seat_number)
);

CREATE INDEX idx_seats_event ON seats(event_id);
CREATE INDEX idx_seats_status ON seats(event_id, status);
```

### 4. 좌석 예약 테이블 (기존 reservations 통합)
```sql
-- reservations 테이블 수정
ALTER TABLE reservations ADD COLUMN payment_method VARCHAR(50);  -- 'naver_pay', 'kakao_pay', 'bank_transfer'
ALTER TABLE reservations ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending';  -- pending, completed, cancelled
ALTER TABLE reservations ADD COLUMN expires_at TIMESTAMP;  -- 임시 예약 만료 시간 (5분)

-- reservation_items 수정 (좌석 정보 추가)
ALTER TABLE reservation_items ADD COLUMN seat_id UUID REFERENCES seats(id);
```

---

## 🔒 동시성 제어 (분산 락 활용)

### 기존 분산 락 시스템 재사용
```javascript
// backend/src/config/redis.js (이미 구현됨)
const acquireLock = async (key, ttl = 5000) => {
  const lockKey = `lock:${key}`;
  const result = await redisClient.set(lockKey, Date.now(), {
    NX: true,
    PX: ttl
  });
  return result === 'OK';
};
```

### 좌석 예약 시 적용
```javascript
// 좌석별 락
const seatLockKey = `seat:${eventId}:${seatId}`;
const locked = await acquireLock(seatLockKey, 10000);  // 10초

if (!locked) {
  return res.status(409).json({ 
    error: '다른 사용자가 선택 중인 좌석입니다. 잠시 후 다시 시도해주세요.' 
  });
}

try {
  // 좌석 상태 확인 (DB)
  await client.query('BEGIN');
  const seat = await client.query(
    'SELECT * FROM seats WHERE id = $1 FOR UPDATE',
    [seatId]
  );
  
  if (seat.rows[0].status !== 'available') {
    throw new Error('이미 예약된 좌석입니다.');
  }
  
  // 임시 예약 생성 (5분 유효)
  // ...
  
  await client.query('COMMIT');
} finally {
  await releaseLock(seatLockKey);
}
```

---

## 🎨 프론트엔드: 좌석 선택 UI

### 좌석 배치도 컴포넌트
```jsx
// frontend/src/pages/SeatSelection.js

<div className="seat-map">
  {/* 무대/스크린 */}
  <div className="stage">
    STAGE
  </div>
  
  {/* 구역별 좌석 */}
  {sections.map(section => (
    <div className="section" key={section.name}>
      <h3>{section.name} - {section.price.toLocaleString()}원</h3>
      
      {/* 행별 좌석 */}
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

<style>
.seat {
  width: 30px;
  height: 30px;
  margin: 2px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.seat.available {
  background: #4CAF50;
  color: white;
}

.seat.available:hover {
  background: #45a049;
  transform: scale(1.1);
}

.seat.reserved {
  background: #ccc;
  color: #666;
  cursor: not-allowed;
}

.seat.selected {
  background: #2196F3;
  color: white;
  border: 2px solid #0d47a1;
}

.seat.locked {
  background: #ff9800;
  color: white;
  cursor: not-allowed;
}
</style>
```

### 좌석 상태 구분
```javascript
const SEAT_STATUS = {
  available: '선택 가능',    // 초록색
  selected: '선택됨',        // 파란색 (내가 선택)
  reserved: '예약 완료',     // 회색
  locked: '선택 중',         // 주황색 (다른 사람이 선택 중)
};
```

---

## 💳 결제 페이지 (목업)

### UI 구성
```jsx
// frontend/src/pages/Payment.js

<div className="payment-page">
  {/* 예약 정보 */}
  <div className="reservation-summary">
    <h2>예약 정보</h2>
    <div className="event-info">
      <h3>{event.title}</h3>
      <p>{event.venue} | {formatDate(event.eventDate)}</p>
    </div>
    
    <div className="seat-info">
      <h4>선택한 좌석</h4>
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
  
  {/* 결제 수단 선택 */}
  <div className="payment-methods">
    <h2>결제 수단</h2>
    
    <label className={`payment-option ${paymentMethod === 'naver_pay' ? 'selected' : ''}`}>
      <input 
        type="radio" 
        value="naver_pay"
        checked={paymentMethod === 'naver_pay'}
        onChange={(e) => setPaymentMethod(e.target.value)}
      />
      <img src="/images/naver-pay.png" alt="네이버페이" />
      네이버페이
    </label>
    
    <label className={`payment-option ${paymentMethod === 'kakao_pay' ? 'selected' : ''}`}>
      <input 
        type="radio" 
        value="kakao_pay"
        checked={paymentMethod === 'kakao_pay'}
        onChange={(e) => setPaymentMethod(e.target.value)}
      />
      <img src="/images/kakao-pay.png" alt="카카오페이" />
      카카오페이
    </label>
    
    <label className={`payment-option ${paymentMethod === 'bank_transfer' ? 'selected' : ''}`}>
      <input 
        type="radio" 
        value="bank_transfer"
        checked={paymentMethod === 'bank_transfer'}
        onChange={(e) => setPaymentMethod(e.target.value)}
      />
      <span>🏦</span>
      계좌이체
    </label>
  </div>
  
  {/* 결제 버튼 */}
  <button 
    className="payment-btn"
    onClick={handlePayment}
    disabled={!paymentMethod || isProcessing}
  >
    {isProcessing ? '결제 처리 중...' : `${totalAmount.toLocaleString()}원 결제하기`}
  </button>
  
  {/* 임시 예약 만료 타이머 */}
  <div className="timer">
    ⏰ 남은 시간: {formatTime(remainingTime)}
    <p className="timer-warning">시간 내에 결제하지 않으면 좌석이 자동 취소됩니다.</p>
  </div>
</div>
```

---

## 🔄 API 설계

### 1. 좌석 조회 API
```javascript
GET /api/events/:eventId/seats

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
      "status": "available"  // available, reserved, locked
    },
    ...
  ],
  "layout": {
    "sections": [
      {
        "name": "VIP",
        "rows": 3,
        "seatsPerRow": 10,
        "price": 150000
      }
    ]
  }
}
```

### 2. 좌석 선택 (임시 예약) API
```javascript
POST /api/seats/reserve

Request:
{
  "eventId": "event-uuid",
  "seatIds": ["seat-uuid-1", "seat-uuid-2"]
}

Response (성공):
{
  "reservationId": "reservation-uuid",
  "expiresAt": "2024-12-01T10:05:00Z",  // 5분 후
  "seats": [...],
  "totalAmount": 300000
}

Response (실패 - 이미 예약됨):
{
  "error": "이미 예약된 좌석이 포함되어 있습니다.",
  "unavailableSeats": ["seat-uuid-1"]
}

Response (실패 - 다른 사용자가 선택 중):
{
  "error": "다른 사용자가 선택 중인 좌석입니다. 잠시 후 다시 시도해주세요."
}
```

### 3. 결제 처리 API (목업)
```javascript
POST /api/payments/process

Request:
{
  "reservationId": "reservation-uuid",
  "paymentMethod": "naver_pay"  // naver_pay, kakao_pay, bank_transfer
}

Response (성공):
{
  "success": true,
  "paymentId": "payment-uuid",
  "message": "결제가 완료되었습니다.",
  "reservation": {
    "id": "reservation-uuid",
    "eventTitle": "임영웅 콘서트",
    "seats": [...],
    "totalAmount": 300000,
    "paymentMethod": "naver_pay",
    "paidAt": "2024-12-01T10:03:45Z"
  }
}

// 실제 PG사 연동은 하지 않고, 그냥 DB 상태만 변경
```

### 4. 임시 예약 만료 처리
```javascript
// 백그라운드 작업 (Cron Job)
// 5분 경과한 임시 예약 자동 취소

setInterval(async () => {
  const expiredReservations = await pool.query(`
    SELECT id FROM reservations
    WHERE payment_status = 'pending'
    AND expires_at < NOW()
  `);
  
  for (const reservation of expiredReservations.rows) {
    // 좌석 상태를 'available'로 복구
    await pool.query(`
      UPDATE seats
      SET status = 'available'
      WHERE id IN (
        SELECT seat_id FROM reservation_items
        WHERE reservation_id = $1
      )
    `, [reservation.id]);
    
    // 예약 취소
    await pool.query(
      'UPDATE reservations SET status = $1 WHERE id = $2',
      ['cancelled', reservation.id]
    );
  }
}, 30000);  // 30초마다 체크
```

---

## 📁 파일 구조

```
backend/
├── src/
│   ├── routes/
│   │   ├── seats.js          # 좌석 관련 API (NEW)
│   │   ├── payments.js       # 결제 API (NEW)
│   │   └── admin.js          # 좌석 유형 관리 추가
│   ├── services/
│   │   ├── seat-generator.js # 좌석 자동 생성 (NEW)
│   │   └── reservation-cleaner.js  # 만료 예약 정리 (NEW)
│   └── middleware/
│       └── seat-lock.js      # 좌석 락 미들웨어 (NEW)

frontend/
├── src/
│   ├── pages/
│   │   ├── SeatSelection.js  # 좌석 선택 페이지 (NEW)
│   │   ├── Payment.js        # 결제 페이지 (NEW)
│   │   └── PaymentSuccess.js # 결제 완료 페이지 (NEW)
│   ├── components/
│   │   ├── SeatMap.js        # 좌석 배치도 컴포넌트 (NEW)
│   │   └── SeatLegend.js     # 좌석 상태 범례 (NEW)
│   └── admin/
│       └── SeatLayoutManager.js  # 좌석 유형 관리 (NEW)

database/
└── migrations/
    └── 002_add_seats.sql     # 좌석 관련 테이블 (NEW)
```

---

## 🎯 구현 순서

### Phase 1: 데이터베이스 (1일)
- [x] TODO로 추가됨
- [ ] `seat_layouts` 테이블 생성
- [ ] `seats` 테이블 생성
- [ ] `events`, `reservations` 테이블 수정
- [ ] 샘플 좌석 유형 데이터 삽입

### Phase 2: 백엔드 - 좌석 시스템 (2일)
- [x] TODO로 추가됨
- [ ] 좌석 자동 생성 서비스
- [ ] 좌석 조회 API
- [ ] 좌석 예약 API (분산 락 적용)
- [ ] 만료 예약 자동 정리 Cron

### Phase 3: 백엔드 - 결제 (1일)
- [x] TODO로 추가됨
- [ ] 결제 처리 API (목업)
- [ ] 결제 완료 처리

### Phase 4: 관리자 페이지 (1일)
- [x] TODO로 추가됨
- [ ] 좌석 유형 관리 UI
- [ ] 이벤트 생성 시 좌석 유형 선택

### Phase 5: 사용자 페이지 - 좌석 선택 (2일)
- [x] TODO로 추가됨
- [ ] 좌석 배치도 컴포넌트
- [ ] 좌석 선택 UI
- [ ] 실시간 상태 업데이트

### Phase 6: 사용자 페이지 - 결제 (1일)
- [x] TODO로 추가됨
- [ ] 결제 페이지 UI
- [ ] 결제 수단 선택
- [ ] 결제 완료 페이지

**총 소요 시간: 약 8일 (1.5주)**

---

## 🎨 UI/UX 포인트

### 좌석 색상 코드
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
  animation: pulse 1s;
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

### 사용자 피드백
```javascript
// 좌석 선택 시
✅ "VIP-1-5 좌석을 선택했습니다."

// 이미 예약된 좌석 클릭 시
❌ "이미 예약된 좌석입니다. 다른 좌석을 선택해주세요."

// 다른 사람이 선택 중인 좌석 클릭 시
⚠️ "다른 사용자가 선택 중입니다. 잠시 후 다시 시도해주세요."

// 5분 타이머
⏰ "남은 시간: 4분 35초"
"시간 내에 결제하지 않으면 좌석이 자동 취소됩니다."

// 결제 완료
🎉 "결제가 완료되었습니다!"
```

---

## 🔐 보안 & 예외 처리

### 1. 동시성 제어
```javascript
// 분산 락으로 Race Condition 방지
✅ User A: 좌석 선택 → 락 획득 → 예약 처리
❌ User B: 동시 선택 → 락 획득 실패 → "선택 중" 메시지
```

### 2. 임시 예약 만료
```javascript
// 5분 후 자동 취소
setTimeout(() => {
  cancelReservation(reservationId);
}, 5 * 60 * 1000);
```

### 3. 중복 결제 방지
```javascript
// 이미 결제 완료된 예약은 다시 결제 불가
if (reservation.paymentStatus === 'completed') {
  throw new Error('이미 결제가 완료된 예약입니다.');
}
```

---

**준비 완료! 이제 구현 시작할까요?** 🚀

