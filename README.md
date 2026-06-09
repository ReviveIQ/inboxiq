# InboxIQ

**Every reply is a revenue decision.**

InboxIQ connects to Gmail and Outlook, scans your email history using AI, and surfaces hidden revenue opportunities — warm contacts, stalled deals, and follow-ups your sales team has been missing. Built for B2B sales teams. Part of the [ReviveIQI](https://reviveiqi.com) suite.

**Live at:** [inboxiq.reviveiqi.com](https://inboxiq.reviveiqi.com)

---

## What it does

- Gmail OAuth and Outlook OAuth — connect any inbox with one click
- Scans 24 months of email thread metadata (sender, subject, date, snippet — never full body text)
- GPT-4o-mini classifies every thread: Revenue, Network, Partnership, or Reactivation
- Scores each thread on Warmth (1–10) and Opportunity Potential (1–10)
- Surfaces a prioritized opportunity board — sorted by combined score
- Team workspaces — manager sees all connected inboxes, shared opportunity board, follow-up compliance
- Incremental scan cron every 4 hours — stays current automatically
- Weekly digest email every Monday (cron)
- OAuth tokens encrypted at rest with AES-256-GCM before TiDB storage
- Never stores full email body text, never sells or shares data

## Opportunity types

| Type | What it means |
|---|---|
| Revenue | Direct buying signal — pricing, proposals, demos, purchase intent |
| Network | Warm contact who could refer, introduce, or create future opportunity |
| Partnership | Integration, co-sell, channel, or BD conversation |
| Reactivation | Warm thread gone cold (30+ days no reply) with latent opportunity value |

## Pricing

| Plan | Price | What's included |
|---|---|---|
| Free | $0 | 1 inbox, 25 scans/month |
| Personal | $4.99/month | 1 inbox, unlimited scans, weekly digest |
| Team | $19.99/month | Up to 5 inboxes, workspace, team dashboard |
| Team+ | $49.99/month | Up to 15 inboxes, Slack notifications, RevOps analytics |

## Stack

React · TypeScript · Vite · Node.js · Express · tRPC · Drizzle · TiDB Cloud · GPT-4o-mini · Google OAuth · Microsoft MSAL · Stripe · Resend · Railway

## Repo

`github.com/ReviveIQ/inboxiq` — main branch = production. Auto-deploys on push.

## Status

Phase 1 ✅ — Scaffold, auth, workspaces, 7 DB tables, Railway live  
Phase 2 ✅ — Gmail + Outlook OAuth, scanning, AI classification, opportunity board  
Phase 3 🔜 — Slack notifications, weekly digest, Stripe billing

---

*Part of the ReviveIQI suite · [reviveiqi.com](https://reviveiqi.com)*
