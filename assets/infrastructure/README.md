# SecureMint Engine - Infrastructure

Infrastructure as Code for SecureMint Engine.

## Components

### Kubernetes (`kubernetes/`)

Kubernetes manifests for deploying SecureMint Engine:

- Namespace and RBAC
- Deployments with HPA
- Services and Ingress
- ConfigMaps and Secrets
- PodDisruptionBudgets

```bash
# Deploy all resources
kubectl apply -f kubernetes/

# Check status
kubectl get pods -n securemint
```

### Terraform (`terraform/`)

AWS infrastructure using Terraform:

- **EKS** - Kubernetes cluster
- **RDS** - PostgreSQL database
- **ElastiCache** - Redis cluster
- **S3** - Storage
- **CloudWatch** - Monitoring

```bash
cd terraform

# Initialize
terraform init

# Plan
terraform plan -var-file=environments/production.tfvars

# Apply
terraform apply -var-file=environments/production.tfvars
```

### Monitoring (`monitoring/`)

- **Prometheus** - Metrics collection and alerting
- **Grafana** - Dashboards and visualization
- **Alert Rules** - SecureMint-specific alerts

## Environments

- `production.tfvars` - Production configuration
- `staging.tfvars` - Staging configuration

## Requirements

- Terraform >= 1.0
- kubectl configured
- AWS credentials

## License

MIT
