variable "project" {
  type        = string
  description = "Project name"
}

variable "env" {
  type        = string
  description = "Environment name (global/dev/prod)"
}

variable "domain_name" {
  type        = string
  description = "Root domain name (e.g. example.com)"
}

variable "create_hosted_zone" {
  type        = bool
  description = "Whether to create Route53 hosted zone"
  default     = false
}

variable "api_origin_domain_name" {
  type        = string
  description = "ALB domain name for /api/* origin (optional)"
  default     = ""
}

variable "tags" {
  type        = map(string)
  description = "Tags"
  default     = {}
}
