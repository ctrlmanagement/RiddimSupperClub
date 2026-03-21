# Agent: Supabase Schema Guardian
**Role:** Authoritative reference for all database schema, RLS policies, permanent query constraints, and FK relationships. Prevents known footguns. Reviews all SQL before execution.

---

## Supabase Project
- **Project ID:** `cbvryfgrqzdvbqigyrgh`
- **URL:** `https://cbvryfgrqzdvbqigyrgh.supabase.co`
- **Auth key type:** Anon JWT (`eyJ...`) — always anon, never service key in browser

---

## Full Table Inventory

### Core Platform Tables
| Table | Key Columns | RLS Status |
|---|---|---|
| `members` | id (TEXT ⚠ not UUID), phone, first_name, last_name, email, instagram, birthday, preferred_occasion, zip_code, points, tier, visit_count, last_visit_date | 🔴 Verify pre-launch |
| `staff` | id (UUID), phone, first_name, last_name, role, mac_address, supabase_id | 🔴 Verify pre-launch |
| `events` | id, title, date, start_time, event_type, status, flyer_url, max_capacity | ✅ RLS ACTIVE |
| `guest_lists` | id, event_id, member_id, submitted_by, confirmed_by, method, status | 🔴 Verify pre-launch |
| `reservations` | id, member_id, handled_by, event_id, party_size, preferred_occasion, status, created_at | 🔴 Verify pre-launch |
| `points_ledger` | id, member_id, points, reason, created_at | 🔴 Verify |
| `table_bookings` | id, member_id, phone, party_size, booking_date, time_slot, status, ref_staff_id, token, notes | 🔴 Verify |
| `vip_passes` | id, member_id, type, issued_by, scanned_at, created_at | 🔴 Verify |
| `tickets` | id, event_id, member_id (TEXT nullable), tier_name, price, status, token, scanned_at, purchase_method | ✅ anon INSERT + owner ALL + staff SELECT |
| `ticket_prices` | id, event_id, tier_name, price, quantity_available | ✅ owner ALL + anon SELECT ONLY (no anon INSERT — verified S60) |
| `license_agreements` | id, token, status, recipient_name, recipient_email, signature_data, user_agent, sent_by, sent_at, signed_at | ✅ RLS S59 |
| `galleries` | id, title, gallery_date, is_private, cover_storage_path | 🔴 Verify |
| `gallery_photos` | id, gallery_id, storage_path, display_order, original_filename | 🔴 Verify |
| `employee_enrollments` | id, member_id, staff_id, enrolled_via | 🔴 Verify |
| `schedules` | id, staff_id, event_id, role, start_time, end_time | 🔴 Verify |
| `time_off_requests` | id, staff_id, date, reason, status | 🔴 Verify |
| `inquiries` | id, inquiry_type, status, first_name, last_name, phone, email, message, + type-specific fields | 🔴 Verify |
| `member_segments` | VIEW — marketing query helper | N/A |

### Inventory Tables
| Table | Key Columns | RLS Status |
|---|---|---|
| `inv_products` | id, name, category, cost, case_size, par_level, active, upc, pos_item_id, distributor_id (FK), std_pour_oz (⚠ NEEDS ADDING S61) | 🔴 Verify pre-launch |
| `inv_counts` | id, session_id, product_id, location, quantity, count_type (opening/closing/spot_check), counted_at | 🔴 Verify |
| `inv_sessions` | id, location, status, opened_by, opened_at, closed_at, period_id (FK), count_type, assigned_to | 🔴 Verify |
| `inv_stock_ups` | id, product_id, location, quantity, report_date, source, to_location (BAR1–BAR5 etc.) | 🔴 Verify |
| `inv_par_levels` | id, product_id, location, par_quantity | 🔴 Verify |
| `inv_cost_periods` | id, week_ending, period_type, locked | 🔴 Verify pre-launch |
| `inv_cost_lines` | id, period_id, product_id, location, usage, cost | 🔴 Verify |
| `inv_sales_entries` | id, period_id, location, sales_total | 🔴 Verify |
| `inv_distributors` | id, name, rep_name, rep_phone, rep_email, notes, active | ✅ RLS S60 |
| `inv_price_history` | id, product_id (FK), distributor_id (FK), price_per_bottle, price_per_case, case_size, effective_date | ✅ RLS S60 |
| `inv_periods` | id, period_type (week/biweek/month/quarter/custom), start_date, end_date, label, status (open/closed/locked), is_spot_check, parent_period_id (self-ref FK) | ✅ RLS S60 |

---

## Critical Query Constraints

### ⛔ NEVER DO THESE
```javascript
// 1. Never join events via FK on table_bookings or tickets — causes 400 RLS block
// WRONG:
.from('tickets').select('*, events(title)')
// RIGHT: query events separately by event_id

// 2. Never send authorized_by in tickets INSERT — FK to auth.users
// WRONG:
{ event_id, member_id, tier_name, price, authorized_by: ownerId }
// RIGHT: omit authorized_by entirely

// 3. Never send valid_date or booking_type in table_bookings INSERT/UPDATE
// WRONG:
{ member_id, booking_date, valid_date: '2026-03-20', booking_type: 'dinner' }
// RIGHT: omit both fields

// 4. Never use .eq() for phone lookup — use .ilike()
// WRONG:
.eq('phone', '4045551234')
// RIGHT:
.ilike('phone', '%4045551234%')

// 5. Never use service key in members portal or tbk.html — use anon JWT
// WRONG:
const key = SUPABASE_SERVICE_KEY
// RIGHT:
const key = SUPABASE_ANON_KEY // starts with eyJ
```

---

## RLS Policy Reference

### tickets table (verified S60)
```sql
-- Owner: full access
-- Staff: SELECT only (confirmed live S60)
-- Anon: INSERT only (purchase flow) + SELECT own token
-- No anon INSERT on ticket_prices
```

### events table (verified S32)
```sql
CREATE POLICY "Public can read events" ON events FOR SELECT USING (true);
CREATE POLICY "Owner can insert events" ON events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Owner can update events" ON events FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Owner can delete events" ON events FOR DELETE USING (auth.role() = 'authenticated');
```

---

## Pending Schema Work (S61)
```sql
-- Required for INV-11 (product drill-down / theoretical yield)
ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS std_pour_oz NUMERIC DEFAULT 1.25;
-- Industry defaults: 1.25oz premium, 1.5oz shot, 2oz well
```

---

## Usage Formula (locked S60)
```
Usage = Beginning + Stock Up Received − Ending

Beginning  = inv_counts WHERE count_type='opening' AND location=X AND session.period_id=P
Stock Up   = inv_stock_ups WHERE to_location=X AND report_date BETWEEN period.start_date AND period.end_date
Ending     = inv_counts WHERE count_type='closing' AND location=X AND session.period_id=P
```

## Beverage Cost Thresholds (locked S60)
| Band | Range | Action |
|---|---|---|
| On Target | < 18% | None |
| Watch | 18–25% | Monitor |
| High | 25–32% | Investigate |
| Alert | 32%+ | Drill-down |
| Unexplained pours | > 8% of theoretical yield | Flag theft/over-pour |

**Theoretical yield:** `usage_bottles × (750 / (std_pour_oz × 29.5735))`
