/**
 * Inbox scanner
 * Orchestrates: fetch threads → filter → classify → store opportunities
 * Runs on: initial connect (24-month history) + incremental (every 4h) + manual "Scan Now"
 */
import { getDb, decryptToken } from "./_core/db";
import { inboxes, opportunities, scans } from "./drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getGmailThreads, getGmailThread, parseGmailThread, refreshGmailToken } from "./gmail";
import { getOutlookMessages, parseOutlookMessage, refreshOutlookToken } from "./outlook";
import { classifyThreadBatch, isWorthClassifying } from "./classifier";

const MONTHS_BACK = 24;
const MAX_THREADS_PER_SCAN = 1000;

export async function scanInbox(inboxId: number, isInitial = false): Promise<{
  emailsScanned: number;
  opportunitiesFound: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Get inbox record
  const inboxRows = await db.select().from(inboxes).where(eq(inboxes.id, inboxId)).limit(1);
  if (!inboxRows.length) throw new Error(`Inbox ${inboxId} not found`);
  const inbox = inboxRows[0];

  // Create scan record
  const insertResult = await db.insert(scans).values({
    inboxId,
    userId: inbox.userId,
    status: "running",
    startedAt: new Date(),
  });

  // Get the scan we just inserted by finding the most recent one for this inbox
  const scanRows = await db.select().from(scans)
    .where(eq(scans.inboxId, inboxId))
    .orderBy(scans.createdAt)
    .limit(1);
  // Get most recent — orderBy desc
  const allScanRows = await db.select({ id: scans.id, status: scans.status })
    .from(scans)
    .where(eq(scans.inboxId, inboxId));
  const scanId = allScanRows.sort((a, b) => b.id - a.id)[0]?.id;

  console.log(`[Scanner] inbox ${inboxId}: scan ${scanId} starting (initial=${isInitial})`);

  try {
    // Get valid access token (refresh if expired)
    console.log(`[Scanner] inbox ${inboxId}: getting access token`);
    const accessToken = await getValidAccessToken(inbox);
    console.log(`[Scanner] inbox ${inboxId}: access token obtained`);

    // Fetch threads based on provider
    console.log(`[Scanner] inbox ${inboxId}: fetching ${inbox.provider} threads`);
    const rawThreads = inbox.provider === "gmail"
      ? await fetchGmailThreads(accessToken, isInitial)
      : await fetchOutlookThreads(accessToken, isInitial);

    // Filter to threads worth classifying
    const worthClassifying = rawThreads
      .filter(t => isWorthClassifying(t.subject, t.from, t.snippet))
      .slice(0, 200); // cap per scan — incremental scans will catch the rest

    console.log(`[Scanner] inbox ${inboxId}: ${rawThreads.length} threads → ${worthClassifying.length} worth classifying (capped at 200)`);

    // Classify in batches
    const now = new Date();
    const threadsWithAge = worthClassifying.map(t => ({
      ...t,
      daysSinceLastTouch: Math.floor((now.getTime() - t.date.getTime()) / (1000 * 60 * 60 * 24)),
    }));

    const classifications = await classifyThreadBatch(threadsWithAge);

    // Store opportunities (only non-null types with score >= 4)
    let opportunitiesFound = 0;
    for (const thread of worthClassifying) {
      const c = classifications.get(thread.threadId);
      if (!c || !c.type || c.opportunityScore < 3) continue;

      // Check if already stored
      const existing = await db.select({ id: opportunities.id })
        .from(opportunities)
        .where(and(eq(opportunities.inboxId, inboxId), eq(opportunities.threadId, thread.threadId)))
        .limit(1);

      if (existing.length > 0) {
        // Update scores on re-scan
        await db.update(opportunities).set({
          warmthScore: c.warmthScore,
          opportunityScore: c.opportunityScore,
          summary: c.summary,
          nextAction: c.nextAction,
          updatedAt: new Date(),
        }).where(eq(opportunities.id, existing[0].id));
      } else {
        // Parse contact info from From field
        const { name: contactName, email: contactEmail } = parseEmailAddress(thread.from);

        await db.insert(opportunities).values({
          userId: inbox.userId,
          workspaceId: inbox.workspaceId,
          inboxId,
          threadId: thread.threadId,
          contactName,
          contactEmail,
          subject: thread.subject,
          type: c.type,
          warmthScore: c.warmthScore,
          opportunityScore: c.opportunityScore,
          nextAction: c.nextAction,
          summary: c.summary,
          status: "Active",
          lastTouchAt: thread.date,
        });
        opportunitiesFound++;
      }
    }

    // Update scan record
    if (scanId) {
      await db.update(scans).set({
        status: "complete",
        emailsScanned: rawThreads.length,
        opportunitiesFound,
        completedAt: new Date(),
      }).where(eq(scans.id, scanId));
    }

    // Update inbox lastScanAt
    await db.update(inboxes).set({ lastScanAt: new Date() }).where(eq(inboxes.id, inboxId));

    console.log(`[Scanner] inbox ${inboxId}: scan complete — ${opportunitiesFound} new opportunities`);
    return { emailsScanned: rawThreads.length, opportunitiesFound };

  } catch (err: any) {
    console.error(`[Scanner] inbox ${inboxId} scan FAILED:`, err.message);
    console.error(`[Scanner] stack:`, err.stack);
    try {
      if (scanId) {
        const db2 = await getDb();
        if (db2) await db2.update(scans).set({ status: "failed", completedAt: new Date() }).where(eq(scans.id, scanId));
      }
    } catch (dbErr: any) {
      console.error(`[Scanner] Failed to update scan status:`, dbErr.message);
    }
    throw err;
  }
}

// ── Token management ──────────────────────────────────────────────────────────
async function getValidAccessToken(inbox: any): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const now = new Date();
  const expiry = inbox.tokenExpiresAt ? new Date(inbox.tokenExpiresAt) : null;
  const isExpired = !expiry || expiry <= new Date(now.getTime() + 5 * 60 * 1000); // 5min buffer

  if (!isExpired && inbox.accessToken) {
    return decryptToken(inbox.accessToken);
  }

  // Refresh the token
  console.log(`[Scanner] Refreshing ${inbox.provider} token for inbox ${inbox.id}`);
  const refreshed = inbox.provider === "gmail"
    ? await refreshGmailToken(inbox.refreshToken!)
    : await refreshOutlookToken(inbox.refreshToken!);

  await db.update(inboxes).set({
    accessToken: refreshed.accessToken,
    tokenExpiresAt: refreshed.expiresAt,
  }).where(eq(inboxes.id, inbox.id));

  return decryptToken(refreshed.accessToken);
}

// ── Thread fetchers ───────────────────────────────────────────────────────────
async function fetchGmailThreads(accessToken: string, isInitial: boolean): Promise<Array<{
  threadId: string; subject: string; from: string; to: string; date: Date; snippet: string; messageCount: number;
}>> {
  const threads: any[] = [];
  let pageToken: string | undefined;
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - (isInitial ? MONTHS_BACK : 0));

  let fetched = 0;
  do {
    const { threads: batch, nextPageToken } = await getGmailThreads(accessToken, 100, pageToken);
    pageToken = nextPageToken;

    // Fetch thread details in parallel (batches of 10)
    for (let i = 0; i < batch.length; i += 10) {
      const chunk = batch.slice(i, i + 10);
      const details = await Promise.all(
        chunk.map((t: any) => getGmailThread(accessToken, t.id).catch(() => null))
      );
      for (const detail of details) {
        if (detail) threads.push(parseGmailThread(detail));
      }
    }

    fetched += batch.length;
    if (fetched >= MAX_THREADS_PER_SCAN) break;
  } while (pageToken);

  return threads;
}

async function fetchOutlookThreads(accessToken: string, isInitial: boolean): Promise<Array<{
  threadId: string; subject: string; from: string; to: string; date: Date; snippet: string; messageCount: number;
}>> {
  const threads: any[] = [];
  let nextLink: string | undefined;
  let fetched = 0;

  do {
    const { messages, nextLink: next } = await getOutlookMessages(accessToken, 100, nextLink);
    nextLink = next;
    threads.push(...messages.map(parseOutlookMessage));
    fetched += messages.length;
    if (fetched >= MAX_THREADS_PER_SCAN) break;
  } while (nextLink);

  // Deduplicate by conversationId
  const seen = new Set<string>();
  return threads.filter(t => {
    if (seen.has(t.threadId)) return false;
    seen.add(t.threadId);
    return true;
  });
}

// ── Email address parser ──────────────────────────────────────────────────────
function parseEmailAddress(raw: string): { name: string; email: string } {
  // Handles: "John Smith <john@company.com>" or "john@company.com"
  const match = raw.match(/^(.*?)\s*<(.+@.+)>$/);
  if (match) {
    return {
      name: match[1].replace(/['"]/g, "").trim(),
      email: match[2].trim(),
    };
  }
  return { name: "", email: raw.trim() };
}
