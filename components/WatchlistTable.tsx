"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellPlus } from "lucide-react";
import WatchlistButton from "@/components/WatchlistButton";
import AlertModal from "@/components/AlertModal";
import ChangeBadge from "@/components/ChangeBadge";
import { formatPrice } from "@/lib/utils";

const WatchlistTable = ({ watchlist }: WatchlistTableProps) => {
  const router = useRouter();
  const [alertFor, setAlertFor] = useState<StockWithData | null>(null);

  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>Company</th>
              <th className="text-right">Price</th>
              <th className="text-right hidden sm:table-cell">Today</th>
              <th className="hidden md:table-cell">Added</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((stock) => (
              <tr key={stock.symbol} className="cursor-pointer" onClick={() => router.push(`/stocks/${stock.symbol}`)}>
                <td onClick={(e) => e.stopPropagation()}>
                  <WatchlistButton
                    type="icon"
                    symbol={stock.symbol}
                    company={stock.company}
                    isInWatchlist
                    onWatchlistChange={() => router.refresh()}
                  />
                </td>
                <td>
                  <Link href={`/stocks/${stock.symbol}`} className="flex items-center gap-3 group" onClick={(e) => e.stopPropagation()}>
                    <span className="symbol-avatar">{stock.symbol.slice(0, 4)}</span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-gray-100 group-hover:text-yellow-500 transition-colors">{stock.symbol}</span>
                      <span className="block text-xs text-gray-500 truncate max-w-[120px] sm:max-w-[220px]">{stock.company}</span>
                    </span>
                  </Link>
                </td>
                <td className="text-right font-semibold">{stock.currentPrice ? formatPrice(stock.currentPrice) : "—"}</td>
                <td className="text-right hidden sm:table-cell">
                  <ChangeBadge value={stock.changePercent} />
                </td>
                <td className="hidden md:table-cell text-gray-500">{new Date(stock.addedAt).toLocaleDateString()}</td>
                <td className="text-right">
                  <button
                    className="add-alert ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAlertFor(stock);
                    }}
                  >
                    <BellPlus className="h-4 w-4" /> <span className="hidden sm:inline">Alert</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertModal
        open={Boolean(alertFor)}
        setOpen={(o) => !o && setAlertFor(null)}
        currentPrice={alertFor?.currentPrice}
        alertData={alertFor ? { symbol: alertFor.symbol, company: alertFor.company, alertName: "", alertType: "upper", threshold: "" } : undefined}
      />
    </>
  );
};

export default WatchlistTable;
