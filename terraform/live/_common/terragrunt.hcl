locals {
  project = "tiketi"

  # 기본은 live/<env>/<region>/... 에서 env/region 추출.
  # 예외로 live/global/... 은 region을 고정해서 사용(Edge 스택 등).
  path_parts = split("/", path_relative_to_include())
  env        = local.path_parts[0]
  region = local.env == "global" ? "ap-northeast-2" : local.path_parts[1]

  tags = {
    Project     = local.project
    Environment = local.env
    ManagedBy   = "terragrunt"
  }

  state_bucket_name    = "${local.project}-${local.env}-${local.region}-tfstate"
  dynamodb_lock_table  = "${local.project}-${local.env}-${local.region}-tflock"
  # remote state key는 path_relative_to_include()가 이미 env/region을 포함하므로
  # 여기서는 project만 prefix로 둬서 env/region 중복을 제거한다.
  state_key_prefix     = local.project
  state_bucket_region  = local.region
}

generate "provider" {
  path      = "provider.generated.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

provider "aws" {
  region = "${local.region}"

  default_tags {
    tags = ${jsonencode(local.tags)}
  }
}
EOF
}
