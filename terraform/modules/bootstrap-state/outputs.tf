output "bucket_name" {
  value       = aws_s3_bucket.tf_state.bucket
  description = "State bucket name"
}

output "dynamodb_table_name" {
  value       = aws_dynamodb_table.tf_lock.name
  description = "Lock table name"
}
