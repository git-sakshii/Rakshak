import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Send, Sparkles, CheckCircle2, 
  RefreshCw, Save, Search, Lock, Eye, EyeOff, AlertTriangle
} from 'lucide-react';

const GithubIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
);
import { api } from '../api/client';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState(null); // 'github' | 'telegram' | 'gemini' | 'repos'
  const [status, setStatus] = useState(null);

  // Form states
  const [gitUser, setGitUser] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [showGitToken, setShowGitToken] = useState(false);

  const [telToken, setTelToken] = useState('');
  const [telChatId, setTelChatId] = useState('');
  const [showTelToken, setShowTelToken] = useState(false);

  const [gemKey, setGemKey] = useState('');
  const [showGemKey, setShowGemKey] = useState(false);

  // Repos selection states
  const [reposList, setReposList] = useState([]);
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [fetchingRepos, setFetchingRepos] = useState(false);

  // Demo fallback state
  const [demoStatus, setDemoStatus] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSetupStatus();
      setStatus(data);
      setGitUser(data.github_username || '');
      setGitToken(data.github_token || '');
      setTelToken(data.telegram_token || '');
      setTelChatId(data.telegram_chat_id || '');
      setGemKey(data.gemini_key === 'dummy_gemini_key' ? '' : (data.gemini_key || ''));
      
      const savedRepos = data.selected_repos || [];
      setSelectedRepos(savedRepos);

      try {
        const demo = await api.getDemoStatus();
        setDemoStatus(demo.rakshak_demo_fallback);
      } catch (err) {
        console.error("Failed to load demo status:", err);
      }

      if (data.github_configured) {
        setFetchingRepos(true);
        const repos = await api.getGitHubRepos();
        setReposList(repos);
        setFetchingRepos(false);
        
        // If no custom selection has been saved, default to checking all repositories
        if (savedRepos.length === 0) {
          setSelectedRepos(repos.map(r => r.name));
        }
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchReposList = async () => {
    setFetchingRepos(true);
    try {
      const repos = await api.getGitHubRepos();
      setReposList(repos);
      if (selectedRepos.length === 0) {
        setSelectedRepos(repos.map(r => r.name));
      }
    } catch (e) {
      console.error("Failed to fetch repos:", e);
    } finally {
      setFetchingRepos(false);
    }
  };

  const handleSaveGitHub = async (e) => {
    e.preventDefault();
    setSavingSection('github');
    try {
      await api.setupGitHub(gitUser, gitToken);
      alert("GitHub credentials updated successfully.");
      // Refresh repositories list
      fetchReposList();
      // Reload status
      const data = await api.getSetupStatus();
      setStatus(data);
    } catch (err) {
      alert("Error saving GitHub config: " + err.message);
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveRepos = async () => {
    setSavingSection('repos');
    try {
      await api.selectGitHubRepos(selectedRepos);
      alert("Monitored repositories list updated.");
      const data = await api.getSetupStatus();
      setStatus(data);
    } catch (err) {
      alert("Error saving repository selection: " + err.message);
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveTelegram = async (e) => {
    e.preventDefault();
    setSavingSection('telegram');
    try {
      await api.setupTelegram(telToken, telChatId);
      alert("Telegram configurations updated.");
      const data = await api.getSetupStatus();
      setStatus(data);
    } catch (err) {
      alert("Error saving Telegram configurations: " + err.message);
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveGemini = async (e) => {
    e.preventDefault();
    setSavingSection('gemini');
    try {
      await api.setupGemini(gemKey || 'dummy_gemini_key');
      alert("Gemini key configuration updated.");
      const data = await api.getSetupStatus();
      setStatus(data);
    } catch (err) {
      alert("Error saving Gemini key: " + err.message);
    } finally {
      setSavingSection(null);
    }
  };

  const handleToggleDemoMode = async () => {
    try {
      const res = await api.toggleDemoMode();
      setDemoStatus(res.rakshak_demo_fallback);
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight font-sans flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" />
          <span>Agent Settings</span>
        </h2>
        <p className="text-muted text-xs font-medium mt-1">
          Adjust scanning filters, API integrations, and notification channels.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Forms */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* GitHub Credentials */}
          <div className="glass border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-extrabold flex items-center gap-2 text-white/90">
              <GithubIcon className="w-4 h-4 text-muted" />
              <span>GitHub Credentials</span>
            </h3>
            <form onSubmit={handleSaveGitHub} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">GitHub Username</label>
                <input
                  type="text"
                  required
                  placeholder="Username"
                  value={gitUser}
                  onChange={(e) => setGitUser(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              <div className="relative">
                <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Personal Access Token</label>
                <div className="relative">
                  <input
                    type={showGitToken ? "text" : "password"}
                    required
                    placeholder="ghp_xxxx..."
                    value={gitToken}
                    onChange={(e) => setGitToken(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-xs focus:border-primary focus:outline-none transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGitToken(!showGitToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                  >
                    {showGitToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSection === 'github'}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {savingSection === 'github' ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                <span>Save Credentials</span>
              </button>
            </form>
          </div>

          {/* Telegram Settings */}
          <div className="glass border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-extrabold flex items-center gap-2 text-white/90">
              <Send className="w-4 h-4 text-blue-400" />
              <span>Telegram Bot Notifications</span>
            </h3>
            <form onSubmit={handleSaveTelegram} className="space-y-3.5">
              <div className="relative">
                <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Bot Token</label>
                <div className="relative">
                  <input
                    type={showTelToken ? "text" : "password"}
                    placeholder="Not configured"
                    value={telToken}
                    onChange={(e) => setTelToken(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-xs focus:border-primary focus:outline-none transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTelToken(!showTelToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                  >
                    {showTelToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Chat ID</label>
                <input
                  type="text"
                  placeholder="Not configured"
                  value={telChatId}
                  onChange={(e) => setTelChatId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={savingSection === 'telegram'}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {savingSection === 'telegram' ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                <span>Save Telegram Settings</span>
              </button>
            </form>
          </div>

          {/* Gemini AI Key */}
          <div className="glass border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-extrabold flex items-center gap-2 text-white/90">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Gemini AI Engine</span>
            </h3>
            <form onSubmit={handleSaveGemini} className="space-y-3.5">
              <div className="relative">
                <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Gemini API Key</label>
                <div className="relative">
                  <input
                    type={showGemKey ? "text" : "password"}
                    placeholder="AIzaSy... (using offline mode if blank)"
                    value={gemKey}
                    onChange={(e) => setGemKey(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-xs focus:border-primary focus:outline-none transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGemKey(!showGemKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                  >
                    {showGemKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSection === 'gemini'}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {savingSection === 'gemini' ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                <span>Save Gemini Key</span>
              </button>
            </form>
          </div>

          {/* Demo Fallback Mode */}
          <div className="glass border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-extrabold flex items-center gap-2 text-white/90">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span>Demo Fallback Mode</span>
            </h3>
            <p className="text-[11px] text-muted leading-relaxed">
              When enabled, Rakshak Agent uses a cached/offline demo dataset of repositories and packages to demonstrate features without querying live APIs.
            </p>
            <button
              type="button"
              onClick={handleToggleDemoMode}
              className={`w-full py-2.5 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                demoStatus
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/15'
                  : 'bg-white/5 border-white/10 text-muted hover:border-white/20 hover:text-white'
              }`}
            >
              <span>Demo Fallback: {demoStatus ? 'ENABLED' : 'DISABLED'}</span>
            </button>
          </div>

        </div>

        {/* Right Column: Repository Selector */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass border border-white/5 rounded-2xl p-6 space-y-4 flex flex-col h-full justify-between min-h-[500px]">
            <div className="space-y-4">
              <div className="flex justify-between items-start border-b border-white/5 pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-white">Monitored Repositories Selection</h3>
                  <p className="text-xs text-muted mt-0.5">Check the repositories Rakshak should actively scan and analyze.</p>
                </div>
                {status?.github_configured && (
                  <button
                    onClick={fetchReposList}
                    disabled={fetchingRepos}
                    className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1 bg-primary/5 border border-primary/10 px-2 py-1 rounded"
                  >
                    <RefreshCw className={`w-3 h-3 ${fetchingRepos ? 'animate-spin' : ''}`} />
                    <span>Sync GitHub</span>
                  </button>
                )}
              </div>

              {!status?.github_configured ? (
                <div className="py-20 text-center space-y-3">
                  <Lock className="w-10 h-10 text-white/10 mx-auto" />
                  <p className="text-xs text-muted max-w-xs mx-auto">
                    Please configure and save your GitHub Credentials in the left panel to load and select repositories.
                  </p>
                </div>
              ) : fetchingRepos && reposList.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
                  <p className="text-xs font-mono text-muted">Fetching repositories from GitHub API...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search and select buttons */}
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                      <input
                        type="text"
                        placeholder="Search loaded repositories..."
                        value={repoSearchQuery}
                        onChange={(e) => setRepoSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:border-primary focus:outline-none transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRepos(reposList.map(r => r.name))}
                      className="px-2.5 py-1.5 border border-white/10 rounded-lg text-[10px] hover:text-white transition-colors whitespace-nowrap"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRepos([])}
                      className="px-2.5 py-1.5 border border-white/10 rounded-lg text-[10px] hover:text-white transition-colors whitespace-nowrap"
                    >
                      Deselect All
                    </button>
                  </div>

                  {/* List Container */}
                  <div className="max-h-[350px] overflow-y-auto border border-white/5 rounded-xl divide-y divide-white/5 bg-black/20 p-1.5 space-y-1 scrollbar-thin">
                    {reposList
                      .filter(r => r.name.toLowerCase().includes(repoSearchQuery.toLowerCase()))
                      .map(repo => {
                        const isChecked = selectedRepos.includes(repo.name);
                        return (
                          <label
                            key={repo.name}
                            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-white/5 transition-all border ${isChecked ? 'border-primary/15 bg-primary/5' : 'border-transparent'}`}
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
                                  <span className="text-[8px] bg-red-500/15 border border-red-500/25 text-red-400 px-1 rounded-sm uppercase font-mono font-semibold">Private</span>
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
                      <div className="py-12 text-center text-xs text-muted font-mono">
                        No repositories found matching "{repoSearchQuery}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {status?.github_configured && reposList.length > 0 && (
              <div className="pt-4 border-t border-white/5 flex justify-between items-center gap-4 flex-wrap">
                <span className="text-xs text-muted font-mono">
                  Selected Repositories: <b className="text-primary">{selectedRepos.length}</b> / {reposList.length}
                </span>
                <button
                  type="button"
                  onClick={handleSaveRepos}
                  disabled={savingSection === 'repos'}
                  className="bg-primary hover:bg-primary/85 text-background font-extrabold px-5 py-2.5 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(102,252,241,0.15)]"
                >
                  {savingSection === 'repos' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save Selected Repositories</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
