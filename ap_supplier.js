// ============================================================
//  ap_supplier.js — เจ้าหนี้ (AP) + ทำความสะอาด SUPPLIER_MASTER + เทียบจ่าย BAYC
//  SUPPLIER_MASTER: A code · B name · C contact · D address · E tel
//                   F taxId · G bankName · H bankAccount · I chequePayable · J creditDays · K note
//  BANK_TRANSACTIONS: 0 DATE · 1 BANK · 2 DIR · 3 AMOUNT · 4 CAT · 5 SUBJECT · 6 EMAIL_DATE · 7 MSG_ID · 8 NOTE · 9 ACCOUNT
// ============================================================

// ── (1) ใส่หัวคอลัมน์ F-K ──
function apAddSupplierHeaders() {
  var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName('SUPPLIER_MASTER');
  if (!s) return 'ไม่พบ SUPPLIER_MASTER';
  var heads = ['SUPPLIER_ID','SUPPLIER_NAME','CONTACT_PERSON','ADDRESS','TEL',
               'TAX_ID','BANK_NAME','BANK_ACCOUNT','CHEQUE_PAYABLE','CREDIT_DAYS','NOTE'];
  s.getRange(1,1,1,heads.length).setValues([heads]).setFontWeight('bold').setBackground('#1A237E').setFontColor('#fff');
  s.setFrozenRows(1);
  return 'ใส่หัวคอลัมน์แล้ว: ' + heads.slice(5).join(' · ');
}

// ── normalize ชื่อบริษัท สำหรับจับคู่ ──
function apNorm_(s) {
  return String(s||'')
    .replace(/บริษัท|บจก\.?|บจ\.?|หจก\.?|ห้างหุ้นส่วนจำกัด|บ\.|\(มหาชน\)|มหาชน|จำกัด|จก\.?/g,'')
    .replace(/[\s\.\(\),\-\/]/g,'').toLowerCase();
}
// ── แกะ SUBJECT ธนาคาร: ธนาคาร / ผู้รับ / บัญชีปลายทาง / อ้างอิง ──
function apParseSubject_(subj) {
  var s = String(subj||'');
  var acct = (s.match(/บัญชีปลายทาง\s*:\s*([0-9A-Za-z]+)/)||[])[1] || '';
  var ref  = (s.match(/หมายเลขอ้างอิง\s*:\s*([0-9]+)/)||[])[1] || '';
  var m = s.match(/^โอนเงิน\s+([A-Z]+)\s+([\s\S]*?)\s*บัญชีปลายทาง/);
  if (m) return { bank:m[1], payee:m[2].replace(/\s+/g,' ').trim(), account:acct, ref:ref, kind:'transfer' };
  if (/พร้อมเพย์|จ่ายบิล|จ่ายคิวอาร์/.test(s)) {
    var p2 = s.replace(/^จ่ายคิวอาร์พร้อมเพย์\s*|^จ่ายบิล\s*/,'').replace(/บัญชีปลายทาง[\s\S]*/,'').replace(/หมายเลขอ้างอิง[\s\S]*/,'').trim();
    return { bank:'', payee:p2, account:acct, ref:ref, kind:'qr/bill' };
  }
  return { bank:'', payee:'', account:acct, ref:ref, kind:'other' };
}

// ชื่อธนาคารไทย
var AP_BANK = {KBANK:'กสิกรไทย',BBL:'กรุงเทพ',SCB:'ไทยพาณิชย์',TTB:'ทหารไทยธนชาต',BAY:'กรุงศรี',KTB:'กรุงไทย',GSB:'ออมสิน',UOB:'ยูโอบี',CIMB:'ซีไอเอ็มบี',TISCO:'ทิสโก้',KKP:'เกียรตินาคิน',LHBANK:'แลนด์แอนด์เฮ้าส์',BAAC:'ธกส.',GHB:'อาคารสงเคราะห์'};
function apBankTh_(c){ return AP_BANK[c] || c || ''; }
// จับคู่ผู้รับกับ SUPPLIER_MASTER + จัดประเภทความตรง
function apMatchAll_(payee, sm){
  var n = apNorm_(payee); if (n.length<3) return {type:'ไม่เจอ 🔴', best:null, alts:[]};
  var exact=[], partial=[];
  for (var i=0;i<sm.length;i++){ var sn=sm[i].norm; if(!sn) continue;
    if (sn===n) exact.push(sm[i]);
    else if (sn.indexOf(n)>=0 || n.indexOf(sn)>=0) partial.push(sm[i]); }
  if (exact.length===1) return {type:'ตรงเป๊ะ', best:exact[0], alts:[]};
  if (exact.length>1)   return {type:'เป๊ะหลายตัว ⚠️', best:exact[0], alts:exact.slice(1)};
  if (partial.length===1) return {type:'ตรงบางส่วน ⚠️', best:partial[0], alts:[]};
  if (partial.length>1)   return {type:'บางส่วนหลายตัว ⚠️', best:partial[0], alts:partial.slice(1)};
  return {type:'ไม่เจอ 🔴', best:null, alts:[]};
}

// ── (2) รายงานจ่ายเจ้าหนี้ BAYC 6 เดือน + จับคู่ + ช่องยืนยัน → ชีต AP_BAYC_REPORT ──
function apBaycReport(year) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var b = ss.getSheetByName('BANK_TRANSACTIONS'); if (!b) return 'ไม่พบ BANK_TRANSACTIONS';
  year = year || (new Date()).getFullYear();
  var bv = b.getDataRange().getValues();
  var sm = ss.getSheetByName('SUPPLIER_MASTER').getDataRange().getValues().slice(1)
    .map(function(r){ return { code:String(r[0]||''), name:String(r[1]||''), norm:apNorm_(r[1]), curH:String(r[7]||'') }; })
    .filter(function(x){ return x.norm.length>=3; });
  var tz='Asia/Bangkok', groups={};
  for (var i=1;i<bv.length;i++){
    var r=bv[i];
    if (String(r[1])!=='BAYC' || String(r[2])!=='OUT' || String(r[4])!=='PAYMENT') continue;
    var d = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (isNaN(d) || d.getFullYear()!==year || d.getMonth()>5) continue;
    var p = apParseSubject_(r[5]);
    var key = p.payee || '(ไม่ระบุผู้รับ)';
    var g = groups[key] || (groups[key]={ payee:p.payee||'(ไม่ระบุผู้รับ)', bank:'', account:'', count:0, total:0, months:{} });
    g.count++; g.total += Number(r[3])||0;
    var mm = Utilities.formatDate(d,tz,'MM'); g.months[mm]=(g.months[mm]||0)+(Number(r[3])||0);
    if (p.account && !g.account) g.account=p.account;
    if (p.bank && !g.bank) g.bank=p.bank;
  }
  var rep = ss.getSheetByName('AP_BAYC_REPORT'); if (rep) ss.deleteSheet(rep);
  rep = ss.insertSheet('AP_BAYC_REPORT');
  var HEAD=['ผู้รับ(ธนาคาร)','สถานะจับคู่','ผู้ขาย(code)','ผู้ขาย(ชื่อ)','ตัวเลือกอื่น','บัญชีเดิม(H)','ธนาคาร','บัญชีปลายทาง','ครั้ง','ยอดรวม','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ยืนยัน(ใส่code/✓)'];
  rep.getRange(1,1,1,HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#1A237E').setFontColor('#fff');
  rep.setFrozenRows(1);
  var arr = Object.keys(groups).map(function(k){return groups[k];}).sort(function(a,b){return b.total-a.total;});
  var rows = arr.map(function(g){
    var m = apMatchAll_(g.payee, sm);
    var alts = m.alts.map(function(s){return s.code;}).join(', ');
    return [ g.payee, m.type, m.best?m.best.code:'', m.best?m.best.name:'', alts, m.best?m.best.curH:'',
             apBankTh_(g.bank), g.account, g.count, g.total,
             g.months['01']||'', g.months['02']||'', g.months['03']||'', g.months['04']||'', g.months['05']||'', g.months['06']||'', '' ];
  });
  if (rows.length) rep.getRange(2,1,rows.length,HEAD.length).setValues(rows);
  var exact = rows.filter(function(x){return x[1]==='ตรงเป๊ะ';}).length;
  var none  = rows.filter(function(x){return x[1].indexOf('ไม่เจอ')>=0;}).length;
  var grand = arr.reduce(function(t,g){return t+g.total;},0);
  Logger.log('AP_BAYC_REPORT '+year+': '+arr.length+' ผู้รับ · ตรงเป๊ะ '+exact+' · ไม่เจอ '+none+' · ยอดรวม '+grand);
  return 'เสร็จ → ชีต AP_BAYC_REPORT : '+arr.length+' ผู้รับ (ตรงเป๊ะ '+exact+' · ต้องรีวิว '+(arr.length-exact)+' · ไม่เจอ '+none+') ยอดรวม '+Math.round(grand).toLocaleString();
}

// ── หาชื่อผู้ขายซ้ำใน SUPPLIER_MASTER ──
function apFindDupSuppliers() {
  var sm = SpreadsheetApp.openById(SHEET_ID).getSheetByName('SUPPLIER_MASTER').getDataRange().getValues().slice(1);
  var m = {};
  sm.forEach(function(r){ var n=apNorm_(r[1]); if(n.length<3) return; (m[n]=m[n]||[]).push(String(r[0])+': '+String(r[1])); });
  var dups = Object.keys(m).filter(function(k){return m[k].length>1;}).map(function(k){return m[k].join('   ||   ');});
  Logger.log('ชื่อผู้ขายซ้ำ '+dups.length+' กลุ่ม:\n'+dups.join('\n'));
  return 'พบชื่อซ้ำ '+dups.length+' กลุ่ม (ดูรายละเอียดใน execution log)';
}

// ── ตรวจ SUPPLIER_MASTER: ชื่อซ้ำ + ชื่อน่าสงสัย → ชีต SUPPLIER_AUDIT (รีวิวก่อนจับคู่บัญชี) ──
function apSupplierAudit() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sm = ss.getSheetByName('SUPPLIER_MASTER'); if (!sm) return 'ไม่พบ SUPPLIER_MASTER';
  var sd = sm.getDataRange().getValues();
  var normMap = {};
  for (var i=1;i<sd.length;i++){ var n=apNorm_(sd[i][1]); if(n) (normMap[n]=normMap[n]||[]).push(i); }
  var rows = [];
  for (var i=1;i<sd.length;i++){
    var r=sd[i], name=String(r[1]||'').trim(), n=apNorm_(name);
    var dup = (normMap[n]||[]).filter(function(x){return x!==i;}).map(function(x){return String(sd[x][0]);});
    var flags = [];
    if (!name) flags.push('ไม่มีชื่อ');
    if (n.length>0 && n.length<4) flags.push('ชื่อสั้น/น่าสงสัย');
    if (n && dup.length>0) flags.push('ซ้ำ');
    if (!flags.length) continue;
    rows.push({ norm:n, row:[String(r[0]), name, flags.join(', '), dup.join(', '),
                String(r[2]||''), String(r[4]||''), String(r[5]||''), String(r[7]||'')] });
  }
  rows.sort(function(a,b){ return a.norm < b.norm ? -1 : (a.norm > b.norm ? 1 : 0); });   // ซ้ำอยู่ติดกัน
  var aud = ss.getSheetByName('SUPPLIER_AUDIT'); if (aud) ss.deleteSheet(aud);
  aud = ss.insertSheet('SUPPLIER_AUDIT');
  aud.getRange(1,1,1,8).setValues([['SUPPLIER_ID','ชื่อ','ปัญหา','ซ้ำกับ(code)','ผู้ติดต่อ','โทร','เลขภาษี(F)','บัญชี(H)']])
     .setFontWeight('bold').setBackground('#B71C1C').setFontColor('#fff');
  aud.setFrozenRows(1);
  if (rows.length) aud.getRange(2,1,rows.length,8).setValues(rows.map(function(x){return x.row;}));
  var dupCount = rows.filter(function(x){return x.row[2].indexOf('ซ้ำ')>=0;}).length;
  Logger.log('SUPPLIER_AUDIT: '+rows.length+' แถวมีปัญหา (ซ้ำ '+dupCount+') จาก '+(sd.length-1)+' ผู้ขาย');
  return 'เสร็จ → ชีต SUPPLIER_AUDIT : '+rows.length+' แถวต้องตรวจ (ซ้ำ '+dupCount+' · น่าสงสัย/ว่าง '+(rows.length-dupCount)+') จากทั้งหมด '+(sd.length-1)+' ผู้ขาย';
}

// ── (3) เติมเลขบัญชี/ธนาคาร เข้า SUPPLIER_MASTER เฉพาะแถวที่ "ยืนยัน" (H ว่างเท่านั้น) ──
function apApplyAccounts() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var rep = ss.getSheetByName('AP_BAYC_REPORT'); if (!rep) return 'ยังไม่มี AP_BAYC_REPORT — รัน apBaycReport ก่อน';
  var rv = rep.getDataRange().getValues();
  var hd = rv[0].map(function(x){return String(x);});
  function col(name){ return hd.indexOf(name); }
  var cCfm=col('ยืนยัน(ใส่code/✓)'), cCode=col('ผู้ขาย(code)'), cBank=col('ธนาคาร'), cAcct=col('บัญชีปลายทาง');
  if (cCfm<0) return 'ไม่พบคอลัมน์ยืนยัน — รัน apBaycReport ใหม่';
  var sm = ss.getSheetByName('SUPPLIER_MASTER'); var sd = sm.getDataRange().getValues();
  var bak = ss.insertSheet('SUPPLIER_BAK_'+Utilities.formatDate(new Date(),'Asia/Bangkok','yyyyMMdd_HHmmss'));
  bak.getRange(1,1,sd.length,sd[0].length).setValues(sd);
  var idx={}; for (var i=1;i<sd.length;i++){ idx[String(sd[i][0]).trim()]=i; }
  var filled=0, skipped=0, badcode=0;
  for (var r=1;r<rv.length;r++){
    var cfm=String(rv[r][cCfm]||'').trim(); if(!cfm) continue;
    var code = /VEND-/i.test(cfm) ? cfm.toUpperCase().match(/VEND-\d+/)[0] : String(rv[r][cCode]||'').trim();
    if (!code || idx[code]==null){ badcode++; continue; }
    var ri=idx[code], curH=String(sd[ri][7]||'').trim();
    var bankTh=String(rv[r][cBank]||''), acct=String(rv[r][cAcct]||'');
    if (curH){ skipped++; }                          // มีบัญชีเต็มอยู่แล้ว → ไม่ทับ
    else if (acct){ sm.getRange(ri+1,8).setValue(acct+' (ย่อจากแบงค์)'); sd[ri][7]=acct; filled++; }
    if (!String(sd[ri][6]||'').trim() && bankTh){ sm.getRange(ri+1,7).setValue(bankTh); sd[ri][6]=bankTh; }
  }
  return 'เติมบัญชีใหม่ '+filled+' · ข้าม(H มีอยู่แล้ว) '+skipped+' · code ไม่ถูก '+badcode+' (backup '+bak.getName()+')';
}

// ── (3) ย้ายข้อมูลเก่าที่ผิดช่องใน F (ไม่ใช่เลขภาษี) → NOTE + backup ก่อน ──
function apCleanSupplierF() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName('SUPPLIER_MASTER'); if (!s) return 'ไม่พบ SUPPLIER_MASTER';
  var data = s.getDataRange().getValues();
  var bak = ss.insertSheet('SUPPLIER_BAK_'+Utilities.formatDate(new Date(),'Asia/Bangkok','yyyyMMdd_HHmmss'));
  bak.getRange(1,1,data.length,data[0].length).setValues(data);
  var moved=0;
  for (var i=1;i<data.length;i++){
    var f = String(data[i][5]||'').trim();
    if (!f) continue;
    var digits = f.replace(/[^0-9]/g,'');
    var isTaxId = (digits.length>=10) && /^[0-9\s\-]+$/.test(f);   // เลขล้วน = เลขภาษี → คงไว้
    if (isTaxId) continue;
    // ไม่ใช่เลขภาษี (มีตัวอักษร/ข้อความ เช่น "โอน...") → ย้ายไป NOTE
    var note = String(data[i][10]||'');
    s.getRange(i+1,11).setValue((note?note+' | ':'')+'[ย้ายจาก F] '+f);
    s.getRange(i+1,6).setValue('');
    moved++;
  }
  return 'ย้ายข้อมูลเก่าจาก F → NOTE จำนวน '+moved+' แถว (สำรองไว้ที่ '+bak.getName()+')';
}

// ── ตรวจข้อมูลจริง (อ่านอย่างเดียว) ──
function apInspect() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var out = {};
  var sm = ss.getSheetByName('SUPPLIER_MASTER');
  if (sm) {
    var sv = sm.getDataRange().getValues();
    out.supHeader = sv[0].slice(0,12).map(function(x){ return String(x||''); });
    out.supCount = sv.length - 1;
    out.supSample = sv.slice(1, 13).map(function(r){ return r.slice(0,12).map(function(x){ return String(x||''); }); });
    var c = { F:0, G:0, H:0, I:0, J:0, K:0 };
    for (var i=1;i<sv.length;i++){ ['F','G','H','I','J','K'].forEach(function(col,idx){ if(String(sv[i][5+idx]||'').trim()) c[col]++; }); }
    out.supFilled = c;
  } else out.supHeader = 'ไม่พบ SUPPLIER_MASTER';
  var b = ss.getSheetByName('BANK_TRANSACTIONS');
  if (b) {
    var bv = b.getDataRange().getValues();
    out.bankHeader = bv[0].map(function(x){ return String(x||''); });
    var bayc = bv.slice(1).filter(function(r){ return String(r[1])==='BAYC'; });
    out.baycTotal = bayc.length;
    var out2 = bayc.filter(function(r){ return String(r[2])==='OUT'; });
    out.baycOut = out2.length;
    out.baycCats = {};
    out2.forEach(function(r){ var k=String(r[4]||'?'); out.baycCats[k]=(out.baycCats[k]||0)+1; });
    out.baycSample = out2.slice(0, 18).map(function(r){
      return { date:String(r[0]), amt:r[3], cat:String(r[4]), subject:String(r[5]||'').slice(0,90), note:String(r[8]||''), acct:String(r[9]||'') };
    });
  } else out.bankHeader = 'ไม่พบ BANK_TRANSACTIONS';
  Logger.log('=== AP_INSPECT_JSON_START ===');
  Logger.log(JSON.stringify(out));
  Logger.log('=== AP_INSPECT_JSON_END ===');
  return out;
}
