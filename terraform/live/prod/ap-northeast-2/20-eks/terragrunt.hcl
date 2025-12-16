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

terraform {
  source = "../../../../modules/eks"
}

inputs = {
  project = local.project
  env     = local.env
  region  = local.region

  cluster_name = "${local.project}-${local.env}"
  vpc_id       = dependency.network.outputs.vpc_id
  subnet_ids   = dependency.network.outputs.private_subnet_ids

  node_groups = {
    app = {
      instance_types = ["t3.large"]
      min_size       = 2
      max_size       = 6
      desired_size   = 3
    }

    observability = {
      instance_types = ["t3.large"]
      min_size       = 2
      max_size       = 6
      desired_size   = 2
    }
  }

  tags = local.tags
}
