// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MockBackedToken
 * @notice Mock BackedToken for testing SecureMintPolicy and RedemptionEngine
 * @dev Simplified version that allows flexible mint policy setting
 */
contract MockBackedToken is ERC20, Pausable {
    address public secureMintPolicy;
    address public guardian;

    error OnlySecureMint();
    error OnlyGuardian();
    error ZeroAddress();

    event SecureMint(address indexed to, uint256 amount, uint256 newTotalSupply);
    event GuardianChanged(address indexed oldGuardian, address indexed newGuardian);

    constructor(
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        guardian = msg.sender;
    }

    modifier onlySecureMint() {
        if (msg.sender != secureMintPolicy) revert OnlySecureMint();
        _;
    }

    modifier onlyGuardian() {
        if (msg.sender != guardian) revert OnlyGuardian();
        _;
    }

    function setSecureMintPolicy(address _policy) external {
        secureMintPolicy = _policy;
    }

    function mint(address to, uint256 amount) external onlySecureMint whenNotPaused {
        _mint(to, amount);
        emit SecureMint(to, amount, totalSupply());
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external {
        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        unchecked {
            _approve(account, msg.sender, currentAllowance - amount);
        }
        _burn(account, amount);
    }

    function pause() external onlyGuardian {
        _pause();
    }

    function unpause() external onlyGuardian {
        _unpause();
    }

    function setGuardian(address newGuardian) external onlyGuardian {
        if (newGuardian == address(0)) revert ZeroAddress();
        emit GuardianChanged(guardian, newGuardian);
        guardian = newGuardian;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}
