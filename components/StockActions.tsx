"use client";

import { useState } from "react";
import { BellPlus } from "lucide-react";
import WatchlistButton from "@/components/WatchlistButton";
import AlertModal from "@/components/AlertModal";
import HoldingModal from "@/components/HoldingModal";

type Props = {
  symbol: string;
  company: string;
  isInWatchlist: boolean;
  currentPrice?: number;
  activeAlerts: number;
};

const StockActions = ({ symbol, company, isInWatchlist, currentPrice, activeAlerts }: Props) => {
  const [alertOpen, setAlertOpen] = useState(false);

  return (
    <div className="card p-4! space-y-3">
      <WatchlistButton symbol={symbol} company={company} isInWatchlist={isInWatchlist} />
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-outline h-11" onClick={() => setAlertOpen(true)}>
          <BellPlus className="h-4 w-4" /> Set alert
          {activeAlerts > 0 && <span className="badge badge-up ml-1">{activeAlerts}</span>}
        </button>
        <HoldingModal symbol={symbol} company={company} currentPrice={currentPrice} triggerLabel="Add to portfolio" triggerClassName="btn-outline h-11" />
      </div>

      <AlertModal
        open={alertOpen}
        setOpen={setAlertOpen}
        currentPrice={currentPrice}
        alertData={{ symbol, company, alertName: "", alertType: "upper", threshold: "" }}
      />
    </div>
  );
};

export default StockActions;
