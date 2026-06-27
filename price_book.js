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

// normalize ชื่อสำหรับจับคู่ (ตัดช่องว่าง/เครื่องหมาย/บาท)
function pbNorm_(s){
  s = String(s||'').toLowerCase();
  s = s.replace(/\s+/g,'').replace(/[()\-_.,\/\\'"]/g,'').replace(/บาท/g,'');
  return s;
}
// check digit EAN-13 (สำหรับรหัสภายในให้สแกน/พิมพ์ฉลากได้)
function ean13Check_(d12){
  var sum=0; for (var i=0;i<12;i++){ var n=parseInt(d12.charAt(i),10)||0; sum += (i%2===0)? n : n*3; }
  return String((10-(sum%10))%10);
}

// ── จับคู่อัตโนมัติด้วยชื่อ (รันใน editor ครั้งเดียว) ──
// ตรงชื่อ→"จับคู่แล้ว"(ยืมบาร์โค้ด) ; ไม่ตรง→"เพิ่มใหม่"(จะสร้างสินค้าใหม่)
function pbAutoMatch(){
  try {
    var s = pbSheet_(); if (!s || s.getLastRow()<2) return 'ไม่มีข้อมูลใน PRICE_BOOK';
    var klh = klhDataSheet_(); var d = klh.getDataRange().getValues();
    var sn = function(v){ var n=parseFloat(v); return isNaN(n)?0:n; };
    var map = {};
    for (var i=1;i<d.length;i++){
      var bc=String(d[i][0]||'').trim(); if(!bc) continue;
      var k=pbNorm_(d[i][1]); if(!k) continue;
      if(!map[k]) map[k]={ barcode:bc, name:String(d[i][1]||''), cost:sn(d[i][17]), retail:sn(d[i][23]), whole:sn(d[i][21]) };
    }
    var n = s.getLastRow()-1;
    var vals = s.getRange(2,1,n,PB_HEAD.length).getValues();
    var matched=0, newc=0, skip=0;
    for (var j=0;j<vals.length;j++){
      var r=vals[j];
      if (String(r[0])==='ส่งแล้ว' || String(r[0])==='ยืนยันแล้ว'){ skip++; continue; }  // อย่าทับที่ยืนยัน/ส่งแล้ว
      var m = map[pbNorm_(r[2])];
      if (m){ r[0]='จับคู่แล้ว'; r[1]=m.barcode; r[8]=m.name; r[9]=m.cost; r[10]=m.retail; r[11]=m.whole; matched++; }
      else  { r[0]='เพิ่มใหม่'; r[1]=''; r[8]=''; r[9]=''; r[10]=''; r[11]=''; newc++; }
    }
    s.getRange(2,1,n,PB_HEAD.length).setValues(vals);
    Logger.log('pbAutoMatch: matched='+matched+' new='+newc+' skip='+skip+' total='+n);
    return 'จับคู่อัตโนมัติเสร็จ — ตรงชื่อ '+matched+' · เพิ่มใหม่ '+newc+(skip?(' · ข้าม(ยืนยัน/ส่งแล้ว) '+skip):'')+' (รวม '+n+')';
  } catch(e){ return 'ERROR: '+e; }
}

// ── จับคู่รอบ 2 (เฉพาะที่ยัง "เพิ่มใหม่") — ขึ้นต้นตรงกัน + กันกำกวม/กันทับซ้ำ ──
//  เคสที่จับ: ชื่อสมุดราคา = ชื่อ KLH + ส่วนต่อท้าย (ราคา/ขนาด) เช่น "มาม่าต้มยำ7บาท" ↔ "มาม่าต้มยำ"
//  กฎปลอดภัย: (1) ฝั่งสั้นเป็นคำขึ้นต้นของฝั่งยาว (2) ต่างกัน ≤8 ตัว (3) KLH ที่เข้าได้ต้องบาร์โค้ดเดียว
//             (4) บาร์โค้ดนั้นต้องถูกอ้างโดยสมุดราคาแถวเดียว (กันหลายขนาดไปทับบาร์โค้ดเดียวกัน)
function pbAutoMatch2() {
  try {
    var s = pbSheet_(); if (!s || s.getLastRow()<2) return 'ไม่มีข้อมูลใน PRICE_BOOK';
    var klh = klhDataSheet_(); var d = klh.getDataRange().getValues();
    var sn = function(v){ var n=parseFloat(v); return isNaN(n)?0:n; };
    var bucket = {};   // จัดกลุ่ม KLH ตาม 3 ตัวอักษรแรก (เร่งความเร็ว)
    for (var i=1;i<d.length;i++){
      var bc=String(d[i][0]||'').trim(); if(!bc) continue;
      var norm=pbNorm_(d[i][1]); if(norm.length<6) continue;
      var info={ barcode:bc, name:String(d[i][1]||''), norm:norm, cost:sn(d[i][17]), retail:sn(d[i][23]), whole:sn(d[i][21]) };
      var k3=norm.slice(0,3); (bucket[k3]=bucket[k3]||[]).push(info);
    }
    var n = s.getLastRow()-1; var vals = s.getRange(2,1,n,PB_HEAD.length).getValues();
    // pass A: หา candidate ต่อแถว + นับการอ้างบาร์โค้ด
    var cand = [], claims = {};
    for (var j=0;j<vals.length;j++){
      cand[j]=null;
      if (String(vals[j][0])!=='เพิ่มใหม่') continue;
      var key=pbNorm_(vals[j][2]); if(key.length<6) continue;
      var list=bucket[key.slice(0,3)]||[];
      var hitBc=null, ok=true;
      for (var m=0;m<list.length;m++){
        var x=list[m];
        var short=x.norm.length<=key.length?x.norm:key;
        var lng  =x.norm.length<=key.length?key:x.norm;
        if (lng.indexOf(short)===0 && (lng.length-short.length)<=8){
          if (hitBc===null) hitBc=x.barcode;
          else if (hitBc!==x.barcode){ ok=false; break; }   // หลาย KLH → กำกวม ทิ้ง
        }
      }
      if (ok && hitBc){ for(var q=0;q<list.length;q++){ if(list[q].barcode===hitBc){ cand[j]=list[q]; break; } } claims[hitBc]=(claims[hitBc]||0)+1; }
    }
    // pass B: รับเฉพาะบาร์โค้ดที่ถูกอ้างโดยแถวเดียว
    var matched=0, rem=0;
    for (var j2=0;j2<vals.length;j2++){
      if (String(vals[j2][0])!=='เพิ่มใหม่') continue;
      var c=cand[j2];
      if (c && claims[c.barcode]===1){
        vals[j2][0]='จับคู่แล้ว'; vals[j2][1]=c.barcode; vals[j2][8]=c.name;
        vals[j2][9]=c.cost; vals[j2][10]=c.retail; vals[j2][11]=c.whole; matched++;
      } else rem++;
    }
    s.getRange(2,1,n,PB_HEAD.length).setValues(vals);
    Logger.log('pbAutoMatch2: matched='+matched+' remain-new='+rem);
    return 'จับคู่รอบ 2 ได้เพิ่ม '+matched+' รายการ · เหลือ "เพิ่มใหม่" '+rem;
  } catch(e){ return 'ERROR: '+e; }
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
  var c = { total:st.length, pending:0, matched:0, confirmed:0, pushed:0, newc:0 };
  st.forEach(function(r){ var v=String(r[0]);
    if(v==='ยืนยันแล้ว')c.confirmed++; else if(v==='จับคู่แล้ว')c.matched++; else if(v==='ส่งแล้ว')c.pushed++;
    else if(v==='เพิ่มใหม่')c.newc++; else c.pending++; });
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
  // มีบาร์โค้ด = ยืนยันอัปเดตของเดิม / ไม่มีบาร์โค้ด = ยืนยันเพิ่มเป็นสินค้าใหม่
  var hasBc = !!String(s.getRange(row,2).getValue()||'').trim();
  s.getRange(row,1).setValue(on ? 'ยืนยันแล้ว' : (hasBc ? 'จับคู่แล้ว' : 'เพิ่มใหม่'));
  s.getRange(row,14).setValue(on ? (Session.getActiveUser().getEmail()||'staff') : '');
  s.getRange(row,15).setValue(on ? Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd HH:mm') : '');
  return { ok:true };
}
// ── ยืนยันทั้งหมด (bulk) — รันใน editor · status ว่าง=ทั้ง จับคู่แล้ว+เพิ่มใหม่ ──
function pbConfirmAll(statusFilter) {
  try {
    var s = pbSheet_(); if (!s || s.getLastRow()<2) return 'ไม่มีข้อมูล';
    var n = s.getLastRow()-1;
    var st = s.getRange(2,1,n,1).getValues();
    var c=0, m=0, nw=0;
    for (var i=0;i<st.length;i++){
      var v=String(st[i][0]);
      var pick = statusFilter ? (v===statusFilter) : (v==='จับคู่แล้ว'||v==='เพิ่มใหม่');
      if (pick){ if(v==='จับคู่แล้ว')m++; else if(v==='เพิ่มใหม่')nw++; st[i][0]='ยืนยันแล้ว'; c++; }
    }
    s.getRange(2,1,n,1).setValues(st);
    return 'ยืนยันแล้ว '+c+' รายการ (จับคู่แล้ว '+m+' · เพิ่มใหม่ '+nw+') → รัน pbPushToKlh() เพื่อส่งเข้า KLH DATA';
  } catch(e){ return 'ERROR: '+e; }
}

// ── ส่งกลับ KLH DATA (เฉพาะ "ยืนยันแล้ว" + backup + log) — batch ทั้งหมด กัน timeout ──
//   มีบาร์โค้ด → อัปเดต "ส่ง + ปลีก" เท่านั้น (ไม่แตะทุน — FIFO/รับเข้าเป็นเจ้าของ)
//   ไม่มีบาร์โค้ด → สร้างสินค้าใหม่ + ออกรหัสภายใน 21xxxxxxxxxxx (ทุนตั้งต้นจาก Excel)
function pbPushToKlh() {
  try {
    var s = pbSheet_(); if (!s || s.getLastRow()<2) return { ok:false, msg:'ไม่มีข้อมูล' };
    var n = s.getLastRow()-1;
    var vals = s.getRange(2,1,n,PB_HEAD.length).getValues();
    if (!vals.some(function(r){ return String(r[0])==='ยืนยันแล้ว'; })) return { ok:false, msg:'ไม่มีแถวที่ยืนยันแล้ว' };
    var klh = klhDataSheet_(); var data = klh.getDataRange().getValues();
    var width = Math.max(klh.getLastColumn(), 35);
    var idx = {}, maxPlu = 0;
    for (var i=1;i<data.length;i++){
      var b=String(data[i][0]).trim(); if(b) idx[b]=i;
      if (/^21\d{11}$/.test(b)){ var nn=parseInt(b.substring(2,12),10); if(nn>maxPlu) maxPlu=nn; }
    }
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var bakName = 'KLHDATA_BAK_'+Utilities.formatDate(new Date(),'Asia/Bangkok','yyyyMMdd_HHmmss');
    ss.insertSheet(bakName).getRange(1,1,data.length,data[0].length).setValues(data);   // backup (batch)
    var now = Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd HH:mm');
    var today = Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd');
    var updated=0, created=0, logRows=[], newRows=[];
    for (var vi=0; vi<vals.length; vi++){
      var r = vals[vi]; if (String(r[0])!=='ยืนยันแล้ว') continue;
      var bc = String(r[1]).trim();
      if (bc && idx[bc]!=null){
        var ri = idx[bc];
        var oldRetail=data[ri][23], oldWhole=data[ri][21], oldCost=data[ri][17];
        if (r[6]!=='') data[ri][23] = r[6];   // X ปลีก (แก้ใน array)
        if (r[7]!=='') data[ri][21] = r[7];   // V ส่ง
        logRows.push([now,'UPDATE', bc, data[ri][1], oldCost, oldCost, oldRetail, r[6], oldWhole, r[7]]);
        vals[vi][0]='ส่งแล้ว'; updated++;
      } else if (!bc){
        maxPlu++; var d12='21'+('0000000000'+maxPlu).slice(-10); var newBc=d12+ean13Check_(d12);
        var cost=pbNum_(r[5])||0, retail=pbNum_(r[6])||0, whole=pbNum_(r[7])||0;
        var row=[]; for (var c=0;c<width;c++) row.push('');
        row[0]=newBc; row[1]=String(r[2]||''); row[3]=String(r[3]||'');
        row[15]=cost; row[16]='7%'; row[17]=cost; row[21]=whole; row[23]=retail; row[24]=today;
        newRows.push(row);
        logRows.push([now,'NEW', newBc, r[2], '', cost, '', retail, '', whole]);
        vals[vi][1]=newBc; vals[vi][0]='ส่งแล้ว'; created++;
      }
    }
    // เขียนคืน KLH DATA: คอลัมน์ V(22) + X(24) ทั้งหมดทีเดียว
    if (data.length>1){
      var vCol=[], xCol=[];
      for (var d2=1; d2<data.length; d2++){ vCol.push([data[d2][21]]); xCol.push([data[d2][23]]); }
      klh.getRange(2,22,vCol.length,1).setValues(vCol);
      klh.getRange(2,24,xCol.length,1).setValues(xCol);
    }
    if (newRows.length) klh.getRange(klh.getLastRow()+1,1,newRows.length,width).setValues(newRows);
    // log (batch)
    var log = ss.getSheetByName('PRICE_UPDATE_LOG') || ss.insertSheet('PRICE_UPDATE_LOG');
    if (log.getLastRow()===0) log.appendRow(['DATE','ACTION','BARCODE','NAME','COST_OLD','COST_NEW','RETAIL_OLD','RETAIL_NEW','WHOLE_OLD','WHOLE_NEW']);
    if (logRows.length) log.getRange(log.getLastRow()+1,1,logRows.length,10).setValues(logRows);
    // เขียนคืน PRICE_BOOK: สถานะ(1) + บาร์โค้ด(2) ทั้งคอลัมน์
    var stCol=[], bcCol=[];
    for (var v2=0; v2<vals.length; v2++){ stCol.push([vals[v2][0]]); bcCol.push([vals[v2][1]]); }
    s.getRange(2,1,n,1).setValues(stCol);
    s.getRange(2,2,n,1).setValues(bcCol);
    return { ok:true, updated:updated, created:created, backup:bakName };
  } catch(e){ return { ok:false, msg:String(e) }; }
}
