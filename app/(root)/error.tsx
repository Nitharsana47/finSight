'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

// Friendly fallback when a page fails to load (for example a dropped database connection)
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="empty-state mx-auto max-w-xl">
      <h2 className="empty-title">Something went wrong loading this page</h2>
      <p className="empty-description">This is usually a temporary connection problem. Check your internet connection and try again.</p>
      <button className="btn-primary" onClick={reset}>
        <RefreshCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
