// ============================================================
//  bank.js — อ่านอีเมลธนาคาร (KTB + กรุงศรี) → BANK_TRANSACTIONS
//  ตามแผน PLAN_Accounting_KLH:
//   • KTB รับเข้า = ฐานยอดขายภาษี (ภพ.30)
//   • กรุงศรี: ยอดที่ตรงกับโอนออก KTB วันเดียวกัน = "โยกเงิน" (ไม่นับขาย)
//  ตั้งค่า CONFIG: BANK_EMAIL_KTB / BANK_EMAIL_BAY (ค่าเริ่มต้นด้านล่าง)
// ============================================================

var SH_BANK  = 'BANK_TRANSACTIONS';
var H_BANK   = ['DATE','BANK','DIRECTION','AMOUNT','CATEGORY','SUBJECT','EMAIL_DATE','MSG_ID','NOTE','ACCOUNT'];
// BANK: KTB=กรุงไทยออมทรัพย์ · BAY=กรุงศรีออมทรัพย์ · BAYC=กรุงศรีกระแสรายวัน
// CATEGORY: SALE/TRANSFER/PAYMENT/EXPENSE/UNKNOWN(รอผู้ใช้ระบุ)
// ACCOUNT: ผังบัญชีค่าใช้จ่าย → ดึงเข้างบกำไรขาดทุน

function bankSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName(SH_BANK);
  if (!s) {
    s = ss.insertSheet(SH_BANK);
    s.getRange(1,1,1,H_BANK.length).setValues([H_BANK])
      .setBackground('#1A237E').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
  } else if (!s.getRange(1, 10).getValue()) {
    s.getRange(1, 10).setValue('ACCOUNT').setBackground('#1A237E').setFontColor('#fff').setFontWeight('bold');
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

    if (added > 0) {
      var alerts = categorizeBankTxns_();
      if (alerts.length) sendWmsLine_('🔔 ตรวจอีเมลธนาคาร:\n' + alerts.slice(0, 10).join('\n――――\n'));
    }
    return { ok: true, added: added, skipped: skipped, msg: 'บันทึกใหม่ ' + added + ' รายการ (ซ้ำ ' + skipped + ')' };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── จัดประเภทตามผังเงิน 5 ข้อ + คืนรายการที่ต้องเตือน ──────────────
// 1) KTB IN = ยอดขาย KLH ทั้งหมด
// 2) KTB OUT จับคู่ BAY IN (statement) = โยกเงิน · ไม่ตรง = ค่าใช้จ่ายธนาคาร (เตือน)
// 3) BAY IN จากอีเมล = PromptPay ลูกค้า = SALE (โดนค่าธรรมเนียม 0.5% → เตือนตามตัวลูกค้า)
//    BAY OUT จับคู่ BAYC IN = โยกเงินภายใน · ไม่ตรง = ค่าใช้จ่าย เช่น ค่าน้ำ (เตือน)
// 4) BAYC IN จับคู่ BAY OUT = โยกเงิน · BAYC OUT ที่เหลือ = ชำระหนี้/ค่าใช้จ่าย (ต้องระบุ)
function categorizeBankTxns_() {
  var s = bankSheet_();
  if (s.getLastRow() <= 1) return [];
  var rows = s.getDataRange().getValues();
  var alerts = [];

  function matched(date, bank, dir, amt) {
    for (var j = 1; j < rows.length; j++) {
      if (String(rows[j][0]) === date && rows[j][1] === bank && rows[j][2] === dir
          && Math.abs(Number(rows[j][3]) - amt) < 1) return true;
    }
    return false;
  }

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][4]) continue;   // จัดประเภทแล้ว
    var date = String(rows[i][0]), bank = rows[i][1], dir = rows[i][2], amt = Number(rows[i][3]);
    var subj = String(rows[i][5] || ''), src = String(rows[i][7] || '');
    var fromEmail = src.indexOf('MANUAL') < 0 && src.indexOf('STMT') < 0;
    var cat = '';

    if (bank === 'KTB') {
      if (dir === 'IN') cat = 'SALE';                                   // ข้อ 1
      else {                                                            // ข้อ 2
        if (matched(date, 'BAY', 'IN', amt)) cat = 'TRANSFER';
        else { cat = 'EXPENSE';
          alerts.push('🟦 KTB เงินออก ฿' + amt.toLocaleString() + ' (' + date + ') ไม่ตรงยอดเข้า กรุงศรี → น่าจะค่าธรรมเนียม/ค่าบัญชีพิเศษ — เช็คในสมุดเงินธนาคาร'); }
      }
    } else if (bank === 'BAY') {
      if (dir === 'IN') {
        if (fromEmail || /promptpay|พร้อมเพย์/i.test(subj)) {           // ข้อ 3 อีเมล = PromptPay ลูกค้า
          cat = 'SALE';
          alerts.push('🟧 ลูกค้าโอน PromptPay เข้า กรุงศรี ฿' + amt.toLocaleString() + ' (' + date + ')\n→ เสียค่าธรรมเนียม 0.5% ≈ ฿' + (amt*0.005).toFixed(2) + ' — หาว่าลูกค้ารายไหน แจ้งให้โอนเข้า กรุงไทย แทน');
        } else if (matched(date, 'KTB', 'OUT', amt)) cat = 'TRANSFER';
        else { cat = 'UNKNOWN';
          alerts.push('🟧 กรุงศรีออมทรัพย์ เงินเข้า ฿' + amt.toLocaleString() + ' (' + date + ') ไม่ตรงโยกเงิน — ลูกค้าโอน? ไประบุในสมุดเงินธนาคาร'); }
      } else {                                                          // BAY OUT
        if (matched(date, 'BAYC', 'IN', amt)) cat = 'TRANSFER';
        else { cat = 'EXPENSE';
          alerts.push('🟧 กรุงศรีออมทรัพย์ เงินออก ฿' + amt.toLocaleString() + ' (' + date + ') ไม่ตรงเข้ากระแสรายวัน — ค่าน้ำประปา/ค่าใช้จ่ายอื่น? ไประบุผังบัญชี'); }
      }
    } else if (bank === 'BAYC') {                                       // ข้อ 4
      if (dir === 'IN') {
        if (matched(date, 'BAY', 'OUT', amt)) cat = 'TRANSFER';
        else cat = 'UNKNOWN';
      } else { cat = 'PAYMENT';
        if (!String(rows[i][8] || '')) alerts.push('🟥 กรุงศรีกระแสฯ จ่ายออก ฿' + amt.toLocaleString() + ' (' + date + ') — ระบุว่าชำระหนี้ใคร/ค่าอะไร + ผังบัญชี ในสมุดเงินธนาคาร'); }
    } else {
      cat = dir === 'IN' ? 'SALE' : 'PAYMENT';
    }
    s.getRange(i+1, 5).setValue(cat);
  }
  return alerts;
}

// ════════════════════════════════════════════════════════════
//  นำเข้า statement กรุงศรี (ออมทรัพย์/กระแสรายวัน) จากโฟลเดอร์ Drive
//  รองรับ .csv / .xlsx / Google Sheet · สแกนทุกคืน 23:00 อัตโนมัติ
//  วางไฟล์ในโฟลเดอร์ "BANK_STATEMENTS" (ระบบสร้างให้ + ย้ายไป "นำเข้าแล้ว" เมื่อเสร็จ)
//  ชื่อไฟล์มีคำว่า "กระแส" หรือ "current" หรือ "BAYC" = บัญชีกระแสรายวัน, อื่นๆ = ออมทรัพย์
// ════════════════════════════════════════════════════════════
function stmtFolder_() {
  var cfg = getConfig();
  if (cfg.STATEMENT_FOLDER_ID) { try { return DriveApp.getFolderById(String(cfg.STATEMENT_FOLDER_ID).trim()); } catch(e) {} }
  var it = DriveApp.getFoldersByName('BANK_STATEMENTS');
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder('BANK_STATEMENTS');
}

function importBayStatements() {
  try {
    var folder = stmtFolder_();
    var doneIt = folder.getFoldersByName('นำเข้าแล้ว');
    var done = doneIt.hasNext() ? doneIt.next() : folder.createFolder('นำเข้าแล้ว');
    var s = bankSheet_();
    var seen = {};
    if (s.getLastRow() > 1) s.getRange(2, 8, s.getLastRow()-1, 1).getValues().forEach(function(r){ if (r[0]) seen[String(r[0])] = 1; });

    var files = folder.getFiles();
    var imported = 0, fileCount = 0, errs = [];
    while (files.hasNext()) {
      var f = files.next();
      var name = f.getName();
      var bankCode = /กระแส|current|BAYC/i.test(name) ? 'BAYC' : 'BAY';
      var grid = null, tempId = null;
      try {
        var mime = f.getMimeType();
        if (mime === MimeType.CSV || /\.csv$/i.test(name)) {
          grid = Utilities.parseCsv(f.getBlob().getDataAsString('UTF-8'));
        } else if (mime === MimeType.GOOGLE_SHEETS) {
          grid = SpreadsheetApp.openById(f.getId()).getSheets()[0].getDataRange().getValues();
        } else if (/\.xlsx?$/i.test(name) || mime === MimeType.MICROSOFT_EXCEL) {
          var conv = Drive.Files.create({ name: 'tmp_stmt', mimeType: 'application/vnd.google-apps.spreadsheet' }, f.getBlob());
          tempId = conv.id;
          grid = SpreadsheetApp.openById(tempId).getSheets()[0].getDataRange().getValues();
        } else { continue; }   // ข้ามไฟล์ชนิดอื่น

        var n = parseStatementGrid_(grid, bankCode, name, s, seen);
        imported += n; fileCount++;
        f.moveTo(done);
      } catch(e) { errs.push(name + ': ' + e.message); }
      finally { if (tempId) { try { DriveApp.getFileById(tempId).setTrashed(true); } catch(e2) {} } }
    }

    var alerts = imported > 0 ? categorizeBankTxns_() : [];
    if (alerts.length) sendWmsLine_('🏦 ตรวจ statement กรุงศรี:\n' + alerts.slice(0, 10).join('\n――――\n'));
    return { ok: errs.length === 0, files: fileCount, imported: imported,
             msg: 'นำเข้า ' + fileCount + ' ไฟล์ / ' + imported + ' รายการ' + (errs.length ? ' · ผิดพลาด: ' + errs.join(' | ') : '') };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// หา header แล้วอ่านแถว: วันที่ / ถอน(เดบิต) / ฝาก(เครดิต) / รายละเอียด
function parseStatementGrid_(grid, bankCode, fileName, s, seen) {
  var hRow = -1, cDate = -1, cOut = -1, cIn = -1, cDesc = -1;
  for (var i = 0; i < Math.min(grid.length, 15); i++) {
    for (var j = 0; j < grid[i].length; j++) {
      var h = String(grid[i][j] || '').toLowerCase();
      if (cDate < 0 && /วันที่|date/.test(h)) { hRow = i; cDate = j; }
      if (/ถอน|withdraw|debit|จ่าย/.test(h)) cOut = j;
      if (/ฝาก|deposit|credit|รับ/.test(h))  cIn = j;
      if (/รายละเอียด|รายการ|desc/.test(h))  cDesc = j;
    }
    if (hRow >= 0 && (cOut >= 0 || cIn >= 0)) break;
  }
  if (hRow < 0 || cDate < 0) throw new Error('หา header วันที่/ฝาก/ถอน ไม่เจอ');

  var count = 0;
  for (var r = hRow + 1; r < grid.length; r++) {
    var dRaw = grid[r][cDate];
    if (!dRaw) continue;
    var d = parseThaiDate_(dRaw);
    if (!d) continue;
    var amtIn  = cIn  >= 0 ? Number(String(grid[r][cIn]).replace(/[, ]/g, ''))  || 0 : 0;
    var amtOut = cOut >= 0 ? Number(String(grid[r][cOut]).replace(/[, ]/g, '')) || 0 : 0;
    var desc = cDesc >= 0 ? String(grid[r][cDesc] || '').slice(0, 120) : '';
    var pair = amtIn > 0 ? [['IN', amtIn]] : [];
    if (amtOut > 0) pair.push(['OUT', amtOut]);
    pair.forEach(function(p) {
      var key = 'STMT-' + bankCode + '-' + d + '-' + p[0] + '-' + p[1] + '-' + desc.slice(0, 20);
      if (seen[key]) return;
      s.appendRow([d, bankCode, p[0], p[1], '', desc || ('statement: ' + fileName),
                   Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), key, '', '']);
      seen[key] = 1; count++;
    });
  }
  return count;
}

// dd/mm/yyyy (รองรับ พ.ศ.) หรือ Date object → 'yyyy-MM-dd'
function parseThaiDate_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd');
  var m = String(v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) return null;
  var y = Number(m[3]); if (y < 100) y += 2500;
  if (y > 2400) y -= 543;
  return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}

// ตั้ง trigger สแกนโฟลเดอร์ทุกคืน 23:00 (รันครั้งเดียวใน Editor)
function setupDailyStatementTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'importBayStatements') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('importBayStatements').timeBased().everyDays(1).atHour(23).create();
  var folder = stmtFolder_();
  return 'ตั้งสแกน statement ทุกคืน 23:00 แล้ว · โฟลเดอร์: ' + folder.getName() + ' (id: ' + folder.getId() + ')';
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
          subject: String(rows[i][5] || ''), note: String(rows[i][8] || ''),
          account: String(rows[i][9] || '')
        });
      }
    }
    out.sort(function(a, b) { return a.date < b.date ? 1 : -1; });
    return { ok: true, month: ym, txns: out };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// แก้หมวด + หมายเหตุ + ผังบัญชี (ชำระหนี้ใคร / ค่าใช้จ่ายอะไร)
function updateBankTxn(row, cat, note, account) {
  try {
    var s = bankSheet_();
    if (row < 2 || row > s.getLastRow()) return { ok: false, msg: 'แถวไม่ถูกต้อง' };
    s.getRange(row, 5).setValue(String(cat || ''));
    s.getRange(row, 9).setValue(String(note || ''));
    s.getRange(row, 10).setValue(String(account || ''));
    return { ok: true };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ค่าใช้จ่ายจากธนาคาร แยกตามผังบัญชี (ดึงเข้างบกำไรขาดทุน — ผังเงินข้อ 5)
function getBankExpenses(yyyymm) {
  try {
    var ym = yyyymm || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
    var s = bankSheet_();
    var by = {}, total = 0, unspecified = 0;
    if (s.getLastRow() > 1) {
      s.getDataRange().getValues().slice(1).forEach(function(r) {
        var d = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]);
        if (d.slice(0, 7) !== ym) return;
        var cat = String(r[4] || '');
        if (cat !== 'EXPENSE' && cat !== 'PAYMENT') return;
        var amt = Number(r[3]) || 0;
        var acc = String(r[9] || '').trim();
        if (!acc) { acc = cat === 'PAYMENT' ? 'ชำระเจ้าหนี้ (ยังไม่ระบุ)' : 'ค่าใช้จ่ายอื่น (ยังไม่ระบุ)'; unspecified += amt; }
        by[acc] = (by[acc] || 0) + amt;
        total += amt;
      });
    }
    var rows = [];
    for (var k in by) rows.push({ account: k, amount: by[k] });
    rows.sort(function(a, b) { return b.amount - a.amount; });
    return { ok: true, month: ym, total: total, unspecified: unspecified, rows: rows };
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
