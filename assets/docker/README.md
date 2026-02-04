# SecureMint Engine - Docker

Docker configurations for SecureMint Engine.

## Development

Start the full development stack:

```bash
docker-compose up -d
```

This starts:
- **API Gateway** (port 3000)
- **Dashboard** (port 3001)
- **PostgreSQL** (port 5432)
- **Redis** (port 6379)
- **Hardhat Node** (port 8545)
- **Graph Node** (port 8000)
- **IPFS** (port 5001)
- **Prometheus** (port 9090)
- **Grafana** (port 3002)

### Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Production

Use the production compose file with Traefik:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Features

- Traefik reverse proxy with automatic TLS
- Service replicas with load balancing
- Resource limits and health checks
- External PostgreSQL and Redis

## Building Images

```bash
# API Gateway
docker build -f Dockerfile.api -t securemint-api ..

# Dashboard
docker build -f Dockerfile.dashboard -t securemint-dashboard ..
```

## Environment Variables

See `.env.example` for required variables.

## License

MIT
