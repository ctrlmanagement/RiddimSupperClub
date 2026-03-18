/* ═══════════════════════════════════════════════════════════════════
   DOOR 64 — OWNER INVENTORY MANAGER
   owner_inv.js · Session 59 · March 2026
   Depends on: supabaseClient, showToast, goToTab (owner portal)
   New S59: inv_cost_periods, inv_cost_lines, inv_sales_entries
   ═══════════════════════════════════════════════════════════════════ */

const INV_LOCATIONS     = ['LR','BAR1','BAR2','BAR3','BAR4','SVC'];
const INV_BAR_LOCATIONS = ['BAR1','BAR2','BAR3','BAR4','SVC'];
const INV_CAT_ORDER     = ['COGNAC','VODKA','WHISKEY','TEQUILA','RUM','GIN','SCOTCH','CORDIAL','CHAMPAGNE','BEER','BEVERAGE'];

let invMgrTab        = 'staff';
let invMgrProducts   = [];
let invMgrPars       = {};
let invMgrPending    = {};
let invMgrOrders     = [];
let invMgrProductsF  = [];
let invStaffList     = [];

// ── Cost report state ─────────────────────────────────────────────
let costPeriods       = [];
let costActivePeriod  = null;   // full period object currently viewed
let costLines         = [];     // inv_cost_lines for active period
let costSales         = {};     // { location: { total_sales, total_comps } }
let costReportView    = 'cost'; // 'cost' | 'lr'
let costReportLoc     = 'house'; // 'house' | 'BAR1' … 'SVC'
let costPeriodFilter  = 'week'; // 'week' | 'biweek' | 'month' | 'quarter' | 'custom'

async function invMgrInit() {
  await invMgrLoadProducts();
  await invMgrLoadPars();
  invMgrSetTab('staff', document.querySelector('.invmgr-tab[data-itab="staff"]'));
}

async function invMgrLoadProducts() {
  const { data } = await supabaseClient
    .from('inv_products').select('*').eq('active', true).order('category').order('name');
  invMgrProducts  = data || [];
  invMgrProductsF = [...invMgrProducts];
  const el = document.getElementById('invMgrProdCount');
  if (el) el.textContent = invMgrProducts.length + ' products';
}

async function invMgrLoadPars() {
  const { data } = await supabaseClient.from('inv_par_levels').select('*');
  invMgrPars = {};
  if (data) data.forEach(p => {
    if (!invMgrPars[p.product_id]) invMgrPars[p.product_id] = {};
    invMgrPars[p.product_id][p.location] = p.par_qty;
  });
}

function invMgrSetTab(tab, btn) {
  invMgrTab = tab;
  document.querySelectorAll('.invmgr-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  ['staff','products','par','orders','house','cost'].forEach(t => {
    const el = document.getElementById(`invmgr-${t}-area`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'staff')    invMgrRenderStaff();
  if (tab === 'products') invMgrRenderProducts();
  if (tab === 'par')      invMgrRenderPar();
  if (tab === 'orders')   invMgrRenderOrders();
  if (tab === 'house')    invMgrRenderHouse();
  if (tab === 'cost')     costInit();
}

// ── STAFF ──────────────────────────────────────────────────────────
async function invMgrRenderStaff() {
  const tbody = document.getElementById('invStaffTableBody');
  if (!tbody) return;
  const { data } = await supabaseClient.from('inv_staff').select('*').order('name');
  invStaffList = data || [];
  if (!invStaffList.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--ash);font-style:italic;">No inventory staff yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = invStaffList.map(s => `
    <tr style="border-bottom:1px solid rgba(42,42,42,0.4);">
      <td style="padding:14px 16px;font-family:var(--font-display);font-size:16px;font-weight:300;color:var(--ivory);">${s.name}</td>
      <td style="padding:14px 16px;font-size:13px;color:var(--mist);">${s.phone}</td>
      <td style="padding:14px 16px;">
        <span class="invmgr-role-badge invmgr-role-${s.role}">${s.role === 'key_barback' ? 'Key Barback' : 'Manager'}</span>
      </td>
      <td style="padding:14px 16px;text-align:center;">
        <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:${s.active ? '#81C784' : 'var(--ash)'};">
          <span style="width:7px;height:7px;border-radius:50%;background:${s.active ? '#4CAF50' : 'var(--ash)'}"></span>
          ${s.active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td style="padding:14px 16px;">
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button onclick="invMgrToggleStaff('${s.id}',${s.active})"
            style="padding:5px 12px;border-radius:4px;border:1px solid ${s.active ? 'rgba(192,57,43,0.3)' : 'rgba(76,175,80,0.3)'};background:none;color:${s.active ? '#E57373' : '#81C784'};font-family:var(--font-label);font-size:9px;letter-spacing:0.12em;cursor:pointer;">
            ${s.active ? 'Deactivate' : 'Reactivate'}
          </button>
          <button onclick="invMgrDeleteStaff('${s.id}','${s.name}')"
            style="padding:5px 12px;border-radius:4px;border:1px solid rgba(192,57,43,0.3);background:none;color:#E57373;font-family:var(--font-label);font-size:9px;letter-spacing:0.12em;cursor:pointer;">
            Remove
          </button>
        </div>
      </td>
    </tr>`).join('');
}

async function invMgrToggleStaff(id, active) {
  await supabaseClient.from('inv_staff').update({ active: !active }).eq('id', id);
  showToast(active ? 'Staff deactivated' : 'Staff reactivated', 'success');
  invMgrRenderStaff();
}

async function invMgrDeleteStaff(id, name) {
  if (!confirm(`Remove ${name} from inventory portal access?`)) return;
  await supabaseClient.from('inv_staff').delete().eq('id', id);
  showToast(`${name} removed`, 'success');
  invMgrRenderStaff();
}

function openInvStaffModal() {
  const name = prompt('Staff member name:');
  if (!name?.trim()) return;
  const phone = prompt('Phone number (10 digits, e.g. 4045550100):');
  if (!phone?.trim()) return;
  const roleChoice = prompt('Role:\n1 = Key Barback (scan + count only)\n2 = Manager (full access)\n\nEnter 1 or 2:');
  const role   = roleChoice === '2' ? 'manager' : 'key_barback';
  const digits = phone.replace(/\D/g, '');
  const e164   = digits.length === 10 ? '+1' + digits : '+' + digits;
  supabaseClient.from('inv_staff').insert({ name: name.trim(), phone: e164, role, active: true, created_by: 'owner' })
    .then(({ error }) => {
      if (error) { showToast(error.message.includes('unique') ? 'Phone already registered' : 'Error adding staff', ''); return; }
      showToast(`${name.trim()} added as ${role === 'key_barback' ? 'Key Barback' : 'Manager'}`, 'success');
      invMgrRenderStaff();
    });
}

// ── PRODUCTS / UPC ─────────────────────────────────────────────────
function invMgrRenderProducts() {
  const tbody = document.getElementById('invMgrProductsBody');
  if (!tbody) return;
  tbody.innerHTML = invMgrProductsF.map(p => `
    <tr style="border-bottom:1px solid rgba(42,42,42,0.4);">
      <td style="padding:12px 16px;font-size:13px;color:var(--ivory);font-weight:500;">${p.name}</td>
      <td style="padding:12px 16px;font-size:12px;color:var(--ash);">${p.category}</td>
      <td style="padding:12px 16px;font-size:12px;color:var(--mist);">${p.distributor || '—'}</td>
      <td style="padding:12px 16px;font-size:13px;color:var(--mist);text-align:center;">${p.cost ? '$'+p.cost : '—'}</td>
      <td style="padding:12px 16px;font-size:13px;color:var(--mist);text-align:center;">${p.case_size || '—'}</td>
      <td style="padding:12px 16px;">
        <input class="invmgr-upc-input ${p.upc ? 'has-upc' : ''}" type="text"
          placeholder="Scan or enter UPC…" value="${p.upc || ''}" data-pid="${p.id}"
          onchange="invMgrSaveUpc(this)" onfocus="this.select()" />
      </td>
    </tr>`).join('');
  const el = document.getElementById('invMgrProdCount');
  if (el) el.textContent = invMgrProductsF.length + ' products';
}

function invMgrFilterProducts(q) {
  invMgrProductsF = q.trim()
    ? invMgrProducts.filter(p =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.category||'').toLowerCase().includes(q.toLowerCase()) ||
        (p.distributor||'').toLowerCase().includes(q.toLowerCase()) ||
        (p.upc||'').includes(q))
    : [...invMgrProducts];
  invMgrRenderProducts();
}

async function invMgrSaveUpc(input) {
  const pid = input.dataset.pid, upc = input.value.trim();
  const { error } = await supabaseClient.from('inv_products').update({ upc: upc||null }).eq('id', pid);
  if (error) { showToast('Error saving UPC', ''); return; }
  const p = invMgrProducts.find(p => p.id === pid);
  if (p) p.upc = upc || null;
  input.classList.toggle('has-upc', !!upc);
  showToast(upc ? `UPC saved — ${p?.name}` : 'UPC cleared', 'success');
}

// ── PAR ────────────────────────────────────────────────────────────
function invMgrRenderPar() {
  const loc   = document.getElementById('invMgrParLoc')?.value || 'LR';
  const tbody = document.getElementById('invMgrParBody');
  if (!tbody) return;
  tbody.innerHTML = invMgrProducts.map(p => {
    const par = invMgrPending[p.id]?.[loc] ?? invMgrPars[p.id]?.[loc] ?? 0;
    return `<tr style="border-bottom:1px solid rgba(42,42,42,0.4);">
      <td style="padding:10px 16px;font-size:13px;color:var(--ivory);">${p.name}</td>
      <td style="padding:10px 16px;font-size:12px;color:var(--ash);">${p.category}</td>
      <td style="padding:10px 16px;text-align:center;">
        <input class="invmgr-par-input" type="number" min="0" step="0.5" value="${par}"
          data-pid="${p.id}" data-loc="${loc}" onchange="invMgrParChanged(this)" />
      </td>
    </tr>`;
  }).join('');
}

function invMgrParChanged(input) {
  const pid = input.dataset.pid, loc = input.dataset.loc;
  if (!invMgrPending[pid]) invMgrPending[pid] = {};
  invMgrPending[pid][loc] = parseFloat(input.value) || 0;
}

async function invMgrSavePar() {
  const loc     = document.getElementById('invMgrParLoc')?.value || 'LR';
  const changes = Object.entries(invMgrPending)
    .filter(([,locs]) => locs[loc] !== undefined)
    .map(([pid, locs]) => ({ product_id: pid, location: loc, par_qty: locs[loc], updated_by: 'owner' }));
  if (!changes.length) { showToast('No changes to save', ''); return; }
  for (const row of changes) {
    await supabaseClient.from('inv_par_levels').upsert(row, { onConflict: 'product_id,location' });
  }
  await invMgrLoadPars();
  invMgrPending = {};
  showToast(`PAR saved — ${changes.length} items`, 'success');
}

// ── ORDERS ─────────────────────────────────────────────────────────
async function invMgrGenerateOrders() {
  const grid = document.getElementById('invMgrOrdersGrid');
  grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ash);">Calculating…</div>';
  const today = new Date().toISOString().slice(0,10), allCounts = {};
  for (const loc of INV_LOCATIONS) {
    const { data: sessions } = await supabaseClient.from('inv_sessions').select('id')
      .eq('location', loc).eq('week_of', today).order('opened_at', { ascending: false }).limit(1);
    if (!sessions?.length) continue;
    const { data: counts } = await supabaseClient.from('inv_counts').select('product_id, quantity').eq('session_id', sessions[0].id);
    if (counts) counts.forEach(c => { allCounts[c.product_id] = (allCounts[c.product_id]||0) + c.quantity; });
  }
  invMgrOrders = invMgrProducts.map(p => {
    const end = allCounts[p.id] || 0;
    const par = INV_LOCATIONS.reduce((s, l) => s + (invMgrPars[p.id]?.[l]||0), 0);
    const suggested = Math.max(0, par - end) > 0 ? Math.ceil((par - end) / (p.case_size||1)) : 0;
    return { p, end, par, suggested, confirmed: suggested };
  }).filter(r => r.par > 0);
  invMgrRenderOrders();
}

function invMgrRenderOrders() {
  const grid = document.getElementById('invMgrOrdersGrid');
  if (!invMgrOrders.length) {
    grid.innerHTML = '<div style="text-align:center;padding:48px;color:var(--ash);font-style:italic;font-size:13px;">Click Auto-Generate to build this week\'s order from HOUSE END vs PAR.</div>';
    return;
  }
  const byDist = {};
  invMgrOrders.forEach((row, idx) => {
    const dist = row.p.distributor || 'Unknown';
    if (!byDist[dist]) byDist[dist] = [];
    byDist[dist].push({ ...row, idx });
  });
  grid.innerHTML = Object.entries(byDist).sort((a,b) => a[0].localeCompare(b[0])).map(([dist, rows]) => {
    const total    = rows.reduce((s,r) => s + (r.confirmed*(r.p.cost||0)*(r.p.case_size||1)), 0);
    const rowsHtml = rows.map(row => {
      const cls = row.end === 0 ? 'out' : row.end < row.par ? 'low' : '';
      return `<div class="invmgr-order-row">
        <div class="invmgr-order-name">${row.p.name} <span style="font-size:11px;color:var(--ash);margin-left:6px;">${row.p.category}</span></div>
        <span style="font-size:11px;color:var(--ash);">END</span>
        <div class="invmgr-order-end ${cls}">${row.end%1===0?row.end:row.end.toFixed(1)}</div>
        <span style="font-size:11px;color:var(--ash);">PAR</span>
        <div style="font-family:var(--font-display);font-size:15px;min-width:30px;text-align:center;color:var(--mist);">${row.par}</div>
        <span style="font-size:11px;color:var(--owner-gold);">CASES</span>
        <input class="invmgr-order-input" type="number" min="0" step="1" value="${row.confirmed}"
          onchange="invMgrOrders[${row.idx}].confirmed=parseFloat(this.value)||0" />
        <span style="font-size:12px;color:var(--ash);min-width:60px;text-align:right;">
          ${row.confirmed > 0 && row.p.cost ? '$'+(row.confirmed*(row.p.cost||0)*(row.p.case_size||1)).toFixed(0) : ''}
        </span>
      </div>`;
    }).join('');
    return `<div class="invmgr-order-section">
      <div class="invmgr-order-dist">${dist}<span style="color:var(--ash);font-size:11px;">${total > 0 ? 'Est. $'+total.toFixed(0) : ''}</span></div>
      ${rowsHtml}
    </div>`;
  }).join('');
}

async function invMgrConfirmOrders() {
  const toSave = invMgrOrders.filter(r => r.confirmed > 0);
  if (!toSave.length) { showToast('No quantities set', ''); return; }
  if (!confirm(`Confirm ${toSave.length} order lines?`)) return;
  const today = new Date().toISOString().slice(0,10);
  const { error } = await supabaseClient.from('inv_orders').insert(
    toSave.map(r => ({
      week_of: today, product_id: r.p.id, distributor: r.p.distributor||'Unknown',
      house_end: r.end, house_par: r.par, suggested_cases: r.suggested,
      confirmed_cases: r.confirmed, case_price: (r.p.cost||0)*(r.p.case_size||1),
      status: 'confirmed', created_by: 'owner'
    }))
  );
  if (error) { showToast('Error saving orders', ''); return; }
  showToast(`${toSave.length} orders confirmed`, 'success');
}

// ── HOUSE VIEW ─────────────────────────────────────────────────────
async function invMgrRenderHouse() {
  const grid      = document.getElementById('invMgrHouseGrid');
  const catFilter = document.getElementById('invMgrHouseCat')?.value || '';
  if (!grid) return;
  grid.innerHTML  = '<div style="text-align:center;padding:40px;color:var(--ash);grid-column:1/-1;">Loading…</div>';
  const today = new Date().toISOString().slice(0,10), allCounts = {};
  for (const loc of INV_LOCATIONS) {
    const { data: sessions } = await supabaseClient.from('inv_sessions').select('id')
      .eq('location', loc).eq('week_of', today).order('opened_at', { ascending: false }).limit(1);
    if (!sessions?.length) continue;
    const { data: counts } = await supabaseClient.from('inv_counts').select('product_id, quantity').eq('session_id', sessions[0].id);
    if (counts) counts.forEach(c => { allCounts[c.product_id] = (allCounts[c.product_id]||0) + c.quantity; });
  }
  const cats = {};
  invMgrProducts.forEach(p => {
    if (catFilter && p.category !== catFilter) return;
    if (!cats[p.category]) cats[p.category] = [];
    const qty = allCounts[p.id] || 0;
    const par = INV_LOCATIONS.reduce((s,l) => s + (invMgrPars[p.id]?.[l]||0), 0);
    cats[p.category].push({ p, qty, par });
  });
  const sorted = INV_CAT_ORDER.filter(c => cats[c]).concat(Object.keys(cats).filter(c => !INV_CAT_ORDER.includes(c)));
  if (!sorted.length) {
    grid.innerHTML = '<div style="text-align:center;padding:48px;color:var(--ash);grid-column:1/-1;">No count data for today.</div>';
    return;
  }
  grid.innerHTML = sorted.map(cat => {
    const rows = cats[cat].map(({p, qty, par}) => {
      const cls = qty===0 ? 'out' : qty<par ? 'low' : 'ok';
      return `<div class="invmgr-house-row">
        <span class="invmgr-house-name">${p.name}</span>
        <span class="invmgr-house-qty ${cls}">${qty%1===0?qty:qty.toFixed(1)}<span style="font-size:10px;color:var(--ash);margin-left:4px;">/ ${par}</span></span>
      </div>`;
    }).join('');
    return `<div class="invmgr-house-card"><div class="invmgr-house-cat">${cat}</div>${rows}</div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// ── COST REPORT — S59 ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

async function costInit() {
  const el = document.getElementById('invmgr-cost-area');
  if (!el) return;
  el.innerHTML = costShell();
  await costLoadPeriods();
  costBindEvents();
}

function costShell() {
  return `
<!-- ── Cost Report Shell ── -->
<style>
.cost-kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
@media(max-width:900px){.cost-kpi-row{grid-template-columns:1fr 1fr;}}
@media(max-width:500px){.cost-kpi-row{grid-template-columns:1fr;}}
.cost-kpi{background:var(--carbon);border:1px solid var(--graphite);border-radius:8px;padding:18px;position:relative;overflow:hidden;}
.cost-kpi-label{font-family:var(--font-label);font-size:10px;letter-spacing:0.3em;color:var(--owner-gold);margin-bottom:6px;}
.cost-kpi-val{font-family:var(--font-display);font-size:34px;font-weight:300;color:var(--ivory);}
.cost-kpi-sub{font-size:11px;color:var(--ash);margin-top:4px;}
.cost-kpi.alert{border-color:rgba(192,57,43,0.5);}
.cost-kpi.alert .cost-kpi-val{color:var(--ember);}
.cost-tbl{width:100%;border-collapse:collapse;font-size:13px;}
.cost-tbl th{font-family:var(--font-label);font-size:10px;letter-spacing:0.2em;color:var(--ash);text-align:left;padding:10px 12px;border-bottom:1px solid var(--graphite);}
.cost-tbl th.num{text-align:right;}
.cost-tbl td{padding:10px 12px;border-bottom:1px solid rgba(42,42,42,0.35);color:var(--mist);}
.cost-tbl td.num{text-align:right;font-family:var(--font-display);font-size:14px;font-weight:300;}
.cost-tbl tr:hover td{background:rgba(218,165,32,0.02);}
.cost-pct{display:inline-block;padding:2px 8px;border-radius:4px;font-family:var(--font-label);font-size:11px;}
.cost-pct.ok{background:rgba(76,175,80,0.12);color:#81C784;}
.cost-pct.warn{background:rgba(218,165,32,0.12);color:var(--gold-warm);}
.cost-pct.alert{background:rgba(192,57,43,0.12);color:#E57373;}
.cost-period-row{display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:8px;border:1px solid var(--graphite);background:var(--carbon);cursor:pointer;transition:border-color 150ms;}
.cost-period-row:hover{border-color:rgba(218,165,32,0.4);}
.cost-period-row.active{border-color:var(--owner-gold);background:rgba(218,165,32,0.05);}
.cost-period-date{font-family:var(--font-label);font-size:13px;letter-spacing:0.15em;color:var(--ivory);flex:1;}
.cost-period-status{font-family:var(--font-label);font-size:9px;letter-spacing:0.15em;padding:3px 10px;border-radius:999px;border:1px solid;}
.cost-period-status.draft{color:var(--gold-warm);border-color:rgba(212,168,67,0.4);background:rgba(212,168,67,0.08);}
.cost-period-status.finalized{color:#81C784;border-color:rgba(76,175,80,0.4);background:rgba(76,175,80,0.08);}
.cost-sales-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px;}
.cost-sales-card{background:var(--carbon);border:1px solid var(--graphite);border-radius:8px;padding:16px;}
.cost-sales-loc{font-family:var(--font-label);font-size:10px;letter-spacing:0.25em;color:var(--owner-gold);margin-bottom:12px;}
.cost-sales-input{width:100%;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:9px 12px;color:var(--ivory);font-family:var(--font-display);font-size:18px;outline:none;margin-bottom:8px;}
.cost-sales-input:focus{border-color:var(--owner-gold);}
.cost-sales-label{font-size:11px;color:var(--ash);margin-bottom:4px;}
.lr-balance-row{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(42,42,42,0.4);font-size:13px;}
.lr-balance-row:last-child{border-bottom:none;}
.lr-variance-ok{color:#81C784;font-family:var(--font-display);font-size:18px;}
.lr-variance-bad{color:var(--ember);font-family:var(--font-display);font-size:18px;}
.cost-filter-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;align-items:center;}
.cost-filter-btn{padding:5px 14px;border-radius:999px;border:1px solid var(--graphite);background:none;color:var(--ash);font-family:var(--font-body);font-size:12px;cursor:pointer;transition:all 150ms;}
.cost-filter-btn:hover{border-color:var(--owner-gold);color:var(--owner-gold);}
.cost-filter-btn.active{border-color:var(--owner-gold);color:var(--owner-gold);background:rgba(218,165,32,0.1);}
.cost-export-btn{padding:7px 16px;border-radius:6px;border:1px solid var(--graphite);background:none;color:var(--ash);font-family:var(--font-label);font-size:10px;letter-spacing:0.15em;cursor:pointer;transition:all 150ms;}
.cost-export-btn:hover{border-color:var(--owner-gold);color:var(--owner-gold);}
</style>

<div style="display:grid;grid-template-columns:260px 1fr;gap:24px;" id="costLayout">
  <!-- Sidebar: period list -->
  <div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
      <div style="font-family:var(--font-label);font-size:10px;letter-spacing:0.3em;color:var(--owner-gold);">PERIODS</div>
      <button onclick="costOpenNewPeriodModal()"
        style="padding:7px 14px;background:linear-gradient(135deg,var(--owner-accent),var(--owner-gold));border:none;border-radius:6px;color:#fff;font-family:var(--font-label);font-size:11px;letter-spacing:0.12em;cursor:pointer;">
        + New Period
      </button>
    </div>
    <!-- Period search -->
    <input id="costPeriodSearch" type="text" placeholder="Search week ending…"
      oninput="costFilterPeriods(this.value)"
      style="width:100%;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:8px 12px;color:var(--ivory);font-family:var(--font-body);font-size:13px;outline:none;margin-bottom:12px;" />
    <!-- Period type filter -->
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
      <button class="cost-filter-btn active" data-pfilter="all" onclick="costSetPeriodFilter('all',this)">All</button>
      <button class="cost-filter-btn" data-pfilter="week" onclick="costSetPeriodFilter('week',this)">Week</button>
      <button class="cost-filter-btn" data-pfilter="month" onclick="costSetPeriodFilter('month',this)">Month</button>
      <button class="cost-filter-btn" data-pfilter="quarter" onclick="costSetPeriodFilter('quarter',this)">Quarter</button>
    </div>
    <div id="costPeriodList" style="display:flex;flex-direction:column;gap:8px;max-height:600px;overflow-y:auto;">
      <div style="text-align:center;padding:32px;color:var(--ash);font-size:13px;">Loading periods…</div>
    </div>
  </div>

  <!-- Main: report area -->
  <div id="costMainArea">
    <div style="text-align:center;padding:64px 20px;color:var(--ash);">
      <div style="font-size:32px;margin-bottom:12px;opacity:0.2;">◑</div>
      <div style="font-family:var(--font-display);font-size:20px;font-weight:300;color:var(--ivory);margin-bottom:6px;">Select a period</div>
      <div style="font-size:13px;">Choose a period from the left or create a new one.</div>
    </div>
  </div>
</div>

<!-- New Period Modal -->
<div id="costNewPeriodModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:2000;align-items:center;justify-content:center;padding:20px;">
  <div style="background:var(--carbon);border:1px solid rgba(218,165,32,0.4);border-radius:12px;padding:32px 28px;width:100%;max-width:440px;box-shadow:0 8px 48px rgba(0,0,0,0.6);max-height:90vh;overflow-y:auto;">
    <div style="font-family:var(--font-display);font-size:24px;font-weight:300;font-style:italic;color:var(--ivory);margin-bottom:4px;">New Cost Period</div>
    <div style="font-size:12px;color:var(--ash);margin-bottom:24px;">Starting inventory is auto-pulled from the previous period's ending counts.</div>
    <div style="margin-bottom:16px;">
      <label style="display:block;font-family:var(--font-label);font-size:10px;letter-spacing:0.25em;color:var(--owner-gold);margin-bottom:6px;">WEEK ENDING DATE</label>
      <input type="date" id="costNewWeekEnding"
        style="width:100%;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:11px 14px;color:var(--ivory);font-family:var(--font-body);font-size:14px;outline:none;" />
    </div>
    <div style="margin-bottom:16px;">
      <label style="display:block;font-family:var(--font-label);font-size:10px;letter-spacing:0.25em;color:var(--owner-gold);margin-bottom:6px;">PERIOD TYPE</label>
      <select id="costNewPeriodType"
        style="width:100%;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:11px 14px;color:var(--ivory);font-family:var(--font-body);font-size:14px;outline:none;-webkit-appearance:none;">
        <option value="week">Weekly</option>
        <option value="biweek">Bi-Weekly</option>
        <option value="month">Monthly</option>
        <option value="quarter">Quarterly</option>
        <option value="custom">Custom</option>
      </select>
    </div>
    <div style="margin-bottom:16px;" id="costNewDateStartWrap">
      <label style="display:block;font-family:var(--font-label);font-size:10px;letter-spacing:0.25em;color:var(--owner-gold);margin-bottom:6px;">PERIOD START DATE</label>
      <input type="date" id="costNewDateStart"
        style="width:100%;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:11px 14px;color:var(--ivory);font-family:var(--font-body);font-size:14px;outline:none;" />
    </div>
    <div style="background:rgba(218,165,32,0.05);border:1px solid rgba(218,165,32,0.2);border-radius:8px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:var(--ash);line-height:1.7;" id="costNewPreview">
      Select a week ending date to preview.
    </div>
    <div style="display:flex;gap:10px;">
      <button onclick="costCreatePeriod()"
        style="flex:1;padding:13px;border-radius:6px;background:linear-gradient(135deg,var(--owner-accent),var(--owner-gold));border:none;color:#fff;font-family:var(--font-label);font-size:13px;letter-spacing:0.15em;cursor:pointer;">
        Create Period
      </button>
      <button onclick="costCloseNewPeriodModal()"
        style="padding:13px 20px;border-radius:6px;background:none;border:1px solid var(--graphite);color:var(--ash);font-family:var(--font-body);font-size:13px;cursor:pointer;">
        Cancel
      </button>
    </div>
  </div>
</div>
`;
}

// ── Period loading & listing ────────────────────────────────────────
async function costLoadPeriods() {
  const { data, error } = await supabaseClient
    .from('inv_cost_periods')
    .select('*')
    .order('week_ending', { ascending: false });
  costPeriods = data || [];
  costRenderPeriodList(costPeriods);
}

function costRenderPeriodList(periods) {
  const el = document.getElementById('costPeriodList');
  if (!el) return;
  if (!periods.length) {
    el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--ash);font-size:13px;font-style:italic;">No periods yet. Create one to start tracking cost.</div>`;
    return;
  }
  el.innerHTML = periods.map(p => {
    const we    = new Date(p.week_ending + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const isAct = costActivePeriod?.id === p.id;
    return `<div class="cost-period-row ${isAct ? 'active' : ''}" onclick="costSelectPeriod('${p.id}')">
      <div>
        <div class="cost-period-date">Week ending ${we}</div>
        <div style="font-size:11px;color:var(--ash);margin-top:2px;text-transform:uppercase;letter-spacing:0.1em;">${p.period_type}</div>
      </div>
      <span class="cost-period-status ${p.status}">${p.status}</span>
    </div>`;
  }).join('');
}

function costFilterPeriods(q) {
  let filtered = costPeriods;
  const pf     = document.querySelector('.cost-filter-btn.active[data-pfilter]')?.dataset.pfilter || 'all';
  if (pf !== 'all') filtered = filtered.filter(p => p.period_type === pf);
  if (q.trim()) filtered = filtered.filter(p => p.week_ending.includes(q) || p.period_type.includes(q));
  costRenderPeriodList(filtered);
}

function costSetPeriodFilter(val, btn) {
  document.querySelectorAll('.cost-filter-btn[data-pfilter]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  costFilterPeriods(document.getElementById('costPeriodSearch')?.value || '');
}

async function costSelectPeriod(id) {
  costActivePeriod = costPeriods.find(p => p.id === id);
  if (!costActivePeriod) return;
  costRenderPeriodList(costPeriods);
  await costLoadPeriodData();
  costRenderMain();
}

async function costLoadPeriodData() {
  if (!costActivePeriod) return;
  const pid = costActivePeriod.id;
  const { data: lines } = await supabaseClient
    .from('inv_cost_lines').select('*').eq('period_id', pid);
  costLines = lines || [];

  const { data: sales } = await supabaseClient
    .from('inv_sales_entries').select('*').eq('period_id', pid);
  costSales = {};
  if (sales) sales.forEach(s => { costSales[s.location] = { total_sales: s.total_sales||0, total_comps: s.total_comps||0 }; });
}

// ── Main report render ─────────────────────────────────────────────
function costRenderMain() {
  const el = document.getElementById('costMainArea');
  if (!el || !costActivePeriod) return;
  const p        = costActivePeriod;
  const we       = new Date(p.week_ending + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const locked   = p.status === 'finalized';

  el.innerHTML = `
    <!-- Period header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
      <div>
        <div style="font-family:var(--font-label);font-size:11px;letter-spacing:0.3em;color:var(--owner-gold);margin-bottom:2px;">COST REPORT</div>
        <div style="font-family:var(--font-display);font-size:26px;font-weight:300;color:var(--ivory);">Week Ending ${we}</div>
        <div style="font-size:12px;color:var(--ash);margin-top:2px;">${p.period_type.toUpperCase()} · ${locked ? '🔒 Finalized' : '✎ Draft'}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        ${locked
          ? `<button onclick="costUnlockPeriod()" style="padding:8px 16px;border-radius:6px;border:1px solid rgba(218,165,32,0.4);background:none;color:var(--owner-gold);font-family:var(--font-label);font-size:10px;letter-spacing:0.15em;cursor:pointer;">🔓 Unlock</button>`
          : `<button onclick="costFinalizePeriod()" style="padding:8px 16px;border-radius:6px;background:linear-gradient(135deg,var(--owner-accent),var(--owner-gold));border:none;color:#fff;font-family:var(--font-label);font-size:10px;letter-spacing:0.15em;cursor:pointer;">✓ Finalize</button>`
        }
        <button class="cost-export-btn" onclick="costExportCSV()">↓ CSV</button>
        <button class="cost-export-btn" onclick="costExportPDF()">↓ PDF</button>
      </div>
    </div>

    <!-- View toggle: Cost / LR Balance -->
    <div style="display:flex;gap:6px;margin-bottom:20px;border-bottom:1px solid var(--graphite);padding-bottom:14px;flex-wrap:wrap;align-items:center;">
      <button class="cost-filter-btn ${costReportView==='cost'?'active':''}" onclick="costSetView('cost',this)">◑ Cost Report</button>
      <button class="cost-filter-btn ${costReportView==='lr'?'active':''}" onclick="costSetView('lr',this)">⊡ LR Balance</button>
      <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;">
        <button class="cost-filter-btn ${costReportLoc==='house'?'active':''}" onclick="costSetLoc('house',this)">House</button>
        ${INV_BAR_LOCATIONS.map(l => `<button class="cost-filter-btn ${costReportLoc===l?'active':''}" onclick="costSetLoc('${l}',this)">${l}</button>`).join('')}
      </div>
    </div>

    <!-- Sales entry -->
    ${!locked ? costSalesEntryHtml() : ''}

    <!-- KPIs -->
    <div class="cost-kpi-row" id="costKpiRow"></div>

    <!-- Report body -->
    <div id="costReportBody"></div>
  `;

  costRenderKpis();
  costRenderReportBody();
}

function costSalesEntryHtml() {
  const locs = costReportLoc === 'house' ? INV_BAR_LOCATIONS : [costReportLoc];
  if (costReportView === 'lr') return '';
  return `
    <div style="margin-bottom:20px;">
      <div style="font-family:var(--font-label);font-size:10px;letter-spacing:0.3em;color:var(--owner-gold);margin-bottom:10px;">SALES & COMPS INPUT</div>
      <div class="cost-sales-grid">
        ${locs.map(loc => {
          const s = costSales[loc] || {};
          return `<div class="cost-sales-card">
            <div class="cost-sales-loc">${loc}</div>
            <div class="cost-sales-label">Total Sales $</div>
            <input class="cost-sales-input" type="number" min="0" step="0.01"
              placeholder="0.00" value="${s.total_sales || ''}"
              data-loc="${loc}" data-field="total_sales"
              onchange="costSaveSalesEntry(this)" />
            <div class="cost-sales-label">Total Comps $</div>
            <input class="cost-sales-input" type="number" min="0" step="0.01"
              placeholder="0.00" value="${s.total_comps || ''}"
              data-loc="${loc}" data-field="total_comps"
              onchange="costSaveSalesEntry(this)" />
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function costRenderKpis() {
  const el = document.getElementById('costKpiRow');
  if (!el) return;

  if (costReportView === 'lr') {
    // LR: show variance stats
    const lrLines = costLines.filter(l => l.location === 'LR');
    const totalVariance = lrLines.reduce((s,l) => s + (l.variance||0), 0);
    const outItems = lrLines.filter(l => Math.abs(l.variance||0) > 0.5).length;
    el.innerHTML = `
      <div class="cost-kpi ${Math.abs(totalVariance)>1?'alert':''}">
        <div class="cost-kpi-label">Total Variance</div>
        <div class="cost-kpi-val">${totalVariance>=0?'+':''}${totalVariance.toFixed(1)}</div>
        <div class="cost-kpi-sub">Bottles · Target 0.0</div>
      </div>
      <div class="cost-kpi">
        <div class="cost-kpi-label">Items Off</div>
        <div class="cost-kpi-val">${outItems}</div>
        <div class="cost-kpi-sub">Products with variance > ±0.5</div>
      </div>
      <div class="cost-kpi">
        <div class="cost-kpi-label">Products Tracked</div>
        <div class="cost-kpi-val">${lrLines.length}</div>
        <div class="cost-kpi-sub">In LR this period</div>
      </div>
      <div class="cost-kpi">
        <div class="cost-kpi-label">Status</div>
        <div class="cost-kpi-val" style="font-size:22px;${Math.abs(totalVariance)<0.5?'color:#81C784':'color:var(--ember)'}">
          ${Math.abs(totalVariance)<0.5?'Balanced':'Review'}
        </div>
        <div class="cost-kpi-sub">LR balance check</div>
      </div>`;
    return;
  }

  // Bar cost report KPIs
  const locs   = costReportLoc === 'house' ? INV_BAR_LOCATIONS : [costReportLoc];
  const lines  = costLines.filter(l => locs.includes(l.location));
  const totalCost$  = lines.reduce((s,l) => s+(l.cost_dollars||0), 0);
  const totalSales  = locs.reduce((s,loc) => s+(costSales[loc]?.total_sales||0), 0);
  const totalComps  = locs.reduce((s,loc) => s+(costSales[loc]?.total_comps||0), 0);
  const costPct     = totalSales > 0 ? (totalCost$ / totalSales * 100) : null;
  const pctClass    = costPct === null ? '' : costPct <= 25 ? '' : costPct <= 32 ? 'alert' : 'alert';
  const pctColor    = costPct === null ? 'var(--ash)' : costPct <= 25 ? '#81C784' : costPct <= 32 ? 'var(--gold-warm)' : 'var(--ember)';

  el.innerHTML = `
    <div class="cost-kpi">
      <div class="cost-kpi-label">Cost $</div>
      <div class="cost-kpi-val">$${totalCost$.toFixed(0)}</div>
      <div class="cost-kpi-sub">Total cost of usage</div>
    </div>
    <div class="cost-kpi">
      <div class="cost-kpi-label">Sales</div>
      <div class="cost-kpi-val">$${totalSales.toFixed(0)}</div>
      <div class="cost-kpi-sub">Total bar sales entered</div>
    </div>
    <div class="cost-kpi">
      <div class="cost-kpi-label">Comps</div>
      <div class="cost-kpi-val">$${totalComps.toFixed(0)}</div>
      <div class="cost-kpi-sub">Total comped</div>
    </div>
    <div class="cost-kpi ${pctClass}">
      <div class="cost-kpi-label">Cost %</div>
      <div class="cost-kpi-val" style="color:${pctColor};">${costPct !== null ? costPct.toFixed(1)+'%' : '—'}</div>
      <div class="cost-kpi-sub">${costPct === null ? 'Enter sales to calculate' : costPct<=25?'On target':costPct<=32?'Watch':'Above target'}</div>
    </div>`;
}

function costRenderReportBody() {
  const el = document.getElementById('costReportBody');
  if (!el) return;

  if (costReportView === 'lr') { costRenderLRBalance(el); return; }

  const locs  = costReportLoc === 'house' ? INV_BAR_LOCATIONS : [costReportLoc];
  const lines = costLines.filter(l => locs.includes(l.location));

  if (!lines.length) {
    el.innerHTML = `<div style="text-align:center;padding:48px;color:var(--ash);font-size:13px;font-style:italic;">
      No cost lines for this period. Use "Pull from Counts" to populate.
    </div>
    <div style="text-align:center;margin-top:0;">
      <button onclick="costPullFromCounts()"
        style="padding:11px 24px;border-radius:6px;background:linear-gradient(135deg,var(--owner-accent),var(--owner-gold));border:none;color:#fff;font-family:var(--font-label);font-size:12px;letter-spacing:0.15em;cursor:pointer;">
        ⬇ Pull Counts from Inventory Sessions
      </button>
    </div>`;
    return;
  }

  // Group by category
  const byCat = {};
  lines.forEach(l => {
    const p = invMgrProducts.find(pr => pr.id === l.product_id);
    if (!p) return;
    const cat = p.category || 'OTHER';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push({ l, p });
  });

  const totalSales = locs.reduce((s,loc) => s+(costSales[loc]?.total_sales||0), 0);
  const sorted     = INV_CAT_ORDER.filter(c => byCat[c]).concat(Object.keys(byCat).filter(c => !INV_CAT_ORDER.includes(c)));

  const pullBtn = costActivePeriod?.status !== 'finalized'
    ? `<button onclick="costPullFromCounts()" style="padding:7px 16px;border-radius:6px;border:1px solid rgba(218,165,32,0.4);background:none;color:var(--owner-gold);font-family:var(--font-label);font-size:10px;letter-spacing:0.12em;cursor:pointer;margin-bottom:16px;">↺ Refresh from Counts</button>`
    : '';

  el.innerHTML = pullBtn + sorted.map(cat => {
    const rows = byCat[cat];
    const catCost = rows.reduce((s,{l}) => s+(l.cost_dollars||0), 0);
    const catPct  = totalSales>0 ? (catCost/totalSales*100) : null;
    const pctStr  = catPct !== null ? catPct.toFixed(1)+'%' : '—';
    const pctCls  = catPct === null ? '' : catPct<=8?'ok':catPct<=14?'warn':'alert';

    const rowsHtml = rows.map(({l,p}) => {
      const usage   = l.usage || 0;
      const cost$   = l.cost_dollars || 0;
      const pPct    = totalSales>0 ? (cost$/totalSales*100) : null;
      const pPctCls = pPct===null?'':pPct<=4?'ok':pPct<=8?'warn':'alert';
      return `<tr>
        <td style="padding-left:24px;">${p.name}</td>
        <td class="num">${(l.start_qty||0)%1===0?(l.start_qty||0):(l.start_qty||0).toFixed(1)}</td>
        <td class="num">${(l.orders_in||0)%1===0?(l.orders_in||0):(l.orders_in||0).toFixed(1)}</td>
        <td class="num" style="color:rgba(192,57,43,0.7);">${(l.pulls_out||0)>0?'−'+(l.pulls_out||0).toFixed(1):''}</td>
        <td class="num">${(l.end_qty||0)%1===0?(l.end_qty||0):(l.end_qty||0).toFixed(1)}</td>
        <td class="num" style="color:var(--mist);">${usage%1===0?usage:usage.toFixed(1)}</td>
        <td class="num">$${(p.cost||0).toFixed(2)}</td>
        <td class="num" style="color:var(--ivory);">$${cost$.toFixed(2)}</td>
        <td class="num"><span class="cost-pct ${pPctCls}">${pPct!==null?pPct.toFixed(1)+'%':'—'}</span></td>
      </tr>`;
    }).join('');

    return `<div class="panel" style="padding:0;overflow:hidden;overflow-x:auto;margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(218,165,32,0.04);border-bottom:1px solid var(--graphite);">
        <span style="font-family:var(--font-label);font-size:11px;letter-spacing:0.25em;color:var(--owner-gold);">${cat}</span>
        <span style="display:flex;align-items:center;gap:12px;font-size:12px;color:var(--ash);">
          Cost: <span style="color:var(--ivory);font-family:var(--font-display);font-size:15px;">$${catCost.toFixed(0)}</span>
          &nbsp;of Sales: <span class="cost-pct ${pctCls}">${pctStr}</span>
        </span>
      </div>
      <table class="cost-tbl" style="min-width:700px;">
        <thead><tr>
          <th>Product</th>
          <th class="num">Start</th>
          <th class="num">+Orders</th>
          <th class="num">−Pulls</th>
          <th class="num">End</th>
          <th class="num">Usage</th>
          <th class="num">Unit $</th>
          <th class="num">Cost $</th>
          <th class="num">% Sales</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
  }).join('');
}

function costRenderLRBalance(el) {
  const lrLines = costLines.filter(l => l.location === 'LR');
  if (!lrLines.length) {
    el.innerHTML = `<div style="text-align:center;padding:48px;color:var(--ash);font-size:13px;font-style:italic;">No LR data for this period.</div>
    <div style="text-align:center;"><button onclick="costPullFromCounts()" style="padding:11px 24px;border-radius:6px;background:linear-gradient(135deg,var(--owner-accent),var(--owner-gold));border:none;color:#fff;font-family:var(--font-label);font-size:12px;letter-spacing:0.15em;cursor:pointer;">⬇ Pull Counts</button></div>`;
    return;
  }

  const byCat = {};
  lrLines.forEach(l => {
    const p = invMgrProducts.find(pr => pr.id === l.product_id);
    if (!p) return;
    if (!byCat[p.category]) byCat[p.category] = [];
    byCat[p.category].push({ l, p });
  });

  const sorted = INV_CAT_ORDER.filter(c => byCat[c]).concat(Object.keys(byCat).filter(c => !INV_CAT_ORDER.includes(c)));

  el.innerHTML = sorted.map(cat => {
    const rows = byCat[cat].map(({l,p}) => {
      const variance = l.variance ?? (l.start_qty + l.orders_in - (l.pulls_out||0) - l.end_qty);
      const varCls   = Math.abs(variance) < 0.5 ? 'lr-variance-ok' : 'lr-variance-bad';
      return `<div class="lr-balance-row">
        <span style="flex:1;font-size:13px;color:var(--mist);">${p.name}</span>
        <span style="min-width:60px;text-align:right;font-family:var(--font-display);font-size:14px;color:var(--ash);">${(l.start_qty||0).toFixed(1)}</span>
        <span style="min-width:60px;text-align:right;font-family:var(--font-display);font-size:14px;color:var(--ash);">+${(l.orders_in||0).toFixed(1)}</span>
        <span style="min-width:60px;text-align:right;font-family:var(--font-display);font-size:14px;color:rgba(192,57,43,0.7);">${(l.pulls_out||0)>0?'−'+(l.pulls_out||0).toFixed(1):''}</span>
        <span style="min-width:60px;text-align:right;font-family:var(--font-display);font-size:14px;color:var(--mist);">${(l.end_qty||0).toFixed(1)}</span>
        <span style="min-width:80px;text-align:right;" class="${varCls}">${variance>=0?'+':''}${variance.toFixed(1)}</span>
      </div>`;
    }).join('');

    return `<div class="panel" style="margin-bottom:16px;">
      <div style="font-family:var(--font-label);font-size:10px;letter-spacing:0.25em;color:var(--owner-gold);margin-bottom:4px;">${cat}</div>
      <div style="display:flex;justify-content:flex-end;gap:24px;font-family:var(--font-label);font-size:9px;letter-spacing:0.15em;color:var(--ash);padding:4px 0 8px;border-bottom:1px solid var(--graphite);margin-bottom:4px;">
        <span style="min-width:60px;text-align:right;">START</span>
        <span style="min-width:60px;text-align:right;">ORDERS</span>
        <span style="min-width:60px;text-align:right;">PULLS</span>
        <span style="min-width:60px;text-align:right;">END</span>
        <span style="min-width:80px;text-align:right;color:var(--owner-gold);">VARIANCE</span>
      </div>
      ${rows}
    </div>`;
  }).join('');
}

// ── Pull counts into cost lines ────────────────────────────────────
async function costPullFromCounts() {
  if (!costActivePeriod) return;
  if (costActivePeriod.status === 'finalized') { showToast('Period is finalized — unlock first', ''); return; }

  const pid = costActivePeriod.id;
  const we  = costActivePeriod.week_ending;
  showToast('Pulling counts…', '');

  // Load all sessions for this week_ending across all locations
  const { data: sessions } = await supabaseClient
    .from('inv_sessions').select('id, location')
    .eq('week_of', we);

  const endCounts = {}; // { product_id: { location: qty } }
  for (const sess of (sessions||[])) {
    const { data: counts } = await supabaseClient
      .from('inv_counts').select('product_id, quantity').eq('session_id', sess.id);
    if (counts) counts.forEach(c => {
      if (!endCounts[c.product_id]) endCounts[c.product_id] = {};
      endCounts[c.product_id][sess.location] = (endCounts[c.product_id][sess.location]||0) + c.quantity;
    });
  }

  // Pull confirmed orders for this week
  const { data: orders } = await supabaseClient
    .from('inv_orders').select('product_id, confirmed_cases, case_price, distributor')
    .eq('week_of', we).eq('status','confirmed');

  const ordersIn = {}; // { product_id: cases (need ×case_size for bottles) }
  if (orders) orders.forEach(o => { ordersIn[o.product_id] = (ordersIn[o.product_id]||0) + o.confirmed_cases; });

  // Pull stock-up requests (bar pulls from LR)
  const { data: stockUps } = await supabaseClient
    .from('inv_stock_ups').select('product_id, quantity, from_location')
    .eq('report_date', we);

  const pulls = {}; // { product_id: qty } — total pulled from LR
  if (stockUps) stockUps.forEach(s => { pulls[s.product_id] = (pulls[s.product_id]||0) + s.quantity; });

  // Get starting quantities from previous period's cost lines
  const prevPeriodId = await costGetPrevPeriodId();
  const startQtys    = {}; // { product_id: { location: qty } }
  if (prevPeriodId) {
    const { data: prevLines } = await supabaseClient
      .from('inv_cost_lines').select('product_id, location, end_qty')
      .eq('period_id', prevPeriodId);
    if (prevLines) prevLines.forEach(l => {
      if (!startQtys[l.product_id]) startQtys[l.product_id] = {};
      startQtys[l.product_id][l.location] = l.end_qty || 0;
    });
  }

  // Build upsert rows for every product × location with any data
  const rows = [];
  const productIds = new Set([
    ...Object.keys(endCounts),
    ...Object.keys(ordersIn),
    ...Object.keys(pulls),
    ...Object.keys(startQtys)
  ]);

  for (const pid_prod of productIds) {
    const product = invMgrProducts.find(p => p.id === pid_prod);
    if (!product) continue;

    for (const loc of INV_LOCATIONS) {
      const endQty   = endCounts[pid_prod]?.[loc] ?? 0;
      const startQty = startQtys[pid_prod]?.[loc] ?? 0;
      // Orders in: convert cases to bottles — LR only gets full order deliveries
      const ordersBottles = loc === 'LR' ? (ordersIn[pid_prod]||0) * (product.case_size||1) : 0;
      // Pulls: LR only — stock-up requests
      const pullsOut  = loc === 'LR' ? (pulls[pid_prod]||0) : 0;

      if (endQty === 0 && startQty === 0 && ordersBottles === 0 && pullsOut === 0) continue;

      rows.push({
        period_id:  pid,
        product_id: pid_prod,
        location:   loc,
        start_qty:  startQty,
        orders_in:  ordersBottles,
        pulls_out:  pullsOut,
        end_qty:    endQty,
        unit_cost:  product.cost || 0
      });
    }
  }

  if (!rows.length) { showToast('No count data found for this period', ''); return; }

  const { error } = await supabaseClient.from('inv_cost_lines')
    .upsert(rows, { onConflict: 'period_id,product_id,location' });

  if (error) { showToast('Error pulling counts: ' + error.message, ''); return; }

  await costLoadPeriodData();
  costRenderMain();
  showToast(`${rows.length} cost lines updated`, 'success');
}

async function costGetPrevPeriodId() {
  if (!costActivePeriod) return null;
  const { data } = await supabaseClient
    .from('inv_cost_periods').select('id, week_ending')
    .lt('week_ending', costActivePeriod.week_ending)
    .order('week_ending', { ascending: false })
    .limit(1);
  return data?.[0]?.id || null;
}

// ── Sales entry save ───────────────────────────────────────────────
async function costSaveSalesEntry(input) {
  if (!costActivePeriod) return;
  const loc   = input.dataset.loc;
  const field = input.dataset.field;
  const val   = parseFloat(input.value) || 0;
  if (!costSales[loc]) costSales[loc] = { total_sales: 0, total_comps: 0 };
  costSales[loc][field] = val;

  const { error } = await supabaseClient.from('inv_sales_entries').upsert({
    period_id:    costActivePeriod.id,
    location:     loc,
    total_sales:  costSales[loc].total_sales,
    total_comps:  costSales[loc].total_comps,
    entered_by:   'owner'
  }, { onConflict: 'period_id,location' });

  if (error) { showToast('Error saving sales', ''); return; }
  costRenderKpis();
  costRenderReportBody();
}

// ── Finalize / unlock ──────────────────────────────────────────────
async function costFinalizePeriod() {
  if (!costActivePeriod) return;
  if (!confirm('Finalize this period? Ending counts will become starting numbers for the next period. You can unlock it later if needed.')) return;
  const { error } = await supabaseClient.from('inv_cost_periods')
    .update({ status: 'finalized', finalized_by: 'owner', finalized_at: new Date().toISOString() })
    .eq('id', costActivePeriod.id);
  if (error) { showToast('Error finalizing', ''); return; }
  costActivePeriod.status = 'finalized';
  await costLoadPeriods();
  costRenderMain();
  showToast('Period finalized', 'success');
}

async function costUnlockPeriod() {
  if (!costActivePeriod) return;
  if (!confirm('Unlock this finalized period? The next period\'s starting numbers may need to be refreshed.')) return;
  const { error } = await supabaseClient.from('inv_cost_periods')
    .update({ status: 'draft', unlocked_by: 'owner', unlocked_at: new Date().toISOString() })
    .eq('id', costActivePeriod.id);
  if (error) { showToast('Error unlocking', ''); return; }
  costActivePeriod.status = 'draft';
  await costLoadPeriods();
  costRenderMain();
  showToast('Period unlocked', 'success');
}

// ── New period modal ───────────────────────────────────────────────
function costOpenNewPeriodModal() {
  const modal = document.getElementById('costNewPeriodModal');
  if (!modal) return;
  modal.style.display = 'flex';
  // Default to next Sunday
  const d = new Date();
  d.setDate(d.getDate() + (7 - d.getDay()) % 7 || 7);
  document.getElementById('costNewWeekEnding').value = d.toISOString().slice(0,10);
  document.getElementById('costNewPeriodType').value = 'week';
  costUpdateNewPeriodPreview();
}

function costCloseNewPeriodModal() {
  const modal = document.getElementById('costNewPeriodModal');
  if (modal) modal.style.display = 'none';
}

function costUpdateNewPeriodPreview() {
  const we   = document.getElementById('costNewWeekEnding')?.value;
  const type = document.getElementById('costNewPeriodType')?.value || 'week';
  const prev = document.getElementById('costNewPreview');
  if (!prev || !we) return;
  const end    = new Date(we + 'T12:00:00');
  const days   = { week:7, biweek:14, month:28, quarter:91, custom:7 }[type] || 7;
  const start  = new Date(end); start.setDate(start.getDate() - days + 1);
  const prevPeriod = costPeriods.find(p => new Date(p.week_ending + 'T12:00:00') < end);
  const startStr   = start.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  const endStr     = end.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  document.getElementById('costNewDateStart').value = start.toISOString().slice(0,10);
  prev.innerHTML = `Period: <strong style="color:var(--ivory);">${startStr} → ${endStr}</strong><br>
    Starting inventory: <strong style="color:var(--ivory);">${prevPeriod ? 'Auto-pulled from week ending '+prevPeriod.week_ending : 'No previous period — manual entry required'}</strong>`;
}

async function costCreatePeriod() {
  const we    = document.getElementById('costNewWeekEnding')?.value;
  const type  = document.getElementById('costNewPeriodType')?.value || 'week';
  const start = document.getElementById('costNewDateStart')?.value;
  if (!we) { showToast('Choose a week ending date', ''); return; }

  // Check for duplicate
  if (costPeriods.find(p => p.week_ending === we)) {
    showToast('A period for that week ending already exists', ''); return;
  }

  const { data, error } = await supabaseClient.from('inv_cost_periods').insert({
    week_ending:  we,
    period_type:  type,
    date_start:   start || we,
    date_end:     we,
    status:       'draft',
    created_by:   'owner'
  }).select().single();

  if (error) { showToast('Error creating period: ' + error.message, ''); return; }
  costCloseNewPeriodModal();
  await costLoadPeriods();
  costSelectPeriod(data.id);
  showToast('Period created', 'success');
}

// ── View / location toggles ────────────────────────────────────────
function costSetView(view, btn) {
  costReportView = view;
  document.querySelectorAll('#costMainArea .cost-filter-btn').forEach(b => {
    if (['cost','lr'].includes(b.textContent.trim().replace(/[◑⊡ ]/g,''))) return;
    b.classList.remove('active');
  });
  costRenderMain();
}

function costSetLoc(loc, btn) {
  costReportLoc = loc;
  costRenderMain();
}

// ── Export ─────────────────────────────────────────────────────────
function costExportCSV() {
  if (!costActivePeriod) return;
  const we    = costActivePeriod.week_ending;
  const locs  = costReportLoc === 'house' ? INV_BAR_LOCATIONS : [costReportLoc];
  const lines = costLines.filter(l => locs.includes(l.location));
  const totalSales = locs.reduce((s,loc) => s+(costSales[loc]?.total_sales||0), 0);

  let csv = `Week Ending,${we}\n`;
  csv += `Period Type,${costActivePeriod.period_type}\n`;
  csv += `Location,${costReportLoc === 'house' ? 'House (All Bars)' : costReportLoc}\n`;
  csv += `Total Sales,$${totalSales.toFixed(2)}\n\n`;
  csv += `Product,Category,Location,Start,Orders In,Pulls Out,End,Usage,Unit Cost,Cost $,Cost %\n`;

  lines.forEach(l => {
    const p       = invMgrProducts.find(pr => pr.id === l.product_id);
    if (!p) return;
    const usage   = l.usage || 0;
    const cost$   = l.cost_dollars || 0;
    const pct     = totalSales > 0 ? (cost$/totalSales*100).toFixed(2) : '';
    csv += `"${p.name}","${p.category}","${l.location}",${l.start_qty||0},${l.orders_in||0},${l.pulls_out||0},${l.end_qty||0},${usage.toFixed(2)},${p.cost||0},${cost$.toFixed(2)},${pct}\n`;
  });

  // Totals
  const totalCost = lines.reduce((s,l) => s+(l.cost_dollars||0), 0);
  const costPct   = totalSales > 0 ? (totalCost/totalSales*100).toFixed(2) : '';
  csv += `\nTOTAL,,,,,,,,$${totalCost.toFixed(2)},${costPct ? costPct+'%' : ''}\n`;

  // Sales by location
  csv += `\nSALES BY LOCATION\n`;
  locs.forEach(loc => {
    const s = costSales[loc] || {};
    csv += `${loc},$${(s.total_sales||0).toFixed(2)},Comps,$${(s.total_comps||0).toFixed(2)}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `cost_report_${we}_${costReportLoc}.csv`;
  a.click();
  showToast('CSV exported', 'success');
}

function costExportPDF() {
  if (!costActivePeriod) return;
  const we    = costActivePeriod.week_ending;
  const locs  = costReportLoc === 'house' ? INV_BAR_LOCATIONS : [costReportLoc];
  const lines = costLines.filter(l => locs.includes(l.location));
  const totalSales = locs.reduce((s,loc) => s+(costSales[loc]?.total_sales||0), 0);
  const totalCost  = lines.reduce((s,l) => s+(l.cost_dollars||0), 0);
  const costPct    = totalSales > 0 ? (totalCost/totalSales*100).toFixed(1)+'%' : '—';

  // Group by category
  const byCat = {};
  lines.forEach(l => {
    const p = invMgrProducts.find(pr => pr.id === l.product_id);
    if (!p) return;
    if (!byCat[p.category]) byCat[p.category] = [];
    byCat[p.category].push({ l, p });
  });
  const sorted = INV_CAT_ORDER.filter(c => byCat[c]).concat(Object.keys(byCat).filter(c => !INV_CAT_ORDER.includes(c)));

  const catRows = sorted.map(cat => {
    const rows    = byCat[cat];
    const catCost = rows.reduce((s,{l}) => s+(l.cost_dollars||0), 0);
    const rowsHtml = rows.map(({l,p}) => {
      const usage = l.usage||0;
      const cost$ = l.cost_dollars||0;
      return `<tr>
        <td>${p.name}</td><td>${l.location}</td>
        <td class=r>${(l.start_qty||0).toFixed(1)}</td>
        <td class=r>${(l.orders_in||0).toFixed(1)}</td>
        <td class=r>${(l.end_qty||0).toFixed(1)}</td>
        <td class=r>${usage.toFixed(1)}</td>
        <td class=r>$${(p.cost||0).toFixed(2)}</td>
        <td class=r>$${cost$.toFixed(2)}</td>
      </tr>`;
    }).join('');
    return `<tr class=cat><td colspan=7>${cat}</td><td class=r>$${catCost.toFixed(0)}</td></tr>${rowsHtml}`;
  }).join('');

  const salesRows = locs.map(loc => {
    const s = costSales[loc]||{};
    return `<tr><td>${loc}</td><td class=r>$${(s.total_sales||0).toFixed(2)}</td><td class=r>$${(s.total_comps||0).toFixed(2)}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset=UTF-8>
  <title>Cost Report — ${we}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:32px;}
    h1{font-size:20px;margin-bottom:4px;}
    .meta{color:#555;font-size:11px;margin-bottom:20px;}
    .kpi-row{display:flex;gap:24px;margin-bottom:20px;}
    .kpi{border:1px solid #ddd;border-radius:6px;padding:12px 18px;min-width:120px;}
    .kpi-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.1em;}
    .kpi-val{font-size:24px;font-weight:bold;margin-top:2px;}
    table{width:100%;border-collapse:collapse;margin-bottom:20px;}
    th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#888;padding:7px 10px;border-bottom:2px solid #ddd;}
    th.r,td.r{text-align:right;}
    td{padding:6px 10px;border-bottom:1px solid #eee;}
    tr.cat td{font-weight:bold;background:#f5f5f5;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;padding:6px 10px;}
    .section-title{font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#333;margin:20px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px;}
    @media print{body{margin:16px;}}
  </style></head><body>
  <h1>Cost Report — Week Ending ${we}</h1>
  <div class=meta>${costActivePeriod.period_type.toUpperCase()} · ${costReportLoc === 'house' ? 'House (All Bars)' : costReportLoc} · ${costActivePeriod.status.toUpperCase()}</div>
  <div class=kpi-row>
    <div class=kpi><div class=kpi-label>Total Cost</div><div class=kpi-val>$${totalCost.toFixed(0)}</div></div>
    <div class=kpi><div class=kpi-label>Total Sales</div><div class=kpi-val>$${totalSales.toFixed(0)}</div></div>
    <div class=kpi><div class=kpi-label>Cost %</div><div class=kpi-val>${costPct}</div></div>
  </div>
  <div class=section-title>Cost Detail by Product</div>
  <table><thead><tr>
    <th>Product</th><th>Location</th>
    <th class=r>Start</th><th class=r>Orders</th><th class=r>End</th>
    <th class=r>Usage</th><th class=r>Unit $</th><th class=r>Cost $</th>
  </tr></thead><tbody>${catRows}</tbody></table>
  <div class=section-title>Sales by Location</div>
  <table><thead><tr><th>Location</th><th class=r>Sales $</th><th class=r>Comps $</th></tr></thead>
  <tbody>${salesRows}</tbody></table>
  <div style="font-size:10px;color:#aaa;margin-top:32px;">Generated ${new Date().toLocaleString()} · RIDDIM Supper Club · AG Entertainment</div>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

// ── Bind events on shell render ────────────────────────────────────
function costBindEvents() {
  const we  = document.getElementById('costNewWeekEnding');
  const typ = document.getElementById('costNewPeriodType');
  if (we)  we.addEventListener('change', costUpdateNewPeriodPreview);
  if (typ) typ.addEventListener('change', costUpdateNewPeriodPreview);
}

// ── goToTab hook ────────────────────────────────────────────────────
window.addEventListener('load', function() {
  const poll = setInterval(() => {
    if (typeof window.goToTab === 'function') {
      clearInterval(poll);
      const _orig = window.goToTab;
      window.goToTab = function(tabId) {
        _orig(tabId);
        if (tabId === 'invmgr' && !invMgrProducts.length) invMgrInit();
      };
    }
  }, 50);
});
