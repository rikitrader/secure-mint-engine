# Contributing to SecureMint Engine

Thank you for your interest in contributing to SecureMint Engine! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please read it before contributing.

## How to Contribute

### Reporting Issues

1. Check if the issue already exists in GitHub Issues
2. If not, create a new issue with:
   - Clear, descriptive title
   - Detailed description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes following our coding standards
4. Write or update tests as needed
5. Ensure all tests pass:
   ```bash
   npm test
   ```
6. Commit with clear, descriptive messages
7. Push to your fork
8. Open a Pull Request

### Pull Request Guidelines

- PRs should focus on a single feature or fix
- Include tests for new functionality
- Update documentation as needed
- Follow existing code style
- Keep commits atomic and well-described

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/secure-mint-engine.git
cd secure-mint-engine

# Install dependencies
cd assets
npm install

# Run tests
npm test

# Run linter
npm run lint
```

## Coding Standards

### Solidity

- Follow Solidity style guide
- Use NatSpec comments for public functions
- Include comprehensive tests
- Optimize for gas where possible

### TypeScript

- Use TypeScript strict mode
- Include type definitions
- Follow ESLint configuration
- Write unit tests for new code

## Testing Requirements

- All new code must have tests
- Maintain >95% code coverage
- Include both unit and integration tests
- Test edge cases and error conditions

## Security

- Never commit secrets or private keys
- Report security vulnerabilities privately
- Follow secure coding practices
- Review OWASP guidelines

## Questions?

Feel free to open an issue for any questions about contributing.

Thank you for helping improve SecureMint Engine!
