# SecureMint Engine - Documentation

Documentation for SecureMint Engine.

## Guides

- **[Integration Guide](guides/INTEGRATION_GUIDE.md)** - Complete guide for integrating SecureMint SDK
- **[Security Checklist](SECURITY_CHECKLIST.md)** - Security best practices and checklist
- **[Audit Preparation](AUDIT_PREPARATION.md)** - Preparing for security audits

## Security

- **[Bug Bounty Program](BUG_BOUNTY.md)** - Security bug bounty details ($500K pool)
- **[Incident Response](INCIDENT_RESPONSE.md)** - Emergency response playbook

## API Documentation

- **OpenAPI Spec**: `../api-gateway/openapi.yaml`
- **Postman Collection**: `../api-gateway/postman-collection.json`
- **GraphQL Schema**: `../api-gateway/src/graphql/schema.ts`

## SDK Documentation

Generated with TypeDoc:

```bash
cd ../sdk
npm run docs
```

## Contract Documentation

Generated with Forge:

```bash
cd ../contracts
forge doc
```

## Online Documentation

- Website: https://docs.securemint.io
- API Reference: https://api.securemint.io/docs

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

## License

MIT
