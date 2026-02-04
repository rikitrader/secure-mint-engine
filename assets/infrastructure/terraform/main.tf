# SecureMint Engine - Terraform Infrastructure
# AWS-based deployment for dashboard, alerting, and monitoring

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  backend "s3" {
    bucket         = "securemint-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "securemint-terraform-locks"
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# PROVIDERS
# ═══════════════════════════════════════════════════════════════════════════════

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "SecureMint"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# DATA SOURCES
# ═══════════════════════════════════════════════════════════════════════════════

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# ═══════════════════════════════════════════════════════════════════════════════
# VPC
# ═══════════════════════════════════════════════════════════════════════════════

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "securemint-${var.environment}"
  cidr = var.vpc_cidr

  azs             = slice(data.aws_availability_zones.available.names, 0, 3)
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway     = true
  single_nat_gateway     = var.environment != "production"
  enable_dns_hostnames   = true
  enable_dns_support     = true

  # EKS requirements
  public_subnet_tags = {
    "kubernetes.io/role/elb"                    = 1
    "kubernetes.io/cluster/securemint-${var.environment}" = "shared"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"           = 1
    "kubernetes.io/cluster/securemint-${var.environment}" = "shared"
  }

  tags = {
    Component = "networking"
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# EKS CLUSTER
# ═══════════════════════════════════════════════════════════════════════════════

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "securemint-${var.environment}"
  cluster_version = "1.28"

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # Managed node groups
  eks_managed_node_groups = {
    general = {
      name           = "general"
      instance_types = var.node_instance_types

      min_size     = var.node_min_size
      max_size     = var.node_max_size
      desired_size = var.node_desired_size

      labels = {
        role = "general"
      }

      tags = {
        Component = "compute"
      }
    }

    monitoring = {
      name           = "monitoring"
      instance_types = ["t3.medium"]

      min_size     = 1
      max_size     = 3
      desired_size = 2

      labels = {
        role = "monitoring"
      }

      taints = [{
        key    = "dedicated"
        value  = "monitoring"
        effect = "NO_SCHEDULE"
      }]

      tags = {
        Component = "monitoring"
      }
    }
  }

  # Enable IRSA
  enable_irsa = true

  # Cluster addons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  tags = {
    Component = "kubernetes"
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# RDS (Optional - for alerting state)
# ═══════════════════════════════════════════════════════════════════════════════

module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  count = var.enable_rds ? 1 : 0

  identifier = "securemint-${var.environment}"

  engine               = "postgres"
  engine_version       = "15"
  family               = "postgres15"
  major_engine_version = "15"
  instance_class       = var.rds_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100

  db_name  = "securemint"
  username = "securemint"
  port     = 5432

  multi_az               = var.environment == "production"
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  skip_final_snapshot     = var.environment != "production"

  performance_insights_enabled = true
  create_cloudwatch_log_group  = true

  tags = {
    Component = "database"
  }
}

resource "aws_security_group" "rds" {
  name        = "securemint-rds-${var.environment}"
  description = "Security group for SecureMint RDS"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }

  tags = {
    Name      = "securemint-rds-${var.environment}"
    Component = "database"
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# ELASTICACHE (Redis for caching)
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_elasticache_subnet_group" "main" {
  count = var.enable_redis ? 1 : 0

  name       = "securemint-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_elasticache_replication_group" "main" {
  count = var.enable_redis ? 1 : 0

  replication_group_id       = "securemint-${var.environment}"
  description                = "SecureMint Redis cluster"
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.environment == "production" ? 2 : 1
  port                       = 6379
  automatic_failover_enabled = var.environment == "production"

  subnet_group_name  = aws_elasticache_subnet_group.main[0].name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = {
    Component = "cache"
  }
}

resource "aws_security_group" "redis" {
  name        = "securemint-redis-${var.environment}"
  description = "Security group for SecureMint Redis"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }

  tags = {
    Name      = "securemint-redis-${var.environment}"
    Component = "cache"
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# SECRETS MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_secretsmanager_secret" "rpc_url" {
  name        = "securemint/${var.environment}/rpc-url"
  description = "Ethereum RPC URL for SecureMint"

  tags = {
    Component = "secrets"
  }
}

resource "aws_secretsmanager_secret" "alerting" {
  name        = "securemint/${var.environment}/alerting"
  description = "Alerting webhook credentials"

  tags = {
    Component = "secrets"
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# S3 (Backups and logs)
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_s3_bucket" "logs" {
  bucket = "securemint-logs-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Component = "storage"
  }
}

resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "log-retention"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# CLOUDWATCH
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_cloudwatch_log_group" "eks" {
  name              = "/aws/eks/securemint-${var.environment}/cluster"
  retention_in_days = var.log_retention_days

  tags = {
    Component = "logging"
  }
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "securemint-${var.environment}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EKS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "CPU utilization is too high"

  dimensions = {
    ClusterName = module.eks.cluster_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Component = "monitoring"
  }
}

resource "aws_sns_topic" "alerts" {
  name = "securemint-${var.environment}-alerts"

  tags = {
    Component = "alerting"
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUTS
# ═══════════════════════════════════════════════════════════════════════════════

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = var.enable_rds ? module.rds[0].db_instance_endpoint : null
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = var.enable_redis ? aws_elasticache_replication_group.main[0].primary_endpoint_address : null
}
