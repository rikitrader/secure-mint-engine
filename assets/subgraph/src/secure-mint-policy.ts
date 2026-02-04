import { BigInt, Address, Bytes, log } from "@graphprotocol/graph-ts";
import {
  SecureMintExecuted,
  EpochReset,
  Paused,
  Unpaused,
  EpochCapChangeProposed,
  EpochCapChangeExecuted,
} from "../generated/SecureMintPolicy/SecureMintPolicy";
import { Token, Mint, Oracle, DailyStats } from "../generated/schema";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getOrCreateToken(address: Address): Token {
  let token = Token.load(address.toHexString());

  if (token == null) {
    token = new Token(address.toHexString());
    token.name = "USD Backed Token";
    token.symbol = "USDB";
    token.decimals = 18;
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

export function handleSecureMintExecuted(event: SecureMintExecuted): void {
  // Find and update the mint entity created by token transfer
  let mintId = event.transaction.hash.toHexString() + "-" + (event.logIndex.toI32() - 1).toString();
  let mint = Mint.load(mintId);

  if (mint != null) {
    // Update with oracle data from policy event
    mint.backingAtMint = event.params.backing;
    mint.supplyAfterMint = event.params.newSupply;
    mint.oracleTimestamp = event.params.oracleTimestamp;
    mint.save();
  }

  // Update daily stats with backing info
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.verifiedBacking = event.params.backing;

  // Calculate health factor (backing / supply * 10000)
  if (event.params.newSupply.gt(BigInt.fromI32(0))) {
    let supplyIn6Decimals = event.params.newSupply.div(BigInt.fromI32(10).pow(12));
    if (supplyIn6Decimals.gt(BigInt.fromI32(0))) {
      dailyStats.healthFactor = event.params.backing
        .times(BigInt.fromI32(10000))
        .div(supplyIn6Decimals);
    }
  }
  dailyStats.save();

  log.info("SecureMintExecuted: {} tokens, backing: {}, new supply: {}", [
    event.params.amount.toString(),
    event.params.backing.toString(),
    event.params.newSupply.toString(),
  ]);
}

export function handleEpochReset(event: EpochReset): void {
  log.info("Epoch reset: new epoch {}, capacity {}", [
    event.params.newEpoch.toString(),
    event.params.epochCapacity.toString(),
  ]);
}

export function handlePolicyPaused(event: Paused): void {
  log.warning("SecureMintPolicy PAUSED by {}", [event.params.account.toHexString()]);
}

export function handlePolicyUnpaused(event: Unpaused): void {
  log.info("SecureMintPolicy unpaused by {}", [event.params.account.toHexString()]);
}

export function handleEpochCapChangeProposed(event: EpochCapChangeProposed): void {
  log.info("Epoch cap change proposed: {} -> {}, effective at {}", [
    event.params.currentCap.toString(),
    event.params.newCap.toString(),
    event.params.effectiveTime.toString(),
  ]);
}

export function handleEpochCapChangeExecuted(event: EpochCapChangeExecuted): void {
  log.info("Epoch cap change executed: new cap = {}", [
    event.params.newCap.toString(),
  ]);
}
