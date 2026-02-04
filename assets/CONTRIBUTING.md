# Contributing to SecureMint Engine

Thank you for your interest in contributing to SecureMint Engine! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Security](#security)

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to conduct@securemint.io.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Foundry (for contract development)
- Docker (for local development)
- Git

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/securemint-engine.git
cd securemint-engine
```

3. Add the upstream remote:

```bash
git remote add upstream https://github.com/securemint/engine.git
```

## Development Setup

### Install Dependencies

```bash
# Install all dependencies
make install

# Or manually:
pnpm install
cd contracts && forge install
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

### Start Development Environment

```bash
# Start all services
make dev

# Or with Docker
docker-compose up -d
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/` - New features (e.g., `feature/add-bridge-support`)
- `fix/` - Bug fixes (e.g., `fix/oracle-staleness-check`)
- `docs/` - Documentation (e.g., `docs/update-api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/simplify-mint-logic`)
- `test/` - Test additions/fixes (e.g., `test/add-fuzz-tests`)

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code restructuring
- `test` - Adding tests
- `chore` - Maintenance

Examples:
```
feat(contracts): add cross-chain bridge support

Implements lock-and-mint bridge with multi-sig validator set.

Closes #123
```

```
fix(sdk): handle oracle staleness correctly

The SDK was not properly checking the staleness threshold
when the oracle returned a zero timestamp.

Fixes #456
```

## Submitting Changes

### Pull Request Process

1. Create your feature branch:
```bash
git checkout -b feature/my-feature
```

2. Make your changes and commit:
```bash
git add .
git commit -m "feat(scope): description"
```

3. Push to your fork:
```bash
git push origin feature/my-feature
```

4. Create a Pull Request on GitHub

### PR Requirements

- [ ] Follows coding standards
- [ ] Includes tests for new functionality
- [ ] All tests pass
- [ ] Documentation updated (if applicable)
- [ ] No breaking changes (or clearly documented)
- [ ] Security implications considered

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Prefer interfaces over type aliases for objects
- Use meaningful variable names
- Add JSDoc comments for public APIs

```typescript
/**
 * Simulates a mint operation without executing it.
 * @param recipient - The address to receive tokens
 * @param amount - The amount to mint (in smallest unit)
 * @returns Simulation result with gas estimate
 */
async function simulateMint(
  recipient: string,
  amount: string
): Promise<SimulationResult> {
  // Implementation
}
```

### Solidity

- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Use NatSpec comments for all public functions
- Prefer custom errors over require strings
- Use OpenZeppelin contracts where possible
- Add events for all state changes

```solidity
/// @notice Mints tokens to recipient if backing is sufficient
/// @param recipient The address to receive tokens
/// @param amount The amount to mint
/// @dev Reverts if invariants are violated
function mint(address recipient, uint256 amount) external onlyMinter {
    // Check invariants before minting
    if (totalSupply() + amount > getBacking()) {
        revert InsufficientBacking(amount, getBacking());
    }

    _mint(recipient, amount);
    emit Minted(msg.sender, recipient, amount);
}
```

### Formatting

- Use Prettier for TypeScript/JavaScript
- Use forge fmt for Solidity
- Run linting before committing:

```bash
make lint
```

## Testing

### Running Tests

```bash
# All tests
make test

# Specific components
make test-contracts
make test-sdk
make test-api

# With coverage
make coverage
```

### Writing Tests

- Aim for >90% code coverage
- Test edge cases and error conditions
- Use descriptive test names
- Group related tests with `describe`

```typescript
describe('SecureMintSDK', () => {
  describe('simulateMint', () => {
    it('should return success for valid mint within capacity', async () => {
      // Test implementation
    });

    it('should return failure when backing is insufficient', async () => {
      // Test implementation
    });

    it('should throw when recipient is invalid address', async () => {
      // Test implementation
    });
  });
});
```

### Contract Testing

```solidity
function test_Mint_Success() public {
    // Arrange
    uint256 amount = 1000 * 10 ** 6;
    address recipient = address(0x123);

    // Act
    vm.prank(minter);
    token.mint(recipient, amount);

    // Assert
    assertEq(token.balanceOf(recipient), amount);
}

function test_Mint_RevertWhen_InsufficientBacking() public {
    // Arrange
    uint256 hugeAmount = 1_000_000_000 * 10 ** 6;

    // Act & Assert
    vm.expectRevert(SecureMintPolicy.InsufficientBacking.selector);
    vm.prank(minter);
    token.mint(address(0x123), hugeAmount);
}
```

## Security

### Reporting Vulnerabilities

**DO NOT report security vulnerabilities through GitHub issues.**

For security vulnerabilities, please email security@securemint.io with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

See our [Bug Bounty Program](docs/BUG_BOUNTY.md) for rewards.

### Security Considerations

When contributing:
- Review for reentrancy vulnerabilities
- Check access control on all functions
- Validate all inputs
- Consider gas optimization attacks
- Test with edge cases (0, max values, etc.)
- Run Slither on contract changes

```bash
# Run security checks
make security
```

## Questions?

- Open a [Discussion](https://github.com/securemint/engine/discussions)
- Join our [Discord](https://discord.gg/securemint)
- Email: contributors@securemint.io

Thank you for contributing to SecureMint Engine!
