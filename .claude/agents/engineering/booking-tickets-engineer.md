# Agent: Booking & Tickets Engineer
**Role:** Expert on the RIDDIM table booking engine and ticketing system. Knows the full schema, QR token flows, non-member TBK flow, ticket purchase + scan + comp issuance, and all permanent constraints around these tables.

---

## Table Booking Engine

### Tables Involved
- `table_bookings` — primary booking record
- `reservations` — legacy table (staff-facing reservation flow via reserve.html)

### table_bookings Schema
```sql
id UUID, member_id UUID nullable, phone TEXT, party_size INT,
booking_date DATE, time_slot TEXT, status TEXT, ref_staff_id UUID nullable,
token TEXT UNIQUE, notes TEXT, created_at TIMESTAMPTZ
```

### ⛔ PERMANENT CONSTRAINTS
```javascript
// Never include these fields in table_bookings INSERT/UPDATE — they will fail:
// - valid_date
// - booking_type

// Phone lookup — always use ilike, never eq:
.ilike('phone', '%4045551234%')  // ✅
.eq('phone', '4045551234')       // ❌

// Never JOIN events via FK on table_bookings queries — causes 400 RLS block
// Query events SEPARATELY by event_id
```

### TBK Flow (Non-Member)
1. User lands on `tbk.html` (token in URL or direct)
2. Phone entry → OTP → validated against members or creates guest entry
3. Party size + time slot selection
4. INSERT to `table_bookings` — status: `pending`
5. Token generated → SMS confirmation via `window.open('sms:')`
6. Token captured on `join.html` load if `tbk_token` param present
**Status:** ✅ Confirmed working E2E — S56

### Two-Mode reserve.html
- **Dinner mode** — standard table booking, any night
- **Nightlife mode** — event-gated, shows available events from DB
- Redesigned S56 — member must be logged in or directed to join flow

---

## Ticketing System

### Tickets Schema
```sql
tickets:
  id UUID, event_id UUID, member_id TEXT nullable, tier_name TEXT,
  price NUMERIC, status TEXT, token TEXT UNIQUE,
  scanned_at TIMESTAMPTZ nullable, purchase_method TEXT,
  created_at TIMESTAMPTZ

ticket_prices:
  id UUID, event_id UUID, tier_name TEXT, price NUMERIC, quantity_available INT
```

### ⛔ PERMANENT CONSTRAINTS
```javascript
// Never include authorized_by in tickets INSERT — FK to auth.users
// Google OAuth sessions don't satisfy this FK — will cause constraint violation
{ event_id, member_id, tier_name, price, status: 'comp' }  // ✅ no authorized_by
{ event_id, ..., authorized_by: ownerGoogleId }             // ❌ breaks on FK

// Never JOIN events via FK on tickets queries
// Causes 400 RLS block — query events table separately
```

### RLS Policy Status (verified S60)
```
tickets:      owner ALL + staff SELECT + anon INSERT (purchase) ✅
ticket_prices: owner ALL + anon SELECT ✅ (NO anon INSERT — verified S60)
```

### QR Token Prefixes
| Prefix | Source | Scanner |
|---|---|---|
| `TBK:` | table_bookings.token | Staff check-in |
| `TKT:` | tickets.token | Staff TKT: scan gate |
| `COMP:` | comp tickets | Staff TKT: scan gate |
| `VIP:` | vip_passes | Staff VIP scan |
| `RES:` | reservations | Staff reservations tab |

### Ticket Phases Status
| Phase | Feature | Status |
|---|---|---|
| 1 | Owner comp issuance | ✅ S57 |
| 2 | Member wallet card + QR | ✅ S57 |
| 3 | Staff TKT: scan gate | ✅ S57 |
| 4 | Paid purchase on events.html | ✅ S58 |
| 4b | Stripe/Square payment integration | 🔴 PENDING — processor not chosen |

### Ticket Scanner UI (Staff Portal)
- **Indigo overlay** — distinct from gold check-in UI
- Routes on QR prefix: `TKT:` → ticket scan, `TBK:` → booking check-in, etc.
- On scan: UPDATE `tickets.scanned_at = NOW()` — second scan blocked if already set

### events.html DB-Driven (S58)
- Static event cards replaced entirely — now queries `events` table
- Ticket purchase panels are dynamic per event
- DB sidebar calendar shows event dates
- `event_type` must be set on all events: `UPDATE events SET event_type = 'special' WHERE event_type IS NULL;`

---

## License Agreements System (S59)

### Schema
```sql
license_agreements:
  id UUID, token TEXT UNIQUE, status TEXT (pending/signed/revoked),
  recipient_name TEXT, recipient_email TEXT, signature_data TEXT,
  user_agent TEXT, sent_by TEXT, sent_at TIMESTAMPTZ, signed_at TIMESTAMPTZ,
  ip_address TEXT nullable (not yet captured)
```

### Flow
1. Owner sends agreement → INSERT to `license_agreements` with unique token
2. Recipient receives link: `https://portal.ctrlmanagement.com/license-sign.html?token=XXX`
3. `license-sign.html` — public token-gated page — shows full license text + canvas signature
4. On sign: UPDATE status = 'signed', store signature_data (base64 canvas PNG), user_agent

### Notes
- `license-sign.html` is public — no auth required, only token validation
- `ip_address` is currently NULL — optional future edge function capture
- No expiry logic yet — pending agreements never expire (30-day TTL under discussion)
- RLS: ✅ active S59

---

## VIP Pass System (S39)
```sql
vip_passes: id, member_id, type (entry|comp_table|comp_tab), issued_by, scanned_at, created_at
```
- Types consolidated from prior comp table + owner entry QR + comp tab
- `scanned_at` TIMESTAMPTZ added S54
- VIP: prefix for QR scanning
