# envs/dev/main.tf

# Terraform 설정 (상태 관리 - S3 백엔드 설정은 생략)
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# AWS Provider 설정
provider "aws" {
  region = var.aws_region
}


# ----------------------------------------------------
# 1. Network 모듈 호출: VPC, Subnet, Route Tables, IGW 생성
# ----------------------------------------------------
module "network_vpc" {
  source = "../../modules/network/vpc" # VPC 모듈의 경로 지정

  # VPC 모듈의 variables.tf에 정의된 변수에 값을 주입
  project_name         = var.project_name
  aws_region           = var.aws_region
  vpc_cidr_block       = var.vpc_cidr_block
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

# --- 출력 (디버깅 및 확인용) ---
output "vpc_id" {
  description = "생성된 VPC의 ID"
  value       = module.network_vpc.vpc_id # 💡 VPC 모듈의 outputs.tf에서 값을 가져옴
}

output "public_subnet_ids" {
  description = "Public Subnet ID 리스트"
  value       = module.network_vpc.public_subnet_ids
}