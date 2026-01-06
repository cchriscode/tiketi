# 대기열 시스템 부하 테스트 가이드

대기열(Queue) 시스템을 실제 1000명 이상의 사용자 없이 테스트하는 방법입니다.

---

## 📋 목차

1. [테스트 준비](#테스트-준비)
2. [임계값 조정하기](#임계값-조정하기)
3. [부하 테스트 실행](#부하-테스트-실행)
4. [테스트 시나리오](#테스트-시나리오)
5. [문제 해결](#문제-해결)

---

## 테스트 준비

### 1. 시스템 실행

```bash
# 시스템이 실행되어 있는지 확인
kubectl get pods -n tiketi

# 모든 Pod가 Running 상태여야 함
# 특히 ticket-service, backend, dragonfly(Redis) 확인
```

### 2. 포트포워딩 시작

```bash
# 별도 터미널에서 실행
./scripts/port-forward-all.sh

# 또는 macOS
./scripts/port-forward-all.sh
```

### 3. 필요한 패키지 설치

```bash
# 부하 테스트 스크립트에 필요한 패키지
npm install axios socket.io-client
```

---

## 임계값 조정하기

실제 1000명을 모을 필요 없이, **임계값을 낮춰서 테스트**할 수 있습니다.

### 방법 1: ConfigMap 수정 (권장)

```bash
# ConfigMap 편집
kubectl edit configmap tiketi-config -n tiketi
```

다음 값을 수정:

```yaml
data:
  QUEUE_THRESHOLD: "10"  # 1000 → 10으로 변경 (10명 초과 시 대기열)
  QUEUE_PROCESSOR_INTERVAL: "5000"  # 처리 주기를 5초로 단축 (테스트용)
```

저장 후 Pod 재시작:

```bash
# Backend 재시작
kubectl rollout restart deployment/backend -n tiketi

# Ticket Service 재시작
kubectl rollout restart deployment/ticket-service -n tiketi

# 재시작 확인
kubectl get pods -n tiketi -w
```

### 방법 2: 환경변수로 오버라이드

특정 Pod에만 적용하려면:

```bash
# Ticket Service 환경변수 추가
kubectl set env deployment/ticket-service QUEUE_THRESHOLD=10 -n tiketi
```

---

## 부하 테스트 실행

### 기본 테스트 (50명)

```bash
node scripts/queue-load-test.js
```

### 임계값 초과 테스트 (15명, 임계값 10)

```bash
# ConfigMap에서 QUEUE_THRESHOLD=10으로 설정 후
node scripts/queue-load-test.js --users 15 --eventId 1
```

**예상 결과:**
- 처음 10명: 즉시 입장 허용
- 나머지 5명: 대기열에 진입
- 대기열 사용자는 주기적으로 입장 허용됨

### 대량 부하 테스트 (100명)

```bash
node scripts/queue-load-test.js --users 100 --eventId 1 --delay 50
```

### 옵션 설명

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--users` | 50 | 생성할 가상 사용자 수 |
| `--eventId` | 1 | 테스트할 이벤트 ID |
| `--apiUrl` | http://localhost:3001 | Backend API URL |
| `--delay` | 100 | 각 요청 간 지연 시간 (ms) |

---

## 테스트 시나리오

### 시나리오 1: 기본 대기열 동작 확인

**목적:** 임계값 초과 시 대기열 진입 확인

```bash
# 1. 임계값을 10으로 설정
kubectl set env deployment/ticket-service QUEUE_THRESHOLD=10 -n tiketi
kubectl set env deployment/backend QUEUE_THRESHOLD=10 -n tiketi

# 2. Pod 재시작 대기
kubectl rollout status deployment/ticket-service -n tiketi
kubectl rollout status deployment/backend -n tiketi

# 3. 15명 동시 접속
node scripts/queue-load-test.js --users 15 --eventId 1
```

**확인사항:**
- ✅ 처음 10명은 즉시 입장
- ✅ 나머지 5명은 대기열 진입
- ✅ 로그에 대기열 순번 표시

---

### 시나리오 2: 대기열 처리 속도 확인

**목적:** 대기열에서 사용자가 주기적으로 입장하는지 확인

```bash
# 1. 처리 주기를 5초로 단축
kubectl set env deployment/ticket-service QUEUE_PROCESSOR_INTERVAL=5000 -n tiketi

# 2. 임계값 5명, 총 20명 접속
kubectl set env deployment/ticket-service QUEUE_THRESHOLD=5 -n tiketi
kubectl set env deployment/backend QUEUE_THRESHOLD=5 -n tiketi

# 3. Pod 재시작
kubectl rollout restart deployment/ticket-service -n tiketi
kubectl rollout restart deployment/backend -n tiketi

# 4. 테스트 실행
node scripts/queue-load-test.js --users 20 --eventId 1
```

**확인사항:**
- ✅ 5명씩 입장 허용
- ✅ 5초마다 대기열 처리
- ✅ 모든 사용자가 최종적으로 입장

---

### 시나리오 3: 대규모 동시 접속

**목적:** 많은 사용자 동시 접속 시 안정성 확인

```bash
# 1. 임계값 20명
kubectl set env deployment/ticket-service QUEUE_THRESHOLD=20 -n tiketi
kubectl set env deployment/backend QUEUE_THRESHOLD=20 -n tiketi

# 2. 100명 동시 접속
node scripts/queue-load-test.js --users 100 --eventId 1 --delay 50
```

**확인사항:**
- ✅ 20명 즉시 입장
- ✅ 80명 대기열 진입
- ✅ Redis/Socket.IO 안정성
- ✅ 메모리/CPU 사용량

---

### 시나리오 4: 재연결 시 상태 복구 확인

**목적:** 새로고침/재연결 시 대기열 순번 유지 확인

```bash
# 1. 브라우저에서 수동 테스트
# http://localhost:3000 접속

# 2. 이벤트 페이지 접속 (예: Event ID 1)

# 3. 개발자 도구 → 콘솔에서 확인
# - 대기열 진입 메시지
# - 순번 표시

# 4. 브라우저 새로고침 (F5)

# 5. 순번이 유지되는지 확인
```

**확인사항:**
- ✅ 새로고침 후 대기열 순번 유지
- ✅ Socket 재연결 성공
- ✅ Redis 세션 데이터 복구

---

## 실시간 모니터링

### 1. 로그 확인

```bash
# Ticket Service 로그 (대기열 처리)
kubectl logs -f deployment/ticket-service -n tiketi

# Backend 로그 (WebSocket 연결)
kubectl logs -f deployment/backend -n tiketi
```

### 2. Redis 데이터 확인

```bash
# Redis CLI 접속
kubectl exec -it deployment/dragonfly -n tiketi -- redis-cli

# 대기열 키 확인
KEYS queue:*

# 특정 대기열 크기 확인
ZCARD queue:1

# 활성 사용자 확인
SCARD active:1

# 대기열 내용 확인
ZRANGE queue:1 0 -1 WITHSCORES
```

### 3. Pod 리소스 확인

```bash
# CPU/메모리 사용량
kubectl top pods -n tiketi

# 특정 Pod 상세
kubectl describe pod <pod-name> -n tiketi
```

---

## 문제 해결

### 문제 1: 모든 사용자가 즉시 입장됨

**원인:** 임계값이 너무 높음

**해결:**
```bash
# 임계값 확인
kubectl get configmap tiketi-config -n tiketi -o yaml | grep QUEUE_THRESHOLD

# 낮은 값으로 설정
kubectl set env deployment/ticket-service QUEUE_THRESHOLD=5 -n tiketi
kubectl set env deployment/backend QUEUE_THRESHOLD=5 -n tiketi
```

---

### 문제 2: 대기열 처리가 안됨

**원인:** Queue Processor가 실행되지 않음

**확인:**
```bash
# Ticket Service 로그 확인
kubectl logs deployment/ticket-service -n tiketi | grep "Queue processor"

# 예상 로그:
# "🚀 Queue processor started (interval: 10000ms)"
# "🔄 Processing 1 queue(s)..."
```

**해결:**
```bash
# Ticket Service 재시작
kubectl rollout restart deployment/ticket-service -n tiketi
```

---

### 문제 3: Socket 연결 실패

**원인:** CORS 설정 또는 포트포워딩 문제

**확인:**
```bash
# Backend 로그에서 Socket 연결 확인
kubectl logs deployment/backend -n tiketi | grep "Socket"

# 포트포워딩 확인
ps aux | grep "port-forward"
```

**해결:**
```bash
# 포트포워딩 재시작
pkill -f "port-forward"
./scripts/port-forward-all.sh
```

---

### 문제 4: Redis 연결 오류

**원인:** Dragonfly(Redis) Pod 문제

**확인:**
```bash
# Dragonfly Pod 상태
kubectl get pod -n tiketi -l app=dragonfly

# Dragonfly 로그
kubectl logs deployment/dragonfly -n tiketi
```

**해결:**
```bash
# Dragonfly 재시작
kubectl rollout restart deployment/dragonfly -n tiketi

# 연결 테스트
kubectl exec -it deployment/dragonfly -n tiketi -- redis-cli PING
# 응답: PONG
```

---

## 테스트 후 정리

### 1. 임계값 원래대로 복구

```bash
# ConfigMap 수정
kubectl edit configmap tiketi-config -n tiketi
```

```yaml
data:
  QUEUE_THRESHOLD: "1000"  # 원래 값으로 복구
  QUEUE_PROCESSOR_INTERVAL: "10000"
```

### 2. Pod 재시작

```bash
kubectl rollout restart deployment/ticket-service -n tiketi
kubectl rollout restart deployment/backend -n tiketi
```

### 3. 테스트 데이터 정리 (선택)

```bash
# Redis 데이터 정리
kubectl exec -it deployment/dragonfly -n tiketi -- redis-cli FLUSHDB

# 또는 특정 키만 삭제
kubectl exec -it deployment/dragonfly -n tiketi -- redis-cli DEL queue:1 active:1
```

---

## 고급 테스트

### k6를 사용한 부하 테스트

더 강력한 부하 테스트가 필요하면 k6 사용:

```bash
# k6 설치 (macOS)
brew install k6

# 또는 Windows
choco install k6
```

**k6 스크립트 예시** (`scripts/queue-load-test.k6.js`):

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import ws from 'k6/ws';

export let options = {
  vus: 50, // 가상 사용자 50명
  duration: '30s', // 30초 동안 실행
};

export default function () {
  // 1. 로그인
  const loginRes = http.post('http://localhost:3001/api/auth/login', {
    email: `loadtest${__VU}@test.com`,
    password: 'Test1234!',
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });

  const token = loginRes.json('token');

  // 2. WebSocket 연결
  const url = 'ws://localhost:3001';
  ws.connect(url, { auth: { token } }, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ event: 'join-queue', data: { eventId: 1 } }));
    });

    socket.on('queue-entry-allowed', () => {
      console.log('Allowed to enter!');
      socket.close();
    });
  });

  sleep(1);
}
```

**실행:**
```bash
k6 run scripts/queue-load-test.k6.js
```

---

## 참고 문서

- [WebSocket 구조](./TIKETI_PROJECT_ANALYSIS_PART2.md)
- [MSA 아키텍처](./MSA_SYSTEM_SPEC.md)
- [Redis 설정](../k8s/08-dragonfly.yaml)

---

**Happy Testing! 🎫**
