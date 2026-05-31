import React, { useState } from 'react';
import { Send, CheckCircle, ShieldAlert, ExternalLink, MessageSquare, Flame } from 'lucide-react';
import { api } from '../api/client';

export default function AlertCard({ alert, onDismiss, onSendTelegram }) {
  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [sent, setSent] = useState(alert.sent_to_telegram);

  const handleSendTelegram = async () => {
    setLoadingTelegram(true);
    try {
      await api.sendAlertTelegram(alert.id);
      setSent(true);
      if (onSendTelegram) onSendTelegram(alert.id);
    } catch (e) {
      alert("Failed to send alert: " + e.message);
    } finally {
      setLoadingTelegram(false);
    }
  };

  const getSeverityColor = (sev) => {
    switch (String(sev).toLowerCase()) {
      case 'critical':
        return 'text-red-500 border-red-500/20 bg-red-500/5';
      case 'high':
        return 'text-orange-400 border-orange-500/20 bg-orange-500/5';
      case 'medium':
        return 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5';
      case 'low':
      default:
        return 'text-blue-400 border-blue-500/20 bg-blue-500/5';
    }
  };

  return (
    <div className={`p-4 rounded-xl border glass glass-hover transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${alert.severity === 'critical' ? 'border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]' : 'border-white/5'}`}>
      <div className="flex gap-3.5 items-start">
        <div className={`p-2.5 rounded-lg border ${getSeverityColor(alert.severity)}`}>
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-bold text-xs uppercase tracking-wider text-muted font-mono">{alert.ecosystem}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono">{alert.package}</span>
            {alert.repo && (
              <span className="text-xs text-secondary font-mono">in {alert.repo}</span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-mono font-semibold ${getSeverityColor(alert.severity)}`}>
              {alert.severity}
            </span>
          </div>
          
          <h4 className="text-white font-medium text-sm md:text-base leading-snug max-w-2xl flex items-center gap-1.5">
            {alert.hn_title}
            {alert.hn_url && (
              <a href={alert.hn_url} target="_blank" rel="noreferrer" className="inline-block hover:text-primary text-muted transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </h4>

          {/* Render HN stats if available */}
          {(alert.points > 0 || alert.num_comments > 0) && (
            <div className="flex items-center gap-3.5 mt-2 text-xs text-muted font-mono">
              <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-500" /> {alert.points} points</span>
              <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5 text-secondary" /> {alert.num_comments} comments</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t border-white/5 md:border-none pt-3 md:pt-0">
        <button
          onClick={handleSendTelegram}
          disabled={sent || loadingTelegram}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border font-medium transition-all ${sent ? 'border-primary/20 bg-primary/5 text-primary' : 'border-white/10 hover:border-primary hover:text-primary text-muted'}`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>{sent ? 'Broadcasted' : 'Broadcast'}</span>
        </button>
        
        <button
          onClick={() => onDismiss(alert.id)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:border-emerald-500 hover:text-emerald-400 text-muted font-medium transition-all"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Resolve</span>
        </button>
      </div>
    </div>
  );
}
