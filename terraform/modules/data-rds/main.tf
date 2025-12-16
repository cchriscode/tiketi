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

resource "random_password" "db" {
  length  = 24
  special = true
}

resource "aws_security_group" "rds" {
  name        = "${var.project}-${var.env}-rds"
  description = "RDS access from EKS nodes"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Postgres from EKS nodes"
    from_port       = 5432
    to_port         = 5432
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

module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "${var.project}-${var.env}-postgres"

  engine               = "postgres"
  engine_version       = var.engine_version
  family               = var.parameter_group_family
  major_engine_version = split(".", var.engine_version)[0]

  instance_class = var.instance_class
  allocated_storage = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  port     = 5432
  multi_az = true

  subnet_ids             = var.subnet_ids
  create_db_subnet_group = true

  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = var.backup_retention_days
  deletion_protection     = var.deletion_protection
  skip_final_snapshot     = var.skip_final_snapshot

  storage_encrypted = true

  tags = var.tags
}

resource "aws_secretsmanager_secret" "db" {
  name = "${var.project}/${var.env}/rds/postgres"
  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id

  secret_string = jsonencode({
    host     = module.rds.db_instance_address
    port     = 5432
    database = var.db_name
    username = var.db_username
    password = random_password.db.result
  })
}
