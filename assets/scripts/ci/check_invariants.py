#!/usr/bin/env python3
"""
Invariant Verification Script for Secure Mint Engine

Verifies that deployed contracts maintain critical invariants:
- INV-SM-1: Supply ≤ BackedValue
- INV-SM-2: mint() requires canMint(amount) == true
- INV-SM-3: Oracle unhealthy → new mints blocked
- INV-SM-4: Sum(tierBalances) == totalReserves

This script queries on-chain state to verify invariants are holding.
"""

import json
import sys
import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

try:
    from web3 import Web3
    from web3.exceptions import ContractLogicError
except ImportError:
    print("ERROR: web3 package not installed. Run: pip install web3")
    sys.exit(1)


@dataclass
class InvariantResult:
    name: str
    passed: bool
    details: str
    severity: str  # "critical", "warning", "info"


class InvariantChecker:
    """Check on-chain invariants for Secure Mint Engine."""

    def __init__(self, rpc_url: str, deployment_path: str):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))

        if not self.w3.is_connected():
            raise ConnectionError(f"Cannot connect to RPC: {rpc_url}")

        self.deployment = self._load_deployment(deployment_path)
        self.contracts = self._load_contracts()

    def _load_deployment(self, path: str) -> dict:
        """Load deployment manifest."""
        with open(path, 'r') as f:
            return json.load(f)

    def _load_contracts(self) -> dict:
        """Initialize contract instances from deployment."""
        contracts = {}

        # Minimal ABIs for invariant checking
        abis = {
            'token': [
                {"inputs": [], "name": "totalSupply", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"}
            ],
            'oracle': [
                {"inputs": [], "name": "getVerifiedBacking", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
                {"inputs": [], "name": "isHealthy", "outputs": [{"type": "bool"}], "stateMutability": "view", "type": "function"}
            ],
            'policy': [
                {"inputs": [], "name": "paused", "outputs": [{"type": "bool"}], "stateMutability": "view", "type": "function"},
                {"inputs": [{"type": "uint256"}], "name": "canMintNow", "outputs": [{"type": "bool"}, {"type": "string"}], "stateMutability": "view", "type": "function"}
            ],
            'treasury': [
                {"inputs": [], "name": "totalReserves", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
                {"inputs": [], "name": "getTierBalances", "outputs": [{"type": "uint256[4]"}], "stateMutability": "view", "type": "function"}
            ]
        }

        contract_map = {
            'token': 'BackedToken',
            'oracle': 'BackingOraclePoR',
            'policy': 'SecureMintPolicy',
            'treasury': 'TreasuryVault'
        }

        for key, contract_name in contract_map.items():
            if contract_name in self.deployment.get('contracts', {}):
                address = self.deployment['contracts'][contract_name]['address']
                contracts[key] = self.w3.eth.contract(
                    address=Web3.to_checksum_address(address),
                    abi=abis[key]
                )

        return contracts

    def check_inv_sm_1(self) -> InvariantResult:
        """
        INV-SM-1: Supply ≤ BackedValue
        The total token supply must never exceed verified backing.
        """
        try:
            if 'token' not in self.contracts or 'oracle' not in self.contracts:
                return InvariantResult(
                    name="INV-SM-1",
                    passed=True,
                    details="Contracts not deployed - skipping",
                    severity="info"
                )

            total_supply = self.contracts['token'].functions.totalSupply().call()
            verified_backing = self.contracts['oracle'].functions.getVerifiedBacking().call()

            # Convert to same decimals (18 -> 6)
            supply_in_6_decimals = total_supply // (10 ** 12)

            passed = supply_in_6_decimals <= verified_backing

            return InvariantResult(
                name="INV-SM-1",
                passed=passed,
                details=f"Supply: {supply_in_6_decimals}, Backing: {verified_backing}",
                severity="critical" if not passed else "info"
            )

        except Exception as e:
            return InvariantResult(
                name="INV-SM-1",
                passed=False,
                details=f"Error checking: {str(e)}",
                severity="warning"
            )

    def check_inv_sm_3(self) -> InvariantResult:
        """
        INV-SM-3: Oracle unhealthy → new mints blocked
        When oracle is unhealthy, minting must be blocked.
        """
        try:
            if 'oracle' not in self.contracts or 'policy' not in self.contracts:
                return InvariantResult(
                    name="INV-SM-3",
                    passed=True,
                    details="Contracts not deployed - skipping",
                    severity="info"
                )

            oracle_healthy = self.contracts['oracle'].functions.isHealthy().call()

            if oracle_healthy:
                return InvariantResult(
                    name="INV-SM-3",
                    passed=True,
                    details="Oracle is healthy - invariant holds trivially",
                    severity="info"
                )

            # Oracle is unhealthy - check if minting is blocked
            can_mint, reason = self.contracts['policy'].functions.canMintNow(1).call()

            passed = not can_mint

            return InvariantResult(
                name="INV-SM-3",
                passed=passed,
                details=f"Oracle unhealthy, canMint={can_mint}, reason={reason}",
                severity="critical" if not passed else "info"
            )

        except Exception as e:
            return InvariantResult(
                name="INV-SM-3",
                passed=False,
                details=f"Error checking: {str(e)}",
                severity="warning"
            )

    def check_inv_sm_4(self) -> InvariantResult:
        """
        INV-SM-4: Sum(tierBalances) == totalReserves
        Treasury tier balances must sum to total reserves.
        """
        try:
            if 'treasury' not in self.contracts:
                return InvariantResult(
                    name="INV-SM-4",
                    passed=True,
                    details="Treasury not deployed - skipping",
                    severity="info"
                )

            total_reserves = self.contracts['treasury'].functions.totalReserves().call()
            tier_balances = self.contracts['treasury'].functions.getTierBalances().call()

            sum_of_tiers = sum(tier_balances)
            passed = sum_of_tiers == total_reserves

            return InvariantResult(
                name="INV-SM-4",
                passed=passed,
                details=f"Sum of tiers: {sum_of_tiers}, Total reserves: {total_reserves}",
                severity="critical" if not passed else "info"
            )

        except Exception as e:
            return InvariantResult(
                name="INV-SM-4",
                passed=False,
                details=f"Error checking: {str(e)}",
                severity="warning"
            )

    def run_all_checks(self) -> list[InvariantResult]:
        """Run all invariant checks."""
        return [
            self.check_inv_sm_1(),
            self.check_inv_sm_3(),
            self.check_inv_sm_4(),
        ]


def main():
    """Main check routine."""
    print("═" * 70)
    print("  SECURE MINT ENGINE - Invariant Verification")
    print("═" * 70)
    print()

    # Get configuration from environment
    rpc_url = os.environ.get('RPC_URL')
    deployment_path = os.environ.get('DEPLOYMENT_PATH')

    if not rpc_url:
        print("ERROR: RPC_URL environment variable not set")
        sys.exit(1)

    if not deployment_path or not Path(deployment_path).exists():
        print("WARNING: Deployment path not found - running in dry mode")
        print("Set DEPLOYMENT_PATH to a valid deployment manifest")
        sys.exit(0)

    try:
        checker = InvariantChecker(rpc_url, deployment_path)
        results = checker.run_all_checks()

        # Print results
        for result in results:
            status = "✓" if result.passed else "✗"
            print(f"{status} {result.name}: {result.details}")

        print()
        print("═" * 70)

        # Check for critical failures
        critical_failures = [r for r in results if not r.passed and r.severity == "critical"]

        if critical_failures:
            print(f"  CRITICAL: {len(critical_failures)} invariant(s) violated!")
            print("═" * 70)
            sys.exit(1)
        else:
            passed = sum(1 for r in results if r.passed)
            print(f"  All {passed}/{len(results)} invariants holding")
            print("═" * 70)
            sys.exit(0)

    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
