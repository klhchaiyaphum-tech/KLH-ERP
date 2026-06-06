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
