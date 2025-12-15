// 심화 프로젝트 instructure
terraform/
├── envs/                       # 📂 환경별 실제 배포 지점
│   ├── dev/                    # 개발 환경
│   │   ├── main.tf             # 모듈 호출 및 조합 (여기서 모든 인프라가 배포됨)
│   │   ├── variables.tf        # 환경별 변수 선언
│   │   ├── terraform.tfvars    # 변수 값 (예: 인스턴스 타입 = t3.medium)
│   │   └── backend.tf          # dev 환경용 State S3 Key 설정
│   └── prod/                   # 프로덕션 환경
│       └── ... (dev와 동일 구조)
│
├── global/                     # 🌐 모든 환경이 공유하는 전역 리소스
│   ├── ecr/                    # Docker 이미지 저장소 (환경 독립적)
│   ├── route53-root/           # 최상위 도메인 Hosted Zone (e.g., example.com)
│   ├── iam-oidc/               # GitHub Actions 등 CI/CD를 위한 OIDC/IAM 설정
│   └── s3-backend/             # Terraform State 저장용 S3 및 DynamoDB Lock
│
└── modules/                    # 🏗️ 재사용 가능한 인프라 템플릿
    ├── network/                # 🌐 네트워크 및 엣지 서비스
    │   ├── vpc/                # EKS, RDS용 Subnet Tagging 포함
    │   ├── acm/                # SSL/TLS 인증서
    │   └── waf/                # 웹 방화벽 규칙 정의
    │
    ├── data/                   # 💾 데이터 저장소 및 캐시
    │   ├── rds/                # RDS + Secrets Manager(DB Credential)
    │   └── elasticache/        # Redis/Memcached 캐시
    │
    ├── compute/                # 🖥️ EKS 클러스터 및 컴퓨팅 환경
    │   ├── eks-cluster/        # EKS Control Plane 및 Node Group
    │   ├── eks-addons/         # AWS LB Controller, ExternalDNS, ArgoCD(Helm) 등 EKS 필수 확장 도구
    │   └── eks-irsa/           # EKS Pod가 AWS 서비스(S3, Secret Manager) 접근 권한 설정
    │
    ├── observability/          # 📈 관측성 스택
    │   ├── helm-stack/         # Prometheus, Loki, Grafana 등 Helm Chart 배포
    │   └── monitoring-infra/   # CloudWatch Dashboard, SNS Topic 등 AWS 모니터링 리소스
    │
    └── frontend/               # 🖼️ 정적 웹사이트 호스팅
        └── s3-cloudfront/      # React 정적 배포용 S3 Bucket, CloudFront, Route53 Record




--------------
// 기본 프로젝트 terraform instructure
terraform/
├── envs/
│   ├── dev/
│   │   ├── main.tf             # 1. network 호출 -> 2. compute-monolith 호출 -> 3. frontend 호출
│   │   └── variables.tf
│   └── prod/
│       └── ...
│
├── global/                     # 🌐 모든 환경 공유 (CI/CD 및 상태 관리)
│   ├── route53-root/           # 루트 도메인 Hosted Zone
│   ├── s3-backend/             # Terraform State 저장용 S3
│   └── iam-ci/                 # GitHub Actions가 AWS에 접근하기 위한 IAM Role
│
└── modules/
    ├── network/                # 🌐 네트워크 및 보안 엣지
    │   ├── vpc/                # VPC, Subnets, Internet Gateway, Route Tables
    │   └── acm/                # ACM 인증서 (CloudFront용 us-east-1, ALB용 ap-northeast-2)
    │
    ├── compute-monolith/       # 🖥️ 단일 EC2 (앱, DB, 캐시, 모니터링 포함)
    │   ├── ec2-instance/       # EC2 인스턴스, EC2 Security Group (Backend SG)
    │   └── alb-setup/          # Application Load Balancer (ALB SG), Target Group, Listener
    │
    └── frontend/               # 🖼️ React 정적 배포 스택
        └── s3-cloudfront/      # S3 Bucket, CloudFront Distribution, Route53 Record