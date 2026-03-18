/* ═══════════════════════════════════════════════════════════════════
   DOOR 64 — OWNER INVENTORY MANAGER
   owner_inv.js · Session 58 · March 18, 2026
   Depends on: supabaseClient, showToast, goToTab (owner portal)
   ═══════════════════════════════════════════════════════════════════ */

const INV_LOCATIONS = ['LR','BAR1','BAR2','BAR3','BAR4','SVC'];
const INV_CAT_ORDER = ['COGNAC','VODKA','WHISKEY','TEQUILA','RUM','GIN','SCOTCH','CORDIAL','CHAMPAGNE','BEER','BEVERAGE'];

let invMgrTab       = 'staff';
let invMgrProducts  = [];
let invMgrPars      = {};
let invMgrPending   = {};
let invMgrOrders    = [];
let invMgrProductsF = [];
let invStaffList    = [];

async function invMgrInit() {
  await invMgrLoadProducts();
  await invMgrLoadPars();
  invMgrSetTab('staff', document.querySelector('.invmgr-tab[data-itab="staff"]'));
}

async function invMgrLoadProducts() {
  const { data } = await supabaseClient
    .from('inv_products').select('*').eq('active', true).order('category').order('name');
  invMgrProducts = data || [];
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
  ['staff','products','par','orders','house'].forEach(t => {
    const el = document.getElementById(`invmgr-${t}-area`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'staff')    invMgrRenderStaff();
  if (tab === 'products') invMgrRenderProducts();
  if (tab === 'par')      invMgrRenderPar();
  if (tab === 'orders')   invMgrRenderOrders();
  if (tab === 'house')    invMgrRenderHouse();
}

// ── STAFF ──────────────────────────────────────────────────────────
async function invMgrRenderStaff() {
  const tbody = document.getElementById('invStaffTableBody');
  if (!tbody) return;
  const { data } = await supabaseClient.from('inv_staff').select('*').order('name');
  invStaffList = data || [];
  if (!invStaffList.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--ash);font-style:italic;">No inventory staff yet. Add a Key Barback to get started.</td></tr>`;
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
          <span style="width:7px;height:7px;border-radius:50%;background:${s.active ? '#4CAF50' : 'var(--ash)'};"></span>
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
  const role = roleChoice === '2' ? 'manager' : 'key_barback';
  const digits = phone.replace(/\D/g, '');
  const e164 = digits.length === 10 ? '+1' + digits : '+' + digits;
  supabaseClient.from('inv_staff').insert({
    name: name.trim(), phone: e164, role, active: true, created_by: 'owner'
  }).then(({ error }) => {
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
  const pid = input.dataset.pid;
  const upc = input.value.trim();
  const { error } = await supabaseClient.from('inv_products').update({ upc: upc||null }).eq('id', pid);
  if (error) { showToast('Error saving UPC', ''); return; }
  const p = invMgrProducts.find(p => p.id === pid);
  if (p) p.upc = upc || null;
  input.classList.toggle('has-upc', !!upc);
  showToast(upc ? `UPC saved — ${p?.name}` : 'UPC cleared', 'success');
}

// ── PAR ────────────────────────────────────────────────────────────
function invMgrRenderPar() {
  const loc = document.getElementById('invMgrParLoc')?.value || 'LR';
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
  const loc = document.getElementById('invMgrParLoc')?.value || 'LR';
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
  const today = new Date().toISOString().slice(0,10);
  const allCounts = {};
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
    const total = rows.reduce((s,r) => s + (r.confirmed*(r.p.cost||0)*(r.p.case_size||1)), 0);
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
  const grid = document.getElementById('invMgrHouseGrid');
  const catFilter = document.getElementById('invMgrHouseCat')?.value || '';
  if (!grid) return;
  grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ash);grid-column:1/-1;">Loading…</div>';
  const today = new Date().toISOString().slice(0,10);
  const allCounts = {};
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
