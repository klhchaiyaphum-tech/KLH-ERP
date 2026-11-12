// ============================================================
//  pp30_import.js — แยกข้อมูลจากชุดเอกสาร ภพ.30 (OCR แล้วใน AP_OCR_STAGING) ออกมาเป็นชีตตรวจต่างหาก
//  ★ ทุกฟังก์ชันที่รันได้ เขียนเฉพาะชีต PP30_* / OCR_PAGE_TEST — ไม่แตะ SUPPLIER_MASTER · KLH DATA ·
//    INVOICE_HEADER · AP_LEDGER (ผู้ใช้ตรวจ/ตัดสินใจก่อน เพราะของเดิมอาจซ้ำหรือใช้ชื่อไม่ตรงกัน)
//  1) pp30Build()      รวมหน้ารายงานภาษีซื้อ + ผูกใบกำกับ → PP30_LIST + PP30_SUMMARY (ผลรวมเทียบแถวยอดรวม)
//  2) pp30Suppliers()  ผู้ขายในบิล (ชื่อ ที่อยู่ เลขภาษี) ↔ SUPPLIER_MASTER → PP30_SUPPLIERS (ให้ผู้ใช้ยืนยัน)
//  3) pp30Items()      สินค้าทุกบรรทัดในบิล ↔ KLH DATA + ความถี่/รอบสั่ง/ราคา → PP30_ITEMS
//  4) pp30PayCheck()   ยอดจ่าย BAYC ↔ บิล (ยอดตรง) หาจ่ายซ้ำ/ค้างจ่าย → PP30_PAYCHECK · PP30_APSTATUS · PP30_APSUM
//  5) ocrPageTest()    ทดสอบวิธีจับคู่ของหน้า OCR เดิม เทียบวิธีใหม่ ด้วยบิลชุดนี้ (ไม่ใช้ Gemini เพิ่ม) → OCR_PAGE_TEST
//  pp30Commit_()       ยังไม่เปิดใช้ (ลงท้าย _ = รันจากเมนูไม่ได้) รอผู้ใช้ตรวจชีตครบแล้วค่อยเปิด
//  Depends: ap_ocr.js · ap_payable.js (apDs_, apLoadAliases_, apMatchSup2_) · ap_supplier.js (apNorm_, apParseSubject_)
//           invoice_ocr.js (ocrAliasSheet_, ocrProdKey_, lookupSupplierForOcr, lookupProductsForOcr, initOcrSheets, initApSheets_)
// ============================================================

var PP30_LIST   = 'PP30_LIST';
var PP30_SUM    = 'PP30_SUMMARY';
var PP30_SUPS   = 'PP30_SUPPLIERS';
var PP30_ITEMS  = 'PP30_ITEMS';
var PP30_PAYCHK = 'PP30_PAYCHECK';
var PP30_APST   = 'PP30_APSTATUS';
var PP30_APSUM  = 'PP30_APSUM';
var OCR_TEST    = 'OCR_PAGE_TEST';
var PP30_ENTITY = 'ห้างหุ้นส่วนจำกัด เคแอลเอช';

// 0 KEY · 1 PERIOD · 2 SEQ · 3 INVOICE_DATE · 4 INVOICE_NO · 5 SUPPLIER_REPORT · 6 SUPPLIER_CODE
// 7 SUPPLIER_NAME · 8 MATCH · 9 BASE · 10 VAT · 11 TOTAL · 12 DUE_DATE · 13 PAGES · 14 PAGE_TOTAL
// 15 N_ITEMS · 16 CHECK · 17 DECISION · 18 RECV_NO · 19 AP_ID
var H_PP30_LIST = ['KEY','PERIOD','SEQ','INVOICE_DATE','INVOICE_NO','SUPPLIER_REPORT','SUPPLIER_CODE',
                   'SUPPLIER_NAME','MATCH','BASE','VAT','TOTAL','DUE_DATE','PAGES','PAGE_TOTAL',
                   'N_ITEMS','CHECK','DECISION','RECV_NO','AP_ID'];
var H_PP30_SUM = ['PERIOD','REPORT_PAGES','INVOICE_PAGES','ROWS','SUM_BASE','SUM_VAT','SUM_TOTAL',
                  'REPORT_BASE','REPORT_VAT','REPORT_TOTAL','DIFF_VAT','VAT_IMPORT','LINKED',
                  'NO_INVOICE','ORPHAN_PAGES','FLAGGED','NOTE'];
// 0 GROUP_KEY · 1 TAX_ID · 2 NAME_ON_BILL · 3 OTHER_NAMES · 4 ADDRESS · 5 TEL · 6 INVOICES · 7 TOTAL · 8 PERIODS
// 9 MATCH_CODE · 10 MATCH_NAME · 11 MATCH_HOW · 12 MASTER_TAX_ID · 13 MASTER_ADDRESS · 14 MASTER_TEL
// 15 ALT_1 · 16 ALT_2 · 17 ALT_3 · 18 SUGGEST · 19 CONFIRM_CODE
var H_PP30_SUPS = ['GROUP_KEY','TAX_ID','NAME_ON_BILL','OTHER_NAMES','ADDRESS','TEL','INVOICES','TOTAL','PERIODS',
                   'MATCH_CODE','MATCH_NAME','MATCH_HOW','MASTER_TAX_ID','MASTER_ADDRESS','MASTER_TEL',
                   'ALT_1','ALT_2','ALT_3','SUGGEST','CONFIRM_CODE'];
// 0 ITEM_KEY · 1 SUPPLIER_CODE · 2 SUPPLIER_NAME · 3 BILL_CODE · 4 BILL_NAME · 5 UNIT · 6 LINES · 7 ORDERS
// 8 TOTAL_QTY · 9 TOTAL_AMOUNT · 10 FIRST_DATE · 11 LAST_DATE · 12 AVG_DAYS · 13 PRICE_MIN · 14 PRICE_MAX
// 15 PRICE_LAST · 16 BARCODE · 17 KLH_NAME · 18 MATCH · 19 ALT_1 · 20 ALT_2 · 21 ALT_3 · 22 MULT · 23 UNIT_BIG
// 24 KLH_BUY_PRICE · 25 PIECE_PRICE_LAST · 26 DIFF_BUY_% · 27 KLH_COST_FINAL · 28 FLAG
var H_PP30_ITEMS = ['ITEM_KEY','SUPPLIER_CODE','SUPPLIER_NAME','BILL_CODE','BILL_NAME','UNIT','LINES','ORDERS',
                    'TOTAL_QTY','TOTAL_AMOUNT','FIRST_DATE','LAST_DATE','AVG_DAYS','PRICE_MIN','PRICE_MAX',
                    'PRICE_LAST','BARCODE','KLH_NAME','MATCH','ALT_1','ALT_2','ALT_3','MULT','UNIT_BIG',
                    'KLH_BUY_PRICE','PIECE_PRICE_LAST','DIFF_BUY_%','KLH_COST_FINAL','FLAG'];
var H_PP30_PAYCHK = ['REF','DATE','PAYEE','ACCOUNT','AMOUNT','SUP_CODE','SUP_NAME','HOW',
                     'MATCHED_INVOICES','INVOICE_SUM','RESULT','BANK_NOTE'];
var H_PP30_APST = ['PERIOD','SEQ','INVOICE_DATE','INVOICE_NO','SUP_CODE','SUP_NAME','TOTAL',
                   'PAID_BY_REF','PAID_DATE','DAYS_TO_PAY','STATUS'];
var H_PP30_APSUM = ['SUP_CODE','SUP_NAME','INVOICES','INVOICE_TOTAL','PAYMENTS','PAY_TOTAL','MATCHED_PAY',
                    'UNMATCHED_PAY','OUTSTANDING','SUSPECT','NOTE'];
var H_OCR_TEST = ['FILE','SUP_ON_BILL','TAX_ID','TRUTH_BY_TAX','OCR_PAGE_PICK','SUP_RESULT','SUM_ITEMS',
                  'SUBTOTAL','SUM_CHECK','LINE','BILL_ITEM','OCR_PAGE_ITEM','NEW_ITEM','ITEM_RESULT'];

// ── helpers ─────────────────────────────────────────────────
function pp30Num_(v) { var n = Number(String(v === null || v === undefined ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
function pp30Ds_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') { return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd'); }
  var s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}
function pp30InvKey_(s) { return String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, ''); }
// เลขบิลเดียวกันไหม (ทน OCR: ขีด/ช่องว่าง/ตัวอักษรหน้าเลข)
function pp30InvSame_(a, b) {
  if (!a || !b) { return false; }
  if (a === b) { return true; }
  var da = a.replace(/\D/g, ''), db = b.replace(/\D/g, '');
  if (da.length >= 6 && da === db) { return true; }
  return a.length >= 6 && b.length >= 6 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0);
}
function pp30MonthDiff_(period, date) {
  var p = String(period).match(/^(\d{4})-(\d{2})/), d = String(date).match(/^(\d{4})-(\d{2})/);
  if (!p || !d) { return 0; }
  return (Number(p[1]) * 12 + Number(p[2])) - (Number(d[1]) * 12 + Number(d[2]));
}
function pp30AddDays_(ds, n) {
  if (!ds || !n) { return ''; }
  var d = new Date(ds + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
}
function pp30DayDiff_(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
function pp30KlhTax_() {
  var cfg = getConfig(), keys = ['COMPANY_TAX_ID','TAX_ID','TAXID','TAXPAYER_ID'];
  for (var i = 0; i < keys.length; i++) {
    var t = String(cfg[keys[i]] || '').replace(/\D/g, '');
    if (t.length === 13) { return t; }
  }
  return '0363542000326';
}
function r2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function r4_(n) { return Math.round((Number(n) || 0) * 10000) / 10000; }
// เขียนชีตทั้งก้อน (ล้างแถวเก่า) · textCols = คอลัมน์ (เริ่ม 1) ที่ต้องเก็บเป็นข้อความ
function pp30WriteSheet_(name, header, rows, textCols) {
  var s = apOcrSheet_(name, header);
  if (s.getLastRow() > 1) { s.getRange(2, 1, s.getLastRow() - 1, Math.max(header.length, s.getLastColumn())).clearContent(); }
  if (!rows.length) { return s; }
  (textCols || []).forEach(function(c) { s.getRange(2, c, rows.length, 1).setNumberFormat('@'); });
  s.getRange(2, 1, rows.length, header.length).setValues(rows);
  return s;
}
function pp30ReadSheet_(name, header) {
  var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
  if (!s || s.getLastRow() <= 1) { return []; }
  return s.getRange(2, 1, s.getLastRow() - 1, header.length).getValues();
}
// หน้าในชีตพัก → map ชื่อไฟล์ → {id, items[], type}
function pp30StagingPages_() {
  var out = {};
  pp30ReadSheet_(AP_OCR_STAGING, H_AP_STG).forEach(function(r) {
    var items = [];
    try { items = JSON.parse(r[18] || '[]'); } catch (e) {}
    out[String(r[1])] = { id:String(r[21]), type:String(r[3]), items:items };
  });
  return out;
}
// ความคล้ายของชื่อ (คู่ตัวอักษร) — ชื่อไทยไม่เว้นวรรคก็เทียบได้
function pp30Grams_(s) {
  var t = String(s || '').toLowerCase().replace(/[\s\.\,\(\)\-\/\*x×"']+/g, '');
  var g = {};
  for (var i = 0; i < t.length - 1; i++) { var k = t.substr(i, 2); g[k] = (g[k] || 0) + 1; }
  return { g:g, n:Math.max(0, t.length - 1) };
}
function pp30Dice_(a, b) {
  if (!a.n || !b.n) { return 0; }
  var hit = 0;
  for (var k in a.g) { if (b.g[k]) { hit += Math.min(a.g[k], b.g[k]); } }
  return 2 * hit / (a.n + b.n);
}

// ════════════════════════════════════════════════════════════
//  1) รวมรายงาน + ผูกใบกำกับ → PP30_LIST
// ════════════════════════════════════════════════════════════
function pp30Build() {
  var sv = pp30ReadSheet_(AP_OCR_STAGING, H_AP_STG);
  if (!sv.length) { Logger.log('ชีตพักว่าง — รัน apOcrRun() ก่อน'); return; }
  var idx = apOcrSupplierIndex_();
  var klhTax = pp30KlhTax_();

  // ค่าที่ผู้ใช้ตัดสินใจไว้ (รันซ้ำไม่หาย)
  var old = {};
  pp30ReadSheet_(PP30_LIST, H_PP30_LIST).forEach(function(r) {
    old[String(r[0])] = { code:String(r[6]), name:String(r[7]), dec:String(r[17]), recv:String(r[18]), ap:String(r[19]) };
  });

  // แยกหน้ารายงาน / ใบกำกับ ตามงวด
  var reports = {}, pages = {}, periods = {};
  sv.forEach(function(r) {
    var per = String(r[2]) || '(ไม่ทราบงวด)', t = String(r[3]);
    periods[per] = true;
    if (t === 'report') {
      var rp = reports[per] || (reports[per] = { rows:[], grand:null, files:0 });
      rp.files++;
      var rows = [];
      try { rows = JSON.parse(r[18] || '[]'); } catch (e) {}
      rows.forEach(function(x) { rp.rows.push(x); });
      if (String(r[16]) !== '') { rp.grand = { base:pp30Num_(r[14]), vat:pp30Num_(r[15]), total:pp30Num_(r[16]) }; }
    } else if (t === 'invoice' || t === 'credit') {
      (pages[per] = pages[per] || []).push({ file:String(r[1]), type:t, seq:String(r[4]).replace(/\D/g, ''),
        supOcr:String(r[5]), tax:String(r[6]), code:String(r[7]), name:String(r[8]), how:String(r[9]),
        buyerTax:String(r[10]), inv:String(r[11]), invKey:pp30InvKey_(r[11]), date:pp30Ds_(r[12]),
        due:pp30Ds_(r[13]), total:pp30Num_(r[16]), n:pp30Num_(r[17]), used:false });
    }
  });

  var out = [], sum = {}, dupSeen = {};
  function supOf_(name, linked) {
    for (var i = 0; i < linked.length; i++) { if (linked[i].code) { return { code:linked[i].code, name:linked[i].name, how:linked[i].how }; } }
    return apOcrMatchSupplier_(name, '', idx);
  }
  function makeRow_(key, per, seq, date, inv, supRep, base, vat, total, linked, chk, defDec) {
    var o = old[key] || {};
    var sup = supOf_(supRep, linked);
    if (!sup.code && o.code) { sup = { code:o.code, name:o.name, how:'แก้มือ' }; }
    var pageTotal = 0, nItems = 0, due = '', files = [];
    linked.forEach(function(p) {
      files.push(p.file); nItems += p.n;
      if (Math.abs(p.total) > Math.abs(pageTotal)) { pageTotal = p.total; }
      if (!due && p.due) { due = p.due; }
      if (p.buyerTax.length === 13 && p.buyerTax !== klhTax) { chk.push('ใบกำกับไม่ใช่ชื่อ KLH (' + p.file + ')'); }
    });
    if (!due && sup.code) {
      for (var i = 0; i < idx.list.length; i++) {
        if (idx.list[i].code === sup.code && idx.list[i].credit) { due = pp30AddDays_(date, idx.list[i].credit); break; }
      }
    }
    if (!total) { chk.push('ยอดเป็น 0/ขีด'); }
    if (Math.abs(base + vat - total) > 0.05) { chk.push('มูลค่า+ภาษี ไม่เท่ารวม'); }
    if (base > 0 && Math.abs(vat - base * 0.07) > Math.max(1, base * 0.005)) { chk.push('ภาษีไม่ใช่ 7%'); }
    if (linked.length && pageTotal && Math.abs(Math.abs(pageTotal) - Math.abs(total)) > 0.05) { chk.push('ยอดในใบกำกับ ' + pageTotal + ' ไม่เท่ารายงาน'); }
    var md = pp30MonthDiff_(per, date);
    if (md > 6) { chk.push('บิลเก่าเกิน 6 เดือน'); }
    if (md < 0) { chk.push('วันที่บิลหลังงวดภาษี'); }
    if (!sup.code) { chk.push('ไม่รู้จักผู้ขาย'); }
    // ซ้ำ: ผู้ขาย + เลขบิลเดียวกัน (ทุกงวด) → ใบหลังตั้งเป็น ข้าม
    var invKey = pp30InvKey_(inv), dec = defDec;
    if (invKey) {
      var dk = (sup.code || apOcrNorm_(supRep)) + '|' + invKey;
      if (dupSeen[dk]) { chk.push('ซ้ำกับ ' + dupSeen[dk]); dec = 'ข้าม'; }
      else { dupSeen[dk] = per + ' ลำดับ ' + (seq || '-'); }
    }
    if (!total) { dec = 'ข้าม'; }
    if (o.dec) { dec = o.dec; }
    return [key, per, seq, date, inv, supRep, sup.code, sup.name, sup.how, base, vat, total, due,
            files.join(', '), pageTotal || '', nItems, chk.join(' · '), dec, o.recv || '', o.ap || ''];
  }

  Object.keys(periods).sort().forEach(function(per) {
    var rp = reports[per], pg = pages[per] || [];
    var st = sum[per] = { rp:rp ? rp.files : 0, ip:pg.length, rows:0, b:0, v:0, t:0, linked:0, noInv:0, orphan:0, flag:0, vImp:0,
                          grand:rp ? rp.grand : null, dropped:0 };
    if (rp) {
      var seen = {};
      rp.rows.sort(function(a, b) { return pp30Num_(a.seq) - pp30Num_(b.seq); });
      rp.rows.forEach(function(x, i) {
        var seq = String(x.seq === null || x.seq === undefined ? '' : x.seq).replace(/\D/g, '');
        var inv = String(x.invoiceNo || ''), invKey = pp30InvKey_(inv);
        var base = pp30Num_(x.base), vat = pp30Num_(x.vat), total = pp30Num_(x.total);
        var k1 = seq + '|' + invKey + '|' + total.toFixed(2);
        if (seen[k1]) { st.dropped++; return; }   // หน้ารายงานเดียวกันสแกนซ้ำ
        seen[k1] = true;
        // ผูกใบกำกับ: เลขบิลเดียวกัน (รวมหลายหน้า) → เลขวงกลม + ยอดใกล้กัน → ยอดเงินตรงกันใบเดียว
        var linked = pg.filter(function(p) { return pp30InvSame_(p.invKey, invKey); });
        if (!linked.length && seq) {
          linked = pg.filter(function(p) { return !p.used && p.seq === seq && (!p.total || Math.abs(Math.abs(p.total) - Math.abs(total)) < 1); });
        }
        if (!linked.length && total) {
          var byAmt = pg.filter(function(p) { return !p.used && Math.abs(Math.abs(p.total) - Math.abs(total)) <= 0.01; });
          if (byAmt.length === 1) { linked = byAmt; }
        }
        linked.forEach(function(p) { p.used = true; });
        var chk = [];
        if (!linked.length) { chk.push('ไม่พบใบกำกับในชุดสแกน'); }
        var row = makeRow_(per + '|' + (seq || ('#' + i)) + '|' + invKey, per, seq, pp30Ds_(x.date), inv,
                           String(x.supplier || ''), base, vat, total, linked, chk, 'นำเข้า');
        out.push(row);
        st.rows++; st.b += base; st.v += vat; st.t += total;
        if (linked.length) { st.linked++; } else { st.noInv++; }
        if (row[16]) { st.flag++; }
        if (row[17] === 'นำเข้า') { st.vImp += vat; }
      });
    }
    // ใบกำกับที่ไม่อยู่ในรายงาน: งวดไม่มีหน้ารายงาน → ใช้ใบกำกับเป็นรายการ · มีรายงาน → ข้าม (ยังไม่ได้ขอคืนภาษี?)
    var groups = {}, order = [];
    pg.forEach(function(p) {
      if (p.used) { return; }
      var g = p.invKey || ('F:' + p.file);
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(p);
    });
    order.forEach(function(g) {
      var ps = groups[g], p0 = ps[0];
      for (var i = 1; i < ps.length; i++) { if (Math.abs(ps[i].total) > Math.abs(p0.total)) { p0 = ps[i]; } }
      var total = p0.total;
      var vat = Math.round(total * 7 / 107 * 100) / 100, base = Math.round((total - vat) * 100) / 100;
      var chk = [rp ? 'ไม่อยู่ในรายงาน ภพ.30 งวดนี้' : 'งวดนี้ไม่มีหน้ารายงาน — ใช้ยอดจากใบกำกับ', 'มูลค่า/ภาษีคำนวณจาก 7/107'];
      if (p0.type === 'credit') { chk.push('ใบลดหนี้'); }
      var row = makeRow_(per + '|P|' + g, per, p0.seq, p0.date, p0.inv, p0.supOcr, base, vat,
                         p0.type === 'credit' ? -Math.abs(total) : total, ps, chk, rp ? 'ข้าม' : 'นำเข้า');
      out.push(row);
      st.orphan += ps.length;
      if (!rp) { st.rows++; st.b += base; st.v += vat; st.t += row[11]; st.linked++; if (row[17] === 'นำเข้า') { st.vImp += vat; } }
      st.flag++;
    });
  });

  pp30WriteSheet_(PP30_LIST, H_PP30_LIST, out, [1, 2, 3, 5, 7, 19, 20]);

  var sumRows = [], log = ['═══════ สรุปชุด ภพ.30 ═══════'];
  Object.keys(sum).sort().forEach(function(per) {
    var s = sum[per], g = s.grand;
    var diff = g ? Math.round((s.v - g.vat) * 100) / 100 : '';
    var note = !s.rp ? 'ไม่มีหน้ารายงาน — ใช้ยอดจากใบกำกับ (ประมาณ VAT 7/107)'
             : !g ? '⚠️ ไม่พบแถวยอดรวมในรายงาน'
             : Math.abs(diff) <= 0.05 ? '✅ ผลรวมทุกแถวตรงกับยอดรวมในรายงาน'
             : '⚠️ ผลรวมต่างจากยอดรวมในรายงาน ' + diff + ' — มีแถวที่อ่านผิด/หลุด';
    if (s.dropped) { note += ' · ตัดแถวสแกนซ้ำ ' + s.dropped; }
    sumRows.push([per, s.rp, s.ip, s.rows, r2_(s.b), r2_(s.v), r2_(s.t), g ? g.base : '', g ? g.vat : '', g ? g.total : '',
                  diff, r2_(s.vImp), s.linked, s.noInv, s.orphan, s.flag, note]);
    log.push(per + ': ' + s.rows + ' รายการ · VAT ' + r2_(s.v) + (g ? ' (รายงาน ' + g.vat + ')' : '') + ' · ผูกใบกำกับ ' + s.linked
             + ' · ไม่พบใบ ' + s.noInv + ' · ติดธง ' + s.flag + ' · ' + note);
  });
  pp30WriteSheet_(PP30_SUM, H_PP30_SUM, sumRows, [1]);
  log.push('ดูที่ชีต ' + PP30_LIST + ' (CHECK = สิ่งที่ต้องตรวจ) → ต่อด้วย pp30Suppliers() · pp30Items() · pp30PayCheck()');
  Logger.log(log.join('\n'));
  return log.join('\n');
}

// ════════════════════════════════════════════════════════════
//  2) ผู้ขายในบิล ↔ SUPPLIER_MASTER → PP30_SUPPLIERS (ข้อเสนอ ให้ผู้ใช้ยืนยันในคอลัมน์ CONFIRM_CODE)
// ════════════════════════════════════════════════════════════
function pp30Suppliers() {
  var sv = pp30ReadSheet_(AP_OCR_STAGING, H_AP_STG);
  if (!sv.length) { Logger.log('ชีตพักว่าง — รัน apOcrRun() ก่อน'); return; }
  var idx = apOcrSupplierIndex_();
  var smv = pp30ReadSheet_('SUPPLIER_MASTER', ['','','','','','','','','','','']);
  var master = {}, taxCodes = {};
  smv.forEach(function(r) {
    var code = String(r[0] || ''); if (!code) { return; }
    master[code] = { name:String(r[1] || ''), addr:String(r[3] || ''), tel:String(r[4] || ''), tax:String(r[5] || '').replace(/\D/g, '') };
    if (master[code].tax.length === 13 && String(r[1]).indexOf('⊘') < 0) { (taxCodes[master[code].tax] = taxCodes[master[code].tax] || []).push(code); }
  });
  idx.list.forEach(function(s) { s.gr = pp30Grams_(s.norm); });
  var confirm = {};
  pp30ReadSheet_(PP30_SUPS, H_PP30_SUPS).forEach(function(r) { if (r[19]) { confirm[String(r[0])] = String(r[19]); } });

  var groups = {}, byNorm = {};
  sv.forEach(function(r) {
    var t = String(r[3]);
    if (t !== 'invoice' && t !== 'credit') { return; }
    var name = String(r[5] || '').trim(), tax = String(r[6] || '').replace(/\D/g, '');
    if (!name && tax.length !== 13) { return; }
    var key = tax.length === 13 ? 'TAX:' + tax : 'N:' + apOcrNorm_(name);
    var g = groups[key] || (groups[key] = { key:key, tax:tax.length === 13 ? tax : '', names:{}, addr:'', tel:'', inv:{}, periods:{} });
    if (name) { g.names[name] = (g.names[name] || 0) + 1; byNorm[apOcrNorm_(name)] = key; }
    if (!g.addr && r[22]) { g.addr = String(r[22]); }
    if (!g.tel && r[23]) { g.tel = String(r[23]); }
    var ik = pp30InvKey_(r[11]) || String(r[1]);
    g.inv[ik] = Math.max(g.inv[ik] || 0, Math.abs(pp30Num_(r[16])));
    g.periods[String(r[2])] = true;
  });
  // ผู้ขายที่มีแต่ในหน้ารายงาน (ไม่เจอใบกำกับ)
  pp30ReadSheet_(PP30_LIST, H_PP30_LIST).forEach(function(L) {
    if (L[13]) { return; }
    var name = String(L[5] || '').trim(); if (!name) { return; }
    var n = apOcrNorm_(name), key = byNorm[n] || ('N:' + n);
    var g = groups[key] || (groups[key] = { key:key, tax:'', names:{}, addr:'', tel:'', inv:{}, periods:{}, reportOnly:true });
    g.names[name] = (g.names[name] || 0) + 1;
    g.inv[pp30InvKey_(L[4]) || String(L[0])] = Math.abs(pp30Num_(L[11]));
    g.periods[String(L[1])] = true;
    byNorm[n] = key;
  });

  var out = [], cnt = { tax:0, name:0, near:0, none:0, warn:0 };
  Object.keys(groups).forEach(function(k) {
    var g = groups[k];
    var names = Object.keys(g.names).sort(function(a, b) { return g.names[b] - g.names[a]; });
    var hit = apOcrMatchSupplier_(names[0] || '', g.tax, idx);
    var ms = hit.code ? master[hit.code] || {} : {};
    var sug;
    if (hit.how === 'เลขภาษีตรง') { sug = 'ตรงด้วยเลขภาษี ✅'; cnt.tax++; }
    else if (hit.code && g.tax && ms.tax && ms.tax !== g.tax) { sug = '⚠️ ชื่อตรงแต่เลขภาษีไม่ตรง (คนละสาขา/คนละบริษัท?)'; cnt.warn++; }
    else if (hit.code && hit.how !== 'ใกล้เคียง') { sug = 'ชื่อตรง' + (g.tax && !ms.tax ? ' · master ยังไม่มีเลขภาษี เติมได้' : ''); cnt.name++; }
    else if (hit.code) { sug = 'ชื่อใกล้เคียง — ช่วยดู'; cnt.near++; }
    else { sug = 'ไม่พบใน master — ผู้ขายใหม่? (หรือดู ALT)'; cnt.none++; }
    if (g.tax && taxCodes[g.tax] && taxCodes[g.tax].length > 1) { sug += ' · master มีเลขภาษีนี้ซ้ำ: ' + taxCodes[g.tax].join(', '); }
    if (g.reportOnly) { sug += ' · มีแต่ในหน้ารายงาน (ไม่มีใบกำกับ ไม่มีที่อยู่)'; }
    // ตัวเลือกอื่น 3 อันดับ (ความคล้ายของชื่อ)
    var gr = pp30Grams_(apOcrNorm_(names[0] || '')), sc = [];
    idx.list.forEach(function(s) { if (s.code !== hit.code) { var d = pp30Dice_(gr, s.gr); if (d >= 0.3) { sc.push({ s:s, d:d }); } } });
    sc.sort(function(a, b) { return b.d - a.d; });
    var alt = sc.slice(0, 3).map(function(x) { return x.s.code + ' ' + x.s.name + ' (' + Math.round(x.d * 100) + '%)'; });
    var total = 0, nInv = 0;
    for (var ik in g.inv) { total += g.inv[ik]; nInv++; }
    out.push([g.key, g.tax, names[0] || '', names.slice(1).join(' | '), g.addr, g.tel, nInv, r2_(total),
              Object.keys(g.periods).sort().join(', '), hit.code, hit.name, hit.how,
              ms.tax || '', ms.addr || '', ms.tel || '', alt[0] || '', alt[1] || '', alt[2] || '', sug, confirm[g.key] || '']);
  });
  out.sort(function(a, b) { return b[7] - a[7]; });
  pp30WriteSheet_(PP30_SUPS, H_PP30_SUPS, out, [1, 2, 6, 10, 13, 15, 20]);
  var msg = 'ผู้ขายในบิล ' + out.length + ' ราย · ตรงด้วยเลขภาษี ' + cnt.tax + ' · ชื่อตรง ' + cnt.name
          + ' · ใกล้เคียง ' + cnt.near + ' · ไม่พบ ' + cnt.none + ' · เลขภาษีขัดกัน ' + cnt.warn
          + '\nตรวจที่ชีต ' + PP30_SUPS + ' — ถ้าถูกพิมพ์รหัสผู้ขายในคอลัมน์ CONFIRM_CODE (SUPPLIER_MASTER ยังไม่ถูกแก้)';
  Logger.log(msg);
  return msg;
}

// ════════════════════════════════════════════════════════════
//  3) สินค้าในบิล ↔ KLH DATA + ความถี่/รอบสั่ง/ราคา → PP30_ITEMS (1 แถว = ผู้ขาย + ชื่อสินค้าในบิล)
//     ผู้ใช้ตัดสิน: แก้ BARCODE แล้วพิมพ์ MATCH = แก้มือ หรือ MATCH = ยืนยัน (ถูกแล้ว) — รันซ้ำไม่หาย
// ════════════════════════════════════════════════════════════
function pp30ItemKey_(sup, name) { return String(sup || '') + '|' + String(name || '').replace(/\s+/g, '').toLowerCase(); }

function pp30ProdIndex_() {
  // KLH DATA: 0 barcode · 1 name · 4 mult · 5 unit_big · 6 sup · 8 buy · 17 cost · 27 bc_big · 33 bc_doz
  var kd = klhDataSheet_().getDataRange().getValues();
  var ix = { byBc:{}, bcMap:{}, bySup:{}, prods:[], alias:{}, manual:{} };
  for (var i = 1; i < kd.length; i++) {
    var r = kd[i], nm = String(r[1] || '');
    if (!nm) { continue; }
    var p = { bc:String(r[0] || ''), name:nm, mult:pp30Num_(r[4]) || 1, unitBig:String(r[5] || ''),
              sup:String(r[6] || ''), buy:pp30Num_(r[8]), cost:pp30Num_(r[17]), gr:null };
    ix.prods.push(p);
    if (p.bc) { ix.bcMap[p.bc] = p; }
    [r[0], r[27], r[33]].forEach(function(b) { b = String(b || '').replace(/\D/g, ''); if (b.length >= 8 && !ix.byBc[b]) { ix.byBc[b] = p; } });
    (ix.bySup[p.sup] = ix.bySup[p.sup] || []).push(p);
  }
  var as = ocrAliasSheet_();
  if (as.getLastRow() > 1) {
    as.getRange(2, 1, as.getLastRow() - 1, 3).getValues().forEach(function(a) { ix.alias[ocrProdKey_(a[0], a[1])] = String(a[2]); });
  }
  pp30ReadSheet_(PP30_ITEMS, H_PP30_ITEMS).forEach(function(o) {
    var how = String(o[18]);
    if ((how === 'แก้มือ' || how === 'ยืนยัน') && o[16]) { ix.manual[String(o[0])] = { bc:String(o[16]), how:how }; }
  });
  return ix;
}

// จับคู่ 1 รายการ: แก้มือ/ยืนยัน → จำไว้ → บาร์โค้ด → ชื่อคล้าย (ในสินค้าของผู้ขายนี้ก่อน)
function pp30MatchProd_(ix, sup, codeB, nameB, itemKey) {
  var res = { hit:null, how:'ไม่พบ', alts:[] };
  var mk = itemKey ? ix.manual[itemKey] : null;
  if (mk && ix.bcMap[mk.bc]) { res.hit = ix.bcMap[mk.bc]; res.how = mk.how; return res; }
  var ab = ix.alias[ocrProdKey_(sup, nameB)] || ix.alias[ocrProdKey_('', nameB)];
  if (ab && ix.bcMap[ab]) { res.hit = ix.bcMap[ab]; res.how = 'จำไว้'; return res; }
  var cd = String(codeB || '').replace(/\D/g, '');
  if (cd.length >= 8 && ix.byBc[cd]) { res.hit = ix.byBc[cd]; res.how = 'บาร์โค้ด'; return res; }
  if (!nameB) { return res; }
  var pool = (sup && ix.bySup[sup] && ix.bySup[sup].length) ? ix.bySup[sup] : null;
  var inSup = !!pool;
  if (!pool) {   // ผู้ขายไม่มีสินค้าใน KLH DATA → กรองทั้งหมดด้วยคำในชื่อ (ชื่อไทยติดกันยาว → ใช้ 4 ตัวแรก)
    var toks = String(nameB).split(/[\s\/\-\(\)\.\,\*x×0-9]+/).filter(function(t) { return t.length >= 3; });
    var has_ = function(tk) { return ix.prods.filter(function(p) { for (var t = 0; t < tk.length; t++) { if (p.name.indexOf(tk[t]) >= 0) { return true; } } return false; }); };
    pool = toks.length ? has_(toks) : [];
    if (!pool.length && toks.length) { pool = has_(toks.map(function(t) { return t.slice(0, 4); })); }
  }
  var gb = pp30Grams_(nameB), sc = [];
  pool.forEach(function(p) {
    if (!p.gr) { p.gr = pp30Grams_(p.name); }
    var d = pp30Dice_(gb, p.gr);
    if (d >= 0.25) { sc.push({ p:p, d:d }); }
  });
  sc.sort(function(a, b) { return b.d - a.d; });
  if (sc.length && sc[0].d >= 0.6) { res.hit = sc[0].p; res.how = 'ชื่อใกล้ ' + Math.round(sc[0].d * 100) + '%'; }
  else if (sc.length && sc[0].d >= 0.4) { res.hit = sc[0].p; res.how = 'เดา ' + Math.round(sc[0].d * 100) + '%'; }
  if (res.hit && !inSup) { res.how += ' (ต่างผู้ขาย)'; }
  res.alts = sc.slice(res.hit ? 1 : 0, (res.hit ? 1 : 0) + 3).map(function(x) {
    return x.p.bc + ' ' + x.p.name + ' (' + Math.round(x.d * 100) + '%)';
  });
  return res;
}

// ราคาบิล → ต่อชิ้น: หน่วยในบิล = หน่วยใหญ่ → หาร MULT · ไม่รู้ → เลือกแบบที่ใกล้ราคาเดิมกว่า (ต่างกัน ≥ MULT เท่า เลือกผิดยาก)
function pp30PiecePrice_(hit, price, unitB) {
  if (!hit || !price) { return null; }
  var ref = hit.buy || (hit.cost ? hit.cost / 1.07 : 0), cand = price;
  if (hit.mult > 1) {
    if (unitB && hit.unitBig && String(unitB).trim() === hit.unitBig) { cand = price / hit.mult; }
    else if (ref) { if (Math.abs(Math.log(price / hit.mult / ref)) < Math.abs(Math.log(price / ref))) { cand = price / hit.mult; } }
  }
  return { piece:r4_(cand), diff:hit.buy ? Math.round((cand - hit.buy) / hit.buy * 1000) / 10 : '' };
}

function pp30Items() {
  var list = pp30ReadSheet_(PP30_LIST, H_PP30_LIST);
  if (!list.length) { Logger.log('ยังไม่มี PP30_LIST — รัน pp30Build() ก่อน'); return; }
  var stgPages = pp30StagingPages_();
  var ix = pp30ProdIndex_();

  var g = {}, nLines = 0;
  list.forEach(function(L) {
    if (!L[13] || /ซ้ำกับ/.test(String(L[16]))) { return; }   // ใบซ้ำไม่นับ
    var sup = String(L[6]), supName = String(L[7]) || String(L[5]), date = pp30Ds_(L[3]), invK = String(L[0]);
    var supKey = sup || ('?' + apOcrNorm_(supName));
    String(L[13]).split(', ').forEach(function(f) {
      var pg = stgPages[f];
      if (!pg) { return; }
      pg.items.forEach(function(it) {
        var name = String(it.description || '').trim();
        if (!name) { return; }
        nLines++;
        var key = pp30ItemKey_(supKey, name);
        var x = g[key] || (g[key] = { key:key, sup:sup, supName:supName, code:String(it.productCode || ''), name:name,
                                      unit:String(it.unit || ''), lines:0, orders:{}, qty:0, amt:0, prices:[], last:null });
        var qty = pp30Num_(it.quantity), amt = pp30Num_(it.amount);
        var price = it.isFoc ? 0 : (pp30Num_(it.unitPrice) || (qty ? amt / qty : 0));
        x.lines++; x.orders[invK] = date; x.qty += qty; x.amt += amt;
        if (price > 0) {
          x.prices.push(price);
          if (!x.last || date >= x.last.date) { x.last = { date:date, price:price, unit:String(it.unit || '') }; }
        }
      });
    });
  });

  var out = [], cnt = {};
  Object.keys(g).forEach(function(k) {
    var x = g[k];
    var dates = [], seen = {};
    for (var o in x.orders) { var d = x.orders[o]; if (d && !seen[d]) { seen[d] = true; dates.push(d); } }
    dates.sort();
    var nOrd = Object.keys(x.orders).length;
    var first = dates[0] || '', last = dates[dates.length - 1] || '';
    var avg = dates.length >= 2 ? Math.round(pp30DayDiff_(first, last) / (dates.length - 1)) : '';
    var m = pp30MatchProd_(ix, x.sup, x.code, x.name, k);
    var pmin = x.prices.length ? Math.min.apply(null, x.prices) : '', pmax = x.prices.length ? Math.max.apply(null, x.prices) : '';
    var pp = (m.hit && x.last) ? pp30PiecePrice_(m.hit, x.last.price, x.last.unit) : null;
    var flag = [];
    if (nOrd === 1) { flag.push('สั่งครั้งเดียว'); }
    if (avg !== '' && avg > 45) { flag.push('รอบสั่ง ' + avg + ' วัน — ดูว่าจมสต๊อกไหม'); }
    if (pmin && pmax > pmin * 1.03) { flag.push('ราคาเปลี่ยน ' + r4_(pmin) + '→' + r4_(pmax)); }
    if (pp && pp.diff !== '' && Math.abs(pp.diff) > 3) { flag.push('ราคาบิลต่างจาก BUY_PRICE ' + pp.diff + '%'); }
    if (!m.hit) { flag.push('ไม่พบสินค้าใน KLH DATA'); }
    else if (m.how.indexOf('เดา') === 0 || m.how.indexOf('ต่างผู้ขาย') >= 0) { flag.push('จับคู่ไม่มั่นใจ'); }
    var hk = m.how.replace(/ \d+%.*$/, '');
    cnt[hk] = (cnt[hk] || 0) + 1;
    out.push([k, x.sup, x.supName, x.code, x.name, x.last ? x.last.unit : x.unit, x.lines, nOrd, r4_(x.qty), r2_(x.amt),
              first, last, avg, pmin === '' ? '' : r4_(pmin), pmax === '' ? '' : r4_(pmax), x.last ? r4_(x.last.price) : '',
              m.hit ? m.hit.bc : '', m.hit ? m.hit.name : '', m.how, m.alts[0] || '', m.alts[1] || '', m.alts[2] || '',
              m.hit ? m.hit.mult : '', m.hit ? m.hit.unitBig : '', m.hit ? m.hit.buy : '',
              pp ? pp.piece : '', pp ? pp.diff : '', m.hit ? m.hit.cost : '', flag.join(' · ')]);
  });
  out.sort(function(a, b) { return (b[7] - a[7]) || (b[9] - a[9]); });   // สั่งบ่อยก่อน แล้วยอดเงินมากก่อน
  pp30WriteSheet_(PP30_ITEMS, H_PP30_ITEMS, out, [1, 2, 4, 11, 12, 17]);

  var top = out.slice(0, 10).map(function(r, i) { return '  ' + (i + 1) + '. ' + r[4] + ' (' + r[2] + ') สั่ง ' + r[7] + ' ครั้ง' + (r[12] !== '' ? ' ทุก ~' + r[12] + ' วัน' : ''); });
  var msg = 'สินค้าในบิล ' + nLines + ' บรรทัด → ' + out.length + ' รายการไม่ซ้ำ · จับคู่: ' + JSON.stringify(cnt)
          + '\nสั่งบ่อยสุด 10 อันดับ:\n' + top.join('\n')
          + '\nตัดสินที่ชีต ' + PP30_ITEMS + ': แก้ BARCODE แล้วพิมพ์ MATCH = แก้มือ · ถ้าถูกแล้วพิมพ์ MATCH = ยืนยัน'
          + '\nบันทึกคู่ที่ยืนยันไว้ใช้ครั้งหน้า: pp30SaveAliases() · KLH DATA ไม่ถูกแก้';
  Logger.log(msg);
  return msg;
}

// จำคู่ที่ผู้ใช้ยืนยัน/แก้มือ (ผู้ขาย + ชื่อในบิล → บาร์โค้ด) → PRODUCT_ALIAS · หน้า OCR ใช้ต่อได้ทันที
function pp30SaveAliases() {
  var rows = pp30ReadSheet_(PP30_ITEMS, H_PP30_ITEMS);
  var s = ocrAliasSheet_();
  var ex = s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, 3).getValues() : [];
  var at = {};
  ex.forEach(function(r, i) { at[ocrProdKey_(r[0], r[1])] = i; });
  var now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
  var add = [], upd = 0;
  rows.forEach(function(r) {
    var how = String(r[18]);
    if (!r[16] || !String(r[4]).trim() || !(how === 'แก้มือ' || how === 'ยืนยัน')) { return; }
    var k = ocrProdKey_(r[1], String(r[4]).trim());
    if (at[k] !== undefined) {
      if (at[k] >= 0 && String(ex[at[k]][2]) !== String(r[16])) { ex[at[k]][2] = String(r[16]); upd++; }
      return;
    }
    at[k] = -1;
    add.push([String(r[1]), String(r[4]).trim(), String(r[16]), now]);
  });
  if (upd) { s.getRange(2, 1, ex.length, 3).setValues(ex); }
  if (add.length) {
    var r0 = s.getLastRow() + 1;
    s.getRange(r0, 1, add.length, 3).setNumberFormat('@');
    s.getRange(r0, 1, add.length, 4).setValues(add);
  }
  Logger.log('PRODUCT_ALIAS: เพิ่ม ' + add.length + ' คู่ · แก้ ' + upd + ' คู่ (หน้า OCR จับคู่ให้อัตโนมัติครั้งหน้า)');
}

// ════════════════════════════════════════════════════════════
//  4) ตรวจการจ่าย: ยอดจ่ายกรุงศรีกระแส (BAYC) ↔ บิลในชุด ภพ.30 — อ่านอย่างเดียว ไม่ตัดบิลจริง
//     จับคู่ยอดตรงเป๊ะ (1 ใบ → หลายใบติดกัน → ชุด ≤12 ใบใน 120 วัน) · ยอดที่เหลือเทียบหา "จ่ายซ้ำ"
// ════════════════════════════════════════════════════════════
function pp30PickBills_(cand, amt, payDate) {
  var cents = Math.round(amt * 100), a, s, e;
  for (a = 0; a < cand.length; a++) { if (Math.round(cand[a].total * 100) === cents) { return [cand[a]]; } }
  for (s = 0; s < cand.length; s++) {
    var acc = 0;
    for (e = s; e < cand.length; e++) {
      acc += Math.round(cand[e].total * 100);
      if (acc === cents) { return cand.slice(s, e + 1); }
      if (acc > cents) { break; }
    }
  }
  var lim = pp30AddDays_(payDate, -120);
  var c2 = cand.filter(function(b) { return b.date >= lim; }).slice(-12), n = c2.length;
  for (var mask = 1; mask < (1 << n); mask++) {
    var t = 0;
    for (var bit = 0; bit < n; bit++) { if (mask & (1 << bit)) { t += Math.round(c2[bit].total * 100); } }
    if (t === cents) {
      var pick = [];
      for (var b2 = 0; b2 < n; b2++) { if (mask & (1 << b2)) { pick.push(c2[b2]); } }
      return pick;
    }
  }
  return [];
}

function pp30PayCheck() {
  var list = pp30ReadSheet_(PP30_LIST, H_PP30_LIST);
  if (!list.length) { Logger.log('ยังไม่มี PP30_LIST — รัน pp30Build() ก่อน'); return; }
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // บิล (ไม่นับใบซ้ำ/ยอด 0)
  var bills = [], byCode = {}, minDate = '9999';
  list.forEach(function(L) {
    var total = pp30Num_(L[11]);
    if (total <= 0 || /ซ้ำกับ/.test(String(L[16]))) { return; }
    var o = { per:String(L[1]), seq:String(L[2]), date:pp30Ds_(L[3]), no:String(L[4]), code:String(L[6]),
              name:String(L[7]) || String(L[5]), total:total, paid:null };
    bills.push(o);
    if (o.date && o.date < minDate) { minDate = o.date; }
    if (o.code) { (byCode[o.code] = byCode[o.code] || []).push(o); }
  });
  Object.keys(byCode).forEach(function(c) { byCode[c].sort(function(a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); }); });

  // ผู้รับเงินในธนาคาร → ผู้ขาย: เลขบัญชีปลายทาง (BANK_RULES / SUPPLIER_MASTER) → ชื่อแฝด/ชื่อ
  var smv = pp30ReadSheet_('SUPPLIER_MASTER', ['','','','','','','','','','','']);
  var sm = [], acct = {}, nameOf = {};
  smv.forEach(function(r) {
    var code = String(r[0] || ''); if (!code) { return; }
    nameOf[code] = String(r[1] || '');
    if (String(r[1]).indexOf('⊘') >= 0) { return; }
    sm.push({ code:code, name:String(r[1]), norm:apNorm_(r[1]) });
    var a = String(r[7] || '').replace(/\D/g, '');
    if (a.length >= 6 && !acct[a]) { acct[a] = code; }
  });
  pp30ReadSheet_('BANK_RULES', ['','','','','','']).forEach(function(r) {
    var k = String(r[0] || ''), v = String(r[5] || '');
    if (v && k.indexOf('ACCT:') === 0) { acct[k.slice(5).replace(/\D/g, '')] = v; }
  });
  var aliasMap = apLoadAliases_();

  // ยอดจ่าย BAYC ตั้งแต่บิลใบแรก
  var bt = ss.getSheetByName('BANK_TRANSACTIONS');
  var bv = bt.getRange(2, 1, bt.getLastRow() - 1, 10).getValues();
  var pays = [];
  for (var i = 0; i < bv.length; i++) {
    var r = bv[i];
    if (String(r[1]) !== 'BAYC' || String(r[2]) !== 'OUT' || String(r[4]) !== 'PAYMENT') { continue; }
    var ds = apDs_(r[0]);
    if (ds < minDate) { continue; }
    var p = apParseSubject_(r[5]), a2 = String(p.account || '').replace(/\D/g, '');
    var code = '', how = '';
    if (a2 && acct[a2]) { code = acct[a2]; how = 'บัญชีปลายทาง'; }
    else { var ms = apMatchSup2_(p.payee, sm, aliasMap); code = ms.code; how = ms.type; }
    pays.push({ ref:String(r[7] || ('ROW' + (i + 2))), date:ds, amt:pp30Num_(r[3]), payee:p.payee || String(r[5]).slice(0, 60),
                acct:p.account, code:code, how:how, note:String(r[8] || ''), pick:[], res:'' });
  }
  pays.sort(function(a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });

  // ตัดในระบบเดิม (AP_PAYMENT) เกินยอดโอนไหม
  var cutByRef = {};
  pp30ReadSheet_('AP_PAYMENT', ['','','','','','','','','','']).forEach(function(r) {
    var ref = String(r[8] || ''); if (ref) { cutByRef[ref] = (cutByRef[ref] || 0) + pp30Num_(r[5]); }
  });

  // จับคู่ทีละรายการตามวันที่
  pays.forEach(function(p) {
    if (!p.code) { return; }
    var cand = (byCode[p.code] || []).filter(function(b) { return !b.paid && b.date <= p.date; });
    p.pick = cand.length ? pp30PickBills_(cand, p.amt, p.date) : [];
    p.pick.forEach(function(b) { b.paid = { ref:p.ref, date:p.date }; });
  });
  var suspect = {};
  pays.forEach(function(p) {
    if (p.pick.length) { p.res = 'ตรงยอด ' + p.pick.length + ' ใบ'; }
    else if (!p.code) {
      // ไม่รู้ผู้รับ → เดาจากยอดเงิน (ต้องตรงบิลค้างใบเดียวเท่านั้น)
      var same = bills.filter(function(b) { return !b.paid && b.date <= p.date && Math.round(b.total * 100) === Math.round(p.amt * 100); });
      p.res = same.length === 1 ? 'ไม่รู้ผู้รับ · ยอดเท่าบิล ' + same[0].no + ' (' + same[0].name + ') — ช่วยยืนยัน' : 'ไม่รู้ผู้รับเงิน';
    } else {
      var paidSame = (byCode[p.code] || []).filter(function(b) { return b.paid && b.paid.ref !== p.ref && Math.round(b.total * 100) === Math.round(p.amt * 100); });
      var paySame = pays.filter(function(q) { return q !== p && q.code === p.code && q.pick.length && Math.round(q.amt * 100) === Math.round(p.amt * 100); });
      if (paidSame.length) {
        p.res = '⚠️ อาจจ่ายซ้ำ: ยอดเท่าบิล ' + paidSame[0].no + ' ที่จ่ายแล้ว (' + paidSame[0].paid.ref + ' ' + paidSame[0].paid.date + ')';
        suspect[p.code] = (suspect[p.code] || 0) + 1;
      } else if (paySame.length) {
        p.res = '⚠️ ยอดเท่ารายการ ' + paySame[0].ref + ' (' + paySame[0].date + ') ที่ตัดบิลไปแล้ว — อาจจ่ายซ้ำ';
        suspect[p.code] = (suspect[p.code] || 0) + 1;
      } else if (!(byCode[p.code] || []).length) {
        p.res = 'ผู้ขายนี้ไม่มีบิลในชุด ภพ.30 (บิลไม่มี VAT/อยู่ชุดอื่น?)';
      } else {
        p.res = 'ยอดไม่ตรงบิลใดๆ (หักส่วนลด/หัก ณ ที่จ่าย/จ่ายบางส่วน/บิลก่อน ' + minDate + '?)';
      }
    }
    if (cutByRef[p.ref] && cutByRef[p.ref] > p.amt + 0.01) { p.res += ' · ⚠️ ในระบบตัดบิลด้วยรายการนี้ ' + r2_(cutByRef[p.ref]) + ' เกินยอดโอน'; }
  });

  var payRows = pays.map(function(p) {
    return [p.ref, p.date, p.payee, p.acct, p.amt, p.code, p.code ? nameOf[p.code] || '' : '', p.how,
            p.pick.map(function(b) { return b.no; }).join(' + '),
            p.pick.length ? r2_(p.pick.reduce(function(t, b) { return t + b.total; }, 0)) : '', p.res, p.note];
  });
  pp30WriteSheet_(PP30_PAYCHK, H_PP30_PAYCHK, payRows, [1, 2, 4, 6, 9]);

  var today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  var stRows = bills.map(function(b) {
    var st = b.paid ? 'จ่ายแล้ว' : (!b.code ? 'ไม่รู้จักผู้ขาย' : 'ยังไม่เจอยอดจ่าย');
    return [b.per, b.seq, b.date, b.no, b.code, b.name, b.total, b.paid ? b.paid.ref : '', b.paid ? b.paid.date : '',
            b.paid && b.date ? pp30DayDiff_(b.date, b.paid.date) : (b.date ? pp30DayDiff_(b.date, today) + ' (ยังค้าง)' : ''), st];
  });
  pp30WriteSheet_(PP30_APST, H_PP30_APST, stRows, [1, 2, 4, 5, 8]);

  // สรุปรายผู้ขาย
  var su = {};
  function S_(code, name) { return su[code] || (su[code] = { code:code, name:name, nInv:0, inv:0, nPay:0, pay:0, mPay:0, uPay:0, out:0 }); }
  // บิลไม่รู้จักผู้ขาย / ยอดโอนไม่รู้ผู้รับ แยกกลุ่มกัน (อย่ารวมกันจนดูเหมือนจ่ายเกิน)
  bills.forEach(function(b) { var s = S_(b.code || ('?' + b.name), b.code ? nameOf[b.code] || b.name : b.name); s.nInv++; s.inv += b.total; if (!b.paid) { s.out += b.total; } });
  pays.forEach(function(p) { var s = S_(p.code || '?ไม่รู้ผู้รับ', p.code ? nameOf[p.code] || '' : '(ยอดโอนที่ไม่รู้ผู้รับ)'); s.nPay++; s.pay += p.amt; if (p.pick.length) { s.mPay += p.amt; } else { s.uPay += p.amt; } });
  var sumRows = Object.keys(su).map(function(c) {
    var s = su[c], note = [];
    if (suspect[c]) { note.push('มีรายการน่าสงสัยจ่ายซ้ำ ' + suspect[c]); }
    if (c.charAt(0) !== '?' && s.pay > s.inv + 0.01 && s.inv) { note.push('จ่ายรวมมากกว่าบิลในชุด ' + r2_(s.pay - s.inv)); }
    if (c.charAt(0) === '?') { note.push(s.nInv ? 'ยังไม่รู้จักผู้ขาย — ดู PP30_SUPPLIERS' : 'ผูกเลขบัญชีปลายทางกับเจ้าหนี้ที่หน้าธนาคารก่อน'); }
    return [c.charAt(0) === '?' ? '' : s.code, s.name, s.nInv, r2_(s.inv), s.nPay, r2_(s.pay), r2_(s.mPay), r2_(s.uPay), r2_(s.out), suspect[c] || 0, note.join(' · ')];
  });
  sumRows.sort(function(a, b) { return (b[9] - a[9]) || (b[3] - a[3]); });
  pp30WriteSheet_(PP30_APSUM, H_PP30_APSUM, sumRows, [1]);

  var nOk = pays.filter(function(p) { return p.pick.length; }).length;
  var nSus = Object.keys(suspect).reduce(function(t, c) { return t + suspect[c]; }, 0);
  var paid = bills.filter(function(b) { return b.paid; }).length;
  var msg = 'บิลในชุด ' + bills.length + ' ใบ · ยอดจ่าย BAYC ตั้งแต่ ' + minDate + ' มี ' + pays.length + ' รายการ'
          + '\nจับคู่ยอดตรงได้ ' + nOk + ' รายการ → บิลจ่ายแล้ว ' + paid + ' ใบ · ยังไม่เจอยอดจ่าย ' + (bills.length - paid) + ' ใบ'
          + '\n⚠️ น่าสงสัยจ่ายซ้ำ ' + nSus + ' รายการ (ดูคอลัมน์ RESULT ในชีต ' + PP30_PAYCHK + ')'
          + '\nดูรายผู้ขายที่ ' + PP30_APSUM + ' · รายบิลที่ ' + PP30_APST + ' — ยังไม่ได้ตัดบิลจริงในระบบ'
          + '\nหมายเหตุ: นับเฉพาะรายการ BAYC หมวด PAYMENT · เช็คที่ไม่มีชื่อผู้รับจะขึ้น "ไม่รู้ผู้รับเงิน"';
  Logger.log(msg);
  return msg;
}

// ════════════════════════════════════════════════════════════
//  5) ทดสอบหน้า OCR: ใช้บิลที่ OCR แล้ว (ไม่เรียก Gemini เพิ่ม) ป้อนให้ตัวจับคู่ของหน้า OCR เดิม
//     เทียบกับเลขภาษี (ผู้ขาย) และวิธีใหม่ (สินค้า) → OCR_PAGE_TEST · ผลรวมรายการ = ยอดก่อนภาษี บอกว่า OCR อ่านเลขถูกไหม
// ════════════════════════════════════════════════════════════
function ocrPageTest(nPages) {
  var t0 = Date.now(), n = Number(nPages) || 10;
  var sv = pp30ReadSheet_(AP_OCR_STAGING, H_AP_STG).filter(function(r) { return String(r[3]) === 'invoice' && pp30Num_(r[17]) > 0; });
  if (!sv.length) { Logger.log('ยังไม่มีใบกำกับที่ OCR แล้ว — รัน apOcrRun() ก่อน'); return; }
  // เลือกบิลต่างผู้ขายกันก่อน ให้ทดสอบได้หลากหลาย
  var pick = [], seenSup = {};
  sv.forEach(function(r) { var k = String(r[6]) || String(r[5]); if (pick.length < n && !seenSup[k]) { seenSup[k] = true; pick.push(r); } });
  sv.forEach(function(r) { if (pick.length < n && pick.indexOf(r) < 0) { pick.push(r); } });

  var idx = apOcrSupplierIndex_(), ix = pp30ProdIndex_();
  var out = [], st = { pages:0, supOk:0, supWrong:0, supMiss:0, supNoTruth:0, sumOk:0, items:0, oldHit:0, newHit:0, agree:0 };
  for (var i = 0; i < pick.length; i++) {
    if (Date.now() - t0 > 300000) { Logger.log('ใกล้ครบเวลา 6 นาที — หยุดที่ ' + i + ' บิล'); break; }
    var r = pick[i], name = String(r[5]), tax = String(r[6]);
    var truth = (tax.length === 13 && idx.byTax[tax]) ? idx.byTax[tax].code : '';
    var cur = lookupSupplierForOcr(name) || {};
    var curCode = cur.exact ? cur.exact.code : '';
    var simCodes = (cur.similar || []).map(function(s) { return s.code; });
    var supRes;
    if (!truth) { supRes = 'master ไม่มีเลขภาษีนี้ — ' + (curCode ? 'หน้า OCR เลือก ' + curCode + ' (ตรวจเอง)' : 'หน้า OCR ไม่เลือกให้'); st.supNoTruth++; }
    else if (curCode === truth) { supRes = 'ตรง ✅'; st.supOk++; }
    else if (curCode) { supRes = '❌ หน้า OCR เลือกผิด (' + curCode + ')'; st.supWrong++; }
    else if (simCodes.indexOf(truth) >= 0) { supRes = 'หน้า OCR ไม่เลือกให้ แต่อยู่ในตัวเลือก'; st.supMiss++; }
    else { supRes = '❌ หน้า OCR หาไม่เจอ'; st.supMiss++; }
    var items = [];
    try { items = JSON.parse(r[18] || '[]'); } catch (e) {}
    var sumItems = items.reduce(function(t, it) { return t + (it.isFoc ? 0 : pp30Num_(it.amount)); }, 0);
    var sub = pp30Num_(r[14]), sumChk = Math.abs(sumItems - sub) <= 1 ? 'ตรง' : 'ต่าง ' + r2_(sumItems - sub);
    if (sumChk === 'ตรง') { st.sumOk++; }
    st.pages++;
    var supUse = truth || curCode;
    items.forEach(function(it, j) {
      var bn = String(it.description || '');
      var old = lookupProductsForOcr(String(it.productCode || ''), bn, supUse) || [];
      var o0 = old[0] || null;
      var nw = pp30MatchProd_(ix, supUse, it.productCode, bn, '');
      var res;
      if (o0 && nw.hit && String(o0.barcode) === nw.hit.bc) { res = 'ตรงกัน'; st.agree++; }
      else if (!o0 && nw.hit) { res = 'หน้าเดิมไม่เจอ · วิธีใหม่เจอ'; }
      else if (o0 && !nw.hit) { res = 'หน้าเดิมเจอ · วิธีใหม่ไม่เจอ'; }
      else if (!o0 && !nw.hit) { res = 'ไม่เจอทั้งคู่'; }
      else { res = 'เลือกต่างกัน — ดูว่าอันไหนถูก'; }
      st.items++; if (o0) { st.oldHit++; } if (nw.hit) { st.newHit++; }
      out.push([String(r[1]), name, tax, truth, curCode || (simCodes[0] ? '(ตัวเลือก) ' + simCodes[0] : ''), supRes,
                r2_(sumItems), sub, sumChk, j + 1, bn, o0 ? o0.barcode + ' ' + o0.name : '',
                nw.hit ? nw.hit.bc + ' ' + nw.hit.name + ' [' + nw.how + ']' : '', res]);
    });
  }
  pp30WriteSheet_(OCR_TEST, H_OCR_TEST, out, [1, 3, 4, 5]);
  var msg = '═══════ ทดสอบหน้า OCR (' + st.pages + ' บิล ' + st.items + ' รายการ) ═══════'
          + '\nผู้ขาย: ตรง ' + st.supOk + ' · เลือกผิด ' + st.supWrong + ' · หาไม่เจอ/ไม่เลือกให้ ' + st.supMiss + ' · master ไม่มีเลขภาษี ' + st.supNoTruth
          + '\nตัวเลข: ผลรวมรายการ = ยอดก่อนภาษี ' + st.sumOk + '/' + st.pages + ' บิล (อ่านเลขถูก)'
          + '\nสินค้า: หน้าเดิมเจอ ' + st.oldHit + '/' + st.items + ' · วิธีใหม่เจอ ' + st.newHit + '/' + st.items + ' · เลือกตรงกัน ' + st.agree
          + '\nรายละเอียดที่ชีต ' + OCR_TEST + ' — สุ่มดูคอลัมน์ OCR_PAGE_ITEM กับ NEW_ITEM ว่าอันไหนถูก';
  Logger.log(msg);
  return msg;
}

// ════════════════════════════════════════════════════════════
//  ยังไม่เปิดใช้ — นำเข้าจริง: INVOICE_HEADER (ภาษีซื้อ, TAX_PERIOD) + DETAIL + PRICE_LOG + AP_LEDGER
//  เปิดเมื่อผู้ใช้ตรวจ PP30_LIST / PP30_SUPPLIERS / PP30_ITEMS ครบแล้ว (ลงท้าย _ = รันจากเมนูไม่ได้)
// ════════════════════════════════════════════════════════════
function pp30Commit_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var lsh = ss.getSheetByName(PP30_LIST);
    if (!lsh || lsh.getLastRow() <= 1) { Logger.log('ยังไม่มี PP30_LIST — รัน pp30Build() ก่อน'); return; }
    var list = lsh.getRange(2, 1, lsh.getLastRow() - 1, H_PP30_LIST.length).getValues();
    var stgPages = pp30StagingPages_();
    var bcOf = {};   // ใช้เฉพาะบาร์โค้ดที่ผู้ใช้ยืนยัน/แก้มือ หรือตรงด้วยบาร์โค้ด/จำไว้
    pp30ReadSheet_(PP30_ITEMS, H_PP30_ITEMS).forEach(function(r) {
      var how = String(r[18]);
      if (r[16] && (how === 'ยืนยัน' || how === 'แก้มือ' || how === 'บาร์โค้ด' || how === 'จำไว้')) { bcOf[String(r[0])] = String(r[16]); }
    });

    initOcrSheets(); initApSheets_();
    var hdr = ss.getSheetByName(SH_INV_H), dtl = ss.getSheetByName(SH_INV_D);
    var ap = ss.getSheetByName('AP_LEDGER'), pl = ss.getSheetByName('PRICE_LOG');
    if (String(hdr.getRange(1, 14).getValue()) !== 'TAX_PERIOD') {
      hdr.getRange(1, 14).setValue('TAX_PERIOD').setBackground('#1A237E').setFontColor('#fff').setFontWeight('bold');
    }
    var haveInv = {}, usedRecv = {}, haveAp = {};
    if (hdr.getLastRow() > 1) {
      hdr.getRange(2, 1, hdr.getLastRow() - 1, 4).getValues().forEach(function(r) {
        usedRecv[String(r[0])] = true;
        var k = pp30InvKey_(r[1]);
        if (k) { haveInv[apOcrNorm_(r[3]) + '|' + k] = String(r[0]); }
      });
    }
    if (ap.getLastRow() > 1) {
      ap.getRange(2, 1, ap.getLastRow() - 1, 12).getValues().forEach(function(r) {
        var k = pp30InvKey_(r[11]);
        if (k && r[2]) { haveAp[String(r[2]) + '|' + k] = String(r[0]); }
      });
    }
    var me = '';
    try { me = Session.getEffectiveUser().getEmail(); } catch (e0) {}
    var now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    var addH = [], addD = [], addP = [], addA = [], marks = [];
    var nH = 0, nA = 0, skipNoSup = 0, skipCredit = 0, dupH = 0, dupA = 0, vatBy = {};

    for (var i = 0; i < list.length; i++) {
      var L = list[i], recv = String(L[18]), apId = String(L[19]);
      if (String(L[17]) !== 'นำเข้า') { marks.push([recv, apId]); continue; }
      var per = String(L[1]), seq = String(L[2]);
      var date = pp30Ds_(L[3]), inv = String(L[4]), invKey = pp30InvKey_(inv);
      var code = String(L[6]), supName = String(L[7]) || String(L[5]);
      var supKey = code || ('?' + apOcrNorm_(supName));
      var base = pp30Num_(L[9]), vat = pp30Num_(L[10]), total = pp30Num_(L[11]);
      var files = L[13] ? String(L[13]).split(', ') : [];

      if (!recv) {
        var exist = invKey ? (haveInv[apOcrNorm_(supName) + '|' + invKey] || haveInv[apOcrNorm_(L[5]) + '|' + invKey]) : '';
        if (exist) { recv = exist; dupH++; }
        else {
          recv = 'PP30-' + per.replace('-', '') + '-' + (seq ? ('00' + seq).slice(-3) : 'X' + (i + 1));
          while (usedRecv[recv]) { recv += 'b'; }
          usedRecv[recv] = true;
          var firstId = files.length && stgPages[files[0]] ? stgPages[files[0]].id : '';
          addH.push([recv, inv, date, supName, PP30_ENTITY, base, vat, total, 'ภพ30',
                     firstId ? 'https://drive.google.com/file/d/' + firstId + '/view' : '',
                     'นำเข้าจาก ภพ.30 งวด ' + per + (seq ? ' ลำดับ ' + seq : ''), me, now, per]);
          if (invKey) { haveInv[apOcrNorm_(supName) + '|' + invKey] = recv; }
          nH++; vatBy[per] = (vatBy[per] || 0) + vat;
          var line = 0;
          files.forEach(function(f) {
            var pg = stgPages[f];
            if (!pg) { return; }
            pg.items.forEach(function(it) {
              line++;
              var bn = String(it.description || '').trim();
              var bc = bcOf[pp30ItemKey_(supKey, bn)] || '';
              var qty = pp30Num_(it.quantity), amt = pp30Num_(it.amount);
              var price = it.isFoc ? 0 : (pp30Num_(it.unitPrice) || (qty ? amt / qty : 0));
              addD.push([recv, line, bc || String(it.productCode || ''), bn, qty, String(it.unit || ''), r4_(price), pp30Num_(it.discount), amt]);
              if (price) { addP.push([date, recv, bc, bn, supName, qty, r4_(price), PP30_ENTITY]); }
            });
          });
        }
      }
      if (!apId) {
        if (total <= 0) { skipCredit++; }
        else if (!code) { skipNoSup++; }
        else if (invKey && haveAp[code + '|' + invKey]) { apId = haveAp[code + '|' + invKey]; dupA++; }
        else {
          apId = 'AP-' + recv;
          addA.push([apId, recv, code, supName, PP30_ENTITY, date, pp30Ds_(L[12]) || date, total, 0, total, 'UNPAID', inv]);
          if (invKey) { haveAp[code + '|' + invKey] = apId; }
          nA++;
        }
      }
      marks.push([recv, apId]);
    }
    function put_(sh, rows, width, textCols) {
      if (!rows.length) { return; }
      var r0 = sh.getLastRow() + 1;
      (textCols || []).forEach(function(c) { sh.getRange(r0, c, rows.length, 1).setNumberFormat('@'); });
      sh.getRange(r0, 1, rows.length, width).setValues(rows);
    }
    put_(hdr, addH, 14, [1, 2, 14]);
    put_(dtl, addD, 9, [1, 3]);
    put_(pl, addP, 8, [2, 3]);
    put_(ap, addA, 12, [1, 2, 3, 12]);
    lsh.getRange(2, 19, marks.length, 2).setNumberFormat('@').setValues(marks);
    var log = ['═══════ นำเข้าชุด ภพ.30 ═══════',
      'ใบกำกับ (INVOICE_HEADER) เพิ่ม ' + nH + ' ใบ · รายการสินค้า ' + addD.length + ' บรรทัด · ราคาลง PRICE_LOG ' + addP.length,
      'เจ้าหนี้ (AP_LEDGER) เพิ่ม ' + nA + ' ใบ',
      'ข้าม: มีในระบบแล้ว ' + dupH + ' · เจ้าหนี้ซ้ำ ' + dupA + ' · ไม่รู้จักผู้ขาย ' + skipNoSup + ' · ยอดติดลบ/ใบลดหนี้ ' + skipCredit];
    Object.keys(vatBy).sort().forEach(function(p) { log.push('  ภาษีซื้องวด ' + p + ' เพิ่ม ' + r2_(vatBy[p]) + ' บาท'); });
    Logger.log(log.join('\n'));
    return log.join('\n');
  } finally { lock.releaseLock(); }
}
