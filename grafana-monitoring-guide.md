# 📊 Grafana 모니터링 가이드

**EKS 클러스터 실시간 모니터링 시스템 - Tiketi 프로젝트**

---

## 📋 목차

1. [시스템 아키텍처](#1-시스템-아키텍처)
2. [구현 상세](#2-구현-상세)
3. [대시보드 가이드](#3-대시보드-가이드)
4. [주요 메트릭 해석](#4-주요-메트릭-해석)
5. [트러블슈팅](#5-트러블슈팅)

---

## 1. 시스템 아키텍처

### 전체 구조
```
<img width="1210" height="561" alt="스크린샷 2026-01-08 오후 3 16 53" src="https://github.com/user-attachments/assets/547d414b-76c5-49b2-835b-d65c0e680643" />

```

### 현재 시스템 상태
```yaml
Cluster: tiketiadv-dev
Region: ap-northeast-2
Nodes: 10 (Spot, ap-northeast-2b)

Monitoring Stack:
  ✅ Grafana: 1/1 Running
  ✅ Loki: 1/1 Running
  ✅ Promtail: 10/10 Running (DaemonSet)
  ✅ Prometheus: 2/2 Running
  ✅ AlertManager: 2/2 Running
  ✅ Node Exporter: 10/10 Running
  ✅ Kube State Metrics: 1/1 Running
  ✅ Prometheus Operator: 1/1 Running

총 Pod 수: 24개 (모두 Running)
```

---

## 2. 구현 상세

### 2-1. Namespace 생성
```yaml
# 00-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tiketi
  labels:
    name: tiketi
---
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
  labels:
    name: monitoring
```

**배포:**
```bash
kubectl apply -f k8s/00-namespace.yaml
```

---

### 2-2. Persistent Volume Claims
```yaml
# 03-pvc.yaml
---
# Grafana Storage
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: grafana-pvc
  namespace: monitoring
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: gp2

---
# Loki Storage
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: loki-pvc
  namespace: monitoring
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi
  storageClassName: gp2
```

**배포:**
```bash
kubectl apply -f k8s/03-pvc.yaml
kubectl get pvc -n monitoring
```

---

### 2-3. Loki 배포

**배포:**
```bash
kubectl apply -f k8s/08-loki.yaml
kubectl get pods -n monitoring -l app=loki
```

---

### 2-4. Promtail 배포 (DaemonSet)

**배포:**
```bash
kubectl apply -f k8s/09-promtail.yaml
kubectl get pods -n monitoring -l app=promtail
```

---

### 2-5. Grafana 배포

**배포:**
```bash
kubectl apply -f k8s/10-grafana.yaml
kubectl get pods -n monitoring -l app=grafana
```

---

### 2-6. Prometheus Stack (Helm)
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --set grafana.enabled=false \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.retention=7d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=gp2 \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=10Gi

kubectl get pods -n monitoring
```

---

### 2-7. ALB Ingress 설정
```bash
kubectl apply -f k8s/ingress-grafana.yaml
kubectl get ingress -n monitoring -w
```

---

## 3. 대시보드 가이드

### 3-1. 접속 방법

**URL:** `http://monitoring.tiketi.store`

**초기 로그인:**
- ID: `admin`
- PW: `admin`

---

### 3-2. Prometheus 데이터소스 추가

**Configuration → Data Sources → Add data source → Prometheus**
```
URL: http://prometheus-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090
```

**Save & Test** → "Data source is working" 확인

---

### 3-3. Loki 데이터소스 (자동 설정됨)

**이미 ConfigMap으로 설정되어 있음**

---

### 3-4. 추천 대시보드 Import

**Dashboards → Import → Dashboard ID 또는 URL 입력**

#### Kubernetes 모니터링

| ID | 이름 | 용도 |
|----|------|------|
| **15661** | K8s Dashboard | 클러스터 전체 현황 ⭐⭐⭐⭐⭐ |

**Import 방법:**
1. Dashboard ID 입력: `15661`
2. **Load** 클릭
3. Prometheus 데이터소스 선택
4. **Import** 클릭

**또는 URL로 Import:**
```
https://grafana.com/grafana/dashboards/15661-k8s-dashboard-en-20250125/
```

---

#### AWS 리소스 모니터링

**AWS RDS 모니터링:**

| ID | 이름 | 용도 |
|----|------|------|
| **707** | AWS RDS | RDS 메트릭 모니터링 ⭐⭐⭐⭐ |

**Import 방법:**
```
https://grafana.com/grafana/dashboards/707-aws-rds/
```

**필요한 데이터소스:**
- CloudWatch (AWS API 연동 필요)

---

**AWS ElastiCache Redis 모니터링:**

| ID | 이름 | 용도 |
|----|------|------|
| **969** | AWS ElastiCache Redis | Redis 메트릭 모니터링 ⭐⭐⭐⭐ |

**Import 방법:**
```
https://grafana.com/grafana/dashboards/969-aws-elasticache-redis/
```

**필요한 데이터소스:**
- CloudWatch (AWS API 연동 필요)

---

### 3-5. CloudWatch 데이터소스 설정 (선택사항)

**RDS와 ElastiCache 대시보드를 사용하려면:**

**Configuration → Data Sources → Add data source → CloudWatch**
```
Auth Provider: AWS SDK Default
Default Region: ap-northeast-2
```

**IAM 권한 필요:**
- `cloudwatch:GetMetricData`
- `cloudwatch:ListMetrics`
- `rds:DescribeDBInstances`
- `elasticache:DescribeCacheClusters`

---

## 4. 주요 메트릭 해석

### 4-1. PromQL 쿼리
```promql
# 노드 CPU 사용률
100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# 노드 메모리 사용률
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Pod CPU 사용량
sum(rate(container_cpu_usage_seconds_total{namespace="monitoring"}[5m])) by (pod)

# Pod 메모리 사용량
sum(container_memory_working_set_bytes{namespace="monitoring"}) by (pod) / 1024 / 1024

# 네트워크 수신 속도
rate(node_network_receive_bytes_total{device!="lo"}[5m]) / 1024 / 1024
```

---

### 4-2. Loki 로그 쿼리 (LogQL)
```logql
# 기본 검색
{namespace="monitoring"}

# App별 필터
{namespace="monitoring", app="grafana"}

# 에러 로그만
{namespace="monitoring"} |= "error"

# 로그 집계 (최근 5분)
sum(rate({namespace="monitoring"}[5m])) by (pod)

# 정규표현식 검색
{namespace="monitoring"} |~ "error|failed|exception"
```

---

## 5. 트러블슈팅

### 해결 완료된 주요 문제

#### ✅ 문제 1: ALB ADDRESS 비어있음
**원인:** IAM 권한 누락
- `ec2:DescribeRouteTables`
- `elasticloadbalancing:DescribeListenerAttributes`

**해결:**
```bash
# IAM Policy 업데이트
aws iam create-policy-version \
  --policy-arn arn:aws:iam::ACCOUNT:policy/AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://updated-policy.json \
  --set-as-default

# Controller 재시작
kubectl rollout restart deployment aws-load-balancer-controller -n kube-system
```

---

#### ✅ 문제 2: 504 Gateway Timeout
**원인:** Security Group 차단

**해결:**
```yaml
# Ingress Annotation 추가
alb.ingress.kubernetes.io/manage-backend-security-group-rules: "true"
```

---

#### ✅ 문제 3: Promtail CrashLoopBackOff
**원인:** YAML 들여쓰기 오류 (line 14)

**해결:**
```yaml
# ❌ 잘못된 형식
kubernetes_sd_configs:
  - role: pod
  namespaces:  # 틀림

# ✅ 올바른 형식
kubernetes_sd_configs:
  - role: pod
    namespaces:  # 맞음 (2칸 더 들여쓰기)
```

---

#### ✅ 문제 4: Pod Pending (PVC AZ 불일치)
**원인:** 
- PV가 ap-northeast-2a에 있음
- 노드가 ap-northeast-2b에만 생성됨 (Spot 인스턴스 특성)

**해결:**
```bash
# PVC 재생성 (현재 노드 AZ에 생성)
kubectl delete deployment grafana loki -n monitoring
kubectl delete pvc grafana-pvc loki-pvc -n monitoring
kubectl apply -f k8s/03-pvc.yaml
kubectl apply -f k8s/08-loki.yaml
kubectl apply -f k8s/10-grafana.yaml
```

---

#### ✅ 문제 5: DaemonSet 중복 생성
**원인:** Spot 인스턴스 교체로 오래된 Pod 미삭제

**해결:**
```bash
kubectl rollout restart daemonset prometheus-prometheus-node-exporter -n monitoring
kubectl rollout restart daemonset promtail -n monitoring
```

---

#### ✅ 문제 6: Prometheus 1/2 Running
**원인:** Sidecar 컨테이너 시작 지연

**해결:**
```bash
kubectl rollout restart statefulset prometheus-prometheus-kube-prometheus-prometheus -n monitoring
```

---

### Spot 인스턴스 주의사항

**Spot 인스턴스 특성:**
- ✅ 비용 70% 절감
- ⚠️ AZ가 계속 변경될 수 있음
- ⚠️ PV의 AZ와 노드의 AZ 불일치 발생 가능

**해결 전략:**
1. PVC를 현재 활성 AZ로 재생성
2. 노드 수를 여유있게 유지
3. Multi-AZ 서브넷 구성

---

## 최종 성과
```
┌────────────────── 프로젝트 성과 ──────────────────┐
│  구현 완료:                                       │
│  ✅ 10개 노드 EKS 클러스터 (Spot)                 │
│  ✅ 24개 모니터링 Pod (100% 정상)                 │
│  ✅ 완전 자동화된 모니터링 스택                   │
│  ✅ ALB Ingress 자동 생성                         │
│  ✅ Kubernetes + AWS 통합 모니터링                │
│                                                   │
│  문제 해결: 6가지                                 │
│  시스템 안정성: 100%                              │
│  비용 절감: ~70% (Spot Instance)                  │
└───────────────────────────────────────────────────┘
```

**🎉 프로덕션급 모니터링 시스템 구축 완료!** 🚀
