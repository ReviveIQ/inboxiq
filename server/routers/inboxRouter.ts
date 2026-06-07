import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../_core/db";
import { inboxes, opportunities, scans } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { scanInbox } from "../scanner";
import type { Express, Request, Response } from "express";

// ── tRPC router ───────────────────────────────────────────────────────────────
export const inboxRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const rows = await db.select().from(inboxes).where(eq(inboxes.userId, ctx.user.userId));
    return rows.map(r => ({
      id: r.id,
      provider: r.provider,
      email: r.email,
      connected: r.connected,
      lastScanAt: r.lastScanAt,
    }));
  }),

  disconnect: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const inbox = await db.select().from(inboxes)
        .where(and(eq(inboxes.id, input.id), eq(inboxes.userId, ctx.user.userId)))
        .limit(1);
      if (!inbox.length) throw new TRPCError({ code: "NOT_FOUND" });
      await db.update(inboxes).set({ connected: 0 }).where(eq(inboxes.id, input.id));
      return { success: true };
    }),

  scanNow: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const inbox = await db.select().from(inboxes)
        .where(and(eq(inboxes.id, input.id), eq(inboxes.userId, ctx.user.userId)))
        .limit(1);
      if (!inbox.length) throw new TRPCError({ code: "NOT_FOUND" });

      // Run scan in background — don't await
      scanInbox(input.id, false).catch(err =>
        console.error(`[InboxRouter] Background scan failed for inbox ${input.id}:`, err.message)
      );

      return { started: true, message: "Scan started — opportunities will appear shortly" };
    }),

  lastScan: protectedProcedure
    .input(z.object({ inboxId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const rows = await db.select().from(scans)
        .where(eq(scans.inboxId, input.inboxId))
        .orderBy(desc(scans.createdAt))
        .limit(1);
      return rows[0] || null;
    }),
});

export const opportunityRouter = router({
  list: protectedProcedure
    .input(z.object({
      workspaceId: z.number().optional(),
      type: z.enum(["Revenue", "Network", "Partnership", "Reactivation"]).optional(),
      status: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const rows = await db.select().from(opportunities)
        .where(eq(opportunities.userId, ctx.user.userId))
        .orderBy(desc(opportunities.opportunityScore), desc(opportunities.warmthScore));

      return rows.filter(r => {
        if (input.type && r.type !== input.type) return false;
        if (input.status && r.status !== input.status) return false;
        if (r.status === "Dismissed") return false;
        return true;
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.string().optional(),
      nextAction: z.string().optional(),
      snoozedUntil: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const opp = await db.select().from(opportunities)
        .where(and(eq(opportunities.id, input.id), eq(opportunities.userId, ctx.user.userId)))
        .limit(1);
      if (!opp.length) throw new TRPCError({ code: "NOT_FOUND" });

      await db.update(opportunities).set({
        ...(input.status && { status: input.status as any }),
        ...(input.nextAction && { nextAction: input.nextAction }),
        ...(input.snoozedUntil && { snoozedUntil: new Date(input.snoozedUntil) }),
        updatedAt: new Date(),
      }).where(eq(opportunities.id, input.id));

      return { success: true };
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const rows = await db.select().from(opportunities)
      .where(and(eq(opportunities.userId, ctx.user.userId)));

    const active = rows.filter(r => r.status === "Active").length;
    const needFollowUp = rows.filter(r =>
      r.status === "Active" && r.nextAction && r.nextAction !== "Archive"
    ).length;
    const byType = {
      Revenue: rows.filter(r => r.type === "Revenue").length,
      Network: rows.filter(r => r.type === "Network").length,
      Partnership: rows.filter(r => r.type === "Partnership").length,
      Reactivation: rows.filter(r => r.type === "Reactivation").length,
    };
    return { total: rows.length, active, needFollowUp, byType };
  }),
});

// ── Express OAuth routes (must be outside tRPC) ───────────────────────────────
export function registerOAuthRoutes(app: Express) {

  // Gmail — initiate
  app.get("/api/oauth/gmail/start", async (req: Request, res: Response) => {
    try {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      const { verifyToken } = await import("../_core/db");
      const user = await verifyToken(token);
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

      const { getGmailAuthUrl } = await import("../gmail");
      const url = getGmailAuthUrl(user.userId);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Gmail — callback
  app.get("/api/oauth/gmail/callback", async (req: Request, res: Response) => {
    try {
      const { code, state: userId } = req.query as { code: string; state: string };
      if (!code || !userId) { res.redirect("/?error=oauth_failed"); return; }

      const { exchangeGmailCode } = await import("../gmail");
      const tokens = await exchangeGmailCode(code);

      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Check if inbox already connected
      const existing = await db.select().from(inboxes)
        .where(and(eq(inboxes.userId, parseInt(userId)), eq(inboxes.email, tokens.email)))
        .limit(1);

      let inboxId: number;
      if (existing.length > 0) {
        await db.update(inboxes).set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          connected: 1,
        }).where(eq(inboxes.id, existing[0].id));
        inboxId = existing[0].id;
      } else {
        await db.insert(inboxes).values({
          userId: parseInt(userId),
          provider: "gmail",
          email: tokens.email,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          connected: 1,
        });
        const newInbox = await db.select().from(inboxes)
          .where(and(eq(inboxes.userId, parseInt(userId)), eq(inboxes.email, tokens.email)))
          .limit(1);
        inboxId = newInbox[0].id;

        // Kick off initial scan in background
        scanInbox(inboxId, true).catch(err =>
          console.error(`[OAuth] Initial Gmail scan failed:`, err.message)
        );
      }

      // Redirect to app with success
      res.redirect("/?connected=gmail&inbox=" + inboxId);
    } catch (err: any) {
      console.error("[OAuth] Gmail callback error:", err.message);
      res.redirect("/?error=gmail_oauth_failed");
    }
  });

  // Outlook — initiate
  app.get("/api/oauth/outlook/start", async (req: Request, res: Response) => {
    try {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      const { verifyToken } = await import("../_core/db");
      const user = await verifyToken(token);
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

      const { getOutlookAuthUrl } = await import("../outlook");
      const url = getOutlookAuthUrl(user.userId);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Outlook — callback
  app.get("/api/oauth/outlook/callback", async (req: Request, res: Response) => {
    try {
      const { code, state: userId } = req.query as { code: string; state: string };
      if (!code || !userId) { res.redirect("/?error=oauth_failed"); return; }

      const { exchangeOutlookCode } = await import("../outlook");
      const tokens = await exchangeOutlookCode(code);

      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const existing = await db.select().from(inboxes)
        .where(and(eq(inboxes.userId, parseInt(userId)), eq(inboxes.email, tokens.email)))
        .limit(1);

      let inboxId: number;
      if (existing.length > 0) {
        await db.update(inboxes).set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          connected: 1,
        }).where(eq(inboxes.id, existing[0].id));
        inboxId = existing[0].id;
      } else {
        await db.insert(inboxes).values({
          userId: parseInt(userId),
          provider: "outlook",
          email: tokens.email,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          connected: 1,
        });
        const newInbox = await db.select().from(inboxes)
          .where(and(eq(inboxes.userId, parseInt(userId)), eq(inboxes.email, tokens.email)))
          .limit(1);
        inboxId = newInbox[0].id;

        scanInbox(inboxId, true).catch(err =>
          console.error(`[OAuth] Initial Outlook scan failed:`, err.message)
        );
      }

      res.redirect("/?connected=outlook&inbox=" + inboxId);
    } catch (err: any) {
      console.error("[OAuth] Outlook callback error:", err.message);
      res.redirect("/?error=outlook_oauth_failed");
    }
  });
}
