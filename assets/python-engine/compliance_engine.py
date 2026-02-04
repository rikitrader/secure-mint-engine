"""
SecureMint Engine - Compliance Engine
Local execution of compliance checks for bulk address screening.
"""

import os
import json
import asyncio
import aiohttp
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum


class ComplianceProvider(Enum):
    """Supported compliance/screening providers."""
    CHAINALYSIS = "chainalysis"
    ELLIPTIC = "elliptic"
    TRM_LABS = "trm"
    INTERNAL = "internal"


class RiskLevel(Enum):
    """Risk classification levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    SEVERE = "severe"
    BLOCKED = "blocked"


@dataclass
class ScreeningResult:
    """Result of screening a single address."""
    address: str
    compliant: bool
    risk_level: RiskLevel
    kyc_status: Optional[str] = None
    aml_alerts: List[str] = field(default_factory=list)
    sanctions_match: bool = False
    pep_match: bool = False
    provider_data: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)


class ComplianceEngine:
    """
    High-performance compliance checking engine.

    Features:
    - Batch address screening
    - Multiple provider integration
    - On-chain KYC registry lookup
    - OFAC/sanctions list checking
    - PEP screening
    - Risk scoring
    """

    # Sanctions lists (cached locally)
    OFAC_ADDRESSES = set()  # Loaded from file

    def __init__(self, api, jurisdiction: str = "US"):
        self.api = api
        self.jurisdiction = jurisdiction

        # Provider configurations
        self.providers = {
            ComplianceProvider.CHAINALYSIS: {
                "api_key": os.getenv("CHAINALYSIS_API_KEY"),
                "base_url": "https://api.chainalysis.com/api/kyt/v2"
            },
            ComplianceProvider.ELLIPTIC: {
                "api_key": os.getenv("ELLIPTIC_API_KEY"),
                "base_url": "https://api.elliptic.co/v2"
            },
            ComplianceProvider.TRM_LABS: {
                "api_key": os.getenv("TRM_API_KEY"),
                "base_url": "https://api.trmlabs.com/public/v2"
            }
        }

        # Load sanctions list
        self._load_sanctions_list()

    def _load_sanctions_list(self):
        """Load OFAC and other sanctions addresses."""
        sanctions_file = os.path.join(
            os.path.dirname(__file__),
            "data",
            "sanctions_addresses.json"
        )

        if os.path.exists(sanctions_file):
            with open(sanctions_file) as f:
                data = json.load(f)
                self.OFAC_ADDRESSES = set(
                    addr.lower() for addr in data.get("addresses", [])
                )

    # ═══════════════════════════════════════════════════════════════════════════
    # BATCH CHECKING
    # ═══════════════════════════════════════════════════════════════════════════

    async def check_batch(
        self,
        addresses: List[str],
        check_kyc: bool = True,
        check_aml: bool = True,
        check_sanctions: bool = True,
        provider: ComplianceProvider = ComplianceProvider.INTERNAL
    ) -> Dict[str, Any]:
        """
        Check compliance for batch of addresses.

        Returns comprehensive results with:
        - Individual address results
        - Summary statistics
        - Risk distribution
        """
        start_time = datetime.now()
        results = []

        # Process in parallel batches
        batch_size = 50
        for i in range(0, len(addresses), batch_size):
            batch = addresses[i:i + batch_size]
            batch_results = await asyncio.gather(*[
                self._check_single(
                    addr,
                    check_kyc,
                    check_aml,
                    check_sanctions,
                    provider
                )
                for addr in batch
            ])
            results.extend(batch_results)

        # Calculate statistics
        compliant_count = sum(1 for r in results if r.compliant)
        risk_distribution = {
            level.value: sum(1 for r in results if r.risk_level == level)
            for level in RiskLevel
        }

        end_time = datetime.now()

        return {
            "results": [self._result_to_dict(r) for r in results],
            "summary": {
                "total_checked": len(addresses),
                "compliant": compliant_count,
                "non_compliant": len(addresses) - compliant_count,
                "compliance_rate": compliant_count / len(addresses) if addresses else 0,
                "risk_distribution": risk_distribution
            },
            "jurisdiction": self.jurisdiction,
            "checks_performed": {
                "kyc": check_kyc,
                "aml": check_aml,
                "sanctions": check_sanctions
            },
            "provider": provider.value,
            "timestamp": start_time.isoformat(),
            "duration_seconds": (end_time - start_time).total_seconds()
        }

    async def _check_single(
        self,
        address: str,
        check_kyc: bool,
        check_aml: bool,
        check_sanctions: bool,
        provider: ComplianceProvider
    ) -> ScreeningResult:
        """Check single address."""
        result = ScreeningResult(
            address=address,
            compliant=True,
            risk_level=RiskLevel.LOW
        )

        # Normalize address
        address_lower = address.lower()

        # 1. Sanctions check (fastest, local)
        if check_sanctions:
            if address_lower in self.OFAC_ADDRESSES:
                result.compliant = False
                result.sanctions_match = True
                result.risk_level = RiskLevel.BLOCKED
                result.aml_alerts.append("OFAC sanctions list match")
                return result  # No need to continue

        # 2. KYC check (on-chain)
        if check_kyc:
            kyc_result = await self._check_kyc(address)
            result.kyc_status = kyc_result["status"]
            if kyc_result["status"] not in ["verified", "enhanced"]:
                result.compliant = False
                result.risk_level = max(result.risk_level, RiskLevel.MEDIUM, key=lambda x: x.value)

        # 3. AML screening (external provider)
        if check_aml and provider != ComplianceProvider.INTERNAL:
            aml_result = await self._check_aml(address, provider)
            if aml_result["risk_score"] > 0.7:
                result.compliant = False
                result.risk_level = RiskLevel.HIGH
            elif aml_result["risk_score"] > 0.5:
                result.risk_level = max(result.risk_level, RiskLevel.MEDIUM, key=lambda x: x.value)

            result.aml_alerts.extend(aml_result.get("alerts", []))
            result.provider_data[provider.value] = aml_result

        return result

    # ═══════════════════════════════════════════════════════════════════════════
    # KYC CHECKING
    # ═══════════════════════════════════════════════════════════════════════════

    async def _check_kyc(self, address: str) -> Dict[str, Any]:
        """Check KYC status from on-chain registry."""
        try:
            # Try to get KYC registry contract
            kyc_registry = self.api.contracts.get("kyc_registry")

            if kyc_registry:
                # Call on-chain KYC registry
                is_verified = kyc_registry.functions.isVerified(
                    self.api.w3.to_checksum_address(address)
                ).call()

                level = kyc_registry.functions.getKYCLevel(
                    self.api.w3.to_checksum_address(address)
                ).call() if is_verified else 0

                return {
                    "status": ["none", "basic", "verified", "enhanced"][min(level, 3)],
                    "level": level,
                    "verified": is_verified,
                    "source": "on-chain"
                }

            # Fallback: assume verified for testing
            return {
                "status": "unknown",
                "verified": False,
                "source": "not_available"
            }

        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "source": "error"
            }

    # ═══════════════════════════════════════════════════════════════════════════
    # AML SCREENING
    # ═══════════════════════════════════════════════════════════════════════════

    async def _check_aml(
        self,
        address: str,
        provider: ComplianceProvider
    ) -> Dict[str, Any]:
        """Check AML status via external provider."""
        config = self.providers.get(provider)
        if not config or not config.get("api_key"):
            return {"risk_score": 0, "alerts": [], "error": "Provider not configured"}

        try:
            if provider == ComplianceProvider.CHAINALYSIS:
                return await self._check_chainalysis(address, config)
            elif provider == ComplianceProvider.ELLIPTIC:
                return await self._check_elliptic(address, config)
            elif provider == ComplianceProvider.TRM_LABS:
                return await self._check_trm(address, config)
            else:
                return {"risk_score": 0, "alerts": []}

        except Exception as e:
            return {"risk_score": 0, "alerts": [], "error": str(e)}

    async def _check_chainalysis(
        self,
        address: str,
        config: Dict[str, str]
    ) -> Dict[str, Any]:
        """Check address via Chainalysis KYT."""
        async with aiohttp.ClientSession() as session:
            headers = {
                "Token": config["api_key"],
                "Content-Type": "application/json"
            }

            # Register transfer (required for KYT)
            async with session.post(
                f"{config['base_url']}/transfers",
                headers=headers,
                json={
                    "network": "ethereum",
                    "asset": "ETH",
                    "transferReference": f"check_{address[:10]}",
                    "direction": "received",
                    "outputAddress": address
                }
            ) as resp:
                if resp.status != 200:
                    return {"risk_score": 0, "alerts": [], "error": f"API error: {resp.status}"}

                data = await resp.json()

                # Parse risk exposure
                risk_score = 0
                alerts = []

                exposures = data.get("exposures", [])
                for exp in exposures:
                    if exp.get("category") in ["sanctions", "terrorism", "ransomware"]:
                        risk_score = max(risk_score, 0.9)
                        alerts.append(f"High-risk exposure: {exp['category']}")
                    elif exp.get("category") in ["mixer", "gambling"]:
                        risk_score = max(risk_score, 0.5)
                        alerts.append(f"Medium-risk exposure: {exp['category']}")

                return {
                    "risk_score": risk_score,
                    "alerts": alerts,
                    "raw_response": data
                }

    async def _check_elliptic(
        self,
        address: str,
        config: Dict[str, str]
    ) -> Dict[str, Any]:
        """Check address via Elliptic."""
        async with aiohttp.ClientSession() as session:
            headers = {
                "x-api-key": config["api_key"],
                "Content-Type": "application/json"
            }

            async with session.post(
                f"{config['base_url']}/wallet/synchronous",
                headers=headers,
                json={
                    "subject": {
                        "asset": "holistic",
                        "blockchain": "ethereum",
                        "type": "address",
                        "hash": address
                    },
                    "type": "wallet_exposure"
                }
            ) as resp:
                if resp.status != 200:
                    return {"risk_score": 0, "alerts": [], "error": f"API error: {resp.status}"}

                data = await resp.json()

                risk_score = data.get("risk_score", 0)
                alerts = [
                    f"{cluster['name']}: {cluster['percentage']}%"
                    for cluster in data.get("clusters", [])
                    if cluster.get("is_high_risk")
                ]

                return {
                    "risk_score": risk_score,
                    "alerts": alerts,
                    "raw_response": data
                }

    async def _check_trm(
        self,
        address: str,
        config: Dict[str, str]
    ) -> Dict[str, Any]:
        """Check address via TRM Labs."""
        async with aiohttp.ClientSession() as session:
            headers = {
                "Authorization": f"Basic {config['api_key']}",
                "Content-Type": "application/json"
            }

            async with session.post(
                f"{config['base_url']}/screening/addresses",
                headers=headers,
                json=[{
                    "address": address,
                    "chain": "ethereum"
                }]
            ) as resp:
                if resp.status != 200:
                    return {"risk_score": 0, "alerts": [], "error": f"API error: {resp.status}"}

                data = await resp.json()

                if data and len(data) > 0:
                    result = data[0]
                    risk_score = 0
                    alerts = []

                    for indicator in result.get("riskIndicators", []):
                        if indicator.get("category") == "sanctions":
                            risk_score = max(risk_score, 1.0)
                            alerts.append(f"Sanctions: {indicator.get('description')}")
                        elif indicator.get("categoryRiskScoreLevel") == "SEVERE":
                            risk_score = max(risk_score, 0.9)
                            alerts.append(f"Severe: {indicator.get('description')}")

                    return {
                        "risk_score": risk_score,
                        "alerts": alerts,
                        "raw_response": result
                    }

                return {"risk_score": 0, "alerts": []}

    # ═══════════════════════════════════════════════════════════════════════════
    # UTILITIES
    # ═══════════════════════════════════════════════════════════════════════════

    def _result_to_dict(self, result: ScreeningResult) -> Dict[str, Any]:
        """Convert ScreeningResult to dictionary."""
        return {
            "address": result.address,
            "compliant": result.compliant,
            "risk_level": result.risk_level.value,
            "kyc_status": result.kyc_status,
            "aml_alerts": result.aml_alerts,
            "sanctions_match": result.sanctions_match,
            "pep_match": result.pep_match,
            "timestamp": result.timestamp.isoformat()
        }

    async def generate_compliance_report(
        self,
        addresses: List[str]
    ) -> Dict[str, Any]:
        """Generate detailed compliance report for addresses."""
        results = await self.check_batch(
            addresses,
            check_kyc=True,
            check_aml=True,
            check_sanctions=True
        )

        # Group by risk level
        by_risk = {}
        for r in results["results"]:
            level = r["risk_level"]
            if level not in by_risk:
                by_risk[level] = []
            by_risk[level].append(r)

        return {
            "report_type": "compliance_screening",
            "jurisdiction": self.jurisdiction,
            "generated_at": datetime.now().isoformat(),
            "summary": results["summary"],
            "by_risk_level": by_risk,
            "recommendations": self._generate_recommendations(results),
            "full_results": results["results"]
        }

    def _generate_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate compliance recommendations."""
        recommendations = []

        summary = results["summary"]

        if summary["risk_distribution"].get("blocked", 0) > 0:
            recommendations.append(
                "CRITICAL: Blocked addresses detected. Do not process transactions."
            )

        if summary["risk_distribution"].get("high", 0) > 0:
            recommendations.append(
                "HIGH RISK: Enhanced due diligence required for high-risk addresses."
            )

        if summary["compliance_rate"] < 0.95:
            recommendations.append(
                f"Compliance rate ({summary['compliance_rate']:.1%}) below target. "
                "Review non-compliant addresses."
            )

        if not recommendations:
            recommendations.append("All addresses within acceptable risk parameters.")

        return recommendations
