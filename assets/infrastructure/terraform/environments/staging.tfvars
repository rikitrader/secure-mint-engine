# SecureMint Engine - Staging Environment

environment = "staging"
aws_region  = "us-east-1"

# VPC Configuration
vpc_cidr             = "10.1.0.0/16"
private_subnet_cidrs = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
public_subnet_cidrs  = ["10.1.101.0/24", "10.1.102.0/24", "10.1.103.0/24"]

# EKS Configuration
node_instance_types = ["t3.medium"]
node_min_size       = 2
node_max_size       = 5
node_desired_size   = 2

# RDS Configuration
enable_rds         = true
rds_instance_class = "db.t3.medium"

# Redis Configuration
enable_redis    = true
redis_node_type = "cache.t3.micro"

# Logging
log_retention_days = 14
