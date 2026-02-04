"""
SecureMint Engine - Bulk Operations Module
High-performance batch processing for token operations.
"""

import csv
import json
import asyncio
from typing import List, Dict, Any, Optional
from pathlib import Path
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class MintRequest:
    """Single mint request."""
    recipient: str
    amount: int
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BurnRequest:
    """Single burn request."""
    holder: str
    amount: int
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BatchResult:
    """Result of a batch operation."""
    success_count: int = 0
    failure_count: int = 0
    total_amount: int = 0
    total_gas_used: int = 0
    transactions: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[Dict[str, Any]] = field(default_factory=list)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class BulkOperator:
    """
    Handles bulk token operations with:
    - CSV/JSON input parsing
    - Validation before execution
    - Batched transaction submission
    - Progress tracking
    - Error handling and retry logic
    """

    def __init__(self, api):
        self.api = api
        self.max_batch_size = 100
        self.default_gas_buffer = 1.2  # 20% gas buffer

    # ═══════════════════════════════════════════════════════════════════════════
    # INPUT LOADING
    # ═══════════════════════════════════════════════════════════════════════════

    def load_csv(self, filepath: Path) -> List[Dict[str, Any]]:
        """
        Load requests from CSV file.

        Expected columns: recipient/holder, amount
        Optional columns: metadata (JSON string)
        """
        requests = []
        with open(filepath, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                request = {
                    "recipient": row.get("recipient") or row.get("holder") or row.get("address"),
                    "amount": int(row.get("amount", 0)),
                }
                if "metadata" in row and row["metadata"]:
                    try:
                        request["metadata"] = json.loads(row["metadata"])
                    except json.JSONDecodeError:
                        request["metadata"] = {"raw": row["metadata"]}

                requests.append(request)

        return requests

    def load_json(self, filepath: Path) -> List[Dict[str, Any]]:
        """Load requests from JSON file."""
        with open(filepath, 'r') as f:
            data = json.load(f)

        # Handle both array and object with 'requests' key
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "requests" in data:
            return data["requests"]
        else:
            raise ValueError("Invalid JSON format: expected array or object with 'requests' key")

    # ═══════════════════════════════════════════════════════════════════════════
    # VALIDATION
    # ═══════════════════════════════════════════════════════════════════════════

    async def validate_mint_batch(
        self,
        requests: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validate mint requests before execution.

        Checks:
        - Address format
        - Amount > 0
        - Total won't exceed backing
        - Rate limit capacity
        """
        errors = []
        warnings = []
        total_amount = 0

        for i, req in enumerate(requests):
            # Check address
            if not req.get("recipient"):
                errors.append(f"Row {i}: Missing recipient address")
                continue

            if not self._is_valid_address(req["recipient"]):
                errors.append(f"Row {i}: Invalid address format: {req['recipient']}")

            # Check amount
            amount = req.get("amount", 0)
            if amount <= 0:
                errors.append(f"Row {i}: Invalid amount: {amount}")
            else:
                total_amount += amount

        # Check against backing
        try:
            backing = await self.api.get_backing()
            total_supply = await self.api.get_total_supply()

            if total_supply + total_amount > backing:
                deficit = (total_supply + total_amount) - backing
                errors.append(
                    f"Batch would exceed backing by {deficit/1e6:.2f}M. "
                    f"Current supply: {total_supply/1e6:.2f}M, "
                    f"Backing: {backing/1e6:.2f}M, "
                    f"Batch total: {total_amount/1e6:.2f}M"
                )
        except Exception as e:
            warnings.append(f"Could not verify backing: {e}")

        # Check rate limits
        try:
            policy = self.api.contracts.get("policy")
            if policy:
                epoch_minted = policy.functions.epochMintedAmount().call()
                epoch_capacity = policy.functions.epochCapacity().call()
                remaining = epoch_capacity - epoch_minted

                if total_amount > remaining:
                    errors.append(
                        f"Batch exceeds epoch capacity. "
                        f"Remaining: {remaining/1e6:.2f}M, "
                        f"Requested: {total_amount/1e6:.2f}M"
                    )
        except Exception as e:
            warnings.append(f"Could not verify rate limits: {e}")

        return {
            "valid": len(errors) == 0,
            "total_requests": len(requests),
            "total_amount": total_amount,
            "errors": errors,
            "warnings": warnings
        }

    async def validate_burn_batch(
        self,
        requests: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Validate burn requests before execution."""
        errors = []
        warnings = []
        total_amount = 0

        for i, req in enumerate(requests):
            holder = req.get("holder") or req.get("recipient")
            if not holder:
                errors.append(f"Row {i}: Missing holder address")
                continue

            if not self._is_valid_address(holder):
                errors.append(f"Row {i}: Invalid address format: {holder}")

            amount = req.get("amount", 0)
            if amount <= 0:
                errors.append(f"Row {i}: Invalid amount: {amount}")
                continue

            # Check balance
            try:
                balance = await self.api.get_balance(holder)
                if balance < amount:
                    errors.append(
                        f"Row {i}: Insufficient balance for {holder}. "
                        f"Has: {balance/1e6:.2f}M, Needs: {amount/1e6:.2f}M"
                    )
            except Exception as e:
                warnings.append(f"Row {i}: Could not verify balance: {e}")

            total_amount += amount

        return {
            "valid": len(errors) == 0,
            "total_requests": len(requests),
            "total_amount": total_amount,
            "errors": errors,
            "warnings": warnings
        }

    def _is_valid_address(self, address: str) -> bool:
        """Check if string is valid Ethereum address."""
        if not address:
            return False
        if not address.startswith("0x"):
            return False
        if len(address) != 42:
            return False
        try:
            int(address, 16)
            return True
        except ValueError:
            return False

    # ═══════════════════════════════════════════════════════════════════════════
    # SIMULATION
    # ═══════════════════════════════════════════════════════════════════════════

    async def simulate_mint_batch(
        self,
        requests: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Simulate batch mint without executing."""
        result = BatchResult(start_time=datetime.now())

        for req in requests:
            try:
                # Build transaction
                policy = self.api.contracts.get("policy")
                if not policy:
                    raise ValueError("Policy contract not configured")

                tx_data = policy.encodeABI(
                    fn_name="mint",
                    args=[
                        self.api.w3.to_checksum_address(req["recipient"]),
                        req["amount"]
                    ]
                )

                sim_result = await self.api.simulate_transaction({
                    "to": self.api.addresses.policy,
                    "data": tx_data
                })

                if sim_result["success"]:
                    result.success_count += 1
                    result.total_amount += req["amount"]
                    result.total_gas_used += sim_result["gas_used"]
                    result.transactions.append({
                        "recipient": req["recipient"],
                        "amount": req["amount"],
                        "gas_estimate": sim_result["gas_used"],
                        "status": "simulated"
                    })
                else:
                    result.failure_count += 1
                    result.errors.append({
                        "recipient": req["recipient"],
                        "amount": req["amount"],
                        "error": sim_result["error"]
                    })

            except Exception as e:
                result.failure_count += 1
                result.errors.append({
                    "recipient": req.get("recipient"),
                    "amount": req.get("amount"),
                    "error": str(e)
                })

        result.end_time = datetime.now()

        return {
            "success_count": result.success_count,
            "failure_count": result.failure_count,
            "total_amount": result.total_amount,
            "total_gas_used": result.total_gas_used,
            "transactions": result.transactions,
            "errors": result.errors,
            "duration_seconds": (result.end_time - result.start_time).total_seconds()
        }

    async def simulate_burn_batch(
        self,
        requests: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Simulate batch burn without executing."""
        result = BatchResult(start_time=datetime.now())

        for req in requests:
            try:
                token = self.api.contracts.get("token")
                if not token:
                    raise ValueError("Token contract not configured")

                tx_data = token.encodeABI(
                    fn_name="burn",
                    args=[req["amount"]]
                )

                sim_result = await self.api.simulate_transaction({
                    "to": self.api.addresses.token,
                    "data": tx_data
                })

                if sim_result["success"]:
                    result.success_count += 1
                    result.total_amount += req["amount"]
                    result.total_gas_used += sim_result["gas_used"]
                else:
                    result.failure_count += 1
                    result.errors.append({
                        "holder": req.get("holder"),
                        "amount": req["amount"],
                        "error": sim_result["error"]
                    })

            except Exception as e:
                result.failure_count += 1
                result.errors.append({
                    "holder": req.get("holder"),
                    "amount": req.get("amount"),
                    "error": str(e)
                })

        result.end_time = datetime.now()

        return {
            "success_count": result.success_count,
            "failure_count": result.failure_count,
            "total_amount": result.total_amount,
            "total_gas_used": result.total_gas_used,
            "errors": result.errors,
            "duration_seconds": (result.end_time - result.start_time).total_seconds()
        }

    # ═══════════════════════════════════════════════════════════════════════════
    # EXECUTION
    # ═══════════════════════════════════════════════════════════════════════════

    async def execute_mint_batch(
        self,
        requests: List[Dict[str, Any]],
        batch_size: int = 50,
        gas_price_gwei: Optional[float] = None,
        max_retries: int = 3,
        progress_callback=None
    ) -> Dict[str, Any]:
        """
        Execute batch mint with:
        - Batched submission
        - Retry logic
        - Progress tracking
        """
        result = BatchResult(start_time=datetime.now())

        # Split into batches
        batches = [
            requests[i:i + batch_size]
            for i in range(0, len(requests), batch_size)
        ]

        for batch_idx, batch in enumerate(batches):
            if progress_callback:
                progress_callback(batch_idx, len(batches), result)

            for req in batch:
                success = False
                last_error = None

                for attempt in range(max_retries):
                    try:
                        tx_result = await self.api.mint(
                            req["recipient"],
                            req["amount"]
                        )

                        if tx_result["status"] == "success":
                            result.success_count += 1
                            result.total_amount += req["amount"]
                            result.total_gas_used += tx_result["gas_used"]
                            result.transactions.append({
                                "recipient": req["recipient"],
                                "amount": req["amount"],
                                "tx_hash": tx_result["tx_hash"],
                                "gas_used": tx_result["gas_used"],
                                "status": "success"
                            })
                            success = True
                            break
                        else:
                            last_error = "Transaction failed on-chain"

                    except Exception as e:
                        last_error = str(e)
                        await asyncio.sleep(2 ** attempt)  # Exponential backoff

                if not success:
                    result.failure_count += 1
                    result.errors.append({
                        "recipient": req["recipient"],
                        "amount": req["amount"],
                        "error": last_error,
                        "attempts": max_retries
                    })

            # Rate limit between batches
            if batch_idx < len(batches) - 1:
                await asyncio.sleep(1)

        result.end_time = datetime.now()

        return {
            "success_count": result.success_count,
            "failure_count": result.failure_count,
            "total_amount": result.total_amount,
            "total_gas_used": result.total_gas_used,
            "transactions": result.transactions,
            "errors": result.errors,
            "duration_seconds": (result.end_time - result.start_time).total_seconds()
        }

    async def execute_burn_batch(
        self,
        requests: List[Dict[str, Any]],
        batch_size: int = 50,
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """Execute batch burn."""
        result = BatchResult(start_time=datetime.now())

        batches = [
            requests[i:i + batch_size]
            for i in range(0, len(requests), batch_size)
        ]

        for batch in batches:
            for req in batch:
                success = False
                last_error = None

                for attempt in range(max_retries):
                    try:
                        tx_result = await self.api.burn(req["amount"])

                        if tx_result["status"] == "success":
                            result.success_count += 1
                            result.total_amount += req["amount"]
                            result.total_gas_used += tx_result["gas_used"]
                            result.transactions.append({
                                "amount": req["amount"],
                                "tx_hash": tx_result["tx_hash"],
                                "status": "success"
                            })
                            success = True
                            break

                    except Exception as e:
                        last_error = str(e)
                        await asyncio.sleep(2 ** attempt)

                if not success:
                    result.failure_count += 1
                    result.errors.append({
                        "amount": req["amount"],
                        "error": last_error
                    })

        result.end_time = datetime.now()

        return {
            "success_count": result.success_count,
            "failure_count": result.failure_count,
            "total_amount": result.total_amount,
            "total_gas_used": result.total_gas_used,
            "transactions": result.transactions,
            "errors": result.errors,
            "duration_seconds": (result.end_time - result.start_time).total_seconds()
        }

    # ═══════════════════════════════════════════════════════════════════════════
    # UTILITIES
    # ═══════════════════════════════════════════════════════════════════════════

    def generate_sample_csv(self, filepath: Path, count: int = 10):
        """Generate sample CSV file for testing."""
        import random

        with open(filepath, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["recipient", "amount"])

            for _ in range(count):
                # Random address
                addr = "0x" + "".join(random.choices("0123456789abcdef", k=40))
                # Random amount (100 - 10000 USDC)
                amount = random.randint(100, 10000) * 1_000_000

                writer.writerow([addr, amount])

        print(f"Generated {count} sample requests: {filepath}")

    def estimate_gas_cost(
        self,
        request_count: int,
        gas_per_tx: int = 100000,
        gas_price_gwei: float = 30
    ) -> Dict[str, Any]:
        """Estimate total gas cost for batch."""
        total_gas = request_count * gas_per_tx
        cost_eth = (total_gas * gas_price_gwei) / 1e9

        return {
            "request_count": request_count,
            "gas_per_tx": gas_per_tx,
            "total_gas": total_gas,
            "gas_price_gwei": gas_price_gwei,
            "estimated_cost_eth": cost_eth,
            "estimated_cost_usd": cost_eth * 2000  # Rough estimate
        }
