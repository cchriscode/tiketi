# modules/network/vpc/outputs.tf

output "vpc_id" {
  description = "생성된 VPC의 ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public Subnet ID 리스트"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private Subnet ID 리스트"
  value       = aws_subnet.private[*].id
}