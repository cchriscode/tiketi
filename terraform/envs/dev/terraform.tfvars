# envs/dev/terraform.tfvars

project_name         = "tiketi"
aws_region           = "ap-northeast-2"

# VPC 모듈에 주입될 값
vpc_cidr_block       = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24"]

# (참고: 향후 다른 모듈에 필요한 변수들, 예: instance_type = "t3.medium" 등이 여기에 추가됩니다.)