# 🎫 TIKETI - 티켓 예매 시스템

Docker Compose 기반의 간단하고 강력한 티켓 예매 플랫폼입니다.

## ⚡ 팀원용 초간단 시작 (30초!)

```bash
# 1. 클론
git clone <repository-url>
cd tiketi

# 2. 실행
start.bat     # Windows
./start.sh    # Mac/Linux

# 3. 브라우저에서 http://localhost:3000 접속!
# 관리자: admin@tiketi.gg / admin123
```

> 📖 **상세 가이드**:
> - Windows: [`팀원용_시작가이드.md`](./팀원용_시작가이드.md)
> - macOS: [`macOS_시작가이드.md`](./macOS_시작가이드.md)
> - 개발자: [`GETTING_STARTED.md`](./GETTING_STARTED.md)

## 📋 주요 기능

### 사용자 기능
- ✅ 이벤트 목록 및 상세 조회
- ✅ 티켓 선택 및 수량 조절
- ✅ 실시간 재고 확인
- ✅ 예매 및 결제
- ✅ 내 예매 내역 조회
- ✅ 예매 취소

### 관리자 기능
- ✅ 대시보드 (통계, 최근 예매)
- ✅ 이벤트 생성/수정/삭제
- ✅ 티켓 타입 관리
- ✅ 예매 내역 관리

### 기술적 특징
- ✅ **DragonflyDB** 분산 락으로 동시성 제어
- ✅ **PostgreSQL** 트랜잭션 보장
- ✅ **Redis 캐싱** 성능 최적화
- ✅ **Docker Compose** 간편한 배포

## 🏗️ 아키텍처

```
┌─────────────┐
│   Frontend  │  React (Port 3000)
│   (React)   │
└──────┬──────┘
       │
┌──────▼──────┐
│   Backend   │  Node.js + Express (Port 3001)
│  (Express)  │
└──────┬──────┘
       │
       ├────────────┐
       │            │
┌──────▼──────┐ ┌──▼────────┐
│  PostgreSQL │ │ DragonflyDB│
│   (5432)    │ │   (6379)   │
└─────────────┘ └────────────┘
```

## 🚀 빠른 시작

### 1. 저장소 클론
```bash
git clone <repository-url>
cd tiketi
```

### 2. Docker Compose로 실행

**방법 1: 편리한 스크립트 사용 (권장)**
```bash
# Windows
start.bat

# Mac/Linux
chmod +x start.sh
./start.sh
```

**방법 2: 직접 실행**
```bash
docker-compose up -d
```

### 3. 편리한 스크립트 모음

| 파일 | 용도 |
|------|------|
| `start.bat` / `start.sh` | 서비스 시작 |
| `stop.bat` | 서비스 중지 |
| `logs.bat` | 로그 확인 |
| `reset.bat` | 완전 초기화 (데이터 삭제) |

### 4. 서비스 접속
- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **DragonflyDB**: localhost:6379

## 👤 테스트 계정

### 관리자 계정
- 이메일: `admin@tiketi.gg`
- 비밀번호: `admin123`

### 일반 사용자
- 회원가입 페이지에서 직접 가입

## 📁 프로젝트 구조

```
tiketi/
├── docker-compose.yml          # Docker Compose 설정
├── database/
│   └── init.sql               # DB 초기화 스크립트
├── backend/
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── server.js          # Express 서버
│       ├── config/
│       │   ├── database.js    # PostgreSQL 연결
│       │   └── redis.js       # DragonflyDB 연결
│       ├── routes/            # API 라우트
│       │   ├── auth.js        # 인증
│       │   ├── events.js      # 이벤트
│       │   ├── tickets.js     # 티켓
│       │   ├── reservations.js# 예매
│       │   └── admin.js       # 관리자
│       └── middleware/
│           └── auth.js        # JWT 인증
└── frontend/
    ├── package.json
    ├── Dockerfile
    └── src/
        ├── App.js
        ├── services/
        │   └── api.js         # API 클라이언트
        ├── components/
        │   └── Header.js
        └── pages/
            ├── Home.js        # 이벤트 목록
            ├── EventDetail.js # 이벤트 상세/예매
            ├── Login.js
            ├── Register.js
            ├── MyReservations.js
            └── admin/
                ├── Dashboard.js
                ├── Events.js
                └── EventForm.js
```

## 🔑 핵심 기술

### 백엔드
- **Node.js** 18
- **Express** - REST API
- **PostgreSQL** 15 - 메인 데이터베이스
- **DragonflyDB** - Redis 호환 캐시 + 분산 락
- **JWT** - 인증/인가
- **bcrypt** - 비밀번호 암호화

### 프론트엔드
- **React** 18
- **React Router** - 클라이언트 라우팅
- **Axios** - HTTP 클라이언트
- **date-fns** - 날짜 포맷팅

### 인프라
- **Docker** & **Docker Compose**
- **PostgreSQL** (공식 이미지)
- **DragonflyDB** (Redis alternative)

## 🔒 보안 기능

### 인증 & 인가
- JWT 토큰 기반 인증
- 역할 기반 접근 제어 (user, admin)
- 비밀번호 bcrypt 해싱

### 동시성 제어
- DragonflyDB 분산 락으로 좌석 중복 예매 방지
- PostgreSQL 트랜잭션으로 데이터 일관성 보장

## 📊 데이터베이스 스키마

### 주요 테이블
- `users` - 사용자 정보
- `events` - 이벤트 정보
- `ticket_types` - 티켓 타입 (VIP석, R석, S석 등)
- `reservations` - 예매 정보
- `reservation_items` - 예매 상세 (티켓별 수량)

## 🔄 예매 프로세스

1. 사용자가 티켓 선택 및 수량 입력
2. 예매하기 클릭
3. **백엔드에서 분산 락 획득** (`ticket:${ticketTypeId}`)
4. 재고 확인 (PostgreSQL `FOR UPDATE`)
5. 재고 충분 → 예매 생성 + 재고 차감
6. 트랜잭션 커밋
7. **락 해제**
8. 캐시 무효화

## 🎯 성능 최적화

### 캐싱 전략
- 이벤트 목록: 5분 캐싱
- 이벤트 상세: 2분 캐싱
- 예매/취소 시 관련 캐시 무효화

### 분산 락
```javascript
// 10초 TTL로 락 획득
const locked = await acquireLock(`ticket:${ticketTypeId}`, 10000);

if (locked) {
  // 크리티컬 섹션
  // 재고 확인 및 예매 처리
  
  await releaseLock(`ticket:${ticketTypeId}`);
}
```

## 🛠️ 개발 가이드

### 로컬 개발 (Docker 없이)

#### 백엔드
```bash
cd backend
npm install
npm run dev
```

#### 프론트엔드
```bash
cd frontend
npm install
npm start
```

#### 데이터베이스
PostgreSQL과 Redis를 로컬에 설치하거나 Docker로 개별 실행:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=tiketi_pass postgres:15
docker run -d -p 6379:6379 docker.dragonflydb.io/dragonflydb/dragonfly
```

### API 엔드포인트

#### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인

#### 이벤트
- `GET /api/events` - 이벤트 목록
- `GET /api/events/:id` - 이벤트 상세

#### 예매
- `POST /api/reservations` - 예매 생성
- `GET /api/reservations/my` - 내 예매 목록
- `GET /api/reservations/:id` - 예매 상세
- `POST /api/reservations/:id/cancel` - 예매 취소

#### 관리자
- `GET /api/admin/dashboard/stats` - 대시보드 통계
- `POST /api/admin/events` - 이벤트 생성
- `PUT /api/admin/events/:id` - 이벤트 수정
- `DELETE /api/admin/events/:id` - 이벤트 삭제

## 🐛 트러블슈팅

### 컨테이너가 시작되지 않음
```bash
docker-compose down -v
docker-compose up --build
```

### 데이터베이스 초기화
```bash
docker-compose down -v
docker volume rm tiketi_postgres_data
docker-compose up -d
```

### 포트 충돌
`.env` 파일을 만들어 포트 변경:
```env
FRONTEND_PORT=3000
BACKEND_PORT=3001
POSTGRES_PORT=5432
REDIS_PORT=6379
```

## 📈 향후 개선 사항

- [ ] 결제 게이트웨이 연동
- [ ] 이메일 알림 (예매 확인, 취소)
- [ ] 좌석 배치도 UI
- [ ] 이벤트 카테고리 분류
- [ ] 검색 및 필터링 고도화
- [ ] 이미지 업로드 기능
- [ ] 실시간 알림 (WebSocket)
- [ ] 쿠폰 및 할인 시스템
- [ ] 리뷰 및 평점 기능

## 📝 라이선스

MIT License

## 👨‍💻 개발자

티케티 개발팀

---

**Made with ❤️ for better ticketing experience**

