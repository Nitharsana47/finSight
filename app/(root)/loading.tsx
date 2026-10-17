// Shown while a page's data loads (prices, portfolio and risk models can take a few seconds)
const Block = ({ className }: { className: string }) => <div className={`animate-pulse rounded-2xl bg-gray-800/80 border border-gray-600/40 ${className}`} />;

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <div className="h-3 w-32 animate-pulse rounded bg-gray-700" />
        <div className="h-9 w-72 max-w-full animate-pulse rounded bg-gray-700" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-gray-800" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Block key={i} className="h-32" />)}
      </div>
      <div className="grid gap-8 xl:grid-cols-3">
        <Block className="h-96 xl:col-span-2" />
        <Block className="h-96" />
      </div>
    </div>
  );
}
