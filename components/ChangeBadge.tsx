import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Coloured +/- percentage pill used across tables and cards
const ChangeBadge = ({ value, className }: { value?: number; className?: string }) => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return <span className={cn("badge badge-muted", className)}>—</span>;
  }
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("badge", up ? "badge-up" : "badge-down", className)}>
      <Icon className="h-3 w-3" />
      {up ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
};

export default ChangeBadge;
