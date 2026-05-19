// ==========================================
// KLH LOGISTICS PRO V9.1 (Enterprise Survey)
// ==========================================

const SHEET_ID = "1ko72nyTpeQZ410eVALhlzZ2EhY7Qk0e340DAdQG8z4U"; // ← FIX #1: uncomment

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || 'index';
  const pageMap = { index: 'Index', wms: 'wms' };
  const tpl = pageMap[page] || 'Index';
  return HtmlService.createTemplateFromFile(tpl)
      .evaluate()
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setTitle(page === 'wms' ? 'KLH WMS' : 'KLH V9.1');
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

function searchProductsFromSheet(query) {
  const cfg = getConfig();
  const surveySheet = cfg.TAB_SURVEY ? String(cfg.TAB_SURVEY).trim() : "KLH DATA";
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(surveySheet);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const q = String(query).toLowerCase();

  return data.slice(1).map((r, i) => ({
    row: i + 2,
    barcode: String(r[0]), name: r[1], category: r[2], size: r[3],
    packMult: r[4], packUnit: r[5], supCode: r[6],
    discount_cash: r[7], buy_price: r[8], discount_percent: r[9],
    buy_qty: r[11], free_qty: r[12], freight: r[14], tax: r[16],
    cost_final: r[17], wholesale_percent: r[18], retail_percent: r[19],
    wholesale_price: r[20], retail_price: r[22],
    barcode_big: String(r[27]), tax_entity: r[29], product_group: r[30]
  })).filter(p =>
    p.barcode.toLowerCase().includes(q) ||
    p.barcode_big.toLowerCase().includes(q) ||
    String(p.name).toLowerCase().includes(q)
  );
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

  const rowData = new Array(31).fill("");
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

  sheet.getRange(row, 1, 1, 31).setValues([rowData]);

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
  
  // ดึงรายการกลุ่มที่ bot อยู่ (ต้องส่งข้อความในกลุ่มก่อน 1 ครั้ง)
  const res = UrlFetchApp.fetch(
    "https://api.line.me/v2/bot/message/replyToken",  
    { headers: { "Authorization": "Bearer " + token } }
  );
  Logger.log(res.getContentText());
}