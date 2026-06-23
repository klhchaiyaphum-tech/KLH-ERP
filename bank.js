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

// ════════════════════════════════════════════════════════════
//  ผังบัญชี (CHART_OF_ACCOUNTS) — เลขผัง · ชื่อ · ประเภท · ใช้งาน
//  TYPE: รายได้ / ค่าใช้จ่าย / หนี้สิน / สินทรัพย์ / ทุน
//  เฉพาะ TYPE='ค่าใช้จ่าย' เข้างบกำไรขาดทุน · หนี้สิน=งบดุล
// ════════════════════════════════════════════════════════════
var SH_COA = 'CHART_OF_ACCOUNTS';
var H_COA  = ['CODE', 'NAME', 'TYPE', 'ACTIVE'];

function chartSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName(SH_COA);
  if (!s) {
    s = ss.insertSheet(SH_COA);
    s.getRange(1, 1, 1, 4).setValues([H_COA]).setBackground('#00695C').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
    var seed = [
      ['4100', 'รายได้จากการขาย',                'รายได้',     true],
      ['4200', 'รายได้อื่น/เงินคืน',              'รายได้',     true],
      ['5100', 'ต้นทุนขาย',                       'ค่าใช้จ่าย',  true],
      ['5310', 'เงินเดือน/ค่าแรง',                'ค่าใช้จ่าย',  true],
      ['5311', 'ประกันสังคม (นายจ้าง)',           'ค่าใช้จ่าย',  true],
      ['5320', 'ค่าน้ำประปา',                     'ค่าใช้จ่าย',  true],
      ['5321', 'ค่าไฟฟ้า',                        'ค่าใช้จ่าย',  true],
      ['5322', 'ค่าโทรศัพท์/เน็ต',                'ค่าใช้จ่าย',  true],
      ['5330', 'ค่าขนส่ง',                        'ค่าใช้จ่าย',  true],
      ['5340', 'ค่าเช่า',                         'ค่าใช้จ่าย',  true],
      ['5350', 'ค่าธรรมเนียมธนาคาร',              'ค่าใช้จ่าย',  true],
      ['5351', 'ดอกเบี้ยธนาคาร',                  'ค่าใช้จ่าย',  true],
      ['5400', 'ภาษี',                            'ค่าใช้จ่าย',  true],
      ['5900', 'ค่าใช้จ่ายอื่น',                  'ค่าใช้จ่าย',  true],
      ['2100', 'ชำระเจ้าหนี้การค้า',              'หนี้สิน',    true],
      ['2210', 'เงินหักประกันสังคมพนักงาน',       'หนี้สิน',    true]
    ];
    s.getRange(2, 1, seed.length, 4).setValues(seed);
  }
  return s;
}

// ดึงผังบัญชี (เฉพาะที่ ACTIVE) → ใช้ในหน้า bank dropdown
function getChartOfAccounts() {
  try {
    var s = chartSheet_();
    var out = [];
    if (s.getLastRow() > 1) {
      s.getDataRange().getValues().slice(1).forEach(function(r) {
        if (r[3] === false || r[3] === 'FALSE') return;
        var nm = String(r[1] || '').trim();
        if (!nm) return;
        out.push({ code: String(r[0] || ''), name: nm, type: String(r[2] || '') });
      });
    }
    return { ok: true, accounts: out };
  } catch(e) { return { ok: false, msg: e.toString(), accounts: [] }; }
}

// map ชื่อผัง → ประเภท (ใช้แยกค่าใช้จ่ายจริง vs หนี้สิน ในงบ P&L)
function chartTypeMap_() {
  var m = {};
  try {
    chartSheet_().getDataRange().getValues().slice(1).forEach(function(r) {
      var nm = String(r[1] || '').trim();
      if (nm) m[nm] = String(r[2] || '');
    });
  } catch(e) {}
  return m;
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
// opts (ไม่บังคับ): { since:'yyyy/MM/dd', before:'yyyy/MM/dd', ktbOnly:true }
// ใช้ดึงย้อนหลังเป็นช่วงเวลา เช่น ดึง KTB เดือน พ.ค. โดยไม่แตะกรุงศรี
function fetchBankEmails(daysBack, opts) {
  try {
    opts = opts || {};
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

    var since = opts.since || Utilities.formatDate(new Date(Date.now() - daysBack*86400000), 'Asia/Bangkok', 'yyyy/MM/dd');
    var range = ' after:' + since + (opts.before ? ' before:' + opts.before : '');
    var added = 0, skipped = 0;

    // ── กรุงไทย: ใช้ "ไฟล์ statement แนบ (MT940 ใน ZIP)" เป็นแหล่งหลัก ──
    // อีเมลข้อความใช้เฉพาะ "โอนไปกรุงศรี" → บันทึกฝั่ง BAY IN (TRANSFER)
    GmailApp.search('from:' + ktbFrom + range, 0, 50).forEach(function(th) {
      th.getMessages().forEach(function(msg) {
        var id = msg.getId();
        if (seen[id]) { skipped++; return; }
        var subject = msg.getSubject() || '';
        var body = '';
        try { body = msg.getPlainBody().slice(0, 4000); } catch(e) {}

        // 1) ไฟล์แนบ statement (.zip → .txt MT940 หรือ .txt ตรงๆ)
        var gotStmt = 0;
        try {
          msg.getAttachments().forEach(function(att) {
            var nm = att.getName();
            if (/\.zip$/i.test(nm)) {
              // ไฟล์แนบธนาคารมักส่ง content-type ผิด → บังคับเป็น zip ก่อนแกะ
              var zb = att.copyBlob().setContentType('application/zip');
              Utilities.unzip(zb).forEach(function(b) {
                gotStmt += parseMt940_(b.getDataAsString('UTF-8'), s, seen);
              });
            } else if (/\.txt$/i.test(nm)) {
              gotStmt += parseMt940_(att.getDataAsString('UTF-8'), s, seen);
            }
          });
        } catch(eA) { Logger.log('attachment: ' + eA); }
        if (gotStmt > 0) { seen[id] = 1; added += gotStmt; return; }

        // 2) อีเมลแจ้งโอน KTB→กรุงศรี (เงิน "ออก" จาก KTB ไม่ใช่เงินเข้า)
        if (/ไปยังเลขที่บัญชี:\s*กรุงศรี/.test(body) || /credited[\s\S]{0,120}krungsri/i.test(body)) {
          var amtT = extractAmount_(body);
          if (amtT > 0) {
            var dT = Utilities.formatDate(msg.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd');
            // บันทึกฝั่ง BAY IN = โยกเงิน (ฝั่ง KTB OUT จะมาจาก statement เอง)
            s.appendRow([dT, 'BAY', 'IN', amtT, 'TRANSFER', 'โยกเงินจาก KTB (อีเมลแจ้งโอน)',
                         Utilities.formatDate(msg.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), id, '', '']);
            seen[id] = 1; added++;
          }
          return;
        }
        // อีเมลกรุงไทยอื่นๆ (แจ้งเงินเข้า ฯลฯ) ข้าม — statement ครอบคลุมแล้ว กันยอดซ้ำ
      });
    });

    // ── กรุงศรี: อีเมล = PromptPay ลูกค้าเข้า (ยอดขาย + เตือน 0.5%) ──
    if (!opts.ktbOnly) GmailApp.search('from:' + bayFrom + range, 0, 50).forEach(function(th) {
      th.getMessages().forEach(function(msg) {
        var id = msg.getId();
        if (seen[id]) { skipped++; return; }
        var subject = msg.getSubject() || '';
        var body = '';
        try { body = msg.getPlainBody().slice(0, 3000); } catch(e) {}
        var amt = extractAmount_(subject + '\n' + body);
        if (amt <= 0) return;
        s.appendRow([
          Utilities.formatDate(msg.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd'),
          'BAY', 'IN', amt, '', subject.slice(0, 120),
          Utilities.formatDate(msg.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'),
          id, '', ''
        ]);
        seen[id] = 1; added++;
      });
    });

    if (added > 0) {
      var alerts = categorizeBankTxns_();
      if (alerts.length) sendWmsLine_('🔔 ตรวจอีเมลธนาคาร:\n' + alerts.slice(0, 10).join('\n――――\n'));
    }
    return { ok: true, added: added, skipped: skipped, msg: 'บันทึกใหม่ ' + added + ' รายการ (ซ้ำ ' + skipped + ')' };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── ดึง KTB จากอีเมลแบบกำหนดเดือน (long-term fix แทนการ decrypt .xls เอง) ──
// yyyymm เช่น '2026-05' → ค้นอีเมล KTB ตั้งแต่ต้นเดือน ถึงต้นเดือนถัดไป (เผื่อ statement ส่งต้นเดือนถัดไป)
// ktbOnly = true → ไม่แตะกรุงศรี (กันยอดที่ import จาก CSV แล้วซ้ำ)
function importKtbMonthFromEmail(yyyymm) {
  yyyymm = String(yyyymm || '').trim();
  var m = yyyymm.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return { ok: false, msg: 'รูปแบบเดือนไม่ถูก ต้องเป็น YYYY-MM เช่น 2026-05' };
  var y = Number(m[1]), mo = Number(m[2]);
  var since = m[1] + '/' + ('0' + mo).slice(-2) + '/01';
  var ny = mo === 12 ? y + 1 : y, nmo = mo === 12 ? 1 : mo + 1;
  var before = ny + '/' + ('0' + nmo).slice(-2) + '/08';   // ครอบอีเมล statement ที่ส่งต้นเดือนถัดไป (เผื่อถึงวันที่ 7)
  var r = fetchBankEmails(0, { since: since, before: before, ktbOnly: true });
  if (r && r.ok) r.msg = 'KTB เดือน ' + yyyymm + ': ' + r.msg + ' (ค้นเมล ' + since + ' ถึง ' + before + ')';
  return r;
}

// ── ดูเนื้อไฟล์ .txt ใน ZIP อีเมล KTB รายวัน (ยืนยันรูปแบบเพื่อ parse ให้ถูก) ──
// รันใน GAS Editor: debugKtbZip()  → ดู Logger หรือค่า return
function debugKtbZip() {
  var cfg = getConfig();
  var ktbFrom = String(cfg.BANK_EMAIL_KTB || 'krungthai.com').trim();
  var since = Utilities.formatDate(new Date(Date.now() - 7 * 86400000), 'Asia/Bangkok', 'yyyy/MM/dd');
  var out = [];
  GmailApp.search('from:' + ktbFrom + ' after:' + since, 0, 8).forEach(function(th) {
    th.getMessages().forEach(function(m) {
      var subj = m.getSubject() || '';
      var dt = Utilities.formatDate(m.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd');
      m.getAttachments().forEach(function(att) {
        var nm = att.getName();
        if (!/\.zip$/i.test(nm)) { out.push('• ' + dt + ' [' + subj.slice(0, 40) + '] ATT(ไม่ใช่ zip): ' + nm); return; }
        try {
          Utilities.unzip(att.copyBlob().setContentType('application/zip')).forEach(function(b) {
            var fn = b.getName(), bytes = b.getBytes().length, head = '';
            try { head = b.getDataAsString('UTF-8').slice(0, 1200); } catch(e) { head = '[อ่านเป็นข้อความไม่ได้ = อาจเข้ารหัส] ' + e; }
            out.push('• ' + dt + ' ZIP=' + nm + '\n   ไฟล์ใน: ' + fn + ' (' + bytes + ' bytes)\n   ── เนื้อหา 1200 ตัวแรก ──\n' + head + '\n════════');
          });
        } catch(e) { out.push('• ' + dt + ' unzip ' + nm + ' พัง: ' + e); }
      });
    });
  });
  var msg = out.length ? out.join('\n\n') : 'ไม่พบอีเมล KTB ใน 7 วัน';
  Logger.log(msg);
  return msg;
}

// ── ดู trigger ที่ติดตั้งแล้ว (เช็คว่ารายงาน 08:00 / สแกนโฟลเดอร์ 23:00 ตั้งไว้หรือยัง) ──
// รันใน GAS Editor: listTriggers()
function listTriggers() {
  var ts = ScriptApp.getProjectTriggers();
  if (!ts.length) return '⚠️ ยังไม่มี trigger เลย — ต้องรัน setupDailyStatementTrigger() + setupDailySalesTrigger() + setupWeeklyTaxTrigger() ครั้งเดียว';
  var cnt = {};
  ts.forEach(function(t){ var h = t.getHandlerFunction(); cnt[h] = (cnt[h]||0) + 1; });
  var want = {
    dailySalesReport: 'รายงานยอดขาย LINE 08:00',
    importBayStatements: 'สแกนโฟลเดอร์ statement 23:00',
    checkWeeklySalesTarget: 'เช็คเป้ายอดขาย อาทิตย์ 19:00',
    dailyBankJob: 'สรุปยอดธนาคาร LINE 06:00'
  };
  var out = ['📋 Trigger ที่ติดตั้ง (' + ts.length + '):'];
  Object.keys(cnt).forEach(function(h){ out.push('  ✅ ' + h + (want[h]?' — '+want[h]:'') + (cnt[h]>1?' ('+cnt[h]+' ตัว!)':'')); });
  Object.keys(want).forEach(function(h){ if (!cnt[h]) out.push('  ❌ ขาด: ' + h + ' — ' + want[h]); });
  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}

// ── เช็คแถวซ้ำในสมุดธนาคาร (ดู KTB เดือนหนึ่งๆ ว่ามีคีย์ซ้ำไหม) ──
// รันใน Editor: checkBankDup('2026-05')
function checkBankDup(yyyymm) {
  var s = bankSheet_();
  if (s.getLastRow() <= 1) return 'ไม่มีข้อมูล';
  var rows = s.getRange(2, 1, s.getLastRow() - 1, H_BANK.length).getValues();
  var byKey = {}, total = 0, dups = [];
  var sumByBank = {};
  rows.forEach(function(r) {
    var rd = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]).slice(0, 10);
    if (yyyymm && rd.slice(0, 7) !== yyyymm) return;
    total++;
    var bk = String(r[1]) + ' ' + String(r[2]);
    sumByBank[bk] = (sumByBank[bk] || 0) + Number(r[3] || 0);
    var k = String(r[7] || (rd + r[1] + r[2] + r[3]));
    byKey[k] = (byKey[k] || 0) + 1;
    if (byKey[k] === 2) dups.push(k);
  });
  var msg = '📊 เดือน ' + (yyyymm || 'ทั้งหมด') + ': ' + total + ' แถว · คีย์ซ้ำ ' + dups.length + ' รายการ';
  Object.keys(sumByBank).sort().forEach(function(b){ msg += '\n  ' + b + ' = ' + sumByBank[b].toLocaleString(); });
  if (dups.length) msg += '\n⚠️ คีย์ซ้ำ: ' + dups.slice(0, 8).join(', ');
  else msg += '\n✅ ไม่มีซ้ำ';
  Logger.log(msg);
  return msg;
}

// ── ปรับปรุงประกันสังคม: แยกครึ่งเป็นค่าใช้จ่าย(นายจ้าง) + ครึ่งเป็นหนี้สิน(หักพนักงานนำส่ง) ──
// เงินที่จ่าย สนง.ประกันสังคม = ส่วนนายจ้าง 50% (ค่าใช้จ่าย 5311) + ส่วนพนักงานที่หักไว้ 50% (หนี้สิน 2210)
// เรียกจากปุ่มในหน้า bank · ทำซ้ำได้ (ข้ามรายการที่แยกแล้ว)
function adjustSocialSecurity(yyyymm) {
  var s = bankSheet_();
  if (s.getLastRow() <= 1) return { ok: false, msg: 'ไม่มีข้อมูล' };
  var W = H_BANK.length;
  var rng = s.getRange(2, 1, s.getLastRow() - 1, W);
  var rows = rng.getValues();
  var add = [], n = 0, total = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var date = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]).slice(0, 10);
    if (yyyymm && date.slice(0, 7) !== yyyymm) continue;
    if (String(r[2]) !== 'OUT') continue;                         // เฉพาะเงินจ่ายออก
    var subj = String(r[5] || ''), note = String(r[8] || '');
    if (!/SOCIAL SECURITY|ประกันสังคม|SSO/i.test(subj)) continue;  // เฉพาะรายการประกันสังคม
    if (/แยกประกันสังคม/.test(note)) continue;                     // แยกไปแล้ว — ข้าม
    var amt = Number(r[3]) || 0;
    if (amt <= 0) continue;
    var emp = Math.round(amt / 2 * 100) / 100;                     // ครึ่งพนักงาน (หนี้สิน)
    var owner = Math.round((amt - emp) * 100) / 100;               // ครึ่งนายจ้าง (ค่าใช้จ่าย) — กันเศษ
    // แก้แถวเดิม → ครึ่งนายจ้าง เป็นค่าใช้จ่าย
    r[3] = owner; r[4] = 'EXPENSE';
    r[8] = (note ? note + ' · ' : '') + 'แยกประกันสังคม(นายจ้าง)';
    r[9] = 'ประกันสังคม (นายจ้าง)';
    // แถวใหม่ → ครึ่งพนักงาน เป็นหนี้สินนำส่ง (ไม่เข้างบกำไรขาดทุน)
    add.push([r[0], r[1], 'OUT', emp, 'LIABILITY', subj, r[6], String(r[7]) + '-SS2',
              'แยกประกันสังคม(พนักงาน) นำส่งหนี้สิน', 'เงินหักประกันสังคมพนักงาน']);
    n++; total += amt;
  }
  if (!n) return { ok: true, n: 0, msg: 'ไม่พบรายการประกันสังคมที่ยังไม่ได้แยก (หรือแยกครบแล้ว)' };
  rng.setValues(rows);
  s.getRange(s.getLastRow() + 1, 1, add.length, W).setValues(add);
  return { ok: true, n: n, msg: 'แยกประกันสังคม ' + n + ' รายการ (รวม ฿' + total.toLocaleString() + ') → ครึ่งค่าใช้จ่าย + ครึ่งหนี้สิน' };
}

// ── จัดประเภทตามผังเงิน 5 ข้อ + คืนรายการที่ต้องเตือน ──────────────
// 1) KTB IN = ยอดขาย KLH ทั้งหมด
// 2) KTB OUT จับคู่ BAY IN (statement) = โยกเงิน · ไม่ตรง = ค่าใช้จ่ายธนาคาร (เตือน)
// 3) BAY IN จากอีเมล = PromptPay ลูกค้า = SALE (โดนค่าธรรมเนียม 0.5% → เตือนตามตัวลูกค้า)
//    BAY OUT จับคู่ BAYC IN = โยกเงินภายใน · ไม่ตรง = ค่าใช้จ่าย เช่น ค่าน้ำ (เตือน)
// 4) BAYC IN จับคู่ BAY OUT = โยกเงิน · BAYC OUT ที่เหลือ = ชำระหนี้/ค่าใช้จ่าย (ต้องระบุ)
// KTB เงินเข้า: ลูกค้าโอน/PromptPay/เงินโอนเข้า = ขาย · ค่าธรรมเนียมคืน/ปรับปรุง(ADJ)/ดอกเบี้ย = รายได้อื่น
function ktbInCat_(desc) {
  return /\bADJ\b|BPGS|\bBSD\d|ดอกเบี้ย|interest|คืนค่าธรรมเนียม|fee\s*refund/i.test(String(desc || '')) ? 'OTHER' : 'SALE';
}

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

  // จัดหมวด KTB เงินเข้าใหม่ตามรหัสธุรกรรม: ลูกค้าโอน/PromptPay = ขาย · ค่าธรรมเนียมคืน/ปรับปรุง/ดอกเบี้ย = รายได้อื่น
  for (var z = 1; z < rows.length; z++) {
    if (rows[z][1] === 'KTB' && rows[z][2] === 'IN' && rows[z][4] !== 'TRANSFER'
        && (rows[z][4] === 'SALE' || rows[z][4] === 'OTHER' || !rows[z][4])) {
      var want = ktbInCat_(rows[z][5]);
      if (rows[z][4] !== want) {
        rows[z][4] = want;
        s.getRange(z+1, 5).setValue(want);
        if (want === 'OTHER' && !rows[z][8]) alerts.push('💡 กรุงไทยเงินเข้า ฿' + Number(rows[z][3]).toLocaleString() + ' (' + String(rows[z][0]).slice(0,10) + ') = ค่าธรรมเนียม/ปรับปรุง → ตั้งเป็น "รายได้อื่น/เงินคืน" (ไม่ใช่ยอดขาย)');
      }
    }
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
    var imported = 0, fileCount = 0, errs = [], alerts = [];
    while (files.hasNext()) {
      var f = files.next();
      var name = f.getName();
      var bankCode = /กระแส|current|BAYC/i.test(name) ? 'BAYC' : 'BAY';
      var grid = null, tempId = null;
      try {
        var mime = f.getMimeType();
        // ZIP (statement กรุงไทย MT940) หรือ .txt MT940 → อ่านตรง
        if (/\.zip$/i.test(name)) {
          var n0 = 0;
          Utilities.unzip(f.getBlob().setContentType('application/zip')).forEach(function(b) {
            n0 += parseMt940_(b.getDataAsString('UTF-8'), s, seen);
          });
          imported += n0; fileCount++;
          f.moveTo(done);
          continue;
        }
        if (/\.txt$/i.test(name)) {
          var n1 = parseMt940_(f.getBlob().getDataAsString('UTF-8'), s, seen);
          imported += n1; fileCount++;
          f.moveTo(done);
          continue;
        }
        if (mime === MimeType.CSV || /\.csv$/i.test(name)) {
          // ตัด BOM (กรุงศรี export มี U+FEFF นำหน้า ทำให้ parse เพี้ยน)
          grid = Utilities.parseCsv(f.getBlob().getDataAsString('UTF-8').replace(/^﻿/, ''));
        } else if (mime === MimeType.GOOGLE_SHEETS) {
          grid = SpreadsheetApp.openById(f.getId()).getSheets()[0].getDataRange().getValues();
        } else if (/\.xlsx?$/i.test(name) || mime === MimeType.MICROSOFT_EXCEL) {
          var conv = Drive.Files.create({ name: 'tmp_stmt', mimeType: 'application/vnd.google-apps.spreadsheet' }, f.getBlob());
          tempId = conv.id;
          grid = SpreadsheetApp.openById(tempId).getSheets()[0].getDataRange().getValues();
        } else { continue; }   // ข้ามไฟล์ชนิดอื่น

        // KTB statement (ถอดรหัสแล้ว) — ชื่อ Historical_SSKB หรือเจอ "ถอนเงิน/ฝากเงิน" + ยอดคงเหลือยกมา
        var isKtb = /Historical_SSKB|กรุงไทย/i.test(name);
        if (!isKtb) {
          for (var gk = 0; gk < Math.min(grid.length, 20); gk++) {
            var rk = (grid[gk] || []).join('|');
            if (/ถอนเงิน\/ฝากเงิน|ยอดคงเหลือยกมา/.test(rk)) { isKtb = true; break; }
          }
        }
        // กรุงศรี: ชื่อ StatementInquiry · หรือเจอ B/F / วันเวลา
        var isKrungsri = /statement\s*inquiry|inquiry/i.test(name);
        if (!isKtb && !isKrungsri) {
          for (var gi = 0; gi < Math.min(grid.length, 6); gi++) {
            var rowStr = (grid[gi] || []).join('|');
            if (/B\/F/.test(rowStr) || /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/.test(rowStr)) { isKrungsri = true; break; }
          }
        }
        var n = isKtb
          ? parseKtbStatementGrid_(grid, name, s, seen)
          : (isKrungsri
              ? parseKrungsriCsv_(grid, name, s, seen, alerts)
              : parseStatementGrid_(grid, bankCode, name, s, seen));
        imported += n; fileCount++;
        f.moveTo(done);
      } catch(e) { errs.push(name + ': ' + e.message); }
      finally { if (tempId) { try { DriveApp.getFileById(tempId).setTrashed(true); } catch(e2) {} } }
    }

    if (imported > 0) alerts = alerts.concat(categorizeBankTxns_());
    if (alerts.length) sendWmsLine_('🏦 ตรวจ statement ธนาคาร:\n' + alerts.slice(0, 10).join('\n――――\n')
      + (alerts.length > 10 ? '\n…และอีก ' + (alerts.length - 10) + ' รายการ (ดูในสมุดเงินธนาคาร)' : ''));
    return { ok: errs.length === 0, files: fileCount, imported: imported,
             msg: 'นำเข้า ' + fileCount + ' ไฟล์ / ' + imported + ' รายการ' + (errs.length ? ' · ผิดพลาด: ' + errs.join(' | ') : '') };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── MT940 (SWIFT) — รูปแบบ statement กรุงไทย Business ──────────────
// :25:เลขบัญชี → ระบุธนาคาร · :61:YYMMDD..C/D + ยอด(จุลภาค=ทศนิยม) · :86:คำอธิบาย
function parseMt940_(text, s, seen) {
  if (!text || text.indexOf(':61:') < 0) return 0;
  var cfg = {};
  try { cfg = getConfig(); } catch(e) {}
  // map เลขบัญชี → ธนาคาร (เพิ่มได้ใน CONFIG: ACCT_KTB / ACCT_BAY / ACCT_BAYC)
  var acctMap = {};
  acctMap[String(cfg.ACCT_KTB  || '3070404782').replace(/[^0-9]/g, '')] = 'KTB';
  if (cfg.ACCT_BAY)  acctMap[String(cfg.ACCT_BAY).replace(/[^0-9]/g, '')]  = 'BAY';
  if (cfg.ACCT_BAYC) acctMap[String(cfg.ACCT_BAYC).replace(/[^0-9]/g, '')] = 'BAYC';

  var lines = String(text).split(/\r?\n/);
  var bank = 'KTB';
  var count = 0;
  var cur = null;   // { date, dir, amt, ref, desc[] }

  function flush() {
    if (!cur) return;
    var key = 'STMT-' + bank + '-' + cur.date + '-' + cur.dir + '-' + cur.amt + '-' + cur.ref;
    if (!seen[key]) {
      var desc = cur.desc.join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);
      // จัดหมวด: เงินเข้าที่เป็น PromptPay/ORFT = ยอดขายลูกค้า · นอกนั้น (ADJ FEE/ดอกเบี้ย/เงินคืน) = รายได้อื่น
      var cat = '';
      if (cur.dir === 'IN') cat = ktbInCat_(desc);
      s.appendRow([cur.date, bank, cur.dir, cur.amt, cat, desc || ('MT940 ' + cur.ref),
                   Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), key, '', '']);
      seen[key] = 1; count++;
    }
    cur = null;
  }

  for (var i = 0; i < lines.length; i++) {
    var L = lines[i];
    var mAcc = L.match(/^:25:.*?(\d{6,})/);
    if (mAcc) { var an = mAcc[1].replace(/[^0-9]/g, ''); if (acctMap[an]) bank = acctMap[an]; continue; }
    var m61 = L.match(/^:61:(\d{2})(\d{2})(\d{2})\d{0,4}(C|D)(\d+,\d{2})\S*?(\S{0,16})$/);
    if (m61) {
      flush();
      cur = {
        date: '20' + m61[1] + '-' + m61[2] + '-' + m61[3],
        dir:  m61[4] === 'C' ? 'IN' : 'OUT',
        amt:  parseFloat(m61[5].replace(',', '.')) || 0,
        ref:  m61[6] || ('L' + i),
        desc: []
      };
      continue;
    }
    if (cur) {
      if (L.indexOf(':86:') === 0) { cur.desc.push(L.slice(4)); continue; }
      if (L.charAt(0) !== ':' && L.charAt(0) !== '-' && L.charAt(0) !== '{') { cur.desc.push(L); continue; }
      if (L.indexOf(':6') === 0 || L.indexOf('-}') === 0) flush();
    }
  }
  flush();
  return count;
}

// ── KTB statement (ถอดรหัสแล้ว xls/csv) — คอลัมน์รวม "ถอนเงิน/ฝากเงิน" + ยอดคงเหลือบอกทิศทาง ──
// header: วันที่/เวลา | รายการ(code) | รายละเอียด | หมายเลขเช็ค | ถอนเงิน/ฝากเงิน | ภาษี | ยอดคงเหลือ | ช่องทาง
// ทิศทาง: ยอดคงเหลือเพิ่ม = เข้า · ลด = ออก · PromptPay(MORPSD/NMPSDP/IORSDT) = ขาย · อื่น = รายได้อื่น
function parseKtbStatementGrid_(grid, fileName, s, seen) {
  var hRow = -1, cDate = 0, cCode = 1, cDetail = 2, cAmt = 4, cBal = 6;
  for (var i = 0; i < Math.min(grid.length, 20); i++) {
    var row = (grid[i] || []).map(function(x){ return String(x || ''); });
    if (row.some(function(c){ return /ยอดคงเหลือ/.test(c); }) && row.some(function(c){ return /วันที่/.test(c); })) {
      hRow = i;
      for (var j = 0; j < row.length; j++) {
        if (/วันที่/.test(row[j])) cDate = j;
        if (/ถอน|ฝาก/.test(row[j])) cAmt = j;
        if (/คงเหลือ/.test(row[j])) cBal = j;
        if (/รายละเอียด/.test(row[j])) cDetail = j;
        if (/^รายการ$/.test(row[j].trim())) cCode = j;
      }
      break;
    }
  }
  if (hRow < 0) return 0;

  var prev = null, count = 0, now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
  function num(v){ var n = parseFloat(String(v).replace(/[, ]/g, '')); return isNaN(n) ? null : n; }

  // ── pass 1: รวบรวมรายการใหม่ + หาช่วงวันที่ของ statement ──
  var rows = [], minD = null, maxD = null;
  for (var r = hRow + 1; r < grid.length; r++) {
    var cell = grid[r][cDate];
    var isDate = (cell instanceof Date) && !isNaN(cell);   // กรณี CSV ถูกแปลงเป็น Google Sheets แล้ววันที่กลายเป็น Date
    var dtRaw = String(cell || '').trim();
    var bal = num(grid[r][cBal]);
    if (!isDate && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dtRaw)) { if (bal !== null) prev = bal; continue; }  // B/F
    if (bal === null) continue;
    var amt = Math.abs(num(grid[r][cAmt]) || 0);
    var delta = (prev !== null) ? (bal - prev) : 0;
    var dir = delta > 0 ? 'IN' : (delta < 0 ? 'OUT' : (amt > 0 ? 'IN' : ''));
    if (!dir) { prev = bal; continue; }
    if (amt <= 0) amt = Math.abs(delta);
    var d = parseThaiDate_(cell);
    var detail = (String(grid[r][cCode] || '') + ' ' + String(grid[r][cDetail] || '')).replace(/\s+/g, ' ').trim().slice(0, 120);
    var cat = '';
    if (dir === 'IN') cat = ktbInCat_(detail);
    var key = 'STMT-KTB-' + d + '-' + dir + '-' + amt + '-' + bal;   // ยอดคงเหลือ = unique ต่อรายการ
    rows.push([d, 'KTB', dir, amt, cat, detail, now, key, '', '']);
    if (!minD || d < minD) minD = d;
    if (!maxD || d > maxD) maxD = d;
    prev = bal;
  }
  if (!rows.length || !minD) return 0;

  // ── authoritative replace แบบ batch (อ่าน-กรอง-เขียนครั้งเดียว: เร็ว + ไม่ row-range error + กันซ้ำ) ──
  var W = H_BANK.length;                                  // 10 คอลัมน์
  var lastRow = s.getLastRow();
  var existing = lastRow > 1 ? s.getRange(2, 1, lastRow - 1, W).getValues() : [];

  // เก็บทุกแถวที่ "ไม่ใช่ KTB ในช่วงวันที่นี้" (ลบ KTB ช่วงนี้ทิ้งทั้งหมด → กันซ้ำกับ email/รันซ้ำ)
  var kept = [], keptKeys = {};
  existing.forEach(function(r) {
    var rd = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]).slice(0, 10);
    if (String(r[1]) === 'KTB' && rd >= minD && rd <= maxD) return;   // ตัดทิ้ง จะใส่ใหม่จากไฟล์
    kept.push(r);
    if (r[7]) keptKeys[String(r[7])] = 1;
  });

  // dedup รายการใหม่ (กันคีย์ซ้ำในไฟล์เอง + ซ้ำกับแถวที่เก็บไว้)
  var fresh = [];
  rows.forEach(function(row) {
    if (keptKeys[row[7]]) return;
    keptKeys[row[7]] = 1; fresh.push(row); count++;
  });

  var out = kept.concat(fresh);
  if (lastRow > 1) s.getRange(2, 1, lastRow - 1, W).clearContent();
  if (out.length) s.getRange(2, 1, out.length, W).setValues(out);
  return count;
}

// ── Krungsri StatementInquiry CSV (ไม่มี header, แถวแรก B/F ยอดยกมา) ──
// คอลัมน์: 0 วันเวลา dd/mm/yyyy hh:mm:ss · 1 ถอน · 2 ฝาก · 3 คงเหลือ · 4 รหัส(TN/TW/TD/FE/DN/CL) · 5 รายละเอียด
// แยกบัญชี: เจอ "รับโอนเงิน BAY K L H บัญชีต้นทาง" = กระแสรายวัน(BAYC) · เจอ "โอนเงิน BAY K L H บัญชีปลายทาง" = ออมทรัพย์(BAY)
function parseKrungsriCsv_(grid, fileName, s, seen, alerts) {
  alerts = alerts || [];
  var joined = grid.map(function(r){ return r.join('|'); }).join('\n');
  var bank = 'BAY';
  if (/กระแส|current|BAYC/i.test(fileName)) bank = 'BAYC';
  else if (/รับโอนเงิน BAY K L H บัญชีต้นทาง/.test(joined)) bank = 'BAYC';
  else if (/โอนเงิน BAY K L H บัญชีปลายทาง/.test(joined)) bank = 'BAY';

  var count = 0;
  var fileKeys = {};            // กุญแจทุกแถวในไฟล์นี้ (ไว้เทียบหาเช็คคืน/แก้ไข)
  var minD = null, maxD = null;

  for (var r = 0; r < grid.length; r++) {
    var row = grid[r];
    if (!row || row.length < 6) continue;
    var dt = String(row[0] || '').trim();
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dt)) continue;        // ข้าม B/F และแถวว่าง
    var d = parseThaiDate_(dt);
    if (!d) continue;
    if (!minD || d < minD) minD = d;
    if (!maxD || d > maxD) maxD = d;
    var amtOut = Number(String(row[1]).replace(/[, ]/g, '')) || 0;
    var amtIn  = Number(String(row[2]).replace(/[, ]/g, '')) || 0;
    var code = String(row[4] || '').trim();
    var desc = String(row[5] || '').replace(/\s+/g, ' ').trim().slice(0, 120);

    // pre-category จากรหัส/คำอธิบาย
    var cat = '', acct = '';
    var isCustomerIn = false;
    if (code === 'FE') { cat = 'EXPENSE'; acct = 'ค่าธรรมเนียมธนาคาร'; }
    else if (/K L H/.test(desc)) cat = 'TRANSFER';              // โยกเงินภายในชื่อตัวเอง
    else if (amtIn > 0 && /รับโอนเงิน|จ่ายคิวอาร์|พร้อมเพย์/.test(desc)) { cat = 'SALE'; isCustomerIn = true; }
    else if (amtOut > 0 && /โอนเงิน|จ่าย|เงินออก/.test(desc)) cat = 'PAYMENT';

    // เช็ค (CL) สั่งจ่ายได้เฉพาะบัญชีกระแสรายวัน → บังคับเป็น BAYC เสมอ (กันจัดผิดไปออมทรัพย์)
    var rowBank = (code === 'CL') ? 'BAYC' : bank;

    var pair = [];
    if (amtIn > 0)  pair.push(['IN', amtIn]);
    if (amtOut > 0) pair.push(['OUT', amtOut]);
    pair.forEach(function(p) {
      var key = 'STMT-' + rowBank + '-' + dt + '-' + p[0] + '-' + p[1];
      fileKeys[key] = 1;
      if (seen[key]) return;
      s.appendRow([d, rowBank, p[0], p[1], cat, desc || ('statement: ' + fileName),
                   Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), key, '', acct]);
      seen[key] = 1; count++;
      // ลูกค้าโอนเข้า → เตือนเช็คตัดลูกหนี้ (AR)
      if (isCustomerIn) {
        alerts.push('🟧 ลูกค้าโอนเข้า ' + (rowBank === 'BAY' ? 'กรุงศรีออมฯ' : 'กรุงศรีกระแสฯ')
          + ' ฿' + p[1].toLocaleString() + ' (' + d + ')\n' + desc.slice(0, 70)
          + '\n→ เช็คว่าเป็นลูกหนี้ชำระหนี้ไหม → ตัด AR ใน Customer & AR แล้วเปลี่ยนหมวดเป็น "ตัดลูกหนี้"');
      }
    });
  }

  // ── เช็คเปลี่ยนแปลง/เช็คคืน: แถวในชีต (ช่วงวันที่เดียวกัน) ที่หายไปจาก statement ล่าสุด ──
  if (minD && maxD) {
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var mid = String(rows[i][7] || '');
      if (mid.indexOf('STMT-' + bank + '-') !== 0) continue;
      var rd = rows[i][0] instanceof Date
        ? Utilities.formatDate(rows[i][0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(rows[i][0]);
      if (rd < minD || rd > maxD) continue;
      if (!fileKeys[mid]) {
        var note9 = String(rows[i][8] || '');
        if (note9.indexOf('ไม่พบใน statement') < 0) {
          s.getRange(i + 1, 9).setValue((note9 ? note9 + ' | ' : '') + '⚠️ไม่พบใน statement ล่าสุด (เช็คคืน/แก้ไข?)');
          alerts.push('⚠️ รายการ ' + rd + ' ' + rows[i][2] + ' ฿' + Number(rows[i][3]).toLocaleString()
            + ' (' + bank + ') หายจาก statement ล่าสุด — อาจมีเช็คคืน/ธนาคารแก้รายการ ตรวจในสมุดเงินธนาคาร');
        }
      }
    }
  }
  return count;
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
  // fallback: ถ้าไม่เจอ header → ลอง parser กรุงศรี (กันไฟล์รูปแบบไม่คาดคิด) ไม่ throw ให้ batch ล้ม
  if (hRow < 0 || cDate < 0) return parseKrungsriCsv_(grid, fileName, s, seen, []);

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

// ── debug: ดูว่าในโฟลเดอร์ statement มีไฟล์อะไร, mime, จำนวนแถว, ตรวจ KTB/หัวตารางเจอไหม ──
// รันใน GAS Editor แล้วดูผลใน Execution log (และส่งเข้า LINE ให้ด้วย)
function debugStmtImport() {
  var folder = stmtFolder_();
  var report = ['📁 โฟลเดอร์: ' + folder.getName()];
  var files = folder.getFiles(), any = false;
  while (files.hasNext()) {
    any = true;
    var f = files.next(), name = f.getName(), mime = f.getMimeType();
    var line = '• ' + name + '\n   mime=' + mime;
    var tempId = null;
    try {
      var grid = null;
      if (mime === MimeType.CSV || /\.csv$/i.test(name)) {
        grid = Utilities.parseCsv(f.getBlob().getDataAsString('UTF-8').replace(/^﻿/, ''));
      } else if (mime === MimeType.GOOGLE_SHEETS) {
        grid = SpreadsheetApp.openById(f.getId()).getSheets()[0].getDataRange().getValues();
      } else if (/\.xlsx?$/i.test(name) || mime === MimeType.MICROSOFT_EXCEL) {
        var conv = Drive.Files.create({ name: 'tmp_dbg', mimeType: 'application/vnd.google-apps.spreadsheet' }, f.getBlob());
        tempId = conv.id;
        grid = SpreadsheetApp.openById(tempId).getSheets()[0].getDataRange().getValues();
      } else { line += '\n   (ชนิดไฟล์ไม่รองรับ → ข้าม)'; report.push(line); continue; }

      var isKtb = /Historical_SSKB|กรุงไทย/i.test(name);
      var headerRow = -1;
      for (var i = 0; i < Math.min(grid.length, 20); i++) {
        var rk = (grid[i] || []).join('|');
        if (/ถอนเงิน\/ฝากเงิน|ยอดคงเหลือยกมา/.test(rk)) isKtb = true;
        if (/ยอดคงเหลือ/.test(rk) && /วันที่/.test(rk)) headerRow = i;
      }
      line += '\n   rows=' + grid.length + ' · isKtb=' + isKtb + ' · headerRow=' + headerRow;
      if (isKtb && headerRow >= 0) {
        var firstData = (grid[headerRow + 2] || []).slice(0, 7).join(' | ');
        line += '\n   ตัวอย่างแถวข้อมูล: ' + firstData;
      }
    } catch (e) { line += '\n   ERROR: ' + e.message; }
    finally { if (tempId) { try { DriveApp.getFileById(tempId).setTrashed(true); } catch (e2) {} } }
    report.push(line);
  }
  if (!any) report.push('(ไม่มีไฟล์ในโฟลเดอร์ — ยังไม่ได้อัปโหลด หรืออัปโหลดผิดโฟลเดอร์)');
  var msg = report.join('\n');
  Logger.log(msg);
  try { sendWmsLine_('🔍 ' + msg); } catch (e3) {}
  return msg;
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
      var rd = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM') : String(r[0]).slice(0, 7);
      if (rd !== ym) return;
      var bank = r[1], dir = r[2], amt = Number(r[3]) || 0, cat = r[4];
      out.count++;
      if (cat === 'TRANSFER') { out.transfer += amt; return; }
      if (dir === 'IN') {
        if (bank === 'KTB') out.ktbIn += amt; else out.bayIn += amt;
        if (cat === 'SALE' || cat === 'AR') out.salesBase += amt;   // AR = ลูกหนี้ชำระ ก็เป็นเงินเข้าฐานภาษี
      } else out.payment += amt;
    });
    return out;
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── ดึง KTB รายวันจากอีเมล: แกะ ZIP → parse MT940 (.txt ไม่เข้ารหัส) เท่านั้น ──
// ข้ามไฟล์เข้ารหัส (statement รายเดือน) · ไม่สร้างแถวฝั่ง BAY (กันซ้ำกับ statement กรุงศรี)
// ยอดรายเดือน (CSV เข้ารหัส) ค่อยถอดเป็น CSV มา import ทับทีหลัง (authoritative replace เคลียร์ให้ตรง)
function fetchKtbDaily(daysBack) {
  try {
    daysBack = Number(daysBack) || 2;
    var cfg = getConfig();
    var ktbFrom = String(cfg.BANK_EMAIL_KTB || 'krungthai.com').trim();
    var s = bankSheet_();
    var seen = {};
    if (s.getLastRow() > 1) s.getRange(2, 8, s.getLastRow() - 1, 1).getValues().forEach(function(r){ if (r[0]) seen[String(r[0])] = 1; });
    var since = Utilities.formatDate(new Date(Date.now() - daysBack * 86400000), 'Asia/Bangkok', 'yyyy/MM/dd');
    var added = 0, files = 0;
    GmailApp.search('from:' + ktbFrom + ' after:' + since, 0, 50).forEach(function(th) {
      th.getMessages().forEach(function(m) {
        m.getAttachments().forEach(function(att) {
          var nm = att.getName();
          try {
            if (/\.zip$/i.test(nm)) {
              Utilities.unzip(att.copyBlob().setContentType('application/zip')).forEach(function(b) {
                var t = '';
                try { t = b.getDataAsString('UTF-8'); } catch(e) { return; }   // เข้ารหัส/ไบนารี → ข้าม
                if (t.indexOf(':61:') >= 0) { added += parseMt940_(t, s, seen); files++; }
              });
            } else if (/\.txt$/i.test(nm)) {
              var t2 = att.getDataAsString('UTF-8');
              if (t2.indexOf(':61:') >= 0) { added += parseMt940_(t2, s, seen); files++; }
            }
          } catch(e) {}
        });
      });
    });
    if (added > 0) categorizeBankTxns_();
    return { ok: true, added: added, files: files, msg: 'KTB รายวัน: เพิ่ม ' + added + ' รายการ (จาก ' + files + ' ไฟล์ MT940 ใน ' + daysBack + ' วัน)' };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── กระทบยอด KTB: เช็คว่าเดือนนี้มีข้อมูลครบทุกวันไหม (วันขาด = อาจดึงไม่ครบ) ──
// เทียบความครบถ้วน — ถ้ามีวันขาด ให้ import statement รายเดือนมาเติม (authoritative replace)
function reconcileKtb(yyyymm) {
  try {
    var s = bankSheet_();
    var ym = yyyymm || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
    if (s.getLastRow() <= 1) return { ok: true, msg: 'ยังไม่มีข้อมูลในสมุดธนาคาร' };
    var rows = s.getRange(2, 1, s.getLastRow() - 1, H_BANK.length).getValues();
    var dayIn = {}, totalIn = 0, totalOut = 0, cnt = 0;
    rows.forEach(function(r) {
      if (String(r[1]) !== 'KTB') return;
      var d = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]).slice(0, 10);
      if (d.slice(0, 7) !== ym) return;
      cnt++;
      var amt = Number(r[3]) || 0;
      if (r[2] === 'IN') { var day = Number(d.slice(8, 10)); dayIn[day] = (dayIn[day] || 0) + amt; totalIn += amt; }
      else totalOut += amt;
    });
    if (!cnt) return { ok: true, msg: '🔍 KTB เดือน ' + ym + ': ยังไม่มีข้อมูลเลย — กดดึง KTB หรือ import statement' };
    var days = Object.keys(dayIn).map(Number).sort(function(a, b){ return a - b; });
    var first = days[0], last = days[days.length - 1], missing = [];
    for (var d = first; d <= last; d++) if (!dayIn[d]) missing.push(d);
    var msg = '🔍 กระทบยอด KTB ' + ym
      + '\nรายการ ' + cnt + ' · เงินเข้ารวม ฿' + Math.round(totalIn).toLocaleString()
      + '\nมีข้อมูลวันที่ ' + first + '–' + last + ' (' + days.length + ' วัน)';
    if (missing.length) msg += '\n⚠️ วันไม่มีเงินเข้า: ' + missing.join(', ') + '\n→ เช็คว่าปิดร้าน หรือข้อมูลขาด (import statement รายเดือนมาเติมครบ)';
    else msg += '\n✅ ครบทุกวันในช่วง ไม่มีวันขาด';
    return { ok: true, msg: msg, totalIn: totalIn, missing: missing };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// เช็คว่าวันที่ ymd มีรายการของแต่ละธนาคารไหม (ไว้เตือนถ้าลืมเรียก statement)
function bankDayPresence_(ymd) {
  var s = bankSheet_();
  var has = { KTB: false, BAY: false, BAYC: false };
  if (s.getLastRow() <= 1) return has;
  s.getRange(2, 1, s.getLastRow() - 1, 2).getValues().forEach(function(r) {
    var d = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]).slice(0, 10);
    if (d === ymd && has.hasOwnProperty(r[1])) has[r[1]] = true;
  });
  return has;
}

// รายวัน 06:00: ดึง KTB รายวัน (MT940) + สรุปยอดสะสมส่ง LINE + เตือนถ้าเมื่อวานไม่มียอด
function dailyBankJob() {
  var ktb = fetchKtbDaily(2);
  var ym = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
  var yest = Utilities.formatDate(new Date(Date.now() - 86400000), 'Asia/Bangkok', 'yyyy-MM-dd');
  var sum = getBankSummary(ym);
  // เตือนถ้าเมื่อวานยังไม่มียอด (ลืมเรียก/ดึง statement)
  var has = bankDayPresence_(yest);
  var miss = [];
  if (!has.KTB) miss.push('กรุงไทย (KTB)');
  if (!has.BAY && !has.BAYC) miss.push('กรุงศรี (BAY) — เรียก statement เองทุกคืน');
  if (sum.ok) {
    var msg = '🏦 รายงานยอดเงินธนาคาร (' + ym + ' สะสม)\n'
      + '🟦 KTB เข้า: ฿' + Math.round(sum.ktbIn).toLocaleString() + '\n'
      + '🟧 กรุงศรี เข้า: ฿' + Math.round(sum.bayIn).toLocaleString() + '\n'
      + '🔁 โยกเงิน (ไม่นับขาย): ฿' + Math.round(sum.transfer).toLocaleString() + '\n'
      + '💰 ฐานยอดขายภาษี: ฿' + Math.round(sum.salesBase).toLocaleString()
      + (ktb && ktb.added ? '\n(KTB อีเมลใหม่ ' + ktb.added + ' รายการ)' : '');
    if (miss.length) msg += '\n\n⚠️ เมื่อวาน (' + yest + ') ยังไม่มียอด:\n   • ' + miss.join('\n   • ') + '\n→ เรียก/นำเข้า statement ให้ครบ';
    sendWmsLine_(msg);
  }
  return { ok: true, ktb: ktb, sum: sum, missingYesterday: miss };
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

// ย้ายรายการไปบัญชีที่ถูก (เช่น เช็คจ่ายจากกระแส แต่ถูกจัดเป็นออมทรัพย์)
function reclassifyBankTxn(row, newBank) {
  try {
    var s = bankSheet_();
    if (row < 2 || row > s.getLastRow()) return { ok: false, msg: 'แถวไม่ถูกต้อง' };
    var nb = String(newBank || '').trim().toUpperCase();
    if (['KTB','BAY','BAYC'].indexOf(nb) < 0) return { ok: false, msg: 'บัญชีไม่ถูกต้อง' };
    s.getRange(row, 2).setValue(nb);
    return { ok: true, msg: 'ย้ายไป ' + nb + ' แล้ว' };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ค่าใช้จ่ายจากธนาคาร แยกตามผังบัญชี (ดึงเข้างบกำไรขาดทุน — ผังเงินข้อ 5)
function getBankExpenses(yyyymm) {
  try {
    var ym = yyyymm || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
    var s = bankSheet_();
    var typeMap = chartTypeMap_();
    var by = {}, total = 0, unspecified = 0;
    if (s.getLastRow() > 1) {
      s.getDataRange().getValues().slice(1).forEach(function(r) {
        var d = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]);
        if (d.slice(0, 7) !== ym) return;
        var cat = String(r[4] || '');
        if (cat !== 'EXPENSE') return;                    // เฉพาะค่าใช้จ่ายจริง (ชำระหนี้/หนี้สิน = งบดุล ไม่เข้า P&L)
        var amt = Number(r[3]) || 0;
        var acc = String(r[9] || '').trim();
        var aType = typeMap[acc] || '';
        if (aType === 'หนี้สิน' || aType === 'สินทรัพย์' || /หนี้สิน/.test(acc)) return;  // ไม่ใช่ค่าใช้จ่าย P&L
        if (!acc) { acc = 'ค่าใช้จ่ายอื่น (ยังไม่ระบุ)'; unspecified += amt; }
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

// ── TEST: ส่งข้อความทดสอบเข้า LINE — รันใน GAS Editor ดูว่าเข้าห้องไหม ──
function testLine() {
  var cfg = getConfig();
  var dest = String(cfg.LINE_GROUP_ID || '');
  var msg = '🔔 ทดสอบระบบ KLH\n'
    + 'เวลา: ' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss') + '\n'
    + 'ปลายทาง: ' + (dest.charAt(0) === 'C' ? 'ห้องกลุ่ม ✓' : (dest.charAt(0) === 'U' ? 'แชทส่วนตัว (U…)' : '?')) + '\n'
    + 'ถ้าเห็นข้อความนี้ = ระบบส่ง LINE ได้ปกติ';
  sendWmsLine_(msg);
  Logger.log('ส่งไป: ' + dest + '\n' + msg);
  return 'ส่งแล้ว → ' + dest;
}

// ── DEBUG: สแกนหาอีเมลธนาคารจริง 14 วัน — รันใน GAS Editor แล้วดู Log ──
// ใช้ปรับ BANK_EMAIL_KTB / BANK_EMAIL_BAY และ regex ให้ตรงรูปแบบจริง
function debugBankEmails(daysBack) {
  daysBack = Number(daysBack) || 14;
  var queries = [
    'from:krungthai.com', 'from:ktb.co.th', 'from:krungsri.com', 'from:bay.co.th',
    'กรุงไทย', 'กรุงศรี', 'Krungthai', 'Krungsri', 'เงินเข้า', 'รับโอนเงิน'
  ];
  var since = Utilities.formatDate(new Date(Date.now() - daysBack*86400000), 'Asia/Bangkok', 'yyyy/MM/dd');
  var out = [];
  queries.forEach(function(q) {
    try {
      var threads = GmailApp.search(q + ' after:' + since, 0, 5);
      threads.forEach(function(th) {
        var m = th.getMessages()[0];
        var body = ''; try { body = m.getPlainBody().slice(0, 200).replace(/\s+/g, ' '); } catch(e) {}
        var att = 0, attNames = ''; try { var atts = m.getAttachments(); att = atts.length; attNames = atts.map(function(a){ return a.getName(); }).join(', '); } catch(e) {}
        out.push('Q[' + q + '] FROM: ' + m.getFrom()
          + '\n  DATE: ' + Utilities.formatDate(m.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd')
          + '\n  SUBJ: ' + m.getSubject()
          + '\n  ATT: ' + att + (attNames ? ' [' + attNames + ']' : '') + ' | AMT-PARSE: ' + extractAmount_(m.getSubject() + ' ' + body)
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
