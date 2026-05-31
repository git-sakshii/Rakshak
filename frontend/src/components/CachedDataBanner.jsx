import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function CachedDataBanner({ isActive }) {
  if (!isActive) return null;

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-4 py-3 rounded-lg flex items-center gap-3 mb-6 animate-pulse">
      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-sm">Demo Fallback Mode Active</p>
        <p className="text-xs text-yellow-400/80">
          Showing cached mock data. Live Coral API queries are disabled or unavailable. Ensure Coral is running in WSL to enable live querying.
        </p>
      </div>
    </div>
  );
}
