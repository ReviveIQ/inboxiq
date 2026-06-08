import express from "express";
import cors from "cors";
import path from "path";
import cron from "node-cron";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./trpc";
import { getDb } from "./db";
import { registerOAuthRoutes } from "../routers/inboxRouter";

const app = express();
const PORT = parseInt(process.env.PORT || "3001");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ── tRPC ─────────────────────────────────────────────────────────────────────
app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));

// ── OAuth routes (must be before static) ─────────────────────────────────────
registerOAuthRoutes(app);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true, product: "InboxIQ", ts: new Date().toISOString() }));

// ── Static assets + pages ─────────────────────────────────────────────────────
const staticPath = path.join(__dirname, "../../dist/public");
app.use(express.static(staticPath));

// Legal pages
app.get("/privacy", (_req, res) => res.sendFile(path.join(staticPath, "privacy.html")));
app.get("/terms", (_req, res) => res.sendFile(path.join(staticPath, "terms.html")));

// Public landing page at root — no auth required (required for Google OAuth verification)
app.get("/", (_req, res) => res.sendFile(path.join(staticPath, "landing.html")));

// React app for /login, /register, and all app routes
app.get("*", (_req, res) => res.sendFile(path.join(staticPath, "index.html")));

// ── Incremental scan cron (every 4 hours) ─────────────────────────────────────
async function runIncrementalScans() {
  try {
    const db = await getDb();
    if (!db) return;
    const { inboxes } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const { scanInbox } = await import("../scanner");

    const connectedInboxes = await db.select({ id: inboxes.id }).from(inboxes).where(eq(inboxes.connected, 1));
    console.log(`[Cron] Starting incremental scan for ${connectedInboxes.length} inboxes`);

    for (const inbox of connectedInboxes) {
      await scanInbox(inbox.id, false).catch(err =>
        console.error(`[Cron] Scan failed for inbox ${inbox.id}:`, err.message)
      );
    }
  } catch (err: any) {
    console.error("[Cron] Incremental scan error:", err.message);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await getDb();
    app.listen(PORT, () => {
      console.log(`[InboxIQ] Server running on port ${PORT}`);

      // Schedule incremental scans every 4 hours
      cron.schedule("0 */4 * * *", runIncrementalScans);
      console.log("[InboxIQ] Incremental scan cron scheduled (every 4 hours)");
    });
  } catch (err) {
    console.error("[InboxIQ] Failed to start:", err);
    process.exit(1);
  }
}

start();

// ── Process-level error alerting ─────────────────────────────────────────────
async function sendCrashAlert(type: string, err: any) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? (err.stack || "").slice(0, 800) : "";
  const time = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "InboxIQ Alerts <alerts@inboxiq.reviveiqi.com>",
        to: ["bryan@reviveiqi.com"],
        subject: `🚨 InboxIQ ${type} — ${msg.slice(0, 60)}`,
        html: `<div style="font-family:sans-serif;max-width:560px;padding:24px">
          <h2 style="color:#ef4444;margin:0 0 16px">🚨 InboxIQ ${type}</h2>
          <p><strong>Time:</strong> ${time} ET</p>
          <p><strong>Error:</strong> <span style="color:#dc2626">${msg}</span></p>
          ${stack ? `<pre style="font-size:12px;background:#f8fafc;padding:12px;border-radius:8px;overflow:auto">${stack}</pre>` : ""}
          <p style="font-size:12px;color:#94a3b8">Check Railway logs: inboxiq-production</p>
        </div>`,
      }),
    });
  } catch { /* never throw in crash handler */ }
}

process.on("uncaughtException", async (err) => {
  console.error("[InboxIQ] uncaughtException:", err);
  await sendCrashAlert("uncaughtException", err);
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  console.error("[InboxIQ] unhandledRejection:", reason);
  await sendCrashAlert("unhandledRejection", reason);
});

process.on("SIGTERM", () => {
  console.log("[InboxIQ] SIGTERM received — shutting down gracefully");
  process.exit(0);
});
