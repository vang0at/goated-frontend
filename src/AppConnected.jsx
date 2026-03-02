import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import api from './api';

// ═══════════════════════════════════════════════════════════
// GOATED.RUN v2 — Responsive + AI Take Creator + Auth Fix
// ═══════════════════════════════════════════════════════════

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '🔥' },
  { id: 'crypto', label: 'Crypto', icon: '₿' },
  { id: 'sports', label: 'Sports', icon: '🏀' },
  { id: 'tech', label: 'Tech', icon: '💻' },
  { id: 'politics', label: 'Politics', icon: '🏛️' },
  { id: 'culture', label: 'Culture', icon: '🎬' },
  { id: 'markets', label: 'Markets', icon: '📈' },
];

const TIERS = {
  GOAT:      { min: 500000, color: '#FFD700', glow: '0 0 40px rgba(255,215,0,0.4)', icon: '🐐', label: 'GOAT' },
  LEGENDARY: { min: 100000, color: '#9945FF', glow: '0 0 30px rgba(153,69,255,0.3)', icon: '👑', label: 'Legendary' },
  ELITE:     { min: 50000,  color: '#00D4FF', glow: '0 0 20px rgba(0,212,255,0.3)', icon: '⚡', label: 'Elite' },
  PRO:       { min: 10000,  color: '#00FF88', glow: '0 0 15px rgba(0,255,136,0.2)', icon: '🎯', label: 'Pro' },
  RISING:    { min: 1000,   color: '#FF6B6B', glow: 'none', icon: '📈', label: 'Rising' },
  ROOKIE:    { min: 0,      color: '#555',    glow: 'none', icon: '🌱', label: 'Rookie' },
};

const getTier = (points) => {
  for (const [key, tier] of Object.entries(TIERS)) {
    if (points >= tier.min) return { key, ...tier };
  }
  return { key: 'ROOKIE', ...TIERS.ROOKIE };
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

// AI Take suggestions
const TAKE_TEMPLATES = [
  { category: 'crypto', text: 'Bitcoin above $___K by ___', hint: 'Price + date = settable' },
  { category: 'crypto', text: 'ETH flips BNB in market cap by ___', hint: 'Comparative + deadline' },
  { category: 'sports', text: '___ wins the 2026 NBA Finals', hint: 'Team + event' },
  { category: 'sports', text: '___ scores 40+ points tonight', hint: 'Player + stat + timeframe' },
  { category: 'tech', text: 'Apple announces ___ at WWDC 2026', hint: 'Product + event' },
  { category: 'tech', text: '___ reaches 100M users by ___', hint: 'App + milestone + date' },
  { category: 'politics', text: '___ wins the 2026 midterm in ___', hint: 'Candidate + race' },
  { category: 'culture', text: '___ grosses $1B worldwide', hint: 'Movie + box office milestone' },
  { category: 'markets', text: 'S&P 500 closes above ___K by end of Q___', hint: 'Index + target + quarter' },
];

const AppConnected = () => {
  const { ready, authenticated, user: privyUser, login, logout, getAccessToken } = usePrivy();

  // User state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Feed state
  const [takes, setTakes] = useState([]);
  const [poolStats, setPoolStats] = useState(null);
  const [exploreTab, setExploreTab] = useState('all');
  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedLoading, setFeedLoading] = useState(false);

  // Create Take state
  const [showCreateTake, setShowCreateTake] = useState(false);
  const [newTakeText, setNewTakeText] = useState('');
  const [stakeAmount, setStakeAmount] = useState(100);
  const [takeCategory, setTakeCategory] = useState('crypto');
  const [isCreating, setIsCreating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);

  // UI state
  const [toast, setToast] = useState(null);
  const [isChallenging, setIsChallenging] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const searchTimeout = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  };

  // ═══════════════════════════════════════════
  // AUTH — Fixed persistence
  // ═══════════════════════════════════════════

  const syncUser = useCallback(async () => {
    if (!authenticated || !privyUser) {
      setUser(null);
      setAuthLoading(false);
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        setAuthLoading(false);
        return;
      }
      api.setToken(token);
      const data = await api.getMe();
      setUser(data.profile || data);
      setAuthError(null);
    } catch (err) {
      console.error('Auth sync error:', err);
      // If /me fails, user might not exist yet — that's OK for new signups
      // The backend should auto-create on first /me call
      // Show them as logged in via Privy but with 0 points
      setUser({
        goat_points: 0,
        staked_points: 0,
        display_name: privyUser?.twitter?.username || privyUser?.google?.name || 'anon',
        privy_id: privyUser?.id,
      });
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }, [authenticated, privyUser, getAccessToken]);

  useEffect(() => {
    if (ready) syncUser();
  }, [ready, authenticated, syncUser]);

  // ═══════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════

  const loadTakes = useCallback(async () => {
    setFeedLoading(true);
    try {
      const params = { tab: exploreTab, q: searchQuery };
      if (category !== 'all') params.category = category;
      const data = await api.explore(params);
      setTakes(data.takes || []);
    } catch (err) {
      console.error('Load takes failed:', err);
    } finally {
      setFeedLoading(false);
    }
  }, [exploreTab, searchQuery, category]);

  const loadPoolStats = useCallback(async () => {
    try {
      const data = await api.getPoolStats();
      setPoolStats(data);
    } catch (err) { /* silent */ }
  }, []);

  useEffect(() => { loadTakes(); }, [loadTakes]);
  useEffect(() => { loadPoolStats(); }, [loadPoolStats]);

  const handleSearch = (val) => {
    setSearchQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadTakes(), 400);
  };

  // ═══════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════

  const handleCreateTake = async () => {
    if (!user || !authenticated) { login(); return; }
    if (!newTakeText.trim() || newTakeText.length < 10) {
      showToast('Take must be at least 10 characters', true);
      return;
    }
    setIsCreating(true);
    try {
      await api.createTake(newTakeText, stakeAmount);
      showToast('Take created! Staked ' + stakeAmount + ' GP 🐐');
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
    if (!user || !authenticated) { login(); return; }
    setIsChallenging(handshakeId);
    try {
      await api.challengeTake(handshakeId);
      showToast('Challenge accepted! 🤝');
      await loadTakes();
      await syncUser();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setIsChallenging(null);
    }
  };

  const handleVote = async (handshakeId, vote) => {
    if (!user || !authenticated) { login(); return; }
    try {
      await api.voteTake(handshakeId, vote);
      showToast(vote === 'yes' ? '👍 Voted GOATED' : '👎 Voted CAP');
      await loadTakes();
    } catch (err) {
      showToast(err.message, true);
    }
  };

  const handleClaimDaily = async () => {
    if (!user || !authenticated) { login(); return; }
    try {
      const result = await api.claimDailyBonus();
      showToast('Claimed ' + (result.amount || 100) + ' GP! 🎁');
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

  const userTier = user ? getTier(user.goat_points || user.goatPoints || 0) : null;
  const userPoints = user ? (user.goat_points || user.goatPoints || 0) : 0;
  const displayName = user ? (user.display_name || user.displayName || 'anon') : '';

  // ═══════════════════════════════════════════
  // LOADING SCREEN
  // ═══════════════════════════════════════════

  if (!ready) return (
    <div style={styles.loadingScreen}>
      <div style={styles.loadingContent}>
        <div style={{ fontSize: 64, marginBottom: 16, animation: 'pulse 1.5s ease infinite' }}>🐐</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#00FF88', letterSpacing: '-0.5px' }}>GOATED.RUN</div>
        <div style={{ fontSize: 13, color: '#555', marginTop: 10 }}>Staked takes. Real conviction.</div>
        <div style={styles.loadingBar}><div style={styles.loadingBarInner} /></div>
      </div>
      <style>{keyframes}</style>
    </div>
  );

  // ═══════════════════════════════════════════
  // MAIN LAYOUT
  // ═══════════════════════════════════════════

  return (
    <div style={styles.appContainer}>
      <style>{keyframes}</style>

      {/* TOAST */}
      {toast && (
        <div style={{ ...styles.toast, background: toast.isError ? '#FF4444' : '#00FF88', color: toast.isError ? '#fff' : '#000' }}>
          {toast.msg}
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLeft}>
            <span style={{ fontSize: 28 }}>🐐</span>
            <span style={styles.logo}>GOATED</span>
            <span style={styles.logoDot}>.RUN</span>
          </div>

          {/* Desktop search */}
          {!isMobile && (
            <div style={styles.headerSearch}>
              <span style={{ color: '#555', fontSize: 14 }}>🔍</span>
              <input
                type="text"
                placeholder="Search takes, topics, users..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                style={styles.headerSearchInput}
              />
            </div>
          )}

          <div style={styles.headerRight}>
            {user && authenticated ? (
              <>
                <button onClick={handleClaimDaily} style={styles.dailyButton} title="Claim daily bonus">
                  🎁
                </button>
                <div style={styles.pointsBadge}>
                  <span style={{ color: '#00FF88', fontWeight: 800, fontSize: 15 }}>{userPoints.toLocaleString()}</span>
                  <span style={{ color: '#555', fontSize: 11, marginLeft: 4 }}>GP</span>
                </div>
                <div onClick={() => setShowSidebar(!showSidebar)} style={{ ...styles.avatarCircle, background: userTier?.color || '#333', boxShadow: userTier?.glow || 'none', cursor: 'pointer' }}>
                  {userTier?.icon || '🌱'}
                </div>
              </>
            ) : (
              <button onClick={login} style={styles.ctaButton}>
                <span style={{ fontSize: 14 }}>🐐</span>
                Get 1,000 GP Free
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ═══ PROFILE SIDEBAR (Desktop) ═══ */}
      {showSidebar && user && (
        <div style={styles.sidebarOverlay} onClick={() => setShowSidebar(false)}>
          <div style={styles.sidebar} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', padding: '24px 20px', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ ...styles.avatarCircle, width: 56, height: 56, fontSize: 28, margin: '0 auto 12px', background: userTier?.color, boxShadow: userTier?.glow }}>
                {userTier?.icon}
              </div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>@{displayName}</div>
              <div style={{ fontSize: 12, color: userTier?.color, fontWeight: 700, marginTop: 4 }}>{userTier?.label} Tier</div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={styles.sidebarStat}>
                <span style={{ color: '#888' }}>GOAT Points</span>
                <span style={{ color: '#00FF88', fontWeight: 800 }}>{userPoints.toLocaleString()}</span>
              </div>
              <div style={styles.sidebarStat}>
                <span style={{ color: '#888' }}>Staked</span>
                <span style={{ fontWeight: 700 }}>{(user.staked_points || 0).toLocaleString()} GP</span>
              </div>
              <div style={styles.sidebarStat}>
                <span style={{ color: '#888' }}>Win Rate</span>
                <span style={{ fontWeight: 700 }}>{user.win_rate || '—'}</span>
              </div>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <button onClick={handleLogout} style={styles.logoutButton}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BODY ═══ */}
      <div style={styles.body}>

        {/* LEFT SIDEBAR — Desktop only */}
        {!isMobile && (
          <aside style={styles.leftSidebar}>
            <div style={styles.sidebarSection}>
              <div style={styles.sidebarLabel}>CATEGORIES</div>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  style={{ ...styles.categoryButton, ...(category === cat.id ? styles.categoryActive : {}) }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Pool Stats */}
            {poolStats && (
              <div style={styles.poolCard}>
                <div style={styles.sidebarLabel}>FAFO POOL</div>
                <div style={styles.poolStat}>
                  <span style={{ color: '#888', fontSize: 11 }}>Total Staked</span>
                  <span style={{ color: '#00FF88', fontWeight: 800 }}>{(poolStats.totalStaked || 0).toLocaleString()} GP</span>
                </div>
                <div style={styles.poolStat}>
                  <span style={{ color: '#888', fontSize: 11 }}>Stakers</span>
                  <span style={{ fontWeight: 700 }}>{poolStats.totalStakers || 0}</span>
                </div>
                <div style={styles.poolStat}>
                  <span style={{ color: '#888', fontSize: 11 }}>30d Earnings</span>
                  <span style={{ color: '#FFD700', fontWeight: 700 }}>{(poolStats.last30DaysEarnings || 0).toLocaleString()} GP</span>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* ═══ MAIN FEED ═══ */}
        <main style={styles.mainFeed}>

          {/* Mobile search */}
          {isMobile && (
            <div style={styles.mobileSearch}>
              <input
                type="text"
                placeholder="Search takes..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                style={styles.mobileSearchInput}
              />
            </div>
          )}

          {/* Mobile categories */}
          {isMobile && (
            <div style={styles.mobileCats}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  style={{ ...styles.mobileCatPill, ...(category === cat.id ? styles.mobileCatActive : {}) }}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab Bar */}
          <div style={styles.tabBar}>
            {['all', 'live', 'fresh', 'settled'].map(tab => (
              <button
                key={tab}
                onClick={() => setExploreTab(tab)}
                style={{ ...styles.tabButton, ...(exploreTab === tab ? styles.tabActive : {}) }}
              >
                {tab === 'all' ? '🔥 All' : tab === 'live' ? '⚡ Live' : tab === 'fresh' ? '🆕 Fresh' : '✅ Settled'}
              </button>
            ))}
          </div>

          {/* Feed */}
          <div style={styles.feed}>
            {feedLoading && takes.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: 32, animation: 'spin 1s linear infinite' }}>⏳</div>
                <div style={{ color: '#555', marginTop: 8 }}>Loading takes...</div>
              </div>
            ) : takes.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🐐</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: '#999' }}>No takes yet</div>
                <div style={{ fontSize: 14, color: '#555', marginTop: 8, maxWidth: 300, lineHeight: 1.5 }}>
                  Be the first to drop a take and put your GP where your mouth is.
                </div>
                {user && authenticated ? (
                  <button onClick={() => setShowCreateTake(true)} style={{ ...styles.ctaButton, marginTop: 20 }}>
                    Drop a Take
                  </button>
                ) : (
                  <button onClick={login} style={{ ...styles.ctaButton, marginTop: 20 }}>
                    Sign in to Create Takes
                  </button>
                )}
              </div>
            ) : (
              takes.map(take => <TakeCard key={take.id} take={take} user={user} onChallenge={handleChallenge} onVote={handleVote} isChallenging={isChallenging} />)
            )}
          </div>
        </main>

        {/* RIGHT SIDEBAR — Desktop only */}
        {!isMobile && (
          <aside style={styles.rightSidebar}>
            <div style={styles.sidebarSection}>
              <div style={styles.sidebarLabel}>TRENDING TAKES</div>
              <div style={{ color: '#555', fontSize: 13, padding: '12px 0' }}>
                Takes will appear here as the community grows 🚀
              </div>
            </div>

            <div style={styles.sidebarSection}>
              <div style={styles.sidebarLabel}>HOW IT WORKS</div>
              <div style={styles.howItWorksStep}>
                <span style={styles.stepNum}>1</span>
                <span style={{ fontSize: 13 }}>Drop a take & stake GP</span>
              </div>
              <div style={styles.howItWorksStep}>
                <span style={styles.stepNum}>2</span>
                <span style={{ fontSize: 13 }}>Someone challenges your take</span>
              </div>
              <div style={styles.howItWorksStep}>
                <span style={styles.stepNum}>3</span>
                <span style={{ fontSize: 13 }}>Community votes, AI settles</span>
              </div>
              <div style={styles.howItWorksStep}>
                <span style={styles.stepNum}>4</span>
                <span style={{ fontSize: 13 }}>Winner takes the pot 🐐</span>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ═══ FAB ═══ */}
      {user && authenticated && (
        <button onClick={() => setShowCreateTake(true)} style={styles.fab}>
          +
        </button>
      )}

      {/* ═══ MOBILE POOL BAR ═══ */}
      {isMobile && poolStats && (
        <div style={styles.mobilePoolBar}>
          <div style={styles.mobilePoolItem}>
            <div style={{ fontSize: 9, color: '#555', fontWeight: 700 }}>POOL</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#00FF88' }}>{(poolStats.totalStaked || 0).toLocaleString()} GP</div>
          </div>
          <div style={styles.mobilePoolItem}>
            <div style={{ fontSize: 9, color: '#555', fontWeight: 700 }}>STAKERS</div>
            <div style={{ fontSize: 12, fontWeight: 800 }}>{poolStats.totalStakers || 0}</div>
          </div>
          <div style={styles.mobilePoolItem}>
            <div style={{ fontSize: 9, color: '#555', fontWeight: 700 }}>30D</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#FFD700' }}>{(poolStats.last30DaysEarnings || 0).toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* ═══ CREATE TAKE MODAL ═══ */}
      {showCreateTake && (
        <CreateTakeModal
          newTakeText={newTakeText}
          setNewTakeText={setNewTakeText}
          stakeAmount={stakeAmount}
          setStakeAmount={setStakeAmount}
          takeCategory={takeCategory}
          setTakeCategory={setTakeCategory}
          showTemplates={showTemplates}
          setShowTemplates={setShowTemplates}
          isCreating={isCreating}
          onSubmit={handleCreateTake}
          onClose={() => setShowCreateTake(false)}
          userPoints={userPoints}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TAKE CARD COMPONENT
// ═══════════════════════════════════════════════════════════

const TakeCard = ({ take, user, onChallenge, onVote, isChallenging }) => {
  const stakePoints = take.creator_stake_points || take.creatorStakePoints || 0;
  const yesVotes = take.yes_votes || 0;
  const noVotes = take.no_votes || 0;
  const totalVotes = yesVotes + noVotes;
  const yesPercent = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 50;

  const statusColors = {
    open: { bg: 'rgba(0,255,136,0.08)', color: '#00FF88', label: '🆕 OPEN' },
    locked: { bg: 'rgba(0,212,255,0.08)', color: '#00D4FF', label: '⚡ LIVE' },
    settled_creator: { bg: 'rgba(255,215,0,0.08)', color: '#FFD700', label: '✅ SETTLED' },
    settled_challenger: { bg: 'rgba(255,215,0,0.08)', color: '#FFD700', label: '✅ SETTLED' },
    disputed: { bg: 'rgba(255,107,107,0.08)', color: '#FF6B6B', label: '⚠️ DISPUTED' },
  };
  const status = statusColors[take.status] || statusColors.open;

  return (
    <div style={styles.takeCard}>
      <div style={styles.takeHeader}>
        <span style={{ ...styles.statusBadge, background: status.bg, color: status.color }}>{status.label}</span>
        <span style={styles.takeStake}>{stakePoints.toLocaleString()} GP</span>
      </div>

      <div style={styles.takeText}>{take.take_text || take.takeText}</div>

      <div style={styles.takeMeta}>
        <span>@{take.creator_handle || take.creatorHandle || 'anon'}</span>
        <span style={{ color: '#333' }}>·</span>
        <span>{formatTime(take.created_at)}</span>
        {take.category && <span style={styles.takeCatPill}>{take.category}</span>}
      </div>

      {/* Sentiment Bar */}
      {totalVotes > 0 && (
        <div style={styles.sentimentContainer}>
          <div style={styles.sentimentBar}>
            <div style={{ ...styles.sentimentYes, width: yesPercent + '%' }} />
          </div>
          <div style={styles.sentimentLabels}>
            <span style={{ color: '#00FF88', fontSize: 11, fontWeight: 700 }}>GOATED {yesPercent}%</span>
            <span style={{ color: '#FF6B6B', fontSize: 11, fontWeight: 700 }}>CAP {100 - yesPercent}%</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={styles.takeActions}>
        {take.status === 'open' && (!user || take.creator_id !== user.id) && (
          <button
            onClick={() => onChallenge(take.id)}
            disabled={isChallenging === take.id}
            style={{ ...styles.challengeButton, opacity: isChallenging === take.id ? 0.5 : 1 }}
          >
            {isChallenging === take.id ? '🔄 Locking...' : '🤝 Challenge ' + stakePoints + ' GP'}
          </button>
        )}
        <button onClick={() => onVote(take.id, 'yes')} style={styles.voteYes}>
          👍 {yesVotes}
        </button>
        <button onClick={() => onVote(take.id, 'no')} style={styles.voteNo}>
          👎 {noVotes}
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// CREATE TAKE MODAL — Enhanced with AI assist
// ═══════════════════════════════════════════════════════════

const CreateTakeModal = ({ newTakeText, setNewTakeText, stakeAmount, setStakeAmount, takeCategory, setTakeCategory, showTemplates, setShowTemplates, isCreating, onSubmit, onClose, userPoints }) => {
  const filteredTemplates = TAKE_TEMPLATES.filter(t => takeCategory === 'all' || t.category === takeCategory);
  const charCount = newTakeText.length;
  const isValid = charCount >= 10 && charCount <= 280;
  const canAfford = userPoints >= stakeAmount;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.createModal} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={styles.modalHeader}>
          <div>
            <span style={{ fontWeight: 900, fontSize: 20 }}>Drop Your Take</span>
            <span style={{ marginLeft: 8, fontSize: 20 }}>🐐</span>
          </div>
          <button onClick={onClose} style={styles.modalClose}>×</button>
        </div>

        {/* Category Selector */}
        <div style={styles.modalSection}>
          <div style={styles.modalLabel}>Category</div>
          <div style={styles.catGrid}>
            {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
              <button
                key={cat.id}
                onClick={() => setTakeCategory(cat.id)}
                style={{ ...styles.catChip, ...(takeCategory === cat.id ? styles.catChipActive : {}) }}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI Templates */}
        {showTemplates && (
          <div style={styles.modalSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={styles.modalLabel}>AI Suggestions</div>
              <button onClick={() => setShowTemplates(false)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer' }}>Hide</button>
            </div>
            <div style={styles.templateGrid}>
              {filteredTemplates.slice(0, 3).map((tmpl, i) => (
                <button
                  key={i}
                  onClick={() => { setNewTakeText(tmpl.text); setShowTemplates(false); }}
                  style={styles.templateCard}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{tmpl.text}</div>
                  <div style={{ fontSize: 10, color: '#00FF88' }}>{tmpl.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Take Input */}
        <div style={styles.modalSection}>
          <div style={styles.modalLabel}>Your Take</div>
          <textarea
            value={newTakeText}
            onChange={(e) => setNewTakeText(e.target.value.slice(0, 280))}
            placeholder="Type a specific, verifiable prediction..."
            style={styles.takeInput}
          />
          <div style={styles.charCount}>
            <span style={{ color: charCount < 10 ? '#FF6B6B' : '#555' }}>{charCount}/280</span>
            {charCount > 0 && charCount < 10 && <span style={{ color: '#FF6B6B', marginLeft: 8 }}>Min 10 chars</span>}
          </div>

          {/* AI Quality Check */}
          {charCount >= 10 && (
            <div style={styles.aiCheck}>
              <span style={{ fontSize: 13 }}>🤖</span>
              <span style={{ fontSize: 11, color: '#888' }}>
                AI Oracle will verify this take is specific, time-bound, and settable before going live.
              </span>
            </div>
          )}
        </div>

        {/* Stake Amount */}
        <div style={styles.modalSection}>
          <div style={styles.modalLabel}>Stake Amount</div>
          <div style={styles.stakeGrid}>
            {[50, 100, 250, 500, 1000].map(amt => (
              <button
                key={amt}
                onClick={() => setStakeAmount(amt)}
                style={{
                  ...styles.stakeChip,
                  ...(stakeAmount === amt ? styles.stakeChipActive : {}),
                  ...(userPoints < amt ? { opacity: 0.3, cursor: 'not-allowed' } : {}),
                }}
                disabled={userPoints < amt}
              >
                {amt} GP
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
            Balance: {userPoints.toLocaleString()} GP • Staking: {stakeAmount} GP • Remaining: {Math.max(0, userPoints - stakeAmount).toLocaleString()} GP
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={onSubmit}
          disabled={isCreating || !isValid || !canAfford}
          style={{
            ...styles.submitButton,
            opacity: (isCreating || !isValid || !canAfford) ? 0.4 : 1,
            cursor: (isCreating || !isValid || !canAfford) ? 'not-allowed' : 'pointer',
          }}
        >
          {isCreating ? '🔮 AI Oracle Analyzing...' : !canAfford ? 'Not Enough GP' : 'Stake ' + stakeAmount + ' GP & Post Take'}
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// KEYFRAMES
// ═══════════════════════════════════════════════════════════

const keyframes = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800;900&display=swap');
  
  @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  @keyframes loadBar { 0% { width: 0%; } 100% { width: 100%; } }

  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #000; }
  
  input::placeholder, textarea::placeholder { color: #444; }
  
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #0a0a0a; }
  ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #333; }
`;

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const styles = {
  // App container
  appContainer: {
    background: '#000',
    color: '#e8e8e8',
    minHeight: '100vh',
    fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif",
  },

  // Loading
  loadingScreen: {
    background: '#000',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  loadingContent: { textAlign: 'center' },
  loadingBar: { width: 120, height: 3, background: '#111', borderRadius: 2, margin: '20px auto 0', overflow: 'hidden' },
  loadingBarInner: { width: '0%', height: '100%', background: '#00FF88', borderRadius: 2, animation: 'loadBar 2s ease forwards' },

  // Header
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(0,0,0,0.9)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid #111',
  },
  headerInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '10px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  logo: { fontWeight: 900, fontSize: 22, color: '#00FF88', letterSpacing: '-0.5px' },
  logoDot: { fontWeight: 600, fontSize: 14, color: '#555', marginLeft: -2 },
  headerSearch: {
    flex: 1,
    maxWidth: 400,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#0a0a0a',
    border: '1px solid #151515',
    borderRadius: 10,
    padding: '8px 14px',
  },
  headerSearchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: 13,
    outline: 'none',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  pointsBadge: {
    background: '#0a0a0a',
    border: '1px solid #151515',
    borderRadius: 10,
    padding: '6px 14px',
    display: 'flex',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    transition: 'transform 0.15s',
  },
  dailyButton: {
    background: '#0a0a0a',
    border: '1px solid #151515',
    borderRadius: 10,
    padding: '6px 10px',
    fontSize: 16,
    cursor: 'pointer',
    transition: 'transform 0.15s',
  },
  ctaButton: {
    background: '#00FF88',
    color: '#000',
    border: 'none',
    borderRadius: 10,
    padding: '10px 18px',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    transition: 'transform 0.1s',
    whiteSpace: 'nowrap',
  },

  // Profile sidebar
  sidebarOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, animation: 'fadeIn 0.15s ease' },
  sidebar: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 280, background: '#0a0a0a', borderLeft: '1px solid #1a1a1a', animation: 'slideUp 0.2s ease' },
  sidebarStat: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #111', fontSize: 13 },
  logoutButton: {
    width: '100%',
    background: 'none',
    border: '1px solid #333',
    borderRadius: 10,
    padding: '10px 0',
    color: '#888',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },

  // Body layout
  body: {
    maxWidth: 1200,
    margin: '0 auto',
    display: 'flex',
    gap: 0,
    minHeight: 'calc(100vh - 56px)',
  },

  // Left sidebar
  leftSidebar: {
    width: 220,
    flexShrink: 0,
    padding: '16px 16px 16px 20px',
    borderRight: '1px solid #0d0d0d',
    position: 'sticky',
    top: 56,
    height: 'calc(100vh - 56px)',
    overflowY: 'auto',
  },
  sidebarSection: { marginBottom: 24 },
  sidebarLabel: { fontSize: 10, fontWeight: 800, color: '#444', letterSpacing: '1.5px', marginBottom: 10 },
  categoryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    background: 'none',
    border: 'none',
    color: '#888',
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    transition: 'all 0.1s',
    textAlign: 'left',
  },
  categoryActive: { background: '#0d0d0d', color: '#00FF88' },
  poolCard: { background: '#060606', border: '1px solid #111', borderRadius: 12, padding: 14 },
  poolStat: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12 },

  // Main feed
  mainFeed: { flex: 1, minWidth: 0, borderRight: '1px solid #0d0d0d' },
  mobileSearch: { padding: '8px 16px' },
  mobileSearchInput: {
    width: '100%',
    background: '#0a0a0a',
    border: '1px solid #151515',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#fff',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  mobileCats: { display: 'flex', gap: 6, padding: '4px 16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  mobileCatPill: {
    background: '#0a0a0a',
    border: '1px solid #151515',
    color: '#888',
    borderRadius: 20,
    padding: '6px 12px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  mobileCatActive: { background: 'rgba(0,255,136,0.08)', borderColor: 'rgba(0,255,136,0.3)', color: '#00FF88' },
  tabBar: { display: 'flex', borderBottom: '1px solid #111', padding: '0 16px' },
  tabButton: {
    flex: 1,
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#555',
    padding: '12px 0',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    transition: 'color 0.15s',
  },
  tabActive: { borderBottomColor: '#00FF88', color: '#00FF88' },

  // Feed items
  feed: { padding: '8px 16px', paddingBottom: 80 },
  emptyState: { textAlign: 'center', padding: '60px 20px' },

  // Take card
  takeCard: {
    background: '#060606',
    border: '1px solid #111',
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
    transition: 'border-color 0.15s',
  },
  takeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: { padding: '3px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },
  takeStake: { fontSize: 12, color: '#555', fontWeight: 700 },
  takeText: { fontSize: 15, fontWeight: 600, lineHeight: 1.5, marginBottom: 10 },
  takeMeta: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#444', marginBottom: 12 },
  takeCatPill: { background: '#0d0d0d', padding: '2px 8px', borderRadius: 4, fontSize: 10 },
  sentimentContainer: { marginBottom: 12 },
  sentimentBar: { height: 6, borderRadius: 3, background: '#1a1a1a', overflow: 'hidden' },
  sentimentYes: { height: '100%', background: 'linear-gradient(90deg, #00FF88, #00CC6A)', borderRadius: 3, transition: 'width 0.3s' },
  sentimentLabels: { display: 'flex', justifyContent: 'space-between', marginTop: 4 },
  takeActions: { display: 'flex', gap: 8 },
  challengeButton: {
    flex: 1,
    background: '#00FF88',
    color: '#000',
    border: 'none',
    borderRadius: 10,
    padding: '10px 0',
    fontWeight: 800,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    transition: 'transform 0.1s',
  },
  voteYes: {
    background: 'rgba(0,255,136,0.06)',
    border: '1px solid rgba(0,255,136,0.15)',
    color: '#00FF88',
    borderRadius: 10,
    padding: '10px 14px',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  voteNo: {
    background: 'rgba(255,68,68,0.06)',
    border: '1px solid rgba(255,68,68,0.15)',
    color: '#FF4444',
    borderRadius: 10,
    padding: '10px 14px',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },

  // Right sidebar
  rightSidebar: {
    width: 260,
    flexShrink: 0,
    padding: '16px 20px 16px 16px',
    position: 'sticky',
    top: 56,
    height: 'calc(100vh - 56px)',
    overflowY: 'auto',
  },
  howItWorksStep: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#111',
    color: '#00FF88',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 800,
    flexShrink: 0,
  },

  // FAB
  fab: {
    position: 'fixed',
    bottom: 80,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#00FF88',
    color: '#000',
    border: 'none',
    fontSize: 28,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 4px 24px rgba(0,255,136,0.25)',
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    transition: 'transform 0.15s',
  },

  // Mobile pool bar
  mobilePoolBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(5,5,5,0.95)',
    backdropFilter: 'blur(10px)',
    borderTop: '1px solid #111',
    padding: '8px 16px',
    display: 'flex',
    justifyContent: 'space-around',
    zIndex: 50,
  },
  mobilePoolItem: { textAlign: 'center' },

  // Toast
  toast: {
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    padding: '10px 24px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13,
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    animation: 'fadeIn 0.2s ease',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },

  // Create Take Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(8px)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    animation: 'fadeIn 0.15s ease',
  },
  createModal: {
    background: '#0a0a0a',
    border: '1px solid #1a1a1a',
    borderRadius: 20,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: 24,
    animation: 'slideUp 0.2s ease',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalClose: { background: 'none', border: 'none', color: '#555', fontSize: 28, cursor: 'pointer', padding: 0, lineHeight: 1 },
  modalSection: { marginBottom: 20 },
  modalLabel: { fontSize: 11, fontWeight: 800, color: '#555', letterSpacing: '1px', marginBottom: 8, textTransform: 'uppercase' },
  catGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  catChip: {
    background: '#0d0d0d',
    border: '1px solid #1a1a1a',
    color: '#888',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  catChipActive: { background: 'rgba(0,255,136,0.08)', borderColor: 'rgba(0,255,136,0.3)', color: '#00FF88' },
  templateGrid: { display: 'flex', flexDirection: 'column', gap: 6 },
  templateCard: {
    background: '#080808',
    border: '1px solid #151515',
    borderRadius: 10,
    padding: '10px 14px',
    textAlign: 'left',
    cursor: 'pointer',
    color: '#ccc',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    transition: 'border-color 0.15s',
  },
  takeInput: {
    width: '100%',
    height: 100,
    background: '#060606',
    border: '1px solid #1a1a1a',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    resize: 'none',
    outline: 'none',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    lineHeight: 1.5,
    boxSizing: 'border-box',
  },
  charCount: { textAlign: 'right', fontSize: 11, marginTop: 4, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' },
  aiCheck: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: '8px 12px',
    background: 'rgba(0,255,136,0.04)',
    border: '1px solid rgba(0,255,136,0.1)',
    borderRadius: 8,
  },
  stakeGrid: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  stakeChip: {
    flex: 1,
    minWidth: 60,
    background: '#0d0d0d',
    border: '1px solid #1a1a1a',
    color: '#888',
    borderRadius: 10,
    padding: '10px 0',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    textAlign: 'center',
  },
  stakeChipActive: { background: '#00FF88', borderColor: '#00FF88', color: '#000' },
  submitButton: {
    width: '100%',
    background: '#00FF88',
    color: '#000',
    border: 'none',
    borderRadius: 12,
    padding: '14px 0',
    fontWeight: 900,
    fontSize: 15,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    transition: 'opacity 0.15s',
  },
};

export default AppConnected;
