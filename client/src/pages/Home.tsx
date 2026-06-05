import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../trpc";

export default function Home() {
  const navigate = useNavigate();
  const { data: me, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    onError: () => { localStorage.removeItem("inboxiq_token"); navigate("/login"); },
  });
  const { data: workspaceList = [] } = trpc.workspace.list.useQuery();
  const [activeTab, setActiveTab] = useState<"dashboard" | "workspace" | "opportunities" | "settings">("dashboard");
  const [showCreateWs, setShowCreateWs] = useState(false);
  const [wsName, setWsName] = useState("");
  const createWs = trpc.workspace.create.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!localStorage.getItem("inboxiq_token")) navigate("/login");
  }, []);

  if (isLoading) return <Loading />;

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!wsName.trim()) return;
    await createWs.mutateAsync({ name: wsName });
    setWsName(""); setShowCreateWs(false);
    utils.workspace.list.invalidate();
  }

  function handleLogout() {
    localStorage.removeItem("inboxiq_token");
    navigate("/login");
  }

  const activeWs = workspaceList[0];

  return (
    <div style={{ minHeight: "100vh", background: "#080f1e", color: "#e2e8f0", fontFamily: "DM Sans, sans-serif" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(8,15,30,0.96)", backdropFilter: "blur(12px)", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <GemLogo size={26} />
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "16px", color: "white", letterSpacing: "-0.02em" }}>
            Inbox<span style={{ color: "#60a5fa" }}>IQ</span>
          </span>
          {activeWs && <span style={{ fontSize: "13px", color: "#475569", marginLeft: "8px" }}>/ {activeWs.name}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "#64748b" }}>{me?.email}</span>
          <PlanBadge plan={me?.plan || "free"} />
          <button onClick={handleLogout} style={{ fontSize: "12px", color: "#64748b", background: "transparent", border: "none", cursor: "pointer" }}>Sign out</button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "2px", padding: "0 32px", background: "#0f172a", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {(["dashboard", "workspace", "opportunities", "settings"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 500, color: activeTab === tab ? "#60a5fa" : "#64748b", background: "transparent", border: "none", borderBottom: `2px solid ${activeTab === tab ? "#60a5fa" : "transparent"}`, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize", transition: "all .15s" }}>
            {tab}
          </button>
        ))}
      </div>

      <div style={{ padding: "32px" }}>
        {/* Dashboard tab */}
        {activeTab === "dashboard" && (
          <div>
            <div style={{ marginBottom: "8px", fontSize: "11px", fontFamily: "DM Mono, monospace", color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em" }}>Overview</div>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "22px", color: "white", marginBottom: "24px", letterSpacing: "-.02em" }}>
              Welcome back{me?.name ? `, ${me.name.split(" ")[0]}` : ""}
            </h2>

            {/* No workspace CTA */}
            {workspaceList.length === 0 && (
              <div style={{ background: "#0f172a", border: "1px solid rgba(37,99,235,0.3)", borderRadius: "14px", padding: "32px", maxWidth: "560px", marginBottom: "28px" }}>
                <div style={{ fontSize: "24px", marginBottom: "12px" }}>🏢</div>
                <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "18px", color: "white", marginBottom: "8px" }}>Create your workspace</div>
                <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px", lineHeight: 1.6 }}>A workspace brings your team together — connect your inboxes, share opportunities, and track follow-ups across the whole team.</p>
                <button onClick={() => setShowCreateWs(true)}
                  style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "10px", padding: "12px 24px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  Create workspace →
                </button>
              </div>
            )}

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "28px" }}>
              {[
                { label: "Connected inboxes", value: "0", color: "#60a5fa" },
                { label: "Opportunities found", value: "0", color: "#10b981" },
                { label: "Need follow-up", value: "0", color: "#f59e0b" },
                { label: "Team members", value: activeWs ? "1" : "0", color: "#a78bfa" },
              ].map(s => (
                <div key={s.label} style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "20px 24px" }}>
                  <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "30px", color: s.color, letterSpacing: "-.03em", marginBottom: "4px" }}>{s.value}</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Connect inbox CTA */}
            <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "24px 28px", maxWidth: "560px" }}>
              <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "16px", color: "white", marginBottom: "8px" }}>Connect your inbox</div>
              <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px", lineHeight: 1.6 }}>
                Gmail and Outlook OAuth coming in Phase 2. Your inbox will be scanned for revenue opportunities, warm contacts, and follow-ups that need attention.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button disabled style={{ background: "rgba(255,255,255,0.05)", color: "#475569", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "10px 18px", fontSize: "13px", cursor: "not-allowed", fontFamily: "inherit" }}>
                  📧 Connect Gmail (coming soon)
                </button>
                <button disabled style={{ background: "rgba(255,255,255,0.05)", color: "#475569", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "10px 18px", fontSize: "13px", cursor: "not-allowed", fontFamily: "inherit" }}>
                  📨 Connect Outlook (coming soon)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workspace tab */}
        {activeTab === "workspace" && (
          <div style={{ maxWidth: "640px" }}>
            <div style={{ marginBottom: "8px", fontSize: "11px", fontFamily: "DM Mono, monospace", color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em" }}>Team</div>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "22px", color: "white", marginBottom: "24px", letterSpacing: "-.02em" }}>Workspace</h2>

            {workspaceList.length === 0 ? (
              <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "32px", textAlign: "center" }}>
                <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>No workspace yet. Create one to invite your team.</p>
                <button onClick={() => setShowCreateWs(true)}
                  style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "10px", padding: "12px 24px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  Create workspace →
                </button>
              </div>
            ) : (
              workspaceList.map(ws => (
                <div key={ws.id} style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "24px 28px", marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <div>
                      <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "18px", color: "white" }}>{ws.name}</div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>Role: {(ws as any).role || "member"}</div>
                    </div>
                    <PlanBadge plan={ws.plan || "free"} />
                  </div>
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
                    <div style={{ fontSize: "12px", fontFamily: "DM Mono, monospace", color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "12px" }}>Members</div>
                    <div style={{ fontSize: "13px", color: "#94a3b8" }}>Invite team members to connect their inboxes and share the opportunity board.</div>
                    <button style={{ marginTop: "12px", background: "transparent", border: "1px solid rgba(37,99,235,0.3)", borderRadius: "8px", padding: "8px 16px", color: "#60a5fa", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}
                      onClick={() => alert("Invite flow coming — workspace owner can paste token or share link")}>
                      + Invite member
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Opportunities tab */}
        {activeTab === "opportunities" && (
          <div>
            <div style={{ marginBottom: "8px", fontSize: "11px", fontFamily: "DM Mono, monospace", color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em" }}>Revenue intelligence</div>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "22px", color: "white", marginBottom: "24px", letterSpacing: "-.02em" }}>Opportunity board</h2>
            <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "16px" }}>📭</div>
              <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "18px", color: "white", marginBottom: "8px" }}>No opportunities yet</div>
              <p style={{ fontSize: "14px", color: "#64748b", maxWidth: "360px", margin: "0 auto", lineHeight: 1.6 }}>
                Connect your inbox in Phase 2 and InboxIQ will scan your email history for hidden opportunities, warm contacts, and follow-ups that need attention.
              </p>
            </div>
          </div>
        )}

        {/* Settings tab */}
        {activeTab === "settings" && (
          <div style={{ maxWidth: "480px" }}>
            <div style={{ marginBottom: "8px", fontSize: "11px", fontFamily: "DM Mono, monospace", color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em" }}>Account</div>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "22px", color: "white", marginBottom: "24px", letterSpacing: "-.02em" }}>Settings</h2>
            <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "24px 28px" }}>
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", fontFamily: "DM Mono, monospace", color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "6px" }}>Name</div>
                <div style={{ fontSize: "14px", color: "white" }}>{me?.name}</div>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", fontFamily: "DM Mono, monospace", color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "6px" }}>Email</div>
                <div style={{ fontSize: "14px", color: "white" }}>{me?.email}</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", fontFamily: "DM Mono, monospace", color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "6px" }}>Plan</div>
                <PlanBadge plan={me?.plan || "free"} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create workspace modal */}
      {showCreateWs && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: "20px" }}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "420px" }}>
            <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "18px", color: "white", marginBottom: "20px" }}>Create workspace</h3>
            <form onSubmit={handleCreateWorkspace}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#64748b", marginBottom: "6px", fontFamily: "DM Mono, monospace", textTransform: "uppercase", letterSpacing: ".06em" }}>Workspace name</label>
                <input type="text" value={wsName} onChange={e => setWsName(e.target.value)} placeholder="Acme Sales Team" required
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "10px 12px", color: "white", fontSize: "14px", outline: "none" }} />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setShowCreateWs(false)} style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "11px", color: "#64748b", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button type="submit" disabled={createWs.isPending} style={{ flex: 2, background: "#2563eb", color: "white", border: "none", borderRadius: "8px", padding: "11px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {createWs.isPending ? "Creating..." : "Create →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    free: { bg: "rgba(100,116,139,0.15)", color: "#94a3b8" },
    personal: { bg: "rgba(37,99,235,0.15)", color: "#60a5fa" },
    team: { bg: "rgba(16,185,129,0.12)", color: "#34d399" },
    team_plus: { bg: "rgba(139,92,246,0.15)", color: "#a78bfa" },
  };
  const c = colors[plan] || colors.free;
  return (
    <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "99px", background: c.bg, color: c.color, fontFamily: "DM Mono, monospace", fontWeight: 500 }}>
      {plan.replace("_", " ")}
    </span>
  );
}

function GemLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <defs>
        <linearGradient id="hg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#2563eb"/></linearGradient>
        <linearGradient id="hg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#93c5fd"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient>
        <linearGradient id="hg3" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#1d4ed8"/><stop offset="100%" stopColor="#1e3a5f"/></linearGradient>
      </defs>
      <polygon points="36,4 68,36 36,68 4,36" fill="url(#hg3)" opacity="0.35"/>
      <polygon points="36,4 20,20 36,36 52,20" fill="url(#hg2)" opacity="0.9"/>
      <polygon points="36,4 52,20 68,36 36,36" fill="url(#hg1)" opacity="0.65"/>
      <polygon points="4,36 20,20 36,36 20,52" fill="url(#hg1)" opacity="0.5"/>
      <polygon points="68,36 52,20 36,36 52,52" fill="url(#hg2)" opacity="0.75"/>
      <polygon points="36,68 20,52 36,36 52,52" fill="url(#hg3)" opacity="0.95"/>
      <circle cx="36" cy="36" r="6" fill="white" opacity="0.95"/>
      <circle cx="36" cy="36" r="3" fill="#93c5fd"/>
    </svg>
  );
}

function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "DM Mono, monospace", fontSize: "13px", color: "#60a5fa" }}>Loading...</div>
    </div>
  );
}
