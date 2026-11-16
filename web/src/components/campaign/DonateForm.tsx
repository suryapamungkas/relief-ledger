import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWaitForTransactionReceipt } from "wagmi";
import { Droplets, HeartHandshake, LockKeyhole } from "lucide-react";
import { RELIEF_LEDGER_ABI } from "@/abi/ReliefLedger";
import { MOCK_USDC_ABI } from "@/abi/MockUSDC";
import { CONTRACT_ADDRESSES, MIN_DONATION } from "@/config/contracts";
import {
  useMinDonation,
  usePaused,
  useReliefLedgerWrite,
  useUSDCAllowance,
  useUSDCBalance,
  useUSDCWrite,
} from "@/hooks/useReliefLedger";
import { decodeContractError, useTransactionState } from "@/hooks/useTransactionState";
import { formatUSDCFull, parseUSDC } from "@/lib/format";
import { AmountInput } from "@/components/ui/AmountInput";
import { TransactionButton } from "@/components/ui/TransactionButton";
import { TxStatusModal } from "@/components/ui/TxStatusModal";

interface DonateFormProps {
  campaignId: bigint;
  deadline: number;
  status: string;
  onSuccess?: () => void;
}

/**
 * Exact-amount ERC-20 approve -> donate flow + MockUSDC faucet for Sepolia testing.
 */
export function DonateForm({ campaignId, deadline, status, onSuccess }: DonateFormProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: isPaused } = usePaused();
  const { data: minDonationChain } = useMinDonation();
  const { data: balanceRaw, refetch: refetchBalance } = useUSDCBalance(address);
  const { data: allowanceRaw, refetch: refetchAllowance } = useUSDCAllowance(
    address,
    CONTRACT_ADDRESSES.RELIEF_LEDGER
  );

  const usdcWrite = useUSDCWrite();
  const ledgerWrite = useReliefLedgerWrite();
  const { isLoading: waitFaucet, isSuccess: faucetSuccess } = useWaitForTransactionReceipt({
    hash: usdcWrite.hash,
  });

  const [rawAmount, setRawAmount] = useState("100");
  const [txTitle, setTxTitle] = useState("Transaction");
  const tx = useTransactionState();

  const balance = (balanceRaw as bigint | undefined) ?? 0n;
  const allowance = (allowanceRaw as bigint | undefined) ?? 0n;
  const minDonation = (minDonationChain as bigint | undefined) ?? MIN_DONATION;
  const parsedAmount = parseUSDC(rawAmount);

  const nowSec = Math.floor(Date.now() / 1000);
  const windowOpen = status === "Fundraising" && nowSec < deadline;

  let inputError: string | null = null;
  if (rawAmount.trim() !== "" && parsedAmount === null) {
    inputError = "Enter a valid number with up to 6 decimal places.";
  } else if (parsedAmount !== null && parsedAmount < minDonation) {
    inputError = `Minimum donation is ${formatUSDCFull(minDonation)} USDC.`;
  } else if (parsedAmount !== null && address && parsedAmount > balance) {
    inputError = "Insufficient MockUSDC balance. Claim test tokens below.";
  }

  const needsApproval = parsedAmount !== null && parsedAmount > allowance;

  useEffect(() => {
    if (faucetSuccess) {
      void refetchBalance();
      void refetchAllowance();
    }
  }, [faucetSuccess, refetchBalance, refetchAllowance]);

  useEffect(() => {
    if (usdcWrite.hash && usdcWrite.isConfirming) {
      tx.setPending(usdcWrite.hash);
    } else if (usdcWrite.hash && usdcWrite.isConfirmed) {
      tx.setConfirmed(usdcWrite.hash);
      void refetchBalance();
      void refetchAllowance();
    } else if (usdcWrite.error) {
      const msg = decodeContractError(usdcWrite.error);
      if (msg.toLowerCase().includes("rejected")) tx.setRejected(msg);
      else tx.setError(msg);
    }
  }, [usdcWrite.hash, usdcWrite.isConfirming, usdcWrite.isConfirmed, usdcWrite.error]);

  useEffect(() => {
    if (ledgerWrite.hash && ledgerWrite.isConfirming) {
      tx.setPending(ledgerWrite.hash);
    } else if (ledgerWrite.hash && ledgerWrite.isConfirmed) {
      tx.setConfirmed(ledgerWrite.hash);
      void refetchBalance();
      void refetchAllowance();
      onSuccess?.();
    } else if (ledgerWrite.error) {
      const msg = decodeContractError(ledgerWrite.error);
      if (msg.toLowerCase().includes("rejected")) tx.setRejected(msg);
      else tx.setError(msg);
    }
  }, [ledgerWrite.hash, ledgerWrite.isConfirming, ledgerWrite.isConfirmed, ledgerWrite.error]);

  function handleFaucet() {
    usdcWrite.reset();
    setTxTitle("Claim 1,000 MockUSDC");
    tx.setPrompt();
    usdcWrite.writeContract({
      address: CONTRACT_ADDRESSES.MOCK_USDC,
      abi: MOCK_USDC_ABI,
      functionName: "faucet",
    });
  }

  async function handleApproveOrDonate() {
    if (!parsedAmount || inputError) return;
    if (needsApproval) {
      usdcWrite.reset();
      setTxTitle(`Approve Exact ${formatUSDCFull(parsedAmount)} USDC`);
      tx.setPrompt();
      usdcWrite.approve(CONTRACT_ADDRESSES.RELIEF_LEDGER, parsedAmount);
      return;
    }

    ledgerWrite.reset();
    setTxTitle(`Donate ${formatUSDCFull(parsedAmount)} USDC`);
    tx.setPrompt();
    try {
      if (publicClient && address) {
        await publicClient.simulateContract({
          address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
          abi: RELIEF_LEDGER_ABI,
          functionName: "donate",
          args: [campaignId, parsedAmount],
          account: address,
        });
      }
      ledgerWrite.writeContract({
        address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
        abi: RELIEF_LEDGER_ABI,
        functionName: "donate",
        args: [campaignId, parsedAmount],
      });
    } catch (err) {
      tx.setError(decodeContractError(err));
    }
  }

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Contribute to Escrow</h3>
          <p className="mt-0.5 text-xs text-slate-600">
            Exact-amount allowance is requested—never unlimited token approvals.
          </p>
        </div>
        <HeartHandshake className="h-5 w-5 text-forest-700" aria-hidden="true" />
      </div>

      {address && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50/80 px-3.5 py-2.5 text-xs">
          <div>
            <span className="text-slate-600">Your MockUSDC: </span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {formatUSDCFull(balance)} USDC
            </span>
          </div>
          <button
            type="button"
            disabled={waitFaucet}
            onClick={handleFaucet}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-white px-2.5 py-1 font-semibold text-brand-700 transition hover:bg-brand-100 cursor-pointer"
          >
            <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
            Claim 1,000 Test USDC
          </button>
        </div>
      )}

      {!windowOpen ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4 text-xs text-slate-700">
          Fundraising window is currently closed or passed (`{status}`). Donations are locked once the deadline expires.
        </div>
      ) : (
        <>
          <AmountInput
            label="Donation Amount"
            hint={`Minimum: ${formatUSDCFull(minDonation)} USDC. Up to 6 decimal places.`}
            value={rawAmount}
            onChange={setRawAmount}
            error={inputError}
            onMaxClick={address ? () => setRawAmount(formatUSDCFull(balance).replace(/,/g, "")) : undefined}
            disabled={Boolean(isPaused)}
          />

          {Boolean(isPaused) && (
            <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
              Contract is currently paused by admin; new deposits are disabled while refunds remain open.
            </p>
          )}

          <div className="space-y-2">
            <TransactionButton
              fullWidth
              variant={needsApproval ? "primary" : "forest"}
              disabled={!parsedAmount || Boolean(inputError) || Boolean(isPaused)}
              loading={usdcWrite.isPending || ledgerWrite.isPending}
              onClick={handleApproveOrDonate}
            >
              {needsApproval ? (
                <>
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                  1/2 · Approve Exact {parsedAmount ? formatUSDCFull(parsedAmount) : ""} USDC
                </>
              ) : (
                <>
                  <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                  2/2 · Donate to Campaign Escrow
                </>
              )}
            </TransactionButton>

            <p className="text-center text-[11px] text-slate-600">
              Current allowance: {formatUSDCFull(allowance)} USDC
            </p>
          </div>
        </>
      )}

      <TxStatusModal tx={tx.state} actionTitle={txTitle} onClose={tx.reset} />
    </div>
  );
}
