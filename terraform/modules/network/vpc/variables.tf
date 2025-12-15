# modules/network/vpc/variables.tf

variable "project_name" {
  description = "tiketi-monolith"
  default = "tiketi-monolith"
  type        = string
}

variable "aws_region" {
  description = "인프라가 배포될 AWS 리전"
  default = "ap-northeast-2"
  type        = string
}

variable "vpc_cidr_block" {
  description = "VPC의 기본 CIDR 블록 : 10.0.0.0/16"
  default = "10.0.0.0/16"
  type        = string
}

variable "availability_zones" {
  description = "사용할 AZ 리스트 ( [ap-northeast-2a, ap-northeast-2b] )"
  default = ["ap-northeast-2a", "ap-northeast-2b"]
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "Public Subnet의 CIDR 리스트 (ALB 및 EC2가 위치)"
  default = ["10.0.1.0/24", "10.0.2.0/24"]
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "Private Subnet의 CIDR 리스트"
  default = ["10.0.11.0/24", "10.0.12.0/24"]
  type        = list(string)
}