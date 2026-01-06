# Kubernetes GitOps Structure with Kustomize

## Overview
Reorganize Kubernetes manifests into Kustomize base + overlays pattern for multi-environment deployment with ArgoCD.

## Directory Structure

```
k8s/
├── base/                           # Common manifests for all environments
│   ├── namespace.yaml
│   ├── backend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   ├── auth-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   ├── ticket-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   ├── payment-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   ├── stats-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   ├── postgres/
│   │   ├── statefulset.yaml      # Only for dev environment
│   │   ├── service.yaml
│   │   ├── pvc.yaml
│   │   └── kustomization.yaml
│   ├── redis/
│   │   ├── statefulset.yaml      # Only for dev environment
│   │   ├── service.yaml
│   │   ├── pvc.yaml
│   │   └── kustomization.yaml
│   └── kustomization.yaml         # Root base kustomization
│
├── overlays/
│   ├── dev/                       # Local Kind development
│   │   ├── namespace.yaml
│   │   ├── configmap.yaml         # Dev-specific config
│   │   ├── secrets.yaml           # Dev secrets (plain text OK)
│   │   ├── ingress.yaml           # Optional: local ingress
│   │   ├── postgres-patch.yaml    # Include postgres for dev
│   │   ├── redis-patch.yaml       # Include redis for dev
│   │   └── kustomization.yaml
│   │
│   ├── staging/                   # AWS EKS staging
│   │   ├── namespace.yaml
│   │   ├── configmap.yaml         # Staging config (RDS/ElastiCache endpoints)
│   │   ├── secrets.yaml           # ENCRYPTED secrets (sealed-secrets)
│   │   ├── ingress.yaml           # ALB ingress
│   │   ├── hpa.yaml               # Horizontal Pod Autoscaler
│   │   ├── resource-patches.yaml  # Medium resource limits
│   │   └── kustomization.yaml
│   │
│   └── prod/                      # AWS EKS production
│       ├── namespace.yaml
│       ├── configmap.yaml         # Prod config (RDS/ElastiCache endpoints)
│       ├── secrets.yaml           # ENCRYPTED secrets (sealed-secrets)
│       ├── ingress.yaml           # ALB ingress with WAF
│       ├── hpa.yaml               # Horizontal Pod Autoscaler
│       ├── pdb.yaml               # Pod Disruption Budget
│       ├── resource-patches.yaml  # High resource limits
│       ├── replicas-patch.yaml    # Higher replica counts
│       └── kustomization.yaml
```

## Base Manifests

### `k8s/base/kustomization.yaml`
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: tiketi

resources:
  - namespace.yaml
  - backend/
  - auth-service/
  - ticket-service/
  - payment-service/
  - stats-service/
  # postgres and redis NOT included in base - only in dev overlay

commonLabels:
  app.kubernetes.io/part-of: tiketi
  app.kubernetes.io/managed-by: argocd

images:
  # Image tags will be updated by CI/CD pipeline
  - name: tiketi-backend
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend
    newTag: latest
  - name: tiketi-auth-service
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-auth-service
    newTag: latest
  - name: tiketi-ticket-service
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-ticket-service
    newTag: latest
  - name: tiketi-payment-service
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-payment-service
    newTag: latest
  - name: tiketi-stats-service
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-stats-service
    newTag: latest
```

### `k8s/base/backend/deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  labels:
    app: backend
    tier: gateway
spec:
  replicas: 1  # Will be overridden by overlays
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
        tier: gateway
    spec:
      containers:
      - name: backend
        image: tiketi-backend:latest  # Kustomize will replace
        ports:
        - containerPort: 5001
        envFrom:
        - configMapRef:
            name: tiketi-config
        - secretRef:
            name: tiketi-secrets
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 5001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5001
          initialDelaySeconds: 10
          periodSeconds: 5
```

### `k8s/base/auth-service/deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  labels:
    app: auth-service
    tier: microservice
spec:
  replicas: 1
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
        tier: microservice
    spec:
      containers:
      - name: auth-service
        image: tiketi-auth-service:latest
        ports:
        - containerPort: 5002
        envFrom:
        - configMapRef:
            name: tiketi-config
        - secretRef:
            name: tiketi-secrets
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 5002
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5002
          initialDelaySeconds: 10
          periodSeconds: 5
```

## Overlay Configurations

### `k8s/overlays/dev/kustomization.yaml`
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: tiketi

bases:
  - ../../base

resources:
  - ../../base/postgres  # Include postgres for dev
  - ../../base/redis     # Include redis for dev

configMapGenerator:
  - name: tiketi-config
    literals:
      - NODE_ENV=development
      - DB_HOST=postgres.tiketi.svc.cluster.local
      - DB_PORT=5432
      - DB_NAME=tiketi
      - DB_USER=tiketi_user
      - REDIS_HOST=redis.tiketi.svc.cluster.local
      - REDIS_PORT=6379
      - BACKEND_URL=http://backend:5001
      - AUTH_SERVICE_URL=http://auth-service:5002
      - TICKET_SERVICE_URL=http://ticket-service:5003
      - PAYMENT_SERVICE_URL=http://payment-service:5004
      - STATS_SERVICE_URL=http://stats-service:5005

secretGenerator:
  - name: tiketi-secrets
    literals:
      - DB_PASSWORD=tiketi_password
      - JWT_SECRET=dev-jwt-secret-key-change-in-production
      - ADMIN_PASSWORD=admin123
      - INTERNAL_API_TOKEN=dev-internal-token

images:
  # Use local Kind images for dev
  - name: tiketi-backend
    newName: tiketi-backend
    newTag: local
  - name: tiketi-auth-service
    newName: tiketi-auth-service
    newTag: local
  - name: tiketi-ticket-service
    newName: tiketi-ticket-service
    newTag: local
  - name: tiketi-payment-service
    newName: tiketi-payment-service
    newTag: local
  - name: tiketi-stats-service
    newName: tiketi-stats-service
    newTag: local

commonLabels:
  environment: development
```

### `k8s/overlays/staging/kustomization.yaml`
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: tiketi-staging

bases:
  - ../../base

resources:
  - ingress.yaml
  - hpa.yaml

configMapGenerator:
  - name: tiketi-config
    literals:
      - NODE_ENV=staging
      - DB_HOST=tiketi-staging.abcdefg.ap-northeast-2.rds.amazonaws.com
      - DB_PORT=5432
      - DB_NAME=tiketi
      - DB_USER=tiketi_user
      - REDIS_HOST=tiketi-staging.abcdefg.cache.amazonaws.com
      - REDIS_PORT=6379
      - BACKEND_URL=http://backend:5001
      - AUTH_SERVICE_URL=http://auth-service:5002
      - TICKET_SERVICE_URL=http://ticket-service:5003
      - PAYMENT_SERVICE_URL=http://payment-service:5004
      - STATS_SERVICE_URL=http://stats-service:5005

secretGenerator:
  - name: tiketi-secrets
    files:
      - secrets.enc.yaml  # Sealed secrets

patchesStrategicMerge:
  - resource-patches.yaml

replicas:
  - name: backend
    count: 2
  - name: auth-service
    count: 2
  - name: ticket-service
    count: 3
  - name: payment-service
    count: 2
  - name: stats-service
    count: 1

images:
  - name: tiketi-backend
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend
    # newTag will be set by CI/CD pipeline
  - name: tiketi-auth-service
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-auth-service
  - name: tiketi-ticket-service
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-ticket-service
  - name: tiketi-payment-service
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-payment-service
  - name: tiketi-stats-service
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-stats-service

commonLabels:
  environment: staging
```

### `k8s/overlays/staging/ingress.yaml`
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-ingress
  annotations:
    # AWS ALB Controller annotations
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:<ACCOUNT_ID>:certificate/<CERT_ID>
    alb.ingress.kubernetes.io/group.name: tiketi-staging
spec:
  rules:
  - host: api-staging.tiketi.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 5001
```

### `k8s/overlays/staging/hpa.yaml`
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
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
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ticket-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ticket-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### `k8s/overlays/staging/resource-patches.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  template:
    spec:
      containers:
      - name: backend
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 1000m
            memory: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ticket-service
spec:
  template:
    spec:
      containers:
      - name: ticket-service
        resources:
          requests:
            cpu: 300m
            memory: 512Mi
          limits:
            cpu: 1500m
            memory: 2Gi
```

### `k8s/overlays/prod/kustomization.yaml`
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: tiketi

bases:
  - ../../base

resources:
  - ingress.yaml
  - hpa.yaml
  - pdb.yaml  # Pod Disruption Budget for HA

configMapGenerator:
  - name: tiketi-config
    literals:
      - NODE_ENV=production
      - DB_HOST=tiketi-prod.abcdefg.ap-northeast-2.rds.amazonaws.com
      - DB_PORT=5432
      - DB_NAME=tiketi
      - DB_USER=tiketi_user
      - REDIS_HOST=tiketi-prod.abcdefg.cache.amazonaws.com
      - REDIS_PORT=6379
      - BACKEND_URL=http://backend:5001
      - AUTH_SERVICE_URL=http://auth-service:5002
      - TICKET_SERVICE_URL=http://ticket-service:5003
      - PAYMENT_SERVICE_URL=http://payment-service:5004
      - STATS_SERVICE_URL=http://stats-service:5005

secretGenerator:
  - name: tiketi-secrets
    files:
      - secrets.enc.yaml  # Sealed secrets (REQUIRED for prod)

patchesStrategicMerge:
  - resource-patches.yaml
  - replicas-patch.yaml

images:
  - name: tiketi-backend
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend
    # newTag will be set by CI/CD pipeline
  - name: tiketi-auth-service
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-auth-service
  - name: tiketi-ticket-service
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-ticket-service
  - name: tiketi-payment-service
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-payment-service
  - name: tiketi-stats-service
    newName: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-stats-service

commonLabels:
  environment: production
```

### `k8s/overlays/prod/pdb.yaml`
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: backend-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: backend
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ticket-service-pdb
spec:
  minAvailable: 3
  selector:
    matchLabels:
      app: ticket-service
```

### `k8s/overlays/prod/replicas-patch.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  replicas: 3
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ticket-service
spec:
  replicas: 5
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
spec:
  replicas: 3
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stats-service
spec:
  replicas: 2
```

## Secrets Management

### Development (k8s/overlays/dev)
- **Plain text secrets** in `kustomization.yaml` (acceptable for local dev)
- Not committed to Git (in `.gitignore`)

### Staging & Production
- **Sealed Secrets** using Bitnami Sealed Secrets Controller
- Encrypted `SealedSecret` resources committed to Git
- Automatically decrypted by controller in cluster

**Example: Creating sealed secret**
```bash
# Install kubeseal CLI
brew install kubeseal

# Create secret
kubectl create secret generic tiketi-secrets \
  --from-literal=DB_PASSWORD='<strong-password>' \
  --from-literal=JWT_SECRET='<random-32-byte-base64>' \
  --from-literal=INTERNAL_API_TOKEN='<random-token>' \
  --dry-run=client -o yaml > secrets.yaml

# Encrypt with kubeseal
kubeseal --format=yaml \
  --cert=pub-cert.pem \
  < secrets.yaml > secrets.enc.yaml

# Commit encrypted version to Git
git add k8s/overlays/prod/secrets.enc.yaml
```

## Testing Kustomize Output

```bash
# Test dev overlay
kustomize build k8s/overlays/dev

# Test staging overlay
kustomize build k8s/overlays/staging

# Test prod overlay
kustomize build k8s/overlays/prod

# Apply to cluster
kubectl apply -k k8s/overlays/dev
kubectl apply -k k8s/overlays/staging
kubectl apply -k k8s/overlays/prod
```

## Migration Plan

### Step 1: Create Base Structure
```bash
mkdir -p k8s/base/{backend,auth-service,ticket-service,payment-service,stats-service,postgres,redis}
```

### Step 2: Move Current Manifests to Base
- Split `deployment.yaml` into individual service deployments
- Move to `k8s/base/<service>/deployment.yaml`
- Create `k8s/base/<service>/service.yaml`
- Create `k8s/base/<service>/kustomization.yaml`

### Step 3: Create Overlays
```bash
mkdir -p k8s/overlays/{dev,staging,prod}
```

### Step 4: Create Environment-Specific Configs
- `kustomization.yaml` for each overlay
- ConfigMaps with environment-specific values
- Secrets (sealed for staging/prod)
- Resource patches for scaling

### Step 5: Validate
```bash
# Build and check output
kustomize build k8s/overlays/dev | kubectl apply --dry-run=client -f -

# Apply to dev
kubectl apply -k k8s/overlays/dev
```

## Next Steps

1. ✅ Complete this design document
2. ⏳ Create base manifests directory structure
3. ⏳ Split current deployments into base manifests
4. ⏳ Create overlay kustomization files
5. ⏳ Test with kustomize build
6. ⏳ Integrate with ArgoCD applications
