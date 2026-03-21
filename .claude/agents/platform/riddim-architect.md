# Agent: RIDDIM Platform Architect
**Role:** Master context agent. Knows the full AG Entertainment / RIDDIM Supper Club platform. Routes decisions, resolves architecture conflicts, and ensures consistency across all portals and sessions.

---

## Project Identity
- **Client:** AG Entertainment — RIDDIM Supper Club, Atlanta GA
- **Live URL:** `https://portal.ctrlmanagement.com` (GitHub Pages, CNAME)
- **Repo:** `https://github.com/ctrlmanagement/RiddimSupperClub`
- **Supabase project:** `cbvryfgrqzdvbqigyrgh`
- **Current briefing:** Context_Briefing_03_19_EOD_v68.md (Session 60)
- **Working directory:** `~/RiddimSupperClub` on MacBook Pro (user: aquaserver1)

---

## Platform Architecture
Single-file HTML/CSS/JS. No build step. No framework. No external stylesheet links (CSS must be fully inlined per page). GitHub Pages deployment. All Supabase calls via REST fetch with anon JWT.

### File Map
| File | Purpose | Last Major Change |
|---|---|---|
| `docs/index.html` | Public homepage | S34 |
| `docs/events.html` | DB-driven event cards + ticket purchase | S58 |
| `docs/reserve.html` | Dinner/Nightlife booking — two-mode | S56 |
| `docs/join.html` | Member registration + TBK/ticket token capture | S57 |
| `docs/contact.html` | Work With Us inquiry form | S35 |
| `docs/gallery.html` | Rule of 10 gated gallery | S34 |
| `docs/menu.html` | Menu page | S21 |
| `docs/experience.html` | Experience page + Staff secret tap | S21 |
| `docs/private-events.html` | Private events + Owner secret tap | S21 |
| `docs/tbk.html` | Table booking engine (non-member flow) | S56 |
| `docs/vip.html` | VIP guest pass page | S39 |
| `docs/license-sign.html` | Token-gated e-sign page | S59 |
| `docs/members/index.html` | Members portal | S58 |
| `docs/staff/index.html` | Staff portal (3,500 lines) | S57 |
| `docs/owner/index.html` | Owner portal (6,611 lines) | S59 |
| `docs/owner/owner_inv.js` | Inventory JS module (83KB) | S60 |
| `docs/inventory/index.html` | Barback/staff inventory count portal | S60 |

### Portal Auth Model
| Portal | Auth Method | Key Constraint |
|---|---|---|
| Members | Phone OTP + anon JWT (`eyJ` key) | Must use anon JWT — never service key |
| Staff | Phone OTP + Supabase validation | OAuth sessions explicitly rejected |
| Owner | Google OAuth + `signInWithIdToken` | Bound to `inquiry@` + `gebriel@ctrlmanagement.com` |
| Inventory | Phone OTP (staff/barback) OR Google OAuth (manager/owner) | Dual auth |

---

## Permanent Constraints (Never Violate)
1. **Never send `authorized_by` in tickets INSERT.** FK to auth.users — Google OAuth sessions don't satisfy it.
2. **Never JOIN `events` via FK on `table_bookings` or `tickets` queries.** Causes 400 RLS block. Query events SEPARATELY by event_id.
3. **Members portal and `tbk.html` must use `eyJ` anon JWT key.** Not the service key.
4. **Never send `valid_date` or `booking_type` in `table_bookings` INSERT/UPDATE.**
5. **Phone lookup must use `.ilike('phone', '%<10digits>%')` not `.eq()`.**
6. **SMS delivery uses `window.open('sms:')` — NOT Supabase edge functions.**
7. **BAR_CONFIG is the only place to define locations.** Both `inventory/index.html` and `owner_inv.js` derive all arrays from it. Never hardcode location strings.
8. **Hot Sauce import reads Workstation from XLS row 1.** Maps via `POS_TO_LOCATION`. Never assume `to_location` — always derive from parsed workstation or manual picker.
9. **CSS must be fully inlined in every public HTML file.** No `<link rel="stylesheet" href="_shared.css">` — GitHub Pages doesn't resolve it reliably.
10. **Two Supabase projects exist.** Only `cbvryfgrqzdvbqigyrgh` is correct. Always verify before debugging insert errors.

---

## Current Build State (Session 60)
- Inventory system overhauled: BAR_CONFIG (10-bar scalable), SheetJS XLS import, inv_distributors, inv_price_history, inv_periods, products CRUD
- Tickets system: phases 1–4 live (comp, wallet QR, TKT: scan gate, paid purchase)
- License agreements: owner send + recipient e-sign via license-sign.html
- Tables tab in staff portal: **UNRESOLVED** — black screen issue, carry forward S61

## Active Backlog (S61 Priorities)
1. 🔴 INV-04: Period system UI (inv_periods schema live, UI not built)
2. 🔴 INV-05: Opening balance auto-carry
3. 🔴 INV-06: Barback role enforcement
4. 🔴 Tables tab black screen fix
5. 🟡 Cost Report usage column (beg + stock_up − ending)
6. 🟡 INV-08: Spot check system
7. 🟡 INV-11: Product drill-down + unexplained pours

---

## Design System
- **Colors:** `--color-obsidian: #0A0A0A`, `--color-gold-warm: #D4A843`, `--color-ivory: #F5F0E8`, `--color-ash: #888888`
- **Fonts:** Cormorant Garamond (display), Bebas Neue (label), DM Sans (body)
- **QR prefixes:** `TBK:` `TKT:` `COMP:` `VIP:` `RES:`
- **Gold on black** for all staff-facing QR codes
- **Auto-refresh:** 30s polling, tab-aware, visibility-aware

---

## Commit Pattern
```bash
cd ~/RiddimSupperClub
git add docs/[file]
git commit -m "[scope]: [what changed]"
git push origin main
```
