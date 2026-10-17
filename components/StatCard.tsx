import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down" | "muted";
  icon: LucideIcon;
};

const StatCard = ({ label, value, sub, tone = "muted", icon: Icon }: Props) => (
  <div className="stat-card">
    <div className="stat-icon">
      <Icon className="h-5 w-5" />
    </div>
    <p className="stat-label">{label}</p>
    <p className="stat-value">{value}</p>
    {sub && <p className={cn("stat-sub", tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-gray-500")}>{sub}</p>}
  </div>
);

export default StatCard;
