import React, { useState, useEffect } from 'react';
import { ShieldAlert, HelpCircle, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import AlertCard from '../components/AlertCard';

export default function Security() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.dismissAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      alert("Failed to dismiss alert: " + e.message);
    }
  };

  const handleSendTelegram = (id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, sent_to_telegram: true } : a));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight font-sans">
            Security Intelligence
          </h2>
          <p className="text-muted text-xs mt-1">
            Real-time vulnerability feeds and Hacker News security tracking matching your exact package footprint.
          </p>
        </div>

        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="p-2 rounded-lg border border-white/5 bg-white/5 hover:border-white/10 text-muted hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="text-muted animate-pulse">Scanning security logs...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20 glass border border-white/5 rounded-2xl">
          <HelpCircle className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <h4 className="font-bold text-base mb-1">All Clear!</h4>
          <p className="text-muted text-xs max-w-xs mx-auto leading-normal">
            No active security advisories or matching Hacker News threads found for your packages.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono text-muted mb-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <span>Found {alerts.length} active alerts requiring attention</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={handleDismiss}
                onSendTelegram={handleSendTelegram}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
