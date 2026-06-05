import express from "express";
import cors from "cors";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./trpc";
import { getDb } from "./db";

const app = express();
const PORT = parseInt(process.env.PORT || "3001");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ── tRPC ─────────────────────────────────────────────────────────────────────
app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true, product: "InboxIQ", ts: new Date().toISOString() }));

// ── Static frontend ───────────────────────────────────────────────────────────
const staticPath = path.join(__dirname, "../../dist/public");
app.use(express.static(staticPath));
app.get("*", (_req, res) => res.sendFile(path.join(staticPath, "index.html")));

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await getDb();
    app.listen(PORT, () => console.log(`[InboxIQ] Server running on port ${PORT}`));
  } catch (err) {
    console.error("[InboxIQ] Failed to start:", err);
    process.exit(1);
  }
}

start();
