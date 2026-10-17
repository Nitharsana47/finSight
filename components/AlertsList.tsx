"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, Pencil, Trash2 } from "lucide-react";
import AlertModal from "@/components/AlertModal";
import { deleteAlert } from "@/lib/actions/alert.actions";
import { formatPrice, getAlertText } from "@/lib/utils";

const AlertsList = ({ alertData }: AlertsListProps) => {
  const router = useRouter();
  const [editing, setEditing] = useState<Alert | null>(null);
  const [pending, startTransition] = useTransition();
  const alerts = alertData ?? [];

  const onDelete = (alert: Alert) => {
    startTransition(async () => {
      const result = await deleteAlert(alert.id);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="card-title flex items-center gap-2">
          <BellRing className="h-5 w-5 text-yellow-500" /> Price alerts
        </h2>
        <span className="badge badge-muted">{alerts.filter((a) => a.active).length} active</span>
      </div>

      {alerts.length === 0 ? (
        <div className="alert-empty">
          No alerts yet. Use the bell icon on a watchlist stock to create one.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {alerts.map((alert) => {
            const distance = alert.currentPrice ? ((alert.threshold - alert.currentPrice) / alert.currentPrice) * 100 : null;
            return (
              <li key={alert.id} className={`alert-item ${alert.active ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="alert-name mb-0! truncate">{alert.alertName}</p>
                  {alert.active ? (
                    <span className="badge badge-up shrink-0">Active</span>
                  ) : (
                    <span className="badge bg-yellow-500/10 text-yellow-500 shrink-0">Triggered</span>
                  )}
                </div>
                <div className="alert-details border-gray-600">
                  <Link href={`/stocks/${alert.symbol}`} className="min-w-0 hover:text-yellow-500">
                    <p className="font-semibold text-gray-100">{alert.symbol}</p>
                    <p className="alert-company truncate text-sm!">{alert.company}</p>
                  </Link>
                  <div className="text-right">
                    <p className="alert-price tabular-nums">{alert.currentPrice ? formatPrice(alert.currentPrice) : "—"}</p>
                    {alert.active && distance !== null && (
                      <p className="text-xs text-gray-500 tabular-nums">{Math.abs(distance).toFixed(1)}% to target</p>
                    )}
                  </div>
                </div>
                <div className="alert-actions">
                  <div className="text-sm">
                    <p className={alert.alertType === "upper" ? "text-up" : "text-down"}>{getAlertText(alert)}</p>
                    {!alert.active && alert.triggeredAt && (
                      <p className="text-xs text-gray-500">
                        Hit {alert.triggeredPrice ? formatPrice(alert.triggeredPrice) : ""} on {new Date(alert.triggeredAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-icon" title={alert.active ? "Edit alert" : "Edit and re-activate"} onClick={() => setEditing(alert)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="btn-icon hover:text-red-500!" title="Delete alert" onClick={() => onDelete(alert)} disabled={pending}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertModal
        open={Boolean(editing)}
        setOpen={(o) => !o && setEditing(null)}
        alertId={editing?.id}
        currentPrice={editing?.currentPrice || undefined}
        alertData={
          editing
            ? { symbol: editing.symbol, company: editing.company, alertName: editing.alertName, alertType: editing.alertType, threshold: String(editing.threshold) }
            : undefined
        }
      />
    </div>
  );
};

export default AlertsList;
