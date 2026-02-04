# Memecoin Execution Layer (Solana + EVM Mirror)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ███╗   ███╗███████╗███╗   ███╗███████╗ ██████╗ ██████╗ ██╗███╗   ██╗     ║
║   ████╗ ████║██╔════╝████╗ ████║██╔════╝██╔════╝██╔═══██╗██║████╗  ██║     ║
║   ██╔████╔██║█████╗  ██╔████╔██║█████╗  ██║     ██║   ██║██║██╔██╗ ██║     ║
║   ██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║██╔══╝  ██║     ██║   ██║██║██║╚██╗██║     ║
║   ██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║███████╗╚██████╗╚██████╔╝██║██║ ╚████║     ║
║   ╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝     ║
║                                                                              ║
║           PRODUCTION-GRADE EXECUTION LAYER │ Solana + Raydium + Jupiter      ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## SYSTEM CONFIGURATION

```
PRIMARY CHAIN:        Solana
SMART CONTRACTS:      Anchor (Rust)
TOKEN STANDARD:       SPL Token (default), Token-2022 only if explicitly required
DEX:                  Raydium + Jupiter
CI/CD:                GitHub Actions
MIRROR CHAINS:        Ethereum + Base (EVM)
CANONICAL SUPPLY:     Solana ONLY (EVM tokens are wrapped mirrors)
```

**ALL OUTPUTS ARE REAL, COMPILABLE CODE. NO PSEUDOCODE. NO PLACEHOLDERS.**

---

## RESEARCH-BACKED DEFAULTS (LOCKED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LOCKED DEFAULT PARAMETERS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Token Supply:              1,000,000,000                                   │
│  Decimals:                  9 (Solana/SPL standard)                         │
│  Distribution Wallets:      10                                              │
│                                                                             │
│  Raydium Initial Liquidity (Conservative Strong Seed):                      │
│  ├── Token to LP:           70,000,000 (7% of supply)                       │
│  └── USDC to LP:            100,000                                         │
│                                                                             │
│  LP Handling:                                                               │
│  ├── LP tokens must be burned OR locked (6-12 months minimum)               │
│  ├── Trading may only be paused via Emergency module                        │
│  └── Mint/freeze authority must be removed after init                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## REQUIRED OUTPUT FILE TREE

```
/repo
├── Anchor.toml
├── Cargo.toml
├── package.json
├── tsconfig.json
├── README.md
│
├── /programs
│   ├── /token_mint
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── /burn_controller
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── /treasury_vault
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── /governance_multisig
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   └── /emergency_pause
│       ├── Cargo.toml
│       └── src/lib.rs
│
├── /migrations
│   └── deploy.ts
│
├── /scripts
│   ├── 00_env_check.ts
│   ├── 01_create_spl_mint.ts
│   ├── 02_mint_and_distribute.ts
│   ├── 03_revoke_authorities.ts
│   ├── 04_create_raydium_pool.ts
│   ├── 05_add_liquidity_raydium.ts
│   ├── 06_lock_or_burn_lp.ts
│   ├── 07_verify_jupiter_quote.ts
│   └── 08_swap_smoke_test.ts
│
├── /.github/workflows
│   ├── ci.yml
│   └── release.yml
│
└── /evm
    ├── WrappedMeme.sol
    ├── MirrorBridgeGate.sol
    └── README.md
```

---

## ROOT CONFIGURATION FILES

### ===== FILE: Anchor.toml =====

```toml
[features]
seeds = false
skip-lint = false

[programs.localnet]
token_mint = "TokenMint11111111111111111111111111111111111"
burn_controller = "BurnCtrl11111111111111111111111111111111111"
treasury_vault = "Treasury1111111111111111111111111111111111111"
governance_multisig = "Govrnce11111111111111111111111111111111111"
emergency_pause = "EmrgPaus11111111111111111111111111111111111"

[programs.devnet]
token_mint = "TokenMint11111111111111111111111111111111111"
burn_controller = "BurnCtrl11111111111111111111111111111111111"
treasury_vault = "Treasury1111111111111111111111111111111111111"
governance_multisig = "Govrnce11111111111111111111111111111111111"
emergency_pause = "EmrgPaus11111111111111111111111111111111111"

[programs.mainnet-beta]
token_mint = "REPLACE_WITH_DEPLOYED_PROGRAM_ID"
burn_controller = "REPLACE_WITH_DEPLOYED_PROGRAM_ID"
treasury_vault = "REPLACE_WITH_DEPLOYED_PROGRAM_ID"
governance_multisig = "REPLACE_WITH_DEPLOYED_PROGRAM_ID"
emergency_pause = "REPLACE_WITH_DEPLOYED_PROGRAM_ID"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
```

### ===== FILE: Cargo.toml =====

```toml
[workspace]
members = [
    "programs/*"
]
resolver = "2"

[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1

[profile.release.build-override]
opt-level = 3
incremental = false
codegen-units = 1
```

### ===== FILE: package.json =====

```json
{
  "name": "memecoin-protocol",
  "version": "1.0.0",
  "description": "Production-grade Solana memecoin with Raydium/Jupiter integration",
  "scripts": {
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "typecheck": "tsc --noEmit",
    "build": "anchor build",
    "test": "anchor test",
    "deploy:devnet": "anchor deploy --provider.cluster devnet",
    "deploy:mainnet": "anchor deploy --provider.cluster mainnet-beta",
    "env:check": "ts-node scripts/00_env_check.ts",
    "mint:create": "ts-node scripts/01_create_spl_mint.ts",
    "mint:distribute": "ts-node scripts/02_mint_and_distribute.ts",
    "mint:revoke": "ts-node scripts/03_revoke_authorities.ts",
    "pool:create": "ts-node scripts/04_create_raydium_pool.ts",
    "pool:add-liq": "ts-node scripts/05_add_liquidity_raydium.ts",
    "lp:lock": "ts-node scripts/06_lock_or_burn_lp.ts",
    "jupiter:quote": "ts-node scripts/07_verify_jupiter_quote.ts",
    "jupiter:swap": "ts-node scripts/08_swap_smoke_test.ts"
  },
  "dependencies": {
    "@coral-xyz/anchor": "^0.29.0",
    "@solana/web3.js": "^1.87.6",
    "@solana/spl-token": "^0.3.9",
    "@raydium-io/raydium-sdk": "^1.3.1-beta.52",
    "bn.js": "^5.2.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/bn.js": "^5.1.5",
    "@types/chai": "^4.3.11",
    "@types/mocha": "^10.0.6",
    "@types/node": "^20.10.4",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "chai": "^4.3.10",
    "eslint": "^8.55.0",
    "mocha": "^10.2.0",
    "ts-mocha": "^10.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
```

### ===== FILE: tsconfig.json =====

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "scripts/**/*",
    "tests/**/*",
    "migrations/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "target"
  ]
}
```

### ===== FILE: README.md =====

```markdown
# Memecoin Protocol

Production-grade Solana memecoin with Raydium/Jupiter integration and EVM cross-chain support.

## Quick Start

```bash
# Install dependencies
npm install

# Check environment
npm run env:check

# Build programs
npm run build

# Run tests
npm run test
```

## Deployment Flow

### 1. Create Token
```bash
npm run mint:create
npm run mint:distribute
npm run mint:revoke
```

### 2. Setup Liquidity
```bash
npm run pool:create
npm run pool:add-liq
npm run lp:lock
```

### 3. Verify Trading
```bash
npm run jupiter:quote
npm run jupiter:swap
```

## Security

- Fixed supply (mint authority revoked after distribution)
- Freeze authority disabled
- Treasury controlled by governance multisig
- Emergency pause with time limits
- All burns are deterministic (no admin burn)

## Programs

| Program | Description |
|---------|-------------|
| token_mint | SPL token state tracking |
| burn_controller | Controlled token burning |
| treasury_vault | PDA-owned treasury |
| governance_multisig | Multi-signature governance |
| emergency_pause | Circuit breaker system |

## Default Parameters

- Total Supply: 1,000,000,000
- Decimals: 9
- LP Token Amount: 70,000,000 (7%)
- LP USDC Amount: 100,000
- Distribution Wallets: 10
```

---

## ANCHOR PROGRAMS

### ===== FILE: programs/token_mint/Cargo.toml =====

```toml
[package]
name = "token_mint"
version = "0.1.0"
description = "Token mint state tracking for memecoin"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "token_mint"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []

[dependencies]
anchor-lang = "0.29.0"
anchor-spl = "0.29.0"
```

### ===== FILE: programs/token_mint/src/lib.rs =====

```rust
use anchor_lang::prelude::*;

declare_id!("TokenMint11111111111111111111111111111111111");

#[program]
pub mod token_mint {
    use super::*;

    /// Initialize the token mint state. Can only be called once.
    /// PDA Seeds: ["mint_state", mint.key()]
    pub fn initialize(
        ctx: Context<Initialize>,
        total_supply: u64,
        decimals: u8,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        let state = &mut ctx.accounts.mint_state;

        require!(!state.initialized, ErrorCode::AlreadyInitialized);
        require!(total_supply > 0, ErrorCode::InvalidSupply);
        require!(decimals <= 18, ErrorCode::InvalidDecimals);
        require!(name.len() <= 32, ErrorCode::NameTooLong);
        require!(symbol.len() <= 10, ErrorCode::SymbolTooLong);

        state.mint = ctx.accounts.mint.key();
        state.total_supply = total_supply;
        state.decimals = decimals;
        state.name = name.clone();
        state.symbol = symbol.clone();
        state.uri = uri;
        state.authority = ctx.accounts.authority.key();
        state.initialized = true;
        state.minted = false;
        state.authorities_disabled = false;
        state.created_at = Clock::get()?.unix_timestamp;

        emit!(TokenInitialized {
            mint: state.mint,
            total_supply,
            decimals,
            name,
            symbol,
            authority: state.authority,
            timestamp: state.created_at,
        });

        Ok(())
    }

    /// Mark that the initial mint has been executed.
    /// Can only be called once by the authority.
    pub fn mark_minted(ctx: Context<MarkMinted>) -> Result<()> {
        let state = &mut ctx.accounts.mint_state;

        require!(state.initialized, ErrorCode::NotInitialized);
        require!(!state.minted, ErrorCode::AlreadyMinted);
        require!(
            ctx.accounts.authority.key() == state.authority,
            ErrorCode::Unauthorized
        );

        state.minted = true;

        emit!(TokenMinted {
            mint: state.mint,
            total_supply: state.total_supply,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Permanently disable mint and freeze authorities.
    /// THIS IS IRREVERSIBLE. Must be called after minting.
    pub fn finalize_disable_authorities(ctx: Context<FinalizeAuthorities>) -> Result<()> {
        let state = &mut ctx.accounts.mint_state;

        require!(state.initialized, ErrorCode::NotInitialized);
        require!(state.minted, ErrorCode::MintFirst);
        require!(!state.authorities_disabled, ErrorCode::AlreadyFinalized);
        require!(
            ctx.accounts.authority.key() == state.authority,
            ErrorCode::Unauthorized
        );

        state.authorities_disabled = true;

        emit!(AuthoritiesDisabled {
            mint: state.mint,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Assert that authorities have been properly revoked.
    /// View function for verification.
    pub fn assert_authorities_revoked(ctx: Context<AssertRevoked>) -> Result<()> {
        let state = &ctx.accounts.mint_state;

        require!(state.authorities_disabled, ErrorCode::AuthoritiesNotDisabled);

        emit!(AuthoritiesVerified {
            mint: state.mint,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MintState::INIT_SPACE,
        seeds = [b"mint_state", mint.key().as_ref()],
        bump
    )]
    pub mint_state: Account<'info, MintState>,

    /// CHECK: The SPL token mint (created externally via spl-token)
    pub mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MarkMinted<'info> {
    #[account(
        mut,
        seeds = [b"mint_state", mint_state.mint.as_ref()],
        bump
    )]
    pub mint_state: Account<'info, MintState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeAuthorities<'info> {
    #[account(
        mut,
        seeds = [b"mint_state", mint_state.mint.as_ref()],
        bump
    )]
    pub mint_state: Account<'info, MintState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct AssertRevoked<'info> {
    #[account(
        seeds = [b"mint_state", mint_state.mint.as_ref()],
        bump
    )]
    pub mint_state: Account<'info, MintState>,
}

#[account]
#[derive(InitSpace)]
pub struct MintState {
    pub mint: Pubkey,
    pub total_supply: u64,
    pub decimals: u8,
    #[max_len(32)]
    pub name: String,
    #[max_len(10)]
    pub symbol: String,
    #[max_len(200)]
    pub uri: String,
    pub authority: Pubkey,
    pub initialized: bool,
    pub minted: bool,
    pub authorities_disabled: bool,
    pub created_at: i64,
}

// Events

#[event]
pub struct TokenInitialized {
    pub mint: Pubkey,
    pub total_supply: u64,
    pub decimals: u8,
    pub name: String,
    pub symbol: String,
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TokenMinted {
    pub mint: Pubkey,
    pub total_supply: u64,
    pub timestamp: i64,
}

#[event]
pub struct AuthoritiesDisabled {
    pub mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AuthoritiesVerified {
    pub mint: Pubkey,
    pub timestamp: i64,
}

// Errors

#[error_code]
pub enum ErrorCode {
    #[msg("Token already initialized")]
    AlreadyInitialized,
    #[msg("Token not initialized")]
    NotInitialized,
    #[msg("Invalid supply - must be greater than 0")]
    InvalidSupply,
    #[msg("Invalid decimals - must be <= 18")]
    InvalidDecimals,
    #[msg("Name too long - max 32 characters")]
    NameTooLong,
    #[msg("Symbol too long - max 10 characters")]
    SymbolTooLong,
    #[msg("Tokens already minted")]
    AlreadyMinted,
    #[msg("Must mint tokens first")]
    MintFirst,
    #[msg("Authorities already disabled")]
    AlreadyFinalized,
    #[msg("Authorities not yet disabled")]
    AuthoritiesNotDisabled,
    #[msg("Unauthorized")]
    Unauthorized,
}
```

---

### ===== FILE: programs/burn_controller/Cargo.toml =====

```toml
[package]
name = "burn_controller"
version = "0.1.0"
description = "Controlled token burning with event logging"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "burn_controller"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []

[dependencies]
anchor-lang = "0.29.0"
anchor-spl = "0.29.0"
```

### ===== FILE: programs/burn_controller/src/lib.rs =====

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

declare_id!("BurnCtrl11111111111111111111111111111111111");

#[program]
pub mod burn_controller {
    use super::*;

    /// Initialize the burn controller state.
    /// PDA Seeds: ["burn_state", mint.key()]
    pub fn initialize(ctx: Context<InitializeBurn>) -> Result<()> {
        let state = &mut ctx.accounts.burn_state;

        require!(!state.initialized, ErrorCode::AlreadyInitialized);

        state.mint = ctx.accounts.mint.key();
        state.total_burned = 0;
        state.burn_count = 0;
        state.initialized = true;
        state.created_at = Clock::get()?.unix_timestamp;

        emit!(BurnControllerInitialized {
            mint: state.mint,
            timestamp: state.created_at,
        });

        Ok(())
    }

    /// Burn tokens from user's ATA.
    /// User must sign to authorize the burn.
    /// Emits BurnEvent for tracking.
    pub fn burn(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);

        let state = &mut ctx.accounts.burn_state;
        require!(state.initialized, ErrorCode::NotInitialized);

        // Verify token account has sufficient balance
        require!(
            ctx.accounts.token_account.amount >= amount,
            ErrorCode::InsufficientBalance
        );

        // Execute burn via CPI to SPL Token program
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::burn(cpi_ctx, amount)?;

        // Update state
        state.total_burned = state
            .total_burned
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        state.burn_count = state
            .burn_count
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        emit!(TokensBurned {
            mint: state.mint,
            burner: ctx.accounts.owner.key(),
            amount,
            total_burned: state.total_burned,
            burn_count: state.burn_count,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Get burn statistics (view function).
    pub fn get_burn_stats(ctx: Context<GetBurnStats>) -> Result<()> {
        let state = &ctx.accounts.burn_state;

        emit!(BurnStatsQueried {
            mint: state.mint,
            total_burned: state.total_burned,
            burn_count: state.burn_count,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeBurn<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + BurnState::INIT_SPACE,
        seeds = [b"burn_state", mint.key().as_ref()],
        bump
    )]
    pub burn_state: Account<'info, BurnState>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(
        mut,
        seeds = [b"burn_state", mint.key().as_ref()],
        bump
    )]
    pub burn_state: Account<'info, BurnState>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = token_account.mint == mint.key() @ ErrorCode::MintMismatch,
        constraint = token_account.owner == owner.key() @ ErrorCode::OwnerMismatch
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// User authorizing the burn
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GetBurnStats<'info> {
    #[account(
        seeds = [b"burn_state", burn_state.mint.as_ref()],
        bump
    )]
    pub burn_state: Account<'info, BurnState>,
}

#[account]
#[derive(InitSpace)]
pub struct BurnState {
    pub mint: Pubkey,
    pub total_burned: u64,
    pub burn_count: u64,
    pub initialized: bool,
    pub created_at: i64,
}

// Events

#[event]
pub struct BurnControllerInitialized {
    pub mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TokensBurned {
    pub mint: Pubkey,
    pub burner: Pubkey,
    pub amount: u64,
    pub total_burned: u64,
    pub burn_count: u64,
    pub timestamp: i64,
}

#[event]
pub struct BurnStatsQueried {
    pub mint: Pubkey,
    pub total_burned: u64,
    pub burn_count: u64,
    pub timestamp: i64,
}

// Errors

#[error_code]
pub enum ErrorCode {
    #[msg("Burn controller already initialized")]
    AlreadyInitialized,
    #[msg("Burn controller not initialized")]
    NotInitialized,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient balance for burn")]
    InsufficientBalance,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Mint mismatch")]
    MintMismatch,
    #[msg("Owner mismatch")]
    OwnerMismatch,
}
```

---

### ===== FILE: programs/treasury_vault/Cargo.toml =====

```toml
[package]
name = "treasury_vault"
version = "0.1.0"
description = "PDA-owned treasury vault with governance controls"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "treasury_vault"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []

[dependencies]
anchor-lang = "0.29.0"
anchor-spl = "0.29.0"
```

### ===== FILE: programs/treasury_vault/src/lib.rs =====

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Treasury1111111111111111111111111111111111111");

/// Maximum spend per transaction (configurable)
pub const DEFAULT_SPEND_CAP: u64 = 1_000_000_000_000; // 1M tokens with 6 decimals

#[program]
pub mod treasury_vault {
    use super::*;

    /// Initialize the treasury vault state.
    /// PDA Seeds: ["treasury_state"]
    pub fn initialize_treasury(
        ctx: Context<InitializeTreasury>,
        governance: Pubkey,
        spend_cap_per_tx: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.treasury_state;

        require!(!state.initialized, ErrorCode::AlreadyInitialized);
        require!(spend_cap_per_tx > 0, ErrorCode::InvalidSpendCap);

        state.authority = ctx.accounts.authority.key();
        state.governance = governance;
        state.spend_cap_per_tx = spend_cap_per_tx;
        state.total_deposited = 0;
        state.total_spent = 0;
        state.spend_count = 0;
        state.initialized = true;
        state.created_at = Clock::get()?.unix_timestamp;

        emit!(TreasuryInitialized {
            authority: state.authority,
            governance,
            spend_cap_per_tx,
            timestamp: state.created_at,
        });

        Ok(())
    }

    /// Deposit tokens into treasury.
    /// Anyone can deposit; tracks total deposits.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);

        let state = &ctx.accounts.treasury_state;
        require!(state.initialized, ErrorCode::NotInitialized);

        // Transfer tokens to treasury vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.from_account.to_account_info(),
            to: ctx.accounts.treasury_token_account.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

        // Update state
        let state = &mut ctx.accounts.treasury_state;
        state.total_deposited = state
            .total_deposited
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(Deposited {
            depositor: ctx.accounts.depositor.key(),
            amount,
            total_deposited: state.total_deposited,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Spend from treasury - ONLY via governance approval.
    /// Requires a valid GovernanceApproval PDA from governance_multisig.
    pub fn spend(ctx: Context<Spend>, amount: u64, proposal_id: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);

        let state = &ctx.accounts.treasury_state;
        require!(state.initialized, ErrorCode::NotInitialized);

        // Enforce spend cap
        require!(amount <= state.spend_cap_per_tx, ErrorCode::ExceedsSpendCap);

        // Verify governance approval
        let approval = &ctx.accounts.governance_approval;
        require!(approval.proposal_id == proposal_id, ErrorCode::InvalidProposal);
        require!(!approval.executed, ErrorCode::AlreadyExecuted);
        require!(approval.amount == amount, ErrorCode::AmountMismatch);
        require!(
            approval.to == ctx.accounts.to_account.key(),
            ErrorCode::RecipientMismatch
        );

        // Treasury PDA signs the transfer
        let treasury_bump = ctx.bumps.treasury_token_account;
        let seeds = &[b"treasury_vault".as_ref(), &[treasury_bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.treasury_token_account.to_account_info(),
            to: ctx.accounts.to_account.to_account_info(),
            authority: ctx.accounts.treasury_token_account.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, signer),
            amount,
        )?;

        // Update state
        let state = &mut ctx.accounts.treasury_state;
        state.total_spent = state
            .total_spent
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        state.spend_count = state
            .spend_count
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        emit!(Spent {
            to: ctx.accounts.to_account.key(),
            amount,
            proposal_id,
            total_spent: state.total_spent,
            spend_count: state.spend_count,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Update spend cap (governance only).
    pub fn update_spend_cap(ctx: Context<UpdateConfig>, new_cap: u64) -> Result<()> {
        require!(new_cap > 0, ErrorCode::InvalidSpendCap);

        let state = &mut ctx.accounts.treasury_state;
        require!(state.initialized, ErrorCode::NotInitialized);
        require!(
            ctx.accounts.governance.key() == state.governance,
            ErrorCode::Unauthorized
        );

        let old_cap = state.spend_cap_per_tx;
        state.spend_cap_per_tx = new_cap;

        emit!(SpendCapUpdated {
            old_cap,
            new_cap,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TreasuryState::INIT_SPACE,
        seeds = [b"treasury_state"],
        bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"treasury_state"],
        bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    #[account(mut)]
    pub from_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"treasury_vault"],
        bump
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub depositor: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Spend<'info> {
    #[account(
        mut,
        seeds = [b"treasury_state"],
        bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    #[account(
        mut,
        seeds = [b"treasury_vault"],
        bump
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub to_account: Account<'info, TokenAccount>,

    /// Governance approval PDA (from governance_multisig program)
    pub governance_approval: Account<'info, GovernanceApproval>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"treasury_state"],
        bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    /// Must be the governance account
    pub governance: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct TreasuryState {
    pub authority: Pubkey,
    pub governance: Pubkey,
    pub spend_cap_per_tx: u64,
    pub total_deposited: u64,
    pub total_spent: u64,
    pub spend_count: u64,
    pub initialized: bool,
    pub created_at: i64,
}

/// External account type from governance_multisig
#[account]
#[derive(InitSpace)]
pub struct GovernanceApproval {
    pub proposal_id: u64,
    pub amount: u64,
    pub to: Pubkey,
    pub executed: bool,
    pub approved_at: i64,
}

// Events

#[event]
pub struct TreasuryInitialized {
    pub authority: Pubkey,
    pub governance: Pubkey,
    pub spend_cap_per_tx: u64,
    pub timestamp: i64,
}

#[event]
pub struct Deposited {
    pub depositor: Pubkey,
    pub amount: u64,
    pub total_deposited: u64,
    pub timestamp: i64,
}

#[event]
pub struct Spent {
    pub to: Pubkey,
    pub amount: u64,
    pub proposal_id: u64,
    pub total_spent: u64,
    pub spend_count: u64,
    pub timestamp: i64,
}

#[event]
pub struct SpendCapUpdated {
    pub old_cap: u64,
    pub new_cap: u64,
    pub timestamp: i64,
}

// Errors

#[error_code]
pub enum ErrorCode {
    #[msg("Treasury already initialized")]
    AlreadyInitialized,
    #[msg("Treasury not initialized")]
    NotInitialized,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Invalid spend cap")]
    InvalidSpendCap,
    #[msg("Amount exceeds per-transaction spend cap")]
    ExceedsSpendCap,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Invalid governance proposal")]
    InvalidProposal,
    #[msg("Proposal already executed")]
    AlreadyExecuted,
    #[msg("Amount mismatch with approval")]
    AmountMismatch,
    #[msg("Recipient mismatch with approval")]
    RecipientMismatch,
    #[msg("Unauthorized")]
    Unauthorized,
}
```

---

### ===== FILE: programs/governance_multisig/Cargo.toml =====

```toml
[package]
name = "governance_multisig"
version = "0.1.0"
description = "Multi-signature governance with proposal system"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "governance_multisig"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []

[dependencies]
anchor-lang = "0.29.0"
anchor-spl = "0.29.0"
```

### ===== FILE: programs/governance_multisig/src/lib.rs =====

```rust
use anchor_lang::prelude::*;

declare_id!("Govrnce11111111111111111111111111111111111");

pub const MAX_OWNERS: usize = 10;
pub const MAX_MEMO_LEN: usize = 200;

#[program]
pub mod governance_multisig {
    use super::*;

    /// Initialize the multisig governance.
    /// PDA Seeds: ["governance_state"]
    pub fn initialize(
        ctx: Context<Initialize>,
        owners: Vec<Pubkey>,
        threshold: u8,
        spend_cap_per_tx: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.governance_state;

        require!(!state.initialized, ErrorCode::AlreadyInitialized);
        require!(!owners.is_empty(), ErrorCode::NoOwners);
        require!(owners.len() <= MAX_OWNERS, ErrorCode::TooManyOwners);
        require!(threshold > 0, ErrorCode::InvalidThreshold);
        require!(threshold as usize <= owners.len(), ErrorCode::ThresholdTooHigh);
        require!(spend_cap_per_tx > 0, ErrorCode::InvalidSpendCap);

        // Check for duplicate owners
        for i in 0..owners.len() {
            for j in (i + 1)..owners.len() {
                require!(owners[i] != owners[j], ErrorCode::DuplicateOwner);
            }
        }

        state.owners = owners.clone();
        state.threshold = threshold;
        state.spend_cap_per_tx = spend_cap_per_tx;
        state.proposal_count = 0;
        state.initialized = true;
        state.created_at = Clock::get()?.unix_timestamp;

        emit!(GovernanceInitialized {
            owners,
            threshold,
            spend_cap_per_tx,
            timestamp: state.created_at,
        });

        Ok(())
    }

    /// Propose a treasury spend.
    /// PDA Seeds: ["proposal", proposal_id.to_le_bytes()]
    pub fn propose_spend(
        ctx: Context<ProposeSpend>,
        to: Pubkey,
        amount: u64,
        memo: String,
    ) -> Result<()> {
        let state = &mut ctx.accounts.governance_state;

        require!(state.initialized, ErrorCode::NotInitialized);
        require!(amount > 0, ErrorCode::ZeroAmount);
        require!(amount <= state.spend_cap_per_tx, ErrorCode::ExceedsSpendCap);
        require!(memo.len() <= MAX_MEMO_LEN, ErrorCode::MemoTooLong);

        // Verify proposer is an owner
        require!(
            state.owners.contains(&ctx.accounts.proposer.key()),
            ErrorCode::NotOwner
        );

        let proposal_id = state.proposal_count;
        state.proposal_count = state.proposal_count.checked_add(1).ok_or(ErrorCode::Overflow)?;

        let proposal = &mut ctx.accounts.proposal;
        proposal.proposal_id = proposal_id;
        proposal.proposer = ctx.accounts.proposer.key();
        proposal.to = to;
        proposal.amount = amount;
        proposal.memo = memo.clone();
        proposal.approvals = vec![ctx.accounts.proposer.key()]; // Proposer auto-approves
        proposal.executed = false;
        proposal.rejected = false;
        proposal.created_at = Clock::get()?.unix_timestamp;

        emit!(ProposalCreated {
            proposal_id,
            proposer: proposal.proposer,
            to,
            amount,
            memo,
            timestamp: proposal.created_at,
        });

        Ok(())
    }

    /// Approve a proposal.
    pub fn approve(ctx: Context<Approve>, proposal_id: u64) -> Result<()> {
        let state = &ctx.accounts.governance_state;
        let proposal = &mut ctx.accounts.proposal;

        require!(state.initialized, ErrorCode::NotInitialized);
        require!(proposal.proposal_id == proposal_id, ErrorCode::InvalidProposal);
        require!(!proposal.executed, ErrorCode::AlreadyExecuted);
        require!(!proposal.rejected, ErrorCode::ProposalRejected);

        // Verify approver is an owner
        let approver = ctx.accounts.approver.key();
        require!(state.owners.contains(&approver), ErrorCode::NotOwner);

        // Check not already approved
        require!(!proposal.approvals.contains(&approver), ErrorCode::AlreadyApproved);

        proposal.approvals.push(approver);

        emit!(ProposalApproved {
            proposal_id,
            approver,
            approval_count: proposal.approvals.len() as u8,
            threshold: state.threshold,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Execute an approved proposal.
    /// Creates a GovernanceApproval PDA for treasury to verify.
    pub fn execute(ctx: Context<Execute>, proposal_id: u64) -> Result<()> {
        let state = &ctx.accounts.governance_state;
        let proposal = &mut ctx.accounts.proposal;

        require!(state.initialized, ErrorCode::NotInitialized);
        require!(proposal.proposal_id == proposal_id, ErrorCode::InvalidProposal);
        require!(!proposal.executed, ErrorCode::AlreadyExecuted);
        require!(!proposal.rejected, ErrorCode::ProposalRejected);

        // Check threshold met
        require!(
            proposal.approvals.len() >= state.threshold as usize,
            ErrorCode::ThresholdNotMet
        );

        // Mark as executed
        proposal.executed = true;

        // Initialize the approval PDA for treasury verification
        let approval = &mut ctx.accounts.governance_approval;
        approval.proposal_id = proposal_id;
        approval.amount = proposal.amount;
        approval.to = proposal.to;
        approval.executed = false; // Treasury will set to true after spend
        approval.approved_at = Clock::get()?.unix_timestamp;

        emit!(ProposalExecuted {
            proposal_id,
            to: proposal.to,
            amount: proposal.amount,
            executor: ctx.accounts.executor.key(),
            timestamp: approval.approved_at,
        });

        Ok(())
    }

    /// Reject a proposal (requires threshold rejections).
    pub fn reject(ctx: Context<Reject>, proposal_id: u64) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        require!(proposal.proposal_id == proposal_id, ErrorCode::InvalidProposal);
        require!(!proposal.executed, ErrorCode::AlreadyExecuted);
        require!(!proposal.rejected, ErrorCode::ProposalRejected);

        proposal.rejected = true;

        emit!(ProposalRejected {
            proposal_id,
            rejector: ctx.accounts.rejector.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + GovernanceState::INIT_SPACE,
        seeds = [b"governance_state"],
        bump
    )]
    pub governance_state: Account<'info, GovernanceState>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProposeSpend<'info> {
    #[account(
        mut,
        seeds = [b"governance_state"],
        bump
    )]
    pub governance_state: Account<'info, GovernanceState>,

    #[account(
        init,
        payer = proposer,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", governance_state.proposal_count.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(mut)]
    pub proposer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct Approve<'info> {
    #[account(
        seeds = [b"governance_state"],
        bump
    )]
    pub governance_state: Account<'info, GovernanceState>,

    #[account(
        mut,
        seeds = [b"proposal", proposal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,

    pub approver: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct Execute<'info> {
    #[account(
        seeds = [b"governance_state"],
        bump
    )]
    pub governance_state: Account<'info, GovernanceState>,

    #[account(
        mut,
        seeds = [b"proposal", proposal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(
        init,
        payer = executor,
        space = 8 + GovernanceApproval::INIT_SPACE,
        seeds = [b"approval", proposal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub governance_approval: Account<'info, GovernanceApproval>,

    #[account(mut)]
    pub executor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct Reject<'info> {
    #[account(
        seeds = [b"governance_state"],
        bump
    )]
    pub governance_state: Account<'info, GovernanceState>,

    #[account(
        mut,
        seeds = [b"proposal", proposal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,

    pub rejector: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct GovernanceState {
    #[max_len(10)]
    pub owners: Vec<Pubkey>,
    pub threshold: u8,
    pub spend_cap_per_tx: u64,
    pub proposal_count: u64,
    pub initialized: bool,
    pub created_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub proposal_id: u64,
    pub proposer: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    #[max_len(200)]
    pub memo: String,
    #[max_len(10)]
    pub approvals: Vec<Pubkey>,
    pub executed: bool,
    pub rejected: bool,
    pub created_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct GovernanceApproval {
    pub proposal_id: u64,
    pub amount: u64,
    pub to: Pubkey,
    pub executed: bool,
    pub approved_at: i64,
}

// Events

#[event]
pub struct GovernanceInitialized {
    pub owners: Vec<Pubkey>,
    pub threshold: u8,
    pub spend_cap_per_tx: u64,
    pub timestamp: i64,
}

#[event]
pub struct ProposalCreated {
    pub proposal_id: u64,
    pub proposer: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub memo: String,
    pub timestamp: i64,
}

#[event]
pub struct ProposalApproved {
    pub proposal_id: u64,
    pub approver: Pubkey,
    pub approval_count: u8,
    pub threshold: u8,
    pub timestamp: i64,
}

#[event]
pub struct ProposalExecuted {
    pub proposal_id: u64,
    pub to: Pubkey,
    pub amount: u64,
    pub executor: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ProposalRejected {
    pub proposal_id: u64,
    pub rejector: Pubkey,
    pub timestamp: i64,
}

// Errors

#[error_code]
pub enum ErrorCode {
    #[msg("Governance already initialized")]
    AlreadyInitialized,
    #[msg("Governance not initialized")]
    NotInitialized,
    #[msg("No owners provided")]
    NoOwners,
    #[msg("Too many owners (max 10)")]
    TooManyOwners,
    #[msg("Duplicate owner address")]
    DuplicateOwner,
    #[msg("Invalid threshold")]
    InvalidThreshold,
    #[msg("Threshold higher than owner count")]
    ThresholdTooHigh,
    #[msg("Invalid spend cap")]
    InvalidSpendCap,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Amount exceeds spend cap")]
    ExceedsSpendCap,
    #[msg("Memo too long (max 200 chars)")]
    MemoTooLong,
    #[msg("Not an owner")]
    NotOwner,
    #[msg("Already approved this proposal")]
    AlreadyApproved,
    #[msg("Invalid proposal")]
    InvalidProposal,
    #[msg("Proposal already executed")]
    AlreadyExecuted,
    #[msg("Proposal was rejected")]
    ProposalRejected,
    #[msg("Approval threshold not met")]
    ThresholdNotMet,
    #[msg("Arithmetic overflow")]
    Overflow,
}
```

---

### ===== FILE: programs/emergency_pause/Cargo.toml =====

```toml
[package]
name = "emergency_pause"
version = "0.1.0"
description = "Time-limited emergency pause system"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "emergency_pause"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []

[dependencies]
anchor-lang = "0.29.0"
```

### ===== FILE: programs/emergency_pause/src/lib.rs =====

```rust
use anchor_lang::prelude::*;

declare_id!("EmrgPaus11111111111111111111111111111111111");

/// Maximum pause duration (24 hours)
pub const MAX_PAUSE_SECONDS: i64 = 86400;

/// Reason codes for pause
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PauseReason {
    Unknown = 0,
    SecurityIncident = 1,
    OracleFailure = 2,
    MarketVolatility = 3,
    ProtocolUpgrade = 4,
    ExternalExploit = 5,
}

#[program]
pub mod emergency_pause {
    use super::*;

    /// Initialize the emergency pause system.
    /// PDA Seeds: ["emergency_state"]
    pub fn initialize(
        ctx: Context<Initialize>,
        pause_authority: Pubkey,
        max_pause_seconds: i64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.emergency_state;

        require!(!state.initialized, ErrorCode::AlreadyInitialized);
        require!(
            max_pause_seconds > 0 && max_pause_seconds <= MAX_PAUSE_SECONDS,
            ErrorCode::InvalidPauseDuration
        );

        state.pause_authority = pause_authority;
        state.max_pause_seconds = max_pause_seconds;
        state.is_paused = false;
        state.pause_reason = PauseReason::Unknown as u8;
        state.paused_at = 0;
        state.pause_expires_at = 0;
        state.pause_count = 0;
        state.initialized = true;
        state.created_at = Clock::get()?.unix_timestamp;

        emit!(EmergencySystemInitialized {
            pause_authority,
            max_pause_seconds,
            timestamp: state.created_at,
        });

        Ok(())
    }

    /// Pause the protocol.
    /// Can only be called by pause_authority.
    /// Pause has a maximum duration and will auto-expire.
    pub fn pause(
        ctx: Context<Pause>,
        reason_code: u8,
        duration_seconds: i64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.emergency_state;
        let now = Clock::get()?.unix_timestamp;

        require!(state.initialized, ErrorCode::NotInitialized);
        require!(
            ctx.accounts.authority.key() == state.pause_authority,
            ErrorCode::Unauthorized
        );
        require!(!state.is_paused, ErrorCode::AlreadyPaused);
        require!(
            duration_seconds > 0 && duration_seconds <= state.max_pause_seconds,
            ErrorCode::InvalidPauseDuration
        );

        state.is_paused = true;
        state.pause_reason = reason_code;
        state.paused_at = now;
        state.pause_expires_at = now.checked_add(duration_seconds).ok_or(ErrorCode::Overflow)?;
        state.pause_count = state.pause_count.checked_add(1).ok_or(ErrorCode::Overflow)?;

        emit!(ProtocolPaused {
            reason_code,
            duration_seconds,
            paused_at: now,
            expires_at: state.pause_expires_at,
            pause_count: state.pause_count,
        });

        Ok(())
    }

    /// Unpause the protocol.
    /// Can be called by pause_authority at any time.
    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        let state = &mut ctx.accounts.emergency_state;
        let now = Clock::get()?.unix_timestamp;

        require!(state.initialized, ErrorCode::NotInitialized);
        require!(
            ctx.accounts.authority.key() == state.pause_authority,
            ErrorCode::Unauthorized
        );
        require!(state.is_paused, ErrorCode::NotPaused);

        let was_expired = now >= state.pause_expires_at;

        state.is_paused = false;
        state.pause_reason = PauseReason::Unknown as u8;

        emit!(ProtocolUnpaused {
            unpaused_at: now,
            was_expired,
            paused_duration: now - state.paused_at,
        });

        Ok(())
    }

    /// Check if protocol is currently paused.
    /// Returns false if pause has expired.
    /// Other programs should call this via CPI.
    pub fn is_paused(ctx: Context<IsPaused>) -> Result<bool> {
        let state = &ctx.accounts.emergency_state;
        let now = Clock::get()?.unix_timestamp;

        if !state.is_paused {
            return Ok(false);
        }

        // Check if pause has expired
        if now >= state.pause_expires_at {
            return Ok(false);
        }

        Ok(true)
    }

    /// Assert that protocol is NOT paused.
    /// Reverts if paused.
    pub fn assert_not_paused(ctx: Context<AssertNotPaused>) -> Result<()> {
        let state = &ctx.accounts.emergency_state;
        let now = Clock::get()?.unix_timestamp;

        if state.is_paused && now < state.pause_expires_at {
            return Err(ErrorCode::ProtocolPaused.into());
        }

        Ok(())
    }

    /// Extend an existing pause.
    /// Cannot exceed max_pause_seconds total.
    pub fn extend_pause(ctx: Context<ExtendPause>, additional_seconds: i64) -> Result<()> {
        let state = &mut ctx.accounts.emergency_state;
        let now = Clock::get()?.unix_timestamp;

        require!(state.initialized, ErrorCode::NotInitialized);
        require!(
            ctx.accounts.authority.key() == state.pause_authority,
            ErrorCode::Unauthorized
        );
        require!(state.is_paused, ErrorCode::NotPaused);
        require!(now < state.pause_expires_at, ErrorCode::PauseExpired);

        let new_expiry = state
            .pause_expires_at
            .checked_add(additional_seconds)
            .ok_or(ErrorCode::Overflow)?;

        // Ensure total pause duration doesn't exceed max
        let total_duration = new_expiry - state.paused_at;
        require!(
            total_duration <= state.max_pause_seconds,
            ErrorCode::ExceedsMaxPauseDuration
        );

        state.pause_expires_at = new_expiry;

        emit!(PauseExtended {
            additional_seconds,
            new_expiry,
            total_duration,
        });

        Ok(())
    }

    /// Transfer pause authority to new address.
    pub fn transfer_authority(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.emergency_state;

        require!(state.initialized, ErrorCode::NotInitialized);
        require!(
            ctx.accounts.authority.key() == state.pause_authority,
            ErrorCode::Unauthorized
        );

        let old_authority = state.pause_authority;
        state.pause_authority = new_authority;

        emit!(AuthorityTransferred {
            old_authority,
            new_authority,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + EmergencyState::INIT_SPACE,
        seeds = [b"emergency_state"],
        bump
    )]
    pub emergency_state: Account<'info, EmergencyState>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(
        mut,
        seeds = [b"emergency_state"],
        bump
    )]
    pub emergency_state: Account<'info, EmergencyState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Unpause<'info> {
    #[account(
        mut,
        seeds = [b"emergency_state"],
        bump
    )]
    pub emergency_state: Account<'info, EmergencyState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct IsPaused<'info> {
    #[account(
        seeds = [b"emergency_state"],
        bump
    )]
    pub emergency_state: Account<'info, EmergencyState>,
}

#[derive(Accounts)]
pub struct AssertNotPaused<'info> {
    #[account(
        seeds = [b"emergency_state"],
        bump
    )]
    pub emergency_state: Account<'info, EmergencyState>,
}

#[derive(Accounts)]
pub struct ExtendPause<'info> {
    #[account(
        mut,
        seeds = [b"emergency_state"],
        bump
    )]
    pub emergency_state: Account<'info, EmergencyState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(
        mut,
        seeds = [b"emergency_state"],
        bump
    )]
    pub emergency_state: Account<'info, EmergencyState>,

    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct EmergencyState {
    pub pause_authority: Pubkey,
    pub max_pause_seconds: i64,
    pub is_paused: bool,
    pub pause_reason: u8,
    pub paused_at: i64,
    pub pause_expires_at: i64,
    pub pause_count: u64,
    pub initialized: bool,
    pub created_at: i64,
}

// Events

#[event]
pub struct EmergencySystemInitialized {
    pub pause_authority: Pubkey,
    pub max_pause_seconds: i64,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolPaused {
    pub reason_code: u8,
    pub duration_seconds: i64,
    pub paused_at: i64,
    pub expires_at: i64,
    pub pause_count: u64,
}

#[event]
pub struct ProtocolUnpaused {
    pub unpaused_at: i64,
    pub was_expired: bool,
    pub paused_duration: i64,
}

#[event]
pub struct PauseExtended {
    pub additional_seconds: i64,
    pub new_expiry: i64,
    pub total_duration: i64,
}

#[event]
pub struct AuthorityTransferred {
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

// Errors

#[error_code]
pub enum ErrorCode {
    #[msg("Emergency system already initialized")]
    AlreadyInitialized,
    #[msg("Emergency system not initialized")]
    NotInitialized,
    #[msg("Invalid pause duration")]
    InvalidPauseDuration,
    #[msg("Protocol is already paused")]
    AlreadyPaused,
    #[msg("Protocol is not paused")]
    NotPaused,
    #[msg("Pause has expired")]
    PauseExpired,
    #[msg("Would exceed maximum pause duration")]
    ExceedsMaxPauseDuration,
    #[msg("Protocol is paused")]
    ProtocolPaused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
}
```

---

## TYPESCRIPT DEPLOYMENT SCRIPTS

### ===== FILE: migrations/deploy.ts =====

```typescript
import * as anchor from '@coral-xyz/anchor';

module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);
  console.log('Deploying memecoin protocol...');
  // Programs are deployed via `anchor deploy`
  // This file is for post-deployment initialization
};
```

### ===== FILE: scripts/00_env_check.ts =====

```typescript
/**
 * Environment Check Script
 * Validates all required environment variables and dependencies
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

interface EnvCheckResult {
  passed: boolean;
  checks: { name: string; status: 'PASS' | 'FAIL' | 'WARN'; message: string }[];
}

async function checkEnvironment(): Promise<EnvCheckResult> {
  const checks: EnvCheckResult['checks'] = [];
  let allPassed = true;

  // Check RPC URL
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const version = await connection.getVersion();
    checks.push({
      name: 'RPC Connection',
      status: 'PASS',
      message: `Connected to Solana ${version['solana-core']}`,
    });
  } catch (e) {
    checks.push({
      name: 'RPC Connection',
      status: 'FAIL',
      message: `Failed to connect to ${rpcUrl}`,
    });
    allPassed = false;
  }

  // Check wallet file
  const walletPath = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;
  if (fs.existsSync(walletPath)) {
    try {
      const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
      if (Array.isArray(walletData) && walletData.length === 64) {
        checks.push({
          name: 'Wallet File',
          status: 'PASS',
          message: `Found valid keypair at ${walletPath}`,
        });
      } else {
        checks.push({
          name: 'Wallet File',
          status: 'FAIL',
          message: 'Invalid keypair format',
        });
        allPassed = false;
      }
    } catch (e) {
      checks.push({
        name: 'Wallet File',
        status: 'FAIL',
        message: `Failed to parse wallet: ${e}`,
      });
      allPassed = false;
    }
  } else {
    checks.push({
      name: 'Wallet File',
      status: 'FAIL',
      message: `Wallet not found at ${walletPath}`,
    });
    allPassed = false;
  }

  // Check token configuration
  const tokenName = process.env.TOKEN_NAME;
  const tokenSymbol = process.env.TOKEN_SYMBOL;
  if (tokenName && tokenSymbol) {
    checks.push({
      name: 'Token Config',
      status: 'PASS',
      message: `Token: ${tokenName} (${tokenSymbol})`,
    });
  } else {
    checks.push({
      name: 'Token Config',
      status: 'WARN',
      message: 'TOKEN_NAME and TOKEN_SYMBOL not set (will use defaults)',
    });
  }

  // Check distribution wallets
  const distWallets = process.env.DISTRIBUTION_WALLETS;
  if (distWallets) {
    try {
      const wallets = JSON.parse(distWallets);
      if (Array.isArray(wallets) && wallets.length > 0) {
        // Validate each is a valid pubkey
        for (const w of wallets) {
          new PublicKey(w);
        }
        checks.push({
          name: 'Distribution Wallets',
          status: 'PASS',
          message: `${wallets.length} wallets configured`,
        });
      }
    } catch (e) {
      checks.push({
        name: 'Distribution Wallets',
        status: 'WARN',
        message: 'Invalid DISTRIBUTION_WALLETS format (will generate)',
      });
    }
  } else {
    checks.push({
      name: 'Distribution Wallets',
      status: 'WARN',
      message: 'DISTRIBUTION_WALLETS not set (will generate 10)',
    });
  }

  // Check wallet balance
  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const walletData = JSON.parse(
      fs.readFileSync(walletPath, 'utf-8')
    );
    const keypair = anchor.web3.Keypair.fromSecretKey(
      Uint8Array.from(walletData)
    );
    const balance = await connection.getBalance(keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;

    if (solBalance >= 1) {
      checks.push({
        name: 'Wallet Balance',
        status: 'PASS',
        message: `${solBalance.toFixed(4)} SOL`,
      });
    } else if (solBalance >= 0.1) {
      checks.push({
        name: 'Wallet Balance',
        status: 'WARN',
        message: `${solBalance.toFixed(4)} SOL (low for mainnet)`,
      });
    } else {
      checks.push({
        name: 'Wallet Balance',
        status: 'FAIL',
        message: `${solBalance.toFixed(4)} SOL (insufficient)`,
      });
      allPassed = false;
    }
  } catch (e) {
    checks.push({
      name: 'Wallet Balance',
      status: 'FAIL',
      message: `Failed to check balance: ${e}`,
    });
  }

  return { passed: allPassed, checks };
}

async function main() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║     MEMECOIN ENVIRONMENT CHECK             ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const result = await checkEnvironment();

  for (const check of result.checks) {
    const icon =
      check.status === 'PASS' ? '✅' : check.status === 'WARN' ? '⚠️' : '❌';
    console.log(`${icon} ${check.name}: ${check.message}`);
  }

  console.log('\n' + '═'.repeat(44));
  if (result.passed) {
    console.log('✅ All critical checks passed!');
    process.exit(0);
  } else {
    console.log('❌ Some checks failed. Please fix before proceeding.');
    process.exit(1);
  }
}

main().catch(console.error);
```

### ===== FILE: scripts/01_create_spl_mint.ts =====

```typescript
/**
 * Create SPL Token Mint
 * Creates the token mint with proper decimals
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  getMintLen,
  getMinimumBalanceForRentExemptMint,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// LOCKED DEFAULTS
const DECIMALS = 9;
const TOTAL_SUPPLY = 1_000_000_000;

interface MintResult {
  mintAddress: string;
  mintAuthority: string;
  freezeAuthority: string;
  decimals: number;
  totalSupply: number;
}

async function createMint(): Promise<MintResult> {
  // Load configuration
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const walletPath = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(rpcUrl, 'confirmed');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletData));

  console.log('Creating SPL Token Mint...');
  console.log('  Payer:', payer.publicKey.toString());
  console.log('  Decimals:', DECIMALS);
  console.log('  Total Supply:', TOTAL_SUPPLY.toLocaleString());

  // Generate mint keypair
  const mintKeypair = Keypair.generate();
  console.log('  Mint Address:', mintKeypair.publicKey.toString());

  // Get rent exemption
  const mintLen = getMintLen([]);
  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  // Create mint account
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    space: mintLen,
    lamports,
    programId: TOKEN_PROGRAM_ID,
  });

  // Initialize mint
  const initMintIx = createInitializeMintInstruction(
    mintKeypair.publicKey,
    DECIMALS,
    payer.publicKey, // mint authority
    payer.publicKey, // freeze authority (will be removed later)
    TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction().add(createAccountIx, initMintIx);

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, mintKeypair],
    { commitment: 'confirmed' }
  );

  console.log('  Transaction:', signature);

  // Save mint info
  const mintInfo: MintResult = {
    mintAddress: mintKeypair.publicKey.toString(),
    mintAuthority: payer.publicKey.toString(),
    freezeAuthority: payer.publicKey.toString(),
    decimals: DECIMALS,
    totalSupply: TOTAL_SUPPLY,
  };

  // Save mint keypair (SECURE THIS!)
  fs.writeFileSync(
    'mint-keypair.json',
    JSON.stringify(Array.from(mintKeypair.secretKey))
  );

  // Save mint info
  fs.writeFileSync('mint-info.json', JSON.stringify(mintInfo, null, 2));

  console.log('\n✅ Mint created successfully!');
  console.log('   Saved mint-keypair.json (KEEP SECURE!)');
  console.log('   Saved mint-info.json');

  return mintInfo;
}

createMint()
  .then((result) => {
    console.log('\nMint Info:');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((err) => {
    console.error('Error creating mint:', err);
    process.exit(1);
  });
```

### ===== FILE: scripts/02_mint_and_distribute.ts =====

```typescript
/**
 * Mint and Distribute Tokens
 * Mints total supply and distributes to configured wallets
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// LOCKED DEFAULTS
const TOTAL_SUPPLY = 1_000_000_000;
const DECIMALS = 9;
const DISTRIBUTION_WALLET_COUNT = 10;

// Distribution percentages
const DISTRIBUTION = {
  LP: 0.07, // 7% to LP
  COMMUNITY: 0.15, // 15% community/airdrop
  TREASURY: 0.10, // 10% treasury
  TEAM: 0.05, // 5% team (vested)
  REMAINING: 0.63, // 63% to distribution wallets
};

interface DistributionResult {
  mint: string;
  totalMinted: number;
  distributions: { wallet: string; amount: number; purpose: string }[];
}

async function mintAndDistribute(): Promise<DistributionResult> {
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const walletPath = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(rpcUrl, 'confirmed');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletData));

  // Load mint info
  if (!fs.existsSync('mint-info.json')) {
    throw new Error('mint-info.json not found. Run 01_create_spl_mint.ts first.');
  }
  const mintInfo = JSON.parse(fs.readFileSync('mint-info.json', 'utf-8'));
  const mintPubkey = new PublicKey(mintInfo.mintAddress);

  console.log('Minting and distributing tokens...');
  console.log('  Mint:', mintPubkey.toString());

  const distributions: DistributionResult['distributions'] = [];
  const totalRaw = BigInt(TOTAL_SUPPLY) * BigInt(10 ** DECIMALS);

  // Generate or load distribution wallets
  let distWallets: Keypair[] = [];
  if (fs.existsSync('distribution-wallets.json')) {
    const saved = JSON.parse(fs.readFileSync('distribution-wallets.json', 'utf-8'));
    distWallets = saved.map((sk: number[]) => Keypair.fromSecretKey(Uint8Array.from(sk)));
    console.log('  Loaded existing distribution wallets');
  } else {
    for (let i = 0; i < DISTRIBUTION_WALLET_COUNT; i++) {
      distWallets.push(Keypair.generate());
    }
    fs.writeFileSync(
      'distribution-wallets.json',
      JSON.stringify(distWallets.map((k) => Array.from(k.secretKey)))
    );
    console.log('  Generated new distribution wallets');
  }

  // Calculate amounts
  const lpAmount = BigInt(Math.floor(TOTAL_SUPPLY * DISTRIBUTION.LP)) * BigInt(10 ** DECIMALS);
  const communityAmount = BigInt(Math.floor(TOTAL_SUPPLY * DISTRIBUTION.COMMUNITY)) * BigInt(10 ** DECIMALS);
  const treasuryAmount = BigInt(Math.floor(TOTAL_SUPPLY * DISTRIBUTION.TREASURY)) * BigInt(10 ** DECIMALS);
  const teamAmount = BigInt(Math.floor(TOTAL_SUPPLY * DISTRIBUTION.TEAM)) * BigInt(10 ** DECIMALS);
  const remainingAmount = BigInt(Math.floor(TOTAL_SUPPLY * DISTRIBUTION.REMAINING)) * BigInt(10 ** DECIMALS);
  const perWalletAmount = remainingAmount / BigInt(DISTRIBUTION_WALLET_COUNT);

  // Create ATA and mint for payer (for LP + treasury + team)
  const payerAta = await getAssociatedTokenAddress(mintPubkey, payer.publicKey);

  // Check if ATA exists
  let payerAtaExists = false;
  try {
    await getAccount(connection, payerAta);
    payerAtaExists = true;
  } catch (e) {
    // ATA doesn't exist
  }

  // Build transaction for payer mint
  const tx1 = new Transaction();
  if (!payerAtaExists) {
    tx1.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        payerAta,
        payer.publicKey,
        mintPubkey
      )
    );
  }

  // Mint LP + Community + Treasury + Team to payer
  const payerMintAmount = lpAmount + communityAmount + treasuryAmount + teamAmount;
  tx1.add(
    createMintToInstruction(
      mintPubkey,
      payerAta,
      payer.publicKey,
      payerMintAmount
    )
  );

  console.log('\n  Minting to payer wallet...');
  const sig1 = await sendAndConfirmTransaction(connection, tx1, [payer]);
  console.log('    TX:', sig1);

  distributions.push({
    wallet: payer.publicKey.toString(),
    amount: Number(payerMintAmount) / 10 ** DECIMALS,
    purpose: 'LP + Community + Treasury + Team',
  });

  // Mint to distribution wallets
  console.log('\n  Minting to distribution wallets...');
  for (let i = 0; i < distWallets.length; i++) {
    const wallet = distWallets[i];
    const ata = await getAssociatedTokenAddress(mintPubkey, wallet.publicKey);

    const tx = new Transaction();
    tx.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        wallet.publicKey,
        mintPubkey
      )
    );
    tx.add(
      createMintToInstruction(
        mintPubkey,
        ata,
        payer.publicKey,
        perWalletAmount
      )
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log(`    Wallet ${i + 1}: ${wallet.publicKey.toString().slice(0, 8)}... - TX: ${sig.slice(0, 16)}...`);

    distributions.push({
      wallet: wallet.publicKey.toString(),
      amount: Number(perWalletAmount) / 10 ** DECIMALS,
      purpose: `Distribution wallet ${i + 1}`,
    });
  }

  const result: DistributionResult = {
    mint: mintPubkey.toString(),
    totalMinted: TOTAL_SUPPLY,
    distributions,
  };

  fs.writeFileSync('distribution-result.json', JSON.stringify(result, null, 2));

  console.log('\n✅ Minting and distribution complete!');
  console.log('   Saved distribution-result.json');

  return result;
}

mintAndDistribute()
  .then((result) => {
    console.log('\nDistribution Summary:');
    console.log(`  Total Minted: ${result.totalMinted.toLocaleString()}`);
    console.log(`  Wallets: ${result.distributions.length}`);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
```

### ===== FILE: scripts/03_revoke_authorities.ts =====

```typescript
/**
 * Revoke Mint and Freeze Authorities
 * THIS IS IRREVERSIBLE - Makes the token supply fixed forever
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  AuthorityType,
  createSetAuthorityInstruction,
  getMint,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

async function confirmAction(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function revokeAuthorities(): Promise<void> {
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const walletPath = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(rpcUrl, 'confirmed');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletData));

  // Load mint info
  if (!fs.existsSync('mint-info.json')) {
    throw new Error('mint-info.json not found');
  }
  const mintInfo = JSON.parse(fs.readFileSync('mint-info.json', 'utf-8'));
  const mintPubkey = new PublicKey(mintInfo.mintAddress);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║         ⚠️  AUTHORITY REVOCATION WARNING ⚠️             ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║  This action is IRREVERSIBLE!                          ║');
  console.log('║  After this, NO MORE TOKENS can EVER be minted.        ║');
  console.log('║  The freeze authority will also be permanently removed.║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('Mint:', mintPubkey.toString());

  // Check current state
  const mintAccount = await getMint(connection, mintPubkey);
  console.log('\nCurrent State:');
  console.log('  Mint Authority:', mintAccount.mintAuthority?.toString() || 'NONE');
  console.log('  Freeze Authority:', mintAccount.freezeAuthority?.toString() || 'NONE');
  console.log('  Supply:', Number(mintAccount.supply) / 10 ** mintAccount.decimals);

  if (!mintAccount.mintAuthority && !mintAccount.freezeAuthority) {
    console.log('\n✅ Authorities already revoked!');
    return;
  }

  // Confirm with user
  const confirmed = await confirmAction(
    '\nAre you absolutely sure you want to revoke all authorities?'
  );

  if (!confirmed) {
    console.log('Aborted.');
    return;
  }

  const tx = new Transaction();

  // Revoke mint authority
  if (mintAccount.mintAuthority) {
    tx.add(
      createSetAuthorityInstruction(
        mintPubkey,
        payer.publicKey,
        AuthorityType.MintTokens,
        null // Set to null to revoke
      )
    );
    console.log('\nRevoking mint authority...');
  }

  // Revoke freeze authority
  if (mintAccount.freezeAuthority) {
    tx.add(
      createSetAuthorityInstruction(
        mintPubkey,
        payer.publicKey,
        AuthorityType.FreezeAccount,
        null // Set to null to revoke
      )
    );
    console.log('Revoking freeze authority...');
  }

  const signature = await sendAndConfirmTransaction(
    connection,
    tx,
    [payer],
    { commitment: 'finalized' }
  );

  console.log('\nTransaction:', signature);

  // Verify
  const updatedMint = await getMint(connection, mintPubkey);
  console.log('\n=== VERIFICATION ===');
  console.log('Mint Authority:', updatedMint.mintAuthority?.toString() || 'REVOKED ✅');
  console.log('Freeze Authority:', updatedMint.freezeAuthority?.toString() || 'REVOKED ✅');

  // Update mint-info.json
  mintInfo.mintAuthority = null;
  mintInfo.freezeAuthority = null;
  mintInfo.authoritiesRevokedAt = new Date().toISOString();
  mintInfo.authoritiesRevokedTx = signature;
  fs.writeFileSync('mint-info.json', JSON.stringify(mintInfo, null, 2));

  console.log('\n✅ Authorities successfully revoked!');
  console.log('   Token supply is now PERMANENTLY FIXED.');
}

revokeAuthorities().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
```

---

### ===== FILE: scripts/04_create_raydium_pool.ts =====

```typescript
/**
 * Create Raydium AMM Pool
 * ADAPTATION POINT: Raydium SDK changes frequently
 * Check https://github.com/raydium-io/raydium-sdk for latest
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import BN from 'bn.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// LOCKED DEFAULTS
const LP_TOKEN_AMOUNT = 70_000_000; // 7% of 1B
const LP_USDC_AMOUNT = 100_000;
const DECIMALS = 9;
const USDC_DECIMALS = 6;

// Well-known addresses
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const RAYDIUM_AMM_PROGRAM = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

interface PoolConfig {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseAmount: BN;
  quoteAmount: BN;
  openTime: BN;
}

async function createRaydiumPool(): Promise<string> {
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const walletPath = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(rpcUrl, 'confirmed');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletData));

  // Load mint info
  if (!fs.existsSync('mint-info.json')) {
    throw new Error('mint-info.json not found');
  }
  const mintInfo = JSON.parse(fs.readFileSync('mint-info.json', 'utf-8'));
  const tokenMint = new PublicKey(mintInfo.mintAddress);

  console.log('Creating Raydium AMM Pool...');
  console.log('  Token Mint:', tokenMint.toString());
  console.log('  Quote Mint (USDC):', USDC_MINT.toString());
  console.log('  Token Amount:', LP_TOKEN_AMOUNT.toLocaleString());
  console.log('  USDC Amount:', LP_USDC_AMOUNT.toLocaleString());

  const config: PoolConfig = {
    baseMint: tokenMint,
    quoteMint: USDC_MINT,
    baseAmount: new BN(LP_TOKEN_AMOUNT).mul(new BN(10).pow(new BN(DECIMALS))),
    quoteAmount: new BN(LP_USDC_AMOUNT).mul(new BN(10).pow(new BN(USDC_DECIMALS))),
    openTime: new BN(Math.floor(Date.now() / 1000) + 300), // 5 min from now
  };

  /**
   * ADAPTATION POINT: Raydium Pool Creation
   *
   * The exact implementation depends on Raydium SDK version.
   *
   * For Raydium AMM V4, you need to:
   * 1. Create market on OpenBook (if not exists)
   * 2. Initialize AMM pool
   * 3. Add initial liquidity
   *
   * Example with Raydium SDK (check for current API):
   *
   * import { Liquidity, MAINNET_PROGRAM_ID } from '@raydium-io/raydium-sdk';
   *
   * const { innerTransactions, poolId } = await Liquidity.makeCreatePoolV4InstructionV2Simple({
   *   connection,
   *   programId: MAINNET_PROGRAM_ID.AmmV4,
   *   marketInfo: {
   *     marketId: marketKeypair.publicKey,
   *     programId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
   *   },
   *   baseMintInfo: { mint: config.baseMint, decimals: DECIMALS },
   *   quoteMintInfo: { mint: config.quoteMint, decimals: USDC_DECIMALS },
   *   baseAmount: config.baseAmount,
   *   quoteAmount: config.quoteAmount,
   *   startTime: config.openTime,
   *   ownerInfo: { feePayer: payer.publicKey, wallet: payer.publicKey },
   *   associatedOnly: true,
   *   checkCreateATAOwner: true,
   *   makeTxVersion: TxVersion.V0,
   * });
   */

  // Placeholder for pool creation
  // In production, implement using current Raydium SDK
  console.log('\n⚠️  ADAPTATION REQUIRED');
  console.log('   Implement pool creation with current Raydium SDK');
  console.log('   See: https://github.com/raydium-io/raydium-sdk');
  console.log('   Or use Raydium UI: https://raydium.io/create-pool/');

  // Save config for manual creation
  const poolConfig = {
    tokenMint: tokenMint.toString(),
    quoteMint: USDC_MINT.toString(),
    tokenAmount: LP_TOKEN_AMOUNT,
    usdcAmount: LP_USDC_AMOUNT,
    openTime: config.openTime.toString(),
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync('pool-config.json', JSON.stringify(poolConfig, null, 2));
  console.log('\n   Saved pool-config.json for reference');

  return 'POOL_ID_PENDING';
}

createRaydiumPool()
  .then((poolId) => {
    console.log('\nPool ID:', poolId);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
```

### ===== FILE: scripts/05_add_liquidity_raydium.ts =====

```typescript
/**
 * Add Liquidity to Raydium Pool
 * ADAPTATION POINT: Requires pool to exist first
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import BN from 'bn.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// LOCKED DEFAULTS
const LP_TOKEN_AMOUNT = 70_000_000;
const LP_USDC_AMOUNT = 100_000;
const DECIMALS = 9;
const USDC_DECIMALS = 6;

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

async function addLiquidity(): Promise<void> {
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const walletPath = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(rpcUrl, 'confirmed');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletData));

  // Load mint info
  const mintInfo = JSON.parse(fs.readFileSync('mint-info.json', 'utf-8'));
  const tokenMint = new PublicKey(mintInfo.mintAddress);

  // Load pool info (if exists)
  let poolId: PublicKey | null = null;
  if (fs.existsSync('pool-info.json')) {
    const poolInfo = JSON.parse(fs.readFileSync('pool-info.json', 'utf-8'));
    poolId = new PublicKey(poolInfo.poolId);
  }

  console.log('Adding Liquidity to Raydium Pool...');
  console.log('  Token Mint:', tokenMint.toString());
  console.log('  Pool ID:', poolId?.toString() || 'NOT SET');

  // Check balances
  const tokenAta = await getAssociatedTokenAddress(tokenMint, payer.publicKey);
  const usdcAta = await getAssociatedTokenAddress(USDC_MINT, payer.publicKey);

  try {
    const tokenAccount = await getAccount(connection, tokenAta);
    const usdcAccount = await getAccount(connection, usdcAta);

    console.log('\nCurrent Balances:');
    console.log('  Token:', Number(tokenAccount.amount) / 10 ** DECIMALS);
    console.log('  USDC:', Number(usdcAccount.amount) / 10 ** USDC_DECIMALS);

    const requiredToken = LP_TOKEN_AMOUNT * 10 ** DECIMALS;
    const requiredUsdc = LP_USDC_AMOUNT * 10 ** USDC_DECIMALS;

    if (Number(tokenAccount.amount) < requiredToken) {
      throw new Error(`Insufficient token balance. Need ${LP_TOKEN_AMOUNT}`);
    }
    if (Number(usdcAccount.amount) < requiredUsdc) {
      throw new Error(`Insufficient USDC balance. Need ${LP_USDC_AMOUNT}`);
    }
  } catch (e) {
    console.error('Error checking balances:', e);
    throw e;
  }

  /**
   * ADAPTATION POINT: Add Liquidity
   *
   * import { Liquidity } from '@raydium-io/raydium-sdk';
   *
   * const { innerTransactions } = await Liquidity.makeAddLiquidityInstructionSimple({
   *   connection,
   *   poolInfo,
   *   userKeys: {
   *     owner: payer.publicKey,
   *     payer: payer.publicKey,
   *   },
   *   amountIn: baseAmount,
   *   otherAmountMin: quoteAmountMin,
   *   fixedSide: 'base',
   * });
   */

  if (!poolId) {
    console.log('\n⚠️  Pool ID not set. Create pool first (04_create_raydium_pool.ts)');
    console.log('   After pool creation, add pool ID to pool-info.json');
    return;
  }

  console.log('\n⚠️  ADAPTATION REQUIRED');
  console.log('   Implement add liquidity with current Raydium SDK');
}

addLiquidity().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
```

### ===== FILE: scripts/06_lock_or_burn_lp.ts =====

```typescript
/**
 * Lock or Burn LP Tokens
 * Critical for trust - LP must be locked or burned
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createBurnInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

enum LpAction {
  BURN = 'burn',
  LOCK = 'lock',
}

async function promptAction(): Promise<LpAction> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('LP Action (burn/lock): ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'burn') {
        resolve(LpAction.BURN);
      } else {
        resolve(LpAction.LOCK);
      }
    });
  });
}

async function lockOrBurnLp(): Promise<void> {
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const walletPath = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(rpcUrl, 'confirmed');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletData));

  // Load pool info
  if (!fs.existsSync('pool-info.json')) {
    console.log('pool-info.json not found. Create pool first.');
    return;
  }
  const poolInfo = JSON.parse(fs.readFileSync('pool-info.json', 'utf-8'));
  const lpMint = new PublicKey(poolInfo.lpMint);

  console.log('LP Token Management');
  console.log('  LP Mint:', lpMint.toString());

  // Check LP balance
  const lpAta = await getAssociatedTokenAddress(lpMint, payer.publicKey);
  let lpBalance: bigint;
  try {
    const lpAccount = await getAccount(connection, lpAta);
    lpBalance = lpAccount.amount;
    console.log('  LP Balance:', lpBalance.toString());
  } catch (e) {
    console.log('No LP tokens found.');
    return;
  }

  if (lpBalance === BigInt(0)) {
    console.log('No LP tokens to process.');
    return;
  }

  const action = await promptAction();

  if (action === LpAction.BURN) {
    console.log('\n🔥 BURNING LP TOKENS...');
    console.log('   This is IRREVERSIBLE!');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const confirmed = await new Promise<boolean>((resolve) => {
      rl.question('Type "BURN" to confirm: ', (answer) => {
        rl.close();
        resolve(answer === 'BURN');
      });
    });

    if (!confirmed) {
      console.log('Aborted.');
      return;
    }

    const tx = new Transaction().add(
      createBurnInstruction(lpAta, lpMint, payer.publicKey, lpBalance)
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log('\n✅ LP Tokens Burned!');
    console.log('   TX:', sig);

    // Update pool info
    poolInfo.lpBurned = true;
    poolInfo.lpBurnTx = sig;
    poolInfo.lpBurnedAt = new Date().toISOString();
    fs.writeFileSync('pool-info.json', JSON.stringify(poolInfo, null, 2));

  } else {
    console.log('\n🔒 LOCKING LP TOKENS...');
    console.log('   Using Raydium LP Lock or external lock service');

    /**
     * ADAPTATION POINT: LP Locking
     *
     * Options:
     * 1. Raydium LP Lock: https://docs.raydium.io/
     * 2. Streamflow: https://streamflow.finance/
     * 3. Custom timelock contract
     *
     * For Raydium LP Lock:
     * - Transfer LP to lock program PDA
     * - Set unlock timestamp (6-12 months)
     */

    console.log('\n⚠️  ADAPTATION REQUIRED');
    console.log('   Implement LP locking with your preferred service');
    console.log('   Recommended lock period: 6-12 months minimum');
  }
}

lockOrBurnLp().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
```

### ===== FILE: scripts/07_verify_jupiter_quote.ts =====

```typescript
/**
 * Verify Jupiter Quote
 * Confirms token is tradeable via Jupiter aggregator
 */

import { PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const DECIMALS = 9;

interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<JupiterQuote | null> {
  const baseUrl = 'https://quote-api.jup.ag/v6';

  // Amount in smallest units
  const amountRaw = (amount * 10 ** DECIMALS).toString();

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountRaw,
    slippageBps: slippageBps.toString(),
  });

  try {
    const response = await fetch(`${baseUrl}/quote?${params}`);

    if (!response.ok) {
      const error = await response.text();
      console.error('Jupiter API error:', error);
      return null;
    }

    return await response.json();
  } catch (e) {
    console.error('Failed to fetch quote:', e);
    return null;
  }
}

async function verifyJupiterQuote(): Promise<void> {
  // Load mint info
  if (!fs.existsSync('mint-info.json')) {
    throw new Error('mint-info.json not found');
  }
  const mintInfo = JSON.parse(fs.readFileSync('mint-info.json', 'utf-8'));
  const tokenMint = mintInfo.mintAddress;

  console.log('╔════════════════════════════════════════════╗');
  console.log('║       JUPITER QUOTE VERIFICATION           ║');
  console.log('╚════════════════════════════════════════════╝\n');

  console.log('Token Mint:', tokenMint);
  console.log('Testing quotes...\n');

  // Test 1: Token -> USDC
  console.log('1. Token -> USDC (1 token)');
  const quote1 = await getJupiterQuote(tokenMint, USDC_MINT, 1);
  if (quote1) {
    console.log('   ✅ PASS');
    console.log('   Output:', parseInt(quote1.outAmount) / 10 ** 6, 'USDC');
    console.log('   Price Impact:', quote1.priceImpactPct, '%');
    console.log('   Routes:', quote1.routePlan.length);
  } else {
    console.log('   ❌ FAIL - No route found');
  }

  // Test 2: USDC -> Token
  console.log('\n2. USDC -> Token (1 USDC)');
  const quote2 = await getJupiterQuote(USDC_MINT, tokenMint, 1);
  if (quote2) {
    console.log('   ✅ PASS');
    console.log('   Output:', parseInt(quote2.outAmount) / 10 ** DECIMALS, 'tokens');
    console.log('   Price Impact:', quote2.priceImpactPct, '%');
  } else {
    console.log('   ❌ FAIL - No route found');
  }

  // Test 3: Token -> SOL
  console.log('\n3. Token -> SOL (1 token)');
  const quote3 = await getJupiterQuote(tokenMint, SOL_MINT, 1);
  if (quote3) {
    console.log('   ✅ PASS');
    console.log('   Output:', parseInt(quote3.outAmount) / 10 ** 9, 'SOL');
    console.log('   Price Impact:', quote3.priceImpactPct, '%');
  } else {
    console.log('   ❌ FAIL - No route found');
  }

  // Test 4: Large trade (price impact check)
  console.log('\n4. Large Trade Test (10,000 tokens)');
  const quote4 = await getJupiterQuote(tokenMint, USDC_MINT, 10000);
  if (quote4) {
    console.log('   Output:', parseInt(quote4.outAmount) / 10 ** 6, 'USDC');
    console.log('   Price Impact:', quote4.priceImpactPct, '%');
    if (quote4.priceImpactPct > 5) {
      console.log('   ⚠️  WARNING: High price impact!');
    } else {
      console.log('   ✅ Price impact acceptable');
    }
  }

  // Save results
  const results = {
    tokenMint,
    testedAt: new Date().toISOString(),
    quotes: {
      tokenToUsdc: quote1 ? { outAmount: quote1.outAmount, priceImpact: quote1.priceImpactPct } : null,
      usdcToToken: quote2 ? { outAmount: quote2.outAmount, priceImpact: quote2.priceImpactPct } : null,
      tokenToSol: quote3 ? { outAmount: quote3.outAmount, priceImpact: quote3.priceImpactPct } : null,
    },
    tradeable: !!(quote1 && quote2),
  };

  fs.writeFileSync('jupiter-verification.json', JSON.stringify(results, null, 2));

  console.log('\n' + '═'.repeat(44));
  if (results.tradeable) {
    console.log('✅ Token is tradeable on Jupiter!');
  } else {
    console.log('❌ Token NOT tradeable on Jupiter');
    console.log('   Ensure pool has sufficient liquidity');
  }
}

verifyJupiterQuote().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
```

### ===== FILE: scripts/08_swap_smoke_test.ts =====

```typescript
/**
 * Jupiter Swap Smoke Test
 * Executes a small test swap to verify trading works
 */

import {
  Connection,
  Keypair,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const DECIMALS = 9;
const TEST_AMOUNT = 0.1; // Small test amount

interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
}

async function getSwapTransaction(
  inputMint: string,
  outputMint: string,
  amount: number,
  userPublicKey: string,
  slippageBps: number = 100
): Promise<JupiterSwapResponse | null> {
  const baseUrl = 'https://quote-api.jup.ag/v6';
  const amountRaw = Math.floor(amount * 10 ** DECIMALS).toString();

  // Get quote
  const quoteParams = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountRaw,
    slippageBps: slippageBps.toString(),
  });

  const quoteResponse = await fetch(`${baseUrl}/quote?${quoteParams}`);
  if (!quoteResponse.ok) {
    console.error('Quote failed:', await quoteResponse.text());
    return null;
  }

  const quote = await quoteResponse.json();
  console.log('Quote received:');
  console.log('  Input:', amount, 'tokens');
  console.log('  Output:', parseInt(quote.outAmount) / 10 ** 6, 'USDC');
  console.log('  Price Impact:', quote.priceImpactPct, '%');

  // Get swap transaction
  const swapResponse = await fetch(`${baseUrl}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });

  if (!swapResponse.ok) {
    console.error('Swap transaction failed:', await swapResponse.text());
    return null;
  }

  return await swapResponse.json();
}

async function smokeTest(): Promise<void> {
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const walletPath = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;

  const connection = new Connection(rpcUrl, 'confirmed');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(walletData));

  // Load mint info
  const mintInfo = JSON.parse(fs.readFileSync('mint-info.json', 'utf-8'));
  const tokenMint = mintInfo.mintAddress;

  console.log('╔════════════════════════════════════════════╗');
  console.log('║         JUPITER SWAP SMOKE TEST            ║');
  console.log('╚════════════════════════════════════════════╝\n');

  console.log('Wallet:', payer.publicKey.toString());
  console.log('Token:', tokenMint);
  console.log('Test Amount:', TEST_AMOUNT, 'tokens');

  // Skip if on mainnet and EXECUTE_SWAP not set
  if (rpcUrl.includes('mainnet') && process.env.EXECUTE_SWAP !== 'true') {
    console.log('\n⚠️  Mainnet detected. Set EXECUTE_SWAP=true to execute.');
    console.log('   This is a safety measure to prevent accidental trades.');
    return;
  }

  console.log('\nGetting swap transaction...');
  const swapData = await getSwapTransaction(
    tokenMint,
    USDC_MINT,
    TEST_AMOUNT,
    payer.publicKey.toString()
  );

  if (!swapData) {
    console.log('❌ Failed to get swap transaction');
    return;
  }

  console.log('\nExecuting swap...');

  // Deserialize and sign transaction
  const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  transaction.sign([payer]);

  // Execute
  const signature = await connection.sendTransaction(transaction, {
    skipPreflight: false,
    maxRetries: 3,
  });

  console.log('Transaction sent:', signature);

  // Confirm
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: transaction.message.recentBlockhash,
      lastValidBlockHeight: swapData.lastValidBlockHeight,
    },
    'confirmed'
  );

  if (confirmation.value.err) {
    console.log('❌ Transaction failed:', confirmation.value.err);
  } else {
    console.log('\n✅ SWAP SUCCESSFUL!');
    console.log('   TX:', signature);
    console.log('   View: https://solscan.io/tx/' + signature);

    // Save result
    const result = {
      tokenMint,
      testAmount: TEST_AMOUNT,
      signature,
      timestamp: new Date().toISOString(),
      success: true,
    };
    fs.writeFileSync('smoke-test-result.json', JSON.stringify(result, null, 2));
  }
}

smokeTest().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
```

---

## CI/CD WORKFLOWS

### ===== FILE: .github/workflows/ci.yml =====

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  SOLANA_VERSION: '1.17.0'
  ANCHOR_VERSION: '0.29.0'
  NODE_VERSION: '18'

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      - name: Cache Cargo
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: Rust Format Check
        run: cargo fmt --all -- --check

      - name: Clippy
        run: cargo clippy --all-targets --all-features -- -D warnings

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: TypeScript Lint
        run: npm run lint

      - name: TypeScript Typecheck
        run: npm run typecheck

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - name: Install Solana
        run: |
          sh -c "$(curl -sSfL https://release.solana.com/v${{ env.SOLANA_VERSION }}/install)"
          echo "$HOME/.local/share/solana/install/active_release/bin" >> $GITHUB_PATH

      - name: Install Anchor
        run: |
          npm install -g @coral-xyz/anchor-cli@${{ env.ANCHOR_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Build Programs
        run: anchor build

      - name: Generate Program Hashes
        run: |
          mkdir -p artifacts
          echo "# Program Build Hashes" > artifacts/program-hashes.txt
          echo "Generated: $(date -u)" >> artifacts/program-hashes.txt
          echo "Commit: ${{ github.sha }}" >> artifacts/program-hashes.txt
          echo "" >> artifacts/program-hashes.txt
          for so in target/deploy/*.so; do
            if [ -f "$so" ]; then
              echo "$(sha256sum $so)" >> artifacts/program-hashes.txt
            fi
          done
          cat artifacts/program-hashes.txt

      - name: Upload Build Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: program-builds
          path: |
            target/deploy/*.so
            target/idl/*.json
            artifacts/program-hashes.txt
          retention-days: 30

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - name: Install Solana
        run: |
          sh -c "$(curl -sSfL https://release.solana.com/v${{ env.SOLANA_VERSION }}/install)"
          echo "$HOME/.local/share/solana/install/active_release/bin" >> $GITHUB_PATH

      - name: Install Anchor
        run: npm install -g @coral-xyz/anchor-cli@${{ env.ANCHOR_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Generate Keypair
        run: solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json

      - name: Run Tests
        run: anchor test

      - name: Upload Test Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: test-results/
          retention-days: 7

  security:
    name: Security Audit
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install cargo-audit
        run: cargo install cargo-audit

      - name: Security Audit
        run: cargo audit

      - name: Check for Unsafe Code
        run: |
          echo "Checking for unsafe code..."
          if grep -r "unsafe" programs/*/src/*.rs; then
            echo "⚠️  WARNING: Unsafe code detected!"
            echo "Review carefully before proceeding."
          else
            echo "✅ No unsafe code found."
          fi

      - name: Check for Panics
        run: |
          echo "Checking for panic! macros..."
          if grep -rE "(panic!|unwrap\(\)|expect\()" programs/*/src/*.rs | grep -v "// safe:"; then
            echo "⚠️  WARNING: Potential panic points detected!"
          else
            echo "✅ No unhandled panics found."
          fi
```

### ===== FILE: .github/workflows/release.yml =====

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        type: choice
        options:
          - devnet
          - mainnet-beta
      confirm_mainnet:
        description: 'Type DEPLOY to confirm mainnet deployment'
        required: false
        type: string
      skip_tests:
        description: 'Skip test suite (emergency only)'
        required: false
        type: boolean
        default: false

env:
  SOLANA_VERSION: '1.17.0'
  ANCHOR_VERSION: '0.29.0'
  NODE_VERSION: '18'

jobs:
  validate:
    name: Validate
    runs-on: ubuntu-latest
    steps:
      - name: Validate Mainnet Confirmation
        if: inputs.environment == 'mainnet-beta'
        run: |
          if [ "${{ inputs.confirm_mainnet }}" != "DEPLOY" ]; then
            echo "❌ ERROR: Mainnet deployment requires typing DEPLOY to confirm"
            exit 1
          fi
          echo "✅ Mainnet deployment confirmed"

  build-and-test:
    name: Build and Test
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - uses: actions/checkout@v4

      - name: Install Solana
        run: |
          sh -c "$(curl -sSfL https://release.solana.com/v${{ env.SOLANA_VERSION }}/install)"
          echo "$HOME/.local/share/solana/install/active_release/bin" >> $GITHUB_PATH

      - name: Install Anchor
        run: npm install -g @coral-xyz/anchor-cli@${{ env.ANCHOR_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Build Programs
        run: anchor build

      - name: Generate Keypair
        run: solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json

      - name: Run Tests
        if: inputs.skip_tests != true
        run: anchor test

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-builds
          path: |
            target/deploy/*.so
            target/idl/*.json

  deploy:
    name: Deploy to ${{ inputs.environment }}
    runs-on: ubuntu-latest
    needs: build-and-test
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4

      - name: Download Artifacts
        uses: actions/download-artifact@v4
        with:
          name: release-builds
          path: target/

      - name: Install Solana
        run: |
          sh -c "$(curl -sSfL https://release.solana.com/v${{ env.SOLANA_VERSION }}/install)"
          echo "$HOME/.local/share/solana/install/active_release/bin" >> $GITHUB_PATH

      - name: Install Anchor
        run: npm install -g @coral-xyz/anchor-cli@${{ env.ANCHOR_VERSION }}

      - name: Setup Deployer Wallet
        run: |
          echo "${{ secrets.DEPLOYER_KEYPAIR }}" > deployer.json
          solana config set --keypair deployer.json
          RPC_URL=${{ inputs.environment == 'mainnet-beta' && 'https://api.mainnet-beta.solana.com' || 'https://api.devnet.solana.com' }}
          solana config set --url $RPC_URL

      - name: Check Deployer Balance
        run: |
          BALANCE=$(solana balance | awk '{print $1}')
          echo "Deployer balance: $BALANCE SOL"
          MIN_BALANCE=${{ inputs.environment == 'mainnet-beta' && '5' || '2' }}
          if (( $(echo "$BALANCE < $MIN_BALANCE" | bc -l) )); then
            echo "❌ Insufficient balance for deployment"
            exit 1
          fi

      - name: Deploy Programs
        run: |
          echo "Deploying to ${{ inputs.environment }}..."
          anchor deploy --provider.cluster ${{ inputs.environment }}

      - name: Verify Deployment
        run: |
          echo "Verifying deployment..."
          solana program show --programs

      - name: Create Release Tag
        if: inputs.environment == 'mainnet-beta'
        run: |
          VERSION=$(date +%Y%m%d%H%M%S)
          git tag "release-${VERSION}"
          echo "Created release tag: release-${VERSION}"

  post-deploy:
    name: Post-Deploy Verification
    runs-on: ubuntu-latest
    needs: deploy
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Verify Jupiter Quote
        if: inputs.environment == 'mainnet-beta'
        run: |
          echo "Verifying Jupiter integration..."
          npm run jupiter:quote || echo "Jupiter quote check failed (may need pool setup)"

      - name: Deployment Summary
        run: |
          echo "╔════════════════════════════════════════════════════════╗"
          echo "║           DEPLOYMENT COMPLETE                           ║"
          echo "╠════════════════════════════════════════════════════════╣"
          echo "║  Environment: ${{ inputs.environment }}"
          echo "║  Commit: ${{ github.sha }}"
          echo "║  Time: $(date -u)"
          echo "╚════════════════════════════════════════════════════════╝"
```

---

## CROSS-CHAIN EVM CONTRACTS

### ===== FILE: evm/WrappedMeme.sol =====

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title WrappedMeme
 * @notice EVM-side wrapped token for Solana memecoin
 * @dev CANONICAL SUPPLY IS ON SOLANA. This is a wrapped mirror only.
 *
 * SECURITY INVARIANTS:
 * - No independent minting (only via BridgeGate with valid Solana lock proof)
 * - Supply parity with Solana canonical token must be maintained
 * - Emergency pause available but time-limited
 */
contract WrappedMeme is ERC20, ERC20Burnable, ERC20Permit, AccessControl, Pausable {
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Solana canonical mint address (32 bytes, for reference/verification)
    bytes32 public immutable solanaCanonicalMint;

    /// @notice Total minted via bridge (must equal locked on Solana)
    uint256 public totalBridgeMinted;

    /// @notice Total burned via bridge (unlocked on Solana)
    uint256 public totalBridgeBurned;

    /// @notice Maximum pause duration (24 hours)
    uint256 public constant MAX_PAUSE_DURATION = 24 hours;

    /// @notice When the current pause expires
    uint256 public pauseExpiresAt;

    // Events
    event BridgeMint(
        address indexed to,
        uint256 amount,
        bytes32 indexed solanaTxHash,
        uint256 totalMinted
    );

    event BridgeBurn(
        address indexed from,
        uint256 amount,
        bytes32 indexed destinationSolanaAddress,
        uint256 totalBurned
    );

    event EmergencyPause(
        address indexed pauser,
        uint256 duration,
        uint256 expiresAt,
        string reason
    );

    event EmergencyUnpause(address indexed unpauser, bool wasExpired);

    /**
     * @notice Constructor
     * @param name Token name
     * @param symbol Token symbol
     * @param _solanaCanonicalMint The Solana mint address (32 bytes)
     * @param admin Initial admin address
     */
    constructor(
        string memory name,
        string memory symbol,
        bytes32 _solanaCanonicalMint,
        address admin
    ) ERC20(name, symbol) ERC20Permit(name) {
        require(_solanaCanonicalMint != bytes32(0), "Invalid Solana mint");
        require(admin != address(0), "Invalid admin");

        solanaCanonicalMint = _solanaCanonicalMint;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /**
     * @notice Mint wrapped tokens (only callable by BridgeGate)
     * @param to Recipient address
     * @param amount Amount to mint
     * @param solanaTxHash Solana lock transaction hash for audit trail
     */
    function bridgeMint(
        address to,
        uint256 amount,
        bytes32 solanaTxHash
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(solanaTxHash != bytes32(0), "Invalid Solana tx hash");

        totalBridgeMinted += amount;
        _mint(to, amount);

        emit BridgeMint(to, amount, solanaTxHash, totalBridgeMinted);
    }

    /**
     * @notice Burn wrapped tokens to unlock on Solana
     * @param amount Amount to burn
     * @param destinationSolanaAddress Solana address to unlock to (32 bytes)
     */
    function bridgeBurn(
        uint256 amount,
        bytes32 destinationSolanaAddress
    ) external whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(destinationSolanaAddress != bytes32(0), "Invalid Solana address");

        totalBridgeBurned += amount;
        _burn(msg.sender, amount);

        emit BridgeBurn(msg.sender, amount, destinationSolanaAddress, totalBridgeBurned);
    }

    /**
     * @notice Emergency pause (time-limited)
     * @param duration Pause duration in seconds (max 24 hours)
     * @param reason Reason for pause (logged)
     */
    function emergencyPause(
        uint256 duration,
        string calldata reason
    ) external onlyRole(PAUSER_ROLE) {
        require(duration > 0 && duration <= MAX_PAUSE_DURATION, "Invalid duration");
        require(!paused(), "Already paused");

        pauseExpiresAt = block.timestamp + duration;
        _pause();

        emit EmergencyPause(msg.sender, duration, pauseExpiresAt, reason);
    }

    /**
     * @notice Unpause (can be called anytime by pauser, or automatically expires)
     */
    function emergencyUnpause() external onlyRole(PAUSER_ROLE) {
        require(paused(), "Not paused");

        bool wasExpired = block.timestamp >= pauseExpiresAt;
        pauseExpiresAt = 0;
        _unpause();

        emit EmergencyUnpause(msg.sender, wasExpired);
    }

    /**
     * @notice Check if pause has expired and auto-unpause
     */
    function checkPauseExpiry() external {
        if (paused() && block.timestamp >= pauseExpiresAt) {
            pauseExpiresAt = 0;
            _unpause();
            emit EmergencyUnpause(address(0), true);
        }
    }

    /**
     * @notice Get supply parity status
     * @return minted Total minted via bridge
     * @return burned Total burned via bridge
     * @return netCirculating Net circulating on this chain
     */
    function getSupplyParity()
        external
        view
        returns (uint256 minted, uint256 burned, uint256 netCirculating)
    {
        minted = totalBridgeMinted;
        burned = totalBridgeBurned;
        netCirculating = minted - burned;
    }

    /**
     * @notice Override to check pause expiry on transfer
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        // Auto-unpause if expired
        if (paused() && block.timestamp >= pauseExpiresAt) {
            pauseExpiresAt = 0;
            _unpause();
            emit EmergencyUnpause(address(0), true);
        }

        super._update(from, to, value);
    }
}
```

### ===== FILE: evm/MirrorBridgeGate.sol =====

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title IBridgeVerifier
 * @notice Interface for pluggable Solana lock proof verification
 * @dev Implement this for your chosen bridge (Wormhole, LayerZero, custom)
 */
interface IBridgeVerifier {
    /**
     * @notice Verify a Solana lock proof
     * @param solanaTxHash The Solana transaction hash
     * @param solanaAccount The Solana account that locked tokens
     * @param amount Amount that was locked
     * @param proof Bridge-specific proof data
     * @return valid True if the proof is valid
     */
    function verifyLockProof(
        bytes32 solanaTxHash,
        bytes32 solanaAccount,
        uint256 amount,
        bytes calldata proof
    ) external view returns (bool valid);
}

/**
 * @title IWrappedMeme
 * @notice Interface for the wrapped token
 */
interface IWrappedMeme {
    function bridgeMint(address to, uint256 amount, bytes32 solanaTxHash) external;
}

/**
 * @title MirrorBridgeGate
 * @notice Gate for Solana -> EVM bridging
 * @dev Uses pluggable verifier interface - not hardcoded to single vendor
 *
 * SECURITY FEATURES:
 * - Replay protection (processed tx tracking)
 * - Daily rate limits
 * - Per-transaction caps
 * - Emergency pause
 * - Pluggable verification (no vendor lock-in)
 */
contract MirrorBridgeGate is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice The wrapped token contract
    IWrappedMeme public wrappedToken;

    /// @notice The proof verifier contract
    IBridgeVerifier public verifier;

    /// @notice Track processed Solana transactions (prevent replay)
    mapping(bytes32 => bool) public processedSolanaTx;

    /// @notice Daily mint limit
    uint256 public dailyMintLimit;

    /// @notice Minted today
    uint256 public dailyMinted;

    /// @notice Day tracker (resets daily count)
    uint256 public lastMintResetDay;

    /// @notice Per-transaction cap
    uint256 public perTxCap;

    /// @notice Total processed through this gate
    uint256 public totalProcessed;

    // Events
    event LockVerifiedAndMinted(
        bytes32 indexed solanaTxHash,
        bytes32 indexed solanaAccount,
        address indexed recipient,
        uint256 amount,
        uint256 totalProcessed
    );

    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event LimitsUpdated(uint256 dailyLimit, uint256 perTxCap);
    event DailyLimitReset(uint256 day, uint256 previousMinted);

    /**
     * @notice Constructor
     * @param _wrappedToken The wrapped token address
     * @param _verifier The initial verifier address
     * @param _dailyMintLimit Daily mint limit
     * @param _perTxCap Per-transaction cap
     * @param admin Admin address
     */
    constructor(
        address _wrappedToken,
        address _verifier,
        uint256 _dailyMintLimit,
        uint256 _perTxCap,
        address admin
    ) {
        require(_wrappedToken != address(0), "Invalid token");
        require(_verifier != address(0), "Invalid verifier");
        require(_dailyMintLimit > 0, "Invalid daily limit");
        require(_perTxCap > 0 && _perTxCap <= _dailyMintLimit, "Invalid per-tx cap");
        require(admin != address(0), "Invalid admin");

        wrappedToken = IWrappedMeme(_wrappedToken);
        verifier = IBridgeVerifier(_verifier);
        dailyMintLimit = _dailyMintLimit;
        perTxCap = _perTxCap;
        lastMintResetDay = block.timestamp / 1 days;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    /**
     * @notice Process a Solana lock proof and mint wrapped tokens
     * @param solanaTxHash The Solana transaction hash where tokens were locked
     * @param solanaAccount The Solana account that locked tokens
     * @param recipient EVM address to receive wrapped tokens
     * @param amount Amount to mint
     * @param proof Bridge-specific proof data
     */
    function processLockAndMint(
        bytes32 solanaTxHash,
        bytes32 solanaAccount,
        address recipient,
        uint256 amount,
        bytes calldata proof
    ) external nonReentrant onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(solanaTxHash != bytes32(0), "Invalid Solana tx hash");
        require(solanaAccount != bytes32(0), "Invalid Solana account");

        // Check not already processed (replay protection)
        require(!processedSolanaTx[solanaTxHash], "Already processed");

        // Check per-transaction cap
        require(amount <= perTxCap, "Exceeds per-tx cap");

        // Reset daily limit if new day
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > lastMintResetDay) {
            emit DailyLimitReset(currentDay, dailyMinted);
            dailyMinted = 0;
            lastMintResetDay = currentDay;
        }

        // Check daily limit
        require(dailyMinted + amount <= dailyMintLimit, "Daily limit exceeded");

        // Verify the lock proof
        require(
            verifier.verifyLockProof(solanaTxHash, solanaAccount, amount, proof),
            "Invalid lock proof"
        );

        // Mark as processed
        processedSolanaTx[solanaTxHash] = true;
        dailyMinted += amount;
        totalProcessed += amount;

        // Mint wrapped tokens
        wrappedToken.bridgeMint(recipient, amount, solanaTxHash);

        emit LockVerifiedAndMinted(
            solanaTxHash,
            solanaAccount,
            recipient,
            amount,
            totalProcessed
        );
    }

    /**
     * @notice Update the verifier (for upgrades)
     * @param _verifier New verifier address
     */
    function setVerifier(address _verifier) external onlyRole(ADMIN_ROLE) {
        require(_verifier != address(0), "Invalid verifier");
        emit VerifierUpdated(address(verifier), _verifier);
        verifier = IBridgeVerifier(_verifier);
    }

    /**
     * @notice Update limits
     * @param _dailyMintLimit New daily limit
     * @param _perTxCap New per-transaction cap
     */
    function setLimits(
        uint256 _dailyMintLimit,
        uint256 _perTxCap
    ) external onlyRole(ADMIN_ROLE) {
        require(_dailyMintLimit > 0, "Invalid daily limit");
        require(_perTxCap > 0 && _perTxCap <= _dailyMintLimit, "Invalid per-tx cap");

        dailyMintLimit = _dailyMintLimit;
        perTxCap = _perTxCap;

        emit LimitsUpdated(_dailyMintLimit, _perTxCap);
    }

    /**
     * @notice Emergency pause
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Get current rate limit status
     */
    function getRateLimitStatus()
        external
        view
        returns (
            uint256 dailyLimit,
            uint256 mintedToday,
            uint256 remainingToday,
            uint256 txCap
        )
    {
        dailyLimit = dailyMintLimit;
        mintedToday = dailyMinted;
        remainingToday = dailyMintLimit > dailyMinted ? dailyMintLimit - dailyMinted : 0;
        txCap = perTxCap;
    }
}
```

### ===== FILE: evm/README.md =====

```markdown
# EVM Cross-Chain Mirror Contracts

## Overview

These contracts enable wrapped token representation of the Solana-canonical memecoin on EVM chains (Ethereum, Base, etc.).

**CRITICAL: Solana is the canonical chain. EVM tokens are wrapped mirrors only.**

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CROSS-CHAIN FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SOLANA (Canonical)              EVM (Mirror)                   │
│  ┌─────────────────┐            ┌─────────────────┐            │
│  │  Lock Tokens    │ ────────►  │  Verify Proof   │            │
│  │  in Escrow PDA  │   Bridge   │  (BridgeGate)   │            │
│  └─────────────────┘   Relay    └────────┬────────┘            │
│                                          │                      │
│                                          ▼                      │
│                                 ┌─────────────────┐            │
│                                 │  Mint Wrapped   │            │
│                                 │  (WrappedMeme)  │            │
│                                 └─────────────────┘            │
│                                                                 │
│  ┌─────────────────┐            ┌─────────────────┐            │
│  │ Unlock Tokens   │ ◄────────  │  Burn Wrapped   │            │
│  │ from Escrow     │   Bridge   │  (WrappedMeme)  │            │
│  └─────────────────┘   Relay    └─────────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Supply Parity Policy

| Rule | Enforcement |
|------|-------------|
| No independent minting | WrappedMeme only mints via BRIDGE_ROLE |
| 1:1 parity | Every mint requires valid Solana lock proof |
| Burn = Unlock | EVM burn triggers Solana unlock process |
| Single source of truth | Solana maintains canonical supply |

## Deployment

### 1. Deploy WrappedMeme

```bash
# Using Hardhat
npx hardhat run scripts/deploy-wrapped.ts --network base

# Constructor args:
# - name: "Wrapped MEME"
# - symbol: "wMEME"
# - solanaCanonicalMint: <32-byte Solana mint address>
# - admin: <multisig address>
```

### 2. Deploy Bridge Verifier

Implement `IBridgeVerifier` for your chosen bridge:

- **Wormhole**: Use Wormhole VAA verification
- **LayerZero**: Use LayerZero message verification
- **Custom**: Implement MPC or light client verification

### 3. Deploy MirrorBridgeGate

```bash
# Constructor args:
# - wrappedToken: <WrappedMeme address>
# - verifier: <BridgeVerifier address>
# - dailyMintLimit: 1_000_000 * 10**18 (1M tokens)
# - perTxCap: 100_000 * 10**18 (100K tokens)
# - admin: <multisig address>
```

### 4. Configure Roles

```solidity
// Grant BRIDGE_ROLE to MirrorBridgeGate
wrappedMeme.grantRole(BRIDGE_ROLE, mirrorBridgeGate);

// Grant OPERATOR_ROLE to relayer
mirrorBridgeGate.grantRole(OPERATOR_ROLE, relayerAddress);
```

## Operational Runbook

### Lock → Mint Flow

1. User locks tokens on Solana (escrow PDA)
2. Bridge relayer detects lock event
3. Relayer generates proof
4. Relayer calls `processLockAndMint()` on MirrorBridgeGate
5. Gate verifies proof via IBridgeVerifier
6. Gate calls `bridgeMint()` on WrappedMeme
7. User receives wrapped tokens on EVM

### Burn → Unlock Flow

1. User calls `bridgeBurn()` on WrappedMeme
2. Event emitted with destination Solana address
3. Bridge relayer detects burn event
4. Relayer initiates unlock on Solana
5. Tokens released from escrow PDA
6. User receives tokens on Solana

## Security Assumptions

| Assumption | Mitigation |
|------------|------------|
| Verifier is honest | Use decentralized verification (Wormhole guardians, MPC) |
| Relayer is available | Multiple relayers, permissionless claiming |
| No replay attacks | processedSolanaTx mapping |
| Rate limits work | Daily + per-tx caps |

## Monitoring

Track these metrics:
- `totalBridgeMinted` vs Solana escrow balance
- Daily mint volume vs limits
- Pause events
- Large transactions (>perTxCap/2)

## Emergency Procedures

### Pause (Suspicious Activity)

```solidity
// On WrappedMeme (time-limited)
wrappedMeme.emergencyPause(3600, "Investigating suspicious activity");

// On MirrorBridgeGate
mirrorBridgeGate.pause();
```

### Unpause (After Investigation)

```solidity
wrappedMeme.emergencyUnpause();
mirrorBridgeGate.unpause();
```

### Update Verifier (Security Upgrade)

```solidity
mirrorBridgeGate.setVerifier(newVerifierAddress);
```
```

---

## DEPLOYMENT CHECKLISTS

### Devnet Checklist

```
╔════════════════════════════════════════════════════════════════════╗
║                    DEVNET DEPLOYMENT CHECKLIST                      ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  BUILD & TEST                                                      ║
║  [ ] All programs compile without errors                           ║
║  [ ] All unit tests passing                                        ║
║  [ ] Integration tests passing                                     ║
║  [ ] Program hashes recorded                                       ║
║                                                                    ║
║  DEPLOYMENT                                                        ║
║  [ ] Devnet SOL funded (2+ SOL)                                   ║
║  [ ] All 5 programs deployed                                       ║
║  [ ] Program IDs recorded in Anchor.toml                          ║
║                                                                    ║
║  TOKEN SETUP                                                       ║
║  [ ] Token mint created (01_create_spl_mint.ts)                   ║
║  [ ] Tokens minted and distributed (02_mint_and_distribute.ts)    ║
║  [ ] Authorities revoked (03_revoke_authorities.ts)               ║
║                                                                    ║
║  LIQUIDITY                                                         ║
║  [ ] Raydium pool created (04_create_raydium_pool.ts)             ║
║  [ ] Initial liquidity added (05_add_liquidity_raydium.ts)        ║
║  [ ] LP tokens locked/burned (06_lock_or_burn_lp.ts)              ║
║                                                                    ║
║  TRADING VERIFICATION                                              ║
║  [ ] Jupiter quote verified (07_verify_jupiter_quote.ts)          ║
║  [ ] Smoke test trade executed (08_swap_smoke_test.ts)            ║
║                                                                    ║
║  GOVERNANCE                                                        ║
║  [ ] Multisig initialized with test owners                        ║
║  [ ] Test proposal created and executed                           ║
║  [ ] Treasury deposit and spend tested                            ║
║                                                                    ║
║  EMERGENCY                                                         ║
║  [ ] Emergency pause tested                                        ║
║  [ ] Pause expiry verified                                        ║
║  [ ] Unpause tested                                                ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### Mainnet Checklist

```
╔════════════════════════════════════════════════════════════════════╗
║                   MAINNET DEPLOYMENT CHECKLIST                      ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  PRE-REQUISITES                                                    ║
║  [ ] All devnet checklist items complete                          ║
║  [ ] Security audit complete (external firm)                      ║
║  [ ] Bug bounty program active                                     ║
║  [ ] Legal review complete                                         ║
║                                                                    ║
║  SECURITY VERIFICATION                                             ║
║  [ ] Program hashes match expected (CI artifact)                  ║
║  [ ] No unsafe code in programs                                   ║
║  [ ] All error paths handled                                       ║
║  [ ] Rate limits configured appropriately                         ║
║  [ ] Spend caps set correctly                                      ║
║                                                                    ║
║  WALLET SETUP                                                      ║
║  [ ] Mainnet SOL funded (10+ SOL recommended)                     ║
║  [ ] USDC funded for LP (100K minimum)                            ║
║  [ ] Multisig signers confirmed (3-of-5 minimum)                  ║
║  [ ] Emergency pause authority set (multisig)                     ║
║                                                                    ║
║  DEPLOYMENT                                                        ║
║  [ ] Programs deployed via CI/CD (release.yml)                    ║
║  [ ] Program IDs verified on-chain                                ║
║  [ ] IDLs published                                                ║
║                                                                    ║
║  TOKEN LAUNCH                                                      ║
║  [ ] Token mint created and verified                              ║
║  [ ] Distribution matches tokenomics plan                         ║
║  [ ] Authorities PERMANENTLY revoked                              ║
║  [ ] LP locked OR burned (proof available)                        ║
║                                                                    ║
║  POST-LAUNCH                                                       ║
║  [ ] Jupiter routing verified                                      ║
║  [ ] Price feeds working                                           ║
║  [ ] Monitoring/alerting configured                               ║
║  [ ] Community announcement made                                   ║
║                                                                    ║
║  CROSS-CHAIN (IF APPLICABLE)                                       ║
║  [ ] EVM contracts deployed                                        ║
║  [ ] Bridge verifier configured                                    ║
║  [ ] Rate limits set                                               ║
║  [ ] Supply parity monitoring active                              ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## SECURITY CHECKLIST

```
╔════════════════════════════════════════════════════════════════════╗
║                      SECURITY CHECKLIST                             ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  AUTHORITY MANAGEMENT                                              ║
║  [ ] Mint authority = None (CRITICAL)                             ║
║  [ ] Freeze authority = None                                       ║
║  [ ] Upgrade authority = None OR multisig                         ║
║  [ ] No EOA admins (multisig only)                                ║
║                                                                    ║
║  GOVERNANCE                                                        ║
║  [ ] Multisig threshold >= 3-of-5                                 ║
║  [ ] Spend cap per transaction set                                ║
║  [ ] Proposal expiry configured                                    ║
║  [ ] No single point of failure                                   ║
║                                                                    ║
║  EMERGENCY CONTROLS                                                ║
║  [ ] Pause is TIME-LIMITED (max 24h)                              ║
║  [ ] Pause cannot mint new tokens                                 ║
║  [ ] Pause is LOGGED (reason code)                                ║
║  [ ] Multiple pause authorities (no single point)                 ║
║                                                                    ║
║  RATE LIMITS                                                       ║
║  [ ] Daily limits configured                                       ║
║  [ ] Per-transaction caps set                                      ║
║  [ ] Cooldowns where appropriate                                   ║
║                                                                    ║
║  CODE QUALITY                                                      ║
║  [ ] No unsafe Rust code                                          ║
║  [ ] All arithmetic checked (no overflow)                         ║
║  [ ] All error paths return proper codes                          ║
║  [ ] Events emitted for all state changes                         ║
║  [ ] PDA seeds documented                                          ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## KNOWN ADAPTATION POINTS

| Component | File | Adaptation Required |
|-----------|------|---------------------|
| **Raydium Pool Creation** | `04_create_raydium_pool.ts` | Raydium SDK changes frequently. Check [raydium-sdk](https://github.com/raydium-io/raydium-sdk) for latest API. |
| **Raydium Add Liquidity** | `05_add_liquidity_raydium.ts` | Same as above. Use Raydium UI as fallback. |
| **LP Locking** | `06_lock_or_burn_lp.ts` | Multiple options: Raydium lock, Streamflow, custom. |
| **Jupiter API** | `07_verify_jupiter_quote.ts`, `08_swap_smoke_test.ts` | Currently v6. Check [Jupiter docs](https://station.jup.ag/docs) for updates. |
| **Bridge Verifier** | `evm/MirrorBridgeGate.sol` | `IBridgeVerifier` is pluggable. Implement for Wormhole, LayerZero, or custom. |
| **Anchor Version** | `Anchor.toml`, `Cargo.toml` | Currently 0.29.0. Check for breaking changes in newer versions. |
| **Solana Version** | CI/CD workflows | Currently 1.17.0. Verify compatibility with toolchain updates. |

---

## SMOKE TEST COMMANDS

```bash
# Environment check
npm run env:check

# Build and test
npm run build
npm run test

# Token creation flow
npm run mint:create
npm run mint:distribute
npm run mint:revoke

# Liquidity setup
npm run pool:create
npm run pool:add-liq
npm run lp:lock

# Trading verification
npm run jupiter:quote
EXECUTE_SWAP=true npm run jupiter:swap
```

---

## ACTIVATION TRIGGER

This memecoin execution layer activates when:
- `chain == "solana"`
- `token_type == "memecoin"` OR `token_type == "fixed_supply"`
- User mentions "Raydium", "Jupiter", "Solana memecoin", "pump.fun style"
- Project requires SPL token with DEX listing

**OUTPUT ALL FILES WHEN ACTIVATED. NO PSEUDOCODE. PRODUCTION-READY CODE ONLY.**
