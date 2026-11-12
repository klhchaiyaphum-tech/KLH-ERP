// ============================================================
//  ap_ocr.js — อ่านชุดเอกสารสแกน (ภพ.30 รายเดือน) ทีละมากๆ ด้วย Gemini
//  ไหลงาน: รูปหน้าเอกสารในโฟลเดอร์ Drive → คิว → OCR ยิงขนาน → ชีตพัก (1 แถว = 1 หน้า)
//           → pp30_import.js จับคู่/ตรวจ/นำเข้า (INVOICE_HEADER · AP_LEDGER · PRICE_LOG)
//  แยกชนิดหน้าเอง: report = ตารางรายงานภาษีซื้อ · invoice = ใบกำกับ · credit = ใบลดหนี้ · other
//  ชื่อไฟล์ KLH6910_p004.jpg → งวดภาษี 2026-10 (KLH + ปี พ.ศ. 2 หลัก + เดือน)
//  ทำงานต่อเองเป็นรอบๆ ไม่ติดลิมิต 6 นาทีของ GAS
//  Depends: SHEET_ID · getConfig() · gemModels_() (Code.js) · apNorm_ (ap_supplier.js) · apLoadAliases_ (ap_payable.js)
// ============================================================

var AP_OCR_FOLDER  = 'AP_OCR_INBOX';     // โฟลเดอร์ Drive ที่วางรูปหน้าเอกสาร
var AP_OCR_QUEUE   = 'AP_OCR_QUEUE';     // คิวงาน
var AP_OCR_STAGING = 'AP_OCR_STAGING';   // ชีตพัก 1 แถว = 1 หน้า
var AP_OCR_PARALLEL = 2;                 // ยิงพร้อมกันกี่หน้าต่อชุด (น้อยไว้ ไม่ชนโควตา Gemini)
var AP_OCR_BUDGET_MS = 270000;           // ใช้เวลาต่อรอบไม่เกิน 4.5 นาที (ลิมิตจริง 6)
var AP_OCR_MAX_BATCHES = 0;              // จำกัดจำนวนชุดต่อรอบ (0 = ไม่จำกัด) ใช้ตอนทดลอง
var AP_OCR_DAILY_CAP = 50;               // หน้าต่อวันสูงสุด กันเกินโควตา/เสียเงิน · ปรับได้ที่ CONFIG.AP_OCR_DAILY_CAP

var H_AP_QUEUE = ['FILE_ID','FILE_NAME','STATUS','OCR_AT','ERROR'];
// 0 STG_ID · 1 FILE_NAME · 2 PERIOD · 3 PAGE_TYPE · 4 SEQ · 5 SUPPLIER_OCR · 6 SUPPLIER_TAXID
// 7 SUPPLIER_CODE · 8 SUPPLIER_NAME · 9 MATCH · 10 BUYER_TAXID · 11 INVOICE_NO · 12 INVOICE_DATE
// 13 DUE_DATE · 14 SUBTOTAL · 15 VAT · 16 TOTAL · 17 N_ITEMS · 18 ITEMS_JSON · 19 STATUS · 20 NOTE · 21 FILE_ID
// 22 SUPPLIER_ADDR · 23 SUPPLIER_TEL
var H_AP_STG   = ['STG_ID','FILE_NAME','PERIOD','PAGE_TYPE','SEQ','SUPPLIER_OCR','SUPPLIER_TAXID',
                  'SUPPLIER_CODE','SUPPLIER_NAME','MATCH','BUYER_TAXID','INVOICE_NO','INVOICE_DATE',
                  'DUE_DATE','SUBTOTAL','VAT','TOTAL','N_ITEMS','ITEMS_JSON','STATUS','NOTE','FILE_ID',
                  'SUPPLIER_ADDR','SUPPLIER_TEL'];

// โควตารายวัน (จำใน Script Properties) → { day, pages, tokens }
function apOcrUsage_(addPages, addTokens) {
  var p = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  var u = {};
  try { u = JSON.parse(p.getProperty('AP_OCR_USAGE') || '{}'); } catch (e) {}
  if (u.day !== today) { u = { day:today, pages:0, tokens:0 }; }
  if (addPages || addTokens) {
    u.pages += addPages || 0; u.tokens += addTokens || 0;
    p.setProperty('AP_OCR_USAGE', JSON.stringify(u));
  }
  return u;
}

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

// ชื่อไฟล์ → งวดภาษี: KLH6910_p004.jpg → '2026-10'
function apOcrPeriod_(fileName) {
  var m = String(fileName || '').match(/KLH(\d{2})(\d{2})/i);
  if (!m) { return ''; }
  var ce = 2500 + Number(m[1]) - 543;
  return ce + '-' + m[2];
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

  var msg = 'เพิ่มเข้าคิว ' + add.length + ' หน้า (มีอยู่แล้วข้าม ' + skip + ')';
  Logger.log(msg);
  return { ok:true, added:add.length, skipped:skip, msg:msg };
}

// ── prompt ──────────────────────────────────────────────────
function apOcrPrompt_() {
  return 'อ่านภาพเอกสารบัญชีภาษาไทยหน้านี้ แล้วตอบเป็น JSON อย่างเดียว ห้ามมีข้อความอื่น\n'
    + 'ขั้นที่ 1 ระบุชนิดหน้า pageType:\n'
    + '  "report"  = ตารางรายงานภาษีซื้อ มีคอลัมน์ ลำดับ/วันที่/เลขที่/ชื่อบริษัท/มูลค่าสินค้า/ภาษี/รวม\n'
    + '  "invoice" = ใบกำกับภาษี/ใบส่งสินค้า/ใบแจ้งหนี้ ที่ผู้ขายออกให้\n'
    + '  "credit"  = ใบลดหนี้/ใบรับคืนสินค้า\n'
    + '  "other"   = อย่างอื่น เช่น ใบเสร็จ ใบวางบิล หน้าว่าง\n'
    + 'ขั้นที่ 2 ตอบตามชนิดหน้า\n'
    + 'ถ้าเป็น report: {"pageType":"report","rows":[{"seq":ลำดับ,"date":"YYYY-MM-DD","invoiceNo":"","supplier":"",'
    + '"base":มูลค่าสินค้า,"vat":ภาษี,"total":รวม}],"grandTotal":{"base":0,"vat":0,"total":0} หรือ null ถ้าหน้านี้ไม่มีแถวยอดรวม}\n'
    + 'ถ้าเป็น invoice/credit/other: {"pageType":"invoice","seq":ตัวเลขที่เขียนด้วยมือแล้ววงกลมไว้ หรือ null,'
    + '"pageNo":"เลขหน้า เช่น 1/2 หรือ null","supplierName":"","supplierTaxId":"13 หลัก หรือ null",'
    + '"supplierAddress":"ที่อยู่ผู้ขาย รวมชื่อสาขา หรือ null","supplierPhone":"เบอร์โทรผู้ขาย หรือ null",'
    + '"buyerName":"","buyerTaxId":"13 หลัก หรือ null","invoiceNo":"","invoiceDate":"YYYY-MM-DD",'
    + '"dueDate":"YYYY-MM-DD หรือ null","subtotal":ยอดก่อนภาษี,"vatAmount":ภาษี,"totalAmount":ยอดสุทธิ,'
    + '"items":[{"productCode":"รหัสหรือบาร์โค้ด หรือ null","description":"ชื่อสินค้า",'
    + '"quantity":จำนวนที่ใช้คิดราคา,"unit":"หน่วยที่ใช้คิดราคา","unitPrice":ราคาต่อหน่วยหลังหักส่วนลด,'
    + '"discount":ส่วนลดต่อหน่วย,"amount":จำนวนเงินรวมบรรทัด,"isFoc":false}]}\n'
    + 'กติกา: ปี พ.ศ. ให้ลบ 543 เป็น ค.ศ. · ปี 2 หลัก เช่น 69 คือ พ.ศ. 2569 = ค.ศ. 2026 · '
    + 'ตัวเลขเงินเป็นตัวเลขล้วนไม่มีจุลภาค · ช่องที่เป็นขีด - ให้ใส่ 0 · '
    + 'ตัวเลขที่คนเขียนด้วยมือเพิ่มบนใบ (เช่น ราคาต่อชิ้นที่จดไว้) ไม่ใช่รายการสินค้า · '
    + 'สินค้าแถม/FOC ใส่ isFoc:true และ unitPrice:0 · อ่านไม่ออกใส่ null';
}

// ── 2. รันคิว (ทำต่อเองจนครบ) ───────────────────────────────
function apOcrRun() {
  var t0 = Date.now();
  var cfg = getConfig();
  var apiKey = cfg && cfg.GEMINI_API_KEY;
  if (!apiKey) { Logger.log('ไม่พบ GEMINI_API_KEY ใน CONFIG'); return; }

  var models = gemModels_(), mi = 0;
  var q = apOcrSheet_(AP_OCR_QUEUE, H_AP_QUEUE);
  var stg = apOcrSheet_(AP_OCR_STAGING, H_AP_STG);
  if (q.getLastRow() <= 1) { Logger.log('คิวว่าง — รัน apOcrBuildQueue() ก่อน'); return; }

  var sup = apOcrSupplierIndex_();
  var rows = q.getRange(2, 1, q.getLastRow() - 1, H_AP_QUEUE.length).getValues();
  var doneThisRun = 0, errThisRun = 0, batches = 0, busy = false, capHit = false, noThink = false, tokRun = 0;
  var cap = Number(cfg.AP_OCR_DAILY_CAP) || AP_OCR_DAILY_CAP;

  while (true) {
    var used = apOcrUsage_();
    if (used.pages >= cap) { capHit = true; break; }     // ครบโควตาวันนี้ — ทำต่อพรุ่งนี้
    // เก็บงานที่ยังไม่ทำ ชุดละ AP_OCR_PARALLEL (ไม่เกินโควตาที่เหลือ)
    var pick = [], room = Math.min(AP_OCR_PARALLEL, cap - used.pages);
    for (var i = 0; i < rows.length && pick.length < room; i++) {
      if (String(rows[i][2]) === 'รอ') { pick.push({ r:i + 2, id:rows[i][0], name:rows[i][1] }); }
    }
    if (!pick.length) { break; }
    if (Date.now() - t0 > AP_OCR_BUDGET_MS) { break; }   // หมดเวลารอบนี้ — ไว้รอบหน้า

    // เตรียม request · รุ่น gemini-3 ตั้งให้คิดน้อย (ประหยัด token) ถ้ารุ่นไม่รับค่อยตัดออก
    var gen = { temperature:0.1, maxOutputTokens:16384, responseMimeType:'application/json' };
    if (!noThink && /^gemini-3/.test(models[mi])) { gen.thinkingConfig = { thinkingLevel:'low' }; }
    var reqs = [];
    for (var j = 0; j < pick.length; j++) {
      var blob = DriveApp.getFileById(pick[j].id).getBlob();
      reqs.push({
        url: 'https://generativelanguage.googleapis.com/v1beta/models/' + models[mi] + ':generateContent?key=' + apiKey,
        method:'post', contentType:'application/json', muteHttpExceptions:true,
        payload: JSON.stringify({
          contents: [{ parts: [ { text: apOcrPrompt_() },
                                { inline_data: { mime_type:blob.getContentType(), data:Utilities.base64Encode(blob.getBytes()) } } ] }],
          generationConfig: gen
        })
      });
    }

    var resArr;
    try { resArr = UrlFetchApp.fetchAll(reqs); }
    catch (e) { Logger.log('fetchAll ล้มเหลว: ' + e); break; }

    var stgAdd = [], now = new Date(), gone = false, thinkBad = false, tried = 0, tokBatch = 0;
    for (var k = 0; k < pick.length; k++) {
      var code = resArr[k].getResponseCode();
      // รุ่นถูกปลด → เปลี่ยนรุ่น · คิว/โควตาเต็ม → เก็บไว้รอบหน้า (ไม่นับว่าผิดพลาด)
      if (code === 404) { gone = true; continue; }
      if (code === 429 || code === 503) { busy = true; continue; }
      if (code === 400 && gen.thinkingConfig && /thinking/i.test(resArr[k].getContentText())) { thinkBad = true; continue; }
      tried++;
      var built = null, errMsg = '';
      try {
        if (code !== 200) { errMsg = 'HTTP ' + code + ' ' + resArr[k].getContentText().substring(0, 120); }
        else {
          var body = JSON.parse(resArr[k].getContentText());
          tokBatch += (body.usageMetadata && body.usageMetadata.totalTokenCount) || 0;
          var raw = body.candidates[0].content.parts[0].text;
          var m = raw.match(/\{[\s\S]*\}/);
          if (!m) { errMsg = 'ไม่พบ JSON ในคำตอบ'; }
          else { built = apOcrStagingRow_(pick[k], JSON.parse(m[0]), sup); }
        }
      } catch (e2) { errMsg = String(e2).substring(0, 150); }

      if (built) { stgAdd.push(built); q.getRange(pick[k].r, 3, 1, 3).setValues([['เสร็จ', now, '']]); doneThisRun++; }
      else       { q.getRange(pick[k].r, 3, 1, 3).setValues([['ผิดพลาด', now, errMsg]]); errThisRun++; }
      rows[pick[k].r - 2][2] = built ? 'เสร็จ' : 'ผิดพลาด';
    }
    if (stgAdd.length) {
      var rg = stg.getRange(stg.getLastRow() + 1, 1, stgAdd.length, H_AP_STG.length);
      rg.setNumberFormat('@');   // กันชีตแปลง '2026-10' / เลขบิล เป็นวันที่-ตัวเลข
      rg.setValues(stgAdd);
    }
    SpreadsheetApp.flush();
    if (tried || tokBatch) { apOcrUsage_(tried, tokBatch); tokRun += tokBatch; }
    if (thinkBad) { noThink = true; Logger.log('รุ่นนี้ไม่รับการตั้งค่าคิดน้อย → ส่งใหม่แบบปกติ'); continue; }
    if (gone) {
      mi++;
      if (mi >= models.length) { Logger.log('❌ Gemini ทุกรุ่นใน gemModels_() ใช้ไม่ได้ (404) — แก้รายชื่อรุ่นใน Code.js'); break; }
      Logger.log('รุ่นเดิมถูกปลด → เปลี่ยนไปใช้ ' + models[mi]);
      continue;   // ชุดนี้ไม่นับ ส่งหน้าเดิมซ้ำด้วยรุ่นถัดไป
    }
    if (busy) { Logger.log('Gemini คิวเต็ม (429/503) — พักไว้ทำต่อรอบหน้า'); break; }
    batches++;
    if (AP_OCR_MAX_BATCHES && batches >= AP_OCR_MAX_BATCHES) { break; }   // โหมดทดลอง
  }

  // เหลืออีกไหม
  var left = 0;
  for (var z = 0; z < rows.length; z++) { if (String(rows[z][2]) === 'รอ') { left++; } }
  var secs = Math.round((Date.now() - t0) / 1000);
  var u = apOcrUsage_();
  Logger.log('รอบนี้: สำเร็จ ' + doneThisRun + ' · ผิดพลาด ' + errThisRun + ' · ' + batches + ' ชุด · ' + secs + ' วิ · เหลืออีก ' + left
             + '\ntoken รอบนี้ ' + tokRun + ' · วันนี้ใช้ไป ' + u.pages + '/' + cap + ' หน้า ' + u.tokens + ' token');

  apOcrClearTriggers_();
  if (left > 0 && !AP_OCR_MAX_BATCHES && mi < models.length) {
    if (capHit) {   // ครบโควตาวันนี้ → พรุ่งนี้ตี 2
      var t = new Date(); t.setDate(t.getDate() + 1); t.setHours(2, 0, 0, 0);
      ScriptApp.newTrigger('apOcrContinue').timeBased().at(t).create();
      Logger.log('ครบโควตาวันนี้ ' + cap + ' หน้า — ทำต่อเองพรุ่งนี้ 02:00 (เหลือ ' + left + ' หน้า)');
    } else if (busy) {   // Gemini บอกโควตา/คิวเต็ม → พัก 1 ชม.
      ScriptApp.newTrigger('apOcrContinue').timeBased().after(60 * 60 * 1000).create();
      Logger.log('Gemini โควตา/คิวเต็ม — พัก 1 ชั่วโมงแล้วทำต่อเอง (เหลือ ' + left + ' หน้า)');
    } else {
      ScriptApp.newTrigger('apOcrContinue').timeBased().after(60 * 1000).create();
      Logger.log('ตั้งเวลาทำต่ออัตโนมัติอีก 1 นาที (เหลือ ' + left + ' หน้า) — ปิดหน้าต่างได้เลย');
    }
  } else if (!left) {
    Logger.log('OCR ครบทุกหน้าแล้ว — ขั้นต่อไปรัน pp30Build()');
  }
  return { ok:true, done:doneThisRun, error:errThisRun, left:left };
}

// คำตอบ Gemini 1 หน้า → แถวชีตพัก
function apOcrStagingRow_(p, d, sup) {
  var type = String(d.pageType || 'other').toLowerCase();
  var stgId = 'STG-' + String(p.name).replace(/\.[^.]+$/, '');
  var period = apOcrPeriod_(p.name);
  var json;
  if (type === 'report') {
    var gt = d.grandTotal || null;
    json = JSON.stringify(d.rows || []);
    return [stgId, p.name, period, 'report', '', '', '', '', '', '', '', '', '', '',
            gt ? Number(gt.base) || 0 : '', gt ? Number(gt.vat) || 0 : '', gt ? Number(gt.total) || 0 : '',
            (d.rows || []).length, json.length > 45000 ? '[]' : json, 'รอตรวจ',
            json.length > 45000 ? 'รายการยาวเกินเก็บ' : '', String(p.id), '', ''];
  }
  var items = d.items || [];
  var sName = String(d.supplierName || '');
  var sTax = String(d.supplierTaxId || '').replace(/\D/g, '');
  var hit = apOcrMatchSupplier_(sName, sTax, sup);
  json = JSON.stringify(items);
  return [stgId, p.name, period, type, d.seq === null || d.seq === undefined ? '' : String(d.seq),
          sName, sTax, hit.code, hit.name, hit.how,
          String(d.buyerTaxId || '').replace(/\D/g, ''),
          String(d.invoiceNo || ''), String(d.invoiceDate || ''), String(d.dueDate || ''),
          Number(d.subtotal) || 0, Number(d.vatAmount) || 0, Number(d.totalAmount) || 0,
          items.length, json.length > 45000 ? '[]' : json, 'รอตรวจ',
          (d.pageNo ? 'หน้า ' + d.pageNo : '') + (json.length > 45000 ? ' รายการยาวเกินเก็บ' : ''), String(p.id),
          String(d.supplierAddress || ''), String(d.supplierPhone || '')];
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

// หน้าที่ผิดพลาด → กลับเข้าคิวใหม่
function apOcrRetryErrors() {
  var q = apOcrSheet_(AP_OCR_QUEUE, H_AP_QUEUE);
  if (q.getLastRow() <= 1) { return; }
  var v = q.getRange(2, 3, q.getLastRow() - 1, 1).getValues(), n = 0;
  for (var i = 0; i < v.length; i++) { if (String(v[i][0]) === 'ผิดพลาด') { v[i][0] = 'รอ'; n++; } }
  q.getRange(2, 3, v.length, 1).setValues(v);
  Logger.log('ส่งกลับเข้าคิว ' + n + ' หน้า — รัน apOcrRun() ต่อ');
}

// ── จับคู่ผู้ขายกับ SUPPLIER_MASTER (เลขภาษี → ชื่อแฝด → ชื่อ) ─────────
function apOcrNorm_(s) {
  return String(s || '')
    .replace(/บริษัท|จำกัด|มหาชน|ห้างหุ้นส่วน|บมจ\.?|หจก\.?|บจก\.?|\(.*?\)|co\.?,?\s*ltd\.?|company|limited|public/gi, '')
    .replace(/[\s\-\.\,]/g, '')
    .toLowerCase();
}

function apOcrSupplierIndex_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sm = ss.getSheetByName('SUPPLIER_MASTER');
  var out = { list:[], byTax:{}, alias:{} };
  try { out.alias = apLoadAliases_(); } catch (eA) {}
  if (!sm || sm.getLastRow() <= 1) { return out; }
  var v = sm.getRange(2, 1, sm.getLastRow() - 1, 10).getValues();
  for (var i = 0; i < v.length; i++) {
    var nm = String(v[i][1] || '');
    if (!nm || nm.indexOf('⊘') >= 0) { continue; }   // ⊘ = ผู้ขายที่ยุบรวมแล้ว
    var it = { code:String(v[i][0] || ''), name:nm, norm:apOcrNorm_(nm),
               tax:String(v[i][5] || '').replace(/\D/g, ''), credit:Number(v[i][9]) || 0 };
    out.list.push(it);
    if (it.tax.length === 13 && !out.byTax[it.tax]) { out.byTax[it.tax] = it; }
  }
  return out;
}

function apOcrMatchSupplier_(ocrName, taxId, idx) {
  var none = { code:'', name:'', how:'ไม่พบ' };
  var tax = String(taxId || '').replace(/\D/g, '');
  if (tax.length === 13 && idx.byTax[tax]) { return { code:idx.byTax[tax].code, name:idx.byTax[tax].name, how:'เลขภาษีตรง' }; }
  var n = apOcrNorm_(ocrName);
  if (!n || !idx.list.length) { return none; }
  var ac = idx.alias[apNorm_(ocrName)];
  if (ac) {
    for (var a = 0; a < idx.list.length; a++) { if (idx.list[a].code === ac) { return { code:ac, name:idx.list[a].name, how:'ชื่อแฝด' }; } }
  }
  for (var i = 0; i < idx.list.length; i++) {
    if (idx.list[i].norm === n) { return { code:idx.list[i].code, name:idx.list[i].name, how:'ชื่อตรง' }; }
  }
  var best = null, bestLen = 0;
  for (var j = 0; j < idx.list.length; j++) {
    var o = idx.list[j].norm;
    if (o.length < 4) { continue; }
    if (n.indexOf(o) >= 0 || o.indexOf(n) >= 0) {
      if (o.length > bestLen) { bestLen = o.length; best = idx.list[j]; }
    }
  }
  if (best) { return { code:best.code, name:best.name, how:'ใกล้เคียง' }; }
  return none;
}

// จับคู่ผู้ขายใหม่ทั้งชีตพัก (ใช้หลังเพิ่มผู้ขาย/เลขภาษีใน SUPPLIER_MASTER)
function apOcrRematchSuppliers() {
  var stg = apOcrSheet_(AP_OCR_STAGING, H_AP_STG);
  if (stg.getLastRow() <= 1) { Logger.log('ชีตพักว่าง'); return; }
  var idx = apOcrSupplierIndex_();
  var v = stg.getRange(2, 1, stg.getLastRow() - 1, H_AP_STG.length).getValues();
  var out = [], fixed = 0;
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][3]) === 'report') { out.push([v[i][7], v[i][8], v[i][9]]); continue; }
    var hit = apOcrMatchSupplier_(v[i][5], v[i][6], idx);
    if (hit.code && !v[i][7]) { fixed++; }
    out.push([hit.code, hit.name, hit.how]);
  }
  stg.getRange(2, 8, out.length, 3).setValues(out);
  Logger.log('จับคู่ผู้ขายใหม่ ' + out.length + ' แถว · จับคู่เพิ่มได้ ' + fixed + ' หน้า');
}

// ── 3. สรุปสถานะ ────────────────────────────────────────────
function apOcrStatus() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var q = ss.getSheetByName(AP_OCR_QUEUE), stg = ss.getSheetByName(AP_OCR_STAGING);
  var out = ['═══════ สถานะอ่านเอกสาร ═══════'];
  var cnt = { 'รอ':0, 'เสร็จ':0, 'ผิดพลาด':0 };
  if (q && q.getLastRow() > 1) {
    var v = q.getRange(2, 3, q.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < v.length; i++) { var k = String(v[i][0]); if (cnt[k] !== undefined) { cnt[k]++; } }
    out.push('คิว: รอ ' + cnt['รอ'] + ' · เสร็จ ' + cnt['เสร็จ'] + ' · ผิดพลาด ' + cnt['ผิดพลาด'] + ' (รวม ' + v.length + ')');
  } else { out.push('คิว: ว่าง'); }

  if (stg && stg.getLastRow() > 1) {
    var s = stg.getRange(2, 1, stg.getLastRow() - 1, H_AP_STG.length).getValues();
    var per = {};
    for (var j = 0; j < s.length; j++) {
      var p = String(s[j][2]) || '(ไม่ทราบงวด)', t = String(s[j][3]);
      var c = per[p] || (per[p] = { report:0, invoice:0, credit:0, other:0, noSup:0 });
      c[t] = (c[t] || 0) + 1;
      if (t === 'invoice' && !s[j][7]) { c.noSup++; }
    }
    Object.keys(per).sort().forEach(function(p) {
      var c = per[p];
      out.push(p + ': รายงาน ' + c.report + ' หน้า · ใบกำกับ ' + c.invoice + ' · ใบลดหนี้ ' + c.credit
               + ' · อื่นๆ ' + c.other + ' · ไม่รู้จักผู้ขาย ' + c.noSup);
    });
  } else { out.push('ชีตพัก: ว่าง'); }

  var tg = ScriptApp.getProjectTriggers(), running = 0;
  for (var t2 = 0; t2 < tg.length; t2++) { if (tg[t2].getHandlerFunction() === 'apOcrContinue') { running++; } }
  out.push(running ? 'กำลังทำต่ออัตโนมัติอยู่' : 'ไม่มีงานค้างทำต่อ');
  var u = apOcrUsage_(), cfg = getConfig();
  out.push('Gemini วันนี้: ' + u.pages + '/' + (Number(cfg.AP_OCR_DAILY_CAP) || AP_OCR_DAILY_CAP) + ' หน้า · ' + u.tokens + ' token');
  Logger.log(out.join('\n'));
  return out.join('\n');
}

// ── ลองชุดเดียวก่อน (AP_OCR_PARALLEL หน้าแรก) ดูว่าทุกอย่างต่อกันติดไหม ─────────
function apOcrTryOne() {
  var savedMax = AP_OCR_MAX_BATCHES;
  AP_OCR_MAX_BATCHES = 1;   // ทำ 1 ชุดแล้วหยุด ไม่ตั้ง trigger ต่อ
  var r = apOcrRun();
  AP_OCR_MAX_BATCHES = savedMax;
  apOcrClearTriggers_();
  Logger.log('— ทดลอง 1 ชุดเสร็จ ดูผลที่ชีต ' + AP_OCR_STAGING + ' — ถ้าโอเค รัน apOcrRun() ทำที่เหลือ —');
  return r;
}
