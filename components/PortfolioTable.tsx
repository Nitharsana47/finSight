"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import ChangeBadge from "@/components/ChangeBadge";
import { removeHolding } from "@/lib/actions/portfolio.actions";
import { formatPrice } from "@/lib/utils";

const signedPrice = (n: number) => `${n >= 0 ? "+" : "-"}${formatPrice(Math.abs(n))}`;

const PortfolioTable = ({ holdings, totalValue }: { holdings: HoldingWithData[]; totalValue: number }) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onRemove = (h: HoldingWithData) => {
    if (!confirm(`Remove ${h.symbol} from your portfolio?`)) return;
    startTransition(async () => {
      const result = await removeHolding(h.id);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Holding</th>
            <th className="text-right hidden sm:table-cell">Shares</th>
            <th className="text-right hidden md:table-cell">Avg cost</th>
            <th className="text-right">Price</th>
            <th className="text-right hidden sm:table-cell">Today</th>
            <th className="text-right hidden md:table-cell">Value</th>
            <th className="text-right">Profit / loss</th>
            <th className="text-right hidden lg:table-cell">Weight</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const weight = totalValue ? (h.value / totalValue) * 100 : 0;
            return (
              <tr key={h.id}>
                <td>
                  <Link href={`/stocks/${h.symbol}`} className="flex items-center gap-3 group">
                    <span className="symbol-avatar">{h.symbol.slice(0, 4)}</span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-gray-100 group-hover:text-yellow-500 transition-colors">{h.symbol}</span>
                      <span className="block text-xs text-gray-500 truncate max-w-[140px] sm:max-w-[180px]">
                        <span className="sm:hidden">{h.shares.toLocaleString()} shares · </span>{h.company}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="text-right hidden sm:table-cell">{h.shares.toLocaleString()}</td>
                <td className="text-right text-gray-400 hidden md:table-cell">{formatPrice(h.avgPrice)}</td>
                <td className="text-right font-semibold">{h.currentPrice ? formatPrice(h.currentPrice) : "—"}</td>
                <td className="text-right hidden sm:table-cell"><ChangeBadge value={h.changePercent} /></td>
                <td className="text-right font-semibold hidden md:table-cell">{formatPrice(h.value)}</td>
                <td className={`text-right font-semibold ${h.profit >= 0 ? "text-up" : "text-down"}`}>
                  {signedPrice(h.profit)}
                  <span className="block text-xs font-medium">{h.profitPercent >= 0 ? "+" : ""}{h.profitPercent.toFixed(2)}%</span>
                </td>
                <td className="text-right hidden lg:table-cell">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-gray-600 overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${Math.min(100, weight)}%` }} />
                    </div>
                    <span className="text-gray-400 w-12 text-right">{weight.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="text-right">
                  <button className="btn-icon hover:text-red-500!" title="Remove holding" onClick={() => onRemove(h)} disabled={pending}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PortfolioTable;
