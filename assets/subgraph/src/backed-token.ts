import { BigInt, Address, Bytes, log } from "@graphprotocol/graph-ts";
import {
  SecureMint,
  Transfer,
  GuardianChanged,
  Paused,
  Unpaused,
} from "../generated/BackedToken/BackedToken";
import { Token, Holder, Mint, Burn, Transfer as TransferEntity, DailyStats } from "../generated/schema";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TOKEN_DECIMALS = 18;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getOrCreateToken(address: Address): Token {
  let token = Token.load(address.toHexString());

  if (token == null) {
    token = new Token(address.toHexString());
    token.name = "USD Backed Token";
    token.symbol = "USDB";
    token.decimals = TOKEN_DECIMALS;
    token.totalSupply = BigInt.fromI32(0);
    token.totalMinted = BigInt.fromI32(0);
    token.totalBurned = BigInt.fromI32(0);
    token.holderCount = BigInt.fromI32(0);
    token.transferCount = BigInt.fromI32(0);
    token.createdAt = BigInt.fromI32(0);
    token.createdAtBlock = BigInt.fromI32(0);
    token.lastUpdated = BigInt.fromI32(0);
  }

  return token;
}

function getOrCreateHolder(address: Address): Holder {
  let holder = Holder.load(address.toHexString());

  if (holder == null) {
    holder = new Holder(address.toHexString());
    holder.balance = BigInt.fromI32(0);
    holder.totalMintedTo = BigInt.fromI32(0);
    holder.totalBurned = BigInt.fromI32(0);
    holder.firstActivity = BigInt.fromI32(0);
    holder.lastActivity = BigInt.fromI32(0);
  }

  return holder;
}

function getDayId(timestamp: BigInt): string {
  let dayTimestamp = timestamp.toI32() / 86400;
  return dayTimestamp.toString();
}

function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  let dayId = getDayId(timestamp);
  let stats = DailyStats.load(dayId);

  if (stats == null) {
    stats = new DailyStats(dayId);
    stats.date = BigInt.fromI32((timestamp.toI32() / 86400) * 86400);
    stats.totalSupply = BigInt.fromI32(0);
    stats.totalMinted = BigInt.fromI32(0);
    stats.totalBurned = BigInt.fromI32(0);
    stats.verifiedBacking = BigInt.fromI32(0);
    stats.healthFactor = BigInt.fromI32(0);
    stats.mintCount = BigInt.fromI32(0);
    stats.burnCount = BigInt.fromI32(0);
    stats.transferCount = BigInt.fromI32(0);
    stats.uniqueActiveUsers = BigInt.fromI32(0);
    stats.mintVolume = BigInt.fromI32(0);
    stats.burnVolume = BigInt.fromI32(0);
    stats.transferVolume = BigInt.fromI32(0);
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleSecureMint(event: SecureMint): void {
  let token = getOrCreateToken(event.address);
  let recipient = getOrCreateHolder(event.params.to);

  // Create mint entity
  let mintId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let mint = new Mint(mintId);
  mint.token = token.id;
  mint.recipient = recipient.id;
  mint.amount = event.params.amount;
  mint.backingAtMint = BigInt.fromI32(0); // Will be updated from policy event
  mint.supplyAfterMint = event.params.newTotalSupply;
  mint.oracleTimestamp = BigInt.fromI32(0);
  mint.transactionHash = event.transaction.hash;
  mint.blockNumber = event.block.number;
  mint.timestamp = event.block.timestamp;
  mint.save();

  // Update token stats
  token.totalSupply = event.params.newTotalSupply;
  token.totalMinted = token.totalMinted.plus(event.params.amount);
  token.lastUpdated = event.block.timestamp;
  token.save();

  // Update recipient stats
  recipient.balance = recipient.balance.plus(event.params.amount);
  recipient.totalMintedTo = recipient.totalMintedTo.plus(event.params.amount);
  recipient.lastActivity = event.block.timestamp;
  if (recipient.firstActivity.equals(BigInt.fromI32(0))) {
    recipient.firstActivity = event.block.timestamp;
  }
  recipient.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.totalSupply = event.params.newTotalSupply;
  dailyStats.totalMinted = dailyStats.totalMinted.plus(event.params.amount);
  dailyStats.mintCount = dailyStats.mintCount.plus(BigInt.fromI32(1));
  dailyStats.mintVolume = dailyStats.mintVolume.plus(event.params.amount);
  dailyStats.save();

  log.info("SecureMint: {} tokens to {}", [
    event.params.amount.toString(),
    event.params.to.toHexString(),
  ]);
}

export function handleTransfer(event: Transfer): void {
  let token = getOrCreateToken(event.address);
  let from = getOrCreateHolder(event.params.from);
  let to = getOrCreateHolder(event.params.to);

  // Check if this is a burn (transfer to zero address)
  if (event.params.to.toHexString() == ZERO_ADDRESS) {
    let burnId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    let burn = new Burn(burnId);
    burn.token = token.id;
    burn.burner = from.id;
    burn.amount = event.params.value;
    burn.supplyAfterBurn = token.totalSupply.minus(event.params.value);
    burn.transactionHash = event.transaction.hash;
    burn.blockNumber = event.block.number;
    burn.timestamp = event.block.timestamp;
    burn.save();

    // Update token stats
    token.totalSupply = token.totalSupply.minus(event.params.value);
    token.totalBurned = token.totalBurned.plus(event.params.value);

    // Update holder stats
    from.balance = from.balance.minus(event.params.value);
    from.totalBurned = from.totalBurned.plus(event.params.value);

    // Update daily stats
    let dailyStats = getOrCreateDailyStats(event.block.timestamp);
    dailyStats.totalBurned = dailyStats.totalBurned.plus(event.params.value);
    dailyStats.burnCount = dailyStats.burnCount.plus(BigInt.fromI32(1));
    dailyStats.burnVolume = dailyStats.burnVolume.plus(event.params.value);
    dailyStats.save();

    log.info("Burn: {} tokens from {}", [
      event.params.value.toString(),
      event.params.from.toHexString(),
    ]);
  }
  // Check if this is a mint (transfer from zero address) - handled by SecureMint event
  else if (event.params.from.toHexString() != ZERO_ADDRESS) {
    // Regular transfer
    let transferId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    let transfer = new TransferEntity(transferId);
    transfer.token = token.id;
    transfer.from = from.id;
    transfer.to = to.id;
    transfer.amount = event.params.value;
    transfer.transactionHash = event.transaction.hash;
    transfer.blockNumber = event.block.number;
    transfer.timestamp = event.block.timestamp;
    transfer.save();

    // Update holder balances
    from.balance = from.balance.minus(event.params.value);
    from.lastActivity = event.block.timestamp;

    to.balance = to.balance.plus(event.params.value);
    to.lastActivity = event.block.timestamp;
    if (to.firstActivity.equals(BigInt.fromI32(0))) {
      to.firstActivity = event.block.timestamp;
    }

    // Update token stats
    token.transferCount = token.transferCount.plus(BigInt.fromI32(1));

    // Update daily stats
    let dailyStats = getOrCreateDailyStats(event.block.timestamp);
    dailyStats.transferCount = dailyStats.transferCount.plus(BigInt.fromI32(1));
    dailyStats.transferVolume = dailyStats.transferVolume.plus(event.params.value);
    dailyStats.save();
  }

  // Save entities
  token.lastUpdated = event.block.timestamp;
  token.save();
  from.save();
  to.save();
}

export function handleGuardianChanged(event: GuardianChanged): void {
  log.info("Guardian changed from {} to {}", [
    event.params.oldGuardian.toHexString(),
    event.params.newGuardian.toHexString(),
  ]);
}

export function handlePaused(event: Paused): void {
  log.info("Token paused by {}", [event.params.account.toHexString()]);
}

export function handleUnpaused(event: Unpaused): void {
  log.info("Token unpaused by {}", [event.params.account.toHexString()]);
}
