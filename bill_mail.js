// ============================================================
//  bill_mail.js — เก็บใบแจ้งหนี้จากอีเมล → Google Drive อัตโนมัติ
//  ทำงานบน Google ทั้งหมด (trigger รายวัน) ไม่ต้องเปิดคอม
//  อ่านกล่องจดหมาย klh.chaiyaphum@gmail.com
//  ปลายทาง: Drive "2569 เอกสาร KLH" / NT · PEA · PWA / <ปี พ.ศ.-เดือน>
//  กันซ้ำ: ติด label 'KLH-filed' บน thread ที่เก็บแล้ว + เช็คชื่อไฟล์ซ้ำในโฟลเดอร์
// ============================================================

var BILL_MAIL_LABEL = 'KLH-filed';
var BILL_MAIL_OWNER = 'klh.chaiyaphum@gmail.com';   // กล่องที่บิลส่งเข้า
var BILL_MAIL_LOG   = 'BILL_INBOX';                  // ชีตบันทึกว่าเก็บอะไรไปบ้าง

// แหล่งบิล — เพิ่มรายการใหม่ได้ที่นี่ที่เดียว
// folderId = โฟลเดอร์ย่อยใน "2569 เอกสาร KLH" (มีอยู่แล้ว)
function billMailSources_() {
  return [
    { key:'NT',  name:'ค่าโทรศัพท์ NT',
      // e-Bill ส่งตรงเข้า klh + e-Receipt ที่ forward มาจาก hotmail
      query:'(from:ntplc.co.th OR (from:num_surasak@hotmail.com "โทรคมนาคมแห่งชาติ"))',
      folderId:'1TSHtuPBmdlaUszGdhExujIwiAfNXk8BV' },
    { key:'PEA', name:'ค่าไฟ PEA',
      query:'from:pea.co.th',
      folderId:'1mkmQ2crghzIj2rCjqmZCd6tArSd0rotA' },
    { key:'PWA', name:'ค่าน้ำ PWA',
      query:'(from:pwa.co.th OR subject:"การประปาส่วนภูมิภาค")',
      folderId:'1qzRiO_g-h4rJkHT0DDPggWulskV22kmH' }
  ];
}

// ชื่อโฟลเดอร์เดือน แบบ พ.ศ. เช่น 2569-10
function billMailMonth_(d) {
  var y = Number(Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy')) + 543;
  return y + '-' + Utilities.formatDate(d, 'Asia/Bangkok', 'MM');
}

function billMailSubfolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function billMailLogSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName(BILL_MAIL_LOG);
  if (!s) {
    s = ss.insertSheet(BILL_MAIL_LOG);
    var h = ['เก็บเมื่อ','แหล่ง','วันที่อีเมล','จาก','หัวเรื่อง','ไฟล์','ลิงก์','เดือน'];
    s.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#1A237E').setFontColor('#FFF');
    s.setFrozenRows(1);
  }
  return s;
}

// ── แกนหลัก ─────────────────────────────────────────────────
// dryRun=true → แค่รายงานว่าจะเก็บอะไร ไม่เขียนอะไรเลย
function billMailCore_(daysBack, dryRun) {
  var me = '';
  try { me = Session.getEffectiveUser().getEmail(); } catch (e0) {}
  var out = ['═══════ เก็บบิลจากอีเมล ' + (dryRun ? '(ทดลอง — ยังไม่บันทึก)' : '') + ' ═══════',
             'กล่องที่อ่าน: ' + (me || '?') + ' · ย้อนหลัง ' + daysBack + ' วัน'];
  if (me && me !== BILL_MAIL_OWNER) {
    out.push('⚠️ กำลังอ่านกล่อง ' + me + ' แต่บิลส่งเข้า ' + BILL_MAIL_OWNER
           + ' — เปิด GAS Editor ด้วยบัญชี ' + BILL_MAIL_OWNER + ' แล้วรันใหม่');
    Logger.log(out.join('\n'));
    return out.join('\n');
  }

  var since = Utilities.formatDate(new Date(Date.now() - daysBack * 86400000), 'Asia/Bangkok', 'yyyy/MM/dd');
  var label = dryRun ? null : (GmailApp.getUserLabelByName(BILL_MAIL_LABEL) || GmailApp.createLabel(BILL_MAIL_LABEL));
  var log = dryRun ? null : billMailLogSheet_();
  var logRows = [], now = new Date(), total = 0;

  var srcs = billMailSources_();
  for (var s = 0; s < srcs.length; s++) {
    var src = srcs[s];
    var q = src.query + ' has:attachment -label:' + BILL_MAIL_LABEL + ' after:' + since;
    var parent = null;
    try { parent = DriveApp.getFolderById(src.folderId); }
    catch (eF) { out.push('❌ ' + src.name + ': เปิดโฟลเดอร์ไม่ได้ (' + eF + ')'); continue; }

    var start = 0, cnt = 0, threads;
    do {
      threads = GmailApp.search(q, start, 100);
      for (var t = 0; t < threads.length; t++) {
        var th = threads[t], saved = 0;
        var msgs = th.getMessages();
        for (var m = 0; m < msgs.length; m++) {
          var msg = msgs[m], d = msg.getDate(), mon = billMailMonth_(d);
          var atts = msg.getAttachments();
          for (var a = 0; a < atts.length; a++) {
            var att = atts[a], nm = att.getName();
            if (!/\.pdf$/i.test(nm)) { continue; }   // เก็บเฉพาะ PDF (ข้ามรูปโลโก้ในเมล)
            var fname = Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd') + '_' + src.key + '_' + nm;
            if (dryRun) {
              out.push('  • ' + src.key + ' → ' + mon + '/' + fname);
              saved++; continue;
            }
            var folder = billMailSubfolder_(parent, mon);
            if (folder.getFilesByName(fname).hasNext()) { saved++; continue; }   // มีแล้ว
            var f = folder.createFile(att.copyBlob().setName(fname));
            logRows.push([now, src.key, d, msg.getFrom(), msg.getSubject(), fname, f.getUrl(), mon]);
            saved++;
          }
        }
        if (saved) { cnt += saved; if (!dryRun) { th.addLabel(label); } }
      }
      start += threads.length;
    } while (threads.length === 100);

    out.push((cnt ? '✅ ' : '— ') + src.name + ': ' + cnt + ' ไฟล์');
    total += cnt;
  }

  if (log && logRows.length) {
    log.getRange(log.getLastRow() + 1, 1, logRows.length, logRows[0].length).setValues(logRows);
  }
  out.push('รวม ' + total + ' ไฟล์' + (dryRun ? ' (ยังไม่ได้บันทึก — รัน billMailRun เพื่อเก็บจริง)' : ' · บันทึกไว้ที่ชีต ' + BILL_MAIL_LOG));
  Logger.log(out.join('\n'));
  return out.join('\n');
}

// ── ปุ่มที่ใช้ ─────────────────────────────────────────────
// 1) ดูก่อนว่าจะเก็บอะไร (ย้อนหลัง 1 ปี) — ไม่เขียนอะไร
function billMailDryRun() { return billMailCore_(365, true); }

// 2) เก็บย้อนหลังทั้งปี (รันครั้งแรกครั้งเดียว)
function billMailBackfill() { return billMailCore_(365, false); }

// 3) รายวัน (trigger เรียก) — ย้อน 14 วันกันพลาด แต่ไม่ซ้ำเพราะมี label
function billMailRun() { return billMailCore_(14, false); }

// 4) ตั้งเวลาทุกวัน 07:00
function setupBillMailTrigger() {
  removeBillMailTrigger();
  ScriptApp.newTrigger('billMailRun').timeBased().everyDays(1).atHour(7).inTimezone('Asia/Bangkok').create();
  Logger.log('✅ ตั้งเวลาเก็บบิลจากอีเมลทุกวัน 07:00 แล้ว (รันในนามบัญชี ' + Session.getEffectiveUser().getEmail() + ')');
}

function removeBillMailTrigger() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) {
    if (ts[i].getHandlerFunction() === 'billMailRun') { ScriptApp.deleteTrigger(ts[i]); }
  }
}

// ════════════════════════════════════════════════════════════
//  ทดสอบ: อีเมล statement กรุงศรี — มาไหม เป็นไฟล์อะไร เปิดได้ไหม
//  (ตอบคำถามว่า ถ้าขอ statement ผ่านแอปมือถือ ระบบดูดเข้าเองได้หรือเปล่า)
// ════════════════════════════════════════════════════════════
function testKrungsriMail() {
  var out = ['═══════ ทดสอบอีเมลกรุงศรี (ย้อน 90 วัน) ═══════'];
  try { out.push('กล่องที่อ่าน: ' + Session.getEffectiveUser().getEmail()); } catch (e0) {}
  var since = Utilities.formatDate(new Date(Date.now() - 90 * 86400000), 'Asia/Bangkok', 'yyyy/MM/dd');
  var threads = GmailApp.search('from:(krungsri.com OR krungsribizonline.com OR bay.co.th) after:' + since, 0, 30);
  out.push('พบ ' + threads.length + ' thread');
  for (var t = 0; t < threads.length; t++) {
    var m = threads[t].getMessages()[0];
    out.push('');
    out.push('▸ ' + Utilities.formatDate(m.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') + ' | ' + m.getFrom());
    out.push('  เรื่อง: ' + m.getSubject());
    var atts = m.getAttachments();
    if (!atts.length) { out.push('  (ไม่มีไฟล์แนบ)'); continue; }
    for (var a = 0; a < atts.length; a++) {
      var att = atts[a], nm = att.getName();
      var line = '  📎 ' + nm + ' (' + Math.round(att.getSize() / 1024) + ' KB, ' + att.getContentType() + ')';
      if (/\.zip$/i.test(nm)) {
        try {
          var inner = Utilities.unzip(att.copyBlob().setContentType('application/zip'));
          var names = [];
          for (var k = 0; k < inner.length; k++) { names.push(inner[k].getName()); }
          line += '\n     ✅ แตก zip ได้ → ' + names.join(', ');
        } catch (eZ) {
          line += '\n     ❌ แตก zip ไม่ได้ (น่าจะติดรหัสผ่าน): ' + String(eZ).substring(0, 80);
        }
      }
      out.push(line);
    }
  }
  Logger.log(out.join('\n'));
  return out.join('\n');
}
