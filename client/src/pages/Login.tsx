import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { trpc } from "../trpc";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = trpc.auth.login.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const result = await login.mutateAsync({ email, password });
      localStorage.setItem("inboxiq_token", result.token);
      navigate("/app");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080f1e", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <GemLogo />
          <h1 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "28px", color: "white", marginTop: "16px", letterSpacing: "-0.02em" }}>
            InboxIQ
          </h1>
          <p style={{ color: "#64748b", fontSize: "14px", marginTop: "6px" }}>Every reply is a revenue decision.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "32px" }}>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "20px", color: "white", marginBottom: "24px" }}>Sign in</h2>
          {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", padding: "10px 14px", color: "#f87171", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}
          <Field label="Email" type="email" value={email} onChange={setEmail} />
          <Field label="Password" type="password" value={password} onChange={setPassword} />
          <button type="submit" disabled={login.isPending} style={{ width: "100%", background: "#2563eb", color: "white", border: "none", borderRadius: "10px", padding: "13px", fontSize: "15px", fontWeight: 600, cursor: "pointer", marginTop: "8px" }}>
            {login.isPending ? "Signing in..." : "Sign in →"}
          </button>
          <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "#64748b" }}>
            No account? <Link to="/register" style={{ color: "#60a5fa" }}>Create one</Link>
          </p>
          <p style={{ textAlign: "center", marginTop: "12px", fontSize: "11px", color: "#334155" }}>
            <a href="/privacy" style={{ color: "#475569", textDecoration: "none" }}>Privacy Policy</a>
            {" · "}
            <a href="/terms" style={{ color: "#475569", textDecoration: "none" }}>Terms of Service</a>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontSize: "12px", color: "#64748b", marginBottom: "6px", fontFamily: "DM Mono, monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required
        style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "10px 12px", color: "white", fontSize: "14px", outline: "none" }} />
    </div>
  );
}

function GemLogo() {
  return (
    <svg width="48" height="48" viewBox="0 0 72 72" fill="none" style={{ margin: "0 auto", display: "block" }}>
      <defs>
        <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#2563eb"/></linearGradient>
        <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#93c5fd"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient>
        <linearGradient id="g3" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#1d4ed8"/><stop offset="100%" stopColor="#1e3a5f"/></linearGradient>
      </defs>
      <polygon points="36,4 68,36 36,68 4,36" fill="url(#g3)" opacity="0.35"/>
      <polygon points="36,4 20,20 36,36 52,20" fill="url(#g2)" opacity="0.9"/>
      <polygon points="36,4 52,20 68,36 36,36" fill="url(#g1)" opacity="0.65"/>
      <polygon points="4,36 20,20 36,36 20,52" fill="url(#g1)" opacity="0.5"/>
      <polygon points="68,36 52,20 36,36 52,52" fill="url(#g2)" opacity="0.75"/>
      <polygon points="36,68 20,52 36,36 52,52" fill="url(#g3)" opacity="0.95"/>
      <circle cx="36" cy="36" r="6" fill="white" opacity="0.95"/>
      <circle cx="36" cy="36" r="3" fill="#93c5fd"/>
    </svg>
  );
}
