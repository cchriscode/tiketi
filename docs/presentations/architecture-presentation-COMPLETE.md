# 티켓팅 사이트 AWS 프로덕션 아키텍처 설명 대본 (완전판)

## 발표 시작

안녕하세요, 오늘 저희 티켓팅 사이트의 AWS 프로덕션 아키텍처에 대해 설명드리겠습니다.

특히 대규모 트래픽 상황에서 안정적인 서비스를 제공하기 위한 핵심 설계에 중점을 두고 말씀드릴게요.

---

## 1. 전체 아키텍처 개요

먼저 전체 구조를 한눈에 보여드리겠습니다.

사용자가 tiketi.gg를 브라우저에 입력하면:

1. **Route 53** (DNS 서비스)가 도메인을 IP로 변환
2. **CloudFront** (CDN)가 전세계 엣지 로케이션에서 빠르게 응답
3. **ALB** (로드밸런서)가 여러 백엔드 서버에 트래픽 분산
4. **EC2 인스턴스들**이 실제 API 처리
5. **ElastiCache Redis**로 실시간 동기화 및 대기열 관리
6. **RDS Aurora**에 데이터 영구 저장

이 모든 리소스는 **VPC**라는 가상 네트워크 안에서 안전하게 격리되어 있고,
**2개의 가용 영역(Availability Zone)**에 분산 배치되어 있습니다.

하나의 데이터센터에 장애가 발생해도 서비스가 계속 운영되는 **고가용성 구조**입니다.

---

## 2. 네트워크 및 보안 설계

본격적인 설명에 앞서, 네트워크 구조와 보안 설계를 먼저 말씀드리겠습니다.

### 2.1 VPC - 가상 네트워크

모든 AWS 리소스는 **VPC (Virtual Private Cloud)** 안에 있습니다.
VPC는 AWS 클라우드에서 논리적으로 격리된 우리만의 네트워크 공간입니다.

**CIDR: 10.0.0.0/16**
- 10.0.0.0부터 10.0.255.255까지, 약 65,000개의 IP 주소 사용 가능
- 우리 티켓팅 사이트의 모든 서버, 데이터베이스, 캐시가 이 네트워크 안에 있습니다

### 2.2 Multi-AZ 고가용성 구성

저희는 **서울 리전 (ap-northeast-2)**에 배포하는데,
중요한 건 **2개의 가용 영역(AZ)**에 모든 리소스를 복제한다는 겁니다.

**가용 영역이란?**
- 물리적으로 분리된 데이터센터
- 각 AZ는 독립적인 전력, 네트워크를 가짐
- 하나가 다운되어도 다른 하나가 계속 작동

**우리의 구성:**
- **AZ-A (ap-northeast-2a)**: 서울 첫 번째 데이터센터
- **AZ-B (ap-northeast-2b)**: 서울 두 번째 데이터센터

예를 들어:
- RDS Aurora: Primary DB가 AZ-A에, Replica DB가 AZ-B에 있습니다
- AZ-A에 정전이 발생하면? Replica가 자동으로 Primary로 승격 (1~2분 소요)
- 사용자는 서비스 중단을 거의 느끼지 못합니다

### 2.3 서브넷 구조 - 3층 보안 계층

VPC를 3가지 타입의 서브넷으로 나눴습니다. 마치 건물의 로비, 사무실, 금고처럼 보안 레벨을 나눈 거죠.

#### 첫 번째 층: Public Subnet (외부와 직접 통신)

**배치 리소스:**
- **ALB (Application Load Balancer)**: 사용자 요청의 진입점
- **NAT Gateway**: Private 서브넷이 외부와 통신할 때 사용

**서브넷 구성:**
- Public Subnet A (10.0.1.0/24) - AZ-A
- Public Subnet B (10.0.2.0/24) - AZ-B

**특징:**
- Internet Gateway와 직접 연결
- 외부 인터넷에서 접근 가능
- 사용자 트래픽의 첫 번째 접점

#### 두 번째 층: Private Subnet (보안 강화 영역)

**배치 리소스:**
- **EC2 백엔드 서버**: Node.js + Socket.IO 실행
- **ElastiCache Redis**: 캐시, 큐, Pub/Sub 담당

**서브넷 구성:**
- Private Subnet A (10.0.11.0/24) - AZ-A
- Private Subnet B (10.0.12.0/24) - AZ-B

**특징:**
- 인터넷에서 직접 접근 **불가능**
- 외부 통신이 필요할 때는 NAT Gateway를 통해서만
  - 예: npm 패키지 설치, 외부 API 호출, S3 업로드
- ALB를 거친 요청만 처리

**왜 이렇게 하나요?**
해커가 백엔드 서버를 직접 공격할 수 없습니다.
반드시 ALB → EC2 순서로만 접근 가능하기 때문에,
ALB 레벨에서 DDoS 방어, Rate Limiting 등을 적용할 수 있습니다.

#### 세 번째 층: DB Subnet (최고 보안 영역)

**배치 리소스:**
- **RDS Aurora PostgreSQL**: 모든 영구 데이터 저장

**서브넷 구성:**
- DB Subnet A (10.0.21.0/24) - AZ-A
- DB Subnet B (10.0.22.0/24) - AZ-B

**특징:**
- 인터넷 접근 완전 차단
- EC2 백엔드 서버에서만 접근 가능
- 데이터베이스 포트(5432)를 외부에 절대 노출하지 않음

**왜 중요한가요?**
데이터베이스는 사용자 개인정보, 결제 내역 등 가장 민감한 데이터를 담고 있습니다.
3층 구조로 인해 해커가 DB에 접근하려면:
1. CloudFront 우회
2. ALB 침투
3. EC2 서버 해킹
이 모든 단계를 통과해야 합니다. 사실상 불가능한 구조죠.

### 2.4 네트워크 게이트웨이

#### Internet Gateway
- VPC와 인터넷을 연결하는 관문
- Public Subnet의 ALB, NAT Gateway가 이를 통해 인터넷과 통신

#### NAT Gateway (각 AZ에 1개씩)
- Private Subnet의 EC2가 외부로 나갈 때 사용
- 외부에서 안으로는 못 들어오고, 안에서 밖으로만 나갈 수 있음 (단방향)
- **고가용성**: AZ-A의 NAT Gateway가 다운되어도 AZ-B의 NAT Gateway로 계속 통신

**예시:**
```
EC2에서 npm install 명령 실행
→ Private Subnet에서 npm 레지스트리로 패키지 다운로드 필요
→ NAT Gateway를 통해 외부로 나감
→ 패키지 다운로드 완료
→ EC2로 돌아옴
```

### 2.5 Security Group (방화벽 규칙)

각 컴포넌트마다 Security Group이라는 가상 방화벽을 설정합니다.
"누가, 어떤 포트로 접근할 수 있는가"를 정의하는 거죠.

#### ALB-SG (ALB 방화벽)
- **Inbound**:
  - 포트 80 (HTTP): 전세계 모든 IP 허용 (0.0.0.0/0)
  - 포트 443 (HTTPS): 전세계 모든 IP 허용
- **목적**: 사용자들이 웹사이트에 접속할 수 있도록

#### EC2-SG (백엔드 서버 방화벽)
- **Inbound**:
  - 포트 3001 (Node.js API): **ALB-SG에서만** 허용
- **목적**: ALB를 거치지 않은 직접 접근 차단

**중요:** 만약 해커가 EC2의 IP 주소를 알아냈다고 해도,
EC2-SG가 ALB 외의 모든 접근을 차단하기 때문에 공격이 불가능합니다.

#### Redis-SG (캐시 방화벽)
- **Inbound**:
  - 포트 6379 (Redis): **EC2-SG에서만** 허용
- **목적**: 백엔드 서버만 Redis에 접근 가능

#### RDS-SG (데이터베이스 방화벽)
- **Inbound**:
  - 포트 5432 (PostgreSQL): **EC2-SG에서만** 허용
- **목적**: 백엔드 서버만 DB에 접근 가능

### 2.6 보안 계층 정리

정리하자면, 보안은 이렇게 층층이 쌓여 있습니다:

```
사용자
  ↓ (인터넷)
CloudFront (DDoS 방어, SSL 종료)
  ↓
ALB-SG (80, 443 포트만 허용)
  ↓
EC2-SG (ALB에서만 3001 포트 허용)
  ↓
Redis-SG (EC2에서만 6379 포트 허용)
  ↓
RDS-SG (EC2에서만 5432 포트 허용)
```

**결과**: 해커가 뚫어야 할 보안 계층이 5개!

---

## 3. 사용자 요청 흐름

이제 네트워크 구조를 이해하셨으니, 실제 사용자 요청이 어떻게 흘러가는지 보시죠.

### 3.1 프론트엔드 배포 구조

사용자가 브라우저에 `tiketi.gg`를 입력하면:

**1단계: Route 53 (DNS 조회)**
```
사용자: "tiketi.gg가 어디 있지?"
Route 53: "CloudFront 주소는 d123abc.cloudfront.net이에요"
```

**2단계: CloudFront (CDN)**
- 사용자가 서울에 있다면? 서울 엣지 로케이션에서 응답
- 부산에 있다면? 부산 엣지 로케이션에서 응답
- LA에 있다면? LA 엣지 로케이션에서 응답

**CloudFront가 캐싱하는 것:**
- React 빌드 파일 (HTML, CSS, JavaScript)
- 이미지, 폰트 등 정적 파일

**3단계: S3 Bucket (원본 파일)**
- React 앱을 `npm run build`로 빌드
- 생성된 파일들을 S3 버킷에 업로드
- CloudFront가 이 S3 버킷을 "Origin"으로 설정
- 처음 요청 시 S3에서 가져와서 CloudFront에 캐싱
- 이후 요청은 캐시된 파일 제공 (초고속)

**전세계 어디서든 빠른 이유:**
```
서울 사용자 → 서울 엣지 (10ms)
부산 사용자 → 부산 엣지 (8ms)
LA 사용자 → LA 엣지 (15ms)
```

S3 버킷이 서울에 있어도, 전세계 엣지 로케이션이 캐싱하고 있어서 모두 빠릅니다!

### 3.2 백엔드 API 처리 구조

이제 사용자가 프론트엔드를 보고 있다가, "티켓 목록 조회" 버튼을 클릭했다고 가정해봅시다.

**1단계: API 요청**
```javascript
// 프론트엔드 코드
fetch('https://tiketi.gg/api/events')
```

**2단계: CloudFront → ALB**
- CloudFront가 `/api/*` 경로는 캐싱하지 않고 ALB로 전달
- 동적 데이터는 항상 최신 정보여야 하니까요

**3단계: ALB (Load Balancer)**
- ALB는 Public Subnet에 있습니다
- Target Group에 등록된 EC2 인스턴스들 중 하나를 선택
- 현재 10대의 EC2가 있다면, 그중 가장 부하가 적은 곳으로 라우팅

**라우팅 알고리즘:**
- Round Robin: 순서대로 돌아가며 분배
- Least Outstanding Requests: 처리 중인 요청이 가장 적은 서버로

**4단계: EC2 인스턴스**
- Private Subnet에 있습니다 (외부 직접 접근 불가)
- Node.js + Express 서버 실행 중
- Socket.IO WebSocket 서버도 함께 실행

### 3.3 Sticky Session - WebSocket 연결 유지의 핵심

여기서 중요한 개념이 나옵니다. **Sticky Session**입니다.

#### 왜 필요한가?

**일반 REST API의 경우:**
```
사용자 A의 첫 번째 요청: EC2-1이 처리
사용자 A의 두 번째 요청: EC2-2가 처리
→ 문제없음! 각 요청이 독립적이니까요.
```

**WebSocket의 경우:**
```
사용자 A가 EC2-1과 WebSocket 연결 맺음 (마치 전화 통화 시작)
사용자 A의 다음 HTTP 요청이 EC2-2로 라우팅되면?
→ EC2-2: "이 사용자의 WebSocket 연결이 어디 있지?"
→ 연결이 끊어지거나 데이터를 찾지 못함!
```

WebSocket은 **지속적인 양방향 연결**입니다. 전화 통화처럼, 한번 연결되면 계속 그 연결을 유지해야 합니다.

#### 해결책: Sticky Session

ALB가 **쿠키**를 사용해서 "이 사용자는 계속 EC2-1로 보내자"고 기억합니다.

**동작 방식:**
```
1. 사용자 A가 처음 접속
2. ALB가 EC2-1로 라우팅
3. ALB가 쿠키 생성: AWSALB=ec2-1-identifier
4. 브라우저가 이 쿠키 저장
5. 이후 모든 요청에 이 쿠키 포함
6. ALB가 쿠키 확인: "아, 이 사용자는 EC2-1이구나"
7. 계속 EC2-1로 라우팅
```

**설정:**
```
ALB Target Group 설정
- Stickiness: Enabled
- Stickiness type: Load balancer generated cookie
- Stickiness duration: 86400 seconds (24시간)
```

**결과:**
- 사용자 A는 세션이 끝날 때까지 항상 EC2-1과 통신
- WebSocket 연결이 안정적으로 유지됨
- 대기열 정보, 좌석 선택 상태 등이 유실되지 않음

---

## 4. Redis Pub/Sub - 멀티 인스턴스 동기화의 핵심

자, 이제 가장 중요한 부분입니다. **여러 EC2 서버 간 실시간 동기화**입니다.

### 4.1 문제 상황

현재 상황:
- 사용자 A는 EC2-1에 연결되어 있음
- 사용자 B는 EC2-2에 연결되어 있음
- 사용자 C는 EC2-3에 연결되어 있음

사용자 A가 "A열 1번 좌석" 티켓을 구매했습니다.
이 정보를 **모든 사용자**가 실시간으로 알아야 합니다!

"이 좌석은 이미 판매됐습니다"라고 보여줘야 하니까요.

### 4.2 Socket.IO의 한계

Socket.IO의 기본 동작:
```javascript
// EC2-1에서 실행
io.emit('ticket-sold', { seatId: 'A-1' });
```

이렇게 하면?
- ✅ EC2-1에 연결된 사용자들은 메시지 받음 (사용자 A)
- ❌ EC2-2에 연결된 사용자들은 메시지 못 받음 (사용자 B)
- ❌ EC2-3에 연결된 사용자들은 메시지 못 받음 (사용자 C)

**이유:** Socket.IO는 기본적으로 같은 Node.js 프로세스 내의 클라이언트에게만 메시지를 전달합니다.

### 4.3 해결책: Redis Pub/Sub

**Redis**는 인메모리 데이터베이스인데, **Pub/Sub (발행/구독)** 기능을 제공합니다.

#### Pub/Sub란?

마치 유튜브 채널처럼:
- **발행(Publish)**: "새 영상 올렸어요!" (방송)
- **구독(Subscribe)**: "이 채널 구독 중!" (알림 받기)
- **결과**: 구독자들이 모두 알림을 받음

#### 우리 시스템에 적용:

**설정 (코드):**
```javascript
// backend/src/config/socket.js
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

// Redis Pub 클라이언트 (발행용)
const pubClient = createClient({
  host: 'tiketi-redis.abc123.ng.0001.apn2.cache.amazonaws.com',
  port: 6379
});

// Redis Sub 클라이언트 (구독용)
const subClient = pubClient.duplicate();

// Socket.IO에 Redis Adapter 연결
io.adapter(createAdapter(pubClient, subClient));
```

**동작 흐름:**

```
1. 사용자 A가 EC2-1에서 티켓 구매
2. EC2-1이 Redis에 메시지 발행 (Publish)
   - 채널: "socket.io#/#"
   - 메시지: { type: 'ticket-sold', data: { seatId: 'A-1' } }

3. Redis가 이 메시지를 구독 중인 모든 EC2에게 브로드캐스트
   - EC2-1 ← 메시지 받음
   - EC2-2 ← 메시지 받음
   - EC2-3 ← 메시지 받음

4. 각 EC2가 자신에게 연결된 클라이언트들에게 WebSocket으로 전달
   - EC2-1 → 사용자 A에게 전송
   - EC2-2 → 사용자 B에게 전송
   - EC2-3 → 사용자 C에게 전송

5. 결과: 모든 사용자가 실시간으로 "A-1 좌석 판매됨" 정보를 받음!
```

**코드로 보면:**
```javascript
// EC2-1에서 실행
io.emit('ticket-sold', { seatId: 'A-1' });

// 내부적으로:
// 1. Socket.IO가 Redis에 Publish
// 2. Redis가 모든 EC2에게 브로드캐스트
// 3. 모든 EC2가 자신의 클라이언트들에게 emit
```

**Redis Adapter의 마법:**
- 코드는 그대로! `io.emit()` 한 줄이면 끝
- Redis Adapter가 자동으로 Pub/Sub 처리
- 개발자는 단일 서버처럼 코딩하면 됨
- 멀티 서버 동기화는 자동!

---

## 5. Redis의 3가지 역할

Redis는 우리 시스템에서 3가지 중요한 역할을 합니다.

### 5.1 첫 번째: Pub/Sub (실시간 동기화)

방금 설명드린 WebSocket 메시지 동기화입니다.

**사용 사례:**
- 티켓 판매 알림
- 좌석 선택 상태 변경
- 실시간 대기 인원 업데이트
- 이벤트 시작/종료 알림

### 5.2 두 번째: Queue (대기열 관리)

대규모 트래픽이 몰릴 때, **대기열**로 사용자를 순서대로 처리합니다.

**Redis의 Sorted Set 자료구조 사용:**
```javascript
// 사용자를 대기열에 추가 (현재 시간을 점수로)
redis.zAdd('waiting-queue:event-123', Date.now(), 'user-456');

// 사용자의 대기 순번 조회
const position = redis.zRank('waiting-queue:event-123', 'user-456');
// 결과: 8245 (8,245번째)

// 대기열 앞에서 50명씩 꺼내서 처리
const users = redis.zRange('waiting-queue:event-123', 0, 49);
redis.zRemRangeByRank('waiting-queue:event-123', 0, 49);
```

**특징:**
- **FIFO 보장**: 먼저 들어온 사람이 먼저 처리
- **새로고침해도 순번 유지**: Redis에 저장되어 있으니까
- **빠른 성능**: 인메모리 연산, 100만 명도 밀리초 단위 처리
- **원자적 연산**: 동시 요청에도 순번이 꼬이지 않음

**사용자 경험:**
```
"현재 8,245번째로 대기 중입니다."
"예상 대기 시간: 약 2분"
→ 페이지 새로고침해도 순번 그대로!
```

### 5.3 세 번째: Cache (세션 및 임시 데이터)

**캐싱하는 데이터:**

1. **세션 정보**
```javascript
// 로그인 시 세션 저장 (30분 유효)
redis.set('session:abc123', JSON.stringify({
  userId: 'user-456',
  email: 'user@example.com',
  role: 'user'
}), 'EX', 1800);

// 매 요청마다 세션 조회
const session = await redis.get('session:abc123');
```

2. **임시 좌석 선택 (5분 타임아웃)**
```javascript
// 사용자가 좌석 선택
redis.set('seat:A-1:reserved', 'user-456', 'EX', 300);

// 5분 후 자동 삭제 → 다른 사람이 선택 가능
```

3. **API 응답 캐싱**
```javascript
// 이벤트 목록 (1분 캐싱)
const cached = await redis.get('events:list');
if (cached) return JSON.parse(cached);

const events = await db.query('SELECT * FROM events');
redis.set('events:list', JSON.stringify(events), 'EX', 60);
```

**왜 Redis를 사용하나요?**
- **속도**: 메모리 기반, PostgreSQL보다 100배 빠름
- **TTL (자동 만료)**: 시간 지나면 자동 삭제
- **원자적 연산**: 동시성 제어 쉬움

**비용 절감 효과:**
- DB 쿼리 90% 감소
- 응답 속도 50ms → 5ms
- RDS 부하 감소로 더 작은 인스턴스 사용 가능

---

## 6. 데이터베이스 구조

### 6.1 RDS Aurora PostgreSQL

영구적으로 저장해야 하는 데이터는 **RDS Aurora PostgreSQL**에 저장합니다.

**저장하는 데이터:**
- 사용자 정보 (회원 가입, 프로필)
- 이벤트 정보 (공연 상세, 날짜, 장소)
- 티켓 타입 (가격, 등급)
- 좌석 정보 (배치도)
- 예매 내역 (결제 완료된 주문)

**코드 예시:**
```javascript
// 티켓 예매 (트랜잭션)
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // 1. 좌석 상태 확인 및 예약
  const seat = await client.query(
    'SELECT * FROM seats WHERE id = $1 FOR UPDATE',
    [seatId]
  );

  if (seat.rows[0].status !== 'available') {
    throw new Error('이미 예약된 좌석입니다');
  }

  // 2. 좌석 상태 변경
  await client.query(
    'UPDATE seats SET status = $1, user_id = $2 WHERE id = $3',
    ['reserved', userId, seatId]
  );

  // 3. 예약 기록 생성
  await client.query(
    'INSERT INTO reservations (user_id, seat_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'5 minutes\')',
    [userId, seatId]
  );

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### 6.2 Aurora의 장점

**일반 RDS PostgreSQL vs Aurora:**

| 기능 | RDS PostgreSQL | Aurora |
|------|---------------|---------|
| 성능 | 1x | **5x** |
| 스토리지 | 수동 확장 | **자동 확장 (최대 128TB)** |
| Read Replica | 최대 5개 | **최대 15개** |
| 페일오버 | 1~2분 | **30초** |
| 백업 | 성능 영향 있음 | **성능 영향 없음** |

### 6.3 Multi-AZ 고가용성

**구성:**
- **Primary DB**: AZ-A에 위치, 읽기/쓰기 처리
- **Replica DB**: AZ-B에 위치, 읽기만 처리
- 실시간 복제 (1초 이내 동기화)

**장애 시나리오:**
```
오후 8시 00분: Primary DB(AZ-A)에 하드웨어 장애 발생
오후 8시 00분 30초: Aurora가 자동으로 Replica(AZ-B)를 Primary로 승격
오후 8시 00분 35초: DNS 자동 업데이트
오후 8시 00분 40초: 모든 EC2가 새 Primary로 연결 재시도
오후 8시 01분: 서비스 완전 복구

다운타임: 약 1분
데이터 손실: 0건 (동기 복제)
```

사용자 입장에서는 "잠깐 느려졌다"고 느낄 정도입니다.

---

## 7. 대기열 시스템

### 7.1 왜 대기열이 필요한가?

인기 티켓 오픈 시:
```
오후 8시 정각: 10만 명이 동시 접속
→ EC2 10대가 감당 가능한 수준: 약 1만 명 (각 1,000명)
→ 나머지 9만 명은?
```

**대기열 없으면:**
- 서버 과부하
- 타임아웃, 에러 폭발
- 누구는 되고 누구는 안 되는 불공정

**대기열 있으면:**
- 순서대로 공정하게 입장
- 서버 부하 제어
- 예상 대기 시간 제공

### 7.2 대기열 동작 방식

**1단계: 임계값 체크**
```javascript
// 현재 활성 사용자 수 확인
const activeUsers = await redis.sCard(`active-users:event-123`);

if (activeUsers >= 1000) {
  // 대기열 활성화
  return { status: 'queue', message: '대기열에 등록되었습니다' };
}
```

**2단계: 대기열 등록**
```javascript
// Sorted Set에 추가 (현재 시간을 점수로)
await redis.zAdd(`waiting-queue:event-123`, Date.now(), userId);

// 내 순번 확인
const position = await redis.zRank(`waiting-queue:event-123`, userId);

// 예상 대기 시간 계산 (초당 50명 처리)
const estimatedWaitMinutes = Math.ceil(position / 50 / 60);
```

**3단계: 백그라운드 처리**
```javascript
// 1초마다 실행되는 프로세서
setInterval(async () => {
  const activeUsers = await redis.sCard(`active-users:event-123`);
  const availableSlots = 1000 - activeUsers;

  if (availableSlots > 0) {
    // 대기열에서 앞에서부터 꺼내기
    const users = await redis.zRange(`waiting-queue:event-123`, 0, availableSlots - 1);

    for (const userId of users) {
      // 입장 허용 알림
      io.to(`user:${userId}`).emit('queue-enter', {
        message: '입장이 허용되었습니다!'
      });

      // 활성 사용자로 등록
      await redis.sAdd(`active-users:event-123`, userId);
      await redis.expire(`active-users:${userId}`, 300); // 5분 TTL
    }

    // 대기열에서 제거
    await redis.zRemRangeByRank(`waiting-queue:event-123`, 0, availableSlots - 1);
  }
}, 1000);
```

**4단계: 사용자 화면**
```
┌─────────────────────────────────────┐
│   🎫 대기열 입장                     │
├─────────────────────────────────────┤
│                                     │
│   현재 대기 순번: 8,245 / 20,000    │
│                                     │
│   ▓▓▓▓▓▓▓▓▓░░░░░░░░░ 41%           │
│                                     │
│   예상 대기 시간: 약 2분             │
│                                     │
│   ⚠️ 페이지를 닫지 마세요!           │
│      순번이 초기화됩니다.            │
└─────────────────────────────────────┘
```

### 7.3 새로고침해도 순번 유지

**문제:**
사용자가 실수로 새로고침하면 대기 순번을 잃어버리나요?

**해결:**
```javascript
// 프론트엔드: 페이지 로드 시
useEffect(() => {
  // 내가 대기열에 있는지 확인
  socket.emit('check-queue-status', { eventId });
}, []);

// 백엔드: 대기열 상태 확인
socket.on('check-queue-status', async ({ eventId }) => {
  const userId = socket.user.id;

  // Redis에서 내 순번 확인
  const position = await redis.zRank(`waiting-queue:${eventId}`, userId);

  if (position !== null) {
    // 대기 중이었음! 순번 복원
    socket.emit('queue-restored', {
      position: position + 1,
      total: await redis.zCard(`waiting-queue:${eventId}`)
    });
  }
});
```

**결과:** 새로고침해도 순번 그대로!

---

## 8. Auto Scaling - 대기열 크기 기반

이제 가장 중요한 **Auto Scaling** 시스템을 설명드리겠습니다.

### 8.1 일반 Auto Scaling의 한계

**전통적인 방식:**
- CPU 사용률 80% 초과 → 서버 추가
- 메모리 사용률 70% 초과 → 서버 추가

**문제점:**
```
오후 7시 50분: 티켓 오픈 10분 전, 대기열에 5만 명 대기 중
현재 CPU: 30% (아직 여유)
→ Auto Scaling 동작 안 함
→ 오후 8시 정각: 5만 명이 동시에 처리 요청
→ CPU 갑자기 100%로 폭발
→ 서버 추가 시작 (3~5분 소요)
→ 그 사이 서비스 다운!
```

**결론:** CPU 기반은 티켓팅에 부적합합니다. **사후 대응**이기 때문입니다.

### 8.2 우리의 해결책: 대기열 크기 기반

**아이디어:** 대기열에 사람이 많다 = 곧 부하가 올 것이다 = **미리** 서버를 늘리자!

**장점:**
- **사전 대응**: 부하 발생 전에 준비
- **비즈니스 로직 반영**: 대기열 = 실제 처리할 사용자 수
- **예측 가능**: 대기열 크기로 필요한 서버 수 계산 가능

### 8.3 시스템 구성

#### Lambda Queue Monitor

**역할:** Redis 대기열 크기를 모니터링하고 CloudWatch에 메트릭 전송

**코드 (Lambda 함수):**
```javascript
// lambda/queue-monitor.js
const Redis = require('ioredis');
const AWS = require('aws-sdk');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379
});

const cloudwatch = new AWS.CloudWatch();

exports.handler = async (event) => {
  // 모든 이벤트의 대기열 크기 조회
  const events = ['event-123', 'event-456', 'event-789'];

  for (const eventId of events) {
    const queueSize = await redis.zCard(`waiting-queue:${eventId}`);
    const activeUsers = await redis.sCard(`active-users:${eventId}`);

    // CloudWatch에 메트릭 전송
    await cloudwatch.putMetricData({
      Namespace: 'Tiketi/Queue',
      MetricData: [
        {
          MetricName: 'QueueSize',
          Value: queueSize,
          Unit: 'Count',
          Dimensions: [
            { Name: 'EventId', Value: eventId }
          ]
        },
        {
          MetricName: 'ActiveUsers',
          Value: activeUsers,
          Unit: 'Count',
          Dimensions: [
            { Name: 'EventId', Value: eventId }
          ]
        }
      ]
    }).promise();

    console.log(`[${eventId}] Queue: ${queueSize}, Active: ${activeUsers}`);
  }

  return { statusCode: 200, body: 'Metrics sent' };
};
```

**실행 주기:** EventBridge로 1분마다 실행
```
CloudWatch Events Rule:
  Schedule: rate(1 minute)
  Target: Lambda Queue Monitor
```

#### CloudWatch Alarms

**알람 설정:**

**1) Scale Out (서버 추가)**
```
Alarm Name: tiketi-scale-out
Metric: Tiketi/Queue/QueueSize
Threshold: > 5,000명
Period: 1분
Evaluation: 1 data point
Action: Auto Scaling Policy "add-2-instances"
```

**2) Scale Out Aggressive (대규모 증가)**
```
Alarm Name: tiketi-scale-out-aggressive
Metric: Tiketi/Queue/QueueSize
Threshold: > 20,000명
Period: 1분
Evaluation: 1 data point
Action: Auto Scaling Policy "add-5-instances"
```

**3) Scale In (서버 제거)**
```
Alarm Name: tiketi-scale-in
Metric: Tiketi/Queue/QueueSize
Threshold: < 1,000명
Period: 5분 (더 보수적)
Evaluation: 2 consecutive data points (안정적인지 확인)
Action: Auto Scaling Policy "remove-1-instance"
```

#### Auto Scaling Group

**설정:**
```
Auto Scaling Group: tiketi-backend-asg
Min Size: 2 (최소 2대는 항상 유지)
Max Size: 10 (최대 10대까지 확장)
Desired Capacity: 2 (평소 2대)

Launch Template:
  Instance Type: t3.medium (2 vCPU, 4GB RAM)
  AMI: ami-tiketi-backend (Node.js + Socket.IO 설치됨)
  User Data:
    #!/bin/bash
    cd /app
    pm2 start server.js
```

**Scaling Policies:**
```
Policy 1: add-2-instances
  - EC2 인스턴스 2대 추가
  - Cooldown: 180초 (3분간 추가 스케일 방지)

Policy 2: add-5-instances
  - EC2 인스턴스 5대 추가
  - Cooldown: 300초 (5분간 추가 스케일 방지)

Policy 3: remove-1-instance
  - EC2 인스턴스 1대 제거
  - Cooldown: 600초 (10분간 추가 축소 방지)
```

### 8.4 실제 동작 시나리오

**오후 7시 30분 (티켓 오픈 30분 전)**
```
현재 상황:
- EC2 인스턴스: 2대
- 대기열: 0명
- CloudWatch: 정상
```

**오후 7시 50분 (10분 전)**
```
사용자들이 몰려들기 시작:
- 대기열: 3,000명
- Lambda가 메트릭 전송: QueueSize = 3000
- CloudWatch: 아직 임계값(5,000) 미만
- 액션: 없음 (2대로 충분)
```

**오후 7시 55분 (5분 전)**
```
대기열 급증:
- 대기열: 8,000명
- Lambda 메트릭 전송: QueueSize = 8000
- CloudWatch 알람 발동! (> 5,000)
- Auto Scaling: EC2 +2대 추가 시작
- 3~5분 후 EC2-3, EC2-4 가용
```

**오후 7시 58분 (2분 전)**
```
계속 증가:
- 대기열: 25,000명
- Lambda 메트릭: QueueSize = 25000
- CloudWatch 알람 발동! (> 20,000, Aggressive)
- Auto Scaling: EC2 +5대 추가 시작
- 현재 운영 중: 4대 (EC2-1,2,3,4)
- 부팅 중: 5대 (EC2-5,6,7,8,9)
```

**오후 8시 00분 (티켓 오픈)**
```
피크 타임:
- 대기열: 20,000명 (일부 입장 시작)
- 운영 중: 9대 (EC2-1~9)
- 처리 능력: 9,000명 동시 처리
- 나머지는 대기열에서 순차 입장
- 서버 안정적 운영 ✅
```

**오후 8시 30분 (대부분 판매 완료)**
```
대기열 감소:
- 대기열: 800명
- Lambda 메트릭: QueueSize = 800
- CloudWatch 알람: Scale In 조건 충족 (< 1,000)
- 하지만 2번 연속 확인 필요 (false positive 방지)
- 5분 더 대기...
```

**오후 8시 35분**
```
안정화:
- 대기열: 500명
- 2번 연속 < 1,000명 확인
- Auto Scaling: EC2 -1대 제거 (EC2-9 종료)
- 현재: 8대 운영 중
```

**오후 9시 00분 (판매 종료)**
```
정상화:
- 대기열: 0명
- 10분마다 EC2 -1대씩 점진적 축소
- 최종: 2대로 복귀 (최소 유지 대수)
```

### 8.5 비용 효과

**Auto Scaling 없이 (24/7 피크 대비):**
```
EC2 10대 * 24시간 * 30일 = 7,200 인스턴스 시간
시간당 ₩100 * 7,200 = ₩720,000/월
```

**Auto Scaling 사용:**
```
평상시 (23시간): 2대 * 23시간 * 30일 = 1,380 인스턴스 시간
피크 (1시간): 10대 * 1시간 * 30일 = 300 인스턴스 시간
합계: 1,680 인스턴스 시간
₩100 * 1,680 = ₩168,000/월

절감액: ₩552,000/월 (77% 절감)
```

---

## 9. WebSocket 세션 복구 메커니즘

### 9.1 문제 상황

Auto Scaling으로 EC2가 제거될 때, 그 서버에 연결된 사용자들은 어떻게 되나요?

```
오후 9시 00분: EC2-9 제거 예정
EC2-9에 연결된 사용자: 1,000명
이 사용자들의 WebSocket 연결은?
```

### 9.2 Connection Draining

**ALB 설정:**
```
Connection Draining: 300초 (5분)
```

**동작:**
```
1. Auto Scaling이 EC2-9 제거 명령
2. ALB가 EC2-9를 "Draining" 상태로 전환
3. 새로운 연결은 EC2-9로 안 보냄 (다른 서버로)
4. 기존 연결은 5분간 유지
5. 5분 내에:
   - 대부분의 사용자가 자연스럽게 종료
   - 남은 연결은 강제 종료
6. EC2-9 완전 제거
```

### 9.3 클라이언트 자동 재연결

**프론트엔드 코드:**
```javascript
// frontend/src/hooks/useSocket.js
const socket = io('https://tiketi.gg', {
  auth: { token: authToken },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

socket.on('connect', () => {
  console.log('WebSocket 연결됨');

  // 세션 복구 요청
  socket.emit('restore-session', {
    eventId: currentEventId,
    previousSocketId: previousSocketId
  });
});

socket.on('session-restored', (data) => {
  console.log('세션 복구 완료:', data);
  // 대기열 순번, 선택한 좌석 등 복원
  setQueuePosition(data.queuePosition);
  setSelectedSeats(data.selectedSeats);
});

socket.on('disconnect', (reason) => {
  console.log('연결 끊김:', reason);
  if (reason === 'io server disconnect') {
    // 서버가 연결을 끊음 (EC2 제거 등)
    // 자동 재연결 시도
    socket.connect();
  }
});
```

**백엔드 세션 복구 로직:**
```javascript
// backend/src/config/socket.js
socket.on('restore-session', async ({ eventId, previousSocketId }) => {
  const userId = socket.user.id;

  // Redis에서 이전 세션 정보 조회
  const sessionData = await redis.get(`socket-session:${userId}`);

  if (sessionData) {
    const data = JSON.parse(sessionData);

    // 세션 복원
    socket.emit('session-restored', {
      queuePosition: data.queuePosition,
      selectedSeats: data.selectedSeats,
      reservationExpiry: data.reservationExpiry
    });

    // 새 소켓 ID로 세션 업데이트
    await redis.set(
      `socket-session:${userId}`,
      JSON.stringify({
        ...data,
        socketId: socket.id,
        lastConnected: Date.now()
      }),
      'EX', 3600 // 1시간 유효
    );
  }
});
```

### 9.4 사용자 경험

**연결 끊김 시:**
```
┌─────────────────────────────────────┐
│   ⚠️ 연결이 끊어졌습니다             │
│   자동으로 재연결 시도 중...         │
│   🔄 재연결 중 (3/5)                 │
└─────────────────────────────────────┘
```

**재연결 완료:**
```
┌─────────────────────────────────────┐
│   ✅ 연결 복구 완료!                 │
│   대기 순번: 245번 (유지됨)          │
│   선택한 좌석: A-12 (유지됨)         │
└─────────────────────────────────────┘
```

**결과:** 사용자는 거의 서비스 중단을 느끼지 못함!

---

## 10. 모니터링 및 알림

### 10.1 CloudWatch 대시보드

**모니터링 지표:**

**1) 비즈니스 메트릭**
- 대기열 크기 (QueueSize)
- 활성 사용자 수 (ActiveUsers)
- 시간당 티켓 판매 수
- 평균 대기 시간

**2) 인프라 메트릭**
- EC2 인스턴스 수
- EC2 CPU/메모리 사용률
- ALB 요청 수 / 응답 시간
- Redis 연결 수 / 메모리 사용률
- RDS 연결 수 / IOPS

**3) 애플리케이션 메트릭**
- WebSocket 연결 수
- API 응답 시간 (P50, P95, P99)
- 에러율
- 대기열 처리 속도 (명/초)

### 10.2 알람 설정

**Critical (즉시 대응 필요):**
```
1. RDS CPU > 80%
   → DBA에게 SMS + 전화

2. ElastiCache 메모리 > 90%
   → 개발팀에게 Slack + SMS

3. ALB 5xx 에러율 > 5%
   → 전체 팀에게 PagerDuty

4. 대기열 > 50,000명
   → 서비스 PM에게 Slack (추가 대응 논의)
```

**Warning (주의 필요):**
```
1. EC2 CPU > 70%
   → Slack 알림 (Auto Scaling 확인)

2. API 응답 시간 P95 > 500ms
   → Slack 알림 (성능 이슈 점검)

3. WebSocket 재연결률 > 10%
   → Slack 알림 (네트워크 이슈 점검)
```

### 10.3 실시간 대시보드 예시

```
┌─────────────────────────────────────────────────────────┐
│   Tiketi 실시간 대시보드 (2025-11-04 20:00)              │
├─────────────────────────────────────────────────────────┤
│   🎫 대기열 현황                                         │
│   총 대기: 18,245명                                      │
│   처리 속도: 52명/초                                     │
│   예상 소진: 약 6분                                      │
│                                                          │
│   🖥️ 인프라 현황                                         │
│   EC2: 8대 (Auto Scaling 활성)                          │
│   CPU: 평균 65% (정상)                                   │
│   메모리: 평균 58% (정상)                                │
│                                                          │
│   📊 비즈니스 현황                                       │
│   금일 판매: 12,450장                                    │
│   매출: ₩248,000,000                                    │
│   전환율: 68% (대기열 입장 → 구매)                       │
│                                                          │
│   ⚡ 성능 현황                                           │
│   API 응답: P95 = 120ms (우수)                           │
│   WebSocket: 8,234개 연결                                │
│   에러율: 0.02% (정상)                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 11. 비용 최적화

### 11.1 비용 구조

**평상시 (일 23시간):**
```
EC2 (t3.medium 2대):     ₩3,000/일
RDS (db.t4g.medium):     ₩2,500/일
ElastiCache (t4g.micro): ₩700/일
ALB:                     ₩1,000/일
CloudFront + S3:         ₩300/일
기타 (Lambda, 네트워크): ₩500/일
───────────────────────────────
합계:                    ₩8,000/일 (₩240,000/월)
```

**피크 타임 (일 1시간, 월 20회):**
```
EC2 추가 8대:            ₩400/시간
추가 데이터 전송:        ₩100/시간
───────────────────────────────
피크 추가 비용:          ₩500/시간
월 20회 * ₩500 =        ₩10,000/월
```

**총 예상 비용: ₩250,000/월 (~$190/월)**

### 11.2 비교: 24/7 피크 대비 운영

**만약 Auto Scaling 없이 항상 10대 운영:**
```
EC2 10대 24/7:          ₩15,000/일
RDS 더 큰 인스턴스:     ₩5,000/일
ElastiCache 더 큰 인스턴스: ₩2,000/일
───────────────────────────────
합계:                   ₩22,000/일 (₩660,000/월)

Auto Scaling 대비:      2.6배 비용
절감액:                 ₩410,000/월
```

### 11.3 추가 최적화 전략

**1) Reserved Instances (예약 인스턴스)**
```
최소 유지 EC2 2대를 1년 예약 구매
→ 40% 할인 (₩90,000/월 → ₩54,000/월)
절감: ₩36,000/월
```

**2) Spot Instances (스팟 인스턴스)**
```
피크 타임 추가 서버를 Spot으로
→ 70% 할인 (₩400/시간 → ₩120/시간)
단, 2분 내 회수 가능 (Auto Scaling으로 대응)
절감: ₩5,600/월
```

**3) CloudFront 캐싱 최적화**
```
정적 파일 TTL 7일로 설정
→ S3 요청 90% 감소
절감: ₩2,000/월
```

**최종 최적화 비용: ₩166,400/월 (₩83,600 절감, 33% 감소)**

---

## 12. 장애 대응 시나리오

### 12.1 시나리오 1: RDS Primary 장애

**발생:**
```
20:15:30 - RDS Primary (AZ-A) 하드웨어 장애
```

**자동 복구:**
```
20:15:35 - Aurora 자동 페일오버 시작
20:15:50 - Replica (AZ-B)가 Primary로 승격
20:15:55 - DNS 자동 업데이트 (엔드포인트 변경)
20:16:00 - EC2들이 새 Primary로 재연결
20:16:10 - 서비스 완전 복구
```

**영향:**
- 다운타임: 약 40초
- 데이터 손실: 0건
- 사용자: 일부 요청 타임아웃 (재시도로 성공)

### 12.2 시나리오 2: AZ-A 전체 장애

**발생:**
```
20:15:00 - AZ-A 데이터센터 네트워크 장애
```

**영향받는 리소스:**
- EC2 4대 (AZ-A)
- RDS Primary
- ElastiCache Primary
- NAT Gateway (AZ-A)

**자동 복구:**
```
20:15:05 - ALB가 AZ-A의 EC2들을 Unhealthy로 표시
20:15:10 - 모든 트래픽을 AZ-B의 EC2들로 라우팅
20:15:15 - RDS 자동 페일오버 (AZ-B로)
20:15:20 - ElastiCache 자동 페일오버 (AZ-B로)
20:15:30 - AZ-B의 NAT Gateway로 아웃바운드 트래픽 전환
20:15:40 - Auto Scaling이 AZ-B에 EC2 4대 추가 시작
20:20:00 - 새 EC2들 가용, 처리 능력 완전 복구
```

**영향:**
- 일시적 처리 능력 50% 감소 (4~5분)
- 대기열 대기 시간 일시적 증가
- 서비스 중단 없음!

### 12.3 시나리오 3: Redis 연결 장애

**발생:**
```
20:15:00 - ElastiCache 네트워크 문제로 연결 타임아웃
```

**영향:**
- WebSocket 메시지 동기화 실패
- 대기열 조회 실패
- 세션 조회 실패

**자동 복구 (코드 레벨):**
```javascript
// backend/src/config/redis.js
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay; // 최대 2초 간격으로 재시도
  },
  reconnectOnError: (err) => {
    const targetErrors = ['READONLY', 'ECONNREFUSED'];
    return targetErrors.some(e => err.message.includes(e));
  }
});

redis.on('error', (err) => {
  logger.error('Redis 에러:', err);
  // Fallback: PostgreSQL 세션 조회
});

// Fallback 로직
async function getSession(userId) {
  try {
    // 먼저 Redis 시도
    return await redis.get(`session:${userId}`);
  } catch (error) {
    // Redis 실패 시 DB에서 조회
    logger.warn('Redis 장애, DB Fallback 사용');
    return await db.query('SELECT * FROM sessions WHERE user_id = $1', [userId]);
  }
}
```

**영향:**
- 성능 저하 (Redis 속도 → DB 속도)
- 기능은 정상 작동
- 사용자는 "약간 느림" 정도로 인식

---

## 13. 정리 및 Q&A 준비

지금까지 저희 티켓팅 사이트의 AWS 아키텍처를 설명드렸습니다. 핵심을 정리하면:

### 13.1 네트워크 및 보안
- **VPC + Multi-AZ**: 고가용성, 하나의 AZ 장애에도 서비스 지속
- **3층 서브넷**: Public (ALB) → Private (EC2, Redis) → DB (RDS)
- **Security Group**: 층층이 쌓인 방화벽, 최소 권한 원칙

### 13.2 핵심 기능
- **프론트엔드**: S3 → CloudFront로 전세계 빠른 배포
- **백엔드**: ALB + 여러 EC2 인스턴스, Sticky Session으로 WebSocket 유지
- **실시간 동기화**: Redis Pub/Sub로 모든 EC2 간 메시지 동기화
- **대기열**: Redis Sorted Set으로 FIFO 보장, 새로고침해도 순번 유지
- **데이터 저장**: RDS Aurora Multi-AZ로 데이터 안정성

### 13.3 확장성 및 최적화
- **Auto Scaling**: 대기열 크기 기반, 사전 예방적 확장
- **Lambda**: 1분마다 대기열 모니터링 → CloudWatch 메트릭 전송
- **비용 최적화**: 필요할 때만 확장, 평소 최소 구성 (₩250,000/월)

### 13.4 안정성
- **Session 복구**: WebSocket 끊겨도 자동 재연결 + 상태 복원
- **고가용성**: 모든 컴포넌트 Multi-AZ, 자동 페일오버
- **모니터링**: CloudWatch로 실시간 감시, 문제 발생 즉시 알림

### 13.5 예상 성능
- **동시 접속**: 최대 10,000명 (EC2 10대 기준)
- **대기열 처리**: 초당 50명 입장
- **응답 속도**: API P95 < 200ms, WebSocket 실시간
- **가용성**: 99.9% (연간 다운타임 < 9시간)

이 아키텍처로 대규모 트래픽을 안정적으로 처리하면서도 비용은 최소화할 수 있습니다.

**질문 있으시면 말씀해주세요!**

---

## 부록: 예상 질문 답변

### Q1: "왜 ElastiCache가 아니라 DragonflyDB를 안 쓰나요?"

**A:** 프로덕션에서는 ElastiCache를 사용할 계획입니다.
ElastiCache는 AWS 관리형 서비스로, 자동 백업, 자동 페일오버, 패치 관리 등을 제공합니다.
DragonflyDB는 로컬 개발용으로만 사용 중입니다. (Redis 호환성 때문)

### Q2: "Lambda 대신 EC2에서 모니터링하면 안 되나요?"

**A:** 가능하지만 Lambda가 더 적합합니다:
- **비용**: Lambda는 실행 시간만 과금 (1분마다 1초 실행 = 거의 무료)
- **관리**: 서버리스, 인프라 관리 불필요
- **확장**: Auto Scaling 없이도 자동 확장
- **격리**: 모니터링 로직이 백엔드 장애에 영향받지 않음

### Q3: "WebSocket이 끊어지면 사용자가 다시 대기열 뒤로 가나요?"

**A:** 아닙니다! Redis에 세션 정보가 저장되어 있어서:
- WebSocket 끊김 감지
- 자동 재연결 시도 (3~5회)
- 재연결 시 `restore-session` 이벤트로 이전 상태 복원
- 대기열 순번, 선택한 좌석 모두 그대로

### Q4: "Redis가 다운되면 어떻게 되나요?"

**A:**
1. **Primary 장애**: Replica가 자동으로 Primary로 승격 (10~30초)
2. **전체 장애**: PostgreSQL Fallback
   - 세션은 DB에서 조회 (느리지만 작동)
   - 대기열은 일시 중단 (복구 시 재개)
   - WebSocket은 폴링으로 대체

### Q5: "Auto Scaling으로 EC2가 늘어나는데, 비용 폭탄 아닌가요?"

**A:**
- **Cooldown 설정**: 3~5분 간격으로만 확장 (무분별한 확장 방지)
- **Max Size 제한**: 최대 10대까지만 (절대 초과 안 함)
- **빠른 Scale In**: 대기열 해소되면 10분마다 1대씩 축소
- **실제 비용**: 월 ₩10,000 정도 추가 (피크 타임 20시간)
- 24/7 10대 운영보다 77% 저렴!

### Q6: "Multi-AZ가 정말 필요한가요? 비용 2배 아닌가요?"

**A:**
- **비용**: RDS/ElastiCache Multi-AZ는 1.5배 (2배 아님)
- **가용성**: 99.9% → 99.99% (다운타임 10배 감소)
- **티켓팅 특성**: 특정 시간에 집중 → 장애 시 매출 직접 타격
- **ROI**: 1시간 서비스 중단 = 월 ₩10,000,000 손실 vs Multi-AZ 추가 비용 ₩50,000/월

답은 명확히 "필요합니다"!

---

**발표 종료**

감사합니다!
