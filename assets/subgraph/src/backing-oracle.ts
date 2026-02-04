import { BigInt, Address, Bytes, log } from "@graphprotocol/graph-ts";
import {
  AttestationSubmitted,
  ConsensusReached,
  HealthStatusChanged,
} from "../generated/BackingOraclePoR/BackingOraclePoR";
import { Oracle, Attestation, OracleHealthChange } from "../generated/schema";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getOrCreateOracle(address: Address): Oracle {
  let oracle = Oracle.load(address.toHexString());

  if (oracle == null) {
    oracle = new Oracle(address.toHexString());
    oracle.isHealthy = false;
    oracle.verifiedBacking = BigInt.fromI32(0);
    oracle.lastUpdate = BigInt.fromI32(0);
    oracle.minAttestors = 2;
    oracle.backingRatio = BigInt.fromI32(10000); // 100%
    oracle.attestationCount = BigInt.fromI32(0);
    oracle.createdAt = BigInt.fromI32(0);
    oracle.lastUpdated = BigInt.fromI32(0);
  }

  return oracle;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleAttestationSubmitted(event: AttestationSubmitted): void {
  let oracle = getOrCreateOracle(event.address);

  // Create attestation entity
  let attestationId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let attestation = new Attestation(attestationId);
  attestation.oracle = oracle.id;
  attestation.attestor = event.params.attestor;
  attestation.backing = event.params.backing;
  attestation.proof = event.params.proof;
  attestation.transactionHash = event.transaction.hash;
  attestation.blockNumber = event.block.number;
  attestation.timestamp = event.block.timestamp;
  attestation.save();

  // Update oracle stats
  oracle.attestationCount = oracle.attestationCount.plus(BigInt.fromI32(1));
  oracle.lastUpdated = event.block.timestamp;

  if (oracle.createdAt.equals(BigInt.fromI32(0))) {
    oracle.createdAt = event.block.timestamp;
  }

  oracle.save();

  log.info("Attestation submitted by {} with backing {}", [
    event.params.attestor.toHexString(),
    event.params.backing.toString(),
  ]);
}

export function handleConsensusReached(event: ConsensusReached): void {
  let oracle = getOrCreateOracle(event.address);

  oracle.verifiedBacking = event.params.verifiedBacking;
  oracle.lastUpdate = event.params.timestamp;
  oracle.lastUpdated = event.block.timestamp;
  oracle.save();

  log.info("Oracle consensus reached: backing = {}", [
    event.params.verifiedBacking.toString(),
  ]);
}

export function handleHealthStatusChanged(event: HealthStatusChanged): void {
  let oracle = getOrCreateOracle(event.address);

  // Create health change entity
  let changeId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let healthChange = new OracleHealthChange(changeId);
  healthChange.oracle = oracle.id;
  healthChange.wasHealthy = event.params.wasHealthy;
  healthChange.isHealthy = event.params.isHealthy;
  healthChange.reason = event.params.reason;
  healthChange.transactionHash = event.transaction.hash;
  healthChange.blockNumber = event.block.number;
  healthChange.timestamp = event.block.timestamp;
  healthChange.save();

  // Update oracle
  oracle.isHealthy = event.params.isHealthy;
  oracle.lastUpdated = event.block.timestamp;
  oracle.save();

  log.info("Oracle health changed: {} -> {} ({})", [
    event.params.wasHealthy.toString(),
    event.params.isHealthy.toString(),
    event.params.reason,
  ]);
}
