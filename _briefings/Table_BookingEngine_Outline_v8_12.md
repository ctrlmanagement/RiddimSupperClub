# AG Entertainment — Members Club Platform
## Booking Engine, Venue Operations & Inventory Feature Outline
**v8.12 · March 21, 2026 · Session 65**

## What Changed in v8.12 (Session 65)

### Security Audit Findings Affecting This Document
- DEV_MODE = true confirmed in inventory portal (line 501) — not just staff
- CRIT-03: staff prod path sets no role after verify-2fa (line 458)
- CRIT-05: inventory GSI script async defer at line 495
- CRIT-04 resolved: Google Drive API key restricted ✅
- All permanent constraints verified compliant in source

### Infrastructure
- Claude Code v2.1.81 installed — primary tool for all code changes going forward
- .claude/agents/ deployed with 23 agents including security/ folder
- Risk score: 6.5/10

---

## Full Feature Status

| Feature | Status | Session |
|---|---|---|
| Table Booking Engine (TBK) | ✅ LIVE | S54-S56 |
| VIP Pass System | ✅ LIVE | S39 |
| Tickets Phase 1-4 | ✅ LIVE | S57-S58 |
| License Agreements e-sign | ✅ LIVE | S59 |
| contact.html Work With Us | ✅ LIVE | S61 |
| Inventory BAR_CONFIG scalable | ✅ LIVE | S60 |
| SheetJS XLS import | ✅ LIVE | S60 |
| INV-01 thru INV-08 complete | ✅ LIVE | S60-S63 |
| INV-12 Owner count edit + audit | ✅ LIVE | S64 |
| UPC ~96 products | ✅ S64 | S64 |
| CRIT-04 Google API key restricted | ✅ S65 | S65 |
| Claude Code + agents installed | ✅ S65 | S65 |
| INV-09 Date/period search | 🔴 NEXT | S66 |
| INV-11 Product drill-down + pours | 🔴 NEXT | S66 |
| INV-10 Trend view | 🟡 S66+ | — |
| Casamigos 3 rows + Desert Island LIIT | 🔴 S66 | — |
| DEV_MODE = false all portals | 🔴 After CRIT-03 fix | S66 |
| Tables tab fix | 🔴 S66 | S66 |

---

## Table Booking Engine

### Permanent Constraints
- Never send valid_date or booking_type in INSERT/UPDATE — VERIFIED COMPLIANT S65
- Never JOIN events via FK — query events separately — VERIFIED COMPLIANT S65
- Phone lookup: .ilike('phone', '%XXXXXXXXXX%') not .eq()
- anon read scoped to qr_token IS NOT NULL (fixed S61)

### TBK Flow Status
✅ Confirmed working E2E S56.

---

## Inventory System — Bar Operations

### Architecture (Two files — must sync)
- docs/inventory/index.html — Staff/barback portal (DEV_MODE:501, CRIT-05 GSI:495)
- docs/owner/owner_inv.js — Owner inventory JS (INV-12 live)

### BAR_CONFIG (canonical — identical in both)
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
const ACTIVE_LOCATIONS = BAR_CONFIG.filter(b => b.active).map(b => b.id);
const POS_TO_LOCATION  = Object.fromEntries(BAR_CONFIG.filter(b=>b.pos).map(b=>[b.pos, b.id]));
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
| Unexplained pours | >8% theoretical | Flag |

### INV Feature Backlog
| Code | Feature | Status |
|---|---|---|
| INV-01 thru INV-08, INV-12 | All complete | ✅ S60-S64 |
| INV-09 | Date/period range search | 🔴 S66 |
| INV-10 | Trend view + variance | 🟡 S66+ |
| INV-11 | Product drill-down + unexplained pours | 🔴 S66 |

### INV-11 Design
```
Theoretical yield = usage_bottles × (750 / (std_pour_oz × 29.5735))
Unexplained pours = theoretical yield − pours_sold
Flag threshold: >8%
```
Requires std_pour_oz on inv_products (live since S63, DEFAULT 1.25).

### Count Cycle
1. Owner creates period
2. Barbacks count → inventory portal
3. Owner reviews + edits via INV-12 (✎ EDIT on any session row)
4. Owner closes period
5. Owner creates next → Carry Opening Balances
6. Repeat

First period only: closing counts entered manually = permanent baseline.

### INV-12 Owner Count Edit
- Works on any session type, any period status, any time
- All edits audit-logged to inv_count_edits (NEVER DELETE)
- Products shown grouped by category, CURRENT vs NEW QTY, optional note

### Owner Portal Inventory Tabs (8 tabs, all operational S63)
Inventory Staff · Products & UPC · PAR Levels · Orders · House View · Distributors · Cost Report · Periods

### Full Table Schema

**inv_products:** id, name, category, cost, case_size, par_level, active, upc, distributor, distributor_id FK→inv_distributors, pos_item_id, std_pour_oz DEFAULT 1.25

**inv_distributors:** id, name, rep_name, rep_phone, rep_email, notes, active, created_at

**inv_price_history:** id, product_id FK, distributor_id FK, price_per_bottle, price_per_case, case_size, effective_date, created_by, created_at

**inv_periods:** id, period_type DEFAULT 'week', start_date, end_date, label, status DEFAULT 'open', is_spot_check, parent_period_id FK, notes, created_by, created_at

**inv_sessions:** id, location, status, opened_by, opened_at, closed_at, week_of, period_id FK, count_type DEFAULT 'closing', assigned_to

**inv_counts:** id, session_id FK, product_id FK, location, quantity, counted_by, counted_at, scan_count, count_type DEFAULT 'closing'

**inv_count_edits (NEVER DELETE):** id, count_id FK, session_id FK, product_id FK, old_qty, new_qty, note, edited_by, edited_at DEFAULT now()

**inv_stock_ups:** id, import_id, pos_item_id, pos_name, pos_category, product_id, quantity, from_location, to_location, report_date, imported_by

### Hot Sauce XLS Import Format
- Row 0: Report period dates
- Row 1: Workstation: POS X (auto-routes via POS_TO_LOCATION)
- Row 2: Department: STOCK_UP
- Item rows: Col 0=POS Item ID, Col 1=Name, Col 3=Num Sold
- Category headers: SU_COGNAC etc — skipped

### UPC Status
~96 products populated S63-S64. ~35 premium spirits need scanner. Casamigos x3 + Desert Island LIIT need new rows first.

---

## VIP Pass System
vip_passes: anon ALL removed S61. Read scoped to active + qr_token S61.

## Ticketing
authorized_by never sent in INSERT — VERIFIED COMPLIANT S65.
ticket_prices: anon INSERT blocked — VERIFIED COMPLIANT S60.

## License Agreements
anon read scoped to status='pending' S61.
sign_agreement RPC: server-side token validation — sound S65.

## Contact / Inquiries
8 inquiry types. Writes to inquiries table. No rate limiting (MED-01).

## HotSauce POS
SERVER\SQLEXPRESS · hssa · password not located.
10 touchpoints defined S62. Email drafted — send when ready.

---

*Table Booking Engine + Inventory v8.12 · S65 EOD · March 21, 2026*
*CRIT-04 resolved. Claude Code installed. INV-09/11 next in S66.*
