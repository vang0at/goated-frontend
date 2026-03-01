import React, { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import api from './api';

const AppConnected = () => {
  const { ready, authenticated, user: privyUser, login, logout, getAccessToken } = usePrivy();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('explore');
  const [takes, setTakes] = useState([]);
  const [poolStats, setPoolStats] = useState(null);
  const [toast, setToast] = useState(null);
  const [showCreateTake, setShowCreateTake] = useState(false);
  const [newTakeText, setNewTakeText] = useState('');
  const [stakeAmount, setStakeAmount] = useState(100);
  const [isCreating, setIsCreating] = useState(false);
  const [isChallenging, setIsChallenging] = useState(null);
  const [exploreTab, setExploreTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  };

  const syncUser = useCallback(async () => {
    if (!authenticated || !privyUser) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No auth token');
      api.setToken(token);
      const data = await api.getMe();
      setUser(data.profile || data);
      setError(null);
    } catch (err) {
      console.error('Auth sync failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authenticated, privyUser, getAccessToken]);

  useEffect(() => {
    if (ready) syncUser();
  }, [ready, authenticated, syncUser]);

  const loadTakes = useCallback(async () => {
    try {
      const data = await api.explore({ tab: exploreTab, q: searchQuery });
      setTakes(data.takes || []);
    } catch (err) {
      console.error('Failed to load takes:', err);
    }
  }, [exploreTab, searchQuery]);

  const loadPoolStats = useCallback(async () => {
    try {
      const data = await api.getPoolStats();
      setPoolStats(data);
    } catch (err) {
      console.error('Failed to load pool:', err);
    }
  }, []);

  useEffect(() => { loadTakes(); }, [loadTakes]);
  useEffect(() => { loadPoolStats(); }, [loadPoolStats]);

  const handleCreateTake = async () => {
    if (!user) { login(); return; }
    if (!newTakeText.trim() || newTakeText.length < 10) {
      showToast('Take must be at least 10 characters', true);
      return;
    }
    setIsCreating(true);
    try {
      const result = await api.createTake(newTakeText, stakeAmount);
      showToast('Take created! Staked ' + stakeAmount + ' GP');
      setNewTakeText('');
      setShowCreateTake(false);
      setStakeAmount(100);
      await loadTakes();
      await syncUser();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setIsCreating(false);
    }
  };

  const handleChallenge = async (handshakeId) => {
    if (!user) { login(); return; }
    setIsChallenging(handshakeId);
    try {
      const result = await api.challengeTake(handshakeId);
      showToast('Challenge accepted! ' + result.stakeAmount + ' GP locked');
      await loadTakes();
      await syncUser();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setIsChallenging(null);
    }
  };

  const handleVote = async (handshakeId, vote) => {
    if (!user) { login(); return; }
    try {
      await api.voteTake(handshakeId, vote);
    } catch (err) {
      showToast(err.message, true);
    }
  };

  const handleClaimDaily = async () => {
    if (!user) { login(); return; }
    try {
      const result = await api.claimDailyBonus();
      showToast('Claimed ' + result.amount + ' GP!');
      await syncUser();
    } catch (err) {
      showToast(err.message, true);
    }
  };

  const handleLogout = async () => {
    await logout();
    api.clearToken();
    setUser(null);
  };

  const getTier = (points) => {
    if (points >= 500000) return { name: 'GOAT', color: '#FFD700', icon: '\u{1F410}' };
    if (points >= 100000) return { name: 'LEGENDARY', color: '#9945FF', icon: '\u{1F451}' };
    if (points >= 50000) return { name: 'ELITE', color: '#00D4FF', icon: '\u26A1' };
    if (points >= 10000) return { name: 'PRO', color: '#00FF88', icon: '\u{1F3AF}' };
    if (points >= 1000) return { name: 'RISING', color: '#FF6B6B', icon: '\u{1F4C8}' };
    return { name: 'ROOKIE', color: '#888', icon: '\u{1F331}' };
  };

  const userTier = user ? getTier(user.goatPoints || user.goat_points || 0) : null;
  const userPoints = user ? (user.goatPoints || user.goat_points || 0) : 0;

  if (!ready) return (
    <div style={{ background: '#000', color: '#00FF88', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F410}'}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>GOATED.RUN</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Loading...</div>
      </div>
    </div>
  );

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", maxWidth: 480, margin: '0 auto', position: 'relative', paddingBottom: 60 }}>

      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.isError ? '#FF6B6B' : '#00FF88', color: '#000', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a', position: 'sticky', top: 0, background: '#000', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24 }}>{'\u{1F410}'}</span>
          <span style={{ fontWeight: 900, fontSize: 18, color: '#00FF88' }}>GOATED</span>
        </div>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div onClick={handleClaimDaily} style={{ cursor: 'pointer', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 10, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#00FF88', fontWeight: 800, fontSize: 14 }}>{userPoints.toLocaleString()}</span>
              <span style={{ fontSize: 11, color: '#888' }}>GP</span>
            </div>
            <div onClick={handleLogout} style={{ cursor: 'pointer', width: 32, height: 32, borderRadius: '50%', background: userTier ? userTier.color : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              {userTier ? userTier.icon : '\u{1F331}'}
            </div>
          </div>
        ) : (
          <button onClick={login} style={{ background: '#00FF88', color: '#000', border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            Get 1,000 GP Free
          </button>
        )}
      </div>

      <div style={{ padding: '8px 16px' }}>
        <input
          type="text"
          placeholder="Search takes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 0, padding: '0 16px', borderBottom: '1px solid #1a1a1a' }}>
        {['all', 'live', 'fresh', 'settled'].map(tab => (
          <button key={tab} onClick={() => setExploreTab(tab)} style={{ flex: 1, background: 'none', border: 'none', borderBottom: exploreTab === tab ? '2px solid #00FF88' : '2px solid transparent', color: exploreTab === tab ? '#00FF88' : '#888', padding: '10px 0', fontWeight: 700, fontSize: 12, cursor: 'pointer', textTransform: 'uppercase' }}>
            {tab === 'all' ? 'All' : tab === 'live' ? 'Live' : tab === 'fresh' ? 'Fresh' : 'Settled'}
          </button>
        ))}
      </div>

      <div style={{ padding: '8px 16px' }}>
        {takes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{'\u{1F410}'}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#888' }}>No takes yet</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Be the first to drop a take!</div>
            {user && (
              <button onClick={() => setShowCreateTake(true)} style={{ marginTop: 16, background: '#00FF88', color: '#000', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                Create Take
              </button>
            )}
          </div>
        ) : (
          takes.map(take => (
            <div key={take.id} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 14, padding: 16, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ background: take.status === 'open' ? 'rgba(0,255,136,0.12)' : take.status === 'locked' ? 'rgba(0,212,255,0.12)' : 'rgba(136,136,136,0.12)', color: take.status === 'open' ? '#00FF88' : take.status === 'locked' ? '#00D4FF' : '#888', padding: '3px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                  {take.status === 'open' ? 'OPEN' : take.status === 'locked' ? 'LIVE' : 'SETTLED'}
                </span>
                <span style={{ fontSize: 11, color: '#555' }}>
                  {take.creator_stake_points || take.creatorStakePoints} GP
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, marginBottom: 12 }}>
                {take.take_text || take.takeText}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
                by @{take.creator_handle || take.creatorHandle || 'anon'}
              </div>
              {(take.yes_votes > 0 || take.no_votes > 0) && (
                <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 10, background: '#1a1a1a' }}>
                  <div style={{ width: ((take.yes_votes / (take.yes_votes + take.no_votes)) * 100) + '%', background: '#00FF88' }} />
                  <div style={{ width: ((take.no_votes / (take.yes_votes + take.no_votes)) * 100) + '%', background: '#FF6B6B' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                {take.status === 'open' && (!user || take.creator_id !== user.id) && (
                  <button onClick={() => handleChallenge(take.id)} disabled={isChallenging === take.id} style={{ flex: 1, background: isChallenging === take.id ? '#333' : '#00FF88', color: '#000', border: 'none', borderRadius: 10, padding: '10px 0', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                    {isChallenging === take.id ? 'Locking...' : 'Challenge ' + (take.creator_stake_points || take.creatorStakePoints) + ' GP'}
                  </button>
                )}
                <button onClick={() => handleVote(take.id, 'yes')} style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', color: '#00FF88', borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {'\u{1F44D}'} {take.yes_votes || 0}
                </button>
                <button onClick={() => handleVote(take.id, 'no')} style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', color: '#FF6B6B', borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {'\u{1F44E}'} {take.no_votes || 0}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {user && (
        <button onClick={() => setShowCreateTake(true)} style={{ position: 'fixed', bottom: 80, right: 24, width: 56, height: 56, borderRadius: '50%', background: '#00FF88', color: '#000', border: 'none', fontSize: 24, fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,255,136,0.3)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          +
        </button>
      )}

      {showCreateTake && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#0a0a0a', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 900, fontSize: 18 }}>Drop Your Take {'\u{1F410}'}</span>
              <button onClick={() => setShowCreateTake(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 24, cursor: 'pointer' }}>{'\u00D7'}</button>
            </div>
            <textarea
              value={newTakeText}
              onChange={(e) => setNewTakeText(e.target.value.slice(0, 280))}
              placeholder="Bitcoin hits $200K before July..."
              style={{ width: '100%', height: 100, background: '#080808', border: '1px solid #1a1a1a', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, resize: 'none', outline: 'none', fontFamily: 'Inter, system-ui', boxSizing: 'border-box' }}
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: '#555', marginTop: 4 }}>{newTakeText.length}/280</div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Stake Amount</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[50, 100, 250, 500].map(amt => (
                  <button key={amt} onClick={() => setStakeAmount(amt)} style={{ flex: 1, background: stakeAmount === amt ? '#00FF88' : '#0a0a0a', color: stakeAmount === amt ? '#000' : '#fff', border: stakeAmount === amt ? 'none' : '1px solid #1a1a1a', borderRadius: 10, padding: '10px 0', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                    {amt} GP
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleCreateTake} disabled={isCreating || newTakeText.length < 10} style={{ width: '100%', marginTop: 20, background: isCreating ? '#333' : '#00FF88', color: '#000', border: 'none', borderRadius: 12, padding: '14px 0', fontWeight: 900, fontSize: 15, cursor: isCreating ? 'default' : 'pointer' }}>
              {isCreating ? 'AI Oracle Parsing...' : 'Stake ' + stakeAmount + ' GP & Post Take'}
            </button>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#555', marginTop: 12 }}>
              AI Oracle will verify your take is specific, time-bound, and settable
            </div>
          </div>
        </div>
      )}

      {poolStats && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0a0a0a', borderTop: '1px solid #1a1a1a', padding: '8px 16px', display: 'flex', justifyContent: 'space-around', maxWidth: 480, margin: '0 auto', zIndex: 50 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 700 }}>POOL</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#00FF88' }}>{(poolStats.totalStaked || 0).toLocaleString()} GP</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 700 }}>STAKERS</div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{poolStats.totalStakers || 0}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 700 }}>30D EARN</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#FFD700' }}>{(poolStats.last30DaysEarnings || 0).toLocaleString()} GP</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppConnected;
