/**
 * ABI for the ReliefLedger contract – events only (all we need to index).
 */
export const RELIEF_LEDGER_ABI = [
  // ─── Events ─────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "VendorSet",
    inputs: [
      { name: "vendor", type: "address", indexed: true },
      { name: "allowed", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CampaignCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "organizer", type: "address", indexed: true },
      { name: "verifiers", type: "address[]", indexed: false },
      { name: "threshold", type: "uint8", indexed: false },
      { name: "minGoal", type: "uint256", indexed: false },
      { name: "donationDeadline", type: "uint64", indexed: false },
      { name: "challengePeriod", type: "uint64", indexed: false },
      { name: "stallTimeout", type: "uint64", indexed: false },
      { name: "milestoneBps", type: "uint16[]", indexed: false },
      { name: "metadataCid", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Donated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "donor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FundraisingFinalized",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "success", type: "bool", indexed: false },
      { name: "raised", type: "uint256", indexed: false },
      { name: "allocations", type: "uint256[]", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PayoutProposed",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "requestId", type: "uint256", indexed: true },
      { name: "milestone", type: "uint8", indexed: false },
      { name: "vendor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "invoiceCid", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PayoutApproved",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "verifier", type: "address", indexed: true },
      { name: "approvals", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ThresholdReached",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "executableAt", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PayoutVetoed",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "verifier", type: "address", indexed: true },
      { name: "reasonCid", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PayoutCancelled",
    inputs: [{ name: "requestId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "PayoutExecuted",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "requestId", type: "uint256", indexed: true },
      { name: "vendor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DeliverySubmitted",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "milestone", type: "uint8", indexed: false },
      { name: "deliveryCid", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CampaignCompleted",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "refundPool", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StallRefundTriggered",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "refundPool", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Refunded",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "donor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
