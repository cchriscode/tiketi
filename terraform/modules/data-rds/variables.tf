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
  description = "Private subnet IDs for DB subnet group"
}

variable "allowed_source_sg" {
  type        = string
  description = "Source security group allowed to access Postgres"
}

variable "db_name" {
  type        = string
  description = "Database name"
}

variable "db_username" {
  type        = string
  description = "Master username"
}

variable "engine_version" {
  type        = string
  description = "Postgres engine version"
  default     = "16.3"
}

variable "parameter_group_family" {
  type        = string
  description = "RDS parameter group family"
  default     = "postgres16"
}

variable "instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t4g.medium"
}

variable "allocated_storage" {
  type        = number
  description = "Allocated storage (GiB)"
  default     = 100
}

variable "max_allocated_storage" {
  type        = number
  description = "Max allocated storage (GiB)"
  default     = 300
}

variable "backup_retention_days" {
  type        = number
  description = "Backup retention days"
  default     = 7
}

variable "deletion_protection" {
  type        = bool
  description = "Deletion protection"
  default     = false
}

variable "skip_final_snapshot" {
  type        = bool
  description = "Skip final snapshot on delete"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Tags"
  default     = {}
}
