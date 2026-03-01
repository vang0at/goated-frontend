// ═══════════════════════════════════════════════════════════
// GOATED.RUN - API Client
// Drop this into your frontend. Replace mock data with real calls.
// ═══════════════════════════════════════════════════════════

const API_BASE = process.env.REACT_APP_API_URL || 'https://api.goated.run';

class GoatedAPI {
  constructor() {
    this.token = null;
  }

  // Set auth token after Privy login
  setToken(token) {
    this.token = token;
    localStorage.setItem('goated_token', token);
  }

  loadToken() {
    this.token = localStorage.getItem('goated_token');
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('goated_token');
  }

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  }

  // ═══════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════

  // Call this after Privy login with the Privy auth token
  async getMe() {
    return this.request('/api/users/me');
  }

  async claimDailyBonus() {
    return this.request('/api/users/daily-bonus', { method: 'POST' });
  }

  async applyReferral(code) {
    return this.request('/api/users/referral', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  // ═══════════════════════════════════════════
  // TAKES
  // ═══════════════════════════════════════════

  async createTake(takeText, stakeAmount) {
    return this.request('/api/takes/create', {
      method: 'POST',
      body: JSON.stringify({ takeText, stakeAmount }),
    });
  }

  async challengeTake(handshakeId) {
    return this.request('/api/takes/challenge', {
      method: 'POST',
      body: JSON.stringify({ handshakeId }),
    });
  }

  async listTakes({ status = 'open', category, sort = 'newest', limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams({ status, sort, limit, offset });
    if (category) params.set('category', category);
    return this.request(`/api/takes?${params}`);
  }

  async voteTake(handshakeId, vote) {
    return this.request('/api/takes/vote', {
      method: 'POST',
      body: JSON.stringify({ handshakeId, vote }),
    });
  }

  // ═══════════════════════════════════════════
  // EXPLORE (Algorithm Feed)
  // ═══════════════════════════════════════════

  async explore({ tab = 'all', category = 'all', sort = 'algorithm', limit = 30, offset = 0, q = '' } = {}) {
    const params = new URLSearchParams({ tab, category, sort, limit, offset });
    if (q) params.set('q', q);
    return this.request(`/api/explore?${params}`);
  }

  // ═══════════════════════════════════════════
  // POOL
  // ═══════════════════════════════════════════

  async getPoolStats() {
    return this.request('/api/pool');
  }

  async stakeToPool(amount) {
    return this.request('/api/pool', {
      method: 'POST',
      body: JSON.stringify({ action: 'stake', amount }),
    });
  }

  async unstakeFromPool(stakeId) {
    return this.request('/api/pool', {
      method: 'POST',
      body: JSON.stringify({ action: 'unstake', stakeId }),
    });
  }

  async getMyStakes() {
    return this.request('/api/pool/stakes');
  }

  // ═══════════════════════════════════════════
  // LEADERBOARD
  // ═══════════════════════════════════════════

  async getLeaderboard(type = 'points', limit = 50) {
    return this.request(`/api/leaderboard?type=${type}&limit=${limit}`);
  }

  // ═══════════════════════════════════════════
  // PUBLIC PROFILES
  // ═══════════════════════════════════════════

  async getProfile(handle) {
    return this.request(`/api/users/${handle}`);
  }

  // ═══════════════════════════════════════════
  // DISPUTES
  // ═══════════════════════════════════════════

  async fileDispute(handshakeId, reason, evidence = null) {
    return this.request('/api/settlements/dispute', {
      method: 'POST',
      body: JSON.stringify({ handshakeId, reason, evidence }),
    });
  }
}

// Singleton export
const api = new GoatedAPI();
export default api;
