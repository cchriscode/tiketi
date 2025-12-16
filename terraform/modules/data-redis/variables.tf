variable "project" {
  type        = string
  description = "Project name"
}

variable "env" {
  type        = string
  description = "Environment name"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for subnet group"
}

variable "allowed_source_sg" {
  type        = string
  description = "Source security group allowed to access Redis"
}

variable "engine_version" {
  type        = string
  description = "Redis engine version"
  default     = "7.1"
}

variable "node_type" {
  type        = string
  description = "ElastiCache node type"
  default     = "cache.t4g.small"
}

variable "num_cache_clusters" {
  type        = number
  description = "Number of cache clusters (>=2 for HA)"
  default     = 2
}

variable "tags" {
  type        = map(string)
  description = "Tags"
  default     = {}
}
