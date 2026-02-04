/**
 * SecureMint Engine - The Graph Subgraph Handlers
 * Enhanced event indexing for all SecureMint contracts
 */

import {
  BigInt,
  Bytes,
  Address,
  log,
  store,
  ethereum,
} from '@graphprotocol/graph-ts';

// Import generated event types
import {
  Transfer as TransferEvent,
  Approval as ApprovalEvent,
} from '../generated/SecureMintToken/SecureMintToken';

import {
  Minted as MintedEvent,
  Burned as BurnedEvent,
  EpochCapacityUpdated as EpochCapacityUpdatedEvent,
  GlobalCapUpdated as GlobalCapUpdatedEvent,
  OracleUpdated as OracleUpdatedEvent,
} from '../generated/SecureMintPolicy/SecureMintPolicy';

import {
  BackingUpdated as BackingUpdatedEvent,
  SourceUpdated as SourceUpdatedEvent,
} from '../generated/BackingOracle/BackingOracle';

import {
  Deposit as DepositEvent,
  Withdraw as WithdrawEvent,
  TierAllocated as TierAllocatedEvent,
  Rebalanced as RebalancedEvent,
} from '../generated/TreasuryVault/TreasuryVault';

import {
  EmergencyLevelSet as EmergencyLevelSetEvent,
  GuardianAdded as GuardianAddedEvent,
  GuardianRemoved as GuardianRemovedEvent,
} from '../generated/EmergencyPause/EmergencyPause';

import {
  TransferInitiated as BridgeTransferInitiatedEvent,
  TransferExecuted as BridgeTransferExecutedEvent,
  ValidatorAdded as ValidatorAddedEvent,
} from '../generated/SecureMintBridge/SecureMintBridge';

import {
  ClaimSubmitted as ClaimSubmittedEvent,
  ClaimPaid as ClaimPaidEvent,
} from '../generated/InsuranceFund/InsuranceFund';

// Import generated entity types
import {
  Token,
  Account,
  Transfer,
  MintEvent,
  BurnEvent,
  OracleUpdate,
  TreasuryAction,
  EmergencyEvent,
  BridgeTransfer,
  InsuranceClaim,
  DailyStats,
  HourlyStats,
  ProtocolMetrics,
} from '../generated/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ZERO_BI = BigInt.fromI32(0);
const ONE_BI = BigInt.fromI32(1);
const PROTOCOL_ID = 'securemint-protocol';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getOrCreateAccount(address: Address): Account {
  let id = address.toHexString();
  let account = Account.load(id);

  if (!account) {
    account = new Account(id);
    account.address = address;
    account.balance = ZERO_BI;
    account.totalMinted = ZERO_BI;
    account.totalBurned = ZERO_BI;
    account.totalTransferredIn = ZERO_BI;
    account.totalTransferredOut = ZERO_BI;
    account.transactionCount = ZERO_BI;
    account.firstSeenBlock = ZERO_BI;
    account.firstSeenTimestamp = ZERO_BI;
    account.lastSeenBlock = ZERO_BI;
    account.lastSeenTimestamp = ZERO_BI;
    account.save();
  }

  return account;
}

function getOrCreateToken(): Token {
  let token = Token.load(PROTOCOL_ID);

  if (!token) {
    token = new Token(PROTOCOL_ID);
    token.name = 'SecureMint Token';
    token.symbol = 'SMT';
    token.decimals = 6;
    token.totalSupply = ZERO_BI;
    token.totalMinted = ZERO_BI;
    token.totalBurned = ZERO_BI;
    token.holderCount = ZERO_BI;
    token.transferCount = ZERO_BI;
    token.save();
  }

  return token;
}

function getOrCreateProtocolMetrics(): ProtocolMetrics {
  let metrics = ProtocolMetrics.load(PROTOCOL_ID);

  if (!metrics) {
    metrics = new ProtocolMetrics(PROTOCOL_ID);
    metrics.totalSupply = ZERO_BI;
    metrics.totalBacking = ZERO_BI;
    metrics.backingRatio = ZERO_BI;
    metrics.epochCapacity = ZERO_BI;
    metrics.epochMinted = ZERO_BI;
    metrics.globalCap = ZERO_BI;
    metrics.treasuryValue = ZERO_BI;
    metrics.insuranceFundValue = ZERO_BI;
    metrics.emergencyLevel = 0;
    metrics.oracleLastUpdate = ZERO_BI;
    metrics.oracleIsStale = false;
    metrics.activeBridgeTransfers = ZERO_BI;
    metrics.pendingClaims = ZERO_BI;
    metrics.lastUpdateBlock = ZERO_BI;
    metrics.lastUpdateTimestamp = ZERO_BI;
    metrics.save();
  }

  return metrics;
}

function getDayId(timestamp: BigInt): string {
  let dayTimestamp = timestamp.toI32() / 86400;
  return dayTimestamp.toString();
}

function getHourId(timestamp: BigInt): string {
  let hourTimestamp = timestamp.toI32() / 3600;
  return hourTimestamp.toString();
}

function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  let id = getDayId(timestamp);
  let stats = DailyStats.load(id);

  if (!stats) {
    stats = new DailyStats(id);
    stats.date = BigInt.fromI32((timestamp.toI32() / 86400) * 86400);
    stats.totalSupply = ZERO_BI;
    stats.totalBacking = ZERO_BI;
    stats.mintVolume = ZERO_BI;
    stats.burnVolume = ZERO_BI;
    stats.transferVolume = ZERO_BI;
    stats.mintCount = ZERO_BI;
    stats.burnCount = ZERO_BI;
    stats.transferCount = ZERO_BI;
    stats.uniqueAddresses = ZERO_BI;
    stats.oracleUpdates = ZERO_BI;
    stats.bridgeVolume = ZERO_BI;
    stats.claimsPaid = ZERO_BI;
    stats.save();
  }

  return stats;
}

function getOrCreateHourlyStats(timestamp: BigInt): HourlyStats {
  let id = getHourId(timestamp);
  let stats = HourlyStats.load(id);

  if (!stats) {
    stats = new HourlyStats(id);
    stats.hour = BigInt.fromI32((timestamp.toI32() / 3600) * 3600);
    stats.totalSupply = ZERO_BI;
    stats.mintVolume = ZERO_BI;
    stats.burnVolume = ZERO_BI;
    stats.transferVolume = ZERO_BI;
    stats.mintCount = ZERO_BI;
    stats.burnCount = ZERO_BI;
    stats.transferCount = ZERO_BI;
    stats.save();
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleTransfer(event: TransferEvent): void {
  let token = getOrCreateToken();
  let from = getOrCreateAccount(event.params.from);
  let to = getOrCreateAccount(event.params.to);

  // Create transfer entity
  let transferId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let transfer = new Transfer(transferId);
  transfer.from = from.id;
  transfer.to = to.id;
  transfer.amount = event.params.value;
  transfer.timestamp = event.block.timestamp;
  transfer.blockNumber = event.block.number;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();

  // Update from account
  if (event.params.from != Address.zero()) {
    from.balance = from.balance.minus(event.params.value);
    from.totalTransferredOut = from.totalTransferredOut.plus(event.params.value);
    from.transactionCount = from.transactionCount.plus(ONE_BI);
    from.lastSeenBlock = event.block.number;
    from.lastSeenTimestamp = event.block.timestamp;
    from.save();

    // Check if account is now empty
    if (from.balance.equals(ZERO_BI)) {
      token.holderCount = token.holderCount.minus(ONE_BI);
    }
  }

  // Update to account
  if (event.params.to != Address.zero()) {
    let wasEmpty = to.balance.equals(ZERO_BI);
    to.balance = to.balance.plus(event.params.value);
    to.totalTransferredIn = to.totalTransferredIn.plus(event.params.value);
    to.transactionCount = to.transactionCount.plus(ONE_BI);
    to.lastSeenBlock = event.block.number;
    to.lastSeenTimestamp = event.block.timestamp;

    if (to.firstSeenBlock.equals(ZERO_BI)) {
      to.firstSeenBlock = event.block.number;
      to.firstSeenTimestamp = event.block.timestamp;
    }
    to.save();

    // New holder
    if (wasEmpty) {
      token.holderCount = token.holderCount.plus(ONE_BI);
    }
  }

  // Update token stats
  token.transferCount = token.transferCount.plus(ONE_BI);
  token.save();

  // Update daily/hourly stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.transferVolume = dailyStats.transferVolume.plus(event.params.value);
  dailyStats.transferCount = dailyStats.transferCount.plus(ONE_BI);
  dailyStats.save();

  let hourlyStats = getOrCreateHourlyStats(event.block.timestamp);
  hourlyStats.transferVolume = hourlyStats.transferVolume.plus(event.params.value);
  hourlyStats.transferCount = hourlyStats.transferCount.plus(ONE_BI);
  hourlyStats.save();
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLICY HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleMinted(event: MintedEvent): void {
  let token = getOrCreateToken();
  let metrics = getOrCreateProtocolMetrics();
  let recipient = getOrCreateAccount(event.params.recipient);

  // Create mint event
  let mintId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let mint = new MintEvent(mintId);
  mint.recipient = recipient.id;
  mint.amount = event.params.amount;
  mint.backingAtMint = event.params.backing;
  mint.epochMintedAfter = event.params.epochMinted;
  mint.timestamp = event.block.timestamp;
  mint.blockNumber = event.block.number;
  mint.transactionHash = event.transaction.hash;
  mint.save();

  // Update recipient
  recipient.totalMinted = recipient.totalMinted.plus(event.params.amount);
  recipient.save();

  // Update token
  token.totalSupply = token.totalSupply.plus(event.params.amount);
  token.totalMinted = token.totalMinted.plus(event.params.amount);
  token.save();

  // Update metrics
  metrics.totalSupply = token.totalSupply;
  metrics.epochMinted = event.params.epochMinted;
  metrics.lastUpdateBlock = event.block.number;
  metrics.lastUpdateTimestamp = event.block.timestamp;
  metrics.save();

  // Update stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.mintVolume = dailyStats.mintVolume.plus(event.params.amount);
  dailyStats.mintCount = dailyStats.mintCount.plus(ONE_BI);
  dailyStats.totalSupply = token.totalSupply;
  dailyStats.save();

  let hourlyStats = getOrCreateHourlyStats(event.block.timestamp);
  hourlyStats.mintVolume = hourlyStats.mintVolume.plus(event.params.amount);
  hourlyStats.mintCount = hourlyStats.mintCount.plus(ONE_BI);
  hourlyStats.totalSupply = token.totalSupply;
  hourlyStats.save();

  log.info('Mint: {} tokens to {}', [event.params.amount.toString(), recipient.id]);
}

export function handleBurned(event: BurnedEvent): void {
  let token = getOrCreateToken();
  let metrics = getOrCreateProtocolMetrics();
  let burner = getOrCreateAccount(event.params.burner);

  // Create burn event
  let burnId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let burn = new BurnEvent(burnId);
  burn.burner = burner.id;
  burn.amount = event.params.amount;
  burn.timestamp = event.block.timestamp;
  burn.blockNumber = event.block.number;
  burn.transactionHash = event.transaction.hash;
  burn.save();

  // Update burner
  burner.totalBurned = burner.totalBurned.plus(event.params.amount);
  burner.save();

  // Update token
  token.totalSupply = token.totalSupply.minus(event.params.amount);
  token.totalBurned = token.totalBurned.plus(event.params.amount);
  token.save();

  // Update metrics
  metrics.totalSupply = token.totalSupply;
  metrics.lastUpdateBlock = event.block.number;
  metrics.lastUpdateTimestamp = event.block.timestamp;
  metrics.save();

  // Update stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.burnVolume = dailyStats.burnVolume.plus(event.params.amount);
  dailyStats.burnCount = dailyStats.burnCount.plus(ONE_BI);
  dailyStats.totalSupply = token.totalSupply;
  dailyStats.save();

  let hourlyStats = getOrCreateHourlyStats(event.block.timestamp);
  hourlyStats.burnVolume = hourlyStats.burnVolume.plus(event.params.amount);
  hourlyStats.burnCount = hourlyStats.burnCount.plus(ONE_BI);
  hourlyStats.totalSupply = token.totalSupply;
  hourlyStats.save();

  log.info('Burn: {} tokens from {}', [event.params.amount.toString(), burner.id]);
}

export function handleEpochCapacityUpdated(event: EpochCapacityUpdatedEvent): void {
  let metrics = getOrCreateProtocolMetrics();
  metrics.epochCapacity = event.params.newCapacity;
  metrics.lastUpdateBlock = event.block.number;
  metrics.lastUpdateTimestamp = event.block.timestamp;
  metrics.save();
}

export function handleGlobalCapUpdated(event: GlobalCapUpdatedEvent): void {
  let metrics = getOrCreateProtocolMetrics();
  metrics.globalCap = event.params.newCap;
  metrics.lastUpdateBlock = event.block.number;
  metrics.lastUpdateTimestamp = event.block.timestamp;
  metrics.save();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleBackingUpdated(event: BackingUpdatedEvent): void {
  let metrics = getOrCreateProtocolMetrics();

  // Create oracle update
  let updateId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let update = new OracleUpdate(updateId);
  update.backing = event.params.backing;
  update.source = event.params.source.toHexString();
  update.timestamp = event.block.timestamp;
  update.blockNumber = event.block.number;
  update.transactionHash = event.transaction.hash;
  update.save();

  // Update metrics
  metrics.totalBacking = event.params.backing;
  metrics.oracleLastUpdate = event.block.timestamp;
  metrics.oracleIsStale = false;

  // Calculate backing ratio (scaled by 1e18)
  let token = getOrCreateToken();
  if (!token.totalSupply.equals(ZERO_BI)) {
    metrics.backingRatio = event.params.backing
      .times(BigInt.fromI32(10).pow(18))
      .div(token.totalSupply);
  }

  metrics.lastUpdateBlock = event.block.number;
  metrics.lastUpdateTimestamp = event.block.timestamp;
  metrics.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.totalBacking = event.params.backing;
  dailyStats.oracleUpdates = dailyStats.oracleUpdates.plus(ONE_BI);
  dailyStats.save();

  log.info('Oracle update: backing = {}', [event.params.backing.toString()]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREASURY HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleTreasuryDeposit(event: DepositEvent): void {
  let metrics = getOrCreateProtocolMetrics();

  let actionId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let action = new TreasuryAction(actionId);
  action.actionType = 'DEPOSIT';
  action.tier = event.params.tier;
  action.amount = event.params.amount;
  action.timestamp = event.block.timestamp;
  action.blockNumber = event.block.number;
  action.transactionHash = event.transaction.hash;
  action.save();

  metrics.treasuryValue = metrics.treasuryValue.plus(event.params.amount);
  metrics.lastUpdateBlock = event.block.number;
  metrics.lastUpdateTimestamp = event.block.timestamp;
  metrics.save();
}

export function handleTreasuryWithdraw(event: WithdrawEvent): void {
  let metrics = getOrCreateProtocolMetrics();

  let actionId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let action = new TreasuryAction(actionId);
  action.actionType = 'WITHDRAW';
  action.tier = event.params.tier;
  action.amount = event.params.amount;
  action.timestamp = event.block.timestamp;
  action.blockNumber = event.block.number;
  action.transactionHash = event.transaction.hash;
  action.save();

  metrics.treasuryValue = metrics.treasuryValue.minus(event.params.amount);
  metrics.lastUpdateBlock = event.block.number;
  metrics.lastUpdateTimestamp = event.block.timestamp;
  metrics.save();
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMERGENCY HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleEmergencyLevelSet(event: EmergencyLevelSetEvent): void {
  let metrics = getOrCreateProtocolMetrics();

  let eventId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let emergencyEvent = new EmergencyEvent(eventId);
  emergencyEvent.level = event.params.newLevel;
  emergencyEvent.setBy = event.params.setBy;
  emergencyEvent.timestamp = event.block.timestamp;
  emergencyEvent.blockNumber = event.block.number;
  emergencyEvent.transactionHash = event.transaction.hash;
  emergencyEvent.save();

  metrics.emergencyLevel = event.params.newLevel;
  metrics.lastUpdateBlock = event.block.number;
  metrics.lastUpdateTimestamp = event.block.timestamp;
  metrics.save();

  log.warning('Emergency level set to {} by {}', [
    event.params.newLevel.toString(),
    event.params.setBy.toHexString(),
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRIDGE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleBridgeTransferInitiated(event: BridgeTransferInitiatedEvent): void {
  let metrics = getOrCreateProtocolMetrics();

  let transferId = event.params.transferId.toHexString();
  let transfer = new BridgeTransfer(transferId);
  transfer.sender = event.params.sender;
  transfer.recipient = event.params.recipient;
  transfer.amount = event.params.amount;
  transfer.sourceChain = event.params.sourceChain;
  transfer.destChain = event.params.destChain;
  transfer.nonce = event.params.nonce;
  transfer.status = 'PENDING';
  transfer.initiatedAt = event.block.timestamp;
  transfer.initiatedBlock = event.block.number;
  transfer.initiatedTx = event.transaction.hash;
  transfer.save();

  metrics.activeBridgeTransfers = metrics.activeBridgeTransfers.plus(ONE_BI);
  metrics.lastUpdateBlock = event.block.number;
  metrics.lastUpdateTimestamp = event.block.timestamp;
  metrics.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.bridgeVolume = dailyStats.bridgeVolume.plus(event.params.amount);
  dailyStats.save();
}

export function handleBridgeTransferExecuted(event: BridgeTransferExecutedEvent): void {
  let metrics = getOrCreateProtocolMetrics();

  let transfer = BridgeTransfer.load(event.params.transferId.toHexString());
  if (transfer) {
    transfer.status = 'EXECUTED';
    transfer.executedAt = event.block.timestamp;
    transfer.executedBlock = event.block.number;
    transfer.executedTx = event.transaction.hash;
    transfer.save();
  }

  metrics.activeBridgeTransfers = metrics.activeBridgeTransfers.minus(ONE_BI);
  metrics.lastUpdateBlock = event.block.number;
  metrics.lastUpdateTimestamp = event.block.timestamp;
  metrics.save();
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSURANCE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleClaimSubmitted(event: ClaimSubmittedEvent): void {
  let metrics = getOrCreateProtocolMetrics();

  let claimId = event.params.claimId.toString();
  let claim = new InsuranceClaim(claimId);
  claim.claimant = event.params.claimant;
  claim.coverageType = event.params.coverageType;
  claim.lossAmount = event.params.lossAmount;
  claim.status = 'PENDING';
  claim.submittedAt = event.block.timestamp;
  claim.submittedBlock = event.block.number;
  claim.submittedTx = event.transaction.hash;
  claim.save();

  metrics.pendingClaims = metrics.pendingClaims.plus(ONE_BI);
  metrics.lastUpdateBlock = event.block.number;
  metrics.lastUpdateTimestamp = event.block.timestamp;
  metrics.save();
}

export function handleClaimPaid(event: ClaimPaidEvent): void {
  let metrics = getOrCreateProtocolMetrics();

  let claim = InsuranceClaim.load(event.params.claimId.toString());
  if (claim) {
    claim.status = 'PAID';
    claim.paidAmount = event.params.amount;
    claim.paidAt = event.block.timestamp;
    claim.paidBlock = event.block.number;
    claim.paidTx = event.transaction.hash;
    claim.save();
  }

  metrics.pendingClaims = metrics.pendingClaims.minus(ONE_BI);
  metrics.lastUpdateBlock = event.block.number;
  metrics.lastUpdateTimestamp = event.block.timestamp;
  metrics.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.claimsPaid = dailyStats.claimsPaid.plus(event.params.amount);
  dailyStats.save();
}
