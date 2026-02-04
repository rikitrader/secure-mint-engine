# Live Data Hooks Engine

## System Role

Data engineering lead for blockchain intelligence.

## Goal

Design a "LiveDataHooks" specification that the MarketIntelligenceEngine can use to refresh chain signals from public sources. Do NOT fabricate data. Provide a pluggable source registry.

---

## Output Files

Generate exactly:
- `/simulation/LIVE_DATA_SOURCES.md`
- `/simulation/LIVE_DATA_SCHEMA.json`
- `/simulation/LIVE_DATA_REFRESH_POLICY.md`
- `/mcp/manifests/tools.json` (ADD tool entries)

---

## LIVE_DATA_SOURCES.md

### Source Registry

#### TVL Sources

| Source | Measures | Update Frequency | Reliability | Fields |
|--------|----------|------------------|-------------|--------|
| DeFiLlama API | Protocol/chain TVL | Real-time | High - aggregated | tvl_usd, tvl_change_7d, tvl_change_30d |
| L2Beat | L2 TVL + security | Daily | High - audited data | tvl_usd, security_rating |

#### Outage/Incident Sources

| Source | Measures | Update Frequency | Reliability | Fields |
|--------|----------|------------------|-------------|--------|
| Chain status pages | Official uptime | Real-time | Official but may lag | outage_count_90d, last_outage |
| CryptoHacks aggregators | Incident tracking | Daily | Community-sourced | major_outage_last_12m |

#### Exploit Feeds

| Source | Measures | Update Frequency | Reliability | Fields |
|--------|----------|------------------|-------------|--------|
| Rekt News | Exploit reports | As incidents occur | High - verified | exploit_loss_usd_12m, exploit_count_12m |
| DeFi exploit databases | Historical exploits | Weekly | Aggregated | exploit_history |
| SlowMist Hacked | Security incidents | Daily | Community verified | exploit_details |

#### Stablecoin Supply/Volume Sources

| Source | Measures | Update Frequency | Reliability | Fields |
|--------|----------|------------------|-------------|--------|
| Stablecoin aggregators | Supply by chain | Daily | High | stablecoin_volume_30d |
| Chain analytics | Transfer volume | Real-time | Chain-specific | daily_volume |

#### Developer Activity (Optional)

| Source | Measures | Update Frequency | Reliability | Fields |
|--------|----------|------------------|-------------|--------|
| Electric Capital | Dev activity index | Monthly | Research-grade | dev_count, dev_growth |
| GitHub analytics | Commit activity | Weekly | Raw data | repo_activity |

---

## LIVE_DATA_SCHEMA.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "LiveChainData",
  "type": "object",
  "required": [
    "chain_id",
    "chain_name",
    "last_updated_utc",
    "source_provenance"
  ],
  "properties": {
    "chain_id": {
      "type": "string",
      "description": "Unique chain identifier"
    },
    "chain_name": {
      "type": "string",
      "description": "Human-readable chain name"
    },
    "tvl_usd": {
      "type": "number",
      "description": "Total Value Locked in USD",
      "minimum": 0
    },
    "tvl_change_7d": {
      "type": "number",
      "description": "7-day TVL change percentage"
    },
    "tvl_change_30d": {
      "type": "number",
      "description": "30-day TVL change percentage"
    },
    "outage_count_90d": {
      "type": "integer",
      "description": "Number of outages in last 90 days",
      "minimum": 0
    },
    "major_outage_last_12m": {
      "type": "boolean",
      "description": "Whether a major outage occurred in last 12 months"
    },
    "exploit_loss_usd_12m": {
      "type": "number",
      "description": "Total exploit losses in USD over 12 months",
      "minimum": 0
    },
    "exploit_count_12m": {
      "type": "integer",
      "description": "Number of exploits in last 12 months",
      "minimum": 0
    },
    "stablecoin_volume_30d": {
      "type": "number",
      "description": "30-day stablecoin transfer volume in USD",
      "minimum": 0
    },
    "oracle_por_supported": {
      "type": "string",
      "enum": ["full", "partial", "none"],
      "description": "Proof-of-Reserve oracle support level"
    },
    "last_updated_utc": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of last data update"
    },
    "source_provenance": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "source_name": { "type": "string" },
          "source_url": { "type": "string", "format": "uri" },
          "fetched_at": { "type": "string", "format": "date-time" },
          "fields_provided": {
            "type": "array",
            "items": { "type": "string" }
          }
        },
        "required": ["source_name", "fetched_at", "fields_provided"]
      },
      "description": "Provenance tracking for each data source"
    },
    "data_quality": {
      "type": "object",
      "properties": {
        "completeness": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Percentage of fields populated"
        },
        "freshness": {
          "type": "string",
          "enum": ["fresh", "stale", "expired"],
          "description": "Data freshness status"
        },
        "conflicts": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Fields where sources disagree"
        }
      }
    }
  }
}
```

---

## LIVE_DATA_REFRESH_POLICY.md

### Refresh Rules

#### Mandatory Refresh Points

| Trigger | Refresh Required |
|---------|-----------------|
| Before final shortlist | MANDATORY |
| Before DECISION_CONTEXT approval | MANDATORY |
| Before CI gate | MANDATORY |
| Weekly maintenance | RECOMMENDED |

#### Staleness Thresholds

| Data Type | Stale After | Expired After |
|-----------|-------------|---------------|
| TVL data | 24 hours | 7 days |
| Outage data | 48 hours | 14 days |
| Exploit data | 7 days | 30 days |
| Stablecoin volume | 24 hours | 7 days |

#### Source Disagreement Protocol

When sources disagree, use **conservative values**:

| Field | Conflict Resolution |
|-------|---------------------|
| `tvl_usd` | Use lower value |
| `exploit_loss_usd_12m` | Use higher value |
| `outage_count_90d` | Use higher value |
| `oracle_por_supported` | Use more restrictive rating |

#### Evidence Logging Requirements

Every refresh MUST be logged by EvidenceLoggingEngine:

```json
{
  "event_type": "live_data_refresh",
  "timestamp": "ISO8601",
  "chain_id": "string",
  "sources_queried": ["array"],
  "fields_updated": ["array"],
  "conflicts_detected": ["array"],
  "resolution_applied": "string",
  "snapshot_hash": "sha256"
}
```

---

## MCP Tool Definitions

Add to `/mcp/manifests/tools.json`:

### live_data_fetch

```json
{
  "name": "live_data_fetch",
  "description": "Fetch live chain data from registered sources",
  "inputs": {
    "chain_ids": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Chain IDs to fetch data for"
    },
    "sources": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Specific sources to query (optional, defaults to all)"
    },
    "fields": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Specific fields to fetch (optional, defaults to all)"
    }
  },
  "outputs": {
    "data": {
      "type": "array",
      "items": { "$ref": "#/definitions/LiveChainData" }
    },
    "errors": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "source": { "type": "string" },
          "error": { "type": "string" }
        }
      }
    }
  },
  "error_handling": {
    "source_timeout": "30s",
    "retry_count": 3,
    "fallback": "use_cached_if_available"
  },
  "rate_limits": {
    "requests_per_minute": 10,
    "burst": 5
  },
  "evidence_logging": "required"
}
```

### live_data_validate

```json
{
  "name": "live_data_validate",
  "description": "Validate live data against schema and freshness requirements",
  "inputs": {
    "data": {
      "type": "object",
      "description": "LiveChainData object to validate"
    },
    "staleness_thresholds": {
      "type": "object",
      "description": "Custom staleness thresholds (optional)"
    }
  },
  "outputs": {
    "valid": { "type": "boolean" },
    "errors": {
      "type": "array",
      "items": { "type": "string" }
    },
    "warnings": {
      "type": "array",
      "items": { "type": "string" }
    },
    "freshness_status": {
      "type": "string",
      "enum": ["fresh", "stale", "expired"]
    }
  },
  "evidence_logging": "required"
}
```

### live_data_snapshot

```json
{
  "name": "live_data_snapshot",
  "description": "Create immutable snapshot of current live data for audit trail",
  "inputs": {
    "chain_ids": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Chain IDs to snapshot"
    },
    "snapshot_id": {
      "type": "string",
      "description": "Unique identifier for this snapshot"
    },
    "reason": {
      "type": "string",
      "description": "Reason for snapshot (e.g., 'pre_deployment_check')"
    }
  },
  "outputs": {
    "snapshot_path": { "type": "string" },
    "snapshot_hash": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "evidence_log_id": { "type": "string" }
  },
  "evidence_logging": "required"
}
```

---

## Integration Notes

- These tools are **hooks** (stubs) unless the runtime environment provides APIs
- All tool invocations MUST be logged by EvidenceLoggingEngine
- Snapshots are immutable and MUST be retained for audit purposes
- Rate limits protect against API abuse and ensure fair usage
