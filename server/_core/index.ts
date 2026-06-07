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

// ── Static frontend ───────────────────────────────────────────────────────────
const staticPath = path.join(__dirname, "../../dist/public");
app.use(express.static(staticPath));
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
