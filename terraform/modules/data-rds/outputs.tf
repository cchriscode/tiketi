output "endpoint" {
  value = module.rds.db_instance_endpoint
}

output "address" {
  value = module.rds.db_instance_address
}

output "security_group_id" {
  value = aws_security_group.rds.id
}

output "secret_arn" {
  value = aws_secretsmanager_secret.db.arn
}
