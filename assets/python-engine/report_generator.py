"""
SecureMint Engine - Report Generator
Automated report generation for compliance, treasury, and operations.
"""

import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import hashlib


@dataclass
class ReportMetadata:
    """Report metadata."""
    report_type: str
    generated_at: datetime
    generated_by: str = "SecureMint CLI"
    version: str = "1.0.0"
    checksum: str = ""


class ReportGenerator:
    """
    Automated report generation for:
    - Reserve attestations
    - Monthly compliance summaries
    - Treasury reports
    - Bridge activity reports
    - Insurance fund reports
    """

    def __init__(self, api):
        self.api = api

    # ═══════════════════════════════════════════════════════════════════════════
    # RESERVE ATTESTATION
    # ═══════════════════════════════════════════════════════════════════════════

    async def generate_reserve_attestation(
        self,
        start_date: datetime,
        end_date: datetime,
        include_proof: bool = False
    ) -> Dict[str, Any]:
        """
        Generate reserve attestation report.

        Includes:
        - Total supply vs backing ratio
        - Historical backing data
        - Oracle update frequency
        - Merkle proof of reserves (optional)
        """
        # Get current state
        total_supply = await self.api.get_total_supply()
        backing = await self.api.get_backing()
        oracle_status = await self.api.get_oracle_status()

        # Get historical data
        oracle_history = await self.api.get_oracle_history(limit=1000)

        # Filter to date range
        history_in_range = [
            h for h in oracle_history
            if start_date.timestamp() <= h["timestamp"] <= end_date.timestamp()
        ]

        # Calculate statistics
        if history_in_range:
            backing_values = [h["backing"] for h in history_in_range]
            min_backing = min(backing_values)
            max_backing = max(backing_values)
            avg_backing = sum(backing_values) / len(backing_values)
            update_count = len(history_in_range)
        else:
            min_backing = max_backing = avg_backing = backing
            update_count = 0

        # Calculate coverage ratio over time
        coverage_ratio = backing / total_supply if total_supply > 0 else float('inf')

        report = {
            "metadata": {
                "report_type": "reserve_attestation",
                "generated_at": datetime.now().isoformat(),
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                }
            },
            "current_state": {
                "total_supply": total_supply,
                "total_supply_formatted": f"{total_supply/1e6:,.2f}",
                "backing": backing,
                "backing_formatted": f"{backing/1e6:,.2f}",
                "coverage_ratio": coverage_ratio,
                "is_fully_backed": coverage_ratio >= 1.0,
                "oracle_last_update": oracle_status["last_update"],
                "oracle_is_stale": oracle_status["is_stale"]
            },
            "period_statistics": {
                "min_backing": min_backing,
                "max_backing": max_backing,
                "avg_backing": avg_backing,
                "oracle_update_count": update_count,
                "update_frequency_hours": (
                    (end_date - start_date).total_seconds() / 3600 / update_count
                    if update_count > 0 else None
                )
            },
            "invariant_status": {
                "INV-SM-1_solvency": total_supply <= backing,
                "message": (
                    "PASS: Total supply is fully backed"
                    if total_supply <= backing
                    else f"FAIL: Underbacked by {(total_supply - backing)/1e6:,.2f}M"
                )
            },
            "attestation": {
                "statement": (
                    f"As of {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}, "
                    f"the total token supply of {total_supply/1e6:,.2f}M is "
                    f"{'fully backed' if coverage_ratio >= 1 else 'NOT fully backed'} "
                    f"by reserves of {backing/1e6:,.2f}M "
                    f"(coverage ratio: {coverage_ratio:.4f})."
                ),
                "auditor_ready": True
            }
        }

        # Add Merkle proof if requested
        if include_proof:
            report["merkle_proof"] = await self._generate_merkle_proof(
                total_supply, backing
            )

        # Add checksum
        report["checksum"] = self._calculate_checksum(report)

        return report

    async def _generate_merkle_proof(
        self,
        total_supply: int,
        backing: int
    ) -> Dict[str, Any]:
        """Generate Merkle proof for reserve attestation."""
        # Build leaf data
        leaf_data = {
            "total_supply": str(total_supply),
            "backing": str(backing),
            "timestamp": str(int(datetime.now().timestamp())),
            "block_number": str(self.api.w3.eth.block_number)
        }

        # Calculate leaf hash
        leaf_hash = hashlib.sha256(
            json.dumps(leaf_data, sort_keys=True).encode()
        ).hexdigest()

        return {
            "leaf_data": leaf_data,
            "leaf_hash": leaf_hash,
            "proof": [],  # Would be populated in production
            "root": leaf_hash  # Simplified for demo
        }

    # ═══════════════════════════════════════════════════════════════════════════
    # MONTHLY SUMMARY
    # ═══════════════════════════════════════════════════════════════════════════

    async def generate_monthly_summary(
        self,
        year: int,
        month: int
    ) -> Dict[str, Any]:
        """
        Generate monthly compliance summary.

        Includes:
        - Transaction volume
        - User activity
        - Compliance metrics
        - Risk distribution
        """
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)

        # Get token contract events
        token = self.api.contracts.get("token")
        policy = self.api.contracts.get("policy")

        # This would query actual blockchain events in production
        # For now, return template structure

        report = {
            "metadata": {
                "report_type": "monthly_summary",
                "generated_at": datetime.now().isoformat(),
                "period": {
                    "year": year,
                    "month": month,
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                }
            },
            "supply_metrics": {
                "opening_supply": 0,  # Would be calculated
                "closing_supply": await self.api.get_total_supply(),
                "net_change": 0,
                "total_minted": 0,
                "total_burned": 0,
                "total_redeemed": 0
            },
            "transaction_metrics": {
                "total_transactions": 0,
                "mint_transactions": 0,
                "burn_transactions": 0,
                "transfer_transactions": 0,
                "unique_addresses": 0
            },
            "compliance_metrics": {
                "kyc_verified_volume": 0,
                "blocked_transactions": 0,
                "suspicious_activity_reports": 0,
                "compliance_rate": 1.0
            },
            "risk_distribution": {
                "low": 0,
                "medium": 0,
                "high": 0,
                "severe": 0
            },
            "oracle_metrics": {
                "total_updates": 0,
                "average_update_frequency_hours": 0,
                "staleness_incidents": 0
            },
            "recommendations": []
        }

        return report

    # ═══════════════════════════════════════════════════════════════════════════
    # COMPLIANCE REPORT
    # ═══════════════════════════════════════════════════════════════════════════

    async def generate_compliance_report(
        self,
        start_date: datetime,
        end_date: datetime,
        jurisdiction: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate regulatory compliance report."""

        report = {
            "metadata": {
                "report_type": "compliance_report",
                "generated_at": datetime.now().isoformat(),
                "jurisdiction": jurisdiction or "GLOBAL",
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                }
            },
            "kyc_summary": {
                "total_users": 0,
                "verified_users": 0,
                "pending_verification": 0,
                "verification_rate": 0,
                "by_level": {
                    "basic": 0,
                    "enhanced": 0,
                    "institutional": 0
                }
            },
            "aml_summary": {
                "transactions_screened": 0,
                "alerts_generated": 0,
                "alerts_cleared": 0,
                "alerts_escalated": 0,
                "sars_filed": 0
            },
            "sanctions_summary": {
                "addresses_screened": 0,
                "matches_found": 0,
                "false_positives": 0,
                "blocked_transactions": 0
            },
            "transaction_reporting": {
                "ctr_filed": 0,  # Currency Transaction Reports
                "travel_rule_compliant": 0,
                "travel_rule_violations": 0
            },
            "audit_trail": {
                "policy_changes": [],
                "access_logs_available": True,
                "data_retention_compliant": True
            },
            "certifications": {
                "last_audit_date": None,
                "audit_firm": None,
                "findings": []
            }
        }

        return report

    # ═══════════════════════════════════════════════════════════════════════════
    # TREASURY REPORT
    # ═══════════════════════════════════════════════════════════════════════════

    async def generate_treasury_report(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Generate treasury status and activity report."""

        treasury_status = await self.api.get_treasury_status()

        report = {
            "metadata": {
                "report_type": "treasury_report",
                "generated_at": datetime.now().isoformat(),
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                }
            },
            "current_status": treasury_status,
            "tier_breakdown": {
                "tier_0_instant": {
                    "balance": treasury_status["tiers"][0]["balance"] if treasury_status["tiers"] else 0,
                    "allocation_target": "10%",
                    "description": "Immediate liquidity for redemptions"
                },
                "tier_1_liquid": {
                    "balance": treasury_status["tiers"][1]["balance"] if len(treasury_status["tiers"]) > 1 else 0,
                    "allocation_target": "30%",
                    "description": "Money market and short-term instruments"
                },
                "tier_2_yield": {
                    "balance": treasury_status["tiers"][2]["balance"] if len(treasury_status["tiers"]) > 2 else 0,
                    "allocation_target": "40%",
                    "description": "Treasury bonds and yield strategies"
                },
                "tier_3_strategic": {
                    "balance": treasury_status["tiers"][3]["balance"] if len(treasury_status["tiers"]) > 3 else 0,
                    "allocation_target": "20%",
                    "description": "Long-term strategic holdings"
                }
            },
            "period_activity": {
                "deposits": 0,
                "withdrawals": 0,
                "rebalances": 0,
                "yield_earned": 0
            },
            "yield_metrics": {
                "total_yield": 0,
                "annualized_rate": 0,
                "yield_by_tier": {}
            },
            "health_indicators": {
                "is_balanced": treasury_status["is_balanced"],
                "liquidity_ratio": 0,
                "concentration_risk": "low"
            }
        }

        return report

    # ═══════════════════════════════════════════════════════════════════════════
    # BRIDGE REPORT
    # ═══════════════════════════════════════════════════════════════════════════

    async def generate_bridge_report(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Generate cross-chain bridge activity report."""

        bridge_status = await self.api.get_bridge_status()
        pending = await self.api.get_pending_transfers()

        report = {
            "metadata": {
                "report_type": "bridge_report",
                "generated_at": datetime.now().isoformat(),
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                }
            },
            "bridge_status": bridge_status,
            "activity_summary": {
                "total_transfers": 0,
                "completed_transfers": 0,
                "pending_transfers": len(pending),
                "failed_transfers": 0,
                "total_volume": 0,
                "fees_collected": 0
            },
            "by_chain": {},  # Would be populated with per-chain stats
            "pending_transfers": pending[:10],  # First 10
            "validator_metrics": {
                "total_validators": bridge_status["validator_count"],
                "threshold": bridge_status["validator_threshold"],
                "average_validation_time": 0
            },
            "security_metrics": {
                "replay_attempts_blocked": 0,
                "rate_limit_triggers": 0,
                "pause_events": 0
            }
        }

        return report

    # ═══════════════════════════════════════════════════════════════════════════
    # INSURANCE REPORT
    # ═══════════════════════════════════════════════════════════════════════════

    async def generate_insurance_report(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Generate insurance fund status and claims report."""

        # Would query insurance contract in production
        report = {
            "metadata": {
                "report_type": "insurance_report",
                "generated_at": datetime.now().isoformat(),
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                }
            },
            "fund_status": {
                "total_balance": 0,
                "total_contributions": 0,
                "total_claims_paid": 0
            },
            "coverage_breakdown": {
                "depeg": {
                    "allocated": 0,
                    "claimed": 0,
                    "available": 0
                },
                "slashing": {
                    "allocated": 0,
                    "claimed": 0,
                    "available": 0
                },
                "oracle_failure": {
                    "allocated": 0,
                    "claimed": 0,
                    "available": 0
                },
                "smart_contract": {
                    "allocated": 0,
                    "claimed": 0,
                    "available": 0
                }
            },
            "claims_summary": {
                "total_claims": 0,
                "pending": 0,
                "approved": 0,
                "rejected": 0,
                "paid": 0
            },
            "recent_claims": [],
            "fund_health": {
                "coverage_ratio": 0,
                "runway_months": 0,
                "rebalance_needed": False
            }
        }

        return report

    # ═══════════════════════════════════════════════════════════════════════════
    # UTILITIES
    # ═══════════════════════════════════════════════════════════════════════════

    def _calculate_checksum(self, report: Dict[str, Any]) -> str:
        """Calculate report checksum for integrity verification."""
        # Remove existing checksum if present
        report_copy = {k: v for k, v in report.items() if k != "checksum"}
        content = json.dumps(report_copy, sort_keys=True, default=str)
        return hashlib.sha256(content.encode()).hexdigest()

    def to_markdown(self, report: Dict[str, Any]) -> str:
        """Convert report to markdown format."""
        md = []
        report_type = report.get("metadata", {}).get("report_type", "Report")

        md.append(f"# {report_type.replace('_', ' ').title()}")
        md.append("")
        md.append(f"Generated: {report.get('metadata', {}).get('generated_at', 'N/A')}")
        md.append("")

        def format_section(data: Dict, level: int = 2):
            lines = []
            for key, value in data.items():
                if key == "metadata":
                    continue

                header = key.replace("_", " ").title()
                lines.append(f"{'#' * level} {header}")
                lines.append("")

                if isinstance(value, dict):
                    for k, v in value.items():
                        if isinstance(v, dict):
                            lines.append(f"**{k.replace('_', ' ').title()}:**")
                            for kk, vv in v.items():
                                lines.append(f"  - {kk.replace('_', ' ')}: {vv}")
                        else:
                            lines.append(f"- **{k.replace('_', ' ')}:** {v}")
                    lines.append("")
                elif isinstance(value, list):
                    for item in value:
                        lines.append(f"- {item}")
                    lines.append("")
                else:
                    lines.append(f"{value}")
                    lines.append("")

            return lines

        md.extend(format_section(report))

        md.append("---")
        md.append(f"*Checksum: {report.get('checksum', 'N/A')}*")

        return "\n".join(md)

    def to_csv(self, report: Dict[str, Any]) -> str:
        """Convert report to CSV format (for flat data)."""
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)

        # Flatten report
        def flatten(data: Dict, prefix: str = "") -> Dict[str, Any]:
            items = {}
            for key, value in data.items():
                new_key = f"{prefix}_{key}" if prefix else key
                if isinstance(value, dict):
                    items.update(flatten(value, new_key))
                elif isinstance(value, list):
                    items[new_key] = json.dumps(value)
                else:
                    items[new_key] = value
            return items

        flat = flatten(report)

        writer.writerow(flat.keys())
        writer.writerow(flat.values())

        return output.getvalue()
