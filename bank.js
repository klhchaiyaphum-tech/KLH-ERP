// ============================================================
//  bank.js — อ่านอีเมลธนาคาร (KTB + กรุงศรี) → BANK_TRANSACTIONS
//  ตามแผน PLAN_Accounting_KLH:
//   • KTB รับเข้า = ฐานยอดขายภาษี (ภพ.30)
//   • กรุงศรี: ยอดที่ตรงกับโอนออก KTB วันเดียวกัน = "โยกเงิน" (ไม่นับขาย)
//  ตั้งค่า CONFIG: BANK_EMAIL_KTB / BANK_EMAIL_BAY (ค่าเริ่มต้นด้านล่าง)
// ============================================================

var SH_BANK  = 'BANK_TRANSACTIONS';
var H_BANK   = ['DATE','BANK','DIRECTION','AMOUNT','CATEGORY','SUBJECT','EMAIL_DATE','MSG_ID','NOTE'];

function bankSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName(SH_BANK);
  if (!s) {
    s = ss.insertSheet(SH_BANK);
    s.getRange(1,1,1,H_BANK.length).setValues([H_BANK])
      .setBackground('#1A237E').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}

// ดึงยอดเงินจากข้อความ (รองรับ "จำนวนเงิน 1,234.56 บาท" / "THB 1,234.56" / "1,234.56 บาท")
function extractAmount_(text) {
  var m = String(text).match(/(?:จำนวนเงิน|ยอดเงิน|amount|THB|฿)[^0-9]{0,12}([0-9,]+\.?[0-9]{0,2})/i)
       || String(text).match(/([0-9][0-9,]{2,})\.([0-9]{2})\s*(?:บาท|THB)/i);
  if (!m) return 0;
  var s = m[2] !== undefined ? (m[1] + '.' + m[2]) : m[1];
  return parseFloat(String(s).replace(/,/g, '')) || 0;
}

function isIncoming_(text) {
  var t = String(text);
  if (/(เงินเข้า|รับโอน|รับเงิน|ได้รับ|credit|deposit|incoming)/i.test(t)) return true;
  if (/(เงินออก|โอนออก|ถอน|ชำระ|จ่าย|debit|withdraw|outgoing)/i.test(t)) return false;
  return true; // อีเมลแจ้งเตือนส่วนใหญ่เป็นเงินเข้า
}

// อ่านอีเมลธนาคารย้อนหลัง N วัน → เขียน BANK_TRANSACTIONS (กันซ้ำด้วย MSG_ID)
function fetchBankEmails(daysBack) {
  try {
    daysBack = Number(daysBack) || 3;
    var cfg = getConfig();
    var ktbFrom = String(cfg.BANK_EMAIL_KTB || 'krungthai.com').trim();
    var bayFrom = String(cfg.BANK_EMAIL_BAY || 'krungsri.com').trim();
    var s = bankSheet_();

    // msg ids ที่บันทึกแล้ว (กันซ้ำ)
    var seen = {};
    if (s.getLastRow() > 1) {
      s.getRange(2, 8, s.getLastRow()-1, 1).getValues().forEach(function(r){ if (r[0]) seen[String(r[0])] = 1; });
    }

    var since = Utilities.formatDate(new Date(Date.now() - daysBack*86400000), 'Asia/Bangkok', 'yyyy/MM/dd');
    var added = 0, skipped = 0;
    [[ktbFrom, 'KTB'], [bayFrom, 'BAY']].forEach(function(pair) {
      var threads = GmailApp.search('from:' + pair[0] + ' after:' + since, 0, 50);
      threads.forEach(function(th) {
        th.getMessages().forEach(function(msg) {
          var id = msg.getId();
          if (seen[id]) { skipped++; return; }
          var subject = msg.getSubject() || '';
          var body = '';
          try { body = msg.getPlainBody().slice(0, 3000); } catch(e) {}
          var amt = extractAmount_(subject + '\n' + body);
          if (amt <= 0) return;                              // ข้ามอีเมลที่ไม่มียอดเงิน
          var dir = isIncoming_(subject + ' ' + body) ? 'IN' : 'OUT';
          s.appendRow([
            Utilities.formatDate(msg.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd'),
            pair[1], dir, amt, '', subject.slice(0, 120),
            Utilities.formatDate(msg.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'),
            id, ''
          ]);
          seen[id] = 1; added++;
        });
      });
    });

    if (added > 0) categorizeBankTxns_();
    return { ok: true, added: added, skipped: skipped, msg: 'บันทึกใหม่ ' + added + ' รายการ (ซ้ำ ' + skipped + ')' };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// จับคู่ "โยกเงิน": KTB OUT กับ BAY IN ยอดเท่ากัน วันเดียวกัน → ไม่นับเป็นขาย
function categorizeBankTxns_() {
  var s = bankSheet_();
  if (s.getLastRow() <= 1) return;
  var rows = s.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][4]) continue;                                 // จัดประเภทแล้ว
    var date = String(rows[i][0]), bank = rows[i][1], dir = rows[i][2], amt = Number(rows[i][3]);
    var cat = '';
    if (bank === 'BAY' && dir === 'IN') {
      for (var j = 1; j < rows.length; j++) {
        if (String(rows[j][0]) === date && rows[j][1] === 'KTB' && rows[j][2] === 'OUT'
            && Math.abs(Number(rows[j][3]) - amt) < 1) { cat = 'TRANSFER'; break; }
      }
      if (!cat) cat = 'SALE';
    } else if (dir === 'IN') cat = 'SALE';
    else cat = 'PAYMENT';
    s.getRange(i+1, 5).setValue(cat);
  }
}

// สรุปยอดธนาคารรายเดือน (ใช้ในหน้า ภพ.30) — ยอดขายฐานภาษี = IN ที่ไม่ใช่ TRANSFER
function getBankSummary(yyyymm) {
  try {
    var ym = yyyymm || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
    var s = bankSheet_();
    var out = { ok: true, month: ym, ktbIn: 0, bayIn: 0, transfer: 0, payment: 0, salesBase: 0, count: 0 };
    if (s.getLastRow() <= 1) return out;
    s.getDataRange().getValues().slice(1).forEach(function(r) {
      if (String(r[0]).slice(0, 7) !== ym) return;
      var bank = r[1], dir = r[2], amt = Number(r[3]) || 0, cat = r[4];
      out.count++;
      if (cat === 'TRANSFER') { out.transfer += amt; return; }
      if (dir === 'IN') {
        if (bank === 'KTB') out.ktbIn += amt; else out.bayIn += amt;
        if (cat === 'SALE') out.salesBase += amt;
      } else out.payment += amt;
    });
    return out;
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// รายวัน 06:00: ดึงอีเมล + สรุปส่ง LINE (ตาม blueprint ในชีต)
function dailyBankJob() {
  var res = fetchBankEmails(2);
  var ym = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
  var sum = getBankSummary(ym);
  if (sum.ok) {
    sendWmsLine_('🏦 รายงานยอดเงินธนาคาร (' + ym + ' สะสม)\n'
      + '🟦 KTB เข้า: ฿' + Math.round(sum.ktbIn).toLocaleString() + '\n'
      + '🟧 กรุงศรี เข้า: ฿' + Math.round(sum.bayIn).toLocaleString() + '\n'
      + '🔁 โยกเงิน (ไม่นับขาย): ฿' + Math.round(sum.transfer).toLocaleString() + '\n'
      + '💰 ฐานยอดขายภาษี: ฿' + Math.round(sum.salesBase).toLocaleString()
      + (res.added ? '\n(อีเมลใหม่ ' + res.added + ' ฉบับ)' : ''));
  }
  return res;
}

// ════════════════════════════════════════════════════════════
//  หน้าสมุดเงินธนาคาร (?page=bank) — ดู/แก้/เพิ่ม BANK_TRANSACTIONS
//  CATEGORY: SALE=ยอดขาย · TRANSFER=โยกเงิน · PAYMENT=ชำระหนี้ · EXPENSE=ค่าใช้จ่าย
// ════════════════════════════════════════════════════════════

// รายการเดือนนั้น พร้อมเลขแถวจริง (ไว้แก้ไขกลับ)
function getBankTxns(yyyymm) {
  try {
    var ym = yyyymm || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
    var s = bankSheet_();
    var out = [];
    if (s.getLastRow() > 1) {
      var rows = s.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        var d = rows[i][0] instanceof Date
          ? Utilities.formatDate(rows[i][0], 'Asia/Bangkok', 'yyyy-MM-dd')
          : String(rows[i][0]);
        if (d.slice(0, 7) !== ym) continue;
        out.push({
          row: i + 1, date: d,
          bank: String(rows[i][1] || ''), dir: String(rows[i][2] || ''),
          amount: Number(rows[i][3]) || 0, cat: String(rows[i][4] || ''),
          subject: String(rows[i][5] || ''), note: String(rows[i][8] || '')
        });
      }
    }
    out.sort(function(a, b) { return a.date < b.date ? 1 : -1; });
    return { ok: true, month: ym, txns: out };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// แก้หมวด + หมายเหตุ (ชำระหนี้ใคร / ค่าใช้จ่ายอะไร)
function updateBankTxn(row, cat, note) {
  try {
    var s = bankSheet_();
    if (row < 2 || row > s.getLastRow()) return { ok: false, msg: 'แถวไม่ถูกต้อง' };
    s.getRange(row, 5).setValue(String(cat || ''));
    s.getRange(row, 9).setValue(String(note || ''));
    return { ok: true };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// เพิ่มรายการมือ (คีย์จาก statement เองได้)
function addBankTxn(d) {
  try {
    if (!d || !d.date || !(Number(d.amount) > 0)) return { ok: false, msg: 'กรอกวันที่และยอดเงิน' };
    var s = bankSheet_();
    s.appendRow([String(d.date), String(d.bank || 'KTB'), String(d.dir || 'IN'),
                 Number(d.amount), String(d.cat || ''), String(d.subject || 'คีย์มือ'),
                 Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'),
                 'MANUAL-' + Date.now(), String(d.note || '')]);
    categorizeBankTxns_();
    return { ok: true };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

function deleteBankTxn(row) {
  try {
    var s = bankSheet_();
    if (row < 2 || row > s.getLastRow()) return { ok: false, msg: 'แถวไม่ถูกต้อง' };
    s.deleteRow(row);
    return { ok: true };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// จับคู่โยกเงินใหม่ทั้งเดือน (หลังแก้ข้อมูล)
function recategorizeBank() {
  try { categorizeBankTxns_(); return { ok: true }; }
  catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── DEBUG: สแกนหาอีเมลธนาคารจริง 14 วัน — รันใน GAS Editor แล้วดู Log ──
// ใช้ปรับ BANK_EMAIL_KTB / BANK_EMAIL_BAY และ regex ให้ตรงรูปแบบจริง
function debugBankEmails() {
  var queries = [
    'from:krungthai.com', 'from:ktb.co.th', 'from:krungsri.com', 'from:bay.co.th',
    'กรุงไทย', 'กรุงศรี', 'Krungthai', 'Krungsri', 'เงินเข้า', 'รับโอนเงิน'
  ];
  var since = Utilities.formatDate(new Date(Date.now() - 14*86400000), 'Asia/Bangkok', 'yyyy/MM/dd');
  var out = [];
  queries.forEach(function(q) {
    try {
      var threads = GmailApp.search(q + ' after:' + since, 0, 5);
      threads.forEach(function(th) {
        var m = th.getMessages()[0];
        var body = ''; try { body = m.getPlainBody().slice(0, 200).replace(/\s+/g, ' '); } catch(e) {}
        var att = 0; try { att = m.getAttachments().length; } catch(e) {}
        out.push('Q[' + q + '] FROM: ' + m.getFrom()
          + '\n  SUBJ: ' + m.getSubject()
          + '\n  ATT: ' + att + ' | AMT-PARSE: ' + extractAmount_(m.getSubject() + ' ' + body)
          + '\n  BODY: ' + body.slice(0, 150));
      });
    } catch(e) { out.push('Q[' + q + '] ERROR: ' + e); }
  });
  var txt = out.length ? out.join('\n----------------\n') : 'ไม่พบอีเมลธนาคารใน 14 วัน — เช็คว่า Gmail บัญชีนี้รับอีเมลแจ้งเตือนธนาคารหรือไม่';
  Logger.log(txt);
  return txt;
}

// ตั้ง trigger รายวัน 06:00 (รันครั้งเดียวใน GAS Editor)
function setupDailyBankTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'dailyBankJob') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyBankJob').timeBased().everyDays(1).atHour(6).create();
  return 'ตั้ง trigger อ่านอีเมลธนาคารทุกวัน 06:00 แล้ว';
}
