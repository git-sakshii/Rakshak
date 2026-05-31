import React, { useState, useEffect } from 'react';
import { Send, Sparkles, CheckCircle2, ChevronRight, Play, RefreshCw } from 'lucide-react';

const GithubIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
);
import { api } from '../api/client';

export default function Setup({ onSetupComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  // GitHub credentials state
  const [gitUser, setGitUser] = useState('');
  const [gitToken, setGitToken] = useState('');
  
  // Scan statistics state
  const [scanStats, setScanStats] = useState(null);
  
  // Telegram config state
  const [telToken, setTelToken] = useState('');
  const [telChatId, setTelChatId] = useState('');
  
  // Gemini key state
  const [gemKey, setGemKey] = useState('');

  // Repository selection state
  const [reposList, setReposList] = useState([]);
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const data = await api.getSetupStatus();
      setStatus(data);
      if (data.setup_complete) {
        onSetupComplete();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGitHubSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.setupGitHub(gitUser, gitToken);
      // Fetch repositories for selection
      const repos = await api.getGitHubRepos();
      setReposList(repos);
      // Check all by default
      setSelectedRepos(repos.map(r => r.name));
      setShowRepoSelector(true);
    } catch (err) {
      alert("GitHub credentials saved, but failed to fetch repositories: " + err.message + "\n\nMake sure your token is valid and you have an active network connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerScan = async () => {
    setLoading(true);
    try {
      const res = await api.triggerScan();
      setScanStats(res.stats);
      // Automatically run risk snapshot computation on scanned dependencies
      await api.runRiskAnalysis();
      setStep(3);
    } catch (err) {
      alert("Scanning failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.setupTelegram(telToken, telChatId);
      setStep(4);
    } catch (err) {
      alert("Error saving Telegram configuration: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGeminiSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.setupGemini(gemKey);
      onSetupComplete();
    } catch (err) {
      alert("Error setting up Gemini key: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const skipStep = (nextStep) => {
    setStep(nextStep);
  };

  return (
    <div className="min-h-screen bg-background text-white flex items-center justify-center p-6 bg-gradient-to-br from-background via-[#0c1015] to-[#121c25]">
      <div className="w-full max-w-xl glass p-8 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden">
        {/* Decorative ambient gradient */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight font-sans bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            🪸 Rakshak Setup
          </h1>
          <p className="text-muted text-sm mt-2">Personal Dependency Health & Security Agent</p>
        </div>

        {/* Wizard Steps indicator */}
        <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${step >= i ? 'border-primary bg-primary/10 text-primary font-bold shadow-[0_0_10px_rgba(102,252,241,0.2)]' : 'border-white/10 text-muted'}`}>
                {i}
              </span>
              {i < 4 && <ChevronRight className="w-3.5 h-3.5 text-white/20" />}
            </div>
          ))}
        </div>
        {/* Step 1: GitHub credentials */}
        {step === 1 && (
          showRepoSelector ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                <div className="p-2 rounded bg-white/5 border border-white/10 text-muted">
                  <GithubIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Step 1.5 — Select Repositories to Monitor</h3>
                  <p className="text-xs text-muted">Choose which of your repositories Rakshak should check</p>
                </div>
              </div>

              {/* Search filter and Select All / None */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Filter repositories..."
                  value={repoSearchQuery}
                  onChange={(e) => setRepoSearchQuery(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-primary focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setSelectedRepos(reposList.map(r => r.name))}
                  className="px-2.5 py-1.5 border border-white/10 rounded-lg text-[10px] hover:text-white transition-colors"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRepos([])}
                  className="px-2.5 py-1.5 border border-white/10 rounded-lg text-[10px] hover:text-white transition-colors"
                >
                  Deselect All
                </button>
              </div>

              {/* Repositories Scroll List */}
              <div className="max-h-60 overflow-y-auto border border-white/5 rounded-lg divide-y divide-white/5 bg-black/25 p-1 pr-2 space-y-1 scrollbar-thin">
                {reposList
                  .filter(r => r.name.toLowerCase().includes(repoSearchQuery.toLowerCase()))
                  .map(repo => {
                    const isChecked = selectedRepos.includes(repo.name);
                    return (
                      <label
                        key={repo.name}
                        className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-white/5 transition-all border ${isChecked ? 'border-primary/10 bg-primary/5' : 'border-transparent'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedRepos(selectedRepos.filter(name => name !== repo.name));
                            } else {
                              setSelectedRepos([...selectedRepos, repo.name]);
                            }
                          }}
                          className="mt-1 rounded text-primary focus:ring-0 focus:ring-offset-0 accent-primary w-4 h-4 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-white truncate">{repo.name}</span>
                            {repo.private && (
                              <span className="text-[8px] bg-red-500/10 border border-red-500/20 text-red-400 px-1 rounded-sm uppercase font-mono font-semibold">Private</span>
                            )}
                            {repo.language && (
                              <span className="text-[8px] bg-white/5 border border-white/10 text-muted px-1 rounded-sm uppercase font-mono">{repo.language}</span>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-[10px] text-muted truncate mt-0.5">{repo.description}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                {reposList.filter(r => r.name.toLowerCase().includes(repoSearchQuery.toLowerCase())).length === 0 && (
                  <div className="py-8 text-center text-xs text-muted font-mono">No matching repositories found.</div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowRepoSelector(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:text-white transition-colors"
                >
                  Back to credentials
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await api.selectGitHubRepos(selectedRepos);
                      setStep(2);
                    } catch (err) {
                      alert("Error saving repository selection: " + err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="bg-primary hover:bg-primary/80 text-background font-extrabold px-5 py-2.5 rounded-lg text-sm transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(102,252,241,0.2)]"
                >
                  <span>Confirm Selection ({selectedRepos.length})</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleGitHubSubmit} className="space-y-5">
              <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                <div className="p-2 rounded bg-white/5 border border-white/10 text-muted">
                  <GithubIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Step 1 — GitHub Scanning Credentials</h3>
                  <p className="text-xs text-muted">Rakshak needs a Personal Access Token to search manifests</p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">GitHub Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. octocat"
                    value={gitUser}
                    onChange={(e) => setGitUser(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Personal Access Token (classic or fine-grained)</label>
                  <input
                    type="password"
                    required
                    placeholder="ghp_xxxxxxxxxxxxxxxx"
                    value={gitToken}
                    onChange={(e) => setGitToken(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors"
                  />
                  <p className="text-[10px] text-muted/80 mt-1 leading-normal">
                    Requires <b>repo</b> scope to scan private files, or can be public read-only.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => skipStep(2)}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:text-white transition-colors"
                >
                  Skip credential setup (local dummy mode)
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-primary hover:bg-primary/80 text-background font-bold px-5 py-2.5 rounded-lg text-sm transition-all flex items-center gap-1.5"
                >
                  <span>Save credentials</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )
        )}

        {/* Step 2: Trigger initial rescan */}
        {step === 2 && (
          <div className="space-y-5 text-center py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-2">
              <Play className="w-5 h-5 ml-0.5 animate-pulse" />
            </div>
            
            <div>
              <h3 className="font-semibold text-base">Step 2 — Discover Dependencies</h3>
              <p className="text-xs text-muted max-w-sm mx-auto mt-1.5">
                Rakshak will search your GitHub repositories for <code>package.json</code>, <code>requirements.txt</code>, and <code>Cargo.toml</code>.
              </p>
            </div>

            {loading ? (
              <div className="py-6 flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                <p className="text-xs font-mono text-muted">Scanning GitHub API & parsing manifest files...</p>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                <button
                  onClick={handleTriggerScan}
                  className="bg-primary hover:bg-primary/85 text-background font-extrabold px-6 py-3 rounded-lg text-sm transition-all inline-flex items-center gap-2 shadow-[0_0_20px_rgba(102,252,241,0.25)] hover:scale-105"
                >
                  <Play className="w-4 h-4" />
                  <span>Start Dependency Discovery Scan</span>
                </button>
                
                <div className="block">
                  <button
                    onClick={() => skipStep(3)}
                    className="text-xs text-muted hover:text-white transition-colors font-medium"
                  >
                    Skip scan (rely on fallback demo data)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Telegram bot */}
        {step === 3 && (
          <form onSubmit={handleTelegramSubmit} className="space-y-5">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="p-2 rounded bg-white/5 border border-white/10 text-muted">
                <Send className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Step 3 — Telegram Notifications (Optional)</h3>
                <p className="text-xs text-muted">Broadcast risk alerts and upgrade suggestions directly to chat</p>
              </div>
            </div>

            {scanStats && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg text-left font-mono">
                <p className="font-bold mb-1">✓ Discovery scan complete!</p>
                <p>• Repos found: {scanStats.repos_scanned}</p>
                <p>• Dependencies indexed: {scanStats.deps_found}</p>
              </div>
            )}

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Telegram Bot Token</label>
                <input
                  type="text"
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  value={telToken}
                  onChange={(e) => setTelToken(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors"
                />
                <p className="text-[10px] text-muted/75 mt-1 leading-normal">
                  Create a bot by sending <code>/newbot</code> to <b>@BotFather</b> on Telegram.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Telegram Chat ID</label>
                <input
                  type="text"
                  placeholder="987654321"
                  value={telChatId}
                  onChange={(e) => setTelChatId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors"
                />
                <p className="text-[10px] text-muted/75 mt-1 leading-normal">
                  Find your ID by sending a message to the bot and checking <code>/api/telegram/history</code> or using <b>@userinfobot</b>.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                type="button"
                onClick={() => skipStep(4)}
                className="text-xs text-muted hover:text-white transition-colors"
              >
                Skip Telegram setup
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-primary/80 text-background font-bold px-5 py-2.5 rounded-lg text-sm transition-all flex items-center gap-1.5"
              >
                <span>Save Telegram Settings</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Gemini Key */}
        {step === 4 && (
          <form onSubmit={handleGeminiSubmit} className="space-y-5">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="p-2 rounded bg-white/5 border border-white/10 text-muted">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Step 4 — Gemini Summarization Engine</h3>
                <p className="text-xs text-muted">Powers conversational dependency logs & AI Q&A</p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Gemini API Key</label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={gemKey}
                  onChange={(e) => setGemKey(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors"
                />
                <p className="text-[10px] text-muted/75 mt-1 leading-normal">
                  Get a key at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">Google AI Studio</a>.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  // Setup with dummy key to complete setup
                  await api.setupGemini("dummy_gemini_key");
                  onSetupComplete();
                }}
                className="text-xs text-muted hover:text-white transition-colors"
              >
                Skip AI (use offline summaries)
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-600 text-background font-extrabold px-5 py-2.5 rounded-lg text-sm transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Setup</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
