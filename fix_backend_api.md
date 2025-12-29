# Backend API 문제 해결 가이드

## 문제 상황
- 이벤트 목록이 안뜸
- 예매 내역 불러오기 실패
- API 엔드포인트 응답: "Cannot GET /api/events"

## 원인
Backend pod에 dependencies가 제대로 설치되지 않았거나, routes가 로드되지 않음

## 해결 방법

### 1. Backend Pod 재배포

```bash
# 1. 현재 backend pod 삭제
kubectl delete pod -n tiketi -l app=backend

# 2. Pod 자동 재생성 대기 (약 30초)
kubectl get pods -n tiketi -w

# 3. Backend pod 로그 확인
kubectl logs -n tiketi -l app=backend --tail=50

# 정상 로그 예시:
# 🚀 Server running on port 3001
# 📡 Health check: http://localhost:3001/health
# 📊 Metrics: http://localhost:3001/metrics
# 📚 API Docs: http://localhost:3001/api-docs
```

### 2. Port Forward 재연결

기존 port-forward를 종료하고 다시 연결:

```bash
# 기존 port-forward 프로세스 찾기
ps aux | grep "port-forward.*backend"

# 프로세스 종료 (PID는 위에서 확인한 번호)
kill <PID>

# Backend port-forward 재시작
kubectl port-forward -n tiketi svc/backend-service 3001:3001 &
```

### 3. API 테스트

```bash
# Health check
curl http://localhost:3001/health

# Events API (중요!)
curl http://localhost:3001/api/events

# 정상 응답 예시:
# {"events":[...],"pagination":{...}}
```

### 4. 만약 여전히 안된다면

Backend 이미지를 다시 빌드하고 재배포:

```bash
# 1. Backend 이미지 빌드
cd backend
docker build -t tiketi-backend:latest .

# 2. Kind로 이미지 로드
kind load docker-image tiketi-backend:latest --name tiketi-cluster

# 3. Deployment 재시작
kubectl rollout restart deployment/backend -n tiketi

# 4. 상태 확인
kubectl get pods -n tiketi
kubectl logs -n tiketi -l app=backend -f
```

## 체크리스트

- [ ] kubectl 명령이 작동하는지 확인 (WSL 재시작 필요할 수 있음)
- [ ] Backend pod가 Running 상태인지 확인
- [ ] Backend pod 로그에 에러가 없는지 확인
- [ ] Port-forward가 정상적으로 연결되어 있는지 확인
- [ ] `curl http://localhost:3001/api/events` 테스트
- [ ] Frontend에서 이벤트 목록이 보이는지 확인

## WSL 문제 해결

만약 WSL 명령이 작동하지 않는다면:

```powershell
# PowerShell에서 WSL 재시작
wsl --shutdown
wsl

# WSL 터미널에서 kubectl 테스트
kubectl get nodes
```

## 예상 결과

모든 단계가 완료되면:
- ✅ Backend pod 정상 실행
- ✅ `/api/events` 엔드포인트 정상 응답
- ✅ Frontend에서 이벤트 목록 표시
- ✅ 예매 내역 정상 로드
