// ============================================================
//  ap_ocr.js — นำเข้าบิลสแกนทีละมากๆ (batch) → เจ้าหนี้ AP
//  ไหลงาน: รูปบิลในโฟลเดอร์ Drive → คิว → OCR ยิงขนาน → ชีตพัก
//           → ตรวจ/ยืนยัน → AP_LEDGER → ตัดบิลที่หน้า เทียบจ่าย BAYC
//  จุดเด่น: ทำงานต่อเองเป็นรอบๆ ไม่ติดลิมิต 6 นาทีของ GAS
//  Depends: SHEET_ID (Code.js) · getConfig() · gemModels_() (Code.js)
// ============================================================

var AP_OCR_FOLDER  = 'AP_OCR_INBOX';     // โฟลเดอร์ Drive ที่วางรูปบิล
var AP_OCR_QUEUE   = 'AP_OCR_QUEUE';     // คิวงาน
var AP_OCR_STAGING = 'AP_OCR_STAGING';   // ชีตพัก รอตรวจก่อนเข้าเจ้าหนี้
var AP_OCR_PARALLEL = 8;                 // ยิงพร้อมกันกี่ใบต่อชุด
var AP_OCR_BUDGET_MS = 270000;           // ใช้เวลาต่อรอบไม่เกิน 4.5 นาที (ลิมิตจริง 6)
var AP_OCR_MAX_BATCHES = 0;              // จำกัดจำนวนชุดต่อรอบ (0 = ไม่จำกัด) ใช้ตอนทดลอง

var H_AP_QUEUE = ['FILE_ID','FILE_NAME','STATUS','OCR_AT','ERROR'];
var H_AP_STG   = ['STG_ID','FILE_NAME','SUPPLIER_OCR','SUPPLIER_CODE','SUPPLIER_NAME','MATCH',
                  'INVOICE_NO','INVOICE_DATE','DUE_DATE','SUBTOTAL','VAT','TOTAL',
                  'N_ITEMS','ITEMS_JSON','STATUS','AP_ID','NOTE'];

function apOcrSheet_(name, header) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1, header.length).setValues([header]);
    s.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#1A237E').setFontColor('#FFF');
    s.setFrozenRows(1);
  }
  return s;
}

// ── 1. สร้างคิวจากโฟลเดอร์ Drive ────────────────────────────
function apOcrBuildQueue() {
  var folders = DriveApp.getFoldersByName(AP_OCR_FOLDER);
  if (!folders.hasNext()) {
    Logger.log('ไม่พบโฟลเดอร์ ' + AP_OCR_FOLDER + ' ใน Drive');
    return { ok:false, msg:'ไม่พบโฟลเดอร์ ' + AP_OCR_FOLDER };
  }
  var folder = folders.next();
  var q = apOcrSheet_(AP_OCR_QUEUE, H_AP_QUEUE);

  // ไฟล์ที่อยู่ในคิวแล้ว (กันซ้ำ)
  var seen = {};
  if (q.getLastRow() > 1) {
    var old = q.getRange(2, 1, q.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < old.length; i++) { seen[String(old[i][0])] = true; }
  }

  var files = folder.getFiles(), add = [], skip = 0;
  while (files.hasNext()) {
    var f = files.next();
    var mt = f.getMimeType();
    if (mt !== 'image/jpeg' && mt !== 'image/png') { continue; }
    if (seen[f.getId()]) { skip++; continue; }
    add.push([f.getId(), f.getName(), 'รอ', '', '']);
  }
  add.sort(function(a, b) { return a[1] < b[1] ? -1 : (a[1] > b[1] ? 1 : 0); });
  if (add.length) { q.getRange(q.getLastRow() + 1, 1, add.length, H_AP_QUEUE.length).setValues(add); }

  var msg = 'เพิ่มเข้าคิว ' + add.length + ' ใบ (มีอยู่แล้วข้าม ' + skip + ')';
  Logger.log(msg);
  return { ok:true, added:add.length, skipped:skip, msg:msg };
}

// ── prompt ──────────────────────────────────────────────────
function apOcrPrompt_() {
  return 'คุณเป็นผู้ช่วยอ่านใบกำกับภาษี/ใบส่งสินค้าภาษาไทย อ่านจากภาพแล้วตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น\n'
    + '{"supplierName":"ชื่อผู้ขาย","supplierTaxId":"เลขผู้เสียภาษี 13 หลัก หรือ null",'
    + '"invoiceNo":"เลขที่ใบกำกับ","invoiceDate":"YYYY-MM-DD","dueDate":"YYYY-MM-DD หรือ null",'
    + '"subtotal":ตัวเลข,"vatAmount":ตัวเลข,"totalAmount":ตัวเลข,'
    + '"items":[{"productCode":"รหัสสินค้า หรือ null","description":"ชื่อสินค้า","quantity":ตัวเลข,'
    + '"unit":"หน่วย","unitPrice":ตัวเลข,"amount":ตัวเลข,"isFoc":false}]}\n'
    + 'วันที่ถ้าเป็น พ.ศ. ให้ลบ 543 เป็น ค.ศ. · สินค้าแถม/FOC ใส่ isFoc:true และ unitPrice:0 · อ่านไม่ได้ใส่ null หรือ 0';
}

// ── 2. รันคิว (ทำต่อเองจนครบ) ───────────────────────────────
function apOcrRun() {
  var t0 = Date.now();
  var cfg = getConfig();
  var apiKey = cfg && cfg.GEMINI_API_KEY;
  if (!apiKey) { Logger.log('ไม่พบ GEMINI_API_KEY ใน CONFIG'); return; }

  var model = gemModels_()[0];
  var q = apOcrSheet_(AP_OCR_QUEUE, H_AP_QUEUE);
  var stg = apOcrSheet_(AP_OCR_STAGING, H_AP_STG);
  if (q.getLastRow() <= 1) { Logger.log('คิวว่าง — รัน apOcrBuildQueue() ก่อน'); return; }

  var sup = apOcrSupplierIndex_();
  var rows = q.getRange(2, 1, q.getLastRow() - 1, H_AP_QUEUE.length).getValues();
  var doneThisRun = 0, errThisRun = 0, batches = 0;

  while (true) {
    // เก็บงานที่ยังไม่ทำ ชุดละ AP_OCR_PARALLEL
    var pick = [];
    for (var i = 0; i < rows.length && pick.length < AP_OCR_PARALLEL; i++) {
      if (String(rows[i][2]) === 'รอ') { pick.push({ r:i + 2, id:rows[i][0], name:rows[i][1] }); }
    }
    if (!pick.length) { break; }
    if (Date.now() - t0 > AP_OCR_BUDGET_MS) { break; }   // หมดเวลารอบนี้ — ไว้รอบหน้า

    // เตรียม request
    var reqs = [];
    for (var j = 0; j < pick.length; j++) {
      var b64 = Utilities.base64Encode(DriveApp.getFileById(pick[j].id).getBlob().getBytes());
      reqs.push({
        url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey,
        method:'post', contentType:'application/json', muteHttpExceptions:true,
        payload: JSON.stringify({
          contents: [{ parts: [ { text: apOcrPrompt_() }, { inline_data: { mime_type:'image/jpeg', data:b64 } } ] }],
          generationConfig: { temperature:0.1, maxOutputTokens:8192 }
        })
      });
    }

    var resArr;
    try { resArr = UrlFetchApp.fetchAll(reqs); }
    catch (e) { Logger.log('fetchAll ล้มเหลว: ' + e); break; }
    batches++;

    var stgAdd = [], now = new Date();
    for (var k = 0; k < pick.length; k++) {
      var okRow = false, errMsg = '';
      try {
        if (resArr[k].getResponseCode() !== 200) {
          errMsg = 'HTTP ' + resArr[k].getResponseCode() + ' ' + resArr[k].getContentText().substring(0, 120);
        } else {
          var raw = JSON.parse(resArr[k].getContentText()).candidates[0].content.parts[0].text;
          var m = raw.match(/\{[\s\S]*\}/);
          if (!m) { errMsg = 'ไม่พบ JSON ในคำตอบ'; }
          else {
            var d = JSON.parse(m[0]);
            var items = d.items || [];
            var sName = String(d.supplierName || '');
            var hit = apOcrMatchSupplier_(sName, sup);
            stgAdd.push([
              'STG-' + String(pick[k].name).replace(/\.[^.]+$/, ''),
              pick[k].name,
              sName,
              hit.code, hit.name, hit.how,
              String(d.invoiceNo || ''),
              String(d.invoiceDate || ''),
              String(d.dueDate || ''),
              Number(d.subtotal) || 0,
              Number(d.vatAmount) || 0,
              Number(d.totalAmount) || 0,
              items.length,
              JSON.stringify(items).substring(0, 45000),
              'รอตรวจ', '', ''
            ]);
            okRow = true;
          }
        }
      } catch (e2) { errMsg = String(e2).substring(0, 150); }

      if (okRow) { q.getRange(pick[k].r, 3, 1, 3).setValues([['เสร็จ', now, '']]); doneThisRun++; }
      else       { q.getRange(pick[k].r, 3, 1, 3).setValues([['ผิดพลาด', now, errMsg]]); errThisRun++; }
      rows[pick[k].r - 2][2] = okRow ? 'เสร็จ' : 'ผิดพลาด';
    }
    if (stgAdd.length) { stg.getRange(stg.getLastRow() + 1, 1, stgAdd.length, H_AP_STG.length).setValues(stgAdd); }
    SpreadsheetApp.flush();
    if (AP_OCR_MAX_BATCHES && batches >= AP_OCR_MAX_BATCHES) { break; }   // โหมดทดลอง
  }

  // เหลืออีกไหม
  var left = 0;
  for (var z = 0; z < rows.length; z++) { if (String(rows[z][2]) === 'รอ') { left++; } }
  var secs = Math.round((Date.now() - t0) / 1000);
  Logger.log('รอบนี้: สำเร็จ ' + doneThisRun + ' · ผิดพลาด ' + errThisRun + ' · ' + batches + ' ชุด · ' + secs + ' วิ · เหลืออีก ' + left);

  apOcrClearTriggers_();
  if (left > 0) {
    ScriptApp.newTrigger('apOcrContinue').timeBased().after(60 * 1000).create();
    Logger.log('ตั้งเวลาทำต่ออัตโนมัติอีก 1 นาที (เหลือ ' + left + ' ใบ) — ปิดหน้าต่างได้เลย');
  } else {
    Logger.log('OCR ครบทุกใบแล้ว — ไปตรวจที่ชีต ' + AP_OCR_STAGING);
  }
  return { ok:true, done:doneThisRun, error:errThisRun, left:left };
}

// ตัวที่ trigger เรียก (ห้ามลงท้าย _ ไม่งั้น trigger เรียกไม่ได้)
function apOcrContinue() { apOcrClearTriggers_(); apOcrRun(); }

function apOcrClearTriggers_() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) {
    if (ts[i].getHandlerFunction() === 'apOcrContinue') { ScriptApp.deleteTrigger(ts[i]); }
  }
}

// หยุดกลางคัน
function apOcrStop() {
  apOcrClearTriggers_();
  Logger.log('หยุดการทำงานต่ออัตโนมัติแล้ว (งานที่ทำไปแล้วยังอยู่ครบ) — สั่ง apOcrRun() เมื่อไรก็ทำต่อได้');
}

// ── จับคู่ผู้ขายกับ SUPPLIER_MASTER ─────────────────────────
function apOcrNorm_(s) {
  return String(s || '')
    .replace(/บริษัท|จำกัด|มหาชน|ห้างหุ้นส่วน|หจก\.?|บจก\.?|\(.*?\)|co\.?,?\s*ltd\.?|company|limited|public/gi, '')
    .replace(/[\s\-\.\,]/g, '')
    .toLowerCase();
}

function apOcrSupplierIndex_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sm = ss.getSheetByName('SUPPLIER_MASTER');
  var out = [];
  if (!sm || sm.getLastRow() <= 1) { return out; }
  var v = sm.getRange(2, 1, sm.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < v.length; i++) {
    var nm = String(v[i][1] || '');
    if (!nm) { continue; }
    out.push({ code:String(v[i][0] || ''), name:nm, norm:apOcrNorm_(nm) });
  }
  return out;
}

function apOcrMatchSupplier_(ocrName, idx) {
  var n = apOcrNorm_(ocrName);
  if (!n || !idx.length) { return { code:'', name:'', how:'ไม่พบ' }; }
  for (var i = 0; i < idx.length; i++) {
    if (idx[i].norm === n) { return { code:idx[i].code, name:idx[i].name, how:'ตรงเป๊ะ' }; }
  }
  var best = null, bestLen = 0;
  for (var j = 0; j < idx.length; j++) {
    var o = idx[j].norm;
    if (o.length < 4) { continue; }
    if (n.indexOf(o) >= 0 || o.indexOf(n) >= 0) {
      if (o.length > bestLen) { bestLen = o.length; best = idx[j]; }
    }
  }
  if (best) { return { code:best.code, name:best.name, how:'ใกล้เคียง' }; }
  return { code:'', name:'', how:'ไม่พบ' };
}

// จับคู่ผู้ขายใหม่ทั้งชีตพัก (ใช้หลังเพิ่มผู้ขายใน SUPPLIER_MASTER)
function apOcrRematchSuppliers() {
  var stg = apOcrSheet_(AP_OCR_STAGING, H_AP_STG);
  if (stg.getLastRow() <= 1) { Logger.log('ชีตพักว่าง'); return; }
  var idx = apOcrSupplierIndex_();
  var v = stg.getRange(2, 1, stg.getLastRow() - 1, H_AP_STG.length).getValues();
  var out = [], fixed = 0;
  for (var i = 0; i < v.length; i++) {
    var hit = apOcrMatchSupplier_(v[i][2], idx);
    if (hit.code && !v[i][3]) { fixed++; }
    out.push([hit.code, hit.name, hit.how]);
  }
  stg.getRange(2, 4, out.length, 3).setValues(out);
  Logger.log('จับคู่ผู้ขายใหม่ ' + out.length + ' แถว · จับคู่เพิ่มได้ ' + fixed + ' ราย');
}

// ── 3. สรุปสถานะ ────────────────────────────────────────────
function apOcrStatus() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var q = ss.getSheetByName(AP_OCR_QUEUE), stg = ss.getSheetByName(AP_OCR_STAGING);
  var out = ['═══════ สถานะนำเข้าบิล ═══════'];
  var cnt = { 'รอ':0, 'เสร็จ':0, 'ผิดพลาด':0 };
  if (q && q.getLastRow() > 1) {
    var v = q.getRange(2, 3, q.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < v.length; i++) { var k = String(v[i][0]); if (cnt[k] !== undefined) { cnt[k]++; } }
    out.push('คิว: รอ ' + cnt['รอ'] + ' · เสร็จ ' + cnt['เสร็จ'] + ' · ผิดพลาด ' + cnt['ผิดพลาด'] + ' (รวม ' + v.length + ')');
  } else { out.push('คิว: ว่าง'); }

  if (stg && stg.getLastRow() > 1) {
    var s = stg.getRange(2, 1, stg.getLastRow() - 1, H_AP_STG.length).getValues();
    var waiting = 0, pushed = 0, noSup = 0, noTotal = 0, sum = 0;
    for (var j = 0; j < s.length; j++) {
      var st = String(s[j][14]);
      if (st === 'รอตรวจ') { waiting++; } else if (st === 'เข้าเจ้าหนี้แล้ว') { pushed++; }
      if (!s[j][3]) { noSup++; }
      if (!Number(s[j][11])) { noTotal++; }
      sum += Number(s[j][11]) || 0;
    }
    out.push('ชีตพัก: รอตรวจ ' + waiting + ' · เข้าเจ้าหนี้แล้ว ' + pushed + ' (รวม ' + s.length + ')');
    out.push('ยอดรวมทุกใบ: ' + sum.toFixed(2) + ' บาท');
    out.push('ต้องแก้ก่อน: ไม่รู้จักผู้ขาย ' + noSup + ' ใบ · ยอดเป็น 0 ' + noTotal + ' ใบ');
  } else { out.push('ชีตพัก: ว่าง'); }

  var tg = ScriptApp.getProjectTriggers(), running = 0;
  for (var t = 0; t < tg.length; t++) { if (tg[t].getHandlerFunction() === 'apOcrContinue') { running++; } }
  out.push(running ? 'กำลังทำต่ออัตโนมัติอยู่' : 'ไม่มีงานค้างทำต่อ');
  Logger.log(out.join('\n'));
  return out.join('\n');
}

// ── 4. ดันเข้า AP_LEDGER (เจ้าหนี้จริง) ─────────────────────
// ปลอดภัย: ข้ามใบที่ไม่รู้จักผู้ขาย / ยอด 0 / ไม่มีเลขที่บิล / ซ้ำกับที่มีอยู่
function apOcrPushToAp() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var stg = ss.getSheetByName(AP_OCR_STAGING);
  if (!stg || stg.getLastRow() <= 1) { Logger.log('ชีตพักว่าง'); return; }
  var ap = ss.getSheetByName('AP_LEDGER');
  if (!ap) { Logger.log('ไม่พบ AP_LEDGER'); return; }

  // บิลที่มีอยู่แล้ว (กันซ้ำ) — คู่ ผู้ขาย+เลขที่บิล
  var have = {};
  if (ap.getLastRow() > 1) {
    var av = ap.getRange(2, 1, ap.getLastRow() - 1, 12).getValues();
    for (var i = 0; i < av.length; i++) {
      have[String(av[i][2]) + '|' + String(av[i][11])] = true;
      have[String(av[i][0])] = true;
    }
  }

  var cfg = getConfig();
  var entity = String((cfg && cfg.DEFAULT_ENTITY) || 'KLH');
  var v = stg.getRange(2, 1, stg.getLastRow() - 1, H_AP_STG.length).getValues();
  var addAp = [], mark = [], sk1 = 0, sk2 = 0, sk3 = 0, sk4 = 0, sk5 = 0, sum = 0;

  for (var r = 0; r < v.length; r++) {
    var row = v[r], st = String(row[14]);
    if (st === 'เข้าเจ้าหนี้แล้ว') { sk5++; mark.push([st, row[15], row[16]]); continue; }
    var code = String(row[3]), invNo = String(row[6]), total = Number(row[11]) || 0;
    if (!code)  { sk1++; mark.push(['ติดปัญหา', '', 'ไม่รู้จักผู้ขาย — เพิ่มใน SUPPLIER_MASTER แล้วสั่ง apOcrRematchSuppliers()']); continue; }
    if (!total) { sk2++; mark.push(['ติดปัญหา', '', 'ยอดรวมเป็น 0 — แก้ในชีตนี้ก่อน']); continue; }
    if (!invNo) { sk3++; mark.push(['ติดปัญหา', '', 'ไม่มีเลขที่บิล — แก้ในชีตนี้ก่อน']); continue; }

    var apId = 'AP-OCR-' + code + '-' + invNo;
    if (have[code + '|' + invNo] || have[apId]) { sk4++; mark.push(['ซ้ำ', apId, 'มีบิลนี้ในเจ้าหนี้แล้ว']); continue; }

    addAp.push([apId, '', code, String(row[4]), entity,
                String(row[7]), String(row[8]), total, 0, total, 'UNPAID', invNo]);
    have[code + '|' + invNo] = true;
    mark.push(['เข้าเจ้าหนี้แล้ว', apId, '']);
    sum += total;
  }

  if (addAp.length) { ap.getRange(ap.getLastRow() + 1, 1, addAp.length, 12).setValues(addAp); }
  stg.getRange(2, 15, mark.length, 3).setValues(mark);

  var msg = ['═══════ ดันเข้าเจ้าหนี้ ═══════',
    'เพิ่มเข้า AP_LEDGER ' + addAp.length + ' ใบ · ยอดรวม ' + sum.toFixed(2) + ' บาท',
    'ข้าม: ไม่รู้จักผู้ขาย ' + sk1 + ' · ยอด 0 ' + sk2 + ' · ไม่มีเลขบิล ' + sk3 + ' · ซ้ำ ' + sk4 + ' · ทำไปแล้ว ' + sk5,
    'ดูเหตุผลรายใบได้ที่คอลัมน์ NOTE ในชีต ' + AP_OCR_STAGING,
    'ขั้นต่อไป: ไปหน้า เทียบจ่าย BAYC เพื่อจับคู่ statement แล้วตัดบิล'].join('\n');
  Logger.log(msg);
  return msg;
}

// ── ลองใบเดียวก่อน (ดูว่าทุกอย่างต่อกันติดไหม) ───────────────
function apOcrTryOne() {
  var saved = AP_OCR_PARALLEL, savedMax = AP_OCR_MAX_BATCHES;
  AP_OCR_PARALLEL = 1; AP_OCR_MAX_BATCHES = 1;   // ทำ 1 ชุด = 1 ใบ แล้วหยุด
  var r = apOcrRun();
  AP_OCR_PARALLEL = saved; AP_OCR_MAX_BATCHES = savedMax;
  apOcrClearTriggers_();
  Logger.log('— ทดลอง 1 ใบเสร็จ ดูผลที่ชีต ' + AP_OCR_STAGING + ' แถวล่างสุด —');
  return r;
}
