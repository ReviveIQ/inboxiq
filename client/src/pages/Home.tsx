import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../trpc";

type OppType = "Revenue" | "Network" | "Partnership" | "Reactivation";

const TYPE_COLORS: Record<OppType, { bg: string; color: string }> = {
  Revenue:      { bg: "rgba(16,185,129,0.12)",  color: "#34d399" },
  Network:      { bg: "rgba(139,92,246,0.12)",  color: "#a78bfa" },
  Partnership:  { bg: "rgba(37,99,235,0.12)",   color: "#60a5fa" },
  Reactivation: { bg: "rgba(245,158,11,0.1)",   color: "#fbbf24" },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  "Active":      { bg: "rgba(37,99,235,0.12)",  color: "#60a5fa" },
  "Waiting":     { bg: "rgba(245,158,11,0.1)",  color: "#fbbf24" },
  "Closed Won":  { bg: "rgba(16,185,129,0.12)", color: "#34d399" },
  "Closed Lost": { bg: "rgba(239,68,68,0.1)",   color: "#f87171" },
  "Dismissed":   { bg: "rgba(100,116,139,0.1)", color: "#94a3b8" },
};

// ── Thread Panel ──────────────────────────────────────────────────────────────
function ThreadPanel({ opportunityId, onClose }: { opportunityId: number; onClose: () => void }) {
  const { data, isLoading, error } = trpc.inbox.getThread.useQuery({ opportunityId });

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: "520px",
      background: "#0f172a", borderLeft: "1px solid rgba(255,255,255,0.08)",
      zIndex: 1000, display: "flex", flexDirection: "column",
      boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {data?.subject || "Loading thread..."}
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
            {data?.messages?.length || 0} message{data?.messages?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "20px", padding: "4px 8px", flexShrink: 0 }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
        {isLoading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: "14px" }}>
            Loading thread...
          </div>
        )}
        {error && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#f87171", fontSize: "14px" }}>
            Could not load thread. Try again.
          </div>
        )}
        {data?.messages?.map((msg: any, i: number) => (
          <div key={msg.messageId} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px", marginBottom: "12px", overflow: "hidden",
          }}>
            {/* Message header */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "white" }}>{msg.from}</p>
                <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>To: {msg.to}</p>
              </div>
              <p style={{ margin: 0, fontSize: "11px", color: "#64748b", flexShrink: 0, marginLeft: "12px" }}>
                {new Date(msg.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
            {/* Message body */}
            <div style={{ padding: "14px 16px", maxHeight: "400px", overflow: "auto" }}>
              {msg.isHtml ? (
                <div
                  style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: 1.65 }}
                  dangerouslySetInnerHTML={{ __html: msg.body
                    // Sanitize inline styles to not break our dark theme
                    .replace(/color\s*:\s*[^;'"]+/gi, "color:inherit")
                    .replace(/background(-color)?\s*:\s*[^;'"]+/gi, "background:transparent")
                    .replace(/font-family\s*:\s*[^;'"]+/gi, "font-family:inherit")
                  }}
                />
              ) : (
                <pre style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: 1.65, whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>
                  {msg.body || msg.snippet}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { data: me, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    onError: () => { localStorage.removeItem("inboxiq_token"); navigate('/login'); },
  });
  const { data: workspaceList = [] } = trpc.workspace.list.useQuery();
  const { data: inboxList = [], refetch: refetchInboxes } = trpc.inbox.list.useQuery();
  const { data: oppStats } = trpc.opportunity.stats.useQuery();
  const [activeTab, setActiveTab] = useState<"dashboard" | "opportunities" | "workspace" | "settings">("dashboard");
  const [oppTypeFilter, setOppTypeFilter] = useState<string>("all");
  const [showCreateWs, setShowCreateWs] = useState(false);
  const [wsName, setWsName] = useState("");
  const [scanningId, setScanningId] = useState<number | null>(null);
  const [selectedOppId, setSelectedOppId] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const createWs = trpc.workspace.create.useMutation();
  const scanNow = trpc.inbox.scanNow.useMutation();
  const updateOpp = trpc.opportunity.update.useMutation();
  const utils = trpc.useUtils();

  const { data: opportunities = [] } = trpc.opportunity.list.useQuery({
    type: oppTypeFilter !== "all" ? oppTypeFilter as OppType : undefined,
  });

  // Handle OAuth redirect params
  useEffect(() => {
    if (!localStorage.getItem("inboxiq_token")) { navigate('/login'); return; }
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      showToast(`✓ ${params.get("connected") === "gmail" ? "Gmail" : "Outlook"} connected — scanning your inbox now`);
      refetchInboxes();
      utils.opportunity.stats.invalidate();
      window.history.replaceState({}, "", "/");
      setActiveTab("dashboard");
    }
    if (params.get("error")) {
      showToast("Connection failed — please try again");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  async function connectGmail() {
    try {
      const token = localStorage.getItem("inboxiq_token");
      const res = await fetch("/api/oauth/gmail/start", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { showToast("Failed to start Gmail connection"); }
  }

  async function connectOutlook() {
    try {
      const token = localStorage.getItem("inboxiq_token");
      const res = await fetch("/api/oauth/outlook/start", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { showToast("Failed to start Outlook connection"); }
  }

  async function handleScanNow(inboxId: number) {
    setScanningId(inboxId);
    try {
      await scanNow.mutateAsync({ id: inboxId });
      showToast("Scan started — opportunities will appear in a few minutes");
      setTimeout(() => { utils.opportunity.stats.invalidate(); utils.opportunity.list.invalidate(); }, 5000);
    } catch { showToast("Scan failed — please try again"); }
    finally { setScanningId(null); }
  }

  async function handleUpdateOpp(id: number, status: string) {
    await updateOpp.mutateAsync({ id, status });
    utils.opportunity.list.invalidate();
    utils.opportunity.stats.invalidate();
  }

  async function handleCreateWs(e: React.FormEvent) {
    e.preventDefault();
    if (!wsName.trim()) return;
    await createWs.mutateAsync({ name: wsName });
    setWsName(""); setShowCreateWs(false);
    utils.workspace.list.invalidate();
  }

  if (isLoading) return <Loading />;

  const hasInboxes = inboxList.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#080f1e", color: "#e2e8f0", fontFamily: "DM Sans, sans-serif" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(8,15,30,0.96)", backdropFilter: "blur(12px)", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <GemLogo size={26} />
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "16px", color: "white", letterSpacing: "-0.02em" }}>
            Inbox<span style={{ color: "#60a5fa" }}>IQ</span>
          </span>
          {workspaceList[0] && <span style={{ fontSize: "13px", color: "#475569", marginLeft: "8px" }}>/ {workspaceList[0].name}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "#64748b" }}>{me?.email}</span>
          <PlanBadge plan={me?.plan || "free"} />
          <button onClick={() => { localStorage.removeItem("inboxiq_token"); navigate('/login'); }}
            style={{ fontSize: "12px", color: "#64748b", background: "transparent", border: "none", cursor: "pointer" }}>Sign out</button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "2px", padding: "0 32px", background: "#0f172a", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {(["dashboard", "opportunities", "workspace", "settings"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 500, color: activeTab === tab ? "#60a5fa" : "#64748b", background: "transparent", border: "none", borderBottom: `2px solid ${activeTab === tab ? "#60a5fa" : "transparent"}`, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize", transition: "all .15s" }}>
            {tab}
          </button>
        ))}
      </div>

      <div style={{ padding: "32px" }}>

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div>
            <div style={{ fontSize: "11px", fontFamily: "DM Mono, monospace", color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: "8px" }}>Overview</div>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "22px", color: "white", marginBottom: "24px", letterSpacing: "-.02em" }}>
              Welcome back{me?.name ? `, ${me.name.split(" ")[0]}` : ""}
            </h2>

            {/* KPI cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "28px" }}>
              {[
                { label: "Connected inboxes", value: inboxList.length, color: "#60a5fa" },
                { label: "Opportunities found", value: oppStats?.total || 0, color: "#10b981" },
                { label: "Need follow-up", value: oppStats?.needFollowUp || 0, color: "#f59e0b" },
                { label: "Revenue signals", value: oppStats?.byType?.Revenue || 0, color: "#34d399" },
              ].map(s => (
                <div key={s.label} style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "20px 24px" }}>
                  <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "30px", color: s.color, letterSpacing: "-.03em", marginBottom: "4px" }}>{s.value}</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Connected inboxes */}
            <div style={{ fontSize: "11px", fontFamily: "DM Mono, monospace", color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: "12px" }}>Connected inboxes</div>

            {inboxList.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                {inboxList.map(inbox => (
                  <div key={inbox.id} style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "20px" }}>{inbox.provider === "gmail" ? "📧" : "📨"}</span>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 500, color: "white" }}>{inbox.email}</div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          {inbox.provider === "gmail" ? "Gmail" : "Outlook"} ·{" "}
                          {inbox.lastScanAt ? `Last scanned ${new Date(inbox.lastScanAt).toLocaleDateString()}` : "Never scanned"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleScanNow(inbox.id)}
                      disabled={scanningId === inbox.id}
                      style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", borderRadius: "8px", padding: "8px 16px", color: "#60a5fa", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
                      {scanningId === inbox.id ? "Scanning..." : "Scan Now"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Connect inbox CTAs */}
            <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "24px 28px" }}>
              <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "16px", color: "white", marginBottom: "6px" }}>
                {hasInboxes ? "Connect another inbox" : "Connect your inbox"}
              </div>
              <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px", lineHeight: 1.6 }}>
                {hasInboxes
                  ? "Add more inboxes to surface opportunities across your full communication history."
                  : "Connect Gmail or Outlook to scan your email history for hidden revenue opportunities, warm contacts, and follow-ups that need attention."}
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={connectGmail}
                  style={{ background: "rgba(37,99,235,0.12)", color: "#60a5fa", border: "1px solid rgba(37,99,235,0.3)", borderRadius: "8px", padding: "10px 18px", fontSize: "13px", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                  📧 Connect Gmail
                </button>
                <button onClick={connectOutlook}
                  style={{ background: "rgba(37,99,235,0.12)", color: "#60a5fa", border: "1px solid rgba(37,99,235,0.3)", borderRadius: "8px", padding: "10px 18px", fontSize: "13px", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                  📨 Connect Outlook
                </button>
              </div>
            </div>

            {/* Recent opportunities preview */}
            {opportunities.length > 0 && (
              <div style={{ marginTop: "28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ fontSize: "11px", fontFamily: "DM Mono, monospace", color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em" }}>Recent opportunities</div>
                  <button onClick={() => setActiveTab("opportunities")} style={{ fontSize: "12px", color: "#60a5fa", background: "transparent", border: "none", cursor: "pointer" }}>View all →</button>
                </div>
                {opportunities.slice(0, 5).map(opp => (
                  <OppRow key={opp.id} opp={opp} onUpdate={handleUpdateOpp} onViewThread={setSelectedOppId} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* OPPORTUNITIES */}
        {activeTab === "opportunities" && (
          <div>
            <div style={{ fontSize: "11px", fontFamily: "DM Mono, monospace", color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: "8px" }}>Revenue intelligence</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "22px", color: "white", letterSpacing: "-.02em" }}>Opportunity board</h2>
              <div style={{ display: "flex", gap: "6px" }}>
                {["all", "Revenue", "Network", "Partnership", "Reactivation"].map(f => (
                  <button key={f} onClick={() => setOppTypeFilter(f)}
                    style={{ fontSize: "12px", padding: "5px 12px", borderRadius: "99px", border: "1px solid", fontFamily: "inherit", cursor: "pointer", background: oppTypeFilter === f ? "rgba(37,99,235,0.15)" : "transparent", color: oppTypeFilter === f ? "#60a5fa" : "#64748b", borderColor: oppTypeFilter === f ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.08)" }}>
                    {f === "all" ? "All" : f}
                  </button>
                ))}
              </div>
            </div>

            {opportunities.length === 0 ? (
              <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "48px", textAlign: "center" }}>
                <div style={{ fontSize: "32px", marginBottom: "16px" }}>📭</div>
                <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "18px", color: "white", marginBottom: "8px" }}>
                  {hasInboxes ? "No opportunities yet" : "Connect an inbox to get started"}
                </div>
                <p style={{ fontSize: "14px", color: "#64748b", maxWidth: "360px", margin: "0 auto 20px", lineHeight: 1.6 }}>
                  {hasInboxes
                    ? "The initial scan is processing. Opportunities will appear here once classification is complete."
                    : "Connect Gmail or Outlook from the Dashboard to scan your email history for hidden revenue opportunities."}
                </p>
                {!hasInboxes && (
                  <button onClick={() => setActiveTab("dashboard")}
                    style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "10px", padding: "12px 24px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Connect inbox →
                  </button>
                )}
              </div>
            ) : (
              <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "1fr 100px 100px 1fr 110px 80px", gap: "12px", fontSize: "11px", fontFamily: "DM Mono, monospace", color: "#475569", textTransform: "uppercase", letterSpacing: ".06em" }}>
                  <span>Contact</span><span>Type</span><span>Score</span><span>Summary</span><span>Next action</span><span>Status</span>
                </div>
                {opportunities.map(opp => (
                  <OppRow key={opp.id} opp={opp} onUpdate={handleUpdateOpp} showFull onViewThread={setSelectedOppId} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* WORKSPACE */}
        {activeTab === "workspace" && (
          <div style={{ maxWidth: "640px" }}>
            <div style={{ fontSize: "11px", fontFamily: "DM Mono, monospace", color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: "8px" }}>Team</div>
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
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px", fontSize: "13px", color: "#94a3b8" }}>
                    Invite team members to connect their inboxes and share the opportunity board.
                    <button style={{ marginTop: "10px", display: "block", background: "transparent", border: "1px solid rgba(37,99,235,0.3)", borderRadius: "8px", padding: "8px 16px", color: "#60a5fa", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
                      + Invite member
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === "settings" && (
          <div style={{ maxWidth: "480px" }}>
            <div style={{ fontSize: "11px", fontFamily: "DM Mono, monospace", color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: "8px" }}>Account</div>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "22px", color: "white", marginBottom: "24px", letterSpacing: "-.02em" }}>Settings</h2>
            <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "24px 28px" }}>
              {[["Name", me?.name || "—"], ["Email", me?.email || "—"]].map(([label, val]) => (
                <div key={label} style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "12px", fontFamily: "DM Mono, monospace", color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "6px" }}>{label}</div>
                  <div style={{ fontSize: "14px", color: "white" }}>{val}</div>
                </div>
              ))}
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
            <form onSubmit={handleCreateWs}>
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

      {/* Thread Panel */}
      {selectedOppId && (
        <>
          <div onClick={() => setSelectedOppId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} />
          <ThreadPanel opportunityId={selectedOppId} onClose={() => setSelectedOppId(null)} />
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", background: "#0f172a", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "10px", padding: "12px 18px", fontSize: "13px", color: "#34d399", zIndex: 999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function OppRow({ opp, onUpdate, showFull = false, onViewThread }: { opp: any; onUpdate: (id: number, status: string) => void; showFull?: boolean; onViewThread?: (id: number) => void }) {
  const tc = TYPE_COLORS[opp.type as OppType] || { bg: "rgba(100,116,139,0.12)", color: "#94a3b8" };
  const sc = STATUS_COLORS[opp.status] || STATUS_COLORS["Active"];
  const score = Math.round(((opp.warmthScore || 5) + (opp.opportunityScore || 5)) / 2);

  return (
    <div style={{ display: "grid", gridTemplateColumns: showFull ? "1fr 100px 100px 1fr 110px 80px 60px" : "1fr 90px 80px 80px 60px", gap: "12px", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "13px" }}>
      <div>
        <div style={{ fontWeight: 500, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opp.contactName || opp.contactEmail || "Unknown"}</div>
        <div style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opp.contactEmail}</div>
      </div>
      <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "6px", background: tc.bg, color: tc.color, fontFamily: "DM Mono, monospace", fontWeight: 500, whiteSpace: "nowrap" }}>{opp.type}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <div style={{ height: "4px", flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: "99px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${score * 10}%`, background: score >= 7 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444", borderRadius: "99px" }} />
        </div>
        <span style={{ fontSize: "11px", color: "#64748b", flexShrink: 0 }}>{score}</span>
      </div>
      {showFull && (
        <div style={{ fontSize: "12px", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opp.summary || opp.subject}</div>
      )}
      {showFull && (
        <span style={{ fontSize: "11px", color: "#64748b" }}>{opp.nextAction}</span>
      )}
      <select
        value={opp.status}
        onChange={e => onUpdate(opp.id, e.target.value)}
        style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px", background: sc.bg, color: sc.color, border: "none", cursor: "pointer", fontFamily: "DM Mono, monospace" }}>
        {["Active", "Waiting", "Closed Won", "Closed Lost", "Dismissed"].map(s => (
          <option key={s} value={s} style={{ background: "#0f172a", color: "white" }}>{s}</option>
        ))}
      </select>
      <button
        onClick={() => onViewThread?.(opp.id)}
        style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px", background: "rgba(37,99,235,0.12)", color: "#60a5fa", border: "1px solid rgba(37,99,235,0.2)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
        View
      </button>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    free:      { bg: "rgba(100,116,139,0.15)", color: "#94a3b8" },
    personal:  { bg: "rgba(37,99,235,0.15)",   color: "#60a5fa" },
    team:      { bg: "rgba(16,185,129,0.12)",  color: "#34d399" },
    team_plus: { bg: "rgba(139,92,246,0.15)",  color: "#a78bfa" },
  };
  const c = colors[plan] || colors.free;
  return <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "99px", background: c.bg, color: c.color, fontFamily: "DM Mono, monospace", fontWeight: 500 }}>{plan.replace("_", " ")}</span>;
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
