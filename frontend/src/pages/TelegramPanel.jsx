import React, { useState, useEffect } from 'react';
import { Send, RefreshCw, MessageSquare, Terminal, HelpCircle, Shield } from 'lucide-react';
import { api } from '../api/client';

export default function TelegramPanel() {
  const [status, setStatus] = useState(null);
  const [testMsg, setTestMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form edit states
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');

  useEffect(() => {
    fetchConfig();
    fetchHistory();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await api.getSetupStatus();
      setStatus(data);
      // Pre-fill fields if configured
      if (data.telegram_configured) {
        // Retrieve settings through api status or fill placeholders
        setToken('**********************************');
        setChatId('*************');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getTelegramHistory();
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleConfigSubmit = async (e) => {
    e.preventDefault();
    if (token.includes('***') || chatId.includes('***')) {
      alert("Please enter actual token and chat ID values to update.");
      return;
    }
    setLoading(true);
    try {
      await api.setupTelegram(token, chatId);
      alert("Telegram configuration updated.");
      fetchConfig();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!testMsg.trim()) return;
    setLoading(true);
    try {
      await api.sendTelegramMessage(testMsg);
      setTestMsg('');
      alert("Broadcast sent successfully!");
      fetchHistory();
    } catch (err) {
      alert("Broadcast failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight font-sans">
          Telegram Notifications Center
        </h2>
        <p className="text-muted text-xs mt-1">
          Configure real-time broadcasts, test direct connections, and view inbound command logs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Config and direct test */}
        <div className="space-y-6 lg:col-span-1">
          <form onSubmit={handleConfigSubmit} className="glass p-5 rounded-2xl border border-white/5 space-y-4">
            <h3 className="font-extrabold text-sm border-b border-white/5 pb-2 text-white/95 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span>Bot Credentials</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Bot Token</label>
                <input
                  type="password"
                  placeholder="123456789:ABC..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-primary focus:outline-none transition-colors text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Chat ID</label>
                <input
                  type="text"
                  placeholder="987654321"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-primary focus:outline-none transition-colors text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-muted text-background font-bold py-2 rounded-lg text-xs transition-colors"
            >
              Update Credentials
            </button>
          </form>

          {/* Direct Broadcast Form */}
          <form onSubmit={handleSendMessage} className="glass p-5 rounded-2xl border border-white/5 space-y-4">
            <h3 className="font-extrabold text-sm border-b border-white/5 pb-2 text-white/95 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-400" />
              <span>Test Broadcast Channel</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Message Content</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Type a test notification message..."
                  value={testMsg}
                  onChange={(e) => setTestMsg(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-primary focus:outline-none transition-colors text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !testMsg.trim()}
              className="w-full bg-secondary hover:bg-secondary/80 disabled:bg-white/5 disabled:text-muted text-background font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Broadcast</span>
            </button>
          </form>
        </div>

        {/* Telegram Logs and Command Guide */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass p-5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
              <h3 className="font-extrabold text-sm text-white/95 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-secondary" />
                <span>Conversation Log History</span>
              </h3>
              <button
                onClick={fetchHistory}
                disabled={historyLoading}
                className="p-1 rounded hover:bg-white/5 text-muted hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {historyLoading && history.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted animate-pulse">
                Loading logs...
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted">
                No Telegram operations logged yet. Run bot commands to see updates.
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {history.map((log) => (
                  <div key={log.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex gap-2.5 items-start">
                    <Terminal className={`w-4.5 h-4.5 flex-shrink-0 mt-0.5 ${log.direction === 'inbound' ? 'text-primary' : 'text-blue-400'}`} />
                    <div className="space-y-1 w-full min-w-0">
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-bold uppercase tracking-wider font-mono ${log.direction === 'inbound' ? 'text-primary' : 'text-blue-400'}`}>
                          {log.direction} {log.intent && `[${log.intent}]`}
                        </span>
                        <span className="text-[9px] text-muted font-mono">{new Date(log.executed_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-white/90 break-all leading-normal whitespace-pre-wrap">{log.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Command Guide */}
          <div className="glass p-5 rounded-2xl border border-white/5 space-y-3">
            <h3 className="font-extrabold text-sm border-b border-white/5 pb-2 text-white/95 flex items-center gap-2">
              <HelpCircle className="w-4.5 h-4.5 text-muted" />
              <span>Supported Telegram Commands</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/5 font-mono">
                <p className="text-primary font-bold">/health</p>
                <p className="text-[10px] text-muted mt-0.5">Dependency risk count & AI prose summary</p>
              </div>
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/5 font-mono">
                <p className="text-primary font-bold">/security</p>
                <p className="text-[10px] text-muted mt-0.5">List critical CVE & HN warning alerts</p>
              </div>
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/5 font-mono">
                <p className="text-primary font-bold">/fix &lt;pkg&gt;</p>
                <p className="text-[10px] text-muted mt-0.5">Find Dev.to upgrade guides for a package</p>
              </div>
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/5 font-mono">
                <p className="text-primary font-bold">/refresh</p>
                <p className="text-[10px] text-muted mt-0.5">Trigger a fresh scanner rescan job</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
