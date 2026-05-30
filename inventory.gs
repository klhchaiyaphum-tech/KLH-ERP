// ============================================================
//  inventory.js — KLH ERP Phase 2: WMS Backend
//  Shares: SHEET_ID (Code.js)
// ============================================================

const SH_LOG  = 'STOCK_LOG';
const SH_WH   = 'WAREHOUSE';
const SH_CFG  = 'SKU_WH_CONFIG';
const SH_BAL  = 'STOCK_BALANCE';
const SH_PL   = 'PICK_LIST';
const SH_FIFO = 'FIFO_BATCH';

const H_LOG  = ['Date','Time','Type','SKU','Product_Name','Entity','Warehouse','Qty','Unit','Cost_Per_Unit','Amount','Ref','User','Note'];
const H_WH   = ['WH_ID','WH_Name','Entity','Location','Manager','Active'];
const H_CFG  = ['SKU','WH_ID','ROP','ROQ','Max_Stock','Active'];
const H_BAL  = ['SKU','Product_Name','WH_ID','Qty_On_Hand','Qty_Reserved','Cost_Avg','Last_Updated'];
const H_PL   = ['PL_ID','Date','WH_From','WH_To','SKU','Product_Name','Qty_Req','Qty_Picked','Status','Picker','Created_By','Note'];
const H_FIFO = ['Batch_ID','Date','SKU','WH_ID','Qty_Remaining','Cost_Per_Unit','Ref'];

// ── Helpers ───────────────────────────────────────────────────
function ss_()     { return SpreadsheetApp.openById(SHEET_ID); }
function sh_(n)    { return ss_().getSheetByName(n); }
function now_()    { return new Date(); }
function fmt_(d,f) { return Utilities.formatDate(d, 'Asia/Bangkok', f); }
function user_()   { return Session.getActiveUser().getEmail(); }

// ── Init Sheets ───────────────────────────────────────────────
function initWmsSheets() {
  const ss = ss_();
  const defs = [
    [SH_LOG, H_LOG], [SH_WH, H_WH], [SH_CFG, H_CFG],
    [SH_BAL, H_BAL], [SH_PL, H_PL], [SH_FIFO, H_FIFO],
  ];
  const result = [];
  defs.forEach(([name, hdr]) => {
    let s = ss.getSheetByName(name);
    if (!s) { s = ss.insertSheet(name); result.push('+ ' + name); }
    else { result.push('✓ ' + name); }
    const firstCell = s.getLastRow() > 0 ? s.getRange(1,1).getValue() : '';
    if (firstCell !== hdr[0] && s.getLastRow() <= 1) {
      s.clearContents();
      s.getRange(1,1,1,hdr.length).setValues([hdr])
        .setBackground('#E65100').setFontColor('#fff').setFontWeight('bold');
      s.setFrozenRows(1);
    }
  });

  const wh = ss.getSheetByName(SH_WH);
  if (wh && wh.getLastRow() <= 1) {
    wh.getRange(2,1,5,6).setValues([
      ['W1','คลังกลาง','หจก.เค แอล เอช','ไชยภูมิ','',true],
      ['W2','สาขา 2',  'หจก.เค แอล เอช','','',true],
      ['W3','สาขา 3',  'หจก.เค แอล เอช','','',true],
      ['W4','สาขา 4',  'หจก.เค แอล เอช','','',true],
      ['W5','สาขา 5',  'หจก.เค แอล เอช','','',true],
    ]);
  }
  return result.join('\n');
}

// ── Page Init ─────────────────────────────────────────────────
function getWmsData() {
  try {
    return {
      ok: true,
      warehouses: getWarehouses_(),
      stock:      getStockBalance(''),
      pickLists:  getPickLists('PENDING'),
    };
  } catch(e) { return { ok: false, msg: e.message }; }
}

function getWarehouses_() {
  const d = sh_(SH_WH).getDataRange().getValues();
  return d.slice(1).filter(r => r[5] === true)
    .map(r => ({ id: r[0], name: r[1], entity: r[2], location: r[3] }));
}

// ── SKU Lookup ────────────────────────────────────────────────
function lookupSkuForWms(sku) {
  try {
    const s = ss_().getSheetByName('PRODUCTS');
    if (!s) return null;
    const rows = s.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === String(sku).trim())
        return { sku: rows[i][0], name: rows[i][1], unit: rows[i][2], entity: rows[i][3] };
    }
    return null;
  } catch(e) { return null; }
}

// ── Stock Balance ─────────────────────────────────────────────
function getStockBalance(whId) {
  const d = sh_(SH_BAL).getDataRange().getValues();
  return d.slice(1)
    .filter(r => !whId || r[2] === whId)
    .map(r => ({
      sku: r[0], name: r[1], wh: r[2],
      onHand: Number(r[3]) || 0,
      reserved: Number(r[4]) || 0,
      costAvg: parseFloat(Number(r[5]).toFixed(2)),
      updated: r[6] ? fmt_(new Date(r[6]), 'dd/MM/yy HH:mm') : ''
    }));
}

function updateBal_(sku, pName, whId, delta, newCost) {
  const s = sh_(SH_BAL);
  const d = s.getDataRange().getValues();
  const now = now_();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]) === String(sku) && d[i][2] === whId) {
      const oldQ = Number(d[i][3]) || 0;
      const oldC = Number(d[i][5]) || 0;
      const newQ = Math.max(0, oldQ + delta);
      let avgC = oldC;
      if (delta > 0 && newCost > 0)
        avgC = newQ > 0 ? (oldQ * oldC + delta * newCost) / newQ : newCost;
      s.getRange(i+1,4).setValue(newQ);
      s.getRange(i+1,6).setValue(avgC);
      s.getRange(i+1,7).setValue(now);
      return newQ;
    }
  }
  const newQ = Math.max(0, delta);
  s.appendRow([sku, pName || sku, whId, newQ, 0, newCost || 0, now]);
  return newQ;
}

// ── FIFO Batch ────────────────────────────────────────────────
function addBatch_(sku, whId, qty, cost, ref) {
  sh_(SH_FIFO).appendRow(['B'+Date.now(), now_(), sku, whId, qty, cost, ref]);
}

function consumeFifo_(sku, whId, needed) {
  const s = sh_(SH_FIFO);
  const d = s.getDataRange().getValues();
  let rem = needed, totalCost = 0;
  for (let i = 1; i < d.length && rem > 0; i++) {
    if (String(d[i][2]) === String(sku) && d[i][3] === whId && Number(d[i][4]) > 0) {
      const bq = Number(d[i][4]), bc = Number(d[i][5]);
      const use = Math.min(bq, rem);
      totalCost += use * bc;
      rem -= use;
      s.getRange(i+1,5).setValue(bq - use);
    }
  }
  if (rem > 0) return { ok: false, msg: `สต็อกใน ${whId} ไม่พอ (ขาด ${rem})` };
  return { ok: true, unitCost: needed > 0 ? totalCost / needed : 0 };
}

// ── Receive Goods ─────────────────────────────────────────────
function receiveGoods(d) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const { sku, whId, qty, cost, ref, note, entity, pName, unit, date } = d;
    const q = Number(qty), c = Number(cost) || 0;
    if (!sku || !whId || q <= 0) return { ok: false, msg: 'ข้อมูลไม่ครบ: SKU / คลัง / จำนวน' };

    const txDate = date ? fmt_(new Date(date), 'yyyy-MM-dd') : fmt_(now_(), 'yyyy-MM-dd');
    sh_(SH_LOG).appendRow([txDate, fmt_(now_(),'HH:mm:ss'),
      'IN', sku, pName||sku, entity||'', whId, q, unit||'', c, q*c, ref||'', user_(), note||'']);
    addBatch_(sku, whId, q, c, ref||'');
    const newQ = updateBal_(sku, pName, whId, q, c);
    ropAlert_(sku, whId, newQ);
    return { ok: true, msg: `รับสินค้า ${sku} × ${q} → ${whId} สำเร็จ`, newQty: newQ };
  } catch(e) { return { ok: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

// ── Transfer Goods ────────────────────────────────────────────
function transferGoods(d) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const { sku, fromWH, toWH, qty, ref, note, pName, unit, entity } = d;
    const q = Number(qty);
    if (!sku || !fromWH || !toWH || q <= 0) return { ok: false, msg: 'ข้อมูลไม่ครบ' };
    if (fromWH === toWH) return { ok: false, msg: 'คลังต้นทาง/ปลายทางต้องต่างกัน' };

    const balRows = sh_(SH_BAL).getDataRange().getValues();
    let curQ = 0;
    for (let i = 1; i < balRows.length; i++) {
      if (String(balRows[i][0]) === String(sku) && balRows[i][2] === fromWH) {
        curQ = Number(balRows[i][3]) || 0; break;
      }
    }
    if (curQ < q) return { ok: false, msg: `สต็อกใน ${fromWH} มีแค่ ${curQ} (ต้องการ ${q})` };

    const fifo = consumeFifo_(sku, fromWH, q);
    if (!fifo.ok) return fifo;

    const tRef = ref || ('TR-' + fmt_(now_(),'yyyyMMddHHmmss'));
    const base = [fmt_(now_(),'yyyy-MM-dd'), fmt_(now_(),'HH:mm:ss'), '',
                  sku, pName||sku, entity||'', '', q, unit||'',
                  fifo.unitCost, q*fifo.unitCost, tRef, user_(), note||''];
    const logSh = sh_(SH_LOG);
    const rowOut = [...base]; rowOut[2] = 'TRANSFER_OUT'; rowOut[6] = fromWH;
    const rowIn  = [...base]; rowIn[2]  = 'TRANSFER_IN';  rowIn[6]  = toWH;
    logSh.appendRow(rowOut);
    logSh.appendRow(rowIn);

    updateBal_(sku, pName, fromWH, -q, 0);
    addBatch_(sku, toWH, q, fifo.unitCost, tRef);
    const newQ = updateBal_(sku, pName, toWH, q, fifo.unitCost);
    ropAlert_(sku, fromWH, curQ - q);
    return { ok: true, msg: `โอน ${sku} × ${q}  ${fromWH} → ${toWH} สำเร็จ`, ref: tRef };
  } catch(e) { return { ok: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

// ── Adjust Stock ──────────────────────────────────────────────
function adjustStock(d) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const { sku, whId, qtyActual, reason, pName, unit, entity } = d;
    const actual = Number(qtyActual);
    const balRows = sh_(SH_BAL).getDataRange().getValues();
    let sysQ = 0;
    for (let i = 1; i < balRows.length; i++) {
      if (String(balRows[i][0]) === String(sku) && balRows[i][2] === whId) {
        sysQ = Number(balRows[i][3]) || 0; break;
      }
    }
    const diff = actual - sysQ;
    if (diff === 0) return { ok: true, msg: 'ไม่มีการเปลี่ยนแปลง' };

    sh_(SH_LOG).appendRow([fmt_(now_(),'yyyy-MM-dd'), fmt_(now_(),'HH:mm:ss'),
      'ADJUST', sku, pName||sku, entity||'', whId, diff, unit||'', 0, 0,
      'ADJUST', user_(), reason||'']);
    if (diff > 0) addBatch_(sku, whId, diff, 0, 'ADJUST');
    else consumeFifo_(sku, whId, Math.abs(diff));
    const newQ = updateBal_(sku, pName, whId, diff, 0);
    return { ok: true, msg: `ปรับสต็อก ${sku}: ${sysQ} → ${actual} (${diff > 0 ? '+' : ''}${diff})`, newQty: newQ };
  } catch(e) { return { ok: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

// ── Pick List ─────────────────────────────────────────────────
function createPickList(d) {
  try {
    const now = now_();
    const plId = 'PL-' + fmt_(now,'yyyyMMdd-HHmmss');
    const rows = (d.items || []).map(it => [
      plId, fmt_(now,'yyyy-MM-dd'), d.whFrom||'', d.whTo||'',
      it.sku, it.name||it.sku, it.qty, 0, 'PENDING', '', user_(), d.note||''
    ]);
    if (!rows.length) return { ok: false, msg: 'ไม่มีรายการสินค้า' };
    const s = sh_(SH_PL);
    s.getRange(s.getLastRow()+1, 1, rows.length, 12).setValues(rows);
    return { ok: true, plId, msg: `สร้าง ${plId} (${rows.length} รายการ) สำเร็จ` };
  } catch(e) { return { ok: false, msg: e.message }; }
}

function getPickLists(status) {
  const d = sh_(SH_PL).getDataRange().getValues();
  const rows = d.slice(1).filter(r => !status || r[8] === status);
  const map = {};
  rows.forEach(r => {
    const id = r[0];
    if (!map[id]) map[id] = { plId: id, date: r[1], whFrom: r[2], whTo: r[3], status: r[8], picker: r[9], note: r[11], items: [] };
    map[id].items.push({ sku: r[4], name: r[5], qtyReq: Number(r[6]), qtyPicked: Number(r[7]) });
  });
  return Object.values(map);
}

function updatePickItem(plId, sku, qtyPicked) {
  try {
    const s = sh_(SH_PL);
    const d = s.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
      if (d[i][0] === plId && String(d[i][4]) === String(sku)) {
        s.getRange(i+1,8).setValue(Number(qtyPicked));
        s.getRange(i+1,10).setValue(user_());
        d[i][7] = Number(qtyPicked);
      }
    }
    const plRows = d.slice(1).filter(r => r[0] === plId);
    const allDone = plRows.every(r => Number(r[7]) >= Number(r[6]));
    if (allDone) {
      for (let i = 1; i < d.length; i++) {
        if (d[i][0] === plId) s.getRange(i+1,9).setValue('DONE');
      }
    }
    return { ok: true, allDone };
  } catch(e) { return { ok: false, msg: e.message }; }
}

function completePickList(plId) {
  try {
    const s = sh_(SH_PL);
    const d = s.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
      if (d[i][0] === plId) s.getRange(i+1,9).setValue('DONE');
    }
    return { ok: true };
  } catch(e) { return { ok: false, msg: e.message }; }
}

// ── ROP Config ────────────────────────────────────────────────
function getRopConfig(whId) {
  const d = sh_(SH_CFG).getDataRange().getValues();
  return d.slice(1)
    .filter(r => !whId || r[1] === whId)
    .map(r => ({ sku: r[0], wh: r[1], rop: Number(r[2]), roq: Number(r[3]), maxStock: Number(r[4]), active: r[5] }));
}

function saveRopConfigs(configs) {
  try {
    const s = sh_(SH_CFG);
    const d = s.getDataRange().getValues();
    configs.forEach(cfg => {
      let found = false;
      for (let i = 1; i < d.length; i++) {
        if (String(d[i][0]) === String(cfg.sku) && d[i][1] === cfg.wh) {
          s.getRange(i+1,3,1,4).setValues([[cfg.rop||0, cfg.roq||0, cfg.maxStock||0, cfg.active !== false]]);
          found = true; break;
        }
      }
      if (!found) s.appendRow([cfg.sku, cfg.wh, cfg.rop||0, cfg.roq||0, cfg.maxStock||0, cfg.active !== false]);
    });
    return { ok: true };
  } catch(e) { return { ok: false, msg: e.message }; }
}

// ── ROP Alert ─────────────────────────────────────────────────
function ropAlert_(sku, whId, curQ) {
  const d = sh_(SH_CFG).getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]) === String(sku) && d[i][1] === whId && d[i][5] === true) {
      const rop = Number(d[i][2]);
      if (curQ <= rop) {
        const roq = Number(d[i][3]);
        sendWmsLine_(`⚠️ สต็อกต่ำกว่า ROP!\nสินค้า: ${sku}\nคลัง: ${whId}\nคงเหลือ: ${curQ}\nROP: ${rop}${roq ? '\nควรสั่งซื้อ: '+roq+' ชิ้น' : ''}`);
      }
      break;
    }
  }
}

function checkAllRop() {
  sh_(SH_BAL).getDataRange().getValues().slice(1)
    .forEach(r => ropAlert_(r[0], r[2], Number(r[3])));
  return 'ROP check done';
}

// ── Seed Test Data ────────────────────────────────────────────
function seedTestData() {
  const ss = ss_();

  // 1) PRODUCTS sheet
  let prod = ss.getSheetByName('PRODUCTS');
  if (!prod) {
    prod = ss.insertSheet('PRODUCTS');
    prod.getRange(1,1,1,4).setValues([['SKU','Product_Name','Unit','Entity']])
      .setBackground('#1565C0').setFontColor('#fff').setFontWeight('bold');
    prod.setFrozenRows(1);
  }
  if (prod.getLastRow() <= 1) {
    prod.getRange(2,1,8,4).setValues([
      ['SKU001','น้ำดื่มตรา KLH 600ml (แพ็ก 12)',    'แพ็ก', 'หจก.เค แอล เอช'],
      ['SKU002','น้ำดื่มตรา KLH 1.5L (แพ็ก 6)',     'แพ็ก', 'หจก.เค แอล เอช'],
      ['SKU003','น้ำอัดลม 325ml (ลัง 24)',           'ลัง',  'หจก.เค แอล เอช'],
      ['SKU004','ขนมกรุบกรอบ (ลัง 36 ซอง)',         'ลัง',  'กวงล่งเฮง'],
      ['SKU005','บะหมี่กึ่งสำเร็จรูป (ลัง 30 ซอง)', 'ลัง',  'หจก.เค แอล เอช'],
      ['SKU006','ข้าวสารหอมมะลิ 5kg',               'ถุง',  'หจก.เค แอล เอช'],
      ['SKU007','น้ำตาลทราย 1kg',                   'ถุง',  'เอี่ยมเช็ง'],
      ['SKU008','น้ำมันพืช 1L',                     'ขวด', 'หจก.เค แอล เอช'],
    ]);
    Logger.log('PRODUCTS: สร้าง 8 รายการ');
  } else {
    Logger.log('PRODUCTS: มีข้อมูลอยู่แล้ว ไม่ overwrite');
  }

  // 2) Receive stock into W1 (คลังกลาง) via receiveGoods
  var testStock = [
    { sku:'SKU001', pName:'น้ำดื่ม 600ml (แพ็ก 12)',     unit:'แพ็ก', qty:120, cost:45,   entity:'หจก.เค แอล เอช' },
    { sku:'SKU002', pName:'น้ำดื่ม 1.5L (แพ็ก 6)',       unit:'แพ็ก', qty:80,  cost:65,   entity:'หจก.เค แอล เอช' },
    { sku:'SKU003', pName:'น้ำอัดลม 325ml (ลัง 24)',     unit:'ลัง',  qty:50,  cost:180,  entity:'หจก.เค แอล เอช' },
    { sku:'SKU004', pName:'ขนมกรุบกรอบ (ลัง 36)',        unit:'ลัง',  qty:40,  cost:320,  entity:'กวงล่งเฮง' },
    { sku:'SKU005', pName:'บะหมี่กึ่งสำเร็จรูป (ลัง 30)',unit:'ลัง',  qty:60,  cost:270,  entity:'หจก.เค แอล เอช' },
    { sku:'SKU006', pName:'ข้าวสารหอมมะลิ 5kg',         unit:'ถุง',  qty:200, cost:185,  entity:'หจก.เค แอล เอช' },
    { sku:'SKU007', pName:'น้ำตาลทราย 1kg',             unit:'ถุง',  qty:150, cost:22,   entity:'เอี่ยมเช็ง' },
    { sku:'SKU008', pName:'น้ำมันพืช 1L',               unit:'ขวด', qty:90,  cost:48,   entity:'หจก.เค แอล เอช' },
  ];

  // Check if STOCK_BALANCE already has data
  var bal = sh_(SH_BAL);
  if (bal.getLastRow() > 1) {
    Logger.log('STOCK_BALANCE มีข้อมูลอยู่แล้ว — ข้าม seed stock');
  } else {
    var today = fmt_(now_(), 'yyyy-MM-dd');
    var logSh = sh_(SH_LOG);
    testStock.forEach(function(item) {
      // Write STOCK_LOG
      logSh.appendRow([today, fmt_(now_(),'HH:mm:ss'),
        'IN', item.sku, item.pName, item.entity, 'W1',
        item.qty, item.unit, item.cost, item.qty * item.cost,
        'SEED-INIT', 'system', 'ข้อมูลเริ่มต้นทดสอบ']);
      // Write FIFO_BATCH
      addBatch_(item.sku, 'W1', item.qty, item.cost, 'SEED-INIT');
      // Write STOCK_BALANCE
      updateBal_(item.sku, item.pName, 'W1', item.qty, item.cost);
    });
    Logger.log('STOCK_BALANCE: seed ' + testStock.length + ' SKU เข้า W1 สำเร็จ');
  }

  // 3) Set ROP config for W1
  var cfgSh = sh_(SH_CFG);
  if (cfgSh.getLastRow() <= 1) {
    cfgSh.getRange(2,1,5,6).setValues([
      ['SKU001','W1', 20, 50,  500, true],
      ['SKU002','W1', 15, 40,  300, true],
      ['SKU003','W1', 10, 30,  200, true],
      ['SKU005','W1', 10, 30,  200, true],
      ['SKU006','W1', 30, 100, 500, true],
    ]);
    Logger.log('SKU_WH_CONFIG: seed ROP 5 รายการ');
  }

  return '✅ seedTestData เสร็จสิ้น — ดูผลใน PRODUCTS, STOCK_LOG, STOCK_BALANCE, FIFO_BATCH, SKU_WH_CONFIG';
}

// ── LINE Notification ─────────────────────────────────────────
function sendWmsLine_(text) {
  try {
    const cfg = {};
    const cs = ss_().getSheetByName('CONFIG');
    if (!cs) return;
    cs.getDataRange().getValues().forEach(r => { if (r[0]) cfg[r[0]] = r[1]; });
    if (!cfg.LINE_CHANNEL_TOKEN || !cfg.LINE_GROUP_ID) return;
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.LINE_CHANNEL_TOKEN },
      payload: JSON.stringify({ to: cfg.LINE_GROUP_ID, messages: [{ type: 'text', text }] }),
      muteHttpExceptions: true
    });
  } catch(e) { Logger.log('LINE error: ' + e.message); }
}
