# ReliefLedger Smart Contracts

Foundry workspace for the **ReliefLedger** milestone-based disaster-relief escrow system on Ethereum Sepolia.

- **Author:** Nur Hidayat Surya Pamungkas
- **License:** [MIT](../LICENSE)

## Contracts

- [`src/ReliefLedger.sol`](src/ReliefLedger.sol) — Non-upgradeable escrow contract implementing campaign isolation, vendor allowlist payouts, strict majority verifier approval, single-verifier challenge veto, and pull-based pro-rata refunds.
- [`src/interfaces/IReliefLedger.sol`](src/interfaces/IReliefLedger.sol) — Campaign structs, enums, events, and custom errors.
- [`src/mocks/MockUSDC.sol`](src/mocks/MockUSDC.sol) — Testnet-only 6-decimal ERC-20 with `faucet()` (`1000 mUSDC` / 24h cooldown).

## Commands

```bash
# Check formatting
forge fmt --check

# Compile & check contract bytecode sizes
forge build --sizes

# Run unit, fuzz, and invariant tests
forge test -vv

# Coverage summary
forge coverage --ir-minimum --report summary

# Update gas snapshot
forge snapshot

# Local simulation / Sepolia deployment
forge script script/Deploy.s.sol
forge script script/SeedDemo.s.sol
```
