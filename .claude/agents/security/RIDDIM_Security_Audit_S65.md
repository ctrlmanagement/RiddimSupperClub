# RIDDIM Members Club Platform
## Comprehensive Security Audit Report
**Session 65 · March 20, 2026 · AG Entertainment**
*Conducted against docs.zip (repo snapshot March 20–21, 2026)*
*Auditor role: Lead Cybersecurity Architect & Penetration Tester — OWASP Top 10 / Supabase RLS specialist*

---

## Executive Summary

| Dimension | Score | Notes |
|---|---|---|
| **Overall Risk Score** | **6.8 / 10** | Elevated from 6.1 (S61) due to new findings |
| Attack Surface | Large | 11 entry points, 6 CDN dependencies, 3 active portals |
| Authentication | Medium-High | DEV_MODE = true in **3 files**, no lockout on any portal |
| Authorization | Medium | Client-side role checks in inventory, prod staff path sets no role |
| Data Exposure | Medium | PII accessible via anon SELECT, key inconsistency |
| Third-Party Risk | Medium | Google API key exposed, Supabase JS unpinned |
| Infrastructure | Medium | GitHub Pages / Cloudflare — no WAF, no CSP |

### Critical Findings vs Prior Audit

The S61 audit identified DEV_MODE in staff/index.html only. **This audit confirms DEV_MODE = true in three files: staff, members, and inventory portals.** Additionally, six files use a legacy eyJ anon key format while four use the new sb_publishable format — confirming a partial key rotation that was never completed across the codebase.

### Risk Score Change: 6.1 → 6.8
- **Up:** DEV_MODE scope wider than known (+0.4), Google API key exposed (+0.2), inventory phone enumeration explicit (+0.1)
- **Down:** authorized_by constraint confirmed compliant (-0.1), sign_agreement via RPC is sound (-0.1), barback lock confirmed in source (-0.2)

---

## Critical Exposures — Immediate Action Required

### CRIT-01 — DEV_MODE = true in THREE portals
**Files:** `staff/index.html:222`, `members/index.html:147`, `inventory/index.html:501`
**OWASP:** A07:2021 Identification and Authentication Failures

Previously believed to affect only staff portal. **This audit confirms all three portals display the OTP code on screen.**

| Portal | DEV_MODE Line | Behavior |
|---|---|---|
| staff | 222 | OTP rendered in `devCodeInline` element — visible to any visitor |
| members | 147 | OTP rendered in top banner and `devCodeInlineValue` element |
| inventory | 501 | OTP rendered in `devCode` div — visible to any visitor |

All three portals also regenerate a new OTP on each Resend click (lines staff:472, members, inventory:623), giving an attacker unlimited attempts at a fresh code each time.

**Attack:** Navigate to any portal login → enter any registered phone → read 6-digit code from the DOM → gain full portal access. No phone ownership required.

**Verify before fixing:**
```sql
-- No DB verification needed — this is a source code fix only
-- Confirm DEV_MODE = false has not already been deployed:
-- Check live page source at portal.ctrlmanagement.com/staff/
-- portal.ctrlmanagement.com/members/
-- portal.ctrlmanagement.com/inventory/
```

**Fix (source only — no SQL needed):**
```javascript
// staff/index.html line 222
const DEV_MODE = false;

// members/index.html line 147
const DEV_MODE = false;

// inventory/index.html line 501
const DEV_MODE = false;
```

---

### CRIT-02 — Inconsistent Anon Key Format — Partial Rotation
**Files:** 6 files use legacy `eyJ` format, 4 use new `sb_publishable` format
**OWASP:** A02:2021 Cryptographic Failures

| Format | Files |
|---|---|
| Legacy `eyJ...` | `members/index.html`, `tbk.html`, `license-sign.html`, `reserve.html`, `events.html`, `contact.html` |
| New `sb_publishable_...` | `owner/index.html`, `staff/index.html`, `inventory/index.html`, `join.html` |

**I am uncertain whether both keys are currently active or whether the old key was revoked.** If both are active and pointing to the same Supabase project, this is a key management issue but not an immediate exploit. If the old key was supposed to be revoked after rotation but wasn't, every file using the legacy key is using a key that should no longer work — which means it wasn't actually revoked.

**Verify:**
```sql
-- AUDIT ONLY — run in Supabase SQL Editor
-- Check if both keys are JWT-signed with the same secret
-- (Cannot be done from SQL — must check Supabase Dashboard → Settings → API)
-- Verify: are both keys listed under "Project API Keys"?
-- If old eyJ key no longer appears → it was revoked → legacy files will fail silently
-- If both appear → rotation was never completed
```

**Action required:** Confirm in Supabase Dashboard → Settings → API whether the old `eyJ...` key is still active. If it is, complete the rotation by updating all 6 legacy files to use `sb_publishable_fQlHFhC7tPkZNRl1djnvcA_68LpKQpv`.

---

### CRIT-03 — Staff Prod Path Sets No Role on enterPortal()
**File:** `staff/index.html:458`
**OWASP:** A01:2021 Broken Access Control

In DEV_MODE, the staff portal loads the role from the `staff` table (line 436–444) and populates `currentStaff.role`. In the **production path** (DEV_MODE = false, verify-2fa Edge Function used), after a successful OTP verification:

```javascript
// staff/index.html:458 — PRODUCTION PATH
currentStaff = {name:'Staff Member', phone:loginPhone};
// role is MISSING — never set from DB
enterPortal();
```

`currentStaff.role` is undefined on portal entry. Later (line 920), tab gating reads `currentStaff?.role || ''` which returns empty string — all role-locked tabs would be unlocked. The SEAT_ALLOWED check at line 2807 would also fail silently.

**Note:** This does not affect functionality while DEV_MODE is true (the bug is hidden). The moment DEV_MODE is set to false, every staff member gets an undefined role and all role-based restrictions disappear.

**Verify:**
```sql
-- AUDIT ONLY — verify staff table has role column and data
SELECT id, first_name, phone, role, active
FROM staff
WHERE active = true
LIMIT 5;
```

**Fix (source only):**
```javascript
// staff/index.html — replace line 452–462 production verify block
try {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-2fa`, {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${SUPABASE_KEY}`},
    body:JSON.stringify({phone:loginPhone, code})
  });
  if (!res.ok) throw new Error();
  // Load role from DB after successful OTP — same as DEV_MODE path
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
} catch { showError('otpError','Incorrect code.'); clearOtp(); }
```

---

### CRIT-04 — Google Drive API Key Exposed in Owner Portal
**File:** `owner/index.html:2863`
**OWASP:** A02:2021 Cryptographic Failures

```javascript
const GALLERY_GOOGLE_API_KEY = 'AIzaSyCrp5mYEWpja1os-bt-eDWmBvNRv-D3Oyk';
```

Google API keys are not the same as Supabase anon keys — they can be restricted by domain and API scope in Google Cloud Console, or they can be unrestricted. An unrestricted key allows any caller to make billable API calls (Drive, Maps, YouTube, etc.) against the AG Entertainment Google Cloud project.

**I cannot determine the key's restriction scope from source code alone.** Must verify in Google Cloud Console.

**Verify in Google Cloud Console:**
1. Navigate to APIs & Services → Credentials
2. Find `AIzaSyCrp5mYEWpja1os-bt-eDWmBvNRv-D3Oyk`
3. Check: Application restrictions (HTTP referrers ideally) and API restrictions (should be limited to Google Picker API / Drive API only)

**If unrestricted:** Immediate risk of API quota exhaustion or billing attack. Restrict to:
- HTTP referrer: `portal.ctrlmanagement.com/*`
- API scope: Google Picker API only

---

### CRIT-05 — Inventory Portal GSI Script Still Has async defer
**File:** `inventory/index.html:495`
**OWASP:** A07:2021

```html
<!-- inventory/index.html line 495 — AFTER </head> -->
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

Permanent constraint 275 (established S64) states: *"Google GSI script must be synchronous in `<head>`, never async defer."* This was fixed in `owner/index.html` during S64 but **was not applied to `inventory/index.html`.**

The inventory portal uses a different Google auth flow (popup-based via `startGoogleLogin()`) rather than the GSI button. With `async defer`, clicking the Google Sign-in button before the script loads produces no error or feedback — the button appears to do nothing, silently failing.

**Verify:**
```
// No SQL needed — confirm in live page source:
// View source of portal.ctrlmanagement.com/inventory/
// Search for "gsi/client" — confirm async defer is present
```

**Fix:**
```html
<!-- Move to <head>, remove async defer -->
<head>
  <script src="https://accounts.google.com/gsi/client"></script>
  <!-- other head content -->
</head>
```

---

## High Severity Findings

### HIGH-01 — No OTP Lockout on Any Portal
**Files:** `staff/index.html`, `members/index.html`, `inventory/index.html`
**OWASP:** A07:2021

Zero brute-force protection was confirmed across all three portals:
- No `localStorage` lockout tracking
- No `failed_attempts` counter
- No cooldown after incorrect OTP
- No server-side rate limiting (Edge Functions not visible in source — uncertain whether they implement limits)
- The 30-second resend timer only gates resending, not verification attempts

With DEV_MODE = true (current state), the OTP is on screen so this is moot. Once DEV_MODE = false, an attacker can attempt all 1,000,000 six-digit combinations against any known staff or member phone number.

**Verify — current lockout state on Edge Function:**
```
// AUDIT ONLY — cannot determine from source code alone
// Must inspect: Supabase Edge Functions → verify-2fa source
// Check whether it tracks attempts or applies rate limiting
// If send-2fa / verify-2fa do not implement lockout → HIGH risk
```

**Minimum fix (client-side while waiting for server-side):**
```javascript
// In verifyCode() — add attempt counter
let otpAttempts = 0;
async function verifyCode() {
  // ...existing code...
  if (code !== devOtpCode || !res.ok) {
    otpAttempts++;
    if (otpAttempts >= 5) {
      showError('otpError', 'Too many attempts. Please request a new code.');
      clearOtp();
      goScreen('screenLogin');
      otpAttempts = 0;
      return;
    }
    // ...existing error handling...
  }
}
```

---

### HIGH-02 — Inventory Portal Explicit Phone Enumeration
**File:** `inventory/index.html:559`
**OWASP:** A07:2021

```javascript
// inventory/index.html line 559
if (!staff) {
  document.getElementById('loginError').textContent =
    'Phone number not registered for inventory access.';
```

This directly confirms to an attacker whether a phone number is registered in `inv_staff`. Unlike the staff portal (which silently fails on unregistered numbers — a good pattern), the inventory portal explicitly announces that the number is not in the system.

Contrast with staff portal (lines 369–372) which correctly silently fails:
```javascript
if (error || !data) {
  btn.disabled = false; btn.textContent = 'Send Code';
  return; // No error shown
}
```

**Fix:** Change inventory error to a neutral message:
```javascript
// inventory/index.html — replace line 559
document.getElementById('loginError').textContent = 'Could not send code. Please try again.';
```

---

### HIGH-03 — Staff "Account Deactivated" Confirms Registration
**File:** `staff/index.html:375`
**OWASP:** A07:2021

```javascript
if (!data.active) {
  showError('loginError', 'Account deactivated. Contact your manager.');
```

A deactivated account is still in the staff table. This message confirms: (1) the phone number is registered, (2) the account exists but is deactivated. Combined with HIGH-02, an attacker can enumerate which numbers are active vs deactivated.

**Fix:** Replace with the same neutral silent fail:
```javascript
// staff/index.html — replace lines 374–378
if (!data.active) {
  btn.disabled = false; btn.textContent = 'Send Code';
  return; // Silent fail — no different behavior from unregistered
}
```

---

### HIGH-04 — join.html Phone Enumeration via Duplicate Check
**File:** `join.html:1292`
**OWASP:** A07:2021

```javascript
alert('A membership already exists for this phone number. Visit the Members portal to log in.');
```

This confirms that a given phone number is a registered member. Public-facing page, no auth required to test any phone number.

**Impact:** Lower than staff/inventory enumeration since the members table RLS already exposes all member phones via anon SELECT. But it adds a convenient enumeration interface.

**Fix:** Redirect silently to members portal:
```javascript
// join.html — replace alert with silent redirect
window.location.href = 'members/index.html';
```

---

### HIGH-05 — No Session Expiry on Any Portal
**Files:** All portals
**OWASP:** A07:2021

No session expiry was found in any portal. Sessions live as JavaScript variables in memory — they expire only when the browser tab is closed. No timeout, no idle check, no server-side revocation.

A staff member who leaves a device unattended with the portal open has an indefinitely active session. This is especially risky given that the staff portal grants check-in privileges, table booking management, and guest list modification.

**This is an accepted pilot risk (Phase D) per the security roadmap.** Logging it here as HIGH to ensure it's tracked.

**Minimum fix (client-side):**
```javascript
// Add to all portals — session timeout after 8 hours
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const SESSION_START = Date.now();
setInterval(() => {
  if (Date.now() - SESSION_START > SESSION_TIMEOUT_MS) {
    logout(); // call existing logout function
  }
}, 60000); // check every minute
```

---

### HIGH-06 — Supabase JS SDK Unpinned (@2 major only)
**Files:** All portals
**OWASP:** A06:2021 Vulnerable and Outdated Components

All portals load `@supabase/supabase-js@2` without pinning to a specific minor version. A breaking security fix or supply chain compromise in any `@2.x.x` release automatically propagates to all users on next page load.

**Exception found:** `reserve.html` loads from a different CDN path:
```html
https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js
```
All other portals use the bare `@2` which resolves to latest minor. This inconsistency should be standardized.

**Fix:** Pin to a specific version after verifying current behavior:
```html
<!-- Replace all instances of @2 with current verified version -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.x.x"></script>
```

---

## Medium Severity Findings

### MED-01 — No Contact Form Rate Limiting
**File:** `contact.html`
**OWASP:** A05:2021

The contact form has button-disable after submit (3 refs to disabled) but no rate limiting, no CAPTCHA, and no server-side throttle. An attacker can spam the `inquiries` table with automated form submissions. The `anon can submit inquiry` policy allows unlimited anonymous INSERTs.

**Verify current policy:**
```sql
-- AUDIT ONLY
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'inquiries' AND roles @> '{anon}';
```

---

### MED-02 — inv_counts Writable by Anon Without Session Validation
**Tables:** `inv_counts`, `inv_stock_ups`
**OWASP:** A01:2021

Both tables have `anon ALL` policies (confirmed S61). The inventory portal requires OTP auth before showing the count UI, but the Supabase REST API for these tables accepts anonymous writes with no session_id validation.

An attacker with the anon key can INSERT fabricated count records directly to `inv_counts` with any `session_id`, `product_id`, and `quantity`, bypassing the portal entirely.

**Verify:**
```sql
-- AUDIT ONLY
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('inv_counts', 'inv_stock_ups') AND roles @> '{anon}';
```

**Accepted pilot risk per security roadmap** — RLS cannot be scoped without proper staff sessions (Phase D). Log and track.

---

### MED-03 — license-sign.html Uses Old eyJ Key
**File:** `license-sign.html:251`
**OWASP:** A02:2021

The license signing page uses the legacy key format. The RPC call `sign_agreement` runs server-side and does its own token validation, so the risk is lower here. But if the key format rotation is ever completed and the old key revoked, `license-sign.html` will silently fail to load agreements.

---

### MED-04 — Google Client ID Exposed (Multiple Portals)
**Files:** `owner/index.html:917`, `inventory/index.html:499`
**OWASP:** A02:2021

```
46572233442-7ppaitpmvnm0vvmj6uqk0683rsocka9a.apps.googleusercontent.com
```

Google OAuth Client IDs are intentionally public-facing — they are required to be in frontend code. **This is not a vulnerability in itself.** However, the OAuth client must be configured in Google Cloud Console with:
- Authorized JavaScript origins: `https://portal.ctrlmanagement.com` only
- Authorized redirect URIs: specific paths only

**Verify in Google Cloud Console** that no wildcard origins or unintended redirect URIs are configured. If correctly restricted, this is informational only.

---

### MED-05 — html2canvas Loaded Twice in Staff Portal
**File:** `staff/index.html`
**OWASP:** A06:2021

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<!-- appears twice in staff portal -->
```

QRCode.js is loaded twice. html2canvas is loaded once. Duplicate script loading is unnecessary attack surface and page weight.

---

### MED-06 — No X-Frame-Options / Clickjacking Protection
**Files:** All portals
**OWASP:** A05:2021

No `X-Frame-Options` or `frame-ancestors` CSP directive exists anywhere. All portals can be embedded in iframes. This enables clickjacking attacks where a malicious site overlays the portal in a transparent iframe, tricking users into interacting with portal UI.

Can be addressed via Cloudflare Transform Rules without code changes:
```
Rule: Add response header X-Frame-Options: DENY
Match: All pages on portal.ctrlmanagement.com
```

---

## Audit Findings Table

| ID | Severity | File | Line | Issue | OWASP |
|---|---|---|---|---|---|
| CRIT-01 | 🔴 Critical | staff/index.html | 222 | DEV_MODE = true | A07 |
| CRIT-01 | 🔴 Critical | members/index.html | 147 | DEV_MODE = true | A07 |
| CRIT-01 | 🔴 Critical | inventory/index.html | 501 | DEV_MODE = true | A07 |
| CRIT-02 | 🔴 Critical | 6 files | multiple | Inconsistent/partial key rotation | A02 |
| CRIT-03 | 🔴 Critical | staff/index.html | 458 | Prod path sets no role on enterPortal() | A01 |
| CRIT-04 | 🔴 Critical | owner/index.html | 2863 | Google Drive API key exposed | A02 |
| CRIT-05 | 🔴 Critical | inventory/index.html | 495 | GSI script async defer (auth race) | A07 |
| HIGH-01 | 🟠 High | staff, members, inventory | — | No OTP lockout on any portal | A07 |
| HIGH-02 | 🟠 High | inventory/index.html | 559 | Explicit phone enumeration | A07 |
| HIGH-03 | 🟠 High | staff/index.html | 375 | "Account deactivated" confirms registration | A07 |
| HIGH-04 | 🟠 High | join.html | 1292 | Phone enumeration via dupe check | A07 |
| HIGH-05 | 🟠 High | All portals | — | No session expiry (Phase D) | A07 |
| HIGH-06 | 🟠 High | All portals | — | Supabase JS @2 unpinned | A06 |
| MED-01 | 🟡 Medium | contact.html | — | No form rate limiting | A05 |
| MED-02 | 🟡 Medium | inv_counts, inv_stock_ups | — | anon ALL — no session validation | A01 |
| MED-03 | 🟡 Medium | license-sign.html | 251 | Legacy key format | A02 |
| MED-04 | 🟡 Medium | owner, inventory | 917, 499 | Google Client ID exposed (verify scope) | A02 |
| MED-05 | 🟡 Medium | staff/index.html | — | QRCode.js loaded twice | A06 |
| MED-06 | 🟡 Medium | All portals | — | No X-Frame-Options | A05 |
| INFO-01 | ℹ️ Info | All portals | — | No CSP headers (Phase C — Astro) | A05 |
| INFO-02 | ℹ️ Info | members, staff | — | anon SELECT on members/staff tables | A01 |
| INFO-03 | ℹ️ Info | owner/index.html | 983 | OWNER_EMAILS client-side (secondary check) | A01 |

---

## Permanent Constraint Compliance Verification

| Constraint | Status | Evidence |
|---|---|---|
| Never send `authorized_by` in tickets INSERT | ✅ COMPLIANT | events.html:1778 — comment + payload excludes it. RLS enforces it. |
| Never JOIN events via FK on table_bookings/tickets | ✅ COMPLIANT | No FK joins found in scan |
| Members portal + tbk.html use eyJ anon key | ✅ COMPLIANT | Both use legacy key (per constraint) |
| Never send `valid_date` or `booking_type` in table_bookings | ✅ COMPLIANT | No instances in reserve.html writes |
| Phone lookup uses .ilike() not .eq() | ⚠️ UNCERTAIN | Not verified in all write paths — recommend targeted scan |
| SMS via window.open('sms:') only | ✅ COMPLIANT | 6 confirmed instances, no Edge Function SMS found |
| BAR_CONFIG is only location source | ✅ COMPLIANT | Both inv files use it |
| Google GSI script in `<head>` synchronous | 🔴 VIOLATED | inventory/index.html:495 — still async defer |
| inv_count_edits never deleted | ✅ COMPLIANT | No DELETE on inv_count_edits found in source |
| hssa credentials never in repo/frontend | ✅ COMPLIANT | No SQL Server credentials in any file |

---

## Accepted Risk Register

Items that cannot be fixed without Phase D architectural changes (staff authenticated sessions):

| ID | Table | Exposure | Reason Cannot Fix Now | Phase |
|---|---|---|---|---|
| AR-01 | members | anon SELECT all rows (names + phones) | Staff check-in requires member lookup via anon key | D |
| AR-02 | staff | anon SELECT all active rows | OTP auth requires phone lookup via anon key | D |
| AR-03 | points_ledger | anon SELECT all transactions | Check-in writes + reads points | D |
| AR-04 | guest_lists | anon SELECT + UPDATE all rows | Staff guest list operations | D |
| AR-05 | inv_counts | anon ALL | Barback counting operations | D |
| AR-06 | inv_stock_ups | anon ALL | POS import operations | D |
| AR-07 | All portals | No session expiry | Requires server-side sessions (Astro SSR) | D |
| AR-08 | All portals | Client-side role checks | Requires server-side session tokens | D |
| AR-09 | All portals | No CSP headers | GitHub Pages has no header injection capability | C |
| AR-10 | All portals | No server-side lockout | Edge Function source not in scope — verify separately | D |

---

## Remediation Priority Queue

### Do Before Setting DEV_MODE = false (blocking)

1. **Fix CRIT-03** — staff prod path role loading (staff/index.html:458)
2. **Fix CRIT-05** — inventory GSI script to `<head>` sync
3. **Verify CRIT-02** — confirm both keys active or old key already revoked

### Set DEV_MODE = false in all three files simultaneously
Do not set it in one file and not others — inconsistent state is harder to reason about.

### Do Within This Week

4. **Fix CRIT-04** — restrict Google Drive API key in Google Cloud Console
5. **Fix HIGH-02** — inventory phone enumeration (1-line change)
6. **Fix HIGH-03** — staff "Account deactivated" silent fail (2-line change)
7. **Add X-Frame-Options via Cloudflare** (no code change needed)
8. **Verify Google OAuth client restrictions** in Google Cloud Console

### Do Before Real Staff Onboarding

9. **HIGH-01** — OTP lockout (client-side minimum, Edge Function ideal)
10. **HIGH-04** — join.html silent redirect on duplicate phone
11. **Complete key rotation** — update all 6 legacy eyJ files to sb_publishable format
12. **HIGH-06** — pin Supabase JS to specific minor version

---

## Verify Queries — Run Before Any Policy Changes

*All queries below are AUDIT ONLY until live state is confirmed.*

**Confirm current policies on sensitive tables:**
```sql
-- AUDIT ONLY
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('inv_counts','inv_stock_ups','members','staff','points_ledger','guest_lists')
ORDER BY tablename, cmd;
```

**Confirm inv_count_edits RLS is enabled:**
```sql
-- AUDIT ONLY
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'inv_count_edits';
```

**Confirm no service role key in use (anon-only verification):**
```sql
-- AUDIT ONLY
-- Run this as anon to confirm what anon can actually do:
SET ROLE anon;
SELECT COUNT(*) FROM members;
SELECT COUNT(*) FROM inv_counts;
SELECT COUNT(*) FROM inv_count_edits;
RESET ROLE;
```

**Confirm sign_agreement RPC exists and has proper security:**
```sql
-- AUDIT ONLY
SELECT routine_name, security_type, routine_definition
FROM information_schema.routines
WHERE routine_name = 'sign_agreement'
AND routine_schema = 'public';
```

---

## What Is Sound — Items Not Requiring Action

| Item | Assessment |
|---|---|
| `authorized_by` never sent in ticket INSERT | ✅ Correctly excluded + RLS enforced |
| `sign_agreement` via RPC (server-side) | ✅ Token validation is server-enforced, not client |
| Barback `assigned_bar` lock in inventory | ✅ Confirmed in source — setLocation() blocked for key_barback |
| `vip_passes` anon ALL removed (S61) | ✅ Confirmed no anon ALL policy in source comments |
| `table_bookings` anon read scoped to qr_token | ✅ Confirmed in codebase |
| No hardcoded passwords or SQL Server credentials | ✅ Scan clean |
| No service role key usage | ✅ Scan clean — anon key only in all files |
| Google OAuth email check on owner portal | ✅ Double-checked both in supabase session + OWNER_EMAILS array |
| No open redirects in TBK flow | ✅ Redirect target is hardcoded `join.html` — not user-supplied |
| DEV_MODE members portal uses Supabase OTP fallback | ✅ Phone registered → OTP → anon session |

---

*RIDDIM Members Club Platform — Security Audit S65 · March 20, 2026*
*All SQL blocks marked AUDIT ONLY — verify live state before executing any changes.*
*DEV_MODE = true in 3 files remains the most critical outstanding item.*
