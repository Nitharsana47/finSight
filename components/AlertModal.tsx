"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createAlert, updateAlert } from "@/lib/actions/alert.actions";
import { cn, formatPrice } from "@/lib/utils";

type Props = AlertModalProps & { currentPrice?: number };

const emptyForm = (data?: AlertData): AlertData => ({
  symbol: data?.symbol ?? "",
  company: data?.company ?? "",
  alertName: data?.alertName ?? "",
  alertType: data?.alertType ?? "upper",
  threshold: data?.threshold ?? "",
});

const AlertModal = ({ alertId, alertData, open, setOpen, currentPrice }: Props) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<AlertData>(emptyForm(alertData));
  const isEdit = Boolean(alertId);

  useEffect(() => {
    if (open) {
      const initial = emptyForm(alertData);
      if (!initial.alertName && initial.symbol) initial.alertName = `${initial.symbol} price alert`;
      setForm(initial);
    }
  }, [open, alertData]);

  const set = <K extends keyof AlertData>(key: K, value: AlertData[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = isEdit ? await updateAlert(alertId!, form) : await createAlert(form);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="modal">
        <DialogHeader>
          <DialogTitle className="text-xl text-gray-100">{isEdit ? "Edit price alert" : "Create price alert"}</DialogTitle>
          <DialogDescription className="text-gray-500">
            We check prices every 5 minutes and email you when your target is hit.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 mt-2">
          <div className="flex items-center justify-between rounded-xl bg-gray-900/60 border border-gray-600/60 px-4 py-3">
            <div>
              <p className="font-semibold text-gray-100">{form.symbol || "—"}</p>
              <p className="text-sm text-gray-500 truncate max-w-[220px]">{form.company}</p>
            </div>
            {currentPrice ? (
              <div className="text-right">
                <p className="text-xs text-gray-500">Current</p>
                <p className="font-semibold text-gray-100 tabular-nums">{formatPrice(currentPrice)}</p>
              </div>
            ) : null}
          </div>

          <div>
            <label className="field-label" htmlFor="alertName">Alert name</label>
            <input id="alertName" className="field-input" value={form.alertName} onChange={(e) => set("alertName", e.target.value)} placeholder="e.g. Apple breakout" required maxLength={60} />
          </div>

          <div>
            <span className="field-label">Notify me when the price</span>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "upper", label: "Rises above", icon: TrendingUp, active: "border-teal-400 bg-teal-400/10 text-teal-400" },
                { value: "lower", label: "Falls below", icon: TrendingDown, active: "border-red-500 bg-red-500/10 text-red-500" },
              ] as const).map(({ value, label, icon: Icon, active }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set("alertType", value)}
                  className={cn(
                    "flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                    form.alertType === value ? active : "border-gray-600 text-gray-400 hover:border-gray-500"
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="threshold">Target price (USD)</label>
            <input
              id="threshold"
              className="field-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={form.threshold}
              onChange={(e) => set("threshold", e.target.value)}
              placeholder={currentPrice ? currentPrice.toFixed(2) : "0.00"}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full h-11" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create alert"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AlertModal;
