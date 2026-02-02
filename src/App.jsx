import React, { useState, useEffect, useMemo, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import subsData from './data/subs.json';
import { loadGoogleScripts, initTokenClient, handleLogin, fetchSubscriptions, deleteSubscription, subscribeToChannel } from './services/youtube';
import './index.css';

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" className="yt-logo-glow" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const App = () => {
  const [subs, setSubs] = useState(subsData);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('pending');
  const [activeIndex, setActiveIndex] = useState(0);
  const [sweepDir, setSweepDir] = useState(null);
  const [isTinderMode, setIsTinderMode] = useState(false);

  // API State
  const [isApiMode, setIsApiMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize Google Scripts
  useEffect(() => {
    loadGoogleScripts(
      () => console.log('GAPI loaded'),
      () => {
        console.log('GIS loaded');
        initTokenClient((accessToken) => {
          setIsLoading(true);
          fetchSubscriptions(accessToken)
            .then(data => {
              setSubs(data);
              setIsApiMode(true);
              setFilter('all');
              // Auto-switch to swipe mode if many subs? Optional.
            })
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
        });
      }
    );
  }, []);

  const filteredSubs = useMemo(() => {
    return subs.filter(sub => {
      const matchesSearch = sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.handle.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === 'all' || sub.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [subs, searchTerm, filter]);

  const stats = useMemo(() => {
    return {
      total: subs.length,
      pending: subs.filter(s => s.status === 'pending').length,
      keep: subs.filter(s => s.status === 'keep').length,
      toss: subs.filter(s => s.status === 'toss').length,
      archive: subs.filter(s => s.status === 'archive').length,
    };
  }, [subs]);

  const getAvatar = (handle) => {
    // If we have a direct avatar URL (from API), use it
    const sub = subs.find(s => s.handle === handle);
    if (sub && sub.avatar) return sub.avatar;

    // Fallback to unavatar for demo data
    const cleanHandle = handle.replace('@', '');
    return `https://unavatar.io/youtube/${cleanHandle}`;
  };

  const updateStatus = async (id, status) => {
    const dirMap = { 'keep': 'right', 'toss': 'left', 'archive': 'down' };
    setSweepDir(dirMap[status]);

    // Handle API Actions
    if (isApiMode) {
      const sub = subs.find(s => s.id === id);

      // Unsubscribe Logic (Toss OR Archive)
      if (status === 'toss' || status === 'archive') {
        if (sub && sub.subscriptionId) {
          try {
            await deleteSubscription(sub.subscriptionId);
            console.log(`Unsubscribed from ${sub.name} (${status})`);
          } catch (err) {
            console.error("Failed to unsubscribe", err);
            setSweepDir(null);
            alert("Failed to unsubscribe.");
            return;
          }
        }
      }

      // Subscribe Logic (Keep)
      if (status === 'keep') {
        if (sub && !sub.subscriptionId) {
          try {
            const newSub = await subscribeToChannel(sub.id);
            console.log(`Subscribed to ${sub.name}`);
            setSubs(prev => prev.map(s => s.id === id ? { ...s, subscriptionId: newSub.id } : s));
          } catch (err) {
            console.error("Failed to subscribe", err);
            setSweepDir(null);
            alert("Failed to subscribe.");
            return;
          }
        }
      }
    }

    setTimeout(() => {
      setSubs(prev => prev.map(sub => {
        if (sub.id === id) {
          // If we unsubscribed (toss/archive), clear the subscriptionId locally
          const shouldClearId = (status === 'toss' || status === 'archive') && isApiMode;
          return { ...sub, status, subscriptionId: shouldClearId ? null : sub.subscriptionId };
        }
        return sub;
      }));
      setSweepDir(null);

      // Advance Logic
      const itemLeaves = filter !== 'all' && filter !== status;

      if (itemLeaves) {
        if (activeIndex >= filteredSubs.length - 1 && activeIndex > 0) {
          setActiveIndex(prev => prev - 1);
        }
      } else {
        setActiveIndex(prev => Math.min(prev + 1, filteredSubs.length - 1));
      }
    }, 500);
  };

  const handleKeyDown = useCallback((e) => {
    if (filteredSubs.length === 0) return;
    const currentSub = filteredSubs[activeIndex];
    if (!currentSub) return;
    if (document.activeElement.tagName === 'INPUT') return;

    if (isTinderMode) {
      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); updateStatus(currentSub.id, 'keep'); break;
        case 'ArrowLeft': e.preventDefault(); updateStatus(currentSub.id, 'toss'); break;
        case 'ArrowDown': e.preventDefault(); updateStatus(currentSub.id, 'archive'); break;
        case 'ArrowUp': e.preventDefault(); setActiveIndex(prev => Math.min(prev + 1, filteredSubs.length - 1)); break;
        default: break;
      }
    } else {
      switch (e.key) {
        case '1': e.preventDefault(); updateStatus(currentSub.id, 'keep'); break;
        case '2': e.preventDefault(); updateStatus(currentSub.id, 'toss'); break;
        case '3': e.preventDefault(); updateStatus(currentSub.id, 'archive'); break;
        case 'ArrowRight': e.preventDefault(); setActiveIndex(prev => Math.min(prev + 1, filteredSubs.length - 1)); break;
        case 'ArrowLeft': e.preventDefault(); setActiveIndex(prev => Math.max(prev - 1, 0)); break;
        default: break;
      }
    }

    if (e.key === 't' || e.key === 'T') setIsTinderMode(prev => !prev);
    if (e.key === 's' || e.key === '/' || e.key === 'S') { e.preventDefault(); document.querySelector('.search-field').focus(); }
  }, [filteredSubs, activeIndex, isTinderMode, filter]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(subs, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = "curated_subscriptions.json";
    link.click();
  };

  const downloadArchivePDF = () => {
    const archived = subs.filter(s => s.status === 'archive');
    if (archived.length === 0) {
      alert("No archived channels to download yet!");
      return;
    }

    const doc = new jsPDF();

    // Header
    doc.setFillColor(41, 121, 255); // Blue
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("SubStudio - Archived Channels", 14, 13);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total Archived: ${archived.length}`, 14, 35);

    const tableData = archived.map(sub => [
      sub.name,
      sub.handle,
      sub.sub_count,
      `www.youtube.com/${sub.handle}`
    ]);

    autoTable(doc, {
      head: [['Channel Name', 'Handle', 'Subscribers', 'Link']],
      body: tableData,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [41, 121, 255] },
      styles: { fontSize: 9 },
      columnStyles: {
        3: { textColor: [0, 0, 255] }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const url = 'https://' + data.cell.raw;
          doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
        }
      }
    });

    doc.save('substudio_archive_list.pdf');
  };

  const handleLogout = () => {
    setIsApiMode(false);
    setSubs(subsData);
    setFilter('pending');
    // Optional: revoke token if we store it, but for now just clearing state is enough to "logout" of the app view
  };

  return (
    <div className="app-container">
      <div className="mesh-gradient"></div>

      <div className="floating-header">
        <div className="header-row">
          <div className="title-section">
            <YouTubeIcon />
            <h1>SubStudio</h1>
            {!isApiMode && <span className="demo-badge">DEMO</span>}
            <div className="mode-pills">
              <button className={!isTinderMode ? 'active' : ''} onClick={() => setIsTinderMode(false)}>Discover</button>
              <button className={isTinderMode ? 'active' : ''} onClick={() => setIsTinderMode(true)}>Swipe</button>
            </div>
          </div>
          <div className="stats-grid">
            {!isApiMode ? (
              <button onClick={handleLogin} className="premium-export" style={{ background: 'var(--text-primary)', color: 'var(--bg-deep)' }}>
                Sign In with Google
              </button>
            ) : (
              <button onClick={handleLogout} className="premium-export" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}>
                Sign Out
              </button>
            )}
            <div className="stat-chip" style={{ color: 'var(--accent-keep)' }}>KEEP • {stats.keep}</div>
            <div className="stat-chip" style={{ color: 'var(--accent-toss)' }}>TOSS • {stats.toss}</div>

            {/* Archive Button for PDF Download */}
            <button
              className="stat-chip"
              onClick={downloadArchivePDF}
              style={{
                color: 'var(--accent-archive)',
                cursor: 'pointer',
                background: 'rgba(41, 121, 255, 0.1)',
                border: '1px solid rgba(41, 121, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              title="Download PDF List of Archived Channels"
            >
              ARCHIVE • {stats.archive} (PDF)
            </button>
            <button onClick={exportData} className="premium-export">Export</button>
          </div>
        </div>

        <div className="search-row">
          <input
            type="text"
            className="search-field"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setActiveIndex(0); }}
          />
          <select
            className="search-field"
            style={{ maxWidth: '220px' }}
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setActiveIndex(0); }}
          >
            <option value="all">All Library</option>
            <option value="pending">Review Pending</option>
            <option value="keep">Saved To Keep</option>
            <option value="toss">Marked for Toss</option>
            <option value="archive">In Archive</option>
          </select>
        </div>
      </div>

      <div className={isTinderMode ? "tinder-viewport" : "grid"}>
        {isLoading && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem' }}>
            <h2>Fetching your subscriptions...</h2>
            <p>This checks your public subscription list.</p>
          </div>
        )}

        {!isLoading && filteredSubs.map((sub, index) => {
          const isActive = index === activeIndex;
          if (isTinderMode && !isActive) return null;

          return (
            <div
              key={sub.id}
              className={`card ${isTinderMode ? 'tinder-card' : ''} status-${sub.status} ${isActive ? 'selected' : ''} ${isActive && sweepDir ? `sweeping-${sweepDir}` : ''}`}
              onClick={() => setActiveIndex(index)}
            >
              <div className="card-header">
                <img
                  src={getAvatar(sub.handle)}
                  alt={sub.name}
                  className="avatar-large"
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sub.name)}&background=random&color=fff`;
                  }}
                />
                {!isTinderMode && (
                  <div className="card-main">
                    <h3 className="channel-name">{sub.name}</h3>
                    <div className="channel-meta">
                      <span>{sub.handle}</span>
                      {sub.sub_count !== 'Unknown' && (
                        <>
                          <span>•</span>
                          <span>{sub.sub_count}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {isTinderMode && (
                <>
                  <h3 className="channel-name">{sub.name}</h3>
                  <div className="channel-meta" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <span>{sub.handle}</span>
                    {sub.sub_count !== 'Unknown' && (
                      <>
                        <span style={{ margin: '0 0.5rem' }}>•</span>
                        <span>{sub.sub_count}</span>
                      </>
                    )}
                  </div>
                </>
              )}

              <p className="channel-desc">{sub.description || "The creator hasn't provided a description yet."}</p>

              <div className="action-footer">
                <button className="action-btn toss" onClick={(e) => { e.stopPropagation(); updateStatus(sub.id, 'toss') }}>
                  {isTinderMode ? "TOSS (←)" : "TOSS (2)"}
                </button>
                <button className="action-btn archive" onClick={(e) => { e.stopPropagation(); updateStatus(sub.id, 'archive') }}>
                  {isTinderMode ? "ARCHIVE (↓)" : "ARCHIVE (3)"}
                </button>
                {isTinderMode && (
                  <button className="action-btn skip" onClick={(e) => { e.stopPropagation(); setActiveIndex(prev => Math.min(prev + 1, filteredSubs.length - 1)) }}>
                    SKIP (↑)
                  </button>
                )}
                <button className="action-btn keep" onClick={(e) => { e.stopPropagation(); updateStatus(sub.id, 'keep') }}>
                  {isTinderMode ? "KEEP (→)" : "KEEP (1)"}
                </button>
              </div>

              <div className="stamp keep">KEEP</div>
              <div className="stamp toss">TOSS</div>
              <div className="stamp archive">ARCHIVE</div>
            </div>
          );
        })}

        {!isLoading && filteredSubs.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '10rem 0', opacity: 0.5 }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>All Clear!</h2>
            <p>No remaining subscriptions match your current filter.</p>
          </div>
        )}
      </div>

      {!isTinderMode && (
        <div className="floating-overlay">
          <div className="hint-group"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Actions</div>
          <div className="hint-group"><kbd>←</kbd><kbd>→</kbd> Nav</div>
          <div style={{ width: '1px', height: '24px', background: 'var(--glass-border)' }}></div>
          <div className="hint-group"><kbd>T</kbd> View</div>
          <div className="hint-group"><kbd>/</kbd> Find</div>
        </div>
      )}
    </div>
  );
};

export default App;
