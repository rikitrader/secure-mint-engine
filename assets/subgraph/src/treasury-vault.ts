import { BigInt, Address, Bytes, log } from "@graphprotocol/graph-ts";
import {
  Deposit,
  Withdrawal,
  TierTransfer,
  Rebalanced,
  AllocationProposed,
  AllocationExecuted,
  EmergencyWithdrawal,
} from "../generated/TreasuryVault/TreasuryVault";
import {
  Treasury,
  TreasuryDeposit,
  TreasuryWithdrawal,
  TreasuryRebalance,
  DailyStats,
} from "../generated/schema";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getOrCreateTreasury(address: Address): Treasury {
  let treasury = Treasury.load(address.toHexString());

  if (treasury == null) {
    treasury = new Treasury(address.toHexString());
    treasury.reserveAsset = Address.zero();
    treasury.totalReserves = BigInt.fromI32(0);
    treasury.tier0Balance = BigInt.fromI32(0);
    treasury.tier1Balance = BigInt.fromI32(0);
    treasury.tier2Balance = BigInt.fromI32(0);
    treasury.tier3Balance = BigInt.fromI32(0);
    treasury.tier0Allocation = BigInt.fromI32(1000);
    treasury.tier1Allocation = BigInt.fromI32(2000);
    treasury.tier2Allocation = BigInt.fromI32(5000);
    treasury.tier3Allocation = BigInt.fromI32(2000);
    treasury.createdAt = BigInt.fromI32(0);
    treasury.lastUpdated = BigInt.fromI32(0);
  }

  return treasury;
}

function getDayId(timestamp: BigInt): string {
  let dayTimestamp = timestamp.toI32() / 86400;
  return dayTimestamp.toString();
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleDeposit(event: Deposit): void {
  let treasury = getOrCreateTreasury(event.address);

  // Create deposit entity
  let depositId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let deposit = new TreasuryDeposit(depositId);
  deposit.treasury = treasury.id;
  deposit.depositor = event.params.from;
  deposit.amount = event.params.amount;
  deposit.tier = event.params.tier;
  deposit.transactionHash = event.transaction.hash;
  deposit.blockNumber = event.block.number;
  deposit.timestamp = event.block.timestamp;
  deposit.save();

  // Update treasury balances
  treasury.totalReserves = treasury.totalReserves.plus(event.params.amount);

  if (event.params.tier == 0) {
    treasury.tier0Balance = treasury.tier0Balance.plus(event.params.amount);
  } else if (event.params.tier == 1) {
    treasury.tier1Balance = treasury.tier1Balance.plus(event.params.amount);
  } else if (event.params.tier == 2) {
    treasury.tier2Balance = treasury.tier2Balance.plus(event.params.amount);
  } else if (event.params.tier == 3) {
    treasury.tier3Balance = treasury.tier3Balance.plus(event.params.amount);
  }

  treasury.lastUpdated = event.block.timestamp;
  if (treasury.createdAt.equals(BigInt.fromI32(0))) {
    treasury.createdAt = event.block.timestamp;
  }
  treasury.save();

  log.info("Treasury deposit: {} to tier {}", [
    event.params.amount.toString(),
    event.params.tier.toString(),
  ]);
}

export function handleWithdrawal(event: Withdrawal): void {
  let treasury = getOrCreateTreasury(event.address);

  // Create withdrawal entity
  let withdrawalId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let withdrawal = new TreasuryWithdrawal(withdrawalId);
  withdrawal.treasury = treasury.id;
  withdrawal.recipient = event.params.to;
  withdrawal.amount = event.params.amount;
  withdrawal.tier = event.params.tier;
  withdrawal.reason = event.params.reason;
  withdrawal.transactionHash = event.transaction.hash;
  withdrawal.blockNumber = event.block.number;
  withdrawal.timestamp = event.block.timestamp;
  withdrawal.save();

  // Update treasury balances
  treasury.totalReserves = treasury.totalReserves.minus(event.params.amount);

  if (event.params.tier == 0) {
    treasury.tier0Balance = treasury.tier0Balance.minus(event.params.amount);
  } else if (event.params.tier == 1) {
    treasury.tier1Balance = treasury.tier1Balance.minus(event.params.amount);
  } else if (event.params.tier == 2) {
    treasury.tier2Balance = treasury.tier2Balance.minus(event.params.amount);
  } else if (event.params.tier == 3) {
    treasury.tier3Balance = treasury.tier3Balance.minus(event.params.amount);
  }

  treasury.lastUpdated = event.block.timestamp;
  treasury.save();

  log.info("Treasury withdrawal: {} from tier {} to {}", [
    event.params.amount.toString(),
    event.params.tier.toString(),
    event.params.to.toHexString(),
  ]);
}

export function handleEmergencyWithdrawal(event: EmergencyWithdrawal): void {
  let treasury = getOrCreateTreasury(event.address);

  // Create withdrawal entity (marked as emergency)
  let withdrawalId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let withdrawal = new TreasuryWithdrawal(withdrawalId);
  withdrawal.treasury = treasury.id;
  withdrawal.recipient = event.params.to;
  withdrawal.amount = event.params.amount;
  withdrawal.tier = null; // Emergency withdrawals span tiers
  withdrawal.reason = "EMERGENCY: " + event.params.reason;
  withdrawal.transactionHash = event.transaction.hash;
  withdrawal.blockNumber = event.block.number;
  withdrawal.timestamp = event.block.timestamp;
  withdrawal.save();

  // Update total reserves (tier-specific updates would need additional event data)
  treasury.totalReserves = treasury.totalReserves.minus(event.params.amount);
  treasury.lastUpdated = event.block.timestamp;
  treasury.save();

  log.warning("EMERGENCY Treasury withdrawal: {} to {}", [
    event.params.amount.toString(),
    event.params.to.toHexString(),
  ]);
}

export function handleTierTransfer(event: TierTransfer): void {
  let treasury = getOrCreateTreasury(event.address);

  // Update source tier
  if (event.params.fromTier == 0) {
    treasury.tier0Balance = treasury.tier0Balance.minus(event.params.amount);
  } else if (event.params.fromTier == 1) {
    treasury.tier1Balance = treasury.tier1Balance.minus(event.params.amount);
  } else if (event.params.fromTier == 2) {
    treasury.tier2Balance = treasury.tier2Balance.minus(event.params.amount);
  } else if (event.params.fromTier == 3) {
    treasury.tier3Balance = treasury.tier3Balance.minus(event.params.amount);
  }

  // Update destination tier
  if (event.params.toTier == 0) {
    treasury.tier0Balance = treasury.tier0Balance.plus(event.params.amount);
  } else if (event.params.toTier == 1) {
    treasury.tier1Balance = treasury.tier1Balance.plus(event.params.amount);
  } else if (event.params.toTier == 2) {
    treasury.tier2Balance = treasury.tier2Balance.plus(event.params.amount);
  } else if (event.params.toTier == 3) {
    treasury.tier3Balance = treasury.tier3Balance.plus(event.params.amount);
  }

  treasury.lastUpdated = event.block.timestamp;
  treasury.save();

  log.info("Tier transfer: {} from tier {} to tier {}", [
    event.params.amount.toString(),
    event.params.fromTier.toString(),
    event.params.toTier.toString(),
  ]);
}

export function handleRebalanced(event: Rebalanced): void {
  let treasury = getOrCreateTreasury(event.address);

  // Create rebalance entity
  let rebalanceId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let rebalance = new TreasuryRebalance(rebalanceId);
  rebalance.treasury = treasury.id;

  // Old balances
  rebalance.tier0Before = event.params.oldBalances[0];
  rebalance.tier1Before = event.params.oldBalances[1];
  rebalance.tier2Before = event.params.oldBalances[2];
  rebalance.tier3Before = event.params.oldBalances[3];

  // New balances
  rebalance.tier0After = event.params.newBalances[0];
  rebalance.tier1After = event.params.newBalances[1];
  rebalance.tier2After = event.params.newBalances[2];
  rebalance.tier3After = event.params.newBalances[3];

  rebalance.transactionHash = event.transaction.hash;
  rebalance.blockNumber = event.block.number;
  rebalance.timestamp = event.block.timestamp;
  rebalance.save();

  // Update treasury with new balances
  treasury.tier0Balance = event.params.newBalances[0];
  treasury.tier1Balance = event.params.newBalances[1];
  treasury.tier2Balance = event.params.newBalances[2];
  treasury.tier3Balance = event.params.newBalances[3];
  treasury.lastUpdated = event.block.timestamp;
  treasury.save();

  log.info("Treasury rebalanced", []);
}

export function handleAllocationProposed(event: AllocationProposed): void {
  log.info("New allocation proposed: [{}, {}, {}, {}] at {}", [
    event.params.newAllocations[0].toString(),
    event.params.newAllocations[1].toString(),
    event.params.newAllocations[2].toString(),
    event.params.newAllocations[3].toString(),
    event.params.effectiveTime.toString(),
  ]);
}

export function handleAllocationExecuted(event: AllocationExecuted): void {
  let treasury = getOrCreateTreasury(event.address);

  treasury.tier0Allocation = event.params.newAllocations[0];
  treasury.tier1Allocation = event.params.newAllocations[1];
  treasury.tier2Allocation = event.params.newAllocations[2];
  treasury.tier3Allocation = event.params.newAllocations[3];
  treasury.lastUpdated = event.block.timestamp;
  treasury.save();

  log.info("Allocation executed: [{}, {}, {}, {}]", [
    event.params.newAllocations[0].toString(),
    event.params.newAllocations[1].toString(),
    event.params.newAllocations[2].toString(),
    event.params.newAllocations[3].toString(),
  ]);
}
