variable "project" {
  type        = string
  description = "Project name"
}

variable "env" {
  type        = string
  description = "Environment name"
}

variable "cluster_name" {
  type        = string
  description = "EKS cluster name"
}

variable "cluster_oidc_provider_arn" {
  type        = string
  description = "EKS OIDC provider ARN"
}

variable "cluster_oidc_issuer_url" {
  type        = string
  description = "EKS OIDC issuer URL"
}

variable "tags" {
  type        = map(string)
  description = "Tags"
  default     = {}
}
