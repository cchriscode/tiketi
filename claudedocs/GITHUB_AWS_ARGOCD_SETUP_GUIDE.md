# GitHub Actions + AWS + ArgoCD 설정 가이드 (기존 EKS 클러스터)

> **전제 조건:** EKS 클러스터가 이미 구축되어 있음 (VPC, RDS, ElastiCache, ALB 포함)
>
> **목표:** 기존 인프라에 GitHub Actions CI/CD + ArgoCD GitOps 연결
>
> **난이도:** 초보자 가능 (클릭 단위 설명)
>
> **소요 시간:** 약 40분

![Tiketi AWS Architecture](./_ext_images/2_AWS.png)

---

## 📋 **사전 준비물 (이미 완료된 항목)**

### ✅ **이미 구축된 인프라**
- [x] AWS 계정 및 관리자 권한
- [x] VPC (10.0.0.0/16)
- [x] EKS 클러스터 (ap-northeast-2)
- [x] RDS PostgreSQL (Multi-AZ)
- [x] ElastiCache Redis
- [x] ALB (Application Load Balancer)
- [x] Route53, CloudFront, WAF

### 🔧 **필요한 도구**
- [ ] GitHub 계정 및 리포지토리 (project-ticketing)
- [ ] AWS CLI 설치 및 설정 완료
- [ ] kubectl 설치 완료
- [ ] kubectl이 EKS 클러스터에 연결됨

---

## 🎯 **전체 흐름 요약**

```
0단계: 코드 준비 (5분) ⚠️ 중요!
   ├─ 현재 브랜치를 main에 머지
   ├─ ArgoCD 설정 파일이 main에 있는지 확인
   └─ GitHub Actions 워크플로우 파일 확인

1단계: 사전 확인 (5분)
   ├─ kubectl로 EKS 클러스터 연결 확인
   ├─ AWS Account ID 확인
   └─ 현재 배포 상태 확인 (비어있어도 정상)

2단계: AWS 설정 (20분)
   ├─ ECR 리포지토리 생성 (또는 확인)
   ├─ IAM OIDC Provider 생성 (GitHub Actions 인증)
   ├─ IAM 역할 생성 (GitHub Actions용)
   └─ IAM 정책 연결 (ECR 푸시 권한)

3단계: GitHub 설정 (5분)
   ├─ Repository Secrets 추가
   ├─ repoURL 수정 (argocd/*.yaml)
   └─ Workflow 파일 확인

4단계: ArgoCD 설정 (10분)
   ├─ ArgoCD 설치 (EKS 클러스터)
   ├─ Git 리포지토리 연결
   ├─ Application 생성
   └─ Auto-Sync 활성화

5단계: 테스트 (5분)
   └─ 코드 푸시 → 자동 배포 확인
```

---

# 0단계: 코드 준비 (5분 소요) ⚠️ **필수!**

> **실행 위치:** 💻 **로컬 PC** (Git + VSCode)
>
> **중요:** ArgoCD와 GitHub Actions 설정 파일이 **배포 브랜치** (main 또는 final)에 있어야 합니다!

---

## 0.1 현재 브랜치 확인

### 📍 **작업 중인 브랜치 확인**

**💻 로컬 터미널에서:**

```bash
# 현재 브랜치 확인
git branch

# 출력 예시:
# * mono-kind2  ← 현재 브랜치
#   main
```

### 📍 **필수 파일 확인**

현재 브랜치에 다음 파일들이 있는지 확인:

```bash
# ArgoCD 설정 파일
ls argocd/

# 예상 출력:
# app-of-apps.yaml
# applications/
# projects/

# GitHub Actions 워크플로우
ls .github/workflows/

# 예상 출력:
# backend-ci-cd.yml
# auth-service-ci-cd.yml
# ticket-service-ci-cd.yml
# payment-service-ci-cd.yml
# stats-service-ci-cd.yml
```

**파일이 없으면?** → 이 가이드를 사용할 수 없습니다! 먼저 MSA 코드를 작성해야 합니다.

---

## 0.2 배포 브랜치 선택 (2가지 옵션)

### ⚠️ **왜 특정 브랜치가 필요한가요?**

```
ArgoCD는 지정된 브랜치를 감시 → 해당 브랜치에 없으면 배포 불가!
GitHub Actions도 지정된 브랜치 푸시 시 트리거 → 없으면 실행 안 됨!
```

---

### 🔵 **옵션 1: main 브랜치 사용 (일반적)**

**장점:** 표준 방식, 팀 협업 시 명확
**단점:** main 브랜치 머지 필요

```bash
# 1. 현재 변경사항 커밋
git status
git add .
git commit -m "feat: add MSA architecture with ArgoCD and GitHub Actions"

# 2. main 브랜치로 전환 및 머지
git checkout main
git pull origin main
git merge mono-kind2

# 3. 푸시
git push origin main
```

**다음 단계:** 0.3으로 이동

---

### 🟢 **옵션 2: 원하는 브랜치 사용 (예: final)** ✨

**장점:** main 건드리지 않음, 간단
**단점:** ArgoCD/GitHub Actions 설정 파일 수정 필요

#### **2-1. final 브랜치 생성 및 푸시**

```bash
# 1. 현재 브랜치에서 final 생성
git checkout -b final

# 2. 변경사항 커밋
git add .
git commit -m "feat: add MSA architecture with ArgoCD and GitHub Actions"

# 3. final 브랜치 푸시
git push origin final
```

#### **2-2. ArgoCD 설정 파일 수정**

**모든 ArgoCD Application 파일에서 `targetRevision` 변경:**

```bash
# PowerShell에서 일괄 변경
$files = @(
    "argocd/app-of-apps.yaml",
    "argocd/applications/tiketi-prod.yaml",
    "argocd/applications/tiketi-staging.yaml",
    "argocd/applications/tiketi-dev.yaml"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        (Get-Content $file) -replace 'targetRevision: main', 'targetRevision: final' | Set-Content $file
    }
}

# 확인
git diff argocd/
```

#### **2-3. GitHub Actions 워크플로우 수정**

**모든 워크플로우 파일에서 브랜치 트리거 변경:**

```bash
# PowerShell에서 일괄 변경
$workflows = Get-ChildItem -Path ".github/workflows/*.yml"

foreach ($workflow in $workflows) {
    (Get-Content $workflow.FullName) -replace 'branches: \[main, develop\]', 'branches: [final, develop]' | Set-Content $workflow.FullName
}

# 확인
git diff .github/workflows/
```

#### **2-4. 변경사항 커밋 및 푸시**

```bash
git add argocd/ .github/workflows/
git commit -m "chore: change deployment branch to final"
git push origin final
```

**다음 단계:** 0.3으로 이동 (final 브랜치 기준)

---

## 0.3 GitHub에서 배포 브랜치 확인

### ✅ **브랜치 확인**

**🌐 브라우저에서:**

1. `https://github.com/cchriscode/tiketi` 접속
2. **배포 브랜치 선택** (좌측 상단 브랜치 드롭다운)
   - 옵션 1 선택: `main` 브랜치
   - 옵션 2 선택: `final` 브랜치
3. 다음 파일들이 있는지 확인:
   - ✅ `argocd/app-of-apps.yaml`
   - ✅ `.github/workflows/backend-ci-cd.yml`
   - ✅ `k8s/overlays/prod/kustomization.yaml`

**파일이 보이면 성공!** ✅

### 📍 **로컬 브랜치 전환**

```bash
# 배포 브랜치로 전환
git checkout main    # 옵션 1
# 또는
git checkout final   # 옵션 2

git pull origin main  # 또는 final

# 확인
git branch
# 출력: * main (또는 * final)
```

---

# 1단계: 사전 확인 (5분 소요)

> **실행 위치:** 💻 **로컬 PC 터미널** (PowerShell 또는 Git Bash)
>
> **필요한 것:**
> - AWS CLI 설치 및 설정 완료
> - kubectl 설치 완료
> - EKS 클러스터 접근 권한

---

## 1.1 kubectl로 EKS 클러스터 연결 확인

### 📍 **로컬 터미널 열기**

**Windows:**
- PowerShell 실행 (Win + X → "Windows PowerShell")
- 또는 Git Bash 실행

**Mac/Linux:**
- Terminal 실행

### 📍 **현재 컨텍스트 확인**

```bash
# 현재 연결된 클러스터 확인
kubectl config current-context

# 예상 출력: arn:aws:eks:ap-northeast-2:123456789012:cluster/tiketi-production
```

### 📍 **클러스터 연결 안 되어 있으면**

```bash
# AWS CLI로 kubeconfig 업데이트
aws eks update-kubeconfig --region ap-northeast-2 --name tiketi-production

# 확인
kubectl get nodes

# 예상 출력:
# NAME                                            STATUS   ROLES    AGE   VERSION
# ip-10-0-11-xxx.ap-northeast-2.compute.internal  Ready    <none>   7d    v1.28.x
# ip-10-0-12-xxx.ap-northeast-2.compute.internal  Ready    <none>   7d    v1.28.x
```

---

## 1.2 현재 배포 상태 확인 (비어있어도 정상)

### 📍 **네임스페이스 확인**

```bash
# tiketi 네임스페이스가 있는지 확인
kubectl get namespaces | grep tiketi

# 없으면 정상! (아직 배포 안 했으니까)
# 있으면 확인:
kubectl get all -n tiketi

# 출력이 "No resources found" → 정상! ✅
```

**⚠️ 중요:**
- main에 코드를 머지하기 전이라면 **배포된 것이 없는 게 정상**입니다!
- ArgoCD 설정 후에 자동으로 배포됩니다.

---

## 1.3 AWS Account ID 확인

### 📍 **AWS CLI로 확인**

```bash
# AWS Account ID 확인
aws sts get-caller-identity --query Account --output text

# 출력 예시: 123456789012
```

**메모장에 기록:**
```
AWS_ACCOUNT_ID=123456789012
AWS_REGION=ap-northeast-2
CLUSTER_NAME=tiketi-production
```

---

# 2단계: AWS 설정 (20분 소요)

> **실행 위치:**
> - 1.1 ECR 확인: 💻 **로컬 터미널** (aws CLI)
> - 1.1 ECR 생성: 🌐 **AWS Console** (브라우저)
> - 1.2~1.4: 🌐 **AWS Console** (브라우저)

---

## 1.1 ECR 리포지토리 생성 (또는 확인)

### 📍 **기존 리포지토리 확인 (먼저 확인!)**

**💻 로컬 터미널에서 실행:**

```bash
# AWS CLI로 기존 ECR 리포지토리 확인
aws ecr describe-repositories --region ap-northeast-2 --query 'repositories[].repositoryName' --output table

# 출력 예시:
# -------------------------
# |DescribeRepositories  |
# +-----------------------+
# |  tiketi-backend       |
# |  tiketi-auth-service  |
# +-----------------------+
```

**이미 리포지토리가 있으면 1.1 단계 건너뛰기 ✅**

### 📍 **AWS Console 접속**

**🌐 브라우저에서 실행:**

1. 브라우저에서 https://console.aws.amazon.com/ 접속
2. 우측 상단에서 **리전 선택** → `아시아 태평양 (서울) ap-northeast-2` 선택
3. 상단 검색창에 `ECR` 입력 → **Elastic Container Registry** 클릭

### 📍 **리포지토리 생성 (필요한 것만)**

#### **1번 리포지토리: tiketi-backend**

1. 좌측 메뉴에서 **"프라이빗 리포지토리"** 클릭
2. 우측 상단 **"리포지토리 생성"** 버튼 클릭
3. 설정:
   - **표시 여부 설정**: `프라이빗` (기본값)
   - **리포지토리 이름**: `tiketi-backend`
   - **태그 변경 가능성**: `사용` (체크)
   - **이미지 스캔 설정**: `푸시 시 스캔` (체크 권장)
   - **암호화 설정**: `AES-256` (기본값)
4. 하단 **"리포지토리 생성"** 버튼 클릭

#### **나머지 4개 리포지토리도 동일하게 생성**

- `tiketi-auth-service`
- `tiketi-ticket-service`
- `tiketi-payment-service`
- `tiketi-stats-service`

### ✅ **확인**

ECR 콘솔에서 5개 리포지토리가 보여야 합니다:
```
tiketi-backend
tiketi-auth-service
tiketi-ticket-service
tiketi-payment-service
tiketi-stats-service
```

### 📝 **URI 기록**

각 리포지토리를 클릭하면 **URI**가 표시됩니다:
```
123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend
```

**나중에 사용할 값 기록:**
- **AWS Account ID**: `123456789012` (URI 앞부분)
- **ECR Registry**: `123456789012.dkr.ecr.ap-northeast-2.amazonaws.com`

---

## 1.2 IAM OIDC Provider 생성 (GitHub Actions 인증)

### 📍 **기존 Provider 확인 (먼저 확인!)**

**💻 로컬 터미널에서 실행:**

```bash
# AWS CLI로 기존 OIDC Provider 확인
aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[].Arn' --output table

# 출력에 'token.actions.githubusercontent.com'이 있으면 건너뛰기!
```

**이미 GitHub Actions OIDC Provider가 있으면 1.2 단계 건너뛰기 ✅**

### 📍 **IAM 콘솔 접속**

**🌐 브라우저 (AWS Console)에서:**

1. AWS Console 상단 검색창에 `IAM` 입력 → **IAM** 클릭
2. 좌측 메뉴에서 **"액세스 관리"** → **"자격 증명 공급자"** 클릭
3. 우측 상단 **"공급자 추가"** 버튼 클릭

### 📍 **OIDC 공급자 설정**

1. **공급자 유형**: `OpenID Connect` 선택
2. **공급자 URL**: `https://token.actions.githubusercontent.com` 입력
3. **"지문 가져오기"** 버튼 클릭 (자동으로 지문 입력됨)
4. **대상**: `sts.amazonaws.com` 입력
5. 하단 **"공급자 추가"** 버튼 클릭

### ✅ **확인**

"자격 증명 공급자" 목록에 `token.actions.githubusercontent.com`이 표시되어야 합니다.

---

## 1.3 IAM 역할 생성 (GitHub Actions용)

### 📍 **역할 생성 시작**

1. IAM 콘솔 좌측 메뉴에서 **"액세스 관리"** → **"역할"** 클릭
2. 우측 상단 **"역할 만들기"** 버튼 클릭

### 📍 **신뢰할 수 있는 엔터티 선택**

1. **신뢰할 수 있는 엔터티 유형**: `웹 자격 증명` 선택
2. **자격 증명 공급자**: `token.actions.githubusercontent.com` 선택
3. **대상**: `sts.amazonaws.com` 선택
4. **GitHub 조직**: `cchriscode` 입력
5. **GitHub 리포지토리**: `tiketi` 입력
6. **GitHub 브랜치**: `*` (모든 브랜치 허용) 또는 `main` (main만 허용)
7. **"다음"** 버튼 클릭

### 📍 **권한 정책 추가**

1. 검색창에 `AmazonEC2ContainerRegistryPowerUser` 입력
2. **체크박스 선택**
3. **"다음"** 버튼 클릭

### 📍 **역할 이름 설정**

1. **역할 이름**: `GitHubActionsECRRole` 입력
2. **설명**: `GitHub Actions가 ECR에 이미지를 푸시하는 역할` 입력 (선택)
3. 하단으로 스크롤 → **"역할 만들기"** 버튼 클릭

### ✅ **ARN 기록**

1. "역할" 목록에서 방금 만든 `GitHubActionsECRRole` 클릭
2. 상단에 **ARN** 표시됨:
   ```
   arn:aws:iam::123456789012:role/GitHubActionsECRRole
   ```
3. **복사해서 메모장에 저장** (나중에 GitHub Secrets에 입력)

---

## 1.4 EKS 노드 그룹 IAM 역할 권한 확인

### 📍 **노드 그룹 확인**

**💻 로컬 터미널에서 실행:**

```bash
# 노드 그룹 이름 확인
aws eks list-nodegroups --cluster-name tiketi-production --region ap-northeast-2

# 노드 그룹 상세 정보 확인
aws eks describe-nodegroup --cluster-name tiketi-production --nodegroup-name <nodegroup-name> --region ap-northeast-2 --query 'nodegroup.nodeRole' --output text

# 출력 예시: arn:aws:iam::123456789012:role/eksctl-tiketi-production-nodegro-NodeInstanceRole-xxx
```

### 📍 **ECR 읽기 권한 확인 (중요!)**

**🌐 브라우저 (AWS Console)에서:**

EKS 노드가 ECR에서 이미지를 pull하려면 권한 필요:

1. AWS Console → IAM → 역할 → 위에서 확인한 노드 역할 클릭
2. **"권한"** 탭에서 다음 정책 확인:
   - ✅ `AmazonEC2ContainerRegistryReadOnly` (필수!)
   - ✅ `AmazonEKSWorkerNodePolicy`
   - ✅ `AmazonEKS_CNI_Policy`

3. **`AmazonEC2ContainerRegistryReadOnly`가 없으면 추가:**
   - **"권한 추가"** → **"정책 연결"**
   - `AmazonEC2ContainerRegistryReadOnly` 검색 후 체크
   - **"권한 추가"** 버튼 클릭

**이 권한이 없으면 Pod가 ImagePullBackOff 오류 발생!** ⚠️

---

# 3단계: GitHub 설정 (5분 소요)

> **실행 위치:**
> - 2.1 Secrets 추가: 🌐 **GitHub 웹사이트** (브라우저)
> - 2.2 파일 수정: 💻 **로컬 PC** (VSCode/터미널)

---

## 2.1 Repository Secrets 추가

### 📍 **GitHub 리포지토리 접속**

**🌐 브라우저에서:**

1. 브라우저에서 GitHub 로그인
2. `https://github.com/cchriscode/tiketi` 접속
3. 상단 메뉴에서 **"Settings"** 클릭 (톱니바퀴 아이콘)

### 📍 **Secrets 메뉴 접근**

1. 좌측 메뉴에서 **"Secrets and variables"** 클릭
2. 드롭다운에서 **"Actions"** 클릭

### 📍 **Secret 추가 (총 3개)**

#### **Secret 1: AWS_ACCOUNT_ID**

1. 우측 상단 **"New repository secret"** 버튼 클릭
2. **Name**: `AWS_ACCOUNT_ID`
3. **Secret**: `123456789012` (1.1에서 기록한 Account ID 입력)
4. **"Add secret"** 버튼 클릭

#### **Secret 2: AWS_ROLE_ARN**

1. **"New repository secret"** 버튼 클릭
2. **Name**: `AWS_ROLE_ARN`
3. **Secret**: `arn:aws:iam::123456789012:role/GitHubActionsECRRole` (1.3에서 기록한 ARN 입력)
4. **"Add secret"** 버튼 클릭

#### **Secret 3: DISCORD_WEBHOOK (선택)**

Discord 알림을 받으려면:

1. Discord 서버에서 웹훅 URL 생성
2. **Name**: `DISCORD_WEBHOOK`
3. **Secret**: `https://discord.com/api/webhooks/...` (Discord 웹훅 URL)
4. **"Add secret"** 버튼 클릭

### ✅ **확인**

"Actions secrets" 목록에 다음 항목들이 표시되어야 합니다:
```
AWS_ACCOUNT_ID
AWS_ROLE_ARN
DISCORD_WEBHOOK (선택)
```

---

## 2.2 ArgoCD 매니페스트 파일 수정 (repoURL)

### 📍 **로컬에서 파일 수정**

**💻 로컬 PC에서:**

#### **1. app-of-apps.yaml 수정**

```bash
# 파일 열기
code argocd/app-of-apps.yaml
```

**수정 전 (11줄):**
```yaml
repoURL: 'https://github.com/<ORG>/project-ticketing.git'
```

**수정 후:**
```yaml
repoURL: 'https://github.com/cchriscode/tiketi.git'
```

예시: 실제 리포지토리
```yaml
repoURL: 'https://github.com/cchriscode/tiketi.git'
```

#### **2. applications/*.yaml 수정 (5개 파일)**

다음 파일들도 동일하게 수정:
- `argocd/applications/tiketi-prod.yaml`
- `argocd/applications/tiketi-staging.yaml`
- `argocd/applications/tiketi-dev.yaml`

```bash
# 한 번에 수정 (PowerShell)
cd C:\Users\USER\project-ticketing

# 자신의 GitHub 사용자명으로 변경
$USERNAME = "cchriscode"

# 모든 ArgoCD 파일에서 repoURL 수정
(Get-Content argocd/app-of-apps.yaml) -replace '<ORG>', $USERNAME | Set-Content argocd/app-of-apps.yaml
(Get-Content argocd/applications/tiketi-prod.yaml) -replace '<ORG>', $USERNAME | Set-Content argocd/applications/tiketi-prod.yaml
(Get-Content argocd/applications/tiketi-staging.yaml) -replace '<ORG>', $USERNAME | Set-Content argocd/applications/tiketi-staging.yaml
(Get-Content argocd/applications/tiketi-dev.yaml) -replace '<ORG>', $USERNAME | Set-Content argocd/applications/tiketi-dev.yaml
```

#### **3. Git 커밋 & 푸시**

```bash
git add argocd/
git commit -m "chore: update ArgoCD repoURL with actual GitHub username"
git push origin main
```

---

## 2.3 Kustomize 이미지 경로 확인

### 📍 **이미지 경로 업데이트**

GitHub Actions가 자동으로 업데이트하지만, 초기값 확인:

```bash
# 파일 열기
code k8s/overlays/prod/kustomization.yaml
```

**확인할 부분:**
```yaml
images:
  - name: tiketi-backend
    newName: 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend
    newTag: latest  # GitHub Actions가 자동 업데이트
```

**수정 필요 시:**
- `123456789012`를 본인의 AWS Account ID로 변경
- `ap-northeast-2`를 본인의 리전으로 변경

---

# 4단계: ArgoCD 설치 및 설정 (10분 소요)

> **실행 위치:**
> - 3.1~3.5: 💻 **로컬 터미널** (kubectl 명령어)
> - 3.2 UI 접속: 🌐 **브라우저** (ArgoCD 웹 UI)
> - 3.3 Git 연결: 🌐 **브라우저** (ArgoCD 웹 UI)

---

## 3.1 ArgoCD 설치 (EKS 클러스터)

### 📍 **ArgoCD 이미 설치되어 있는지 확인**

**💻 로컬 터미널에서 실행:**

```bash
# ArgoCD 네임스페이스 확인
kubectl get namespace argocd

# 이미 있으면:
# NAME     STATUS   AGE
# argocd   Active   7d

# ArgoCD Pod 확인
kubectl get pods -n argocd

# Pod가 이미 Running이면 3.1 단계 건너뛰기 ✅
```

### 📍 **ArgoCD 네임스페이스 생성 (없으면)**

```bash
kubectl create namespace argocd
```

### 📍 **ArgoCD 설치 (2가지 방법)**

---

#### **🔵 방법 1: Manifest 설치 (간단)**

**장점:** 빠르고 간단, 초기 테스트용
**단점:** 설정 변경 어려움, 업그레이드 복잡

```bash
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

---

#### **🟢 방법 2: Helm Chart 설치 (프로덕션 권장)** ✨

**장점:**
- ✅ 설정 커스터마이징 쉬움
- ✅ 업그레이드/롤백 간편
- ✅ 값 파일로 설정 관리 (values.yaml)
- ✅ HA 구성 쉬움
- ✅ 버전 관리 명확

**단점:** Helm 이해 필요 (하지만 어렵지 않음)

##### **2-1. Helm 설치 확인**

```bash
# Helm 버전 확인
helm version

# 없으면 설치:
# Windows (Chocolatey)
choco install kubernetes-helm

# Mac
brew install helm

# Linux
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

##### **2-2. ArgoCD Helm 리포지토리 추가**

```bash
# Helm 리포지토리 추가
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# ArgoCD Chart 확인
helm search repo argo/argo-cd

# 출력 예시:
# NAME           CHART VERSION  APP VERSION  DESCRIPTION
# argo/argo-cd   5.51.6         v2.9.3       A Helm chart for ArgoCD
```

##### **2-3. values.yaml 생성 (커스터마이징)**

**💻 로컬에서 파일 생성:**

```bash
# argocd-values.yaml 파일 생성
cat > argocd-values.yaml <<EOF
# ArgoCD Server 설정
server:
  # Ingress 설정 (ALB 사용 시)
  ingress:
    enabled: true
    ingressClassName: alb
    annotations:
      alb.ingress.kubernetes.io/scheme: internet-facing
      alb.ingress.kubernetes.io/target-type: ip
      alb.ingress.kubernetes.io/certificate-arn: <ACM-CERTIFICATE-ARN>  # ACM 인증서 ARN
      alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
      alb.ingress.kubernetes.io/ssl-redirect: '443'
    hosts:
      - argocd.tiketi.com  # 본인 도메인으로 변경
    tls:
      - secretName: argocd-tls
        hosts:
          - argocd.tiketi.com

  # 리소스 제한
  resources:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 250m
      memory: 256Mi

# Redis HA 설정 (프로덕션)
redis-ha:
  enabled: true

# Controller 설정
controller:
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi

# Repo Server 설정
repoServer:
  resources:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 250m
      memory: 256Mi

# Global 설정
global:
  # 이미지 Pull Policy
  image:
    pullPolicy: IfNotPresent

# Config 설정
configs:
  # 기본 프로젝트 생성
  params:
    server.insecure: true  # 로컬 테스트 시 (프로덕션은 false)
EOF
```

**간단한 버전 (로컬 테스트용):**

```bash
cat > argocd-values-simple.yaml <<EOF
# 최소 설정 (로컬 테스트)
server:
  service:
    type: LoadBalancer  # 또는 NodePort

configs:
  params:
    server.insecure: true
EOF
```

##### **2-4. Helm으로 ArgoCD 설치**

**프로덕션 설정:**

```bash
# values.yaml 사용해서 설치
helm install argocd argo/argo-cd \
  --namespace argocd \
  --create-namespace \
  --values argocd-values.yaml

# 설치 확인
helm list -n argocd

# 출력 예시:
# NAME    NAMESPACE  REVISION  UPDATED                   STATUS    CHART           APP VERSION
# argocd  argocd     1         2024-01-07 10:00:00 KST   deployed  argo-cd-5.51.6  v2.9.3
```

**간단한 설치 (로컬 테스트):**

```bash
# 기본 설정으로 설치
helm install argocd argo/argo-cd \
  --namespace argocd \
  --create-namespace \
  --set server.service.type=LoadBalancer

# 또는 간단한 values 파일 사용
helm install argocd argo/argo-cd \
  --namespace argocd \
  --create-namespace \
  --values argocd-values-simple.yaml
```

##### **2-5. Helm 설치 장점 (업그레이드 예시)**

```bash
# 버전 업그레이드
helm upgrade argocd argo/argo-cd \
  --namespace argocd \
  --values argocd-values.yaml

# 설정만 변경
helm upgrade argocd argo/argo-cd \
  --namespace argocd \
  --values argocd-values-updated.yaml

# 롤백
helm rollback argocd -n argocd

# 삭제
helm uninstall argocd -n argocd
```

---

### ✅ **설치 확인 (두 방법 공통)**

```bash
# Pod 상태 확인 (모두 Running이 될 때까지 2-3분 대기)
kubectl get pods -n argocd

# Manifest 설치 시 출력:
# NAME                                  READY   STATUS    RESTARTS   AGE
# argocd-server-xxxx                    1/1     Running   0          2m
# argocd-repo-server-xxxx               1/1     Running   0          2m
# argocd-application-controller-xxxx    1/1     Running   0          2m
# argocd-redis-xxxx                     1/1     Running   0          2m

# Helm 설치 시 출력 (HA 구성):
# NAME                                               READY   STATUS    RESTARTS   AGE
# argocd-application-controller-xxxx                 1/1     Running   0          2m
# argocd-redis-ha-haproxy-xxxx                       1/1     Running   0          2m
# argocd-redis-ha-server-0                           1/1     Running   0          2m
# argocd-redis-ha-server-1                           1/1     Running   0          2m
# argocd-redis-ha-server-2                           1/1     Running   0          2m
# argocd-repo-server-xxxx                            1/1     Running   0          2m
# argocd-server-xxxx                                 1/1     Running   0          2m

# Helm 설치 확인
helm list -n argocd
```

---

## 3.2 ArgoCD UI 접속

### 📍 **ArgoCD Ingress 확인 (운영 환경)**

**💻 로컬 터미널에서 실행:**

이미 ALB가 설정되어 있다면 Ingress로 접속 가능:

```bash
# ArgoCD Ingress 확인
kubectl get ingress -n argocd

# Ingress가 있으면 ADDRESS 확인:
# NAME               CLASS   HOSTS                   ADDRESS
# argocd-ingress     alb     argocd.tiketi.com       xxx.ap-northeast-2.elb.amazonaws.com
```

**Ingress가 있으면:** `https://argocd.tiketi.com` 접속

**Ingress가 없으면 포트포워딩:**

```bash
# 로컬에서 ArgoCD UI 접속 (8080 포트)
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

**별도 터미널을 열어서 실행** (종료하지 말 것!)

### 📍 **초기 비밀번호 확인**

```bash
# Windows (PowerShell)
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | ForEach-Object { [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_)) }

# Mac/Linux
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

**출력 예시:**
```
aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

**복사해서 메모장에 저장!**

### 📍 **브라우저 접속**

**🌐 브라우저에서:**

1. 브라우저에서 `https://localhost:8080` 접속
2. **경고 무시** → "고급" → "계속 진행" 클릭 (자체 서명 인증서)
3. 로그인:
   - **Username**: `admin`
   - **Password**: 위에서 확인한 초기 비밀번호 입력
4. **"SIGN IN"** 버튼 클릭

### 📍 **비밀번호 변경 (권장)**

1. 좌측 메뉴에서 **"User Info"** 클릭
2. **"Update Password"** 클릭
3. 새 비밀번호 입력 후 저장

---

## 3.3 Git 리포지토리 연결

### 📍 **리포지토리 추가**

**🌐 ArgoCD 웹 UI에서:**

1. ArgoCD UI 좌측 메뉴에서 **"Settings"** (톱니바퀴 아이콘) 클릭
2. **"Repositories"** 클릭
3. 우측 상단 **"+ Connect Repo"** 버튼 클릭

### 📍 **리포지토리 정보 입력**

1. **Connection method**: `VIA HTTPS` 선택
2. **Type**: `git` 선택
3. **Repository URL**: `https://github.com/cchriscode/tiketi.git`
4. **Username**: GitHub 사용자명 입력 (공개 리포지토리면 비워도 됨)
5. **Password**: GitHub Personal Access Token 입력 (공개 리포지토리면 비워도 됨)
   - Token 생성: GitHub → Settings → Developer settings → Personal access tokens → Generate new token
   - 권한: `repo` 체크
6. 하단 **"CONNECT"** 버튼 클릭

### ✅ **확인**

"Repositories" 목록에 `https://github.com/cchriscode/tiketi.git`이 표시되고,
**"Successful"** 상태여야 합니다.

---

## 3.4 ArgoCD Project 생성

### 📍 **Project 매니페스트 적용**

**💻 로컬 터미널에서 실행:**

```bash
# 로컬 터미널에서
kubectl apply -f argocd/projects/tiketi-project.yaml
```

### ✅ **확인**

ArgoCD UI에서:
1. **"Settings"** → **"Projects"** 클릭
2. `tiketi` 프로젝트가 표시되어야 함

---

## 3.5 Application 생성 (App of Apps 패턴)

### 📍 **App of Apps 적용**

**💻 로컬 터미널에서 실행:**

```bash
# App of Apps 매니페스트 적용
kubectl apply -f argocd/app-of-apps.yaml
```

### 📍 **ArgoCD UI에서 확인**

**🌐 브라우저 (ArgoCD UI)에서:**

1. 좌측 메뉴에서 **"Applications"** 클릭
2. `tiketi-apps` 애플리케이션이 생성됨
3. 클릭하면 하위 애플리케이션들이 자동으로 생성됨:
   - `tiketi-dev`
   - `tiketi-staging`
   - `tiketi-prod`

### 📍 **수동 Sync (첫 배포)**

1. `tiketi-prod` 애플리케이션 클릭
2. 상단 **"SYNC"** 버튼 클릭
3. **"SYNCHRONIZE"** 버튼 클릭
4. 배포 진행 상황 확인 (2-3분 소요)

### ✅ **확인**

```bash
# 배포된 Pod 확인
kubectl get pods -n tiketi

# 예상 출력:
# NAME                              READY   STATUS    RESTARTS   AGE
# backend-xxxx                      1/1     Running   0          2m
# auth-service-xxxx                 1/1     Running   0          2m
# ticket-service-xxxx               1/1     Running   0          2m
# payment-service-xxxx              1/1     Running   0          2m
# stats-service-xxxx                1/1     Running   0          2m
```

---

## 3.6 Auto-Sync 활성화

### 📍 **자동 동기화 설정**

**📝 참고:** 이미 매니페스트에 설정되어 있음

ArgoCD 매니페스트에 이미 설정되어 있음:

```yaml
# argocd/applications/tiketi-prod.yaml
spec:
  syncPolicy:
    automated:
      prune: true      # Git에서 삭제된 리소스 자동 삭제
      selfHeal: true   # K8s 변경사항 자동 복구
```

### 📍 **UI에서 확인**

**🌐 브라우저 (ArgoCD UI)에서:**

1. `tiketi-prod` 애플리케이션 클릭
2. 상단 **"APP DETAILS"** 버튼 클릭
3. **"SYNC POLICY"** 섹션:
   - **Automated**: `Enabled`
   - **Prune Resources**: `Enabled`
   - **Self Heal**: `Enabled`

---

# 5단계: 전체 파이프라인 테스트 (5분 소요)

> **실행 위치:**
> - 4.1 코드 수정: 💻 **로컬 PC** (VSCode/에디터)
> - 4.2~4.5: 🌐 **브라우저** (GitHub/ArgoCD 확인)

---

## 4.1 코드 수정 및 푸시

### 📍 **테스트용 코드 수정**

**💻 로컬 PC에서:**

```bash
# backend/src/server.js 파일 열기
code backend/src/server.js
```

**파일 끝에 주석 추가:**
```javascript
// Test deployment pipeline - v1.0.0
```

### 📍 **Git 커밋 & 푸시**

```bash
git add backend/src/server.js
git commit -m "test: trigger GitHub Actions pipeline"
git push origin main
```

---

## 4.2 GitHub Actions 실행 확인

### 📍 **GitHub Actions 페이지 접속**

**🌐 브라우저에서:**

1. GitHub 리포지토리에서 상단 **"Actions"** 탭 클릭
2. 방금 푸시한 커밋에 대한 워크플로우가 실행 중
3. `Backend CI/CD` 워크플로우 클릭

### 📍 **실행 단계 확인**

1. **build-and-push** Job:
   - ✅ Checkout code
   - ✅ Configure AWS credentials
   - ✅ Login to Amazon ECR
   - ✅ Build Docker image
   - ✅ Run security scan
   - ✅ Push to ECR

2. **update-manifests** Job:
   - ✅ Update Kustomize image tag
   - ✅ Commit and push changes

3. **notify** Job (Discord 설정 시):
   - ✅ Send Discord notification

### ✅ **성공 확인**

모든 단계가 **초록색 체크 표시** ✅

---

## 4.3 Git 리포지토리 변경 확인

### 📍 **kustomization.yaml 업데이트 확인**

**🌐 브라우저 (GitHub)에서:**

1. GitHub 리포지토리에서 `k8s/overlays/prod/kustomization.yaml` 파일 열기
2. 최근 커밋 확인:
   ```
   chore(k8s): update backend image to abc1234-20260107-120000 [prod]

   🤖 Generated with Claude Code
   Co-Authored-By: Claude Sonnet 4.5
   ```

3. 파일 내용 확인:
   ```yaml
   images:
     - name: tiketi-backend
       newName: 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend
       newTag: abc1234-20260107-120000  # ← 자동 업데이트됨!
   ```

---

## 4.4 ArgoCD 동기화 확인

### 📍 **ArgoCD UI 접속**

**💻 로컬 터미널에서 포트포워딩:**

```bash
# 포트포워딩이 실행 중이 아니면 다시 실행
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

### 📍 **동기화 상태 확인**

**🌐 브라우저 (ArgoCD UI)에서:**

1. `https://localhost:8080` 접속
2. `tiketi-prod` 애플리케이션 클릭
3. 상태 확인:
   - **Sync Status**: `Synced` (초록색)
   - **Health Status**: `Healthy` (초록색)

### 📍 **배포 이력 확인**

1. 상단 **"HISTORY AND ROLLBACK"** 탭 클릭
2. 최근 Sync 이력 확인:
   - Revision: `abc1234` (Git 커밋 SHA)
   - Message: `chore(k8s): update backend image...`

---

## 4.5 실제 Pod 업데이트 확인

### 📍 **Pod 이미지 확인**

**💻 로컬 터미널에서 실행:**

```bash
# Backend Pod 이미지 확인
kubectl get pod -n tiketi -l app=backend -o jsonpath='{.items[0].spec.containers[0].image}'

# 출력 예시:
# 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend:abc1234-20260107-120000
```

### 📍 **롤링 업데이트 확인**

```bash
# Deployment 이벤트 확인
kubectl describe deployment backend -n tiketi | grep -A 5 Events

# 출력 예시:
# Events:
#   Type    Reason             Age   From                   Message
#   ----    ------             ----  ----                   -------
#   Normal  ScalingReplicaSet  2m    deployment-controller  Scaled up replica set backend-abc1234 to 1
#   Normal  ScalingReplicaSet  1m    deployment-controller  Scaled down replica set backend-old123 to 0
```

---

# 5단계: 트러블슈팅

## 5.1 GitHub Actions 실패 시

### ❌ **"Error: Credentials could not be loaded"**

**원인:** IAM 역할 ARN이 잘못됨

**해결:**
1. GitHub Secrets에서 `AWS_ROLE_ARN` 확인
2. AWS IAM 콘솔에서 `GitHubActionsECRRole` ARN 다시 복사
3. GitHub Secrets 업데이트

---

### ❌ **"denied: User is not authorized to perform: ecr:PutImage"**

**원인:** IAM 역할에 ECR 권한 없음

**해결:**
1. AWS IAM 콘솔에서 `GitHubActionsECRRole` 클릭
2. **"권한"** 탭 → **"권한 추가"** → **"정책 연결"**
3. `AmazonEC2ContainerRegistryPowerUser` 검색 후 연결

---

### ❌ **"Repository does not exist"**

**원인:** ECR 리포지토리가 없음

**해결:**
1. AWS ECR 콘솔에서 리포지토리 생성 (1.1 참고)
2. 리포지토리 이름 정확히 확인: `tiketi-backend` (하이픈 주의!)

---

## 5.2 ArgoCD 동기화 실패 시

### ❌ **"repository not found"**

**원인:** Git 리포지토리 URL이 잘못됨

**해결:**
1. ArgoCD UI → Settings → Repositories 확인
2. 리포지토리 URL이 정확한지 확인
3. `argocd/app-of-apps.yaml`의 `repoURL` 수정

---

### ❌ **"ImagePullBackOff"**

**원인:** EKS 노드가 ECR 접근 권한 없음

**해결:**
1. EKS 노드 그룹 IAM 역할 확인
2. 다음 정책 연결:
   - `AmazonEC2ContainerRegistryReadOnly`

```bash
# eksctl로 노드 그룹 IAM 역할 확인
eksctl get nodegroup --cluster tiketi-production

# IAM 콘솔에서 해당 역할에 정책 연결
```

---

### ❌ **"ComparisonError: Manifest generation error"**

**원인:** Kustomize 문법 오류

**해결:**
```bash
# 로컬에서 Kustomize 빌드 테스트
kubectl kustomize k8s/overlays/prod

# 오류 메시지 확인 후 수정
```

---

## 5.3 Pod 상태 확인

### 📍 **Pod 로그 확인**

```bash
# 최신 Backend Pod 로그 확인
kubectl logs -n tiketi -l app=backend --tail=100

# 특정 Pod 로그 확인
kubectl logs -n tiketi backend-abc1234-xxxx
```

### 📍 **Pod 상세 정보 확인**

```bash
# Pod 이벤트 확인
kubectl describe pod -n tiketi backend-abc1234-xxxx

# 실패 원인 확인
kubectl get events -n tiketi --sort-by='.lastTimestamp'
```

---

# 6단계: 롤백 테스트

## 6.1 Git Revert로 롤백

### 📍 **이전 커밋으로 롤백**

```bash
# Git 로그 확인
git log --oneline k8s/overlays/prod/kustomization.yaml

# 출력:
# abc1234 chore(k8s): update backend image to abc1234-20260107-120000
# def5678 chore(k8s): update backend image to def5678-20260107-100000

# 최근 커밋 되돌리기
git revert abc1234

# 푸시
git push origin main
```

### 📍 **ArgoCD 자동 롤백 확인**

1. ArgoCD UI에서 `tiketi-prod` 확인
2. 3분 이내 자동으로 이전 이미지로 롤백
3. Pod가 이전 버전으로 재배포됨

---

# 7단계: 프로덕션 체크리스트

배포 전 반드시 확인:

## ✅ **0단계: 코드 준비**
- [ ] 현재 브랜치 확인 (mono-kind2 등)
- [ ] ArgoCD 설정 파일 확인 (argocd/*.yaml)
- [ ] GitHub Actions 워크플로우 확인 (.github/workflows/*.yml)
- [ ] **배포 브랜치 선택** (main 또는 final)
  - [ ] 옵션 1: main 브랜치에 머지
  - [ ] 옵션 2: final 브랜치 생성 + 설정 파일 수정
- [ ] GitHub에서 배포 브랜치에 파일 확인

## ✅ **1단계: 인프라 확인**
- [ ] EKS 클러스터 접속 확인 (`kubectl get nodes`)
- [ ] RDS PostgreSQL 엔드포인트 확인
- [ ] ElastiCache Redis 엔드포인트 확인
- [ ] ALB 생성 확인
- [ ] AWS Account ID 기록
- [ ] tiketi 네임스페이스 비어있음 확인 (정상)

## ✅ **2단계: AWS 설정**
- [ ] ECR 리포지토리 5개 생성 (또는 확인) 완료
- [ ] IAM OIDC Provider 생성 (또는 확인) 완료
- [ ] IAM 역할 ARN GitHub Secrets에 등록
- [ ] EKS 노드 그룹 ECR 읽기 권한 확인

## ✅ **3단계: GitHub 설정**
- [ ] GitHub Secrets 등록 (AWS_ACCOUNT_ID, AWS_ROLE_ARN)
- [ ] GitHub repoURL 수정 완료 (argocd/*.yaml)
- [ ] Workflow 파일 확인

## ✅ **4단계: ArgoCD 설정**
- [ ] ArgoCD 설치 및 로그인 성공
- [ ] Git 리포지토리 연결 성공 (배포 브랜치)
- [ ] App of Apps 배포 성공
- [ ] Auto-Sync 활성화 확인

## ✅ **5단계: 테스트**
- [ ] 테스트 배포 성공
- [ ] Pod 롤링 업데이트 확인
- [ ] 롤백 테스트 성공
- [ ] Discord 알림 설정 (선택)

---

# 8단계: 추가 최적화

## 8.1 Webhook 설정 (3분 감지 → 즉시 감지)

### 📍 **GitHub Webhook 생성**

1. GitHub 리포지토리 → Settings → Webhooks
2. **"Add webhook"** 클릭
3. **Payload URL**: `https://argocd-server-url/api/webhook`
4. **Content type**: `application/json`
5. **Secret**: ArgoCD webhook secret
6. **"Add webhook"** 클릭

**효과:** Git 푸시 즉시 ArgoCD 동기화 (3분 대기 불필요)

---

## 8.2 Notifications 설정

### 📍 **Slack 알림**

```bash
# ArgoCD Notifications 설치
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj-labs/argocd-notifications/stable/manifests/install.yaml
```

**Slack Webhook 설정:**
1. ArgoCD UI → Settings → Notifications
2. Slack Webhook URL 입력
3. 알림 트리거 설정 (Sync 성공/실패 등)

---

# 요약

## ✅ **설정 완료 후 자동화 플로우**

```
개발자가 코드 푸시
    ↓
GitHub Actions 자동 실행 (2-3분)
    ├─ 테스트
    ├─ 빌드
    ├─ ECR 푸시
    ├─ kustomization.yaml 업데이트
    └─ Git 커밋
    ↓
ArgoCD 자동 감지 (3분 이내 또는 Webhook 즉시)
    ├─ Git 변경 감지
    ├─ kubectl apply (기존 EKS 클러스터)
    └─ Pod 롤링 업데이트
    ↓
배포 완료! (총 5-6분)
```

## 🎯 **핵심 포인트**

1. **사전 확인**: kubectl로 EKS 클러스터 접속 확인
2. **AWS**: IAM 역할 + ECR 리포지토리 + 노드 권한
3. **GitHub**: Secrets 설정 + repoURL 수정
4. **ArgoCD**: 설치 + Git 연결 + Auto-Sync
5. **테스트**: 코드 푸시 → 자동 배포 확인

## 📊 **기존 인프라 활용**

이미 구축된 AWS 인프라:
- ✅ VPC (10.0.0.0/16)
- ✅ EKS 클러스터
- ✅ RDS PostgreSQL
- ✅ ElastiCache Redis
- ✅ ALB (Application Load Balancer)
- ✅ Route53, CloudFront, WAF

추가로 설정한 것:
- ✅ ECR (이미지 저장소)
- ✅ GitHub Actions (CI)
- ✅ ArgoCD (CD)

---

**작성일:** 2026-01-07
**대상 환경:** 기존 EKS 클러스터 (ap-northeast-2)
**최종 검증:** EKS 1.28, ArgoCD 2.9, GitHub Actions
