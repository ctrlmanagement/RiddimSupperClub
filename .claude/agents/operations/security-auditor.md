# Agent: Security Pre-Launch Auditor
**Role:** Verifies RLS policies, checks for anon key exposure, reviews permanent constraint compliance, and maintains the pre-launch security checklist for the RIDDIM platform.

---

## Pre-Launch Security Checklist

### ✅ Completed
| Item | Session |
|---|---|
| GitHub passkey | S32 |
| Supabase 2FA (Google Authenticator) | S32 |
| Cloudflare 2FA | S32 |
| noindex on staff + owner portals | S32 |
| robots.txt blocking /staff/ + /owner/ | S32 |
| Owner email server-side via signInWithIdToken | S32 |
| events table RLS (4 policies) | S32 |
| tickets RLS (owner + staff + anon INSERT) | S56–S57 |
| ticket_prices RLS (owner ALL + anon SELECT only — NO anon INSERT) | S58, verified S60 |
| license_agreements RLS | S59 |
| inv_distributors RLS | S60 |
| inv_price_history RLS | S60 |
| inv_periods RLS | S60 |

### 🔴 Outstanding Pre-Launch
| Item | Priority | Notes |
|---|---|---|
| RLS on members, staff, guest_lists, reservations, points_ledger | Critical | Before real staff onboard |
| RLS on table_bookings, vip_passes, employee_enrollments | Critical | Before go-live |
| RLS on galleries, gallery_photos, schedules, time_off_requests | High | Before go-live |
| RLS on inv_products, inv_counts, inv_sessions, inv_stock_ups, inv_par_levels | High | Verify — may be unset |
| RLS on inv_cost_periods, inv_cost_lines, inv_sales_entries | High | New S59 — not yet verified |
| Phone enumeration protection on staff login | High | Before real staff onboard |
| Move lockout tracking from localStorage → Supabase staff table | High | Before real staff onboard |
| Restrict anon key permissions | High | Before go-live |
| Lock send-2fa + verify-2fa Edge Functions to authenticated requests | High | Before go-live |
| Migrate members.id TEXT → UUID | Medium | Pre-launch |
| Migrate tickets.member_id TEXT → UUID | Medium | Pre-launch |

---

## Known Permanent Security Constraints
These are platform-level constraints that must never be violated regardless of which feature is being built:

1. **Never expose service key in browser.** Anon JWT (`eyJ...`) only in all browser-side code.
2. **Members portal and tbk.html must use anon JWT.** Not service key.
3. **Never include `authorized_by` in tickets INSERT.** FK to auth.users — Google OAuth won't satisfy it.
4. **Never JOIN events via FK on table_bookings or tickets.** Causes 400 RLS block.
5. **SMS delivery uses `window.open('sms:')`.** Never Supabase Edge Function for SMS.
6. **Staff portal rejects OAuth sessions explicitly.** Only phone+OTP auth.
7. **Owner portal binds to specific emails:** `inquiry@ctrlmanagement.com` + `gebriel@ctrlmanagement.com` — validated server-side via Supabase signInWithIdToken.
8. **Second Supabase project exists.** Always confirm project = `cbvryfgrqzdvbqigyrgh` before any debugging.
9. **ticket_prices: no anon INSERT.** Verified S60. Never add an anon INSERT policy here.

---

## RLS Verification Query Pattern
```sql
-- Check which tables have RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check policies on a specific table
SELECT policyname, cmd, roles, qual 
FROM pg_policies 
WHERE tablename = 'tickets';
```

---

## Phase B Security Roadmap Reference

### Phase B ✅ Complete (S32)
Account 2FA, noindex, robots.txt, owner email server-side, events RLS

### Phase C (Post-Astro Migration — Pending)
- Route obscurity — non-obvious portal URLs
- Content Security Policy headers  
- Cloudflare Access on portal routes
- IP allowlisting for staff portal

### Phase D (Post-Migration)
- WebAuthn passkeys for staff portal (deferred — staff not enrolled yet)
- Move session tokens to httpOnly cookies (requires Astro SSR)

---

## Security Review Checklist for New Features
Before any new feature ships, confirm:
- [ ] No service key in browser-side code
- [ ] RLS policy created if new table added
- [ ] No unauthorized data leakage via anon SELECT (check policy qual)
- [ ] No permanent constraint violations (see list above)
- [ ] No new Edge Function calls for SMS (use window.open sms:)
- [ ] No authorized_by in tickets INSERT
- [ ] No events FK join on table_bookings/tickets queries
