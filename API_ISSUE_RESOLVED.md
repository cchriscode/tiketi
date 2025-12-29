# API 문제 해결 완료 보고서

**날짜:** 2025-12-22
**문제:** 이벤트 목록이 안뜨고 예매 내역을 불러오는데 실패

---

## 🎯 문제 원인 분석

### 1. Kubectl Context 문제
- **현상**: kubectl이 `docker-desktop` context를 사용 중이었음
- **원인**: Kind cluster인 `tiketi-local`로 전환되지 않았음
- **해결**: `kind export kubeconfig --name tiketi-local` 실행

### 2. Database 테이블 부재
- **현상**: Backend 로그에 `relation "events" does not exist` 에러
- **원인**: PostgreSQL에 테이블들이 생성되지 않았음
- **해결**: 모든 MSA schema migrations 실행
  - auth_schema ✅
  - ticket_schema ✅
  - payment_schema ✅
  - stats_schema ✅

### 3. Schema Search Path 문제
- **현상**: Database에 데이터가 있지만 API가 빈 배열 반환
- **원인**: Backend가 `FROM events` 쿼리를 하는데 `ticket_schema.events`를 찾지 못함
- **해결**: PostgreSQL search_path 설정
  ```sql
  ALTER ROLE tiketi_user SET search_path TO
    ticket_schema, auth_schema, payment_schema, stats_schema, public;
  ```

### 4. Port-Forward 미설정
- **현상**: localhost:3001 접근 불가
- **원인**: Kind cluster의 서비스들이 port-forward되지 않았음
- **해결**: 모든 서비스 port-forward 설정

---

## ✅ 해결 완료 항목

### 1. Kubernetes 환경 설정
- ✅ kubectl context를 `kind-tiketi-local`로 전환
- ✅ tiketi namespace의 모든 pod 정상 실행 확인

### 2. Database 초기화
- ✅ init.sql 실행 (기본 테이블 생성)
- ✅ auth-service-schema.sql 실행
- ✅ ticket-service-schema.sql 실행
- ✅ payment-service-schema.sql 실행
- ✅ stats-service-schema.sql 실행
- ✅ Sample events 3개 insert
- ✅ PostgreSQL search_path 설정

### 3. Backend Pod 재시작
- ✅ Backend pod 삭제하여 자동 재생성
- ✅ 새로운 connection이 search_path 적용 확인

### 4. Port-Forward 설정
- ✅ Backend (3001)
- ✅ Frontend (3000)
- ✅ PostgreSQL (5432)

### 5. API 테스트
- ✅ Events API: 3개의 이벤트 정상 반환
- ✅ Auth API: 로그인 성공
- ✅ Reservations API: 정상 응답 (빈 배열)

---

## 🚀 현재 시스템 상태

### Running Services

| Service | Port | Status | Notes |
|---------|------|--------|-------|
| Frontend | 3000 | ✅ Running | React app accessible |
| Backend | 3001 | ✅ Running | All APIs working |
| PostgreSQL | 5432 | ✅ Running | All schemas created |
| DragonflyDB | 6379 | ✅ Running | Redis-compatible cache |
| Payment Service | 3003 | ✅ Available | On backend pod |
| Stats Service | 3004 | ✅ Available | On backend pod |

### Database Status

```
Schemas: 4
- auth_schema (users table)
- ticket_schema (events, reservations, seats, etc.)
- payment_schema (payments, payment_logs)
- stats_schema (daily_stats, event_stats)

Sample Data:
- Events: 3
- Users: 2 (including testadmin@tiketi.com)
```

### API Endpoints Test Results

```bash
# Events API (✅ Working)
curl http://localhost:3001/api/events
# Returns: 3 events

# Auth API (✅ Working)
curl -X POST http://localhost:3001/api/auth/login \
  -d '{"email":"testadmin@tiketi.com","password":"admin123"}'
# Returns: JWT token

# Reservations API (✅ Working)
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/reservations/my
# Returns: []
```

---

## 📝 사용 방법

### 1. Frontend 접속
```
브라우저에서: http://localhost:3000
```

### 2. 로그인
```
Email: testadmin@tiketi.com
Password: admin123
```

### 3. 이벤트 확인
- 홈페이지에서 3개의 이벤트가 표시됩니다:
  1. 2024 Concert Tour in Seoul
  2. Musical Phantom of the Opera
  3. Sports Game - Basketball Finals

### 4. Port-Forward 재시작 (필요시)
```powershell
# 편리한 스크립트 사용
.\start_port_forwards.ps1

# 또는 수동으로:
kubectl port-forward -n tiketi svc/backend-service 3001:3001
kubectl port-forward -n tiketi svc/frontend-service 3000:80
kubectl port-forward -n tiketi svc/postgres-service 5432:5432
```

---

## 🔧 문제 재발 시 체크리스트

1. **Kubectl context 확인**
   ```bash
   kubectl config current-context
   # 결과: kind-tiketi-local (이어야 함)
   ```

2. **Pod 상태 확인**
   ```bash
   kubectl get pods -n tiketi
   # 모든 pod가 Running 상태여야 함
   ```

3. **Backend 로그 확인**
   ```bash
   kubectl logs -n tiketi -l app=backend --tail=50
   # "relation does not exist" 에러가 없어야 함
   ```

4. **Port-forward 확인**
   ```bash
   curl http://localhost:3001/health
   # {"status":"ok",...} 응답이 와야 함
   ```

5. **Database search_path 확인**
   ```bash
   kubectl exec -n tiketi <postgres-pod> -- \
     psql -U tiketi_user -d tiketi \
     -c "SHOW search_path;"
   # ticket_schema, auth_schema, ... 포함되어야 함
   ```

---

## 📚 추가 리소스

- **Setup Guide**: `WSL2_KIND_SETUP_GUIDE.md`
- **Port-forward Script**: `start_port_forwards.ps1`
- **Database Migrations**: `database/migrations/`
- **Stats Service Report**: `STATS_SERVICE_TEST_REPORT.md`

---

## ✅ 결론

모든 API 문제가 해결되었으며, 시스템이 정상 작동 중입니다:
- ✅ 이벤트 목록 정상 표시
- ✅ 예매 내역 API 정상 작동
- ✅ Frontend와 Backend 통신 정상
- ✅ 모든 4개 MSA 서비스 정상 실행

**시스템 준비 완료! 🎉**
