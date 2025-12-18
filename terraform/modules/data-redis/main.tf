terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

resource "random_password" "redis" {
  length  = 32
  special = true

  # ElastiCache Redis AUTH token은 허용 특수문자가 제한됨(AWS 문서).
  # safe set으로 강제해서 apply 실패를 예방.
  override_special = "!&#$^<>-"
}

resource "aws_security_group" "redis" {
  name        = "${var.project}-${var.env}-redis"
  description = "Redis access from EKS nodes"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from EKS nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.allowed_source_sg]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

module "redis" {
  source  = "terraform-aws-modules/elasticache/aws"
  version = "~> 1.0"

  replication_group_id = "${var.project}-${var.env}-redis"
  description          = "Tiketi Redis"
  engine               = "redis"
  engine_version       = var.engine_version
  port                 = 6379

  node_type                  = var.node_type
  num_cache_clusters         = var.num_cache_clusters
  automatic_failover_enabled = true
  multi_az_enabled           = true

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis.result

  subnet_ids          = var.subnet_ids
  create_subnet_group = true

  security_group_ids = [aws_security_group.redis.id]

  tags = var.tags
}

resource "aws_secretsmanager_secret" "redis" {
  name = "${var.project}/${var.env}/elasticache/redis"
  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id = aws_secretsmanager_secret.redis.id

  secret_string = jsonencode({
    primary_endpoint = module.redis.primary_endpoint_address
    reader_endpoint  = module.redis.reader_endpoint_address
    port             = 6379
    auth_token       = random_password.redis.result
    tls              = true
  })
}
