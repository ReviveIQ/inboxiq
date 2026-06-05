# InboxIQ — Product Requirements Document
**Version 1.0 · June 2026 · ReviveIQI**
*Where Revenue Intelligence Meets Real Execution*

---

## 1. Product Overview

InboxIQ is a B2B SaaS product that connects to any email inbox — Gmail or Outlook — and surfaces hidden revenue opportunities that have gone cold, been forgotten, or were never properly followed up on. It turns a cluttered inbox into a structured opportunity intelligence system.

### 1.1 The Problem

B2B sales teams lose recoverable revenue every day not from lack of pipeline, but because existing conversations go cold inside email. A warm intro from 6 months ago. A prospect who asked for a follow-up that never came. A deal that stalled and nobody remembers. The revenue is there — it's just buried.

Most tools solve this at the CRM layer. InboxIQ solves it at the inbox layer — where the conversations actually live.

### 1.2 The Solution

InboxIQ connects to a team's email inboxes, scans for opportunity signals using AI classification, scores contacts by relationship warmth and revenue potential, and surfaces actionable follow-up recommendations. Managers get a workspace view across their entire team's inboxes. Reps get a personal triage interface.

### 1.3 Position in the ReviveIQI Suite

```
ResumeIQ        → optimize how you present yourself (job seekers)
MyCareerIQ      → manage your job search pipeline (job seekers)
InboxIQ         → recover revenue buried in email (B2B sales teams)
ReviveIQI Core  → B2B pipeline recovery consulting
```

InboxIQ is the first ReviveIQI product targeting B2B sales teams directly. It creates a natural entry point into ReviveIQI consulting engagements — teams using InboxIQ who want deeper pipeline diagnostics can be upsold to ReviveIQI Core.

---

## 2. Target Market

### 2.1 Primary: B2B Sales Teams at Growth-Stage SaaS Companies

- **Company size:** 10–200 employees
- **Team size:** 2–15 sales reps + 1 manager
- **Pain:** Stalled pipeline, inconsistent follow-up, deals falling through the cracks
- **Trigger:** New sales manager, missed quarter, CRM cleanup initiative

### 2.2 Secondary: Founder-Led Sales

- Solo founders or small teams doing outbound
- No CRM discipline yet — everything lives in Gmail
- High value per recovered opportunity

### 2.3 Tertiary: Revenue Operations

- RevOps or sales ops leaders who need visibility across rep inboxes
- Used for auditing communication quality and follow-up compliance

---

## 3. Workspace Model

Workspaces are a first-class concept in InboxIQ. Unlike MyCareerIQ (where every user is their own pipeline), B2B sales teams share context — a manager needs visibility across their team's inboxes, and reps need a shared opportunity board.

### 3.1 Workspace Structure

```
Workspace (e.g. "Acme Sales Team")
├── Owner (Sales Manager)
│   └── Connected inbox: manager@acme.com
├── Member (Rep 1)
│   └── Connected inbox: rep1@acme.com
├── Member (Rep 2)
│   └── Connected inbox: rep2@acme.com
└── Shared Opportunity Board
    └── Aggregated view across all connected inboxes
```

### 3.2 Roles

| Role | Permissions |
|---|---|
| **Owner** | Create workspace, invite members, view all inboxes, manage billing, access team analytics |
| **Member** | Connect own inbox, manage own opportunities, view shared board |
| **Viewer** *(future)* | Read-only access to shared board — for execs or RevOps |

### 3.3 Workspace Creation Flow

1. User signs up → prompted to create a workspace or join an existing one
2. Workspace owner invites members via email
3. Each member connects their own inbox (OAuth)
4. Owner sees all connected inboxes in the team dashboard
5. Shared opportunity board aggregates across all members

---

## 4. Email Integration

### 4.1 Supported Providers (v1.0)

| Provider | Auth Method | Scope Required |
|---|---|---|
| **Gmail** | Google OAuth 2.0 | `gmail.readonly`, `gmail.labels`, `gmail.modify` |
| **Outlook / Microsoft 365** | Microsoft OAuth 2.0 (MSAL) | `Mail.Read`, `Mail.ReadWrite` |

### 4.2 What We Read

- **From / To / CC** — identify who the conversation is with
- **Subject line** — classify opportunity type
- **Thread snippets** — surface context without reading full body unless needed
- **Date / timestamp** — calculate recency and relationship warmth
- **Labels / folders** — respect existing organization

### 4.3 What We Never Do

- Never store full email body text in our database
- Never send emails on behalf of the user without explicit confirmation
- Never share one user's inbox data with another user (even in the same workspace) — only aggregated opportunity metadata is shared
- Never train models on user email content

### 4.4 Scan Frequency

- **Initial scan:** historical — goes back 24 months on first connect
- **Ongoing:** incremental scan every 4 hours for new signals
- **Manual:** "Scan Now" button available at any time

---

## 5. Opportunity Classification

### 5.1 Opportunity Types

| Type | Signal | Example |
|---|---|---|
| **Revenue** | Deal language, pricing, proposals, contracts | "Let me know your pricing", "Can you send a proposal" |
| **Network** | Introductions, referrals, warm connections | "I'd love to introduce you to", "Thought of you" |
| **Partnership** | Integration, co-sell, channel language | "Explore a partnership", "Work together" |
| **Reactivation** | Warm thread gone cold (>30 days, no reply) | Any thread with positive signal + no recent reply |

### 5.2 Opportunity Scoring

Each contact/thread is scored on two dimensions:

**Relationship Warmth (1–10)**
- 10: Active thread, replied within 7 days, mutual engagement
- 7–9: Replied within 30 days, positive tone
- 4–6: Thread exists, 30–90 days stale
- 1–3: >90 days no reply, cold or one-sided

**Opportunity Potential (1–10)**
- Based on: title/seniority of contact, company size signals, deal language present, prior revenue conversation detected

**Combined Score** drives the "Needs Attention" priority queue.

### 5.3 AI Classification Pipeline

```
Raw email thread
    ↓
GPT-4o-mini classification
    ↓
{ type, warmthScore, opportunityScore, nextAction, summary }
    ↓
Stored in TiDB against userId + threadId
    ↓
Surfaced in opportunity board
```

---

## 6. Core Features

### 6.1 Personal Triage (Per Rep)

- Inbox surfaced as a prioritized queue — not chronological, scored by opportunity potential
- One-click actions: Follow Up / Archive / Log Opportunity / Dismiss
- "Scan Now" to trigger a fresh classification pass
- Session counter tracks emails processed

### 6.2 Opportunity Board

- All logged opportunities in a structured table
- Columns: Contact, Company, Type, Score, Last Touch, Next Action, Status
- Filter by type, score, rep (workspace owners only), status
- Export to CSV
- Status: Active / Waiting / Closed Won / Closed Lost

### 6.3 Follow-Up Queue

- AI-generated list of threads that need a reply
- Sorted by: days since last touch + opportunity score
- One-click to open the thread in Gmail/Outlook
- "Snooze" to resurface in 7/14/30 days

### 6.4 Weekly Digest (Email)

- Sent every Monday morning
- Contains: new opportunities surfaced, follow-ups overdue, relationship warmth alerts
- Manager version includes team summary

### 6.5 Team Dashboard (Workspace Owners)

- Aggregated view across all connected inboxes
- Per-rep stats: emails processed, opportunities logged, follow-up compliance rate
- Relationship warmth heatmap across the team's contact network
- "Blind spots" — contacts no one on the team has talked to in 60+ days

### 6.6 ReviveIQI Upsell Trigger

- When workspace scores below a threshold on follow-up compliance or opportunity recovery rate: surface prompt "Your team may be sitting on recoverable revenue. Book a ReviveIQI diagnostic call."
- Links to Calendly booking

---

## 7. Pricing Model

| Plan | Price | What's included |
|---|---|---|
| **Free** | $0 | 1 inbox, 25 scans/month, manual triage only, 7-day history |
| **Personal** | $4.99/month | 1 inbox, unlimited scans, full history, weekly digest, CSV export |
| **Team** | $19.99/month | Up to 5 inboxes, workspace, shared opportunity board, team dashboard, manager view |
| **Team+** | $49.99/month | Up to 15 inboxes, priority support, RevOps analytics, Slack notifications |

**No auto-renewal without explicit consent.** Monthly only — no annual lock-in in v1.0.

**Free tier** is intentionally generous to drive rep-level adoption before manager upgrade.

---

## 8. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind |
| Backend | Node.js + Express + tRPC |
| Database | TiDB Cloud (shared `pipeline` cluster, new `inboxiq` database) |
| ORM | Drizzle |
| Auth | jose JWT (same pattern as MyCareerIQ) |
| Email OAuth | Google OAuth 2.0 + Microsoft MSAL |
| AI | OpenAI GPT-4o-mini (classification) + GPT-4o (summaries) |
| Email | Resend (digests + notifications) |
| Payments | Stripe (same live keys as ResumeIQ/MyCareerIQ) |
| Hosting | Railway (new service: inboxiq-production) |
| Repo | github.com/ReviveIQ/inboxiq |

---

## 9. Database Schema

### Core Tables

```sql
-- Users (shared pattern with MyCareerIQ)
iq_users (
  id BIGINT PK AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  plan ENUM('free','personal','team','team_plus') DEFAULT 'free',
  planExpiresAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT NOW()
)

-- Workspaces
iq_workspaces (
  id BIGINT PK AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  ownerId BIGINT NOT NULL,
  plan ENUM('free','personal','team','team_plus') DEFAULT 'free',
  planExpiresAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT NOW()
)

-- Workspace members
iq_workspace_members (
  id BIGINT PK AUTO_INCREMENT,
  workspaceId BIGINT NOT NULL,
  userId BIGINT NOT NULL,
  role ENUM('owner','member','viewer') DEFAULT 'member',
  joinedAt TIMESTAMP DEFAULT NOW(),
  INDEX(workspaceId, userId)
)

-- Connected inboxes
iq_inboxes (
  id BIGINT PK AUTO_INCREMENT,
  userId BIGINT NOT NULL,
  workspaceId BIGINT,
  provider ENUM('gmail','outlook') NOT NULL,
  email VARCHAR(255) NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  tokenExpiresAt TIMESTAMP,
  lastScanAt TIMESTAMP,
  historyId VARCHAR(255),
  connected TINYINT DEFAULT 1,
  createdAt TIMESTAMP DEFAULT NOW()
)

-- Classified opportunities
iq_opportunities (
  id BIGINT PK AUTO_INCREMENT,
  userId BIGINT NOT NULL,
  workspaceId BIGINT,
  inboxId BIGINT NOT NULL,
  threadId VARCHAR(255) NOT NULL,
  contactName VARCHAR(255),
  contactEmail VARCHAR(255),
  contactCompany VARCHAR(255),
  contactTitle VARCHAR(255),
  subject VARCHAR(500),
  type ENUM('Revenue','Network','Partnership','Reactivation'),
  warmthScore INT,
  opportunityScore INT,
  nextAction VARCHAR(255),
  summary TEXT,
  status ENUM('Active','Waiting','Closed Won','Closed Lost','Dismissed') DEFAULT 'Active',
  lastTouchAt TIMESTAMP,
  snoozedUntil TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP,
  INDEX(userId, status),
  INDEX(workspaceId, status)
)

-- Scan jobs
iq_scans (
  id BIGINT PK AUTO_INCREMENT,
  inboxId BIGINT NOT NULL,
  userId BIGINT NOT NULL,
  status ENUM('pending','running','complete','failed') DEFAULT 'pending',
  emailsScanned INT DEFAULT 0,
  opportunitiesFound INT DEFAULT 0,
  startedAt TIMESTAMP,
  completedAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW()
)
```

---

## 10. API Routes

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

POST   /api/workspaces                    Create workspace
GET    /api/workspaces/:id                Get workspace + members
POST   /api/workspaces/:id/invite         Invite member by email
DELETE /api/workspaces/:id/members/:uid   Remove member

GET    /api/inboxes                       List connected inboxes
POST   /api/inboxes/connect/gmail         Start Gmail OAuth flow
POST   /api/inboxes/connect/outlook       Start Outlook OAuth flow
GET    /api/inboxes/oauth/gmail/callback  Gmail OAuth callback
GET    /api/inboxes/oauth/outlook/callback Outlook OAuth callback
DELETE /api/inboxes/:id                   Disconnect inbox
POST   /api/inboxes/:id/scan              Trigger manual scan

GET    /api/opportunities                 List opportunities (filterable)
GET    /api/opportunities/:id             Get single opportunity
PATCH  /api/opportunities/:id             Update status/action/snooze
DELETE /api/opportunities/:id             Remove opportunity
GET    /api/opportunities/export          CSV export

GET    /api/team/dashboard                Workspace owner aggregate view
GET    /api/team/followup-queue           Cross-team follow-up queue

POST   /api/billing/checkout              Stripe checkout
POST   /api/billing/webhook               Stripe webhook
GET    /api/billing/status                Current plan status
```

---

## 11. Build Sequence

### Phase 1 — Foundation (Week 1–2)
- [ ] Repo scaffold: Express + tRPC + Drizzle + TiDB
- [ ] Auth: register, login, JWT (mirror MyCareerIQ pattern)
- [ ] Workspace CRUD + member invite flow
- [ ] Basic frontend: auth screens, workspace setup
- [ ] Railway deploy: inboxiq-production service

### Phase 2 — Gmail Integration (Week 2–3)
- [ ] Google OAuth 2.0 flow
- [ ] Gmail API: thread list, thread read, label apply
- [ ] Initial scan: 24-month history pull
- [ ] Incremental scan: poll for new threads every 4 hours
- [ ] Store raw thread metadata in iq_inboxes

### Phase 3 — AI Classification (Week 3–4)
- [ ] GPT-4o-mini classification prompt
- [ ] Opportunity type + warmth + potential scoring
- [ ] Next action recommendation
- [ ] Store classified opportunities in iq_opportunities
- [ ] Scan job tracking in iq_scans

### Phase 4 — Opportunity Board (Week 4–5)
- [ ] Personal triage queue (scored, not chronological)
- [ ] Opportunity table with filters
- [ ] One-click actions: Follow Up / Archive / Dismiss / Snooze
- [ ] CSV export
- [ ] Status management

### Phase 5 — Team Features (Week 5–6)
- [ ] Team dashboard (workspace owner view)
- [ ] Per-rep stats
- [ ] Follow-up compliance tracking
- [ ] Relationship warmth heatmap (simple version)

### Phase 6 — Outlook + Polish (Week 6–7)
- [ ] Microsoft MSAL OAuth
- [ ] Outlook Mail API integration
- [ ] Weekly digest email (Resend)
- [ ] Stripe billing + plan gates
- [ ] ReviveIQI upsell trigger

---

## 12. Open Questions

| # | Question | Status |
|---|---|---|
| OQ-1 | Do we want a Slack integration for follow-up alerts in v1.0? | Open |
| OQ-2 | Should the free tier include Gmail only, or both providers? | Open |
| OQ-3 | Token storage: encrypt access/refresh tokens at rest in TiDB? | Needs decision before Phase 2 |
| OQ-4 | Should workspace members see each other's contact names, or anonymized? | Open |
| OQ-5 | Weekly digest: triggered by cron or event-based? | Open |
| OQ-6 | Domain: inboxiq.reviveiqi.com subdomain or standalone inboxiq.io? | Open |

---

## 13. Success Metrics

| Metric | Definition | Target (Month 3) |
|---|---|---|
| Connected inboxes | Total inboxes linked via OAuth | 50 |
| Opportunities surfaced | Total classified opportunities across all users | 500 |
| Follow-up rate | % of surfaced opps that get a status update within 7 days | >40% |
| Workspace conversion | % of Personal users who upgrade to Team | >15% |
| ReviveIQI referrals | Diagnostic calls booked via InboxIQ upsell | 5 |

---

## 14. Brand

Follows ReviveIQI brand system:
- **Colors:** Navy (#080f1e / #0f172a) + Blue (#2563eb / #3b82f6 / #60a5fa / #93c5fd)
- **Fonts:** Syne 800 (headings) + DM Sans 300–500 (body)
- **Logo:** Gem SVG (shared ReviveIQI mark)
- **Wordmark:** `InboxIQ` white 800-weight, `IQ` in #60a5fa
- **Tagline:** "Every reply is a revenue decision."
- **URL:** inboxiq.reviveiqi.com (v1.0) → inboxiq.io (future)

---

*InboxIQ PRD v1.0 · ReviveIQI · Confidential*
