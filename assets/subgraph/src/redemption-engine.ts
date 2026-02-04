import { BigInt, Address, Bytes, log } from "@graphprotocol/graph-ts";
import {
  RedemptionRequested,
  RedemptionExecuted,
  RedemptionCancelled,
  DailyLimitChanged,
  DepegSurchargeApplied,
} from "../generated/RedemptionEngine/RedemptionEngine";
import {
  RedemptionRequest,
  DailyRedemptionStats,
  Holder,
} from "../generated/schema";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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

function getOrCreateDailyRedemptionStats(timestamp: BigInt): DailyRedemptionStats {
  let dayId = getDayId(timestamp);
  let stats = DailyRedemptionStats.load(dayId);

  if (stats == null) {
    stats = new DailyRedemptionStats(dayId);
    stats.date = BigInt.fromI32((timestamp.toI32() / 86400) * 86400);
    stats.totalRequested = BigInt.fromI32(0);
    stats.totalExecuted = BigInt.fromI32(0);
    stats.totalCancelled = BigInt.fromI32(0);
    stats.requestCount = BigInt.fromI32(0);
    stats.executionCount = BigInt.fromI32(0);
    stats.cancellationCount = BigInt.fromI32(0);
    stats.avgRedemptionSize = BigInt.fromI32(0);
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleRedemptionRequested(event: RedemptionRequested): void {
  let holder = getOrCreateHolder(event.params.user);

  // Create or update redemption request
  let request = new RedemptionRequest(event.params.user.toHexString());
  request.user = holder.id;
  request.amount = event.params.amount;
  request.status = "PENDING";
  request.requestTimestamp = event.block.timestamp;
  request.unlockTimestamp = event.params.unlockTime;
  request.requestTxHash = event.transaction.hash;
  request.blockNumber = event.block.number;
  request.save();

  // Update holder
  holder.lastActivity = event.block.timestamp;
  holder.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyRedemptionStats(event.block.timestamp);
  dailyStats.totalRequested = dailyStats.totalRequested.plus(event.params.amount);
  dailyStats.requestCount = dailyStats.requestCount.plus(BigInt.fromI32(1));

  // Calculate average
  if (dailyStats.requestCount.gt(BigInt.fromI32(0))) {
    dailyStats.avgRedemptionSize = dailyStats.totalRequested.div(dailyStats.requestCount);
  }
  dailyStats.save();

  log.info("Redemption requested: {} tokens by {}, unlocks at {}", [
    event.params.amount.toString(),
    event.params.user.toHexString(),
    event.params.unlockTime.toString(),
  ]);
}

export function handleRedemptionExecuted(event: RedemptionExecuted): void {
  let request = RedemptionRequest.load(event.params.user.toHexString());

  if (request != null) {
    request.status = "EXECUTED";
    request.executedAmount = event.params.tokenAmount;
    request.executionTimestamp = event.block.timestamp;
    request.executionTxHash = event.transaction.hash;

    // Calculate fee (difference between token amount and reserve amount in token decimals)
    let reserveInTokenDecimals = event.params.reserveAmount.times(BigInt.fromI32(10).pow(12));
    if (event.params.tokenAmount.gt(reserveInTokenDecimals)) {
      request.feeAmount = event.params.tokenAmount.minus(reserveInTokenDecimals);
    } else {
      request.feeAmount = BigInt.fromI32(0);
    }

    request.save();
  }

  // Update holder
  let holder = getOrCreateHolder(event.params.user);
  holder.totalBurned = holder.totalBurned.plus(event.params.tokenAmount);
  holder.lastActivity = event.block.timestamp;
  holder.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyRedemptionStats(event.block.timestamp);
  dailyStats.totalExecuted = dailyStats.totalExecuted.plus(event.params.tokenAmount);
  dailyStats.executionCount = dailyStats.executionCount.plus(BigInt.fromI32(1));
  dailyStats.save();

  log.info("Redemption executed: {} tokens -> {} reserve for {}", [
    event.params.tokenAmount.toString(),
    event.params.reserveAmount.toString(),
    event.params.user.toHexString(),
  ]);
}

export function handleRedemptionCancelled(event: RedemptionCancelled): void {
  let request = RedemptionRequest.load(event.params.user.toHexString());

  if (request != null) {
    request.status = "CANCELLED";
    request.save();
  }

  // Update holder
  let holder = getOrCreateHolder(event.params.user);
  holder.lastActivity = event.block.timestamp;
  holder.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyRedemptionStats(event.block.timestamp);
  dailyStats.totalCancelled = dailyStats.totalCancelled.plus(event.params.amount);
  dailyStats.cancellationCount = dailyStats.cancellationCount.plus(BigInt.fromI32(1));
  dailyStats.save();

  log.info("Redemption cancelled: {} tokens by {}", [
    event.params.amount.toString(),
    event.params.user.toHexString(),
  ]);
}

export function handleDailyLimitChanged(event: DailyLimitChanged): void {
  log.info("Daily redemption limit changed to {}", [
    event.params.newLimit.toString(),
  ]);
}

export function handleDepegSurchargeApplied(event: DepegSurchargeApplied): void {
  let request = RedemptionRequest.load(event.params.user.toHexString());

  if (request != null) {
    request.surchargeAmount = event.params.surchargeAmount;
    request.save();
  }

  log.info("Depeg surcharge applied: {} for {}", [
    event.params.surchargeAmount.toString(),
    event.params.user.toHexString(),
  ]);
}
