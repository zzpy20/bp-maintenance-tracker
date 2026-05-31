# BP Maintenance Tracker

A focused maintenance workflow tool for property managers — built to bring order to the chaos of repair requests, quotes, approvals, and follow-ups.

**Live demo:** [bp-tracker.plos.xyz](https://bp-tracker.plos.xyz) *(password: 0011)*

---

## The Problem

Property managers juggling 50+ tenancies face a daily challenge: maintenance requests arrive scattered across email inboxes, WhatsApp messages, and property management portals. Each repair job involves a multi-step workflow — log the issue, source quotes, get owner approval, instruct tradespeople, chase for invoices and photo evidence — with no single place to see where each job stands.

The result: things fall through the cracks. Owners don't get chased. Invoices go missing. Jobs sit in limbo for weeks.

## The Solution

BP Maintenance Tracker is a lightweight issue-tracking tool purpose-built for this workflow. It gives property managers a clear view of every open maintenance job, its current stage, and what needs to happen next.

---

## Features

### Dashboard
- At-a-glance counts for **Total Open**, **Overdue**, **Needs Chasing**, and **Urgent** issues
- Smart grouping: **Action Needed** (overdue or due today), **Needs Chasing** (waiting too long), **Due This Week**
- Each issue shows its current status, property, and how many days it has been waiting

### Issue Tracking
- Full lifecycle status flow: `New` → `Waiting Quote` → `Owner Approved` → `Supplier Instructed` → `Waiting Repair` → `Waiting Invoice` → `Closed`
- Priority levels: High / Medium / Low
- Trade category tagging (Plumbing, HVAC, Appliance, etc.)
- **Next Action** field with due date — surface exactly what needs doing and flag it as overdue
- Direct link to the original email or Property Tree work order

### Communication
- One-click **Email Templates** pre-filled with issue and property details:
  - Request quote from supplier
  - Follow up on quote (supplier)
  - Send quote to owner for approval
  - Follow up on owner approval
  - Notify tenant of upcoming work
- Log communication actions (e.g. "Chased supplier") with timestamped activity feed

### Attachments
- Upload **quotes**, **invoices**, **photos**, and **documents** directly to the issue — stored in Cloudflare R2
- Identify missing evidence at a glance

### Properties & Suppliers
- Property registry with owner and tenant contact details
- Supplier directory with trade type and contact info
- Per-property issue count and quick-access link

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite at the edge) |
| File Storage | Cloudflare R2 |
| Deployment | Cloudflare Pages + Workers |

Fully serverless — zero infrastructure to manage, deploys globally via Cloudflare's edge network.

---

## Local Development

**Prerequisites:** Node.js 18+, Wrangler CLI

```bash
# Install dependencies
npm install

# Apply local D1 migration
npm run db:migrate:local

# Start local dev server
npm run dev
```

Open the Wrangler local URL shown in your terminal.

---

## Deploy to Cloudflare

**1. Create Cloudflare resources:**
```bash
wrangler d1 create bp-maintenance-db
wrangler r2 bucket create bp-maintenance-files
```

**2. Update `wrangler.toml`** with the returned `database_id`.

**3. Deploy:**
```bash
npm run db:migrate:remote
npm run deploy
```

---

## Project Background

Built as a real-world tool for a property management office in Brisbane, Australia, managing 50+ tenancies. The workflow was modelled directly from the day-to-day experience of a property manager — specifically the friction points around maintenance coordination that existing tools like PropertyTree don't address well at the task-tracking level.

Developed iteratively with Claude Code (Anthropic) as an AI-assisted full-stack project.

---

## Roadmap

- [ ] Multi-user support with role-based access (agent / owner portal)
- [ ] Automated follow-up reminders via email or SMS
- [ ] Bulk status updates
- [ ] Reporting — average resolution time, supplier performance
- [ ] Mobile-optimised view for on-the-go updates
