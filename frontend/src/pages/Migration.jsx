import React, { useState, useEffect } from 'react';
import { BookOpen, HelpCircle, RefreshCw, Send, ExternalLink, ThumbsUp, Clock } from 'lucide-react';
import { api } from '../api/client';

export default function Migration() {
  const [dependencies, setDependencies] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState('');
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentGuides, setRecentGuides] = useState([]);
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    fetchDeps();
    fetchRecentGuides();
    
    // Check if there is a hash for a package name
    const hash = window.location.hash;
    if (hash && hash.startsWith('#migration-')) {
      const pkg = hash.replace('#migration-', '');
      setSelectedPkg(pkg);
      handleSearch(pkg);
    }
  }, []);

  const fetchDeps = async () => {
    try {
      const heatmap = await api.getRiskHeatmap();
      // Deduplicate packages
      const unique = Array.from(new Set(heatmap.map(c => c.package))).sort();
      setDependencies(unique);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRecentGuides = async () => {
    try {
      const data = await api.getGuides();
      setRecentGuides(data.slice(0, 10));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async (pkgName) => {
    const pkg = pkgName || selectedPkg;
    if (!pkg) return;
    setLoading(true);
    setGuides([]);
    try {
      const data = await api.fetchGuides(pkg);
      setGuides(data);
      fetchRecentGuides(); // Refresh overall list
    } catch (e) {
      alert("Failed to fetch guides: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTelegram = async (guide) => {
    setSendingId(guide.id);
    try {
      await api.sendGuideTelegram(guide.id);
      alert("Upgrade guide broadcasted successfully!");
    } catch (e) {
      alert("Failed to broadcast: " + e.message);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight font-sans">
          Migration & Upgrade Guides
        </h2>
        <p className="text-muted text-xs mt-1">
          Search developer articles, breaking changes, and upgrade documentation from Dev.to.
        </p>
      </div>

      <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-2">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider">Select Dependency</label>
          <select
            value={selectedPkg}
            onChange={(e) => {
              setSelectedPkg(e.target.value);
              handleSearch(e.target.value);
            }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors text-white"
          >
            <option value="" className="bg-[#0b0c10]">-- Choose a package --</option>
            {dependencies.map((dep, idx) => (
              <option key={idx} value={dep} className="bg-[#0b0c10]">{dep}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => handleSearch()}
          disabled={loading || !selectedPkg}
          className="bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-muted text-background font-extrabold px-6 py-2.5 rounded-lg text-sm transition-all flex items-center gap-2 h-11"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
          <span>{loading ? 'Searching Dev.to...' : 'Fetch Guides'}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[250px]">
          <span className="text-muted animate-pulse">Running Dev.to tags query...</span>
        </div>
      ) : guides.length > 0 ? (
        <div className="space-y-4">
          <h3 className="font-extrabold text-sm border-b border-white/5 pb-2 text-primary uppercase tracking-wider font-mono">
            Results for {selectedPkg}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guides.map((guide) => (
              <div key={guide.id} className="p-4 rounded-xl border border-white/5 glass glass-hover flex flex-col justify-between h-full gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-muted font-mono uppercase">
                      {guide.ecosystem || 'doc'}
                    </span>
                    <div className="flex gap-3 text-[10px] text-muted font-mono">
                      <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3 text-primary" /> {guide.reactions}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-secondary" /> {guide.reading_time_min}m</span>
                    </div>
                  </div>

                  <h4 className="font-semibold text-sm leading-snug text-white flex items-start gap-1">
                    <a href={guide.url} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors flex items-center gap-1.5">
                      <span>{guide.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                    </a>
                  </h4>
                </div>

                <button
                  onClick={() => handleSendTelegram(guide)}
                  disabled={sendingId === guide.id}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border border-white/10 hover:border-primary hover:text-primary transition-all text-muted"
                >
                  {sendingId === guide.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Broadcast to Telegram</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="font-extrabold text-sm border-b border-white/5 pb-2 text-white/95">
            Recently Cached Guides
          </h3>
          
          {recentGuides.length === 0 ? (
            <div className="text-center py-16 glass border border-white/5 rounded-2xl">
              <HelpCircle className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-muted text-xs">No upgrade guides cached yet. Try selecting a package from the dropdown above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentGuides.map((guide) => (
                <div key={guide.id} className="p-4 rounded-xl border border-white/5 glass glass-hover flex flex-col justify-between h-full gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-muted font-mono font-bold uppercase">
                        {guide.package}
                      </span>
                      <div className="flex gap-3 text-[10px] text-muted font-mono">
                        <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3 text-primary" /> {guide.reactions}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-secondary" /> {guide.reading_time_min}m</span>
                      </div>
                    </div>

                    <h4 className="font-semibold text-sm leading-snug text-white flex items-start gap-1">
                      <a href={guide.url} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors flex items-center gap-1.5">
                        <span>{guide.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                      </a>
                    </h4>
                  </div>

                  <button
                    onClick={() => handleSendTelegram(guide)}
                    disabled={sendingId === guide.id}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border border-white/10 hover:border-primary hover:text-primary transition-all text-muted"
                  >
                    {sendingId === guide.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Broadcast to Telegram</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
