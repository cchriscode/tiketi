# MSA 마이그레이션 분석

## 📊 현재 구조 분석

### Backend Routes (backend/src/routes/)
```
✅ admin.js          - Backend 고유 (유지)
🔴 auth.js           - Auth Service 중복 (제거 → 프록시)
🔴 events.js         - Ticket Service 중복 (제거 → 프록시)
✅ health.js         - Backend 고유 (유지)
✅ image.js          - Backend 고유 (유지)
✅ news.js           - Backend 고유 (유지)
🔴 payments.js       - Payment Service 중복 (제거 → 프록시)
🔴 queue.js          - Ticket Service 중복 (제거 → 프록시)
🔴 reservations.js   - Ticket Service 중복 (제거 → 프록시)
🔴 seats.js          - Ticket Service 중복 (제거 → 프록시)
✅ stats-proxy.js    - 이미 프록시 (유지)
🔴 tickets.js        - Ticket Service 중복 (제거 → 프록시)
```

### MSA Service Routes

**Auth Service (port 3005)**:
- `auth.js` - 회원가입, 로그인

**Ticket Service (port 3002)**:
- `events.js` - 이벤트 조회
- `tickets.js` - 티켓 조회, 재고 확인
- `seats.js` - 좌석 조회, 선택
- `reservations.js` - 예약 생성, 조회, 취소
- `queue.js` - 대기열 관리

**Payment Service (port 3003)**:
- `payments.js` - 결제 준비, 확인, 처리

**Stats Service (port 3004)**:
- `stats.js` - 통계 조회

---

## 🎯 마이그레이션 계획

### Phase 1: 프록시 생성

**생성할 파일**:
1. `backend/src/routes/auth-proxy.js` - Auth Service (3005)로 프록시
2. `backend/src/routes/ticket-proxy.js` - Ticket Service (3002)로 프록시
3. `backend/src/routes/payment-proxy.js` - Payment Service (3003)로 프록시

### Phase 2: Backend server.js 수정

**제거할 라우트**:
```javascript
// 제거
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/seats', require('./routes/seats'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/queue', require('./routes/queue'));
```

**추가할 프록시 라우트**:
```javascript
// MSA Proxies
app.use('/api/auth', require('./routes/auth-proxy'));
app.use('/api', require('./routes/ticket-proxy')); // events, tickets, seats, reservations, queue
app.use('/api/payments', require('./routes/payment-proxy'));
app.use('/api/stats', require('./routes/stats-proxy')); // 이미 존재

// Backend 고유 기능
app.use('/api/admin', require('./routes/admin'));
app.use('/api/news', require('./routes/news'));
if (process.env.AWS_S3_BUCKET) {
  app.use('/api/image', require('./routes/image'));
}
app.use('/', require('./routes/health'));
```

### Phase 3: 파일 제거

**제거할 파일**:
- `backend/src/routes/auth.js`
- `backend/src/routes/events.js`
- `backend/src/routes/tickets.js`
- `backend/src/routes/seats.js`
- `backend/src/routes/reservations.js`
- `backend/src/routes/queue.js`
- `backend/src/routes/payments.js`

---

## 📝 상세 엔드포인트 매핑

### Auth Proxy → Auth Service (3005)
```
/api/auth/* → http://auth-service:3005/api/auth/*
```

### Ticket Proxy → Ticket Service (3002)
```
/api/events/* → http://ticket-service:3002/api/events/*
/api/tickets/* → http://ticket-service:3002/api/tickets/*
/api/seats/* → http://ticket-service:3002/api/seats/*
/api/reservations/* → http://ticket-service:3002/api/reservations/*
/api/queue/* → http://ticket-service:3002/api/queue/*
```

### Payment Proxy → Payment Service (3003)
```
/api/payments/* → http://payment-service:3003/api/payments/*
```

### Stats Proxy → Stats Service (3004) ✅ 이미 존재
```
/api/stats/* → http://stats-service:3004/api/stats/*
```

---

## ✅ Frontend 변경사항

**Frontend는 변경 불필요!**
- Frontend는 계속 `http://localhost:3001/api/*`로 호출
- Backend가 내부적으로 MSA로 프록시
- 투명한 전환 (Transparent Migration)

---

## 🔒 안전 체크리스트

- [ ] 프록시 파일 3개 생성
- [ ] Backend server.js 라우트 교체
- [ ] 기존 파일 제거
- [ ] Health check 확인
- [ ] Frontend 기능 테스트
- [ ] 에러 로깅 확인
