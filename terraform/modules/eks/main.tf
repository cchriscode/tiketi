terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  vpc_id     = var.vpc_id
  subnet_ids = var.subnet_ids

  cluster_endpoint_public_access       = var.cluster_endpoint_public_access
  cluster_endpoint_public_access_cidrs = var.cluster_endpoint_public_access_cidrs

  enable_irsa = true

  eks_managed_node_groups = {
    for ng_name, ng in var.node_groups : ng_name => {
      name = "${var.cluster_name}-${ng_name}"

      instance_types = ng.instance_types

      min_size     = ng.min_size
      max_size     = ng.max_size
      desired_size = ng.desired_size

      capacity_type = ng.capacity_type

      labels = merge(
        {
          "nodegroup" = ng_name
        },
        ng.labels
      )

      taints = ng.taints

      tags = var.tags
    }
  }

  tags = var.tags
}
