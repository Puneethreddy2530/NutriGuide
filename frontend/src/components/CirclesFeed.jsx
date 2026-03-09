import { useState, useEffect, useRef, useCallback } from "react";

const API = import.meta?.env?.VITE_API_URL ?? "";

const POST_TYPES = {
  general: { label: "General", color: "#64748b", icon: "â—Ž" },
  streak_share: { label: "Streak", color: "#60a5fa", icon: "ðŸ”¥" },
  milestone: { label: "Milestone", color: "#eab308", icon: "âœ¦" },
  support_request: { label: "Support", color: "#8b5cf6", icon: "ðŸ’œ" },
  journal_share: { label: "Journal", color: "#3b82f6", icon: "â—ˆ" },
};

const EMOJIS = ["ðŸ’™", "ðŸ”¥", "ðŸ’ª", "ðŸŒ±", "âœ¨"];

const CHALLENGE_LABELS = {
  journaling: "Journalling",
  medication: "Medication",
  activity: "Activity",
};

const RANK_BADGES = ["ðŸ¥‡", "ðŸ¥ˆ", "ðŸ¥‰"];

// â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const timeAgo = (iso) => {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// â”€â”€ Interceptor Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function InterceptorBanner({ response, onDismiss, onMindGuide }) {
  return (
    <div style={{
      padding: "20px 24px",
      background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.05))",
      borderLeft: "4px solid #8b5cf6",
      borderRadius: "0 14px 14px 0",
      animation: "fadeUp 0.3s ease",
      marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(139,92,246,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16,
        }}>ðŸ¤</div>
        <div>
          <div style={{
            fontSize: 14, color: "#8b5cf6",
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800
          }}>
            MindGuide reached out privately
          </div>
          <div style={{
            fontSize: 11, color: "rgba(255,255,255,0.3)",
            fontFamily: "'DM Mono', monospace"
          }}>
            Your post was intercepted for safety
          </div>
        </div>
      </div>
      <div style={{
        fontSize: 13, color: "rgba(0,0,0,0.7)",
        lineHeight: 1.8, fontFamily: "'DM Mono', monospace",
        whiteSpace: "pre-wrap", marginBottom: 18
      }}>
        {response}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onMindGuide} style={{
          padding: "10px 20px",
          background: "rgba(139,92,246,0.1)",
          borderRadius: 20, cursor: "pointer",
          color: "#8b5cf6", fontSize: 11, border: "none",
          fontWeight: 600, fontFamily: "'DM Mono', monospace", letterSpacing: 1,
        }}>
          Talk to MindGuide â†’
        </button>
        <button onClick={onDismiss} style={{
          padding: "10px 16px", background: "none", border: "none",
          cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 11,
          fontWeight: 500, fontFamily: "'DM Mono', monospace",
        }}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

// â”€â”€ Post Card (Non-Boxy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PostCard({ post, onReact, onComment, myUserId }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentAnon, setCommentAnon] = useState(false);
  const [reacted, setReacted] = useState(new Set());
  const [localCount, setLocalCount] = useState(post.reaction_count || 0);

  const type = POST_TYPES[post.post_type] || POST_TYPES.general;
  const ctx = post.health_context || {};

  const loadComments = async () => {
    try {
      const r = await fetch(`${API}/circles/comments/${post.id}`);
      const d = await r.json();
      setComments(d.comments || []);
    } catch { }
  };

  const handleReact = async (emoji) => {
    const wasReacted = reacted.has(emoji);
    const next = new Set(reacted);
    wasReacted ? next.delete(emoji) : next.add(emoji);
    setReacted(next);
    setLocalCount(c => wasReacted ? c - 1 : c + 1);
    await onReact(post.id, emoji);
  };

  const submitComment = async () => {
    if (!commentInput.trim()) return;
    const result = await onComment(post.id, commentInput, commentAnon);
    if (result?.action === "intercepted") {
      setCommentInput("");
      return;
    }
    setCommentInput("");
    loadComments();
  };

  const isOwnPost = post.user_id === myUserId;

  return (
    <div style={{
      padding: "20px 0",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      animation: "fadeUp 0.3s ease",
      position: "relative",
    }}>
      {/* Decorative side accent for the post type */}
      <div style={{
        position: "absolute",
        left: "-20px", top: "24px", bottom: "24px",
        width: "3px", borderRadius: "3px",
        background: type.color, opacity: 0.2
      }} />

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 12
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Avatar */}
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: `${type.color}15`,
            color: type.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 600,
          }}>
            {post.anonymous ? "â—Ž" : post.display_name[0].toUpperCase()}
          </div>
          <div>
            <div style={{
              fontSize: 15, color: "rgba(255,255,255,0.88)",
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700, letterSpacing: "-0.2px"
            }}>
              {post.display_name}
            </div>
            <div style={{
              fontSize: 11, color: "rgba(255,255,255,0.3)",
              fontFamily: "'DM Mono', monospace",
              marginTop: 2
            }}>
              {timeAgo(post.created_at)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Post type badge */}
          <span style={{
            fontSize: 11, padding: "4px 10px",
            background: `${type.color}10`,
            borderRadius: 20, color: type.color,
            fontFamily: "'DM Mono', monospace", fontWeight: 600,
          }}>
            {type.icon} {type.label}
          </span>

          {/* Health context pill (streak etc) */}
          {ctx.streak && (
            <span style={{
              fontSize: 11, padding: "4px 10px",
              background: "rgba(96,165,250,0.1)",
              borderRadius: 20, color: "#3b82f6",
              fontWeight: 600, fontFamily: "'DM Mono', monospace",
            }}>
              ðŸ”¥ {ctx.streak}d streak
            </span>
          )}
          {ctx.mood && (
            <span style={{
              fontSize: 11, padding: "4px 10px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 20, color: "rgba(255,255,255,0.4)",
              fontWeight: 500, fontFamily: "'DM Mono', monospace",
            }}>
              {ctx.mood}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{
        fontSize: 15, lineHeight: 1.6,
        color: "rgba(0,0,0,0.8)",
        fontFamily: "'DM Mono', monospace",
        marginBottom: 16,
        marginLeft: 52, // Align with text
      }}>
        {post.content}
      </div>

      {/* Reactions + comment toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: 52 }}>
        {EMOJIS.map(emoji => (
          <button key={emoji} onClick={() => handleReact(emoji)} style={{
            padding: "6px 14px",
            background: reacted.has(emoji) ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${reacted.has(emoji) ? "rgba(96,165,250,0.2)" : "transparent"}`,
            borderRadius: 20, cursor: "pointer", fontSize: 14,
            transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            transform: reacted.has(emoji) ? "scale(1.05)" : "scale(1)",
          }}>
            {emoji}
          </button>
        ))}

        <span style={{
          fontSize: 12, color: "rgba(255,255,255,0.3)",
          fontFamily: "'DM Mono', monospace", fontWeight: 500,
          marginLeft: 4
        }}>
          {localCount > 0 ? `${localCount} reactions` : ""}
        </span>

        <button onClick={() => {
          setShowComments(s => !s);
          if (!showComments) loadComments();
        }} style={{
          marginLeft: "auto",
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600,
          fontFamily: "'DM Mono', monospace", transition: "color 0.2s",
        }}
          onMouseEnter={e => e.target.style.color = "#60a5fa"}
          onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.4)"}
        >
          {post.comment_count > 0 ? `${post.comment_count} comments` : "Reply"}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div style={{
          marginTop: 16, paddingTop: 16,
          marginLeft: 52,
          borderTop: "1px dashed rgba(0,0,0,0.08)"
        }}>
          {comments.map(c => (
            <div key={c.id} style={{
              display: "flex", gap: 12, marginBottom: 12,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: "rgba(255,255,255,0.04)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 600
              }}>
                {c.anonymous ? "â—Ž" : c.display_name[0].toUpperCase()}
              </div>
              <div style={{ paddingTop: 4 }}>
                <span style={{
                  fontSize: 13, color: type.color, marginRight: 8,
                  fontWeight: 700, fontFamily: "'DM Mono', monospace"
                }}>
                  {c.display_name}
                </span>
                <span style={{
                  fontSize: 13, color: "rgba(0,0,0,0.7)",
                  fontFamily: "'DM Mono', monospace"
                }}>
                  {c.content}
                </span>
              </div>
            </div>
          ))}

          {/* Comment input */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <input
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitComment(); }}
              placeholder="Write a reply..."
              style={{
                flex: 1, padding: "10px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "none", borderRadius: 20,
                outline: "none", color: "rgba(255,255,255,0.88)", fontSize: 13,
                fontFamily: "'DM Mono', monospace",
              }}
            />
            <button onClick={() => setCommentAnon(a => !a)} style={{
              padding: "8px 14px",
              background: commentAnon ? "rgba(255,255,255,0.07)" : "transparent",
              border: "none", borderRadius: 20, cursor: "pointer",
              color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600,
              fontFamily: "'DM Mono', monospace",
            }}>
              {commentAnon ? "ANON" : "NAMED"}
            </button>
            <button onClick={submitComment} style={{
              padding: "8px 18px",
              background: `${type.color}15`,
              border: `none`,
              borderRadius: 20, cursor: "pointer",
              color: type.color, fontSize: 13, fontWeight: 700,
            }}>Reply</button>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€ Leaderboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LeaderboardPanel({ leaderboard, filter, onFilter }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
      borderRadius: 20, padding: "20px", border: "1px solid rgba(0,0,0,0.04)",
      height: "fit-content", position: "sticky", top: 100,
    }}>
      <div style={{
        fontSize: 15, color: "rgba(255,255,255,0.88)",
        fontFamily: "'Syne', sans-serif", fontWeight: 800,
        marginBottom: 16,
      }}>
        Top Streaks
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[["all", "All"], ["journaling", "Journal"], ["medication", "Meds"], ["activity", "Activity"]].map(([key, label]) => (
          <button key={key} onClick={() => onFilter(key)} style={{
            flex: 1, padding: "6px 0",
            background: filter === key ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.04)",
            border: "none", borderRadius: 8, cursor: "pointer",
            color: filter === key ? "#3b82f6" : "rgba(255,255,255,0.3)",
            fontSize: 11, fontWeight: 600, fontFamily: "'DM Mono', monospace",
          }}>
            {label}
          </button>
        ))}
      </div>

      {leaderboard.length === 0 ? (
        <div style={{
          fontSize: 12, color: "rgba(255,255,255,0.25)",
          textAlign: "center", padding: "20px 0",
          fontFamily: "'DM Mono', monospace"
        }}>
          No streaks yet
        </div>
      ) : leaderboard.slice(0, 10).map((entry, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 0",
          borderBottom: i < leaderboard.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
          animation: `fadeUp ${0.1 + i * 0.05}s ease`,
        }}>
          <span style={{
            fontSize: i < 3 ? 18 : 13, width: 24,
            textAlign: "center", fontWeight: 700,
            color: i >= 3 ? "rgba(255,255,255,0.25)" : undefined
          }}>
            {i < 3 ? RANK_BADGES[i] : `${i + 1}`}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 13, color: "rgba(255,255,255,0.88)",
              fontFamily: "'DM Mono', monospace", fontWeight: 600
            }}>
              {entry.display_name}
            </div>
            <div style={{
              fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2,
              fontFamily: "'DM Mono', monospace"
            }}>
              {CHALLENGE_LABELS[entry.challenge_type] || entry.challenge_type}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontSize: 16, color: "#60a5fa",
              fontFamily: "'DM Mono', monospace", fontWeight: 700
            }}>
              {entry.current_streak}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// â”€â”€ Safety Demo Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SafetyDemoModal({ onClose }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/circles/safety-demo`)
      .then(r => r.json())
      .then(d => { setResults(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statusColor = (action) =>
    action === "intercepted" ? "#ef4444"
      : action === "posted_with_support" ? "#60a5fa"
        : "#22c55e";

  const statusIcon = (action) =>
    action === "intercepted" ? "ðŸ›¡"
      : action === "posted_with_support" ? "ðŸ’œ"
        : "âœ“";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(250,250,249,0.9)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: "100%", maxWidth: 540,
        background: "rgba(255,255,255,0.025)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
        borderRadius: 24, padding: "32px",
        animation: "fadeUp 0.3s ease cubic-bezier(0.175, 0.885, 0.32, 1)",
      }}>
        <div style={{
          fontSize: 22, color: "rgba(255,255,255,0.88)",
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800, marginBottom: 8
        }}>
          ðŸ›¡ AI Safety Interceptor Demo
        </div>
        <div style={{
          fontSize: 13, color: "rgba(255,255,255,0.4)",
          fontFamily: "'DM Mono', monospace",
          marginBottom: 24, lineHeight: 1.6
        }}>
          Every post is screened by AI before reaching the feed.
          Crisis signals are intercepted privately. Support cases get a
          quiet nudge. Safe posts go straight through.
        </div>

        {loading ? (
          <div style={{
            textAlign: "center", padding: "40px 0",
            color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 500,
            animation: "pulse 1.2s infinite"
          }}>
            Running live safety checksâ€¦
          </div>
        ) : results?.results?.map((r, i) => (
          <div key={i} style={{
            padding: "16px", marginBottom: 12,
            background: `${statusColor(r.action)}10`,
            borderLeft: `3px solid ${statusColor(r.action)}`,
            borderRadius: "0 12px 12px 0",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 10
            }}>
              <span style={{
                fontSize: 13, color: "rgba(0,0,0,0.7)", fontWeight: 500,
                fontFamily: "'DM Mono', monospace"
              }}>
                "{r.content}"
              </span>
              <span style={{
                fontSize: 11, color: statusColor(r.action), fontWeight: 700,
                fontFamily: "'DM Mono', monospace",
                marginLeft: 12, flexShrink: 0
              }}>
                {statusIcon(r.action)} {r.action.replace(/_/g, " ").toUpperCase()}
              </span>
            </div>
            <div style={{
              display: "flex", gap: 16, fontSize: 11, fontWeight: 500,
              fontFamily: "'DM Mono', monospace",
              color: "rgba(255,255,255,0.3)"
            }}>
              <span>score: <span style={{ color: statusColor(r.action) }}>
                {(r.safety_score * 100).toFixed(0)}%
              </span></span>
              <span>posted: <span style={{ color: r.posted ? "#22c55e" : "#ef4444" }}>
                {r.posted ? "YES" : "NO"}
              </span></span>
              <span>via: {r.method}</span>
            </div>
          </div>
        ))}

        <button onClick={onClose} style={{
          marginTop: 16, width: "100%", padding: "14px 0",
          background: "rgba(255,255,255,0.04)", border: "none",
          borderRadius: 12, cursor: "pointer", fontWeight: 700,
          color: "rgba(255,255,255,0.5)", fontSize: 13,
          fontFamily: "'DM Mono', monospace", letterSpacing: 1,
          transition: "background 0.2s",
        }}
          onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.07)"}
          onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.04)"}
        >
          CLOSE DEMO
        </button>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Main Component
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export default function CirclesFeed({ token, onNavigate }) {
  const [posts, setPosts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [stats, setStats] = useState(null);
  const [lbFilter, setLbFilter] = useState("all");
  const [feedFilter, setFeedFilter] = useState("all");

  // Composer
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState("general");
  const [anonymous, setAnonymous] = useState(false);
  const [shareHealth, setShareHealth] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  // Feedback
  const [intercepted, setIntercepted] = useState(null);
  const [posting, setPosting] = useState(false);
  const [showSafetyDemo, setShowSafetyDemo] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [postError, setPostError] = useState(null);

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    loadFeed(0, true);
    loadLeaderboard("all");
    loadStats();
  }, [feedFilter]);

  const loadFeed = async (offset = 0, reset = false) => {
    setLoading(true);
    try {
      const typeParam = feedFilter !== "all" ? `&post_type=${feedFilter}` : "";
      const r = await fetch(
        `${API}/circles/feed?limit=10&offset=${offset}${typeParam}`, { headers }
      );
      const d = await r.json();
      const newPosts = d.posts || [];
      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      setHasMore(newPosts.length === 10);
      setPage(offset / 10);
    } catch { }
    setLoading(false);
  };

  const loadLeaderboard = async (type) => {
    try {
      const typeParam = type !== "all" ? `?challenge_type=${type}` : "";
      const r = await fetch(`${API}/circles/leaderboard${typeParam}`);
      const d = await r.json();
      setLeaderboard(d.leaderboard || []);
    } catch { }
  };

  const loadStats = async () => {
    try {
      const r = await fetch(`${API}/circles/stats`);
      const d = await r.json();
      setStats(d);
    } catch { }
  };

  const handlePost = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      const r = await fetch(`${API}/circles/post`, {
        method: "POST", headers,
        body: JSON.stringify({
          content, post_type: postType,
          anonymous, share_health: shareHealth
        }),
      });
      if (!r.ok) {
        const errText = await r.text().catch(() => "Unknown error");
        setPostError(`Failed to post: ${r.status} â€” ${errText}`);
        setPosting(false);
        return;
      }
      const d = await r.json();

      if (d.action === "intercepted" || d.action === "moderated") {
        setIntercepted(d.private_response);
        setContent("");
        setComposerOpen(false);
      } else {
        setContent("");
        setComposerOpen(false);
        loadFeed(0, true);
        loadStats();
      }
    } catch (e) {
      setPostError(`Network error: ${e.message || "Could not reach server"}`);
    }
    setPosting(false);
  };

  const handleReact = async (postId, emoji) => {
    try {
      await fetch(`${API}/circles/react`, {
        method: "POST", headers,
        body: JSON.stringify({ post_id: postId, emoji }),
      });
    } catch { }
  };

  const handleComment = async (postId, text, anon) => {
    try {
      const r = await fetch(`${API}/circles/comment`, {
        method: "POST", headers,
        body: JSON.stringify({ post_id: postId, content: text, anonymous: anon }),
      });
      return await r.json();
    } catch { }
  };

  const handleLbFilter = (f) => {
    setLbFilter(f);
    loadLeaderboard(f === "all" ? "all" : f);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% -10%, #0d0a2e 0%, #030308 60%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'DM Mono', monospace",
      color: "rgba(255,255,255,0.88)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes pulse   { 0%,100%{opacity:0.4} 50%{opacity:1} }
        * { box-sizing: border-box; }
      `}</style>

      {showSafetyDemo && <SafetyDemoModal onClose={() => setShowSafetyDemo(false)} />}

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{
        padding: "24px 40px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(250,250,249,0.9)", backdropFilter: "blur(12px)",
        flexShrink: 0, position: "sticky", top: 0, zIndex: 100,
      }}>
        <div>
          <div style={{
            fontSize: 28, color: "rgba(255,255,255,0.88)",
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800, letterSpacing: "-0.5px"
          }}>
            Circles
          </div>
          {stats && (
            <div style={{
              fontSize: 12, color: "rgba(255,255,255,0.3)",
              fontWeight: 500, marginTop: 4
            }}>
              {stats.total_members} members Â· {stats.total_posts} posts
              {stats.crisis_intercepted > 0 &&
                ` Â· ðŸ™Œ ${stats.crisis_intercepted} helped`}
            </div>
          )}
          <div style={{
            fontSize: 12, color: "rgba(255,255,255,0.28)",
            fontFamily: "'DM Mono', monospace",
            marginTop: 4, letterSpacing: 0.2, fontWeight: 400,
          }}>
            Share your journey, celebrate milestones, and find peer support
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* AI Safety badge */}
          <button onClick={() => setShowSafetyDemo(true)} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px",
            background: "rgba(34,197,94,0.1)",
            border: "none", borderRadius: 24, cursor: "pointer",
            fontFamily: "'DM Mono', monospace", fontWeight: 700,
            transition: "transform 0.2s"
          }}
            onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
            onMouseLeave={e => e.target.style.transform = "scale(1)"}
          >
            <span style={{ fontSize: 14 }}>ðŸ›¡</span>
            <span style={{ fontSize: 11, color: "#166534", letterSpacing: 0.5 }}>
              AI SAFETY ACTIVE
            </span>
          </button>

          {/* Feed type filter */}
          <div style={{
            display: "flex", gap: 4,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 12, padding: 4
          }}>
            {[["all", "All"], ["streak_share", "Streaks"], ["support_request", "Support"],
            ["milestone", "Milestones"]].map(([key, label]) => (
              <button key={key} onClick={() => setFeedFilter(key)} style={{
                padding: "8px 14px", borderRadius: 8, border: "none",
                background: feedFilter === key ? "#ffffff" : "transparent",
                boxShadow: feedFilter === key ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
                cursor: "pointer", fontWeight: 600,
                color: feedFilter === key ? "#60a5fa" : "rgba(255,255,255,0.3)",
                fontSize: 12, fontFamily: "'DM Mono', monospace",
                transition: "all 0.2s",
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Post button */}
          <button onClick={() => setComposerOpen(o => !o)} style={{
            padding: "10px 24px",
            background: composerOpen ? "rgba(255,255,255,0.04)" : "#60a5fa",
            border: "none", borderRadius: 24, cursor: "pointer",
            color: composerOpen ? "rgba(255,255,255,0.4)" : "#ffffff",
            fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace",
            transition: "all 0.2s",
            boxShadow: composerOpen ? "none" : "0 4px 14px rgba(96,165,250,0.3)"
          }}>
            {composerOpen ? "âœ• CANCEL" : "+ SHARE"}
          </button>
        </div>
      </div>

      {/* â”€â”€ Main layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{
        flex: 1, display: "flex",
        maxWidth: 1100, width: "100%",
        margin: "0 auto", padding: "32px 20px",
        gap: 40, alignItems: "flex-start"
      }}>

        {/* â”€â”€ Feed column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {intercepted && (
            <InterceptorBanner
              response={intercepted}
              onDismiss={() => setIntercepted(null)}
              onMindGuide={() => {
                setIntercepted(null);
                if (onNavigate) onNavigate("/mindguide");
              }}
            />
          )}

          {/* Composer */}
          {composerOpen && (
            <div style={{
              marginBottom: 32, padding: "24px",
              background: "rgba(255,255,255,0.025)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
              borderRadius: 20, animation: "fadeUp 0.3s ease",
            }}>
              {/* Post type selector */}
              <div style={{
                display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap"
              }}>
                {Object.entries(POST_TYPES).map(([key, t]) => (
                  <button key={key} onClick={() => setPostType(key)} style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: postType === key ? `${t.color}15` : "transparent",
                    border: `1px solid ${postType === key ? t.color : "rgba(255,255,255,0.08)"}`,
                    cursor: "pointer",
                    color: postType === key ? t.color : "rgba(255,255,255,0.4)",
                    fontFamily: "'DM Mono', monospace",
                    transition: "all 0.2s",
                  }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={
                  postType === "support_request"
                    ? "Share what you're going through. This community is here for you."
                    : postType === "streak_share"
                      ? "Share your streak milestone! How are you feeling?"
                      : "What's on your mind? Share with the communityâ€¦"
                }
                rows={4}
                style={{
                  width: "100%", padding: "16px",
                  background: "rgba(0,0,0,0.02)",
                  border: "none", borderRadius: 12, outline: "none", resize: "none",
                  color: "rgba(255,255,255,0.88)", fontSize: 15, lineHeight: 1.6,
                  fontFamily: "'DM Mono', monospace",
                }}
              />

              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginTop: 16
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button onClick={() => setAnonymous(a => !a)} style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: anonymous ? "rgba(255,255,255,0.07)" : "transparent",
                    border: `1px solid ${anonymous ? "transparent" : "rgba(255,255,255,0.08)"}`,
                    cursor: "pointer", color: "rgba(255,255,255,0.5)",
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    {anonymous ? "ðŸ›¡ ANONYMOUS" : "ðŸ‘€ PUBLIC"}
                  </button>

                  <button onClick={() => setShareHealth(s => !s)} style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: shareHealth ? "rgba(96,165,250,0.1)" : "transparent",
                    border: `1px solid ${shareHealth ? "transparent" : "rgba(255,255,255,0.08)"}`,
                    cursor: "pointer", color: shareHealth ? "#3b82f6" : "rgba(255,255,255,0.5)",
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    {shareHealth ? "âœ“ MOOD ATTACHED" : "+ ATTACH MOOD"}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 500 }}>
                    ðŸ›¡ AI screened before posting
                  </span>
                  <button
                    onClick={handlePost}
                    disabled={!content.trim() || posting}
                    style={{
                      padding: "10px 28px",
                      background: content.trim() ? "#60a5fa" : "rgba(255,255,255,0.04)",
                      border: "none", borderRadius: 24,
                      cursor: content.trim() ? "pointer" : "default",
                      color: content.trim() ? "#ffffff" : "rgba(255,255,255,0.25)",
                      fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                      transition: "all 0.2s",
                      boxShadow: content.trim() && !posting ? "0 4px 14px rgba(96,165,250,0.3)" : "none",
                    }}>
                    {posting ? "CHECKINGâ€¦" : "POST"}
                  </button>
                </div>
              </div>

              {postError && (
                <div style={{
                  marginTop: 12, padding: "12px 16px",
                  background: "rgba(239,68,68,0.1)", borderRadius: 12,
                  color: "#ef4444", fontSize: 12, fontFamily: "'DM Mono', monospace",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span>{postError}</span>
                  <button onClick={() => setPostError(null)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#ef4444", fontSize: 16, fontWeight: 800
                  }}>âœ•</button>
                </div>
              )}
            </div>
          )}

          {/* Posts list */}
          {loading && posts.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 0",
              color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 500,
              animation: "pulse 1.2s infinite"
            }}>
              Loading feed...
            </div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.1 }}>â—Ž</div>
              <div style={{ fontSize: 16, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                No posts yet â€” be the first to share
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onReact={handleReact}
                  onComment={handleComment}
                  myUserId="demo_user"
                />
              ))}

              {hasMore && (
                <button onClick={() => loadFeed((page + 1) * 10)} style={{
                  marginTop: 24, padding: "14px 0", width: "100%",
                  background: "rgba(255,255,255,0.04)", border: "none",
                  borderRadius: 16, cursor: "pointer", fontWeight: 700,
                  color: "rgba(255,255,255,0.4)", fontSize: 13,
                  fontFamily: "'DM Mono', monospace",
                  transition: "background 0.2s",
                }}
                  onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.04)"}
                >
                  LOAD MORE
                </button>
              )}
            </div>
          )}
        </div>

        {/* â”€â”€ Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <LeaderboardPanel
            leaderboard={leaderboard}
            filter={lbFilter}
            onFilter={handleLbFilter}
          />
        </div>
      </div>
    </div >
  );
}

