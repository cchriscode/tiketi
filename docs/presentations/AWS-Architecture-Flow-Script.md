# TIKETI AWS 아키텍처 흐름 설명 대본
> **다이어그램을 따라가며 자연스럽게 설명하는 발표 스크립트**

---

## 🎤 발표 시작

안녕하세요, 지금부터 저희 TIKETI 티켓팅 플랫폼의 AWS 아키텍처를 설명드리겠습니다.

다이어그램 위쪽부터 차근차근 따라가 보겠습니다.

---

## 📍 1. 사용자 진입 - 위쪽 영역

자, 먼저 사용자가 브라우저에 **tiketi.gg**를 입력했다고 가정해볼게요.

### Route 53 (DNS)

가장 먼저 만나는 건 **Route 53**입니다. 이건 AWS의 DNS 서비스인데요, 쉽게 말하면 전화번호부 같은 거예요.

사용자가 "tiketi.gg"라고 입력하면, Route 53이 "아, 그거면 CloudFront 주소인 d123abc.cloudfront.net으로 가세요"라고 알려주는 거죠.

### CloudFront (CDN)

Route 53이 알려준 대로 **CloudFront**로 이동합니다. CloudFront는 전세계에 퍼져있는 CDN인데요, 서울에 있는 사람은 서울 엣지에서, LA에 있는 사람은 LA 엣지에서 빠르게 응답을 받을 수 있어요.

### CloudFront의 두 갈래 길

여기서 CloudFront는 두 가지 경로로 나뉩니다.

**첫 번째 경로 - S3 (React 정적 파일):**

왼쪽을 보시면 **S3 Bucket**이 있죠? 여기엔 React로 만든 프론트엔드가 빌드되어서 저장되어 있어요. HTML, CSS, JavaScript 파일들이요.

CloudFront가 "이 파일들은 S3에서 가져올게"라고 해서 사용자한테 React 앱을 띄워줍니다. 이건 정적 파일이니까 빠르게 캐싱되어서 제공되죠.

**두 번째 경로 - API 요청:**

오른쪽으로 가면 API 요청 경로입니다. 사용자가 "티켓 목록 보여줘" 같은 동적 요청을 하면, CloudFront는 이걸 캐싱하지 않고 바로 아래쪽 VPC로 보내요.

---

## 📍 2. VPC 진입 - Internet Gateway

자, 이제 큰 파란색 박스가 보이시죠? 이게 **VPC**입니다. 우리만의 가상 네트워크 공간이에요.

CloudFront에서 온 API 요청은 **Internet Gateway**를 통해 VPC로 들어옵니다. Internet Gateway는 VPC와 인터넷을 연결하는 관문이에요.

---

## 📍 3. ALB (로드밸런서)

Internet Gateway를 지나면 바로 **ALB**, Application Load Balancer를 만나게 됩니다.

ALB는 이름 그대로 로드밸런서인데요, 들어온 요청을 여러 백엔드 서버에 골고루 나눠주는 역할을 해요.

"너한테 1,000명, 너한테 1,000명, 너한테도 1,000명" 이런 식으로요.

그리고 중요한 게, ALB는 **Sticky Session**이라는 기능을 쓰는데요, 이게 뭐냐면 한번 연결된 사용자는 계속 같은 서버로 보내주는 거예요. WebSocket 연결을 유지하기 위해서 필요하거든요.

---

## 📍 4. 가용 영역(AZ) 두 개로 분산

자, 이제 VPC 안을 보면 큰 주황색 박스가 두 개 보이시죠?

왼쪽이 **Availability Zone A**, 오른쪽이 **Availability Zone B**입니다.

이게 뭐냐면, 물리적으로 분리된 데이터센터예요. 서울의 다른 지역에 있다고 생각하시면 돼요.

왜 이렇게 나눴냐? 만약에 AZ-A에 정전이 나거나 문제가 생기면, AZ-B가 모든 걸 받아서 처리할 수 있거든요. 그래서 서비스가 멈추지 않아요.

---

## 📍 5. 서브넷 3층 구조

각 가용 영역 안을 보면 서브넷이 3층으로 나뉘어져 있어요.

### 1층 - Public Subnet (초록색)

제일 위에 초록색 박스가 **Public Subnet**이에요. 여기엔 **NAT Gateway**가 있어요.

NAT Gateway는 뭐냐면, 안쪽에 있는 서버들이 밖으로 나갈 때 쓰는 출구예요. 예를 들어 npm 패키지를 다운받거나 외부 API를 호출할 때 여기를 통해서 나가죠.

근데 밖에서 안으로는 못 들어와요. 단방향이에요.

### 2층 - Private Subnet (빨간색)

그 아래 빨간색 박스가 **Private Subnet**입니다. 여기가 핵심이에요.

**EC2 인스턴스들**이 여기 있어요. 다이어그램을 보면 AZ-A에 EC2가 3대, AZ-B에 EC2가 2대 있죠?

이 EC2들이 Node.js 백엔드 서버를 돌리고 있어요. Express API랑 Socket.IO WebSocket 서버가 여기서 실행되고 있고요.

중요한 건, 이 Private Subnet은 외부에서 직접 접근할 수 없어요. 무조건 ALB를 거쳐야만 들어올 수 있죠. 그래서 보안이 강화되는 거예요.

그리고 여기에 **ElastiCache Redis**도 있어요. AZ-A에 Primary, AZ-B에 Replica가 있죠.

Redis는 세 가지 일을 해요:
1. **Pub/Sub**: 여러 EC2 서버 간에 WebSocket 메시지를 동기화해요
2. **Queue**: 대기열 관리를 해요
3. **Cache**: 세션이랑 임시 데이터를 저장하죠

### 3층 - DB Subnet (보라색)

제일 아래 보라색 박스가 **DB Subnet**이에요. 최고 보안 영역이죠.

여기엔 **RDS Aurora PostgreSQL**이 있어요. AZ-A에 Primary, AZ-B에 Replica가 배치되어 있고요.

사용자 정보, 이벤트 정보, 예매 내역 같은 모든 영구 데이터가 여기 저장돼요.

---

## 📍 6. 데이터 흐름 - EC2에서 처리

자, 그럼 실제로 요청이 어떻게 처리되는지 볼까요?

ALB가 요청을 받으면 → EC2 중 하나로 보내요.

그 EC2는:
1. 먼저 **Redis**를 확인해요. "캐시에 있나?"
2. 없으면 **RDS Aurora**에 가서 데이터를 가져와요
3. 가져온 데이터를 처리해서 사용자한테 돌려줘요

---

## 📍 7. Redis Pub/Sub - 실시간 동기화의 핵심

자, 여기서 중요한 게 있어요. 다이어그램에서 Redis Primary와 Replica 사이에 점선이 보이시죠?

이게 바로 **복제(Replication)** 선이에요.

그리고 모든 EC2가 Redis로 연결되어 있는 선들이 보이시죠? 이게 **Pub/Sub** 연결이에요.

예를 들어볼게요. 사용자 A가 EC2-1에 연결되어서 티켓을 구매했어요.

그럼:
1. EC2-1이 Redis에 메시지를 발행(Publish)해요
2. Redis가 이걸 구독(Subscribe)하고 있는 모든 EC2에게 브로드캐스트해요
3. EC2-1, 2, 3, 4, 5 모두 이 메시지를 받아요
4. 각 EC2가 자기한테 연결된 사용자들에게 WebSocket으로 전달해요

결과적으로 모든 사용자가 실시간으로 "티켓이 팔렸어요"라는 알림을 받게 되는 거죠!

---

## 📍 8. Aurora 복제 - 데이터베이스 고가용성

RDS Aurora도 마찬가지예요. Primary와 Replica 사이에 점선이 보이시죠?

Primary에 데이터가 쓰이면 1초 이내로 Replica에 복제돼요.

만약 Primary에 장애가 나면? Replica가 자동으로 Primary로 승격돼요. 30초 정도 걸리고요.

사용자는 거의 느끼지 못할 정도로 빠르게 복구되는 거예요.

---

## 📍 9. 아래쪽 - Auto Scaling 시스템

자, 이제 다이어그램 아래쪽을 볼게요.

### Lambda Queue Monitor

왼쪽에 **Lambda** 함수가 있죠? 이건 1분마다 실행되는 작은 프로그램이에요.

이 Lambda가 하는 일은:
1. Redis에 접속해서 대기열 크기를 확인해요
2. "현재 8,000명이 대기 중이네?"
3. 이 정보를 CloudWatch로 보내요

### CloudWatch Alarms

중간에 **CloudWatch**가 있죠?

CloudWatch는 Lambda가 보낸 메트릭을 보고 판단해요:
- "대기열이 5,000명 넘었네? 알람 발동!"
- "대기열이 1,000명 밑이네? 축소 알람!"

### Auto Scaling Group

그럼 오른쪽에 **Auto Scaling Group**이 반응해요.

대기열이 많으면:
- "EC2 2대 더 추가해!"
- 3~5분 후에 새 EC2들이 떠서 ALB에 연결돼요

대기열이 적으면:
- "EC2 1대 줄여!"
- 천천히 서버를 제거해요

이렇게 자동으로 서버 개수가 조절되는 거죠. 평소엔 2대, 피크 타임엔 10대까지 늘어나요.

---

## 📍 10. S3 VPC Endpoint - 비용 절감의 비밀

다이어그램 중앙 아래쪽을 보면 **S3 VPC Endpoint**가 있어요.

이게 뭐냐면, EC2에서 S3로 직접 가는 지름길이에요.

원래는:
```
EC2 → NAT Gateway → Internet Gateway → S3
(비용: 엄청 비쌈)
```

근데 VPC Endpoint를 쓰면:
```
EC2 → S3 VPC Endpoint → S3
(비용: 무료!)
```

이렇게 바로 갈 수 있어요. 월 4만원 넘게 절약할 수 있죠.

---

## 📍 11. NAT Gateway - 대안 경로

다이어그램에서 점선으로 된 주황색 화살표들이 보이시죠?

이게 **NAT Gateway를 경유하는 대안 경로**예요.

만약 VPC Endpoint를 못 쓰는 서비스(예: 외부 API 호출)는 NAT Gateway를 통해서 밖으로 나가요.

각 AZ마다 NAT Gateway가 하나씩 있어서, 한쪽이 다운되어도 다른 쪽을 쓸 수 있어요.

---

## 📍 12. 전체 연결 흐름 정리

자, 그럼 전체 흐름을 한번 정리해볼게요.

### 프론트엔드 로딩:
```
사용자
  ↓
Route 53 (DNS 조회)
  ↓
CloudFront (CDN)
  ↓
S3 (React 앱)
  ↓
브라우저에 화면 표시
```

### API 요청:
```
브라우저
  ↓
CloudFront
  ↓
Internet Gateway
  ↓
ALB
  ↓
EC2 (Private Subnet)
  ├─→ Redis (캐시 확인)
  └─→ RDS Aurora (데이터 조회)
  ↓
응답 반환
```

### 실시간 동기화:
```
EC2-1에서 이벤트 발생
  ↓
Redis Pub/Sub
  ↓
모든 EC2로 브로드캐스트
  ↓
모든 사용자가 실시간으로 받음
```

### Auto Scaling:
```
Lambda (1분마다)
  ↓
Redis 대기열 크기 측정
  ↓
CloudWatch (메트릭 수집)
  ↓
Alarms (임계값 초과?)
  ↓
Auto Scaling (EC2 추가/제거)
```

---

## 📊 핵심 포인트 정리

자, 이 아키텍처의 핵심을 정리하면:

### 1️⃣ Multi-AZ 고가용성
- 모든 서비스가 두 개 가용 영역에 분산
- 한쪽이 다운되어도 서비스 계속됨
- 자동 페일오버로 30초 ~ 1분 내 복구

### 2️⃣ 3층 보안
- Public (ALB만) → Private (EC2, Redis) → DB (Aurora)
- 외부에서 DB로 직접 접근 불가능
- 층층이 쌓인 방화벽

### 3️⃣ 실시간 동기화
- Redis Pub/Sub로 모든 EC2 간 메시지 공유
- 어떤 EC2에 연결되어도 실시간 업데이트
- Socket.IO + Redis Adapter가 자동 처리

### 4️⃣ 스마트한 Auto Scaling
- CPU가 아닌 대기열 크기 기반
- 사전 예방적으로 서버 확장
- 비용 효율적 (필요할 때만 증가)

### 5️⃣ 비용 최적화
- S3 VPC Endpoint로 NAT 비용 절감
- Auto Scaling으로 평소엔 최소 구성
- 월 15만원대로 수만 명 처리 가능

---

## 💰 간단한 비용 정리

이 전체 아키텍처를 돌리는 데 드는 비용은:

```
평상시 (EC2 2대):
  - 컴퓨팅: ₩108,000
  - 데이터베이스: ₩100,000
  - 네트워크: ₩41,500
  - 기타: ₩9,500
  ─────────────────
  합계: ₩259,000/월

피크 타임 추가 (월 20시간):
  ₩9,000

총: ₩268,000/월 (약 $200)
```

최적화하면 ₩154,500까지 줄일 수 있어요.

---

## 🎯 마무리

자, 지금까지 다이어그램을 위에서부터 아래까지 따라가면서 설명드렸습니다.

정리하면:

1. **Route 53**으로 진입
2. **CloudFront**가 S3(정적)와 VPC(동적)로 분기
3. **Internet Gateway**로 VPC 진입
4. **ALB**가 트래픽 분산
5. 두 개 **AZ**에 모든 리소스 복제
6. **Public → Private → DB** 3층 구조
7. **EC2**들이 백엔드 처리
8. **Redis**로 실시간 동기화
9. **Aurora**로 데이터 저장
10. **Lambda → CloudWatch → Auto Scaling**으로 자동 확장
11. **VPC Endpoint**로 비용 절감

이 모든 게 유기적으로 연결되어서 안정적이고 확장 가능한 티켓팅 서비스를 만드는 거죠!

질문 있으시면 말씀해주세요!
