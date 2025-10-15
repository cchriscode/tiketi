# 🚀 빠른 시작 가이드

## 📋 사전 요구사항

- Docker & Docker Compose 설치
- Git

## 🏃‍♂️ 실행 방법

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd tiketi
```

### 2. Docker Compose로 모든 서비스 실행
```bash
docker-compose up -d
```

이 명령어는 다음을 자동으로 실행합니다:
- PostgreSQL 데이터베이스 (포트 5432)
- DragonflyDB (Redis) (포트 6379)
- 백엔드 API 서버 (포트 3001)
- 프론트엔드 앱 (포트 3000)

### 3. 서비스 확인

#### 프론트엔드
브라우저에서 http://localhost:3000 접속

#### 백엔드 API
http://localhost:3001/health 접속하여 `{"status":"OK"}` 확인

### 4. 로그 확인
```bash
# 모든 서비스 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 5. 서비스 중지
```bash
docker-compose down
```

## 👤 첫 사용자 만들기

### 옵션 1: 관리자 계정으로 로그인
데이터베이스 초기화 시 자동으로 생성된 관리자 계정:
- 이메일: `admin@tiketi.gg`
- 비밀번호: `admin123`

### 옵션 2: 새 사용자 회원가입
1. http://localhost:3000/register 접속
2. 이메일, 이름, 비밀번호 입력
3. 회원가입 완료

## 🎯 주요 기능 사용법

### 1. 이벤트 둘러보기
- 홈 페이지에서 이벤트 목록 확인
- 필터로 "예매 중", "오픈 예정" 등 선택
- 이벤트 카드 클릭하여 상세 페이지 이동

### 2. 티켓 예매
1. 이벤트 상세 페이지에서 티켓 종류 선택
2. 수량 조절 (+/- 버튼)
3. "예매하기" 클릭
4. 예매 완료!

### 3. 내 예매 확인
- 상단 메뉴에서 "내 예매" 클릭
- 예매 내역 조회 및 상세 정보 확인

### 4. 예매 취소
1. "내 예매" 페이지에서 예매 선택
2. 상세 페이지에서 "예매 취소" 클릭
3. 확인 후 취소 완료

## 🔧 관리자 기능

### 대시보드 접속
1. 관리자 계정으로 로그인
2. 상단 메뉴에서 "관리자" 클릭
3. 대시보드에서 통계 확인

### 이벤트 생성
1. "이벤트 관리" 클릭
2. "+ 새 이벤트" 버튼 클릭
3. 이벤트 정보 입력:
   - 이벤트명
   - 설명
   - 장소 및 주소
   - 공연일시
   - 판매 시작/종료일
4. "이벤트 생성" 클릭

### 티켓 타입 추가
현재는 데이터베이스 초기화 시 샘플 티켓이 자동 생성됩니다.
추후 UI에서 티켓 타입을 추가할 수 있습니다.

## 🔍 테스트 시나리오

### 동시성 테스트
여러 브라우저나 시크릿 창에서 동시에 같은 티켓을 예매해보세요.
DragonflyDB 분산 락이 중복 예매를 방지합니다.

### 재고 소진 테스트
1. 관리자로 재고가 적은 이벤트 생성
2. 일반 사용자로 모든 티켓 예매
3. "매진" 상태 확인

## 📊 샘플 데이터

초기 데이터베이스에는 다음이 포함됩니다:
- 관리자 계정 1개
- 샘플 이벤트 3개
- 각 이벤트별 티켓 타입 3-4개

## 🐛 문제 해결

### 포트 충돌
다른 애플리케이션이 3000, 3001, 5432, 6379 포트를 사용 중이면:
1. `docker-compose.yml` 파일에서 포트 변경
2. 프론트엔드의 `REACT_APP_API_URL` 환경변수도 함께 변경

### 데이터베이스 초기화 실패
```bash
docker-compose down -v
docker-compose up -d
```

### 컨테이너가 계속 재시작됨
```bash
docker-compose logs <service-name>
```
로그를 확인하여 오류 메시지 파악

## 💡 팁

### 데이터 초기화
```bash
docker-compose down -v
docker volume prune
docker-compose up -d
```

### 개발 모드에서 코드 수정
코드를 수정하면 자동으로 재시작됩니다:
- 백엔드: nodemon이 변경사항 감지
- 프론트엔드: React 개발 서버가 자동 리로드

### 프로덕션 빌드
```bash
# 프론트엔드
cd frontend
npm run build

# 백엔드는 NODE_ENV=production으로 실행
```

## 📚 다음 단계

- [README.md](./README.md) - 전체 프로젝트 문서
- [tiketi-architecture-analysis.md](./tiketi-architecture-analysis.md) - 아키텍처 상세 분석
- API 엔드포인트 테스트 (Postman, cURL 등)

## 🎉 즐거운 개발 되세요!

