import { useState, useCallback } from "react";

export type TxPhase = "idle" | "prompt" | "pending" | "confirmed" | "reverted" | "rejected";

export interface TxState {
  phase: TxPhase;
  hash?: `0x${string}`;
  error?: string;
}

export function useTransactionState() {
  const [state, setState] = useState<TxState>({ phase: "idle" });

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  const setPrompt = useCallback(() => setState({ phase: "prompt" }), []);

  const setPending = useCallback((hash: `0x${string}`) => setState({ phase: "pending", hash }), []);

  const setConfirmed = useCallback((hash: `0x${string}`) => setState({ phase: "confirmed", hash }), []);

  const setReverted = useCallback((hash: `0x${string}`, error?: string) =>
    setState({ phase: "reverted", hash, error }), []);

  const setRejected = useCallback((error?: string) =>
    setState({ phase: "rejected", error }), []);

  const setError = useCallback((error: string) =>
    setState({ phase: "reverted", error }), []);

  return {
    state,
    reset,
    setPrompt,
    setPending,
    setConfirmed,
    setReverted,
    setRejected,
    setError,
  };
}

/**
 * Decode a contract error into a human-readable message.
 */
export function decodeContractError(error: unknown): string {
  if (!error || typeof error !== "object") return "Unknown error";
  const e = error as Record<string, unknown>;

  // User rejected
  if (typeof e["message"] === "string") {
    const msg = e["message"] as string;
    if (msg.includes("User rejected") || msg.includes("user rejected")) {
      return "Transaction rejected by user.";
    }
    // Custom error names
    const customErrors: Record<string, string> = {
      ZeroAddress: "Zero address not allowed.",
      InvalidAmount: "Invalid amount.",
      InvalidCidLength: "CID length is invalid (must be 1–128 chars).",
      InvalidGoal: "Min goal must be greater than zero.",
      InvalidDeadline: "Donation deadline is invalid.",
      InvalidVerifierCount: "Must have 3–9 verifiers.",
      DuplicateVerifier: "Duplicate verifier address.",
      OrganizerCannotBeVerifier: "Organizer cannot be a verifier.",
      InvalidThreshold: "Approval threshold is invalid (must be strict majority).",
      InvalidChallengePeriod: "Challenge period must be 24h–7 days.",
      InvalidStallTimeout: "Stall timeout must be 14–90 days.",
      InvalidMilestoneCount: "Must have 1–5 milestones.",
      InvalidMilestoneBps: "Each milestone allocation must be > 0.",
      MilestoneBpsSumNot10000: "Milestone percentages must sum to 100%.",
      NotFundraising: "Campaign is not in fundraising phase.",
      DeadlineNotPassed: "Donation deadline has not passed yet.",
      DeadlinePassed: "Donation deadline has already passed.",
      DonationTooSmall: "Donation is below the minimum (1 USDC).",
      FeeOnTransferNotAllowed: "Fee-on-transfer tokens are not supported.",
      NotActive: "Campaign is not active.",
      NotOrganizer: "Only the campaign organizer can do this.",
      OpenRequestExists: "There is already an open payout request.",
      VendorNotRegistered: "Vendor is not registered.",
      VendorIsOrganizer: "Vendor cannot be the organizer.",
      VendorIsVerifier: "Vendor cannot be a campaign verifier.",
      AmountExceedsAvailable: "Amount exceeds available funds in this milestone.",
      NotVerifier: "Only campaign verifiers can do this.",
      AlreadyVoted: "You have already voted on this request.",
      AlreadyApproved: "Request already has enough approvals.",
      RequestNotProposed: "Request is not in proposed state.",
      ChallengeNotElapsed: "Challenge period has not elapsed yet.",
      VendorRemoved: "Vendor was removed from the registry.",
      StallNotElapsed: "Stall timeout has not elapsed yet.",
      NotRefunding: "Campaign is not in refunding state.",
      NothingToRefund: "You have no contribution to refund.",
      AlreadyRefunded: "You have already claimed your refund.",
      NoPaidInMilestone: "No funds have been paid in this milestone.",
      RenounceDisabled: "Renouncing ownership is disabled.",
      SelfAddress: "Cannot use contract's own address.",
      CampaignNotFound: "Campaign not found on-chain.",
      RequestNotFound: "Payout request not found on-chain.",
      NotApproved: "Payout request has not reached verifier approval threshold yet.",
      EnforcedPause: "Contract is paused.",
    };

    for (const [key, friendly] of Object.entries(customErrors)) {
      if (msg.includes(key)) return friendly;
    }

    // Truncate long messages
    if (msg.length > 120) return msg.slice(0, 120) + "…";
    return msg;
  }

  return "An unexpected error occurred.";
}
