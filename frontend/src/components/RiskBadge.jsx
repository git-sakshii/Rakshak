import React from 'react';

export default function RiskBadge({ status, score }) {
  let colorClasses = "";
  let dotClasses = "";
  
  const displayStatus = status || (score > 120 ? 'Critical' : score > 60 ? 'Warning' : 'Healthy');

  switch (displayStatus.toLowerCase()) {
    case 'critical':
      colorClasses = "bg-red-500/10 text-red-400 border-red-500/30";
      dotClasses = "bg-red-500 pulse-critical";
      break;
    case 'warning':
      colorClasses = "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
      dotClasses = "bg-yellow-500";
      break;
    case 'healthy':
    default:
      colorClasses = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      dotClasses = "bg-emerald-500";
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${colorClasses}`}>
      <span className={`w-2 h-2 rounded-full ${dotClasses}`}></span>
      <span>{displayStatus}</span>
      {score !== undefined && <span className="ml-1 opacity-70">({score})</span>}
    </span>
  );
}
