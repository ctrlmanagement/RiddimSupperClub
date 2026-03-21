# AG ENTERTAINMENT
*Members Club + Public Website — Session Context Briefing*

**Last Updated: March 21, 2026 (Session 65 — EOD v74) | Full S65 security audit · CRIT-04 resolved · Google API key hardened · Claude Code v2.1.81 installed · Agent library deployed**

*This document is the master context briefing for all AI-assisted development sessions on the AG Entertainment Members Club platform and RIDDIM Supper Club public website. Load this document at the start of every session. It contains the complete current system state, all decisions made to date, open questions, and next priorities. Replace with the updated version generated at the end of each session.*

---

## 1. Purpose & How to Use This Document

AG Entertainment is building a direct-to-consumer membership and loyalty platform across five venues, and a unified public-facing website for RIDDIM Supper Club. Development is AI-assisted — Claude helps write code, debug issues, and generate documents. This briefing gives Claude (and any developer joining mid-project) full context on what exists, what decisions have been made, and what to build next.

At the end of every working session, generate an updated version of this document and replace the saved copy. This is the single source of truth.

---

## 2. Current System State

> 🟢 **LIVE — Riddim Pilot Deployed February 23, 2026. Core infrastructure confirmed operational.**

| Phase | Status |
|---|---|
| Phase B Security Hardening | ✅ COMPLETE (Session 32) |
| Phase A1 Sessions 33-55 | ✅ COMPLETE |
| Sessions 56-64 | ✅ COMPLETE |
| **Session 65 — S65 security audit + CRIT-04 resolved + Claude Code installed + agents deployed** | ✅ **COMPLETE** |
| INV-12 Owner count edit + audit log | ✅ DEPLOYED S64 |
| UPC total coverage ~96 active products | ✅ S64 |
| contact.html Work With Us inquiry hub | ✅ DEPLOYED S61 |
| RLS audit all 40+ tables confirmed | ✅ S61 + S65 verified |
| **S65 Full security audit — docs.zip source review** | ✅ **COMPLETE** |
| **CRIT-04 Google Drive API key restricted** | ✅ **RESOLVED S65** |
| **Agent library rebuilt — 23 files, security/ folder added** | ✅ **S65** |
| **cybersecurity-architect.md updated to S65** | ✅ **S65** |
| **Claude Code v2.1.81 installed via Homebrew** | ✅ **S65** |
| **.claude/agents/ deployed to ~/RiddimSupperClub** | ✅ **S65** |
| Tables tab layout + mobile swipe | 🔴 UNRESOLVED S66 |
| INV-09 Date/period range search | 🔴 NEXT S66 |
| INV-11 Product drill-down + unexplained pours | 🔴 NEXT S66 |
| DEV_MODE = true in staff + members + inventory | 🔴 CRITICAL — fix CRIT-03 first |
| CRIT-03 staff prod path sets no role (line 458) | 🔴 MUST FIX before DEV_MODE = false |
| CRIT-05 inventory GSI async defer (line 495) | 🔴 S66 |
| CRIT-02 key rotation unverified | 🔴 Check Supabase Dashboard |
| Casamigos 3 variants not in DB | 🔴 Add via owner portal |
| First period closing counts not entered | 🔴 Owner action needed |

### Session 65 Key Deliverables

| Item | Detail |
|---|---|
| Full security audit S65 | 611-line report. All 11 files reviewed with exact line references. 5 criticals, 6 high, 6 medium. Report at security/RIDDIM_Security_Audit_S65.md |
| CRIT-04 resolved | AIzaSyCrp5mYEWpja1os-bt-eDWmBvNRv-D3Oyk restricted: HTTP referrers portal.ctrlmanagement.com/* + ctrlmanagement.github.io/*, API scope Picker API only |
| DEV_MODE scope corrected | Confirmed in 3 portals not 1: staff:222, members:147, inventory:501 |
| CRIT-03 identified | staff/index.html:458 sets currentStaff with no role in production path. DEV_MODE masks it. Fix before DEV_MODE = false |
| CRIT-05 identified | inventory/index.html:495 GSI still async defer. Owner fixed S64, inventory missed. |
| CRIT-02 identified | 6 files legacy eyJ key, 4 files sb_publishable. tbk + members use eyJ BY CONSTRAINT — correct. Others need verification. |
| Agent library rebuilt | Cleaned Security Audit folder → security/. cybersecurity-architect.md rewritten. 23 total files. |
| Claude Code installed | v2.1.81 via Homebrew. In ~/RiddimSupperClub. Authenticated gebriel@ctrlmanagement.com. AVX warning — non-blocking. |
| Agents deployed | .claude/agents/ installed in ~/RiddimSupperClub. All 23 files confirmed. |

### Risk Score
| Point | Score |
|---|---|
| S61 post-fixes | 6.1 |
| S65 new findings | 6.8 |
| S65 after CRIT-04 fix | **6.5** |

---

## 3. Strategic Principles

| # | Principle |
|---|---|
| 1-277 | See v73 for full detail |
| 278 | **DEV_MODE = true in THREE portals.** staff:222, members:147, inventory:501. Set all three false simultaneously. Never one at a time. (S65) |
| 279 | **Fix CRIT-03 before DEV_MODE = false.** staff:458 sets currentStaff with no role in prod path. All role restrictions silently disappear when DEV_MODE = false without this fix. Add DB role load matching lines 434-444 (DEV_MODE path). (S65) |
| 280 | **CRIT-05: Inventory GSI async defer violates Principle 275.** inventory:495. Move to head synchronous. Owner was fixed S64 — inventory was missed. (S65) |
| 281 | **Google Drive API key always restricted: HTTP referrers + API scope.** Resolved S65. Any future Google API keys follow same pattern immediately on creation. (S65) |
| 282 | **Claude Code is the primary tool for all remaining source code work.** Installed S65. Browser chat = documents only. Claude Code = all file edits, security fixes, commits. (S65) |
| 283 | **The .claude/agents/ library is live and must be updated at session end.** 23 files at ~/RiddimSupperClub/.claude/agents/. cybersecurity-architect.md is canonical security reference. (S65) |
| 284 | **Key rotation must be verified in Supabase Dashboard before acting.** CRIT-02: tbk.html + members/index.html use eyJ BY CONSTRAINT — correct. events, reserve, contact, license-sign need verification. (S65) |

---

## 4. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend Public Site | Plain HTML/CSS/JS | 10-page flat site /docs. No build step. |
| Frontend Portals | Plain HTML/CSS/JS | Single-file portals. |
| Database | Supabase PostgreSQL | cbvryfgrqzdvbqigyrgh. 44 tables. All RLS enabled. |
| Auth Staff | Phone+OTP → verify-2fa Edge Function | DEV_MODE=true (staff:222). CRIT-03 at line 458. |
| Auth Members | Phone+OTP | DEV_MODE=true (members:147). |
| Auth Inventory | Phone+OTP or Google OAuth | DEV_MODE=true (inventory:501). CRIT-05: GSI async defer (inv:495). |
| Auth Owner | Google OAuth + signInWithIdToken | GSI in head sync S64. OWNER_EMAILS hardcoded. |
| Hosting | GitHub Pages | portal.ctrlmanagement.com |
| CDN | Cloudflare | DNS. X-Frame-Options needed via Transform Rules. |
| **Claude Code** | **v2.1.81 — Homebrew — S65** | **~/RiddimSupperClub. Primary dev tool going forward.** |
| **Agent Library** | **.claude/agents/ — 23 files — S65** | **security/ folder new. cybersecurity-architect.md updated.** |
| Google Drive Picker | Google Picker API | Key restricted S65 — 2 referrers + Picker API only. |
| XLS Parsing | SheetJS 0.18.5 | Hot Sauce imports. |
| Inventory Location Config | BAR_CONFIG array | Must match in both inv files. |
| UPC Lookup | Open Food Facts + upc_lookup.py | ~96 products. |
| Count Edit Audit | inv_count_edits table | Created S64. Never delete. |
| HotSauce POS | SQL Server EXPRESS — SERVER\SQLEXPRESS | Login: hssa. Password not located. |

### Supabase Key Status (CRIT-02 — verify before acting)
| Key Format | Files | Status |
|---|---|---|
| eyJ legacy | members, tbk.html, license-sign.html, reserve.html, events.html, contact.html | members + tbk = CORRECT by constraint. Others = verify. |
| sb_publishable_fQlHFhC7tPkZNRl1djnvcA_68LpKQpv | owner, staff, inventory, join.html | Current |

---

## 5. File Map

| File | Last Change | Notes |
|---|---|---|
| docs/index.html | S34 | Public homepage |
| docs/events.html | S58 | DB-driven. Legacy eyJ key. |
| docs/reserve.html | S56 | Two-mode. Legacy eyJ key. |
| docs/join.html | S57 | sb_publishable key. |
| docs/contact.html | S61 | 8 inquiry types. Legacy eyJ key. |
| docs/members/index.html | S58 | DEV_MODE:147. eyJ BY CONSTRAINT. |
| docs/staff/index.html | S61 | DEV_MODE:222. CRIT-03 at line 458. |
| docs/owner/index.html | S64 | GSI in head. Dropbox removed. Dead openDropboxChooser() code remains. |
| docs/owner/owner_inv.js | S64 | INV-12 count edit + audit. |
| docs/inventory/index.html | S63 | DEV_MODE:501. CRIT-05: GSI async defer line 495. |
| docs/license-sign.html | S59 | E-sign. Legacy eyJ key. |
| docs/tbk.html | S56 | eyJ BY CONSTRAINT. |
| .claude/agents/ | **S65** | **23 agents. security/ folder new.** |

---

## 6. Known Issues / Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| DEV_MODE = true — staff + members + inventory | 🔴 CRITICAL | Fix CRIT-03 first, then all three false simultaneously |
| CRIT-03: Staff prod path no role (line 458) | 🔴 CRITICAL | Gate: must fix before DEV_MODE = false |
| CRIT-05: Inventory GSI async defer (line 495) | 🔴 Critical | Move to head |
| CRIT-02: Key rotation unverified | 🔴 Critical | Check Supabase Dashboard first |
| HIGH-01: No OTP lockout | 🟠 High | 5-attempt client limit minimum |
| HIGH-02: Inventory phone enumeration (inv:559) | 🟠 High | 1-line fix |
| HIGH-03: Staff "Account deactivated" reveals (staff:375) | 🟠 High | 2-line fix |
| HIGH-04: join.html dupe phone alert | 🟠 High | Silent redirect |
| Tables tab black screen | 🔴 High | Unresolved S46 |
| INV-09 date/period search | 🔴 High | Not built |
| INV-11 product drill-down | 🔴 High | Needs period data |
| Casamigos 3 variants not in DB | 🔴 High | UPCs: 856724006015/856724006213/856724006107 |
| Desert Island LIIT not in DB | 🔴 High | Scan in-venue |
| First period closing counts | 🔴 High | Baseline for all calculations |
| X-Frame-Options missing | 🟡 Medium | Cloudflare Transform Rules — no code |
| Dropbox dead code in owner portal | 🟡 Medium | openDropboxChooser() throws if called |
| Supabase JS @2 unpinned | 🟡 Medium | Pin to specific minor version |
| AVX warning on Claude Code | Low | brew install --cask claude-code-baseline if crashes |
| members anon SELECT all rows | High | Accepted pilot risk Phase D |
| No CSP | High | Phase C Astro migration |
| No session expiry | High | Accepted Phase D |
| members.id TEXT not UUID | Medium | Pre-launch migration |

---

## 7. Decisions Log

| Session | Decision |
|---|---|
| 1-64 | See v73 |
| 65 | **S65 full audit reveals DEV_MODE in 3 portals not 1.** staff:222, members:147, inventory:501. Set all three false simultaneously. |
| 65 | **CRIT-03: prod staff path (line 458) sets no role.** After verify-2fa success currentStaff gets name+phone but no role. Fix: query staff table same as DEV_MODE path (lines 434-444). Must precede DEV_MODE = false. |
| 65 | **CRIT-04 resolved.** Google Drive API key restricted in Google Cloud Console. HTTP referrers: portal.ctrlmanagement.com/* + ctrlmanagement.github.io/*. API: Picker API only. Key is safe by design — actual file access uses OAuth session token, not developer key. |
| 65 | **CRIT-05: inventory GSI still async defer.** Owner fixed S64. Inventory missed. Violates Principle 275. |
| 65 | **CRIT-02: key rotation is partial.** tbk + members use eyJ by permanent constraint — correct. events/reserve/contact/license-sign on eyJ may be wrong depending on whether old key was revoked. Verify Supabase Dashboard first. |
| 65 | **Staff phone enumeration correctly silent.** Lines 369-372 return silently for unregistered. "Account deactivated" message (375) does leak status — change to silent fail. |
| 65 | **authorized_by constraint fully compliant.** events.html:1778 comments + RLS policy at 1401. No violation. |
| 65 | **sign_agreement RPC is sound.** Server-side token validation. Not exploitable client-side. |
| 65 | **Claude Code is the primary dev tool going forward.** All source code fixes in Claude Code. Browser chat for documents only. |
| 65 | **Agent library restructured.** Security Audit folder flattened to security/. cybersecurity-architect.md rewritten. 23 agents deployed. |
| 65 | **ctrlmanagement.github.io/* needed as second HTTP referrer.** portal.ctrlmanagement.com is CNAME — browsers send that as referrer. GitHub Pages URL added as fallback for direct access/testing. |

---

## 8. Open Questions & Next Session Priorities

### Session 66 — Claude Code

| Priority | Task |
|---|---|
| 🔴 1 | **Fix CRIT-03** — staff/index.html:458, add DB role load after verify-2fa. Gate for DEV_MODE = false. Use @cybersecurity-architect |
| 🔴 2 | **Fix CRIT-05** — inventory/index.html:495, GSI to head, remove async defer |
| 🔴 3 | **Verify CRIT-02** — Supabase Dashboard → Settings → API. Both keys active? Then update legacy files or confirm rotation. |
| 🔴 4 | **Set DEV_MODE = false in all three** after 1+2 are fixed |
| 🔴 5 | **Tables tab black screen fix** |
| 🔴 6 | **Fix HIGH-02** — inventory:559, 1-line neutral message |
| 🔴 7 | **Fix HIGH-03** — staff:375, silent fail |
| 🟡 8 | **X-Frame-Options via Cloudflare Transform Rules** |
| 🟡 9 | **Remove Dropbox dead code** from owner portal gallery UI |
| 🟡 10 | **INV-09 date/period search** |
| 🟡 11 | **INV-11 product drill-down** |
| 🟡 12 | **Add Casamigos x3 + Desert Island LIIT via owner portal** |
| 🟡 13 | **Complete first period closing counts** |
| 🟡 14 | **HIGH-01 OTP lockout** — 5-attempt client-side minimum |
| 🟡 15 | **HIGH-04 join.html silent redirect** on dupe phone |

### Open Questions
| Question | Context |
|---|---|
| Is old eyJ key still active? | Verify Supabase Dashboard → Settings → API |
| HotSauce API/webhooks? | Pending email response |
| hssa password? | Windows HotSauce config files |
| Payment processor? | Unblocks Tickets Phase 4c |
| Final RIDDIM domain? | riddimatlanta.com or other |
| Ticket expiry? | Pre-launch decision |
| Agreement expiry (30-day TTL)? | Pending decision |
| Venue stock liter sizes? | Determines liter product rows |

---

## 9. Reference Documents

| File | Description |
|---|---|
| Context_Briefing_03_21_EOD_v74.md | This document |
| RIDDIM_Security_Roadmap_39.md | Updated S65 |
| Table_BookingEngine_Outline_v8_12.md | Updated S65 |
| RIDDIM_Design_System_Status_v31.md | Unchanged S65 |
| security/RIDDIM_Security_Audit_S65.md | Full 611-line S65 audit |
| claude_agents.zip | 23-agent library rebuilt S65 |
| upc_lookup.py | Bulk UPC script |
| upc_update_session64.sql | SQL UPC bulk apply |
| inv_count_edits_migration.sql | inv_count_edits table — already run |

---

## 10. Inventory System Reference

### BAR_CONFIG (canonical — must match in BOTH inventory files)
```javascript
const BAR_CONFIG = [
  { id:'LR',    label:'Liquor Room', pos:null,    active:true  },
  { id:'BAR1',  label:'Bar 1',       pos:'POS 1', active:true  },
  { id:'BAR2',  label:'Bar 2',       pos:'POS 2', active:true  },
  { id:'BAR3',  label:'Bar 3',       pos:'POS 3', active:true  },
  { id:'BAR4',  label:'Bar 4',       pos:'POS 4', active:true  },
  { id:'BAR5',  label:'SVC',         pos:'POS 7', active:true  },
  { id:'BAR6',  label:'Bar 6',       pos:'POS 5', active:false },
  { id:'BAR7',  label:'Bar 7',       pos:'POS 6', active:false },
  { id:'BAR8',  label:'Bar 8',       pos:'POS 8', active:false },
  { id:'BAR9',  label:'Bar 9',       pos:'POS 9', active:false },
  { id:'BAR10', label:'Bar 10',      pos:'POS 10',active:false },
];
```

### Usage Formula (locked S60)
```
Usage = Beginning + Stock Up − Ending
Beginning = inv_counts WHERE count_type='opening' AND location=X AND session.period_id=P
Stock Up  = inv_stock_ups WHERE to_location=X AND report_date BETWEEN start AND end
Ending    = inv_counts WHERE count_type='closing' AND location=X AND session.period_id=P
```

### Cost Thresholds
| Band | % | Action |
|---|---|---|
| On Target | <18% | — |
| Watch | 18-25% | Monitor |
| High | 25-32% | Investigate |
| Alert | 32%+ | Drill-down |
| Unexplained pours | >8% theoretical | Flag theft/over-pour |

### INV Backlog
| Code | Feature | Status |
|---|---|---|
| INV-01 thru INV-08 | All complete | ✅ S60-S63 |
| INV-12 | Owner count edit + audit | ✅ S64 |
| INV-09 | Date/period range search | 🔴 S66 |
| INV-10 | Trend view + variance | 🟡 S66+ |
| INV-11 | Product drill-down + pours | 🔴 S66 |

### Count Cycle
1. Owner creates period → Periods tab
2. Barbacks enter closing counts in inventory portal
3. Owner reviews, uses EDIT to correct (INV-12)
4. Owner closes period
5. Owner creates next period → Carry Opening Balances
6. Repeat

**First period:** No carry. Closing counts entered now = permanent baseline.

### Key Table Schemas

**inv_count_edits (NEVER DELETE):**
```sql
id UUID, count_id UUID FK→inv_counts, session_id UUID FK→inv_sessions,
product_id UUID FK→inv_products, old_qty NUMERIC NOT NULL,
new_qty NUMERIC NOT NULL, note TEXT, edited_by TEXT NOT NULL,
edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

---

## 11. Agent Library

**Installed: ~/RiddimSupperClub/.claude/agents/ ✅**

```
platform/  riddim-architect · supabase-schema-guardian · cybersecurity-architect (★S65)
engineering/  portal-ui-engineer · events-manager · inventory-system-engineer
              booking-tickets-engineer · gallery-manager
operations/  analytics-reporting · members-employees · scheduling-staff-view
             security-auditor · session-briefing-generator
brand/  riddim-brand-guardian
security/  RIDDIM_Security_Audit_S65 · S61 records · audit prompts (★NEW S65)
```

**Claude Code usage:**
```
@cybersecurity-architect   CRIT fixes, RLS audit
@portal-ui-engineer        Tables tab fix
@inventory-system-engineer INV-09, INV-11
@supabase-schema-guardian  RLS, schema questions
```

---

*Context Briefing v74 · Session 65 Full EOD · March 21, 2026 · AG Entertainment*
*CRIT-04 resolved. Claude Code installed. Agents deployed. Risk: 6.5/10.*
*Fix CRIT-03 (staff/index.html:458) before setting DEV_MODE = false — this is the gate.*

---

## 12. Inventory System — Bar Operations Reference

### BAR_CONFIG (canonical — must match in both inv files)
```javascript
const BAR_CONFIG = [
  { id:'LR',    label:'Liquor Room', pos:null,    active:true  },
  { id:'BAR1',  label:'Bar 1',       pos:'POS 1', active:true  },
  { id:'BAR2',  label:'Bar 2',       pos:'POS 2', active:true  },
  { id:'BAR3',  label:'Bar 3',       pos:'POS 3', active:true  },
  { id:'BAR4',  label:'Bar 4',       pos:'POS 4', active:true  },
  { id:'BAR5',  label:'SVC',         pos:'POS 7', active:true  },
  { id:'BAR6',  label:'Bar 6',       pos:'POS 5', active:false },
  { id:'BAR7',  label:'Bar 7',       pos:'POS 6', active:false },
  { id:'BAR8',  label:'Bar 8',       pos:'POS 8', active:false },
  { id:'BAR9',  label:'Bar 9',       pos:'POS 9', active:false },
  { id:'BAR10', label:'Bar 10',      pos:'POS 10',active:false },
];
```

### Usage Formula (locked S60)
```
Usage = Beginning + Stock Up Received − Ending
Beginning = inv_counts WHERE count_type='opening' AND location=X AND session.period_id=P
Stock Up  = inv_stock_ups WHERE to_location=X AND report_date BETWEEN period dates
Ending    = inv_counts WHERE count_type='closing' AND location=X AND session.period_id=P
```

### Beverage Cost Thresholds
| Band | % | Action |
|---|---|---|
| On Target | < 18% | — |
| Watch | 18–25% | Monitor |
| High | 25–32% | Investigate |
| Alert | 32%+ | Drill-down required |
| Unexplained pours | > 8% theoretical yield | Flag theft/over-pour |

### Hot Sauce XLS Import Format
- Row 0: Report period dates
- Row 1: `Workstation: POS X` → auto-routes via POS_TO_LOCATION
- Row 2: `Department: STOCK_UP`
- Item rows: Col 0 = POS Item ID, Col 1 = Product name, Col 3 = Num Sold
- Category headers: `SU_COGNAC`, `SU_TEQUILA` etc — skipped

### INV Feature Backlog
| Code | Feature | Status |
|---|---|---|
| INV-01 | Distributor directory CRUD | ✅ S60 |
| INV-02 | Products add/remove/inline edit | ✅ S60 |
| INV-03 | Price history — log + trend | ✅ S60 |
| INV-04 | Period system UI | ✅ S63 |
| INV-05 | Opening balances — auto-carry | ✅ S63 |
| INV-06 | Barback role enforcement | ✅ S63 |
| INV-07 | SheetJS XLS import | ✅ S60 |
| INV-08 | Spot check system | ✅ S63 |
| INV-12 | Owner count edit + audit log | ✅ S64 |
| INV-09 | Date/period range search | 🔴 S66 |
| INV-10 | Trend view + variance alerts | 🟡 S66+ |
| INV-11 | Product drill-down + unexplained pours | 🔴 S66 |

### Full Inventory Table Schema Reference
| Table | Purpose | RLS |
|---|---|---|
| inv_products | Product catalogue, cost, par, UPC, std_pour_oz | Owner write + staff read |
| inv_distributors | Rep contacts | Owner write + staff read active |
| inv_price_history | Historical price per product/distributor | Owner write + staff read |
| inv_periods | Count cycle container | Owner write + staff read |
| inv_sessions | Counting sessions per location/period | Authenticated only |
| inv_counts | Bottle counts | anon ALL (barback ops) |
| inv_stock_ups | POS import rows with to_location | anon ALL (POS import) |
| inv_count_edits | Audit log — owner count corrections | Owner only. NEVER DELETE. |
| inv_par_levels | Min stock targets | Owner write + staff read |
| inv_orders | Distributor orders | Owner email-scoped |
| inv_cost_periods | Cost report periods | Owner email-scoped |
| inv_cost_lines | Per-product cost lines | Owner email-scoped |
| inv_sales_entries | Sales totals per location | Owner email-scoped |
| inv_staff | Inventory staff directory | Owner write + anon read active |

### UPC Status (S65)
- Total populated: ~96 active products
- Needs new rows + scanner: Casamigos Blanco/Reposado/Anejo + Desert Island LIIT
- ~35 premium spirits still need scanner registration
- First count period: Week of 03/22/2026. Status: OPEN. Closing counts not yet entered.

---

## 13. HotSauce POS Integration — Reference

**SQL Server Access:** SERVER\SQLEXPRESS · Auth: SQL Server Authentication · Login: hssa · Password: in HotSauce config files on Windows machine (not yet located)

**Integration Status:**
- SQL Server instance + hssa confirmed ✅ S62
- XLS export member identity match proven ✅ S62
- 10 touchpoints defined and grounded in codebase ✅ S62
- Integration email drafted ✅ S62 — fill name/contact and send
- hssa password: 🔴 not yet located
- HotSauce API response: 🔴 pending

**Security constraint:** hssa credentials must never appear in repo or frontend code.

*(Full 10-touchpoint detail in HotSauce_Integration_Briefing_v1.md)*
