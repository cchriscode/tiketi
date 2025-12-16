variable "name_prefix" {
  type        = string
  description = "Prefix for IAM role/policy names"
}

variable "github_repositories" {
  type        = list(string)
  description = "Allowed GitHub repos in owner/repo form"
}

variable "apply_branch" {
  type        = string
  description = "Branch allowed to assume apply/deploy roles"
  default     = "main"
}

variable "terraform_state_bucket_arns" {
  type        = list(string)
  description = "State bucket ARNs (and objects) that plan/apply may access"
  default     = []
}

variable "terraform_lock_table_arns" {
  type        = list(string)
  description = "DynamoDB lock table ARNs that plan/apply may access"
  default     = []
}

variable "ecr_repository_arns" {
  type        = list(string)
  description = "ECR repository ARNs allowed for deploy"
  default     = []
}

variable "frontend_bucket_arn" {
  type        = string
  description = "Frontend S3 bucket ARN for deploy"
  default     = ""
}

variable "cloudfront_distribution_arns" {
  type        = list(string)
  description = "CloudFront distribution ARNs for invalidation"
  default     = []
}

variable "tags" {
  type        = map(string)
  description = "Tags"
  default     = {}
}
