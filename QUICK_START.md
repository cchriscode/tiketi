# TIKETI Quick Start Guide ??

> 처음부???�까지 TIKETI ?�스?�을 로컬?�서 ?�행?�는 ?�벽 가?�드

## ?�� 목차

1. [빠른 ?�작 (?�동 ?�치)](#빠른-?�작-?�동-?�치) ??**권장**
2. [?�전 ?�구?�항](#?�전-?�구?�항)
3. [?�동 ?�치 (?�세)](#?�동-?�치-?�세)
4. [?�속 �??�스??(#?�속-�??�스??
5. [문제 ?�결](#문제-?�결)

---

## ?�️ ?�작?�기 ?�에

**?�수 ?�인?�항:**
1. ??Docker Desktop ?�행 �?
2. ??WSL2 ?��????�기
3. ???�로?�트 ?�렉?�리�??�동: `cd /mnt/c/Users/USER/project-ticketing`

**?�체 ?�리 ???�시?�하?�면:**
```bash
# Windows (PowerShell)
.\cleanup.ps1

# ?�는 WSL
./scripts/cleanup.sh
```

---

## 빠른 ?�작 (?�동 ?�치)

### ?�스???�치 ?��

**Windows (PowerShell):**
```powershell
# ?�로?�트 루트?�서 ?�행
.\setup-tiketi.ps1
```

**Linux/WSL:**
```bash
# ?�로?�트 루트?�서 ?�행
./scripts/setup-tiketi.sh
```

???�크립트???�음???�동?�로 ?�행?�니??
1. ??Kind ?�러?�터 ?�성
2. ??PostgreSQL 배포 �??�키�??�정
3. ??모든 Docker ?��?지 빌드
4. ??모든 ?�비??배포
5. ??준�??�료 ?�인

**?�요 ?�간**: ??5-10�?

?�료 ???�트?�워?�만 ?�행?�면 ?�니??

## 방법 1: WSL?�서 ?��? ?�료 (추천!)

**WSL ?��??�에??**
```bash
./scripts/port-forward-all.sh
```

**?�속 URL ?�인:**
```bash
./scripts/show-access-url.sh
```

**Windows ?�롬?�서 ?�속:**
```
http://<WSL-IP>:3000
(?�크립트가 ?�시??IP ?�용, ?? http://172.17.40.29:3000)
```

??**??방법??가??간단?�니??**

---

## 방법 2: PowerShell ?�용 (localhost ?�속)

**PowerShell?�서 (Windows ?�이?�브):**

### 1?�계: Windows kubectl ?�정 (최초 1?�만)
```powershell
.\setup-windows-kubectl.ps1
```

**???�크립트가 ?�는 ??**
- Windows??kubectl ?�치 (?�을 경우)
- WSL??kubeconfig�?Windows�?복사
- Kind ?�러?�터 ?�결 ?�정

### 2?�계: ?�트?�워???�작
```powershell
.\start_port_forwards.ps1
```

**???�크립트가 ?�는 ??**
- ?�용 중인 ?�트 ?�동 ?�리
- 7�??�비???�트?�워???�작 (백그?�운??PowerShell �?
- Health Check ?�동 ?�행
- ?�속 URL ?�시

**Windows ?�롬?�서 ?�속:**
```
http://localhost:3000
```

**?�점**: Google OAuth ?�스????`http://localhost:3000` ?�용 가??(OAuth 리디?�션 ?�정�??�치)

---

**문제 발생 ??** `FULL_WSL_GUIDE.md` ?�는 `WSL_PORT_FORWARD_ISSUE.md` 참고

---

**?��? ?�리?�는 ?�크립트:**
- Windows (PowerShell): `.\cleanup.ps1`
- Linux/WSL: `./scripts/cleanup.sh`


### ?�계�??�행 (?�택?�항)

?�동???�크립트�??�계별로 ?�행?�려�?

```bash
# 1?�계: ?�러?�터 ?�정
./scripts/1-setup-cluster.sh

# 2?�계: Database ?�정
./scripts/2-setup-database.sh

# 3?�계: 빌드 & 배포
./scripts/3-build-and-deploy.sh
```

---

## ?�전 ?�구?�항

### ?�수 ?�프?�웨??
- **WSL2** (Windows Subsystem for Linux 2)
- **Docker Desktop** (WSL2 백엔???�용)
- **Node.js** v18 ?�상
- **Git**

### ?�치 ?�인
```bash
# WSL2?�서 ?�행
wsl --version
docker --version
kubectl version --client
kind version
node --version
```

---

## ?�동 ?�치 (?�세)

> ?�� **권장**: ?�의 [빠른 ?�작](#빠른-?�작-?�동-?�치) ?�동???�크립트�??�용?�세??
>
> ?�래??�??�계�??�동?�로 ?�행?�려??경우�??�한 ?�세 가?�드?�니??

### 1. Kind ?�러?�터 ?�성

```bash
cd /mnt/c/Users/USER/project-ticketing

# Kind ?�러?�터 ?�성 (3-node cluster)
kind create cluster --name tiketi-local --config k8s/kind-config.yaml

# ?�러?�터 ?�인
kubectl cluster-info --context kind-tiketi-local
kubectl get nodes
```

### 2. Kubernetes Namespace ?�성

```bash
# Dev environment (namespace + config + secrets + postgres/dragonfly + services)
kubectl apply -k k8s/overlays/dev

```

### 3. Toss Payments API ???�정 (?�택?�항)

?�제 결제 기능???�용?�려�?[Toss Payments 개발???�터](https://developers.tosspayments.com/)?�서 API ?��? 발급받아 ?�정:

```bash
# k8s/overlays/dev/secrets.env ���� ����
nano k8s/overlays/dev/secrets.env

# ?�음 값을 ?�제 API ?�로 교체:
# TOSS_CLIENT_KEY: "?�제_?�라?�언????
# TOSS_SECRET_KEY: "?�제_?�크�???

# Secret ?�적??
kubectl apply -k k8s/overlays/dev
```

---

## Database ?�정

### 1. PostgreSQL 배포

```bash
# PVC �?PostgreSQL 배포 (Kustomize�?통합 배포?�므�??�미 ?�성?�었?�면 SKIP)
kubectl apply -k k8s/overlays/dev

# Pod ?�행 ?��?(??30�?
kubectl wait --for=condition=ready pod -l app=postgres -n tiketi --timeout=120s

# ?�태 ?�인
kubectl get pods -n tiketi
```

### 2. Database 초기??�??�키�??�성

**중요**: 반드???�래 ?�서?��??�행?�세??

#### Step 1: 기본 ?�키�?�??�플 ?�이???�성

```bash
# public ?�키마에 기본 ?�이블과 ?�플 ?�이???�성 (?�벤?? 좌석 ?�이?�웃 ??
cat database/init.sql | \
  kubectl exec -i -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi
```

#### Step 2: MSA ?�키�?마이그레?�션

```bash
# Auth Service ?�키�?(users ?�이�??�동)
cat database/migrations/auth-service-schema.sql | \
  kubectl exec -i -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi

# Ticket Service ?�키�?(events, seats, reservations ???�동)
cat database/migrations/ticket-service-schema.sql | \
  kubectl exec -i -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi

# Stats Service ?�키�?(?�계 ?�이�??�성)
cat database/migrations/stats-service-schema.sql | \
  kubectl exec -i -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi

# Payment Service ?�키�?(결제 ?�이�??�성)
cat database/migrations/payment-service-schema.sql | \
  kubectl exec -i -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi
```

#### Step 3: Search Path ?�정

```bash
# MSA ?�키마�? ?�선?�도�?search_path ?�정
cat database/set_search_path.sql | \
  kubectl exec -i -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi
```

**결과 ?�인:**
```bash
# ?�벤???�이???�인 (25�??�상???�플 ?�벤?��? ?�어????
kubectl exec -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U tiketi_user -d tiketi -c "SELECT COUNT(*) FROM events"
```

---

## ?�비??빌드 & 배포

### 1. Monorepo ?�키지 ?�치

```bash
# 공통 ?�키지 ?�치
cd packages/common && npm install && cd ../..
cd packages/database && npm install && cd ../..
cd packages/metrics && npm install && cd ../..
```

### 2. Docker ?��?지 빌드

```bash
# Auth Service
docker build -t tiketi-auth-service:local -f services/auth-service/Dockerfile .
kind load docker-image tiketi-auth-service:local --name tiketi-local

# Ticket Service
docker build -t tiketi-ticket-service:local -f services/ticket-service/Dockerfile .
kind load docker-image tiketi-ticket-service:local --name tiketi-local

# Stats Service
docker build -t tiketi-stats-service:local -f services/stats-service/Dockerfile .
kind load docker-image tiketi-stats-service:local --name tiketi-local

# Payment Service
docker build -t tiketi-payment-service:local -f services/payment-service/Dockerfile .
kind load docker-image tiketi-payment-service:local --name tiketi-local

# Backend (Legacy - Admin API ??
docker build -t tiketi-backend:local -f backend/Dockerfile backend
kind load docker-image tiketi-backend:local --name tiketi-local
```

**?�� Tip**: 모든 ?��?지�???번에 빌드?�려�?
```bash
chmod +x scripts/build-all-images.sh
./scripts/build-all-images.sh
```

### 3. ?�프???�비??배포

```bash
# Monitoring stack (optional)
kubectl apply -f k8s/08-loki.yaml
kubectl apply -f k8s/09-promtail.yaml
kubectl apply -f k8s/10-grafana.yaml
```

### 4. ?�플리�??�션 ?�비??배포

```bash
# Backend & MSA ?�비??배포
kubectl apply -k k8s/overlays/dev

# 배포 ?�태 ?�인 (모든 Pod가 Running ???�까지 ?��?
kubectl get pods -n tiketi -w
```

**?�상 Pod 목록:**
```
NAME                               READY   STATUS    RESTARTS   AGE
postgres-xxxxx                     1/1     Running   0          5m
dragonfly-xxxxx                    1/1     Running   0          3m
grafana-xxxxx                      1/1     Running   0          3m
loki-xxxxx                         1/1     Running   0          3m
promtail-xxxxx                     1/1     Running   0          3m
backend-xxxxx                      1/1     Running   0          2m
auth-service-xxxxx                 1/1     Running   0          2m
ticket-service-xxxxx               1/1     Running   0          2m
stats-service-xxxxx                1/1     Running   0          2m
payment-service-xxxxx              1/1     Running   0          2m
```

---

## Frontend 배포

### 1. Frontend ?��?지 빌드

```bash
# Frontend 빌드 �?Nginx ?��?지 ?�성
docker build -t tiketi-frontend:local -f frontend/Dockerfile frontend
kind load docker-image tiketi-frontend:local --name tiketi-local
```

### 2. Frontend 배포

```bash
# Frontend Deployment & Service
kubectl apply -f k8s/07-frontend.yaml

# 배포 ?�인
kubectl get pods -n tiketi | grep frontend
```

---

## ?�속 �??�스??

### 1. Port-Forward ?�정

**Option A: ?�동 ?�크립트 ?�용 (Windows)**
```powershell
# PowerShell?�서 ?�행
.\start_port_forwards.ps1
```

**Option B: ?�동 ?�크립트 ?�용 (WSL/Linux)**
```bash
chmod +x scripts/port-forward-all.sh
./scripts/port-forward-all.sh
```

**Option C: ?�동 ?�정**
```bash
# 각각 별도???��??�에???�행
kubectl port-forward -n tiketi svc/postgres-service 5432:5432 &
kubectl port-forward -n tiketi svc/backend-service 3001:3001 &
kubectl port-forward -n tiketi svc/auth-service 3005:3005 &
kubectl port-forward -n tiketi svc/ticket-service 3002:3002 &
kubectl port-forward -n tiketi svc/payment-service 3003:3003 &
kubectl port-forward -n tiketi svc/stats-service 3004:3004 &
kubectl port-forward -n tiketi svc/frontend-service 3000:3000 &
```

**참고**: Auth Service??NodePort 30001???�용?�니??(30006??Grafana가 ?�용 �?

### 2. ?�속 URL

| ?�비??| URL | ?�명 |
|--------|-----|------|
| **Frontend** | http://localhost:3000 | 메인 ?�용???�사?�트 |
| **Backend API** | http://localhost:3001 | Legacy API (Admin ?? |
| **Auth Service** | http://localhost:3005 | ?�증 ?�비??(MSA) |
| **Ticket Service** | http://localhost:3002 | ?�켓 ?�매 ?�비??(좌석, Socket.IO) |
| **Payment Service** | http://localhost:3003 | 결제 ?�비??(TossPayments) |
| **Stats Service** | http://localhost:3004 | ?�계 ?�비??(Read-only) |
| **Grafana** | http://localhost:30006 | 모니?�링 ?�?�보??(NodePort) |

**참고**: Port-forward ?�이 NodePort�?직접 ?�속 가??
- Backend: http://localhost:30000
- Frontend: http://localhost:30005
- Grafana: http://localhost:30006
- Payment: http://localhost:30003
- Ticket: http://localhost:30004
- Stats: http://localhost:30002
- Auth: http://localhost:30001
- PostgreSQL: localhost:30432

### 3. 기본 ?�스??

#### A. ?�원가??& 로그??
1. http://localhost:3000 ?�속
2. ?�원가??(?�측 ?�단)
3. 로그??

#### B. ?�켓 ?�매 ?�로??
1. 메인 ?�이지?�서 ?�벤???�택
2. 좌석 ?�택
3. 결제 ?�단 ?�택
   - **Toss Payments** (?�제 API ???�정 ???�동)
   - Naver Pay (Mock)
   - Kakao Pay (Mock)
   - 계좌?�체 (Mock)
4. ?�매 ?�료 ?�인

#### C. 관리자 기능
1. http://localhost:3000/admin ?�속
2. Admin 로그??
   - Email: `admin@tiketi.gg`
   - Password: `admin123`
3. Dashboard ?�인
4. ?�계 ?�이지 ?�인 (좌측 메뉴 "Statistics")

#### D. API Health Check
```bash
# 모든 ?�비??Health ?�인
curl http://localhost:3001/health  # Backend
curl http://localhost:3005/health  # Auth Service
curl http://localhost:3002/health  # Ticket
curl http://localhost:3003/health  # Payment
curl http://localhost:3004/health  # Stats
```

---

## 문제 ?�결

### Pod가 CrashLoopBackOff ?�태????

```bash
# 로그 ?�인
kubectl logs -n tiketi <pod-name>

# ?�전 컨테?�너 로그 ?�인
kubectl logs -n tiketi <pod-name> --previous

# Pod ?�세 ?�보
kubectl describe pod -n tiketi <pod-name>
```

### Database ?�결 ?�패

```bash
# PostgreSQL Pod 로그 ?�인
kubectl logs -n tiketi -l app=postgres

# PostgreSQL 직접 ?�속 ?�스??
kubectl exec -it -n tiketi $(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- psql -U tiketi_user -d tiketi

# ?�키�??�인
\dn
# ?�이�??�인
SET search_path TO auth_schema, ticket_schema, stats_schema, payment_schema, public;
\dt
```

### ?��?지 Pull ?�패

```bash
# ?��?지가 Kind ?�러?�터??로드?�었?��? ?�인
docker exec -it tiketi-local-control-plane crictl images | grep tiketi

# ?�시 로드
kind load docker-image tiketi-auth-service:local --name tiketi-local
# ... (?�른 ?��?지?�도)
```

### Port-Forward ?��?

```bash
# ?�로?�스 ?�인
ps aux | grep "port-forward"

# 모두 종료 ???�시??
pkill -f "port-forward"
./scripts/port-forward-all.sh
```

### Frontend가 백엔??API ?�출 ?�패

```bash
# Frontend 로그 ?�인
kubectl logs -n tiketi -l app=frontend

# Frontend Pod?�서 백엔???�속 ?�스??
kubectl exec -it -n tiketi $(kubectl get pod -n tiketi -l app=frontend -o jsonpath='{.items[0].metadata.name}') -- wget -O- http://auth-service:3005/health
```

### ?�체 ?�시??

```bash
# 모든 Deployment ?�시??
kubectl rollout restart deployment -n tiketi

# ?�정 ?�비?�만 ?�시??
kubectl rollout restart deployment/auth-service -n tiketi
```

---

## ?�체 초기??& ?�시??

?�스?�을 ?�전??초기?�하�??�시 ?�작?�려�?

### 방법 1: Cleanup ?�크립트 ?�용 (추천)

**Windows:**
```powershell
.\cleanup.ps1
```

**Linux/WSL:**
```bash
./scripts/cleanup.sh
```

???�크립트???�음???�리?�니??
- ???�행 중인 port-forward ?�로?�스
- ??Kind cluster ??��
- ??Docker images ??�� (?�택?�항)
- ??node_modules ?�더 ??�� (?�택?�항)

### 방법 2: ?�동 ?�리

```bash
# 1. ?�트 ?�워??중�?
pkill -f "kubectl port-forward"

# 2. Kind ?�러?�터 ??��
kind delete cluster --name tiketi-local

# 3. 처음부???�시 ?�작
# ??가?�드??"초기 ?�정" ?�계부???�시 진행
```

---

## 개발 모드

개발 중에??로컬?�서 직접 ?�행?�는 것이 ???�리?????�습?�다:

```bash
# Backend (Legacy)
cd backend
npm install
npm run dev  # Port 3001

# Auth Service
cd services/auth-service
npm install
npm run dev  # Port 3005

# Ticket Service
cd services/ticket-service
npm install
npm run dev  # Port 3002

# Payment Service
cd services/payment-service
npm install
npm run dev  # Port 3003

# Stats Service
cd services/stats-service
npm install
npm run dev  # Port 3004

# Frontend
cd frontend
npm install
npm start  # Port 3000
```

?? ??경우 PostgreSQL?� ?�전??K8s?�서 ?�행?�어???�며, `localhost:5432`�?port-forward ?�요.

---

## ?�용??명령??모음

```bash
# 모든 Pod ?�태 ?�인
kubectl get pods -n tiketi

# 모든 Service ?�인
kubectl get svc -n tiketi

# ?�정 ?�비??로그 ?�시�??�인
kubectl logs -n tiketi -f deployment/auth-service

# ConfigMap ?�인
kubectl get configmap tiketi-config -n tiketi -o yaml

# Secret ?�인 (Base64 ?�코??
kubectl get secret tiketi-secret -n tiketi -o jsonpath='{.data.DB_PASSWORD}' | base64 -d

# 리소???�용???�인
kubectl top pods -n tiketi
kubectl top nodes

# ?�러?�터 ?�체 ?�보
kubectl get all -n tiketi
```

---

## 추�? 문서

- **MSA ?�키?�처**: [MSA_ARCHITECTURE.md](./MSA_ARCHITECTURE.md)
- **마이그레?�션 계획**: [MSA_MIGRATION_PLAN.md](./MSA_MIGRATION_PLAN.md)
- **WSL2 & Kind ?�세 ?�정**: [WSL2_KIND_SETUP_GUIDE.md](./WSL2_KIND_SETUP_GUIDE.md)
- **API 문서**: [fix_backend_api.md](./fix_backend_api.md)

---

## ?�이?�스

MIT License

---

**Happy Ticketing! ?��**