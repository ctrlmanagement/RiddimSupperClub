# Agent: Analytics & Reporting
**Role:** Owner Portal Analytics and Reporting tabs. KPI dashboard, revenue breakdown, check-in bar chart, member tier donut, and the four reporting search sections (Staff Performance, Member Activity, Guest List History, Reservation History).

---

## Analytics Tab — Dashboard KPIs

### KPI Cards (top row)
| Card | Value Source | Notes |
|---|---|---|
| Tonight Est. Revenue | Hardcoded `$12,480` | ⚠️ Not live — needs POS integration |
| Total Members | `members` table COUNT | ✅ Live — `kpiMembers` |
| Avg Visit Spend | Hardcoded `$187` | ⚠️ Not live — needs POS |
| Points Outstanding | `points_ledger` SUM | ✅ Live — `kpiPoints` |

**Principle:** Every number on the dashboard must eventually come from live Supabase data. Hardcoded stats (Tonight Revenue, Avg Spend) are placeholders until POS is integrated.

### Revenue Breakdown Panel (Month-to-Date)
Currently all hardcoded — Food & Beverage, Hookah Service, Private Events. Replace with real data once POS is selected and integrated.

### Weekly Check-Ins Bar Chart
- **Source:** `guest_lists` table WHERE `status = 'confirmed'`, grouped by week
- **Renders:** 8-week bar chart using div-based bars with CSS heights
- Last week highlighted with `bar.thisweek` class (gold-bright gradient)
- Bar labels show week abbreviation, bar values show check-in count

### Tier Distribution Donut Chart
- **Source:** `members` table, GROUP BY tier
- **Renders:** SVG donut with 4 segments: Bronze / Silver / Gold / Obsidian
- Legend below with member counts per tier

```javascript
// Tier thresholds
Bronze:   0 points
Silver:   500 points
Gold:     1,500 points
Obsidian: 5,000 points
```

---

## Reporting Tab — Four Sections

### 1. Staff Performance
**Inputs:** Staff selector dropdown + date range (from/to)
**Queries:**
```javascript
// Three parallel queries for selected staff + date range:
supabaseClient.from('employee_enrollments')
  .select('id').eq('staff_id', staffId)
  .gte('enrolled_at', from).lte('enrolled_at', to)

supabaseClient.from('guest_lists')
  .select('id').eq('confirmed_by', staffId)  // check-ins attributed
  .gte('confirmed_at', from).lte('confirmed_at', to)

supabaseClient.from('reservations')
  .select('id').eq('handled_by', staffId)
  .gte('event_date', from).lte('event_date', to)
```
**Stats displayed:** Enrollments count, Check-Ins count, Reservations count
**Table:** Detailed rows per activity

### 2. Member Activity
**Inputs:** Search (name, phone, member ID) + date range
**Queries:**
```javascript
supabaseClient.from('members')
  .select('*').ilike('phone', '%searchTerm%')  // always use ilike for phone

// Then fetch activity:
supabaseClient.from('guest_lists').select('*').eq('member_phone', phone)
supabaseClient.from('reservations').select('*').eq('member_phone', phone)
supabaseClient.from('tickets').select('id,quantity,price_paid,comped,events(title,event_date)')
  .eq('member_id', memberId)
```
**Displays:** Visit history, point activity, reservations, tickets

### 3. Guest List History
**Inputs:** Guest name or phone + date range
**Query:**
```javascript
supabaseClient.from('guest_lists')
  .select('guest_name, guest_phone, status, submitted_at, confirmed_at, events(name, event_date)')
  .ilike('guest_name', '%query%')  // or ilike guest_phone
  .gte('submitted_at', from).lte('submitted_at', to)
  .order('submitted_at', { ascending: false }).limit(100)
```

### 4. Reservation History
**Inputs:** Guest name or phone + date range
**Query:**
```javascript
supabaseClient.from('reservations')
  .select('member_name, member_phone, party_size, occasion, event_date, status, requested_at, handled_by')
  .ilike('member_phone', '%query%')
  .gte('event_date', from).lte('event_date', to)
  .order('event_date', { ascending: false }).limit(100)
```

---

## Key Constraints for Analytics Queries

1. **Phone lookup always uses `.ilike('phone', '%XXXXXXXXXX%')`** — never `.eq()`
2. **Never JOIN events via FK on reservations or guest_lists** — query events separately
3. **member_segments view** is the canonical helper for marketing queries:
   ```sql
   -- member_segments view combines:
   -- members + last visit + points + enrollment attribution
   -- Use for cohort analysis, not individual lookups
   ```

---

## Future Analytics (Post-POS)

When POS is integrated, these will become live:
- Tonight estimated revenue (replace hardcoded `$12,480`)
- Average visit spend per member vs walk-in
- Food & Beverage / Hookah / Private Events monthly breakdown
- Product-level sales (feeds inventory cost report INV-11 drill-down)

---

## Key Functions (owner/index.html)
| Function | Purpose |
|---|---|
| `loadOwnerData()` | Fires on portal load — fetches KPI data |
| `renderBarChart(data)` | 8-week check-in bar chart |
| `renderDonutChart(tiers)` | Tier distribution donut |
| `runStaffReport()` | Staff performance query + render |
| `runMemberReport()` | Member activity search |
| `runGuestReport()` | Guest list history search |
| `runResReport()` | Reservation history search |
| `populateReportStaffSelect()` | Fills staff dropdown on Reporting tab open |
