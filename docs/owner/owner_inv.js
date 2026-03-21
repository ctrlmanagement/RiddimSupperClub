/* ═══════════════════════════════════════════════════════════════════
   AG ENTERTAINMENT — OWNER INVENTORY MANAGER
   owner_inv.js · Session 60 · March 2026
   Depends on: supabaseClient, showToast, goToTab (owner portal)
   S59: inv_cost_periods, inv_cost_lines, inv_sales_entries
   S60: inv_distributors, inv_price_history, BAR_CONFIG scalable
   ═══════════════════════════════════════════════════════════════════ */

// ── LOCATION CONFIG (mirrors inventory/index.html) ─────────────────
const BAR_CONFIG = [
  { id:'LR',    label:'Liquor Room', pos:null,     active:true  },
  { id:'BAR1',  label:'Bar 1',       pos:'POS 1',  active:true  },
  { id:'BAR2',  label:'Bar 2',       pos:'POS 2',  active:true  },
  { id:'BAR3',  label:'Bar 3',       pos:'POS 3',  active:true  },
  { id:'BAR4',  label:'Bar 4',       pos:'POS 4',  active:true  },
  { id:'BAR5',  label:'SVC',         pos:'POS 7',  active:true  },
  { id:'BAR6',  label:'Bar 6',       pos:'POS 5',  active:false },
  { id:'BAR7',  label:'Bar 7',       pos:'POS 6',  active:false },
  { id:'BAR8',  label:'Bar 8',       pos:'POS 8',  active:false },
  { id:'BAR9',  label:'Bar 9',       pos:'POS 9',  active:false },
  { id:'BAR10', label:'Bar 10',      pos:'POS 10', active:false },
];
const INV_LOCATIONS     = BAR_CONFIG.map(b => b.id);
const ACTIVE_LOCATIONS  = BAR_CONFIG.filter(b => b.active).map(b => b.id);
const INV_BAR_LOCATIONS = BAR_CONFIG.filter(b => b.active && b.id !== 'LR').map(b => b.id);
const INV_CAT_ORDER     = ['COGNAC','VODKA','WHISKEY','TEQUILA','RUM','GIN','SCOTCH','CORDIAL','CHAMPAGNE','BEER','BEVERAGE'];

let invMgrTab        = 'staff';
let invMgrProducts   = [];
let invMgrPars       = {};
let invMgrPending    = {};
let invMgrOrders     = [];
let invMgrProductsF  = [];
let invStaffList     = [];
let invDistributors  = [];   // inv_distributors cache

// ── Cost report state ─────────────────────────────────────────────
let costPeriods       = [];
let costActivePeriod  = null;   // full period object currently viewed
let costLines         = [];     // inv_cost_lines for active period
let costSales         = {};     // { location: { total_sales, total_comps } }
let costReportView    = 'cost'; // 'cost' | 'lr'
let costReportLoc     = 'house'; // 'house' | 'BAR1' … 'SVC'
let costPeriodFilter  = 'week'; // 'week' | 'biweek' | 'month' | 'quarter' | 'custom'

async function invMgrInit() {
  await invMgrLoadDistributors();
  await invMgrLoadProducts();
  await invMgrLoadPars();
  invMgrSetTab('staff', document.querySelector('.invmgr-tab[data-itab="staff"]'));
}

async function invMgrLoadDistributors() {
  const { data } = await supabaseClient.from('inv_distributors').select('*').order('name');
  invDistributors = data || [];
}

async function invMgrLoadProducts() {
  // Try with distributor join first; fall back to plain select if table not yet migrated
  let data = null;
  const { data: d1, error: e1 } = await supabaseClient
    .from('inv_products').select('*, inv_distributors(name)').order('category').order('name');
  if (e1) {
    // Fallback — inv_distributors table may not exist yet
    const { data: d2 } = await supabaseClient
      .from('inv_products').select('*').order('category').order('name');
    data = d2;
  } else {
    data = d1;
  }
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
  ['staff','products','par','orders','house','cost','distributors','periods'].forEach(t => {
    const el = document.getElementById(`invmgr-${t}-area`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'staff')         invMgrRenderStaff();
  if (tab === 'products')      invMgrRenderProducts();
  if (tab === 'par')           invMgrRenderPar();
  if (tab === 'orders')        invMgrRenderOrders();
  if (tab === 'house')         invMgrRenderHouse();
  if (tab === 'cost')          costInit();
  if (tab === 'distributors')  invMgrRenderDistributors();
  if (tab === 'periods')       invMgrRenderPeriods();
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
        ${s.role === 'key_barback' ? `
        <div style="margin-bottom:8px;">
          <span style="font-family:var(--font-label);font-size:9px;letter-spacing:0.15em;color:var(--ash);display:block;margin-bottom:4px;">ASSIGNED BAR</span>
          <select onchange="invMgrSetBarbackBar('${s.id}',this.value)"
            style="background:var(--void);border:1px solid var(--graphite);border-radius:4px;padding:4px 8px;color:var(--ivory);font-family:var(--font-body);font-size:12px;">
            <option value="">— Unassigned —</option>
            ${BAR_CONFIG.filter(b=>b.active&&b.id!=='LR').map(b=>`<option value="${b.id}" ${s.assigned_bar===b.id?'selected':''}>${b.label}</option>`).join('')}
          </select>
        </div>` : ''}
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

async function invMgrSetBarbackBar(id, bar) {
  const { error } = await supabaseClient.from('inv_staff')
    .update({ assigned_bar: bar || null }).eq('id', id);
  if (error) { showToast('Error saving assignment', ''); return; }
  const s = invStaffList.find(x => x.id === id);
  if (s) s.assigned_bar = bar || null;
  showToast(bar ? `Assigned to ${bar}` : 'Bar assignment cleared', 'success');
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
  const showInactive = document.getElementById('invMgrShowInactive')?.checked;
  const list = showInactive ? invMgrProductsF : invMgrProductsF.filter(p => p.active !== false);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:40px;text-align:center;color:var(--ash);font-style:italic;">No products found.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => {
    const distName = p.inv_distributors?.name || p.distributor || '—';
    const inactive = p.active === false;
    return `<tr style="border-bottom:1px solid rgba(42,42,42,0.4);opacity:${inactive?'0.5':'1'};">
      <td style="padding:12px 16px;font-size:13px;color:var(--ivory);font-weight:500;">${p.name}${inactive?'<span style="font-size:9px;color:var(--ash);margin-left:8px;">INACTIVE</span>':''}</td>
      <td style="padding:12px 16px;font-size:12px;color:var(--ash);">${p.category}</td>
      <td style="padding:12px 16px;font-size:12px;color:var(--mist);">${distName}</td>
      <td style="padding:10px 12px;">
        <input style="width:72px;background:var(--void);border:1px solid var(--graphite);border-radius:4px;padding:5px 7px;color:var(--ivory);font-family:var(--font-display);font-size:14px;text-align:center;outline:none;"
          type="number" min="0" step="0.01" placeholder="0.00" value="${p.cost||''}"
          data-pid="${p.id}" data-field="cost"
          onchange="invMgrSaveProductField(this)" onfocus="this.select()"/>
      </td>
      <td style="padding:10px 12px;">
        <input style="width:56px;background:var(--void);border:1px solid var(--graphite);border-radius:4px;padding:5px 7px;color:var(--ivory);font-family:var(--font-display);font-size:14px;text-align:center;outline:none;"
          type="number" min="1" step="1" placeholder="12" value="${p.case_size||''}"
          data-pid="${p.id}" data-field="case_size"
          onchange="invMgrSaveProductField(this)" onfocus="this.select()"/>
      </td>
      <td style="padding:10px 12px;">
        <input style="width:72px;background:var(--void);border:1px solid var(--graphite);border-radius:4px;padding:5px 7px;color:var(--ivory);font-family:var(--font-body);font-size:12px;text-align:center;outline:none;"
          type="text" placeholder="POS ID" value="${p.pos_item_id||''}"
          data-pid="${p.id}" data-field="pos_item_id"
          onchange="invMgrSaveProductField(this)" onfocus="this.select()"/>
      </td>
      <td style="padding:10px 12px;">
        <input class="invmgr-upc-input ${p.upc ? 'has-upc' : ''}" type="text"
          placeholder="UPC…" value="${p.upc || ''}" data-pid="${p.id}"
          onchange="invMgrSaveUpc(this)" onfocus="this.select()"/>
      </td>
      <td style="padding:10px 12px;">
        <button onclick="invMgrToggleProduct('${p.id}',${inactive})"
          style="padding:4px 10px;border-radius:4px;border:1px solid ${inactive?'rgba(76,175,80,0.3)':'rgba(192,57,43,0.3)'};background:none;color:${inactive?'#81C784':'#E57373'};font-family:var(--font-label);font-size:9px;letter-spacing:0.1em;cursor:pointer;">
          ${inactive ? 'Activate' : 'Deactivate'}
        </button>
      </td>
    </tr>`;
  }).join('');
  const el = document.getElementById('invMgrProdCount');
  if (el) el.textContent = list.length + ' products';
}

function invMgrFilterProducts(q) {
  invMgrProductsF = q.trim()
    ? invMgrProducts.filter(p =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.category||'').toLowerCase().includes(q.toLowerCase()) ||
        (p.inv_distributors?.name||p.distributor||'').toLowerCase().includes(q.toLowerCase()) ||
        String(p.pos_item_id||'').includes(q) ||
        (p.upc||'').includes(q))
    : [...invMgrProducts];
  invMgrRenderProducts();
}

async function invMgrSaveProductField(input) {
  const pid = input.dataset.pid, field = input.dataset.field;
  let val = input.value.trim();
  if (field === 'cost') val = parseFloat(val) || null;
  else if (field === 'case_size') val = parseInt(val) || null;
  else if (field === 'pos_item_id') val = parseInt(val) || null;
  const { error } = await supabaseClient.from('inv_products').update({ [field]: val }).eq('id', pid);
  if (error) { showToast('Error saving', ''); return; }
  const p = invMgrProducts.find(x => x.id === pid);
  if (p) p[field] = val;
  showToast('Saved', 'success');
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

async function invMgrToggleProduct(id, currentlyInactive) {
  const newActive = currentlyInactive;
  const { error } = await supabaseClient.from('inv_products').update({ active: newActive }).eq('id', id);
  if (error) { showToast('Error updating product', ''); return; }
  const p = invMgrProducts.find(x => x.id === id);
  if (p) p.active = newActive;
  invMgrFilterProducts(document.getElementById('invMgrProdSearch')?.value || '');
  showToast(newActive ? 'Product activated' : 'Product deactivated', 'success');
}

async function openAddProductModal() {
  const name = prompt('Product name:');
  if (!name?.trim()) return;
  const cat = prompt(`Category:\n${INV_CAT_ORDER.join(' · ')}`);
  if (!cat?.trim()) return;
  const catUpper = cat.trim().toUpperCase();
  if (!INV_CAT_ORDER.includes(catUpper)) { showToast('Invalid category', ''); return; }
  const distChoice = invDistributors.length
    ? prompt(`Distributor (enter number or leave blank):\n${invDistributors.map((d,i)=>`${i+1}. ${d.name}`).join('\n')}`)
    : null;
  const distId = invDistributors[parseInt(distChoice)-1]?.id || null;
  const cost = parseFloat(prompt('Cost per bottle (e.g. 24.50):') || '0') || null;
  const caseSize = parseInt(prompt('Case size (e.g. 12):') || '0') || null;
  const posId = parseInt(prompt('POS Item ID from Hot Sauce (or leave blank):') || '0') || null;
  const { data, error } = await supabaseClient.from('inv_products').insert({
    name: name.trim(), category: catUpper, distributor_id: distId,
    cost, case_size: caseSize, pos_item_id: posId, active: true
  }).select('*, inv_distributors(name)').single();
  if (error) { showToast('Error adding product', ''); return; }
  invMgrProducts.unshift(data);
  invMgrFilterProducts('');
  showToast(`${name.trim()} added`, 'success');
}

// ── DISTRIBUTORS ───────────────────────────────────────────────────
async function invMgrRenderDistributors() {
  const area = document.getElementById('invmgr-distributors-area');
  if (!area) return;
  await invMgrLoadDistributors();
  area.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
      <div>
        <p style="font-family:var(--font-label);font-size:11px;letter-spacing:0.35em;color:var(--owner-gold);">PURCHASING</p>
        <h2 style="font-family:var(--font-display);font-size:28px;font-weight:300;color:var(--ivory);">Distributors</h2>
      </div>
      <button onclick="openAddDistributorModal()"
        style="padding:9px 18px;background:linear-gradient(135deg,var(--owner-accent),var(--owner-gold));border:none;border-radius:6px;color:#fff;font-family:var(--font-label);font-size:12px;letter-spacing:0.12em;cursor:pointer;">
        + Add Distributor
      </button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;" id="distCardGrid">
      ${invDistributors.length ? invDistributors.map(d => distCard(d)).join('') :
        '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--ash);font-style:italic;">No distributors yet. Add your first rep.</div>'}
    </div>`;
}

function distCard(d) {
  return `<div style="background:var(--carbon);border:1px solid var(--graphite);border-radius:8px;padding:20px;${!d.active?'opacity:0.5':''}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
      <div>
        <div style="font-family:var(--font-display);font-size:18px;font-weight:300;color:var(--ivory);">${d.name}</div>
        ${d.active===false?'<span style="font-size:9px;color:var(--ash);letter-spacing:0.15em;font-family:var(--font-label);">INACTIVE</span>':''}
      </div>
      <div style="display:flex;gap:6px;">
        <button onclick="openPriceHistoryModal('${d.id}','${d.name.replace(/'/g,String.fromCharCode(92)+"'")}')"
          style="padding:4px 10px;border-radius:4px;border:1px solid rgba(218,165,32,0.35);background:none;color:var(--owner-gold);font-family:var(--font-label);font-size:9px;letter-spacing:0.1em;cursor:pointer;">
          $ Pricing
        </button>
        <button onclick="invMgrToggleDist('${d.id}',${d.active===false})"
          style="padding:4px 10px;border-radius:4px;border:1px solid ${d.active===false?'rgba(76,175,80,0.3)':'rgba(192,57,43,0.3)'};background:none;color:${d.active===false?'#81C784':'#E57373'};font-family:var(--font-label);font-size:9px;cursor:pointer;">
          ${d.active===false?'Activate':'Deactivate'}
        </button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
      <div><span style="color:var(--ash);">Rep</span><div style="color:var(--mist);margin-top:2px;">${d.rep_name||'—'}</div></div>
      <div><span style="color:var(--ash);">Phone</span><div style="color:var(--mist);margin-top:2px;">${d.rep_phone||'—'}</div></div>
      <div style="grid-column:1/-1;"><span style="color:var(--ash);">Email</span><div style="color:var(--mist);margin-top:2px;">${d.rep_email||'—'}</div></div>
      ${d.notes?`<div style="grid-column:1/-1;"><span style="color:var(--ash);">Notes</span><div style="color:var(--ash);font-size:11px;margin-top:2px;">${d.notes}</div></div>`:''}
    </div>
  </div>`;
}

async function openAddDistributorModal() {
  const name = prompt('Distributor name (e.g. Republic National):');
  if (!name?.trim()) return;
  const rep_name  = prompt('Rep name (optional):') || null;
  const rep_phone = prompt('Rep phone (optional):') || null;
  const rep_email = prompt('Rep email (optional):') || null;
  const notes     = prompt('Notes (optional):') || null;
  const { error } = await supabaseClient.from('inv_distributors')
    .insert({ name: name.trim(), rep_name, rep_phone, rep_email, notes, active: true });
  if (error) { showToast('Error adding distributor', ''); return; }
  showToast(`${name.trim()} added`, 'success');
  invMgrRenderDistributors();
}

async function invMgrToggleDist(id, currentlyInactive) {
  await supabaseClient.from('inv_distributors').update({ active: !currentlyInactive }).eq('id', id);
  showToast(currentlyInactive ? 'Distributor activated' : 'Distributor deactivated', 'success');
  invMgrRenderDistributors();
}

async function openPriceHistoryModal(distId, distName) {
  const { data: hist } = await supabaseClient
    .from('inv_price_history')
    .select('*, inv_products(name, category)')
    .eq('distributor_id', distId)
    .order('effective_date', { ascending: false })
    .limit(50);
  const rows = hist || [];
  const existing = document.getElementById('priceHistModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'priceHistModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:var(--carbon);border:1px solid var(--graphite);border-radius:10px;width:100%;max-width:680px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
      <div style="padding:20px 24px;border-bottom:1px solid var(--graphite);display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-family:var(--font-label);font-size:10px;letter-spacing:0.3em;color:var(--owner-gold);">PRICING HISTORY</div>
          <div style="font-family:var(--font-display);font-size:20px;font-weight:300;color:var(--ivory);margin-top:2px;">${distName}</div>
        </div>
        <button onclick="document.getElementById('priceHistModal').remove()"
          style="background:none;border:none;color:var(--ash);font-size:22px;cursor:pointer;line-height:1;">×</button>
      </div>
      <div style="padding:16px 24px;border-bottom:1px solid var(--graphite);">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
          <div style="flex:1;min-width:160px;">
            <div style="font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);margin-bottom:4px;">PRODUCT</div>
            <select id="phProduct" style="width:100%;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:8px 10px;color:var(--ivory);font-family:var(--font-body);font-size:13px;">
              <option value="">— Select —</option>
              ${invMgrProducts.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <div style="font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);margin-bottom:4px;">BOTTLE PRICE</div>
            <input id="phBottle" type="number" step="0.01" placeholder="0.00"
              style="width:90px;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:8px 10px;color:var(--ivory);font-family:var(--font-display);font-size:15px;outline:none;"/>
          </div>
          <div>
            <div style="font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);margin-bottom:4px;">CASE PRICE</div>
            <input id="phCase" type="number" step="0.01" placeholder="0.00"
              style="width:90px;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:8px 10px;color:var(--ivory);font-family:var(--font-display);font-size:15px;outline:none;"/>
          </div>
          <div>
            <div style="font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);margin-bottom:4px;">EFFECTIVE DATE</div>
            <input id="phDate" type="date" value="${new Date().toISOString().slice(0,10)}"
              style="background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:8px 10px;color:var(--ivory);font-family:var(--font-body);font-size:13px;outline:none;"/>
          </div>
          <button onclick="logPriceEntry('${distId}')"
            style="padding:9px 16px;background:linear-gradient(135deg,var(--owner-accent),var(--owner-gold));border:none;border-radius:6px;color:#fff;font-family:var(--font-label);font-size:11px;letter-spacing:0.12em;cursor:pointer;white-space:nowrap;">
            + Log Price
          </button>
        </div>
      </div>
      <div style="overflow-y:auto;flex:1;padding:0 8px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="border-bottom:1px solid var(--graphite);">
            <th style="padding:10px 16px;text-align:left;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">PRODUCT</th>
            <th style="padding:10px 12px;text-align:right;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">BOTTLE</th>
            <th style="padding:10px 12px;text-align:right;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">CASE</th>
            <th style="padding:10px 16px;text-align:left;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">EFFECTIVE</th>
          </tr></thead>
          <tbody>
            ${rows.length ? rows.map(r => `
              <tr style="border-bottom:1px solid rgba(42,42,42,0.35);">
                <td style="padding:10px 16px;color:var(--ivory);">${r.inv_products?.name||'—'}<span style="font-size:10px;color:var(--ash);margin-left:6px;">${r.inv_products?.category||''}</span></td>
                <td style="padding:10px 12px;text-align:right;font-family:var(--font-display);font-size:14px;color:var(--mist);">${r.price_per_bottle?'$'+Number(r.price_per_bottle).toFixed(2):'—'}</td>
                <td style="padding:10px 12px;text-align:right;font-family:var(--font-display);font-size:14px;color:var(--mist);">${r.price_per_case?'$'+Number(r.price_per_case).toFixed(2):'—'}</td>
                <td style="padding:10px 16px;color:var(--ash);font-size:12px;">${r.effective_date}</td>
              </tr>`).join('') :
              '<tr><td colspan="4" style="padding:32px;text-align:center;color:var(--ash);font-style:italic;">No price history yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function logPriceEntry(distId) {
  const productId = document.getElementById('phProduct')?.value;
  const bottle    = parseFloat(document.getElementById('phBottle')?.value) || null;
  const casePrice = parseFloat(document.getElementById('phCase')?.value) || null;
  const effDate   = document.getElementById('phDate')?.value;
  if (!productId) { showToast('Select a product', ''); return; }
  if (!bottle && !casePrice) { showToast('Enter at least one price', ''); return; }
  const { error } = await supabaseClient.from('inv_price_history').insert({
    distributor_id: distId, product_id: productId,
    price_per_bottle: bottle, price_per_case: casePrice,
    effective_date: effDate, created_by: 'owner'
  });
  if (error) { showToast('Error logging price', ''); return; }
  if (bottle) {
    await supabaseClient.from('inv_products').update({ cost: bottle, distributor_id: distId }).eq('id', productId);
    const p = invMgrProducts.find(x => x.id === productId);
    if (p) { p.cost = bottle; p.distributor_id = distId; }
  }
  showToast('Price logged — cost updated', 'success');
  const distName = invDistributors.find(d=>d.id===distId)?.name || '';
  openPriceHistoryModal(distId, distName);
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
  const today     = new Date().toISOString().slice(0,10);
  const weekStart = new Date(new Date(today + 'T12:00:00') - 6 * 86400000).toISOString().slice(0,10);
  const allCounts = {};
  for (const loc of ACTIVE_LOCATIONS) {
    const { data: sessions } = await supabaseClient.from('inv_sessions').select('id')
      .eq('location', loc).gte('week_of', weekStart).lte('week_of', today)
      .order('opened_at', { ascending: false }).limit(1);
    if (!sessions?.length) continue;
    const { data: counts } = await supabaseClient.from('inv_counts').select('product_id, quantity').eq('session_id', sessions[0].id);
    if (counts) counts.forEach(c => { allCounts[c.product_id] = (allCounts[c.product_id]||0) + c.quantity; });
  }
  invMgrOrders = invMgrProducts.map(p => {
    const end = allCounts[p.id] || 0;
    const par = ACTIVE_LOCATIONS.reduce((s, l) => s + (invMgrPars[p.id]?.[l]||0), 0);
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
  const today     = new Date().toISOString().slice(0,10);
  const weekStart = new Date(new Date(today + 'T12:00:00') - 6 * 86400000).toISOString().slice(0,10);
  const allCounts = {};
  for (const loc of ACTIVE_LOCATIONS) {
    // Get most recent session within the current week window
    const { data: sessions } = await supabaseClient.from('inv_sessions').select('id')
      .eq('location', loc).gte('week_of', weekStart).lte('week_of', today)
      .order('opened_at', { ascending: false }).limit(1);
    if (!sessions?.length) continue;
    const { data: counts } = await supabaseClient.from('inv_counts').select('product_id, quantity').eq('session_id', sessions[0].id);
    if (counts) counts.forEach(c => { allCounts[c.product_id] = (allCounts[c.product_id]||0) + c.quantity; });
  }
  const cats = {};
  invMgrProducts.forEach(p => {
    if (catFilter && p.category !== catFilter) return;
    if (!cats[p.category]) cats[p.category] = [];
    const qty = allCounts[p.id] || 0;
    const par = ACTIVE_LOCATIONS.reduce((s,l) => s + (invMgrPars[p.id]?.[l]||0), 0);
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
    <!-- Date range filter -->
    <div style="margin-bottom:12px;">
      <div style="font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);margin-bottom:6px;">DATE RANGE</div>
      <div style="display:flex;gap:6px;align-items:center;">
        <input id="costDateFrom" type="date"
          style="flex:1;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:6px 8px;color:var(--ivory);font-family:var(--font-body);font-size:12px;outline:none;"
          onchange="costFilterPeriods(document.getElementById('costPeriodSearch')?.value||'')"/>
        <span style="color:var(--ash);font-size:11px;">→</span>
        <input id="costDateTo" type="date"
          style="flex:1;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:6px 8px;color:var(--ivory);font-family:var(--font-body);font-size:12px;outline:none;"
          onchange="costFilterPeriods(document.getElementById('costPeriodSearch')?.value||'')"/>
      </div>
      <button onclick="document.getElementById('costDateFrom').value='';document.getElementById('costDateTo').value='';costFilterPeriods('');"
        style="margin-top:5px;background:none;border:none;color:var(--ash);font-size:11px;cursor:pointer;padding:0;font-family:var(--font-body);">
        Clear dates
      </button>
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
  const dateFrom = document.getElementById('costDateFrom')?.value;
  const dateTo   = document.getElementById('costDateTo')?.value;
  if (dateFrom) filtered = filtered.filter(p => p.week_ending >= dateFrom);
  if (dateTo)   filtered = filtered.filter(p => p.week_ending <= dateTo);
  if (q.trim()) filtered = filtered.filter(p => p.week_ending.includes(q) || p.period_type.includes(q));
  costRenderPeriodList(filtered);
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
  const totalRevenue = totalSales + totalComps;
  const costPct     = totalRevenue > 0 ? (totalCost$ / totalRevenue * 100) : null;
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

  const totalSales  = locs.reduce((s,loc) => s+(costSales[loc]?.total_sales||0), 0);
  const totalComps2 = locs.reduce((s,loc) => s+(costSales[loc]?.total_comps||0), 0);
  const totalRev    = totalSales + totalComps2;
  const sorted     = INV_CAT_ORDER.filter(c => byCat[c]).concat(Object.keys(byCat).filter(c => !INV_CAT_ORDER.includes(c)));

  const pullBtn = costActivePeriod?.status !== 'finalized'
    ? `<button onclick="costPullFromCounts()" style="padding:7px 16px;border-radius:6px;border:1px solid rgba(218,165,32,0.4);background:none;color:var(--owner-gold);font-family:var(--font-label);font-size:10px;letter-spacing:0.12em;cursor:pointer;margin-bottom:16px;">↺ Refresh from Counts</button>`
    : '';

  el.innerHTML = pullBtn + sorted.map(cat => {
    const rows = byCat[cat];
    const catCost = rows.reduce((s,{l}) => s+(l.cost_dollars||0), 0);
    const catPct  = totalRev>0 ? (catCost/totalRev*100) : null;
    const pctStr  = catPct !== null ? catPct.toFixed(1)+'%' : '—';
    const pctCls  = catPct === null ? '' : catPct<=8?'ok':catPct<=14?'warn':'alert';

    const rowsHtml = rows.map(({l,p}) => {
      const usage   = l.usage || 0;
      const cost$   = l.cost_dollars || 0;
      const pPct    = totalRev>0 ? (cost$/totalRev*100) : null;
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
          <th class="num">${costReportLoc === 'LR' ? '+Orders' : '+Pulls'}</th>
          <th class="num">${costReportLoc === 'LR' ? '−Pulls' : ''}</th>
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
        <span style="min-width:60px;text-align:right;">+ORDERS</span>
        <span style="min-width:60px;text-align:right;">−PULLS</span>
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

  // Load all sessions within period date range
  // If date_start not set, default to 6 days before week_ending (full week)
  const dateStart = costActivePeriod.date_start ||
    new Date(new Date(we + 'T12:00:00') - 6 * 86400000).toISOString().slice(0, 10);
  const { data: sessions } = await supabaseClient
    .from('inv_sessions').select('id, location')
    .gte('week_of', dateStart)
    .lte('week_of', we);

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
    .gte('week_of', dateStart).lte('week_of', we).eq('status','confirmed');

  const ordersIn = {}; // { product_id: cases (need ×case_size for bottles) }
  if (orders) orders.forEach(o => { ordersIn[o.product_id] = (ordersIn[o.product_id]||0) + o.confirmed_cases; });

  // Pull stock-up requests — keyed by to_location so each bar sees what it received
  const { data: stockUps } = await supabaseClient
    .from('inv_stock_ups').select('product_id, quantity, from_location, to_location')
    .gte('report_date', dateStart).lte('report_date', we);

  // pulls: { product_id: { location: qty } }
  // LR loses qty (pulls_out), receiving bar gains qty (received_in)
  const pulls = {};
  if (stockUps) stockUps.forEach(s => {
    if (!s.product_id) return;
    if (!pulls[s.product_id]) pulls[s.product_id] = {};
    // LR side: total out
    pulls[s.product_id]['LR'] = (pulls[s.product_id]['LR']||0) + s.quantity;
    // Bar side: received at to_location (if set)
    if (s.to_location) {
      pulls[s.product_id][s.to_location] = (pulls[s.product_id][s.to_location]||0) + s.quantity;
    }
  });

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

    for (const loc of ACTIVE_LOCATIONS) {
      const endQty   = endCounts[pid_prod]?.[loc] ?? 0;
      const startQty = startQtys[pid_prod]?.[loc] ?? 0;
      // Orders in: convert cases to bottles — LR only gets full order deliveries
      const ordersBottles = loc === 'LR' ? (ordersIn[pid_prod]||0) * (product.case_size||1) : 0;
      // LR loses bottles as pulls_out; bars gain bottles as received_in (+PULLS column)
      const pullsOut   = loc === 'LR' ? (pulls[pid_prod]?.['LR']||0) : 0;
      const receivedIn = loc !== 'LR' ? (pulls[pid_prod]?.[loc]||0) : 0;

      if (endQty === 0 && startQty === 0 && ordersBottles === 0 && pullsOut === 0 && receivedIn === 0) continue;

      rows.push({
        period_id:   pid,
        product_id:  pid_prod,
        location:    loc,
        start_qty:   startQty,
        orders_in:   loc === 'LR' ? ordersBottles : receivedIn,
        pulls_out:   pullsOut,
        end_qty:     endQty,
        unit_cost:   product.cost || 0
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
  const totalSales  = locs.reduce((s,loc) => s+(costSales[loc]?.total_sales||0), 0);
  const totalCompsC = locs.reduce((s,loc) => s+(costSales[loc]?.total_comps||0), 0);
  const totalRevC   = totalSales + totalCompsC;

  let csv = `Week Ending,${we}\n`;
  csv += `Period Type,${costActivePeriod.period_type}\n`;
  csv += `Location,${costReportLoc === 'house' ? 'House (All Bars)' : costReportLoc}\n`;
  csv += `Total Sales,$${totalSales.toFixed(2)}\nTotal Comps,$${totalCompsC.toFixed(2)}\nTotal Revenue (Sales+Comps),$${totalRevC.toFixed(2)}\n\n`;
  csv += `Product,Category,Location,Start,+Orders/+Pulls,−Pulls Out,End,Usage,Unit Cost,Cost $,Cost %\n`;

  lines.forEach(l => {
    const p       = invMgrProducts.find(pr => pr.id === l.product_id);
    if (!p) return;
    const usage   = l.usage || 0;
    const cost$   = l.cost_dollars || 0;
    const pct     = totalRevC > 0 ? (cost$/totalRevC*100).toFixed(2) : '';
    csv += `"${p.name}","${p.category}","${l.location}",${l.start_qty||0},${l.orders_in||0},${l.pulls_out||0},${l.end_qty||0},${usage.toFixed(2)},${p.cost||0},${cost$.toFixed(2)},${pct}\n`;
  });

  // Totals
  const totalCost = lines.reduce((s,l) => s+(l.cost_dollars||0), 0);
  const costPct   = totalRevC > 0 ? (totalCost/totalRevC*100).toFixed(2) : '';
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
  const totalSales  = locs.reduce((s,loc) => s+(costSales[loc]?.total_sales||0), 0);
  const totalCompsP = locs.reduce((s,loc) => s+(costSales[loc]?.total_comps||0), 0);
  const totalRevP   = totalSales + totalCompsP;
  const totalCost   = lines.reduce((s,l) => s+(l.cost_dollars||0), 0);
  const costPct     = totalRevP > 0 ? (totalCost/totalRevP*100).toFixed(1)+'%' : '—';

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

// ═══════════════════════════════════════════════════════════════════
// ── INV-04: PERIOD SYSTEM UI ───────────────────────────────────────
// ── INV-05: OPENING BALANCE AUTO-CARRY ────────────────────────────
// ═══════════════════════════════════════════════════════════════════

let invPeriods      = [];
let invActivePeriod = null;

async function invMgrRenderPeriods() {
  const area = document.getElementById('invmgr-periods-area');
  if (!area) return;
  area.innerHTML = invPeriodsShell();
  bindNewPeriodModalEvents();
  await invLoadPeriods();
}

function invPeriodsShell() {
  return `
<style>
.inv-period-card{background:var(--carbon);border:1px solid var(--graphite);border-radius:8px;padding:16px 20px;cursor:pointer;transition:border-color 150ms;}
.inv-period-card:hover{border-color:rgba(218,165,32,0.4);}
.inv-period-card.active{border-color:var(--owner-gold);background:rgba(218,165,32,0.04);}
.inv-pstatus{font-family:var(--font-label);font-size:9px;letter-spacing:0.15em;padding:3px 10px;border-radius:999px;border:1px solid;white-space:nowrap;}
.inv-pstatus.open{color:#81C784;border-color:rgba(76,175,80,0.4);background:rgba(76,175,80,0.08);}
.inv-pstatus.closed{color:var(--gold-warm);border-color:rgba(212,168,67,0.4);background:rgba(212,168,67,0.08);}
.inv-pstatus.locked{color:var(--ash);border-color:rgba(136,136,136,0.3);background:rgba(136,136,136,0.06);}
</style>

<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
  <div>
    <p style="font-family:var(--font-label);font-size:11px;letter-spacing:0.35em;color:var(--owner-gold);">INVENTORY</p>
    <h2 style="font-family:var(--font-display);font-size:28px;font-weight:300;color:var(--ivory);">Count Periods</h2>
  </div>
  <button onclick="openInvPeriodModal()"
    style="padding:9px 18px;background:linear-gradient(135deg,var(--owner-accent),var(--owner-gold));border:none;border-radius:6px;color:#fff;font-family:var(--font-label);font-size:12px;letter-spacing:0.12em;cursor:pointer;">
    + New Period
  </button>
</div>

<div style="display:grid;grid-template-columns:280px 1fr;gap:20px;align-items:start;" id="invPeriodsLayout">
  <div id="invPeriodListPanel" style="display:flex;flex-direction:column;gap:8px;max-height:680px;overflow-y:auto;">
    <div style="text-align:center;padding:32px;color:var(--ash);font-size:13px;">Loading…</div>
  </div>
  <div id="invPeriodDetailPanel">
    <div style="text-align:center;padding:64px 20px;color:var(--ash);">
      <div style="font-size:32px;margin-bottom:12px;opacity:0.2;">◑</div>
      <div style="font-family:var(--font-display);font-size:20px;font-weight:300;color:var(--ivory);margin-bottom:6px;">Select a period</div>
      <div style="font-size:13px;">Choose a period from the left or create a new one.</div>
    </div>
  </div>
</div>

<!-- New Period Modal -->
<div id="invNewPeriodModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:2000;align-items:center;justify-content:center;padding:20px;">
  <div style="background:var(--carbon);border:1px solid rgba(218,165,32,0.4);border-radius:12px;padding:32px 28px;width:100%;max-width:440px;box-shadow:0 8px 48px rgba(0,0,0,0.6);max-height:90vh;overflow-y:auto;">
    <div style="font-family:var(--font-display);font-size:24px;font-weight:300;font-style:italic;color:var(--ivory);margin-bottom:4px;">New Count Period</div>
    <div style="font-size:12px;color:var(--ash);margin-bottom:24px;">Define the date range for this counting cycle.</div>

    <div style="margin-bottom:16px;">
      <label style="display:block;font-family:var(--font-label);font-size:10px;letter-spacing:0.25em;color:var(--owner-gold);margin-bottom:6px;">PERIOD TYPE</label>
      <select id="invNewPeriodType" onchange="invUpdateNewPeriodDates()"
        style="width:100%;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:11px 14px;color:var(--ivory);font-family:var(--font-body);font-size:14px;outline:none;-webkit-appearance:none;">
        <option value="week">Weekly (7 days)</option>
        <option value="biweek">Bi-Weekly (14 days)</option>
        <option value="month">Monthly (28 days)</option>
        <option value="quarter">Quarterly (91 days)</option>
        <option value="custom">Custom</option>
      </select>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <div>
        <label style="display:block;font-family:var(--font-label);font-size:10px;letter-spacing:0.25em;color:var(--owner-gold);margin-bottom:6px;">START DATE</label>
        <input type="date" id="invNewPeriodStart" onchange="invUpdateNewPeriodDates()"
          style="width:100%;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:11px 14px;color:var(--ivory);font-family:var(--font-body);font-size:13px;outline:none;"/>
      </div>
      <div>
        <label style="display:block;font-family:var(--font-label);font-size:10px;letter-spacing:0.25em;color:var(--owner-gold);margin-bottom:6px;">END DATE</label>
        <input type="date" id="invNewPeriodEnd"
          style="width:100%;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:11px 14px;color:var(--ivory);font-family:var(--font-body);font-size:13px;outline:none;"/>
      </div>
    </div>

    <div style="margin-bottom:16px;">
      <label style="display:block;font-family:var(--font-label);font-size:10px;letter-spacing:0.25em;color:var(--owner-gold);margin-bottom:6px;">LABEL (OPTIONAL)</label>
      <input type="text" id="invNewPeriodLabel" placeholder="e.g. Week of Mar 17"
        style="width:100%;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:11px 14px;color:var(--ivory);font-family:var(--font-body);font-size:14px;outline:none;"/>
    </div>

    <div style="margin-bottom:20px;">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;color:var(--mist);">
        <input type="checkbox" id="invNewPeriodSpotCheck" style="accent-color:var(--owner-gold);width:16px;height:16px;"/>
        Mark as spot check (sub-period, won't auto-carry balances)
      </label>
    </div>

    <div id="invNewPeriodPreview"
      style="background:rgba(218,165,32,0.05);border:1px solid rgba(218,165,32,0.2);border-radius:8px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:var(--ash);line-height:1.8;min-height:48px;">
      Select a start date to preview.
    </div>

    <div style="display:flex;gap:10px;">
      <button onclick="invCreatePeriod()"
        style="flex:1;padding:13px;border-radius:6px;background:linear-gradient(135deg,var(--owner-accent),var(--owner-gold));border:none;color:#fff;font-family:var(--font-label);font-size:13px;letter-spacing:0.15em;cursor:pointer;">
        Create Period
      </button>
      <button onclick="closeInvPeriodModal()"
        style="padding:13px 20px;border-radius:6px;background:none;border:1px solid var(--graphite);color:var(--ash);font-family:var(--font-body);font-size:13px;cursor:pointer;">
        Cancel
      </button>
    </div>
  </div>
</div>
`;
}

function bindNewPeriodModalEvents() {
  // Close on backdrop click
  const modal = document.getElementById('invNewPeriodModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
}

// ── Period loading & list ──────────────────────────────────────────
async function invLoadPeriods() {
  const { data } = await supabaseClient
    .from('inv_periods')
    .select('*')
    .order('start_date', { ascending: false });
  invPeriods = data || [];
  invRenderPeriodList();
}

function invRenderPeriodList() {
  const el = document.getElementById('invPeriodListPanel');
  if (!el) return;
  if (!invPeriods.length) {
    el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--ash);font-size:13px;font-style:italic;">No periods yet.<br>Create one to begin.</div>`;
    return;
  }
  el.innerHTML = invPeriods.map(p => {
    const isAct  = invActivePeriod?.id === p.id;
    const start  = new Date(p.start_date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const end    = new Date(p.end_date   + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const typeLabel = { week:'Weekly', biweek:'Bi-Weekly', month:'Monthly', quarter:'Quarterly', custom:'Custom' }[p.period_type] || p.period_type;
    const displayLabel = p.label || `${typeLabel}: ${start} → ${end}`;
    return `<div class="inv-period-card ${isAct?'active':''}" onclick="invSelectPeriod('${p.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;">
        <div style="font-family:var(--font-display);font-size:15px;font-weight:300;color:var(--ivory);flex:1;line-height:1.3;">${displayLabel}</div>
        <span class="inv-pstatus ${p.status}">${p.status.toUpperCase()}</span>
      </div>
      <div style="font-size:11px;color:var(--ash);">${start} → ${end}${p.is_spot_check?' · <em>Spot Check</em>':''}</div>
    </div>`;
  }).join('');
}

function invSelectPeriod(id) {
  invActivePeriod = invPeriods.find(p => p.id === id) || null;
  invRenderPeriodList();
  invRenderPeriodDetail();
}

// ── Period detail ──────────────────────────────────────────────────
function invRenderPeriodDetail() {
  const el = document.getElementById('invPeriodDetailPanel');
  if (!el || !invActivePeriod) return;
  const p     = invActivePeriod;
  const start = new Date(p.start_date + 'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const end   = new Date(p.end_date   + 'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const days  = Math.round((new Date(p.end_date + 'T12:00:00') - new Date(p.start_date + 'T12:00:00')) / 86400000) + 1;
  const label = p.label || `${({ week:'Weekly', biweek:'Bi-Weekly', month:'Monthly', quarter:'Quarterly', custom:'Custom' }[p.period_type]||p.period_type)} Period`;
  const locked = p.status === 'locked';

  // Action buttons based on status
  const actionBtns = (() => {
    if (p.status === 'open') return `
      <button onclick="invPeriodAction('close','${p.id}')"
        style="padding:9px 20px;border-radius:6px;border:1px solid rgba(212,168,67,0.4);background:none;color:var(--gold-warm);font-family:var(--font-label);font-size:11px;letter-spacing:0.12em;cursor:pointer;">
        ■ Close Period
      </button>`;
    if (p.status === 'closed') return `
      <button onclick="invPeriodAction('open','${p.id}')"
        style="padding:9px 20px;border-radius:6px;border:1px solid rgba(76,175,80,0.4);background:none;color:#81C784;font-family:var(--font-label);font-size:11px;letter-spacing:0.12em;cursor:pointer;">
        ▶ Re-open
      </button>
      <button onclick="invPeriodAction('lock','${p.id}')"
        style="padding:9px 20px;border-radius:6px;background:linear-gradient(135deg,var(--owner-accent),var(--owner-gold));border:none;color:#fff;font-family:var(--font-label);font-size:11px;letter-spacing:0.12em;cursor:pointer;">
        🔒 Lock Period
      </button>`;
    if (p.status === 'locked') return `
      <span style="font-size:12px;color:var(--ash);font-style:italic;">🔒 Locked — read only</span>`;
    return '';
  })();

  // INV-05 carry button — only on open periods that are not spot checks
  const carryBtn = (!locked && !p.is_spot_check) ? `
    <button onclick="invCarryOpeningBalances('${p.id}')"
      style="padding:9px 20px;border-radius:6px;border:1px solid rgba(74,159,138,0.4);background:none;color:var(--inv-light,#6BBFA8);font-family:var(--font-label);font-size:11px;letter-spacing:0.12em;cursor:pointer;"
      title="Copy closing counts from previous period as opening counts for this period">
      ↺ Carry Opening Balances
    </button>` : '';

  el.innerHTML = `
  <div class="panel">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
      <div>
        <div style="font-family:var(--font-label);font-size:10px;letter-spacing:0.3em;color:var(--owner-gold);margin-bottom:4px;">COUNT PERIOD</div>
        <div style="font-family:var(--font-display);font-size:26px;font-weight:300;color:var(--ivory);">${label}</div>
        <div style="font-size:13px;color:var(--ash);margin-top:4px;">${start} → ${end} · ${days} day${days!==1?'s':''}${p.is_spot_check?' · Spot Check':''}</div>
      </div>
      <span class="inv-pstatus ${p.status}" style="font-size:11px;padding:5px 14px;">${p.status.toUpperCase()}</span>
    </div>

    ${p.notes ? `<div style="background:rgba(218,165,32,0.05);border:1px solid rgba(218,165,32,0.15);border-radius:6px;padding:12px 14px;font-size:13px;color:var(--ash);margin-bottom:20px;">${p.notes}</div>` : ''}

    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:28px;">
      ${actionBtns}
      ${carryBtn}
    </div>

    <div style="font-family:var(--font-label);font-size:10px;letter-spacing:0.25em;color:var(--ash);margin-bottom:12px;">COUNT SESSIONS IN THIS PERIOD</div>
    <div id="invPeriodSessionsArea"><div style="text-align:center;padding:24px;color:var(--ash);font-size:13px;">Loading sessions…</div></div>
  </div>`;

  if (p.is_spot_check) {
    invRenderSpotCheckDetail(p);
  } else {
    invLoadPeriodSessions(p.id, p.start_date, p.end_date);
  }
}

async function invLoadPeriodSessions(periodId, startDate, endDate) {
  const el = document.getElementById('invPeriodSessionsArea');
  if (!el) return;
  // Fetch sessions linked by period_id OR that fall within date range
  const { data: byPeriod } = await supabaseClient
    .from('inv_sessions').select('*').eq('period_id', periodId).order('opened_at', { ascending: false });
  const { data: byDate } = await supabaseClient
    .from('inv_sessions').select('*').gte('week_of', startDate).lte('week_of', endDate).is('period_id', null).order('opened_at', { ascending: false });

  const rows = [...(byPeriod||[]), ...(byDate||[])];
  rows.sort((a,b) => b.opened_at.localeCompare(a.opened_at));

  if (!rows.length) {
    el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--ash);font-size:13px;font-style:italic;">No count sessions for this period yet.</div>`;
    return;
  }
  el.innerHTML = `
  <div style="overflow-x:auto;">
  <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:480px;">
    <thead><tr style="border-bottom:1px solid var(--graphite);">
      <th style="padding:8px 12px;text-align:left;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">LOCATION</th>
      <th style="padding:8px 12px;text-align:left;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">DATE</th>
      <th style="padding:8px 12px;text-align:left;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">TYPE</th>
      <th style="padding:8px 12px;text-align:left;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">STATUS</th>
      <th style="padding:8px 12px;text-align:left;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">OPENED BY</th>
      <th style="padding:8px 12px;"></th>
    </tr></thead>
    <tbody>
      ${rows.map(s => {
        const d    = new Date(s.opened_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});
        const t    = new Date(s.opened_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
        const scol = s.status === 'open' ? '#81C784' : 'var(--ash)';
        const ctype = s.count_type || 'closing';
        const ctypeBadge = ctype === 'opening'
          ? `<span style="font-size:9px;color:#81C784;border:1px solid rgba(76,175,80,0.4);border-radius:4px;padding:1px 6px;">OPENING</span>`
          : ctype === 'spot_check'
          ? `<span style="font-size:9px;color:var(--gold-warm);border:1px solid rgba(212,168,67,0.4);border-radius:4px;padding:1px 6px;">SPOT</span>`
          : `<span style="font-size:9px;color:var(--ash);border:1px solid var(--graphite);border-radius:4px;padding:1px 6px;">CLOSING</span>`;
        return `<tr style="border-bottom:1px solid rgba(42,42,42,0.35);">
          <td style="padding:9px 12px;color:var(--ivory);font-weight:500;">${s.location}</td>
          <td style="padding:9px 12px;color:var(--mist);">${d} <span style="color:var(--ash);font-size:11px;">${t}</span></td>
          <td style="padding:9px 12px;">${ctypeBadge}</td>
          <td style="padding:9px 12px;"><span style="color:${scol};font-size:12px;">${s.status}</span></td>
          <td style="padding:9px 12px;color:var(--ash);font-size:12px;">${(s.opened_by||'—').replace('+1','').slice(-10)}</td>
          <td style="padding:9px 12px;">
            <button onclick="invOpenEditCounts('${s.id}','${s.location}','${ctype}')"
              style="padding:4px 12px;border-radius:4px;border:1px solid rgba(218,165,32,0.35);background:none;color:var(--owner-gold);font-family:var(--font-label);font-size:9px;letter-spacing:0.12em;cursor:pointer;"
              onmouseover="this.style.background='rgba(218,165,32,0.08)'"
              onmouseout="this.style.background='none'">✎ EDIT</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  </div>`;
}

// ── Period actions (open/close/lock) ──────────────────────────────
async function invPeriodAction(action, id) {
  const p = invPeriods.find(x => x.id === id);
  if (!p) return;
  const confirmMsg = {
    close: 'Close this period? Counts can still be edited until locked.',
    open:  'Re-open this period?',
    lock:  'Lock this period? This cannot be undone — no further edits will be allowed.'
  }[action];
  if (!confirm(confirmMsg)) return;
  const newStatus = { close:'closed', open:'open', lock:'locked' }[action];
  const { error } = await supabaseClient.from('inv_periods').update({ status: newStatus }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, ''); return; }
  p.status = newStatus;
  invActivePeriod = p;
  invRenderPeriodList();
  invRenderPeriodDetail();
  showToast(`Period ${newStatus}`, 'success');
}

// ── INV-05: Opening balance auto-carry ────────────────────────────
async function invCarryOpeningBalances(periodId) {
  const period = invPeriods.find(p => p.id === periodId);
  if (!period) return;
  if (period.status === 'locked') { showToast('Period is locked', ''); return; }

  // Find the most recent prior period (by end_date, non-spot-check)
  const { data: priorPeriods } = await supabaseClient
    .from('inv_periods')
    .select('id, end_date, label')
    .lt('end_date', period.start_date)
    .eq('is_spot_check', false)
    .order('end_date', { ascending: false })
    .limit(1);

  if (!priorPeriods?.length) {
    showToast('No prior period found — no balances to carry', '');
    return;
  }
  const priorPeriod = priorPeriods[0];
  if (!confirm(`Carry closing counts from period ending ${priorPeriod.end_date} as opening balances for this period?\n\nThis will create opening sessions for each active location.`)) return;

  showToast('Carrying opening balances…', '');

  // Get all closed sessions from the prior period (most recent per location)
  const { data: priorSessions } = await supabaseClient
    .from('inv_sessions')
    .select('id, location, count_type')
    .gte('week_of', priorPeriod.end_date)
    .lte('week_of', priorPeriod.end_date)
    .eq('status', 'closed')
    .order('opened_at', { ascending: false });

  // Also check sessions linked by period_id
  const { data: priorByPId } = await supabaseClient
    .from('inv_sessions')
    .select('id, location, count_type')
    .eq('period_id', priorPeriod.id)
    .in('count_type', ['closing', null])
    .eq('status', 'closed')
    .order('opened_at', { ascending: false });

  const allPrior = [...(priorByPId||[]), ...(priorSessions||[])];

  // Deduplicate — most recent session per location
  const latestByLoc = {};
  allPrior.forEach(s => {
    if (!latestByLoc[s.location]) latestByLoc[s.location] = s;
  });

  if (!Object.keys(latestByLoc).length) {
    showToast('No closed sessions found in prior period', '');
    return;
  }

  let created = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const [loc, priorSess] of Object.entries(latestByLoc)) {
    // Get counts from that session
    const { data: priorCounts } = await supabaseClient
      .from('inv_counts')
      .select('product_id, quantity')
      .eq('session_id', priorSess.id);

    if (!priorCounts?.length) continue;

    // Create a new opening session for this location in the new period
    const { data: newSess, error: sessErr } = await supabaseClient
      .from('inv_sessions')
      .insert({
        location:     loc,
        status:       'closed',  // opening balances are pre-closed — read-only reference
        opened_by:    'owner-carry',
        closed_at:    new Date().toISOString(),
        week_of:      period.start_date,
        period_id:    periodId,
        count_type:   'opening',
        assigned_to:  null
      })
      .select()
      .single();

    if (sessErr || !newSess) { showToast(`Error creating opening session for ${loc}`, ''); continue; }

    // Insert counts into new opening session
    const countRows = priorCounts.map(c => ({
      session_id:  newSess.id,
      product_id:  c.product_id,
      location:    loc,
      quantity:    c.quantity,
      counted_by:  'owner-carry',
      count_type:  'opening'
    }));

    const { error: cntErr } = await supabaseClient.from('inv_counts').insert(countRows);
    if (!cntErr) created++;
  }

  showToast(`Opening balances carried — ${created} location${created!==1?'s':''} seeded`, 'success');
  // Refresh session list
  invLoadPeriodSessions(periodId, period.start_date, period.end_date);
}

// ── New period modal ───────────────────────────────────────────────
function openInvPeriodModal() {
  const modal = document.getElementById('invNewPeriodModal');
  if (!modal) return;
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('invNewPeriodStart').value   = today;
  document.getElementById('invNewPeriodType').value    = 'week';
  document.getElementById('invNewPeriodLabel').value   = '';
  document.getElementById('invNewPeriodSpotCheck').checked = false;
  invUpdateNewPeriodDates();
  modal.style.display = 'flex';
}

function closeInvPeriodModal() {
  const modal = document.getElementById('invNewPeriodModal');
  if (modal) modal.style.display = 'none';
}

function invUpdateNewPeriodDates() {
  const type     = document.getElementById('invNewPeriodType')?.value || 'week';
  const startVal = document.getElementById('invNewPeriodStart')?.value;
  const preview  = document.getElementById('invNewPeriodPreview');
  const endInput = document.getElementById('invNewPeriodEnd');
  if (!startVal) { if (preview) preview.textContent = 'Select a start date to preview.'; return; }

  const daysOffset = { week:6, biweek:13, month:27, quarter:90, custom:null }[type];
  let endVal = '';

  if (daysOffset !== null) {
    const end = new Date(startVal + 'T12:00:00');
    end.setDate(end.getDate() + daysOffset);
    endVal = end.toISOString().slice(0, 10);
    if (endInput) { endInput.value = endVal; endInput.readOnly = true; endInput.style.opacity = '0.6'; }
  } else {
    if (endInput) { endInput.readOnly = false; endInput.style.opacity = '1'; endVal = endInput.value; }
  }

  if (preview && endVal) {
    const s = new Date(startVal + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const e = new Date(endVal   + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const prevP = invPeriods.find(p => p.end_date < startVal && !p.is_spot_check);
    const carryNote = prevP
      ? `Auto-carry available from period ending <strong style="color:var(--ivory);">${prevP.end_date}</strong>`
      : '<em>First period — opening balances require manual counts</em>';
    preview.innerHTML = `Range: <strong style="color:var(--ivory);">${s} → ${e}</strong><br>${carryNote}`;
  }
}

async function invCreatePeriod() {
  const type     = document.getElementById('invNewPeriodType')?.value || 'week';
  const startVal = document.getElementById('invNewPeriodStart')?.value;
  const endVal   = document.getElementById('invNewPeriodEnd')?.value;
  const label    = document.getElementById('invNewPeriodLabel')?.value.trim() || null;
  const spotCheck = document.getElementById('invNewPeriodSpotCheck')?.checked || false;

  if (!startVal)         { showToast('Select a start date', '');              return; }
  if (!endVal)           { showToast('Select an end date', '');               return; }
  if (endVal < startVal) { showToast('End date must be after start date', ''); return; }

  // Warn on overlap
  const overlap = invPeriods.find(p =>
    !p.is_spot_check && !(p.end_date < startVal || p.start_date > endVal)
  );
  if (overlap && !spotCheck && !confirm(`This overlaps with an existing period (${overlap.start_date} → ${overlap.end_date}). Continue?`)) return;

  const { data, error } = await supabaseClient.from('inv_periods').insert({
    period_type:  type,
    start_date:   startVal,
    end_date:     endVal,
    label:        label,
    status:       'open',
    is_spot_check: spotCheck,
    created_by:   'owner'
  }).select().single();

  if (error) { showToast('Error: ' + error.message, ''); return; }

  closeInvPeriodModal();
  invPeriods.unshift(data);
  invActivePeriod = data;
  invRenderPeriodList();
  invRenderPeriodDetail();
  showToast('Period created', 'success');
}

// ═══════════════════════════════════════════════════════════════════
// ── INV-08: SPOT CHECK SYSTEM ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

let spotCheckState = {
  periodId:   null,
  location:   null,
  category:   '',
  baseline:   {},   // { product_id: qty } — last known counts
  spotCounts: {},   // { product_id: qty } — entered this session
  savedSession: null
};

async function invRenderSpotCheckDetail(period) {
  const el = document.getElementById('invPeriodDetailPanel');
  if (!el) return;
  const locked = period.status === 'locked';
  const start  = new Date(period.start_date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

  spotCheckState.periodId = period.id;
  spotCheckState.location = spotCheckState.location || ACTIVE_LOCATIONS.find(l => l !== 'LR') || 'BAR1';

  // Check if a spot check session already exists for this period
  const { data: existingSessions } = await supabaseClient
    .from('inv_sessions')
    .select('id, location, status, opened_at')
    .eq('period_id', period.id)
    .eq('count_type', 'spot_check')
    .order('opened_at', { ascending: false });

  const hasSaved = existingSessions?.length > 0;

  el.innerHTML = `
  <div class="panel">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
      <div>
        <div style="font-family:var(--font-label);font-size:10px;letter-spacing:0.3em;color:var(--gold-warm);margin-bottom:4px;">SPOT CHECK</div>
        <div style="font-family:var(--font-display);font-size:26px;font-weight:300;color:var(--ivory);">${period.label || start}</div>
        <div style="font-size:13px;color:var(--ash);margin-top:4px;">Quick variance check — select location and category</div>
      </div>
      <span class="inv-pstatus ${period.status}" style="font-size:11px;padding:5px 14px;">${period.status.toUpperCase()}</span>
    </div>

    <!-- Controls -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:20px;padding:16px;background:rgba(218,165,32,0.04);border:1px solid rgba(218,165,32,0.15);border-radius:8px;">
      <div>
        <div style="font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);margin-bottom:5px;">LOCATION</div>
        <select id="spotLocSelect" onchange="spotCheckChangeLocation(this.value)"
          style="background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:8px 12px;color:var(--ivory);font-family:var(--font-body);font-size:13px;">
          ${ACTIVE_LOCATIONS.map(id => {
            const b = BAR_CONFIG.find(x => x.id === id);
            return `<option value="${id}" ${id === spotCheckState.location ? 'selected' : ''}>${b.emoji} ${b.label}</option>`;
          }).join('')}
        </select>
      </div>
      <div>
        <div style="font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);margin-bottom:5px;">CATEGORY</div>
        <select id="spotCatSelect" onchange="spotCheckChangeCategory(this.value)"
          style="background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:8px 12px;color:var(--ivory);font-family:var(--font-body);font-size:13px;">
          <option value="">All Categories</option>
          ${INV_CAT_ORDER.map(c => `<option value="${c}" ${c === spotCheckState.category ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      ${!locked ? `
      <button onclick="spotCheckSave('${period.id}')"
        style="padding:9px 20px;border-radius:6px;background:linear-gradient(135deg,var(--owner-accent),var(--owner-gold));border:none;color:#fff;font-family:var(--font-label);font-size:11px;letter-spacing:0.12em;cursor:pointer;margin-left:auto;">
        ✓ Save Spot Count
      </button>` : ''}
    </div>

    <!-- Prior sessions summary -->
    ${hasSaved ? `
    <div style="margin-bottom:16px;padding:10px 14px;background:rgba(76,175,80,0.06);border:1px solid rgba(76,175,80,0.25);border-radius:6px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <span style="font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:#81C784;">SAVED SESSIONS</span>
      ${existingSessions.map(s => {
        const t = new Date(s.opened_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
        return `<span style="font-size:12px;color:var(--mist);">${s.location} · ${t}</span>`;
      }).join('<span style="color:var(--graphite);">|</span>')}
      <button onclick="spotCheckLoadResults('${period.id}')"
        style="margin-left:auto;padding:5px 14px;border-radius:4px;border:1px solid rgba(76,175,80,0.35);background:none;color:#81C784;font-family:var(--font-label);font-size:9px;letter-spacing:0.12em;cursor:pointer;">
        View Variance Report
      </button>
    </div>` : ''}

    <!-- Product table -->
    <div id="spotCheckTableArea">
      <div style="text-align:center;padding:32px;color:var(--ash);">Loading baseline counts…</div>
    </div>
  </div>`;

  await spotCheckLoadBaseline();
}

function spotCheckChangeLocation(loc) {
  spotCheckState.location   = loc;
  spotCheckState.spotCounts = {};
  spotCheckLoadBaseline();
}

function spotCheckChangeCategory(cat) {
  spotCheckState.category = cat;
  spotCheckRenderTable();
}

async function spotCheckLoadBaseline() {
  // Find most recent closed session for this location to use as baseline
  const { data: sessions } = await supabaseClient
    .from('inv_sessions')
    .select('id, week_of')
    .eq('location', spotCheckState.location)
    .eq('status', 'closed')
    .not('count_type', 'eq', 'spot_check')
    .order('opened_at', { ascending: false })
    .limit(1);

  spotCheckState.baseline = {};

  if (sessions?.length) {
    const { data: counts } = await supabaseClient
      .from('inv_counts')
      .select('product_id, quantity')
      .eq('session_id', sessions[0].id);
    if (counts) counts.forEach(c => { spotCheckState.baseline[c.product_id] = c.quantity; });
  }

  spotCheckRenderTable();
}

function spotCheckRenderTable() {
  const el = document.getElementById('spotCheckTableArea');
  if (!el) return;
  const loc    = spotCheckState.location;
  const cat    = spotCheckState.category;
  const locked = invActivePeriod?.status === 'locked';

  const products = invMgrProducts.filter(p =>
    p.active !== false && (!cat || p.category === cat)
  );

  if (!products.length) {
    el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--ash);font-size:13px;">No products found.</div>`;
    return;
  }

  // Group by category
  const byCat = {};
  products.forEach(p => {
    if (!byCat[p.category]) byCat[p.category] = [];
    byCat[p.category].push(p);
  });
  const sorted = INV_CAT_ORDER.filter(c => byCat[c]).concat(Object.keys(byCat).filter(c => !INV_CAT_ORDER.includes(c)));

  const hasBaseline = Object.keys(spotCheckState.baseline).length > 0;

  el.innerHTML = `
  <div style="font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);margin-bottom:8px;">
    ${loc} · ${hasBaseline ? 'Baseline from last count session' : '⚠ No prior count found — variances will show as N/A'}
  </div>
  <div style="overflow-x:auto;">
  <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:480px;">
    <thead><tr style="border-bottom:1px solid var(--graphite);">
      <th style="padding:9px 12px;text-align:left;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">PRODUCT</th>
      <th style="padding:9px 12px;text-align:right;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">LAST KNOWN</th>
      <th style="padding:9px 12px;text-align:center;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--owner-gold);">SPOT COUNT</th>
      <th style="padding:9px 12px;text-align:right;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">VARIANCE</th>
    </tr></thead>
    <tbody>
    ${sorted.map(cat => {
      const rows = byCat[cat].map(p => {
        const baseline  = spotCheckState.baseline[p.id];
        const spot      = spotCheckState.spotCounts[p.id];
        const variance  = (spot !== undefined && baseline !== undefined) ? (spot - baseline) : null;
        const varColor  = variance === null ? 'var(--ash)'
                        : variance === 0   ? '#81C784'
                        : variance > 0     ? '#81C784'
                        : Math.abs(variance) <= 0.5 ? 'var(--gold-warm)' : 'var(--ember)';
        const varStr    = variance === null ? '—'
                        : `${variance >= 0 ? '+' : ''}${variance % 1 === 0 ? variance : variance.toFixed(1)}`;
        const alertFlag = variance !== null && variance < -0.5
                        ? `<span style="font-size:9px;color:var(--ember);margin-left:4px;">⚠</span>` : '';

        return `<tr style="border-bottom:1px solid rgba(42,42,42,0.3);">
          <td style="padding:9px 12px;">
            <div style="color:var(--ivory);font-size:13px;">${p.name}</div>
            <div style="font-size:10px;color:var(--ash);">${p.category}</div>
          </td>
          <td style="padding:9px 12px;text-align:right;font-family:var(--font-display);font-size:15px;color:var(--ash);">
            ${baseline !== undefined ? (baseline % 1 === 0 ? baseline : baseline.toFixed(1)) : '—'}
          </td>
          <td style="padding:8px 12px;text-align:center;">
            ${locked ? `<span style="font-family:var(--font-display);font-size:15px;color:var(--mist);">${spot !== undefined ? spot : '—'}</span>` : `
            <input type="number" min="0" step="0.5" placeholder="—"
              value="${spot !== undefined ? spot : ''}"
              data-pid="${p.id}"
              onchange="spotCheckEnterCount('${p.id}', this.value)"
              style="width:72px;background:var(--void);border:1px solid var(--graphite);border-radius:4px;padding:6px 8px;color:var(--ivory);font-family:var(--font-display);font-size:15px;text-align:center;outline:none;"
              onfocus="this.select()"
              oninput="spotCheckEnterCount('${p.id}', this.value)"/>`}
          </td>
          <td style="padding:9px 12px;text-align:right;font-family:var(--font-display);font-size:16px;color:${varColor};">
            ${varStr}${alertFlag}
          </td>
        </tr>`;
      }).join('');

      return `<tr style="background:rgba(218,165,32,0.03);">
        <td colspan="4" style="padding:6px 12px;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--owner-gold);">${cat}</td>
      </tr>${rows}`;
    }).join('')}
    </tbody>
  </table>
  </div>`;
}

function spotCheckEnterCount(pid, val) {
  const qty = parseFloat(val);
  if (!isNaN(qty) && qty >= 0) {
    spotCheckState.spotCounts[pid] = qty;
  } else {
    delete spotCheckState.spotCounts[pid];
  }
  // Re-render variance column only (lightweight)
  const rows = document.querySelectorAll('#spotCheckTableArea tbody tr');
  rows.forEach(row => {
    const input = row.querySelector(`input[data-pid="${pid}"]`);
    if (!input) return;
    const varCell = row.cells[3];
    if (!varCell) return;
    const baseline  = spotCheckState.baseline[pid];
    const spot      = spotCheckState.spotCounts[pid];
    const variance  = (spot !== undefined && baseline !== undefined) ? (spot - baseline) : null;
    const varColor  = variance === null ? 'var(--ash)'
                    : variance === 0   ? '#81C784'
                    : variance > 0     ? '#81C784'
                    : Math.abs(variance) <= 0.5 ? 'var(--gold-warm)' : 'var(--ember)';
    const varStr    = variance === null ? '—'
                    : `${variance >= 0 ? '+' : ''}${variance % 1 === 0 ? variance : variance.toFixed(1)}`;
    const alertFlag = variance !== null && variance < -0.5
                    ? `<span style="font-size:9px;color:var(--ember);margin-left:4px;">⚠</span>` : '';
    varCell.innerHTML = `<span style="font-family:var(--font-display);font-size:16px;color:${varColor};">${varStr}${alertFlag}</span>`;
  });
}

async function spotCheckSave(periodId) {
  if (!Object.keys(spotCheckState.spotCounts).length) {
    showToast('Enter at least one count before saving', '');
    return;
  }
  const loc   = spotCheckState.location;
  const today = new Date().toISOString().slice(0, 10);

  // Create spot check session
  const { data: sess, error: sessErr } = await supabaseClient
    .from('inv_sessions')
    .insert({
      location:    loc,
      status:      'closed',
      opened_by:   'owner',
      closed_at:   new Date().toISOString(),
      week_of:     today,
      period_id:   periodId,
      count_type:  'spot_check'
    })
    .select()
    .single();

  if (sessErr || !sess) { showToast('Error saving session: ' + (sessErr?.message||''), ''); return; }

  // Insert counts
  const countRows = Object.entries(spotCheckState.spotCounts).map(([pid, qty]) => ({
    session_id:  sess.id,
    product_id:  pid,
    location:    loc,
    quantity:    qty,
    counted_by:  'owner',
    count_type:  'spot_check'
  }));

  const { error: cntErr } = await supabaseClient.from('inv_counts').insert(countRows);
  if (cntErr) { showToast('Error saving counts: ' + cntErr.message, ''); return; }

  showToast(`Spot check saved — ${countRows.length} items at ${loc}`, 'success');
  spotCheckState.spotCounts = {};
  // Reload detail to show saved sessions bar
  invRenderSpotCheckDetail(invActivePeriod);
}

async function spotCheckLoadResults(periodId) {
  const el = document.getElementById('spotCheckTableArea');
  if (!el) return;
  el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--ash);">Loading results…</div>`;

  // Load all spot check sessions for this period
  const { data: sessions } = await supabaseClient
    .from('inv_sessions')
    .select('id, location')
    .eq('period_id', periodId)
    .eq('count_type', 'spot_check');

  if (!sessions?.length) { el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--ash);">No spot check data found.</div>`; return; }

  // Load counts for all sessions
  const allSpot = {};  // { location: { pid: qty } }
  for (const s of sessions) {
    const { data: counts } = await supabaseClient.from('inv_counts').select('product_id, quantity').eq('session_id', s.id);
    if (!allSpot[s.location]) allSpot[s.location] = {};
    if (counts) counts.forEach(c => { allSpot[s.location][c.product_id] = c.quantity; });
  }

  // Load baseline for each location
  const allBaseline = {};
  for (const loc of Object.keys(allSpot)) {
    const { data: bSess } = await supabaseClient
      .from('inv_sessions').select('id')
      .eq('location', loc).eq('status', 'closed')
      .not('count_type', 'eq', 'spot_check')
      .order('opened_at', { ascending: false }).limit(1);
    allBaseline[loc] = {};
    if (bSess?.length) {
      const { data: bCounts } = await supabaseClient.from('inv_counts').select('product_id, quantity').eq('session_id', bSess[0].id);
      if (bCounts) bCounts.forEach(c => { allBaseline[loc][c.product_id] = c.quantity; });
    }
  }

  // Build variance report
  const flagged = [];
  const rows = [];
  for (const [loc, spotPids] of Object.entries(allSpot)) {
    for (const [pid, spotQty] of Object.entries(spotPids)) {
      const p        = invMgrProducts.find(pr => pr.id === pid);
      if (!p) continue;
      const baseline = allBaseline[loc]?.[pid];
      const variance = baseline !== undefined ? spotQty - baseline : null;
      rows.push({ loc, p, spotQty, baseline, variance });
      if (variance !== null && variance < -0.5) flagged.push({ loc, p, spotQty, baseline, variance });
    }
  }

  rows.sort((a,b) => (a.variance??0) - (b.variance??0));

  el.innerHTML = `
  <div style="margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
      <span style="font-family:var(--font-label);font-size:10px;letter-spacing:0.25em;color:var(--owner-gold);">VARIANCE REPORT</span>
      ${flagged.length ? `<span style="font-family:var(--font-label);font-size:9px;letter-spacing:0.15em;padding:3px 10px;border-radius:999px;border:1px solid rgba(192,57,43,0.4);background:rgba(192,57,43,0.08);color:var(--ember);">${flagged.length} ITEMS FLAGGED</span>` : `<span style="font-family:var(--font-label);font-size:9px;letter-spacing:0.15em;padding:3px 10px;border-radius:999px;border:1px solid rgba(76,175,80,0.4);background:rgba(76,175,80,0.08);color:#81C784;">ALL CLEAR</span>`}
    </div>
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:440px;">
      <thead><tr style="border-bottom:1px solid var(--graphite);">
        <th style="padding:8px 12px;text-align:left;font-family:var(--font-label);font-size:9px;letter-spacing:0.15em;color:var(--ash);">PRODUCT</th>
        <th style="padding:8px 12px;text-align:left;font-family:var(--font-label);font-size:9px;letter-spacing:0.15em;color:var(--ash);">LOCATION</th>
        <th style="padding:8px 12px;text-align:right;font-family:var(--font-label);font-size:9px;letter-spacing:0.15em;color:var(--ash);">BASELINE</th>
        <th style="padding:8px 12px;text-align:right;font-family:var(--font-label);font-size:9px;letter-spacing:0.15em;color:var(--ash);">SPOT</th>
        <th style="padding:8px 12px;text-align:right;font-family:var(--font-label);font-size:9px;letter-spacing:0.15em;color:var(--owner-gold);">VARIANCE</th>
      </tr></thead>
      <tbody>
      ${rows.map(({loc, p, spotQty, baseline, variance}) => {
        const varColor = variance === null ? 'var(--ash)'
                       : variance >= 0 ? '#81C784'
                       : Math.abs(variance) <= 0.5 ? 'var(--gold-warm)' : 'var(--ember)';
        const varStr   = variance === null ? '—'
                       : `${variance >= 0 ? '+' : ''}${variance % 1 === 0 ? variance : variance.toFixed(1)}`;
        return `<tr style="border-bottom:1px solid rgba(42,42,42,0.3);${variance !== null && variance < -0.5 ? 'background:rgba(192,57,43,0.04);' : ''}">
          <td style="padding:8px 12px;color:var(--ivory);">${p.name}</td>
          <td style="padding:8px 12px;color:var(--ash);font-size:12px;">${loc}</td>
          <td style="padding:8px 12px;text-align:right;font-family:var(--font-display);font-size:14px;color:var(--ash);">${baseline !== undefined ? baseline : '—'}</td>
          <td style="padding:8px 12px;text-align:right;font-family:var(--font-display);font-size:14px;color:var(--mist);">${spotQty}</td>
          <td style="padding:8px 12px;text-align:right;font-family:var(--font-display);font-size:16px;color:${varColor};">${varStr}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    </div>
  </div>`;
}

// ── INV-12: OWNER COUNT EDIT ──────────────────────────────────────
// Edit any count session (opening, closing, spot) — owner only.
// All edits are audit-logged to inv_count_edits.

let invEditSessionId   = null;
let invEditSessionLoc  = null;
let invEditSessionType = null;
let invEditCounts      = [];   // { count_id, product_id, name, category, old_qty, new_qty }

async function invOpenEditCounts(sessionId, location, countType) {
  invEditSessionId   = sessionId;
  invEditSessionLoc  = location;
  invEditSessionType = countType;
  invEditCounts      = [];

  // Show modal with loading state
  invShowEditModal();

  // Load existing counts for this session
  const { data: counts, error: cErr } = await supabaseClient
    .from('inv_counts')
    .select('id, product_id, quantity, count_type')
    .eq('session_id', sessionId)
    .order('count_type');

  if (cErr) { showToast('Error loading counts: ' + cErr.message, ''); return; }

  // Load all active products for this location (so owner can add missing ones too)
  const { data: products } = await supabaseClient
    .from('inv_products')
    .select('id, name, category')
    .eq('active', true)
    .order('category')
    .order('name');

  const prodMap = {};
  (products || []).forEach(p => prodMap[p.id] = p);

  // Build edit rows — existing counts first
  const existingPids = new Set();
  (counts || []).forEach(c => {
    const prod = prodMap[c.product_id];
    if (!prod) return;
    existingPids.add(c.product_id);
    invEditCounts.push({
      count_id:   c.id,
      product_id: c.product_id,
      name:       prod.name,
      category:   prod.category,
      old_qty:    c.quantity,
      new_qty:    c.quantity
    });
  });

  // Sort by category then name
  invEditCounts.sort((a,b) => {
    const catCmp = (a.category||'').localeCompare(b.category||'');
    return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
  });

  invRenderEditModal();
}

function invShowEditModal() {
  let modal = document.getElementById('invEditCountsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'invEditCountsModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    modal.addEventListener('click', e => { if (e.target === modal) invCloseEditModal(); });
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  modal.innerHTML = `<div style="background:var(--carbon);border:1px solid rgba(218,165,32,0.3);border-radius:12px;padding:32px;width:100%;max-width:640px;max-height:88vh;overflow-y:auto;box-shadow:0 8px 48px rgba(0,0,0,0.7);">
    <div style="text-align:center;padding:32px;color:var(--ash);font-size:13px;">Loading counts…</div>
  </div>`;
}

function invRenderEditModal() {
  const modal = document.getElementById('invEditCountsModal');
  if (!modal) return;
  const typeLabel = { opening:'Opening', closing:'Closing', spot_check:'Spot Check' }[invEditSessionType] || invEditSessionType;

  let lastCat = null;
  const rows = invEditCounts.map((row, i) => {
    let catHeader = '';
    if (row.category !== lastCat) {
      lastCat = row.category;
      catHeader = `<tr><td colspan="3" style="padding:10px 8px 4px;font-family:var(--font-label);font-size:9px;letter-spacing:0.25em;color:var(--owner-gold);border-bottom:1px solid rgba(218,165,32,0.15);">${row.category}</td></tr>`;
    }
    return `${catHeader}
    <tr>
      <td style="padding:8px 8px;color:var(--ivory);font-size:13px;">${row.name}</td>
      <td style="padding:8px 8px;color:var(--ash);font-size:12px;text-align:right;">${row.old_qty}</td>
      <td style="padding:8px 8px;">
        <input type="number" min="0" step="0.25"
          value="${row.new_qty}"
          data-idx="${i}"
          onchange="invEditCountChange(${i}, this.value)"
          style="width:80px;background:var(--void);border:1px solid var(--graphite);border-radius:4px;padding:5px 8px;color:var(--ivory);font-family:var(--font-display);font-size:14px;text-align:center;outline:none;"
          onfocus="this.style.borderColor='var(--owner-gold)'"
          onblur="this.style.borderColor='var(--graphite)'" />
      </td>
    </tr>`;
  }).join('');

  modal.innerHTML = `
  <div style="background:var(--carbon);border:1px solid rgba(218,165,32,0.3);border-radius:12px;padding:28px;width:100%;max-width:640px;max-height:88vh;overflow-y:auto;box-shadow:0 8px 48px rgba(0,0,0,0.7);">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;">
      <div>
        <div style="font-family:var(--font-label);font-size:10px;letter-spacing:0.3em;color:var(--owner-gold);margin-bottom:4px;">EDIT COUNT — OWNER</div>
        <div style="font-family:var(--font-display);font-size:22px;font-weight:300;color:var(--ivory);">${invEditSessionLoc} · ${typeLabel}</div>
      </div>
      <button onclick="invCloseEditModal()" style="background:none;border:none;color:var(--ash);font-size:22px;cursor:pointer;padding:0 4px;line-height:1;">×</button>
    </div>
    <div style="font-size:12px;color:var(--ash);margin-bottom:20px;">Changes are audit-logged with your name and timestamp. All edits are reversible.</div>

    <div style="background:rgba(218,165,32,0.05);border:1px solid rgba(218,165,32,0.15);border-radius:6px;padding:10px 14px;margin-bottom:20px;">
      <div style="display:flex;gap:4px;">
        <div style="flex:1;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">PRODUCT</div>
        <div style="width:60px;text-align:right;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--ash);">CURRENT</div>
        <div style="width:90px;text-align:center;font-family:var(--font-label);font-size:9px;letter-spacing:0.2em;color:var(--owner-gold);">NEW QTY</div>
      </div>
    </div>

    <div style="overflow-y:auto;max-height:380px;">
    <table style="width:100%;border-collapse:collapse;">
      <colgroup><col style="width:auto"><col style="width:70px"><col style="width:90px"></colgroup>
      <tbody id="invEditCountsBody">${rows}</tbody>
    </table>
    </div>

    <div style="margin-top:16px;">
      <label style="display:block;font-family:var(--font-label);font-size:10px;letter-spacing:0.2em;color:var(--owner-gold);margin-bottom:6px;">REASON / NOTE (optional)</label>
      <input type="text" id="invEditCountNote" placeholder="e.g. Recount after delivery, corrected miscount…"
        style="width:100%;background:var(--void);border:1px solid var(--graphite);border-radius:6px;padding:10px 14px;color:var(--ivory);font-family:var(--font-body);font-size:13px;outline:none;box-sizing:border-box;"
        onfocus="this.style.borderColor='var(--owner-gold)'"
        onblur="this.style.borderColor='var(--graphite)'" />
    </div>

    <div style="display:flex;gap:10px;margin-top:20px;">
      <button onclick="invSaveEditCounts()"
        style="flex:1;padding:13px;border-radius:6px;background:linear-gradient(135deg,var(--owner-accent),var(--owner-gold));border:none;color:#fff;font-family:var(--font-label);font-size:12px;letter-spacing:0.15em;cursor:pointer;">
        ✓ SAVE CHANGES
      </button>
      <button onclick="invCloseEditModal()"
        style="padding:13px 20px;border-radius:6px;background:none;border:1px solid var(--graphite);color:var(--ash);font-family:var(--font-body);font-size:13px;cursor:pointer;">
        Cancel
      </button>
    </div>
    <div id="invEditCountStatus" style="margin-top:12px;font-size:12px;min-height:18px;text-align:center;"></div>
  </div>`;
}

function invEditCountChange(idx, val) {
  const num = parseFloat(val);
  if (!isNaN(num) && num >= 0) {
    invEditCounts[idx].new_qty = num;
  }
}

async function invSaveEditCounts() {
  const note    = (document.getElementById('invEditCountNote')?.value || '').trim();
  const changed = invEditCounts.filter(r => r.new_qty !== r.old_qty);
  const statusEl = document.getElementById('invEditCountStatus');

  if (!changed.length) {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--ash);">No changes made.</span>`;
    return;
  }

  if (statusEl) statusEl.innerHTML = `<span style="color:var(--ash);">Saving ${changed.length} change${changed.length!==1?'s':''}…</span>`;

  // Get current owner identity for audit log
  const { data: { user } } = await supabaseClient.auth.getUser();
  const editedBy = user?.email || user?.id || 'owner';
  const editedAt = new Date().toISOString();

  let errors = 0;
  for (const row of changed) {
    // Update inv_counts
    const { error: updErr } = await supabaseClient
      .from('inv_counts')
      .update({ quantity: row.new_qty })
      .eq('id', row.count_id);

    if (updErr) { errors++; continue; }

    // Write audit record
    await supabaseClient.from('inv_count_edits').insert({
      count_id:    row.count_id,
      session_id:  invEditSessionId,
      product_id:  row.product_id,
      old_qty:     row.old_qty,
      new_qty:     row.new_qty,
      note:        note || null,
      edited_by:   editedBy,
      edited_at:   editedAt
    });
  }

  if (errors > 0) {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--ember);">${errors} error${errors!==1?'s':''} — some changes may not have saved.</span>`;
  } else {
    showToast(`${changed.length} count${changed.length!==1?'s':''} updated`, 'success');
    invCloseEditModal();
    // Refresh the period detail to show updated session info
    if (invActivePeriod) invRenderPeriodDetail();
  }
}

function invCloseEditModal() {
  const modal = document.getElementById('invEditCountsModal');
  if (modal) modal.style.display = 'none';
  invEditSessionId   = null;
  invEditSessionLoc  = null;
  invEditSessionType = null;
  invEditCounts      = [];
}
// ── END INV-12 ────────────────────────────────────────────────────
