// ============================================================
//  ap_payable.js — เจ้าหนี้การค้า (AP): คงค้าง · ครบกำหนด · บันทึกจ่าย · ประวัติ
//  AP_LEDGER: 0 AP_ID · 1 RECV_NO · 2 SUPPLIER_CODE · 3 SUPPLIER_NAME · 4 ENTITY
//             5 INVOICE_DATE · 6 DUE_DATE · 7 TOTAL · 8 PAID · 9 BALANCE · 10 STATUS · 11 NOTE
//  AP_PAYMENT: PAY_ID · DATE · SUPPLIER_CODE · SUPPLIER_NAME · AP_ID · AMOUNT · BANK · ACCOUNT · REF · NOTE
// ============================================================
var AP_SHEET = 'AP_LEDGER';
var APP_SHEET = 'AP_PAYMENT';
var APP_HEAD = ['PAY_ID','DATE','SUPPLIER_CODE','SUPPLIER_NAME','AP_ID','AMOUNT','BANK','ACCOUNT','REF','NOTE'];

function apPaySheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName(APP_SHEET);
  if (!s) { s = ss.insertSheet(APP_SHEET);
    s.getRange(1,1,1,APP_HEAD.length).setValues([APP_HEAD]).setFontWeight('bold').setBackground('#1A237E').setFontColor('#fff');
    s.setFrozenRows(1);
  }
  return s;
}
function apDs_(v){ return v instanceof Date ? Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd') : String(v||'').slice(0,10); }
// วันเริ่มระบบเจ้าหนี้ (cutover) — บิลก่อนวันนี้ไม่นับคงค้าง · ตั้งใน CONFIG.AP_START_DATE ได้
function apStartDate_(){ try { var c=getConfig(); return c.AP_START_DATE || '2026-07-01'; } catch(e){ return '2026-07-01'; } }

// เจ้าหนี้คงค้าง รวมตามผู้ขาย (+ ใกล้ครบ/เกินกำหนด)
function apGetPayables() {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(AP_SHEET);
    if (!s || s.getLastRow() <= 1) return { ok:true, items:[], total:0, overdue:0 };
    var today = Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd');
    var cutover = apStartDate_();
    var rows = s.getRange(2,1,s.getLastRow()-1,12).getValues();
    var map = {};
    rows.forEach(function(r){
      var bal = Number(r[9])||0; if (bal<=0) return;
      if (apDs_(r[5]) < cutover) return;   // บิลก่อน cutover ไม่นับคงค้าง
      var code = String(r[2]||'') || ('?'+String(r[3]||''));
      var m = map[code] || (map[code]={ code:String(r[2]||''), name:String(r[3]||''), balance:0, bills:0, nearestDue:'', overdue:0 });
      m.balance += bal; m.bills++;
      var due = apDs_(r[6]);
      if (!m.nearestDue || (due && due < m.nearestDue)) m.nearestDue = due;
      if (due && due < today) m.overdue += bal;
    });
    var items = Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return b.balance-a.balance;});
    var total = items.reduce(function(t,x){return t+x.balance;},0);
    var overdue = items.reduce(function(t,x){return t+x.overdue;},0);
    return { ok:true, items:items, total:total, overdue:overdue, count:items.length };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// บิลค้างของผู้ขายรายตัว
function apSupplierBills(code) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(AP_SHEET);
    if (!s || s.getLastRow() <= 1) return { ok:true, items:[] };
    var cutover = apStartDate_();
    var rows = s.getRange(2,1,s.getLastRow()-1,12).getValues();
    var items = rows.filter(function(r){ return String(r[2])===String(code) && (Number(r[9])||0)>0 && apDs_(r[5])>=cutover; })
      .map(function(r){ return { apId:String(r[0]||''), recvNo:String(r[1]||''), invoiceDate:apDs_(r[5]),
        dueDate:apDs_(r[6]), total:Number(r[7])||0, paid:Number(r[8])||0, balance:Number(r[9])||0,
        status:String(r[10]||''), invoiceNo:String(r[11]||'') }; });
    return { ok:true, items:items };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// บันทึกจ่ายเจ้าหนี้ → ตัด AP_LEDGER + ลง AP_PAYMENT
function apPay(apId, amount, bank, account, ref, note) {
  try {
    var amt = Number(amount)||0; if (amt<=0) return { ok:false, msg:'จำนวนเงินไม่ถูกต้อง' };
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var s = ss.getSheetByName(AP_SHEET); if (!s) return { ok:false, msg:'ไม่พบ AP_LEDGER' };
    var rows = s.getDataRange().getValues();
    for (var i=1;i<rows.length;i++){
      if (String(rows[i][0])===String(apId)){
        var paid = (Number(rows[i][8])||0) + amt;
        var bal  = (Number(rows[i][7])||0) - paid;
        var st   = bal<=0 ? 'PAID' : 'PARTIAL';
        s.getRange(i+1,9).setValue(paid);
        s.getRange(i+1,10).setValue(Math.max(0,bal));
        s.getRange(i+1,11).setValue(st);
        var pay = apPaySheet_();
        pay.appendRow(['APP-'+Utilities.formatDate(new Date(),'Asia/Bangkok','yyyyMMdd-HHmmss'),
          Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd HH:mm'),
          String(rows[i][2]||''), String(rows[i][3]||''), apId, amt,
          String(bank||''), String(account||''), String(ref||''), String(note||'')]);
        return { ok:true, msg:'จ่าย '+apId+' ฿'+amt+' | คงเหลือ ฿'+Math.max(0,bal), balance:Math.max(0,bal) };
      }
    }
    return { ok:false, msg:'ไม่พบบิล '+apId };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// ประวัติจ่ายรายผู้ขาย (หรือทั้งหมดถ้า code ว่าง)
function apPayHistory(code) {
  try {
    var s = apPaySheet_(); if (s.getLastRow()<=1) return { ok:true, items:[] };
    var rows = s.getRange(2,1,s.getLastRow()-1,APP_HEAD.length).getValues();
    var items = rows.filter(function(r){ return !code || String(r[2])===String(code); })
      .map(function(r){ return { payId:String(r[0]), date:apDs_(r[1]), code:String(r[2]), name:String(r[3]),
        apId:String(r[4]), amount:Number(r[5])||0, bank:String(r[6]), account:String(r[7]), ref:String(r[8]), note:String(r[9]) }; })
      .reverse();
    return { ok:true, items:items };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// แจ้งเตือนครบกำหนดเจ้าหนี้ (สำหรับ Dashboard) — ใกล้ครบ ≤7วัน / ครบวันนี้ / เกินกำหนด
function apAlerts() {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(AP_SHEET);
    var empty = { ok:true, overdue:[], dueToday:[], dueSoon:[], overdueAmt:0, dueTodayAmt:0, dueSoonAmt:0 };
    if (!s || s.getLastRow()<=1) return empty;
    var tz='Asia/Bangkok', today=Utilities.formatDate(new Date(),tz,'yyyy-MM-dd');
    var cutover=apStartDate_();
    var overdue=[], dueToday=[], dueSoon=[];
    s.getRange(2,1,s.getLastRow()-1,12).getValues().forEach(function(r){
      var bal=Number(r[9])||0; if(bal<=0) return;
      if(apDs_(r[5]) < cutover) return;
      var due=apDs_(r[6]); if(!due) return;
      var diff=Math.round((new Date(due+'T00:00:00')-new Date(today+'T00:00:00'))/86400000);
      if(isNaN(diff)) return;
      var it={ apId:String(r[0]), supplier:String(r[3]), dueDate:due, balance:bal, daysLeft:diff };
      if(diff<0) overdue.push(it); else if(diff===0) dueToday.push(it); else if(diff<=7) dueSoon.push(it);
    });
    function sum(a){ return a.reduce(function(t,x){return t+x.balance;},0); }
    return { ok:true, overdue:overdue, dueToday:dueToday, dueSoon:dueSoon,
             overdueAmt:sum(overdue), dueTodayAmt:sum(dueToday), dueSoonAmt:sum(dueSoon) };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// ── เตือนเจ้าหนี้ใกล้ครบ (≤7วัน) / ครบวันนี้ / เกินกำหนด เข้า LINE (ส่งเฉพาะมีรายการ) ──
function apDueReminder() {
  try {
    var a = apAlerts(); if (!a || !a.ok) return 'apAlerts error';
    var total = a.overdue.length + a.dueToday.length + a.dueSoon.length;
    if (total === 0) return 'ไม่มีเจ้าหนี้ใกล้ครบ/เกินกำหนด — ไม่ส่ง';
    var rnd = function(n){ return Math.round(Number(n)||0).toLocaleString(); };
    var msg = '🔔 เตือนชำระเจ้าหนี้ ('+Utilities.formatDate(new Date(),'Asia/Bangkok','dd/MM/yyyy')+')\n――――――――\n';
    function block(title, arr, amt, fmt){
      if (!arr.length) return '';
      var s = title+' '+arr.length+' บิล · ฿'+rnd(amt)+'\n';
      arr.slice(0,8).forEach(function(x){ s += '  • '+x.supplier+' ฿'+rnd(x.balance)+fmt(x)+'\n'; });
      if (arr.length>8) s += '  … และอีก '+(arr.length-8)+' บิล\n';
      return s;
    }
    msg += block('🔴 เกินกำหนด', a.overdue, a.overdueAmt, function(x){ return ' (เกิน '+(-x.daysLeft)+'ว.)'; });
    msg += block('🟠 ครบวันนี้', a.dueToday, a.dueTodayAmt, function(){ return ''; });
    msg += block('🟡 ใกล้ครบ (≤7วัน)', a.dueSoon, a.dueSoonAmt, function(x){ return ' (อีก '+x.daysLeft+'ว.)'; });
    sendWmsLine_(msg);
    return 'ส่งเตือนแล้ว: เกิน '+a.overdue.length+' · วันนี้ '+a.dueToday.length+' · ใกล้ครบ '+a.dueSoon.length;
  } catch(e){ return 'error: '+e; }
}
// ตั้ง trigger เตือนเจ้าหนี้ทุกวัน 09:00 (รันครั้งเดียวใน editor)
function setupApDueTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction()==='apDueReminder') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('apDueReminder').timeBased().everyDays(1).atHour(9).create();
  return 'ตั้งเตือนเจ้าหนี้ครบกำหนดทุกวัน 09:00 แล้ว (ส่งเฉพาะวันที่มีบิลใกล้ครบ/เกิน)';
}
