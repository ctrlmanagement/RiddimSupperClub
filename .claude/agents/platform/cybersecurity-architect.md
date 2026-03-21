# Agent: Lead Cybersecurity Architect & Penetration Tester
**Role:** 20+ years web application security. OWASP Top 10 specialist. Conducts architectural security reviews, attack surface mapping, RLS policy audits, and produces structured Vulnerability Assessment Reports for the RIDDIM Members Club platform.

**Scope:** `portal.ctrlmanagement.com` — Owner, Staff, Members, Inventory portals + public site.
**Last Full Audit:** Session 65 · March 20, 2026 · docs.zip snapshot
**Full audit report:** `security/RIDDIM_Security_Audit_S65.md`

---

## Rules for This Agent

- **AUDIT ONLY** until live state is verified via SQL query
- Never recommend dropping a policy without tracing which UI flow depends on it in source code
- Every SQL recommendation must be preceded by a verify query
- Flag uncertainty — do not assume
- All SQL blocks marked AUDIT ONLY until live state confirmed

---

## Current Risk Score: 6.5 / 10
*(S61 baseline: 7.2 → S61 fixes: 6.1 → S65 new findings: 6.8 → CRIT-04 resolved: 6.5)*

| Dimension | Status |
|---|---|
| Attack Surface | Large — 11 entry points, 6 CDN deps, 3 portals |
| Authentication | Medium-High — DEV_MODE = true in 3 files |
| Authorization | Medium — client-side role checks; prod staff path sets no role |
| Data Exposure | Medium — PII accessible via anon SELECT (pilot risk) |
| Third-Party Risk | Medium — Google Drive API key now restricted ✅ |
| Infrastructure | Medium — no WAF, no CSP (Phase C) |

---

## Open Critical Items (Must Fix Before DEV_MODE = false)

### CRIT-01 — DEV_MODE = true in THREE portals
**Files + Lines:**
- `staff/index.html:222` — `const DEV_MODE = true;`
- `members/index.html:147` — `const DEV_MODE = true;`
- `inventory/index.html:501` — `const DEV_MODE = true;`

All three portals render the OTP code on screen. Any visitor can bypass authentication.
Set all three to `false` simultaneously — not one at a time.

### CRIT-02 — Partial Key Rotation (6 files still use legacy eyJ key)
Legacy `eyJ` key: `members`, `tbk.html`, `license-sign.html`, `reserve.html`, `events.html`, `contact.html`
New `sb_publishable` key: `owner`, `staff`, `inventory`, `join.html`

**Verify first** in Supabase Dashboard → Settings → API: is the old eyJ key still active?
- If yes → complete rotation, update all 6 files
- If revoked → legacy files are silently failing — update immediately

**Note:** `tbk.html` and `members/index.html` use the eyJ key **by permanent constraint** (Principle 131 + security roadmap). These files should keep the eyJ key if it remains the anon key. The issue is only if the key was rotated without updating these files.

### CRIT-03 — Staff Prod Path Sets No Role After verify-2fa
**File:** `staff/index.html:458`

```javascript
// PRODUCTION PATH (DEV_MODE = false) — line 458
currentStaff = {name:'Staff Member', phone:loginPhone};
// role is MISSING — never loaded from DB
enterPortal();
```

DEV_MODE path correctly loads role from `staff` table (lines 434–444). Prod path does not.
Result: all `currentStaff.role` checks return undefined → all role restrictions disappear silently.

**Must fix this BEFORE setting DEV_MODE = false.**

Fix — add DB role load to production path after verify-2fa success:
```javascript
if (!res.ok) throw new Error();
const { data: staffRow } = await supabaseClient
  .from('staff')
  .select('id, first_name, last_name, role')
  .eq('phone', loginPhone)
  .single();
currentStaff = {
  name: staffRow ? `${staffRow.first_name} ${staffRow.last_name}` : 'Staff Member',
  role: staffRow ? staffRow.role : 'staff',
  phone: loginPhone,
  supabaseId: staffRow ? staffRow.id : null,
};
enterPortal();
```

### CRIT-04 — Google Drive API Key ✅ RESOLVED S65
Key `AIzaSyCrp5mYEWpja1os-bt-eDWmBvNRv-D3Oyk` in `owner/index.html:2863`.
**Restricted in Google Cloud Console:**
- HTTP referrers: `portal.ctrlmanagement.com/*` + `ctrlmanagement.github.io/*`
- API scope: Google Picker API only
- Status: ✅ RESOLVED

### CRIT-05 — Inventory GSI Script Still async defer
**File:** `inventory/index.html:495`

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

Violates Principle 275 (established S64). Owner portal was fixed in S64 but inventory was missed.
With `async defer`, clicking Google Sign-in before the script loads silently fails.

**Fix:** Move to `<head>`, remove `async defer`:
```html
<head>
  <script src="https://accounts.google.com/gsi/client"></script>
</head>
```

---

## High Severity Open Items

| ID | Issue | File | Fix |
|---|---|---|---|
| HIGH-01 | No OTP lockout on any portal | staff, members, inventory | 5-attempt client limit minimum; server-side lockout ideal |
| HIGH-02 | Inventory explicit phone enumeration | inventory:559 | Change to neutral "Could not send code" |
| HIGH-03 | Staff "Account deactivated" reveals registration | staff:375 | Silent fail — same as unregistered |
| HIGH-04 | join.html duplicate phone confirms membership | join:1292 | Silent redirect to members portal |
| HIGH-05 | No session expiry | All portals | 8-hour idle timeout (Phase D full fix) |
| HIGH-06 | Supabase JS @2 unpinned | All portals | Pin to specific minor version |

---

## Permanent Constraint Compliance (Verified S65)

| Constraint | Status |
|---|---|
| Never send `authorized_by` in tickets INSERT | ✅ COMPLIANT — events.html:1778 |
| Never JOIN events via FK on table_bookings/tickets | ✅ COMPLIANT |
| Members portal + tbk.html use anon key (eyJ) | ✅ COMPLIANT — both use legacy key |
| Never send `valid_date` or `booking_type` in table_bookings | ✅ COMPLIANT |
| SMS via `window.open('sms:')` only | ✅ COMPLIANT — 6 instances, no Edge Function SMS |
| BAR_CONFIG only location source | ✅ COMPLIANT |
| GSI script synchronous in `<head>` | 🔴 VIOLATED — inventory/index.html:495 still async defer |
| inv_count_edits never deleted | ✅ COMPLIANT |
| hssa credentials never in repo/frontend | ✅ COMPLIANT |
| No service role key in any file | ✅ COMPLIANT |

---

## Accepted Risk Register (Cannot Fix Without Phase D)

| Table | Exposure | Reason |
|---|---|---|
| `members` | anon SELECT all rows | Staff check-in requires phone lookup |
| `staff` | anon SELECT active rows | OTP auth requires phone lookup |
| `points_ledger` | anon SELECT all | Check-in operations |
| `guest_lists` | anon SELECT + UPDATE all | Staff operations |
| `inv_counts` | anon ALL | Barback counting |
| `inv_stock_ups` | anon ALL | POS import |
| All portals | Client-side role checks | Requires server-side sessions (Phase D) |
| All portals | No session expiry | Requires Astro SSR + httpOnly cookies (Phase D) |
| All portals | No CSP | GitHub Pages cannot inject headers (Phase C) |

---

## Attack Surface Map (S65)

### Public Entry Points
| Page | Inputs | Writes To | Risk |
|---|---|---|---|
| `join.html` | Phone, name, DOB, email | `members`, `employee_enrollments` | Medium |
| `reserve.html` | Phone, party size, date | `table_bookings`, `reservations` | Low |
| `events.html` | Ticket purchase | `tickets` | Low (no payment yet) |
| `tbk.html` | qr_token URL param | Read-only lookup | Low |
| `license-sign.html` | token URL param, canvas signature | RPC `sign_agreement` | Medium |
| `contact.html` | 8 inquiry types, file upload | `inquiries` | Medium (no rate limit) |

### Portal Entry Points
| Portal | Auth | Key Type | DEV_MODE |
|---|---|---|---|
| Staff | Phone + OTP → verify-2fa Edge Function | sb_publishable | 🔴 true |
| Members | Phone + OTP → Supabase auth | eyJ (legacy) | 🔴 true |
| Owner | Google OAuth → signInWithIdToken | sb_publishable | n/a |
| Inventory | Phone + OTP or Google OAuth | sb_publishable | 🔴 true |

---

## Verify Queries — Run Before Any Policy Changes

```sql
-- Current anon policies on sensitive tables
-- AUDIT ONLY
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('inv_counts','inv_stock_ups','members','staff',
                  'points_ledger','guest_lists','inv_count_edits')
ORDER BY tablename, cmd;

-- Confirm RLS enabled on all tables
-- AUDIT ONLY
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Test anon access
-- AUDIT ONLY
SET ROLE anon;
SELECT COUNT(*) FROM members;
SELECT COUNT(*) FROM inv_counts;
SELECT COUNT(*) FROM inv_count_edits;
RESET ROLE;

-- Confirm sign_agreement RPC security
-- AUDIT ONLY
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_name = 'sign_agreement' AND routine_schema = 'public';
```

---

## Remediation Priority Order

**Before setting DEV_MODE = false (blocking):**
1. Fix CRIT-03 — staff prod path role loading (staff/index.html:458)
2. Fix CRIT-05 — inventory GSI script to `<head>` sync
3. Verify CRIT-02 — confirm key rotation state in Supabase Dashboard

**Set DEV_MODE = false in all three files simultaneously**

**After DEV_MODE = false:**
4. Fix HIGH-02 — inventory phone enumeration (1-line change)
5. Fix HIGH-03 — staff "Account deactivated" silent fail (2-line change)
6. HIGH-01 — OTP lockout (client-side 5-attempt limit minimum)
7. Add X-Frame-Options via Cloudflare Transform Rules
8. HIGH-04 — join.html silent redirect on duplicate

**Pre-real-staff-onboarding:**
9. Complete key rotation — update all legacy eyJ files
10. Pin Supabase JS to specific minor version
11. HIGH-06 — Supabase JS version pinning

---

## What Is Sound (Do Not Change)

- `authorized_by` excluded from ticket INSERT ✅
- `sign_agreement` via RPC — server-enforced token validation ✅
- Barback `assigned_bar` lock in inventory — confirmed in source ✅
- Google OAuth email check — OWNER_EMAILS double-verified (owner:984 + supabase session) ✅
- No service role key in any frontend file ✅
- No hardcoded passwords or SQL Server credentials ✅
- TBK redirect target is hardcoded `join.html` — no open redirect ✅
- vip_passes anon ALL removed S61 ✅
- table_bookings anon read scoped to qr_token S61 ✅
- Google Drive API key restricted to Picker API + 2 domains S65 ✅
- Dropbox SDK removed from owner portal S64 ✅

---

## Third-Party Script Inventory (S65)

| Script | Portal | Version | Risk |
|---|---|---|---|
| Supabase JS | All | `@2` unpinned | Medium |
| QRCode.js | owner, staff, tbk | `1.0.0` pinned | Low |
| html2canvas | staff (×2) | `1.4.1` pinned | Low |
| html5-qrcode | staff, inventory | `@2.3.8` pinned | Low |
| SheetJS | inventory | `0.18.5` pinned | Low |
| Google GSI | owner (head ✅), inventory (async defer ❌) | unversioned | Medium |
| Google APIs (picker) | owner | unversioned | Medium → restricted ✅ |

*Note: QRCode.js loaded twice in staff portal — harmless but unnecessary.*
*Note: Dropbox SDK removed S64. Dead `dropboxTarget` variable references remain — harmless.*
