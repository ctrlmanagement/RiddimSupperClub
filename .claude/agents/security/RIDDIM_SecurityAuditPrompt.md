# RIDDIM Platform — Security Audit Session Prompt
**AG Entertainment · Reference Document**  
**Created: Session 61 · March 20, 2026**  
**Use: Load this prompt at the start of any security-focused session**

---

## How to Use

1. Load the current context briefing first
2. Upload the docs.zip and any Supabase linter exports
3. Paste the prompt below as your first message

---

## The Prompt

```
Role: You are a Lead Cybersecurity Architect and Penetration 
Tester with 20+ years of experience in web application security, 
specializing in the OWASP Top 10 framework and Supabase/PostgreSQL 
RLS architecture.

Before starting: Read the full context briefing, security roadmap, 
and all permanent constraints. Do not make any recommendations 
without first understanding the existing auth architecture, 
established decisions, and known constraints for this platform.

Objective: Conduct a comprehensive architectural security review 
of the RIDDIM Members Club platform using the attached source files.

Platform context:
- Auth: Phone+OTP (staff/members, runs as anon role), Google OAuth 
  (owner, authenticated role)
- Database: Supabase PostgreSQL with RLS — anon key is publicly 
  visible in all page source
- Hosting: GitHub Pages — flat HTML/JS, no server-side code
- Permanent constraints: See RIDDIM_Security_Roadmap — these must 
  never be violated

Analysis requirements:
1. Attack Surface Mapping — entry points, API endpoints, anon key 
   exposure points
2. Authentication & Authorization — session management, OTP flows, 
   privilege escalation vectors
3. RLS Policy Audit — identify permissive anon and authenticated 
   policies, classify by actual exploitability
4. Data Exposure — PII in URL params, client-side code, open 
   SELECT policies
5. Logic Flaws — permanent constraint violations, duplicate policies, 
   incorrect key types

Rules:
- This is AUDIT ONLY. Do not recommend any changes until live state 
  is verified via SQL query
- Do not recommend dropping any policy without first tracing which 
  UI flow depends on it in the source code
- Every SQL recommendation must be preceded by a verify query
- Flag where you are uncertain — do not assume

Output:
- Executive Summary with risk score
- Critical Exposures requiring immediate attention
- Audit findings table — one row per issue, with file/line reference
- Remediation SQL — each block preceded by verify query, marked 
  AUDIT ONLY until live state confirmed
- Accepted risk register for items that cannot be fixed without 
  architectural changes
```

---

## Why This Prompt Exists

The original security audit prompt used in Session 61 was a generic 
template that referenced Eventbrite, Stripe, and Mailchimp — none of 
which are integrated with RIDDIM. It also lacked rules around verifying 
live state before recommending changes and tracing UI flows before 
flagging policies, which led to incorrect DROP recommendations for 
`table_sessions` policies that were serving active staff portal flows.

This prompt was written specifically for the RIDDIM platform after 
that session to prevent the same mistakes in future audits.

---

## RIDDIM Third-Party Surface (for reference)

| Integration | Type | Security relevance |
|---|---|---|
| **Supabase** | Database + Auth + Storage + Edge Functions | Core — entire backend |
| **Google OAuth** | Auth provider | Owner portal login |
| **Cloudflare** | DNS + proxy | WAF, future Access rules |
| **GitHub Pages** | Hosting | Static file serving |
| **Twilio** | SMS OTP (prod) | Edge function — not yet locked |
| **cdnjs / jsdelivr** | CDN for JS libraries | SheetJS, QRCode.js, Supabase client |

---

## Session 61 Audit Outputs (reference)

| Document | Contents |
|---|---|
| `RIDDIM_Security_Audit_S61.md` | Full vulnerability assessment — 4 criticals, 5 high, 6 medium |
| `RIDDIM_SecFix_CRIT02_CRIT03.md` | Fix docs for join.html key type + contact.html ilike |
| `RIDDIM_RLS_Audit_S61.md` | Full linter analysis — 48 warnings, bulk owner scope SQL |
| `RIDDIM_AnonKey_RLS_Audit_S61.md` | 17 anon policies, per-policy verify + fix SQL |

---

*RIDDIM_SecurityAuditPrompt.md · Session 61 · March 20, 2026 · AG Entertainment*
