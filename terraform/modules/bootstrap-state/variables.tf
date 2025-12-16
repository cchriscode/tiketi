variable "bucket_name" {
  description = "S3 bucket name for Terraform/Terragrunt remote state"
  type        = string
}

variable "dynamodb_table_name" {
  description = "DynamoDB table name for Terraform state locking"
  type        = string
}

variable "tags" {
  description = "Tags to apply to created resources"
  type        = map(string)
  default     = {}
}
