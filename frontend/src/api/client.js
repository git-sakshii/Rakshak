const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorMessage;
    } catch (_) {}
    throw new Error(errorMessage);
  }
  
  if (response.status === 204) {
    return null;
  }
  
  return response.json();
}

export const api = {
  // Setup & Health
  getSetupStatus: () => request('/api/setup/status'),
  setupGitHub: (username, token) => request('/api/setup/github', {
    method: 'POST',
    body: JSON.stringify({ username, token }),
  }),
  getGitHubRepos: () => request('/api/setup/github/repos'),
  selectGitHubRepos: (selected_repos) => request('/api/setup/github/select', {
    method: 'POST',
    body: JSON.stringify({ selected_repos }),
  }),
  setupTelegram: (token, chat_id) => request('/api/setup/telegram', {
    method: 'POST',
    body: JSON.stringify({ token, chat_id }),
  }),
  setupGemini: (api_key) => request('/api/setup/gemini', {
    method: 'POST',
    body: JSON.stringify({ api_key }),
  }),
  triggerScan: () => request('/api/setup/scan', { method: 'POST' }),
  
  // Overview
  getOverview: () => request('/api/overview'),
  getQueryLog: () => request('/api/query-log'),
  
  // Repositories
  getRepos: () => request('/api/repos'),
  
  // Risk & Details
  runRiskAnalysis: () => request('/api/risk'),
  getRiskHeatmap: () => request('/api/risk/heatmap'),
  getRepoRisk: (repo) => request(`/api/risk/${repo}`),
  getDependencyDetail: (repo, pkg) => request(`/api/risk/${repo}/${pkg}`),
  
  // Alerts
  getAlerts: () => request('/api/alerts'),
  getAllAlerts: () => request('/api/alerts/all'),
  dismissAlert: (id) => request(`/api/alerts/${id}/dismiss`, { method: 'POST' }),
  sendAlertTelegram: (id) => request(`/api/alerts/${id}/send-telegram`, { method: 'POST' }),
  
  // Guides
  getGuides: () => request('/api/guides'),
  fetchGuides: (pkg) => request(`/api/guides/${pkg}`),
  sendGuideTelegram: (id) => request(`/api/guides/${id}/send-telegram`, { method: 'POST' }),
  
  // History
  getScanHistory: () => request('/api/scan-history'),
  getLatestSnapshot: () => request('/api/latest-snapshot'),
  
  // Ask AI
  askQuestion: (question) => request('/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
  }),
  
  // Telegram history & direct send
  getTelegramHistory: () => request('/api/telegram/history'),
  sendTelegramMessage: (message) => request('/api/telegram/send', {
    method: 'POST',
    body: JSON.stringify({ message }),
  }),
  
  // Demo commands
  resetDemo: () => request('/api/demo/reset', { method: 'DELETE' }),
  getDemoStatus: () => request('/api/demo/status'),
  toggleDemoMode: () => request('/api/demo/toggle', { method: 'POST' })
};
