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
  source = "../../../../modules/iam-github-oidc"
}

locals {
  github_repo = get_env("GITHUB_REPO", "REPLACE_ME_OWNER/REPLACE_ME_REPO")
}

inputs = {
  name_prefix          = "gh-${local.project}-${local.env}"
  github_repositories  = [local.github_repo]
  apply_branch         = "main"

  terraform_state_bucket_arns = ["arn:aws:s3:::${local.state_bucket_name}"]
  terraform_lock_table_arns   = ["arn:aws:dynamodb:${local.region}:${get_aws_account_id()}:table/${local.dynamodb_lock_table}"]

  ecr_repository_arns          = []
  frontend_bucket_arn          = ""
  cloudfront_distribution_arns = []

  tags = local.tags
}
