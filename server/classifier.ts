/**
 * AI opportunity classification
 * Uses GPT-4o-mini — fast and cheap for bulk classification
 * Returns: type, warmthScore, opportunityScore, nextAction, summary
 *
 * Tuned for ReviveIQI / Bryan Greer:
 * - B2B consulting + SaaS tools for sales teams and job seekers
 * - ICP: VP Sales, CRO, RevOps, Sales Directors at growth-stage B2B SaaS (50-500 employees)
 * - Secondary: job seekers, founders, career changers (ResumeIQ / MyCareerIQ users)
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
    `[${i}] ID:${t.threadId} | From:${t.from} | Subject:${t.subject} | Days since last touch:${t.daysSinceLastTouch} | Snippet:${t.snippet.slice(0, 200)}`
  ).join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 2500,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You are a revenue intelligence analyst for Bryan Greer, founder of ReviveIQI (reviveiqi.com).

ABOUT BRYAN AND REVIVEIQI:
ReviveIQI is a B2B revenue intelligence company that:
1. Provides consulting to help B2B sales teams diagnose broken pipelines and recover stalled revenue
2. Builds AI-powered SaaS tools: ResumeIQ (resume transformation), MyCareerIQ (job search pipeline), InboxIQ (email opportunity scanner)

BRYAN'S IDEAL CONTACTS (score these highly):
- Title signals: VP Sales, CRO, Chief Revenue Officer, VP Revenue, Sales Director, Head of Sales, RevOps, Revenue Operations, Sales Manager, Director of Sales, Founder, Co-founder, CEO (small company)
- Company signals: SaaS, B2B, growth-stage, Series A/B/C, 50-500 employees, sales team of 5+
- Job seeker signals: someone who mentioned resume, job search, career change, layoff, new role — potential ResumeIQ/MyCareerIQ user
- Former colleagues, managers, or coworkers — always high network value regardless of title

CLASSIFY each thread into exactly one type:

Revenue: Direct or near-direct commercial opportunity
  - Explicit: pricing questions, proposals, demos, contract discussions, "how much does it cost", "I want to hire you", "can we work together"
  - Implicit: a VP Sales or CRO who engaged warmly — even without explicit buying language, their title + engagement = revenue opportunity
  - Consulting inquiry: "I have a pipeline problem", "our close rate is terrible", "deals keep stalling"
  - Tool inquiry: "I need help with my resume", "I'm job searching", "tell me about your tools"

Network: Relationship capital with future opportunity potential
  - Former colleagues, managers, teammates — high value regardless of current conversation
  - Warm professional introductions
  - Connectors who could refer ReviveIQI to their network
  - Recruiters (potential pipeline for job-seeker referrals to MyCareerIQ/ResumeIQ)
  - Anyone who has expressed genuine interest in Bryan's work or ReviveIQI

Partnership: Business development and go-to-market opportunities
  - Integration, co-sell, referral, affiliate, reseller conversations
  - Complementary tools or services that serve overlapping audiences
  - Speaking opportunities, podcasts, content collaborations
  - Investor conversations

Reactivation: Warm thread that has gone cold — latent opportunity worth reviving
  - Any Revenue, Network, or Partnership thread with no reply in 14+ days (not 30 — act earlier)
  - Former clients or prospects who went quiet
  - Someone who showed interest but conversation dropped off
  - High-value contacts (VP/CRO/Founder) with no recent activity

null: No meaningful opportunity
  - Automated emails, newsletters, digests, marketing blasts
  - Receipts, invoices, order confirmations
  - Password resets, security alerts, account notifications
  - LinkedIn connection request emails (not the actual LinkedIn message)
  - Spam or irrelevant cold outreach with no signal

WARMTH SCORE — how alive and mutual is this relationship right now:
- 10: Active back-and-forth, replied within 7 days, clear mutual engagement
- 8-9: Positive exchange, last touch within 14 days
- 6-7: Good prior interaction, 14-30 days since last touch
- 4-5: One-sided or 30-60 days stale — needs action soon
- 2-3: Cold, 60-90 days, relationship exists but fading
- 1: >90 days or essentially cold — difficult but not impossible to revive

OPPORTUNITY SCORE — revenue/business potential for ReviveIQI specifically:
- 10: CRO/VP Sales at growth-stage SaaS with explicit pain signal OR direct consulting inquiry
- 8-9: VP Sales/CRO/Founder at relevant company, warm, no explicit ask yet — clear ICP match
- 7-8: Sales Director/RevOps/Head of Sales at relevant company, engaged
- 6-7: Mid-level sales role, job seeker actively looking, or strong referral connector
- 4-5: Tangential role but relationship has value, or indirect opportunity
- 2-3: Weak signal, unlikely to convert, but worth monitoring
- 1: Very low — keep only if relationship has historical significance

NEXT ACTION — choose the most specific appropriate action:
- "Reply" — respond to an active conversation
- "Reconnect" — re-engage a warm contact who has gone quiet
- "Schedule Call" — conversation is warm enough to propose a meeting
- "Send Proposal" — explicit buying signal, time to put something formal together
- "Refer to ReviveIQI" — job seeker or referral opportunity worth pointing to the tools
- "Archive" — no opportunity, safe to deprioritize

SUMMARY — one sentence that tells Bryan:
- Who the person is (name + title/context if available)
- What specifically makes this worth his attention
- What the latent opportunity is
Example: "Sarah Mitchell (VP Sales, Acme SaaS) engaged warmly about pipeline challenges 18 days ago — classic ReviveIQI consulting prospect gone quiet."
Example: "Former colleague from Renaissance Learning, now Director of RevOps at a Series B company — high-value reconnect."

Return ONLY a valid JSON array. No preamble, no markdown, no explanation.`
          },
          {
            role: "user",
            content: `Classify these ${threads.length} email threads for Bryan Greer / ReviveIQI:\n\n${prompt}`,
          }
        ]
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error("[Classify] GPT error:", res.status, await res.text());
      return results;
    }

    const data = await res.json() as any;
    const raw = (data.choices?.[0]?.message?.content || "")
      .replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();

    const classifications = JSON.parse(raw) as (ClassificationResult & { id: string })[];

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

// Filter threads worth classifying — skip obvious noise before sending to GPT
export function isWorthClassifying(subject: string, from: string, snippet: string): boolean {
  const subjectLower = subject.toLowerCase();
  const fromLower = from.toLowerCase();

  // Skip automated / no-reply senders
  const noreplyPatterns = ["noreply", "no-reply", "donotreply", "do-not-reply",
    "notifications@", "alerts@", "mailer@", "newsletter", "digest@",
    "updates@", "info@linkedin", "jobs-noreply", "bounce@"];
  if (noreplyPatterns.some(p => fromLower.includes(p))) return false;

  // Skip obvious noise subjects
  const noiseSubjects = [
    "unsubscribe", "invoice #", "receipt", "order confirmed", "order #",
    "your bill", "statement", "password reset", "verify your", "confirm your email",
    "account security", "two-factor", "2fa", "login attempt", "sign-in attempt",
    "payment confirmation", "your subscription", "billing", "invoice attached",
    "you have a new connection", "accepted your invitation", "viewed your profile",
    "new message on linkedin", // LinkedIn email notification — not the actual message
  ];
  if (noiseSubjects.some(n => subjectLower.includes(n))) return false;

  // Must have some content to classify
  if (!subject.trim() && !snippet.trim()) return false;

  // Skip very short automated snippets
  if (snippet.length < 10 && !subject) return false;

  return true;
}
