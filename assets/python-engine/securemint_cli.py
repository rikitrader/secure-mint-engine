#!/usr/bin/env python3
"""
SecureMint Engine - Local Python CLI
Executes bulk operations locally with API access for 90-99% token reduction.

Usage:
    python securemint_cli.py <command> [options]

Commands:
    mint-batch      Batch mint tokens
    burn-batch      Batch burn tokens
    compliance      Run compliance checks
    report          Generate reports
    simulate        Simulate transactions
    oracle          Oracle operations
    treasury        Treasury management
    bridge          Cross-chain operations
"""

import os
import sys
import json
import asyncio
import argparse
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pathlib import Path

# Add local modules to path
sys.path.insert(0, str(Path(__file__).parent))

from securemint_api import SecureMintAPI
from bulk_operations import BulkOperator
from compliance_engine import ComplianceEngine
from report_generator import ReportGenerator


class SecureMintCLI:
    """Main CLI interface for SecureMint local execution."""

    def __init__(self):
        self.api: Optional[SecureMintAPI] = None
        self.config_path = Path.home() / ".securemint" / "config.json"
        self.load_config()

    def load_config(self):
        """Load configuration from file."""
        if self.config_path.exists():
            with open(self.config_path) as f:
                self.config = json.load(f)
        else:
            self.config = {
                "rpc_url": os.getenv("RPC_URL", "http://localhost:8545"),
                "chain_id": int(os.getenv("CHAIN_ID", "1")),
                "private_key": os.getenv("PRIVATE_KEY", ""),
                "contracts": {
                    "token": os.getenv("TOKEN_ADDRESS", ""),
                    "policy": os.getenv("POLICY_ADDRESS", ""),
                    "oracle": os.getenv("ORACLE_ADDRESS", ""),
                    "treasury": os.getenv("TREASURY_ADDRESS", ""),
                    "bridge": os.getenv("BRIDGE_ADDRESS", ""),
                }
            }

    def save_config(self):
        """Save configuration to file."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)

    def connect(self):
        """Initialize API connection."""
        if not self.api:
            self.api = SecureMintAPI(
                rpc_url=self.config["rpc_url"],
                chain_id=self.config["chain_id"],
                private_key=self.config.get("private_key"),
                contracts=self.config.get("contracts", {})
            )
        return self.api

    # ═══════════════════════════════════════════════════════════════════════════
    # BATCH MINTING
    # ═══════════════════════════════════════════════════════════════════════════

    async def mint_batch(self, args):
        """
        Batch mint tokens from CSV/JSON input.

        Input format (CSV): recipient,amount
        Input format (JSON): [{"recipient": "0x...", "amount": "1000000"}]
        """
        api = self.connect()
        bulk = BulkOperator(api)

        # Load mint requests from file
        input_file = Path(args.input)
        if not input_file.exists():
            print(f"Error: Input file not found: {input_file}")
            return 1

        if input_file.suffix == '.csv':
            requests = bulk.load_csv(input_file)
        else:
            requests = bulk.load_json(input_file)

        print(f"Loaded {len(requests)} mint requests")

        # Validate all requests first
        print("Validating requests...")
        validation = await bulk.validate_mint_batch(requests)

        if validation["errors"]:
            print(f"Validation errors: {len(validation['errors'])}")
            for err in validation["errors"][:10]:
                print(f"  - {err}")
            if not args.force:
                return 1

        # Check invariants before minting
        print("Checking invariants...")
        invariants = await api.check_invariants()
        if not invariants["all_valid"]:
            print("WARNING: Invariant violations detected!")
            for inv, status in invariants["results"].items():
                if not status["valid"]:
                    print(f"  - {inv}: {status['message']}")
            if not args.force:
                return 1

        # Execute batch mint
        print(f"Executing batch mint ({len(requests)} transactions)...")

        if args.dry_run:
            print("DRY RUN - No transactions will be sent")
            results = await bulk.simulate_mint_batch(requests)
        else:
            results = await bulk.execute_mint_batch(
                requests,
                batch_size=args.batch_size,
                gas_price_gwei=args.gas_price,
                max_retries=args.retries
            )

        # Output results
        output_file = Path(args.output) if args.output else input_file.with_suffix('.results.json')
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)

        print(f"\nResults saved to: {output_file}")
        print(f"  Success: {results['success_count']}")
        print(f"  Failed: {results['failure_count']}")
        print(f"  Total gas used: {results['total_gas_used']}")

        return 0 if results['failure_count'] == 0 else 1

    # ═══════════════════════════════════════════════════════════════════════════
    # BATCH BURNING
    # ═══════════════════════════════════════════════════════════════════════════

    async def burn_batch(self, args):
        """Batch burn tokens."""
        api = self.connect()
        bulk = BulkOperator(api)

        input_file = Path(args.input)
        if input_file.suffix == '.csv':
            requests = bulk.load_csv(input_file)
        else:
            requests = bulk.load_json(input_file)

        print(f"Loaded {len(requests)} burn requests")

        if args.dry_run:
            results = await bulk.simulate_burn_batch(requests)
        else:
            results = await bulk.execute_burn_batch(
                requests,
                batch_size=args.batch_size
            )

        output_file = Path(args.output) if args.output else input_file.with_suffix('.results.json')
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)

        print(f"Results saved to: {output_file}")
        return 0

    # ═══════════════════════════════════════════════════════════════════════════
    # COMPLIANCE
    # ═══════════════════════════════════════════════════════════════════════════

    async def compliance_check(self, args):
        """Run compliance checks on addresses."""
        api = self.connect()
        compliance = ComplianceEngine(api, args.jurisdiction)

        # Load addresses
        if args.address:
            addresses = [args.address]
        elif args.input:
            with open(args.input) as f:
                if args.input.endswith('.json'):
                    addresses = json.load(f)
                else:
                    addresses = [line.strip() for line in f if line.strip()]
        else:
            print("Error: Must provide --address or --input")
            return 1

        print(f"Checking compliance for {len(addresses)} addresses...")

        results = await compliance.check_batch(
            addresses,
            check_kyc=args.kyc,
            check_aml=args.aml,
            check_sanctions=args.sanctions
        )

        # Output
        output_file = Path(args.output) if args.output else Path("compliance_results.json")
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)

        # Summary
        passed = sum(1 for r in results["results"] if r["compliant"])
        failed = len(results["results"]) - passed

        print(f"\nCompliance Results:")
        print(f"  Passed: {passed}")
        print(f"  Failed: {failed}")
        print(f"  Output: {output_file}")

        return 0 if failed == 0 else 1

    # ═══════════════════════════════════════════════════════════════════════════
    # REPORTS
    # ═══════════════════════════════════════════════════════════════════════════

    async def generate_report(self, args):
        """Generate various reports."""
        api = self.connect()
        reporter = ReportGenerator(api)

        report_type = args.type
        output_dir = Path(args.output_dir) if args.output_dir else Path("reports")
        output_dir.mkdir(parents=True, exist_ok=True)

        # Date range
        end_date = datetime.now()
        if args.days:
            start_date = end_date - timedelta(days=args.days)
        elif args.start_date:
            start_date = datetime.fromisoformat(args.start_date)
        else:
            start_date = end_date - timedelta(days=30)

        print(f"Generating {report_type} report...")
        print(f"  Period: {start_date.date()} to {end_date.date()}")

        if report_type == "reserve":
            report = await reporter.generate_reserve_attestation(
                start_date, end_date,
                include_proof=args.include_proof
            )
        elif report_type == "monthly":
            report = await reporter.generate_monthly_summary(
                start_date.year,
                start_date.month
            )
        elif report_type == "compliance":
            report = await reporter.generate_compliance_report(
                start_date, end_date,
                jurisdiction=args.jurisdiction
            )
        elif report_type == "treasury":
            report = await reporter.generate_treasury_report(
                start_date, end_date
            )
        elif report_type == "bridge":
            report = await reporter.generate_bridge_report(
                start_date, end_date
            )
        elif report_type == "insurance":
            report = await reporter.generate_insurance_report(
                start_date, end_date
            )
        else:
            print(f"Unknown report type: {report_type}")
            return 1

        # Save report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = output_dir / f"{report_type}_{timestamp}.json"
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)

        # Also generate markdown if requested
        if args.markdown:
            md_file = output_file.with_suffix('.md')
            md_content = reporter.to_markdown(report)
            with open(md_file, 'w') as f:
                f.write(md_content)
            print(f"Markdown: {md_file}")

        print(f"Report saved: {output_file}")
        return 0

    # ═══════════════════════════════════════════════════════════════════════════
    # SIMULATION
    # ═══════════════════════════════════════════════════════════════════════════

    async def simulate(self, args):
        """Simulate transactions before execution."""
        api = self.connect()

        if args.tx_file:
            with open(args.tx_file) as f:
                transactions = json.load(f)
        else:
            transactions = [{
                "to": args.to,
                "data": args.data,
                "value": args.value or "0"
            }]

        print(f"Simulating {len(transactions)} transactions...")

        results = await api.simulate_bundle(transactions)

        output_file = Path(args.output) if args.output else Path("simulation_results.json")
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)

        # Check invariants after simulation
        if results["success"]:
            print("✓ Simulation successful")
            print(f"  Gas used: {results['gas_used']}")

            if results.get("invariant_violations"):
                print("⚠ WARNING: Invariant violations detected!")
                for violation in results["invariant_violations"]:
                    print(f"  - {violation}")
        else:
            print("✗ Simulation failed")
            print(f"  Error: {results['error']}")

        return 0 if results["success"] else 1

    # ═══════════════════════════════════════════════════════════════════════════
    # ORACLE OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════

    async def oracle(self, args):
        """Oracle operations."""
        api = self.connect()

        if args.action == "status":
            status = await api.get_oracle_status()
            print(json.dumps(status, indent=2))

        elif args.action == "update":
            if not args.backing:
                print("Error: --backing required for update")
                return 1
            result = await api.update_oracle(args.backing)
            print(f"Oracle updated: {result['tx_hash']}")

        elif args.action == "history":
            history = await api.get_oracle_history(
                limit=args.limit or 100
            )
            output_file = Path(args.output) if args.output else Path("oracle_history.json")
            with open(output_file, 'w') as f:
                json.dump(history, f, indent=2)
            print(f"History saved: {output_file}")

        return 0

    # ═══════════════════════════════════════════════════════════════════════════
    # TREASURY OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════

    async def treasury(self, args):
        """Treasury management operations."""
        api = self.connect()

        if args.action == "status":
            status = await api.get_treasury_status()
            print(json.dumps(status, indent=2))

        elif args.action == "allocate":
            result = await api.allocate_treasury(
                tier=args.tier,
                amount=args.amount,
                target=args.target
            )
            print(f"Allocation complete: {result['tx_hash']}")

        elif args.action == "rebalance":
            result = await api.rebalance_treasury()
            print(f"Rebalance complete: {result['tx_hash']}")

        elif args.action == "withdraw":
            result = await api.withdraw_treasury(
                tier=args.tier,
                amount=args.amount,
                recipient=args.recipient
            )
            print(f"Withdrawal complete: {result['tx_hash']}")

        return 0

    # ═══════════════════════════════════════════════════════════════════════════
    # BRIDGE OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════

    async def bridge(self, args):
        """Cross-chain bridge operations."""
        api = self.connect()

        if args.action == "status":
            status = await api.get_bridge_status()
            print(json.dumps(status, indent=2))

        elif args.action == "pending":
            pending = await api.get_pending_transfers()
            print(json.dumps(pending, indent=2))

        elif args.action == "validate":
            result = await api.validate_transfer(
                transfer_id=args.transfer_id
            )
            print(f"Validation: {result['status']}")

        elif args.action == "execute":
            result = await api.execute_transfer(
                transfer_id=args.transfer_id
            )
            print(f"Execution: {result['tx_hash']}")

        return 0


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="SecureMint Engine - Local Python CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # ═══════════════════════════════════════════════════════════════════════════
    # MINT-BATCH COMMAND
    # ═══════════════════════════════════════════════════════════════════════════

    mint_parser = subparsers.add_parser("mint-batch", help="Batch mint tokens")
    mint_parser.add_argument("-i", "--input", required=True, help="Input CSV/JSON file")
    mint_parser.add_argument("-o", "--output", help="Output results file")
    mint_parser.add_argument("--batch-size", type=int, default=50, help="Transactions per batch")
    mint_parser.add_argument("--gas-price", type=float, help="Gas price in gwei")
    mint_parser.add_argument("--retries", type=int, default=3, help="Max retries per tx")
    mint_parser.add_argument("--dry-run", action="store_true", help="Simulate only")
    mint_parser.add_argument("--force", action="store_true", help="Continue on validation errors")

    # ═══════════════════════════════════════════════════════════════════════════
    # BURN-BATCH COMMAND
    # ═══════════════════════════════════════════════════════════════════════════

    burn_parser = subparsers.add_parser("burn-batch", help="Batch burn tokens")
    burn_parser.add_argument("-i", "--input", required=True, help="Input CSV/JSON file")
    burn_parser.add_argument("-o", "--output", help="Output results file")
    burn_parser.add_argument("--batch-size", type=int, default=50, help="Transactions per batch")
    burn_parser.add_argument("--dry-run", action="store_true", help="Simulate only")

    # ═══════════════════════════════════════════════════════════════════════════
    # COMPLIANCE COMMAND
    # ═══════════════════════════════════════════════════════════════════════════

    compliance_parser = subparsers.add_parser("compliance", help="Run compliance checks")
    compliance_parser.add_argument("-a", "--address", help="Single address to check")
    compliance_parser.add_argument("-i", "--input", help="File with addresses")
    compliance_parser.add_argument("-o", "--output", help="Output file")
    compliance_parser.add_argument("-j", "--jurisdiction", default="US", help="Jurisdiction code")
    compliance_parser.add_argument("--kyc", action="store_true", help="Check KYC status")
    compliance_parser.add_argument("--aml", action="store_true", help="Run AML screening")
    compliance_parser.add_argument("--sanctions", action="store_true", help="Check sanctions")

    # ═══════════════════════════════════════════════════════════════════════════
    # REPORT COMMAND
    # ═══════════════════════════════════════════════════════════════════════════

    report_parser = subparsers.add_parser("report", help="Generate reports")
    report_parser.add_argument("-t", "--type", required=True,
                              choices=["reserve", "monthly", "compliance", "treasury", "bridge", "insurance"],
                              help="Report type")
    report_parser.add_argument("-o", "--output-dir", help="Output directory")
    report_parser.add_argument("-d", "--days", type=int, help="Number of days")
    report_parser.add_argument("--start-date", help="Start date (ISO format)")
    report_parser.add_argument("-j", "--jurisdiction", help="Jurisdiction for compliance report")
    report_parser.add_argument("--include-proof", action="store_true", help="Include Merkle proof")
    report_parser.add_argument("--markdown", action="store_true", help="Also generate markdown")

    # ═══════════════════════════════════════════════════════════════════════════
    # SIMULATE COMMAND
    # ═══════════════════════════════════════════════════════════════════════════

    sim_parser = subparsers.add_parser("simulate", help="Simulate transactions")
    sim_parser.add_argument("--tx-file", help="JSON file with transactions")
    sim_parser.add_argument("--to", help="Target address")
    sim_parser.add_argument("--data", help="Transaction data")
    sim_parser.add_argument("--value", help="ETH value")
    sim_parser.add_argument("-o", "--output", help="Output file")

    # ═══════════════════════════════════════════════════════════════════════════
    # ORACLE COMMAND
    # ═══════════════════════════════════════════════════════════════════════════

    oracle_parser = subparsers.add_parser("oracle", help="Oracle operations")
    oracle_parser.add_argument("action", choices=["status", "update", "history"])
    oracle_parser.add_argument("--backing", type=int, help="New backing value")
    oracle_parser.add_argument("--limit", type=int, help="History limit")
    oracle_parser.add_argument("-o", "--output", help="Output file")

    # ═══════════════════════════════════════════════════════════════════════════
    # TREASURY COMMAND
    # ═══════════════════════════════════════════════════════════════════════════

    treasury_parser = subparsers.add_parser("treasury", help="Treasury operations")
    treasury_parser.add_argument("action", choices=["status", "allocate", "rebalance", "withdraw"])
    treasury_parser.add_argument("--tier", type=int, help="Treasury tier (0-3)")
    treasury_parser.add_argument("--amount", help="Amount")
    treasury_parser.add_argument("--target", help="Target address/protocol")
    treasury_parser.add_argument("--recipient", help="Withdrawal recipient")

    # ═══════════════════════════════════════════════════════════════════════════
    # BRIDGE COMMAND
    # ═══════════════════════════════════════════════════════════════════════════

    bridge_parser = subparsers.add_parser("bridge", help="Bridge operations")
    bridge_parser.add_argument("action", choices=["status", "pending", "validate", "execute"])
    bridge_parser.add_argument("--transfer-id", help="Transfer ID")

    # Parse and execute
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    cli = SecureMintCLI()

    # Route to handler
    handlers = {
        "mint-batch": cli.mint_batch,
        "burn-batch": cli.burn_batch,
        "compliance": cli.compliance_check,
        "report": cli.generate_report,
        "simulate": cli.simulate,
        "oracle": cli.oracle,
        "treasury": cli.treasury,
        "bridge": cli.bridge,
    }

    handler = handlers.get(args.command)
    if handler:
        return asyncio.run(handler(args))
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
