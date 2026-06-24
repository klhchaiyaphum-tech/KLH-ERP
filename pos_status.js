// ============================================================
//  pos_status.js — Order lifecycle (ใช้ร่วม LINE / POS-PC / Cashier)
//  ORDERS column 16 (index 15) = FULFILL: NEW → PREPARING → READY → DONE
//  ORDERS column 13 (index 12) = STATUS (payment): PENDING → PAID  [เดิม]
//  delivery (pickup/delivery) อ่านจาก NOTE (createLineOrder ใส่ "จัดส่ง"/"รับเองที่ร้าน")
// ============================================================

function _ordSheet_() { return SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_ORD); }

function _ordRow_(s, orderId) {
  if (!s || s.getLastRow() < 2) return -1;
  var ids = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(orderId)) return i + 2;
  return -1;
}

// ป้ายสถานะที่ลูกค้า LINE เห็น (6 ขั้น)
function lineStatusLabel_(pay, fulfill, delivery) {
  if (fulfill === 'DONE')      return (delivery === 'delivery') ? 'จัดส่งแล้ว' : 'รับสินค้าแล้ว';
  if (fulfill === 'READY')     return (delivery === 'delivery') ? 'กำลังจัดส่ง' : 'จัดเสร็จ พร้อมมารับ';
  if (fulfill === 'PREPARING') return 'กำลังจัดสินค้า';
  if (pay === 'PAID')          return 'ชำระเงินแล้ว';
  return 'รอชำระเงิน';
}

// ── POS-PC เลื่อนสถานะจัดของ (กำลังจัด / จัดเสร็จ) · Cashier นำจัดส่ง (DONE) ──
function setOrderFulfill(orderId, fulfill) {
  try {
    var ok = ['NEW','PREPARING','READY','DONE'];
    if (ok.indexOf(fulfill) < 0) return { ok: false, msg: 'สถานะไม่ถูกต้อง: ' + fulfill };
    var s = _ordSheet_(); if (!s) return { ok: false, msg: 'ไม่พบ ORDERS' };
    var row = _ordRow_(s, orderId); if (row < 0) return { ok: false, msg: 'ไม่พบออเดอร์ ' + orderId };
    s.getRange(row, 16).setValue(fulfill);   // col 16 = FULFILL
    // แจ้งเตือนสถานะเข้ากลุ่ม LINE (เฉพาะออเดอร์ LINE)
    try {
      var rv = s.getRange(row, 1, 1, 16).getValues()[0];
      if (/LINE/i.test(String(rv[4]||''))) {
        var note = String(rv[14]||''), deliv = /จัดส่ง/.test(note) ? 'delivery' : 'pickup';
        var lbl = (fulfill==='PREPARING') ? '🧺 กำลังจัดสินค้า'
                : (fulfill==='READY')     ? (deliv==='delivery' ? '✅ จัดเสร็จ พร้อมจัดส่ง' : '✅ จัดเสร็จ พร้อมให้มารับ')
                : (fulfill==='DONE')      ? (deliv==='delivery' ? '🎉 จัดส่งแล้ว' : '🎉 ลูกค้ารับสินค้าแล้ว')
                : '';
        if (lbl && typeof pushLineGroup_ === 'function') {
          pushLineGroup_('📦 อัปเดตออเดอร์ ' + orderId + '\nลูกค้า: ' + String(rv[8]||'') + '\nสถานะ: ' + lbl);
        }
      }
    } catch(eP) {}
    return { ok: true, orderId: orderId, fulfill: fulfill };
  } catch(e) { return { ok: false, msg: String(e) }; }
}

// ── สรุปยอดขายกะ (Cashier ปิดกะ) — SALES_HEADER: 2 date · 9 total · 10 payMethod · 13 user ──
function getShiftSummary(dateStr) {
  try {
    var tz = 'Asia/Bangkok';
    var day = dateStr || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_SALH);
    if (!s || s.getLastRow() <= 1) return { ok:true, date:day, count:0, total:0, cash:0, transfer:0, credit:0, bills:[] };
    var rows = s.getRange(2, 1, s.getLastRow()-1, 15).getValues();
    function sd(v){ return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v||'').slice(0,10); }
    var cash=0, transfer=0, credit=0, total=0, count=0, bills=[];
    rows.forEach(function(r){
      if (sd(r[2]) !== day) return;
      var amt = Number(r[9])||0;
      var m = String(r[10]||'').toUpperCase();
      var bucket;
      if (m.indexOf('CREDIT')>=0 || m.indexOf('เชื่อ')>=0) { credit += amt; bucket='เชื่อ'; }
      else if (m.indexOf('CASH')>=0 || m.indexOf('เงินสด')>=0) { cash += amt; bucket='เงินสด'; }
      else { transfer += amt; bucket='โอน/QR'; }   // QR/TRANSFER/PROMPTPAY
      total += amt; count++;
      bills.push({ saleId:String(r[0]||''), time:String(r[3]||''), customer:String(r[6]||''), total:amt, method:bucket });
    });
    return { ok:true, date:day, count:count, total:total, cash:cash, transfer:transfer, credit:credit, bills:bills };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// ── ประวัติการขายที่เสร็จแล้ว (SALES_HEADER) สำหรับฝั่งร้านดูที่แคชเชียร์ ──
function getSalesHistory(dateStr, limit) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_SALH);
    if (!s || s.getLastRow() <= 1) return { ok:true, items:[], total:0, count:0 };
    var tz = 'Asia/Bangkok';
    function sd(v){ return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v||'').slice(0,10); }
    function st(v){ return v instanceof Date ? Utilities.formatDate(v, tz, 'HH:mm') : String(v||'').slice(0,5); }
    var rows = s.getRange(2, 1, s.getLastRow()-1, 15).getValues();
    var out = rows.map(function(r){
      var m = String(r[10]||'').toUpperCase();
      var mLabel = (m.indexOf('CREDIT')>=0) ? 'เงินเชื่อ' : (m.indexOf('CASH')>=0) ? 'เงินสด' : 'โอน/QR';
      var sid = String(r[0]||'');
      return { saleId:sid, date:sd(r[2]), time:st(r[3]), customer:String(r[6]||'ลูกค้าทั่วไป'),
               total:Number(r[9])||0, method:mLabel, note:String(r[14]||''),
               isAr: sid.indexOf('ARR-')===0 };
    });
    if (dateStr) out = out.filter(function(x){ return x.date === dateStr; });
    out = out.reverse();
    var total = out.reduce(function(t,x){ return t + x.total; }, 0), count = out.length;
    if (limit && out.length > limit) out = out.slice(0, limit);
    return { ok:true, items:out, total:total, count:count };
  } catch(e) { return { ok:false, msg:String(e) }; }
}

// ── ดึงรายการสินค้าของออเดอร์ (ทุกสถานะ) สำหรับพิมพ์ใบจัดสินค้า ──
function getOrderForPick(orderId) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var ordS = ss.getSheetByName(SH_ORD), dtlS = ss.getSheetByName(SH_ORDD);
    if (!ordS || !dtlS) return { ok:false, msg:'ไม่พบ ORDERS' };
    function sd(v){ return v instanceof Date ? Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd') : String(v||''); }
    var hdr = ordS.getDataRange().getValues(), o = null;
    for (var i=1;i<hdr.length;i++){
      if (String(hdr[i][0])===String(orderId)){
        o = { orderId:sd(hdr[i][0]), customerName:sd(hdr[i][8]), total:Number(hdr[i][11])||0,
              status:sd(hdr[i][12]), note:sd(hdr[i][14]) };
        break;
      }
    }
    if (!o) return { ok:false, msg:'ไม่พบออเดอร์ '+orderId };
    o.delivery = /จัดส่ง/.test(o.note) ? 'delivery' : 'pickup';
    var dtl = dtlS.getDataRange().getValues().slice(1);
    o.items = dtl.filter(function(r){ return String(r[0])===String(orderId); })
      .map(function(r){ return { barcode:String(r[2]||''), name:String(r[3]||''), qty:Number(r[4])||0, unit:String(r[5]||'') }; });
    return { ok:true, order:o };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// ── แคชเชียร์ยืนยันชำระ (หลังดูสลิป) → ตั้งสถานะ PAID ──
function setOrderPaid(orderId) {
  try {
    var s = _ordSheet_(); if (!s) return { ok:false, msg:'ไม่พบ ORDERS' };
    var row = _ordRow_(s, orderId); if (row < 0) return { ok:false, msg:'ไม่พบออเดอร์' };
    s.getRange(row, 13).setValue('PAID');
    return { ok:true, orderId:orderId };
  } catch(e) { return { ok:false, msg:String(e) }; }
}

// ── บอร์ดออเดอร์ (POS-PC จัดของ + Cashier รับเงิน) — ตัดที่ DONE ออก ──
function getOrderBoard() {
  try {
    var s = _ordSheet_(); if (!s || s.getLastRow() <= 1) return { ok: true, orders: [] };
    var rows = s.getRange(2, 1, s.getLastRow() - 1, 16).getValues();
    function sd(v){ return v instanceof Date ? Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd') : String(v || ''); }
    function st(v){ return v instanceof Date ? Utilities.formatDate(v, 'Asia/Bangkok', 'HH:mm') : String(v || '').slice(0,5); }
    var out = rows.map(function(r) {
      var note = String(r[14] || '');
      var mSlip = note.match(/SLIP:(\S+)/);
      var mAmt  = note.match(/สลิปยอด:([\d.]+)/);
      return {
        orderId:      sd(r[0]),
        date:         sd(r[2]), time: st(r[3]),
        source:       sd(r[4]),                       // POS / LINE OA
        customerName: sd(r[8]),
        total:        Number(r[11]) || 0,
        payStatus:    sd(r[12]) || 'PENDING',         // PENDING / PAID
        fulfill:      String(r[15] || 'NEW') || 'NEW',// NEW/PREPARING/READY/DONE
        delivery:     /จัดส่ง/.test(note) ? 'delivery' : 'pickup',
        slipUrl:      mSlip ? mSlip[1] : '',
        slipAmt:      mAmt ? Number(mAmt[1]) : 0,
        note:         note
      };
    }).filter(function(o){ return o.fulfill !== 'DONE'; });
    return { ok: true, orders: out.reverse() };
  } catch(e) { return { ok: false, msg: String(e) }; }
}

// ── ลูกค้า LINE ดูสถานะออเดอร์ตัวเอง (จับด้วย lineUid หรือเบอร์ ใน NOTE) ──
function lineGetMyOrders(lineUid, phone) {
  try {
    var s = _ordSheet_(); if (!s || s.getLastRow() <= 1) return { ok: true, orders: [] };
    var rows = s.getRange(2, 1, s.getLastRow() - 1, 16).getValues();
    function sd(v){ return v instanceof Date ? Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') : String(v || ''); }
    var uid = String(lineUid || ''), ph = String(phone || '').replace(/[^0-9]/g, '');
    var out = rows.filter(function(r) {
      var note = String(r[14] || '');
      if (uid && note.indexOf('UID:' + uid) >= 0) return true;
      if (ph && ph.length >= 6 && note.indexOf(ph) >= 0) return true;
      return false;
    }).map(function(r) {
      var note = String(r[14] || ''), delivery = /จัดส่ง/.test(note) ? 'delivery' : 'pickup';
      var fulfill = String(r[15] || 'NEW') || 'NEW';
      return {
        orderId:     sd(r[0]),
        dateTime:    sd(r[2]) + ' ' + sd(r[3]),
        total:       Number(r[11]) || 0,
        delivery:    delivery,
        fulfill:     fulfill,
        canConfirm:  (fulfill === 'READY'),   // จัดเสร็จ/รอจัดส่ง → ลูกค้ากดยืนยันรับของได้
        statusLabel: lineStatusLabel_(String(r[12] || ''), fulfill, delivery)
      };
    }).reverse();
    return { ok: true, orders: out };
  } catch(e) { return { ok: false, msg: String(e) }; }
}

// ── ลูกค้า LINE กดยืนยันว่าได้รับสินค้าแล้ว → ปิดออเดอร์ (DONE) ──
function lineConfirmReceived(orderId, lineUid, phone) {
  try {
    var s = _ordSheet_(); if (!s) return { ok:false, msg:'ไม่พบ ORDERS' };
    var row = _ordRow_(s, orderId); if (row < 0) return { ok:false, msg:'ไม่พบออเดอร์' };
    var note = String(s.getRange(row, 15).getValue() || '');
    var uid = String(lineUid || ''), ph = String(phone || '').replace(/[^0-9]/g, '');
    var owns = (uid && note.indexOf('UID:' + uid) >= 0) || (ph && ph.length >= 6 && note.indexOf(ph) >= 0);
    if (!owns) return { ok:false, msg:'ออเดอร์นี้ไม่ใช่ของคุณ' };
    return setOrderFulfill(orderId, 'DONE');   // จะ push แจ้งกลุ่ม "ลูกค้ารับสินค้าแล้ว" อัตโนมัติ
  } catch(e) { return { ok:false, msg:String(e) }; }
}
