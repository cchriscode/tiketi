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

dependency "network" {
  config_path = "../10-network"
}

dependency "eks" {
  config_path = "../20-eks"
}

terraform {
  source = "../../../../modules/data-rds"
}

inputs = {
  project = local.project
  env     = local.env

  vpc_id            = dependency.network.outputs.vpc_id
  subnet_ids        = dependency.network.outputs.private_subnet_ids
  allowed_source_sg = dependency.eks.outputs.node_security_group_id

  db_name     = "tiketi"
  db_username = "tiketi"

  tags = local.tags
}
