// ============================================================
//  pos_backend.js — KLH POS Backend
//  Sheets: ORDERS, ORDER_DETAIL, SALES_HEADER, SALES_DETAIL
//         CUSTOMER_MASTER, AR_LEDGER
//  Deferred settlement model:
//    Order created (PENDING) → Cashier closes → Stock deducted
// ============================================================

// ── Debug: ดู ORDERS sheet (รันใน GAS Editor) ─────────────────
function debugOrders() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName('ORDERS');
  if (!s) { Logger.log('ไม่พบ ORDERS sheet — ต้องรัน initPosSheets ก่อน'); return; }
  Logger.log('ORDERS: ' + s.getLastRow() + ' แถว (รวม header)');
  var hdr = s.getRange(1,1,1,13).getValues()[0];
  Logger.log('Header: ' + hdr.join(' | '));
  if (s.getLastRow() <= 1) {
    Logger.log('ยังไม่มี order — สร้าง order จาก POS ก่อน แล้วลองใหม่');
    return;
  }
  var rows = s.getDataRange().getValues().slice(1);
  rows.slice(0,5).forEach(function(r){
    Logger.log('ID=' + r[0] + ' | status=' + r[12] + ' | total=' + r[11] + ' | date=' + r[2]);
  });
  Logger.log('แสดง ' + Math.min(5,rows.length) + '/' + rows.length + ' รายการ');
}

const SH_ORD  = 'ORDERS';
const SH_ORDD = 'ORDER_DETAIL';
const SH_SALH = 'SALES_HEADER';
const SH_SALD = 'SALES_DETAIL';
const SH_CUST = 'CUSTOMER_MASTER';
const SH_AR   = 'AR_LEDGER';

const H_ORD  = ['ORDER_ID','QR_CODE','DATE','TIME','SOURCE','DEVICE','ENTITY',
                'CUSTOMER_CODE','CUSTOMER_NAME','SUBTOTAL','DISCOUNT','TOTAL',
                'STATUS','CREATED_BY','NOTE'];
const H_ORDD = ['ORDER_ID','LINE_NO','BARCODE','PRODUCT_NAME','QTY','UNIT',
                'UNIT_PRICE','DISCOUNT_AMT','LINE_TOTAL','LARGE_UNIT','CONV_RATE'];
const H_SALH = ['SALE_ID','ORDER_ID','PAID_DATE','PAID_TIME','ENTITY',
                'CUSTOMER_CODE','CUSTOMER_NAME','SUBTOTAL','VAT_AMT','TOTAL',
                'PAYMENT_METHOD','CASH_RECEIVED','CHANGE_GIVEN','CASHIER','NOTE'];
const H_SALD = ['SALE_ID','LINE_NO','BARCODE','PRODUCT_NAME','QTY_PIECE',
                'UNIT','UNIT_PRICE','LINE_TOTAL','ENTITY'];
// CUSTOMER_MASTER: code,name,phone,address,taxId,priceLevel,creditLimit,creditDays,outstanding,note,entity,created
const H_CUST = ['CUST_ID','NAME','PHONE','ADDRESS','TAX_ID',
                'PRICE_LEVEL','CREDIT_LIMIT','CREDIT_DAYS','OUTSTANDING','NOTE','ENTITY','CREATED'];
// AR_LEDGER: arId,saleId,custId,custName,entity,invDate,dueDate,amount,paidAmt,balance,status,note
const H_AR   = ['AR_ID','SALE_ID','CUST_ID','CUST_NAME','ENTITY',
                'INV_DATE','DUE_DATE','AMOUNT','PAID_AMT','BALANCE','STATUS','NOTE'];

// ── Init POS Sheets ────────────────────────────────────────────
function initPosSheets() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var defs = [
    [SH_ORD,  H_ORD,  '#1A237E'],
    [SH_ORDD, H_ORDD, '#311B92'],
    [SH_SALH, H_SALH, '#1B5E20'],
    [SH_SALD, H_SALD, '#2E7D32'],
    [SH_CUST, H_CUST, '#4A148C'],
    [SH_AR,   H_AR,   '#B71C1C'],
  ];
  var results = [];
  defs.forEach(function(d) {
    var name = d[0], hdr = d[1], color = d[2];
    var s = ss.getSheetByName(name);
    if (!s) { s = ss.insertSheet(name); }
    if (s.getLastRow() === 0 || s.getRange(1,1).getValue() !== hdr[0]) {
      s.clearContents();
      s.getRange(1,1,1,hdr.length).setValues([hdr])
        .setBackground(color).setFontColor('#fff').setFontWeight('bold');
      s.setFrozenRows(1);
    }
    results.push(name);
  });
  return 'POS Sheets ready: ' + results.join(', ');
}

// ── Generate Order ID ──────────────────────────────────────────
function genOrderId_(date) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName(SH_ORD);
  var ymd = Utilities.formatDate(date, 'Asia/Bangkok', 'yyyyMMdd');
  var prefix = 'ORD-' + ymd + '-';
  if (!s || s.getLastRow() <= 1) return prefix + '001';
  var vals = s.getRange(2,1,s.getLastRow()-1,1).getValues();
  var max = 0;
  vals.forEach(function(r) {
    if (String(r[0]).indexOf(prefix) === 0) {
      var n = parseInt(String(r[0]).replace(prefix,''), 10);
      if (n > max) max = n;
    }
  });
  return prefix + String(max+1).padStart(3,'0');
}

function genSaleId_(date) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName(SH_SALH);
  var ymd = Utilities.formatDate(date, 'Asia/Bangkok', 'yyyyMMdd');
  var prefix = 'SAL-' + ymd + '-';
  if (!s || s.getLastRow() <= 1) return prefix + '001';
  var vals = s.getRange(2,1,s.getLastRow()-1,1).getValues();
  var max = 0;
  vals.forEach(function(r) {
    if (String(r[0]).indexOf(prefix) === 0) {
      var n = parseInt(String(r[0]).replace(prefix,''), 10);
      if (n > max) max = n;
    }
  });
  return prefix + String(max+1).padStart(3,'0');
}

// ── Search Products for POS ────────────────────────────────────
// Returns: [{barcode, name, category, retailPrice, wholesalePrice,
//            convRate, unitBig, costFinal, onHand, taxEntity}]
function posSearchProducts(query, whId, catFilter) {
  try {
    var rows;
    // ถ้ามี catFilter → scan ทั้ง sheet เพื่อให้ได้สินค้าครบ ไม่ติดขอบ 200 rows
    if (catFilter && catFilter !== 'all') {
      var klh = klhDataSheet_();
      var allRows = klh ? klh.getDataRange().getValues() : [];
      rows = [];
      var q = String(query || '').toLowerCase().trim();
      for (var i = 1; i < allRows.length; i++) {
        var r = allRows[i];
        var cat = String(r[2] || '').trim();
        // "ไม่มีหมวด" = สินค้าที่ col C ว่าง
        if (catFilter === 'ไม่มีหมวด') {
          if (cat !== '') continue;
        } else {
          if (cat !== catFilter) continue;
        }
        var name = String(r[1] || '');
        var barcode = String(r[0] || '');
        if (q && name.toLowerCase().indexOf(q) < 0 && barcode.indexOf(q) < 0) continue;
        rows.push({
          barcode:        barcode,
          name:           name,
          category:       cat,
          retail_price:   Number(r[22]) || Number(r[23]) || 0,           // W → X
          wholesale_price:Number(r[20]) || Number(r[21]) || 0,           // U → V (ราคาส่ง/หน่วยใหญ่)
          packMult:       Number(r[4])  || 1,
          packUnit:       String(r[5]  || ''),
          cost_final:     Number(r[17]) || 0,
          tax_entity:     String(r[29] || ''),
          dozen_barcode:  String(r[33] || ''),  // AH
          dozen_price:    Number(r[34]) || 0     // AI ราคาโหล
        });
      }
    } else {
      rows = searchProductsFromSheet(query || '');
    }
    var stock = {};
    var balSh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('STOCK_BALANCE');
    if (balSh) {
      balSh.getDataRange().getValues().slice(1).forEach(function(r) {
        var key = String(r[0]) + '|' + String(r[2]);
        stock[key] = Number(r[3]) || 0;
      });
    }
    return rows.slice(0, 200).map(function(p) {
      var wh  = whId || 'W1';
      var key = p.barcode + '|' + wh;
      return {
        barcode:        p.barcode,
        name:           p.name,
        category:       p.category,
        retailPrice:    p.retail_price   || 0,  // W: RETAIL_OLD
        wholesalePrice: p.wholesale_price || 0, // U: WHOLESALE_OLD
        convRate:       p.packMult       || 1,
        unitBig:        p.packUnit       || '',
        costFinal:      p.cost_final     || 0,
        taxEntity:      p.tax_entity     || '',
        dozenPrice:     p.dozen_price    || 0,   // ราคาโหล (12 ชิ้น)
        dozenBarcode:   p.dozen_barcode  || '',
        onHand:         stock[key]       || 0
      };
    });
  } catch(e) {
    Logger.log('posSearchProducts error: ' + e);
    return [];
  }
}

// ── Get Warehouses for POS ─────────────────────────────────────
function getPosPageData() {
  var warehouses = [];
  var entities = ['หจก. เคแอลเอช','กวงล่งเฮง','วิศาลศักดิ์','เจ็กตา','เอี้ยมเช็ง'];
  var pendingOrders = [];

  try { initPosSheets(); } catch(e) { Logger.log('initPosSheets err: ' + e); }

  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var whSh = ss.getSheetByName('WAREHOUSE');
    if (whSh) {
      whSh.getDataRange().getValues().slice(1).forEach(function(r) {
        if (r[5] === true) warehouses.push({ id: String(r[0]), name: String(r[1]) });
      });
    }
  } catch(e) { Logger.log('warehouses err: ' + e); }

  try {
    var shData = getShopsAndEntities();
    if (shData.shops.length) entities = shData.shops;
  } catch(e) { Logger.log('shops err: ' + e); }

  try {
    pendingOrders = getPendingOrders();
  } catch(e) { Logger.log('pendingOrders err: ' + e); }

  return {
    ok:         true,
    warehouses: warehouses,
    entities:   entities,
    pending:    pendingOrders
  };
}

// ── Create Order (Pending — no stock deduction) ────────────────
function createOrder(data) {
  // data = {entity, device, source, customerCode, customerName, whId,
  //         items:[{barcode,name,qty,unit,unitPrice,discountAmt,lineTotal,convRate,unitBig}],
  //         subtotal, discount, total, note}
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    var ss  = SpreadsheetApp.openById(SHEET_ID);
    var now = new Date();
    var ordSh  = ss.getSheetByName(SH_ORD);
    var orddSh = ss.getSheetByName(SH_ORDD);
    if (!ordSh || !orddSh) { initPosSheets(); ordSh = ss.getSheetByName(SH_ORD); orddSh = ss.getSheetByName(SH_ORDD); }

    var orderId = genOrderId_(now);
    var user    = Session.getActiveUser().getEmail();
    var dateStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
    var timeStr = Utilities.formatDate(now, 'Asia/Bangkok', 'HH:mm:ss');

    // Header row
    ordSh.appendRow([
      orderId,
      orderId,                        // QR = orderId (scan to retrieve)
      dateStr, timeStr,
      data.source  || 'POS',
      data.device  || '',
      data.entity  || '',
      data.customerCode || '',
      data.customerName || '',
      Number(data.subtotal) || 0,
      Number(data.discount) || 0,
      Number(data.total)    || 0,
      'PENDING',
      user,
      data.note    || ''
    ]);

    // Detail rows
    var items = data.items || [];
    if (items.length) {
      var rows = items.map(function(it, i) {
        return [
          orderId, i+1,
          it.barcode    || '',
          it.name       || '',
          Number(it.qty)        || 0,
          it.unit       || '',
          Number(it.unitPrice)  || 0,
          Number(it.discountAmt)|| 0,
          Number(it.lineTotal)  || 0,
          it.unitBig    || '',
          Number(it.convRate)   || 1
        ];
      });
      orddSh.getRange(orddSh.getLastRow()+1, 1, rows.length, H_ORDD.length).setValues(rows);
    }

    lock.releaseLock();
    return { ok: true, orderId: orderId, msg: 'สร้างออเดอร์ ' + orderId + ' สำเร็จ' };
  } catch(e) {
    return { ok: false, msg: e.message || String(e) };
  }
}

// ── Get Pending Orders (for cashier) ───────────────────────────
function getPendingOrders() {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_ORD);
    if (!s || s.getLastRow() <= 1) return [];
    var rows = s.getDataRange().getValues().slice(1);
    function sd(v){ return v instanceof Date ? Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd') : String(v||''); }
    return rows.filter(function(r){ return String(r[12]) === 'PENDING'; })
      .map(function(r) {
        return {
          orderId:      sd(r[0]),
          date:         sd(r[2]),
          time:         sd(r[3]),
          source:       sd(r[4]),
          entity:       sd(r[6]),
          customerName: sd(r[8]),
          total:        Number(r[11])||0,
          status:       sd(r[12])
        };
      }).reverse().slice(0, 50);
  } catch(e) { return []; }
}

// ── Load Order by ID (cashier scans QR) ────────────────────────
function loadOrderById(orderId) {
  try {
    var ss   = SpreadsheetApp.openById(SHEET_ID);
    var ordS = ss.getSheetByName(SH_ORD);
    var dtlS = ss.getSheetByName(SH_ORDD);
    if (!ordS || !dtlS) return { ok: false, msg: 'ไม่พบ ORDERS sheet' };

    var hdrRows = ordS.getDataRange().getValues();
    var order = null;
    for (var i = 1; i < hdrRows.length; i++) {
      if (String(hdrRows[i][0]) === String(orderId)) {
        // Convert all values to safe primitives (no Date objects → GAS serialize ไม่ได้)
        function safeStr(v) { return v instanceof Date ? Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd') : String(v||''); }
        function safeNum(v) { return Number(v)||0; }
        order = {
          orderId:      safeStr(hdrRows[i][0]),
          date:         safeStr(hdrRows[i][2]),
          time:         safeStr(hdrRows[i][3]),
          source:       safeStr(hdrRows[i][4]),
          device:       safeStr(hdrRows[i][5]),
          entity:       safeStr(hdrRows[i][6]),
          customerCode: safeStr(hdrRows[i][7]),
          customerName: safeStr(hdrRows[i][8]),
          subtotal:     safeNum(hdrRows[i][9]),
          discount:     safeNum(hdrRows[i][10]),
          total:        safeNum(hdrRows[i][11]),
          status:       safeStr(hdrRows[i][12]),
          note:         safeStr(hdrRows[i][14])
        };
        break;
      }
    }
    if (!order) return { ok: false, msg: 'ไม่พบออเดอร์ ' + orderId };
    if (order.status !== 'PENDING') return { ok: false, msg: 'ออเดอร์ ' + orderId + ' สถานะ: ' + order.status + ' (ไม่ใช่ PENDING)' };

    var dtlRows = dtlS.getDataRange().getValues().slice(1);
    var items = dtlRows.filter(function(r){ return String(r[0]) === String(orderId); })
      .map(function(r) {
        var qty  = Number(r[4])||0;
        var unit = String(r[5]||'');
        var conv = Number(r[10])||1;
        // ชิ้นจริง: ถ้าหน่วย = "ชิ้น" → = qty (บิลเก่า convRate อาจเป็นตัวคูณแพ็ก ไม่ใช้)
        //          ถ้าหน่วยใหญ่/โหล → qty × convRate
        var pieces = (unit === 'ชิ้น' || unit === '') ? qty : qty * conv;
        return {
          barcode:    String(r[2]||''),
          name:       String(r[3]||''),
          qty:        qty,
          unit:       unit,
          unitPrice:  Number(r[6])||0,
          discountAmt:Number(r[7])||0,
          lineTotal:  Number(r[8])||0,
          unitBig:    String(r[9]||''),
          convRate:   conv,
          pieces:     pieces
        };
      });
    order.items = items;
    return { ok: true, order: order };
  } catch(e) { return { ok: false, msg: e.message }; }
}

// ── Close Sale (Cashier — this is where stock is deducted) ─────
function closeSale(data) {
  // data = {orderIds:[], entity, customerCode, customerName,
  //         vatRate, subtotal, vatAmt, total,
  //         paymentMethod, cashReceived, changeGiven, note,
  //         warehouseId, items:[...merged from all orders]}
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    var ss   = SpreadsheetApp.openById(SHEET_ID);
    var now  = new Date();
    var user = Session.getActiveUser().getEmail();
    var dateStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
    var timeStr = Utilities.formatDate(now, 'Asia/Bangkok', 'HH:mm:ss');
    var saleId  = genSaleId_(now);
    var whId    = data.warehouseId || 'W1';

    // 1. Write SALES_HEADER
    var salHSh = ss.getSheetByName(SH_SALH);
    if (!salHSh) { initPosSheets(); salHSh = ss.getSheetByName(SH_SALH); }
    salHSh.appendRow([
      saleId,
      (data.orderIds || []).join(','),
      dateStr, timeStr,
      data.entity  || '',
      data.customerCode || '',
      data.customerName || '',
      Number(data.subtotal)     || 0,
      Number(data.vatAmt)       || 0,
      Number(data.total)        || 0,
      data.paymentMethod        || 'CASH',
      Number(data.cashReceived) || 0,
      Number(data.changeGiven)  || 0,
      user,
      data.note || ''
    ]);

    // 2. Write SALES_DETAIL + Deduct STOCK_LOG
    var salDSh = ss.getSheetByName(SH_SALD);
    if (!salDSh) salDSh = ss.getSheetByName(SH_SALD);
    var items   = data.items || [];
    var logSh   = ss.getSheetByName('STOCK_LOG');
    var detailRows = [];

    items.forEach(function(it) {
      // ── จำนวน "ชิ้นจริง" ที่ต้องตัดสต๊อก ──
      // ถ้า frontend ส่ง it.pieces มา (หน่วยใหญ่/โหล แปลงเป็นชิ้นแล้ว) → ใช้เลย
      // ถ้าไม่ส่ง → fallback = qty (พฤติกรรมเดิม ปลอดภัยกับบิลเก่า)
      var pieces = (it.pieces !== undefined && it.pieces !== null && it.pieces !== '')
                   ? (Number(it.pieces) || 0)
                   : (Number(it.qty) || 0);
      // SALES_DETAIL row (QTY_PIECE = ชิ้นจริง)
      detailRows.push([
        saleId, detailRows.length+1,
        it.barcode || '', it.name || '',
        pieces,
        it.unit || '',
        Number(it.unitPrice) || 0,
        Number(it.lineTotal) || 0,
        data.entity || ''
      ]);
      // STOCK_LOG OUT row (actual deduction = ชิ้นจริง)
      if (logSh && it.barcode && pieces > 0) {
        logSh.appendRow([
          dateStr, timeStr,
          'OUT',
          it.barcode,
          it.name || '',
          data.entity || '',
          whId,
          -pieces,  // negative = out (ชิ้นจริง)
          it.unit || '',
          Number(it.unitPrice) || 0,
          Number(it.lineTotal) || 0,
          saleId, user,
          'POS ขาย: ' + (data.customerName || 'ลูกค้าทั่วไป')
        ]);
        // Update STOCK_BALANCE (ตัดเป็นชิ้นจริง)
        var balSh = ss.getSheetByName('STOCK_BALANCE');
        if (balSh) {
          var balData = balSh.getDataRange().getValues();
          var found = false;
          for (var i = 1; i < balData.length; i++) {
            if (String(balData[i][0]) === String(it.barcode) && String(balData[i][2]) === String(whId)) {
              var newQ = Math.max(0, (Number(balData[i][3]) || 0) - pieces);
              balSh.getRange(i+1, 4).setValue(newQ);
              balSh.getRange(i+1, 7).setValue(now);
              found = true; break;
            }
          }
          if (!found) {
            Logger.log('closeSale: no STOCK_BALANCE for ' + it.barcode + '/' + whId);
          }
        }
      }
    });

    if (detailRows.length) {
      salDSh.getRange(salDSh.getLastRow()+1, 1, detailRows.length, H_SALD.length).setValues(detailRows);
    }

    // 3. AR entry for credit payment
    if (data.paymentMethod === 'CREDIT') {
      createArEntry_(ss, saleId, {
        customerCode: data.customerCode,
        customerName: data.customerName,
        entity:       data.entity,
        creditDays:   data.creditDays || 30,
        note:         data.note
      }, Number(data.total)||0);
    }

    // 4. Mark all source orders as PAID
    var ordSh = ss.getSheetByName(SH_ORD);
    if (ordSh && data.orderIds && data.orderIds.length) {
      var ordData = ordSh.getDataRange().getValues();
      for (var oi = 1; oi < ordData.length; oi++) {
        if (data.orderIds.indexOf(String(ordData[oi][0])) >= 0) {
          ordSh.getRange(oi+1, 13).setValue('PAID');
        }
      }
    }

    lock.releaseLock();
    return {
      ok:     true,
      saleId: saleId,
      msg:    'ปิดบิล ' + saleId + ' สำเร็จ | ตัดสต็อกแล้ว ' + items.length + ' รายการ'
    };
  } catch(e) {
    return { ok: false, msg: e.message || String(e) };
  }
}

// ── Cancel Order ───────────────────────────────────────────────
function cancelOrder(orderId, reason) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_ORD);
    if (!s) return { ok: false, msg: 'ไม่พบ ORDERS' };
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(orderId)) {
        s.getRange(i+1, 13).setValue('CANCELLED');
        s.getRange(i+1, 15).setValue(reason || 'ยกเลิก');
        return { ok: true, msg: 'ยกเลิก ' + orderId + ' แล้ว' };
      }
    }
    return { ok: false, msg: 'ไม่พบออเดอร์' };
  } catch(e) { return { ok: false, msg: e.message }; }
}

// ── Daily Sales Summary ────────────────────────────────────────
function getDailySalesSummary(dateStr) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_SALH);
    if (!s || s.getLastRow() <= 1) return { ok: true, total: 0, count: 0, byEntity: {} };
    var d = dateStr || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
    var rows = s.getDataRange().getValues().slice(1).filter(function(r){ return String(r[2]) === d; });
    var total = 0, byEntity = {}, byPayment = {};
    rows.forEach(function(r) {
      total += Number(r[9]) || 0;
      var ent = String(r[4] || 'ไม่ระบุ');
      byEntity[ent] = (byEntity[ent] || 0) + (Number(r[9]) || 0);
      var pay = String(r[10] || 'CASH');
      byPayment[pay] = (byPayment[pay] || 0) + (Number(r[9]) || 0);
    });
    return { ok: true, date: d, count: rows.length, total: total, byEntity: byEntity, byPayment: byPayment };
  } catch(e) { return { ok: false, msg: e.message }; }
}

// ══════════════════════════════════════════════════════════════
//  CUSTOMER MASTER (ระบบสมาชิก)
// ══════════════════════════════════════════════════════════════

function searchCustomers(query) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_CUST);
    if (!s || s.getLastRow() <= 1) return [];
    var q = String(query||'').trim().toLowerCase();
    return s.getDataRange().getValues().slice(1)
      .filter(function(r){
        return r[0] && (
          String(r[1]).toLowerCase().indexOf(q) >= 0 ||  // name
          String(r[2]).toLowerCase().indexOf(q) >= 0 ||  // phone
          String(r[0]).toLowerCase().indexOf(q) >= 0     // id
        );
      })
      .map(function(r){
        return {
          custId:      String(r[0]),
          name:        String(r[1]||''),
          phone:       String(r[2]||''),
          priceLevel:  String(r[5]||'retail'),
          creditLimit: Number(r[6])||0,
          creditDays:  Number(r[7])||0,
          outstanding: Number(r[8])||0,
          entity:      String(r[10]||'')
        };
      }).slice(0,10);
  } catch(e) { return []; }
}

function getCustomerById(custId) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_CUST);
    if (!s) return null;
    var rows = s.getDataRange().getValues().slice(1);
    for (var i=0;i<rows.length;i++) {
      if (String(rows[i][0]) === String(custId)) {
        var r = rows[i];
        // Get AR outstanding live
        var outstanding = getCustomerOutstanding_(custId);
        return {
          custId: r[0], name: r[1], phone: r[2], address: r[3], taxId: r[4],
          priceLevel: r[5]||'retail', creditLimit: Number(r[6])||0,
          creditDays: Number(r[7])||0, outstanding: outstanding,
          note: r[9], entity: r[10]
        };
      }
    }
    return null;
  } catch(e) { return null; }
}

function getCustomerOutstanding_(custId) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_AR);
    if (!s || s.getLastRow() <= 1) return 0;
    var total = 0;
    s.getDataRange().getValues().slice(1).forEach(function(r) {
      if (String(r[2]) === String(custId) && r[10] !== 'PAID') {
        total += Number(r[9]) || 0;  // BALANCE
      }
    });
    return total;
  } catch(e) { return 0; }
}

function addCustomer(data) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_CUST);
    if (!s) { initPosSheets(); s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_CUST); }
    // Auto ID
    var lastRow = s.getLastRow();
    var num = 1;
    if (lastRow > 1) {
      var lastId = s.getRange(lastRow,1).getValue();
      num = (parseInt(String(lastId).replace('CUST-','')) || 0) + 1;
    }
    var custId = 'CUST-' + String(num).padStart(4,'0');
    var now    = Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd');
    s.appendRow([
      custId, data.name||'', data.phone||'', data.address||'', data.taxId||'',
      data.priceLevel||'retail', Number(data.creditLimit)||0, Number(data.creditDays)||0,
      0, data.note||'', data.entity||'', now
    ]);
    return { ok:true, custId:custId, msg:'เพิ่มสมาชิก '+custId+' สำเร็จ' };
  } catch(e) { return { ok:false, msg:e.message }; }
}

function updateCustomer(custId, data) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_CUST);
    if (!s) return { ok:false, msg:'ไม่พบ CUSTOMER_MASTER' };
    var rows = s.getDataRange().getValues();
    for (var i=1;i<rows.length;i++) {
      if (String(rows[i][0]) === String(custId)) {
        s.getRange(i+1,1,1,11).setValues([[
          custId,
          data.name        || rows[i][1],
          data.phone       || rows[i][2],
          data.address     || rows[i][3],
          data.taxId       || rows[i][4],
          data.priceLevel  || rows[i][5],
          Number(data.creditLimit !== undefined ? data.creditLimit : rows[i][6]),
          Number(data.creditDays  !== undefined ? data.creditDays  : rows[i][7]),
          rows[i][8],  // outstanding — managed via AR
          data.note    !== undefined ? data.note : rows[i][9],
          data.entity  || rows[i][10]
        ]]);
        return { ok:true, msg:'อัปเดต '+custId+' สำเร็จ' };
      }
    }
    return { ok:false, msg:'ไม่พบรหัส '+custId };
  } catch(e) { return { ok:false, msg:e.message }; }
}

function getAllCustomers() {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_CUST);
    if (!s || s.getLastRow() <= 1) return [];
    return s.getDataRange().getValues().slice(1)
      .filter(function(r){ return r[0]; })
      .map(function(r){
        var outstanding = getCustomerOutstanding_(String(r[0]));
        return {
          custId: r[0], name: r[1], phone: r[2], address: r[3], taxId: r[4],
          priceLevel: r[5], creditLimit: Number(r[6])||0, creditDays: Number(r[7])||0,
          outstanding: outstanding, note: r[9], entity: r[10]
        };
      });
  } catch(e) { return []; }
}

// ══════════════════════════════════════════════════════════════
//  AR LEDGER (ลูกหนี้การค้า)
// ══════════════════════════════════════════════════════════════

function createArEntry_(ss, saleId, data, total) {
  var s = ss.getSheetByName(SH_AR);
  if (!s) return;
  var now      = new Date();
  var invDate  = Utilities.formatDate(now,'Asia/Bangkok','yyyy-MM-dd');
  var days     = Number(data.creditDays) || 30;
  var dueDate  = new Date(now.getTime() + days*24*60*60*1000);
  var dueDateStr = Utilities.formatDate(dueDate,'Asia/Bangkok','yyyy-MM-dd');
  var arId     = 'AR-' + saleId;
  s.appendRow([
    arId, saleId,
    data.customerCode || '', data.customerName || '',
    data.entity       || '',
    invDate, dueDateStr,
    total, 0, total,     // amount, paid, balance
    'UNPAID',
    data.note || ''
  ]);
  Logger.log('AR created: '+arId+' ฿'+total+' due '+dueDateStr);
}

function getArByCustomer(custId, status) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_AR);
    if (!s || s.getLastRow() <= 1) return { ok:true, items:[] };
    var rows = s.getDataRange().getValues().slice(1)
      .filter(function(r){
        return (!custId || String(r[2]) === String(custId)) &&
               (!status  || String(r[10]) === status);
      })
      .map(function(r){
        return {
          arId: r[0], saleId: r[1], custId: r[2], custName: r[3], entity: r[4],
          invDate: r[5], dueDate: r[6],
          amount: Number(r[7])||0, paidAmt: Number(r[8])||0, balance: Number(r[9])||0,
          status: r[10], note: r[11]
        };
      });
    return { ok:true, items:rows };
  } catch(e) { return { ok:false, msg:e.message }; }
}

function payArEntry(arId, payAmount) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    var s    = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_AR);
    if (!s) { lock.releaseLock(); return { ok:false, msg:'ไม่พบ AR_LEDGER' }; }
    var rows = s.getDataRange().getValues();
    for (var i=1;i<rows.length;i++) {
      if (String(rows[i][0]) === String(arId)) {
        var paid    = (Number(rows[i][8])||0) + (Number(payAmount)||0);
        var balance = (Number(rows[i][7])||0) - paid;
        var status  = balance <= 0 ? 'PAID' : 'PARTIAL';
        s.getRange(i+1,9).setValue(paid);
        s.getRange(i+1,10).setValue(Math.max(0,balance));
        s.getRange(i+1,11).setValue(status);
        lock.releaseLock();
        return { ok:true, msg:'ชำระ '+arId+' ฿'+payAmount+' | คงเหลือ ฿'+Math.max(0,balance), balance: Math.max(0,balance) };
      }
    }
    lock.releaseLock();
    return { ok:false, msg:'ไม่พบ AR_ID '+arId };
  } catch(e) { return { ok:false, msg:e.message }; }
}

function getArSummary(entity, status) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_AR);
    if (!s || s.getLastRow()<=1) return { ok:true, total:0, overdue:0, items:[] };
    var today = Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd');
    var rows = s.getDataRange().getValues().slice(1)
      .filter(function(r){ return (!entity || r[4]===entity) && r[10] !== 'PAID'; });
    var total = 0, overdue = 0;
    rows.forEach(function(r){
      var bal = Number(r[9])||0;
      total += bal;
      if (String(r[6]) < today) overdue += bal;
      // Auto-mark overdue
      if (String(r[6]) < today && r[10]==='UNPAID') {
        // would need row ref to update, skip for now
      }
    });
    return { ok:true, total:total, overdue:overdue, count:rows.length };
  } catch(e) { return { ok:false, msg:e.message }; }
}
