# GitOps 파이프라인 Critical Fixes - 2026-01-05

## 📋 수정 개요

**작업 일시:** 2026-01-05
**작업 상태:** ✅ 완료
**심각도:** 🔴 CRITICAL (2개) + 🟡 IMPORTANT (2개)

이전 GitOps 구성에서 발견된 치명적 이슈들을 수정했습니다. 수정하지 않았다면 staging/prod 환경에서 파드가 절대 정상 동작하지 않았을 것입니다.

---

## 🔴 Issue #1: initContainers 하드코딩 (CRITICAL)

### 문제점
**심각도:** 🔴 CRITICAL
**영향:** Staging/Prod 파드가 무한 대기 상태로 배포 불가

Base deployment에 `wait-for-postgres`/`wait-for-dragonfly` initContainers가 하드코딩되어 있었습니다:

```yaml
# 문제: Base deployment.yaml에 하드코딩
initContainers:
  - name: wait-for-postgres
    command: [sh, -c, "until nc -z postgres-service 5432; do sleep 2; done"]
  - name: wait-for-dragonfly
    command: [sh, -c, "until nc -z dragonfly-service 6379; do sleep 2; done"]
```

**왜 문제인가:**
- `postgres-service`/`dragonfly-service`는 **dev 환경에만** 존재
- Staging/Prod는 RDS/ElastiCache를 사용하므로 해당 서비스가 없음
- 결과: 파드가 영원히 대기 → **배포 실패**

### 해결 방법

**Step 1:** Base deployment에서 initContainers 완전 제거

```bash
k8s/base/backend/deployment.yaml       (initContainers 제거)
k8s/base/auth-service/deployment.yaml   (initContainers 제거)
k8s/base/ticket-service/deployment.yaml (initContainers 제거)
k8s/base/payment-service/deployment.yaml(initContainers 제거)
k8s/base/stats-service/deployment.yaml  (initContainers 제거)
```

**Step 2:** Dev overlay에만 환경변수 기반 패치 추가

```yaml
# k8s/overlays/dev/wait-deps-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  template:
    spec:
      initContainers:
        - name: wait-for-database
          image: busybox:1.36
          command: [sh, -c, "until nc -z $DB_HOST $DB_PORT; do sleep 2; done"]
          env:
            - name: DB_HOST
              valueFrom:
                configMapKeyRef:
                  name: tiketi-config
                  key: DB_HOST  # Dev: postgres-service, Staging/Prod: RDS endpoint
```

**장점:**
- ✅ Dev에서는 `DB_HOST=postgres-service`로 대기
- ✅ Staging/Prod에는 initContainers 자체가 없어서 즉시 시작
- ✅ 환경변수 기반이므로 확장 가능

### 수정 파일
- `k8s/base/*/deployment.yaml` (5개 파일)
- `k8s/overlays/dev/wait-deps-patch.yaml` (신규)
- `k8s/overlays/dev/kustomization.yaml` (패치 추가)

---

## 🔴 Issue #2: SealedSecret 구조 오류 (CRITICAL)

### 문제점
**심각도:** 🔴 CRITICAL
**영향:** Staging/Prod 파드가 환경변수 없이 시작 실패

Kustomize `secretGenerator`에 `secrets.enc.yaml`을 **파일로** 넣어서 실제 Secret 키가 생성되지 않았습니다:

```yaml
# 문제: staging/prod kustomization.yaml
secretGenerator:
  - name: tiketi-secret
    files:
      - secrets.enc.yaml  # ❌ 파일 전체가 하나의 키로 들어감
```

**생성된 Secret (잘못된 구조):**
```yaml
apiVersion: v1
kind: Secret
data:
  secrets.enc.yaml: <파일 내용 전체>  # ❌ 키가 하나만 생성됨
  # DB_PASSWORD: 없음!
  # JWT_SECRET: 없음!
```

**왜 문제인가:**
- 서비스 코드는 `DB_PASSWORD`, `JWT_SECRET` 등 개별 키를 참조
- 실제로는 `secrets.enc.yaml` 하나의 키만 존재
- 결과: 환경변수 없이 파드 시작 → **Crash Loop**

### 해결 방법

**Step 1:** SealedSecret 리소스로 변경

```yaml
# k8s/overlays/staging/secrets.enc.yaml (변경 후)
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: tiketi-secret
  namespace: tiketi-staging
spec:
  encryptedData:
    DB_PASSWORD: AgBQRVBMQUNFSE9MREVSX0VOQ1JZUFRFRF9EQVRBLi4uCg==
    JWT_SECRET: AgBQRVBMQUNFSE9MREVSX0VOQ1JZUFRFRF9EQVRBLi4uCg==
    ADMIN_PASSWORD: AgBQRVBMQUNFSE9MREVSX0VOQ1JZUFRFRF9EQVRBLi4uCg==
    INTERNAL_API_TOKEN: AgBQRVBMQUNFSE9MREVSX0VOQ1JZUFRFRF9EQVRBLi4uCg==
  template:
    metadata:
      name: tiketi-secret  # 이 이름으로 실제 Secret 생성
      namespace: tiketi-staging
```

**Step 2:** secretGenerator 제거, resources에 추가

```yaml
# k8s/overlays/staging/kustomization.yaml
resources:
  - secrets.enc.yaml  # SealedSecret 리소스로 직접 포함

# secretGenerator 섹션 제거
```

**동작 방식:**
1. SealedSecret Controller가 `spec.encryptedData`를 복호화
2. `spec.template`에 정의된 구조로 실제 Secret 생성
3. 서비스가 `DB_PASSWORD`, `JWT_SECRET` 등 개별 키 정상 참조

**중요:** 현재는 PLACEHOLDER 값이므로 실제 배포 전 kubeseal로 암호화 필요

### 수정 파일
- `k8s/overlays/staging/secrets.enc.yaml` (SealedSecret 리소스로 변경)
- `k8s/overlays/staging/kustomization.yaml` (secretGenerator 제거)
- `k8s/overlays/prod/secrets.enc.yaml` (SealedSecret 리소스로 변경)
- `k8s/overlays/prod/kustomization.yaml` (secretGenerator 제거)

---

## 🟡 Issue #3: Namespace 충돌 (IMPORTANT)

### 문제점
**심각도:** 🟡 IMPORTANT
**영향:** 동일 클러스터에서 dev/staging 환경 충돌

Base에 `namespace.yaml`이 있고 staging overlay가 이를 그대로 포함하여 네임스페이스 충돌:

```yaml
# 문제: k8s/base/kustomization.yaml
namespace: tiketi  # 고정
resources:
  - namespace.yaml  # tiketi 네임스페이스 생성

# staging kustomization.yaml
namespace: tiketi-staging  # 원하는 네임스페이스
bases:
  - ../../base  # 하지만 base의 tiketi도 함께 생성됨
```

**왜 문제인가:**
- Staging app이 `tiketi-staging`을 사용해야 하는데 `tiketi`도 함께 관리
- 같은 클러스터에서 dev/staging 동시 운영 시 충돌
- ArgoCD가 잘못된 네임스페이스 리소스 관리

### 해결 방법

**Step 1:** Base에서 namespace 제거

```yaml
# k8s/base/kustomization.yaml (변경 후)
# namespace: tiketi 제거
resources:
  # - namespace.yaml 제거
  - backend/
  - auth-service/
  ...
```

**Step 2:** 각 overlay에 개별 namespace 추가

```yaml
# k8s/overlays/dev/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tiketi  # Dev 환경

# k8s/overlays/staging/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tiketi-staging  # Staging 환경

# k8s/overlays/prod/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tiketi  # Production 환경
```

**Step 3:** 각 overlay kustomization.yaml에 포함

```yaml
# k8s/overlays/staging/kustomization.yaml
namespace: tiketi-staging
resources:
  - namespace.yaml  # 자신의 네임스페이스만 생성
  - ../../base
```

**결과:**
- ✅ Dev app → `tiketi` 네임스페이스만 관리
- ✅ Staging app → `tiketi-staging` 네임스페이스만 관리
- ✅ Prod app → `tiketi` 네임스페이스만 관리 (별도 클러스터)

### 수정 파일
- `k8s/base/kustomization.yaml` (namespace 정의 제거)
- `k8s/overlays/dev/namespace.yaml` (신규)
- `k8s/overlays/dev/kustomization.yaml` (namespace.yaml 포함)
- `k8s/overlays/staging/namespace.yaml` (신규)
- `k8s/overlays/staging/kustomization.yaml` (namespace.yaml 포함)
- `k8s/overlays/prod/namespace.yaml` (신규)
- `k8s/overlays/prod/kustomization.yaml` (namespace.yaml 포함)

---

## 🟢 Issue #4: ArgoCD 스펙 오류 (LOW)

### 문제점
**심각도:** 🟢 LOW
**영향:** ArgoCD 기능이 의도대로 작동하지 않음

**4-1: Invalid spec.health**

```yaml
# argocd/applications/tiketi-dev.yaml
spec:
  health:  # ❌ Application v1alpha1에 없는 필드
    pass: true
```

ArgoCD Application 스펙에 `spec.health` 필드가 존재하지 않아 무시됨.

**해결:** 해당 섹션 삭제

**4-2: 잘못된 알림 위치**

```yaml
# argocd/applications/tiketi-prod.yaml
spec:
  source:
    kustomize:
      commonAnnotations:
        # ❌ 워크로드에만 붙음, Application 알림 X
        notifications.argoproj.io/subscribe.on-deployed.slack: tiketi-prod
```

`kustomize.commonAnnotations`는 Deployment/Service 같은 워크로드에 붙어서 ArgoCD 알림으로 작동 안 함.

**해결:** `metadata.annotations`로 이동

```yaml
# argocd/applications/tiketi-prod.yaml (수정 후)
metadata:
  annotations:
    # ✅ Application 자체 annotations
    notifications.argoproj.io/subscribe.on-deployed.slack: tiketi-prod-deployments
    notifications.argoproj.io/subscribe.on-health-degraded.slack: tiketi-prod-alerts
```

### 수정 파일
- `argocd/applications/tiketi-dev.yaml` (spec.health 제거)
- `argocd/applications/tiketi-prod.yaml` (알림 annotations 이동)

---

## 📊 수정 전후 비교

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| **initContainers** | Base에 하드코딩 (postgres-service) | Dev overlay만 환경변수 기반 패치 |
| **Staging/Prod 시작** | 무한 대기 (배포 실패) | ✅ 즉시 시작 |
| **Secrets 구조** | secretGenerator + 파일 (키 1개) | SealedSecret 리소스 (키 4개) |
| **환경변수** | `secrets.enc.yaml` 키만 존재 | ✅ DB_PASSWORD, JWT_SECRET 등 정상 |
| **Namespace 관리** | Base에 고정 (충돌 위험) | ✅ Overlay별 독립 관리 |
| **ArgoCD 스펙** | Invalid fields (무시됨) | ✅ 정확한 스펙 |
| **알림 설정** | 워크로드에 붙음 (미작동) | ✅ Application annotations |

---

## ✅ 수정 완료 체크리스트

- [x] **Issue #1:** Base deployments에서 initContainers 제거
- [x] **Issue #1:** Dev overlay에 환경변수 기반 wait 패치 추가
- [x] **Issue #2:** Staging/Prod SealedSecret 리소스 생성
- [x] **Issue #2:** Staging/Prod secretGenerator 제거
- [x] **Issue #3:** Base에서 namespace.yaml 제거
- [x] **Issue #3:** 각 overlay에 개별 namespace.yaml 추가
- [x] **Issue #4:** ArgoCD spec.health 제거
- [x] **Issue #4:** ArgoCD 알림 annotations 위치 수정

---

## 🧪 검증 방법

### 1. Kustomize Build 테스트

```bash
# Dev (initContainers 있어야 함)
kubectl kustomize k8s/overlays/dev | grep -A5 "initContainers"
# 예상: wait-for-database, wait-for-cache 존재

# Staging (initContainers 없어야 함)
kubectl kustomize k8s/overlays/staging | grep "initContainers"
# 예상: 결과 없음

# Prod (initContainers 없어야 함)
kubectl kustomize k8s/overlays/prod | grep "initContainers"
# 예상: 결과 없음
```

### 2. Secret 구조 확인

```bash
# Staging secrets 확인
kubectl kustomize k8s/overlays/staging | yq eval 'select(.kind == "SealedSecret")'
# 예상: encryptedData에 DB_PASSWORD, JWT_SECRET, ADMIN_PASSWORD, INTERNAL_API_TOKEN

# SealedSecret이 실제 Secret으로 변환되는지 확인
kubectl kustomize k8s/overlays/staging | yq eval 'select(.kind == "SealedSecret") | .spec.template.metadata.name'
# 예상: tiketi-secret
```

### 3. Namespace 독립성 확인

```bash
# Dev
kubectl kustomize k8s/overlays/dev | grep "namespace:" | sort | uniq
# 예상: namespace: tiketi만 존재

# Staging
kubectl kustomize k8s/overlays/staging | grep "namespace:" | sort | uniq
# 예상: namespace: tiketi-staging만 존재

# Prod
kubectl kustomize k8s/overlays/prod | grep "namespace:" | sort | uniq
# 예상: namespace: tiketi만 존재
```

### 4. ArgoCD Application 스펙 검증

```bash
# spec.health 없는지 확인
yq eval '.spec.health' argocd/applications/tiketi-dev.yaml
# 예상: null

# Prod annotations 위치 확인
yq eval '.metadata.annotations' argocd/applications/tiketi-prod.yaml
# 예상: notifications.argoproj.io/* 존재
```

---

## ⚠️ 남은 작업

### 1. Sealed Secrets 암호화 (필수 - Production 배포 전)

현재는 PLACEHOLDER 값이므로 실제 암호화 필요:

```bash
# 1. Sealed Secrets Controller 설치 (EKS 클러스터)
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# 2. Public key 가져오기
kubeseal --fetch-cert --controller-name=sealed-secrets-controller --controller-namespace=kube-system > pub-cert.pem

# 3. 강력한 secrets 생성
export DB_PASSWORD=$(openssl rand -base64 48)
export JWT_SECRET=$(openssl rand -base64 48)
export ADMIN_PASSWORD=$(openssl rand -base64 48)
export INTERNAL_API_TOKEN=$(openssl rand -base64 48)

# 4. Plain Secret 생성
kubectl create secret generic tiketi-secret \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  --from-literal=INTERNAL_API_TOKEN="$INTERNAL_API_TOKEN" \
  --namespace=tiketi \
  --dry-run=client -o yaml > plain-secret.yaml

# 5. Kubeseal로 암호화
kubeseal --format=yaml --cert=pub-cert.pem \
  < plain-secret.yaml > k8s/overlays/prod/secrets.enc.yaml

# 6. Plain secret 즉시 삭제
shred -u plain-secret.yaml  # Linux
rm -P plain-secret.yaml     # macOS

# 7. Git commit (암호화된 파일만)
git add k8s/overlays/prod/secrets.enc.yaml
git commit -m "feat(k8s): add encrypted production secrets"
```

### 2. Placeholder 값 교체 (AWS 인프라 준비 후)

- RDS/ElastiCache 엔드포인트
- AWS Account ID
- ECR Repository URLs
- ACM Certificate ARN
- WAF ARN

---

## 📚 참고 자료

### 이전 문서 (이슈 포함)
- `K8S_KUSTOMIZE_MIGRATION_COMPLETE.md` - Kustomize 구조 설명
- `GITHUB_ACTIONS_ARGOCD_COMPLETE.md` - GitHub Actions + ArgoCD 파이프라인

### 공식 문서
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [Kustomize Patches](https://kubectl.docs.kubernetes.io/references/kustomize/patches/)
- [ArgoCD Application Spec](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/)

---

**작성일:** 2026-01-05
**작성자:** Claude Code
**버전:** 1.0.0
**상태:** ✅ Critical Issues Fixed
