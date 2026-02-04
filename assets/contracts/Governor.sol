// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";

/**
 * @title SecureMintGovernor
 * @notice DAO governance contract for SecureMintEngine protocol
 * @dev Implements token-weighted voting with timelock execution
 *
 * GOVERNANCE PARAMETERS:
 * - Voting Delay: 1 day (time between proposal and voting start)
 * - Voting Period: 5 days
 * - Proposal Threshold: 1% of total supply (to prevent spam)
 * - Quorum: 4% of total supply
 *
 * PROPOSAL TYPES:
 * - Standard: Normal governance proposals
 * - Emergency: Reduced timelock for critical fixes
 * - Veto: Guardian can veto malicious proposals during timelock
 *
 * SECURITY:
 * - All execution goes through timelock
 * - Guardian veto power for emergency situations
 * - Cannot change core invariants via governance
 */
contract SecureMintGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Guardian address with veto power
    address public guardian;

    /// @notice Mapping of vetoed proposal IDs
    mapping(uint256 => bool) public vetoedProposals;

    /// @notice Proposal types for different execution paths
    enum ProposalType {
        STANDARD,
        EMERGENCY,
        PARAMETER_CHANGE
    }

    /// @notice Mapping of proposal ID to type
    mapping(uint256 => ProposalType) public proposalTypes;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event ProposalVetoed(uint256 indexed proposalId, address indexed vetoedBy, string reason);
    event GuardianChanged(address indexed oldGuardian, address indexed newGuardian);
    event ProposalTypeSet(uint256 indexed proposalId, ProposalType proposalType);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error OnlyGuardian();
    error ProposalAlreadyVetoed();
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Initialize the governor
     * @param _token Governance token address (IVotes)
     * @param _timelock Timelock controller address
     * @param _guardian Guardian address with veto power
     * @param _votingDelay Delay before voting starts (in blocks)
     * @param _votingPeriod Duration of voting (in blocks)
     * @param _proposalThreshold Minimum tokens to create proposal
     * @param _quorumPercentage Quorum percentage (1-100)
     */
    constructor(
        IVotes _token,
        TimelockController _timelock,
        address _guardian,
        uint48 _votingDelay,
        uint32 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumPercentage
    )
        Governor("SecureMint Governor")
        GovernorSettings(_votingDelay, _votingPeriod, _proposalThreshold)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(_quorumPercentage)
        GovernorTimelockControl(_timelock)
    {
        if (_guardian == address(0)) revert ZeroAddress();
        guardian = _guardian;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GUARDIAN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Veto a proposal (guardian only)
     * @dev Can only veto during timelock period (after vote passes, before execution)
     * @param proposalId Proposal to veto
     * @param reason Reason for veto
     */
    function veto(uint256 proposalId, string calldata reason) external {
        if (msg.sender != guardian) revert OnlyGuardian();
        if (vetoedProposals[proposalId]) revert ProposalAlreadyVetoed();

        ProposalState currentState = state(proposalId);
        require(
            currentState == ProposalState.Queued,
            "Can only veto queued proposals"
        );

        vetoedProposals[proposalId] = true;

        emit ProposalVetoed(proposalId, msg.sender, reason);
    }

    /**
     * @notice Transfer guardian role
     * @param newGuardian New guardian address
     */
    function setGuardian(address newGuardian) external {
        if (msg.sender != guardian) revert OnlyGuardian();
        if (newGuardian == address(0)) revert ZeroAddress();

        emit GuardianChanged(guardian, newGuardian);
        guardian = newGuardian;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PROPOSAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a proposal with type annotation
     * @param targets Target addresses
     * @param values ETH values
     * @param calldatas Call data
     * @param description Proposal description
     * @param proposalType Type of proposal
     */
    function proposeWithType(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        ProposalType proposalType
    ) external returns (uint256) {
        uint256 proposalId = propose(targets, values, calldatas, description);
        proposalTypes[proposalId] = proposalType;
        emit ProposalTypeSet(proposalId, proposalType);
        return proposalId;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // OVERRIDES
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Override state to include veto check
     */
    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        if (vetoedProposals[proposalId]) {
            return ProposalState.Defeated;
        }
        return super.state(proposalId);
    }

    /**
     * @notice Override execute to check veto status
     */
    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        require(!vetoedProposals[proposalId], "Proposal was vetoed");
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    // Required overrides for multiple inheritance

    function votingDelay()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }
}
