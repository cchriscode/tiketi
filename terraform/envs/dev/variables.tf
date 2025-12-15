# envs/dev/variables.tf

variable "project_name" {
  description = "프로젝트 이름. 모든 리소스 태그의 접두어로 사용됩니다."
  default     = "tiketi"
}

variable "aws_region" {
  description = "주요 인프라가 배포될 리전"
  default     = "ap-northeast-2"
}

# --- VPC Module Variables ---
variable "vpc_cidr_block" {
  description = "VPC의 기본 CIDR 블록"
  type        = string
}

variable "public_subnet_cidrs" {
  description = "Public Subnet의 CIDR 리스트"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "Private Subnet의 CIDR 리스트"
  type        = list(string)
}