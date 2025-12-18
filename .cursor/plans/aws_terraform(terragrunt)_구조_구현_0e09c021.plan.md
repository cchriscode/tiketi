---
name: AWS Terraform(Terragrunt) 구조/구현
overview: drawio 아키텍처(ap-northeast-2, Global edge 포함)를 EKS+Terragrunt로 구현하기 위한 디렉토리 구조, 스택 분리, 적용 순서, GitHub OIDC 기반 운영 플로우를 확정한다.
todos:
  - id: bootstrap-state
    content: S3 state bucket + DynamoDB lock을 만드는 bootstrap 스택 설계/구현(terragrunt 적용 포함)
    status: completed
  - id: terragrunt-layout
    content: terraform/modules + terraform/live 구조 생성 및 공통 terragrunt.hcl 패턴 확정
    status: completed
  - id: network-stack
    content: VPC/subnet/NAT per AZ/route table/EKS subnet tags 포함 네트워크 스택 작성
    status: completed
  - id: eks-stack
    content: terraform-aws-modules/eks 기반 EKS+managed node groups 작성
    status: completed
  - id: irsa-stack
    content: aws-load-balancer-controller/external-dns/ebs-csi 등 IRSA role/policy 스택 작성
    status: completed
  - id: data-stacks
    content: RDS Postgres Multi-AZ + Redis replication group 스택 작성(보안그룹 포함)
    status: completed
  - id: edge-stack
    content: Route53/ACM(us-east-1 + ap-northeast-2)/CloudFront/WAF/S3 정적 호스팅 스택 작성
    status: completed
  - id: gha-oidc-roles
    content: GitHub OIDC 기반 role 3개(plan/apply/deploy) IAM 스택 작성 및 기존 workflow 연동 방향 제시
    status: in_progress
---

## 목표(확정된 전제)

- **Region**: `ap-northeast-2`
- **K8s**: **EKS**(Managed control plane + managed node groups)
- **IaC 운영**: **Terragrunt**(`live/` + `modules/`)
- **State/Lock**: **S3 + DynamoDB**(bootstrap 스택 필요)
- **Env**: **single AWS account, multi env**(dev/stage/prod)
- **Ingress/TLS/DNS**: **AWS LB Controller + ACM + Route53(+external-dns)**
- **GitOps**: ArgoCD가 애드온/앱 소유(Terraform은 클러스터/IRSA/권한/외부리소스)
- **모듈 전략**: `terraform-aws-modules` 적극 사용
- **NAT**: **AZ별 NAT 1개씩**
- **DB/Cache**: **RDS PostgreSQL Multi-AZ**, **ElastiCache Redis replication group**
- **CI**: GitHub Actions OIDC + role 분리(plan/apply/deploy)

## 아키텍처 → Terraform 스택 분해(권한/의존성 기준)

- **Global(Edge) 스택**
  - Route53 Hosted Zone(또는 기존 zone data source)
  - CloudFront + WAF
  - S3(정적 사이트 origin)
  - ACM(CloudFront용 **us-east-1** 인증서)
- **Region(ap-northeast-2) Core 스택**
  - VPC `10.0.0.0/16`
  - Public subnets: `10.0.1.0/24`(A), `10.0.2.0/24`(B)
  - Private subnets: `10.0.11.0/24`(A), `10.0.12.0/24`(B)
  - IGW, **NAT GW per AZ** + EIP, route tables(공용/사설 AZ별)
  - (권장) VPC endpoints: `ecr.api`, `ecr.dkr`, `s3(gateway)`, `logs`, `sts` 등(옵션)
- **EKS 스택(Region)**
  - EKS cluster + managed node groups(앱/관측)
  - OIDC provider
  - 필수 IAM/IRSA: aws-load-balancer-controller, external-dns, ebs-csi 등(설치/업데이트는 ArgoCD)
  - (선택) EKS managed add-ons(VPC CNI/CoreDNS/kube-proxy/EBS CSI)
- **Data 스택(Region)**
  - RDS(Postgres, multi-AZ, subnet group=private)
  - ElastiCache Redis replication group(multi-AZ)
  - Secrets Manager(앱 시크릿 “컨테이너”만 만들지/값까지 넣을지 선택 가능)
- **Observability(Region)**
  - CloudWatch log groups / retention / IAM 정책 등(필요한 범위만)

## Terraform 디렉토리 구조(추천: 확장 가능한 표준 Terragrunt 레이아웃)

`/Users/cielo/devops/tiketi` 기준으로 신규 `terraform/`를 다음처럼 구성:

```text
terraform/
  modules/
    vpc/
    eks/
    eks-irsa/
    data-rds/
    data-redis/
    edge/
    iam-github-oidc/
    bootstrap-state/

  live/
    _common/
      terragrunt.hcl          # 공통 locals(tags, naming)

    dev/
      ap-northeast-2/
        00-bootstrap-state/
        10-network/
        20-eks/
        21-eks-irsa/
        30-data-rds/
        31-data-redis/
        40-edge/              # (option) edge가 dev별이면 여기, 아니면 global로 분리

    prod/
      ap-northeast-2/
        ... (동일)

    global/
      40-edge/                # Route53/CloudFront/WAF/S3/ACM(us-east-1)
```

### Terragrunt 공통 패턴(핵심만)

- `live/_common/terragrunt.hcl`
  - `remote_state`(S3 bucket + DynamoDB table)
  - `generate "provider"`(region/assume_role/tags)
  - `locals { env, region, project, tags }`
- 각 스택 `terragrunt.hcl`
  - `include`로 공통 상속
  - `terraform { source = "../../../../modules/<stack>" }`
  - `dependency`로 stack output 참조(예: `eks`는 `network` output vpc/subnets 참조)

## 구현 순서(실행 가능 단위로)

1. **bootstrap-state**

   - S3 state bucket(버전닝/암호화/KMS/퍼블릭 차단)
   - DynamoDB lock table
   - (선택) state용 KMS key

2. **network**

   - `terraform-aws-modules/vpc/aws`
   - NAT per AZ + route tables + tags(EKS subnet tags 포함)

3. **eks**

   - `terraform-aws-modules/eks/aws`
   - managed node groups(앱/관측), cluster endpoint 정책

4. **eks-irsa**

   - GitOps가 설치할 컨트롤러들의 IAM role/policy + service account trust(OIDC)

5. **data-rds / data-redis**

   - SG: EKS node SG(또는 특정 pod SG)에서만 접근
   - subnet group=private

6. **edge**

   - Route53 zone(기존이면 data source)
   - ACM(us-east-1, CloudFront용) + ACM(ap-northeast-2, ALB용)
   - CloudFront + WAF + S3 origin
   - CloudFront 2-origin 패턴(권장): `/api/*` → ALB, 나머지 → S3

## GitHub Actions/OIDC(권한 분리 설계)

- 기존 [`/.github/workflows/deploy.yml`](/Users/cielo/devops/tiketi/.github/workflows/deploy.yml)은 현재 **S3/CloudFront + EC2** 중심.
- 목표 아키텍처(EKS+ArgoCD)로 갈 때는 role을 **3개**로 분리:
  - `gh-terraform-plan` : read-only + state read
  - `gh-terraform-apply`: infra write + state write
  - `gh-app-deploy`      : ECR push + (gitops repo commit / argocd sync trigger) 최소권한

## 산출물(완료 정의)

- `terraform/`에 **modules/live 구조 확정**
- `live/dev` 기준으로 **00→10→20→21→30→31→global/40** 순서로 apply 가능한 상태
- EKS IRSA role들이 준비되어 ArgoCD가 aws-load-balancer-controller/external-dns를 설치하면
  - Route53/ACM 기반 도메인
  - ALB ingress 생성
  - RDS/Redis private 접근

이 연결이 성립