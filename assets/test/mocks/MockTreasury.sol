// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockTreasury
 * @notice Mock treasury for testing RedemptionEngine
 * @dev Simplified treasury that allows withdrawal by authorized address
 */
contract MockTreasury {
    using SafeERC20 for IERC20;

    IERC20 public reserveAsset;
    address public redemptionEngine;

    error OnlyRedemptionEngine();
    error InsufficientBalance();

    constructor(address _reserveAsset) {
        reserveAsset = IERC20(_reserveAsset);
    }

    function setRedemptionEngine(address _engine) external {
        redemptionEngine = _engine;
    }

    function totalReserves() external view returns (uint256) {
        return reserveAsset.balanceOf(address(this));
    }

    function withdraw(address to, uint256 amount) external {
        if (msg.sender != redemptionEngine) revert OnlyRedemptionEngine();
        if (reserveAsset.balanceOf(address(this)) < amount) revert InsufficientBalance();

        reserveAsset.safeTransfer(to, amount);
    }

    function withdrawForRedemption(
        address to,
        uint256 amount,
        string calldata /* reason */
    ) external {
        if (msg.sender != redemptionEngine) revert OnlyRedemptionEngine();
        if (reserveAsset.balanceOf(address(this)) < amount) revert InsufficientBalance();

        reserveAsset.safeTransfer(to, amount);
    }

    // Allow direct deposits for testing
    function deposit(uint256 amount) external {
        reserveAsset.safeTransferFrom(msg.sender, address(this), amount);
    }
}
