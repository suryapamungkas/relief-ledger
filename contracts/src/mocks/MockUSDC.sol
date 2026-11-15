// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC — Testnet-only faucet stablecoin. NOT real USDC.
/// @author Nur Hidayat Surya Pamungkas
/// @notice 6 decimals. `faucet()` mints 1 000 mUSDC once per address per day.
/// @dev DO NOT deploy to mainnet.
contract MockUSDC is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 1000e6;
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    mapping(address => uint256) public lastFaucet;

    error FaucetCooldown(uint256 availableAt);

    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint 1 000 mUSDC to the caller. Once per day per address.
    function faucet() external {
        uint256 last = lastFaucet[msg.sender];
        if (last != 0 && block.timestamp < last + FAUCET_COOLDOWN) {
            revert FaucetCooldown(last + FAUCET_COOLDOWN);
        }
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Unrestricted mint for deploy scripts and tests.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
