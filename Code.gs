// ==========================================
// KLH LOGISTICS PRO V9.1 (Enterprise Survey)
// ==========================================

const SHEET_ID = "1ko72nyTpeQZ410eVALhlzZ2EhY7Qk0e340DAdQG8z4U"; // ← FIX #1: uncomment

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || 'index';
  const pageMap = { index: 'Index', wms: 'wms', pricelist: 'pricelist' };
  const tpl = pageMap[page] || 'Index';
  const titles = { wms: 'KLH WMS', pricelist: 'KLH Price List' };
  return HtmlService.createTemplateFromFile(tpl)
      .evaluate()
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setTitle(titles[page] || 'KLH V9.1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
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
    let shops = getList(cfg.TAB_SHOPS    || "SHOPS");

    shops = shops.filter(s => s.toUpperCase() !== "SHOPS" && s !== "ชื่อร้าน");
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

function getSupplierList(sheetName) {
  sheetName = sheetName || "SUPPLIER_MASTER";
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
    if (!sheet) return [];
    return sheet.getDataRange().getValues().slice(1).map(r => ({
      code: String(r[0]), name: String(r[1]), contact: String(r[2]), tel: String(r[4])
    }));
  } catch(e) { return []; }
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
    sheet.appendRow([newCode, data.name, data.contact, "", data.tel]);
    return { status: "success", code: newCode, name: data.name };
  } catch(e) { return { status: "error", message: e.toString() }; }
}

// ── Debug (run this in GAS Editor to diagnose search) ────────
function debugSearchTest() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  // แสดงชื่อ sheets ทั้งหมด
  var allSheets = ss.getSheets().map(function(s){ return s.getName(); });
  Logger.log('All sheets: ' + JSON.stringify(allSheets));
  // ค่า TAB_SURVEY จาก CONFIG
  var cfg = getConfig();
  Logger.log('cfg.TAB_SURVEY = "' + cfg.TAB_SURVEY + '"');
  // หา KLH DATA
  var sheet = ss.getSheetByName('KLH DATA');
  Logger.log('getSheetByName("KLH DATA") = ' + (sheet ? 'FOUND (' + sheet.getLastRow() + ' rows)' : 'NULL'));
  if (!sheet) return 'NO SHEET';
  // ลองค้นหา "หมึก"
  var data = sheet.getDataRange().getValues();
  var q = 'หมึก';
  var found = [];
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][1] || '');
    if (name.toLowerCase().indexOf(q) >= 0) found.push(data[i][0] + ':' + name);
  }
  Logger.log('Search "หมึก" found: ' + found.length + ' → ' + found.slice(0,5).join(', '));
  // Unicode ของสินค้าแถว 5 (ITEM-0004)
  if (data.length > 4) {
    var nm = String(data[4][1] || '');
    var codes = [];
    for (var j=0;j<nm.length;j++) codes.push(nm.charCodeAt(j));
    Logger.log('Row5 name="'+nm+'" codes='+codes.join(','));
    var qcodes = [];
    for (var k=0;k<q.length;k++) qcodes.push(q.charCodeAt(k));
    Logger.log('Query "'+q+'" codes='+qcodes.join(','));
    Logger.log('indexOf result: ' + nm.toLowerCase().indexOf(q));
  }
  return 'done — ดู Execution log';
}

function searchProductsFromSheet(query) {
  const cfg = getConfig();
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // หา sheet แบบ case-insensitive (แก้ปัญหา "KLH Data" vs "KLH DATA")
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
  if (!q) return [];

  // sv = safe string (แปลง Date/Error → ''), sn = safe number
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
      update_date:       '',         // Y  (skip Date object)
      ref_cost_whole:    sn(r[25]),  // Z  REF_COST_WHOLE
      ref_cost_retail:   sn(r[26]),  // AA REF_COST_RETAIL
      barcode_big:       sv(r[27]),  // AB BARCODE_BIG
      image_url:         sv(r[28]),  // AC IMAGE_URL
      tax_entity:        sv(r[29]),  // AD TAX_ENTITY
      product_group:     sv(r[30]),  // AE PRODUCT_GROUP
      supplier_compare:  sv(r[31]),  // AF SUPPLIER_COMPARE
      best_price_source: sv(r[32])   // AG BEST_PRICE_SOURCE
    };
  }).filter(function(p) {
    return p.barcode.toLowerCase().indexOf(q) >= 0 ||
           p.barcode_big.toLowerCase().indexOf(q) >= 0 ||
           p.name.toLowerCase().indexOf(q) >= 0;
  });
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

  // บันทึกรูปภาพ
  if (imgBase64 && cfg.TEMP_FOLDER_ID) {
    try {
      const folder = DriveApp.getFolderById(cfg.TEMP_FOLDER_ID);
      const blob = processImageWithBgRemoval(imgBase64, cfg);
      blob.setName("IMG_" + barcodeSmall + ".png");
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // ← FIX #2
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

  // LINE Messaging API  ← FIX #3: ใช้ Messaging API แทน LINE Notify
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
// FIX #4: ลบ writeStockLog() ออก เพราะซ้ำกับใน processAndSaveAll แล้ว
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const event = body.events[0];
  Logger.log(JSON.stringify(event.source));
  // จะเห็น groupId: "Cxxxxxxx..." ใน Logs
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

// ── Price List Data (แยก 2 ฟังก์ชัน: หมวด + สินค้า) ─────────
function klhDataSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = null;
  try {
    var cfg = getConfig();
    if (cfg && cfg.TAB_SURVEY) sheet = ss.getSheetByName(String(cfg.TAB_SURVEY).trim());
  } catch(e) {}
  return sheet || ss.getSheetByName('KLH DATA');
}

// ① โหลดหมวดหมู่ (เร็ว — return แค่ชื่อหมวด + จำนวน)
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

    // อ่านเฉพาะ col A (barcode) + col C (category) จาก KLH DATA
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

// ② โหลดสินค้าทีละหมวด
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
        wholesale: safeN(r[20])
      });
    });
    Logger.log('getPriceListItems: ' + catName + ' = ' + items.length + ' รายการ');
    return { ok: true, items: items };
  } catch(e) {
    Logger.log('getPriceListItems ERROR: ' + e);
    return { ok: false, msg: e.message || String(e) };
  }
}