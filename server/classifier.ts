/**
 * AI opportunity classification
 * Uses GPT-4o-mini — fast and cheap for bulk classification
 * Returns: type, warmthScore, opportunityScore, nextAction, summary
 */

interface ClassificationResult {
  type: "Revenue" | "Network" | "Partnership" | "Reactivation" | null;
  warmthScore: number;
  opportunityScore: number;
  nextAction: string;
  summary: string;
}

const BATCH_SIZE = 20; // threads per GPT call

export async function classifyThreadBatch(threads: Array<{
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  daysSinceLastTouch: number;
}>): Promise<Map<string, ClassificationResult>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const results = new Map<string, ClassificationResult>();

  // Process in batches
  for (let i = 0; i < threads.length; i += BATCH_SIZE) {
    const batch = threads.slice(i, i + BATCH_SIZE);
    const batchResults = await classifyBatch(batch, apiKey);
    batchResults.forEach((v, k) => results.set(k, v));
  }

  return results;
}

async function classifyBatch(
  threads: Array<{ threadId: string; subject: string; from: string; snippet: string; daysSinceLastTouch: number }>,
  apiKey: string
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();

  const prompt = threads.map((t, i) =>
    `[${i}] ID:${t.threadId} | From:${t.from} | Subject:${t.subject} | Days since last touch:${t.daysSinceLastTouch} | Snippet:${t.snippet.slice(0, 150)}`
  ).join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 2000,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You are a B2B sales opportunity analyst. Classify email threads and return ONLY a JSON array — no preamble, no markdown.

For each thread return:
{
  "id": "<thread id>",
  "type": "Revenue" | "Network" | "Partnership" | "Reactivation" | null,
  "warmthScore": 1-10,
  "opportunityScore": 1-10,
  "nextAction": "Follow Up" | "Reconnect" | "Schedule Meeting" | "Send Proposal" | "Archive",
  "summary": "one sentence describing the opportunity"
}

TYPE definitions:
- Revenue: direct sales signal — pricing questions, proposals, demos, purchase intent, contract discussion
- Network: relationship with a person who could refer, introduce, or create future opportunities
- Partnership: integration, co-sell, channel, or business development conversation
- Reactivation: warm thread that has gone cold (no reply in 30+ days) — has latent opportunity value
- null: no meaningful opportunity — newsletters, receipts, automated notifications, spam

WARMTH SCORE (relationship temperature):
- 10: active 2-way conversation, replied within 7 days
- 7-9: positive exchange, replied within 30 days
- 4-6: one-sided or 30-90 days stale
- 1-3: cold, >90 days, or never engaged

OPPORTUNITY SCORE (revenue/business potential):
- 9-10: direct buying signal or high-value senior contact at target company
- 7-8: clear business context, relevant role, engaged
- 4-6: indirect potential, could develop
- 1-3: weak signal, low priority
- 0: no opportunity (use null type)`
          },
          {
            role: "user",
            content: `Classify these ${threads.length} email threads:\n\n${prompt}`,
          }
        ]
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error("[Classify] GPT error:", await res.text());
      return results;
    }

    const data = await res.json() as any;
    const raw = (data.choices?.[0]?.message?.content || "")
      .replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();

    const classifications = JSON.parse(raw) as ClassificationResult & { id: string }[];

    for (const c of classifications) {
      if (c.id) {
        results.set(c.id, {
          type: c.type,
          warmthScore: Math.min(10, Math.max(1, c.warmthScore || 5)),
          opportunityScore: Math.min(10, Math.max(1, c.opportunityScore || 5)),
          nextAction: c.nextAction || "Archive",
          summary: c.summary || "",
        });
      }
    }
  } catch (err: any) {
    console.error("[Classify] Batch failed:", err.message);
  }

  return results;
}

// Filter threads worth classifying — skip obvious noise
export function isWorthClassifying(subject: string, from: string, snippet: string): boolean {
  const subjectLower = subject.toLowerCase();
  const fromLower = from.toLowerCase();

  // Skip automated / no-reply senders
  if (fromLower.includes("noreply") || fromLower.includes("no-reply") ||
      fromLower.includes("donotreply") || fromLower.includes("notifications@") ||
      fromLower.includes("alerts@") || fromLower.includes("mailer@") ||
      fromLower.includes("newsletter")) return false;

  // Skip obvious noise subjects
  const noiseSubjects = ["unsubscribe", "invoice #", "receipt", "order confirmed",
    "your bill", "statement", "password reset", "verify your", "confirm your",
    "account security", "two-factor", "2fa", "login attempt"];
  if (noiseSubjects.some(n => subjectLower.includes(n))) return false;

  // Must have some content
  if (!subject && !snippet) return false;

  return true;
}
