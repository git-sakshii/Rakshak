import React, { useState, useEffect } from 'react';
import { 
  Sparkles, ShieldAlert, BookOpen, Layers, History, Send, 
  Settings, LogOut, CheckCircle, XCircle, Grid, HelpCircle, 
  RefreshCw, Menu, Eye 
} from 'lucide-react';
import { api } from './api/client';
import Setup from './pages/Setup';
import Overview from './pages/Overview';
import Heatmap from './pages/Heatmap';
import Security from './pages/Security';
import Migration from './pages/Migration';
import ScanHistory from './pages/ScanHistory';
import TelegramPanel from './pages/TelegramPanel';
import SettingsPage from './pages/Settings';

export default function App() {
  const [setupComplete, setSetupComplete] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const data = await api.getSetupStatus();
      setStatus(data);
      setSetupComplete(data.setup_complete);
    } catch (e) {
      console.error(e);
      // If server is not responding, fallback to setup is incomplete or mock
      setSetupComplete(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm("Are you sure you want to reset the database? This will clear all repository data and load the mock demo dataset.")) {
      return;
    }
    try {
      await api.resetDemo();
      alert("Database reset to demo state successfully.");
      checkStatus();
      setActiveTab('overview');
    } catch (e) {
      alert("Reset failed: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0c10] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <span className="text-muted text-xs font-mono">Initializing Rakshak agent UI...</span>
        </div>
      </div>
    );
  }

  if (!setupComplete) {
    return <Setup onSetupComplete={() => setSetupComplete(true)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview />;
      case 'heatmap':
        return <Heatmap />;
      case 'security':
        return <Security />;
      case 'guides':
        return <Migration />;
      case 'history':
        return <ScanHistory />;
      case 'telegram':
        return <TelegramPanel />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-white flex flex-col md:flex-row relative">
      
      {/* Sidebar - Desktop */}
      <aside className={`w-64 bg-[#0e1218] border-r border-white/5 flex flex-col justify-between p-5 z-40 md:relative fixed inset-y-0 left-0 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} transition-transform duration-300 ease-in-out`}>
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🪸</span>
              <div>
                <h1 className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                  Rakshak Agent
                </h1>
                <span className="text-[8px] font-mono text-primary/80 uppercase tracking-widest font-semibold">Security &amp; Health</span>
              </div>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 rounded-lg border border-white/5 text-muted hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {[
              { id: 'overview', label: 'Overview', icon: Grid },
              { id: 'heatmap', label: 'Risk Heatmap', icon: Layers },
              { id: 'security', label: 'Security Alerts', icon: ShieldAlert },
              { id: 'guides', label: 'Dev.to Guides', icon: BookOpen },
              { id: 'history', label: 'Scan History', icon: History },
              { id: 'telegram', label: 'Telegram Bot', icon: Send },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-primary/10 border border-primary/20 text-primary shadow-[0_0_15px_rgba(102,252,241,0.05)]' : 'border border-transparent text-muted hover:text-white hover:bg-white/5'}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-4 pt-4 border-t border-white/5 font-mono text-xs">
          <button
            onClick={handleResetDemo}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-red-400 font-semibold transition-colors"
          >
            <span>Reset Demo DB</span>
          </button>

          <div className="flex justify-between items-center text-[10px] text-muted-foreground/80 text-muted">
            <span>Coral WSL</span>
            <span className="flex items-center gap-1">
              {status?.rakshak_demo_fallback ? (
                <span className="text-yellow-400 font-bold">Fallback</span>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-emerald-400 font-bold">Active</span>
                </>
              )}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between bg-[#0e1218] border-b border-white/5 px-4 py-3.5 z-30">
        <div className="flex items-center gap-2">
          <span className="text-xl">🪸</span>
          <span className="font-extrabold text-base tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            Rakshak Agent
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 rounded-lg border border-white/5 text-muted hover:text-white"
        >
          <Menu className="w-5.5 h-5.5" />
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-full">
        {/* Top Integration Bar */}
        <header className="flex justify-end gap-3.5 mb-6 text-[10px] font-mono font-bold text-muted uppercase tracking-wider flex-wrap border-b border-white/5 pb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e1218] border border-white/5">
            <span>Coral CLI</span>
            {status?.rakshak_demo_fallback ? (
              <span className="text-yellow-400 flex items-center gap-0.5">⚠️ FALLBACK</span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> WSL CONNECTED</span>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e1218] border border-white/5">
            <span>Telegram Bot</span>
            {status?.telegram_configured ? (
              <span className="text-emerald-400 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> BROADCASTS ACTIVE</span>
            ) : (
              <span className="text-white/40 flex items-center gap-0.5">OFFLINE</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e1218] border border-white/5">
            <span>Gemini AI</span>
            {status?.gemini_configured ? (
              <span className="text-emerald-400 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> FLASH 3.1 READY</span>
            ) : (
              <span className="text-white/40 flex items-center gap-0.5">OFFLINE</span>
            )}
          </div>
        </header>

        {/* Dynamic page component */}
        {renderContent()}
      </main>
    </div>
  );
}
