include "common" {
  path = find_in_parent_folders("_common/terragrunt.hcl")
}

remote_state {
  backend = "s3"

  config = {
    bucket         = local.state_bucket_name
    key            = "${local.state_key_prefix}/${path_relative_to_include()}/terraform.tfstate"
    region         = local.state_bucket_region
    dynamodb_table = local.dynamodb_lock_table
    encrypt        = true
  }

  generate = {
    path      = "backend.generated.tf"
    if_exists = "overwrite_terragrunt"
  }
}

terraform {
  source = "../../../../modules/vpc"
}

inputs = {
  project      = local.project
  env          = local.env
  region       = local.region
  cluster_name = "${local.project}-${local.env}"

  vpc_cidr = "10.0.0.0/16"
  azs      = ["ap-northeast-2a", "ap-northeast-2c"]

  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets = ["10.0.11.0/24", "10.0.12.0/24"]

  tags = local.tags
}
