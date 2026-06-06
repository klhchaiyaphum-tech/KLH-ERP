// ==========================================
// KLH LOGISTICS PRO V9.1 (Enterprise Survey)
// ==========================================

const SHEET_ID = "1ko72nyTpeQZ410eVALhlzZ2EhY7Qk0e340DAdQG8z4U";

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || 'index';
  const pageMap = {
    index: 'main', survey: 'Index',
    wms: 'wms', pricelist: 'pricelist', ocr: 'ocr',
    supplier: 'supplier',
    pos:     'pos',           // POS Handheld (Sunmi V4) — Variant B
    pos_pc:  'pos_pc',        // POS PC — 3-column desktop
    pos_t2:  'pos_t2',        // POS Sunmi T2 Lite — countertop dual-screen
    cashier: 'pos_cashier',   // Cashier station — scan QR + collect payment
    customer:'customer', ar:  'customer',
    label:       'label',          // Label printing — shelf + barcode stickers
    slip:        'slip',           // Slip verification — iPhone camera
    shelf_print: 'shelf_print',    // Shared shelf label print (Survey + Label)
    stock_month: 'stock_month'     // สิ้นเดือน: แยกสต๊อก KLH vs ร้านอื่น + ขายจำลอง (ข้อ 5)
  };
  const tpl = pageMap[page] || 'main';
  const titles = {
    survey: 'KLH Data Survey', wms: 'KLH WMS',
    pricelist: 'KLH Price List', ocr: 'KLH Invoice OCR',
    supplier: 'KLH Supplier Master',
    pos:     'KLH POS Handheld',
    pos_pc:  'KLH POS PC',
    pos_t2:  'KLH POS T2 Lite',
    label:   'KLH Label Print',
    slip:    'KLH Slip Verify',
    cashier: 'KLH Cashier',
    customer:'KLH Customer & AR',
    stock_month: 'KLH สต๊อกสิ้นเดือน'
  };
  const tmpl = HtmlService.createTemplateFromFile(tpl);
  tmpl.fromPage = (e && e.parameter && e.parameter.from) || '';
  return tmpl.evaluate()
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setTitle(titles[page] || 'KLH V9.1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getExecUrl() {
  return ScriptApp.getService().getUrl();
}

// ── readKTBQrCode: ลบแล้ว — ใช้ QR string hardcode แทน (ประหยัด Gemini API) ──

// ── Save Slip Image to Google Drive ──────────────────────────────
function saveSlipToDrive(base64, mimeType, orderId) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var rootFolderId = DriveApp.getFileById(SHEET_ID).getParents().next().getId();
    // สร้างโฟลเดอร์ Slips/YYYY-MM
    var slipsFolder;
    try { slipsFolder = DriveApp.getFoldersByName('Slips').next(); }
    catch(e) { slipsFolder = DriveApp.createFolder('Slips'); }
    var monthName = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
    var monthFolder;
    try { monthFolder = slipsFolder.getFoldersByName(monthName).next(); }
    catch(e) { monthFolder = slipsFolder.createFolder(monthName); }
    // สร้างไฟล์
    var ext = mimeType === 'image/png' ? '.png' : '.jpg';
    var filename = (orderId || 'slip') + '_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'HHmmss') + ext;
    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, filename);
    var file = monthFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { ok: true, fileId: file.getId(), url: file.getUrl(), name: filename };
  } catch(e) {
    Logger.log('saveSlipToDrive error: ' + e);
    return { ok: false, error: e.toString() };
  }
}

// ── Slip Verification via Gemini OCR ─────────────────────────────
function verifySlipGemini(base64, mimeType, expectedAmount) {
  try {
    var cfg = getConfig();
    var apiKey = cfg.GEMINI_API_KEY || '';
    if (!apiKey) return { error: 'ไม่พบ Gemini API Key ใน Config' };

    var prompt = 'นี่คือรูปสลิปโอนเงิน กรุณาอ่านข้อมูลและตอบเป็น JSON เท่านั้น (ไม่มีข้อความอื่น):\n'
      + '{\n'
      + '  "amount": <ยอดเงินที่โอน เป็นตัวเลข เช่น 245.00>,\n'
      + '  "date": "<วันที่และเวลา เช่น 01/06/2568 10:45>",\n'
      + '  "sender": "<ชื่อผู้โอน>",\n'
      + '  "receiver": "<ชื่อผู้รับ>",\n'
      + '  "bank": "<ชื่อธนาคาร>",\n'
      + '  "refNo": "<เลขอ้างอิง>",\n'
      + '  "isSlip": <true ถ้าเป็นสลิปโอนเงินจริง, false ถ้าไม่ใช่>\n'
      + '}\n'
      + 'ถ้าอ่านค่าใดไม่ได้ให้ใส่ null';

    var models = ['gemini-2.0-flash-lite','gemini-1.5-flash'];
    var parsed = null;
    for (var m = 0; m < models.length; m++) {
      try {
        var url = 'https://generativelanguage.googleapis.com/v1beta/models/'
          + models[m] + ':generateContent?key=' + apiKey;
        var payload = {
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 } }
            ]
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 512 }
        };
        var resp = UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        if (resp.getResponseCode() !== 200) continue;
        var respJson = JSON.parse(resp.getContentText());
        var raw = respJson.candidates[0].content.parts[0].text;
        // extract JSON
        var match = raw.match(/\{[\s\S]*\}/);
        if (match) { parsed = JSON.parse(match[0]); break; }
      } catch(e2) { Logger.log('model '+models[m]+' error: '+e2); continue; }
    }
    if (!parsed) return { error: 'อ่านสลิปไม่สำเร็จ', note: 'ภาพไม่ชัดหรือไม่ใช่สลิป' };
    if (!parsed.isSlip) return { error: 'ไม่ใช่สลิปโอนเงิน', amount: 0, note: 'ภาพที่ส่งมาไม่ใช่สลิปการโอนเงิน' };

    return {
      amount:   parsed.amount   || 0,
      date:     parsed.date     || '',
      sender:   parsed.sender   || '',
      receiver: parsed.receiver || '',
      bank:     parsed.bank     || '',
      refNo:    parsed.refNo    || '',
      ok:       true
    };
  } catch(e) {
    Logger.log('verifySlipGemini error: '+e);
    return { error: e.toString() };
  }
}

// โหลดรายชื่อกิจการจาก Sheet SHOPS (ใช้ร่วมกันทุกหน้า)
function getShopsAndEntities() {
  try {
    const cfg = getConfig();
    const ss  = SpreadsheetApp.openById(SHEET_ID);
    const sn  = (cfg.TAB_SHOPS || 'SHOPS').trim();
    const sh  = ss.getSheetByName(sn);
    if (!sh) {
      Logger.log('getShopsAndEntities: Sheet "' + sn + '" not found');
      return { shops: [], entities: [] };
    }
    const rows = sh.getDataRange().getValues();
    const SKIP = ['SHOPS','ชื่อร้าน','ร้าน','CATEGORY CODE','CATEGORY NAME'];
    const shops = rows
      .map(function(r){ return String(r[0]||'').trim(); })
      .filter(function(v){ return v.length > 0 && SKIP.indexOf(v.toUpperCase()) < 0 && SKIP.indexOf(v) < 0; });
    Logger.log('getShopsAndEntities: found ' + shops.length + ' → ' + shops.join(' | '));
    return { shops: shops, entities: shops };
  } catch(e) {
    Logger.log('getShopsAndEntities error: ' + e);
    return { shops: [], entities: [] };
  }
}

function getConfig() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName("CONFIG") || ss.getSheetByName("Config");
    if (!sheet) return { error: "หา Sheet ชื่อ 'CONFIG' ไม่เจอครับ" };
    const data = sheet.getDataRange().getValues();
    const config = {};
    data.forEach(row => {
      if (row[0]) config[String(row[0]).trim().toUpperCase()] = row[1];
    });
    return config;
  } catch(e) { return { error: "ปัญหาที่ CONFIG: " + e.toString() }; }
}

function getDropdownData() {
  try {
    const cfg = getConfig();
    if (cfg.error) return { error: cfg.error };

    const ss = SpreadsheetApp.openById(SHEET_ID);

    const getList = (sheetName) => {
      try {
        if (!sheetName) return [];
        const sh = ss.getSheetByName(String(sheetName).trim());
        if (!sh) return [];
        return sh.getDataRange().getValues().flat().map(String).map(s => s.trim()).filter(s => s !== "");
      } catch(e) { return []; }
    };

    let cats  = getList(cfg.TAB_CATEGORY || "PRODUCT_CATEGORY");
    let packs = getList(cfg.TAB_PACKAGE  || "PACKAGE");

    // อ่าน SHOPS จาก col A ผ่าน getShopsAndEntities()
    const shopsData = getShopsAndEntities();
    let shops = shopsData.shops;
    if (shops.length === 0) shops = ["หจก. เคแอลเอช", "กวงล่งเฮง", "วิศาลศักดิ์", "เจ๊กตา", "เอี่ยมเช็ง"];

    const rawTax   = String(cfg.TAX_RATE || "7").replace('%', '').trim();
    const parsedTax = parseFloat(rawTax);
    const finalTaxRate = parsedTax > 1 ? parsedTax / 100 : (parsedTax || 0.07);

    return {
      companyName: cfg.COMPANY_NAME || "KLH Logistics",
      vatRate: finalTaxRate,
      categories: cats,
      packages: packs,
      shops: shops,
      suppliers: getSupplierList(cfg.TAB_SUPPLIER || "SUPPLIER_MASTER")
    };
  } catch(err) { return { error: "ระบบหลังบ้านขัดข้อง: " + err.toString() }; }
}

function manageListData(configKey, oldName, newName, mode) {
  try {
    const cfg = getConfig();
    const map = {
      TAB_CATEGORY: cfg.TAB_CATEGORY || "PRODUCT_CATEGORY",
      TAB_PACKAGE:  cfg.TAB_PACKAGE  || "PACKAGE",
      TAB_SHOPS:    cfg.TAB_SHOPS    || "SHOPS"
    };
    const sheetName = map[configKey];
    if (!sheetName) return "Key ไม่ถูกต้อง";

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
    if (!sheet) return "ไม่พบ Sheet: " + sheetName;

    if (mode === 'add') { sheet.appendRow([newName]); return "เพิ่มข้อมูลเรียบร้อย"; }

    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(oldName)) {
        if (mode === 'edit')   sheet.getRange(i + 1, 1).setValue(newName);
        else if (mode === 'delete') sheet.deleteRow(i + 1);
        return "อัปเดตข้อมูลเรียบร้อย";
      }
    }
    return "ไม่พบชื่อเดิมในระบบ";
  } catch(e) { return "Error: " + e.toString(); }
}

// SUPPLIER_MASTER columns: A=Code B=Name C=Contact D=Address E=Tel
//   F=TaxId G=BankName H=BankAccount I=ChequePayable J=CreditDays K=Note
function getSupplierList(sheetName) {
  sheetName = sheetName || "SUPPLIER_MASTER";
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
    if (!sheet) return [];
    return sheet.getDataRange().getValues().slice(1).map(function(r, i) {
      return {
        row: i+2, code: String(r[0]||''), name: String(r[1]||''),
        contact: String(r[2]||''), address: String(r[3]||''), tel: String(r[4]||''),
        taxId: String(r[5]||''), bankName: String(r[6]||''), bankAccount: String(r[7]||''),
        chequePayable: String(r[8]||''), creditDays: String(r[9]||''), note: String(r[10]||'')
      };
    }).filter(function(r){ return r.code || r.name; });
  } catch(e) { return []; }
}

function updateSupplier(code, data) {
  try {
    const cfg = getConfig();
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sn = (cfg.TAB_SUPPLIER || 'SUPPLIER_MASTER').trim();
    const sheet = ss.getSheetByName(sn);
    if (!sheet) return {ok:false, msg:'ไม่พบ Sheet '+sn};
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === String(code).trim()) {
        sheet.getRange(i+1,1,1,11).setValues([[
          code,
          data.name         || rows[i][1]  || '',
          data.contact      || rows[i][2]  || '',
          data.address      || rows[i][3]  || '',
          data.tel          || rows[i][4]  || '',
          data.taxId        || rows[i][5]  || '',
          data.bankName     || rows[i][6]  || '',
          data.bankAccount  || rows[i][7]  || '',
          data.chequePayable|| rows[i][8]  || '',
          data.creditDays   !== undefined ? data.creditDays : (rows[i][9]||''),
          data.note         || rows[i][10] || ''
        ]]);
        return {ok:true, msg:'อัปเดต '+code+' สำเร็จ'};
      }
    }
    return {ok:false, msg:'ไม่พบรหัส '+code};
  } catch(e) { return {ok:false, msg:e.message}; }
}

function deleteSupplier(code) {
  try {
    const cfg = getConfig();
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sn = (cfg.TAB_SUPPLIER || 'SUPPLIER_MASTER').trim();
    const sheet = ss.getSheetByName(sn);
    if (!sheet) return {ok:false, msg:'ไม่พบ Sheet'};
    const rows = sheet.getDataRange().getValues();
    for (let i = rows.length-1; i >= 1; i--) {
      if (String(rows[i][0]).trim() === String(code).trim()) {
        sheet.deleteRow(i+1);
        return {ok:true, msg:'ลบ '+code+' สำเร็จ'};
      }
    }
    return {ok:false, msg:'ไม่พบรหัส '+code};
  } catch(e) { return {ok:false, msg:e.message}; }
}

function deleteProduct(row) {
  try {
    const cfg = getConfig();
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sn = (cfg.TAB_SURVEY || 'KLH DATA').trim();
    const sheet = ss.getSheetByName(sn);
    if (!sheet) return {ok:false, msg:'ไม่พบ KLH DATA'};
    if (row < 2) return {ok:false, msg:'row ไม่ถูกต้อง'};
    const name = sheet.getRange(row, 2).getValue();
    sheet.deleteRow(row);
    return {ok:true, msg:'ลบ "'+name+'" สำเร็จ'};
  } catch(e) { return {ok:false, msg:e.message}; }
}

function addNewSupplier(data) {
  try {
    const cfg = getConfig();
    const supSheet = cfg.TAB_SUPPLIER ? String(cfg.TAB_SUPPLIER).trim() : "SUPPLIER_MASTER";
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(supSheet);
    const lastRow = Math.max(1, sheet.getLastRow());
    let newCode = "VEND-001";
    if (lastRow > 1) {
      const lastCode = sheet.getRange(lastRow, 1).getValue();
      const num = parseInt(String(lastCode).replace("VEND-", "")) || 0;
      newCode = "VEND-" + String(num + 1).padStart(3, '0');
    }
    sheet.appendRow([newCode, data.name||'', data.contact||'', data.address||'', data.tel||'',
      data.taxId||'', data.bankName||'', data.bankAccount||'', data.chequePayable||'', data.creditDays||'', data.note||'']);
    return { status: "success", code: newCode, name: data.name };
  } catch(e) { return { status: "error", message: e.toString() }; }
}

// ── Debug Search Test ──────────────────────────────────────────
function debugSearchTest() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var allSheets = ss.getSheets().map(function(s){ return s.getName(); });
  Logger.log('All sheets: ' + JSON.stringify(allSheets));
  var cfg = getConfig();
  Logger.log('cfg.TAB_SURVEY = "' + cfg.TAB_SURVEY + '"');
  var sheet = ss.getSheetByName('KLH DATA');
  Logger.log('getSheetByName("KLH DATA") = ' + (sheet ? 'FOUND (' + sheet.getLastRow() + ' rows)' : 'NULL'));
  if (!sheet) return 'NO SHEET';
  var data = sheet.getDataRange().getValues();
  var q = 'หมึก';
  var found = [];
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][1] || '');
    if (name.toLowerCase().indexOf(q) >= 0) found.push(data[i][0] + ':' + name);
  }
  Logger.log('Search "หมึก" found: ' + found.length + ' → ' + found.slice(0,5).join(', '));
  return 'done — ดู Execution log';
}

function searchProductsFromSheet(query) {
  const cfg = getConfig();
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // หา sheet แบบ case-insensitive
  const wantName = cfg.TAB_SURVEY ? String(cfg.TAB_SURVEY).trim() : 'KLH DATA';
  let sheet = ss.getSheetByName(wantName);
  if (!sheet) {
    const upper = wantName.toUpperCase();
    ss.getSheets().forEach(function(s) { if (!sheet && s.getName().toUpperCase() === upper) sheet = s; });
  }
  if (!sheet) sheet = ss.getSheetByName('KLH DATA');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const q = String(query || '').trim().toLowerCase();
  // ถ้า query ว่าง → คืน 200 รายการแรก (สำหรับโหลด POS ครั้งแรก)
  const returnAll = !q;

  // sv = safe string, sn = safe number
  function sv(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return '';
    try { var s = String(v); return (s === 'Error' || s.charAt(0) === '#') ? '' : s; }
    catch(e) { return ''; }
  }
  function sn(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  return data.slice(1).map(function(r, i) {
    return {
      row:               i + 2,
      barcode:           sv(r[0]),   // A  BARCODE_SMALL
      name:              sv(r[1]),   // B  PRODUCT_NAME
      category:          sv(r[2]),   // C  CATEGORY
      size:              sv(r[3]),   // D  SIZE_MODEL
      packMult:          sn(r[4]),   // E  MULTIPLIER
      packUnit:          sv(r[5]),   // F  UNIT_BIG
      supCode:           sv(r[6]),   // G  SUPPLIER_CODE
      discount_cash:     sn(r[7]),   // H  DISCOUNT_CASH
      buy_price:         sn(r[8]),   // I  BUY_PRICE
      discount_percent:  sn(r[9]),   // J  DISCOUNT_PERCENT
      dis_per_val:       sn(r[10]),  // K  DIS_PER_VAL
      buy_qty:           sn(r[11]),  // L  BUY_QTY
      free_qty:          sn(r[12]),  // M  FREE_QTY
      free_val:          sn(r[13]),  // N  FREE_VAL
      freight:           sn(r[14]),  // O  FREIGHT
      calc_cost:         sn(r[15]),  // P  CALC_COST
      tax:               sn(r[16]),  // Q  TAX
      cost_final:        sn(r[17]),  // R  COST_FINAL
      wholesale_percent: sn(r[18]),  // S  WHOLESALE_PER
      retail_percent:    sn(r[19]),  // T  RETAIL_PER
      wholesale_price:   sn(r[20]),  // U  WHOLESALE_OLD
      wholesale_calc:    sn(r[21]),  // V  WHOLESALE_NEW
      retail_price:      sn(r[22]),  // W  RETAIL_OLD
      retail_calc:       sn(r[23]),  // X  RETAIL_NEW
      update_date:       '',         // Y  (skip Date)
      ref_cost_whole:    sn(r[25]),  // Z  REF_COST_WHOLE
      ref_cost_retail:   sn(r[26]),  // AA REF_COST_RETAIL
      barcode_big:       sv(r[27]),  // AB BARCODE_BIG
      image_url:         sv(r[28]),  // AC IMAGE_URL
      tax_entity:        sv(r[29]),  // AD TAX_ENTITY
      product_group:     sv(r[30]),  // AE PRODUCT_GROUP
      supplier_compare:  sv(r[31]),  // AF SUPPLIER_COMPARE
      best_price_source: sv(r[32]),  // AG BEST_PRICE_SOURCE
      dozen_barcode:     sv(r[33]),  // AH BARCODE_DOZ
      dozen_price:       sn(r[34])   // AI RETAIL_DOZ (ราคาโหล 12 ชิ้น)
    };
  }).filter(function(p) {
    if (returnAll) return p.barcode.length > 0;
    return p.barcode.toLowerCase().indexOf(q) >= 0 ||
           p.barcode_big.toLowerCase().indexOf(q) >= 0 ||
           p.name.toLowerCase().indexOf(q) >= 0;
  }).slice(0, returnAll ? 200 : 100);  // initial=200, search=100
}

function processImageWithBgRemoval(imgBase64, config) {
  if (!config.REMOVE_BG_TOKEN) return Utilities.newBlob(Utilities.base64Decode(imgBase64), 'image/png');
  try {
    const response = UrlFetchApp.fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'post',
      headers: { 'X-Api-Key': config.REMOVE_BG_TOKEN },
      payload: { 'image_file_b64': imgBase64, 'size': 'auto' },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) return Utilities.newBlob(Utilities.base64Decode(imgBase64), 'image/png');
    return response.getBlob();
  } catch(e) {
    return Utilities.newBlob(Utilities.base64Decode(imgBase64), 'image/png');
  }
}

function processAndSaveAll(imgBase64, barcodeSmall, info) {
  const cfg = getConfig();
  const surveySheet = cfg.TAB_SURVEY ? String(cfg.TAB_SURVEY).trim() : "KLH DATA";
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(surveySheet);
  const row = info.row === -1 ? sheet.getLastRow() + 1 : info.row;

  const rowData = new Array(33).fill("");
  rowData[0]  = barcodeSmall;
  rowData[1]  = info.name;
  rowData[2]  = info.category;
  rowData[3]  = info.size;
  rowData[4]  = info.packMult;
  rowData[5]  = info.packUnit;
  rowData[6]  = info.supCode;
  rowData[7]  = info.discount_cash;
  rowData[8]  = info.buy_price;
  rowData[9]  = info.discount_percent;
  rowData[10] = info.buy_price * (info.discount_percent || 0);
  rowData[11] = info.buy_qty;
  rowData[12] = info.free_qty;
  const totalQty = Number(info.buy_qty) + Number(info.free_qty) || 1;
  rowData[13] = info.buy_price * (Number(info.free_qty) / totalQty);
  rowData[14] = info.freight;
  rowData[15] = info.buy_price - (rowData[7] || 0) - (rowData[10] || 0) - (rowData[13] || 0);
  rowData[16] = info.tax;
  rowData[17] = info.cost_final;
  rowData[18] = info.wholesale_percent;
  rowData[19] = info.retail_percent;
  rowData[20] = info.wholesale_price;
  rowData[21] = info.wholesale_calc;
  rowData[22] = info.retail_price;
  rowData[23] = info.retail_calc;
  rowData[24] = new Date();
  rowData[27] = info.barcode_big;
  rowData[29] = info.tax_entity;
  rowData[30] = info.product_group;
  rowData[31] = info.supplier_compare  || '';  // AF: SUPPLIER_COMPARE
  rowData[32] = info.best_price_source || '';  // AG: BEST_PRICE_SOURCE
  rowData[33] = info.barcode_doz       || '';  // AH: BARCODE_DOZ
  rowData[34] = info.retail_doz        || '';  // AI: RETAIL_DOZ

  // บันทึกรูปภาพ
  if (imgBase64 && cfg.TEMP_FOLDER_ID) {
    try {
      const folder = DriveApp.getFolderById(cfg.TEMP_FOLDER_ID);
      const blob = processImageWithBgRemoval(imgBase64, cfg);
      blob.setName("IMG_" + barcodeSmall + ".png");
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      rowData[28] = file.getUrl();
    } catch(err) { Logger.log("Image save error: " + err); }
  }

  sheet.getRange(row, 1, 1, 33).setValues([rowData]);

  // บันทึก STOCK_LOG
  try {
    const stock = SpreadsheetApp.openById(SHEET_ID).getSheetByName(cfg.TAB_STOCK_LOG || "STOCK_LOG");
    if (stock) {
      stock.appendRow([
        new Date(), "IN", barcodeSmall, info.name, info.tax_entity || "",
        Number(info.buy_qty || 0) + Number(info.free_qty || 0),
        info.packUnit || "", "PO-" + Date.now(),
        Session.getActiveUser().getEmail(), "รับสินค้าเข้า"
      ]);
    }
  } catch(err) { Logger.log("Stock log error: " + err); }

  // LINE Messaging API
  try {
    const token   = cfg.LINE_CHANNEL_TOKEN;
    const groupId = cfg.LINE_GROUP_ID;
    if (token && groupId) {
      const msg = `📦 รับสินค้าเข้า\nสินค้า: ${info.name}\nBarcode: ${barcodeSmall}\nจำนวน: ${info.buy_qty}\nEntity: ${info.tax_entity}\nต้นทุน: ${info.cost_final}`;
      UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
        method: "post",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        payload: JSON.stringify({ to: groupId, messages: [{ type: "text", text: msg }] }),
        muteHttpExceptions: true
      });
    }
  } catch(err) { Logger.log("LINE error: " + err); }

  return { status: "success" };
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const event = body.events[0];
  Logger.log(JSON.stringify(event.source));
}

function getLineGroupId() {
  const cfg   = getConfig();
  const token = cfg.LINE_CHANNEL_TOKEN;
  const res = UrlFetchApp.fetch(
    "https://api.line.me/v2/bot/message/replyToken",
    { headers: { "Authorization": "Bearer " + token } }
  );
  Logger.log(res.getContentText());
}

// ── POS Categories — อ่านจาก PRODUCT_CATEGORY (7 rows) ไม่ใช่ KLH DATA (3500+ rows)
function getPosCategories() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var catSheet = ss.getSheetByName('PRODUCT_CATEGORY');
    if (catSheet && catSheet.getLastRow() > 1) {
      // อ่าน col B (Category Name) หรือ col A ถ้า B ว่าง
      var rows = catSheet.getDataRange().getValues().slice(1);
      var SKIP = ['CATEGORY NAME','Category Name','ชื่อหมวด'];
      var cats = rows
        .map(function(r){ return String(r[1]||r[0]||'').trim(); })
        .filter(function(v){ return v.length > 0 && SKIP.indexOf(v) < 0; });
      Logger.log('getPosCategories (PRODUCT_CATEGORY): ' + cats.join(' | '));
      var result = cats.map(function(c){ return { name: c, count: 0 }; });
      result.push({ name: 'ไม่มีหมวด', count: 0 }); // สินค้าที่ col C ว่าง
      return result;
    }
    // fallback: อ่านจาก KLH DATA col C (ช้ากว่า)
    Logger.log('getPosCategories: ไม่พบ PRODUCT_CATEGORY — fallback KLH DATA');
    var klh = klhDataSheet_();
    if (!klh) return [];
    var data = klh.getDataRange().getValues();
    var seen = {}, order = [];
    data.slice(1).forEach(function(r){
      var cat = String(r[2]||'').trim();
      if (cat && !seen[cat]) { seen[cat]=1; order.push(cat); }
    });
    return order.map(function(c){ return { name: c, count: 0 }; });
  } catch(e) {
    Logger.log('getPosCategories error: ' + e);
    return [];
  }
}

// ── Price List Data ───────────────────────────────────────────
function klhDataSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = null;
  try {
    var cfg = getConfig();
    if (cfg && cfg.TAB_SURVEY) sheet = ss.getSheetByName(String(cfg.TAB_SURVEY).trim());
  } catch(e) {}
  return sheet || ss.getSheetByName('KLH DATA');
}

function getPriceListCategories() {
  try {
    var ss  = SpreadsheetApp.openById(SHEET_ID);

    // ลำดับจาก PRODUCT_CATEGORY
    var catOrder = [];
    var catSheet = ss.getSheetByName('PRODUCT_CATEGORY');
    if (catSheet && catSheet.getLastRow() > 1) {
      catSheet.getDataRange().getValues().slice(1).forEach(function(r) {
        var nm = String(r[1] || r[0] || '').trim();
        if (nm && catOrder.indexOf(nm) < 0) catOrder.push(nm);
      });
    }

    var klh = klhDataSheet_();
    if (!klh) return { ok: false, msg: 'ไม่พบ Sheet KLH DATA' };
    var data = klh.getDataRange().getValues();
    var count = {};
    var seen  = [];
    data.slice(1).forEach(function(r) {
      if (!String(r[0] || '').trim()) return;
      var cat = String(r[2] || '').trim() || 'ไม่ระบุหมวด';
      if (!count[cat]) { count[cat] = 0; seen.push(cat); }
      count[cat]++;
    });

    var ordered = [];
    catOrder.forEach(function(c) { if (count[c]) ordered.push(c); });
    seen.forEach(function(c)     { if (ordered.indexOf(c) < 0) ordered.push(c); });

    var categories = ordered.map(function(c) { return { name: c, count: count[c] }; });
    Logger.log('getPriceListCategories: ' + categories.length + ' หมวด, ' + (data.length-1) + ' สินค้า');
    return { ok: true, categories: categories, sheetName: klh.getName() };
  } catch(e) {
    Logger.log('getPriceListCategories ERROR: ' + e);
    return { ok: false, msg: e.message || String(e) };
  }
}

function getPriceListItems(catName) {
  try {
    var klh = klhDataSheet_();
    if (!klh) return { ok: false, msg: 'ไม่พบ Sheet KLH DATA' };
    var data = klh.getDataRange().getValues();
    var items = [];
    data.slice(1).forEach(function(r) {
      var barcode = String(r[0] || '').trim();
      if (!barcode) return;
      var cat = String(r[2] || '').trim() || 'ไม่ระบุหมวด';
      if (cat !== catName) return;
      var safeN = function(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; };
      items.push({
        barcode:   barcode,
        name:      String(r[1]  || ''),
        size:      String(r[3]  || ''),
        mult:      safeN(r[4])  || 1,
        unit:      String(r[5]  || ''),
        cost:      safeN(r[17]),
        retail:    safeN(r[22]),
        wholesale: safeN(r[20]),
        dozenBarcode: String(r[33] || ''),  // AH
        dozenPrice:   safeN(r[34])          // AI = ราคาโหล (12 ชิ้น)
      });
    });
    Logger.log('getPriceListItems: ' + catName + ' = ' + items.length + ' รายการ');
    return { ok: true, items: items };
  } catch(e) {
    Logger.log('getPriceListItems ERROR: ' + e);
    return { ok: false, msg: e.message || String(e) };
  }
}

// Customer (Member) functions
function searchCustomers(query) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CUSTOMER_MASTER');
    if (!s || s.getLastRow() <= 1) return [];
    var q = String(query || '').trim().toLowerCase();
    return s.getDataRange().getValues().slice(1)
      .filter(function(r){
        return r[0] && (
          String(r[1]).toLowerCase().indexOf(q) >= 0 ||
          String(r[2]).toLowerCase().indexOf(q) >= 0 ||
          String(r[0]).toLowerCase().indexOf(q) >= 0
        );
      })
      .map(function(r){
        return {
          custId: String(r[0]||''), name: String(r[1]||''), phone: String(r[2]||''),
          priceLevel: String(r[5]||'retail'), creditLimit: Number(r[6])||0,
          creditDays: Number(r[7])||0, outstanding: Number(r[8])||0, entity: String(r[10]||'')
        };
      }).slice(0,10);
  } catch(e) { return []; }
}

function getCustomerById(custId) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CUSTOMER_MASTER');
    if (!s) return null;
    var rows = s.getDataRange().getValues().slice(1);
    for (var i=0;i<rows.length;i++) {
      if (String(rows[i][0]).trim() === String(custId).trim()) {
        var r = rows[i];
        return {
          custId: r[0], name: r[1], phone: r[2], address: r[3], taxId: r[4],
          priceLevel: r[5]||'retail', creditLimit: Number(r[6])||0,
          creditDays: Number(r[7])||0, outstanding: Number(r[8])||0,
          note: r[9], entity: r[10]
        };
      }
    }
    return null;
  } catch(e) { return null; }
}

function addCustomer(data) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CUSTOMER_MASTER');
    if (!s) return {ok:false, msg:'ไม่พบ CUSTOMER_MASTER'};
    var lastRow = s.getLastRow();
    var num = 1;
    if (lastRow > 1) {
      var lastId = s.getRange(lastRow,1).getValue();
      num = (parseInt(String(lastId).replace('CUST-','')) || 0) + 1;
    }
    var custId = 'CUST-' + String(num).padStart(4,'0');
    var now    = Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd');
    s.appendRow([
      custId, data.name||'', data.phone||'', data.address||'', data.taxId||'',
      data.priceLevel||'retail', Number(data.creditLimit)||0, Number(data.creditDays)||0,
      0, data.note||'', data.entity||'', now
    ]);
    return { ok:true, custId:custId, msg:'เพิ่มสมาชิก '+custId+' สำเร็จ' };
  } catch(e) { return { ok:false, msg:e.message }; }
}

function updateCustomer(custId, data) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CUSTOMER_MASTER');
    if (!s) return {ok:false, msg:'ไม่พบ CUSTOMER_MASTER'};
    var rows = s.getDataRange().getValues();
    for (var i=1;i<rows.length;i++) {
      if (String(rows[i][0]).trim() === String(custId).trim()) {
        s.getRange(i+1,1,1,11).setValues([[
          custId,
          data.name        || rows[i][1]  || '',
          data.contact     || rows[i][2]  || '',
          data.address     || rows[i][3]  || '',
          data.taxId       || rows[i][4]  || '',
          data.priceLevel  || rows[i][5]  || 'retail',
          Number(data.creditLimit !== undefined ? data.creditLimit : rows[i][6]),
          Number(data.creditDays  !== undefined ? data.creditDays  : rows[i][7]),
          rows[i][8],
          data.note !== undefined ? data.note : rows[i][9],
          data.entity || rows[i][10] || ''
        ]]);
        return {ok:true, msg:'อัปเดต '+custId+' สำเร็จ'};
      }
    }
    return {ok:false, msg:'ไม่พบรหัส '+custId};
  } catch(e) { return {ok:false, msg:e.message}; }
}

function getAllCustomers() {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CUSTOMER_MASTER');
    if (!s || s.getLastRow() <= 1) return [];
    return s.getDataRange().getValues().slice(1)
      .filter(function(r){ return r[0]; })
      .map(function(r){
        return {
          custId: r[0], name: r[1], phone: r[2], address: r[3], taxId: r[4],
          priceLevel: r[5], creditLimit: Number(r[6])||0, creditDays: Number(r[7])||0,
          outstanding: Number(r[8])||0, note: r[9], entity: r[10]
        };
      });
  } catch(e) { return []; }
}

// ── Init + Seed ทุกอย่างใน 1 ฟังก์ชัน (รันครั้งเดียว) ────────
function initAllAndSeed() {
  // 1. init POS sheets
  var r1 = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ['ORDERS','ORDER_DETAIL','SALES_HEADER','SALES_DETAIL','CUSTOMER_MASTER','AR_LEDGER'];
  sheets.forEach(function(name){ if(!r1.getSheetByName(name)){ r1.insertSheet(name); Logger.log('สร้าง '+name); } });
  // 2. seed customers
  var cm = r1.getSheetByName('CUSTOMER_MASTER');
  if (cm.getLastRow() <= 1) seedSampleCustomers();
  Logger.log('initAllAndSeed เสร็จสิ้น');
  return 'done';
}

// ── Seed 20 sample customers (รัน 1 ครั้งใน GAS Editor) ────────
function seedSampleCustomers() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s  = ss.getSheetByName('CUSTOMER_MASTER');
  if (!s) { Logger.log('ไม่พบ CUSTOMER_MASTER'); return 'error'; }
  if (s.getLastRow() > 1) { Logger.log('มีข้อมูลอยู่แล้ว'); return 'skip'; }
  var now = Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd');
  var data = [
    ['CUST-0001','ร้านขนมสุขใจ',         '081-234-5678','ตลาดสดชัยภูมิ',  '','wholesale',30000,30,0,'ลูกค้าเก่า',  'หจก. เคแอลเอช',now],
    ['CUST-0002','ร้านเบเกอรี่หอมกลิ่น', '089-876-5432','ถนนสระแก้ว',    '','vip',       80000,45,0,'ลูกค้า VIP', 'หจก. เคแอลเอช',now],
    ['CUST-0003','ห้างทรัพย์มงคล',        '044-811-234', 'อ.เมืองชัยภูมิ', '0135542000123','wholesale',100000,30,0,'',    'หจก. เคแอลเอช',now],
    ['CUST-0004','ร้านค้าปลีกสุขสันต์',   '085-111-2233','ต.บ้านเล่า',     '','retail',     5000, 0, 0,'',           'กวงล่งเฮง',now],
    ['CUST-0005','สหกรณ์ชุมชนชัยภูมิ',   '044-822-456', 'อ.เมือง',        '0125345000456','wholesale',50000,30,0,'',     'หจก. เคแอลเอช',now],
    ['CUST-0006','ร้านเจ๊กอ้อขนม',        '082-333-4455','ตลาดเช้า',       '','wholesale',20000,15,0,'',           'หจก. เคแอลเอช',now],
    ['CUST-0007','โรงแรมชัยภูมิเพลส',     '044-833-789', 'ถนนบรรณาการ',   '0155678000789','vip',      200000,45,0,'ชำระทุกสิ้นเดือน','หจก. เคแอลเอช',now],
    ['CUST-0008','ร้านอาหารครัวบ้าน',     '083-555-6677','อ.บ้านแท่น',     '','retail',    10000,0, 0,'',           'เอี่ยมเช็ง',now],
    ['CUST-0009','ร้านพรชัยสินค้า',       '086-777-8899','ถนนชัยภูมิ-โคราช','','wholesale',40000,30,0,'',          'หจก. เคแอลเอช',now],
    ['CUST-0010','บริษัทขนมดีมีสุข จำกัด','044-844-321', 'นิคมอุตสาหกรรม','0189012000321','vip',     500000,60,0,'','หจก. เคแอลเอช',now],
    ['CUST-0011','ร้านสดสะอาด',           '087-123-9900','ต.หนองบัว',      '','retail',     8000, 0, 0,'',           'กวงล่งเฮง',now],
    ['CUST-0012','ร้านขนมตลาดนัด',        '091-234-5000','อ.คอนสาร',       '','retail',     3000, 0, 0,'',           'หจก. เคแอลเอช',now],
    ['CUST-0013','ห้างร้านทวีทรัพย์',     '088-456-7890','อ.ภูเขียว',      '0231234000890','wholesale',60000,30,0,'','หจก. เคแอลเอช',now],
    ['CUST-0014','ร้านครัวลุงประยูร',     '090-567-8901','ต.โพนทอง',       '','retail',     5000, 0, 0,'',           'วิศาลศักดิ์',now],
    ['CUST-0015','โรงเรียนชัยภูมิพิทยาคม','044-811-000', 'อ.เมือง',        '0345678000001','retail',  20000,30,0,'โรงอาหาร','หจก. เคแอลเอช',now],
    ['CUST-0016','ร้านนายสมชาย',          '093-678-9012','อ.จัตุรัส',       '','retail',     5000, 0, 0,'',           'หจก. เคแอลเอช',now],
    ['CUST-0017','กลุ่มแม่บ้านบ้านค่าย',  '083-789-0123','ต.กุดชุมแสง',    '','retail',     2000, 0, 0,'',           'เอี่ยมเช็ง',now],
    ['CUST-0018','ร้านอาหารตามสั่งป้าจุ', '092-890-1234','ถนนชัยภูมิ',     '','retail',     3000, 0, 0,'',           'หจก. เคแอลเอช',now],
    ['CUST-0019','ซุปเปอร์มาร์เก็ตดาว',  '044-855-678', 'ห้างสรรพสินค้า',  '0456789000678','wholesale',150000,45,0,'','หจก. เคแอลเอช',now],
    ['CUST-0020','ร้านสวรรค์วัตถุดิบเบเกอรี','085-901-2345','ตลาดสด',    '','vip',        70000,30,0,'VIP เบเกอรี่','หจก. เคแอลเอช',now],
  ];
  s.getRange(2,1,data.length,12).setValues(data);
  Logger.log('เพิ่มลูกค้าตัวอย่าง 20 รายชื่อ สำเร็จ');
  return 'done';
}

// AR
function getArByCustomer(custId, status) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName('AR_LEDGER');
    if (!s || s.getLastRow() <= 1) return { ok:true, items:[] };
    var rows = s.getDataRange().getValues().slice(1)
      .filter(function(r){
        return (!custId || String(r[2]) === String(custId)) &&
               (!status  || String(r[10]) === status);
      })
      .map(function(r){
        return {
          arId: r[0], saleId: r[1], custId: r[2], custName: r[3], entity: r[4],
          invDate: r[5], dueDate: r[6],
          amount: Number(r[7])||0, paidAmt: Number(r[8])||0, balance: Number(r[9])||0,
          status: r[10], note: r[11]
        };
      });
    return { ok:true, items:rows };
  } catch(e) { return { ok:false, msg:e.message }; }
}

function payArEntry(arId, payAmount) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    var s    = SpreadsheetApp.openById(SHEET_ID).getSheetByName('AR_LEDGER');
    if (!s) { lock.releaseLock(); return { ok:false, msg:'ไม่พบ AR_LEDGER' }; }
    var rows = s.getDataRange().getValues();
    for (var i=1;i<rows.length;i++) {
      if (String(rows[i][0]) === String(arId)) {
        var paid    = (Number(rows[i][8])||0) + (Number(payAmount)||0);
        var balance = (Number(rows[i][7])||0) - paid;
        var status  = balance <= 0 ? 'PAID' : 'PARTIAL';
        s.getRange(i+1,9).setValue(paid);
        s.getRange(i+1,10).setValue(Math.max(0,balance));
        s.getRange(i+1,11).setValue(status);
        lock.releaseLock();
        return { ok:true, msg:'ชำระ '+arId+' ฿'+payAmount+' | คงเหลือ ฿'+Math.max(0,balance), balance: Math.max(0,balance) };
      }
    }
    lock.releaseLock();
    return { ok:false, msg:'ไม่พบ AR_ID '+arId };
  } catch(e) { return { ok:false, msg:e.message }; }
}

function getArSummary(entity, status) {
  try {
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName('AR_LEDGER');
    if (!s || s.getLastRow()<=1) return { ok:true, total:0, overdue:0, count:0 };
    var today = Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd');
    var rows = s.getDataRange().getValues().slice(1)
      .filter(function(r){ return (!entity || r[4]===entity) && r[10] !== 'PAID'; });
    var total = 0, overdue = 0;
    rows.forEach(function(r){
      var bal = Number(r[9])||0;
      total += bal;
      if (String(r[6]) < today) overdue += bal;
    });
    return { ok:true, total:total, overdue:overdue, count:rows.length };
  } catch(e) { return { ok:false, msg:e.message }; }
}
