import React from 'react';
import { Zap, Clock } from 'lucide-react';

export default function QueryTimer({ ms, cacheStatus, fallbackUsed }) {
  if (ms === undefined) return null;

  const isHit = cacheStatus === 'HIT';

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 text-xs rounded-lg glass border border-white/5 w-fit">
      <div className="flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 text-secondary" />
        <span className="font-mono text-white/80">{ms}ms</span>
      </div>
      
      <span className="w-px h-3 bg-white/10" />

      <div className="flex items-center gap-1">
        <Zap className={`w-3.5 h-3.5 ${isHit ? 'text-primary' : 'text-muted'}`} />
        <span className={`font-semibold ${isHit ? 'text-primary' : 'text-muted'}`}>
          {fallbackUsed ? 'SEED FALLBACK' : isHit ? 'CACHE HIT' : 'LIVE QUERY'}
        </span>
      </div>
    </div>
  );
}
