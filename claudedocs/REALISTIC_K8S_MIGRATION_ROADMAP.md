# 현실적인 K8s 마이그레이션 로드맵
## EC2 → K8s 학습 중심 접근법

---

## 🎯 전제 조건

**현재 상태**:
- ✅ EC2에 Docker Compose로 배포 완료
- ✅ Frontend (React) + Backend (Node.js) + PostgreSQL + Redis
- ✅ 기본 기능 동작 중

**목표**:
- 🎓 K8s 실전 경험 습득
- 🎓 MSA 개념 이해 (과도한 복잡도 없이)
- 🎓 포트폴리오 강화
- 🎓 취업/이직 준비

---

## 📅 3단계 학습 로드맵

### **1단계: 모놀리식 K8s 마이그레이션** (2주)
**목표**: K8s 핵심 개념 마스터

### **2단계: 경량 MSA 전환** (2-3주)
**목표**: 실용적 MSA 패턴 학습

### **3단계: 고급 기능 추가** (선택, 2주)
**목표**: 심화 기술 스택

---

## 🚀 1단계: 모놀리식 K8s 마이그레이션 (2주)

### Week 1: EKS 클러스터 구축 및 기본 배포

#### Day 1-2: 환경 준비

**1.1 필수 도구 설치**

```bash
# Windows (PowerShell)
# AWS CLI
choco install awscli

# kubectl
choco install kubernetes-cli

# eksctl
choco install eksctl

# Kompose (Docker Compose → K8s 변환)
choco install kompose

# 확인
aws --version
kubectl version --client
eksctl version
kompose version
```

**1.2 현재 Docker Compose 분석**

```bash
cd C:\Users\USER\project-ticketing

# Docker Compose 파일 확인
cat docker-compose.yml

# 현재 구조 파악
# - frontend: React 앱
# - backend: Node.js API
# - postgres: PostgreSQL DB
# - redis: Redis 캐시
```

**1.3 Kompose로 자동 변환**

```bash
# K8s YAML 파일 자동 생성
kompose convert -f docker-compose.yml -o k8s/generated/

# 생성된 파일 확인
ls k8s/generated/
# → frontend-deployment.yaml
# → backend-deployment.yaml
# → postgres-deployment.yaml
# → redis-deployment.yaml
# → frontend-service.yaml
# → backend-service.yaml
# → postgres-service.yaml
# → redis-service.yaml
```

#### Day 3: EKS 클러스터 생성

**1.4 EKS 클러스터 구성**

```bash
# 클러스터 설정 파일 작성
cat > eks-cluster.yaml <<EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: tiketi-cluster
  region: ap-northeast-2

nodeGroups:
  - name: tiketi-nodes
    instanceType: t3.medium
    desiredCapacity: 2
    minSize: 2
    maxSize: 4
    volumeSize: 20
    ssh:
      allow: false

# Managed Add-ons
addons:
  - name: vpc-cni
  - name: coredns
  - name: kube-proxy
EOF

# 클러스터 생성 (15-20분 소요)
eksctl create cluster -f eks-cluster.yaml

# kubeconfig 설정 확인
kubectl get nodes

# 출력:
# NAME                                            STATUS   ROLES    AGE
# ip-192-168-1-10.ap-northeast-2.compute.internal Ready    <none>   1m
# ip-192-168-2-20.ap-northeast-2.compute.internal Ready    <none>   1m
```

#### Day 4-5: 애플리케이션 배포

**1.5 네임스페이스 생성**

```bash
mkdir -p k8s/base

cat > k8s/base/namespace.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: tiketi
EOF

kubectl apply -f k8s/base/namespace.yaml
```

**1.6 ConfigMap & Secrets 작성**

```bash
# ConfigMap (비밀이 아닌 설정)
cat > k8s/base/configmap.yaml <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: tiketi
data:
  NODE_ENV: "production"
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "tiketi"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  CORS_ORIGIN: "https://tiketi.gg"
EOF

# Secrets (비밀번호, 토큰)
cat > k8s/base/secrets.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: tiketi
type: Opaque
stringData:
  DB_USER: "tiketi_user"
  DB_PASSWORD: "<YOUR_DB_PASSWORD>"
  JWT_SECRET: "<YOUR_JWT_SECRET>"
  REDIS_PASSWORD: ""
  AWS_ACCESS_KEY_ID: "<YOUR_AWS_KEY>"
  AWS_SECRET_ACCESS_KEY: "<YOUR_AWS_SECRET>"
EOF

kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/base/secrets.yaml
```

**1.7 PostgreSQL 배포 (StatefulSet)**

```bash
cat > k8s/base/postgres.yaml <<EOF
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
      storage: 10Gi
  storageClassName: gp2
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: tiketi
spec:
  serviceName: postgres-service
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
        image: postgres:15
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_NAME
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
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
  clusterIP: None
EOF

kubectl apply -f k8s/base/postgres.yaml

# 확인
kubectl get pods -n tiketi -l app=postgres
kubectl logs -n tiketi postgres-0
```

**1.8 Redis 배포**

```bash
cat > k8s/base/redis.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: tiketi
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command: ["redis-server"]
        args: ["--appendonly", "yes"]
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: tiketi
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
EOF

kubectl apply -f k8s/base/redis.yaml
```

**1.9 Backend 배포**

```bash
cat > k8s/base/backend.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: tiketi
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: <YOUR_ECR_OR_DOCKERHUB>/tiketi-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: PORT
          value: "3001"
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: NODE_ENV
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_HOST
        - name: DB_NAME
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_NAME
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_USER
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: JWT_SECRET
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: REDIS_HOST
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
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
  - port: 80
    targetPort: 3001
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: tiketi
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
EOF

kubectl apply -f k8s/base/backend.yaml
```

**1.10 Frontend 배포**

```bash
cat > k8s/base/frontend.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: tiketi
spec:
  replicas: 2
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
        image: <YOUR_ECR_OR_DOCKERHUB>/tiketi-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: REACT_APP_API_URL
          value: "https://api.tiketi.gg"
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
  - port: 80
    targetPort: 3000
  type: ClusterIP
EOF

kubectl apply -f k8s/base/frontend.yaml
```

### Week 2: Ingress 및 모니터링

#### Day 1-2: Ingress Controller

**2.1 NGINX Ingress 설치**

```bash
# NGINX Ingress Controller 설치
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/aws/deploy.yaml

# 설치 확인
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx

# LoadBalancer 주소 확인 (AWS ELB 생성됨)
kubectl get svc ingress-nginx-controller -n ingress-nginx
# 출력: EXTERNAL-IP (예: a1b2c3d4...elb.amazonaws.com)
```

**2.2 Ingress 리소스 생성**

```bash
cat > k8s/base/ingress.yaml <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-ingress
  namespace: tiketi
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  # API 서버
  - host: api.tiketi.gg
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 80

  # 프론트엔드
  - host: tiketi.gg
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
EOF

kubectl apply -f k8s/base/ingress.yaml
```

**2.3 도메인 설정 (Route 53)**

```bash
# Ingress LoadBalancer 주소 확인
INGRESS_LB=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo $INGRESS_LB
# 출력: a1b2c3d4...elb.amazonaws.com

# Route 53에 CNAME 레코드 추가:
# tiketi.gg → $INGRESS_LB
# api.tiketi.gg → $INGRESS_LB
```

#### Day 3-4: SSL 인증서

**2.4 Cert-Manager 설치**

```bash
# Cert-Manager 설치
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# 확인
kubectl get pods -n cert-manager
```

**2.5 Let's Encrypt Issuer 생성**

```bash
cat > k8s/base/cluster-issuer.yaml <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@tiketi.gg
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

kubectl apply -f k8s/base/cluster-issuer.yaml
```

**2.6 Ingress에 TLS 추가**

```bash
cat > k8s/base/ingress-tls.yaml <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-ingress
  namespace: tiketi
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - tiketi.gg
    - api.tiketi.gg
    secretName: tiketi-tls
  rules:
  - host: api.tiketi.gg
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 80
  - host: tiketi.gg
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
EOF

kubectl apply -f k8s/base/ingress-tls.yaml

# SSL 인증서 발급 확인 (5분 소요)
kubectl get certificate -n tiketi
```

#### Day 5: 모니터링

**2.7 Prometheus & Grafana 설치**

```bash
# Helm 설치
choco install kubernetes-helm

# Prometheus Stack 설치
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# 확인
kubectl get pods -n monitoring

# Grafana 접속
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# 브라우저에서 http://localhost:3000
# 로그인: admin / prom-operator
```

**2.8 애플리케이션 메트릭 연동**

```javascript
// backend/src/server.js에 이미 있는 메트릭 엔드포인트
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

```yaml
# ServiceMonitor 생성
cat > k8s/base/servicemonitor.yaml <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: backend-metrics
  namespace: tiketi
spec:
  selector:
    matchLabels:
      app: backend
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
EOF

kubectl apply -f k8s/base/servicemonitor.yaml
```

---

## 🎨 2단계: 경량 MSA 전환 (2-3주)

### Week 3: Payment Service 분리

#### 서비스 분리 전략

```
기존 모놀리식:
backend/src/routes/
├── auth.js
├── events.js
├── reservations.js
└── payments.js  ← 이것만 분리

↓

Core Backend (auth, events, reservations 유지)
Payment Service (payments만 독립)
```

**3.1 Payment Service 디렉토리 생성**

```bash
mkdir -p services/payment-service/src/{routes,config,services}
cd services/payment-service

npm init -y

npm install express cors dotenv pg axios winston prom-client
npm install --save-dev nodemon
```

**3.2 기존 코드 복사 및 수정**

```bash
# 기존 파일 복사
cp ../../backend/src/routes/payments.js src/routes/
cp ../../backend/src/config/database.js src/config/
cp ../../backend/src/utils/logger.js src/utils/

# DB 설정 수정 (payments_db 사용)
# src/config/database.js
```

**3.3 Toss Payments SDK 추가**

```bash
npm install @tosspayments/payment-sdk-node

# src/services/toss-client.js 작성 (이전 가이드 참고)
```

**3.4 서비스 간 통신 클라이언트**

```javascript
// src/clients/core-backend-client.js
const axios = require('axios');

class CoreBackendClient {
  constructor() {
    this.baseURL = process.env.CORE_BACKEND_URL || 'http://backend-service.tiketi.svc.cluster.local';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 5000
    });
  }

  async getReservation(reservationId) {
    const response = await this.client.get(`/api/reservations/${reservationId}`);
    return response.data;
  }

  async confirmReservation(reservationId) {
    const response = await this.client.post(`/api/reservations/${reservationId}/confirm`);
    return response.data;
  }
}

module.exports = new CoreBackendClient();
```

**3.5 Payment Service 메인 파일**

```javascript
// src/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const paymentRoutes = require('./routes/payments');
const { logger } = require('./utils/logger');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/payments', paymentRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'payment-service' });
});

app.listen(PORT, () => {
  logger.info(`💳 Payment Service running on port ${PORT}`);
});
```

**3.6 Dockerfile**

```dockerfile
# services/payment-service/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

EXPOSE 3002

CMD ["node", "src/server.js"]
```

**3.7 K8s 배포**

```bash
# 이미지 빌드 및 푸시
cd services/payment-service
docker build -t <YOUR_REGISTRY>/payment-service:latest .
docker push <YOUR_REGISTRY>/payment-service:latest

# K8s 매니페스트
cat > k8s/payment-service.yaml <<EOF
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
      containers:
      - name: payment-service
        image: <YOUR_REGISTRY>/payment-service:latest
        ports:
        - containerPort: 3002
        env:
        - name: TOSS_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: TOSS_SECRET_KEY
        - name: CORE_BACKEND_URL
          value: "http://backend-service.tiketi.svc.cluster.local"
---
apiVersion: v1
kind: Service
metadata:
  name: payment-service
  namespace: tiketi
spec:
  selector:
    app: payment-service
  ports:
  - port: 80
    targetPort: 3002
EOF

kubectl apply -f k8s/payment-service.yaml
```

**3.8 Ingress 업데이트**

```bash
# k8s/base/ingress.yaml에 추가
# ...
  - host: api.tiketi.gg
    http:
      paths:
      - path: /api/payments
        pathType: Prefix
        backend:
          service:
            name: payment-service
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 80

kubectl apply -f k8s/base/ingress.yaml
```

### Week 4: Analytics Service 개발

**4.1 Analytics Service 생성** (이전 가이드 참고)

- 이벤트 수집 API
- Redis 실시간 카운터
- Cron Job 집계
- 통계 조회 API

**4.2 별도 데이터베이스 생성**

```bash
# RDS에 analytics_db 생성
# 또는 K8s에 별도 PostgreSQL StatefulSet
```

### Week 5: Google OAuth 추가

**5.1 Core Backend에 Google OAuth 추가**

```bash
cd backend
npm install passport passport-google-oauth20
```

```javascript
// src/config/passport.js 작성
// src/routes/auth.js에 Google 라우트 추가
```

---

## 🌟 3단계: 고급 기능 (선택, 2주)

### Message Queue (RabbitMQ)

```bash
# RabbitMQ 설치
helm install rabbitmq bitnami/rabbitmq --namespace tiketi

# Payment Service에서 이벤트 발행
await messageQueue.publish('payment.completed', {
  reservationId,
  amount
});

# Analytics Service에서 구독
messageQueue.subscribe('payment.completed', async (data) => {
  await updateStats(data);
});
```

---

## ✅ 최종 체크리스트

### 1단계 완료 시
- [ ] EKS 클러스터 생성
- [ ] Frontend, Backend, DB, Redis 배포
- [ ] Ingress 설정
- [ ] SSL 인증서 발급
- [ ] 모니터링 (Prometheus, Grafana)
- [ ] **동작 확인**: https://tiketi.gg 접속

### 2단계 완료 시
- [ ] Payment Service 분리
- [ ] Analytics Service 개발
- [ ] Google OAuth 추가
- [ ] 서비스 간 통신 확인

### 3단계 완료 시 (선택)
- [ ] Message Queue 추가
- [ ] Circuit Breaker 구현
- [ ] Distributed Tracing

---

## 📊 학습 효과

| 단계 | 배울 수 있는 것 | 포트폴리오 강점 |
|------|----------------|----------------|
| 1단계 | K8s 핵심 개념 | "K8s 배포 경험" |
| 2단계 | MSA 패턴 | "MSA 아키텍처 설계" |
| 3단계 | 고급 패턴 | "분산 시스템 경험" |

---

## 💰 예상 비용

- **EKS 클러스터**: $73/월
- **EC2 노드 (t3.medium × 2)**: $60/월
- **RDS (선택)**: $80/월
- **기타**: $20/월

**총**: $233/월 (₩303,000/월)

**비용 절감**:
- RDS 대신 K8s StatefulSet 사용 → $150/월 절약
- Spot Instance 사용 → 추가 50% 절약

---

**작성일**: 2025-12-05
**작성자**: Claude
