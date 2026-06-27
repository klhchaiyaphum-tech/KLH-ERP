// ============================================================
//  accounting.js — KLH Accounting / Tax (Phase 4)
//  ข้อ 5: สิ้นเดือนแยกสต๊อก KLH vs ร้านอื่น + ขายจำลอง KLH
//
//  แหล่งข้อมูล (สำรวจจากชีตจริง 2026-06-06):
//   KLH DATA  : A=BARCODE_SMALL(0) B=NAME(1) C=CAT(2) E=MULT(4)
//               F=UNIT_BIG(5) L=BUY_QTY(11) R=COST_FINAL(17)
//               U=WHOLESALE_OLD(20) W=RETAIL_OLD(22) X=RETAIL_NEW(23)
//               AB=BARCODE_BIG(27) AD=TAX_ENTITY(29) AI=RETAIL_DOZ(34)
//   STOCK_BALANCE : r0=barcode r2=warehouse r3=qty
//   SALES_HEADER  : 0 SALE_ID 1 ORDER_ID 2 PAID_DATE 4 ENTITY 9 TOTAL
//   SALES_DETAIL  : 0 SALE_ID 2 BARCODE 4 QTY_PIECE 6 UNIT_PRICE 7 LINE_TOTAL 8 ENTITY
// ============================================================

// ตรวจว่าชื่อนิติ = KLH (ห้างหุ้นส่วนจำกัด เคแอลเอช) หรือไม่
function isKlhEntity_(name) {
  var s = String(name || '').toLowerCase();
  return s.indexOf('เคแอลเอช') >= 0 || s.indexOf('klh') >= 0;
}

// แปลงค่าวันที่ใน PAID_DATE → 'YYYY-MM'
function ymOf_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM');
  }
  var s = String(v).trim();
  // รองรับ '2026-06-01', '2026/06/01', '1/6/2026'
  var m = s.match(/^(\d{4})[-\/](\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2);
  var m2 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (m2) return m2[3] + '-' + ('0' + m2[2]).slice(-2);
  return '';
}

// ────────────────────────────────────────────────────────────
//  ข้อ 5 (ส่วน A): สิ้นเดือนแยกสต๊อก KLH vs ร้านอื่น
//  yyyymm: '2026-06' หรือ '' = ทุกเดือน (สำหรับยอดขายจริง)
// ────────────────────────────────────────────────────────────
function getMonthEndStockByEntity(yyyymm) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var cfg = getConfig();
    var dataName = (cfg.SHEET_DATA || cfg.TAB_SURVEY || 'KLH DATA');

    // 1) อ่าน KLH DATA → product map
    var dSh = ss.getSheetByName(dataName) || ss.getSheetByName('KLH DATA');
    var prod = {};                 // barcode → {name,cat,entity,isKlh,cost,retail,unitBig}
    if (dSh) {
      var dv = dSh.getDataRange().getValues();
      for (var i = 1; i < dv.length; i++) {
        var r = dv[i];
        var bc = String(r[0] || '').trim();
        if (!bc) continue;
        var entity = String(r[29] || '').trim();
        var info = {
          barcode: bc,
          name:    String(r[1] || ''),
          cat:     String(r[2] || ''),
          entity:  entity,
          isKlh:   isKlhEntity_(entity),
          cost:    Number(r[17]) || 0,                       // COST_FINAL (R)
          retail:  Number(r[22]) || Number(r[23]) || 0,      // RETAIL_OLD (W) ↘ RETAIL_NEW (X)
          unitBig: String(r[5] || '')
        };
        prod[bc] = info;
        // map barcode ลังด้วย (AB) → ชี้สินค้าตัวเดียวกัน
        var bcBig = String(r[27] || '').trim();
        if (bcBig && !prod[bcBig]) prod[bcBig] = info;
      }
    }

    // 2) STOCK_BALANCE → onHand รวมทุกคลัง ต่อ barcode
    var onHand = {};
    var bSh = ss.getSheetByName('STOCK_BALANCE');
    if (bSh) {
      var bv = bSh.getDataRange().getValues();
      for (var j = 1; j < bv.length; j++) {
        var bbc = String(bv[j][0] || '').trim();
        if (!bbc) continue;
        onHand[bbc] = (onHand[bbc] || 0) + (Number(bv[j][3]) || 0);
      }
    }

    // 3) SALES_HEADER → saleId ที่อยู่ในเดือน
    var saleMonth = {};   // saleId → 'YYYY-MM'
    var hSh = ss.getSheetByName('SALES_HEADER');
    if (hSh) {
      var hv = hSh.getDataRange().getValues();
      for (var k = 1; k < hv.length; k++) {
        var sid = String(hv[k][0] || '').trim();
        if (!sid) continue;
        saleMonth[sid] = ymOf_(hv[k][2]);
      }
    }

    // 4) SALES_DETAIL → ยอดขายจริงต่อ barcode (กรองเดือน)
    var soldQty = {}, soldAmt = {};
    var sSh = ss.getSheetByName('SALES_DETAIL');
    if (sSh) {
      var sv = sSh.getDataRange().getValues();
      for (var m = 1; m < sv.length; m++) {
        var srow = sv[m];
        var sid2 = String(srow[0] || '').trim();
        if (!sid2) continue;
        if (yyyymm && saleMonth[sid2] !== yyyymm) continue;
        var sbc = String(srow[2] || '').trim();
        soldQty[sbc] = (soldQty[sbc] || 0) + (Number(srow[4]) || 0);
        soldAmt[sbc] = (soldAmt[sbc] || 0) + (Number(srow[7]) || 0);
      }
    }

    // 5) รวมเป็น 2 กลุ่ม
    var klhItems = [], otherItems = [];
    var klhTot = { qty: 0, costVal: 0, retailVal: 0, soldQty: 0, soldAmt: 0 };
    var othTot = { qty: 0, costVal: 0, retailVal: 0, soldQty: 0, soldAmt: 0 };
    var othByEntity = {};

    for (var bc2 in prod) {
      var p = prod[bc2];
      if (p.barcode !== bc2) continue;   // ข้าม alias barcode ลัง (นับครั้งเดียว)
      var oh = onHand[bc2] || 0;
      var sq = soldQty[bc2] || 0;
      var sa = soldAmt[bc2] || 0;
      var row = {
        barcode:   p.barcode,
        name:      p.name,
        cat:       p.cat,
        entity:    p.entity,
        onHand:    oh,
        cost:      p.cost,
        retail:    p.retail,
        costVal:   oh * p.cost,
        retailVal: oh * p.retail,
        soldQty:   sq,
        soldAmt:   sa
      };
      if (p.isKlh) {
        klhItems.push(row);
        klhTot.qty += oh; klhTot.costVal += row.costVal; klhTot.retailVal += row.retailVal;
        klhTot.soldQty += sq; klhTot.soldAmt += sa;
      } else {
        otherItems.push(row);
        othTot.qty += oh; othTot.costVal += row.costVal; othTot.retailVal += row.retailVal;
        othTot.soldQty += sq; othTot.soldAmt += sa;
        var en = p.entity || 'ไม่ระบุ';
        if (!othByEntity[en]) othByEntity[en] = { entity: en, qty: 0, costVal: 0, soldAmt: 0, count: 0 };
        othByEntity[en].qty += oh; othByEntity[en].costVal += row.costVal;
        othByEntity[en].soldAmt += sa; othByEntity[en].count += 1;
      }
    }

    // เรียงตามมูลค่าต้นทุนคงเหลือ มาก→น้อย
    klhItems.sort(function(a, b){ return b.costVal - a.costVal; });
    otherItems.sort(function(a, b){ return b.costVal - a.costVal; });
    var othGroups = [];
    for (var e in othByEntity) othGroups.push(othByEntity[e]);
    othGroups.sort(function(a, b){ return b.costVal - a.costVal; });

    return {
      ok: true,
      month: yyyymm || '(ทุกเดือน)',
      generatedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'),
      klh:   { items: klhItems,   totals: klhTot },
      other: { items: otherItems, totals: othTot, byEntity: othGroups }
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// ════════════════════════════════════════════════════════════
//  งบกำไรขาดทุน (P&L) — Phase 6.3
//  รายได้ = SALES_HEADER · ต้นทุนขาย = SALES_DETAIL × ต้นทุน (KLH DATA R)
//  ซื้อเข้า = INVOICE_HEADER · แยก KLH vs นิติอื่น
// ════════════════════════════════════════════════════════════
function getProfitLoss(yyyymm) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var ym = yyyymm || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');

    // ต้นทุน/ชิ้นจาก KLH DATA (R=17) + fallback ราคาปลีก×0.8
    var costMap = {};
    var dSh = ss.getSheetByName('KLH DATA');
    if (dSh) {
      dSh.getDataRange().getValues().slice(1).forEach(function(r) {
        var bc = String(r[0] || '').trim();
        if (bc) costMap[bc] = Number(r[17]) || 0;
      });
    }

    // ยอดขาย: SALES_HEADER (0 SALE_ID, 2 PAID_DATE, 4 ENTITY, 9 TOTAL)
    var saleMonth = {}, revenue = { klh: 0, other: 0 }, byEntity = {};
    var hSh = ss.getSheetByName('SALES_HEADER');
    if (hSh && hSh.getLastRow() > 1) {
      hSh.getDataRange().getValues().slice(1).forEach(function(r) {
        var sid = String(r[0] || '').trim();
        if (!sid || ymOf_(r[2]) !== ym) return;
        saleMonth[sid] = true;
        var ent = String(r[4] || 'ไม่ระบุ').trim() || 'ไม่ระบุ';
        var tot = Number(r[9]) || 0;
        if (isKlhEntity_(ent)) revenue.klh += tot; else revenue.other += tot;
        if (!byEntity[ent]) byEntity[ent] = { entity: ent, revenue: 0, cogs: 0 };
        byEntity[ent].revenue += tot;
      });
    }

    // ต้นทุนขาย: SALES_DETAIL (0 SALE_ID, 2 BARCODE, 4 QTY_PIECE, 8 ENTITY)
    var cogs = { klh: 0, other: 0 }, unkCost = 0;
    var dtSh = ss.getSheetByName('SALES_DETAIL');
    if (dtSh && dtSh.getLastRow() > 1) {
      dtSh.getDataRange().getValues().slice(1).forEach(function(r) {
        var sid = String(r[0] || '').trim();
        if (!saleMonth[sid]) return;
        var bc = String(r[2] || '').trim();
        var q  = Number(r[4]) || 0;
        var c  = costMap[bc] || 0;
        if (c <= 0) { unkCost++; return; }
        var ent = String(r[8] || '').trim();
        var amt = q * c;
        if (isKlhEntity_(ent)) cogs.klh += amt; else cogs.other += amt;
        if (byEntity[ent]) byEntity[ent].cogs += amt;
      });
    }

    // ยอดซื้อเข้าเดือนนี้ (INVOICE_HEADER: 2 INVOICE_DATE, 4 TAX_ENTITY, 7 TOTAL)
    var purchases = { klh: 0, other: 0 };
    var inv = ss.getSheetByName('INVOICE_HEADER');
    if (inv && inv.getLastRow() > 1) {
      inv.getDataRange().getValues().slice(1).forEach(function(r) {
        if (ymOf_(r[2]) !== ym) return;
        var t = Number(r[7]) || 0;
        if (isKlhEntity_(r[4])) purchases.klh += t; else purchases.other += t;
      });
    }

    var entityRows = [];
    for (var e in byEntity) {
      var x = byEntity[e];
      entityRows.push({ entity: x.entity, revenue: x.revenue, cogs: x.cogs,
                        gross: x.revenue - x.cogs,
                        margin: x.revenue > 0 ? (x.revenue - x.cogs) / x.revenue * 100 : 0 });
    }
    entityRows.sort(function(a, b) { return b.revenue - a.revenue; });

    var totalRev  = revenue.klh + revenue.other;
    var totalCogs = cogs.klh + cogs.other;

    // ค่าใช้จ่ายดำเนินงานจากสมุดเงินธนาคาร (EXPENSE/PAYMENT ตามผังบัญชี — ผังเงินข้อ 5)
    var opex = { total: 0, rows: [], unspecified: 0 };
    try {
      var be = getBankExpenses(ym);
      if (be && be.ok) opex = { total: be.total, rows: be.rows, unspecified: be.unspecified };
    } catch(e2) {}

    // รายได้อื่น (OTHER) + ชำระเจ้าหนี้การค้า (PAYMENT) จากสมุดเงินธนาคาร
    var otherIncome = 0, bankPayment = 0;
    try {
      var bkt = ss.getSheetByName('BANK_TRANSACTIONS');
      if (bkt && bkt.getLastRow() > 1) {
        bkt.getDataRange().getValues().slice(1).forEach(function(r){
          var d = r[0] instanceof Date ? Utilities.formatDate(r[0],'Asia/Bangkok','yyyy-MM-dd') : String(r[0]);
          if (d.slice(0,7) !== ym) return;
          var c4 = String(r[4]), amt = Number(r[3]) || 0;
          if (c4 === 'OTHER') otherIncome += amt;
          else if (c4 === 'PAYMENT') bankPayment += amt;
        });
      }
    } catch(e3) {}
    // ยอดซื้อเข้า KLH = อ้างอิงกระแสเงิน (ชำระเจ้าหนี้การค้าจากธนาคาร) — ถ้ายังไม่มี OCR
    if (bankPayment > 0) purchases.klh = bankPayment;

    var gross = totalRev - totalCogs;
    return {
      ok: true, month: ym,
      revenue: revenue, cogs: cogs, purchases: purchases,
      totals: { revenue: totalRev, cogs: totalCogs, gross: gross,
                margin: totalRev > 0 ? gross / totalRev * 100 : 0,
                opex: opex.total, otherIncome: otherIncome,
                net: gross + otherIncome - opex.total },
      opex: opex, otherIncome: otherIncome,
      klh: { revenue: revenue.klh, cogs: cogs.klh, gross: revenue.klh - cogs.klh },
      byEntity: entityRows,
      itemsNoCost: unkCost
    };
  } catch(e) { return { ok: false, error: e.toString() }; }
}

// ════════════════════════════════════════════════════════════
//  ประมาณการ สรรพากร (ภพ.30) — ตามที่ตกลง:
//  • ภาษีซื้อ = ใบกำกับจาก OCR ที่ผู้ซื้อ = KLH (INVOICE_HEADER)
//  • ภาษีขาย = ฐานยอดขาย (เป้า = ภาษีซื้อ + % ผู้บริหาร, ต้อง > ซื้อ)
//  • แจ้ง LINE รายสัปดาห์ ถ้ายอดจริงต่ำ/เกินเป้า
// ════════════════════════════════════════════════════════════

var SH_TAXEST = 'TAX_ESTIMATE';
var H_TAXEST  = ['MONTH','INPUT_VAT','EXEC_PERCENT','TARGET_SALES','TARGET_VAT','LAST_YEAR_AVG','UPDATED_BY','UPDATED_AT'];

function taxEstSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName(SH_TAXEST);
  if (!s) {
    s = ss.insertSheet(SH_TAXEST);
    s.getRange(1,1,1,H_TAXEST.length).setValues([H_TAXEST])
      .setBackground('#00695C').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}

// สรุป ภพ.30 ประจำเดือน (yyyymm = 'YYYY-MM')
function getPP30(yyyymm) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var ym = yyyymm || Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM');

    // เลขประจำตัวผู้เสียภาษี + ชื่อบริษัท จาก CONFIG (รองรับหลายชื่อ key)
    var cfg = getConfig();
    var taxId = '', coName = '';
    ['COMPANY_TAX_ID','TAX_ID','TAXID','TAXPAYER_ID','เลขผู้เสียภาษี','เลขประจำตัวผู้เสียภาษี','เลขประจำตัวผู้เสียภาษีอากร'].forEach(function(k){
      if (!taxId && cfg[k]) taxId = String(cfg[k]).replace(/[^0-9]/g, '');
    });
    coName = String(cfg.COMPANY_NAME || '');

    // 1) ภาษีซื้อ: INVOICE_HEADER (4 TAX_ENTITY, 2 INVOICE_DATE, 5 SUBTOTAL, 6 VAT_AMT, 7 TOTAL)
    var inputVat = 0, inputBase = 0, inputCount = 0, purchaseAll = 0;
    var inv = ss.getSheetByName('INVOICE_HEADER');
    if (inv && inv.getLastRow() > 1) {
      inv.getDataRange().getValues().slice(1).forEach(function(r) {
        if (ymOf_(r[2]) !== ym) return;
        purchaseAll += Number(r[7]) || 0;                 // ยอดซื้อทุกนิติ (เจ้าหนี้)
        if (isKlhEntity_(r[4]) && (Number(r[6])||0) > 0) { // เฉพาะบิลชื่อ KLH ที่มี VAT
          inputVat  += Number(r[6]) || 0;
          inputBase += Number(r[5]) || 0;
          inputCount++;
        }
      });
    }

    // 2) ยอดขายจริง KLH เดือนนี้ (SALES_HEADER: 2 PAID_DATE, 4 ENTITY, 9 TOTAL)
    var actualSales = 0;
    var sal = ss.getSheetByName('SALES_HEADER');
    if (sal && sal.getLastRow() > 1) {
      sal.getDataRange().getValues().slice(1).forEach(function(r) {
        if (ymOf_(r[2]) === ym && isKlhEntity_(r[4])) actualSales += Number(r[9]) || 0;
      });
    }

    // 3) ประมาณการของผู้บริหาร (TAX_ESTIMATE)
    var est = null;
    var es = taxEstSheet_();
    if (es.getLastRow() > 1) {
      es.getDataRange().getValues().slice(1).forEach(function(r) {
        var k = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM') : String(r[0]).slice(0, 7);
        if (k === ym) est = {
          execPercent: Number(r[2])||0, targetSales: Number(r[3])||0,
          targetVat: Number(r[4])||0, lastYearAvg: Number(r[5])||0
        };
      });
    }

    // 4) ยอดขายรับจริงจากธนาคาร (BANK_TRANSACTIONS: SALE+AR) — แหล่งหลักของฐานภาษีขาย
    var bs = getBankSummary(ym);
    var bankSales = (bs && bs.ok) ? bs.salesBase : 0;

    // ฐานยอดขายเพื่อคำนวณภาษีขาย: ใช้ยอดรับจริงจากธนาคารเป็นหลัก (POS อาจยังไม่ครบ) ไม่มีค่อย fallback POS
    var salesForVat = bankSales > 0 ? bankSales : actualSales;
    var outputVatActual = salesForVat * 7 / 107;     // ราคารวม VAT
    var netVat = outputVatActual - inputVat;

    return {
      ok: true, month: ym,
      taxId: taxId, companyName: coName,
      input:  { vat: inputVat, base: inputBase, count: inputCount },
      purchaseAllEntities: purchaseAll,
      actualSales: salesForVat,                       // ยอดขายที่ใช้คำนวณ (ธนาคารเป็นหลัก)
      posSales: actualSales,                          // ยอดขาย POS (อ้างอิง)
      bankSales: bankSales,
      bank: (bs && bs.ok) ? bs : null,
      outputVatActual: outputVatActual,
      netVat: netVat,
      estimate: est,
      // ยอดขายขั้นต่ำที่ทำให้ VAT ขาย > VAT ซื้อ (ไม่ขอคืนภาษี)
      minSalesRequired: inputVat * 107 / 7
    };
  } catch(e) { return { ok:false, error: e.toString() }; }
}

// ผู้บริหารบันทึกประมาณการ: % เหนือภาษีซื้อ → เป้ายอดขาย/VAT
function saveTaxEstimate(yyyymm, execPercent, lastYearAvg) {
  try {
    var ym  = yyyymm;
    var pct = Number(execPercent) || 0;
    if (pct <= 0) return { ok:false, msg:'% ต้องมากกว่า 0 (ภาษีขายต้องเกินภาษีซื้อ)' };
    var pp = getPP30(ym);
    if (!pp.ok) return pp;
    var targetVat   = pp.input.vat * (1 + pct/100);          // VAT ขายเป้า > VAT ซื้อ
    var targetSales = targetVat * 107 / 7;                   // ยอดขาย (รวม VAT) ที่ต้องมี
    var s = taxEstSheet_();
    var rows = s.getDataRange().getValues();
    var rowIdx = -1;
    for (var i = 1; i < rows.length; i++) {
      var k = rows[i][0] instanceof Date ? Utilities.formatDate(rows[i][0], 'Asia/Bangkok', 'yyyy-MM') : String(rows[i][0]).slice(0, 7);
      if (k === ym) { rowIdx = i+1; break; }
    }
    var rec = [ym, pp.input.vat, pct, targetSales, targetVat, Number(lastYearAvg)||0,
               Session.getActiveUser().getEmail(),
               Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd HH:mm')];
    if (rowIdx > 0) s.getRange(rowIdx,1,1,H_TAXEST.length).setValues([rec]);
    else s.appendRow(rec);
    return { ok:true, targetSales: targetSales, targetVat: targetVat };
  } catch(e) { return { ok:false, msg: e.toString() }; }
}

// เช็ครายสัปดาห์: ยอดจริงสะสม vs เป้าตามสัดส่วนวัน → แจ้ง LINE
function checkWeeklySalesTarget() {
  try {
    var now = new Date();
    var ym  = Utilities.formatDate(now,'Asia/Bangkok','yyyy-MM');
    var pp  = getPP30(ym);
    if (!pp.ok || !pp.estimate || !pp.estimate.targetSales) {
      Logger.log('ยังไม่ตั้งเป้าเดือน ' + ym); return 'no-target';
    }
    var day = now.getDate();
    var daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    var expected = pp.estimate.targetSales * (day / daysInMonth);
    var diff = pp.actualSales - expected;
    var msg = '📊 เช็คเป้าภาษีขาย KLH (' + ym + ')\n'
      + 'เป้าเดือน: ฿' + Math.round(pp.estimate.targetSales).toLocaleString() + '\n'
      + 'ควรได้ถึงวันนี้ (' + day + '/' + daysInMonth + '): ฿' + Math.round(expected).toLocaleString() + '\n'
      + 'ยอดจริงสะสม: ฿' + Math.round(pp.actualSales).toLocaleString() + '\n'
      + (diff < 0
          ? '⚠️ ต่ำกว่าเป้า ฿' + Math.round(-diff).toLocaleString() + '\n→ ควรนำเงินเข้าบัญชี KTB เพิ่ม เพื่อสร้างฐานภาษีขาย'
          : '✅ เกินเป้า ฿' + Math.round(diff).toLocaleString());
    sendWmsLine_(msg);
    return msg;
  } catch(e) { Logger.log('checkWeeklySalesTarget: '+e); return 'error: '+e; }
}

// ════════════════════════════════════════════════════════════
//  รายงานยอดขายรายวัน → LINE (แทนสคริปต์เก่า รายงานยอดเงิน)
//  ยอดขาย POS เมื่อวาน (แยกนิติ) + เงินเข้าธนาคารเมื่อวาน + ยอดสะสมเดือนนี้
// ════════════════════════════════════════════════════════════
function dailySalesReport() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var tz = 'Asia/Bangkok';
    var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var ym = today.slice(0, 7);
    function dOf(v){ return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v||'').slice(0,10); }

    // ── ยอดขาย/ชำระเจ้าหนี้ สะสมเดือนนี้ จากธนาคาร ──
    var ktbSale = 0, baySale = 0, payment = 0;
    var bk = ss.getSheetByName('BANK_TRANSACTIONS');
    if (bk && bk.getLastRow() > 1) {
      bk.getDataRange().getValues().slice(1).forEach(function(r){
        var pd = dOf(r[0]); if (pd.slice(0,7) !== ym || pd > today) return;
        var cat = String(r[4]||''), amt = Number(r[3]) || 0;
        if (r[2] === 'IN' && (cat === 'SALE' || cat === 'AR')) {
          if (String(r[1]).toUpperCase() === 'KTB') ktbSale += amt; else baySale += amt;   // กรุงศรี = ออม+กระแส
        }
        if (r[2] === 'OUT' && cat === 'PAYMENT') payment += amt;
      });
    }
    // ── ใช้ค่าตรงหน้า ภพ.30 (getPP30): ยอดรับจริง + ยอดขายปีที่แล้วเฉลี่ย/เดือน ──
    var taxSale = ktbSale + baySale;          // ฐานภาษี (SALE+AR) = ตรงกับ salesBase หน้า ภพ.30
    var lastYearAvg = 0;
    try {
      var pp = getPP30(ym);
      if (pp && pp.ok) {
        if (Number(pp.actualSales) > 0) taxSale = Number(pp.actualSales);   // ยอดรับจริงจากธนาคาร (แหล่งเดียวกับหน้า)
        if (pp.estimate) lastYearAvg = Number(pp.estimate.lastYearAvg) || 0;
      }
    } catch(ePP) {}
    var gap = taxSale - lastYearAvg;          // ยอดรับจริง − ยอดปีก่อนเฉลี่ย/เดือน (ลบ = ยังขาด)

    // เฉลี่ยต่อวัน: ผ่านมาแล้ว vs ที่เหลือถึงสิ้นเดือน
    var dayNum = Number(Utilities.formatDate(new Date(), tz, 'd'));            // วันที่ของเดือน (วันที่ผ่านมาแล้ว)
    var daysInMonth = new Date(Number(ym.slice(0,4)), Number(ym.slice(5,7)), 0).getDate();
    var daysLeft = Math.max(0, daysInMonth - dayNum);
    var avgPast = dayNum > 0 ? taxSale / dayNum : 0;                            // ขายเฉลี่ย/วัน ตั้งแต่ต้นเดือน
    var needLeft = daysLeft > 0 ? Math.abs(gap) / daysLeft : 0;                 // ต้องเร่ง/วัน ถึงสิ้นเดือน

    var rnd = function(n){ return Math.round(n).toLocaleString(); };
    var line4 = daysLeft <= 0 ? '🏁 สิ้นเดือนแล้ว'
      : (gap >= 0 ? '🎉 เกินยอดปีก่อนแล้ว (เหลือ ' + daysLeft + ' วัน)'
                  : '🎯 ต้องเร่งขายอีกวันละ ฿' + rnd(needLeft) + ' (เหลือ ' + daysLeft + ' วัน) ถึงทันปีก่อน');
    var msg = '📊 รายงานยอดขาย KLH · เดือน ' + ym + ' (สะสม ' + dayNum + ' วัน)\n――――――――\n'
      + '1️⃣ ยอดขาย KTB:  ฿' + rnd(ktbSale) + '\n'
      + '2️⃣ ยอดขาย กรุงศรี:  ฿' + rnd(baySale) + '\n'
      + '3️⃣ ยอดขายภาษี (รวม):  ฿' + rnd(taxSale) + '\n'
      + '      📈 เฉลี่ย/วัน (ผ่านมา ' + dayNum + ' วัน): ฿' + rnd(avgPast) + '\n'
      + '4️⃣ ยอดรับจริง เทียบปีที่แล้ว:  ' + (gap >= 0 ? '+' : '') + rnd(gap) + '\n'
      + '      ' + line4 + '\n'
      + (lastYearAvg ? '      ปีก่อนเฉลี่ย ฿' + rnd(lastYearAvg) + '/เดือน · รับจริง ฿' + rnd(taxSale)
                     : '      (ยังไม่ตั้งยอดปีก่อนในหน้า ภพ.30)') + '\n'
      + '5️⃣ ชำระเจ้าหนี้การค้า:  ฿' + rnd(payment);
    sendWmsLine_(msg);
    return msg;
  } catch(e) { Logger.log('dailySalesReport: ' + e); return 'error: ' + e; }
}

// ตั้ง trigger รายงานยอดขายทุกเช้า (ค่าเริ่มต้น 08:00 — เปลี่ยนเลขชั่วโมงได้)
function setupDailySalesTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'dailySalesReport') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailySalesReport').timeBased().everyDays(1).atHour(8).create();
  return 'ตั้งรายงานยอดขายเข้า LINE ทุกวัน 08:00 แล้ว';
}

// ตั้ง trigger รายสัปดาห์ (รันครั้งเดียวใน GAS Editor)
function setupWeeklyTaxTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'checkWeeklySalesTarget') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkWeeklySalesTarget')
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(19).create();
  return 'ตั้ง trigger ทุกอาทิตย์ 19:00 แล้ว';
}

// ────────────────────────────────────────────────────────────
//  ข้อ 5 (ส่วน B): สร้างยอดขาย KLH "จำลอง" จากยอด statement
//  → กระจายยอดขายเป้าหมายลงสินค้า KLH ตามน้ำหนักมูลค่าขายปลีก
//  → ได้ "สต๊อกคงเหลือ KLH จำลอง" สำหรับรายงานสรรพากร
//
//  targetSalesAmount = ยอดขายรวมที่ต้องการจำลอง (จาก statement)
// ────────────────────────────────────────────────────────────
function simulateKlhStock(yyyymm, targetSalesAmount) {
  try {
    var base = getMonthEndStockByEntity(yyyymm);
    if (!base.ok) return base;
    var target = Number(targetSalesAmount) || 0;

    var items = base.klh.items;
    // น้ำหนัก = มูลค่าขายปลีกของสต๊อกที่ยังมี (onHand × retail)
    var totalWeight = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].onHand > 0 && items[i].retail > 0) {
        items[i]._w = items[i].onHand * items[i].retail;
        totalWeight += items[i]._w;
      } else {
        items[i]._w = 0;
      }
    }

    var out = [];
    var totSimQty = 0, totSimAmt = 0, totRemainQty = 0, totRemainCost = 0;
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var alloc = (totalWeight > 0) ? target * (it._w / totalWeight) : 0;
      var simQty = (it.retail > 0) ? Math.round(alloc / it.retail) : 0;
      if (simQty > it.onHand) simQty = it.onHand;           // ขายเกินสต๊อกไม่ได้
      var simAmt = simQty * it.retail;
      var remainQty = it.onHand - simQty;
      var remainCost = remainQty * it.cost;
      out.push({
        barcode:    it.barcode,
        name:       it.name,
        onHand:     it.onHand,
        retail:     it.retail,
        cost:       it.cost,
        simSoldQty: simQty,
        simSoldAmt: simAmt,
        remainQty:  remainQty,
        remainCost: remainCost
      });
      totSimQty += simQty; totSimAmt += simAmt;
      totRemainQty += remainQty; totRemainCost += remainCost;
    }
    out.sort(function(a, b){ return b.simSoldAmt - a.simSoldAmt; });

    return {
      ok: true,
      month: base.month,
      target: target,
      totals: {
        simSoldQty:  totSimQty,
        simSoldAmt:  totSimAmt,
        remainQty:   totRemainQty,
        remainCost:  totRemainCost,
        unmatched:   Math.max(0, target - totSimAmt)   // ยอดที่ขายจำลองไม่หมด (สต๊อกไม่พอ)
      },
      items: out
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}
