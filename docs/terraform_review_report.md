## Terraform/Terragrunt 리뷰 리포트 (tiketi)

작성일: 2025-12-18

> 이 문서는 “리뷰 + 수정 반영 결과”까지 포함한 버전이다. (코드 변경 반영됨)

### TL;DR (바로 고쳐야 하는 것)
- **[DONE] Terragrunt remote state key 경로 env/region 중복 제거** (단, 기존 state가 있으면 마이그레이션 필요)
- **[DONE] EKS API endpoint 기본값을 private-only로 변경** (public + 0.0.0.0/0 기본값 제거)
- **[DONE] RDS/Redis 비밀번호(토큰) 랜덤 생성 문자셋을 AWS 제약에 맞게 고정** (apply 실패 방지)
- **[DONE] GitHub OIDC deploy role의 fail-open(`*`) 제거** (ARN 미지정이면 해당 권한 블록 자체를 생성하지 않음)

---

### 현재 구조 요약
- `terraform/live/**` : Terragrunt 스택
  - `00-bootstrap-state`: S3 tfstate bucket + DynamoDB lock table 생성
  - `10-network`: VPC
  - `20-eks`: EKS
  - `21-eks-irsa`: IRSA(aws-lb-controller, external-dns, ebs-csi)
  - `30-data-rds`: Postgres(RDS) + SecretsManager
  - `31-data-redis`: ElastiCache Redis + SecretsManager
  - `global/40-edge`: Route53 + ACM(us-east-1 + regional) + CloudFront + WAF + S3 static origin
- `terraform/modules/**`: 각 스택별 Terraform 모듈(대부분 terraform-aws-modules 래핑)
- 공통 Provider는 `live/_common/terragrunt.hcl`에서 `generate "provider"`로 주입

---

## 1) Terragrunt 공통 설정 리뷰 (`terraform/live/_common/terragrunt.hcl`)

### 1.1 remote state key 중복 (BLOCKER)
현재 공통 locals:
- (수정 전) `state_key_prefix = "${project}/${env}/${region}"`
- (수정 후) `state_key_prefix = local.project`

각 스택 terragrunt의 remote_state:
- `key = "${local.state_key_prefix}/${path_relative_to_include()}/terraform.tfstate"`

문제:
- `path_relative_to_include()` 자체가 이미 `dev/ap-northeast-2/20-eks` 같은 **env/region을 포함**
- 그래서 key가 `project/env/region/(env/region/stack)` 형태로 중복됨

#### 적용한 수정
`state_key_prefix`를 `local.project`로 변경해서 중복을 제거했다.
결과적으로 state key는 아래 형태로 정리됨:
- `tiketi/dev/ap-northeast-2/20-eks/terraform.tfstate`

#### 주의: 이미 remote state를 한 번이라도 썼으면 “키 변경 = state 마이그레이션”이 필요
이미 `old key`로 state 객체가 S3에 생성된 상태에서 key만 바꾸면, Terraform/Terragrunt는 **새 state로 인식**해서 리소스를 “새로 만들려고” 할 수 있음(최악: 중복 생성 시도).

실무에서 제일 단순한 방법은 **S3 객체를 새 key로 복사/이동**하는 거야(스택별로 1회).

예시(개념):

```bash
# old -> new (copy)
aws s3 cp "s3://<bucket>/<OLD_KEY>" "s3://<bucket>/<NEW_KEY>"

# (선택) old key 제거
aws s3 rm "s3://<bucket>/<OLD_KEY>"
```

그 다음 해당 스택에서 `terragrunt init` / `terragrunt plan`로 drift/재생성 시도가 없는지 확인.

---

## 2) 네트워크(VPC) 모듈 리뷰 (`modules/vpc` + `live/*/10-network`)

### 좋은 점
- `terraform-aws-modules/vpc/aws` 사용은 정석
- public/private subnet에 EKS ELB 태그 적용됨
  - `kubernetes.io/role/elb`, `kubernetes.io/role/internal-elb`
- `one_nat_gateway_per_az=true`로 HA 구성(비용은 증가)

### 체크 포인트
- **비용**: NAT Gateway가 AZ당 1개면 dev에서도 월 비용이 꽤 나감
  - dev는 `single_nat_gateway=true`로 다운시키는 게 일반적

---

## 3) EKS 모듈 리뷰 (`modules/eks` + `live/*/20-eks`)

### 3.1 EKS API endpoint 노출 (HIGH)
`modules/eks/variables.tf`:
- (수정 전) `cluster_endpoint_public_access=true`, `cluster_endpoint_public_access_cidrs=["0.0.0.0/0"]`
- (수정 후) `cluster_endpoint_public_access=false`, `cluster_endpoint_public_access_cidrs=[]`
- (추가) `cluster_endpoint_private_access=true` 변수를 추가하고, eks 모듈에 실제로 연결함

#### 권장 수정(최소 변경)
prod(그리고 가능하면 dev도)에서 terragrunt input으로 강제:

```hcl
# live/prod/.../20-eks/terragrunt.hcl
inputs = {
  # ...
  cluster_endpoint_public_access = false
}
```

public endpoint가 꼭 필요하면 CIDR을 좁혀:

```hcl
cluster_endpoint_public_access       = true
cluster_endpoint_public_access_cidrs = ["203.0.113.10/32"]
```

### 3.2 node_groups 타입/사용
- `node_groups`의 `capacity_type/labels/taints`가 `optional()`로 잘 잡혀있어서 지금 입력으로도 안전
- 다만 운영에서 흔히 필요한 것(권장):
  - control plane 로그 활성화
  - secrets encryption(KMS)
  - access entries / aws-auth(누가 admin인지 명시)

현재 래퍼 모듈이 upstream eks module의 고급 옵션들을 노출하지 않아서, 필요하면 래퍼에 변수를 추가하는 방향이 좋아.

---

## 4) RDS(Postgres) 모듈 리뷰 (`modules/data-rds` + `live/*/30-data-rds`)

### 4.1 password 생성 제약 (HIGH)
RDS 마스터 패스워드는 엔진/서비스 제약 때문에 **특정 문자가 들어가면 실패**할 수 있음.
수정 전:

```hcl
resource "random_password" "db" {
  length  = 24
  special = true
}
```

수정 후(반영 완료):

```hcl
resource "random_password" "db" {
  length  = 24
  special = true

  # AWS 제약(/, \", @, 공백) 회피 + 안정적인 특수문자 셋으로 고정
  override_special = "!&#$^<>-"
}
```

### 4.2 삭제 안전장치(특히 prod)
현재 defaults:
- `deletion_protection=false`
- `skip_final_snapshot=true`

prod는 보통:
- `deletion_protection=true`
- `skip_final_snapshot=false`

이건 terragrunt 입력에서 env별로 갈라주는 게 제일 깔끔함.

### 4.3 SecretsManager 저장
- endpoint/username/password를 SecretsManager로 넣는 건 좋음
- 단, **Terraform state에도 비밀번호가 들어간다**는 점은 그대로임
  - 그래서 remote state 버킷 정책/암호화(KMS) 강화가 의미가 있음

---

## 5) Redis(ElastiCache) 모듈 리뷰 (`modules/data-redis` + `live/*/31-data-redis`)

### 5.1 auth_token 생성 제약 (HIGH)
Redis auth token도 서비스 제약으로 특정 문자를 거부하는 케이스가 있음.
수정 전:

```hcl
resource "random_password" "redis" {
  length  = 32
  special = true
}
```

수정 후(반영 완료):

```hcl
resource "random_password" "redis" {
  length  = 32
  special = true

  # ElastiCache AUTH token 허용 특수문자만 사용
  override_special = "!&#$^<>-"
}
```

### 5.2 네트워크 접근
- SG ingress가 `allowed_source_sg`만 허용하는 방식이라 방향은 좋음
- 다만 `allowed_source_sg`가 EKS node SG(= 워커 노드)라서, 워커 노드 내 어떤 파드든 Redis에 붙을 수 있음
  - 더 타이트하게 하려면: pod SG(Security Groups for Pods) 또는 별도 SG/ENI 전략이 필요

---

## 6) GitHub OIDC IAM 모듈 리뷰 (`modules/iam-github-oidc` + `live/*/05-iam-github-oidc`)

### 6.1 Apply role이 AdministratorAccess (MED/HIGH)
- 실무에서 흔하지만, prod 기준으론 과한 권한
- 최소한 plan/apply를 분리한 건 좋음

### 6.2 Deploy role의 fail-open(= 값 비우면 *) (HIGH)
`deploy` 정책에서 입력값이 비면 `resources = ["*"]`로 떨어짐:

- `ecr_repository_arns = []` → ECR 대부분 권한이 *
- `frontend_bucket_arn = ""` → S3 권한이 *
- `cloudfront_distribution_arns = []` → invalidation이 *

현재 terragrunt가 실제로 전부 비워둠:

```hcl
ecr_repository_arns          = []
frontend_bucket_arn          = ""
cloudfront_distribution_arns = []
```

#### 권장 개선(아이디어)
#### 적용한 수정(반영 완료)
- **fail-open(`*`) 제거**: `ecr_repository_arns`/`frontend_bucket_arn`/`cloudfront_distribution_arns`가 비어있으면 해당 statement 블록 자체를 만들지 않도록 변경
- 결과: 지금처럼 terragrunt에서 값을 비워둬도 deploy role이 무제한 권한을 갖지 않음(단, 당연히 배포 기능도 제한됨)

---

## 7) IRSA 모듈 리뷰 (`modules/eks-irsa` + `live/*/21-eks-irsa`)

### 좋은 점
- aws-load-balancer-controller / external-dns / ebs-csi를 IRSA로 분리한 건 정석

### 개선 포인트
- `external_dns` policy가 Route53 리소스가 `*`라서 너무 넓음
  - hosted zone ARN으로 제한하는 게 일반적

---

## 8) Edge(CloudFront/WAF/ACM/Route53/S3) 모듈 리뷰 (`modules/edge` + `live/global/40-edge`)

### 좋은 점
- CloudFront용 ACM을 **us-east-1 provider alias**로 잘 처리
- OAC + S3 public access block + bucket policy(SourceArn 조건)도 방향 좋음
- WAFv2 ManagedRulesCommonRuleSet 적용도 기본 방어로 괜찮음

### 개선 포인트(운영 품질)
- S3 frontend bucket에 versioning/lifecycle/logging이 없음(원하면 추가)
- CloudFront cache_policy/response_headers_policy 대신 legacy `forwarded_values` 사용(동작은 하지만 요즘은 policy 기반 권장)
- `api_origin_domain_name`이 빈 값이면 `/api/*` origin/behavior가 생성 안 되는데, 이건 의도면 OK

---

## 9) State(bootstrap-state) 모듈 리뷰 (`modules/bootstrap-state` + `live/*/00-bootstrap-state`)

### 좋은 점
- 버전닝, public access block, SSE, lifecycle, DDB PITR까지 기본기는 충분

### 개선 포인트(보안/감사)
- SSE가 `AES256`(SSE-S3)인데, 조직 보안 기준에 따라 **SSE-KMS**가 필요할 수 있음
- S3 bucket policy로 아래를 강제하면 더 좋음:
  - **TLS(aws:SecureTransport) 강제**
  - **암호화 업로드 강제**

---

## 실행 순서(현재 설계 기준)
1. `live/dev/ap-northeast-2/00-bootstrap-state`
2. `live/dev/ap-northeast-2/05-iam-github-oidc`
3. `live/dev/ap-northeast-2/10-network`
4. `live/dev/ap-northeast-2/20-eks`
5. `live/dev/ap-northeast-2/21-eks-irsa`
6. `live/dev/ap-northeast-2/30-data-rds`
7. `live/dev/ap-northeast-2/31-data-redis`

prod도 동일.

---

## 내가 제안하는 “최소 수정 PR 세트”(우선순위)
1) **Terragrunt state key 중복 제거** (BLOCKER)
2) **EKS endpoint public 기본값 제거 또는 prod에서 강제 off** (HIGH)
3) **RDS/Redis random_password에 override_special 추가** (HIGH)
4) **GitHub OIDC deploy role fail-open 제거(값 비면 에러)** (HIGH)
5) (옵션) state bucket SSE-KMS + TLS 강제 정책

---

## 참고: 검토한 주요 파일
- `terraform/live/_common/terragrunt.hcl`
- `terraform/live/dev/ap-northeast-2/*/terragrunt.hcl`
- `terraform/live/prod/ap-northeast-2/*/terragrunt.hcl`
- `terraform/live/global/*/terragrunt.hcl`
- `terraform/modules/*/*.tf`
