#!/usr/bin/env python3
"""
Schema Validation Script for Secure Mint Engine

Validates project configuration files against JSON schemas.
Part of the CI pipeline to ensure configuration integrity.
"""

import json
import sys
import os
from pathlib import Path

try:
    import jsonschema
    from jsonschema import validate, ValidationError, SchemaError
except ImportError:
    print("ERROR: jsonschema package not installed. Run: pip install jsonschema")
    sys.exit(1)


def load_json_file(filepath: str) -> dict:
    """Load and parse a JSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)


def validate_file(data_file: str, schema_file: str) -> tuple[bool, str]:
    """
    Validate a JSON file against a schema.

    Returns:
        Tuple of (success: bool, message: str)
    """
    try:
        data = load_json_file(data_file)
        schema = load_json_file(schema_file)

        validate(instance=data, schema=schema)
        return True, f"✓ {os.path.basename(data_file)} is valid"

    except ValidationError as e:
        path = " -> ".join(str(p) for p in e.absolute_path) if e.absolute_path else "root"
        return False, f"✗ {os.path.basename(data_file)}: Validation error at '{path}': {e.message}"

    except SchemaError as e:
        return False, f"✗ Schema error in {os.path.basename(schema_file)}: {e.message}"

    except json.JSONDecodeError as e:
        return False, f"✗ JSON parse error in {data_file}: {e.msg}"

    except FileNotFoundError as e:
        return False, f"✗ File not found: {e.filename}"


def main():
    """Main validation routine."""
    print("═" * 70)
    print("  SECURE MINT ENGINE - Schema Validation")
    print("═" * 70)
    print()

    # Define validation pairs: (data_file, schema_file)
    project_root = Path(__file__).parent.parent.parent
    schemas_dir = project_root / "schemas"

    validations = []

    # Check if PROJECT_CONTEXT exists and validate
    context_path = os.environ.get('PROJECT_CONTEXT_PATH', 'intake/PROJECT_CONTEXT.json')
    context_file = project_root / context_path
    if context_file.exists():
        validations.append((
            str(context_file),
            str(schemas_dir / "project-context.schema.json")
        ))

    # Check for deployment manifests
    deployments_dir = project_root / "deployments"
    if deployments_dir.exists():
        for network_dir in deployments_dir.iterdir():
            if network_dir.is_dir():
                manifest = network_dir / "manifest.json"
                if manifest.exists():
                    validations.append((
                        str(manifest),
                        str(schemas_dir / "deployment-manifest.schema.json")
                    ))

    if not validations:
        print("No files to validate. Ensure PROJECT_CONTEXT.json exists.")
        print("Schema validation will be skipped.")
        sys.exit(0)

    # Run validations
    results = []
    for data_file, schema_file in validations:
        success, message = validate_file(data_file, schema_file)
        results.append((success, message))
        print(message)

    print()
    print("═" * 70)

    # Summary
    passed = sum(1 for s, _ in results if s)
    total = len(results)

    if passed == total:
        print(f"  All {total} validations passed!")
        print("═" * 70)
        sys.exit(0)
    else:
        print(f"  {total - passed}/{total} validations failed")
        print("═" * 70)
        sys.exit(1)


if __name__ == "__main__":
    main()
