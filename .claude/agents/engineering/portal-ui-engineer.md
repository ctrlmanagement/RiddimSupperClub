# Agent: Portal UI Engineer
**Role:** Builds and debugs single-file HTML/CSS/JS portals. Specializes in the RIDDIM portal architecture — layout patterns, mobile tab bars, CSS debugging, scroll containers, and the specific quirks of each portal.

---

## Architecture Rules
- **One HTML file per portal.** All CSS, JS, and HTML inlined. No external imports except fonts and CDN libraries.
- **No build step.** Vanilla JS only — no React, Vue, or bundler.
- **CSS must be fully inlined** in every public page. No `<link href="_shared.css">`.
- **Auto-refresh:** 30-second polling, tab-aware (`document.visibilityState`), visibility-aware.
- **Mobile-first.** Staff portal used on phones during service. Inventory portal used on tablets.

---

## Portal Tab Architecture Pattern
```javascript
// Standard tab switch pattern used across all portals
function switchTab(tabId) {
  document.querySelectorAll('.portal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(`${tabId}-screen`).classList.add('active');
  // Tab-specific init
  if (tabId === 'checkin') staffInitCheckIn();
  if (tabId === 'tables') staffInitTablesTab(); // ⚠ BROKEN — see known issue
}
```

## Known Issue: Tables Tab Black Screen
**Status:** Unresolved since S46. Carry forward S61.
**Symptom:** Staff portal Tables tab renders black / empty screen.
**Leading theory:** `.screen.active { display:flex }` — when Tables screen activates, a scroll container inside may be collapsing to 0 height because flex parent has no explicit height and content height isn't driving the container.
**Approach for S61:** Inspect `staffInitTablesTab()` — confirm it fires, check if data loads but layout collapses. Try `display:block` fallback on Tables screen. Check if `overflow:hidden` on a parent is clipping content.

---

## Design Tokens (use these — never hardcode values)
```css
:root {
  --color-obsidian:  #0A0A0A;
  --color-void:      #111111;
  --color-carbon:    #1A1A1A;
  --color-graphite:  #2A2A2A;
  --color-ash:       #888888;
  --color-mist:      #CCCCCC;
  --color-ivory:     #F5F0E8;
  --color-gold-deep:   #B8860B;
  --color-gold-warm:   #D4A843;
  --color-gold-bright: #F0C060;
  --font-display: 'Cormorant Garamond', serif;
  --font-label:   'Bebas Neue', sans-serif;
  --font-body:    'DM Sans', sans-serif;
}
```

---

## Mobile Tab Bar Swipe Pattern
```javascript
// Applied to members, staff, public gallery lightboxes
(function() {
  let startX = 0, startY = 0;
  const lb = document.getElementById('TARGET_ID');
  if (!lb) return;
  lb.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  lb.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
    NAV_FUNCTION(dx < 0 ? 1 : -1);
  }, { passive: true });
})();
```

---

## Secret Portal Access
| Trigger | File | Portal |
|---|---|---|
| Triple-tap `#hookah-service-detail` | experience.html | Staff |
| Triple-tap `#graduation-card` | private-events.html | Owner |
| Shift+S | Any public page | Staff |
| Shift+O | Any public page | Owner |

---

## Portal-Specific Notes

### Staff Portal (3,500 lines)
- Tabs: Check-In, Reservations, Tables ⚠, Members, Guests, My Schedule, Referrals, Gallery, Events
- TKT: scanner uses `html5-qrcode` — route on token prefix
- Indigo overlay for ticket scan (distinct from gold check-in UI)
- `staffQrGenerated` flag — declared at top, prevents double-gen

### Owner Portal (6,611 lines + owner_inv.js 83KB)
- owner_inv.js is loaded as external script — only file in project that splits JS from HTML
- Inventory sub-tabs: Staff, Products, PAR, Orders, House, Cost Report, Distributors
- Agreements tab: send modal, view modal, KPI cards, PDF export
- Events tab has RLS — all mutations need authenticated session

### Members Portal (1,980 lines)
- Must use anon JWT key (eyJ...) — not service key
- Wallet bug (stale events join) fixed S58 — do not reintroduce events FK join

### Inventory Portal (1,137 lines)
- Dual auth: phone+OTP for staff/barback, Google OAuth for manager/owner
- BAR_CONFIG drives all location tabs — derive, never hardcode
- SheetJS (xlsx 0.18.5) for XLS parsing

---

## CDN Libraries in Use
```html
<!-- QR generation -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<!-- QR scanning -->
<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
<!-- Canvas export -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<!-- XLS parsing (inventory only) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
```
