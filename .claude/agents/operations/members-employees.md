# Agent: Members & Employees
**Role:** Owner Portal Members and Employees tabs. Member search, point editing, member detail modal, tier management. Employee CRUD, role management, staff performance modal, MAC address, phone-to-portal-access link.

---

## Members Tab

### members Table Schema
```sql
members:
  id TEXT,          -- ⚠️ TEXT not UUID — legacy, needs migration pre-launch
  phone TEXT,       -- primary identifier — use ilike for lookup
  first_name TEXT, last_name TEXT,
  email TEXT nullable,
  instagram TEXT,   -- stripped of leading @ on capture
  birthday DATE,
  date_of_birth DATE,  -- both exist; birthday is preferred; date_of_birth legacy
  preferred_occasion TEXT,
  zip_code TEXT,    -- collected but not yet on join form
  points INT DEFAULT 0,
  tier TEXT,        -- BRONZE | SILVER | GOLD | OBSIDIAN
  visit_count INT,
  last_visit_date DATE,
  created_at TIMESTAMPTZ
```

### Tier Thresholds
| Tier | Points Required | Badge Colour |
|---|---|---|
| BRONZE | 0 | `#9A7B2A` |
| SILVER | 500 | `#C0C8D0` |
| GOLD | 1,500 | `#D4A843` |
| OBSIDIAN | 5,000 | `#F0C060` |

### Members Table UI
- Columns: Member name, ID, Tier badge, Points, Visits, Since, Enrolled By, Actions
- Search: `filterMembersTable()` — client-side filter on loaded data
- **Enrolled By** column shows staff chip (blue) or `—` if unattributed
- Row click → `memberDetailModal` with full member profile + QR + history

### Member Detail Modal
```
Name (Cormorant Garamond display)
Tier badge
Points + Visits (KPI tiles)
Phone
Member ID
Member QR (generated via QRCode.js — `RDM-XXXX` format)
Member Since
Visit & Spend History (points_ledger rows)
Edit Points button → editModal
```

### Edit Points Modal
```javascript
// Fields: New Point Total + Note (internal reason)
// UPDATE members SET points = newTotal
// INSERT to points_ledger: { member_id, points: delta, reason: note }
```

### ⛔ Phone Lookup Constraint
```javascript
// ALWAYS use ilike — never eq
.ilike('phone', '%4045551234%')  // ✅
.eq('phone', '4045551234')       // ❌ misses formatting variants
```

---

## Employees Tab

### staff Table Schema
```sql
staff:
  id UUID,
  phone TEXT,           -- enables Staff Portal OTP login
  first_name TEXT, last_name TEXT,
  role TEXT,            -- see roles below
  mac_address TEXT,     -- nullable — required for WiFi clock-in
  supabase_id UUID,     -- fetched at login, stored client-side
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
```

### Staff Roles
| Role | Portal Colour | Notes |
|---|---|---|
| manager | Purple `#9B59B6` | Full staff portal access |
| host | Blue `#4A7FC1` (VIP Host) | |
| host_floor | Green `#66BB6A` (Host) | |
| server | Green `#27AE60` | |
| bartender | Orange `#E67E22` | Shares colour with barback |
| barback | Orange `#E67E22` | Inventory counting role |
| security | Red `#C0392B` | |
| promoter | Gold `#D4A843` | |
| kitchen | Cyan `#26C6DA` | |
| chef | Deep orange `#FF7043` | |

### Employee CRUD

**Add Employee:**
```javascript
// Fields: first_name, last_name, phone, role, mac_address (optional)
// Phone registered here = unlocks Staff Portal OTP login
// INSERT to staff table
// Phone format: strip non-digits, store as +1XXXXXXXXXX
```

**Edit Employee:**
- Change role → `saveStaffRole()` — updates `staff.role`
- Edit via Staff Performance Modal (also shows enrollment/checkin/reservation stats)
- Deactivate / Reactivate — sets `active = false/true`

**MAC Address:**
- Required for WiFi captive portal clock-in
- Format: `AA:BB:CC:DD:EE:FF`
- Nullable — staff without MAC cannot clock in via WiFi but can still login via OTP

### Staff Performance Modal
```javascript
// Opens from employee card Actions button
// Fetches 3 stats for this staff member:
supabaseClient.from('employee_enrollments').select('id', {count:'exact'}).eq('staff_id', id)
supabaseClient.from('guest_lists').select('id', {count:'exact'}).eq('confirmed_by', id)
supabaseClient.from('reservations').select('id', {count:'exact'}).eq('handled_by', id)
// Displays: Enrollments | Check-Ins | Reservations
// Also contains Role Change select + Save
```

### Role Filter Bar
Employee grid has filter chips: All / Manager / VIP Host / Host / Server / Security / Barback / Bartender / Promoter / Kitchen / Chef

---

## member_segments View
The canonical view for marketing queries — combines members + attribution data:
```sql
-- Use member_segments for:
-- Cohort analysis by tier, enrollment channel, or date range
-- Marketing exports
-- Retention reporting
-- NOT for individual member lookups (use members table directly)
```

---

## Known Issues / Pre-Launch
| Issue | Notes |
|---|---|
| `members.id` is TEXT not UUID | Legacy. Needs UUID migration pre-launch. |
| `tickets.member_id` is TEXT nullable | Same issue — needs UUID migration. |
| `date_of_birth` and `birthday` both exist | Drop `date_of_birth` in Phase 4 cleanup. |
| `zip_code` column exists but not collected on join.html | Add zip_code field to join form. |
| `visit_count` and `last_visit_date` not auto-updated | Needs trigger on guest_list confirmation. |
| `instagram` field not yet on Members Portal profile edit | Pending — let members update their own. |
