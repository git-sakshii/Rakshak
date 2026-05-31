import React, { useState, useEffect } from 'react';
import { 
  Layers, ArrowRight, ShieldAlert, BookOpen, AlertTriangle, 
  CheckCircle2, X, ExternalLink, HelpCircle, ExternalLink as ExtIcon 
} from 'lucide-react';
import { api } from '../api/client';
import RiskBadge from '../components/RiskBadge';

export default function Heatmap() {
  const [cells, setCells] = useState([]);
  const [repos, setRepos] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchHeatmap();
  }, []);

  const fetchHeatmap = async () => {
    setLoading(true);
    try {
      const data = await api.getRiskHeatmap();
      setCells(data);
      
      // Group cells by repo name
      const grouped = {};
      data.forEach(cell => {
        if (!grouped[cell.repo]) {
          grouped[cell.repo] = [];
        }
        grouped[cell.repo].push(cell);
      });
      setRepos(grouped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = async (cell) => {
    setSelectedCell(cell);
    setDetailLoading(true);
    setDetail(null);
    try {
      const info = await api.getDependencyDetail(cell.repo, cell.package);
      setDetail(info);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (String(status).toLowerCase()) {
      case 'critical':
        return 'bg-red-500 hover:bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
      case 'healthy':
      default:
        return 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]';
    }
  };

  return (
    <div className="space-y-6 relative">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight font-sans">
          Dependency Risk Heatmap
        </h2>
        <p className="text-muted text-xs mt-1">
          Interactive matrix representation of dependency health grouped by project repository.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="text-muted animate-pulse">Loading heatmap matrix...</span>
        </div>
      ) : Object.keys(repos).length === 0 ? (
        <div className="text-center py-20 glass border border-white/5 rounded-xl">
          <HelpCircle className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-muted text-sm">No dependency health data available. Trigger a scan first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {Object.entries(repos).map(([repoName, repoCells]) => (
            <div key={repoName} className="glass p-5 rounded-2xl border border-white/5 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <h3 className="font-extrabold text-sm tracking-wide text-secondary">{repoName}</h3>
                <span className="text-xs text-muted font-mono">{repoCells.length} dependencies</span>
              </div>
              
              <div className="flex flex-wrap gap-2.5">
                {repoCells.map((cell) => (
                  <button
                    key={cell.id}
                    onClick={() => handleCellClick(cell)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/5 hover:border-primary/20 hover:bg-primary/5 transition-all text-left group"
                    title={`${cell.package} (${cell.status} - Score: ${cell.risk_score})`}
                  >
                    {/* Status Glow Indicator Dot */}
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      String(cell.status).toLowerCase() === 'critical' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse' :
                      String(cell.status).toLowerCase() === 'warning' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' :
                      'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                    }`} />
                    
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-xs text-white/95 group-hover:text-primary transition-colors truncate max-w-[180px]">
                        {cell.package}
                      </span>
                      <span className="text-[10px] text-muted/60 font-mono">
                        {cell.risk_score}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide Drawer for cell details */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-lg bg-[#0e1218] border-l border-white/10 h-full p-6 overflow-y-auto flex flex-col justify-between shadow-2xl animate-slide-in relative">
            
            {/* Header */}
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-muted font-bold block mb-1">
                    {selectedCell.ecosystem} dependency detail
                  </span>
                  <h3 className="text-xl font-extrabold text-white break-all pr-4">{selectedCell.package}</h3>
                  <p className="text-xs text-secondary mt-1">in {selectedCell.repo}</p>
                </div>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="p-1.5 rounded-lg border border-white/10 hover:border-white/20 text-muted hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {detailLoading ? (
                <div className="space-y-4 py-10 text-center text-xs text-muted animate-pulse">
                  <span>Loading metadata details from Coral registry...</span>
                </div>
              ) : (
                detail && (
                  <div className="space-y-6">
                    {/* Status & Version Panel */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <span className="text-xs text-muted block font-semibold uppercase tracking-wider">Risk Level</span>
                        <RiskBadge status={detail.snapshot.status} score={detail.snapshot.risk_score} />
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted block font-semibold uppercase tracking-wider mb-1">Version Status</span>
                        <div className="flex items-center gap-1.5 text-xs font-mono bg-black/30 px-2.5 py-1 rounded-md border border-white/5">
                          <span className="text-muted">Pinned: {detail.snapshot.your_version}</span>
                          {detail.snapshot.your_version !== detail.snapshot.latest_version && (
                            <>
                              <ArrowRight className="w-3 h-3 text-primary" />
                              <span className="text-primary font-bold">{detail.snapshot.latest_version}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Risk Score Breakdown Reasons */}
                    {detail.reasons && detail.reasons.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-extrabold text-sm border-b border-white/5 pb-2 text-white/95">
                          Risk Penalty Breakdown
                        </h4>
                        <div className="space-y-2.5">
                          {detail.reasons.map((reason, index) => (
                            <div key={index} className="p-3 bg-white/5 border border-white/5 rounded-xl flex justify-between items-start gap-4">
                              <div className="space-y-1">
                                <span className="text-xs font-semibold text-white/90 block">{reason.title}</span>
                                <span className="text-[10px] text-muted leading-normal block">{reason.detail}</span>
                              </div>
                              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                reason.type === 'advisory' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                                reason.type === 'lag' || reason.type === 'deprecation' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                                'bg-white/5 border border-white/10 text-muted'
                              }`}>
                                +{reason.score_impact}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Security advisories list */}
                    <div className="space-y-3">
                      <h4 className="font-extrabold text-sm border-b border-white/5 pb-2 text-white/95">
                        Vulnerability Advisories
                      </h4>
                      {detail.alerts.length === 0 ? (
                        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <span>No known vulnerability advisories matching this package version.</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {detail.alerts.map((alert) => (
                            <div key={alert.id} className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl space-y-1.5">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 font-mono">
                                  {alert.hn_id || 'Alert'}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-bold uppercase">
                                  {alert.severity}
                                </span>
                              </div>
                              <h5 className="font-semibold text-xs leading-normal text-white">{alert.hn_title}</h5>
                              {alert.hn_url && (
                                <a 
                                  href={alert.hn_url} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-[10px] text-secondary hover:underline inline-flex items-center gap-1"
                                >
                                  <span>View Advisory</span>
                                  <ExtIcon className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Upgrade guidance placeholder linking to Dev.to */}
                    <div className="space-y-3">
                      <h4 className="font-extrabold text-sm border-b border-white/5 pb-2 text-white/95">
                        Suggested Actions
                      </h4>
                      <p className="text-xs text-muted leading-relaxed">
                        To resolve this warning, upgrade the package pins inside your repository manifest file. For code changes, see:
                      </p>
                      
                      <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <span>Dev.to Migration Guides</span>
                        </div>
                        
                        <a
                          href={`#migration-${selectedCell.package}`}
                          onClick={() => setSelectedCell(null)}
                          className="px-2.5 py-1 bg-primary text-background font-bold text-[10px] rounded-lg hover:bg-primary/80 transition-colors"
                        >
                          Show Guides
                        </a>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 pt-4 mt-6 flex justify-end">
              <button
                onClick={() => setSelectedCell(null)}
                className="px-4 py-2 border border-white/10 text-xs rounded-lg hover:border-white/20 transition-colors font-medium text-white"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
