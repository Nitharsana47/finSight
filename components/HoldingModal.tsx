"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addHolding } from "@/lib/actions/portfolio.actions";
import { formatPrice } from "@/lib/utils";

type Props = {
  symbol?: string;
  company?: string;
  currentPrice?: number;
  triggerLabel?: string;
  triggerClassName?: string;
};

const HoldingModal = ({ symbol, company, currentPrice, triggerLabel = "Add holding", triggerClassName = "btn-primary" }: Props) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ symbol: symbol ?? "", shares: "", avgPrice: "" });

  useEffect(() => {
    if (open) setForm({ symbol: symbol ?? "", shares: "", avgPrice: currentPrice ? currentPrice.toFixed(2) : "" });
  }, [open, symbol, currentPrice]);

  const shares = Number(form.shares);
  const price = Number(form.avgPrice);
  const total = shares > 0 && price > 0 ? shares * price : 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await addHolding({ symbol: form.symbol, company, shares: form.shares, avgPrice: form.avgPrice });
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {triggerLabel}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="modal">
          <DialogHeader>
            <DialogTitle className="text-xl text-gray-100">Add to portfolio</DialogTitle>
            <DialogDescription className="text-gray-500">
              Record a purchase. Buying more of a stock you own updates your average price.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            <div>
              <label className="field-label" htmlFor="h-symbol">Stock symbol</label>
              <input
                id="h-symbol"
                className="field-input uppercase"
                value={form.symbol}
                onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                placeholder="e.g. AAPL"
                disabled={Boolean(symbol)}
                required
                maxLength={12}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="h-shares">Shares</label>
                <input id="h-shares" className="field-input" type="number" step="any" min="0" inputMode="decimal" value={form.shares} onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value }))} placeholder="10" required />
              </div>
              <div>
                <label className="field-label" htmlFor="h-price">Buy price (USD)</label>
                <input id="h-price" className="field-input" type="number" step="0.01" min="0" inputMode="decimal" value={form.avgPrice} onChange={(e) => setForm((f) => ({ ...f, avgPrice: e.target.value }))} placeholder="0.00" required />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-gray-900/60 border border-gray-600/60 px-4 py-3 text-sm">
              <span className="text-gray-500">Total invested</span>
              <span className="font-semibold text-gray-100 tabular-nums">{formatPrice(total)}</span>
            </div>

            <button type="submit" className="btn-primary w-full h-11" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add holding
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HoldingModal;
