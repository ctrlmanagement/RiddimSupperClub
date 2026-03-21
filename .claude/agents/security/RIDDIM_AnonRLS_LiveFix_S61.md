# Anon RLS Live State Assessment + Fix SQL
**AG Entertainment · RIDDIM Platform · Session 61**
**Date:** March 20, 2026 — Pre-fix snapshot

---

## Live State Assessment — All 8 Tables

### 1. members
| Policy | Cmd | Role | Check | Assessment |
|---|---|---|---|---|
| `anon can register as member` | INSERT | anon | `true` | 🔴 No field guards — tier/points injectable |
| `staff can read members` | SELECT | anon | `true` | ⚠️ All rows readable — acceptable for staff checkin |
| `staff can update member on checkin` | UPDATE | anon | `true` | 🔴 No constraints — points/tier writable by anyone |
| `owner full access to members` | ALL | authenticated | `true` | ⚠️ Needs owner email scope |

**Fixes needed:** INSERT WITH CHECK guards + UPDATE WITH CHECK to block points/tier writes.

---

### 2. points_ledger
| Policy | Cmd | Role | Check | Assessment |
|---|---|---|---|---|
| `staff can insert points` | INSERT | anon | `amount >= -500 AND amount <= 500` | ✅ Already scoped — range guard exists |
| `staff can read points` | SELECT | anon | `true` | ⚠️ All rows readable — acceptable for staff |
| `owner full access to points_ledger` | ALL | authenticated | `true` | ⚠️ Needs owner email scope |

**Fixes needed:** None on anon side — range guard is solid. Owner scope is separate pass.

---

### 3. guest_lists
| Policy | Cmd | Role | Check | Assessment |
|---|---|---|---|---|
| `staff can insert guest list entry` | INSERT | anon | `true` | 🟠 No field guards |
| `staff can read guest list` | SELECT | anon | `true` | ✅ Acceptable for staff ops |
| `staff can update guest status` | UPDATE | anon | `status IN (confirmed, no_show, pending)` | ✅ Already scoped to valid statuses |
| `owner full access to guest_lists` | ALL | authenticated | `true` | ⚠️ Needs owner email scope |

**Fixes needed:** INSERT WITH CHECK guards only. UPDATE already correctly scoped.

---

### 4. reservations
| Policy | Cmd | Role | Check | Assessment |
|---|---|---|---|---|
| `anon can submit reservation` | INSERT | anon | `true` | 🟠 No field guards — flooding risk |
| `staff can read reservations` | SELECT | anon | `true` | ✅ Acceptable for staff ops |
| `staff can update reservation status` | UPDATE | anon | `true` | 🟠 No status constraint |
| `owner full access to reservations` | ALL | authenticated | `true` | ⚠️ Needs owner email scope |

**Fixes needed:** INSERT field guards + UPDATE status constraint.

---

### 5. table_bookings
| Policy | Cmd | Role | Check | Assessment |
|---|---|---|---|---|
| `anon insert table_bookings` | INSERT | anon | `true` | 🟠 No field guards |
| `anon read own booking by token` | SELECT | anon | `qr_token IS NOT NULL` | ✅ Already scoped by token |
| `authenticated insert table_bookings` | INSERT | authenticated | `true` | ⚠️ Needs owner email scope |
| `authenticated select table_bookings` | SELECT | authenticated | `true` | ⚠️ Needs owner email scope |
| `authenticated update table_bookings` | UPDATE | authenticated | `true` | ⚠️ Needs owner email scope |
| `Owner can delete own unscanned bookings` | DELETE | authenticated | scoped ✅ | ✅ Already correctly scoped |

**Fixes needed:** anon INSERT field guards only. SELECT already scoped. DELETE already good.

---

### 6. employee_enrollments
| Policy | Cmd | Role | Check | Assessment |
|---|---|---|---|---|
| `anon can insert enrollment` | INSERT | anon | `true` | 🟠 No FK validation |
| `staff can read enrollments` | SELECT | anon | `true` | ✅ Acceptable |
| `owner full access to enrollments` | ALL | authenticated | `true` | ⚠️ Needs owner email scope |

**Fixes needed:** INSERT WITH CHECK to require valid staff_id + member_id FK references.

---

### 7. table_sessions
| Policy | Cmd | Role | Check | Assessment |
|---|---|---|---|---|
| `Authenticated can manage table_sessions` | ALL | authenticated | `true` | ⚠️ Duplicate policy |
| `authenticated_manage_table_sessions` | ALL | authenticated | `true` | ⚠️ Duplicate — drop one |

**No anon policies at all** — this table is cleaner than the linter suggested. The `anon can manage table sessions` ALL policy from the linter export is **gone**. Only fix needed: drop one of the two duplicate authenticated policies.

---

### 8. inquiries
| Policy | Cmd | Role | Check | Assessment |
|---|---|---|---|---|
| `Public can insert inquiries` | INSERT | anon | `true` | 🟠 Duplicate — drop this one |
| `anon can submit inquiry` | INSERT | anon | `true` | ✅ Keep — add field guards |
| `owner full access to inquiries` | ALL | authenticated | `true` | ⚠️ Needs owner email scope |
| `Owner can read inquiries` | SELECT | authenticated | `true` | ⚠️ Redundant with ALL above |
| `Owner can update inquiries` | UPDATE | authenticated | `true` | ⚠️ Redundant with ALL above |

**Fixes needed:** Drop `Public can insert inquiries` duplicate. Drop redundant SELECT + UPDATE authenticated policies (ALL covers them). Add field guards to INSERT.

---

## Summary — What Actually Needs Fixing

| Table | Action Required |
|---|---|
| `members` | INSERT guards + UPDATE block points/tier |
| `points_ledger` | ✅ Already scoped — no anon changes needed |
| `guest_lists` | INSERT field guards only (UPDATE already scoped ✅) |
| `reservations` | INSERT field guards + UPDATE status constraint |
| `table_bookings` | INSERT field guards only (SELECT already scoped ✅) |
| `employee_enrollments` | INSERT FK validation |
| `table_sessions` | Drop one duplicate authenticated ALL policy |
| `inquiries` | Drop duplicate INSERT + drop redundant auth policies |

---

## Fix SQL — Run in This Order

---

### FIX 1 — members INSERT + UPDATE

```sql
-- Guard INSERT: prevent points/tier injection on signup
DROP POLICY IF EXISTS "anon can register as member" ON public.members;

CREATE POLICY "anon can register as member"
ON public.members FOR INSERT
TO anon
WITH CHECK (
  total_points = 0
  AND total_visits = 0
  AND status = 'active'
);

-- Guard UPDATE: block points and tier changes via anon
DROP POLICY IF EXISTS "staff can update member on checkin" ON public.members;

CREATE POLICY "staff can update member on checkin"
ON public.members FOR UPDATE
TO anon
USING (true)
WITH CHECK (
  total_points = (SELECT total_points FROM public.members m WHERE m.id = members.id)
  AND tier = (SELECT tier FROM public.members m WHERE m.id = members.id)
);

-- Verify
SELECT policyname, cmd, roles, qual AS using_clause, with_check AS check_clause
FROM pg_policies
WHERE tablename = 'members' AND roles::text LIKE '%anon%'
ORDER BY cmd;
```

---

### FIX 2 — guest_lists INSERT guards

```sql
-- UPDATE already correctly scoped — do not touch
-- Only fix INSERT

DROP POLICY IF EXISTS "staff can insert guest list entry" ON public.guest_lists;

CREATE POLICY "staff can insert guest list entry"
ON public.guest_lists FOR INSERT
TO anon
WITH CHECK (
  guest_name IS NOT NULL
  AND event_id IS NOT NULL
);

-- Verify
SELECT policyname, cmd, roles, qual AS using_clause, with_check AS check_clause
FROM pg_policies
WHERE tablename = 'guest_lists' AND roles::text LIKE '%anon%'
ORDER BY cmd;
```

---

### FIX 3 — reservations INSERT + UPDATE

```sql
-- Guard INSERT: require minimum valid fields
DROP POLICY IF EXISTS "anon can submit reservation" ON public.reservations;

CREATE POLICY "anon can submit reservation"
ON public.reservations FOR INSERT
TO anon
WITH CHECK (
  guest_name IS NOT NULL
  AND guest_phone IS NOT NULL
  AND party_size > 0
  AND party_size <= 20
  AND status = 'pending'
);

-- Guard UPDATE: lock to valid status transitions only
DROP POLICY IF EXISTS "staff can update reservation status" ON public.reservations;

CREATE POLICY "staff can update reservation status"
ON public.reservations FOR UPDATE
TO anon
USING (true)
WITH CHECK (
  status IN ('pending', 'confirmed', 'seated', 'cancelled', 'no_show')
);

-- Verify
SELECT policyname, cmd, roles, qual AS using_clause, with_check AS check_clause
FROM pg_policies
WHERE tablename = 'reservations' AND roles::text LIKE '%anon%'
ORDER BY cmd;
```

---

### FIX 4 — table_bookings INSERT guards

```sql
-- SELECT already correctly scoped by qr_token — do not touch

DROP POLICY IF EXISTS "anon insert table_bookings" ON public.table_bookings;

CREATE POLICY "anon insert table_bookings"
ON public.table_bookings FOR INSERT
TO anon
WITH CHECK (
  guest_name IS NOT NULL
  AND guest_phone IS NOT NULL
  AND party_size > 0
  AND status = 'pending'
);

-- Verify
SELECT policyname, cmd, roles, qual AS using_clause, with_check AS check_clause
FROM pg_policies
WHERE tablename = 'table_bookings' AND roles::text LIKE '%anon%'
ORDER BY cmd;
```

---

### FIX 5 — employee_enrollments INSERT FK validation

```sql
DROP POLICY IF EXISTS "anon can insert enrollment" ON public.employee_enrollments;

CREATE POLICY "anon can insert enrollment"
ON public.employee_enrollments FOR INSERT
TO anon
WITH CHECK (
  staff_id IS NOT NULL
  AND member_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.staff WHERE id = employee_enrollments.staff_id)
  AND EXISTS (SELECT 1 FROM public.members WHERE id = employee_enrollments.member_id)
);

-- Verify
SELECT policyname, cmd, roles, qual AS using_clause, with_check AS check_clause
FROM pg_policies
WHERE tablename = 'employee_enrollments' AND roles::text LIKE '%anon%'
ORDER BY cmd;
```

---

### FIX 6 — table_sessions: drop duplicate authenticated policy

```sql
-- Two identical ALL authenticated policies — drop one
DROP POLICY IF EXISTS "authenticated_manage_table_sessions" ON public.table_sessions;

-- Verify — should show only one authenticated ALL policy
SELECT policyname, cmd, roles, qual AS using_clause, with_check AS check_clause
FROM pg_policies
WHERE tablename = 'table_sessions'
ORDER BY roles, cmd;
```

---

### FIX 7 — inquiries: drop duplicate + redundant policies

```sql
-- Drop duplicate anon INSERT
DROP POLICY IF EXISTS "Public can insert inquiries" ON public.inquiries;

-- Drop redundant authenticated policies (owner full access ALL covers these)
DROP POLICY IF EXISTS "Owner can read inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Owner can update inquiries" ON public.inquiries;

-- Add field guards to the remaining INSERT
DROP POLICY IF EXISTS "anon can submit inquiry" ON public.inquiries;

CREATE POLICY "anon can submit inquiry"
ON public.inquiries FOR INSERT
TO anon
WITH CHECK (
  (phone IS NOT NULL OR email IS NOT NULL)
  AND message IS NOT NULL
);

-- Verify
SELECT policyname, cmd, roles, qual AS using_clause, with_check AS check_clause
FROM pg_policies
WHERE tablename = 'inquiries'
ORDER BY roles, cmd;
```

---

## Final Verification — All 8 Tables

```sql
-- Run after all fixes to confirm clean state
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual       AS using_clause,
  with_check AS check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'members', 'points_ledger', 'guest_lists', 'reservations',
    'table_bookings', 'employee_enrollments', 'table_sessions', 'inquiries'
  )
ORDER BY tablename, roles, cmd;
```

---

## Points_ledger — No Changes Needed ✅

```sql
-- Already correctly scoped — confirm and move on
SELECT policyname, cmd, roles, qual AS using_clause, with_check AS check_clause
FROM pg_policies
WHERE tablename = 'points_ledger'
ORDER BY roles, cmd;

-- Expected: amount >= -500 AND amount <= 500 on anon INSERT — this is good
```

---

*RIDDIM_AnonRLS_LiveFix_S61.md · Session 61 · March 20, 2026 · AG Entertainment*
*Run fixes in order 1–7. Verify after each. Run final verification query to confirm clean state.*
