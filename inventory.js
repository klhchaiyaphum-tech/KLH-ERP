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
// Reads from KLH DATA (primary) falling back to PRODUCTS sheet
function lookupSkuForWms(sku) {
  try {
    const skuStr = String(sku).trim();
    const cfg = getConfig();
    const klhSheet = ss_().getSheetByName(cfg.TAB_SURVEY || 'KLH DATA');
    if (klhSheet) {
      const rows = klhSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        const bSmall = String(rows[i][0] || '').trim();   // A: BARCODE_SMALL
        const bBig   = String(rows[i][27] || '').trim();  // AB: BARCODE_BIG
        if (bSmall === skuStr || (bBig && bBig === skuStr)) {
          return {
            sku:          rows[i][0],
            name:         rows[i][1],           // B: PRODUCT_NAME
            unit:         rows[i][5]  || '',    // F: UNIT_BIG (ลัง/แพ็ค)
            entity:       rows[i][29] || '',    // AD: TAX_ENTITY
            convRate:     Number(rows[i][4]) || 1,  // E: MULTIPLIER
            baseUnit:     'ชิ้น',
            barcodeLarge: bBig
          };
        }
      }
    }
    // Fallback: PRODUCTS sheet
    const ps = ss_().getSheetByName('PRODUCTS');
    if (!ps) return null;
    const pRows = ps.getDataRange().getValues();
    for (let i = 1; i < pRows.length; i++) {
      if (String(pRows[i][0]).trim() === skuStr)
        return {
          sku: pRows[i][0], name: pRows[i][1], unit: pRows[i][2], entity: pRows[i][3],
          convRate:     Number(pRows[i][4]) || 1,
          baseUnit:     String(pRows[i][5] || pRows[i][2] || ''),
          barcodeLarge: String(pRows[i][6] || '')
        };
    }
    return null;
  } catch(e) { return null; }
}

// ── Stock Balance ─────────────────────────────────────────────
// showAll=true → join กับ KLH DATA แสดงสินค้าทุกรายการ (รวมที่ qty=0)
function getStockBalance(whId, showAll) {
  const balData = sh_(SH_BAL).getDataRange().getValues();

  // Build map: SKU → balance row
  const balMap = {};
  balData.slice(1).forEach(function(r) {
    if (!r[0]) return;
    var key = String(r[0]) + '|' + String(r[2]);
    balMap[key] = {
      sku: r[0], name: String(r[1]||''), wh: r[2],
      onHand:   Number(r[3]) || 0,
      reserved: Number(r[4]) || 0,
      costAvg:  parseFloat(Number(r[5]).toFixed(2)),
      updated:  r[6] ? fmt_(new Date(r[6]), 'dd/MM/yy HH:mm') : ''
    };
  });

  if (!showAll) {
    // ── default: เฉพาะสินค้าที่มีการเคลื่อนไหว ───────────────
    return Object.values(balMap)
      .filter(function(r){ return !whId || r.wh === whId; });
  }

  // ── showAll: JOIN กับ KLH DATA (แสดงทุกสินค้า รวม qty=0) ────
  try {
    const cfg = getConfig();
    const klhSheet = ss_().getSheetByName(cfg.TAB_SURVEY || 'KLH DATA');
    if (!klhSheet) return Object.values(balMap);

    const klhData = klhSheet.getDataRange().getValues();
    const result  = [];
    const warehouses = whId ? [whId] : getWarehouses_().map(function(w){ return w.id; });

    klhData.slice(1).forEach(function(r) {
      const sku = String(r[0]||'').trim();
      if (!sku) return;
      warehouses.forEach(function(wh) {
        const key  = sku + '|' + wh;
        const bal  = balMap[key];
        result.push({
          sku:      sku,
          name:     bal ? bal.name : String(r[1]||''),
          wh:       wh,
          onHand:   bal ? bal.onHand   : 0,
          reserved: bal ? bal.reserved : 0,
          costAvg:  bal ? bal.costAvg  : 0,
          updated:  bal ? bal.updated  : '',
          // KLH DATA fields
          unitBig:  String(r[5]||''),   // F: UNIT_BIG
          mult:     Number(r[4])||1,    // E: MULTIPLIER
          category: String(r[2]||'')   // C: CATEGORY
        });
      });
    });
    return result;
  } catch(e) {
    Logger.log('getStockBalance showAll error: ' + e);
    return Object.values(balMap);
  }
}

// ── Recalculate STOCK_BALANCE from STOCK_LOG ─────────────────
// เรียกใน GAS Editor เพื่อ rebuild ถ้า STOCK_BALANCE เพี้ยน
function recalcStockFromLog() {
  const logData = sh_(SH_LOG).getDataRange().getValues();
  const balSheet = sh_(SH_BAL);

  // Sum movements per SKU+WH
  const totals = {}; // 'SKU|WH' → {sku, name, wh, qty, costSum, costQty}
  logData.slice(1).forEach(function(r) {
    const type = String(r[2]||'');
    const sku  = String(r[3]||'').trim();
    const wh   = String(r[6]||'').trim();
    const qty  = Number(r[7])||0;
    const cost = Number(r[9])||0;
    if (!sku || !wh) return;

    const key = sku + '|' + wh;
    if (!totals[key]) totals[key] = {sku:sku, name:String(r[4]||''), wh:wh, qty:0, costSum:0, costQty:0};

    // IN types add, OUT types subtract
    if (type==='IN' || type==='TRANSFER_IN' || type==='ADJUST' && qty>0) {
      totals[key].qty     += qty;
      totals[key].costSum += qty * cost;
      totals[key].costQty += qty;
    } else if (type==='OUT' || type==='TRANSFER_OUT' || type==='ADJUST' && qty<0) {
      totals[key].qty     += qty; // qty is negative for OUT
    }
  });

  // Rebuild STOCK_BALANCE
  balSheet.clearContents();
  const hdr = ['SKU','Product_Name','WH_ID','Qty_On_Hand','Qty_Reserved','Cost_Avg','Last_Updated'];
  balSheet.getRange(1,1,1,hdr.length).setValues([hdr])
    .setBackground('#E65100').setFontColor('#fff').setFontWeight('bold');

  const now = now_();
  const rows = Object.values(totals).map(function(t) {
    const avgCost = t.costQty > 0 ? t.costSum / t.costQty : 0;
    return [t.sku, t.name, t.wh, Math.max(0, t.qty), 0, avgCost, now];
  });
  if (rows.length) balSheet.getRange(2,1,rows.length,hdr.length).setValues(rows);
  return 'Rebuilt STOCK_BALANCE: ' + rows.length + ' rows from ' + (logData.length-1) + ' log entries';
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

// ── Batch Receive from Invoice OCR ────────────────────────────
// เรียกจากหน้า OCR หลัง verify เสร็จ — รับสินค้าทีเดียวหลาย SKU
function batchReceiveFromInvoice(payload) {
  // payload = { items:[{barcode,productName,buyQty,freeQty,unit,unitPrice,costPerUnit}],
  //             recvNo, entity, whId, supplierName }
  var results = [];
  var errors  = [];
  (payload.items || []).forEach(function(it) {
    if (!it.barcode || !it.buyQty) return;
    var totalQty = (Number(it.buyQty)||0) + (Number(it.freeQty)||0);
    if (totalQty <= 0) return;
    var costPer = Number(it.costPerUnit) || Number(it.unitPrice) || 0;
    var d = {
      sku:      it.barcode,
      whId:     payload.whId,
      qty:      totalQty,     // รับชิ้นรวม (ซื้อ+แถม)
      convRate: 1,            // ส่งเป็น piece แล้ว
      baseUnit: it.unit || 'ชิ้น',
      cost:     costPer,
      ref:      payload.recvNo || '',
      entity:   payload.entity || '',
      pName:    it.productName || it.barcode,
      unit:     it.unit || 'ชิ้น',
      note:     'OCR Invoice: ' + (payload.supplierName||'') + (it.freeQty > 0 ? ' | แถม '+it.freeQty : '')
    };
    var res = receiveGoods(d);
    if (res.ok) {
      results.push({ sku: it.barcode, name: it.productName, qty: totalQty, newQty: res.newQty });
    } else {
      errors.push({ sku: it.barcode, msg: res.msg });
    }
  });
  return {
    ok: errors.length === 0,
    received: results,
    errors: errors,
    msg: 'รับสินค้า ' + results.length + ' รายการ สำเร็จ' + (errors.length ? ', ผิดพลาด ' + errors.length + ' รายการ' : '')
  };
}

// ── Receive Goods ─────────────────────────────────────────────
function receiveGoods(d) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const { sku, whId, qty, cost, ref, note, entity, pName, unit, date } = d;
    const convRate = Math.max(1, Number(d.convRate) || 1);
    const baseUnit = d.baseUnit || unit || '';
    const q = Number(qty), c = Number(cost) || 0;
    if (!sku || !whId || q <= 0) return { ok: false, msg: 'ข้อมูลไม่ครบ: SKU / คลัง / จำนวน' };

    // Convert to base unit (pieces) for storage
    const piecesQty   = q * convRate;
    const costPerPiece = convRate > 1 ? (c / convRate) : c;  // c = cost per large unit
    const logNote = convRate > 1
      ? (q + ' ' + (unit||'') + ' × ' + convRate + ' = ' + piecesQty + ' ' + baseUnit + (note ? ' | ' + note : ''))
      : (note || '');

    const txDate = date ? fmt_(new Date(date), 'yyyy-MM-dd') : fmt_(now_(), 'yyyy-MM-dd');
    sh_(SH_LOG).appendRow([txDate, fmt_(now_(),'HH:mm:ss'),
      'IN', sku, pName||sku, entity||'', whId,
      piecesQty, baseUnit, costPerPiece, piecesQty * costPerPiece,
      ref||'', user_(), logNote]);
    addBatch_(sku, whId, piecesQty, costPerPiece, ref||'');
    const newQ = updateBal_(sku, pName, whId, piecesQty, costPerPiece);
    ropAlert_(sku, whId, newQ);
    const dispQty = convRate > 1 ? (q + ' ' + (unit||'') + ' (' + piecesQty + ' ' + baseUnit + ')') : (q + ' ' + (unit||''));
    return { ok: true, msg: 'รับสินค้า ' + sku + ' × ' + dispQty + ' → ' + whId + ' สำเร็จ', newQty: newQ };
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

// ════════════════════════════════════════════════════════════
//  WMS ANALYTICS — หลักวิชาการคลัง (ตาม WMS_DESIGN ข้อ 5)
//  ABC (Pareto 80/95) · Velocity · Safety Stock · ROP อัตโนมัติ ·
//  EOQ · Turnover/DOH · Dead stock
//  แหล่งข้อมูล: STOCK_LOG (Type=OUT) + STOCK_BALANCE + CONFIG
// ════════════════════════════════════════════════════════════
function wmsAnalytics(days) {
  try {
    days = Number(days) || 90;
    const cutoff = new Date(Date.now() - days * 86400000);
    const cfgAll = {};
    try {
      const cs = ss_().getSheetByName('CONFIG');
      if (cs) cs.getDataRange().getValues().forEach(r => { if (r[0]) cfgAll[String(r[0]).trim().toUpperCase()] = r[1]; });
    } catch(e) {}
    const LT        = Number(cfgAll.LEAD_TIME_DAYS) || 7;     // วันสั่ง→รับ
    const ORDER_COST= Number(cfgAll.ORDER_COST)     || 100;   // ค่าใช้จ่าย/การสั่ง 1 ครั้ง
    const HOLD_RATE = Number(cfgAll.HOLDING_RATE)   || 0.20;  // %ถือครอง/ปี
    const Z         = 1.65;                                    // service level 95%

    // 1) ยอดขายออก (OUT) ย้อนหลัง — รวมทุกคลัง ต่อ SKU + bucket รายวันไว้คำนวณ σ
    const sold = {};  // sku → { qty, value, name, daily:{ymd:qty} }
    const logSh = sh_(SH_LOG);
    if (logSh && logSh.getLastRow() > 1) {
      logSh.getDataRange().getValues().slice(1).forEach(r => {
        if (String(r[2]) !== 'OUT') return;
        let d = r[0] instanceof Date ? r[0] : new Date(r[0]);
        if (isNaN(d) || d < cutoff) return;
        const sku = String(r[3] || '').trim(); if (!sku) return;
        const q   = Math.abs(Number(r[7]) || 0);
        const amt = Math.abs(Number(r[10]) || 0) || q * (Number(r[9]) || 0);
        if (!sold[sku]) sold[sku] = { qty: 0, value: 0, name: String(r[4] || sku), daily: {} };
        sold[sku].qty += q; sold[sku].value += amt;
        const ymd = fmt_(d, 'yyyy-MM-dd');
        sold[sku].daily[ymd] = (sold[sku].daily[ymd] || 0) + q;
      });
    }

    // 2) สต๊อกคงเหลือ + ต้นทุนเฉลี่ย (รวมทุกคลัง)
    const bal = {};   // sku → { onHand, cost, name }
    sh_(SH_BAL).getDataRange().getValues().slice(1).forEach(r => {
      const sku = String(r[0] || '').trim(); if (!sku) return;
      if (!bal[sku]) bal[sku] = { onHand: 0, cost: 0, name: String(r[1] || sku) };
      bal[sku].onHand += Number(r[3]) || 0;
      if (Number(r[5]) > 0) bal[sku].cost = Number(r[5]);
    });

    // 3) รวมเป็นรายการวิเคราะห์
    const skus = {};
    Object.keys(sold).forEach(k => skus[k] = 1);
    Object.keys(bal).forEach(k => skus[k] = 1);
    let rows = Object.keys(skus).map(sku => {
      const s = sold[sku] || { qty: 0, value: 0, daily: {}, name: '' };
      const b = bal[sku]  || { onHand: 0, cost: 0, name: '' };
      const velocity = s.qty / days;                          // ชิ้น/วัน
      // σ รายวัน (รวมวันที่ขาย 0 ด้วย)
      const dailyVals = Object.values(s.daily);
      const mean = s.qty / days;
      let variance = 0;
      dailyVals.forEach(q => variance += Math.pow(q - mean, 2));
      variance += (days - dailyVals.length) * Math.pow(0 - mean, 2);
      const sigma = Math.sqrt(variance / Math.max(1, days - 1));
      const safety = Z * sigma * Math.sqrt(LT);
      const rop    = velocity * LT + safety;
      const annualD = velocity * 365;
      const H = Math.max(0.01, (b.cost || 1) * HOLD_RATE);
      const eoq = annualD > 0 ? Math.sqrt(2 * annualD * ORDER_COST / H) : 0;
      const stockValue = b.onHand * b.cost;
      const annualCogs = (s.value / days) * 365;
      const turnover = stockValue > 0 ? annualCogs / stockValue : 0;
      const doh = velocity > 0 ? b.onHand / velocity : (b.onHand > 0 ? 9999 : 0);
      return {
        sku: sku, name: s.name || b.name,
        soldQty: s.qty, soldValue: s.value, velocity: velocity,
        onHand: b.onHand, cost: b.cost, stockValue: stockValue,
        safety: Math.ceil(safety), rop: Math.ceil(rop), eoq: Math.ceil(eoq),
        turnover: turnover, doh: Math.round(doh),
        dead: (s.qty === 0 && b.onHand > 0)
      };
    });

    // 4) ABC ตามมูลค่าขายสะสม (80/95)
    rows.sort((a, b2) => b2.soldValue - a.soldValue);
    const totalValue = rows.reduce((t, r) => t + r.soldValue, 0) || 1;
    let cum = 0;
    rows.forEach(r => {
      cum += r.soldValue;
      r.abc = r.soldValue <= 0 ? 'C' : (cum / totalValue <= 0.80 ? 'A' : (cum / totalValue <= 0.95 ? 'B' : 'C'));
    });

    // 5) Slotting advisor — แนะนำคลังตามกฎที่ตกลง (WMS_DESIGN ข้อ 3)
    //    KLH→W3 (แยกบัญชีสรรพากร) · A เร็ว→W1+W3 · B→W2 buffer · C/Dead→W4 โรงสี
    const entityMap = {};
    try {
      const kd = ss_().getSheetByName('KLH DATA');
      if (kd) kd.getDataRange().getValues().slice(1).forEach(r => {
        const bc = String(r[0] || '').trim();
        if (bc) entityMap[bc] = String(r[29] || '').trim();
      });
    } catch(e) {}
    rows.forEach(r => {
      const ent = entityMap[r.sku] || '';
      const isKlh = ent.indexOf('เคแอลเอช') >= 0 || /klh/i.test(ent);
      if (r.dead)            { r.recWh = 'W4'; r.recWhy = 'Dead stock — เก็บโรงสี/พิจารณาระบาย'; }
      else if (isKlh)        { r.recWh = 'W3'; r.recWhy = 'สินค้า KLH — แยกคลังซอยโทรศัพท์ (บัญชีสรรพากร)'; }
      else if (r.abc === 'A'){ r.recWh = 'W1+W3'; r.recWhy = 'Class A หมุนเร็ว — หน้าร้านเต็ม + สำรองใกล้'; }
      else if (r.abc === 'B'){ r.recWh = 'W2'; r.recWhy = 'Class B — buffer ข้างบ้าน เติมไว'; }
      else                   { r.recWh = 'W4'; r.recWhy = 'Class C ช้า — เก็บโรงสี ไม่ตุนหน้าร้าน'; }
    });

    const deadRows = rows.filter(r => r.dead);
    return {
      ok: true, days: days, leadTime: LT, orderCost: ORDER_COST, holdRate: HOLD_RATE,
      summary: {
        skuCount: rows.length,
        a: rows.filter(r => r.abc === 'A').length,
        b: rows.filter(r => r.abc === 'B').length,
        c: rows.filter(r => r.abc === 'C').length,
        totalSold: totalValue,
        totalStockValue: rows.reduce((t, r) => t + r.stockValue, 0),
        deadCount: deadRows.length,
        deadValue: deadRows.reduce((t, r) => t + r.stockValue, 0)
      },
      rows: rows.slice(0, 300)
    };
  } catch(e) { return { ok: false, error: e.toString() }; }
}

// ตั้งคลัง 5 แห่งจริง + คุณสมบัติ (Role/Fetch_Cost/Priority) — รันครั้งเดียวใน Editor
// เพิ่มคอลัมน์ G-J ต่อท้าย header เดิม (ไม่กระทบโค้ดที่อ่าน A-F)
function initWarehouseMaster() {
  const s = sh_(SH_WH);
  s.getRange(1, 7, 1, 4).setValues([['ROLE','FETCH_COST','PRIORITY','NOTE']])
    .setBackground('#E65100').setFontColor('#fff').setFontWeight('bold');
  const whs = [
    ['W1','คลังหน้าร้าน',     'หจก.เค แอล เอช','ชัยภูมิ','',true,'FRONT', 0, 1,'pick-face ขายหน้าร้าน เก็บ 3-5 วันพอขาย'],
    ['W2','ข้างบ้าน+บนบ้าน',  'หจก.เค แอล เอช','ชัยภูมิ','',true,'BUFFER',1, 2,'ของเบาเท่านั้น buffer/ขายส่งบ่อย'],
    ['W3','ซอยโทรศัพท์',      'หจก.เค แอล เอช','ชัยภูมิ','',true,'FAST',  2, 3,'ของขายเร็ว + สินค้าชื่อ KLH (บัญชีสรรพากร)'],
    ['W4','โรงสี',            'หจก.เค แอล เอช','ชัยภูมิ','',true,'BULK',  5, 4,'ใหญ่/หนักได้ แต่ไกล รวมรอบไปเอา'],
    ['W5','ศูนย์กระจาย (อนาคต)','หจก.เค แอล เอช','',     '',false,'DC',   3, 5,'เปิดเมื่อขยายสาขา'],
  ];
  const d = s.getDataRange().getValues();
  whs.forEach(w => {
    let found = false;
    for (let i = 1; i < d.length; i++) {
      if (String(d[i][0]) === w[0]) { s.getRange(i+1, 1, 1, 10).setValues([w]); found = true; break; }
    }
    if (!found) s.appendRow(w);
  });
  return 'ตั้งคลัง 5 แห่ง (W1 หน้าร้าน / W2 ข้างบ้าน / W3 ซอยโทรศัพท์ / W4 โรงสี / W5 ศูนย์กระจาย) แล้ว';
}

// เขียน ROP/ROQ ที่คำนวณได้ ลง SKU_WH_CONFIG ของคลังหน้าร้าน (W1)
function applyCalculatedRop(days, whId) {
  try {
    const res = wmsAnalytics(days);
    if (!res.ok) return res;
    const target = whId || 'W1';
    const cfgs = res.rows
      .filter(r => r.velocity > 0)
      .map(r => ({ sku: r.sku, wh: target, rop: r.rop, roq: r.eoq, maxStock: 0, active: true }));
    if (!cfgs.length) return { ok: false, msg: 'ไม่มีสินค้าที่มียอดขายในช่วงที่เลือก' };
    const sv = saveRopConfigs(cfgs);
    return { ok: sv.ok, applied: cfgs.length, msg: 'ตั้ง ROP/ROQ อัตโนมัติ ' + cfgs.length + ' SKU → คลัง ' + target };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── Seed Test Data ────────────────────────────────────────────
function seedTestData() {
  const ss = ss_();

  // 1) PRODUCTS sheet
  let prod = ss.getSheetByName('PRODUCTS');
  if (!prod) {
    prod = ss.insertSheet('PRODUCTS');
    prod.setFrozenRows(1);
  }
  // Always ensure latest 7-col header (SKU / Product_Name / Unit / Entity / Conv_Rate / Base_Unit / Barcode_Large)
  const prodHdrCheck = prod.getLastRow() > 0 ? prod.getRange(1,1,1,7).getValues()[0] : [];
  if (prodHdrCheck[4] !== 'Conv_Rate') {
    prod.getRange(1,1,1,7).setValues([['SKU','Product_Name','Unit','Entity','Conv_Rate','Base_Unit','Barcode_Large']])
      .setBackground('#1565C0').setFontColor('#fff').setFontWeight('bold');
    prod.setFrozenRows(1);
    Logger.log('PRODUCTS: อัปเดต header เป็น 7 คอลัมน์');
  }
  if (prod.getLastRow() <= 1) {
    // Unit = large unit (ลัง/แพ็ก), Conv_Rate = pieces per large unit, Base_Unit = piece name
    prod.getRange(2,1,8,7).setValues([
      ['SKU001','น้ำดื่มตรา KLH 600ml (แพ็ก 12)',    'แพ็ก', 'หจก.เค แอล เอช', 12, 'ขวด',    ''],
      ['SKU002','น้ำดื่มตรา KLH 1.5L (แพ็ก 6)',     'แพ็ก', 'หจก.เค แอล เอช',  6, 'ขวด',    ''],
      ['SKU003','น้ำอัดลม 325ml (ลัง 24)',           'ลัง',  'หจก.เค แอล เอช', 24, 'กระป๋อง',''],
      ['SKU004','ขนมกรุบกรอบ (ลัง 36 ซอง)',         'ลัง',  'กวงล่งเฮง',       36, 'ซอง',    ''],
      ['SKU005','บะหมี่กึ่งสำเร็จรูป (ลัง 30 ซอง)', 'ลัง',  'หจก.เค แอล เอช', 30, 'ซอง',    ''],
      ['SKU006','ข้าวสารหอมมะลิ 5kg',               'ถุง',  'หจก.เค แอล เอช',  1, 'ถุง',    ''],
      ['SKU007','น้ำตาลทราย 1kg',                   'ถุง',  'เอี่ยมเช็ง',       1, 'ถุง',    ''],
      ['SKU008','น้ำมันพืช 1L',                     'ขวด', 'หจก.เค แอล เอช',   1, 'ขวด',   ''],
    ]);
    Logger.log('PRODUCTS: สร้าง 8 รายการ');
  } else {
    Logger.log('PRODUCTS: มีข้อมูลอยู่แล้ว ไม่ overwrite');
  }

  // 2) Receive stock into W1 — stored as base units (pieces), cost per piece
  // qty = large units received, convRate = pieces per large unit, cost = cost per large unit
  var testStock = [
    { sku:'SKU001', pName:'น้ำดื่ม 600ml',          unit:'แพ็ก', baseUnit:'ขวด',    qty:120, convRate:12, cost:45,  entity:'หจก.เค แอล เอช' },
    { sku:'SKU002', pName:'น้ำดื่ม 1.5L',           unit:'แพ็ก', baseUnit:'ขวด',    qty:80,  convRate:6,  cost:65,  entity:'หจก.เค แอล เอช' },
    { sku:'SKU003', pName:'น้ำอัดลม 325ml',         unit:'ลัง',  baseUnit:'กระป๋อง',qty:50,  convRate:24, cost:180, entity:'หจก.เค แอล เอช' },
    { sku:'SKU004', pName:'ขนมกรุบกรอบ',            unit:'ลัง',  baseUnit:'ซอง',    qty:40,  convRate:36, cost:320, entity:'กวงล่งเฮง' },
    { sku:'SKU005', pName:'บะหมี่กึ่งสำเร็จรูป',   unit:'ลัง',  baseUnit:'ซอง',    qty:60,  convRate:30, cost:270, entity:'หจก.เค แอล เอช' },
    { sku:'SKU006', pName:'ข้าวสารหอมมะลิ 5kg',    unit:'ถุง',  baseUnit:'ถุง',    qty:200, convRate:1,  cost:185, entity:'หจก.เค แอล เอช' },
    { sku:'SKU007', pName:'น้ำตาลทราย 1kg',        unit:'ถุง',  baseUnit:'ถุง',    qty:150, convRate:1,  cost:22,  entity:'เอี่ยมเช็ง' },
    { sku:'SKU008', pName:'น้ำมันพืช 1L',          unit:'ขวด', baseUnit:'ขวด',    qty:90,  convRate:1,  cost:48,  entity:'หจก.เค แอล เอช' },
  ];

  // Check if STOCK_BALANCE already has data
  var bal = sh_(SH_BAL);
  if (bal.getLastRow() > 1) {
    Logger.log('STOCK_BALANCE มีข้อมูลอยู่แล้ว — ข้าม seed stock');
  } else {
    var today = fmt_(now_(), 'yyyy-MM-dd');
    var logSh = sh_(SH_LOG);
    testStock.forEach(function(item) {
      var piecesQty    = item.qty * item.convRate;
      var costPerPiece = item.cost / item.convRate;
      var logNote      = item.convRate > 1
        ? (item.qty + ' ' + item.unit + ' × ' + item.convRate + ' = ' + piecesQty + ' ' + item.baseUnit + ' | SEED')
        : 'SEED-INIT';
      // Write STOCK_LOG (quantities in base units)
      logSh.appendRow([today, fmt_(now_(),'HH:mm:ss'),
        'IN', item.sku, item.pName, item.entity, 'W1',
        piecesQty, item.baseUnit, costPerPiece, piecesQty * costPerPiece,
        'SEED-INIT', 'system', logNote]);
      // Write FIFO_BATCH (pieces, cost per piece)
      addBatch_(item.sku, 'W1', piecesQty, costPerPiece, 'SEED-INIT');
      // Write STOCK_BALANCE (pieces)
      updateBal_(item.sku, item.pName, 'W1', piecesQty, costPerPiece);
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
// ใช้ getConfig() (trim+uppercase key) ให้เหมือน testLinePush/pushLineGroup_ ที่ส่งได้จริง
function sendWmsLine_(text) {
  try {
    var cfg = getConfig();
    var token = cfg.LINE_CHANNEL_TOKEN;
    var gid   = cfg.LINE_GROUP_ID || 'C9936ac4af81efc524493fe83a0a7b328';
    if (!token) { Logger.log('sendWmsLine_: ไม่พบ LINE_CHANNEL_TOKEN'); return; }
    var resp = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      payload: JSON.stringify({ to: gid, messages: [{ type: 'text', text: text }] }),
      muteHttpExceptions: true
    });
    Logger.log('sendWmsLine_ HTTP ' + resp.getResponseCode() + ' → ' + resp.getContentText().slice(0,120));
  } catch(e) { Logger.log('LINE error: ' + e.message); }
}
