terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

locals {
  github_oidc_url = "https://token.actions.githubusercontent.com"

  repos = [for r in var.github_repositories : "repo:${r}:*"]

  apply_subjects = [for r in var.github_repositories : "repo:${r}:ref:refs/heads/${var.apply_branch}"]
  plan_subjects  = concat(
    [for r in var.github_repositories : "repo:${r}:pull_request"],
    [for r in var.github_repositories : "repo:${r}:ref:refs/heads/${var.apply_branch}"]
  )
}

resource "aws_iam_openid_connect_provider" "github" {
  url = local.github_oidc_url

  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    # GitHub OIDC thumbprint rotates; this is a common current value.
    # If AWS rejects it in the future, update to the current GitHub OIDC root CA thumbprint.
    "6938fd4d98bab03faadb97b34396831e3780aea1"
  ]

  tags = var.tags
}

data "aws_iam_policy_document" "assume_plan" {
  statement {
    effect = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    actions = ["sts:AssumeRoleWithWebIdentity"]

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.plan_subjects
    }
  }
}

data "aws_iam_policy_document" "assume_apply" {
  statement {
    effect = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    actions = ["sts:AssumeRoleWithWebIdentity"]

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.apply_subjects
    }
  }
}

data "aws_iam_policy_document" "assume_deploy" {
  statement {
    effect = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    actions = ["sts:AssumeRoleWithWebIdentity"]

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.apply_subjects
    }
  }
}

resource "aws_iam_role" "terraform_plan" {
  name               = "${var.name_prefix}-terraform-plan"
  assume_role_policy = data.aws_iam_policy_document.assume_plan.json
  tags               = var.tags
}

resource "aws_iam_role" "terraform_apply" {
  name               = "${var.name_prefix}-terraform-apply"
  assume_role_policy = data.aws_iam_policy_document.assume_apply.json
  tags               = var.tags
}

resource "aws_iam_role" "app_deploy" {
  name               = "${var.name_prefix}-app-deploy"
  assume_role_policy = data.aws_iam_policy_document.assume_deploy.json
  tags               = var.tags
}

# --- Plan role policies ---
resource "aws_iam_role_policy_attachment" "plan_readonly" {
  role       = aws_iam_role.terraform_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

data "aws_iam_policy_document" "tf_state_access" {
  statement {
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
      "s3:GetBucketLocation"
    ]

    resources = flatten([
      for b in var.terraform_state_bucket_arns : [
        b,
        "${b}/*"
      ]
    ])
  }

  statement {
    effect = "Allow"

    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:UpdateItem",
      "dynamodb:DescribeTable"
    ]

    resources = var.terraform_lock_table_arns
  }
}

resource "aws_iam_policy" "tf_state_access" {
  name        = "${var.name_prefix}-tfstate-access"
  description = "S3/DynamoDB access for Terraform state + lock"
  policy      = data.aws_iam_policy_document.tf_state_access.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "plan_tf_state" {
  role       = aws_iam_role.terraform_plan.name
  policy_arn = aws_iam_policy.tf_state_access.arn
}

# --- Apply role policies ---
resource "aws_iam_role_policy_attachment" "apply_admin" {
  role       = aws_iam_role.terraform_apply.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

resource "aws_iam_role_policy_attachment" "apply_tf_state" {
  role       = aws_iam_role.terraform_apply.name
  policy_arn = aws_iam_policy.tf_state_access.arn
}

# --- Deploy role policy (minimal-ish) ---
data "aws_iam_policy_document" "deploy" {
  statement {
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken"
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:DescribeRepositories",
      "ecr:CreateRepository",
      "ecr:TagResource"
    ]
    resources = length(var.ecr_repository_arns) > 0 ? var.ecr_repository_arns : ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:GetBucketLocation",
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    resources = length(var.frontend_bucket_arn) > 0 ? [var.frontend_bucket_arn, "${var.frontend_bucket_arn}/*"] : ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "cloudfront:CreateInvalidation"
    ]
    resources = length(var.cloudfront_distribution_arns) > 0 ? var.cloudfront_distribution_arns : ["*"]
  }
}

resource "aws_iam_policy" "deploy" {
  name        = "${var.name_prefix}-app-deploy"
  description = "ECR + S3 + CloudFront deploy permissions"
  policy      = data.aws_iam_policy_document.deploy.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "deploy" {
  role       = aws_iam_role.app_deploy.name
  policy_arn = aws_iam_policy.deploy.arn
}
