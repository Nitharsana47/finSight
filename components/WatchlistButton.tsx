"use client";
import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Star, Trash2 } from "lucide-react";
import { addToWatchlist, removeFromWatchlist } from "@/lib/actions/watchlist.actions";

// Saves to MongoDB through server actions, with an optimistic toggle that
// rolls back if the request fails.
const WatchlistButton = ({
  symbol,
  company,
  isInWatchlist,
  showTrashIcon = false,
  type = "button",
  onWatchlistChange,
}: WatchlistButtonProps) => {
  const [added, setAdded] = useState<boolean>(!!isInWatchlist);
  const [pending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    const next = !added;
    setAdded(next);

    startTransition(async () => {
      const result = next ? await addToWatchlist(symbol, company) : await removeFromWatchlist(symbol);
      if (result.success) {
        toast.success(result.message);
        onWatchlistChange?.(symbol, next);
      } else {
        setAdded(!next);
        toast.error(result.error);
      }
    });
  };

  if (type === "icon") {
    return (
      <button
        type="button"
        title={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
        aria-label={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
        aria-pressed={added}
        className={`watchlist-icon-btn ${added ? "watchlist-icon-added" : ""}`}
        onClick={handleClick}
        disabled={pending}
      >
        <Star className="h-5 w-5" fill={added ? "currentColor" : "none"} />
      </button>
    );
  }

  return (
    <button type="button" className={`watchlist-btn ${added ? "watchlist-remove" : ""}`} onClick={handleClick} disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : showTrashIcon && added ? (
        <Trash2 className="h-4 w-4" />
      ) : (
        <Star className="h-4 w-4" fill={added ? "currentColor" : "none"} />
      )}
      <span>{added ? "Remove from Watchlist" : "Add to Watchlist"}</span>
    </button>
  );
};

export default WatchlistButton;
