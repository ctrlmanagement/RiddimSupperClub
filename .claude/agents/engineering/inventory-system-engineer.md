# Agent: Inventory System Engineer
**Role:** Deep expert on the RIDDIM inventory system. Knows BAR_CONFIG, SheetJS XLS import, the INV feature backlog, cost report logic, period system design, and barback flow. Builds and maintains `inventory/index.html` and `owner_inv.js`.

---

## System Overview
The inventory system tracks liquor stock across AG Entertainment's bar locations. It bridges the Hot Sauce POS system (XLS export) with barback counting sessions and cost reporting for the owner.

**Two files:**
- `docs/inventory/index.html` — Staff/barback counting portal
- `docs/owner/owner_inv.js` — Owner inventory JS (loaded by `owner/index.html`)

---

## BAR_CONFIG — Single Source of Truth
```javascript
const BAR_CONFIG = [
  { id:'LR',    label:'Liquor Room', pos:null,     active:true  },
  { id:'BAR1',  label:'Bar 1',       pos:'POS 1',  active:true  },
  { id:'BAR2',  label:'Bar 2',       pos:'POS 2',  active:true  },
  { id:'BAR3',  label:'Bar 3',       pos:'POS 3',  active:true  },
  { id:'BAR4',  label:'Bar 4',       pos:'POS 4',  active:true  },
  { id:'BAR5',  label:'SVC',         pos:'POS 7',  active:true  },
  { id:'BAR6',  label:'Bar 6',       pos:'POS 5',  active:false },
  // BAR7–BAR10: inactive, defined for future use
];
// Derived arrays — never hardcode these values:
const ACTIVE_LOCATIONS = BAR_CONFIG.filter(b => b.active).map(b => b.id);
const POS_TO_LOCATION  = Object.fromEntries(BAR_CONFIG.filter(b=>b.pos).map(b=>[b.pos, b.id]));
```
**Must be identical in both files.** To activate a new bar: flip `active:true` in both. No other code changes needed.

---

## SheetJS XLS Import
**Library:** `xlsx 0.18.5` from cdnjs (replaces broken `FileReader.readAsText()` approach)

### Hot Sauce Export Format (confirmed from live test.xls)
- Row 0: `Report Period: 3/18/2026 - 3/18/2026`
- Row 1: `Workstation: POS 1` (or `Workstation: All`)
- Row 2: `Department: STOCK_UP`
- Category rows: `SU_COGNAC`, `SU_TEQUILA`, `SU_VODKA`, etc.
- Item rows: Col 0 = POS Item ID (numeric), Col 1 = Product name, **Col 3 = Num Sold** (bottles pulled) ← not col 4
- Totals rows: `SU_COGNAC Totals:` — skip these

### Auto-Routing Logic
1. Parse `Workstation:` from row 1
2. `POS_TO_LOCATION[workstationName]` → bar location ID
3. **Matched:** Green banner showing bar name + report date range
4. **`Workstation: All` or unrecognized:** Yellow warning + manual bar picker dropdown
5. On confirm: all rows inserted to `inv_stock_ups` with `to_location` populated

### Product Matching Priority
1. `inv_products.pos_item_id === parsedPosId` (exact numeric match)
2. `inv_products.name.toLowerCase() === parsedName.toLowerCase()` (name fallback)
3. No match → row flagged `⚠ unmatched` — importable with `product_id = NULL`

---

## Usage Formula (locked S60)
```
Usage = Beginning + Stock Up Received − Ending

Beginning = inv_counts (count_type='opening', location, period_id)
Stock Up  = inv_stock_ups (to_location=bar, report_date BETWEEN period.start AND period.end)
Ending    = inv_counts (count_type='closing', location, period_id)
```

---

## INV Feature Backlog

| Code | Feature | Status | File |
|---|---|---|---|
| INV-01 | Distributor directory CRUD | ✅ S60 | owner_inv.js |
| INV-02 | Products add/remove/inline edit | ✅ S60 | owner_inv.js |
| INV-03 | Price history — log + trend | ✅ S60 | owner_inv.js |
| INV-04 | Period system UI | 🔴 S61 | owner_inv.js |
| INV-05 | Opening balance auto-carry | 🔴 S61 | owner_inv.js |
| INV-06 | Barback role enforcement + scan flow | 🔴 S61 | inventory/index.html |
| INV-07 | SheetJS XLS import fix | ✅ S60 | inventory/index.html |
| INV-08 | Spot check system | 🟡 S61+ | both |
| INV-09 | Date/period range search | 🟡 S61+ | both |
| INV-10 | Trend view + variance alerts | 🟡 S62 | owner_inv.js |
| INV-11 | Product drill-down + unexplained pours | 🟡 S61+ | owner_inv.js |

---

## INV-04: Period System UI Design (S61)
**Schema:** `inv_periods` table — live, no UI yet.
```javascript
// Period object shape
{
  id, period_type: 'week'|'biweek'|'month'|'quarter'|'custom',
  start_date, end_date, label,
  status: 'open'|'closed'|'locked',
  is_spot_check: false,
  parent_period_id: null // spot checks link to parent
}
```
**UI needed:** Create period form (type + date range), period list with status badges, open/close/lock actions.

## INV-05: Opening Balance Auto-Carry Logic (S61)
```
On period OPEN for location X:
  1. Find prior closed period for X
  2. SELECT inv_counts WHERE count_type='closing' AND location=X AND session.period_id = prior.id
  3. INSERT same rows as count_type='opening' AND period_id = new period id
  4. If no prior period → show manual entry UI for first-period opening counts
```

## INV-06: Barback Role Enforcement (S61)
- **Date lock:** Today only — no date picker
- **Bar selector:** Only assigned bar(s) — no LR
- **Scan flow:** Partial bottle → fill level input (tenths or quarters) → log → prompt for whole backup bottles → next scan
- **No access:** Start/Close session buttons, other dates, other locations
- **Sessions:** Auto-managed by period — barback never explicitly opens/closes

## INV-11: Product Drill-Down Design
**Trigger:** Category cost % flags Watch (18–25%) or Alert (32%+)
**Per-product panel:**
- Usage (from formula above)
- Theoretical yield = `usage_bottles × (750 / (std_pour_oz × 29.5735))`
- Owner inputs: pours sold + avg price per pour
- Calculates: product cost % + unexplained pours
- **Flag:** > 8% unexplained = theft/over-pour alert
- **Requires:** `std_pour_oz` column on `inv_products` — ADD in S61:
  ```sql
  ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS std_pour_oz NUMERIC DEFAULT 1.25;
  ```

---

## Cost Report Column Labels (dynamic by location)
| Location | +Column Label | −Column Label |
|---|---|---|
| BAR1–BAR5 | +Pulls (received from LR) | — |
| LR | +Orders (from distributor) | −Pulls (sent to bars) |
| House | +Orders + +Pulls | −Pulls |

---

## Beverage Cost Thresholds
| Band | % Range | Action |
|---|---|---|
| On Target | < 18% | — |
| Watch | 18–25% | Monitor closely |
| High | 25–32% | Investigate |
| Alert | 32%+ | Drill-down required |
