# Vulnerability Assessment Report
## AG Entertainment — RIDDIM Members Club Platform
**Assessment Type:** Architectural Security Review & Static Code Analysis  
**Auditor Role:** Lead Cybersecurity Architect / Penetration Tester  
**Date:** March 19, 2026  
**Codebase Session:** S60 EOD (v68 context)  
**Files Reviewed:** All HTML/JS in docs.zip — 17 files across public site, members, staff, owner, and inventory portals

---

## Executive Summary

| Dimension | Rating |
|---|---|
| **Overall Pre-Launch Risk Score** | 🔴 HIGH (7.4 / 10) |
| **Critical Findings (patch before go-live)** | 4 |
| **High Findings** | 5 |
| **Medium Findings** | 6 |
| **Low / Informational** | 4 |

The platform has a well-designed authentication architecture and correctly applies the anon JWT constraint on the two highest-risk pages (members portal and TBK scanner). However, several significant gaps exist: DEV_MODE is active in production-committed files, the wrong Supabase key type is used across multiple files, hidden keyboard shortcuts expose internal portal URLs on public pages, and lockout tracking remains in localStorage. None of these are catastrophic in isolation — the Supabase anon key is not a secret and RLS is the true enforcement layer — but in combination, particularly before RLS is fully deployed across all tables, they represent meaningful pre-launch risk.

**The single most urgent issue is that DEV_MODE = true is committed to staff, members, and inventory portals.** This displays live OTP codes on-screen in production, bypassing the entire authentication model.

---

## 1. Attack Surface Map

| Entry Point | File | Auth Required | Key Type | Notes |
|---|---|---|---|---|
| Public homepage | `index.html` | None | None | Contains Shift+S/O shortcuts |
| Events page | `events.html` | None | eyJ anon JWT | DB-driven — ticket purchase flow |
| Reservation form | `reserve.html` | None | eyJ anon JWT | Writes to table_bookings |
| Contact / inquiry | `contact.html` | None | eyJ anon JWT | Queries 5 tables on phone blur |
| VIP pass page | `vip.html` | Token in URL | sb_publishable | Token-gated but no expiry |
| License signing | `license-sign.html` | Token in URL | sb_publishable | Sensitive legal flow |
| Join / signup | `join.html` | None | sb_publishable | ⚠️ Should be eyJ |
| Members portal | `members/index.html` | Phone + OTP | eyJ anon JWT ✅ | Correct key |
| Staff portal | `staff/index.html` | Phone + OTP | sb_publishable | DEV_MODE = true |
| Owner portal | `owner/index.html` | Google OAuth | sb_publishable | Full data access |
| Inventory portal | `inventory/index.html` | Phone+OTP / OAuth | sb_publishable | DEV_MODE = true |
| TBK scanner | `tbk.html` | None (token) | eyJ anon JWT ✅ | Correct key |
| Gallery (public) | `gallery.html` | None | sb_publishable | Signed URL access |
| Private events form | `private-events.html` | None | sb_publishable | Writes inquiries |

---

## 2. Critical Exposures

### CRIT-01 — DEV_MODE Active in Production Files
**Severity:** 🔴 CRITICAL  
**Files:** `staff/index.html` (line 222), `members/index.html` (line 147), `inventory/index.html` (line 501)  
**CVSS Analog:** 9.1 (Authentication Bypass)

**Finding:** All three portals have `const DEV_MODE = true` committed to the codebase. When true:
- A 6-digit OTP code is generated client-side and displayed on-screen in a visible `devCodeVal` element
- The code is generated with `Math.random()` (not server-issued) meaning it never touches Twilio or any edge function
- Any visitor to `/staff/`, `/members/`, or `/inventory/` can enter any phone number and immediately see and use the OTP without owning that phone

**Impact:** Complete authentication bypass on all three portals. An attacker can log in as any staff member (if they know or enumerate a valid phone number) and access all member PII, check-in data, inventory data, and scheduling.

**Remediation:**
```javascript
// Set false before any production deploy
const DEV_MODE = false;
```
Add a CI check or pre-commit hook that blocks `DEV_MODE = true` from merging to main.

---

### CRIT-02 — join.html Uses Wrong Supabase Key Type
**Severity:** 🔴 CRITICAL  
**File:** `join.html` (line 1286)  
**CVSS Analog:** 7.5 (Insufficient Access Control)

**Finding:** `join.html` uses `sb_publishable_fQlHFhC7tPkZNRl1djnvcA_68LpKQpv` instead of the anon JWT. This page handles post-signup member creation and links `tbk_token` / `ticket_token` to newly created member records. The permanent constraint documented in the security roadmap explicitly requires `members portal and tbk.html must use the eyJ anon JWT key`.

**Impact:** Depending on Supabase's treatment of the `sb_publishable` key vs the anon JWT in RLS policy evaluation, this could result in different (potentially broader) data access than intended. If `sb_publishable` resolves to a different role than `anon`, any RLS policies written for `anon` may not apply. Additionally, mismatched key types make RLS reasoning harder during audits.

**Remediation:** Replace `sb_publishable_fQlHFhC7tPkZNRl1djnvcA_68LpKQpv` with the eyJ anon JWT on line 1286 of `join.html`. Verify same fix needed on any page where public users create or link member records.

---

### CRIT-03 — contact.html Uses `.eq()` for Phone Lookup (Permanent Constraint Violation)
**Severity:** 🔴 CRITICAL  
**File:** `contact.html` (line 1829)  
**CVSS Analog:** 7.3 (Inconsistent Access Control / Logic Flaw)

**Finding:** The guest lookup on the contact form queries the `members` table using:
```
/rest/v1/members?phone=eq.%2B14045551234
```
The documented permanent constraint (Security Roadmap, permanent constraints section) explicitly states: **"Phone lookup must use `.ilike('phone', '%<10digits>%')` not `.eq()`."** This same file also queries `reservations`, `vip_passes`, `guest_lists`, and `inquiries` using `eq.` against raw phone values.

**Impact:** Phone number format inconsistencies (E.164 vs 10-digit vs stored format variation) mean members who exist in the database will not be found, leading to duplicate accounts, failed lookup, and guest record fragmentation. In a security context, this creates a false negative — a member presents at the venue but the system reports them as unknown, triggering unnecessary manual verification flows that can be socially engineered.

**Remediation:** Replace all `phone=eq.` calls in `contact.html` with `.ilike('phone', '%${phone10}%')` per the established pattern.

---

### CRIT-04 — RLS Not Verified on 15+ Tables Before Staff Onboarding
**Severity:** 🔴 CRITICAL  
**Files:** Supabase project `cbvryfgrqzdvbqigyrgh` (not file-level — DB state)  
**CVSS Analog:** 8.5 (Missing Authorization)

**Finding:** Per the security checklist, the following tables do not have confirmed RLS enabled:
- `members`, `staff`, `guest_lists`, `reservations`, `points_ledger`
- `table_bookings`, `vip_passes`, `employee_enrollments`
- `galleries`, `gallery_photos`, `schedules`, `time_off_requests`
- `inv_products`, `inv_counts`, `inv_sessions`, `inv_stock_ups`, `inv_par_levels`
- `inv_cost_periods`, `inv_cost_lines`, `inv_sales_entries`

The anon key is visible in browser source across all pages. Without RLS, any visitor who reads the source can directly query these tables via the REST API using the exposed anon key and project URL.

**Impact:** Full database read access to all member PII (name, phone, email, tier, points), all booking records, all staff schedules, all inventory cost data — for any internet user. This is the highest-consequence open issue on the platform.

**Remediation:** Run the RLS verification query before any real staff or member onboarding:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```
Enable RLS on every table that returns `false`. Write policies appropriate to each access pattern.

---

## 3. High Severity Findings

### HIGH-01 — Hidden Keyboard Shortcuts Expose Portal URLs on Public Pages
**Severity:** 🟠 HIGH  
**Files:** `index.html`, `contact.html`, `reserve.html`, `join.html`, `menu.html`

**Finding:** Five public-facing pages contain:
```javascript
// SECRET PORTAL ACCESS — Shift+S: Staff · Shift+O: Owner
if (e.shiftKey && e.key === 'S') window.location.href = STAFF_URL;
if (e.shiftKey && e.key === 'O') window.location.href = OWNER_URL;
```
While the JavaScript is minified somewhat, the comment `SECRET PORTAL ACCESS` is visible in plaintext in the source of `reserve.html` line 1693. Any developer tools inspection or "View Source" immediately reveals both shortcut keys and the portal URLs.

**Impact:** Low direct security risk since both portals require authentication, but it directly undermines the obscurity model, negates the value of `noindex` and `robots.txt` restrictions, and trains staff to use keyboard shortcuts in public settings where shoulder-surfing is possible.

**Remediation:** Remove all `Shift+S/O` shortcuts from public pages before go-live. Internal navigation to portals should occur via bookmarks or direct URL entry — not keyboard shortcuts embedded in public HTML.

---

### HIGH-02 — Lockout Tracking in localStorage (Not Supabase)
**Severity:** 🟠 HIGH  
**Files:** `members/index.html`, `staff/index.html`

**Finding:** Failed OTP attempt counting is stored in browser `localStorage` (`riddim_member` key confirmed in members portal). localStorage is per-browser and per-origin, meaning:
- An attacker can clear localStorage between attempts, resetting the lockout counter
- Lockout does not persist across devices or browsers
- An attacker using incognito mode starts with a clean counter on every session

**Impact:** Brute-force protection is effectively disabled for anyone willing to use private browsing or clear storage. The 6-digit OTP space (1,000,000 combinations) with no server-side rate limiting is brute-forceable in a targeted attack.

**Remediation:** Move lockout tracking to a `failed_otp_attempts` column (or dedicated table) in Supabase, keyed by phone number. Enforce server-side in the `verify-2fa` edge function. Already on the pre-launch checklist — treat as blocking before real staff onboard.

---

### HIGH-03 — Edge Functions Not Locked to Authenticated Requests
**Severity:** 🟠 HIGH  
**Files:** `members/index.html` (lines 287, 360), `staff/index.html` (lines 388, 453)

**Finding:** Both `send-2fa` and `verify-2fa` edge functions are called with only the anon key in the Authorization header. No user session token, no rate-limit key beyond what the function itself implements. The functions are publicly accessible endpoints.

**Impact:** Without authentication requirements on the edge functions, any actor with the Supabase project URL and anon key (both visible in page source) can call `send-2fa` to trigger OTP SMS delivery to arbitrary phone numbers — this is an SMS bombing / phone enumeration vector. They can also call `verify-2fa` with guessed codes in a scripted loop.

**Remediation:** Add rate limiting at the edge function level (per phone, per IP). Lock the functions to require a valid session or signed request. Already on the security checklist.

---

### HIGH-04 — Member ID Exposed in QR URL Query Parameter
**Severity:** 🟠 HIGH  
**File:** `owner/index.html` (line 1402)

**Finding:**
```javascript
const qrUrl = `${window.location.origin}/members/index.html?member=${m.id}`;
```
Member QR codes encode the raw internal member ID (a TEXT identifier) as a plain URL query parameter. These QR codes appear on printed cards, digital wallet passes, and shared screens.

**Impact:** Any person who scans or photographs a member QR code can extract the member ID and use it to query the members portal for associated data. If RLS on the `members` table is not correctly restricted (see CRIT-04), this becomes a direct data extraction path. Even with correct RLS, exposing internal database IDs as QR payload is poor practice — it enables enumeration and correlates scan events to identifiable individuals.

**Remediation:** Replace the raw member ID in QR payloads with the opaque `qr_token` field (already used for TBK and ticket QRs). The members portal should look up by `qr_token`, not by `member=id`.

---

### HIGH-05 — .DS_Store Files Committed to Repository (Filesystem Metadata Leakage)
**Severity:** 🟠 HIGH  
**Files:** `docs/.DS_Store`, `docs/owner/.DS_Store`, `docs/members/.DS_Store`

**Finding:** macOS `.DS_Store` files are committed and deployed to GitHub Pages in three directories. These binary files contain directory listings, including names of files that may not be publicly linked or visible — subfolders, filenames, and sometimes recently accessed file metadata from the developer's local machine.

**Impact:** An attacker who fetches `https://portal.ctrlmanagement.com/.DS_Store` can parse it to enumerate filenames the developer has worked with locally, potentially revealing unpublished page names, internal naming conventions, or development artifacts. Tools like `ds_store_exp` automate this extraction.

**Remediation:**
```bash
# Add to .gitignore immediately
echo ".DS_Store" >> .gitignore
# Remove from git tracking
git rm -r --cached **/.DS_Store
git commit -m "Remove .DS_Store files"
```
A `.gitignore` file is already noted as missing in the context briefing — this is the same ticket.

---

## 4. Medium Severity Findings

### MED-01 — DEV_MODE OTP Uses Math.random() (Not Cryptographically Secure)
**Severity:** 🟡 MEDIUM  
**Files:** `inventory/index.html` (line 623)

Even in dev/test use, `Math.random()` for OTP generation is not cryptographically secure. The V8 engine's PRNG is predictable given enough outputs. The production edge function presumably generates proper OTPs, but if DEV_MODE logic ever leaks into a staging environment visible externally, the OTPs are predictable.

**Remediation:** Use `crypto.getRandomValues()` for any client-side OTP generation. Better: remove DEV_MODE entirely and use a test phone number allowlist in the edge function.

---

### MED-02 — Google OAuth Token in URL Fragment (Inventory + Owner Portals)
**Severity:** 🟡 MEDIUM  
**Files:** `inventory/index.html` (line 649–650), `owner/index.html` (lines 950–954)

Both portals use implicit flow (`response_type: 'token id_token'`), which returns the `id_token` in the URL hash fragment of the popup window. The code reads it via `popup.location.hash`. While the fragment isn't sent to the server, it can be read by browser history, referrer headers if the popup navigates, or any JavaScript running in the popup context.

**Remediation:** Migrate to PKCE authorization code flow (`response_type: code`) for Google OAuth. This is the current Google-recommended approach and eliminates token exposure in URL fragments.

---

### MED-03 — License Agreement Token in URL (No Expiry Enforced)
**Severity:** 🟡 MEDIUM  
**File:** `license-sign.html` (lines 260–273)

License agreement signing links use a `?token=` URL parameter. The code checks for `voided` status but there is no expiry timestamp enforced client-side or evidenced in the schema (`license_agreements` has no `expires_at` column per the context briefing). A signing link emailed or texted to a recipient remains valid indefinitely.

**Impact:** If a signing link is intercepted, forwarded, or shared, anyone with the URL can view and sign the full legal agreement on behalf of the intended recipient with no time window protection.

**Remediation:** Add `expires_at TIMESTAMPTZ` to `license_agreements`. Reject tokens where `expires_at < now()`. Suggested TTL: 30 days (already flagged as an open question in the briefing).

---

### MED-04 — Members Table ID is TEXT, Not UUID (Enumeration Risk)
**Severity:** 🟡 MEDIUM  
**Files:** Supabase schema (`members.id TEXT`)

The `members.id` field is a TEXT type, not a UUID. If IDs are sequential or short (e.g., `M001`, `M002`), they are trivially enumerable. Combined with the QR URL exposure (HIGH-04), an attacker could iterate member IDs to extract profile data if RLS policies are not airtight.

**Remediation:** Migrate `members.id` to UUID (already on pre-launch checklist). Until migration, verify the ID format is not sequential or guessable.

---

### MED-05 — Phone Enumeration via Contact Form (5 Tables Queried)
**Severity:** 🟡 MEDIUM  
**File:** `contact.html` (lines 1829–1864)

The contact form's phone blur handler fires up to 5 sequential Supabase REST queries (members, reservations, vip_passes, guest_lists, inquiries) using the anon key. The response — even without rendering PII — reveals whether a phone number exists in each table. Different UI states (member found vs. not found) confirm or deny a phone number's presence in the system.

**Impact:** A scripted attacker can enumerate which phone numbers belong to members, have bookings, or appear on VIP lists — without any authentication. Phone enumeration protection is already on the pre-launch checklist.

**Remediation:** Move the lookup logic server-side (edge function). Return only a pass/fail boolean, not individual table results. Rate-limit the endpoint by IP.

---

### MED-06 — robots.txt Discloses Portal Path Structure
**Severity:** 🟡 MEDIUM (Informational/Low boundary)  
**File:** `robots.txt`

```
Disallow: /staff/
Disallow: /owner/
```

While `robots.txt` is the correct mechanism to prevent search engine indexing, it is a public file and explicitly discloses that `/staff/` and `/owner/` are sensitive internal paths. This is widely understood but worth noting: obscurity via `robots.txt` disallowance is not access control.

**Remediation:** Already mitigated by auth requirements on both portals. Future Phase C hardening (Cloudflare Access) will add real network-level protection. No immediate code change required; note for post-migration security review.

---

## 5. Low / Informational Findings

### LOW-01 — Ticket Prices Anon SELECT Policy (Correct — Monitor)
**Severity:** ℹ️ INFORMATIONAL  
**Finding:** `ticket_prices` allows `anon` SELECT, which exposes tier pricing to the public. This is intentional (events.html reads it to display ticket prices) and was verified correct in S60. Monitor: if pricing strategy becomes sensitive, move to authenticated read.

---

### LOW-02 — MAC Address Stored in Employee Records
**Severity:** ℹ️ LOW  
**File:** `owner/index.html` (employee add modal)  
**Finding:** WiFi MAC addresses are collected and stored in the `employee_enrollments` table for clock-in purposes. MAC addresses are PII under GDPR and CCPA. Ensure the data handling policy covers this. MAC addresses can also be spoofed, making clock-in verification via MAC alone weak.

---

### LOW-03 — No Content Security Policy (CSP) Headers
**Severity:** ℹ️ LOW  
**Finding:** No CSP headers are set on any page (would require server-side control or Cloudflare transform rules). External scripts are loaded from `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, and `fonts.googleapis.com`. A permissive script-src could enable XSS if any inline script injection were possible. Phase C hardening includes CSP — prioritize before Astro migration.

---

### LOW-04 — Gallery Signed URLs (Private Bucket — Verify TTL)
**Severity:** ℹ️ LOW  
**File:** `gallery.html`, `owner/index.html`  
**Finding:** Private gallery photos use Supabase Storage signed URLs. Verify the TTL on signed URLs is appropriately short (recommended: ≤1 hour). If long-lived or infinite signed URLs are generated and those URLs are bookmarked or cached, photos remain accessible after a member's access should have expired.

---

## 6. Strategic Recommendations

### Immediate (Before Any Real User Onboarding)

| Priority | Action |
|---|---|
| 🔴 1 | **Set `DEV_MODE = false`** in all three portals. Gate with environment detection if needed. |
| 🔴 2 | **Replace `sb_publishable` with eyJ anon JWT in `join.html`**. Audit all other files for correct key type. |
| 🔴 3 | **Fix phone lookup in `contact.html`** to use `.ilike()` per permanent constraint. |
| 🔴 4 | **Run full RLS audit** on all 20+ tables. Enable RLS on every table before any real staff or member data enters the system. |
| 🔴 5 | **Remove `Shift+S/O` keyboard shortcuts** from all public pages. |
| 🔴 6 | **Remove `.DS_Store` files** from git and add `.gitignore`. |

### Short-Term (Before Public Launch)

| Priority | Action |
|---|---|
| 🟠 7 | Move OTP lockout tracking to Supabase (per existing checklist) |
| 🟠 8 | Rate-limit and authenticate `send-2fa` / `verify-2fa` edge functions |
| 🟠 9 | Replace member ID in QR URL with opaque `qr_token` |
| 🟠 10 | Add `expires_at` to `license_agreements` and enforce 30-day TTL |
| 🟠 11 | Migrate `members.id` and `tickets.member_id` from TEXT to UUID |

### Long-Term (Post-Astro Migration — Phase C/D)

| Priority | Action |
|---|---|
| 🟡 12 | Migrate Google OAuth from implicit flow to PKCE authorization code flow |
| 🟡 13 | Implement Content Security Policy headers via Cloudflare transform rules |
| 🟡 14 | Enable Cloudflare Access on `/staff/` and `/owner/` routes |
| 🟡 15 | Move phone enumeration check to an authenticated edge function |
| 🟡 16 | WebAuthn passkeys for staff portal (Phase D, post staff enrollment) |
| 🟡 17 | Move session tokens to httpOnly cookies (requires Astro SSR) |
| 🟡 18 | Review PII data handling policy for MAC address collection |

---

## 7. Permanent Constraint Compliance Summary

| Constraint | Status | Notes |
|---|---|---|
| No service key in browser | ✅ Pass | No `service_role` key found anywhere |
| members + tbk use eyJ anon JWT | ⚠️ Partial | members/tbk ✅ — join.html ❌ uses sb_publishable |
| No `authorized_by` in tickets INSERT | ✅ Pass | Comment and guard confirmed in events.html |
| No events FK join on table_bookings/tickets | ✅ Pass | No violations found in any file |
| SMS via `window.open('sms:')` only | ✅ Pass | No edge function SMS calls found |
| Staff portal rejects OAuth | ✅ Pass | Only phone+OTP auth path in staff portal |
| Owner bound to specific emails | ✅ Pass | OWNER_EMAILS guard confirmed |
| Phone lookup uses ilike | ❌ FAIL | contact.html uses `.eq.` (CRIT-03) |
| BAR_CONFIG is location source of truth | ✅ Pass | No hardcoded location strings found |
| ticket_prices: no anon INSERT | ✅ Pass | Verified S60 |

---

*Report generated from static analysis of S60 EOD codebase. All line numbers reference the docs.zip upload dated March 19–20, 2026. Dynamic testing (actual Supabase RLS policy verification, edge function penetration testing) should be conducted separately against the live project prior to public launch.*

*AG Entertainment · RIDDIM Platform · Session 61 Security Audit*
