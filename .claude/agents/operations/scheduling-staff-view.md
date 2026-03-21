# Agent: Scheduling & Staff View
**Role:** Owner Portal Scheduling tab and Staff View tab. Weekly schedule grid, shift management, time-off request approval, schedule export, and the Staff View mode (owner sees the staff portal from within the owner portal).

---

## Scheduling Tab

### schedules Table Schema
```sql
schedules:
  id UUID,
  staff_id UUID FK → staff(id),
  event_id UUID nullable,
  role TEXT,         -- role for this specific shift (may differ from staff.role)
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ
```

### time_off_requests Table Schema
```sql
time_off_requests:
  id UUID,
  staff_id UUID FK → staff(id),
  date DATE,
  reason TEXT,
  status TEXT,  -- pending | approved | denied
  created_at TIMESTAMPTZ
```

---

## Schedule Grid UI

7-day grid, one column per day, one row per employee. Current week shown by default.

```
           | SUN  | MON  | TUE  | WED  | THU  | FRI  | SAT  |
-----------|------|------|------|------|------|------|------|
Jordan M.  |      | 6PM–2AM |    |      |      | 8PM–3AM |   |
Missy N.   |      |      |      | 6PM–2AM |   |      | 8PM–3AM |
```

- Today's column highlighted with gold tint + `today-col` class
- Each shift = `sched-shift-chip` — shows time range + role
- Hover cell → `+` appears (click to add shift for that employee + day)
- Week navigation: `‹ / ›` buttons → `changeSchedWeek(-1/1)`

### Add Shift Modal Fields
```
Employee (select from active staff)
Date
Role for Shift (may differ from employee's primary role)
Start Time (default 18:00)
End Time (default 02:00)
Notes (optional, e.g. "Cover for Jordan")
```

### Schedule Export Modal
```
From date / To date
Format: Print/PDF or CSV (Google Sheets)
```
`runSchedExport()` — generates printable schedule or CSV download

---

## Time-Off Requests

Shown in a panel below the schedule grid. Filter tabs: Pending / Approved / Denied / All.

```javascript
// Approve:
supabaseClient.from('time_off_requests').update({ status: 'approved' }).eq('id', id)

// Deny:
supabaseClient.from('time_off_requests').update({ status: 'denied' }).eq('id', id)
```

Each request card shows: staff name, requested dates, reason, status badge, Approve/Deny buttons.

---

## Staff View Tab

The Staff View tab lets the owner see and operate the staff-facing check-in interface from within the owner portal — without logging out. It's useful for owners on the floor who want to do check-ins without switching accounts.

```javascript
// Tab ID: 'staffview'
// CSS class on tab button: 'staff-view-tab'
// Active state: blue (--staff-accent) instead of gold
// Banner shown at top of view:
<div class="staff-view-banner">
  <div class="staff-view-banner-dot"></div>  // pulsing blue dot
  <span class="staff-view-banner-text">Staff View — You are operating as staff</span>
</div>
```

**What's accessible in Staff View:**
- QR scanner (same `html5-qrcode` instance as staff portal)
- Guest list check-in
- Member lookup
- Scan routes: `TBK:` `TKT:` `COMP:` `VIP:` `RES:` prefixes all handled

**What's NOT accessible:**
- Owner-only actions (confirm reservations, manage events, etc.)
- Inventory management
- Financial data

---

## Key Functions (owner/index.html)
| Function | Purpose |
|---|---|
| `loadSchedule()` | Fetches schedules for current week |
| `renderSchedGrid()` | Renders 7-day grid with shifts |
| `changeSchedWeek(dir)` | Navigate prev/next week |
| `openShiftModal(staffId, date)` | Pre-fills modal for a specific employee + day |
| `saveShift()` | INSERT to schedules |
| `closeShiftModal()` | Close without saving |
| `runSchedExport()` | Export current schedule as print/CSV |
| `filterTimeOff(btn, status)` | Filter time-off list |
| `loadTimeOffRequests()` | Fetch pending time-off requests |

---

## Staff Portal: My Schedule Tab (Read-Only View)
Staff see their own schedule in the Staff Portal under "My Schedule" tab — read-only. Same `schedules` table, filtered to `staff_id = currentStaff.id`. Staff can also submit time-off requests from this tab.

```javascript
// Staff query — own shifts only:
supabaseClient.from('schedules')
  .select('*, events(title,event_date)')
  .eq('staff_id', currentStaff.supabaseId)
  .gte('start_time', weekStart)
  .lte('start_time', weekEnd)
  .order('start_time')
```
