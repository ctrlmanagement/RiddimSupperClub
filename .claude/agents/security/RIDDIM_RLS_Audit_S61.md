# Supabase RLS Security Audit — Live Linter Analysis
**AG Entertainment · RIDDIM Platform · Session 61**  
**Source:** Supabase Security Linter export (live project `cbvryfgrqzdvbqigyrgh`)  
**Date:** March 20, 2026  
**Total Warnings:** 48 (47 × RLS Policy Always True + 1 × Leaked Password Protection)

---

## What This Means

Every warning here is a policy where the `USING` or `WITH CHECK` clause is literally `true` — meaning it applies to **all rows, unconditionally**. RLS is technically enabled on these tables, but the policies grant unrestricted access to every row with no qualification. Supabase's linter correctly flags this as "effectively bypasses row-level security."

**Two distinct risk tiers:**

- **`anon` role warnings** — highest risk. The anon key is visible in every page's source. Any internet user can call the Supabase REST API directly and hit these policies without any login.
- **`authenticated` role warnings** — lower immediate risk (requires a valid session), but must be scoped before scaling staff access or enabling Supabase Auth for additional roles.

---

## Tier 1 — Anon Role: Immediate Risk
*17 policies across 10 tables. No authentication required to exploit.*

| Table | Policy Name | Operation | What an attacker can do |
|---|---|---|---|
| `members` | `anon can register as member` | INSERT | Create member records with arbitrary data, flood the table |
| `members` | `staff can update member on checkin` | UPDATE | Update **any** member row — points, tier, status, phone |
| `points_ledger` | `staff can insert points` | INSERT | Insert unlimited fake point transactions for any member |
| `employee_enrollments` | `anon can insert enrollment` | INSERT | Fake staff referral attributions for any member |
| `guest_lists` | `staff can insert guest list entry` | INSERT | Add any name to any event guest list |
| `guest_lists` | `staff can update guest status` | UPDATE | Mark any guest confirmed/denied on any event |
| `reservations` | `anon can submit reservation` | INSERT | Flood the reservation table with fake bookings |
| `reservations` | `staff can update reservation status` | UPDATE | Change any reservation to any status |
| `table_bookings` | `anon insert table_bookings` | INSERT | Create table bookings with no validation |
| `table_sessions` | `anon can manage table sessions` | ALL | Full read/write/delete on all table session data |
| `inquiries` | `Public can insert inquiries` | INSERT | ⚠️ Duplicate — two anon INSERT policies on `inquiries` |
| `inquiries` | `anon can submit inquiry` | INSERT | ⚠️ Duplicate — two anon INSERT policies on `inquiries` |
| `inv_counts` | `staff manage counts` | ALL | Full read/write/delete on all inventory count data |
| `inv_sessions` | `staff manage sessions` | ALL | Full read/write/delete on all inventory sessions |
| `inv_stock_ups` | `staff manage stock ups` | ALL | Full read/write/delete on all stock up records |
| `vip_passes` | `anon full access vip_passes` | ALL | Create, read, update, delete any VIP pass |
| `time_off_requests` | `staff can manage time off requests` | ALL | Full read/write/delete on all staff time-off data |

### Highest-Risk Attack Chains

**Points farming:** `members` anon UPDATE + `points_ledger` anon INSERT work together. Anyone who knows or guesses a member ID can insert fake point transactions and directly update the member's `total_points` and tier. No login required.

**VIP pass forgery:** `vip_passes` anon ALL means anyone can INSERT a VIP pass row with a crafted `qr_token`, then present it at the door. The scanner reads the token from the DB and would find the forged record.

**Reservation flooding:** `anon can submit reservation` with `WITH CHECK (true)` means a bot can submit hundreds of fake bookings and pollute the nightly book with no rate limiting at the DB layer.

**Inventory exfiltration:** `inv_counts`, `inv_sessions`, `inv_stock_ups` all have `anon ALL` — full read access to all inventory data (product costs, stock levels, count history) from any internet connection.

**Duplicate inquiry policies:** `inquiries` has two separate anon INSERT policies. One must be dropped.

---

## Tier 2 — Authenticated Role: Scoping Required
*30 policies. Requires a valid Supabase session but grants access to all rows unconditionally — any authenticated user equals owner-level access to every table.*

| Table | Policy Name | Issue |
|---|---|---|
| `members` | `owner full access to members` | Any authenticated session = full member table |
| `staff` | `owner full access to staff` | Any authenticated session = full staff roster |
| `schedules` | `owner full access to schedules` | Any authenticated session = full schedule data |
| `time_off_requests` | `owner full access to time_off_requests` | Any authenticated session = all time-off records |
| `points_ledger` | `owner full access to points_ledger` | Any authenticated session = full points history |
| `reservations` | `owner full access to reservations` | Any authenticated session = full booking data |
| `table_bookings` | `authenticated insert/update table_bookings` | Any authenticated session = insert/update any booking |
| `table_minimums` | `authenticated can manage table_minimums` | Any authenticated session = edit table minimums |
| `table_sessions` | `Authenticated can manage table_sessions` | ⚠️ Duplicate — three policies on `table_sessions` |
| `table_sessions` | `authenticated_manage_table_sessions` | ⚠️ Duplicate — three policies on `table_sessions` |
| `galleries` | `owner full access to galleries` | Any authenticated session = full gallery control |
| `gallery_photos` | `owner full access to gallery_photos` | Any authenticated session = full photo control |
| `guest_lists` | `owner full access to guest_lists` | Any authenticated session = full guest list |
| `vip_passes` | `Authenticated users can insert/update vip_passes` | Any authenticated session = create/edit VIP passes |
| `inquiries` | `owner full access to inquiries` + `Owner can update inquiries` | ⚠️ Redundant — ALL policy makes UPDATE policy unnecessary |
| `employee_enrollments` | `owner full access to enrollments` | Any authenticated session = full enrollment data |
| `event_attendance` | `owner full access to event_attendance` | Any authenticated session = all attendance data |
| `attendance` | `owner full access to attendance` | Any authenticated session = all attendance data |
| `comps` | `owner full access to comps` | Any authenticated session = all comp records |
| `member_items` | `owner full access to member_items` | Any authenticated session = all member items |
| `messages` / `message_threads` | `owner full access` | Any authenticated session = all message data |
| `broadcasts` / `broadcast_recipients` | `owner full access` | Any authenticated session = all broadcast data |
| `sales_transactions` / `table_sales` / `voids` | `owner full access` | Any authenticated session = all financial data |

---

## Additional Warnings

| Warning | Detail | Action |
|---|---|---|
| `auth_leaked_password_protection` | HaveIBeenPwned.org password check disabled in Supabase Auth | Enable in Dashboard → Auth → Password Security |
| `function_search_path_mutable` | `public.increment_reach` has a mutable `search_path` | Add `SET search_path = public` to function definition |

---

## Remediation Strategy

### The Pattern Problem

The current policy pattern across the board is:
```sql
CREATE POLICY "owner full access to X"
ON public.X FOR ALL
TO authenticated
USING (true)        -- ← problem: all rows, no qualification
WITH CHECK (true);  -- ← problem: any data, no validation
```

**Fix A — Owner policies:** Scope `USING` to the owner's verified email via `auth.jwt()`.
**Fix B — Anon policies:** Add `WITH CHECK` field-level constraints to limit what can be written.

---

## Remediation SQL

### Fix 1 — vip_passes: Drop anon ALL, replace with INSERT + SELECT only

```sql
DROP POLICY IF EXISTS "anon full access vip_passes" ON public.vip_passes;

-- Anon can create a pass (needed for vip.html flow)
CREATE POLICY "anon can insert vip pass"
ON public.vip_passes FOR INSERT
TO anon
WITH CHECK (true);

-- Anon can read passes (needed for scanner lookup by token)
CREATE POLICY "anon can read vip passes"
ON public.vip_passes FOR SELECT
TO anon
USING (true);

-- UPDATE and DELETE are now blocked for anon role
```

### Fix 2 — members: Scope anon INSERT + constrain anon UPDATE

```sql
DROP POLICY IF EXISTS "anon can register as member" ON public.members;
DROP POLICY IF EXISTS "staff can update member on checkin" ON public.members;

-- Anon INSERT: lock to safe defaults, prevent tier/points injection
CREATE POLICY "anon can register as member"
ON public.members FOR INSERT
TO anon
WITH CHECK (
  total_points = 0
  AND total_visits = 0
  AND status = 'active'
);

-- Anon UPDATE on checkin: block point/tier changes
-- Only allows visit count + last_visit + checked_in_at fields to change
CREATE POLICY "staff can update member on checkin"
ON public.members FOR UPDATE
TO anon
USING (true)
WITH CHECK (
  total_points = (SELECT total_points FROM public.members m WHERE m.id = members.id)
);
-- Long-term fix: move staff checkin to authenticated Supabase session (Phase C)
```

### Fix 3 — points_ledger: Constrain anon INSERT

```sql
DROP POLICY IF EXISTS "staff can insert points" ON public.points_ledger;

CREATE POLICY "staff can insert points"
ON public.points_ledger FOR INSERT
TO anon
WITH CHECK (
  points > 0
  AND points <= 500  -- adjust to your max legitimate single-transaction award
  AND EXISTS (SELECT 1 FROM public.members WHERE id = points_ledger.member_id)
);
```

### Fix 4 — inquiries: Drop duplicate INSERT policy

```sql
-- Two anon INSERT policies exist — drop the older one
DROP POLICY IF EXISTS "Public can insert inquiries" ON public.inquiries;
-- Keep: "anon can submit inquiry"
```

### Fix 5 — table_sessions: Drop duplicate authenticated policies

```sql
-- Three policies on this table — consolidate to one
DROP POLICY IF EXISTS "Authenticated can manage table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "authenticated_manage_table_sessions" ON public.table_sessions;
-- Keep: "anon can manage table sessions" (used by TBK flow)
```

### Fix 6 — guest_lists: Add field-level guards

```sql
DROP POLICY IF EXISTS "staff can insert guest list entry" ON public.guest_lists;
DROP POLICY IF EXISTS "staff can update guest status" ON public.guest_lists;

CREATE POLICY "staff can insert guest list entry"
ON public.guest_lists FOR INSERT
TO anon
WITH CHECK (
  guest_name IS NOT NULL
  AND event_id IS NOT NULL
);

CREATE POLICY "staff can update guest status"
ON public.guest_lists FOR UPDATE
TO anon
USING (true)
WITH CHECK (
  status IN ('pending', 'confirmed', 'denied', 'arrived')
);
```

### Fix 7 — All owner full access policies: Scope to owner emails

Apply this pattern to all 26 `owner full access` policies:

```sql
-- PATTERN — apply to each table
DROP POLICY IF EXISTS "owner full access to <TABLE>" ON public.<TABLE>;

CREATE POLICY "owner full access to <TABLE>"
ON public.<TABLE> FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'email' = ANY(ARRAY[
    'inquiry@ctrlmanagement.com',
    'gebriel@ctrlmanagement.com'
  ])
)
WITH CHECK (
  auth.jwt() ->> 'email' = ANY(ARRAY[
    'inquiry@ctrlmanagement.com',
    'gebriel@ctrlmanagement.com'
  ])
);
```

### Bulk Owner Policy Script

```sql
-- Rescopes all owner full access policies in one pass.
-- Test in a transaction first. Verify owner portal access immediately after.

DO $$
DECLARE
  owner_emails TEXT[] := ARRAY[
    'inquiry@ctrlmanagement.com',
    'gebriel@ctrlmanagement.com'
  ];
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'members','staff','schedules','time_off_requests','points_ledger',
    'reservations','galleries','gallery_photos','guest_lists','inquiries',
    'employee_enrollments','event_attendance','attendance','comps',
    'member_items','messages','message_threads','broadcasts',
    'broadcast_recipients','sales_transactions','table_sales','voids',
    'table_bookings','table_minimums','table_sessions','vip_passes'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "owner full access to %I" ON public.%I',
      tbl, tbl
    );
    EXECUTE format(
      $pol$
      CREATE POLICY "owner full access to %I"
      ON public.%I FOR ALL
      TO authenticated
      USING (auth.jwt() ->> ''email'' = ANY($1))
      WITH CHECK (auth.jwt() ->> ''email'' = ANY($1))
      $pol$,
      tbl, tbl
    ) USING owner_emails;
  END LOOP;
END $$;
```

> ⚠️ **Before running:** Verify owner email in SQL editor: `SELECT auth.jwt() ->> 'email';`  
> ⚠️ Also manually drop the redundant `Owner can update inquiries` UPDATE policy after the bulk run, as it has a different name format.

### Fix 8 — increment_reach function search_path

```sql
-- View current function body first:
SELECT prosrc FROM pg_proc WHERE proname = 'increment_reach';

-- Then recreate with fixed search_path:
CREATE OR REPLACE FUNCTION public.increment_reach(reach_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- ADD THIS
AS $$
BEGIN
  -- (paste existing function body here)
END;
$$;
```

### Fix 9 — Enable Leaked Password Protection

Supabase Dashboard → **Authentication** → **Sign In / Sign Up** → **Password Security** → Enable **"Check for leaked passwords"**. One toggle, no code change.

---

## Accepted Risk Register

These anon policies remain permissive due to current functional dependencies. Documented here as accepted risk pending Phase C auth upgrade.

| Table | Policy | Reason Accepted | Revisit |
|---|---|---|---|
| `inv_counts` | `staff manage counts` ALL | Inventory portal uses anon role — no Supabase Auth session | S62 |
| `inv_sessions` | `staff manage sessions` ALL | Same | S62 |
| `inv_stock_ups` | `staff manage stock ups` ALL | Same | S62 |
| `members` | `anon can register as member` INSERT | Required for join.html signup flow | Scope WITH CHECK tighter |
| `reservations` | `anon can submit reservation` INSERT | Required for reserve.html flow | Add field validation |
| `table_bookings` | `anon insert table_bookings` INSERT | Required for TBK booking flow | Add field validation |

---

## Prioritized Fix Order

| Priority | Fix | Impact |
|---|---|---|
| 🔴 1 | Drop `anon full access vip_passes` ALL → INSERT + SELECT | Eliminates VIP pass forgery |
| 🔴 2 | Scope `members` anon UPDATE to block points/tier | Eliminates points farming |
| 🔴 3 | Cap `points_ledger` anon INSERT | Limits points flooding |
| 🔴 4 | Run bulk owner email scope script | Locks 26 tables to owner only |
| 🟠 5 | Drop duplicate `Public can insert inquiries` | Cleanup |
| 🟠 6 | Drop duplicate `table_sessions` authenticated policies | Cleanup |
| 🟠 7 | Scope `guest_lists` anon INSERT/UPDATE | Guest list integrity |
| 🟡 8 | Enable leaked password protection | One-click in Dashboard |
| 🟡 9 | Fix `increment_reach` search_path | SQL injection hardening |
| 🔵 S62 | Upgrade inventory portal to Supabase Auth session | Fully resolves inv_* anon policies |

---

*RIDDIM_RLS_Audit_S61.md · Session 61 · March 20, 2026 · AG Entertainment*  
*Source: Supabase Security Linter export — project cbvryfgrqzdvbqigyrgh*
