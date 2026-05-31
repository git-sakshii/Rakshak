import React from 'react';
import { Layers, ArrowRight, ShieldAlert, BookOpen } from 'lucide-react';
import RiskBadge from './RiskBadge';

export default function PackageCard({ pkg, onSelect }) {
  const isOutdated = pkg.your_version !== pkg.latest_version;
  const isCargo = pkg.ecosystem === 'crates_io';
  
  return (
    <div 
      onClick={() => onSelect && onSelect(pkg)}
      className="p-4 rounded-xl border border-white/5 glass glass-hover cursor-pointer transition-all duration-300 flex flex-col justify-between h-full gap-4"
    >
      <div className="flex justify-between items-start">
        <div className="flex gap-2.5 items-start">
          <div className="p-2 rounded-lg bg-white/5 text-muted border border-white/10 mt-0.5">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-muted font-bold block mb-0.5">{pkg.ecosystem}</span>
            <h4 className="text-white font-semibold text-sm line-clamp-1 break-all" title={pkg.package}>
              {pkg.package}
            </h4>
            <span className="text-xs text-muted block mt-1 font-mono">{pkg.repo}</span>
          </div>
        </div>
        <RiskBadge status={pkg.status} score={pkg.risk_score} />
      </div>

      <div className="flex items-center gap-2 text-xs font-mono bg-white/5 px-3 py-2 rounded-lg border border-white/5">
        <span className="text-muted">Active: {pkg.your_version || 'unknown'}</span>
        {isOutdated && (
          <>
            <ArrowRight className="w-3.5 h-3.5 text-primary" />
            <span className="text-primary font-bold">Latest: {pkg.latest_version}</span>
          </>
        )}
      </div>

      {pkg.status === 'Critical' && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Vulnerability advisory matches version</span>
        </div>
      )}
    </div>
  );
}
