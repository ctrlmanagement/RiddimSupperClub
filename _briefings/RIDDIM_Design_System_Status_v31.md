# RIDDIM Supper Club
*Design System Status — Operational Source of Truth*

**Last Updated: March 20, 2026 (Session 64 EOD) | Design System v1.9 | Companion to Context Briefing v73**

*Load this document alongside Context_Briefing_03_20_EOD_v73.md at the start of any session involving UI, frontend, or component work.*

---

## Quick Status Summary

| Section | Topic | Status |
|---|---|---|
| 01 | Architecture — Three Environments | ✅ Locked |
| 02 | Color Science — Full Palette | ✅ Locked |
| 03 | Typography — Three Typefaces + Scale | ✅ Locked |
| 04 | Spacing System | ✅ Locked |
| 05 | Interaction Language & Animation | ✅ Designed — Not yet in Astro |
| 06 | Member Recognition Flow + Tier System | ✅ Designed — Partially built |
| 07 | Staff Environment — Chips, Role Matrix | ✅ Designed — Partially built |
| 08 | Reference Site Analysis | ✅ Locked — Reference only |
| 09 | Component Tokens — Buttons, Radius, Shadow | ✅ Designed — Not yet in shared CSS |
| 10 | CSS Token Implementation in _shared.css | ⚠️ Partial — Needs full token audit |
| 11 | Public Site Copy | ✅ Written + Wired — Push pending |
| **reserve.html Two-Mode Cards — S56** | Dinner/Nightlife selector | ✅ Built + Live |
| **Tickets Feature UI — S57** | Owner comp form, wallet card, staff scan | ✅ BUILT S57 |
| **contact.html — Work With Us — S61** | 8 inquiry types, dynamic fields | ✅ BUILT S61 |
| **Inventory Portal — Barback Enforcement UI — S63** | Locked bar badge, no switching | ✅ BUILT S63 |
| **Inventory Portal — Period System UI — S63** | Period list, detail, status badges | ✅ BUILT S63 |
| **Inventory Portal — Spot Check UI — S63** | Variance table, color coding, results report | ✅ BUILT S63 |
| **Owner Portal — Count Edit Modal — S64** | ✎ EDIT on session rows, category groups, audit note | ✅ BUILT S64 |
| **menu.html online ordering — S65+** | Via HotSauce delivery integration | 🔴 NOT BUILT |

---

## Component Status

| # | Component / Feature | Status | Session |
|---|---|---|---|
| 1–131 | All components through Session 62 | ✅ Built | 1–62 |
| 132 | Barback locked location badge | ✅ BUILT | 63 |
| 133 | Period system — period list cards with status badges | ✅ BUILT | 63 |
| 134 | Period system — create modal (type/date/label/spot check) | ✅ BUILT | 63 |
| 135 | Period system — detail panel (actions, session table, carry button) | ✅ BUILT | 63 |
| 136 | Spot check entry table (Last Known / Spot Count / Variance) | ✅ BUILT | 63 |
| 137 | Spot check variance report (ALL CLEAR / FLAGGED badge) | ✅ BUILT | 63 |
| **140** | **✎ EDIT button on session rows (owner only)** | ✅ **BUILT** | **64** |
| **141** | **Count edit modal — category headers, CURRENT/NEW QTY columns, note field** | ✅ **BUILT** | **64** |
| 138 | menu.html — Online ordering UI | 🔴 NOT BUILT | S65+ |
| 139 | HotSauce member QR scan result overlay at POS | 🔴 NOT BUILT | After API |

---

## Count Edit Modal Design — S64

### ✎ EDIT Button (session row)
```
padding: 4px 12px
border: 1px solid rgba(218,165,32,0.35)
background: none → hover rgba(218,165,32,0.08)
color: var(--owner-gold)
font-family: var(--font-label)
font-size: 9px; letter-spacing: 0.12em
```

### Count Edit Modal
```
Overlay: rgba(0,0,0,0.8), z-index:3000
Card: var(--carbon), border rgba(218,165,32,0.3), border-radius:12px
Max-width: 640px, max-height: 88vh, overflow-y:auto
Header eyebrow: font-label, gold, "EDIT COUNT — OWNER"
Title: font-display, 22px, location · type
Subtitle: 12px ash — "Changes are audit-logged with your name and timestamp."
```

### Product Table Layout
```
Column header bar: rgba(218,165,32,0.05) background
Columns: PRODUCT (flex) | CURRENT (70px right-align ash) | NEW QTY (90px center gold label)
Category headers: font-label 9px owner-gold, border-bottom rgba(218,165,32,0.15)
Product rows: font-body 13px ivory
Input: 80px wide, var(--void) background, border var(--graphite) → focus var(--owner-gold)
       font-display 14px, text-align:center, step 0.25
```

### Save Button
```
Full width, gradient owner-accent → owner-gold
font-label, 12px, letter-spacing 0.15em
"✓ SAVE CHANGES"
Cancel: ghost style, right of save
```

---

## Inventory Portal Design Language — S63

*(Unchanged from v30)*

### Inventory Portal Color Scheme
```css
--inv:         #4A9F8A
--inv-light:   #6BBFA8
--inv-dark:    #1A3830
--inv-dim:     rgba(74,159,138,0.12)
```

### Period Status Badge Colors
```
OPEN:   color #81C784 · border rgba(76,175,80,0.4) · bg rgba(76,175,80,0.08)
CLOSED: color gold-warm · border rgba(212,168,67,0.4) · bg rgba(212,168,67,0.08)
LOCKED: color ash · border rgba(136,136,136,0.3) · bg rgba(136,136,136,0.06)
```

### Spot Check Variance Color Coding
```
Positive/zero:   #81C784
Small loss ≤0.5: var(--gold-warm)
Large loss >0.5: var(--ember) + ⚠ flag
Unknown:         var(--ash)
```

---

## Tier System — As Built
*(Unchanged from v30)*

## Points Ledger — Transaction Types
*(Unchanged from v30)*

## Typography Rules
*(Unchanged from v30)*

## Inventory Portal Component Patterns — S63
*(Unchanged from v30)*

## Online Ordering — menu.html (Planned S65+)
*(Unchanged from v30)*

## Open Design Questions

| Question | Context |
|---|---|
| Online ordering UI for menu.html | Pending HotSauce delivery platform confirmation |
| HotSauce QR scan result overlay | For perk/comp/ticket at POS — pending hardware confirmation |
| Perks data for PERKS_BY_TIER | Still placeholder — owner input needed |
| Tier thresholds confirmed? | Bronze/Silver/Gold/Obsidian — owner to confirm |

---

*Design System Status v31 · Session 64 EOD · March 20, 2026 · AG Entertainment*
*Count edit modal (INV-12) design documented. Components 140–141 added. All S63 inventory portal patterns unchanged.*
