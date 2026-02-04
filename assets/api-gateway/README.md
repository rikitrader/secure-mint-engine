# SecureMint API Gateway

REST and GraphQL API for SecureMint Engine.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Endpoints

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/token` | GET | Token info |
| `/api/token/balance/:address` | GET | Get balance |
| `/api/mint/simulate` | POST | Simulate mint |
| `/api/mint/capacity` | GET | Epoch capacity |
| `/api/oracle/status` | GET | Oracle status |
| `/api/invariants` | GET | Check invariants |

### GraphQL

```graphql
query {
  token {
    name
    symbol
    totalSupply
  }
  backing {
    totalBacking
    backingRatio
    isStale
  }
  invariants {
    id
    name
    passed
  }
}
```

## Authentication

- **JWT Token**: `Authorization: Bearer <token>`
- **Signature**: Ethereum signature authentication

## Configuration

```bash
# Required environment variables
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
RPC_URL=...
```

## API Documentation

- OpenAPI: `openapi.yaml`
- Postman: `postman-collection.json`

## License

MIT
