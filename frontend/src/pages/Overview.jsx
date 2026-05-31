import React, { useState, useEffect } from 'react';
import { 
  Play, RefreshCw, ShieldAlert, AlertTriangle, CheckCircle, 
  Layers, GitFork, Sparkles, Send, HelpCircle, Terminal,
  X, ArrowRight, BookOpen, ExternalLink
} from 'lucide-react';
import { api } from '../api/client';
import RiskBadge from '../components/RiskBadge';
import QueryTimer from '../components/QueryTimer';
import CachedDataBanner from '../components/CachedDataBanner';

export default function Overview() {
  const [overview, setOverview] = useState(null);
  const [demoStatus, setDemoStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [recentRisks, setRecentRisks] = useState([]);

  // AI Ask state
  const [question, setQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState(null);

  // Detail drawer states
  const [selectedCell, setSelectedCell] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const stats = await api.getOverview();
      setOverview(stats);
      
      const demo = await api.getDemoStatus();
      setDemoStatus(demo.rakshak_demo_fallback);

      const heatmap = await api.getRiskHeatmap();
      // Sort dependencies: prioritizing CVEs (has_alerts), deprecation, and version lag (version_delta) over stale days.
      const sorted = [...heatmap].sort((a, b) => {
        if (!!b.has_alerts !== !!a.has_alerts) {
          return b.has_alerts ? 1 : -1;
        }
        if (!!b.is_deprecated !== !!a.is_deprecated) {
          return b.is_deprecated ? 1 : -1;
        }
        const deltaA = a.version_delta || 0;
        const deltaB = b.version_delta || 0;
        if (deltaB !== deltaA) {
          return deltaB - deltaA;
        }
        return b.risk_score - a.risk_score;
      }).slice(0, 5);
      setRecentRisks(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await api.triggerScan();
      await api.runRiskAnalysis();
      await fetchData();
    } catch (e) {
      alert("Scan failed: " + e.message);
    } finally {
      setScanning(false);
    }
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAiLoading(true);
    setAiAnswer(null);
    try {
      const response = await api.askQuestion(question);
      setAiAnswer(response);
    } catch (err) {
      setAiAnswer({
        answer: "Failed to query Coral or Gemini: " + err.message,
        query_used: "error",
        execution_ms: 0,
        cache_status: "UNKNOWN",
        fallback_used: false
      });
    } finally {
      setAiLoading(false);
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



  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight font-sans">
            Overview Dashboard
          </h2>
          <p className="text-muted text-xs font-medium mt-1">
            Analyze version stale-rates, vulnerability patches, and dependencies.
          </p>
        </div>

        <div className="flex items-center gap-3">

          <button
            onClick={handleScan}
            disabled={scanning}
            className="bg-primary hover:bg-primary/85 text-background font-extrabold px-4 py-2 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(102,252,241,0.15)]"
          >
            <Play className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Rescan Repos'}</span>
          </button>
        </div>
      </div>

      <CachedDataBanner isActive={demoStatus} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass p-5 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted font-semibold uppercase tracking-wider">Total Repos</span>
            <p className="text-3xl font-extrabold tracking-tight mt-1">{overview?.total_repos || 0}</p>
          </div>
          <div className="p-3 bg-white/5 text-muted rounded-xl border border-white/10">
            <GitFork className="w-5 h-5" />
          </div>
        </div>

        <div className="glass p-5 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted font-semibold uppercase tracking-wider">Dependencies</span>
            <p className="text-3xl font-extrabold tracking-tight mt-1">{overview?.total_deps || 0}</p>
          </div>
          <div className="p-3 bg-white/5 text-muted rounded-xl border border-white/10">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="glass p-5 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">Critical</span>
            <p className="text-3xl font-extrabold tracking-tight mt-1 text-red-500">{overview?.critical_risk_count || 0}</p>
          </div>
          <div className="p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="glass p-5 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-yellow-400 font-semibold uppercase tracking-wider">Warning</span>
            <p className="text-3xl font-extrabold tracking-tight mt-1 text-yellow-500">{overview?.warning_risk_count || 0}</p>
          </div>
          <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl border border-yellow-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="glass p-5 rounded-xl border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Healthy</span>
            <p className="text-3xl font-extrabold tracking-tight mt-1 text-emerald-500">{overview?.healthy_risk_count || 0}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ask Rakshak Panel */}
        <div className="lg:col-span-2 glass border border-white/5 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-extrabold text-lg">Ask Rakshak AI</h3>
            </div>
            
            <p className="text-muted text-xs mb-4 leading-normal">
              Ask natural language questions about your package health. Coral will resolve it to SQL, query registries, and Gemini will summarize the answer.
            </p>

            <form onSubmit={handleAsk} className="relative flex items-center mb-4">
              <input
                type="text"
                placeholder="e.g. What is my riskiest npm package and its CVE score?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm focus:border-primary focus:outline-none transition-colors placeholder-white/30"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="absolute right-2.5 p-2 rounded-lg bg-primary text-background hover:bg-primary/80 disabled:bg-white/5 disabled:text-muted transition-all"
              >
                {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>

            {/* Suggestions */}
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                "Which npm package has security vulns?",
                "Are there any outdated cargo dependencies?",
                "Find dev.to upgrades for react",
                "Show me Hacker News alerts"
              ].map((query, index) => (
                <button
                  key={index}
                  onClick={() => setQuestion(query)}
                  className="px-2.5 py-1 text-[10px] rounded-lg border border-white/5 bg-white/5 text-muted hover:text-white hover:border-white/10 font-medium transition-colors"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>

          {/* AI Response Output */}
          {aiAnswer && (
            <div className="border-t border-white/5 pt-4 space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-3">
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-3 w-full">
                  <p className="text-sm leading-relaxed text-white/95">{aiAnswer.answer}</p>
                  
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                    <QueryTimer 
                      ms={aiAnswer.execution_ms} 
                      cacheStatus={aiAnswer.cache_status}
                      fallbackUsed={aiAnswer.fallback_used} 
                    />
                    
                    <div className="flex items-center gap-1.5 text-xs text-muted font-mono bg-black/20 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <Terminal className="w-3.5 h-3.5" />
                      <span>{aiAnswer.query_used}.sql</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Highest Risk Packages */}
        <div className="glass border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-base mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-red-400" />
              <span>Highest Risk Dependencies</span>
            </h3>
            
            {recentRisks.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted">
                <HelpCircle className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p>No risk analysis data exists. Trigger a rescan to load packages.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentRisks.map((pkg, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCellClick(pkg)}
                    className="w-full text-left p-3 bg-white/5 rounded-xl border border-white/5 hover:border-primary/20 hover:bg-primary/5 transition-all flex justify-between items-center gap-3 group"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate text-white group-hover:text-primary transition-colors">{pkg.package}</p>
                      <span className="text-[10px] text-muted font-mono">{pkg.repo} ({pkg.ecosystem})</span>
                    </div>
                    <RiskBadge status={pkg.status} score={pkg.risk_score} />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="text-xs text-muted font-mono mt-4 pt-4 border-t border-white/5 text-center">
            Last Scan: {overview?.last_scan_at ? new Date(overview.last_scan_at).toLocaleString() : 'never'}
          </div>
        </div>
      </div>

      {/* Slide Drawer for dependency details */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-lg bg-[#0e1218] border-l border-white/10 h-full p-6 overflow-y-auto flex flex-col justify-between shadow-2xl animate-slide-in relative text-left">
            
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
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
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
                                  <ExternalLink className="w-3 h-3" />
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
                          href="#guides"
                          onClick={() => {
                            setSelectedCell(null);
                          }}
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
