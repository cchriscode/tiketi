# TIKETI MSA + Kubernetes 마이그레이션 가이드 (Part 6)
## 모니터링, 비용 최적화 및 운영 전략

---

## 📋 목차

1. [모니터링 아키텍처](#1-모니터링-아키텍처)
2. [핵심 메트릭 및 알람 설정](#2-핵심-메트릭-및-알람-설정)
3. [분산 추적 및 로깅](#3-분산-추적-및-로깅)
4. [비용 최적화 전략](#4-비용-최적화-전략)
5. [SRE 및 운영 Best Practices](#5-sre-및-운영-best-practices)
6. [예상 비용 및 ROI 분석](#6-예상-비용-및-roi-분석)

---

## 1. 모니터링 아키텍처

### 1.1 4-Layer 모니터링 전략

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Infrastructure (인프라 레벨)                    │
├─────────────────────────────────────────────────────────┤
│ - EC2 CPU, Memory, Disk, Network                        │
│ - RDS Connections, IOPS, Storage                        │
│ - ElastiCache Memory, CPU, Evictions                    │
│ - EKS Control Plane Health                              │
│ 도구: CloudWatch, Node Exporter                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Layer 2: Container & Kubernetes (컨테이너 레벨)          │
├─────────────────────────────────────────────────────────┤
│ - Pod CPU, Memory 사용률                                 │
│ - Deployment Rollout 상태                                │
│ - HPA Scaling 이벤트                                     │
│ - Node 리소스 압박 상태                                  │
│ 도구: Prometheus, kube-state-metrics                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Layer 3: Application (애플리케이션 레벨)                 │
├─────────────────────────────────────────────────────────┤
│ - HTTP 요청 수, 응답 시간, 에러율                        │
│ - 비즈니스 메트릭 (예약 수, 결제 성공률)                │
│ - Queue 길이, WebSocket 연결 수                          │
│ - DB Query 성능, Connection Pool 사용률                  │
│ 도구: Prometheus + Custom Metrics                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Layer 4: User Experience (사용자 경험)                   │
├─────────────────────────────────────────────────────────┤
│ - Real User Monitoring (RUM)                            │
│ - Frontend 페이지 로딩 시간                              │
│ - JavaScript 에러율                                      │
│ - Synthetic Monitoring (Pingdom, Datadog)               │
│ 도구: CloudWatch RUM, Google Analytics                   │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Prometheus + Grafana 스택 구성

```yaml
# prometheus/prometheus-values.yaml (Helm)
prometheus:
  prometheusSpec:
    # 데이터 보존 기간
    retention: 15d
    retentionSize: "50GB"

    # 스토리지 (EBS)
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 100Gi

    # Scrape 설정
    scrapeInterval: 30s
    evaluationInterval: 30s

    # Service Discovery (Kubernetes 자동 감지)
    serviceMonitorSelector:
      matchLabels:
        prometheus: tiketi

    # Remote Write (장기 보관용)
    remoteWrite:
    - url: https://aps-workspaces.ap-northeast-2.amazonaws.com/workspaces/ws-xxxxx/api/v1/remote_write
      sigv4:
        region: ap-northeast-2

# ServiceMonitor for Queue Service
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: queue-service
  namespace: production
  labels:
    prometheus: tiketi
spec:
  selector:
    matchLabels:
      app: queue-service
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

```bash
# Prometheus 설치
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  -f prometheus/prometheus-values.yaml \
  -n monitoring --create-namespace

# Grafana 접속
kubectl port-forward svc/prometheus-grafana -n monitoring 3000:80
# admin / prom-operator (기본 비밀번호)
```

### 1.3 Grafana 대시보드

```json
// dashboards/tiketi-overview.json
{
  "dashboard": {
    "title": "TIKETI - Service Overview",
    "panels": [
      {
        "title": "Request Rate (RPS)",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (service)"
          }
        ]
      },
      {
        "title": "P99 Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Error Rate (%)",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100"
          }
        ]
      },
      {
        "title": "Pod CPU Usage",
        "targets": [
          {
            "expr": "sum(rate(container_cpu_usage_seconds_total[5m])) by (pod)"
          }
        ]
      },
      {
        "title": "Queue Length",
        "targets": [
          {
            "expr": "tiketi_queue_length"
          }
        ]
      },
      {
        "title": "Active WebSocket Connections",
        "targets": [
          {
            "expr": "tiketi_websocket_connections"
          }
        ]
      },
      {
        "title": "DB Connection Pool Utilization",
        "targets": [
          {
            "expr": "tiketi_db_pool_utilization"
          }
        ]
      },
      {
        "title": "Reservations per Minute",
        "targets": [
          {
            "expr": "rate(tiketi_reservations_total[1m]) * 60"
          }
        ]
      }
    ]
  }
}
```

---

## 2. 핵심 메트릭 및 알람 설정

### 2.1 Golden Signals (SRE)

```yaml
# alerts/golden-signals.yaml
groups:
- name: golden-signals
  interval: 30s
  rules:

  # 1. Latency (지연시간)
  - alert: HighLatency
    expr: |
      histogram_quantile(0.99,
        rate(http_request_duration_seconds_bucket[5m])
      ) > 1
    for: 5m
    labels:
      severity: warning
      team: backend
    annotations:
      summary: "High latency detected"
      description: "P99 latency is {{ $value }}s (threshold: 1s)"

  # 2. Traffic (트래픽)
  - alert: TrafficSpike
    expr: |
      rate(http_requests_total[5m]) >
      avg_over_time(rate(http_requests_total[5m])[1h:5m]) * 2
    for: 10m
    labels:
      severity: info
      team: backend
    annotations:
      summary: "Traffic spike detected"
      description: "Traffic is 2x higher than usual"

  # 3. Errors (에러율)
  - alert: HighErrorRate
    expr: |
      sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
      /
      sum(rate(http_requests_total[5m])) by (service)
      > 0.05
    for: 5m
    labels:
      severity: critical
      team: backend
    annotations:
      summary: "High error rate on {{ $labels.service }}"
      description: "Error rate is {{ $value | humanizePercentage }}"

  # 4. Saturation (리소스 포화)
  - alert: HighCPUSaturation
    expr: |
      avg(rate(container_cpu_usage_seconds_total[5m])) by (pod) > 0.9
    for: 10m
    labels:
      severity: warning
      team: infra
    annotations:
      summary: "High CPU usage on {{ $labels.pod }}"
      description: "CPU usage is {{ $value | humanizePercentage }}"
```

### 2.2 비즈니스 메트릭 알람

```yaml
# alerts/business-metrics.yaml
groups:
- name: business-metrics
  interval: 1m
  rules:

  # 예약 실패율
  - alert: HighReservationFailureRate
    expr: |
      rate(tiketi_reservation_failures_total[5m])
      /
      rate(tiketi_reservation_attempts_total[5m])
      > 0.1
    for: 5m
    labels:
      severity: critical
      team: business
    annotations:
      summary: "High reservation failure rate"
      description: "{{ $value | humanizePercentage }} of reservations are failing"

  # 결제 실패율
  - alert: HighPaymentFailureRate
    expr: |
      rate(tiketi_payment_failures_total[5m])
      /
      rate(tiketi_payment_attempts_total[5m])
      > 0.05
    for: 3m
    labels:
      severity: critical
      team: business
    annotations:
      summary: "High payment failure rate"
      description: "Losing revenue: {{ $value | humanizePercentage }} failures"

  # Queue 과부하
  - alert: QueueOverloaded
    expr: tiketi_queue_length > 10000
    for: 5m
    labels:
      severity: warning
      team: backend
    annotations:
      summary: "Queue is overloaded"
      description: "Queue length: {{ $value }} users waiting"
```

### 2.3 AlertManager 설정

```yaml
# alertmanager/alertmanager-config.yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX'

route:
  receiver: 'default'
  group_by: ['alertname', 'cluster']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
  # Critical alerts → Slack + PagerDuty
  - match:
      severity: critical
    receiver: 'critical-alerts'
    continue: true

  # Warning alerts → Slack only
  - match:
      severity: warning
    receiver: 'warning-alerts'

receivers:
- name: 'default'
  slack_configs:
  - channel: '#tiketi-alerts'
    title: 'Alert: {{ .GroupLabels.alertname }}'
    text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

- name: 'critical-alerts'
  slack_configs:
  - channel: '#tiketi-critical'
    title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
    text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
  pagerduty_configs:
  - service_key: 'PAGERDUTY_SERVICE_KEY'
    description: '{{ .GroupLabels.alertname }}'

- name: 'warning-alerts'
  slack_configs:
  - channel: '#tiketi-warnings'
    title: '⚠️ Warning: {{ .GroupLabels.alertname }}'
    text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

---

## 3. 분산 추적 및 로깅

### 3.1 Jaeger (분산 추적)

```yaml
# jaeger/jaeger-operator.yaml
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: tiketi-jaeger
  namespace: monitoring
spec:
  strategy: production

  storage:
    type: elasticsearch
    elasticsearch:
      nodeCount: 3
      storage:
        size: 100Gi

  collector:
    replicas: 3
    resources:
      requests:
        cpu: 500m
        memory: 1Gi

  query:
    replicas: 2
```

**애플리케이션 코드에 추적 추가:**
```javascript
// services/ticket-service/src/tracing.js
const { initTracer } = require('jaeger-client');

const config = {
  serviceName: 'ticket-service',
  sampler: {
    type: 'probabilistic',
    param: 0.1  // 10% 샘플링
  },
  reporter: {
    agentHost: process.env.JAEGER_AGENT_HOST,
    agentPort: 6831
  }
};

const tracer = initTracer(config);

// Express 미들웨어
const tracingMiddleware = (req, res, next) => {
  const span = tracer.startSpan('http_request');
  span.setTag('http.method', req.method);
  span.setTag('http.url', req.url);

  res.on('finish', () => {
    span.setTag('http.status_code', res.statusCode);
    span.finish();
  });

  req.span = span;
  next();
};

// DB 쿼리 추적
async function queryWithTracing(sql, params, parentSpan) {
  const span = tracer.startSpan('db_query', { childOf: parentSpan });
  span.setTag('db.statement', sql);

  try {
    const result = await pool.query(sql, params);
    span.setTag('db.rows', result.rowCount);
    return result;
  } catch (error) {
    span.setTag('error', true);
    span.log({ event: 'error', message: error.message });
    throw error;
  } finally {
    span.finish();
  }
}
```

### 3.2 로그 집계 (Loki + Promtail)

```yaml
# loki/loki-stack-values.yaml
loki:
  persistence:
    enabled: true
    size: 50Gi
  config:
    schema_config:
      configs:
      - from: 2024-01-01
        store: boltdb-shipper
        object_store: s3
        schema: v11
        index:
          prefix: loki_index_
          period: 24h
    storage_config:
      boltdb_shipper:
        active_index_directory: /data/loki/index
        cache_location: /data/loki/cache
      aws:
        s3: s3://ap-northeast-2/tiketi-logs
        bucketnames: tiketi-logs

promtail:
  config:
    clients:
    - url: http://loki:3100/loki/api/v1/push
    snippets:
      pipelineStages:
      - json:
          expressions:
            level: level
            msg: msg
            trace_id: trace_id
      - labels:
          level:
          trace_id:
```

**구조화된 로깅:**
```javascript
// services/queue-service/src/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'queue-service',
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.Console()
  ]
});

// 사용 예시
logger.info('User entered queue', {
  user_id: userId,
  event_id: eventId,
  queue_position: position,
  trace_id: req.span.context().toTraceId()
});

logger.error('Failed to process queue entry', {
  user_id: userId,
  error: error.message,
  stack: error.stack,
  trace_id: req.span.context().toTraceId()
});
```

---

## 4. 비용 최적화 전략

### 4.1 현재 비용 예측 (월 기준)

```
┌────────────────────────────────────────────────────────┐
│ 평시 (일 평균 5,000 동시 접속)                          │
├────────────────────────────────────────────────────────┤
│ EKS Control Plane         $72   (고정)                 │
│ EC2 Nodes (m6i.xlarge×10) $1,440                       │
│ RDS (db.r6g.xlarge)       $520                         │
│ RDS Read Replica (×1)     $260                         │
│ ElastiCache (r6g.large×3) $450                         │
│ ALB                       $30                          │
│ NAT Gateway (×2)          $90                          │
│ S3 + CloudFront           $50                          │
│ Data Transfer             $100                         │
│ Monitoring (Prometheus)   $50                          │
│ Backup Storage            $30                          │
├────────────────────────────────────────────────────────┤
│ Total:                    $3,092/month                 │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ 피크 타임 (100,000 동시 접속, 월 10시간)                │
├────────────────────────────────────────────────────────┤
│ EKS Control Plane         $72   (고정)                 │
│ EC2 Nodes (m6i.xlarge×50) $7,200 (Auto Scaling)        │
│ RDS (db.r6g.2xlarge)      $1,040 (수직 확장)            │
│ RDS Read Replica (×3)     $780                         │
│ ElastiCache (r6g.xlarge×6)$1,800                       │
│ ALB                       $100                         │
│ NAT Gateway (×2)          $200                         │
│ S3 + CloudFront           $200                         │
│ Data Transfer             $500                         │
│ Monitoring                $100                         │
├────────────────────────────────────────────────────────┤
│ Total (10시간):           $12,000                       │
│ 시간당:                   $1,200                        │
│ 월 평균 추가:             $400 (피크 10시간 기준)        │
└────────────────────────────────────────────────────────┘

최종 월 비용: $3,492 (평시) + $400 (피크) = $3,892
```

### 4.2 비용 절감 전략

#### Strategy 1: Spot 인스턴스 (30-70% 절감)

```yaml
# eks/node-groups.yaml
- name: spot-nodes
  instanceTypes:
    - m6i.xlarge
    - m6i.2xlarge
    - m5.xlarge
    - m5.2xlarge
  capacityType: SPOT
  desiredCapacity: 5
  minSize: 0
  maxSize: 30

  labels:
    workload: batch
    capacity-type: spot

  taints:
  - key: spot
    value: "true"
    effect: NoSchedule

# 비용 절감: $1,440 → $500 (65% 절감)
# 주의: 중요하지 않은 워크로드에만 사용 (배치 작업, 개발 환경)
```

#### Strategy 2: Savings Plans & Reserved Instances

```bash
# 1년 약정 (일부 예약)으로 추가 20-30% 절감

# RDS Reserved Instance (1년)
원가: $520/month
RI 가격: $364/month (30% 절감)
절감액: $156/month = $1,872/year

# EC2 Savings Plan (1년, 코어 10대 예약)
원가: $1,440/month
SP 가격: $1,000/month (30% 절감)
절감액: $440/month = $5,280/year

총 절감: $7,152/year
```

#### Strategy 3: Auto Scaling 최적화

```javascript
// Scale Down 적극적 설정
behavior:
  scaleDown:
    stabilizationWindowSeconds: 60  // 300 → 60 (더 빨리 축소)
    policies:
    - type: Percent
      value: 50  // 10 → 50 (더 빠르게 축소)
      periodSeconds: 60

// 야간 시간대 최소 Replica 축소
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: queue-service-hpa-night
spec:
  minReplicas: 3  # 주간 10 → 야간 3
  maxReplicas: 20
  schedule:
    - schedule: "0 1 * * *"  # 새벽 1시
      minReplicas: 3
    - schedule: "0 9 * * *"  # 오전 9시
      minReplicas: 10

# 예상 절감: 야간 8시간 × 30일 = 240시간
# 7개 Pod 절감 × $0.15/hour = $252/month
```

#### Strategy 4: Database 최적화

```sql
-- 1. Read Replica를 RDS Proxy로 교체
-- 기존: RDS Read Replica 3대 = $780/month
-- 신규: RDS Proxy 1대 = $50/month + DCU 비용
-- 절감: ~$600/month (트래픽에 따라 다름)

-- 2. ElastiCache 노드 축소
-- Cluster Mode에서 샤드 축소 (3 → 2)
-- 절감: $450/month → $300/month = $150 절감
```

#### Strategy 5: S3 Lifecycle 정책

```yaml
# s3/lifecycle-policy.json
{
  "Rules": [
    {
      "Id": "move-to-ia",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"  # 30일 후 IA로 이동 (50% 저렴)
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"  # 90일 후 Glacier (80% 저렴)
        }
      ]
    },
    {
      "Id": "delete-old-logs",
      "Status": "Enabled",
      "Expiration": {
        "Days": 365  # 1년 후 삭제
      },
      "Filter": {
        "Prefix": "logs/"
      }
    }
  ]
}

# 예상 절감: 로그 스토리지 $100/month → $30/month = $70 절감
```

### 4.3 최종 최적화 비용

```
원래 비용: $3,892/month

절감 내역:
- Spot 인스턴스 (비중요 워크로드): -$440/month
- Savings Plans (1년 약정): -$596/month
- Auto Scaling 최적화: -$252/month
- Database 최적화: -$750/month
- S3 Lifecycle: -$70/month
─────────────────────────────
총 절감: -$2,108/month (54% 절감)

최종 비용: $1,784/month
```

---

## 5. SRE 및 운영 Best Practices

### 5.1 SLI / SLO / SLA 정의

```yaml
# SLI (Service Level Indicators) - 측정 지표
sli:
  availability:
    metric: sum(up{job="tiketi-services"}) / count(up{job="tiketi-services"})
    target: 0.999  # 99.9%

  latency:
    metric: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
    target: 0.5  # 500ms

  error_rate:
    metric: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
    target: 0.01  # 1%

# SLO (Service Level Objectives) - 목표
slo:
  - name: "API Availability"
    target: 99.9%
    window: 30d
    description: "99.9% of API requests succeed in a 30-day window"

  - name: "P99 Latency"
    target: 500ms
    window: 30d
    description: "99% of requests complete within 500ms"

  - name: "Error Budget"
    calculation: (1 - 0.999) × 30 days = 43 minutes downtime allowed
    alert_threshold: 50%  # Error budget 50% 소진 시 알람

# SLA (Service Level Agreement) - 고객 약속
sla:
  availability: 99.5%  # SLO보다 낮게 설정
  compensation:
    - threshold: 99.5%
      refund: 0%
    - threshold: 99.0%
      refund: 10%
    - threshold: 95.0%
      refund: 25%
```

### 5.2 On-Call 및 Incident Response

```yaml
# pagerduty/escalation-policy.yaml
escalation_policies:
  - name: "TIKETI Production"
    escalation_rules:
      - escalation_delay_in_minutes: 0
        targets:
          - type: user
            id: primary_oncall  # 1차 담당자

      - escalation_delay_in_minutes: 15
        targets:
          - type: user
            id: secondary_oncall  # 2차 담당자 (15분 후)

      - escalation_delay_in_minutes: 30
        targets:
          - type: user
            id: engineering_manager  # 관리자 (30분 후)

    schedules:
      - name: "Primary On-Call"
        time_zone: "Asia/Seoul"
        layers:
          - start: "2024-12-02T09:00:00"
            rotation_virtual_start: "2024-12-02T09:00:00"
            rotation_turn_length_seconds: 604800  # 1주일
            users:
              - user: alice
              - user: bob
              - user: charlie
```

**Incident Runbook 예시:**
```markdown
# Incident: High Error Rate on Ticket Service

## Severity: P1 (Critical)

## Detection
- Alert: HighErrorRate (>5% for 5 minutes)
- Symptoms: Users unable to reserve seats

## Investigation Steps
1. Check Grafana dashboard: Ticket Service Overview
2. Query Prometheus:
   ```
   rate(http_requests_total{service="ticket-service",status=~"5.."}[5m])
   ```
3. Check logs in Loki:
   ```
   {service="ticket-service"} |= "error"
   ```
4. Check Jaeger traces for failed requests

## Common Causes & Solutions

### Cause 1: Database Connection Pool Exhausted
- Symptom: Logs show "connection timeout"
- Solution: Scale up Pods
  ```
  kubectl scale deployment ticket-service --replicas=20 -n production
  ```

### Cause 2: Slow Query
- Symptom: RDS Performance Insights shows high wait time
- Solution: Kill slow query
  ```
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query_start < now() - interval '30 seconds';
  ```

### Cause 3: Redis Down
- Symptom: Connection refused to ElastiCache
- Solution: Failover to standby
  ```
  aws elasticache test-failover --replication-group-id tiketi-redis --node-group-id 0001
  ```

## Rollback Plan
1. Rollback to previous version:
   ```
   kubectl rollout undo deployment/ticket-service -n production
   ```
2. Route traffic to Monolith (emergency):
   ```
   kubectl patch virtualservice tiketi-route --type merge -p '{"spec":{"http":[{"route":[{"destination":{"host":"monolith"},"weight":100}]}]}}'
   ```

## Post-Incident
- [ ] Root cause analysis in Notion
- [ ] Update runbook with new learnings
- [ ] Create Jira ticket for permanent fix
```

### 5.3 Chaos Engineering (고급)

```yaml
# chaos/experiment-pod-failure.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: ticket-service-pod-failure
  namespace: production
spec:
  action: pod-failure
  mode: one
  selector:
    namespaces:
      - production
    labelSelectors:
      app: ticket-service
  duration: "30s"
  scheduler:
    cron: "@every 24h"  # 매일 1번 실행

---
# chaos/experiment-network-delay.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: db-latency
  namespace: production
spec:
  action: delay
  mode: all
  selector:
    namespaces:
      - production
    labelSelectors:
      app: ticket-service
  delay:
    latency: "100ms"
    correlation: "100"
  duration: "5m"
  direction: to
  target:
    mode: all
    selector:
      namespaces:
        - production
      labelSelectors:
        app: postgres

# 목적: DB 지연 시 서비스 동작 확인
# 예상 결과: Timeout 발생, Circuit Breaker 작동
```

---

## 6. 예상 비용 및 ROI 분석

### 6.1 Total Cost of Ownership (TCO)

```
┌─────────────────────────────────────────────────────────┐
│ 현재 (Monolith on EC2)                                  │
├─────────────────────────────────────────────────────────┤
│ EC2 (t3.2xlarge)          $300/month                    │
│ RDS (db.t3.large)         $150/month                    │
│ ElastiCache (t3.medium)   $50/month                     │
│ Data Transfer             $30/month                     │
│ Backup                    $20/month                     │
├─────────────────────────────────────────────────────────┤
│ 인프라 비용:              $550/month                     │
│                                                          │
│ 운영 비용 (엔지니어 1명):  $5,000/month                  │
│ - 수동 배포               20h/month × $50/h = $1,000    │
│ - 장애 대응               30h/month × $100/h = $3,000   │
│ - 모니터링 관리           20h/month × $50/h = $1,000    │
├─────────────────────────────────────────────────────────┤
│ Total TCO:                $5,550/month                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ MSA + Kubernetes (최적화 후)                            │
├─────────────────────────────────────────────────────────┤
│ 인프라 비용:              $1,784/month (앞서 계산)       │
│                                                          │
│ 운영 비용 (엔지니어 0.5명): $2,000/month                 │
│ - 자동 배포 (GitOps)      5h/month × $50/h = $250       │
│ - 자동 복구 (K8s)         10h/month × $100/h = $1,000   │
│ - 대시보드 확인           15h/month × $50/h = $750       │
├─────────────────────────────────────────────────────────┤
│ Total TCO:                $3,784/month                   │
└─────────────────────────────────────────────────────────┘

월 절감: $5,550 - $3,784 = $1,766/month
연 절감: $21,192/year
```

### 6.2 처리 용량 대비 비용

```
Monolith:
- 최대 동시 접속: 10,000명
- 월 비용: $5,550
- 사용자당 비용: $0.555

MSA + K8s:
- 최대 동시 접속: 300,000명 (30배)
- 월 비용: $3,784 (평시 기준)
- 사용자당 비용: $0.0126 (44배 저렴!)

ROI = (절감액 / 투자 비용) × 100
    = ($21,192 / $50,000) × 100  # 초기 마이그레이션 비용 $50k
    = 42% 연간 ROI
    → 2.4년이면 투자 회수
```

### 6.3 비즈니스 임팩트

```
매출 증가 (다운타임 감소):
- 기존 가용성: 95% (월 36시간 다운)
- 신규 가용성: 99.9% (월 43분 다운)
- 다운타임 감소: 35시간/month

티켓 오픈 시나리오:
- 시간당 예상 매출: $10,000 (1,000건 × $10)
- 35시간 × $10,000 = $350,000/month 추가 매출 기회

고객 만족도 향상:
- 응답 시간: 500ms → 100ms (80% 개선)
- 이탈률 감소: 30% → 5%
- 고객 유지율: 60% → 85%
```

---

## 마무리

축하합니다! 🎉

TIKETI를 단일 EC2에서 **수십만 명 동시 접속 가능한 MSA + Kubernetes 아키텍처**로 마이그레이션하는 전체 가이드를 완료했습니다.

### 핵심 요약

1. **아키텍처 변화**
   - Monolith → 9개 마이크로서비스
   - 단일 EC2 → EKS 클러스터 (최대 50 Nodes)
   - 단일 DB → 5개 독립 데이터베이스

2. **성능 개선**
   - 동시 접속: 10,000명 → 300,000명 (30배)
   - 응답 시간: 500ms → 100ms (80% 개선)
   - 가용성: 95% → 99.9% (263배 개선)

3. **비용 효율**
   - TCO: $5,550 → $3,784 (32% 절감)
   - 사용자당 비용: 44배 저렴
   - 연간 ROI: 42%

4. **운영 효율**
   - 배포 시간: 30분 → 5분 (자동화)
   - 복구 시간: 10분 → 30초 (자동)
   - 엔지니어 시간: 70h/month → 30h/month (57% 절감)

### 다음 액션 아이템

- [ ] 경영진 승인 획득
- [ ] AWS 계정 및 예산 확보
- [ ] 팀 교육 일정 수립
- [ ] Phase 1 시작 (인프라 구축)

**Good luck with your migration! 🚀**

---

## 참고 자료

- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [Microservices Patterns (Chris Richardson)](https://microservices.io/patterns/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
