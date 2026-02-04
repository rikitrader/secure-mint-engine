// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title BackedToken
 * @notice Minimal ERC-20 token with restricted mint capability
 * @dev This token is a "dumb ledger" - all business logic lives in SecureMintPolicy
 *
 * SECURITY REQUIREMENTS:
 * - No embedded business logic
 * - No discretionary mint
 * - Mint function callable ONLY by SecureMintPolicy contract
 * - Burn allowed (user or protocol-initiated)
 *
 * WARNING: Once deployed, the secureMintPolicy address is IMMUTABLE.
 * This is intentional to prevent mint authority changes.
 */
contract BackedToken is ERC20, ERC20Burnable, Pausable {
    /// @notice The only address authorized to mint tokens
    address public immutable secureMintPolicy;

    /// @notice The guardian address that can pause/unpause in emergencies
    address public guardian;

    /// @notice Emitted when guardian is changed
    event GuardianChanged(address indexed previousGuardian, address indexed newGuardian);

    /// @notice Emitted when tokens are minted via SecureMintPolicy
    event SecureMint(address indexed to, uint256 amount, uint256 newTotalSupply);

    error OnlySecureMint();
    error OnlyGuardian();
    error ZeroAddress();

    /**
     * @notice Constructor sets the SecureMintPolicy address immutably
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _secureMintPolicy Address of the SecureMintPolicy contract
     * @param _guardian Initial guardian address for emergency pause
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _secureMintPolicy,
        address _guardian
    ) ERC20(_name, _symbol) {
        if (_secureMintPolicy == address(0)) revert ZeroAddress();
        if (_guardian == address(0)) revert ZeroAddress();

        secureMintPolicy = _secureMintPolicy;
        guardian = _guardian;
    }

    /**
     * @notice Modifier restricting function to SecureMintPolicy only
     */
    modifier onlySecureMint() {
        if (msg.sender != secureMintPolicy) revert OnlySecureMint();
        _;
    }

    /**
     * @notice Modifier restricting function to guardian only
     */
    modifier onlyGuardian() {
        if (msg.sender != guardian) revert OnlyGuardian();
        _;
    }

    /**
     * @notice Mint tokens - ONLY callable by SecureMintPolicy
     * @dev All backing verification happens in SecureMintPolicy before this is called
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlySecureMint whenNotPaused {
        _mint(to, amount);
        emit SecureMint(to, amount, totalSupply());
    }

    /**
     * @notice Pause all transfers and minting
     * @dev Can only be called by guardian
     */
    function pause() external onlyGuardian {
        _pause();
    }

    /**
     * @notice Unpause transfers and minting
     * @dev Can only be called by guardian
     */
    function unpause() external onlyGuardian {
        _unpause();
    }

    /**
     * @notice Change the guardian address
     * @dev Can only be called by current guardian
     * @param newGuardian New guardian address
     */
    function setGuardian(address newGuardian) external onlyGuardian {
        if (newGuardian == address(0)) revert ZeroAddress();
        emit GuardianChanged(guardian, newGuardian);
        guardian = newGuardian;
    }

    /**
     * @notice Override to add pause check to transfers
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}
