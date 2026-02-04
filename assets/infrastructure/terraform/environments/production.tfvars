# SecureMint Engine - Production Environment

environment = "production"
aws_region  = "us-east-1"

# VPC Configuration
vpc_cidr             = "10.0.0.0/16"
private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
public_subnet_cidrs  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

# EKS Configuration
node_instance_types = ["t3.large", "t3.xlarge"]
node_min_size       = 3
node_max_size       = 20
node_desired_size   = 5

# RDS Configuration
enable_rds         = true
rds_instance_class = "db.r6g.large"

# Redis Configuration
enable_redis    = true
redis_node_type = "cache.r6g.large"

# Logging
log_retention_days = 90
