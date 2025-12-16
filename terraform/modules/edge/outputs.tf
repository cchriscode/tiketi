output "hosted_zone_id" {
  value = local.hosted_zone_id
}

output "s3_bucket_name" {
  value = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.this.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.this.domain_name
}

output "alb_certificate_arn" {
  value = aws_acm_certificate_validation.alb.certificate_arn
}

output "cloudfront_certificate_arn" {
  value = aws_acm_certificate_validation.cloudfront.certificate_arn
}

output "waf_web_acl_arn" {
  value = aws_wafv2_web_acl.this.arn
}
