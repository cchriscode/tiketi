include "common" {
  path = find_in_parent_folders("_common/terragrunt.hcl")
}

terraform {
  source = "../../../modules/bootstrap-state"
}

inputs = {
  bucket_name         = local.state_bucket_name
  dynamodb_table_name = local.dynamodb_lock_table
  tags                = local.tags
}
