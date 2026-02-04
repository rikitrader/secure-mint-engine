-- ═══════════════════════════════════════════════════════════════════════════════
-- SecureMint Engine - PostgreSQL Database Schema
-- Off-chain data persistence for API and analytics
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENUM TYPES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE mint_status AS ENUM (
    'pending', 'simulating', 'submitted', 'confirmed', 'failed', 'rejected'
);

CREATE TYPE burn_status AS ENUM (
    'pending', 'simulating', 'submitted', 'confirmed', 'failed'
);

CREATE TYPE redemption_status AS ENUM (
    'queued', 'processing', 'completed', 'cancelled', 'failed'
);

CREATE TYPE bridge_status AS ENUM (
    'initiated', 'source_confirmed', 'validators_signed',
    'destination_pending', 'completed', 'failed'
);

CREATE TYPE kyc_status AS ENUM (
    'not_verified', 'pending', 'verified', 'rejected', 'expired'
);

CREATE TYPE emergency_level AS ENUM (
    'normal', 'elevated', 'high', 'severe', 'critical', 'total_halt'
);

CREATE TYPE user_role AS ENUM (
    'user', 'operator', 'admin', 'guardian', 'superadmin'
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CORE TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Users and API keys
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(42) UNIQUE NOT NULL,
    role user_role DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(128) NOT NULL,
    name VARCHAR(255),
    permissions TEXT[] DEFAULT ARRAY['read'],
    rate_limit INTEGER DEFAULT 100,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- Chain configurations
CREATE TABLE chains (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    rpc_url VARCHAR(500),
    explorer_url VARCHAR(500),
    token_address VARCHAR(42),
    policy_address VARCHAR(42),
    treasury_address VARCHAR(42),
    oracle_address VARCHAR(42),
    bridge_address VARCHAR(42),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRANSACTION TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Mint requests
CREATE TABLE mint_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER REFERENCES chains(id),
    recipient VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    status mint_status DEFAULT 'pending',
    simulation_result JSONB,
    transaction_hash VARCHAR(66),
    block_number BIGINT,
    gas_used NUMERIC(78, 0),
    error_message TEXT,
    requested_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Burn requests
CREATE TABLE burn_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER REFERENCES chains(id),
    holder VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    status burn_status DEFAULT 'pending',
    simulation_result JSONB,
    transaction_hash VARCHAR(66),
    block_number BIGINT,
    gas_used NUMERIC(78, 0),
    error_message TEXT,
    requested_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT positive_burn_amount CHECK (amount > 0)
);

-- Redemption queue
CREATE TABLE redemption_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER REFERENCES chains(id),
    holder VARCHAR(42) NOT NULL,
    token_amount NUMERIC(78, 0) NOT NULL,
    redemption_asset VARCHAR(42) NOT NULL,
    expected_amount NUMERIC(78, 0),
    status redemption_status DEFAULT 'queued',
    queue_position INTEGER,
    transaction_hash VARCHAR(66),
    block_number BIGINT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT positive_redemption_amount CHECK (token_amount > 0)
);

-- Bridge transfers
CREATE TABLE bridge_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_chain_id INTEGER REFERENCES chains(id),
    destination_chain_id INTEGER REFERENCES chains(id),
    sender VARCHAR(42) NOT NULL,
    recipient VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    nonce BIGINT NOT NULL,
    status bridge_status DEFAULT 'initiated',
    source_tx_hash VARCHAR(66),
    destination_tx_hash VARCHAR(66),
    validator_signatures JSONB DEFAULT '[]',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT positive_bridge_amount CHECK (amount > 0)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMPLIANCE TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- KYC/AML records
CREATE TABLE compliance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(42) NOT NULL,
    kyc_status kyc_status DEFAULT 'not_verified',
    kyc_provider VARCHAR(50),
    kyc_reference VARCHAR(255),
    aml_risk_score NUMERIC(5, 4),
    aml_provider VARCHAR(50),
    sanctions_match BOOLEAN DEFAULT FALSE,
    sanctions_provider VARCHAR(50),
    jurisdiction VARCHAR(10),
    last_checked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_compliance_address ON compliance_records(address);

-- Compliance check logs
CREATE TABLE compliance_check_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(42) NOT NULL,
    check_type VARCHAR(50) NOT NULL,
    provider VARCHAR(50),
    result JSONB NOT NULL,
    passed BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocked addresses
CREATE TABLE blocked_addresses (
    address VARCHAR(42) PRIMARY KEY,
    reason TEXT NOT NULL,
    blocked_by UUID REFERENCES users(id),
    blocked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- MONITORING TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Oracle data snapshots
CREATE TABLE oracle_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER REFERENCES chains(id),
    oracle_address VARCHAR(42) NOT NULL,
    round_id NUMERIC(78, 0) NOT NULL,
    backing_value NUMERIC(78, 0) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    block_number BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_snapshots_chain_time ON oracle_snapshots(chain_id, timestamp DESC);

-- Invariant check logs
CREATE TABLE invariant_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER REFERENCES chains(id),
    invariant_id VARCHAR(20) NOT NULL,
    passed BOOLEAN NOT NULL,
    current_value VARCHAR(78),
    threshold VARCHAR(78),
    details JSONB,
    block_number BIGINT,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invariant_checks_chain_time ON invariant_checks(chain_id, checked_at DESC);

-- Emergency events
CREATE TABLE emergency_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER REFERENCES chains(id),
    previous_level emergency_level,
    new_level emergency_level NOT NULL,
    triggered_by VARCHAR(42),
    reason TEXT,
    transaction_hash VARCHAR(66),
    block_number BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ANALYTICS TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Daily statistics
CREATE TABLE daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER REFERENCES chains(id),
    date DATE NOT NULL,
    total_supply NUMERIC(78, 0),
    total_backing NUMERIC(78, 0),
    backing_ratio NUMERIC(10, 6),
    minted_amount NUMERIC(78, 0) DEFAULT 0,
    burned_amount NUMERIC(78, 0) DEFAULT 0,
    redeemed_amount NUMERIC(78, 0) DEFAULT 0,
    bridged_in NUMERIC(78, 0) DEFAULT 0,
    bridged_out NUMERIC(78, 0) DEFAULT 0,
    unique_holders INTEGER,
    transaction_count INTEGER DEFAULT 0,
    average_tx_gas NUMERIC(78, 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain_id, date)
);

-- Holder balances (snapshot)
CREATE TABLE holder_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER REFERENCES chains(id),
    address VARCHAR(42) NOT NULL,
    balance NUMERIC(78, 0) NOT NULL,
    last_activity_at TIMESTAMPTZ,
    snapshot_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain_id, address, snapshot_at)
);

CREATE INDEX idx_holder_balances_address ON holder_balances(address);

-- ═══════════════════════════════════════════════════════════════════════════════
-- GOVERNANCE TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Governance proposals
CREATE TABLE governance_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER REFERENCES chains(id),
    proposal_id NUMERIC(78, 0) NOT NULL,
    proposer VARCHAR(42) NOT NULL,
    title VARCHAR(500),
    description TEXT,
    targets TEXT[],
    values NUMERIC(78, 0)[],
    calldatas BYTEA[],
    start_block BIGINT,
    end_block BIGINT,
    votes_for NUMERIC(78, 0) DEFAULT 0,
    votes_against NUMERIC(78, 0) DEFAULT 0,
    votes_abstain NUMERIC(78, 0) DEFAULT 0,
    status VARCHAR(20),
    transaction_hash VARCHAR(66),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    UNIQUE(chain_id, proposal_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Mint requests
CREATE INDEX idx_mint_requests_status ON mint_requests(status);
CREATE INDEX idx_mint_requests_recipient ON mint_requests(recipient);
CREATE INDEX idx_mint_requests_created ON mint_requests(created_at DESC);

-- Burn requests
CREATE INDEX idx_burn_requests_status ON burn_requests(status);
CREATE INDEX idx_burn_requests_holder ON burn_requests(holder);
CREATE INDEX idx_burn_requests_created ON burn_requests(created_at DESC);

-- Redemption requests
CREATE INDEX idx_redemption_requests_status ON redemption_requests(status);
CREATE INDEX idx_redemption_requests_holder ON redemption_requests(holder);
CREATE INDEX idx_redemption_requests_queue ON redemption_requests(queue_position)
    WHERE status = 'queued';

-- Bridge transfers
CREATE INDEX idx_bridge_transfers_status ON bridge_transfers(status);
CREATE INDEX idx_bridge_transfers_sender ON bridge_transfers(sender);
CREATE INDEX idx_bridge_transfers_created ON bridge_transfers(created_at DESC);

-- API keys
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = TRUE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS AND TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_compliance_updated_at
    BEFORE UPDATE ON compliance_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Redemption queue position trigger
CREATE OR REPLACE FUNCTION set_redemption_queue_position()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'queued' THEN
        NEW.queue_position := (
            SELECT COALESCE(MAX(queue_position), 0) + 1
            FROM redemption_requests
            WHERE chain_id = NEW.chain_id AND status = 'queued'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_queue_position
    BEFORE INSERT ON redemption_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_redemption_queue_position();

-- ═══════════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Current system status view
CREATE VIEW v_system_status AS
SELECT
    c.id AS chain_id,
    c.name AS chain_name,
    ds.total_supply,
    ds.total_backing,
    ds.backing_ratio,
    (SELECT new_level FROM emergency_events WHERE chain_id = c.id ORDER BY created_at DESC LIMIT 1) AS emergency_level,
    (SELECT COUNT(*) FROM mint_requests WHERE chain_id = c.id AND status = 'pending') AS pending_mints,
    (SELECT COUNT(*) FROM redemption_requests WHERE chain_id = c.id AND status = 'queued') AS queued_redemptions
FROM chains c
LEFT JOIN daily_stats ds ON ds.chain_id = c.id AND ds.date = CURRENT_DATE
WHERE c.is_active = TRUE;

-- Pending operations view
CREATE VIEW v_pending_operations AS
SELECT
    'mint' AS operation_type,
    id,
    chain_id,
    recipient AS address,
    amount,
    status::text,
    created_at
FROM mint_requests WHERE status IN ('pending', 'simulating', 'submitted')
UNION ALL
SELECT
    'burn' AS operation_type,
    id,
    chain_id,
    holder AS address,
    amount,
    status::text,
    created_at
FROM burn_requests WHERE status IN ('pending', 'simulating', 'submitted')
UNION ALL
SELECT
    'redemption' AS operation_type,
    id,
    chain_id,
    holder AS address,
    token_amount AS amount,
    status::text,
    created_at
FROM redemption_requests WHERE status IN ('queued', 'processing')
ORDER BY created_at;
