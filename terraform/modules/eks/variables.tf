variable "project" {
  type        = string
  description = "Project name"
}

variable "env" {
  type        = string
  description = "Environment name"
}

variable "region" {
  type        = string
  description = "AWS region"
}

variable "cluster_name" {
  type        = string
  description = "EKS cluster name"
}

variable "cluster_version" {
  type        = string
  description = "EKS version"
  default     = "1.30"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for EKS (private recommended)"
}

variable "cluster_endpoint_public_access" {
  type        = bool
  description = "Whether the EKS API endpoint is publicly accessible"
  default     = false
}

variable "cluster_endpoint_private_access" {
  type        = bool
  description = "Whether the EKS API endpoint is privately accessible within the VPC"
  default     = true
}

variable "cluster_endpoint_public_access_cidrs" {
  type        = list(string)
  description = "Allowed CIDRs for public EKS API endpoint access"
  default     = []
}

variable "node_groups" {
  description = "Managed node groups configuration"

  type = map(
    object({
      instance_types = list(string)
      min_size       = number
      max_size       = number
      desired_size   = number
      capacity_type  = optional(string, "ON_DEMAND")
      labels         = optional(map(string), {})
      taints         = optional(list(any), [])
    })
  )
}

variable "tags" {
  type        = map(string)
  description = "Tags"
  default     = {}
}
