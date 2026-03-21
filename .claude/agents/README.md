# AG Entertainment — RIDDIM Platform Agent Library
`.claude/agents/` · Session 65 · March 20, 2026

## Install
```bash
cd ~/RiddimSupperClub
unzip ~/Downloads/claude_agents.zip -d .
# Creates claude_agents/ — rename to .claude/agents/
mv claude_agents .claude/agents
```

## Structure
```
.claude/agents/
├── platform/
│   ├── riddim-architect.md          — Master context, permanent constraints, commit patterns
│   ├── supabase-schema-guardian.md  — All 44 tables, RLS policies, critical query constraints
│   └── cybersecurity-architect.md  — ★ UPDATED S65 — Full audit findings, open CRITs, remediation order
├── engineering/
│   ├── portal-ui-engineer.md        — Single-file portal architecture, CSS debugging
│   ├── events-manager.md            — Event creation, table pricing, ticket tiers, flyer upload
│   ├── inventory-system-engineer.md — BAR_CONFIG, SheetJS, INV backlog INV-04 through INV-12
│   ├── booking-tickets-engineer.md  — TBK, tickets, license agreements, QR tokens
│   └── gallery-manager.md           — Gallery builder, photo upload, signed URLs, Rule of 10
├── operations/
│   ├── analytics-reporting.md       — KPI dashboard, 4 reporting search sections
│   ├── members-employees.md         — Member/employee CRUD, roles, tiers, MAC address
│   ├── scheduling-staff-view.md     — Schedule grid, shifts, time-off, Staff View mode
│   ├── security-auditor.md          — RLS checklist, pre-launch requirements
│   └── session-briefing-generator.md — EOD document generation
├── brand/
│   └── riddim-brand-guardian.md     — Design tokens, copy voice, SEO, public site consistency
└── security/                        — ★ NEW S65 — Audit records and reference docs
    ├── RIDDIM_Security_Audit_S65.md — Full S65 audit (611 lines, all findings with line refs)
    ├── RIDDIM_Security_Audit_S61.md — S61 audit (baseline)
    ├── RIDDIM_RLS_Audit_S61.md      — RLS live test results
    ├── RIDDIM_AnonRLS_LiveFix_S61.md — S61 policy fixes applied
    ├── RIDDIM_SecFix_CRIT02_CRIT03.md — S61 CRIT fixes
    ├── RIDDIM_SecurityAuditPrompt.md — Audit prompt template
    ├── You are a Lead Cybersecurity Architect.md — Audit role definition
    └── supa_warning.md              — Supabase anon key warning reference
```

## Tab → Agent Map

| Owner Portal Tab | Agent |
|---|---|
| Dashboard | `analytics-reporting` |
| Inquiries | `booking-tickets-engineer` + `events-manager` |
| Reservations | `booking-tickets-engineer` |
| VIP & Comp | `booking-tickets-engineer` |
| Table Bookings | `booking-tickets-engineer` |
| Events | `events-manager` |
| Gallery | `gallery-manager` |
| Analytics | `analytics-reporting` |
| Reporting | `analytics-reporting` |
| Members | `members-employees` |
| Employees | `members-employees` |
| Scheduling | `scheduling-staff-view` |
| Staff View | `scheduling-staff-view` |
| Tables | `portal-ui-engineer` (⚠️ black screen unresolved) |
| Tickets | `booking-tickets-engineer` |
| Inventory | `inventory-system-engineer` |
| Agreements | `booking-tickets-engineer` |

## Security Audit Quick Reference

**Current risk score:** 6.5 / 10

**Open criticals:**
- CRIT-01: DEV_MODE = true in staff + members + inventory (all three)
- CRIT-02: Key rotation incomplete — 6 files still use legacy eyJ key
- CRIT-03: Staff prod path sets no role after verify-2fa (fix before DEV_MODE = false)
- CRIT-05: Inventory GSI script still async defer

**Resolved:**
- CRIT-04: Google Drive API key restricted to Picker API + 2 domains ✅ S65

**Accepted pilot risk (Phase D):** members/staff/points_ledger/guest_lists anon SELECT

## Session Context
- **Last session:** S65 (March 20, 2026) — Security audit S65
- **Briefing:** Context_Briefing_03_20_EOD_v73.md
- **Live URL:** https://portal.ctrlmanagement.com
- **Supabase:** cbvryfgrqzdvbqigyrgh (44 tables)
