# TIKETI MSA + Kubernetes 마이그레이션 가이드 (Part 4)
## Kubernetes 설정 및 배포 전략

---

## 📋 목차

1. [서비스별 Kubernetes 매니페스트](#1-서비스별-kubernetes-매니페스트)
2. [ConfigMap과 Secret 관리](#2-configmap과-secret-관리)
3. [Ingress 및 Service Mesh](#3-ingress-및-service-mesh)
4. [Auto Scaling 전략](#4-auto-scaling-전략)
5. [배포 전략 (Rolling, Blue-Green, Canary)](#5-배포-전략)
6. [Helm Charts 구성](#6-helm-charts-구성)

---

## 1. 서비스별 Kubernetes 매니페스트

### 1.1 Queue Service (대기열)

```yaml
# queue-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: queue-service
  namespace: production
  labels:
    app: queue-service
    version: v1
spec:
  replicas: 10  # 기본 10개
  selector:
    matchLabels:
      app: queue-service
  template:
    metadata:
      labels:
        app: queue-service
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      # Node Affinity: WebSocket 전용 노드에 배치
      affinity:
        nodeAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            preference:
              matchExpressions:
              - key: workload
                operator: In
                values:
                - websocket

      # Tolerations: Taint 무시
      tolerations:
      - key: workload
        operator: Equal
        value: websocket
        effect: NoSchedule

      containers:
      - name: queue-service
        image: 123456789.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/queue-service:v1.0.0
        ports:
        - name: http
          containerPort: 3000
          protocol: TCP
        - name: websocket
          containerPort: 3000
          protocol: TCP

        # 환경 변수
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: host
        - name: REDIS_PORT
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: port

        # 리소스 제한
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"

        # Health Checks
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2

        # Graceful Shutdown (WebSocket 연결 정리)
        lifecycle:
          preStop:
            exec:
              command:
              - /bin/sh
              - -c
              - |
                # 1. 새 연결 거부
                echo "Stopping accepting new connections..."
                # 2. 기존 연결에 종료 알림
                kill -SIGTERM 1
                # 3. 30초 대기 (연결 정리)
                sleep 30

      # Pod 종료 유예 시간
      terminationGracePeriodSeconds: 60

---
# queue-service/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: queue-service
  namespace: production
  labels:
    app: queue-service
spec:
  type: ClusterIP
  sessionAffinity: ClientIP  # WebSocket 연결 유지
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800  # 3시간
  ports:
  - name: http
    port: 80
    targetPort: 3000
    protocol: TCP
  selector:
    app: queue-service

---
# queue-service/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: queue-service-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: queue-service
  minReplicas: 10
  maxReplicas: 100
  metrics:
  # CPU 기반
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70

  # 메모리 기반
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80

  # 커스텀 메트릭: 대기열 길이
  - type: Pods
    pods:
      metric:
        name: queue_length
      target:
        type: AverageValue
        averageValue: "1000"

  # 커스텀 메트릭: WebSocket 연결 수
  - type: Pods
    pods:
      metric:
        name: websocket_connections
      target:
        type: AverageValue
        averageValue: "5000"

  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60  # 1분 안정화
      policies:
      - type: Percent
        value: 50  # 최대 50% 증가
        periodSeconds: 60
      - type: Pods
        value: 10  # 또는 10개씩 증가
        periodSeconds: 60
      selectPolicy: Max

    scaleDown:
      stabilizationWindowSeconds: 300  # 5분 안정화 (급격한 감소 방지)
      policies:
      - type: Percent
        value: 10  # 최대 10% 감소
        periodSeconds: 60
      - type: Pods
        value: 5  # 또는 5개씩 감소
        periodSeconds: 60
      selectPolicy: Min

---
# queue-service/pdb.yaml (Pod Disruption Budget)
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: queue-service-pdb
  namespace: production
spec:
  minAvailable: 5  # 최소 5개는 항상 유지 (배포 시에도)
  selector:
    matchLabels:
      app: queue-service
```

**왜 이런 설정을 사용하는가?**
```
sessionAffinity: ClientIP
이유: WebSocket 연결은 stateful
→ 같은 사용자가 같은 Pod에 계속 연결되어야 함
→ 다른 Pod로 가면 세션 끊김

terminationGracePeriodSeconds: 60
이유: WebSocket 연결을 graceful하게 종료
→ preStop hook에서 30초 대기
→ 클라이언트가 재연결할 시간 확보
→ 연결 끊김 에러 최소화

PodDisruptionBudget: minAvailable 5
이유: 노드 업그레이드 시에도 최소 5개 유지
→ 서비스 중단 방지
→ 트래픽 급증 시에도 처리 가능
```

### 1.2 Ticket Service (티켓 예약)

```yaml
# ticket-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ticket-service
  namespace: production
spec:
  replicas: 10
  selector:
    matchLabels:
      app: ticket-service
  template:
    metadata:
      labels:
        app: ticket-service
        version: v1
    spec:
      containers:
      - name: ticket-service
        image: 123456789.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/ticket-service:v1.0.0
        ports:
        - containerPort: 3000

        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: DB_HOST
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: DB_PASSWORD
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: host

        resources:
          requests:
            memory: "1Gi"  # 메모리 많이 필요 (DB 연결 풀)
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"

        # DB 연결 준비될 때까지 대기
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - |
              node -e "
              const { Pool } = require('pg');
              const pool = new Pool({
                host: process.env.DB_HOST,
                port: 5432,
                database: 'ticket_db',
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                connectionTimeoutMillis: 3000
              });
              pool.query('SELECT 1')
                .then(() => { process.exit(0); })
                .catch(() => { process.exit(1); });
              "
          initialDelaySeconds: 20
          periodSeconds: 10

        # Slow start (트래픽 점진적 증가)
        lifecycle:
          postStart:
            exec:
              command:
              - /bin/sh
              - -c
              - "sleep 10"  # 10초 워밍업

      # Init Container: DB 마이그레이션
      initContainers:
      - name: db-migration
        image: 123456789.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/ticket-service:v1.0.0
        command:
        - /bin/sh
        - -c
        - |
          echo "Running database migrations..."
          npm run migrate:up
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: DB_HOST
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: DB_PASSWORD

---
# ticket-service/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: ticket-service
  namespace: production
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: ticket-service

---
# ticket-service/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ticket-service-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ticket-service
  minReplicas: 10
  maxReplicas: 50
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
        averageUtilization: 75

  # 커스텀 메트릭: DB 연결 풀 사용률
  - type: Pods
    pods:
      metric:
        name: db_pool_utilization
      target:
        type: AverageValue
        averageValue: "70"  # 70% 사용 시 스케일 아웃
```

**Init Container를 사용하는 이유:**
```
문제: 배포 시 DB 스키마 변경 필요
→ 모든 Pod가 동시에 마이그레이션 실행?
→ 충돌 발생 (CREATE TABLE 중복 실행)

해결: Init Container 사용
→ Pod 시작 전에 1번만 실행
→ Kubernetes Job으로 별도 실행 (더 안전)
→ 마이그레이션 실패 시 Pod 시작 안 함
```

### 1.3 Payment Service (결제)

```yaml
# payment-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
  namespace: production
spec:
  replicas: 5
  selector:
    matchLabels:
      app: payment-service
  template:
    metadata:
      labels:
        app: payment-service
        version: v1
    spec:
      serviceAccountName: payment-service-sa  # AWS IAM Role 연결

      containers:
      - name: payment-service
        image: 123456789.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/payment-service:v1.0.0
        ports:
        - containerPort: 3000

        env:
        - name: NODE_ENV
          value: "production"

        # PG API Key는 Secrets Manager에서 가져옴
        - name: NAVER_PAY_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: payment-secrets
              key: NAVER_PAY_CLIENT_ID
        - name: NAVER_PAY_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: payment-secrets
              key: NAVER_PAY_SECRET_KEY

        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"

        # 외부 API 호출 실패 감지
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 5  # PG API 지연 고려

        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5

---
# payment-service/service-account.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: payment-service-sa
  namespace: production
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT_ID:role/PaymentServiceRole

---
# payment-service/network-policy.yaml (보안 강화)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payment-service-netpol
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: payment-service
  policyTypes:
  - Ingress
  - Egress

  # Ingress: Order Service에서만 호출 가능
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: order-service
    ports:
    - protocol: TCP
      port: 3000

  # Egress: 외부 PG API + DB만 허용
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432

  # 외부 PG API (Naver Pay, Kakao Pay)
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443  # HTTPS만 허용
```

**NetworkPolicy를 사용하는 이유:**
```
결제 서비스는 민감한 정보 처리
→ 불필요한 서비스에서 접근 차단
→ 보안 사고 방지

예: Queue Service에서 Payment Service 직접 호출 차단
→ 반드시 Order Service를 거쳐야 함
→ 비즈니스 로직 보호
```

---

## 2. ConfigMap과 Secret 관리

### 2.1 ConfigMap (비민감 설정)

```yaml
# configmaps/redis-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
  namespace: production
data:
  host: "tiketi-redis.xxxxx.cache.amazonaws.com"
  port: "6379"
  max-retries: "3"
  retry-delay: "1000"

---
# configmaps/app-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
data:
  # Queue 설정
  QUEUE_THRESHOLD: "1000"
  QUEUE_PROCESSING_RATE: "50"

  # Ticket 설정
  SEAT_LOCK_TIMEOUT: "300"  # 5분
  MAX_SEATS_PER_ORDER: "4"

  # 로그 레벨
  LOG_LEVEL: "info"

  # Feature Flags
  FEATURE_SEAT_MAP: "true"
  FEATURE_WAITING_ROOM: "true"
```

### 2.2 Secret (민감 정보)

```yaml
# External Secrets Operator 사용 (AWS Secrets Manager 연동)
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  refreshInterval: 1h  # 1시간마다 자동 갱신
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore

  target:
    name: db-credentials
    creationPolicy: Owner

  data:
  # Ticket DB
  - secretKey: TICKET_DB_HOST
    remoteRef:
      key: tiketi/production/ticket-db
      property: host
  - secretKey: TICKET_DB_PASSWORD
    remoteRef:
      key: tiketi/production/ticket-db
      property: password

  # Order DB
  - secretKey: ORDER_DB_HOST
    remoteRef:
      key: tiketi/production/order-db
      property: host
  - secretKey: ORDER_DB_PASSWORD
    remoteRef:
      key: tiketi/production/order-db
      property: password

---
# external-secrets/secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-2
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets
```

**왜 External Secrets Operator를 사용하는가?**
```
❌ Kubernetes Secret에 직접 저장
문제:
- Git에 암호화된 Secret 커밋 (보안 위험)
- Secret 변경 시 모든 클러스터 업데이트 필요
- 접근 제어 어려움

✅ External Secrets Operator + AWS Secrets Manager
장점:
- Secret이 AWS Secrets Manager에만 존재
- Git에는 참조만 저장 (안전)
- Secret 변경 시 자동 동기화 (1시간마다)
- IAM으로 세밀한 접근 제어
- Secret 버전 관리 및 로테이션
```

---

## 3. Ingress 및 Service Mesh

### 3.1 Ingress (ALB)

```yaml
# ingress/tiketi-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-api
  namespace: production
  annotations:
    # ALB 설정
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip

    # SSL
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:ACCOUNT_ID:certificate/xxx
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'

    # Health Check
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '30'
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
    alb.ingress.kubernetes.io/healthy-threshold-count: '2'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '3'

    # 성능 최적화
    alb.ingress.kubernetes.io/load-balancer-attributes: |
      idle_timeout.timeout_seconds=120,
      routing.http.drop_invalid_header_fields.enabled=true,
      routing.http2.enabled=true

    # WAF 연결
    alb.ingress.kubernetes.io/wafv2-acl-arn: arn:aws:wafv2:ap-northeast-2:ACCOUNT_ID:regional/webacl/tiketi/xxx

    # 태그
    alb.ingress.kubernetes.io/tags: Environment=production,Service=tiketi

spec:
  rules:
  - host: api.tiketi.com
    http:
      paths:
      # User Service
      - path: /api/users
        pathType: Prefix
        backend:
          service:
            name: user-service
            port:
              number: 80

      - path: /api/auth
        pathType: Prefix
        backend:
          service:
            name: user-service
            port:
              number: 80

      # Event Service
      - path: /api/events
        pathType: Prefix
        backend:
          service:
            name: event-service
            port:
              number: 80

      # Queue Service (WebSocket 지원)
      - path: /api/queue
        pathType: Prefix
        backend:
          service:
            name: queue-service
            port:
              number: 80

      # Ticket Service
      - path: /api/tickets
        pathType: Prefix
        backend:
          service:
            name: ticket-service
            port:
              number: 80

      - path: /api/seats
        pathType: Prefix
        backend:
          service:
            name: ticket-service
            port:
              number: 80

      # Order Service
      - path: /api/orders
        pathType: Prefix
        backend:
          service:
            name: order-service
            port:
              number: 80

      # Payment Service (내부 전용, 외부 차단)
      # - /api/payments는 Order Service에서만 호출

      # Admin Service
      - path: /api/admin
        pathType: Prefix
        backend:
          service:
            name: admin-service
            port:
              number: 80
```

### 3.2 Istio Service Mesh (선택 사항, 고급)

```yaml
# Istio 설치 (운영 복잡도 증가, 대규모에서만 권장)
# 초기에는 사용 안 함, 나중에 필요 시 추가

# 장점:
# - 서비스 간 통신 암호화 (mTLS)
# - Circuit Breaker, Retry, Timeout 자동화
# - Traffic Mirroring (카나리 배포)
# - 분산 추적 (Jaeger 통합)

# 단점:
# - 운영 복잡도 높음
# - 리소스 오버헤드 (사이드카 프록시)
# - 초기 학습 곡선

# 추천: 서비스 10개 이하면 사용 안 함
```

---

## 4. Auto Scaling 전략

### 4.1 HPA (Horizontal Pod Autoscaler)

**이미 각 서비스 매니페스트에 포함됨**

### 4.2 VPA (Vertical Pod Autoscaler) - 리소스 최적화

```yaml
# vpa/ticket-service-vpa.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: ticket-service-vpa
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ticket-service

  # 업데이트 모드
  updatePolicy:
    updateMode: "Auto"  # Auto, Recreate, Initial, Off

  # 리소스 정책
  resourcePolicy:
    containerPolicies:
    - containerName: ticket-service
      minAllowed:
        cpu: 250m
        memory: 512Mi
      maxAllowed:
        cpu: 2000m
        memory: 4Gi
      controlledResources:
      - cpu
      - memory
```

**HPA vs VPA:**
```
HPA (Horizontal):
- Pod 개수 조절
- CPU/메모리 사용률 기반
- 빠른 확장 (1분 이내)
- 권장 사용

VPA (Vertical):
- Pod 리소스 크기 조절
- 실제 사용량 기반
- Pod 재시작 필요 (다운타임)
- 초기 리소스 설정용

추천: HPA 사용, VPA는 모니터링 모드로만
```

### 4.3 Cluster Autoscaler (노드 확장)

**Part 3에서 설정 완료**

---

## 5. 배포 전략

### 5.1 Rolling Update (기본)

```yaml
# deployment.yaml에 설정
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1  # 최대 1개까지 unavailable
      maxSurge: 2        # 최대 2개 추가 생성 (총 12개)

# 배포 과정:
# 1. 새 Pod 2개 생성 (v1.1)
# 2. 새 Pod 준비 완료 (readinessProbe 통과)
# 3. 기존 Pod 1개 종료 (v1.0)
# 4. 새 Pod 1개 생성 (v1.1)
# 5. 반복...
# 6. 모든 Pod가 v1.1로 교체 완료
```

**장점:**
- 다운타임 없음
- 점진적 배포 (문제 조기 발견)

**단점:**
- 배포 시간 길음 (10개 Pod → 5-10분)
- 두 버전 동시 실행 (호환성 필요)

### 5.2 Blue-Green Deployment

```yaml
# blue-green/blue-deployment.yaml (현재 버전)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ticket-service-blue
  namespace: production
spec:
  replicas: 10
  selector:
    matchLabels:
      app: ticket-service
      version: blue
  template:
    metadata:
      labels:
        app: ticket-service
        version: blue
    spec:
      containers:
      - name: ticket-service
        image: tiketi/ticket-service:v1.0.0
        # ...

---
# blue-green/green-deployment.yaml (새 버전)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ticket-service-green
  namespace: production
spec:
  replicas: 10
  selector:
    matchLabels:
      app: ticket-service
      version: green
  template:
    metadata:
      labels:
        app: ticket-service
        version: green
    spec:
      containers:
      - name: ticket-service
        image: tiketi/ticket-service:v1.1.0
        # ...

---
# blue-green/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: ticket-service
  namespace: production
spec:
  selector:
    app: ticket-service
    version: blue  # ← 이 값만 변경하면 즉시 전환
  ports:
  - port: 80
    targetPort: 3000

# 배포 과정:
# 1. Green Deployment 생성 (새 버전)
# 2. Green Pod들이 모두 Ready 상태 대기
# 3. Service selector를 blue → green으로 변경
# 4. 즉시 트래픽이 Green으로 전환 (1초 이내)
# 5. 문제 발생 시 selector를 green → blue로 롤백
# 6. Blue Deployment 삭제
```

**장점:**
- 즉시 전환 (1초)
- 즉시 롤백 가능
- 두 버전 완전 격리

**단점:**
- 리소스 2배 필요 (비용 증가)
- 데이터베이스 마이그레이션 복잡

### 5.3 Canary Deployment (가장 안전)

```yaml
# canary/ticket-service-stable.yaml (안정 버전 90%)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ticket-service-stable
  namespace: production
spec:
  replicas: 9  # 90%
  selector:
    matchLabels:
      app: ticket-service
      track: stable
  template:
    metadata:
      labels:
        app: ticket-service
        track: stable
        version: v1.0.0
    spec:
      containers:
      - name: ticket-service
        image: tiketi/ticket-service:v1.0.0

---
# canary/ticket-service-canary.yaml (카나리 버전 10%)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ticket-service-canary
  namespace: production
spec:
  replicas: 1  # 10%
  selector:
    matchLabels:
      app: ticket-service
      track: canary
  template:
    metadata:
      labels:
        app: ticket-service
        track: canary
        version: v1.1.0
    spec:
      containers:
      - name: ticket-service
        image: tiketi/ticket-service:v1.1.0

---
# canary/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: ticket-service
  namespace: production
spec:
  selector:
    app: ticket-service  # track 라벨 없음 → 둘 다 선택
  ports:
  - port: 80
    targetPort: 3000

# 배포 과정:
# 1. Canary 1개 Pod 배포 (10% 트래픽)
# 2. 30분 모니터링 (에러율, 응답 시간)
# 3. 문제 없으면 Canary 2개로 증가 (20%)
# 4. 1시간 모니터링
# 5. 문제 없으면 Canary 5개로 증가 (50%)
# 6. 2시간 모니터링
# 7. 문제 없으면 Canary 10개로 증가 (100%)
# 8. Stable Deployment 삭제
```

**Flagger로 자동화 (ArgoCD Rollouts):**
```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: ticket-service
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ticket-service
  service:
    port: 80

  # 분석 설정
  analysis:
    interval: 1m
    threshold: 10  # 10회 연속 성공 시 진행
    maxWeight: 50  # 최대 50% 트래픽
    stepWeight: 10  # 10%씩 증가

    metrics:
    - name: request-success-rate
      thresholdRange:
        min: 99  # 99% 이상 성공률
      interval: 1m

    - name: request-duration
      thresholdRange:
        max: 500  # 500ms 이하 응답 시간
      interval: 1m

  # 카나리 단계
  canaryAnalysis:
    - interval: 5m
      threshold: 5
      stepWeight: 10
    - interval: 10m
      threshold: 5
      stepWeight: 20
    - interval: 15m
      threshold: 5
      stepWeight: 50
```

---

## 6. Helm Charts 구성

### 6.1 Helm Chart 구조

```
charts/
├── tiketi/  (Umbrella Chart)
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── values-production.yaml
│   ├── values-staging.yaml
│   └── charts/
│       ├── queue-service/
│       ├── ticket-service/
│       ├── event-service/
│       └── ...
│
└── queue-service/  (개별 Chart)
    ├── Chart.yaml
    ├── values.yaml
    ├── templates/
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   ├── hpa.yaml
    │   ├── configmap.yaml
    │   └── _helpers.tpl
    └── .helmignore
```

### 6.2 Umbrella Chart 예시

```yaml
# charts/tiketi/Chart.yaml
apiVersion: v2
name: tiketi
description: TIKETI Microservices Platform
version: 1.0.0
appVersion: "1.0.0"

dependencies:
- name: queue-service
  version: 1.0.0
  repository: "file://../queue-service"
  condition: queue-service.enabled

- name: ticket-service
  version: 1.0.0
  repository: "file://../ticket-service"
  condition: ticket-service.enabled

- name: event-service
  version: 1.0.0
  repository: "file://../event-service"
  condition: event-service.enabled

# ... 다른 서비스들

---
# charts/tiketi/values.yaml
global:
  environment: production
  region: ap-northeast-2
  imageRegistry: 123456789.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi

  redis:
    host: tiketi-redis.xxxxx.cache.amazonaws.com
    port: 6379

  monitoring:
    enabled: true
    prometheus:
      enabled: true
    grafana:
      enabled: true

queue-service:
  enabled: true
  replicaCount: 10
  image:
    tag: "v1.0.0"
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi
  autoscaling:
    enabled: true
    minReplicas: 10
    maxReplicas: 100

ticket-service:
  enabled: true
  replicaCount: 10
  # ...
```

### 6.3 개별 서비스 Chart

```yaml
# charts/queue-service/values.yaml
replicaCount: 10

image:
  repository: queue-service
  tag: "latest"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 10
  maxReplicas: 100
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

env:
  NODE_ENV: production
  LOG_LEVEL: info

---
# charts/queue-service/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "queue-service.fullname" . }}
  namespace: {{ .Values.global.namespace | default "production" }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "queue-service.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "queue-service.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.global.imageRegistry }}/{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        ports:
        - containerPort: {{ .Values.service.targetPort }}
        env:
        - name: NODE_ENV
          value: {{ .Values.env.NODE_ENV }}
        - name: REDIS_HOST
          value: {{ .Values.global.redis.host }}
        resources:
          {{- toYaml .Values.resources | nindent 12 }}
```

### 6.4 배포 명령어

```bash
# 1. Helm 설치 (로컬)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 2. 의존성 업데이트
cd charts/tiketi
helm dependency update

# 3. Dry-run (검증)
helm install tiketi . --dry-run --debug -f values-production.yaml

# 4. 실제 배포
helm install tiketi . -f values-production.yaml --namespace production --create-namespace

# 5. 업그레이드
helm upgrade tiketi . -f values-production.yaml --namespace production

# 6. 롤백
helm rollback tiketi 1 --namespace production

# 7. 특정 서비스만 업그레이드
helm upgrade tiketi . --set queue-service.image.tag=v1.1.0 --reuse-values

# 8. 삭제
helm uninstall tiketi --namespace production
```

---

## 다음 단계

Kubernetes 설정을 완료했습니다. 이제 실제 마이그레이션 단계별 가이드로 넘어갑니다.

👉 **[Part 5: 마이그레이션 단계별 가이드로 이동](./msa-migration-guide-05-migration-steps.md)**
