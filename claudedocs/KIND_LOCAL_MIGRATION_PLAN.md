# Kind 로컬 Kubernetes 마이그레이션 계획

## 📋 현재 상태 분석

### 현재 배포 구조
- **아키텍처**: 모놀리식 (단일 Backend)
- **배포 방식**: Docker Compose
- **컴포넌트**:
  - Frontend (React) - 포트 3000
  - Backend (Node.js Express) - 포트 3001
  - PostgreSQL 15 - 포트 5432
  - DragonflyDB (Redis 대체) - 포트 6379
  - Grafana - 포트 3002
  - Loki - 포트 3100
  - Promtail (로그 수집)

### 목표
**모놀리식 구조 그대로 Kind 로컬 Kubernetes 클러스터에 배포**

---

## 🎯 마이그레이션 전략

### Phase 1: 환경 준비 (1일)
1. Kind 클러스터 생성
2. Kubernetes CLI 도구 설치 확인
3. 로컬 Docker 레지스트리 설정 (선택)

### Phase 2: Kubernetes Manifests 작성 (2-3일)
1. Namespace 생성
2. ConfigMap/Secret 작성
3. PersistentVolume 작성
4. Database 배포 (PostgreSQL, DragonflyDB)
5. Backend 배포
6. Frontend 배포
7. Monitoring 스택 배포

### Phase 3: 테스트 및 검증 (1일)
1. 서비스 간 연결 확인
2. 데이터베이스 마이그레이션
3. 전체 기능 테스트

---

## 📁 파일 구조 변경 사항

### 추가할 디렉토리 및 파일

```
project-ticketing/
├── k8s/                                    # 새로 생성
│   ├── 00-namespace.yaml                   # Namespace
│   ├── 01-configmap.yaml                   # 환경 변수
│   ├── 02-secret.yaml                      # 민감 정보
│   ├── 03-pvc.yaml                         # 영구 볼륨
│   ├── 04-postgres.yaml                    # PostgreSQL
│   ├── 05-dragonfly.yaml                   # DragonflyDB
│   ├── 06-backend.yaml                     # Backend
│   ├── 07-frontend.yaml                    # Frontend (선택)
│   ├── 08-loki.yaml                        # Loki
│   ├── 09-promtail.yaml                    # Promtail
│   ├── 10-grafana.yaml                     # Grafana
│   └── 99-ingress.yaml                     # Ingress (선택)
│
├── scripts/
│   ├── kind-cluster-create.sh              # Kind 클러스터 생성
│   ├── kind-cluster-delete.sh              # 클러스터 삭제
│   ├── build-and-load-images.sh            # 이미지 빌드 및 로드
│   ├── deploy-all.sh                       # 전체 배포
│   └── port-forward-all.sh                 # 포트 포워딩
│
└── kind-config.yaml                        # Kind 클러스터 설정
```

### 제거할 파일 (백업 후 제거)

**제거하지 않고 참고용으로 유지 권장**:
- `docker-compose.yml` → 백업용 유지
- `docker-compose.prod.yml` → 백업용 유지

**실제 사용 중단**:
- `.github/workflows/deploy.yml` → Kind 로컬에서는 불필요
- AWS 관련 설정들 (로컬에서는 사용 안 함)

### 수정할 파일

1. **backend/Dockerfile**
   - 로컬 개발에 최적화
   - Health check 추가

2. **frontend/Dockerfile** (선택)
   - Kind에 배포 시 수정
   - 또는 로컬에서 `npm start`로 실행

3. **.env**
   - Kubernetes ConfigMap/Secret으로 전환
   - 로컬 호스트명을 K8s 서비스명으로 변경

4. **backend/src/config/database.js**
   - 호스트명: `postgres` → `postgres-service`

5. **backend/src/config/redis.js**
   - 호스트명: `dragonfly` → `dragonfly-service`

---

## 🔧 단계별 실행 계획

### Step 1: Kind 클러스터 생성

**파일**: `kind-config.yaml`

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: tiketi-local
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 30000  # Backend
        hostPort: 3001
        protocol: TCP
      - containerPort: 30001  # Frontend
        hostPort: 3000
        protocol: TCP
      - containerPort: 30002  # Grafana
        hostPort: 3002
        protocol: TCP
  - role: worker
  - role: worker
```

**실행**:
```bash
kind create cluster --config kind-config.yaml --name tiketi-local
kubectl cluster-info --context kind-tiketi-local
```

---

### Step 2: Namespace 생성

**파일**: `k8s/00-namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tiketi
  labels:
    name: tiketi
```

**실행**:
```bash
kubectl apply -f k8s/00-namespace.yaml
```

---

### Step 3: ConfigMap 생성

**파일**: `k8s/01-configmap.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: tiketi-config
  namespace: tiketi
data:
  # Database
  POSTGRES_DB: "tiketi"
  POSTGRES_USER: "tiketi_user"
  DB_HOST: "postgres-service"
  DB_PORT: "5432"

  # Redis (DragonflyDB)
  REDIS_HOST: "dragonfly-service"
  REDIS_PORT: "6379"

  # Backend
  NODE_ENV: "development"
  PORT: "3001"

  # Frontend
  REACT_APP_API_URL: "http://localhost:3001"

  # AWS (로컬에서는 사용 안 함 - S3 Mock)
  AWS_REGION: "ap-northeast-2"
  AWS_S3_BUCKET: "local-mock-bucket"
```

---

### Step 4: Secret 생성

**파일**: `k8s/02-secret.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: tiketi-secret
  namespace: tiketi
type: Opaque
stringData:
  # Database
  POSTGRES_PASSWORD: "tiketi_pass"

  # JWT
  JWT_SECRET: "your-super-secret-jwt-key-change-this-in-production"

  # Admin
  ADMIN_EMAIL: "admin@tiketi.gg"
  ADMIN_PASSWORD: "admin123"

  # AWS (로컬에서는 dummy)
  AWS_ACCESS_KEY_ID: "dummy"
  AWS_SECRET_ACCESS_KEY: "dummy"
```

**실행**:
```bash
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secret.yaml
```

---

### Step 5: PersistentVolume 생성

**파일**: `k8s/03-pvc.yaml`

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: tiketi
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: standard

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dragonfly-pvc
  namespace: tiketi
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: standard

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: grafana-pvc
  namespace: tiketi
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: standard

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: loki-pvc
  namespace: tiketi
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi
  storageClassName: standard
```

**실행**:
```bash
kubectl apply -f k8s/03-pvc.yaml
kubectl get pvc -n tiketi
```

---

### Step 6: PostgreSQL 배포

**파일**: `k8s/04-postgres.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: tiketi
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:15-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_DB
              valueFrom:
                configMapKeyRef:
                  name: tiketi-config
                  key: POSTGRES_DB
            - name: POSTGRES_USER
              valueFrom:
                configMapKeyRef:
                  name: tiketi-config
                  key: POSTGRES_USER
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: tiketi-secret
                  key: POSTGRES_PASSWORD
          volumeMounts:
            - name: postgres-storage
              mountPath: /var/lib/postgresql/data
            - name: init-sql
              mountPath: /docker-entrypoint-initdb.d
      volumes:
        - name: postgres-storage
          persistentVolumeClaim:
            claimName: postgres-pvc
        - name: init-sql
          hostPath:
            path: /path/to/project/database  # 수정 필요
            type: Directory

---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: tiketi
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
  type: ClusterIP
```

---

### Step 7: DragonflyDB 배포

**파일**: `k8s/05-dragonfly.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dragonfly
  namespace: tiketi
spec:
  replicas: 1
  selector:
    matchLabels:
      app: dragonfly
  template:
    metadata:
      labels:
        app: dragonfly
    spec:
      containers:
        - name: dragonfly
          image: docker.dragonflydb.io/dragonflydb/dragonfly:latest
          ports:
            - containerPort: 6379
          args:
            - "--maxmemory=512mb"
            - "--save_schedule=*:*"
          volumeMounts:
            - name: dragonfly-storage
              mountPath: /data
      volumes:
        - name: dragonfly-storage
          persistentVolumeClaim:
            claimName: dragonfly-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: dragonfly-service
  namespace: tiketi
spec:
  selector:
    app: dragonfly
  ports:
    - port: 6379
      targetPort: 6379
  type: ClusterIP
```

---

### Step 8: Backend 배포

**파일**: `k8s/06-backend.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: tiketi
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      initContainers:
        - name: wait-for-postgres
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              until nc -z postgres-service 5432; do
                echo "Waiting for PostgreSQL..."
                sleep 2
              done
        - name: wait-for-dragonfly
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              until nc -z dragonfly-service 6379; do
                echo "Waiting for DragonflyDB..."
                sleep 2
              done
      containers:
        - name: backend
          image: tiketi-backend:local  # 로컬 빌드 이미지
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3001
          envFrom:
            - configMapRef:
                name: tiketi-config
            - secretRef:
                name: tiketi-secret
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3001
            initialDelaySeconds: 20
            periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: tiketi
spec:
  selector:
    app: backend
  ports:
    - port: 3001
      targetPort: 3001
      nodePort: 30000
  type: NodePort
```

---

### Step 9: Frontend 배포 (선택 - 로컬에서 실행 가능)

**파일**: `k8s/07-frontend.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: tiketi
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: tiketi-frontend:local
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
          env:
            - name: REACT_APP_API_URL
              value: "http://localhost:3001"

---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: tiketi
spec:
  selector:
    app: frontend
  ports:
    - port: 3000
      targetPort: 3000
      nodePort: 30001
  type: NodePort
```

---

### Step 10: Monitoring 스택 배포

**파일**: `k8s/08-loki.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loki
  namespace: tiketi
spec:
  replicas: 1
  selector:
    matchLabels:
      app: loki
  template:
    metadata:
      labels:
        app: loki
    spec:
      containers:
        - name: loki
          image: grafana/loki:2.9.3
          ports:
            - containerPort: 3100
          volumeMounts:
            - name: loki-storage
              mountPath: /loki
            - name: loki-config
              mountPath: /etc/loki
      volumes:
        - name: loki-storage
          persistentVolumeClaim:
            claimName: loki-pvc
        - name: loki-config
          configMap:
            name: loki-config

---
apiVersion: v1
kind: Service
metadata:
  name: loki-service
  namespace: tiketi
spec:
  selector:
    app: loki
  ports:
    - port: 3100
      targetPort: 3100
  type: ClusterIP

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
  namespace: tiketi
data:
  loki-config.yaml: |
    auth_enabled: false
    server:
      http_listen_port: 3100
    ingester:
      lifecycler:
        ring:
          kvstore:
            store: inmemory
          replication_factor: 1
    schema_config:
      configs:
        - from: 2020-10-24
          store: boltdb-shipper
          object_store: filesystem
          schema: v11
          index:
            prefix: index_
            period: 24h
    storage_config:
      boltdb_shipper:
        active_index_directory: /loki/index
        cache_location: /loki/cache
        shared_store: filesystem
      filesystem:
        directory: /loki/chunks
```

**파일**: `k8s/10-grafana.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: tiketi
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
        - name: grafana
          image: grafana/grafana:10.2.3
          ports:
            - containerPort: 3000
          env:
            - name: GF_SECURITY_ADMIN_PASSWORD
              value: "admin"
          volumeMounts:
            - name: grafana-storage
              mountPath: /var/lib/grafana
      volumes:
        - name: grafana-storage
          persistentVolumeClaim:
            claimName: grafana-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: grafana-service
  namespace: tiketi
spec:
  selector:
    app: grafana
  ports:
    - port: 3000
      targetPort: 3000
      nodePort: 30002
  type: NodePort
```

---

## 🚀 배포 스크립트

### 1. Kind 클러스터 생성 스크립트

**파일**: `scripts/kind-cluster-create.sh`

```bash
#!/bin/bash

set -e

echo "🚀 Creating Kind cluster for Tiketi..."

# Kind 클러스터 생성
kind create cluster --config kind-config.yaml --name tiketi-local

# Context 확인
kubectl cluster-info --context kind-tiketi-local

# Namespace 생성
kubectl apply -f k8s/00-namespace.yaml

echo "✅ Kind cluster 'tiketi-local' created successfully!"
echo "📝 Use: kubectl config use-context kind-tiketi-local"
```

### 2. Docker 이미지 빌드 및 로드

**파일**: `scripts/build-and-load-images.sh`

```bash
#!/bin/bash

set -e

echo "🏗️  Building Docker images..."

# Backend 이미지 빌드
cd backend
docker build -t tiketi-backend:local -f Dockerfile .
cd ..

# Frontend 이미지 빌드 (선택)
# cd frontend
# docker build -t tiketi-frontend:local -f Dockerfile .
# cd ..

echo "📦 Loading images into Kind cluster..."

# Kind 클러스터에 이미지 로드
kind load docker-image tiketi-backend:local --name tiketi-local
# kind load docker-image tiketi-frontend:local --name tiketi-local

echo "✅ Images loaded successfully!"
```

### 3. 전체 배포 스크립트

**파일**: `scripts/deploy-all.sh`

```bash
#!/bin/bash

set -e

echo "🚀 Deploying all services to Kind cluster..."

# ConfigMap & Secret
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secret.yaml

# PVC
kubectl apply -f k8s/03-pvc.yaml

# Databases
kubectl apply -f k8s/04-postgres.yaml
kubectl apply -f k8s/05-dragonfly.yaml

echo "⏳ Waiting for databases to be ready..."
sleep 10

# Backend
kubectl apply -f k8s/06-backend.yaml

# Frontend (선택)
# kubectl apply -f k8s/07-frontend.yaml

# Monitoring
kubectl apply -f k8s/08-loki.yaml
kubectl apply -f k8s/10-grafana.yaml

echo "✅ All services deployed!"
echo "📊 Check status: kubectl get pods -n tiketi"
```

### 4. 포트 포워딩 스크립트

**파일**: `scripts/port-forward-all.sh`

```bash
#!/bin/bash

echo "🔌 Setting up port forwarding..."

# Backend
kubectl port-forward -n tiketi service/backend-service 3001:3001 &

# Grafana
kubectl port-forward -n tiketi service/grafana-service 3002:3000 &

# PostgreSQL (디버깅용)
kubectl port-forward -n tiketi service/postgres-service 5432:5432 &

echo "✅ Port forwarding active!"
echo "🌐 Backend: http://localhost:3001"
echo "📊 Grafana: http://localhost:3002"
echo "🐘 PostgreSQL: localhost:5432"
echo ""
echo "Press Ctrl+C to stop all port forwards"
wait
```

---

## 📝 실행 순서

### 전체 배포 순서

```bash
# 1. Kind 클러스터 생성
chmod +x scripts/*.sh
./scripts/kind-cluster-create.sh

# 2. Docker 이미지 빌드 및 로드
./scripts/build-and-load-images.sh

# 3. 전체 서비스 배포
./scripts/deploy-all.sh

# 4. Pod 상태 확인
kubectl get pods -n tiketi -w

# 5. 포트 포워딩 (별도 터미널)
./scripts/port-forward-all.sh

# 6. 로그 확인
kubectl logs -n tiketi -l app=backend -f
```

### 접속 확인

```bash
# Backend 헬스 체크
curl http://localhost:3001/api/health

# Grafana 접속
open http://localhost:3002
# ID: admin / PW: admin
```

---

## 🔧 수정이 필요한 기존 파일들

### 1. backend/src/config/database.js

**변경 전**:
```javascript
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  // ...
});
```

**변경 후**:
```javascript
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres-service',  // K8s 서비스명
  // ...
});
```

### 2. backend/src/config/redis.js

**변경 전**:
```javascript
const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    // ...
  }
});
```

**변경 후**:
```javascript
const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'dragonfly-service',  // K8s 서비스명
    // ...
  }
});
```

### 3. backend/Dockerfile (Health check 추가)

**추가**:
```dockerfile
# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

---

## 🗑️ 제거/백업할 파일

### 백업만 하고 유지 (참고용)
- `docker-compose.yml` → `docker-compose.yml.backup`
- `docker-compose.prod.yml` → `docker-compose.prod.yml.backup`

### Kind 로컬에서 불필요 (유지하되 사용 안 함)
- `.github/workflows/deploy.yml` (AWS 배포용)
- AWS 관련 설정들

---

## ✅ 마이그레이션 체크리스트

### Phase 1: 환경 준비
- [ ] Kind 설치 확인 (`kind version`)
- [ ] kubectl 설치 확인 (`kubectl version`)
- [ ] Docker 설치 확인 (`docker --version`)
- [ ] `kind-config.yaml` 작성
- [ ] Kind 클러스터 생성

### Phase 2: Kubernetes Manifests 작성
- [ ] `k8s/00-namespace.yaml`
- [ ] `k8s/01-configmap.yaml`
- [ ] `k8s/02-secret.yaml`
- [ ] `k8s/03-pvc.yaml`
- [ ] `k8s/04-postgres.yaml`
- [ ] `k8s/05-dragonfly.yaml`
- [ ] `k8s/06-backend.yaml`
- [ ] `k8s/07-frontend.yaml` (선택)
- [ ] `k8s/08-loki.yaml`
- [ ] `k8s/10-grafana.yaml`

### Phase 3: 스크립트 작성
- [ ] `scripts/kind-cluster-create.sh`
- [ ] `scripts/build-and-load-images.sh`
- [ ] `scripts/deploy-all.sh`
- [ ] `scripts/port-forward-all.sh`

### Phase 4: 코드 수정
- [ ] `backend/src/config/database.js` (호스트명 변경)
- [ ] `backend/src/config/redis.js` (호스트명 변경)
- [ ] `backend/Dockerfile` (Health check 추가)

### Phase 5: 배포 및 테스트
- [ ] 이미지 빌드 및 Kind 로드
- [ ] 전체 서비스 배포
- [ ] Pod 상태 확인 (`kubectl get pods -n tiketi`)
- [ ] 포트 포워딩 설정
- [ ] Backend 헬스 체크 (`curl localhost:3001/api/health`)
- [ ] 데이터베이스 마이그레이션 실행
- [ ] 전체 기능 테스트

---

## 🚨 주의사항

1. **데이터베이스 초기화 경로**
   - `k8s/04-postgres.yaml`의 `hostPath`를 실제 경로로 수정 필요
   - 또는 ConfigMap으로 `init.sql` 주입

2. **이미지 태그**
   - 로컬 빌드: `tiketi-backend:local`
   - Kind에서 `imagePullPolicy: IfNotPresent` 설정 필수

3. **PersistentVolume**
   - Kind는 기본적으로 `standard` StorageClass 제공
   - 로컬 경로 매핑 사용 시 `hostPath` 타입 PV 생성 필요

4. **Port 충돌**
   - 기존 3000, 3001, 3002 포트 사용 여부 확인
   - NodePort 30000-32767 범위 사용

5. **AWS 서비스**
   - S3 이미지 업로드는 로컬에서 Mock/비활성화 필요
   - 또는 MinIO 등 로컬 S3 대체 솔루션 사용

---

## 📚 다음 단계 (MSA 전환 준비)

현재 계획은 **모놀리식 그대로 Kind에 배포**하는 것이지만, 향후 MSA 전환 시:

1. Backend를 서비스별로 분리
   - auth-service
   - event-service
   - reservation-service
   - payment-service
   - queue-service
   - notification-service

2. 각 서비스별 Deployment/Service 작성

3. Service Mesh (Istio, Linkerd) 도입 검토

현재는 모놀리식 배포에 집중하고, 안정화 후 MSA 전환을 진행하세요.

---

**작성일**: 2025-12-11
**대상 환경**: Kind 로컬 Kubernetes
**아키텍처**: 모놀리식 (Monolithic)
