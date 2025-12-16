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

dependency "eks" {
  config_path = "../20-eks"
}

terraform {
  source = "../../../../modules/eks-irsa"
}

inputs = {
  project = local.project
  env     = local.env

  cluster_name              = dependency.eks.outputs.cluster_name
  cluster_oidc_provider_arn = dependency.eks.outputs.oidc_provider_arn
  cluster_oidc_issuer_url   = dependency.eks.outputs.oidc_issuer_url

  tags = local.tags
}
