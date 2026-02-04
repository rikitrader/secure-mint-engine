-- Migration: 001_initial_schema
-- Description: Initial database schema for SecureMint Engine
-- Created: 2024

BEGIN;

-- Set migration version
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (version, name) VALUES (1, '001_initial_schema');

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
DO $$ BEGIN
    CREATE TYPE mint_status AS ENUM ('pending', 'simulating', 'submitted', 'confirmed', 'failed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE burn_status AS ENUM ('pending', 'simulating', 'submitted', 'confirmed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE redemption_status AS ENUM ('queued', 'processing', 'completed', 'cancelled', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE bridge_status AS ENUM ('initiated', 'source_confirmed', 'validators_signed', 'destination_pending', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE kyc_status AS ENUM ('not_verified', 'pending', 'verified', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE emergency_level AS ENUM ('normal', 'elevated', 'high', 'severe', 'critical', 'total_halt');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'operator', 'admin', 'guardian', 'superadmin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create core tables (abbreviated - full schema in schema.sql)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(42) UNIQUE NOT NULL,
    role user_role DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS chains (
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

CREATE TABLE IF NOT EXISTS mint_requests (
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
    processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS compliance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(42) NOT NULL,
    kyc_status kyc_status DEFAULT 'not_verified',
    kyc_provider VARCHAR(50),
    aml_risk_score NUMERIC(5, 4),
    sanctions_match BOOLEAN DEFAULT FALSE,
    jurisdiction VARCHAR(10),
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mint_requests_status ON mint_requests(status);
CREATE INDEX IF NOT EXISTS idx_mint_requests_recipient ON mint_requests(recipient);
CREATE INDEX IF NOT EXISTS idx_compliance_address ON compliance_records(address);

COMMIT;
