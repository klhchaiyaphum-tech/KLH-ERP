// ============================================================
//  price_book.js — สมุดราคา (staging) เทียบ + อัปเดต KLH DATA ตามบาร์โค้ด
//  PRICE_BOOK ไม่แตะ KLH DATA จนกว่าจะกด "ส่งกลับ" (เฉพาะแถวที่ยืนยัน + backup ก่อน)
//  KLH DATA cols: บาร์โค้ด=A(0) ชื่อ=B(1) ขนาด=D(3) ทุน=R(17) ส่ง=V(21) ปลีก=X(23)
// ============================================================
var PB_SHEET = 'PRICE_BOOK';
var PB_HEAD = ['STATUS','BARCODE','EXCEL_NAME','SIZE','PACK','COST_NEW','RETAIL_NEW','WHOLE_NEW',
               'KLH_NAME','COST_OLD','RETAIL_OLD','WHOLE_OLD','SOURCE','CONFIRMED_BY','CONFIRMED_DATE','ROW_KEY'];

function pbSheet_(create) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName(PB_SHEET);
  if (!s && create) {
    s = ss.insertSheet(PB_SHEET);
    s.getRange(1,1,1,PB_HEAD.length).setValues([PB_HEAD]).setFontWeight('bold').setBackground('#F6704C').setFontColor('#fff');
    s.setFrozenRows(1);
  }
  return s;
}
function pbNum_(v){ var n = parseFloat(v); return isNaN(n) ? '' : n; }
function pbFindRow_(s, rowKey) {
  if (s.getLastRow() < 2) return -1;
  var keys = s.getRange(2,16,s.getLastRow()-1,1).getValues();
  for (var i=0;i<keys.length;i++) if (String(keys[i][0])===String(rowKey)) return i+2;
  return -1;
}

// ── นำเข้า (ขับจาก API เป็น chunk) ──
function pbClear() {
  var s = pbSheet_(true);
  if (s.getLastRow() > 1) s.getRange(2,1,s.getLastRow()-1,PB_HEAD.length).clearContent();
  return { ok:true };
}
// rows = [[excel_name, size, pack, cost, retail, whole, source], ...]
function pbImportChunk(rows) {
  try {
    var s = pbSheet_(true);
    if (!rows || !rows.length) return { ok:true, added:0, total:s.getLastRow()-1 };
    var start = s.getLastRow()+1;
    var out = rows.map(function(r,i){
      return ['รอจับคู่','', String(r[0]||''), String(r[1]||''), String(r[2]||''),
              pbNum_(r[3]), pbNum_(r[4]), pbNum_(r[5]), '','','','', String(r[6]||''), '', '',
              'PB'+start+'_'+i];
    });
    s.getRange(start,1,out.length,PB_HEAD.length).setValues(out);
    return { ok:true, added:out.length, total:s.getLastRow()-1 };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// ── นำเข้าจากไฟล์ CSV ใน Drive (รันใน editor ครั้งเดียว ไม่ต้อง deploy) ──
// อัปโหลด _pricebook.csv ขึ้น Google Drive ก่อน แล้วรันฟังก์ชันนี้
function pbImportFromDriveCsv() {
  try {
    var files = DriveApp.getFilesByName('_pricebook.csv');
    if (!files.hasNext()) return 'ไม่พบไฟล์ _pricebook.csv ใน Drive — อัปโหลดก่อน';
    var file = files.next();
    var csv = file.getBlob().getDataAsString('UTF-8');
    var rows = Utilities.parseCsv(csv);
    pbClear();
    // header: file,sheet,name,size,pack,retail_raw,retail_num,whole_raw,whole_num,cost_case_raw,cost_unit_raw,cost_unit_num,date
    var batch = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r || !r[2]) continue;             // ต้องมีชื่อ
      batch.push([ r[2], r[3], r[4],         // name, size, pack
                   r[11], r[6], r[8],        // cost_unit_num, retail_num, whole_num
                   r[0] + '/' + r[1] ]);     // source = file/sheet
      if (batch.length >= 500) { pbImportChunk(batch); batch = []; }
    }
    if (batch.length) pbImportChunk(batch);
    return 'นำเข้าเสร็จ: ' + (pbSheet_().getLastRow()-1) + ' แถว เข้า PRICE_BOOK';
  } catch(e) { return 'ERROR: ' + e; }
}

// ── หน้าเทียบราคาเรียก ──
function pbStats() {
  var s = pbSheet_(); if (!s || s.getLastRow()<2) return { ok:true, stats:{total:0,pending:0,matched:0,confirmed:0,pushed:0} };
  var st = s.getRange(2,1,s.getLastRow()-1,1).getValues();
  var c = { total:st.length, pending:0, matched:0, confirmed:0, pushed:0 };
  st.forEach(function(r){ var v=String(r[0]);
    if(v==='ยืนยันแล้ว')c.confirmed++; else if(v==='จับคู่แล้ว')c.matched++; else if(v==='ส่งแล้ว')c.pushed++; else c.pending++; });
  return { ok:true, stats:c };
}
function pbList(status, q, offset, limit) {
  var s = pbSheet_(); if (!s || s.getLastRow()<2) return { ok:true, items:[], total:0 };
  var vals = s.getRange(2,1,s.getLastRow()-1,PB_HEAD.length).getValues();
  var ql = String(q||'').toLowerCase();
  var filt = vals.filter(function(r){
    if (status && status!=='all' && String(r[0])!==status) return false;
    if (ql && (String(r[2])+String(r[1])).toLowerCase().indexOf(ql)<0) return false;
    return true;
  });
  var off = offset||0, lim = limit||60;
  var page = filt.slice(off, off+lim);
  var items = page.map(function(r){ return {
    rowKey:r[15], status:r[0], barcode:r[1], name:r[2], size:r[3], pack:r[4],
    costNew:r[5], retailNew:r[6], wholeNew:r[7],
    klhName:r[8], costOld:r[9], retailOld:r[10], wholeOld:r[11], source:r[12] }; });
  return { ok:true, items:items, total:filt.length };
}
// ดึงแถวเดียวตาม rowKey (ใช้ refresh การ์ดหลังจับคู่/ยืนยัน)
function pbGetRow(rowKey) {
  var s = pbSheet_(); var row = pbFindRow_(s, rowKey);
  if (row < 0) return { ok:false };
  var r = s.getRange(row,1,1,PB_HEAD.length).getValues()[0];
  return { ok:true, item:{ rowKey:r[15], status:r[0], barcode:r[1], name:r[2], size:r[3], pack:r[4],
    costNew:r[5], retailNew:r[6], wholeNew:r[7], klhName:r[8], costOld:r[9], retailOld:r[10], wholeOld:r[11], source:r[12] } };
}

// สินค้า KLH DATA ทั้งหมด (ให้หน้าเทียบ cache ไว้ค้นเอง)
function pbGetKlhProducts() {
  try {
    var klh = klhDataSheet_(); if (!klh) return { ok:false, msg:'ไม่พบ KLH DATA' };
    var data = klh.getDataRange().getValues();
    var sn = function(v){ var n=parseFloat(v); return isNaN(n)?0:n; };
    var items = [];
    for (var i=1;i<data.length;i++){
      var bc = String(data[i][0]||'').trim(); if(!bc) continue;
      items.push({ barcode:bc, name:String(data[i][1]||''), size:String(data[i][3]||''),
                   cost:sn(data[i][17]), retail:sn(data[i][23]), whole:sn(data[i][21]) });
    }
    return { ok:true, items:items };
  } catch(e){ return { ok:false, msg:String(e) }; }
}
// จับคู่: ใส่บาร์โค้ด + ดึงราคาเก่าจาก KLH DATA มาเทียบ
function pbMatch(rowKey, barcode) {
  try {
    var s = pbSheet_(); var row = pbFindRow_(s,rowKey); if (row<0) return { ok:false, msg:'ไม่พบแถว' };
    var klh = klhDataSheet_(); var data = klh.getDataRange().getValues();
    var sn = function(v){ var n=parseFloat(v); return isNaN(n)?0:n; };
    var found = null;
    for (var i=1;i<data.length;i++){ if(String(data[i][0]).trim()===String(barcode).trim()){ found=data[i]; break; } }
    if (!found) return { ok:false, msg:'ไม่พบบาร์โค้ดใน KLH DATA' };
    s.getRange(row,2).setValue(String(barcode));
    s.getRange(row,9).setValue(String(found[1]||''));
    s.getRange(row,10).setValue(sn(found[17]));
    s.getRange(row,11).setValue(sn(found[23]));
    s.getRange(row,12).setValue(sn(found[21]));
    s.getRange(row,1).setValue('จับคู่แล้ว');
    return { ok:true };
  } catch(e){ return { ok:false, msg:String(e) }; }
}
function pbUnmatch(rowKey) {
  var s = pbSheet_(); var row = pbFindRow_(s,rowKey); if (row<0) return { ok:false };
  s.getRange(row,2).setValue('');
  s.getRange(row,9,1,4).clearContent();   // KLH_NAME..WHOLE_OLD
  s.getRange(row,1).setValue('รอจับคู่');
  return { ok:true };
}
function pbConfirm(rowKey, on) {
  var s = pbSheet_(); var row = pbFindRow_(s,rowKey); if (row<0) return { ok:false };
  if (on && !String(s.getRange(row,2).getValue()||'')) return { ok:false, msg:'ยังไม่จับคู่บาร์โค้ด' };
  s.getRange(row,1).setValue(on ? 'ยืนยันแล้ว' : 'จับคู่แล้ว');
  s.getRange(row,14).setValue(on ? (Session.getActiveUser().getEmail()||'staff') : '');
  s.getRange(row,15).setValue(on ? Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd HH:mm') : '');
  return { ok:true };
}
// ── ส่งกลับ KLH DATA (เฉพาะ "ยืนยันแล้ว" + backup + log) ──
function pbPushToKlh() {
  try {
    var s = pbSheet_(); if (!s || s.getLastRow()<2) return { ok:false, msg:'ไม่มีข้อมูล' };
    var vals = s.getRange(2,1,s.getLastRow()-1,PB_HEAD.length).getValues();
    var conf = vals.filter(function(r){ return String(r[0])==='ยืนยันแล้ว' && String(r[1]).trim(); });
    if (!conf.length) return { ok:false, msg:'ไม่มีแถวที่ยืนยันแล้ว' };
    var klh = klhDataSheet_(); var data = klh.getDataRange().getValues();
    var idx = {}; for (var i=1;i<data.length;i++){ var b=String(data[i][0]).trim(); if(b) idx[b]=i; }
    var ss = SpreadsheetApp.openById(SHEET_ID);
    // backup snapshot KLH DATA
    var bakName = 'KLHDATA_BAK_'+Utilities.formatDate(new Date(),'Asia/Bangkok','yyyyMMdd_HHmmss');
    var bak = ss.insertSheet(bakName);
    bak.getRange(1,1,data.length,data[0].length).setValues(data);
    // log
    var log = ss.getSheetByName('PRICE_UPDATE_LOG') || ss.insertSheet('PRICE_UPDATE_LOG');
    if (log.getLastRow()===0) log.appendRow(['DATE','BARCODE','NAME','COST_OLD','COST_NEW','RETAIL_OLD','RETAIL_NEW','WHOLE_OLD','WHOLE_NEW']);
    var now = Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd HH:mm');
    var updated = 0, confKeys = {};
    conf.forEach(function(r){
      var bc = String(r[1]).trim(); var ri = idx[bc]; if (ri==null) return;
      var sheetRow = ri+1;
      if (r[5]!=='') klh.getRange(sheetRow,18).setValue(r[5]);   // R = ทุน (col18)
      if (r[6]!=='') klh.getRange(sheetRow,24).setValue(r[6]);   // X = ปลีก (col24)
      if (r[7]!=='') klh.getRange(sheetRow,22).setValue(r[7]);   // V = ส่ง  (col22)
      log.appendRow([now, bc, data[ri][1], data[ri][17], r[5], data[ri][23], r[6], data[ri][21], r[7]]);
      confKeys[r[15]] = 1; updated++;
    });
    // mark ส่งแล้ว
    var keys = s.getRange(2,16,s.getLastRow()-1,1).getValues();
    for (var j=0;j<keys.length;j++){ if(confKeys[keys[j][0]]) s.getRange(j+2,1).setValue('ส่งแล้ว'); }
    return { ok:true, updated:updated, backup:bakName };
  } catch(e){ return { ok:false, msg:String(e) }; }
}
