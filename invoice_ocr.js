// ============================================================
//  ocr.js — KLH Invoice OCR Backend
//  Depends: SHEET_ID (Code.js), ss_() / sh_() / fmt_() (inventory.js)
// ============================================================

const SH_INV_H = 'INVOICE_HEADER';
const SH_INV_D = 'INVOICE_DETAIL';

const H_INV_H = ['RECV_NO','INVOICE_NO','INVOICE_DATE','SUPPLIER_NAME',
                 'TAX_ENTITY','SUBTOTAL','VAT_AMT','TOTAL_AMT',
                 'STATUS','PDF_URL','NOTE','CREATED_BY','CREATED_DATE'];
const H_INV_D = ['RECV_NO','LINE_NO','BARCODE','PRODUCT_NAME',
                 'QTY','UNIT','UNIT_PRICE','DISCOUNT','LINE_TOTAL'];

// ── Init Sheets ───────────────────────────────────────────────
function initOcrSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const defs = [[SH_INV_H, H_INV_H], [SH_INV_D, H_INV_D]];
  const results = [];
  defs.forEach(function(def) {
    var name = def[0], hdr = def[1];
    var s = ss.getSheetByName(name);
    if (!s) { s = ss.insertSheet(name); }
    if (s.getLastRow() === 0 || s.getRange(1,1).getValue() !== hdr[0]) {
      s.clearContents();
      s.getRange(1,1,1,hdr.length).setValues([hdr])
        .setBackground('#1A237E').setFontColor('#fff').setFontWeight('bold');
      s.setFrozenRows(1);
    }
    results.push(name);
  });
  return 'init: ' + results.join(', ');
}

// ── Upload File to Drive ──────────────────────────────────────
function uploadInvoiceFile(base64Data, mimeType, entity) {
  try {
    var cfg = getConfig();
    var now = new Date();

    // Decode base64 → blob
    var bytes  = Utilities.base64Decode(base64Data);
    var ext    = (mimeType === 'application/pdf') ? 'pdf' : 'jpg';
    var recvNo = generateRecvNo_(now);
    var fname  = recvNo + '.' + ext;
    var blob   = Utilities.newBlob(bytes, mimeType, fname);

    // Get or create folder: root/Entity/YYYY/MM
    var folder = getInvoiceFolder_(cfg, entity, now);
    var file   = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // ── OCR: ลอง Gemini ก่อน, fallback ไป Drive OCR ──────────────
    var ocrText = '';
    var parsed  = {};
    var cfg2    = getConfig();
    if (cfg2 && cfg2.GEMINI_API_KEY) {
      // ── Gemini Vision ────────────────────────────────────────
      var gemRes = ocrWithGemini_(base64Data, mimeType, cfg2.GEMINI_API_KEY);
      if (gemRes.ok) {
        parsed  = { suggestions: gemRes.data, items: gemRes.items || [], lines: [] };
        ocrText = gemRes.rawText || JSON.stringify(gemRes.data, null, 2);
        Logger.log('Gemini OCR OK: ' + Object.keys(gemRes.data||{}).length + ' fields');
      } else {
        ocrText = '[Gemini Error] ' + gemRes.msg;
        Logger.log('Gemini OCR error: ' + gemRes.msg);
      }
    } else {
      // ── Fallback: Drive API v3 OCR ───────────────────────────
      try {
        ocrText = runDriveOcr_(file.getId());
      } catch(e) {
        Logger.log('Drive OCR error: ' + e);
        ocrText = '[OCR_ERROR] ' + String(e);
      }
      if (ocrText && !ocrText.startsWith('[OCR_ERROR]')) {
        parsed = parseInvoiceText(ocrText);
      }
    }

    return {
      ok: true,
      recvNo:   recvNo,
      fileId:   file.getId(),
      fileUrl:  file.getUrl(),
      mimeType: mimeType,
      ocrText:  ocrText,
      parsed:   parsed    // ← ข้อมูลที่ parse ได้
    };
  } catch(e) {
    return { ok: false, msg: e.message || String(e) };
  }
}

// ── Gemini Vision OCR ─────────────────────────────────────────
function ocrWithGemini_(base64Data, mimeType, apiKey) {
  var prompt = 'คุณเป็นผู้ช่วยอ่านใบกำกับภาษี/ใบส่งสินค้าภาษาไทย\n'
    + 'โปรดอ่านข้อมูลจากภาพนี้และตอบกลับเป็น JSON เท่านั้น ห้ามมี text อื่น\n'
    + 'Format:\n'
    + '{\n'
    + '  "supplierName": "ชื่อบริษัทผู้ขาย (ทั้งภาษาไทยและอังกฤษถ้ามี)",\n'
    + '  "supplierTaxId": "เลขประจำตัวผู้เสียภาษี 13 หลัก หรือ null",\n'
    + '  "invoiceNo": "เลขที่ใบกำกับ หรือ null",\n'
    + '  "invoiceDate": "วันที่ใบกำกับ format YYYY-MM-DD (แปลงจาก พ.ศ. เป็น ค.ศ. ด้วย) หรือ null",\n'
    + '  "subtotal": ยอดก่อนVAT_เป็นตัวเลข,\n'
    + '  "vatAmount": ยอดVAT_เป็นตัวเลข,\n'
    + '  "totalAmount": ยอดรวมสุทธิ_เป็นตัวเลข,\n'
    + '  "dueDate": "วันครบกำหนดชำระเงิน format YYYY-MM-DD หรือ null",\n'
    + '  "items": [\n'
    + '    {\n'
    + '      "productCode": "รหัสสินค้า หรือ null",\n'
    + '      "description": "ชื่อสินค้า",\n'
    + '      "quantity": จำนวน_เป็นตัวเลข,\n'
    + '      "unit": "หน่วย",\n'
    + '      "unitPrice": ราคาต่อหน่วย_เป็นตัวเลข,\n'
    + '      "amount": จำนวนเงินรวม_เป็นตัวเลข,\n'
    + '      "isFoc": false\n'
    + '    }\n'
    + '  ]\n'
    + '}\n'
    + 'หมายเหตุ: ถ้าสินค้ามีรายการแถม (FOC / แถม) ให้ใส่ isFoc: true และ unitPrice: 0\n'
    + 'ถ้าไม่พบข้อมูลบางส่วน ให้ใส่ null หรือ 0';

  var payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64Data } }
      ]
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
  };

  // ── ลอง models ตามลำดับ — fallback อัตโนมัติ ──────────────────
  var _models = ['gemini-3-flash-preview', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
  var code = 0, body = '';
  for (var _mi = 0; _mi < _models.length; _mi++) {
    var _url = 'https://generativelanguage.googleapis.com/v1beta/models/' + _models[_mi] + ':generateContent?key=' + apiKey;
    var _r = UrlFetchApp.fetch(_url, { method:'POST', contentType:'application/json', payload:JSON.stringify(payload), muteHttpExceptions:true });
    code = _r.getResponseCode();
    body = _r.getContentText();
    Logger.log('Gemini [' + _models[_mi] + '] HTTP ' + code);
    if (code === 200) { break; }
    if (code === 503 || code === 429) { Utilities.sleep(1500); } // รอ 1.5 วิแล้ว ลอง model ถัดไป
    else { break; } // error อื่น (400, 404 ฯลฯ) หยุดเลย
  }

  if (code !== 200) return { ok:false, msg:'Gemini HTTP ' + code + ': ' + body.substring(0,200) };

  try {
    var result = JSON.parse(body);
    if (result.error) return { ok:false, msg:result.error.message };
    var rawText = result.candidates[0].content.parts[0].text.trim();
    // strip markdown code block if present
    var jsonStr = rawText.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'');
    var data = JSON.parse(jsonStr);

    // Convert items to our format
    var items = (data.items || []).map(function(it) {
      return {
        barcode:     it.productCode || '',
        productName: it.description || '',
        qty:         it.isFoc ? it.quantity : it.quantity,
        buyQty:      it.isFoc ? 0 : it.quantity,
        freeQty:     it.isFoc ? it.quantity : 0,
        unit:        it.unit || '',
        unitPrice:   it.isFoc ? 0 : (it.unitPrice || 0),
        lineTotal:   it.amount || 0
      };
    });

    // Convert to suggestions format
    var sugg = {
      supplier:    data.supplierName   || '',
      taxId:       data.supplierTaxId  || '',
      invoiceNo:   data.invoiceNo      || '',
      invoiceDate: data.invoiceDate    || '',
      dueDate:     data.dueDate        || '',
      subtotal:    data.subtotal       || 0,
      vatAmt:      data.vatAmount      || 0,
      totalAmt:    data.totalAmount    || 0
    };

    return { ok:true, data:sugg, items:items, rawText:rawText };
  } catch(pe) {
    Logger.log('Gemini parse error: ' + pe + ' | raw: ' + body.substring(0,300));
    return { ok:false, msg:'parse error: ' + pe.message };
  }
}

// ── Google Drive OCR (Drive API v3) ───────────────────────────
function runDriveOcr_(fileId) {
  var res = Drive.Files.copy(
    { name: 'OCR_TEMP_' + Date.now(), mimeType: 'application/vnd.google-apps.document' },
    fileId,
    { ocrLanguage: 'th' }   // v3: ไม่ต้อง ocr:true, ไม่ต้อง supportsAllDrives
  );
  if (!res || !res.id) throw new Error('Drive.Files.copy returned empty result');
  var text = DocumentApp.openById(res.id).getBody().getText();
  try { DriveApp.getFileById(res.id).setTrashed(true); } catch(e2) {} // ใช้ DriveApp แทน delete_
  return text;
}

// ── Test OCR (รัน function นี้ใน GAS Editor เพื่อ diagnose) ──
function testOcrV3() {
  try {
    Logger.log('Step 1: Drive API available = ' + (typeof Drive !== 'undefined'));
    var blob = Utilities.newBlob('OCR Test Content 123', 'text/plain', 'ocr_test.txt');
    var tmp  = DriveApp.createFile(blob);
    Logger.log('Step 2: temp file created = ' + tmp.getId());
    var res = Drive.Files.copy(
      { name: 'OCR_TEST_DOC', mimeType: 'application/vnd.google-apps.document' },
      tmp.getId(),
      { ocrLanguage: 'th' }
    );
    Logger.log('Step 3: copy result = ' + JSON.stringify(res));
    var text = DocumentApp.openById(res.id).getBody().getText();
    Logger.log('Step 4: text = "' + text + '"');
    try { DriveApp.getFileById(res.id).setTrashed(true); } catch(e2) {}
    tmp.setTrashed(true);
    Logger.log('Step 5: cleanup OK');
    return 'OCR v3 OK: "' + text + '"';
  } catch(e) {
    Logger.log('testOcrV3 ERROR: ' + e);
    return 'ERROR: ' + String(e);
  }
}

// ── Parse OCR Text → Structured Suggestions ───────────────────
function parseInvoiceText(raw) {
  if (!raw) return {};
  var lines = raw.split('\n').map(function(l){ return l.trim(); }).filter(function(l){ return l.length>0; });
  var text  = raw;

  function find(pat) { var m=text.match(pat); return m?m[1].trim():''; }
  function findNum(pat) { return parseFloat((find(pat)||'0').replace(/,/g,''))||0; }
  function cleanN(s) { return parseFloat(String(s||'').replace(/,/g,''))||0; }

  // Supplier: first meaningful line (not address/phone)
  var supplierName = '';
  for (var i=0;i<Math.min(lines.length,6);i++) {
    var l=lines[i];
    if (l.length>3 && !/^\d/.test(l) && !/^(TEL|FAX|www|http)/i.test(l)) { supplierName=l; break; }
  }

  // Date DD/MM/YYYY (Buddhist or AD)
  var invoiceDate='';
  var dm=text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dm) {
    var dd=dm[1],mm=dm[2],yy=parseInt(dm[3]);
    if (yy>2500) yy-=543;
    if (yy<100)  yy+=(yy>50?1900:2000);
    invoiceDate=yy+'-'+mm.padStart(2,'0')+'-'+dd.padStart(2,'0');
  }

  // Invoice number
  var invoiceNo = find(/(?:เลขที่ใบกำกับ|invoice\s*no\.?)[:\s]*([A-Z0-9\-\/]+)/i)
               || find(/Order\s*No\.?[:\s]*(\S+)/i)
               || find(/(\d{4}[\/\-]\d{3,6})/);

  // TAX ID (13 digits of seller)
  var taxId = find(/(?:เลขประจำตัวผู้เสียภาษี|TAX\s*ID)[:\s]*(\d{13})/i)
           || (text.match(/\b(\d{13})\b/) ? text.match(/\b(\d{13})\b/)[1] : '');

  // Totals
  var subtotal = findNum(/(?:sub\s*total|รวมเงิน)[:\s]*([\d,]+\.?\d*)/i);
  var vatAmt   = findNum(/(?:V\.?A\.?T\.?|ภาษีมูลค่าเพิ่ม)[\s%7]*[:\s]*([\d,]+\.?\d*)/i);
  var totalAmt = findNum(/(?:net\s*total|ยอดเงินสุทธิ|ยอดสุทธิ|รวมทั้งสิ้น)[:\s]*([\d,]+\.?\d*)/i);
  if (!totalAmt && subtotal && vatAmt) totalAmt=subtotal+vatAmt;

  // Line items: product_code  description  qty  unit  price  amount
  var items=[];
  var re=/([A-Z0-9]{3,12}[\-\d]*)\s{2,}(.+?)\s+([\d]+)\s+(\S+)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/gm;
  var m2;
  while ((m2=re.exec(text))!==null) {
    items.push({barcode:m2[1],productName:m2[2].trim(),qty:parseFloat(m2[3])||0,unit:m2[4],unitPrice:cleanN(m2[5]),lineTotal:cleanN(m2[6])});
  }
  // FOC items (free of charge - no price shown)
  var fre=/([A-Z0-9]{3,12}[\-\d]*)\s{2,}(.+?FOC.*?)\s+([\d]+)\s+(\S+)/gmi;
  while ((m2=fre.exec(text))!==null) {
    var dup=items.some(function(it){ return it.barcode===m2[1]&&it.productName.indexOf('FOC')>=0; });
    if (!dup) items.push({barcode:m2[1],productName:m2[2].trim(),qty:parseFloat(m2[3])||0,unit:m2[4],unitPrice:0,lineTotal:0});
  }

  Logger.log('parseInvoiceText suggestions: '+JSON.stringify({supplierName:supplierName,invoiceNo:invoiceNo,invoiceDate:invoiceDate,totalAmt:totalAmt,items:items.length}));
  return {
    suggestions: {
      supplier:    supplierName,
      invoiceNo:   invoiceNo,
      invoiceDate: invoiceDate,
      taxId:       taxId,
      subtotal:    subtotal,
      vatAmt:      vatAmt,
      totalAmt:    totalAmt
    },
    items: items,
    lines: lines.slice(0,40)
  };
}

// ── Generate Receipt Number ───────────────────────────────────
function generateRecvNo_(date) {
  var s   = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_INV_H);
  var fmt = Utilities.formatDate(date, 'Asia/Bangkok', 'yyyyMMdd');
  var prefix = 'INV-' + fmt + '-';
  if (!s || s.getLastRow() <= 1) return prefix + '001';

  var vals = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues();
  var max  = 0;
  vals.forEach(function(r) {
    if (String(r[0]).indexOf(prefix) === 0) {
      var n = parseInt(String(r[0]).replace(prefix, ''), 10);
      if (n > max) max = n;
    }
  });
  return prefix + String(max + 1).padStart(3, '0');
}

// ── Folder Helper: root/Entity/YYYY/MM ───────────────────────
function getInvoiceFolder_(cfg, entity, date) {
  var root;
  var folderId = (cfg && cfg.INVOICE_FOLDER_ID) || (cfg && cfg.TEMP_FOLDER_ID);
  if (folderId) {
    root = DriveApp.getFolderById(folderId);
  } else {
    // fallback: สร้างใน My Drive
    var rootSearch = DriveApp.getFoldersByName('KLH_INVOICES');
    root = rootSearch.hasNext() ? rootSearch.next() : DriveApp.createFolder('KLH_INVOICES');
  }

  function getOrCreate(parent, name) {
    var it = parent.getFoldersByName(name);
    return it.hasNext() ? it.next() : parent.createFolder(name);
  }

  var yyyy  = Utilities.formatDate(date, 'Asia/Bangkok', 'yyyy');
  var mm    = Utilities.formatDate(date, 'Asia/Bangkok', 'MM');
  var entF  = getOrCreate(root, entity);
  var yearF = getOrCreate(entF, yyyy);
  return getOrCreate(yearF, mm);
}

// ── ย้ายไฟล์บิลเก่าเข้าโฟลเดอร์ใหม่ (INVOICE_FOLDER_ID) ตามกิจการ/ปี/เดือน ──
// รันครั้งเดียวใน GAS Editor: migrateInvoiceFiles()  · อ้างไฟล์จาก PDF_URL ในแต่ละแถว
function migrateInvoiceFiles() {
  try {
    var ss  = SpreadsheetApp.openById(SHEET_ID);
    var cfg = getConfig();
    if (!cfg.INVOICE_FOLDER_ID) return { ok: false, msg: 'CONFIG ยังไม่มี INVOICE_FOLDER_ID' };
    var dest = DriveApp.getFolderById(cfg.INVOICE_FOLDER_ID);   // เช็คว่าเข้าถึงได้
    var h = ss.getSheetByName(SH_INV_H);
    if (!h || h.getLastRow() <= 1) return { ok: true, moved: 0, msg: 'ยังไม่มีใบกำกับ' };

    var rows = h.getRange(2, 1, h.getLastRow() - 1, H_INV_H.length).getValues();
    var moved = 0, already = 0, skipped = 0, errs = [];
    rows.forEach(function(r) {
      var url = String(r[9] || '');
      var m = url.match(/[-\w]{25,}/);                 // file id ใน URL
      if (!m) { skipped++; return; }
      try {
        var file   = DriveApp.getFileById(m[0]);
        var entity = String(r[4] || 'KLH').trim() || 'KLH';
        var dt     = r[2] instanceof Date ? r[2] : new Date(String(r[2]));
        if (isNaN(dt)) dt = r[12] instanceof Date ? r[12] : new Date();   // fallback วันที่สร้าง
        var target = getInvoiceFolder_(cfg, entity, dt);  // ใช้ INVOICE_FOLDER_ID ใหม่
        // ข้ามถ้าอยู่ในโฟลเดอร์เป้าหมายแล้ว
        var inTarget = false, ps = file.getParents();
        while (ps.hasNext()) { if (ps.next().getId() === target.getId()) { inTarget = true; break; } }
        if (inTarget) { already++; return; }
        file.moveTo(target);
        moved++;
      } catch(e) { errs.push((m[0]||'?') + ': ' + e.message); }
    });
    var msg = 'ย้ายบิล ' + moved + ' ไฟล์ · อยู่ที่เดิมแล้ว ' + already + ' · ข้าม(ไม่มีลิงก์) ' + skipped
            + (errs.length ? ' · พลาด ' + errs.length : '');
    Logger.log(msg + (errs.length ? '\n' + errs.join('\n') : ''));
    return { ok: true, moved: moved, already: already, skipped: skipped, errors: errs, msg: msg };
  } catch(e) { return { ok: false, msg: e.message || String(e) }; }
}

// ── Save Invoice (Header + Detail) ───────────────────────────
function saveInvoice(d) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    var ss       = SpreadsheetApp.openById(SHEET_ID);
    var hdrSheet = ss.getSheetByName(SH_INV_H);
    var dtlSheet = ss.getSheetByName(SH_INV_D);
    if (!hdrSheet || !dtlSheet) {
      initOcrSheets();
      hdrSheet = ss.getSheetByName(SH_INV_H);
      dtlSheet = ss.getSheetByName(SH_INV_D);
    }

    var now    = new Date();
    var user   = Session.getActiveUser().getEmail();
    var fmt    = function(v) { return Utilities.formatDate(now, 'Asia/Bangkok', v); };

    // Header row
    hdrSheet.appendRow([
      d.recvNo, d.invoiceNo || '', d.invoiceDate || '',
      d.supplierName || '', d.entity || '',
      Number(d.subtotal)  || 0,
      Number(d.vatAmt)    || 0,
      Number(d.totalAmt)  || 0,
      'PENDING',
      d.fileUrl || '',
      d.note    || '',
      user, fmt('yyyy-MM-dd HH:mm:ss')
    ]);

    // Detail rows
    var items = d.items || [];
    if (items.length) {
      var rows = items.map(function(it, idx) {
        return [
          d.recvNo, idx + 1,
          it.barcode || '', it.productName || '',
          Number(it.qty)       || 0,
          it.unit              || '',
          Number(it.unitPrice) || 0,
          Number(it.discount)  || 0,
          Number(it.lineTotal) || 0
        ];
      });
      dtlSheet.getRange(dtlSheet.getLastRow() + 1, 1, rows.length, H_INV_D.length).setValues(rows);
    }

    // บันทึก PRICE_LOG
    writePriceLog_(d);

    // ── บันทึก AP_LEDGER (เจ้าหนี้การค้า) ─────────────────────
    writeApLedger_(ss, d);

    // ── รับเข้าคลัง WMS อัตโนมัติ (STOCK_LOG + FIFO + Cost_Avg + ROP) ──
    var wms = { ok: false, msg: 'skip' };
    try {
      wms = batchReceiveFromInvoice({
        recvNo: d.recvNo, entity: d.entity || '', whId: d.whId || 'W1',
        supplierName: d.supplierName || '',
        items: (d.items || []).map(function(it) {
          return { barcode: it.barcode || '', productName: it.productName || '',
                   buyQty: Number(it.qty) || 0, freeQty: 0,
                   unit: it.unit || 'ชิ้น', unitPrice: Number(it.unitPrice) || 0 };
        })
      });
    } catch(e2) { wms = { ok: false, msg: e2.message }; }

    lock.releaseLock();
    return { ok: true, recvNo: d.recvNo, wms: wms };
  } catch(e) {
    return { ok: false, msg: e.message || String(e) };
  }
}

// ── Write AP_LEDGER ───────────────────────────────────────────
function writeApLedger_(ss, d) {
  try {
    var ap = ss.getSheetByName('AP_LEDGER');
    if (!ap) return;
    var apId = 'AP-' + d.recvNo;
    ap.appendRow([
      apId,
      d.recvNo        || '',   // RECV_NO
      d.supplierCode  || '',   // SUPPLIER_CODE
      d.supplierName  || '',   // SUPPLIER_NAME
      d.entity        || '',   // TAX_ENTITY (กิจการของเรา)
      d.invoiceDate   || '',   // INVOICE_DATE
      d.dueDate       || '',   // DUE_DATE ← วันครบกำหนด
      Number(d.totalAmt)  || 0,  // TOTAL_AMT
      0,                         // PAID_AMT (ยังไม่ได้จ่าย)
      Number(d.totalAmt)  || 0,  // BALANCE (= TOTAL ตอนแรก)
      'UNPAID',                  // STATUS
      d.invoiceNo     || ''    // NOTE (เลขที่บิล)
    ]);
    Logger.log('AP_LEDGER: ' + apId + ' = ' + d.totalAmt + ' due ' + d.dueDate);
  } catch(e) { Logger.log('writeApLedger_ error: ' + e); }
}

// ── Write PRICE_LOG ───────────────────────────────────────────
function writePriceLog_(d) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var pl = ss.getSheetByName('PRICE_LOG');
    if (!pl) {
      pl = ss.insertSheet('PRICE_LOG');
      pl.getRange(1,1,1,8).setValues([['Date','RECV_NO','Barcode','Product_Name','Supplier','Qty','Unit_Price','Entity']])
        .setBackground('#BF360C').setFontColor('#fff').setFontWeight('bold');
      pl.setFrozenRows(1);
    }
    (d.items || []).forEach(function(it) {
      if (!it.barcode && !it.productName) return;
      pl.appendRow([
        d.invoiceDate || Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd'),
        d.recvNo, it.barcode || '', it.productName || '',
        d.supplierName || '', Number(it.qty)||0,
        Number(it.unitPrice)||0, d.entity || ''
      ]);
    });
  } catch(e) { Logger.log('writePriceLog_ error: ' + e); }
}

// ── Get Invoice List ──────────────────────────────────────────
function getInvoiceList(limit) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SH_INV_H);
    if (!s || s.getLastRow() <= 1) return { ok: true, items: [] };
    var n = Math.min(limit || 30, s.getLastRow() - 1);
    var rows = s.getRange(s.getLastRow() - n + 1, 1, n, H_INV_H.length).getValues();
    var items = rows.reverse().map(function(r) {
      return {
        recvNo: r[0], invoiceNo: r[1], date: r[2],
        supplier: r[3], entity: r[4], total: r[7],
        status: r[8], fileUrl: r[9]
      };
    });
    return { ok: true, items: items };
  } catch(e) { return { ok: false, msg: e.message }; }
}

// ── Page Data + Auto-init Sheets ─────────────────────────────
function getOcrPageData() {
  try {
    // Auto-create INVOICE_HEADER, INVOICE_DETAIL if missing
    initOcrSheets();
    // Auto-create AP_LEDGER, PRICE_LOG if missing
    initApSheets_();

    var suppliers = getSupplierList();
    var recent    = getInvoiceList(10);

    // อ่าน SHOPS sheet โดยตรง (ไม่ผ่าน getShopsAndEntities)
    var entities = [];
    try {
      var cfg2   = getConfig();
      var shopSn = String(cfg2.TAB_SHOPS || 'SHOPS').trim();
      var shopSh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(shopSn);
      if (shopSh) {
        entities = shopSh.getDataRange().getValues()
          .map(function(r){ return String(r[0]||'').trim(); })
          .filter(function(v){ return v.length > 0 && v !== 'SHOPS' && v !== 'ชื่อร้าน'; });
        Logger.log('OCR entities from SHOPS: ' + entities.length + ' → ' + entities.join(' | '));
      } else {
        Logger.log('OCR: Sheet "' + shopSn + '" not found');
      }
    } catch(se) { Logger.log('OCR shops error: ' + se); }

    return {
      ok:        true,
      suppliers: suppliers,
      recent:    recent.items || [],
      entities:  entities
    };
  } catch(e) { return { ok: false, msg: e.message }; }
}

function initApSheets_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = {
    'AP_LEDGER': ['AP_ID','RECV_NO','SUPPLIER_CODE','SUPPLIER_NAME','TAX_ENTITY',
                  'INVOICE_DATE','DUE_DATE','TOTAL_AMT','PAID_AMT','BALANCE','STATUS','NOTE'],
    'PRICE_LOG': ['Date','RECV_NO','Barcode','Product_Name','Supplier',
                  'Qty','Unit_Price','Cost_FOC','Entity']
  };
  var colors = { 'AP_LEDGER':'#1A237E', 'PRICE_LOG':'#BF360C' };
  Object.keys(sheets).forEach(function(name) {
    var s = ss.getSheetByName(name);
    if (!s) {
      s = ss.insertSheet(name);
      s.getRange(1,1,1,sheets[name].length).setValues([sheets[name]])
        .setBackground(colors[name]).setFontColor('#fff').setFontWeight('bold');
      s.setFrozenRows(1);
    }
  });
}

// ── Supplier Lookup from SUPPLIER_MASTER ──────────────────────
function lookupSupplierForOcr(nameFragment) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('SUPPLIER_MASTER');
    if (!sheet || sheet.getLastRow() <= 1) return { exact: null, similar: [] };
    var rows = sheet.getDataRange().getValues().slice(1);
    var q    = String(nameFragment || '').toLowerCase().trim();
    if (!q) return { exact: null, similar: [] };

    var exact = null, similar = [];
    rows.forEach(function(r) {
      var name = String(r[1] || '').toLowerCase();
      var item = { code: String(r[0]||''), name: String(r[1]||''), contact: String(r[2]||''), tel: String(r[4]||'') };
      if (!name) return;
      if (name === q) { exact = item; }
      else if (name.indexOf(q.substring(0,5)) >= 0 || q.indexOf(name.substring(0,5)) >= 0) { similar.push(item); }
    });
    return { exact: exact, similar: similar.slice(0, 5) };
  } catch(e) { return { exact: null, similar: [] }; }
}

// ── Product Lookup from KLH DATA ─────────────────────────────
function lookupProductsForOcr(code, name) {
  try {
    var rows = searchProductsFromSheet(code && code.length > 2 ? code : (name || ''));
    if (!rows.length && code && name) rows = searchProductsFromSheet(name.substring(0, 6));
    return rows.slice(0, 5).map(function(p) {
      return {
        barcode: p.barcode, name: p.name,
        packMult: p.packMult, packUnit: p.packUnit,
        buyPrice: p.buy_price, costFinal: p.cost_final,
        retailPrice: p.retail_price, wholesalePrice: p.wholesale_price,
        buyQty: p.buy_qty, freeQty: p.free_qty, taxEntity: p.tax_entity
      };
    });
  } catch(e) { return []; }
}

// ── Calculate FOC Landed Cost ─────────────────────────────────
// เช่น: ซื้อ 50 กล่อง × 800 + แถม 6 กล่อง
// ต้นทุนจริง/กล่อง = (50×800) ÷ (50+6) = 714.29
function calcFocCost(buyQty, unitPrice, freeQty) {
  var paid    = (Number(buyQty)||0) * (Number(unitPrice)||0);
  var total   = (Number(buyQty)||0) + (Number(freeQty)||0);
  var perUnit = total > 0 ? paid / total : (Number(unitPrice)||0);
  return {
    paidAmount:   paid,
    totalQty:     total,
    costPerUnit:  Math.round(perUnit * 100) / 100
  };
}

// ── Get current product data from KLH DATA for comparison ─────
function getProductCurrent(barcode) {
  try {
    var rows = searchProductsFromSheet(barcode);
    if (!rows.length) return null;
    var p = rows[0];
    return {
      row:           p.row,
      barcode:       p.barcode,
      name:          p.name,
      buyPrice:      p.buy_price,       // I
      discCash:      p.discount_cash,   // H
      discPct:       p.discount_percent,// J
      buyQty:        p.buy_qty,         // L
      freeQty:       p.free_qty,        // M
      freight:       p.freight,         // O
      tax:           p.tax,             // Q
      costFinal:     p.cost_final,      // R
      wholesalePer:  p.wholesale_percent,// S
      retailPer:     p.retail_percent,   // T
      wholesalePrice:p.wholesale_price,  // U
      retailPrice:   p.retail_price,     // W
      taxEntity:     p.tax_entity,       // AD
      supCode:       p.supCode           // G
    };
  } catch(e) { return null; }
}

// ── Apply price update to KLH DATA + log to PRICE_HISTORY ─────
function applyPriceUpdate(data) {
  // data = {barcode, row, recvNo, productName, fields:[{label, colIdx, oldVal, newVal}]}
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    var cfg      = getConfig();
    var ss       = SpreadsheetApp.openById(SHEET_ID);
    var klhSheet = ss.getSheetByName(cfg.TAB_SURVEY || 'KLH DATA');
    if (!klhSheet) { lock.releaseLock(); return { ok: false, msg: 'ไม่พบ KLH DATA' }; }

    var now  = new Date();
    var user = Session.getActiveUser().getEmail();
    var changed = 0;

    // Update cells in KLH DATA
    (data.fields || []).forEach(function(f) {
      if (f.colIdx > 0 && f.newVal !== '' && f.newVal !== null) {
        klhSheet.getRange(data.row, f.colIdx).setValue(f.newVal);
        changed++;
      }
    });
    // Update date stamp (col Y = index 25 → column 25)
    if (changed > 0) klhSheet.getRange(data.row, 25).setValue(now);

    // ── Log ONE summary row to PRICE_HISTORY ──────────────────
    var histSheet = ss.getSheetByName('PRICE_HISTORY');
    if (!histSheet) {
      histSheet = ss.insertSheet('PRICE_HISTORY');
      histSheet.getRange(1,1,1,10).setValues([[
        'DATE','BARCODE','NAME','OLD_COST','NEW_COST',
        'OLD_RETAIL','NEW_RETAIL','USER','ENTITY','REMARK'
      ]]).setBackground('#880E4F').setFontColor('#fff').setFontWeight('bold');
      histSheet.setFrozenRows(1);
    }
    // Extract old/new COST_FINAL (R) and RETAIL_OLD (W) from fields
    var oldCostFinal = 0, newCostFinal = 0, oldRetail = 0, newRetail = 0;
    var changedFields = [];
    (data.fields || []).forEach(function(f) {
      var ov = parseFloat(f.oldVal||0), nv = parseFloat(f.newVal||0);
      var label = String(f.label||'');
      if (label.indexOf('COST_FINAL') >= 0) { oldCostFinal = ov; newCostFinal = nv; }
      if (label.indexOf('RETAIL') >= 0 && label.indexOf('WHOLESALE') < 0) { oldRetail = ov; newRetail = nv; }
      if (Math.abs(ov - nv) > 0.001) {
        // Short label: remove col-letter in parentheses
        changedFields.push(label.replace(/\([A-Z]\)/g,'').trim());
      }
    });
    // Write ONE row per product
    histSheet.appendRow([
      now,                                        // DATE
      data.barcode       || '',                   // BARCODE
      data.productName   || '',                   // NAME
      oldCostFinal.toFixed(2),                    // OLD_COST
      newCostFinal.toFixed(2),                    // NEW_COST
      oldRetail  > 0 ? oldRetail.toFixed(2) : '',// OLD_RETAIL
      newRetail  > 0 ? newRetail.toFixed(2) : '',// NEW_RETAIL
      user,                                       // USER
      (data.entity || '') + ' | ' + (data.recvNo||''),  // ENTITY
      changedFields.join(', ')                    // REMARK
    ]);

    lock.releaseLock();
    var changedCount = changedFields.length;
    return {
      ok:      true,
      changed: changed,
      msg:     'อัปเดต KLH DATA ' + changed + ' ช่อง' + (changedCount > 0 ? ' (เปลี่ยน: ' + changedFields.join(', ') + ')' : '') + ' + บันทึก PRICE_HISTORY แล้ว'
    };
  } catch(e) {
    return { ok: false, msg: e.message || String(e) };
  }
}
