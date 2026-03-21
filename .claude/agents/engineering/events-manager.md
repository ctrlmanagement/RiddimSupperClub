# Agent: Events Manager
**Role:** Full event lifecycle in the Owner Portal. Covers event creation, editing, flyer/promo video upload, visibility controls, table section pricing, ticket tier configuration, and responding to incoming reservation + booking inquiries tied to events.

---

## Events Tab — What's In It

The Events tab has three views toggled by buttons:
- **Calendar** — month grid, colour-coded by status. Click any day → opens Add Event modal pre-filled with that date.
- **List** — filterable by status (All / Scheduled / Live / Sold Out / Completed / Cancelled). Each event card shows Edit, $ Pricing, 🎟 Tickets, and Delete buttons.
- **Guests** — date picker + event selector → guest list for that event (same data as Staff Check-In).

---

## events Table Schema
```sql
events:
  id UUID, title TEXT, event_date DATE, start_time TIME, end_time TIME,
  status TEXT,          -- scheduled | live | sold_out | completed | cancelled
  event_type TEXT,      -- special | dinner | nightlife | brunch | private
  description TEXT,
  flyer_url TEXT,       -- Supabase Storage public URL
  promo_video_url TEXT, -- Supabase Storage public URL
  show_on_site BOOLEAN, -- shows in events.html card grid (up to 5 events)
  is_featured BOOLEAN,  -- shows in events.html hero banner (separate from 5 cards)
  max_capacity INT,
  created_at TIMESTAMPTZ
```

### ⛔ Critical: event_type must be set
```sql
-- Run if existing events have NULL event_type (breaks filter chips on events.html)
UPDATE events SET event_type = 'special' WHERE event_type IS NULL;
```

### ⛔ Critical: RLS on events
- Public SELECT: `USING (true)` — everyone can read
- INSERT/UPDATE/DELETE: `WITH CHECK (auth.role() = 'authenticated')` — owner only
- **Never bypass RLS** — owner must be authenticated via Google OAuth session

---

## Event Status Colours
| Status | Colour | Meaning |
|---|---|---|
| scheduled | `#81C784` green | Upcoming, not yet live |
| live | `#4A7FC1` blue | Currently happening |
| sold_out | `#D4A843` gold | Tickets exhausted |
| completed | `#2A2A2A` graphite | Past event |
| cancelled | `#E57373` red | Cancelled |

Status auto-transition logic (client-side `scheduleAutoComplete()`):
- Event date = yesterday + status is scheduled/live → auto-set to `completed`
- ⚠️ This is client-side — should be replaced with Supabase Edge Function (Phase 4)

---

## Event Creation Flow (`saveEvent()`)
```javascript
// Fields captured in Add Event modal:
{
  title,
  event_date,       // DATE — required
  start_time,
  end_time,
  status: 'scheduled',
  event_type,       // special | dinner | nightlife | brunch | private
  description,
  flyer_url,        // uploaded to Supabase Storage event-flyers bucket, public
  promo_video_url,  // uploaded to Supabase Storage
  show_on_site,     // boolean toggle — shows up to 5 cards on events.html
  is_featured,      // boolean toggle — hero banner on events.html (separate from 5 cards)
  // visibility toggles:
  visible_staff: true,   // shows on staff calendar
  visible_members: true, // shows on members calendar
}

// INSERT via:
supabaseClient.from('events').insert(payload)

// ⛔ NEVER JOIN events table via FK on table_bookings or tickets queries
// Query events SEPARATELY by event_id
```

### Visibility Controls
| Toggle | Effect |
|---|---|
| Staff Calendar | Shows in staff portal My Schedule / Events tab |
| Member Calendar | Shows in members portal Tonight tab |
| Show on Events Page | Shows in events.html card grid (max 5 at once) |
| Featured Event | Shows in events.html hero banner — one at a time |

---

## Table Section Pricing (`$ Pricing` button → `openPricingModal()`)

Each event can have table pricing set per section of the floor plan. Sections map to table groups:

```javascript
// Pricing sections defined in modal:
const sections = [
  { key: 'front',    label: 'Front Booths',   tables: [1,2,3,4,5,6]   },
  { key: 'mid',      label: 'Mid Section',    tables: [7,8,9,10,11]   },
  { key: 'vip',      label: 'VIP Section',    tables: [12,13,14,15,16] },
  { key: 'patio',    label: 'Patio',          tables: [17,18,19,20,21,22,23,24] },
  { key: 'main',     label: 'Main Floor',     tables: [25,26,27,28,29,30,31] },
];
```

Pricing stored in `table_bookings` or a dedicated pricing table. Owner sets minimum spend or flat rate per section per event. This drives the table booking flow (reserve.html Nightlife mode) so guests see correct minimums when selecting tables.

---

## Ticket Tier Configuration (`🎟 Tickets` button → `openTktCfgModal()`)

```sql
ticket_prices:
  id UUID, event_id UUID, tier_name TEXT, price NUMERIC, quantity_available INT
```

Owner adds tiers (GA, VIP, Table, etc.) with price and quantity per event. These drive the purchase panels on `events.html`.

**Constraints:**
- Owner ALL + anon SELECT only — no anon INSERT (verified S60)
- Never include `authorized_by` in comp ticket INSERT

---

## Responding to Inquiries for Events

Inquiries that come through `contact.html` with type `celebration`, `corporate`, `fundraiser`, `political`, `buyout` are event-related. The Inquiries tab in the owner portal handles these:

**Status workflow:** `new → reviewed → quoted → booked | declined`

**Owner actions on an event inquiry:**
1. Open inquiry → review type-specific fields (guest count, date, budget, organization)
2. Set status to `reviewed`
3. Add internal notes
4. Respond via SMS (use `window.open('sms:+1XXXXXXXXXX')` — no edge function)
5. When confirmed → create the event in Events tab + update inquiry to `booked`
6. Optionally create a license agreement (Agreements tab) if venue rental contract needed

**The connection between inquiry → event → table booking:**
- Inquiry captures date + guest count + budget
- Owner creates event in Events tab for that date
- Owner sets table section pricing via `$ Pricing` on that event
- Guests book via `reserve.html` (Nightlife mode) which gates on available events

---

## Flyer + Promo Video Upload

**Flyer:** Device upload → Supabase Storage `event-flyers` bucket (public) → URL stored in `events.flyer_url`. Max 10MB. JPEG/PNG/WebP.

**Promo Video:** Device upload → Supabase Storage → `events.promo_video_url`. Preview player shown in modal before saving.

**Display on events.html:**
- Flyer shown as event card background image
- Featured event flyer shown as hero banner
- Promo video not yet surfaced on public site (stored but unused publicly)

---

## Key Functions (owner/index.html)
| Function | Purpose |
|---|---|
| `openAddEventModal()` | Opens create modal, optionally pre-fills date from calendar click |
| `openEditEventModal(id)` | Loads event into modal for editing |
| `saveEvent()` | INSERT or UPDATE to events table |
| `deleteEvent(id)` | DELETE — status check first (don't delete live events) |
| `openPricingModal(id, title, date)` | Table section minimum spend config |
| `openTktCfgModal(id, title, date)` | Ticket tier config → ticket_prices table |
| `setEventsView('calendar'|'list'|'guests')` | Toggle view |
| `scheduleAutoComplete()` | Client-side auto-completion of past events |
| `eventsTabFilter(btn, status)` | Filter event list by status |
