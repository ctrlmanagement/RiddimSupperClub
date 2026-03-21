# RIDDIM Supper Club — Platform Security & Build Roadmap
**AG Entertainment · Updated Session 65 Full EOD · March 21, 2026**
*S65 full audit complete. CRIT-04 resolved. Claude Code installed. Risk score: 6.5/10.*

---

## Overview

| Phase Milestone | Status |
|---|---|
| Phase B — Security Hardening | ✅ COMPLETE (Session 32) |
| Phase A1 — Sessions 33–55 | ✅ COMPLETE |
| Sessions 56–64 | ✅ COMPLETE |
| **Session 65 — Full S65 audit · CRIT-04 resolved · Claude Code installed** | ✅ **COMPLETE** |
| All 44 tables — RLS enabled | ✅ VERIFIED S61 |
| S65 full audit — all portals + public files reviewed | ✅ COMPLETE |
| CRIT-04 Google Drive API key restricted | ✅ RESOLVED S65 |
| DEV_MODE = true in 3 portals | 🔴 Fix CRIT-03 first |
| Tables tab layout + mobile swipe | 🔴 UNRESOLVED S66 |

---

## PERMANENT CONSTRAINTS — Never Remove

> ⚠️ DEV_MODE = true in staff, members, AND inventory portals. All three must be false before public traffic. Cannot set false until CRIT-03 is fixed.

> ⚠️ CRIT-03: Fix staff prod path role loading BEFORE DEV_MODE = false. staff/index.html:458 sets currentStaff with no role. Setting DEV_MODE = false without this fix means all role restrictions silently disappear.

> Never send authorized_by in tickets INSERT (FK to auth.users). ✅ VERIFIED S65

> Never JOIN events via FK on table_bookings or tickets queries. ✅ VERIFIED S65

> Members portal and tbk.html must use eyJ anon key (Principle 131). ✅ VERIFIED S65

> Never send valid_date or booking_type in table_bookings INSERT/UPDATE. ✅ VERIFIED S65

> Phone lookup uses .ilike('phone', '%XXXXXXXXXX%') not .eq().

> SMS delivery uses window.open('sms:') — NOT Supabase edge functions. ✅ VERIFIED S65

> BAR_CONFIG is the only place to define locations. Must match in both inventory files.

> Hot Sauce import reads Workstation from XLS row 1 — maps via POS_TO_LOCATION.

> COST THRESHOLDS: On Target <18% · Watch 18–25% · High 25–32% · Alert 32%+. Unexplained pours >8% = flag.

> GOOGLE AUTH: GSI script must be synchronous in head — NEVER async defer. Owner portal fixed S64. Inventory portal STILL async defer CRIT-05.

> GOOGLE DRIVE API KEY S65: AIzaSyCrp5mYEWpja1os-bt-eDWmBvNRv-D3Oyk restricted to Google Picker API + portal.ctrlmanagement.com/* + ctrlmanagement.github.io/*. Never remove.

> HOTSAUCE SQL SERVER: SERVER\SQLEXPRESS. Login hssa. Never expose in frontend or repo.

> inv_count_edits: Never delete. Permanent audit trail for owner count corrections.

---

## Risk Score History

| Session | Score | Change |
|---|---|---|
| S60 baseline | 7.2 | Initial assessment |
| S61 RLS fixes | 6.1 | 6 policies hardened, 3 tables created |
| S65 new findings | 6.8 | DEV_MODE 3 portals, CRIT-03, CRIT-05, phone enum, API key |
| S65 CRIT-04 resolved | **6.5** | Google Drive API key restricted |

---

## Open Criticals — Fix S66 in Claude Code

### CRIT-01 — DEV_MODE = true in THREE portals
Files: staff:222, members:147, inventory:501
Fix: Set all three to false simultaneously. Do CRIT-03 first.

### CRIT-02 — Partial Key Rotation
Verify in Supabase Dashboard → Settings → API first.
If old eyJ key still active → update license-sign.html, reserve.html, events.html, contact.html.
members/index.html + tbk.html keep eyJ by constraint (Principle 131).

### CRIT-03 — Staff Prod Path Sets No Role — FIX BEFORE DEV_MODE = false
**File:** staff/index.html:458

**Bug:** Production path after verify-2fa sets currentStaff with no role property.

**Fix — replace lines 452–461:**
```javascript
try {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-2fa`, {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${SUPABASE_KEY}`},
    body:JSON.stringify({phone:loginPhone, code})
  });
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
} catch { showError('otpError','Incorrect code.'); clearOtp(); }
btn.disabled=false; btn.textContent='Verify';
```

**Verify query first:**
```sql
SELECT id, first_name, phone, role, active FROM staff WHERE active = true LIMIT 5;
```

### CRIT-04 — Google Drive API Key — RESOLVED S65
Key AIzaSyCrp5mYEWpja1os-bt-eDWmBvNRv-D3Oyk in owner:2863.
Restricted: HTTP referrers portal.ctrlmanagement.com/* + ctrlmanagement.github.io/*. API: Google Picker only.

### CRIT-05 — Inventory GSI Script async defer
File: inventory/index.html:495
Fix: Move script to head, remove async defer.
```html
<head>
  <script src="https://accounts.google.com/gsi/client"></script>
</head>
```

---

## High Severity — Fix S66

| ID | File:Line | Issue | Fix |
|---|---|---|---|
| HIGH-01 | All portals | No OTP lockout | 5-attempt counter in verifyCode() |
| HIGH-02 | inventory:559 | Explicit phone enumeration | "Could not send code. Try again." |
| HIGH-03 | staff:375 | "Account deactivated" reveals existence | Silent fail — same as unregistered |
| HIGH-04 | join:1292 | Alert confirms membership on dupe phone | Silent redirect to members portal |
| HIGH-05 | All portals | No session expiry | 8hr idle timeout; Phase D full fix |
| HIGH-06 | All portals | Supabase JS @2 unpinned | Pin to @2.x.x |

---

## Accepted Pilot Risk — Phase D

| Table | Exposure | Reason |
|---|---|---|
| members | anon SELECT all | Staff check-in phone lookup |
| staff | anon SELECT active | OTP auth phone lookup |
| points_ledger | anon SELECT all | Check-in operations |
| guest_lists | anon SELECT + UPDATE | Staff operations |
| inv_counts | anon ALL | Barback counting |
| inv_stock_ups | anon ALL | POS import |
| All portals | Client-side role checks | Phase D — server-side sessions |
| All portals | No session expiry | Phase D — Astro SSR + httpOnly cookies |
| All portals | No CSP | Phase C — GitHub Pages limitation |

---

## Verified Compliant (S65)

| Item | Status |
|---|---|
| authorized_by excluded from tickets INSERT | ✅ events.html:1778 + RLS |
| sign_agreement via RPC — server-enforced | ✅ license-sign.html:381 |
| Barback assigned_bar lock | ✅ inventory:675–681 |
| Google OAuth email double-check | ✅ owner:984 + Supabase session |
| No service role key in any file | ✅ Full scan clean |
| No hardcoded passwords | ✅ Full scan clean |
| No open redirect in TBK | ✅ Hardcoded to join.html |
| vip_passes anon ALL removed | ✅ S61 |
| table_bookings anon scoped to qr_token | ✅ S61 |
| Google Drive API key restricted | ✅ S65 |
| Dropbox SDK removed | ✅ S64 |
| Owner portal GSI in head | ✅ S64 |

---

## Consolidated Sequence Table

| # | Action | Status |
|---|---|---|
| 1–14 | Phase B + S60–64 security items | ✅ DONE |
| 15 | S65 full audit — 11 files | ✅ DONE |
| 16 | CRIT-04 Google Drive API key restricted | ✅ DONE S65 |
| 17 | Agent library rebuilt, security/ folder | ✅ DONE S65 |
| 18 | Claude Code v2.1.81 + .claude/agents/ live | ✅ DONE S65 |
| 19 | Fix CRIT-03 — staff:458 | 🔴 S66 |
| 20 | Fix CRIT-05 — inventory:495 | 🔴 S66 |
| 21 | Fix HIGH-02/03/04 phone enumeration | 🔴 S66 |
| 22 | DEV_MODE = false all 3 simultaneously | 🔴 S66 after 19 |
| 23 | Verify + complete CRIT-02 key rotation | 🔴 S66 |
| 24 | HIGH-01 OTP lockout | 🔴 S66 |
| 25 | HIGH-06 Supabase JS pin | 🟡 S66 |
| 26 | X-Frame-Options Cloudflare Transform Rule | 🟡 S66 |
| 27 | Tables tab fix | 🔴 S66 |
| 28 | INV-09, INV-11 | 🔴 S66 |
| 29 | members.id + tickets.member_id UUID | 🔴 Pre-launch |
| 30 | Function test all portals | Pending |
| 31 | CSP headers | Phase C |
| 32–35 | Phase D security | Pending |

---

*Security Roadmap v39 · Session 65 Full EOD · March 21, 2026 · AG Entertainment*
*S65 audit complete. CRIT-04 resolved. Claude Code v2.1.81 live. Agents installed.*
*Fix CRIT-03 (staff:458) → then DEV_MODE = false across all three portals simultaneously.*
