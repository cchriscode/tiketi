# MSA 마이그레이션 가이드 Part 3: K3s → EKS 단계별 실행 가이드

> **작성일:** 2025-12-03
> **경로:** 현재 EC2 → K3s → EKS
> **목적:** 실제 마이그레이션 실행 단계

---

## 목차
1. [전체 로드맵](#전체-로드맵)
2. [Phase 2: K3s에 첫 서비스 배포 (Auth)](#phase-2-k3s에-첫-서비스-배포)
3. [Phase 3: 나머지 서비스 배포](#phase-3-나머지-서비스-배포)
4. [Phase 4: K3s 안정화 및 모니터링](#phase-4-k3s-안정화-및-모니터링)
5. [Phase 5: EKS 마이그레이션](#phase-5-eks-마이그레이션)
6. [트러블슈팅](#트러블슈팅)

---

## 1. 전체 로드맵

```
Week 1-2:   Phase 1 - RDS/ElastiCache 마이그레이션 ✅
Week 3:     Phase 2 - K3s 설치 + Auth Service 배포
Week 4-5:   Phase 3 - Event, Queue, Reservation, Payment 배포
Week 6-7:   Phase 4 - K3s 안정화, 부하 테스트
Week 8:     Phase 5 - EKS 클러스터 생성
Week 9:     Phase 5 - EKS로 트래픽 전환
Week 10+:   최적화 - HPA, Spot Instance, Service Mesh
```

---

## 2. Phase 2: K3s에 첫 서비스 배포 (Auth)

### 2.1 프로젝트 구조 변경

```bash
# 현재 구조
project-ticketing/
├── backend/
│   └── src/
│       ├── routes/
│       ├── services/
│       └── server.js (모놀리스)
└── frontend/

# 목표 구조 (MSA)
project-ticketing/
├── services/
│   ├── auth-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── event-service/
│   ├── queue-service/
│   ├── reservation-service/
│   └── payment-service/
├── k8s/
│   ├── auth-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── hpa.yaml
│   ├── event-service/
│   └── ...
└── frontend/
```

---

### 2.2 Auth Service 분리

#### **Step 1: 코드 분리**

```bash
# 새 디렉토리 생성
mkdir -p services/auth-service/src

# 기존 코드 복사
cp -r backend/src/routes/auth.js services/auth-service/src/
cp -r backend/src/middleware/auth.js services/auth-service/src/middleware/
cp -r backend/src/utils services/auth-service/src/

# Auth Service 전용 server.js
cat > services/auth-service/src/server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'auth-service',
    version: process.env.VERSION || '1.0.0'
  });
});

// Routes
app.use('/api/v1/auth', authRoutes);

// Error Handler
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  logger.info(`Auth Service listening on port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
EOF
```

---

#### **Step 2: Dockerfile 작성**

```dockerfile
# services/auth-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3010

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3010/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "src/server.js"]
```

---

#### **Step 3: Docker 이미지 빌드 및 푸시**

```bash
# 이미지 빌드
cd services/auth-service
docker build -t tiketi/auth-service:v1.0.0 .

# 테스트 (로컬)
docker run -p 3010:3010 \
  -e DB_HOST=tiketi-dev-cluster.cluster-xxx.us-east-1.rds.amazonaws.com \
  -e DB_PASSWORD=xxx \
  tiketi/auth-service:v1.0.0

# Health Check
curl http://localhost:3010/health
# {"status":"ok","service":"auth-service","version":"1.0.0"}

# ECR에 푸시
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

docker tag tiketi/auth-service:v1.0.0 \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/tiketi/auth-service:v1.0.0

docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/tiketi/auth-service:v1.0.0
```

---

### 2.3 Kubernetes Manifest 작성

#### **Deployment**

```yaml
# k8s/auth-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: tiketi
  labels:
    app: auth-service
    version: v1.0.0
spec:
  replicas: 2
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
        version: v1.0.0
    spec:
      # ECR 이미지 Pull을 위한 ServiceAccount
      serviceAccountName: tiketi-sa

      containers:
      - name: auth-service
        image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/tiketi/auth-service:v1.0.0
        ports:
        - containerPort: 3010
          name: http
          protocol: TCP

        # Environment Variables
        env:
        - name: PORT
          value: "3010"
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: host
        - name: DB_PORT
          value: "5432"
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: password
        - name: DB_NAME
          value: "tiketi"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: auth-secret
              key: jwt-secret

        # Resource Limits
        resources:
          requests:
            cpu: "100m"      # 최소 0.1 CPU
            memory: "128Mi"
          limits:
            cpu: "500m"      # 최대 0.5 CPU
            memory: "512Mi"

        # Health Checks
        livenessProbe:
          httpGet:
            path: /health
            port: 3010
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /health
            port: 3010
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3

      # Graceful Shutdown
      terminationGracePeriodSeconds: 30
```

---

#### **Service (ClusterIP)**

```yaml
# k8s/auth-service/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: tiketi
  labels:
    app: auth-service
spec:
  type: ClusterIP
  selector:
    app: auth-service
  ports:
  - port: 3010
    targetPort: 3010
    protocol: TCP
    name: http
  sessionAffinity: None
```

---

#### **HorizontalPodAutoscaler**

```yaml
# k8s/auth-service/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
  namespace: tiketi
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 2
        periodSeconds: 15
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

---

### 2.4 Secrets 생성

```bash
# Namespace 생성
kubectl create namespace tiketi

# Database Secret
kubectl create secret generic database-secret \
  --from-literal=host=tiketi-dev-cluster.cluster-xxx.us-east-1.rds.amazonaws.com \
  --from-literal=username=postgres \
  --from-literal=password=your-db-password \
  -n tiketi

# Auth Secret
kubectl create secret generic auth-secret \
  --from-literal=jwt-secret=your-jwt-secret-key \
  -n tiketi

# ECR Pull Secret (EC2 IAM Role 사용 시 불필요, 로컬 테스트용)
kubectl create secret docker-registry ecr-secret \
  --docker-server=123456789012.dkr.ecr.us-east-1.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region us-east-1) \
  -n tiketi

# ServiceAccount 생성
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: tiketi-sa
  namespace: tiketi
imagePullSecrets:
- name: ecr-secret
EOF
```

---

### 2.5 Auth Service 배포

```bash
# 배포
kubectl apply -f k8s/auth-service/

# 배포 상태 확인
kubectl get deployments -n tiketi
# NAME           READY   UP-TO-DATE   AVAILABLE   AGE
# auth-service   2/2     2            2           1m

kubectl get pods -n tiketi
# NAME                           READY   STATUS    RESTARTS   AGE
# auth-service-xxx-yyy           1/1     Running   0          1m
# auth-service-xxx-zzz           1/1     Running   0          1m

# Service 확인
kubectl get svc -n tiketi
# NAME           TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
# auth-service   ClusterIP   10.43.100.123   <none>        3010/TCP   1m

# HPA 확인
kubectl get hpa -n tiketi
# NAME               REFERENCE                 TARGETS         MINPODS   MAXPODS   REPLICAS   AGE
# auth-service-hpa   Deployment/auth-service   15%/70%, 20%/80%   2         10        2          1m
```

---

### 2.6 테스트

#### **클러스터 내부 테스트**

```bash
# 임시 Pod 생성
kubectl run test-pod --image=curlimages/curl -i --tty --rm -n tiketi -- sh

# Auth Service 호출
curl http://auth-service.tiketi.svc.cluster.local:3010/health
# {"status":"ok","service":"auth-service","version":"1.0.0"}

# 회원가입 테스트
curl -X POST http://auth-service.tiketi.svc.cluster.local:3010/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
# {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","user":{...}}
```

---

#### **Ingress를 통한 외부 접근**

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-ingress
  namespace: tiketi
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  ingressClassName: nginx
  rules:
  - host: api.tiketi.local  # 로컬 테스트용 (나중에 실제 도메인으로 변경)
    http:
      paths:
      - path: /api/v1/auth(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: auth-service
            port:
              number: 3010
```

```bash
# Ingress 배포
kubectl apply -f k8s/ingress.yaml

# Ingress Controller의 External IP 확인
kubectl get svc -n ingress-nginx
# NAME                                 TYPE           EXTERNAL-IP
# ingress-nginx-controller             LoadBalancer   a1234...elb.amazonaws.com

# /etc/hosts 수정 (로컬 테스트)
echo "{{EXTERNAL-IP}} api.tiketi.local" | sudo tee -a /etc/hosts

# 테스트
curl http://api.tiketi.local/api/v1/auth/health
# {"status":"ok","service":"auth-service","version":"1.0.0"}
```

---

### 2.7 모니터링 확인

```bash
# Prometheus로 메트릭 확인
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090

# 브라우저: http://localhost:9090
# 쿼리:
# - container_cpu_usage_seconds_total{namespace="tiketi", pod=~"auth-service.*"}
# - container_memory_working_set_bytes{namespace="tiketi", pod=~"auth-service.*"}

# Grafana 대시보드
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80

# 브라우저: http://localhost:3000
# Dashboards → Kubernetes / Compute Resources / Namespace (Pods)
# Namespace 선택: tiketi
```

---

## 3. Phase 3: 나머지 서비스 배포

### 3.1 Event Service

#### **코드 분리 및 Docker 이미지**

```bash
mkdir -p services/event-service/src
cp -r backend/src/routes/events.js services/event-service/src/routes/
cp -r backend/src/routes/seats.js services/event-service/src/routes/

# server.js 작성 (Auth Service와 유사)
cat > services/event-service/src/server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const eventRoutes = require('./routes/events');
const seatRoutes = require('./routes/seats');
const redis = require('./config/redis');  # 캐싱
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3011;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'event-service',
    redis: redis.status === 'ready' ? 'connected' : 'disconnected'
  });
});

app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/seats', seatRoutes);

app.listen(PORT, () => {
  logger.info(`Event Service listening on port ${PORT}`);
});
EOF

# Dockerfile (Auth Service와 동일 구조)
cp services/auth-service/Dockerfile services/event-service/

# 빌드 및 푸시
cd services/event-service
docker build -t 123456789012.dkr.ecr.us-east-1.amazonaws.com/tiketi/event-service:v1.0.0 .
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/tiketi/event-service:v1.0.0
```

---

#### **Kubernetes Manifest**

```yaml
# k8s/event-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: event-service
  namespace: tiketi
spec:
  replicas: 2
  selector:
    matchLabels:
      app: event-service
  template:
    metadata:
      labels:
        app: event-service
    spec:
      serviceAccountName: tiketi-sa
      containers:
      - name: event-service
        image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/tiketi/event-service:v1.0.0
        ports:
        - containerPort: 3011
        env:
        - name: PORT
          value: "3011"
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: host
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: password
        - name: REDIS_HOST
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: host
        - name: REDIS_AUTH_TOKEN
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: auth-token
        resources:
          requests:
            cpu: "200m"
            memory: "256Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3011
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3011
          initialDelaySeconds: 5
          periodSeconds: 5

---
# k8s/event-service/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: event-service
  namespace: tiketi
spec:
  type: ClusterIP
  selector:
    app: event-service
  ports:
  - port: 3011
    targetPort: 3011

---
# k8s/event-service/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: event-service-hpa
  namespace: tiketi
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: event-service
  minReplicas: 2
  maxReplicas: 20  # 이벤트 조회는 트래픽 많음
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

```bash
# Redis Secret 생성
kubectl create secret generic redis-secret \
  --from-literal=host=tiketi-dev-redis.xxx.cache.amazonaws.com \
  --from-literal=auth-token=your-redis-auth-token \
  -n tiketi

# 배포
kubectl apply -f k8s/event-service/

# Ingress 업데이트 (Event Service 경로 추가)
# k8s/ingress.yaml에 추가:
#   - path: /api/v1/events(/|$)(.*)
#     pathType: Prefix
#     backend:
#       service:
#         name: event-service
#         port:
#           number: 3011
kubectl apply -f k8s/ingress.yaml

# 테스트
curl http://api.tiketi.local/api/v1/events
# [{"id":"...","title":"BTS Concert",...}]
```

---

### 3.2 Queue Service (WebSocket 포함)

#### **중요 포인트: Sticky Session**

WebSocket 연결은 같은 Pod로 유지되어야 합니다.

```yaml
# k8s/queue-service/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: queue-service
  namespace: tiketi
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"  # NLB 사용
spec:
  type: LoadBalancer  # Ingress가 아닌 직접 LB 노출
  sessionAffinity: ClientIP  # Sticky Session
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 3600  # 1시간
  selector:
    app: queue-service
  ports:
  - port: 3012
    targetPort: 3012
    name: http
```

#### **Deployment**

```yaml
# k8s/queue-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: queue-service
  namespace: tiketi
spec:
  replicas: 3
  selector:
    matchLabels:
      app: queue-service
  template:
    metadata:
      labels:
        app: queue-service
    spec:
      serviceAccountName: tiketi-sa
      containers:
      - name: queue-service
        image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/tiketi/queue-service:v1.0.0
        ports:
        - containerPort: 3012
        env:
        - name: PORT
          value: "3012"
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: host
        - name: REDIS_AUTH_TOKEN
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: auth-token
        - name: SOCKET_IO_REDIS_ENABLED
          value: "true"  # Redis Adapter 사용
        resources:
          requests:
            cpu: "500m"    # WebSocket은 CPU 많이 사용
            memory: "512Mi"
          limits:
            cpu: "2000m"
            memory: "2Gi"
```

---

### 3.3 Reservation Service (가장 중요 🔥)

```yaml
# k8s/reservation-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: reservation-service
  namespace: tiketi
spec:
  replicas: 3
  selector:
    matchLabels:
      app: reservation-service
  template:
    metadata:
      labels:
        app: reservation-service
    spec:
      serviceAccountName: tiketi-sa
      containers:
      - name: reservation-service
        image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/tiketi/reservation-service:v1.0.0
        ports:
        - containerPort: 3013
        env:
        - name: PORT
          value: "3013"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: host
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: password
        - name: REDIS_HOST
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: host
        - name: REDIS_AUTH_TOKEN
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: auth-token
        resources:
          requests:
            cpu: "1000m"   # 트랜잭션 처리 많음
            memory: "1Gi"
          limits:
            cpu: "4000m"
            memory: "4Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3013
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3013
          initialDelaySeconds: 5
          periodSeconds: 5

---
# k8s/reservation-service/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: reservation-service-hpa
  namespace: tiketi
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: reservation-service
  minReplicas: 3
  maxReplicas: 50  # 예매는 가장 많이 확장
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 85
```

---

### 3.4 Payment Service

```yaml
# k8s/payment-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
  namespace: tiketi
spec:
  replicas: 2
  selector:
    matchLabels:
      app: payment-service
  template:
    metadata:
      labels:
        app: payment-service
    spec:
      serviceAccountName: tiketi-sa
      containers:
      - name: payment-service
        image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/tiketi/payment-service:v1.0.0
        ports:
        - containerPort: 3014
        env:
        - name: PORT
          value: "3014"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: host
        - name: TOSS_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: payment-secret
              key: toss-secret-key
        resources:
          requests:
            cpu: "200m"
            memory: "256Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
```

---

### 3.5 전체 Ingress 설정 (최종)

```yaml
# k8s/ingress.yaml (전체 서비스 통합)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-ingress
  namespace: tiketi
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    nginx.ingress.kubernetes.io/ssl-redirect: "false"  # 나중에 true로 변경
    nginx.ingress.kubernetes.io/cors-allow-origin: "*"
    nginx.ingress.kubernetes.io/enable-cors: "true"
spec:
  ingressClassName: nginx
  rules:
  - host: api.tiketi.gg  # 실제 도메인
    http:
      paths:
      - path: /api/v1/auth(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: auth-service
            port:
              number: 3010

      - path: /api/v1/events(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: event-service
            port:
              number: 3011

      - path: /api/v1/reservations(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: reservation-service
            port:
              number: 3013

      - path: /api/v1/payments(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: payment-service
            port:
              number: 3014

      # Queue Service는 별도 LoadBalancer (WebSocket)
```

---

계속해서 Phase 4 (K3s 안정화) 및 Phase 5 (EKS 마이그레이션)를 작성하겠습니다...