output "primary_endpoint" {
  value = module.redis.primary_endpoint_address
}

output "reader_endpoint" {
  value = module.redis.reader_endpoint_address
}

output "security_group_id" {
  value = aws_security_group.redis.id
}

output "secret_arn" {
  value = aws_secretsmanager_secret.redis.arn
}
