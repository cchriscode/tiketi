output "aws_load_balancer_controller_role_arn" {
  value = module.alb_controller_irsa.iam_role_arn
}

output "external_dns_role_arn" {
  value = module.external_dns_irsa.iam_role_arn
}

output "ebs_csi_role_arn" {
  value = module.ebs_csi_irsa.iam_role_arn
}
