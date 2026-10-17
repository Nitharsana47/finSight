import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

// Brand mark: a magnifying lens over a rising chart line, plus the app name as text
const Logo = ({ className }: { className?: string }) => (
    <span className={cn("flex items-center gap-2.5 select-none", className)}>
        <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
            <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FDD458" />
                    <stop offset="100%" stopColor="#0FEDBE" />
                </linearGradient>
            </defs>
            <circle cx="13.5" cy="13.5" r="10" fill="none" stroke="url(#logo-grad)" strokeWidth="2.6" />
            <path d="M21 21l7.5 7.5" stroke="url(#logo-grad)" strokeWidth="3" strokeLinecap="round" />
            <path d="M8 17l3.5-3.5 3 2.5L19 10" fill="none" stroke="#0FEDBE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xl font-bold tracking-tight text-gray-100">
            {APP_NAME.slice(0, 3)}<span className="text-yellow-500">{APP_NAME.slice(3)}</span>
        </span>
    </span>
);

export default Logo;
