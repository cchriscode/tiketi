variable "project" {
  type        = string
  description = "Project name (used for naming)"
}

variable "env" {
  type        = string
  description = "Environment name (dev/prod)"
}

variable "region" {
  type        = string
  description = "AWS region"
}

variable "cluster_name" {
  type        = string
  description = "EKS cluster name used for subnet tags"
}

variable "name" {
  type        = string
  description = "VPC name"
  default     = ""
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR"
}

variable "azs" {
  type        = list(string)
  description = "AZ list"
}

variable "public_subnets" {
  type        = list(string)
  description = "Public subnet CIDRs (same length as azs)"
}

variable "private_subnets" {
  type        = list(string)
  description = "Private subnet CIDRs (same length as azs)"
}

variable "tags" {
  type        = map(string)
  description = "Tags"
  default     = {}
}
