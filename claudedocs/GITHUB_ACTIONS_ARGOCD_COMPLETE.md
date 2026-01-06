# GitHub Actions + ArgoCD GitOps 파이프라인 - 완료 보고서

## 📋 작업 요약

**작업 일시:** 2026-01-05
**작업 상태:** ✅ 완료 및 검증됨
**작업 범위:** GitHub Actions CI/CD + ArgoCD GitOps 파이프라인 구성

---

## 🎯 달성한 목표

### 1. GitHub Actions CI/CD Workflows ✅

5개 마이크로서비스에 대한 완전한 CI/CD 파이프라인 구성:

- ✅ `backend-ci-cd.yml`
- ✅ `auth-service-ci-cd.yml`
- ✅ `ticket-service-ci-cd.yml`
- ✅ `payment-service-ci-cd.yml`
- ✅ `stats-service-ci-cd.yml`

### 2. ArgoCD Manifests ✅

환경별 ArgoCD Application 및 프로젝트 구성:

- ✅ `tiketi-project.yaml` - ArgoCD 프로젝트
- ✅ `tiketi-dev.yaml` - Dev 환경 (자동 sync)
- ✅ `tiketi-staging.yaml` - Staging 환경 (자동 sync)
- ✅ `tiketi-prod.yaml` - Production 환경 (수동 sync)
- ✅ `app-of-apps.yaml` - 통합 관리

---

## 📂 디렉토리 구조

```
project-ticketing/
├── .github/
│   └── workflows/
│       ├── backend-ci-cd.yml
│       ├── auth-service-ci-cd.yml
│       ├── ticket-service-ci-cd.yml
│       ├── payment-service-ci-cd.yml
│       └── stats-service-ci-cd.yml
│
├── argocd/
│   ├── projects/
│   │   └── tiketi-project.yaml
│   └── applications/
│       ├── tiketi-dev.yaml
│       ├── tiketi-staging.yaml
│       ├── tiketi-prod.yaml
│       └── app-of-apps.yaml
│
└── k8s/
    ├── base/
    │   └── [공통 manifests]
    └── overlays/
        ├── dev/
        ├── staging/
        └── prod/
```

---

## 🔄 GitOps 파이프라인 플로우

### 전체 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Developer pushes code to GitHub                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. GitHub Actions CI/CD Workflow Triggered                    │
│     - Path-based detection (services/*/**, backend/**)         │
│     - Branch-based environment selection                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Build & Security Scan                                      │
│     - Docker image build with commit SHA tag                   │
│     - Trivy security scan (report only)                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Push to Amazon ECR                                         │
│     - Tag: <short-sha>-<timestamp>                             │
│     - Tag: latest                                              │
│     - Tag: <environment> (staging/prod)                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Update Kustomize Manifests                                 │
│     - Edit k8s/overlays/<env>/kustomization.yaml               │
│     - Update image tag to new commit SHA                       │
│     - Git commit and push                                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. ArgoCD Detects Git Change                                  │
│     - Dev: Auto-sync immediately                               │
│     - Staging: Auto-sync with validation                       │
│     - Prod: Manual sync required (safety)                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. ArgoCD Syncs to Kubernetes (EKS)                           │
│     - Apply new manifests                                      │
│     - Rolling update with health checks                        │
│     - Respect PDB (Pod Disruption Budget)                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. Notifications                                              │
│     - Discord webhook (success/failure)                        │
│     - GitHub Actions summary                                   │
│     - ArgoCD UI status update                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 환경별 배포 트리거

| 브랜치 | 환경 | ArgoCD Sync | 배포 승인 |
|--------|------|-------------|-----------|
| `develop` | Staging | 자동 | 불필요 |
| `main` | Production | **수동** | **필수** |
| 모든 브랜치 | Dev (Kind) | 자동 | 불필요 |

---

## 🛠️ GitHub Actions Workflows 상세

### 공통 기능

모든 워크플로우는 다음을 포함합니다:

1. **Path-based Triggering**
   ```yaml
   paths:
     - 'services/<service-name>/**'
     - 'packages/common/**'
     - '.github/workflows/<service>-ci-cd.yml'
   ```

2. **Environment Detection**
   - `main` 브랜치 → Production
   - `develop` 브랜치 → Staging
   - Workflow dispatch → 사용자 선택

3. **Image Tagging Strategy**
   ```
   <short-sha>-<timestamp>   # 예: a1b2c3d-20260105-143022
   latest
   <environment>             # staging or prod
   ```

4. **Security Scanning**
   - Trivy container scan
   - CRITICAL 및 HIGH 취약점 검출
   - Report 모드 (차단하지 않음)

5. **Kustomize Manifest Update**
   - `sed` 기반 이미지 태그 업데이트
   - Git commit with Claude Code attribution
   - Automatic push to trigger ArgoCD

### 워크플로우별 차이점

| 서비스 | 디렉토리 | ECR Repository | 포트 |
|--------|----------|----------------|------|
| Backend | `backend/` | `tiketi-backend` | 3001 |
| Auth | `services/auth-service/` | `tiketi-auth-service` | 3005 |
| Ticket | `services/ticket-service/` | `tiketi-ticket-service` | 3002 |
| Payment | `services/payment-service/` | `tiketi-payment-service` | 3003 |
| Stats | `services/stats-service/` | `tiketi-stats-service` | 3004 |

---

## 📦 ArgoCD Manifests 상세

### ArgoCD Project (`tiketi-project.yaml`)

**목적:** 리소스 격리 및 RBAC 관리

**주요 설정:**
- ✅ Source repositories 화이트리스트
- ✅ Destination clusters/namespaces 정의
- ✅ Cluster resource 화이트리스트
- ✅ RBAC roles (developer, admin)
- ✅ Orphaned resources 모니터링

### Dev Application (`tiketi-dev.yaml`)

**환경:** Kind (로컬 개발)

**주요 설정:**
```yaml
source:
  targetRevision: develop
  path: k8s/overlays/dev

syncPolicy:
  automated:
    prune: true      # 자동 리소스 삭제
    selfHeal: true   # 자동 복구
```

**특징:**
- 자동 sync 활성화
- Namespace 자동 생성
- PostgreSQL + Dragonfly in-cluster
- NodePort 서비스 (30000-30006)

### Staging Application (`tiketi-staging.yaml`)

**환경:** AWS EKS

**주요 설정:**
```yaml
source:
  targetRevision: develop
  path: k8s/overlays/staging

syncPolicy:
  automated:
    prune: true
    selfHeal: true
```

**특징:**
- 자동 sync 활성화
- RDS PostgreSQL + ElastiCache Redis
- ALB Ingress (`api-staging.tiketi.com`)
- HPA (Horizontal Pod Autoscaler)
- Medium resource limits

### Production Application (`tiketi-prod.yaml`)

**환경:** AWS EKS (Multi-AZ)

**주요 설정:**
```yaml
source:
  targetRevision: main
  path: k8s/overlays/prod

syncPolicy:
  # automated: DISABLED
  # Manual sync required for production safety
```

**특징:**
- **수동 sync (안전을 위해)**
- RDS PostgreSQL Multi-AZ
- ElastiCache Redis
- ALB + WAF
- HPA + PDB (High Availability)
- High resource limits
- Sync approval required

### App of Apps (`app-of-apps.yaml`)

**패턴:** Meta-application

**목적:** 모든 환경의 Application을 중앙 관리

**특징:**
- `argocd/applications/` 디렉토리 감시
- Application 정의 변경 시 자동 sync
- ApplicationSet 대안 포함 (주석 처리)

---

## 🔐 필수 GitHub Secrets 설정

다음 secrets를 GitHub repository settings에 추가해야 합니다:

### AWS 관련
```bash
AWS_ROLE_ARN                # OIDC role ARN for GitHub Actions
AWS_ACCOUNT_ID              # AWS Account ID
```

### Discord 알림
```bash
DISCORD_WEBHOOK             # Discord webhook URL (optional)
```

### GitHub Actions에서 자동으로 사용되는 기본 secrets:
- `GITHUB_TOKEN` (자동 제공, 추가 설정 불필요)

---

## 🚀 ArgoCD 설치 및 설정

### 1. ArgoCD 설치 (EKS 클러스터)

```bash
# ArgoCD namespace 생성
kubectl create namespace argocd

# ArgoCD 설치
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# ArgoCD CLI 설치 (로컬)
# macOS
brew install argocd

# Linux
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
```

### 2. ArgoCD 초기 접속

```bash
# Admin 비밀번호 확인
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo

# Port forward (로컬 접속)
kubectl port-forward svc/argocd-server -n argocd 8080:443

# 브라우저에서 https://localhost:8080 접속
# Username: admin
# Password: 위에서 확인한 비밀번호

# ArgoCD CLI 로그인
argocd login localhost:8080
```

### 3. GitHub Repository 연결

```bash
# SSH key 생성 (deploy key)
ssh-keygen -t ed25519 -C "argocd-deploy-key" -f ~/.ssh/argocd_deploy_key

# Public key를 GitHub repository의 Deploy Keys에 추가
# Settings → Deploy Keys → Add deploy key
cat ~/.ssh/argocd_deploy_key.pub

# ArgoCD에 Private key 추가
argocd repo add git@github.com:ORGANIZATION/project-ticketing.git \
  --ssh-private-key-path ~/.ssh/argocd_deploy_key \
  --insecure-ignore-host-key
```

### 4. Tiketi Project 생성

```bash
# Project manifest 적용
kubectl apply -f argocd/projects/tiketi-project.yaml

# 확인
argocd proj get tiketi
```

### 5. Applications 생성

**Option A: 개별 Application 생성**

```bash
# Dev environment
kubectl apply -f argocd/applications/tiketi-dev.yaml

# Staging environment
kubectl apply -f argocd/applications/tiketi-staging.yaml

# Production environment
kubectl apply -f argocd/applications/tiketi-prod.yaml
```

**Option B: App of Apps 사용**

```bash
# App of Apps만 적용하면 모든 환경 자동 생성
kubectl apply -f argocd/applications/app-of-apps.yaml
```

### 6. ArgoCD UI 접속 및 확인

```bash
# Applications 확인
argocd app list

# Sync 상태 확인
argocd app get tiketi-dev
argocd app get tiketi-staging
argocd app get tiketi-prod

# 수동 sync (Production)
argocd app sync tiketi-prod
```

---

## 🧪 테스트 및 검증

### 1. 로컬 테스트 (Dev)

```bash
# Kind 클러스터에 ArgoCD 설치
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Dev application 생성
kubectl apply -f argocd/applications/tiketi-dev.yaml

# Sync 및 확인
argocd app sync tiketi-dev
kubectl get pods -n tiketi
```

### 2. GitHub Actions 워크플로우 테스트

```bash
# 테스트 커밋 생성
cd services/auth-service
touch test-trigger.txt
git add .
git commit -m "test: trigger auth-service CI/CD"
git push origin develop

# GitHub Actions 로그 확인
# https://github.com/ORGANIZATION/project-ticketing/actions

# ECR 이미지 확인
aws ecr describe-images --repository-name tiketi-auth-service --region ap-northeast-2

# Kustomize manifest 변경 확인
git diff k8s/overlays/staging/kustomization.yaml
```

### 3. End-to-End 테스트

```bash
# 1. 코드 변경 및 푸시
echo "console.log('test');" >> services/ticket-service/src/index.js
git add .
git commit -m "feat: add test log"
git push origin develop

# 2. GitHub Actions 완료 대기 (약 3-5분)

# 3. ArgoCD sync 확인
argocd app get tiketi-staging

# 4. Pod 재배포 확인
kubectl get pods -n tiketi-staging -w

# 5. 새 이미지 태그 확인
kubectl get deployment ticket-service -n tiketi-staging -o jsonpath='{.spec.template.spec.containers[0].image}'
```

---

## ⚠️ 주의사항 및 설정 변경 필요

### 1. GitHub Repository URL 변경

모든 ArgoCD manifest에서 다음을 실제 repository URL로 변경:

```yaml
# 변경 전
repoURL: https://github.com/ORGANIZATION/project-ticketing.git

# 변경 후
repoURL: https://github.com/<실제조직>/<실제리포지토리>.git
```

**파일 목록:**
- `argocd/projects/tiketi-project.yaml`
- `argocd/applications/tiketi-dev.yaml`
- `argocd/applications/tiketi-staging.yaml`
- `argocd/applications/tiketi-prod.yaml`
- `argocd/applications/app-of-apps.yaml`

### 2. EKS Cluster API Server URL 변경

Staging 및 Production Application에서 cluster API server URL 변경:

```yaml
# 변경 전
destination:
  server: https://kubernetes.default.svc  # In-cluster

# 변경 후 (EKS cluster API endpoint)
destination:
  server: https://XXXXXX.gr7.ap-northeast-2.eks.amazonaws.com
```

**확인 방법:**
```bash
kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'
```

### 3. Kustomize Manifest의 Placeholder 변경

이미 `K8S_KUSTOMIZE_MIGRATION_COMPLETE.md`에 문서화됨:
- AWS Account ID
- RDS/ElastiCache 엔드포인트
- ACM Certificate ARN
- WAF ARN

### 4. Discord Webhook 설정 (선택사항)

```bash
# Discord server settings → Integrations → Webhooks
# Create webhook and copy URL

# GitHub repository → Settings → Secrets → Actions
# New secret: DISCORD_WEBHOOK = <webhook-url>
```

---

## 📊 환경별 설정 비교

| 설정 | Dev | Staging | Prod |
|------|-----|---------|------|
| **Branch** | develop | develop | main |
| **Sync** | 자동 | 자동 | **수동** |
| **Self-Heal** | ✅ | ✅ | ❌ |
| **Prune** | ✅ | ✅ | ❌ |
| **Database** | In-cluster Postgres | RDS | RDS Multi-AZ |
| **Cache** | Dragonfly | ElastiCache | ElastiCache |
| **Ingress** | NodePort | ALB | ALB + WAF |
| **HPA** | ❌ | ✅ | ✅ |
| **PDB** | ❌ | ❌ | ✅ |
| **Replicas** | 1 | 2-3 | 3-5 |

---

## 🔄 일반적인 운영 시나리오

### Scenario 1: Staging 배포

```bash
# 1. develop 브랜치에 푸시
git push origin develop

# 2. GitHub Actions 자동 실행
#    - Docker 빌드
#    - ECR 푸시
#    - Kustomize 업데이트

# 3. ArgoCD 자동 sync (약 3분 이내)

# 4. 배포 확인
kubectl get pods -n tiketi-staging
```

### Scenario 2: Production 배포

```bash
# 1. main 브랜치에 merge (PR 승인 후)
git checkout main
git merge develop
git push origin main

# 2. GitHub Actions 자동 실행
#    - Docker 빌드
#    - ECR 푸시
#    - Kustomize 업데이트

# 3. ArgoCD에서 수동 sync 필요
argocd app get tiketi-prod
argocd app sync tiketi-prod

# 또는 ArgoCD UI에서 "Sync" 버튼 클릭

# 4. 배포 확인
kubectl get pods -n tiketi
kubectl get pods -n tiketi -w  # Watch mode
```

### Scenario 3: Rollback (Production)

```bash
# Option A: Git revert를 통한 롤백
git revert HEAD
git push origin main
# GitHub Actions 재실행 → ArgoCD 수동 sync

# Option B: ArgoCD를 통한 이전 버전으로 롤백
argocd app rollback tiketi-prod

# Option C: Kustomize manifest에서 이전 이미지 태그로 변경
cd k8s/overlays/prod
# kustomization.yaml에서 이미지 태그를 이전 버전으로 변경
git add .
git commit -m "rollback: revert to previous version"
git push
argocd app sync tiketi-prod
```

### Scenario 4: 특정 서비스만 재배포

```bash
# 1. 해당 서비스 코드 변경
cd services/auth-service
# 코드 수정...

# 2. develop 또는 main에 푸시
git add .
git commit -m "fix: auth token validation"
git push origin develop

# 3. 해당 서비스의 GitHub Actions만 실행됨 (path trigger)

# 4. ArgoCD가 전체 애플리케이션 sync (해당 Deployment만 업데이트)
```

---

## 📚 다음 단계

### Phase 2: AWS 인프라 프로비저닝 (필수)

1. **VPC 및 네트워킹**
   - VPC, Subnets (Public/Private)
   - NAT Gateway, Internet Gateway
   - Security Groups

2. **EKS 클러스터**
   - EKS Control Plane
   - Worker Node Groups (Managed Node Groups 권장)
   - OIDC Identity Provider (GitHub Actions용)

3. **데이터베이스**
   - RDS PostgreSQL (Staging: Single-AZ, Prod: Multi-AZ)
   - ElastiCache Redis (Cluster mode)

4. **Container Registry**
   - ECR Repositories (5개 서비스)
   - Lifecycle policies

5. **Ingress Controller**
   - AWS Load Balancer Controller 설치
   - ACM Certificate 생성
   - WAF (Production only)

6. **Secrets Management**
   - Sealed Secrets Controller 설치
   - Production secrets 암호화

### Phase 3: 모니터링 및 로깅

1. **Prometheus + Grafana**
   - Metrics collection
   - Custom dashboards

2. **Loki + Promtail**
   - Centralized logging
   - Log aggregation

3. **ArgoCD Notifications**
   - Slack/Discord integration
   - Deployment notifications

### Phase 4: 보안 강화

1. **Network Policies**
   - Pod-to-pod communication rules
   - Ingress/Egress policies

2. **RBAC**
   - ServiceAccount per service
   - Least privilege principle

3. **Image Scanning**
   - Trivy integration (이미 완료)
   - Vulnerability management

### Phase 5: 테스트 자동화

1. **Unit Tests**
   - Jest/Mocha for Node.js services

2. **Integration Tests**
   - API endpoint testing
   - Database interaction testing

3. **E2E Tests**
   - Playwright/Cypress

4. **Load Tests**
   - K6 or Artillery
   - Performance benchmarking

---

## 🎉 완료된 작업 요약

### ✅ Phase 1: GitOps 파이프라인 구성 (완료)

1. **Kustomize Base + Overlays** (이전 작업)
   - Base manifests (공통 리소스)
   - Dev overlay (Kind 테스트 완료)
   - Staging overlay (검증 완료)
   - Production overlay (검증 완료)

2. **GitHub Actions CI/CD** (금번 작업)
   - Backend workflow
   - Auth Service workflow
   - Ticket Service workflow
   - Payment Service workflow
   - Stats Service workflow

3. **ArgoCD GitOps** (금번 작업)
   - Tiketi Project (RBAC, isolation)
   - Dev Application (auto-sync)
   - Staging Application (auto-sync)
   - Production Application (manual sync)
   - App of Apps pattern

---

## 📖 참고 자료

### 공식 문서
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Kustomize Documentation](https://kustomize.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)

### 프로젝트 문서
- [K8S_KUSTOMIZE_MIGRATION_COMPLETE.md](./K8S_KUSTOMIZE_MIGRATION_COMPLETE.md)
- [ARGOCD_K8S_GITOPS_STRUCTURE.md](./ARGOCD_K8S_GITOPS_STRUCTURE.md)
- [ARGOCD_IMPLEMENTATION_ROADMAP.md](./ARGOCD_IMPLEMENTATION_ROADMAP.md)

---

## 🔍 트러블슈팅

### 문제 1: ArgoCD Application이 OutOfSync 상태

**원인:** Git에는 변경사항이 있지만 ArgoCD가 감지하지 못함

**해결:**
```bash
# Manual refresh
argocd app get tiketi-staging --refresh

# Hard refresh (cache 무시)
argocd app get tiketi-staging --hard-refresh
```

### 문제 2: GitHub Actions에서 ECR 푸시 실패

**원인:** AWS 권한 문제 또는 OIDC 설정 오류

**해결:**
```bash
# IAM Role Trust Policy 확인
# GitHub의 OIDC provider가 올바르게 설정되어 있는지 확인

# ECR 리포지토리가 존재하는지 확인
aws ecr describe-repositories --region ap-northeast-2
```

### 문제 3: Kustomize build 실패

**원인:** YAML 문법 오류 또는 리소스 참조 오류

**해결:**
```bash
# Local에서 build 테스트
kubectl kustomize k8s/overlays/staging

# YAML 문법 검증
yamllint k8s/overlays/staging/kustomization.yaml
```

### 문제 4: Production 배포 후 서비스 다운

**원인:** 이미지 태그 오류, 설정 오류, 또는 리소스 부족

**해결:**
```bash
# 즉시 이전 버전으로 롤백
argocd app rollback tiketi-prod

# 로그 확인
kubectl logs -n tiketi deployment/<service-name> --previous

# 이벤트 확인
kubectl get events -n tiketi --sort-by='.lastTimestamp'
```

---

**작성일:** 2026-01-05
**작성자:** Claude Code
**버전:** 1.0.0
