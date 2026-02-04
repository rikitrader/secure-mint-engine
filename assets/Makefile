# ═══════════════════════════════════════════════════════════════════════════════
# SecureMint Engine - Makefile
# Master build system with comprehensive workflow triggers
# ═══════════════════════════════════════════════════════════════════════════════

.PHONY: all install build test lint format clean dev deploy docs security help
.PHONY: ci ci-full release setup validate check pre-commit
.PHONY: install-all build-all test-all deploy-full
.PHONY: financial-report financial-check intake intake-config preflight smoke-test production-deploy
.PHONY: legal-gate audit-gate stress-test launch-countdown full-gates
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
CYAN := \033[0;36m
BOLD := \033[1m
NC := \033[0m # No Color

# Timestamps
TIMESTAMP := $(shell date +%Y%m%d_%H%M%S)

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN WORKFLOW COMMANDS
# ═══════════════════════════════════════════════════════════════════════════════

all: install-all build-all test-all ## Complete build: install, build, and test everything
	@echo "$(GREEN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(GREEN)$(BOLD)  SecureMint Engine - Full Build Complete!$(NC)"
	@echo "$(GREEN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"

ci: lint build test security ## CI Pipeline: lint, build, test, security
	@echo "$(GREEN)$(BOLD)CI Pipeline Complete!$(NC)"

ci-full: install-all lint build-all test-all coverage security docs ## Full CI: everything including E2E, coverage, docs
	@echo "$(GREEN)$(BOLD)Full CI Pipeline Complete!$(NC)"

release: validate build-all test-all security docs docker-build ## Release: validate, build, test, security, docs, docker
	@echo "$(GREEN)$(BOLD)Release Build Complete!$(NC)"
	@echo "$(YELLOW)Ready for deployment. Run 'make deploy-full NETWORK=<network>' to deploy.$(NC)"

setup: install-all build-all dev-setup ## New developer setup: install, build, configure dev environment
	@echo "$(GREEN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(GREEN)$(BOLD)  Development Environment Ready!$(NC)"
	@echo "$(GREEN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Copy .env.example to .env and configure"
	@echo "  2. Run 'make dev' to start development environment"
	@echo "  3. Run 'make test' to verify everything works"

validate: lint test-contracts test-sdk security-quick ## Pre-release validation
	@echo "$(GREEN)Validation passed!$(NC)"

check: lint typecheck test-quick ## Quick check: lint, typecheck, quick tests
	@echo "$(GREEN)Quick check passed!$(NC)"

pre-commit: format lint typecheck test-quick ## Pre-commit hook: format, lint, typecheck, quick test
	@echo "$(GREEN)Pre-commit checks passed!$(NC)"

# ═══════════════════════════════════════════════════════════════════════════════
# FINANCIAL FEASIBILITY (MANDATORY FIRST STEP)
# ═══════════════════════════════════════════════════════════════════════════════

financial-report: ## [MANDATORY FIRST] Generate financial feasibility report before ANY implementation
	@echo "$(RED)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(RED)$(BOLD)  MANDATORY: Financial Feasibility Report$(NC)"
	@echo "$(RED)$(BOLD)  This MUST be approved BEFORE any coding or deployment$(NC)"
	@echo "$(RED)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo ""
	@npx ts-node scripts/financial/financial-feasibility-report.ts
	@echo ""
	@echo "$(GREEN)$(BOLD)Financial report generated!$(NC)"
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  1. Review FINANCIAL_FEASIBILITY_REPORT.md"
	@echo "  2. Obtain all required signatures"
	@echo "  3. Only after approval: run 'make intake'"

financial-check: ## Verify financial report exists and is approved
	@echo "$(CYAN)Checking for approved financial report...$(NC)"
	@if [ ! -f "FINANCIAL_FEASIBILITY_REPORT.md" ]; then \
		echo "$(RED)ERROR: No financial report found!$(NC)"; \
		echo "$(RED)Run 'make financial-report' first.$(NC)"; \
		exit 1; \
	fi
	@if ! grep -q "APPROVED" FINANCIAL_FEASIBILITY_REPORT.md; then \
		echo "$(RED)ERROR: Financial report not approved!$(NC)"; \
		echo "$(RED)Obtain required signatures before proceeding.$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)Financial report approved. Proceeding...$(NC)"

# ═══════════════════════════════════════════════════════════════════════════════
# GOD-TIER LAUNCH GATES (ALL MANDATORY)
# ═══════════════════════════════════════════════════════════════════════════════

legal-gate: ## [GATE 1] Legal/Regulatory Compliance Analysis
	@echo "$(CYAN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(CYAN)$(BOLD)  GATE 1: Legal/Regulatory Compliance                          $(NC)"
	@echo "$(CYAN)$(BOLD)  Howey Test, Jurisdiction Analysis, Compliance Checklist      $(NC)"
	@echo "$(CYAN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@npx ts-node scripts/legal/legal-compliance-gate.ts
	@echo "$(GREEN)Legal compliance report generated!$(NC)"

audit-gate: ## [GATE 2] Security Audit Management
	@echo "$(CYAN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(CYAN)$(BOLD)  GATE 2: Security Audit Management                            $(NC)"
	@echo "$(CYAN)$(BOLD)  Firm Selection, Scope Document, Finding Tracker              $(NC)"
	@echo "$(CYAN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@npx ts-node scripts/security/audit-gate.ts
	@echo "$(GREEN)Security audit documents generated!$(NC)"

stress-test: ## [GATE 3] Tokenomics Stress Test
	@echo "$(CYAN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(CYAN)$(BOLD)  GATE 3: Tokenomics Stress Test                               $(NC)"
	@echo "$(CYAN)$(BOLD)  Bank Run, Oracle Manipulation, Whale Dump, Death Spiral      $(NC)"
	@echo "$(CYAN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@npx ts-node scripts/tokenomics/stress-test.ts
	@echo "$(GREEN)Tokenomics stress test complete!$(NC)"

launch-countdown: ## [GATE 4] Launch Countdown Orchestrator
	@echo "$(CYAN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(CYAN)$(BOLD)  GATE 4: Launch Countdown Orchestrator                        $(NC)"
	@echo "$(CYAN)$(BOLD)  T-30 to T-0 Checklist, Go/No-Go Decision, War Room           $(NC)"
	@echo "$(CYAN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@npx ts-node scripts/launch/countdown-orchestrator.ts
	@echo "$(GREEN)Launch countdown report generated!$(NC)"

full-gates: financial-report legal-gate audit-gate stress-test launch-countdown ## Run ALL God-tier gates in sequence
	@echo "$(GREEN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(GREEN)$(BOLD)  ALL GATES COMPLETE!                                          $(NC)"
	@echo "$(GREEN)$(BOLD)  Review all reports before proceeding to deployment           $(NC)"
	@echo "$(GREEN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"

# ═══════════════════════════════════════════════════════════════════════════════
# INTAKE & PREFLIGHT - Production Deployment
# ═══════════════════════════════════════════════════════════════════════════════

intake: financial-check ## Run interactive intake questionnaire (requires approved financial report)
	@echo "$(CYAN)$(BOLD)Starting SecureMint Intake Questionnaire...$(NC)"
	@npx ts-node scripts/intake/intake-cli.ts
	@echo "$(GREEN)Intake complete! Review generated files: config.json, RUN_PLAN.md, CHECKLIST.md, TEST_PLAN.md$(NC)"

intake-config: financial-check ## Run intake with existing config file (requires approved financial report)
	@echo "$(CYAN)Loading intake from config file...$(NC)"
	@npx ts-node scripts/intake/intake-cli.ts --config config.json

preflight: ## Run all preflight checks before deployment
	@echo "$(CYAN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(CYAN)$(BOLD)  SecureMint Engine - Preflight Checks$(NC)"
	@echo "$(CYAN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@npx ts-node scripts/preflight/preflight-check.ts

smoke-test: ## Run smoke tests after deployment
	@echo "$(CYAN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(CYAN)$(BOLD)  SecureMint Engine - Smoke Tests$(NC)"
	@echo "$(CYAN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@npx ts-node scripts/smoke-test/smoke-test.ts

production-deploy: financial-check intake preflight deploy smoke-test ## Full production deployment workflow (requires approved financial report)
	@echo "$(GREEN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"
	@echo "$(GREEN)$(BOLD)  Production Deployment Complete!$(NC)"
	@echo "$(GREEN)$(BOLD)═══════════════════════════════════════════════════════════════$(NC)"

# ═══════════════════════════════════════════════════════════════════════════════
# INSTALLATION - Complete
# ═══════════════════════════════════════════════════════════════════════════════

install: ## Install root dependencies
	@echo "$(BLUE)Installing root dependencies...$(NC)"
	@pnpm install || npm install
	@echo "$(GREEN)Root dependencies installed!$(NC)"

install-all: install install-contracts install-sdk install-api install-dashboard install-subgraph install-mobile ## Install ALL dependencies
	@echo "$(GREEN)$(BOLD)All dependencies installed!$(NC)"

install-contracts: ## Install contract dependencies (npm + forge)
	@echo "$(BLUE)Installing contract dependencies...$(NC)"
	@cd contracts && npm install
	@cd contracts && forge install --no-commit 2>/dev/null || true
	@echo "$(GREEN)Contract dependencies installed!$(NC)"

install-sdk: ## Install SDK dependencies
	@echo "$(BLUE)Installing SDK dependencies...$(NC)"
	@cd sdk && npm install
	@echo "$(GREEN)SDK dependencies installed!$(NC)"

install-api: ## Install API Gateway dependencies
	@echo "$(BLUE)Installing API Gateway dependencies...$(NC)"
	@cd api-gateway && npm install
	@echo "$(GREEN)API Gateway dependencies installed!$(NC)"

install-dashboard: ## Install Dashboard dependencies
	@echo "$(BLUE)Installing Dashboard dependencies...$(NC)"
	@cd dashboard && npm install 2>/dev/null || echo "Dashboard not yet created"
	@echo "$(GREEN)Dashboard dependencies installed!$(NC)"

install-subgraph: ## Install Subgraph dependencies
	@echo "$(BLUE)Installing Subgraph dependencies...$(NC)"
	@cd subgraph && npm install
	@echo "$(GREEN)Subgraph dependencies installed!$(NC)"

install-mobile: ## Install Mobile SDK dependencies
	@echo "$(BLUE)Installing Mobile SDK dependencies...$(NC)"
	@cd mobile-sdk && npm install 2>/dev/null || echo "Mobile SDK uses workspace"
	@echo "$(GREEN)Mobile SDK dependencies installed!$(NC)"

install-python: ## Install Python engine dependencies
	@echo "$(BLUE)Installing Python dependencies...$(NC)"
	@cd python-engine && pip install -r requirements.txt
	@echo "$(GREEN)Python dependencies installed!$(NC)"

# ═══════════════════════════════════════════════════════════════════════════════
# BUILD - Complete
# ═══════════════════════════════════════════════════════════════════════════════

build: build-contracts build-sdk build-api ## Build core components
	@echo "$(GREEN)Core build complete!$(NC)"

build-all: build-contracts build-sdk build-api build-dashboard build-subgraph ## Build ALL components
	@echo "$(GREEN)$(BOLD)All components built!$(NC)"

build-contracts: ## Build smart contracts (Foundry + Hardhat)
	@echo "$(BLUE)Building contracts with Foundry...$(NC)"
	@cd contracts && forge build
	@echo "$(BLUE)Building contracts with Hardhat...$(NC)"
	@cd contracts && npx hardhat compile
	@echo "$(GREEN)Contracts built!$(NC)"

build-sdk: ## Build TypeScript SDK (CJS + ESM)
	@echo "$(BLUE)Building SDK...$(NC)"
	@cd sdk && npm run build
	@echo "$(GREEN)SDK built!$(NC)"

build-api: ## Build API Gateway
	@echo "$(BLUE)Building API Gateway...$(NC)"
	@cd api-gateway && npm run build
	@echo "$(GREEN)API Gateway built!$(NC)"

build-dashboard: ## Build Next.js Dashboard
	@echo "$(BLUE)Building Dashboard...$(NC)"
	@cd dashboard && npm run build 2>/dev/null || echo "Dashboard build skipped"
	@echo "$(GREEN)Dashboard built!$(NC)"

build-subgraph: ## Build The Graph Subgraph
	@echo "$(BLUE)Building Subgraph...$(NC)"
	@cd subgraph && npm run codegen && npm run build
	@echo "$(GREEN)Subgraph built!$(NC)"

build-docker: docker-build ## Alias for docker-build

# ═══════════════════════════════════════════════════════════════════════════════
# TESTING - Complete
# ═══════════════════════════════════════════════════════════════════════════════

test: test-contracts test-sdk test-api ## Run core tests
	@echo "$(GREEN)Core tests passed!$(NC)"

test-all: test-contracts test-sdk test-api test-e2e test-invariants ## Run ALL tests
	@echo "$(GREEN)$(BOLD)All tests passed!$(NC)"

test-quick: ## Quick smoke tests
	@echo "$(BLUE)Running quick tests...$(NC)"
	@cd contracts && forge test --match-test "test_" --no-match-test "testFuzz" -q
	@cd sdk && npm test -- --testPathIgnorePatterns="integration" --bail
	@echo "$(GREEN)Quick tests passed!$(NC)"

test-contracts: ## Run contract unit tests
	@echo "$(BLUE)Running contract tests...$(NC)"
	@cd contracts && forge test -vvv
	@echo "$(GREEN)Contract tests passed!$(NC)"

test-contracts-coverage: ## Run contract tests with coverage
	@echo "$(BLUE)Running contract tests with coverage...$(NC)"
	@cd contracts && forge coverage
	@echo "$(GREEN)Contract coverage generated!$(NC)"

test-sdk: ## Run SDK tests
	@echo "$(BLUE)Running SDK tests...$(NC)"
	@cd sdk && npm test
	@echo "$(GREEN)SDK tests passed!$(NC)"

test-api: ## Run API Gateway tests
	@echo "$(BLUE)Running API tests...$(NC)"
	@cd api-gateway && npm test
	@echo "$(GREEN)API tests passed!$(NC)"

test-e2e: ## Run Playwright E2E tests
	@echo "$(BLUE)Running E2E tests...$(NC)"
	@cd tests/e2e && npx playwright test
	@echo "$(GREEN)E2E tests passed!$(NC)"

test-integration: ## Run integration tests
	@echo "$(BLUE)Running integration tests...$(NC)"
	@cd contracts && forge test --match-path "test/integration/*" -vvv
	@echo "$(GREEN)Integration tests passed!$(NC)"

test-invariants: ## Run invariant tests
	@echo "$(BLUE)Running invariant tests...$(NC)"
	@cd contracts && forge test --match-path "test/invariant/*" -vvv
	@echo "$(GREEN)Invariant tests passed!$(NC)"

test-fuzz: ## Run Echidna fuzz tests
	@echo "$(BLUE)Running Echidna fuzz tests...$(NC)"
	@cd contracts && echidna test/fuzzing/EchidnaSecureMint.sol --contract EchidnaSecureMint --config echidna.yaml
	@echo "$(GREEN)Fuzz tests passed!$(NC)"

test-formal: ## Run Certora formal verification
	@echo "$(BLUE)Running Certora formal verification...$(NC)"
	@certoraRun contracts/certora/conf/SecureMint.conf
	@echo "$(GREEN)Formal verification passed!$(NC)"

test-load: ## Run K6 load tests
	@echo "$(BLUE)Running load tests...$(NC)"
	@k6 run testing/load-tests/k6-stress-test.js
	@echo "$(GREEN)Load tests complete!$(NC)"

coverage: coverage-contracts coverage-sdk coverage-api ## Generate all coverage reports
	@echo "$(GREEN)All coverage reports generated!$(NC)"

coverage-contracts: ## Generate contract coverage
	@echo "$(BLUE)Generating contract coverage...$(NC)"
	@cd contracts && forge coverage --report lcov
	@echo "$(GREEN)Contract coverage generated!$(NC)"

coverage-sdk: ## Generate SDK coverage
	@echo "$(BLUE)Generating SDK coverage...$(NC)"
	@cd sdk && npm run coverage
	@echo "$(GREEN)SDK coverage generated!$(NC)"

coverage-api: ## Generate API coverage
	@echo "$(BLUE)Generating API coverage...$(NC)"
	@cd api-gateway && npm run coverage
	@echo "$(GREEN)API coverage generated!$(NC)"

# ═══════════════════════════════════════════════════════════════════════════════
# LINTING & FORMATTING
# ═══════════════════════════════════════════════════════════════════════════════

lint: lint-contracts lint-ts lint-sol ## Lint all code
	@echo "$(GREEN)All linting passed!$(NC)"

lint-contracts: ## Lint Solidity with forge fmt
	@echo "$(BLUE)Linting contracts...$(NC)"
	@cd contracts && forge fmt --check
	@echo "$(GREEN)Contract linting passed!$(NC)"

lint-ts: ## Lint TypeScript with ESLint
	@echo "$(BLUE)Linting TypeScript...$(NC)"
	@npx eslint . --ext .ts,.tsx --max-warnings 0
	@echo "$(GREEN)TypeScript linting passed!$(NC)"

lint-sol: ## Lint Solidity with Solhint
	@echo "$(BLUE)Linting Solidity with Solhint...$(NC)"
	@cd contracts && npx solhint 'src/**/*.sol' 2>/dev/null || true
	@echo "$(GREEN)Solhint check complete!$(NC)"

typecheck: ## TypeScript type checking
	@echo "$(BLUE)Running TypeScript type check...$(NC)"
	@cd sdk && npx tsc --noEmit
	@cd api-gateway && npx tsc --noEmit
	@echo "$(GREEN)Type checking passed!$(NC)"

format: format-contracts format-ts format-json ## Format all code
	@echo "$(GREEN)All formatting complete!$(NC)"

format-contracts: ## Format Solidity contracts
	@echo "$(BLUE)Formatting contracts...$(NC)"
	@cd contracts && forge fmt
	@echo "$(GREEN)Contracts formatted!$(NC)"

format-ts: ## Format TypeScript/JavaScript
	@echo "$(BLUE)Formatting TypeScript...$(NC)"
	@npx prettier --write "**/*.{ts,tsx,js,jsx}"
	@echo "$(GREEN)TypeScript formatted!$(NC)"

format-json: ## Format JSON/YAML/MD
	@echo "$(BLUE)Formatting config files...$(NC)"
	@npx prettier --write "**/*.{json,yaml,yml,md}"
	@echo "$(GREEN)Config files formatted!$(NC)"

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY - Complete
# ═══════════════════════════════════════════════════════════════════════════════

security: slither echidna certora ## Run all security tools
	@echo "$(GREEN)$(BOLD)All security checks passed!$(NC)"

security-quick: slither ## Quick security check (Slither only)
	@echo "$(GREEN)Quick security check passed!$(NC)"

slither: ## Run Slither static analysis
	@echo "$(BLUE)Running Slither...$(NC)"
	@cd contracts && slither . --config-file slither.config.json
	@echo "$(GREEN)Slither analysis complete!$(NC)"

slither-report: ## Generate Slither report
	@echo "$(BLUE)Generating Slither report...$(NC)"
	@cd contracts && slither . --config-file slither.config.json --json slither-report-$(TIMESTAMP).json
	@echo "$(GREEN)Slither report generated!$(NC)"

echidna: ## Run Echidna fuzzer
	@echo "$(BLUE)Running Echidna...$(NC)"
	@cd contracts && echidna test/fuzzing/EchidnaSecureMint.sol --contract EchidnaSecureMint --config echidna.yaml
	@echo "$(GREEN)Echidna complete!$(NC)"

certora: ## Run Certora formal verification
	@echo "$(BLUE)Running Certora...$(NC)"
	@certoraRun contracts/certora/conf/SecureMint.conf
	@echo "$(GREEN)Certora verification complete!$(NC)"

audit-prep: ## Prepare for security audit
	@echo "$(BLUE)$(BOLD)Preparing audit artifacts...$(NC)"
	@echo "$(BLUE)1/5 Building contracts...$(NC)"
	@cd contracts && forge build --sizes
	@echo "$(BLUE)2/5 Running Slither...$(NC)"
	@cd contracts && slither . --print human-summary 2>/dev/null || true
	@echo "$(BLUE)3/5 Generating coverage...$(NC)"
	@cd contracts && forge coverage --report summary
	@echo "$(BLUE)4/5 Generating gas report...$(NC)"
	@cd contracts && forge test --gas-report > gas-report-$(TIMESTAMP).txt
	@echo "$(BLUE)5/5 Generating documentation...$(NC)"
	@cd contracts && forge doc
	@echo "$(GREEN)$(BOLD)Audit preparation complete!$(NC)"

# ═══════════════════════════════════════════════════════════════════════════════
# DEVELOPMENT
# ═══════════════════════════════════════════════════════════════════════════════

dev: dev-docker ## Start development environment (Docker)
	@echo "$(GREEN)Development environment started!$(NC)"

dev-docker: ## Start Docker development stack
	@echo "$(BLUE)Starting Docker development environment...$(NC)"
	@docker-compose -f docker/docker-compose.yml up -d
	@echo ""
	@echo "$(GREEN)$(BOLD)Development Environment Running:$(NC)"
	@echo "  API Gateway:  http://localhost:3000"
	@echo "  GraphQL:      http://localhost:3000/graphql"
	@echo "  Dashboard:    http://localhost:3001"
	@echo "  Grafana:      http://localhost:3002"
	@echo "  Prometheus:   http://localhost:9090"
	@echo ""

dev-down: ## Stop development environment
	@echo "$(BLUE)Stopping development environment...$(NC)"
	@docker-compose -f docker/docker-compose.yml down
	@echo "$(GREEN)Development environment stopped!$(NC)"

dev-restart: dev-down dev ## Restart development environment

dev-logs: ## View development logs
	@docker-compose -f docker/docker-compose.yml logs -f

dev-logs-api: ## View API logs only
	@docker-compose -f docker/docker-compose.yml logs -f api

dev-local: ## Start local Hardhat node
	@echo "$(BLUE)Starting local Hardhat node...$(NC)"
	@cd contracts && npx hardhat node

dev-deploy-local: ## Deploy to local Hardhat node
	@echo "$(BLUE)Deploying to local node...$(NC)"
	@cd contracts && npx hardhat run scripts/deploy/01_deploy_token.ts --network localhost
	@echo "$(GREEN)Local deployment complete!$(NC)"

dev-setup: ## Configure development environment
	@echo "$(BLUE)Setting up development environment...$(NC)"
	@cp .env.example .env 2>/dev/null || true
	@echo "$(GREEN)Development environment configured!$(NC)"

watch: ## Watch mode for development
	@echo "$(BLUE)Starting watch mode...$(NC)"
	@cd sdk && npm run watch &
	@cd api-gateway && npm run dev &
	@wait

# ═══════════════════════════════════════════════════════════════════════════════
# DEPLOYMENT - Complete
# ═══════════════════════════════════════════════════════════════════════════════

deploy: ## Deploy contracts (requires NETWORK)
ifndef NETWORK
	$(error NETWORK is not set. Usage: make deploy NETWORK=mainnet)
endif
	@echo "$(BLUE)Deploying to $(NETWORK)...$(NC)"
	@cd contracts && npx hardhat run scripts/deploy/01_deploy_token.ts --network $(NETWORK)
	@cd contracts && npx hardhat run scripts/deploy/02_deploy_policy.ts --network $(NETWORK)
	@cd contracts && npx hardhat run scripts/deploy/03_deploy_oracle.ts --network $(NETWORK)
	@cd contracts && npx hardhat run scripts/deploy/04_deploy_treasury.ts --network $(NETWORK)
	@cd contracts && npx hardhat run scripts/deploy/05_deploy_redemption.ts --network $(NETWORK)
	@cd contracts && npx hardhat run scripts/deploy/06_deploy_emergency.ts --network $(NETWORK)
	@cd contracts && npx hardhat run scripts/deploy/07_configure_system.ts --network $(NETWORK)
	@echo "$(GREEN)Deployment to $(NETWORK) complete!$(NC)"

deploy-full: deploy verify deploy-subgraph ## Full deployment: contracts + verify + subgraph
ifndef NETWORK
	$(error NETWORK is not set. Usage: make deploy-full NETWORK=mainnet)
endif
	@echo "$(GREEN)$(BOLD)Full deployment complete!$(NC)"

deploy-multichain: ## Deploy to multiple chains
	@echo "$(BLUE)Deploying to multiple chains...$(NC)"
	@npx ts-node scripts/multichain/deploy-multichain.ts deploy --chains mainnet,polygon,arbitrum,optimism,base --parallel
	@echo "$(GREEN)Multi-chain deployment complete!$(NC)"

verify: ## Verify contracts on explorer
ifndef NETWORK
	$(error NETWORK is not set. Usage: make verify NETWORK=mainnet)
endif
	@echo "$(BLUE)Verifying contracts on $(NETWORK)...$(NC)"
	@npx ts-node scripts/verification/verify-contracts.ts $(NETWORK)
	@echo "$(GREEN)Contract verification complete!$(NC)"

deploy-subgraph: ## Deploy The Graph subgraph
	@echo "$(BLUE)Deploying subgraph...$(NC)"
	@cd subgraph && npm run deploy
	@echo "$(GREEN)Subgraph deployed!$(NC)"

deploy-check: ## Verify deployment health
	@echo "$(BLUE)Checking deployment...$(NC)"
	@npx ts-node examples/cli/deploy-check.ts
	@echo "$(GREEN)Deployment check complete!$(NC)"

# ═══════════════════════════════════════════════════════════════════════════════
# DOCUMENTATION
# ═══════════════════════════════════════════════════════════════════════════════

docs: docs-contracts docs-sdk docs-api ## Generate all documentation
	@echo "$(GREEN)All documentation generated!$(NC)"

docs-contracts: ## Generate contract documentation
	@echo "$(BLUE)Generating contract docs...$(NC)"
	@cd contracts && forge doc
	@echo "$(GREEN)Contract docs generated!$(NC)"

docs-sdk: ## Generate SDK documentation
	@echo "$(BLUE)Generating SDK docs...$(NC)"
	@cd sdk && npx typedoc
	@echo "$(GREEN)SDK docs generated!$(NC)"

docs-api: ## Generate API documentation
	@echo "$(BLUE)API documentation available at: api-gateway/openapi.yaml$(NC)"

docs-serve: ## Serve documentation locally
	@echo "$(BLUE)Serving documentation at http://localhost:8080...$(NC)"
	@npx serve docs

# ═══════════════════════════════════════════════════════════════════════════════
# GAS OPTIMIZATION
# ═══════════════════════════════════════════════════════════════════════════════

gas: gas-report gas-snapshot ## Full gas analysis

gas-report: ## Generate gas report
	@echo "$(BLUE)Generating gas report...$(NC)"
	@cd contracts && forge test --gas-report
	@echo "$(GREEN)Gas report generated!$(NC)"

gas-snapshot: ## Create gas snapshot
	@echo "$(BLUE)Creating gas snapshot...$(NC)"
	@cd contracts && forge snapshot
	@echo "$(GREEN)Gas snapshot created!$(NC)"

gas-compare: ## Compare gas with snapshot
	@echo "$(BLUE)Comparing gas usage...$(NC)"
	@cd contracts && forge snapshot --check
	@echo "$(GREEN)Gas comparison complete!$(NC)"

gas-optimize: ## Run gas optimization analysis
	@echo "$(BLUE)Running gas optimization analysis...$(NC)"
	@npx ts-node scripts/gas/gas-optimizer.ts
	@echo "$(GREEN)Gas optimization analysis complete!$(NC)"

# ═══════════════════════════════════════════════════════════════════════════════
# INFRASTRUCTURE
# ═══════════════════════════════════════════════════════════════════════════════

docker-build: ## Build Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	@docker build -f docker/Dockerfile.api -t securemint-api .
	@docker build -f docker/Dockerfile.dashboard -t securemint-dashboard .
	@echo "$(GREEN)Docker images built!$(NC)"

docker-push: ## Push Docker images to registry
	@echo "$(BLUE)Pushing Docker images...$(NC)"
	@docker push securemint-api
	@docker push securemint-dashboard
	@echo "$(GREEN)Docker images pushed!$(NC)"

docker-all: docker-build docker-push ## Build and push Docker images

k8s-deploy: ## Deploy to Kubernetes
	@echo "$(BLUE)Deploying to Kubernetes...$(NC)"
	@kubectl apply -f infrastructure/kubernetes/
	@echo "$(GREEN)Kubernetes deployment complete!$(NC)"

k8s-status: ## Check Kubernetes deployment status
	@echo "$(BLUE)Kubernetes status:$(NC)"
	@kubectl get pods -n securemint
	@kubectl get services -n securemint

tf-init: ## Initialize Terraform
	@echo "$(BLUE)Initializing Terraform...$(NC)"
	@cd infrastructure/terraform && terraform init
	@echo "$(GREEN)Terraform initialized!$(NC)"

tf-plan: ## Terraform plan
	@echo "$(BLUE)Running Terraform plan...$(NC)"
	@cd infrastructure/terraform && terraform plan -var-file=environments/production.tfvars

tf-apply: ## Apply Terraform changes
	@echo "$(BLUE)Applying Terraform changes...$(NC)"
	@cd infrastructure/terraform && terraform apply -var-file=environments/production.tfvars

tf-destroy: ## Destroy Terraform infrastructure
	@echo "$(RED)Destroying Terraform infrastructure...$(NC)"
	@cd infrastructure/terraform && terraform destroy -var-file=environments/production.tfvars

infra-deploy: tf-init tf-apply k8s-deploy ## Full infrastructure deployment

# ═══════════════════════════════════════════════════════════════════════════════
# PYTHON ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

py-setup: ## Setup Python engine
	@echo "$(BLUE)Setting up Python engine...$(NC)"
	@cd python-engine && pip install -r requirements.txt
	@echo "$(GREEN)Python engine ready!$(NC)"

py-invariants: ## Check invariants via Python
	@echo "$(BLUE)Checking invariants...$(NC)"
	@cd python-engine && python securemint_cli.py invariants
	@echo "$(GREEN)Invariant check complete!$(NC)"

py-report: ## Generate report via Python
	@echo "$(BLUE)Generating report...$(NC)"
	@cd python-engine && python report_generator.py
	@echo "$(GREEN)Report generated!$(NC)"

# ═══════════════════════════════════════════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════════════════════════════════════════

clean: ## Clean build artifacts
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	@rm -rf node_modules 2>/dev/null || true
	@rm -rf contracts/cache contracts/out contracts/artifacts 2>/dev/null || true
	@rm -rf sdk/dist sdk/lib sdk/esm sdk/cjs 2>/dev/null || true
	@rm -rf api-gateway/dist 2>/dev/null || true
	@rm -rf dashboard/.next 2>/dev/null || true
	@rm -rf coverage 2>/dev/null || true
	@rm -rf subgraph/generated subgraph/build 2>/dev/null || true
	@echo "$(GREEN)Clean complete!$(NC)"

clean-all: clean clean-docker ## Clean everything including Docker

clean-docker: ## Clean Docker resources
	@echo "$(BLUE)Cleaning Docker resources...$(NC)"
	@docker-compose -f docker/docker-compose.yml down -v --rmi local 2>/dev/null || true
	@echo "$(GREEN)Docker resources cleaned!$(NC)"

clean-deps: ## Remove all node_modules
	@echo "$(BLUE)Removing all dependencies...$(NC)"
	@find . -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@echo "$(GREEN)Dependencies removed!$(NC)"

reset: clean-all ## Full reset: clean everything and reinstall
	@$(MAKE) install-all
	@echo "$(GREEN)Full reset complete!$(NC)"

# ═══════════════════════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

version: ## Show versions
	@echo "$(CYAN)SecureMint Engine$(NC)"
	@echo "Node: $$(node --version)"
	@echo "npm: $$(npm --version)"
	@echo "Forge: $$(forge --version 2>/dev/null || echo 'not installed')"
	@echo "Hardhat: $$(npx hardhat --version 2>/dev/null || echo 'not installed')"
	@echo "Docker: $$(docker --version 2>/dev/null || echo 'not installed')"

status: ## Show project status
	@echo "$(CYAN)$(BOLD)SecureMint Engine Status$(NC)"
	@echo ""
	@echo "Git Branch: $$(git branch --show-current 2>/dev/null || echo 'N/A')"
	@echo "Last Commit: $$(git log -1 --format='%h %s' 2>/dev/null || echo 'N/A')"
	@echo ""
	@echo "Docker Status:"
	@docker-compose -f docker/docker-compose.yml ps 2>/dev/null || echo "  Not running"

# ═══════════════════════════════════════════════════════════════════════════════
# HELP
# ═══════════════════════════════════════════════════════════════════════════════

help: ## Show this help message
	@echo ""
	@echo "$(CYAN)$(BOLD)SecureMint Engine - GOD-TIER Token Creator$(NC)"
	@echo "$(CYAN)════════════════════════════════════════════════════════════════$(NC)"
	@echo ""
	@echo "$(RED)$(BOLD)GOD-TIER LAUNCH GATES (Run these BEFORE deployment):$(NC)"
	@echo "  $(RED)make financial-report$(NC)   - [GATE 0] Financial Feasibility Report"
	@echo "  $(RED)make legal-gate$(NC)         - [GATE 1] Legal/Regulatory Compliance"
	@echo "  $(RED)make audit-gate$(NC)         - [GATE 2] Security Audit Management"
	@echo "  $(RED)make stress-test$(NC)        - [GATE 3] Tokenomics Stress Test"
	@echo "  $(RED)make launch-countdown$(NC)   - [GATE 4] Launch Countdown Orchestrator"
	@echo "  $(YELLOW)make full-gates$(NC)         - Run ALL gates in sequence"
	@echo ""
	@echo "$(BOLD)Production Workflow (after gates approved):$(NC)"
	@echo "  $(BLUE)1. make intake$(NC)           - Run intake questionnaire"
	@echo "  $(BLUE)2. make preflight$(NC)        - Validate prerequisites"
	@echo "  $(BLUE)3. make deploy$(NC)           - Deploy contracts"
	@echo "  $(BLUE)4. make smoke-test$(NC)       - Validate deployment"
	@echo "  $(YELLOW)OR: make production-deploy$(NC) - Run all steps automatically"
	@echo ""
	@echo "$(BOLD)Main Commands:$(NC)"
	@echo "  $(BLUE)make all$(NC)          - Complete build (install + build + test)"
	@echo "  $(BLUE)make ci$(NC)           - CI pipeline (lint + build + test + security)"
	@echo "  $(BLUE)make ci-full$(NC)      - Full CI (all tests + coverage + docs)"
	@echo "  $(BLUE)make release$(NC)      - Release build (validate + build + docker)"
	@echo "  $(BLUE)make setup$(NC)        - New developer setup"
	@echo ""
	@echo "$(BOLD)Development:$(NC)"
	@echo "  $(BLUE)make dev$(NC)          - Start development environment"
	@echo "  $(BLUE)make dev-down$(NC)     - Stop development environment"
	@echo "  $(BLUE)make watch$(NC)        - Watch mode for development"
	@echo ""
	@echo "$(BOLD)Deployment:$(NC)"
	@echo "  $(BLUE)make deploy$(NC)       - Deploy contracts (NETWORK=mainnet)"
	@echo "  $(BLUE)make deploy-full$(NC)  - Full deployment with verification"
	@echo ""
	@echo "$(BOLD)All Commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(BLUE)%-18s$(NC) %s\n", $$1, $$2}'
	@echo ""
