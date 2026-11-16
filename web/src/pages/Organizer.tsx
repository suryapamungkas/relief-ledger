import { useState, useEffect, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { useAccount, usePublicClient } from "wagmi";
import { FileUp, PackageCheck, Send, AlertTriangle } from "lucide-react";
import { isAddress } from "viem";
import { RELIEF_LEDGER_ABI } from "@/abi/ReliefLedger";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { useReliefLedgerWrite } from "@/hooks/useReliefLedger";
import { useCampaignsList } from "@/hooks/useIndexer";
import { decodeContractError, useTransactionState } from "@/hooks/useTransactionState";
import { AmountInput } from "@/components/ui/AmountInput";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { TransactionButton } from "@/components/ui/TransactionButton";
import { TxStatusModal } from "@/components/ui/TxStatusModal";
import { parseUSDC } from "@/lib/format";

const STATUS_MAP: Record<string, number> = {
  Fundraising: 0,
  Active: 1,
  Completed: 2,
  Refunding: 3,
};

export function Organizer() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { campaigns, loading, reload } = useCampaignsList();
  const write = useReliefLedgerWrite();
  const tx = useTransactionState();

  const [selectedId, setSelectedId] = useState<string>("");
  const [vendor, setVendor] = useState("");
  const [amountStr, setAmountStr] = useState("100");
  const [invoiceCid, setInvoiceCid] = useState("");
  const [deliveryCid, setDeliveryCid] = useState("");
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [txTitle, setTxTitle] = useState("Organizer Action");

  const myCampaigns = campaigns.filter(
    (c) => address && c.organizer.toLowerCase() === address.toLowerCase()
  );

  useEffect(() => {
    if (!selectedId && myCampaigns[0]) {
      setSelectedId(String(myCampaigns[0].id));
    }
  }, [myCampaigns, selectedId]);

  useEffect(() => {
    if (write.hash && write.isConfirming) tx.setPending(write.hash);
    else if (write.hash && write.isConfirmed) {
      tx.setConfirmed(write.hash);
      void reload();
    } else if (write.error) {
      const msg = decodeContractError(write.error);
      if (msg.toLowerCase().includes("rejected")) tx.setRejected(msg);
      else tx.setError(msg);
    }
  }, [write.hash, write.isConfirming, write.isConfirmed, write.error]);

  async function handleIpfsUpload(e: ChangeEvent<HTMLInputElement>, target: "invoice" | "delivery") {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadNotice("File exceeds 5 MB limit.");
      return;
    }

    setUploading(true);
    setUploadNotice(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = (await res.json()) as { cid?: string; error?: string };
      if (!res.ok || !data.cid) {
        setUploadNotice(data.error ?? "Upload unavailable; paste an ipfs:// CID directly.");
      } else {
        if (target === "invoice") setInvoiceCid(data.cid);
        else setDeliveryCid(data.cid);
        setUploadNotice(`Pinned to IPFS: ${data.cid}`);
      }
    } catch {
      setUploadNotice("Could not reach /api/upload. You may paste a pre-pinned CID directly.");
    } finally {
      setUploading(false);
    }
  }

  async function submitPayoutProposal() {
    if (!address || !selectedId) return;
    const parsed = parseUSDC(amountStr);
    if (!isAddress(vendor) || !parsed || !invoiceCid.trim()) return;

    write.reset();
    setTxTitle(`Propose Vendor Payout · Campaign #${selectedId}`);
    tx.setPrompt();
    try {
      if (publicClient) {
        await publicClient.simulateContract({
          address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
          abi: RELIEF_LEDGER_ABI,
          functionName: "proposePayout",
          args: [BigInt(selectedId), vendor as `0x${string}`, parsed, invoiceCid.trim()],
          account: address,
        });
      }
      write.writeContract({
        address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
        abi: RELIEF_LEDGER_ABI,
        functionName: "proposePayout",
        args: [BigInt(selectedId), vendor as `0x${string}`, parsed, invoiceCid.trim()],
      });
    } catch (err) {
      tx.setError(decodeContractError(err));
    }
  }

  async function submitDeliveryProof() {
    if (!address || !selectedId || !deliveryCid.trim()) return;

    write.reset();
    setTxTitle(`Submit Delivery Proof · Campaign #${selectedId}`);
    tx.setPrompt();
    try {
      if (publicClient) {
        await publicClient.simulateContract({
          address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
          abi: RELIEF_LEDGER_ABI,
          functionName: "submitDelivery",
          args: [BigInt(selectedId), deliveryCid.trim()],
          account: address,
        });
      }
      write.writeContract({
        address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
        abi: RELIEF_LEDGER_ABI,
        functionName: "submitDelivery",
        args: [BigInt(selectedId), deliveryCid.trim()],
      });
    } catch (err) {
      tx.setError(decodeContractError(err));
    }
  }

  const parsedAmount = parseUSDC(amountStr);
  const vendorError = vendor.length > 0 && !isAddress(vendor) ? "Enter a valid 0x vendor address." : null;
  const amountError = amountStr.length > 0 && !parsedAmount ? "Enter a valid USDC amount (max 6 decimals)." : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Organizer Console</h1>
        <p className="mt-1 text-sm text-slate-600">
          Propose invoice-backed vendor payouts and submit milestone delivery evidence to unlock subsequent tranches.
        </p>
      </div>

      {/* Privacy notice per SPEC §9.3 */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
        <p>
          <strong>Public IPFS Warning:</strong> Uploaded invoices and delivery photos become permanently public on IPFS, and EXIF metadata is not stripped automatically. Remove sensitive metadata before uploading.
        </p>
      </div>

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : !address ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-slate-700">
          Connect your organizer wallet on Sepolia to manage campaigns.
        </div>
      ) : myCampaigns.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-slate-700">
          Your connected address (
          <code className="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-800">
            {address}
          </code>
          ) is not the organizer of any active campaign yet.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myCampaigns.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(String(c.id))}
                className={`glass text-left rounded-2xl p-5 transition cursor-pointer ${
                  selectedId === String(c.id) ? "border-brand-600 glow-sm" : "glass-hover"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">Campaign #{c.id}</span>
                  <Badge label={c.status} variant={statusToBadgeVariant(STATUS_MAP[c.status] ?? 0)} />
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Milestone {c.currentMilestone + 1} / {c.milestoneBps.length} ·{" "}
                  <Link to={`/campaign/${c.id}`} className="font-semibold text-brand-700 hover:underline">
                    View details
                  </Link>
                </p>
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Propose Vendor Payout */}
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Send className="h-5 w-5 text-brand-700" aria-hidden="true" />
                Propose Vendor Payout (Campaign #{selectedId})
              </div>

              <div className="space-y-1.5">
                <label htmlFor="org-vendor" className="block text-sm font-semibold text-slate-800">
                  Allowlisted Vendor Address
                </label>
                <p className="text-xs text-slate-600">
                  Must be pre-registered by admin and cannot be an organizer or verifier.
                </p>
                <input
                  id="org-vendor"
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="0x..."
                  aria-invalid={Boolean(vendorError) || undefined}
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-4 py-2.5 font-mono text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                />
                {vendorError && <p className="text-xs font-medium text-rose-700">{vendorError}</p>}
              </div>

              <AmountInput
                label="Payout Amount"
                hint="Cannot exceed the campaign's currentAvailable milestone balance."
                value={amountStr}
                onChange={setAmountStr}
                error={amountError}
                quickAmounts={["100", "500", "1000"]}
              />

              <div className="space-y-2">
                <label htmlFor="org-invoice-cid" className="block text-sm font-semibold text-slate-800">
                  Vendor Invoice IPFS CID
                </label>
                <p className="text-xs text-slate-600">
                  Contract hashes `keccak256(invoiceCid)` on-chain for audit verification.
                </p>
                <input
                  id="org-invoice-cid"
                  type="text"
                  value={invoiceCid}
                  onChange={(e) => setInvoiceCid(e.target.value)}
                  placeholder="ipfs://Qm..."
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-4 py-2.5 font-mono text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                />
                <label className="inline-flex items-center gap-2 rounded-xl border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100 cursor-pointer">
                  <FileUp className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
                  <span>{uploading ? "Uploading…" : "Upload Invoice (PNG/JPG/PDF <= 5 MB)"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    className="sr-only"
                    onChange={(e) => void handleIpfsUpload(e, "invoice")}
                  />
                </label>
              </div>

              <TransactionButton
                fullWidth
                variant="primary"
                disabled={!isAddress(vendor) || !parsedAmount || invoiceCid.trim().length === 0}
                loading={write.isPending}
                onClick={submitPayoutProposal}
              >
                Submit Payout Proposal
              </TransactionButton>
            </div>

            {/* Submit Delivery Proof */}
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <PackageCheck className="h-5 w-5 text-forest-700" aria-hidden="true" />
                Submit Milestone Delivery Proof
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                Requires at least one executed vendor payout in the current milestone and zero open payout requests. Unspent milestone funds roll forward—or convert into donor refunds after the final milestone.
              </p>

              <div className="space-y-2">
                <label htmlFor="org-delivery-cid" className="block text-sm font-semibold text-slate-800">
                  Delivery Proof IPFS CID
                </label>
                <input
                  id="org-delivery-cid"
                  type="text"
                  value={deliveryCid}
                  onChange={(e) => setDeliveryCid(e.target.value)}
                  placeholder="ipfs://QmDelivery..."
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-4 py-2.5 font-mono text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                />
                <label className="inline-flex items-center gap-2 rounded-xl border border-forest-600/35 bg-forest-50 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-100 cursor-pointer">
                  <FileUp className="h-3.5 w-3.5 text-forest-700" aria-hidden="true" />
                  <span>{uploading ? "Uploading…" : "Upload Proof (PNG/JPG/PDF <= 5 MB)"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    className="sr-only"
                    onChange={(e) => void handleIpfsUpload(e, "delivery")}
                  />
                </label>
              </div>

              {uploadNotice && (
                <p className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs text-slate-800">
                  {uploadNotice}
                </p>
              )}

              <TransactionButton
                fullWidth
                variant="forest"
                disabled={deliveryCid.trim().length === 0}
                loading={write.isPending}
                onClick={submitDeliveryProof}
              >
                Record Delivery & Advance Milestone
              </TransactionButton>
            </div>
          </div>
        </>
      )}

      <TxStatusModal tx={tx.state} actionTitle={txTitle} onClose={tx.reset} />
    </div>
  );
}
