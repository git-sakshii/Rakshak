import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, ShieldAlert, AlertTriangle, CheckCircle, Database } from 'lucide-react';
import { api } from '../api/client';

export default function ScanHistory() {
  const [history, setHistory] = useState([]);
  const [latestSnap, setLatestSnap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getScanHistory();
      setHistory(data);
      const snap = await api.getLatestSnapshot();
      setLatestSnap(snap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleScanTrigger = async () => {
    setTriggering(true);
    try {
      await api.triggerScan();
      await api.runRiskAnalysis();
      await fetchHistory();
    } catch (e) {
      alert("Trigger failed: " + e.message);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight font-sans">
            Scan History & Database Snapshots
          </h2>
          <p className="text-muted text-xs mt-1">
            Browse dependency delta changes, runtimes, and vulnerability detection history.
          </p>
        </div>

        <button
          onClick={handleScanTrigger}
          disabled={triggering}
          className="bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-muted text-background font-extrabold px-4 py-2 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(102,252,241,0.15)]"
        >
          <Play className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
          <span>{triggering ? 'Scanning...' : 'Scan Now'}</span>
        </button>
      </div>

      {/* Snapshot counts block */}
      {latestSnap && latestSnap.status === 'success' && (
        <div className="glass p-5 rounded-2xl border border-white/5 space-y-4">
          <h3 className="font-extrabold text-sm border-b border-white/5 pb-2.5 text-white/95 flex items-center gap-2">
            <Database className="w-4 h-4 text-secondary" />
            <span>Latest DB Snapshot Summary</span>
            <span className="text-xs text-muted font-mono font-normal">({new Date(latestSnap.snapshotted_at).toLocaleString()})</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                <ShieldAlert className="w-4.5 h-4.5" />
                <span>Critical Risk</span>
              </div>
              <span className="text-2xl font-black text-red-400">{latestSnap.counts.Critical}</span>
            </div>

            <div className="bg-yellow-500/5 border border-yellow-500/10 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-400 font-semibold text-sm">
                <AlertTriangle className="w-4.5 h-4.5" />
                <span>Warnings</span>
              </div>
              <span className="text-2xl font-black text-yellow-400">{latestSnap.counts.Warning}</span>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle className="w-4.5 h-4.5" />
                <span>Healthy</span>
              </div>
              <span className="text-2xl font-black text-emerald-400">{latestSnap.counts.Healthy}</span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[250px]">
          <span className="text-muted animate-pulse">Loading execution history...</span>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-20 glass border border-white/5 rounded-2xl text-muted text-xs">
          No past scans found. Run your first rescan above!
        </div>
      ) : (
        <div className="glass border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/5 text-muted font-mono font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Triggered By</th>
                  <th className="px-5 py-3.5 text-center">Repos</th>
                  <th className="px-5 py-3.5 text-center">Deps</th>
                  <th className="px-5 py-3.5 text-center text-emerald-400">Added</th>
                  <th className="px-5 py-3.5 text-center text-red-400">Removed</th>
                  <th className="px-5 py-3.5 text-center text-orange-400">Alerts</th>
                  <th className="px-5 py-3.5 text-right">Runtime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium text-white/90">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 font-mono text-muted">
                      {new Date(row.scanned_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-secondary capitalize">{row.triggered_by}</td>
                    <td className="px-5 py-3.5 text-center font-mono">{row.repos_scanned}</td>
                    <td className="px-5 py-3.5 text-center font-mono">{row.deps_found}</td>
                    <td className="px-5 py-3.5 text-center font-mono text-emerald-400">+{row.new_deps}</td>
                    <td className="px-5 py-3.5 text-center font-mono text-red-400">-{row.removed_deps}</td>
                    <td className="px-5 py-3.5 text-center font-mono text-orange-400">{row.new_alerts}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-muted">{row.duration_sec}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
