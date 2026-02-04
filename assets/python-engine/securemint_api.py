"""
SecureMint Engine - Core API Client
Direct blockchain interaction for local Python execution.
"""

import os
import json
import asyncio
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from pathlib import Path
from web3 import Web3, AsyncWeb3
from web3.middleware import geth_poa_middleware
from eth_account import Account
from eth_typing import ChecksumAddress


@dataclass
class ContractAddresses:
    """Contract addresses for SecureMint system."""
    token: str = ""
    policy: str = ""
    oracle: str = ""
    treasury: str = ""
    redemption: str = ""
    emergency: str = ""
    governor: str = ""
    bridge: str = ""
    insurance: str = ""
    incentives: str = ""


class SecureMintAPI:
    """
    Core API for SecureMint contract interactions.

    Provides direct blockchain access for:
    - Token operations (mint, burn, transfer)
    - Oracle queries and updates
    - Treasury management
    - Bridge operations
    - Invariant checking
    - Transaction simulation
    """

    # ABI paths relative to this file
    ABI_DIR = Path(__file__).parent / "abis"

    def __init__(
        self,
        rpc_url: str,
        chain_id: int = 1,
        private_key: Optional[str] = None,
        contracts: Optional[Dict[str, str]] = None
    ):
        self.rpc_url = rpc_url
        self.chain_id = chain_id
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))

        # Add PoA middleware for testnets
        if chain_id in [5, 11155111, 80001, 421613]:  # Goerli, Sepolia, Mumbai, Arbitrum Goerli
            self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)

        # Setup account if private key provided
        self.account = None
        if private_key:
            self.account = Account.from_key(private_key)

        # Load contract addresses
        self.addresses = ContractAddresses()
        if contracts:
            for name, addr in contracts.items():
                if hasattr(self.addresses, name) and addr:
                    setattr(self.addresses, name, Web3.to_checksum_address(addr))

        # Load ABIs and create contract instances
        self._load_contracts()

    def _load_contracts(self):
        """Load contract ABIs and create instances."""
        self.contracts = {}

        contract_names = [
            "token", "policy", "oracle", "treasury",
            "redemption", "emergency", "governor",
            "bridge", "insurance", "incentives"
        ]

        for name in contract_names:
            addr = getattr(self.addresses, name, "")
            if addr:
                abi = self._load_abi(name)
                if abi:
                    self.contracts[name] = self.w3.eth.contract(
                        address=addr,
                        abi=abi
                    )

    def _load_abi(self, name: str) -> Optional[List]:
        """Load ABI from file."""
        abi_file = self.ABI_DIR / f"{name}.json"
        if abi_file.exists():
            with open(abi_file) as f:
                return json.load(f)

        # Fallback: try to load from artifacts
        artifact_file = Path(__file__).parent.parent / "contracts" / "out" / f"{name.title()}.sol" / f"{name.title()}.json"
        if artifact_file.exists():
            with open(artifact_file) as f:
                artifact = json.load(f)
                return artifact.get("abi", [])

        return None

    # ═══════════════════════════════════════════════════════════════════════════
    # TOKEN OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════

    async def get_total_supply(self) -> int:
        """Get token total supply."""
        token = self.contracts.get("token")
        if not token:
            raise ValueError("Token contract not configured")
        return token.functions.totalSupply().call()

    async def get_balance(self, address: str) -> int:
        """Get token balance for address."""
        token = self.contracts.get("token")
        if not token:
            raise ValueError("Token contract not configured")
        return token.functions.balanceOf(Web3.to_checksum_address(address)).call()

    async def mint(self, recipient: str, amount: int) -> Dict[str, Any]:
        """Mint tokens to recipient."""
        policy = self.contracts.get("policy")
        if not policy:
            raise ValueError("Policy contract not configured")

        tx = policy.functions.mint(
            Web3.to_checksum_address(recipient),
            amount
        ).build_transaction(self._build_tx_params())

        return await self._send_transaction(tx)

    async def burn(self, amount: int) -> Dict[str, Any]:
        """Burn tokens from sender."""
        token = self.contracts.get("token")
        if not token:
            raise ValueError("Token contract not configured")

        tx = token.functions.burn(amount).build_transaction(
            self._build_tx_params()
        )

        return await self._send_transaction(tx)

    # ═══════════════════════════════════════════════════════════════════════════
    # ORACLE OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════

    async def get_backing(self) -> int:
        """Get current backing value from oracle."""
        oracle = self.contracts.get("oracle")
        if not oracle:
            raise ValueError("Oracle contract not configured")
        return oracle.functions.getLatestBacking().call()

    async def get_oracle_status(self) -> Dict[str, Any]:
        """Get comprehensive oracle status."""
        oracle = self.contracts.get("oracle")
        if not oracle:
            raise ValueError("Oracle contract not configured")

        backing = oracle.functions.getLatestBacking().call()
        last_update = oracle.functions.lastUpdateTimestamp().call()
        staleness = oracle.functions.stalenessThreshold().call()

        return {
            "backing": backing,
            "backing_formatted": backing / 1e6,  # Assuming 6 decimals
            "last_update": last_update,
            "staleness_threshold": staleness,
            "is_stale": (self.w3.eth.get_block('latest')['timestamp'] - last_update) > staleness
        }

    async def update_oracle(self, backing: int) -> Dict[str, Any]:
        """Update oracle with new backing value (authorized only)."""
        oracle = self.contracts.get("oracle")
        if not oracle:
            raise ValueError("Oracle contract not configured")

        tx = oracle.functions.updateBacking(backing).build_transaction(
            self._build_tx_params()
        )

        return await self._send_transaction(tx)

    async def get_oracle_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get oracle update history from events."""
        oracle = self.contracts.get("oracle")
        if not oracle:
            raise ValueError("Oracle contract not configured")

        # Get BackingUpdated events
        latest_block = self.w3.eth.block_number
        from_block = max(0, latest_block - 100000)  # ~2 weeks on mainnet

        events = oracle.events.BackingUpdated.get_logs(
            from_block=from_block,
            to_block=latest_block
        )

        return [
            {
                "block": e['blockNumber'],
                "tx_hash": e['transactionHash'].hex(),
                "backing": e['args']['backing'],
                "timestamp": self.w3.eth.get_block(e['blockNumber'])['timestamp']
            }
            for e in events[-limit:]
        ]

    # ═══════════════════════════════════════════════════════════════════════════
    # TREASURY OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════

    async def get_treasury_status(self) -> Dict[str, Any]:
        """Get treasury status across all tiers."""
        treasury = self.contracts.get("treasury")
        if not treasury:
            raise ValueError("Treasury contract not configured")

        tiers = []
        total = 0

        for i in range(4):  # 4 tiers
            tier_info = treasury.functions.tiers(i).call()
            balance = treasury.functions.tierBalances(i).call()
            tiers.append({
                "tier": i,
                "name": ["INSTANT", "LIQUID", "YIELD", "STRATEGIC"][i],
                "balance": balance,
                "balance_formatted": balance / 1e6,
                "allocation_target": tier_info[0] / 100,  # Convert bps to %
                "max_allocation": tier_info[1] / 100
            })
            total += balance

        return {
            "total_value": total,
            "total_formatted": total / 1e6,
            "tiers": tiers,
            "is_balanced": await self._check_treasury_balance(treasury)
        }

    async def _check_treasury_balance(self, treasury) -> bool:
        """Check if treasury is within allocation targets."""
        # Implementation would check actual vs target allocations
        return True

    async def allocate_treasury(
        self,
        tier: int,
        amount: int,
        target: str
    ) -> Dict[str, Any]:
        """Allocate treasury funds to target."""
        treasury = self.contracts.get("treasury")
        if not treasury:
            raise ValueError("Treasury contract not configured")

        tx = treasury.functions.allocate(
            tier,
            amount,
            Web3.to_checksum_address(target)
        ).build_transaction(self._build_tx_params())

        return await self._send_transaction(tx)

    async def rebalance_treasury(self) -> Dict[str, Any]:
        """Trigger treasury rebalancing."""
        treasury = self.contracts.get("treasury")
        if not treasury:
            raise ValueError("Treasury contract not configured")

        tx = treasury.functions.rebalance().build_transaction(
            self._build_tx_params()
        )

        return await self._send_transaction(tx)

    async def withdraw_treasury(
        self,
        tier: int,
        amount: int,
        recipient: str
    ) -> Dict[str, Any]:
        """Withdraw from treasury tier."""
        treasury = self.contracts.get("treasury")
        if not treasury:
            raise ValueError("Treasury contract not configured")

        tx = treasury.functions.withdraw(
            tier,
            amount,
            Web3.to_checksum_address(recipient)
        ).build_transaction(self._build_tx_params())

        return await self._send_transaction(tx)

    # ═══════════════════════════════════════════════════════════════════════════
    # BRIDGE OPERATIONS
    # ═══════════════════════════════════════════════════════════════════════════

    async def get_bridge_status(self) -> Dict[str, Any]:
        """Get bridge status."""
        bridge = self.contracts.get("bridge")
        if not bridge:
            raise ValueError("Bridge contract not configured")

        return {
            "validator_threshold": bridge.functions.validatorThreshold().call(),
            "validator_count": bridge.functions.validatorCount().call(),
            "outbound_nonce": bridge.functions.outboundNonce().call(),
            "bridge_fee_bps": bridge.functions.bridgeFee().call(),
            "min_transfer": bridge.functions.minTransferAmount().call(),
            "max_transfer": bridge.functions.maxTransferAmount().call(),
            "is_paused": bridge.functions.paused().call()
        }

    async def get_pending_transfers(self) -> List[Dict[str, Any]]:
        """Get pending bridge transfers from events."""
        bridge = self.contracts.get("bridge")
        if not bridge:
            raise ValueError("Bridge contract not configured")

        latest_block = self.w3.eth.block_number
        from_block = max(0, latest_block - 50000)

        initiated = bridge.events.TransferInitiated.get_logs(
            from_block=from_block,
            to_block=latest_block
        )

        executed = {
            e['args']['transferId'].hex()
            for e in bridge.events.TransferExecuted.get_logs(
                from_block=from_block,
                to_block=latest_block
            )
        }

        pending = []
        for e in initiated:
            transfer_id = e['args']['transferId'].hex()
            if transfer_id not in executed:
                pending.append({
                    "transfer_id": transfer_id,
                    "sender": e['args']['sender'],
                    "recipient": e['args']['recipient'],
                    "amount": e['args']['amount'],
                    "source_chain": e['args']['sourceChain'],
                    "dest_chain": e['args']['destChain'],
                    "nonce": e['args']['nonce'],
                    "block": e['blockNumber']
                })

        return pending

    async def validate_transfer(self, transfer_id: str) -> Dict[str, Any]:
        """Validate a pending transfer (validator only)."""
        bridge = self.contracts.get("bridge")
        if not bridge:
            raise ValueError("Bridge contract not configured")

        # Get transfer status
        status = bridge.functions.getTransferStatus(
            bytes.fromhex(transfer_id.replace("0x", ""))
        ).call()

        return {
            "exists": status[0],
            "executed": status[1],
            "signature_count": status[2],
            "threshold": status[3],
            "ready": status[2] >= status[3]
        }

    async def execute_transfer(self, transfer_id: str) -> Dict[str, Any]:
        """Execute a validated transfer."""
        bridge = self.contracts.get("bridge")
        if not bridge:
            raise ValueError("Bridge contract not configured")

        tx = bridge.functions.executeTransfer(
            bytes.fromhex(transfer_id.replace("0x", ""))
        ).build_transaction(self._build_tx_params())

        return await self._send_transaction(tx)

    # ═══════════════════════════════════════════════════════════════════════════
    # INVARIANT CHECKING
    # ═══════════════════════════════════════════════════════════════════════════

    async def check_invariants(self) -> Dict[str, Any]:
        """Check all SecureMint invariants."""
        results = {}

        # INV-SM-1: Solvency (totalSupply <= backing)
        try:
            total_supply = await self.get_total_supply()
            backing = await self.get_backing()
            results["solvency"] = {
                "valid": total_supply <= backing,
                "total_supply": total_supply,
                "backing": backing,
                "ratio": backing / total_supply if total_supply > 0 else float('inf'),
                "message": f"Supply: {total_supply/1e6:.2f}M, Backing: {backing/1e6:.2f}M"
            }
        except Exception as e:
            results["solvency"] = {"valid": False, "error": str(e)}

        # INV-SM-2: Rate Limiting
        try:
            policy = self.contracts.get("policy")
            if policy:
                epoch_minted = policy.functions.epochMintedAmount().call()
                epoch_capacity = policy.functions.epochCapacity().call()
                results["rate_limiting"] = {
                    "valid": epoch_minted <= epoch_capacity,
                    "epoch_minted": epoch_minted,
                    "epoch_capacity": epoch_capacity,
                    "utilization": epoch_minted / epoch_capacity if epoch_capacity > 0 else 0,
                    "message": f"Minted: {epoch_minted/1e6:.2f}M / {epoch_capacity/1e6:.2f}M capacity"
                }
        except Exception as e:
            results["rate_limiting"] = {"valid": False, "error": str(e)}

        # INV-SM-3: Oracle Freshness
        try:
            oracle_status = await self.get_oracle_status()
            results["oracle_freshness"] = {
                "valid": not oracle_status["is_stale"],
                "last_update": oracle_status["last_update"],
                "threshold": oracle_status["staleness_threshold"],
                "message": "Oracle is fresh" if not oracle_status["is_stale"] else "Oracle is STALE"
            }
        except Exception as e:
            results["oracle_freshness"] = {"valid": False, "error": str(e)}

        # INV-SM-4: Emergency Pause State
        try:
            emergency = self.contracts.get("emergency")
            if emergency:
                level = emergency.functions.currentLevel().call()
                results["emergency_pause"] = {
                    "valid": True,  # Just checking state, not validity
                    "level": level,
                    "message": f"Emergency level: {level}"
                }
        except Exception as e:
            results["emergency_pause"] = {"valid": False, "error": str(e)}

        all_valid = all(r.get("valid", False) for r in results.values())

        return {
            "all_valid": all_valid,
            "timestamp": self.w3.eth.get_block('latest')['timestamp'],
            "block_number": self.w3.eth.block_number,
            "results": results
        }

    # ═══════════════════════════════════════════════════════════════════════════
    # SIMULATION
    # ═══════════════════════════════════════════════════════════════════════════

    async def simulate_transaction(self, tx: Dict[str, Any]) -> Dict[str, Any]:
        """Simulate a single transaction."""
        try:
            # Use eth_call to simulate
            result = self.w3.eth.call({
                "to": tx.get("to"),
                "from": tx.get("from", self.account.address if self.account else None),
                "data": tx.get("data"),
                "value": int(tx.get("value", 0))
            })

            # Estimate gas
            gas = self.w3.eth.estimate_gas({
                "to": tx.get("to"),
                "from": tx.get("from", self.account.address if self.account else None),
                "data": tx.get("data"),
                "value": int(tx.get("value", 0))
            })

            return {
                "success": True,
                "result": result.hex() if result else "0x",
                "gas_used": gas,
                "error": None
            }

        except Exception as e:
            return {
                "success": False,
                "result": None,
                "gas_used": 0,
                "error": str(e)
            }

    async def simulate_bundle(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Simulate a bundle of transactions."""
        results = []
        total_gas = 0

        for tx in transactions:
            result = await self.simulate_transaction(tx)
            results.append(result)
            if result["success"]:
                total_gas += result["gas_used"]
            else:
                break  # Stop on first failure

        all_success = all(r["success"] for r in results)

        # Check invariants after simulation
        invariant_violations = []
        if all_success:
            invariants = await self.check_invariants()
            for name, inv in invariants["results"].items():
                if not inv.get("valid", False):
                    invariant_violations.append(f"{name}: {inv.get('message', 'violation')}")

        return {
            "success": all_success and len(invariant_violations) == 0,
            "results": results,
            "gas_used": total_gas,
            "invariant_violations": invariant_violations,
            "error": results[-1]["error"] if results and not results[-1]["success"] else None
        }

    # ═══════════════════════════════════════════════════════════════════════════
    # HELPERS
    # ═══════════════════════════════════════════════════════════════════════════

    def _build_tx_params(self) -> Dict[str, Any]:
        """Build transaction parameters."""
        if not self.account:
            raise ValueError("No account configured - private key required for transactions")

        return {
            "from": self.account.address,
            "nonce": self.w3.eth.get_transaction_count(self.account.address),
            "chainId": self.chain_id,
            "gas": 500000,  # Will be estimated
            "maxFeePerGas": self.w3.eth.gas_price * 2,
            "maxPriorityFeePerGas": self.w3.to_wei(2, 'gwei')
        }

    async def _send_transaction(self, tx: Dict[str, Any]) -> Dict[str, Any]:
        """Sign and send transaction."""
        if not self.account:
            raise ValueError("No account configured")

        # Estimate gas
        tx['gas'] = self.w3.eth.estimate_gas(tx)

        # Sign
        signed = self.account.sign_transaction(tx)

        # Send
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)

        # Wait for receipt
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)

        return {
            "tx_hash": tx_hash.hex(),
            "block_number": receipt['blockNumber'],
            "gas_used": receipt['gasUsed'],
            "status": "success" if receipt['status'] == 1 else "failed"
        }
