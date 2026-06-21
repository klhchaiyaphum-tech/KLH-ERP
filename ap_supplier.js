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

// ── (2) รายงานจ่ายเจ้าหนี้ BAYC 6 เดือน (ม.ค.-มิ.ย.) → ชีต AP_BAYC_REPORT ──
function apBaycReport(year) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var b = ss.getSheetByName('BANK_TRANSACTIONS'); if (!b) return 'ไม่พบ BANK_TRANSACTIONS';
  year = year || (new Date()).getFullYear();
  var bv = b.getDataRange().getValues();
  var sm = ss.getSheetByName('SUPPLIER_MASTER').getDataRange().getValues().slice(1)
    .map(function(r){ return { code:String(r[0]||''), name:String(r[1]||''), norm:apNorm_(r[1]) }; })
    .filter(function(x){ return x.norm.length>=3; });
  function matchSup(payee){
    var n = apNorm_(payee); if (n.length<3) return null;
    var best=null;
    for (var i=0;i<sm.length;i++){ var sn=sm[i].norm;
      if (sn===n) return sm[i];
      if (sn.indexOf(n)>=0 || n.indexOf(sn)>=0){ if(!best) best=sm[i]; } }
    return best;
  }
  var tz='Asia/Bangkok', groups={};
  for (var i=1;i<bv.length;i++){
    var r=bv[i];
    if (String(r[1])!=='BAYC' || String(r[2])!=='OUT' || String(r[4])!=='PAYMENT') continue;
    var d = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (isNaN(d) || d.getFullYear()!==year || d.getMonth()>5) continue;   // ม.ค.-มิ.ย.
    var p = apParseSubject_(r[5]);
    var key = p.payee || ('(ไม่ระบุผู้รับ)');
    var g = groups[key] || (groups[key]={ payee:p.payee||'(ไม่ระบุผู้รับ)', bank:'', account:'', count:0, total:0, months:{}, sup:null, refs:[] });
    g.count++; g.total += Number(r[3])||0;
    var mm = Utilities.formatDate(d,tz,'MM'); g.months[mm]=(g.months[mm]||0)+(Number(r[3])||0);
    if (p.account && !g.account) g.account=p.account;
    if (p.bank && !g.bank) g.bank=p.bank;
    if (!g.sup && p.payee) g.sup=matchSup(p.payee);
  }
  var rep = ss.getSheetByName('AP_BAYC_REPORT'); if (rep) ss.deleteSheet(rep);
  rep = ss.insertSheet('AP_BAYC_REPORT');
  rep.getRange(1,1,1,13).setValues([['ผู้รับ(ธนาคาร)','ผู้ขาย(code)','ผู้ขาย(ชื่อ)','ธนาคาร','บัญชีปลายทาง','ครั้ง','ยอดรวม','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.']])
     .setFontWeight('bold').setBackground('#1A237E').setFontColor('#fff');
  rep.setFrozenRows(1);
  var arr = Object.keys(groups).map(function(k){return groups[k];}).sort(function(a,b){return b.total-a.total;});
  var rows = arr.map(function(g){
    return [ g.payee, g.sup?g.sup.code:'', g.sup?g.sup.name:'(ไม่จับคู่)', g.bank, g.account, g.count, g.total,
             g.months['01']||'', g.months['02']||'', g.months['03']||'', g.months['04']||'', g.months['05']||'', g.months['06']||'' ];
  });
  if (rows.length) rep.getRange(2,1,rows.length,13).setValues(rows);
  var matched = arr.filter(function(g){return g.sup;}).length;
  var grand = arr.reduce(function(t,g){return t+g.total;},0);
  Logger.log('AP_BAYC_REPORT '+year+': '+arr.length+' ผู้รับ · จับคู่ผู้ขายได้ '+matched+' · ยอดจ่ายรวม '+grand);
  return 'เสร็จ → ชีต AP_BAYC_REPORT : '+arr.length+' ผู้รับ (จับคู่ผู้ขาย '+matched+') ยอดรวม '+Math.round(grand).toLocaleString();
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
