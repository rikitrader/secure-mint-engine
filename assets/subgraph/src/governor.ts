import { BigInt, Address, Bytes, log } from "@graphprotocol/graph-ts";
import {
  ProposalCreated,
  ProposalExecuted,
  ProposalCanceled,
  VoteCast,
  ProposalVetoed,
  ProposalQueued,
} from "../generated/SecureMintGovernor/SecureMintGovernor";
import { GovernanceProposal } from "../generated/schema";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getOrCreateProposal(proposalId: BigInt): GovernanceProposal {
  let id = proposalId.toString();
  let proposal = GovernanceProposal.load(id);

  if (proposal == null) {
    proposal = new GovernanceProposal(id);
    proposal.proposer = Address.zero();
    proposal.description = "";
    proposal.targets = [];
    proposal.values = [];
    proposal.calldatas = [];
    proposal.forVotes = BigInt.fromI32(0);
    proposal.againstVotes = BigInt.fromI32(0);
    proposal.abstainVotes = BigInt.fromI32(0);
    proposal.status = "PENDING";
    proposal.vetoed = false;
    proposal.proposedAt = BigInt.fromI32(0);
    proposal.votingStartBlock = BigInt.fromI32(0);
    proposal.votingEndBlock = BigInt.fromI32(0);
  }

  return proposal;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handleProposalCreated(event: ProposalCreated): void {
  let proposal = getOrCreateProposal(event.params.proposalId);

  proposal.proposer = event.params.proposer;
  proposal.description = event.params.description;

  // Convert Address[] to Bytes[]
  let targets: Bytes[] = [];
  for (let i = 0; i < event.params.targets.length; i++) {
    targets.push(event.params.targets[i] as Bytes);
  }
  proposal.targets = targets;

  proposal.values = event.params.values;
  proposal.calldatas = event.params.calldatas;
  proposal.status = "PENDING";
  proposal.proposedAt = event.block.timestamp;
  proposal.votingStartBlock = event.params.startBlock;
  proposal.votingEndBlock = event.params.endBlock;
  proposal.save();

  log.info("Proposal created: {} by {}", [
    event.params.proposalId.toString(),
    event.params.proposer.toHexString(),
  ]);
}

export function handleVoteCast(event: VoteCast): void {
  let proposal = getOrCreateProposal(event.params.proposalId);

  // Update vote counts based on support value
  // 0 = Against, 1 = For, 2 = Abstain
  if (event.params.support == 0) {
    proposal.againstVotes = proposal.againstVotes.plus(event.params.weight);
  } else if (event.params.support == 1) {
    proposal.forVotes = proposal.forVotes.plus(event.params.weight);
  } else if (event.params.support == 2) {
    proposal.abstainVotes = proposal.abstainVotes.plus(event.params.weight);
  }

  // Update status to ACTIVE if voting has started
  if (proposal.status == "PENDING") {
    proposal.status = "ACTIVE";
  }

  proposal.save();

  log.info("Vote cast on proposal {}: {} votes (support: {})", [
    event.params.proposalId.toString(),
    event.params.weight.toString(),
    event.params.support.toString(),
  ]);
}

export function handleProposalQueued(event: ProposalQueued): void {
  let proposal = getOrCreateProposal(event.params.proposalId);
  proposal.status = "QUEUED";
  proposal.save();

  log.info("Proposal queued: {}", [event.params.proposalId.toString()]);
}

export function handleProposalExecuted(event: ProposalExecuted): void {
  let proposal = getOrCreateProposal(event.params.proposalId);
  proposal.status = "EXECUTED";
  proposal.executedAt = event.block.timestamp;
  proposal.save();

  log.info("Proposal executed: {}", [event.params.proposalId.toString()]);
}

export function handleProposalCanceled(event: ProposalCanceled): void {
  let proposal = getOrCreateProposal(event.params.proposalId);
  proposal.status = "CANCELLED";
  proposal.cancelledAt = event.block.timestamp;
  proposal.save();

  log.info("Proposal cancelled: {}", [event.params.proposalId.toString()]);
}

export function handleProposalVetoed(event: ProposalVetoed): void {
  let proposal = getOrCreateProposal(event.params.proposalId);
  proposal.status = "VETOED";
  proposal.vetoed = true;
  proposal.vetoedBy = event.params.vetoer;
  proposal.save();

  log.info("Proposal vetoed: {} by {}", [
    event.params.proposalId.toString(),
    event.params.vetoer.toHexString(),
  ]);
}
