# SecureMint Engine - Python CLI Makefile
# MAKE-based local execution for 90-99% token reduction

.PHONY: help install setup mint burn compliance report oracle treasury bridge simulate clean

# Default target
help:
	@echo "SecureMint Engine - Local Python CLI"
	@echo ""
	@echo "Setup:"
	@echo "  make install      Install dependencies"
	@echo "  make setup        Configure environment"
	@echo ""
	@echo "Token Operations:"
	@echo "  make mint FILE=input.csv           Batch mint from CSV"
	@echo "  make mint-dry FILE=input.csv       Dry-run batch mint"
	@echo "  make burn FILE=input.csv           Batch burn from CSV"
	@echo ""
	@echo "Compliance:"
	@echo "  make compliance ADDR=0x...         Check single address"
	@echo "  make compliance FILE=addrs.txt     Bulk compliance check"
	@echo ""
	@echo "Reports:"
	@echo "  make report TYPE=reserve           Reserve attestation"
	@echo "  make report TYPE=monthly           Monthly summary"
	@echo "  make report TYPE=compliance        Compliance report"
	@echo "  make report TYPE=treasury          Treasury report"
	@echo ""
	@echo "Operations:"
	@echo "  make oracle-status                 Check oracle status"
	@echo "  make treasury-status               Check treasury status"
	@echo "  make bridge-status                 Check bridge status"
	@echo "  make invariants                    Check all invariants"
	@echo ""
	@echo "Simulation:"
	@echo "  make simulate FILE=txs.json        Simulate transactions"

# ═══════════════════════════════════════════════════════════════════════════════
# SETUP
# ═══════════════════════════════════════════════════════════════════════════════

install:
	pip install -r requirements.txt

setup:
	@mkdir -p ~/.securemint
	@if [ ! -f ~/.securemint/config.json ]; then \
		echo '{"rpc_url": "http://localhost:8545", "chain_id": 1}' > ~/.securemint/config.json; \
		echo "Created config at ~/.securemint/config.json"; \
	fi
	@echo "Setup complete. Edit ~/.securemint/config.json with your settings."

# ═══════════════════════════════════════════════════════════════════════════════
# TOKEN OPERATIONS
# ═══════════════════════════════════════════════════════════════════════════════

mint:
ifndef FILE
	$(error FILE is required. Usage: make mint FILE=input.csv)
endif
	python securemint_cli.py mint-batch -i $(FILE) -o results.json

mint-dry:
ifndef FILE
	$(error FILE is required. Usage: make mint-dry FILE=input.csv)
endif
	python securemint_cli.py mint-batch -i $(FILE) --dry-run

mint-force:
ifndef FILE
	$(error FILE is required)
endif
	python securemint_cli.py mint-batch -i $(FILE) --force

burn:
ifndef FILE
	$(error FILE is required. Usage: make burn FILE=input.csv)
endif
	python securemint_cli.py burn-batch -i $(FILE) -o burn_results.json

burn-dry:
ifndef FILE
	$(error FILE is required)
endif
	python securemint_cli.py burn-batch -i $(FILE) --dry-run

# ═══════════════════════════════════════════════════════════════════════════════
# COMPLIANCE
# ═══════════════════════════════════════════════════════════════════════════════

compliance:
ifdef ADDR
	python securemint_cli.py compliance -a $(ADDR) --kyc --aml --sanctions
else ifdef FILE
	python securemint_cli.py compliance -i $(FILE) --kyc --aml --sanctions
else
	$(error ADDR or FILE required. Usage: make compliance ADDR=0x... or FILE=addrs.txt)
endif

compliance-kyc:
ifdef ADDR
	python securemint_cli.py compliance -a $(ADDR) --kyc
else ifdef FILE
	python securemint_cli.py compliance -i $(FILE) --kyc
else
	$(error ADDR or FILE required)
endif

compliance-aml:
ifdef ADDR
	python securemint_cli.py compliance -a $(ADDR) --aml
else ifdef FILE
	python securemint_cli.py compliance -i $(FILE) --aml
else
	$(error ADDR or FILE required)
endif

compliance-sanctions:
ifdef ADDR
	python securemint_cli.py compliance -a $(ADDR) --sanctions
else ifdef FILE
	python securemint_cli.py compliance -i $(FILE) --sanctions
else
	$(error ADDR or FILE required)
endif

# ═══════════════════════════════════════════════════════════════════════════════
# REPORTS
# ═══════════════════════════════════════════════════════════════════════════════

report:
ifndef TYPE
	$(error TYPE is required. Options: reserve, monthly, compliance, treasury, bridge, insurance)
endif
	python securemint_cli.py report -t $(TYPE) --markdown -o reports/

report-reserve:
	python securemint_cli.py report -t reserve --include-proof --markdown -o reports/

report-monthly:
	python securemint_cli.py report -t monthly --markdown -o reports/

report-compliance:
	python securemint_cli.py report -t compliance -j $(or $(JURISDICTION),US) --markdown -o reports/

report-treasury:
	python securemint_cli.py report -t treasury --markdown -o reports/

report-bridge:
	python securemint_cli.py report -t bridge --markdown -o reports/

report-insurance:
	python securemint_cli.py report -t insurance --markdown -o reports/

# ═══════════════════════════════════════════════════════════════════════════════
# STATUS CHECKS
# ═══════════════════════════════════════════════════════════════════════════════

oracle-status:
	python securemint_cli.py oracle status

oracle-history:
	python securemint_cli.py oracle history --limit 100 -o oracle_history.json

treasury-status:
	python securemint_cli.py treasury status

treasury-rebalance:
	python securemint_cli.py treasury rebalance

bridge-status:
	python securemint_cli.py bridge status

bridge-pending:
	python securemint_cli.py bridge pending

invariants:
	@echo "Checking SecureMint Invariants..."
	@python -c "import asyncio; from securemint_api import SecureMintAPI; \
		api = SecureMintAPI('$(or $(RPC_URL),http://localhost:8545)'); \
		result = asyncio.run(api.check_invariants()); \
		import json; print(json.dumps(result, indent=2))"

# ═══════════════════════════════════════════════════════════════════════════════
# SIMULATION
# ═══════════════════════════════════════════════════════════════════════════════

simulate:
ifndef FILE
	$(error FILE is required. Usage: make simulate FILE=txs.json)
endif
	python securemint_cli.py simulate --tx-file $(FILE)

simulate-mint:
	@echo "Simulating mint: $(RECIPIENT) $(AMOUNT)"
	python -c "import asyncio; from securemint_api import SecureMintAPI; \
		api = SecureMintAPI('$(or $(RPC_URL),http://localhost:8545)'); \
		# Would call simulate_transaction here"

# ═══════════════════════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

generate-sample:
	@python -c "from bulk_operations import BulkOperator; \
		BulkOperator(None).generate_sample_csv('sample_mint.csv', 10)"
	@echo "Generated sample_mint.csv"

clean:
	rm -rf __pycache__ *.pyc .pytest_cache
	rm -f results.json burn_results.json compliance_results.json
	rm -f oracle_history.json simulation_results.json

clean-reports:
	rm -rf reports/*.json reports/*.md

# ═══════════════════════════════════════════════════════════════════════════════
# ENVIRONMENT VARIABLES
# ═══════════════════════════════════════════════════════════════════════════════

env-check:
	@echo "Environment Check:"
	@echo "  RPC_URL: $(or $(RPC_URL),[not set - using config])"
	@echo "  CHAIN_ID: $(or $(CHAIN_ID),[not set - using config])"
	@echo "  PRIVATE_KEY: $(if $(PRIVATE_KEY),[set],[not set])"
	@echo "  TOKEN_ADDRESS: $(or $(TOKEN_ADDRESS),[not set])"
	@echo "  POLICY_ADDRESS: $(or $(POLICY_ADDRESS),[not set])"
	@echo "  CHAINALYSIS_API_KEY: $(if $(CHAINALYSIS_API_KEY),[set],[not set])"

# ═══════════════════════════════════════════════════════════════════════════════
# BATCH WORKFLOWS
# ═══════════════════════════════════════════════════════════════════════════════

# Full compliance-checked mint workflow
mint-compliant:
ifndef FILE
	$(error FILE is required)
endif
	@echo "Step 1: Compliance check..."
	python securemint_cli.py compliance -i $(FILE) --kyc --aml --sanctions -o compliance_check.json
	@echo ""
	@echo "Step 2: Dry run mint..."
	python securemint_cli.py mint-batch -i $(FILE) --dry-run
	@echo ""
	@echo "Review compliance_check.json before proceeding."
	@echo "Run 'make mint FILE=$(FILE)' to execute."

# Generate all reports
reports-all:
	@mkdir -p reports
	$(MAKE) report-reserve
	$(MAKE) report-monthly
	$(MAKE) report-treasury
	$(MAKE) report-bridge
	$(MAKE) report-insurance
	@echo "All reports generated in reports/"
