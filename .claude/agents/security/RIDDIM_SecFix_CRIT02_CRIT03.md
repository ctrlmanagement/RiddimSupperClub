# Security Fix — CRIT-02 & CRIT-03
**AG Entertainment · RIDDIM Platform · Session 61**  
**Date:** March 19, 2026  
**Status:** Ready to deploy

---

## CRIT-02 — `join.html` Wrong Supabase Key Type

### Issue

`join.html` instantiates its Supabase client inline inside the signup submit handler using the `sb_publishable` key instead of the required anon JWT. This violates the permanent platform constraint: *members portal and all public-facing pages that write member data must use the eyJ anon JWT key.*

The `sb_publishable` key resolves to a different auth context than `anon` in Supabase's RLS evaluation. Any RLS policies written for the `anon` role may not apply when the client is initialized with `sb_publishable`, meaning member inserts, booking links, and ticket links made during signup could bypass row-level restrictions.

**File:** `docs/join.html`  
**Line:** 1286  
**Affected operations:** member INSERT, employee_enrollments INSERT, table_bookings UPDATE, tickets UPDATE

---

### Fix

**One line change.** Replace the `sb_publishable` key with the eyJ anon JWT.

```javascript
// ❌ BEFORE — line 1284–1287
const { createClient } = window.supabase;
const sb = createClient(
  'https://cbvryfgrqzdvbqigyrgh.supabase.co',
  'sb_publishable_fQlHFhC7tPkZNRl1djnvcA_68LpKQpv'
);

// ✅ AFTER — correct key
const { createClient } = window.supabase;
const sb = createClient(
  'https://cbvryfgrqzdvbqigyrgh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidnJ5ZmdycXpkdmJxaWd5cmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MDk1MTcsImV4cCI6MjA4Nzk4NTUxN30.VowMyliVJXmHr2jc7K_07jGHcUnSzfPrSZudB4JALeA'
);
```

> **Note:** This is the only Supabase client instantiation in `join.html`. There is no global `SUPABASE_KEY` constant on this page — the client is created locally inside the submit handler. No other lines need to change.

---

### Verify

After deploying, open DevTools → Network on `join.html` and submit a test registration. Confirm the Supabase request headers show:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Not:

```
Authorization: Bearer sb_publishable_...
```

---

---

## CRIT-03 — `contact.html` Phone Lookup Uses `.eq()` Instead of `.ilike()`

### Issue

The `lookupGuest()` function in `contact.html` queries five tables using exact-match (`eq.`) on phone numbers. The documented permanent constraint requires: *phone lookup must use `.ilike('phone', '%<10digits>%')` not `.eq()`.*

Phone numbers are stored inconsistently across tables — some rows use E.164 format (`+14045551234`), some use 10-digit (`4045551234`), some may have formatting characters. Using `eq.` against a single format means members stored in a different format will silently not be found, causing:

- Members presenting at the venue showing as **New** instead of **Member**
- Duplicate member creation on the join form
- Referral attribution failing silently
- The inquiries lookup running **two sequential fetches** as a manual fallback — unnecessary complexity that can be collapsed

**File:** `docs/contact.html`  
**Lines:** 1826–1869  
**Function:** `lookupGuest()`  
**Affected tables:** `members`, `reservations`, `vip_passes`, `guest_lists`, `inquiries`

---

### Fix

Replace the entire 5-query block inside `lookupGuest()` with the corrected version below. Key changes:

1. All five queries switch from `eq.` to `ilike.%25${phone10}%25` (PostgREST syntax for `ILIKE '%4045551234%'`)
2. The `inquiries` double-fetch (r5a + r5b fallback) collapses into a single query
3. The `phoneE164` guards on queries 1 and 2 are removed — `phone10` works for all formats via ilike

> **URL encoding note:** `%25` is the URL-encoded form of `%`. So `ilike.%25${phone10}%25` sends `ilike.%4045551234%` to the PostgREST API, which translates to SQL `ILIKE '%4045551234%'`.

---

**❌ BEFORE — current code (lines 1826–1869)**

```javascript
const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

// 1. members (E.164)
if (phoneE164) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/members?phone=eq.${encodeURIComponent(phoneE164)}&select=id,first_name,last_name,email&limit=1`, { headers });
  const d = await r.json();
  if (d && d.length > 0) {
    foundStatuses.push('Member');
    foundMemberId  = d[0].id;
    foundFirstName = d[0].first_name;
    foundLastName  = d[0].last_name;
    foundEmail     = d[0].email;
  }
}

// 2. reservations (E.164)
if (phoneE164) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/reservations?member_phone=eq.${encodeURIComponent(phoneE164)}&select=id&limit=1`, { headers });
  const d = await r.json();
  if (d && d.length > 0) foundStatuses.push('Reservation');
}

// 3. vip_passes (10-digit)
const r3 = await fetch(`${SUPABASE_URL}/rest/v1/vip_passes?guest_phone=eq.${phone10}&select=id&limit=1`, { headers });
const d3 = await r3.json();
if (d3 && d3.length > 0) foundStatuses.push('VIP Guest');

// 4. guest_lists (10-digit)
if (phone10) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/guest_lists?guest_phone=eq.${phone10}&select=id&limit=1`, { headers });
  const d = await r.json();
  if (d && d.length > 0) foundStatuses.push('Guest List');
}

// 5. inquiries — past contact history (phone10 or E.164)
const r5a = await fetch(`${SUPABASE_URL}/rest/v1/inquiries?phone=eq.${phone10}&select=id&limit=1`, { headers });
const d5a = await r5a.json();
if (!d5a || d5a.length === 0) {
  if (phoneE164) {
    const r5b = await fetch(`${SUPABASE_URL}/rest/v1/inquiries?phone=eq.${encodeURIComponent(phoneE164)}&select=id&limit=1`, { headers });
    const d5b = await r5b.json();
    if (d5b && d5b.length > 0) foundStatuses.push('Ticket Holder');
  }
} else {
  foundStatuses.push('Ticket Holder');
}
```

---

**✅ AFTER — corrected code (replace lines 1826–1869 with this)**

```javascript
const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

// 1. members — ilike matches any stored format (E.164, 10-digit, formatted)
const r1 = await fetch(`${SUPABASE_URL}/rest/v1/members?phone=ilike.%25${phone10}%25&select=id,first_name,last_name,email&limit=1`, { headers });
const d1 = await r1.json();
if (d1 && d1.length > 0) {
  foundStatuses.push('Member');
  foundMemberId  = d1[0].id;
  foundFirstName = d1[0].first_name;
  foundLastName  = d1[0].last_name;
  foundEmail     = d1[0].email;
}

// 2. reservations
const r2 = await fetch(`${SUPABASE_URL}/rest/v1/reservations?member_phone=ilike.%25${phone10}%25&select=id&limit=1`, { headers });
const d2 = await r2.json();
if (d2 && d2.length > 0) foundStatuses.push('Reservation');

// 3. vip_passes
const r3 = await fetch(`${SUPABASE_URL}/rest/v1/vip_passes?guest_phone=ilike.%25${phone10}%25&select=id&limit=1`, { headers });
const d3 = await r3.json();
if (d3 && d3.length > 0) foundStatuses.push('VIP Guest');

// 4. guest_lists
const r4 = await fetch(`${SUPABASE_URL}/rest/v1/guest_lists?guest_phone=ilike.%25${phone10}%25&select=id&limit=1`, { headers });
const d4 = await r4.json();
if (d4 && d4.length > 0) foundStatuses.push('Guest List');

// 5. inquiries — single query replaces prior double-fetch fallback pattern
const r5 = await fetch(`${SUPABASE_URL}/rest/v1/inquiries?phone=ilike.%25${phone10}%25&select=id&limit=1`, { headers });
const d5 = await r5.json();
if (d5 && d5.length > 0) foundStatuses.push('Ticket Holder');
```

---

### What Changed in Query 5

The old `inquiries` lookup ran two fetches — first trying `phone10`, then falling back to `phoneE164` only if the first returned empty. With `ilike` matching on the 10-digit core, a single query catches both formats in one round trip. The `r5b` block and its `phoneE164` guard are deleted entirely.

---

### Verify

After deploying, test these scenarios against the contact form:

| Test | Input | Expected Result |
|---|---|---|
| Member stored as E.164 (`+14045551234`) | Enter `404-555-1234` | Status shows **Member**, name pre-fills |
| Member stored as 10-digit (`4045551234`) | Enter `(404) 555-1234` | Status shows **Member**, name pre-fills |
| Phone on guest list only | Enter guest's number | Status shows **Guest List** |
| Phone on VIP pass | Enter VIP number | Status shows **VIP Guest** |
| Phone in inquiries table | Enter inquiry phone | Status shows **Ticket Holder** |
| Unknown phone | Enter new number | Status shows **New** |

---

## Deployment Checklist

- [ ] Replace line 1286 in `docs/join.html` — swap `sb_publishable` key for eyJ anon JWT
- [ ] Replace lines 1826–1869 in `docs/contact.html` — swap all 5 phone lookup queries to `ilike`
- [ ] Test join flow end-to-end: new member signup → redirect to members portal
- [ ] Test contact form phone lookup against known member phone in staging
- [ ] Commit both files with message: `fix(security): CRIT-02 join.html key type + CRIT-03 contact phone ilike`
- [ ] Add to Session 61 deployed items in context briefing

---

*RIDDIM_SecFix_CRIT02_CRIT03.md · Session 61 · March 19, 2026 · AG Entertainment*
