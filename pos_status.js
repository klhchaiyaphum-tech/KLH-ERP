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
  if (fulfill === 'READY')     return (delivery === 'delivery') ? 'รอจัดส่ง' : 'จัดเสร็จ พร้อมมารับ';
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
    return { ok: true, orderId: orderId, fulfill: fulfill };
  } catch(e) { return { ok: false, msg: String(e) }; }
}

// ── บอร์ดออเดอร์ (POS-PC จัดของ + Cashier รับเงิน) — ตัดที่ DONE ออก ──
function getOrderBoard() {
  try {
    var s = _ordSheet_(); if (!s || s.getLastRow() <= 1) return { ok: true, orders: [] };
    var rows = s.getRange(2, 1, s.getLastRow() - 1, 16).getValues();
    function sd(v){ return v instanceof Date ? Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd') : String(v || ''); }
    var out = rows.map(function(r) {
      var note = String(r[14] || '');
      return {
        orderId:      sd(r[0]),
        date:         sd(r[2]), time: sd(r[3]),
        source:       sd(r[4]),                       // POS / LINE OA
        customerName: sd(r[8]),
        total:        Number(r[11]) || 0,
        payStatus:    sd(r[12]) || 'PENDING',         // PENDING / PAID
        fulfill:      String(r[15] || 'NEW') || 'NEW',// NEW/PREPARING/READY/DONE
        delivery:     /จัดส่ง/.test(note) ? 'delivery' : 'pickup',
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
      return {
        orderId:     sd(r[0]),
        dateTime:    sd(r[2]) + ' ' + sd(r[3]),
        total:       Number(r[11]) || 0,
        delivery:    delivery,
        statusLabel: lineStatusLabel_(String(r[12] || ''), String(r[15] || 'NEW') || 'NEW', delivery)
      };
    }).reverse();
    return { ok: true, orders: out };
  } catch(e) { return { ok: false, msg: String(e) }; }
}
