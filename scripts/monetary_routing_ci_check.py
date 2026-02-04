#!/usr/bin/env python3
"""
MONETARY ROUTING CI GUARDRAIL
===============================================================================

PURPOSE:
Fail CI if the selected money mechanic in intake/PROJECT_CONTEXT.json does not
match the active routing path documented in /diagrams/MonetaryRouting.ascii.

REQUIRED INPUTS:
- intake/PROJECT_CONTEXT.json
- diagrams/MonetaryRouting.ascii

FAILURE RULE:
If CI fails, DAO Gate MUST block deployment and require remediation + re-run.

===============================================================================
"""

import json
import sys
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTE MARKERS
# ═══════════════════════════════════════════════════════════════════════════════

ROUTE_MARKERS = {
    "FIXED": "[ROUTE:FIXED]",
    "EMISSIONS": "[ROUTE:EMISSIONS]",
    "SECURE_MINT": "[ROUTE:SECURE_MINT]",
    "CROSS_CHAIN": "[ROUTE:CROSS_CHAIN]",
}

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTING RULES
# ═══════════════════════════════════════════════════════════════════════════════

def infer_required_routes(context: Dict) -> List[str]:
    """
    Parse PROJECT_CONTEXT.json and infer expected routes.

    Rules:
    1. stablecoin_backed or backing_type != "none" => SECURE_MINT
    2. emissions_schedule != "none" => EMISSIONS
    3. cross_chain_required == true => CROSS_CHAIN
    4. minting_required == false => FIXED
    """
    required_routes = []

    # Rule 1: Backed tokens require SECURE_MINT
    money_mechanic = context.get("money_mechanic_type", "")
    backing_type = context.get("backing_type", "none")

    if money_mechanic == "stablecoin_backed" or backing_type != "none":
        required_routes.append("SECURE_MINT")

    # Rule 2: Emissions tokens require EMISSIONS route
    emissions_schedule = context.get("emissions_schedule", "none")
    if emissions_schedule != "none" and emissions_schedule:
        required_routes.append("EMISSIONS")

    # Rule 3: Cross-chain tokens require CROSS_CHAIN route
    cross_chain_required = context.get("cross_chain_required", False)
    if cross_chain_required:
        required_routes.append("CROSS_CHAIN")

    # Rule 4: Fixed supply (no post-TGE minting) requires FIXED route
    minting_required = context.get("minting_required", True)
    if not minting_required:
        required_routes.append("FIXED")

    return required_routes


def parse_routing_diagram(diagram_content: str) -> List[str]:
    """
    Parse MonetaryRouting.ascii for route markers.
    """
    found_routes = []

    for route_name, marker in ROUTE_MARKERS.items():
        if marker in diagram_content:
            found_routes.append(route_name)

    return found_routes


def check_routing_consistency(
    required_routes: List[str],
    documented_routes: List[str]
) -> Tuple[bool, List[str]]:
    """
    Check if all required routes are documented in the diagram.
    """
    missing_routes = []

    for route in required_routes:
        if route not in documented_routes:
            missing_routes.append(route)

    return len(missing_routes) == 0, missing_routes


# ═══════════════════════════════════════════════════════════════════════════════
# REPORT GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def generate_report(
    context: Dict,
    required_routes: List[str],
    documented_routes: List[str],
    missing_routes: List[str],
    passed: bool,
    output_path: Path
) -> str:
    """
    Generate the CI report in Markdown format.
    """
    timestamp = datetime.utcnow().isoformat() + "Z"

    report = f"""# Monetary Routing CI Report

**Generated:** {timestamp}
**Status:** {"✅ PASSED" if passed else "❌ FAILED"}

## Context Analysis

| Field | Value |
|-------|-------|
| money_mechanic_type | `{context.get('money_mechanic_type', 'N/A')}` |
| backing_type | `{context.get('backing_type', 'N/A')}` |
| emissions_schedule | `{context.get('emissions_schedule', 'N/A')}` |
| cross_chain_required | `{context.get('cross_chain_required', 'N/A')}` |
| minting_required | `{context.get('minting_required', 'N/A')}` |

## Route Analysis

### Required Routes (from PROJECT_CONTEXT.json)
{chr(10).join(f'- `[ROUTE:{r}]`' for r in required_routes) if required_routes else '- None required'}

### Documented Routes (from MonetaryRouting.ascii)
{chr(10).join(f'- `[ROUTE:{r}]`' for r in documented_routes) if documented_routes else '- None found'}

### Missing Routes
{chr(10).join(f'- ❌ `[ROUTE:{r}]`' for r in missing_routes) if missing_routes else '- ✅ All required routes documented'}

## Verdict

"""

    if passed:
        report += """**PASSED** - All required monetary routes are documented and consistent.

The deployment may proceed to the next gate.
"""
    else:
        report += f"""**FAILED** - Routing mismatch detected.

### Required Actions

1. Update `diagrams/MonetaryRouting.ascii` to include the missing route markers:
{chr(10).join(f'   - `[ROUTE:{r}]`' for r in missing_routes)}

2. OR update `intake/PROJECT_CONTEXT.json` if the project requirements have changed.

3. Re-run this CI check.

### Blocker

**DAO Gate MUST block deployment until this check passes.**

---

*This check enforces the Follow-the-Money doctrine: monetary routing must be
explicitly documented and consistent with project configuration.*
"""

    # Write report
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report)

    return report


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    """
    Main entry point for CI check.
    """
    # Default paths (can be overridden via env vars)
    project_root = Path(os.environ.get("PROJECT_ROOT", "."))
    context_path = project_root / os.environ.get(
        "PROJECT_CONTEXT_PATH",
        "intake/PROJECT_CONTEXT.json"
    )
    diagram_path = project_root / os.environ.get(
        "ROUTING_DIAGRAM_PATH",
        "diagrams/MonetaryRouting.ascii"
    )
    output_path = project_root / os.environ.get(
        "CI_REPORT_PATH",
        "outputs/MonetaryRoutingCIReport.md"
    )

    print("=" * 70)
    print("MONETARY ROUTING CI CHECK")
    print("=" * 70)

    # Check required files exist
    if not context_path.exists():
        print(f"❌ ERROR: PROJECT_CONTEXT.json not found at {context_path}")
        print("   Create intake/PROJECT_CONTEXT.json with money mechanic settings.")
        sys.exit(1)

    if not diagram_path.exists():
        print(f"❌ ERROR: MonetaryRouting.ascii not found at {diagram_path}")
        print("   Create diagrams/MonetaryRouting.ascii with route markers.")
        sys.exit(1)

    # Load inputs
    print(f"\n📄 Loading PROJECT_CONTEXT.json from: {context_path}")
    with open(context_path) as f:
        context = json.load(f)

    print(f"📄 Loading MonetaryRouting.ascii from: {diagram_path}")
    diagram_content = diagram_path.read_text()

    # Analyze
    print("\n🔍 Analyzing routing requirements...")
    required_routes = infer_required_routes(context)
    print(f"   Required routes: {required_routes}")

    print("\n🔍 Parsing routing diagram...")
    documented_routes = parse_routing_diagram(diagram_content)
    print(f"   Documented routes: {documented_routes}")

    # Check consistency
    print("\n⚖️  Checking consistency...")
    passed, missing_routes = check_routing_consistency(required_routes, documented_routes)

    # Generate report
    print(f"\n📝 Generating report at: {output_path}")
    report = generate_report(
        context=context,
        required_routes=required_routes,
        documented_routes=documented_routes,
        missing_routes=missing_routes,
        passed=passed,
        output_path=output_path
    )

    # Output result
    print("\n" + "=" * 70)
    if passed:
        print("✅ CI CHECK PASSED")
        print("=" * 70)
        print("\nAll required monetary routes are documented and consistent.")
        sys.exit(0)
    else:
        print("❌ CI CHECK FAILED")
        print("=" * 70)
        print(f"\nMissing routes: {missing_routes}")
        print("\nDAO Gate MUST block deployment until resolved.")
        sys.exit(1)


if __name__ == "__main__":
    main()
