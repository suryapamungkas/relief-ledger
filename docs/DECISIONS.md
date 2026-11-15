# ReliefLedger — Architectural Decision Records (ADR)

This log documents key engineering decisions, alternatives considered, and concrete trade-offs encountered during implementation.

---

## ADR-001: Single Non-Upgradeable Escrow Contract

- **Decision:** Deploy a single monolithic `ReliefLedger.sol` managing all campaigns via `mapping(uint256 => Campaign)`, without UUPS or Transparent proxies.
- **Rationale:** Donors depositing relief funds require immutable guarantees that rules (`minGoal`, verifiers, challenge window, vendor-only payouts) cannot be swapped out beneath them by an upgrade key.
- **Trade-off:** Bug fixes or feature additions require deploying a new v2 contract while allowing existing v1 campaigns to wind down cleanly.

## ADR-002: Custom `viem` + SQLite + Express Indexer (Replacing Ponder)

- **Decision:** Build `indexer/` directly on `viem`, `better-sqlite3` (`^12.9.0`), and `express` rather than Ponder.
- **Rationale:** Matches SPEC §3/§8 fallback explicitly, works cleanly across Node 20–24 + Windows/Linux CI environments with deterministic SQLite schema migrations, includes parent-block-hash chain reorg detection + `CONFIRMATIONS` finality safety, and preserves exact `bigint` arithmetic serialized as JSON strings.
- **Trade-off:** Polling `eth_getLogs` in 2,000-block chunks adds minor indexing latency (`POLL_INTERVAL_MS`, default 12s) compared to WebSocket subscriptions, and frontend falls back seamlessly to direct on-chain `viem` views when the indexer is offline.

## ADR-003: Stack-Depth Extraction & `--ir-minimum` Coverage Flag

- **Decision:** Extract `_validateCreateParams(CreateParams calldata)` helper in `ReliefLedger.sol` and run `forge coverage --ir-minimum --report summary`.
- **Rationale:** Emitting the 10-field `CampaignCreated` event alongside inline validation in `createCampaign` triggered `Stack too deep` under unoptimized standard compilation and unoptimized coverage instrumentation. Extracting `_validateCreateParams` keeps `forge build` and `forge test` passing cleanly with standard settings (`optimizer_runs = 200`), while `--ir-minimum` enables Foundry coverage instrumentation (`99.17%` line coverage, `97.47%` branch coverage on `ReliefLedger.sol`).
- **Trade-off:** Coverage reports note `--ir-minimum` source-map approximation; behavior is independently verified under standard `forge test` + 12,800-call stateful invariant fuzzing.

## ADR-004: Store `keccak256(invoiceCid)` On-Chain, Emit Full Strings in Logs

- **Decision:** Only `metadataCid` resides in campaign storage, while payout requests store `bytes32 invoiceHash = keccak256(bytes(invoiceCid))` and emit the full string in `PayoutProposed`, `PayoutVetoed`, and `DeliverySubmitted` events.
- **Rationale:** Saves SSTORE gas while allowing donors and verifiers to deterministically verify off-chain invoice CIDs against the immutable on-chain `bytes32` digest in the UI (`IpfsVerifyBadge`).

## ADR-005: `better-sqlite3@^12.9.0` + `"DOM"` Lib in Indexer `tsconfig.json`

- **Decision:** Target `better-sqlite3@^12.9.0` for prebuilt native binaries on modern Node runtimes (Node 20–24 without local Visual Studio C++ toolchain) and include `"DOM"` in `indexer/tsconfig.json` `lib` so transitive `viem -> ox/webauthn` TypeScript sources typecheck cleanly.

## ADR-006: Browser-Native Top-Layer `<dialog>`, Pure `bigint` Money Formatting, and Motion Reduced-Motion Support

- **Decision:** Implement modals with native HTML `<dialog>` (`showModal()`, `overscroll-behavior: contain`, `@starting-style`), tabs with full WAI-ARIA keyboard navigation, responsive `@container` table stacking, pure `bigint`/`viem` `formatUnits`/`parseUnits` formatting, and `<MotionConfig reducedMotion="user">` across all animations.
- **Rationale:** Eliminates token floating-point precision loss (SPEC §9.2), ensures top-layer accessibility without body scroll-lock hacks, and maintains smooth 60fps compositor transforms even for users requesting reduced motion.
