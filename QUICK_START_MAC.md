# TIKETI Quick Start Guide for Mac ??

> Mac ?�용?��? ?�한 ?�벽???�치 가?�드

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
2. ???��????�기
3. ???�로?�트 ?�렉?�리�??�동: `cd ~/project-ticketing` (?�는 ?�론??경로)

**?�체 ?�리 ???�시?�하?�면:**
```bash
./scripts/cleanup.sh
```

---

## 빠른 ?�작 (?�동 ?�치)

### ?�스???�치 ?��

Mac?�서??간단?�니?? ?��??�에????줄만 ?�행?�세??

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

**?�요 ?�간**: ??5-10�?(M1/M2????빠름!)

### ?�속?�기

?�치 ?�료 ??

```bash
# ?�트?�워???�작
./scripts/port-forward-all.sh
```

**브라?��??�서 ?�속:**
```
http://localhost:3000
```

??**??** ?�제 TIKETI�??�용?????�습?�다.

---

## ?�전 ?�구?�항

### ?�수 ?�프?�웨??

Mac?�서??**WSL???�요 ?�습?�다!** ?�음�??�치?�면 ?�니??

1. **Homebrew** (Mac ?�키지 관리자)
2. **Docker Desktop for Mac**
3. **kubectl** (Kubernetes CLI)
4. **Kind** (Kubernetes in Docker)
5. **Node.js** v18 ?�상

### 1. Homebrew ?�치

```bash
# Homebrew가 ?�다�??�치
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# ?�치 ?�인
brew --version
```

### 2. Docker Desktop for Mac ?�치

**방법 A: Homebrew ?�용 (권장)**
```bash
brew install --cask docker

# Docker Desktop ?�행
open -a Docker
```

**방법 B: 공식 ?�이?�에???�운로드**
- Intel Mac: https://docs.docker.com/desktop/install/mac-install/
- M1/M2 (Apple Silicon): Docker Desktop for Mac (Apple Silicon) ?�운로드

**Docker ?�작 ?�인:**
```bash
docker --version
docker ps  # ?�러 ?�이 ?�행?�어????
```

### 3. kubectl ?�치

```bash
# Homebrew�??�치
brew install kubectl

# ?�치 ?�인
kubectl version --client
```

### 4. Kind ?�치

```bash
# Homebrew�??�치
brew install kind

# ?�치 ?�인
kind version
```

### 5. Node.js ?�치

```bash
# Homebrew�??�치 (v18 ?�상)
brew install node@18

# ?�는 nvm ?�용 (권장)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# ?�치 ?�인
node --version  # v18 ?�상
npm --version
```

### ?�치 ?�인

모든 ?�구가 ?�치?�었?��? ?�인:

```bash
docker --version      # Docker version 24.x.x
kubectl version --client  # Client Version: v1.28.x
kind version          # kind v0.20.0 go1.21.x
node --version        # v18.x.x
npm --version         # 9.x.x
```

---

## ?�동 ?�치 (?�세)

> ?�� **권장**: ?�의 [빠른 ?�작](#빠른-?�작-?�동-?�치) ?�동???�크립트�??�용?�세??
>
> ?�래??�??�계�??�동?�로 ?�행?�려??경우�??�한 ?�세 가?�드?�니??

### 1. ?�로?�트 ?�론

```bash
# ?�하???�렉?�리�??�동
cd ~/Projects  # ?�는 ?�하??경로

# ?�로?�트 ?�론
git clone https://github.com/your-org/project-ticketing.git
cd project-ticketing
```

### 2. Kind ?�러?�터 ?�성

```bash
# Kind ?�러?�터 ?�성 (3-node cluster)
kind create cluster --name tiketi-local --config k8s/kind-config.yaml

# ?�러?�터 ?�인
kubectl cluster-info --context kind-tiketi-local
kubectl get nodes
```

**?�상 결과:**
```
NAME                         STATUS   ROLES           AGE   VERSION
tiketi-local-control-plane   Ready    control-plane   1m    v1.27.0
tiketi-local-worker          Ready    <none>          1m    v1.27.0
tiketi-local-worker2         Ready    <none>          1m    v1.27.0
```

### 3. Kubernetes Namespace & Config ?�성

```bash
# Dev environment (namespace + config + secrets + postgres/dragonfly + services)
kubectl apply -k k8s/overlays/dev

```

### 4. PostgreSQL 배포

```bash
# PVC �?PostgreSQL 배포 (Kustomize�?통합 배포?�므�??�미 ?�성?�었?�면 SKIP)
kubectl apply -k k8s/overlays/dev

# Pod ?�행 ?��?(??30�?
kubectl wait --for=condition=ready pod -l app=postgres -n tiketi --timeout=120s

# ?�태 ?�인
kubectl get pods -n tiketi
```

### 5. Database 초기??

**중요**: 반드???�래 ?�서?��??�행?�세??

```bash
# Pod ?�름 변???�??(간편??
POSTGRES_POD=$(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}')

# 1. 기본 ?�키�?�??�플 ?�이???�성
cat database/init.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi

# 2. MSA ?�키�?마이그레?�션
cat database/migrations/auth-service-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi
cat database/migrations/ticket-service-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi
cat database/migrations/stats-service-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi
cat database/migrations/payment-service-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi

# 3. Search Path ?�정
cat database/set_search_path.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi
```

**결과 ?�인:**
```bash
# ?�벤???�이???�인
kubectl exec -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi -c "SELECT COUNT(*) FROM events"
# 25�??�상???�플 ?�벤?��? ?�어????
```

### 6. 공통 ?�키지 ?�치

```bash
# Monorepo ?�키지 ?�치
cd packages/common && npm install && cd ../..
cd packages/database && npm install && cd ../..
cd packages/metrics && npm install && cd ../..
```

### 7. Docker ?��?지 빌드

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

# Backend (Legacy)
docker build -t tiketi-backend:local -f backend/Dockerfile backend
kind load docker-image tiketi-backend:local --name tiketi-local

# Frontend
docker build -t tiketi-frontend:local -f frontend/Dockerfile frontend
kind load docker-image tiketi-frontend:local --name tiketi-local
```

**?�� Tip**: 모든 ?��?지�???번에 빌드?�려�?
```bash
chmod +x scripts/build-all-images.sh
./scripts/build-all-images.sh
```

**M1/M2 Mac ?�용??주의?�항:**
- Docker ?��?지가 ARM64 ?�키?�처�?빌드?�니??
- ?�환??문제??거의 ?��?�? ?��? Node.js ?�이?�브 모듈?�서 발생 가??
- 문제 발생 ?? `docker build --platform linux/amd64` ?�션 추�?

### 8. ?�프???�비??배포

```bash
# Monitoring stack (optional)
kubectl apply -f k8s/08-loki.yaml
kubectl apply -f k8s/09-promtail.yaml
kubectl apply -f k8s/10-grafana.yaml
```

### 9. ?�플리�??�션 ?�비??배포

```bash
# Backend & MSA ?�비??배포
kubectl apply -k k8s/overlays/dev
kubectl apply -f k8s/07-frontend.yaml

# 배포 ?�태 ?�인 (모든 Pod가 Running ???�까지 ?��?
kubectl get pods -n tiketi -w
```

**Ctrl+C�?종료 ??최종 ?�인:**
```bash
kubectl get pods -n tiketi
```

**모든 Pod가 Running ?�태?�야 ?�니??**

---

## ?�속 �??�스??

### 1. Port-Forward ?�정

**?�동 ?�크립트 ?�용 (권장):**
```bash
chmod +x scripts/port-forward-all.sh
./scripts/port-forward-all.sh
```

???�크립트??백그?�운?�로 ?�행?�며, ?�음 ?�트�??�워?�합?�다:
- PostgreSQL: 5432
- Backend: 3001
- Auth: 3005
- Payment: 3003
- Ticket: 3002
- Stats: 3004
- Frontend: 3000

**?�동 ?�정 (?�택?�항):**
```bash
# 각각 별도???��??�에???�행?�거??백그?�운?�로 ?�행
kubectl port-forward -n tiketi svc/postgres-service 5432:5432 &
kubectl port-forward -n tiketi svc/backend-service 3001:3001 &
kubectl port-forward -n tiketi svc/auth-service 3005:3005 &
kubectl port-forward -n tiketi svc/payment-service 3003:3003 &
kubectl port-forward -n tiketi svc/ticket-service 3002:3002 &
kubectl port-forward -n tiketi svc/stats-service 3004:3004 &
kubectl port-forward -n tiketi svc/frontend-service 3000:3000 &
```

### 2. ?�속 URL

| ?�비??| URL | ?�명 |
|--------|-----|------|
| **Frontend** | http://localhost:3000 | 메인 ?�용???�사?�트 |
| **Backend API** | http://localhost:3001 | Legacy API (Admin ?? |
| **Auth Service** | http://localhost:3005 | ?�증 ?�비??(MSA) |
| **Payment Service** | http://localhost:3003 | 결제 ?�비??|
| **Ticket Service** | http://localhost:3002 | ?�켓 ?�매 ?�비??|
| **Stats Service** | http://localhost:3004 | ?�계 ?�비??|

### 3. 기본 ?�스??

#### A. Health Check

```bash
# 모든 ?�비??Health ?�인
curl http://localhost:3001/health  # Backend
curl http://localhost:3005/health  # Auth
curl http://localhost:3003/health  # Payment
curl http://localhost:3002/health  # Ticket
curl http://localhost:3004/health  # Stats
```

모든 ?�비?��? `{"status":"ok"}` ?�답??반환?�야 ?�니??

#### B. ?�원가??& 로그??

1. 브라?��??�서 http://localhost:3000 ?�속
2. ?�측 ?�단 "?�원가?? ?�릭
3. ?�보 ?�력 ??가??
4. 로그??

#### C. ?�켓 ?�매 ?�로??

1. 메인 ?�이지?�서 ?�벤???�택
2. 좌석 ?�택 (?�시�??�기???�인 - ?�러 ??��???�시 ?�속 ?�스??
3. 결제 진행
4. "???�약" ?�이지?�서 ?�인

#### D. 관리자 기능

1. http://localhost:3000/admin ?�속
2. Admin 로그??
   - Email: `admin@tiketi.gg`
   - Password: `admin123`
3. Dashboard ?�인
4. Statistics ?�이지?�서 ?�계 ?�인

---

## 문제 ?�결

### Docker Desktop???�작?��? ?�을 ??

```bash
# Docker Desktop ?�시??
killall Docker
open -a Docker

# ?�는 ?�스???��??????�시 ?�도
```

### Pod가 CrashLoopBackOff ?�태????

```bash
# 로그 ?�인
kubectl logs -n tiketi <pod-name>

# ?�전 컨테?�너 로그 ?�인
kubectl logs -n tiketi <pod-name> --previous

# Pod ?�세 ?�보
kubectl describe pod -n tiketi <pod-name>
```

**?�반?�인 ?�인:**
- Database ?�결 ?�패 ??PostgreSQL Pod ?�태 ?�인
- ?�경 변???�락 ??ConfigMap/Secret ?�인
- ?��?지 Pull ?�패 ??`kind load docker-image` ?�실??

### Database ?�결 ?�패

```bash
# PostgreSQL Pod 로그 ?�인
kubectl logs -n tiketi -l app=postgres

# PostgreSQL 직접 ?�속 ?�스??
POSTGRES_POD=$(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi

# ?�키�??�인
\dn

# ?�이�??�인
SET search_path TO auth_schema, ticket_schema, stats_schema, payment_schema, public;
\dt
```

### Port-Forward ?��?

Mac?�서???�트?�크 변�???(Wi-Fi 변�??? ?�트 ?�워?�이 ?�어�????�습?�다.

```bash
# 모든 port-forward ?�로?�스 종료
pkill -f "kubectl port-forward"

# ?�는
killall kubectl

# ?�시??
./scripts/port-forward-all.sh
```

### M1/M2 ?�정 ?�슈

**ARM64 ?�키?�처 문제:**
```bash
# ?��? ?��?지??AMD64�?빌드 ?�요?????�음
docker build --platform linux/amd64 -t tiketi-auth-service:local -f services/auth-service/Dockerfile .
```

**Node.js ?�이?�브 모듈 문제:**
```bash
# node_modules ?�설�?
cd services/auth-service
rm -rf node_modules package-lock.json
npm install
```

### Frontend가 백엔??API ?�출 ?�패

```bash
# Frontend 로그 ?�인
kubectl logs -n tiketi -l app=frontend

# 브라?��? 개발???�구?�서 ?�트?�크 ???�인
# CORS ?�러??경우: ConfigMap?�서 FRONTEND_URL ?�인
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

### Cleanup ?�크립트 ?�용 (권장)

```bash
./scripts/cleanup.sh
```

???�크립트???�음???�리?�니??
- ???�행 중인 port-forward ?�로?�스
- ??Kind cluster ??��
- ??Docker images ??�� (?�택?�항)
- ??node_modules ?�더 ??�� (?�택?�항)

### ?�동 ?�리

```bash
# 1. ?�트 ?�워??중�?
pkill -f "kubectl port-forward"

# 2. Kind ?�러?�터 ??��
kind delete cluster --name tiketi-local

# 3. Docker ?��?지 ?�리 (?�택?�항)
docker images | grep tiketi | awk '{print $3}' | xargs docker rmi -f

# 4. 처음부???�시 ?�작
./scripts/setup-tiketi.sh
```

---

## 개발 모드

Kubernetes ?�이 로컬?�서 직접 ?�행 (개발 ???�용):

### 1. PostgreSQL�?K8s?�서 ?�행

```bash
# PostgreSQL ?�트?�워??
kubectl port-forward -n tiketi svc/postgres-service 5432:5432 &
```

### 2. �??�비??로컬 ?�행

**???��??????�도?��? 각각 ?�어???�행:**

```bash
# ??1: Backend
cd backend
npm install
npm run dev  # Port 3001

# ??2: Auth Service
cd services/auth-service
npm install
npm run dev  # Port 3005

# ??3: Ticket Service
cd services/ticket-service
npm install
npm run dev  # Port 3002

# ??4: Payment Service
cd services/payment-service
npm install
npm run dev  # Port 3003

# ??5: Stats Service
cd services/stats-service
npm install
npm run dev  # Port 3004

# ??6: Frontend
cd frontend
npm install
npm start  # Port 3000
```

**?�점:**
- 코드 ?�정 ??즉시 반영 (Hot Reload)
- ?�버�??��?
- 빠른 개발 ?�이??

**?�점:**
- ?�러 ?��???관�??�요
- Redis가 ?�요??기능?� 별도 ?�정 ?�요

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

# Pod??직접 ?�속
kubectl exec -it -n tiketi <pod-name> -- /bin/sh

# PostgreSQL ?�속
POSTGRES_POD=$(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi
```

---

## Mac ?�화 ??

### iTerm2 ?�용??

iTerm2�??�용?�면 ???�리?�니??

**Split Panes�??�러 로그 ?�시 ?�인:**
```bash
# Cmd+D�??�직 분할, Cmd+Shift+D�??�평 분할

# �?Pane?�서:
kubectl logs -n tiketi -f deployment/auth-service
kubectl logs -n tiketi -f deployment/ticket-service
kubectl logs -n tiketi -f deployment/payment-service
```

### Oh My Zsh ?�용??

`.zshrc`??alias 추�?:

```bash
# ~/.zshrc??추�?
alias k='kubectl'
alias kgp='kubectl get pods -n tiketi'
alias kgs='kubectl get svc -n tiketi'
alias klf='kubectl logs -n tiketi -f'
alias tiketi-start='cd ~/Projects/project-ticketing && ./scripts/setup-tiketi.sh'
alias tiketi-port='cd ~/Projects/project-ticketing && ./scripts/port-forward-all.sh'
alias tiketi-clean='cd ~/Projects/project-ticketing && ./scripts/cleanup.sh'

# ?�용
source ~/.zshrc
```

### Docker Desktop 메모�??�정

Mac?�서 Docker Desktop 메모�?부�???

1. Docker Desktop ?�정 ?�기
2. Resources ??Advanced
3. Memory�?4GB ?�상?�로 ?�정 (권장: 6GB)
4. Apply & Restart

### M1/M2 ?�능 최적??

Apple Silicon Mac?� 매우 빠르지�? Rosetta ?��??�이?�을 ?�하�??�해:

```bash
# ARM64 ?�이?�브 ?��?지 ?�용 ?�인
docker images --format "{{.Repository}}:{{.Tag}}" | xargs -I {} docker inspect {} | grep Architecture

# 모두 "arm64"?�야 최적
```

---

## 추�? 문서

- **?�로?�트 분석 보고??*: [claudedocs/TIKETI_PROJECT_ANALYSIS_PART1.md](./claudedocs/TIKETI_PROJECT_ANALYSIS_PART1.md)
- **MSA ?�키?�처**: [MSA_ARCHITECTURE.md](./MSA_ARCHITECTURE.md)
- **면접 준�?QnA**: [claudedocs/TIKETI_PROJECT_ANALYSIS_PART2.md](./claudedocs/TIKETI_PROJECT_ANALYSIS_PART2.md)

---

## Windows ?�?�과 ?�업

Windows ?�?��? `QUICK_START.md`�?참고?�세??

주요 차이??
- Mac: bash ?�크립트 ?�용 (`./scripts/*.sh`)
- Windows: PowerShell ?�크립트 ?�용 (`.\*.ps1`)
- Mac: WSL 불필?? ?�이?�브 Unix ?�경
- Windows: WSL2 + Docker Desktop ?�요

---

## ?�이?�스

MIT License

---

**Happy Ticketing! ?��**

*Made with ?�️ for Mac*
