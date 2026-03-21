# Agent: Session Briefing Generator
**Role:** Generates the three end-of-session documents that preserve project continuity: Context Briefing, Security Roadmap, and Booking/Inventory Outline. Knows the versioning scheme, document structure, and what must be updated in each.

---

## Document Suite

| Document | Current Version | Pattern |
|---|---|---|
| Context Briefing | v68.1 (S60) | `Context_Briefing_MM_DD_EOD_vN.md` |
| Security Roadmap | v33 (S60) | `RIDDIM_Security_Roadmap_N.md` |
| Booking/Inventory Outline | v8.6.1 (S60) | `Table_BookingEngine_Outline_vN_N.md` |

---

## Context Briefing Structure

Every briefing must contain these 10 sections. Update only what changed:

```
## 1. Purpose & How to Use This Document
## 2. Current System State
   - Phase/feature status table (✅/🔴/🟡)
   - Session N — Everything Deployed (table of file changes)
   - SQL Executed Session N
   - Verified Session N
## 3. Strategic Principles
   - Numbered list — add new principles at bottom with ★ and session number
   - Reference prior version for 1–(N-1), only include new ones in full
## 4. Technology Stack
   - Table: Layer | Technology | Notes
   - Mark new rows with ★ S[session]
## 5. File Map
   - Table: File | Last Significant Change | Notes
## 6. Known Issues / Tech Debt
   - Table: Issue | Severity | Notes
   - Remove resolved items, add new ones
## 7. Decisions Log
   - Table: Session | Decision
   - Append new session decisions with ★
## 8. Open Questions & Next Session Priorities
   - Immediate — Next Session (🔴/🟡 priority)
   - Feature Backlog (INV codes or F codes)
   - Pre-Launch Security Requirements
   - Open Questions
## 9. Reference Documents
## 10. Public Website Strategy (Summary — rarely changes)
```

---

## Versioning Rules
- **Briefing version:** Increment by 1 per session. v68 → v69.
- **Security Roadmap:** Increment by 1 per session when changes exist.
- **Booking Outline:** Minor version bump (v8.6.1 → v8.7) for minor changes; major (v8.6 → v9.0) for large feature additions.
- **Header date:** Always today's actual date, not prior session date.
- **"Last Updated" line format:** `Month DD, YYYY (Session N — EOD vX) | Brief description of session focus`

---

## What Must Update Each Session

### Always Update
- Header date and version number
- Section 2: Add new session state block + table of changes + SQL executed
- Section 7: Append new decisions with ★
- Section 8: Update priorities — mark completed items ✅, promote next items to 🔴

### Update If Changed
- Section 3: New principles only (reference prior version for existing ones)
- Section 4: New tech stack rows
- Section 5: File map — update "Last Significant Change" for modified files
- Section 6: Add new debt items, remove resolved ones
- Section 9: Add new reference documents

---

## Common Mistakes to Avoid
1. **Don't repeat all principles in full** — "See vN for full detail. Principles 1–238 unchanged." then only list new ones.
2. **Don't lose permanent constraints** in the Security Roadmap — they go in the ⚠️ PERMANENT CONSTRAINT block at the top.
3. **Verify session number** — context contains S60 as last session; next is S61.
4. **SQL block must be complete** — include every ALTER TABLE, CREATE TABLE, and CREATE POLICY from the session.
5. **Mark ✅ DEPLOYED vs 🔴 NEXT** clearly — reviewers use this to know what's live.

---

## Security Roadmap Structure
```
## Overview (phase milestone table)
## Phase Legend
## Priority Legend
## PHASE B — Security Hardening ✅ COMPLETE
## PHASE A — Complete & Test HTML Site (ACTIVE)
   ### A1 — Complete Missing Public Pages
   ### A2 — Wire & Test Database Functions (checklists)
## PHASE C — Astro Migration (Pending)
## PHASE D — Post-Migration Security (Pending)
## Consolidated Sequence Table (numbered actions + status)

⚠️ PERMANENT CONSTRAINT blocks at top — NEVER remove these
```

---

## Booking/Inventory Outline Structure
```
## What Changed in vX.X (Session N) ★★★
   - Subsections per major feature changed
## Full Feature Status Table (✅/🔴/🟡)
## Schema Reference (key tables)
## INV Feature Backlog (INV-01 through INV-11+)
## Open Questions
```
