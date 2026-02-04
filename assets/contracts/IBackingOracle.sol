// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBackingOracle
 * @notice Interface for backing verification oracles (Proof-of-Reserve or collateral oracles)
 * @dev Implement this interface for any oracle providing backing data to SecureMintPolicy
 */
interface IBackingOracle {
    /**
     * @notice Returns the current verified backing amount
     * @return backing The total backing in the token's base unit
     */
    function getVerifiedBacking() external view returns (uint256 backing);

    /**
     * @notice Returns whether the oracle data is healthy and usable
     * @return healthy True if oracle data is fresh and valid
     */
    function isHealthy() external view returns (bool healthy);

    /**
     * @notice Returns the timestamp of the last oracle update
     * @return timestamp Unix timestamp of last update
     */
    function lastUpdate() external view returns (uint256 timestamp);

    /**
     * @notice Returns the age of the current data in seconds
     * @return age Seconds since last update
     */
    function getDataAge() external view returns (uint256 age);

    /**
     * @notice Returns the required backing for a given supply
     * @param supply The total supply to calculate backing for
     * @return required The minimum backing required
     */
    function getRequiredBacking(uint256 supply) external view returns (uint256 required);

    /**
     * @notice Checks if minting a specific amount would maintain backing requirements
     * @param currentSupply Current total supply
     * @param mintAmount Amount to be minted
     * @return allowed True if mint would maintain backing requirements
     */
    function canMint(uint256 currentSupply, uint256 mintAmount) external view returns (bool allowed);
}

/**
 * @title IProofOfReserve
 * @notice Extended interface for Proof-of-Reserve oracles (off-chain reserves)
 */
interface IProofOfReserve is IBackingOracle {
    /**
     * @notice Returns the attestation details
     * @return attestor Address/identifier of the attestor
     * @return attestationTime Time of attestation
     * @return reserveAmount Attested reserve amount
     */
    function getAttestation() external view returns (
        address attestor,
        uint256 attestationTime,
        uint256 reserveAmount
    );

    /**
     * @notice Returns the number of required attestors
     * @return count Minimum attestors required
     */
    function requiredAttestors() external view returns (uint256 count);

    /**
     * @notice Returns the current attestor count
     * @return count Current number of valid attestations
     */
    function currentAttestorCount() external view returns (uint256 count);
}

/**
 * @title ICollateralOracle
 * @notice Extended interface for on-chain collateral oracles
 */
interface ICollateralOracle is IBackingOracle {
    /**
     * @notice Returns the current collateral ratio in basis points
     * @return ratio Collateral ratio (e.g., 15000 = 150%)
     */
    function getCollateralRatio() external view returns (uint256 ratio);

    /**
     * @notice Returns the price of collateral in base units
     * @return price Collateral price
     */
    function getCollateralPrice() external view returns (uint256 price);

    /**
     * @notice Returns whether the price is within acceptable deviation
     * @return valid True if price deviation is acceptable
     */
    function isPriceValid() external view returns (bool valid);

    /**
     * @notice Returns the TWAP price for manipulation resistance
     * @param period TWAP period in seconds
     * @return twapPrice Time-weighted average price
     */
    function getTWAP(uint256 period) external view returns (uint256 twapPrice);
}
