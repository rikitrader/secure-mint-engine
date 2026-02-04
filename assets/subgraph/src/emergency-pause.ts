import { BigInt, Address, Bytes, log } from "@graphprotocol/graph-ts";
import {
  AlertLevelChanged,
  TriggerRegistered,
  TriggerConditionMet,
} from "../generated/EmergencyPause/EmergencyPause";
import { EmergencyState, AlertLevelChange } from "../generated/schema";

// Alert level constants
const LEVEL_NAMES = ["NORMAL", "ELEVATED", "RESTRICTED", "EMERGENCY", "SHUTDOWN"];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getOrCreateEmergencyState(address: Address): EmergencyState {
  let state = EmergencyState.load(address.toHexString());

  if (state == null) {
    state = new EmergencyState(address.toHexString());
    state.currentLevel = 0; // NORMAL
    state.isPaused = false;
    state.lastLevelChange = BigInt.fromI32(0);
    state.createdAt = BigInt.fromI32(0);
    state.lastUpdated = BigInt.fromI32(0);
  }

  return state;
}

function isPausedAtLevel(level: i32): boolean {
  // EMERGENCY (3) and SHUTDOWN (4) are paused states
  return level >= 3;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleAlertLevelChanged(event: AlertLevelChanged): void {
  let emergencyState = getOrCreateEmergencyState(event.address);

  // Create level change entity
  let changeId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let levelChange = new AlertLevelChange(changeId);
  levelChange.emergencyState = emergencyState.id;
  levelChange.previousLevel = event.params.previousLevel;
  levelChange.newLevel = event.params.newLevel;
  levelChange.changedBy = event.params.changedBy;
  levelChange.reason = event.params.reason;
  levelChange.transactionHash = event.transaction.hash;
  levelChange.blockNumber = event.block.number;
  levelChange.timestamp = event.block.timestamp;
  levelChange.save();

  // Update emergency state
  emergencyState.currentLevel = event.params.newLevel;
  emergencyState.isPaused = isPausedAtLevel(event.params.newLevel);
  emergencyState.lastLevelChange = event.block.timestamp;
  emergencyState.lastUpdated = event.block.timestamp;

  if (emergencyState.createdAt.equals(BigInt.fromI32(0))) {
    emergencyState.createdAt = event.block.timestamp;
  }

  emergencyState.save();

  let previousLevelName = event.params.previousLevel < 5
    ? LEVEL_NAMES[event.params.previousLevel]
    : "UNKNOWN";
  let newLevelName = event.params.newLevel < 5
    ? LEVEL_NAMES[event.params.newLevel]
    : "UNKNOWN";

  log.info("Alert level changed: {} -> {} by {} ({})", [
    previousLevelName,
    newLevelName,
    event.params.changedBy.toHexString(),
    event.params.reason,
  ]);

  // Log warning for high alert levels
  if (event.params.newLevel >= 3) {
    log.warning("HIGH ALERT: System at {} level!", [newLevelName]);
  }
}

export function handleTriggerRegistered(event: TriggerRegistered): void {
  log.info("Trigger registered: {} -> level {}", [
    event.params.condition.toHexString(),
    event.params.level.toString(),
  ]);
}

export function handleTriggerConditionMet(event: TriggerConditionMet): void {
  log.warning("Trigger condition met: {} - escalating to level {}", [
    event.params.condition.toHexString(),
    event.params.newLevel.toString(),
  ]);
}
