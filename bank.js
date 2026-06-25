// ============================================================
//  bank.js — อ่านอีเมลธนาคาร (KTB + กรุงศรี) → BANK_TRANSACTIONS
//  ตามแผน PLAN_Accounting_KLH:
//   • KTB รับเข้า = ฐานยอดขายภาษี (ภพ.30)
//   • กรุงศรี: ยอดที่ตรงกับโอนออก KTB วันเดียวกัน = "โยกเงิน" (ไม่นับขาย)
//  ตั้งค่า CONFIG: BANK_EMAIL_KTB / BANK_EMAIL_BAY (ค่าเริ่มต้นด้านล่าง)
// ============================================================

var SH_BANK  = 'BANK_TRANSACTIONS';
var H_BANK   = ['DATE','BANK','DIRECTION','AMOUNT','CATEGORY','SUBJECT','EMAIL_DATE','MSG_ID','NOTE','ACCOUNT'];
// BANK: KTB=กรุงไทยออมทรัพย์ · BAY=กรุงศรีออมทรัพย์ · BAYC=กรุงศรีกระแสรายวัน · BAYF=กรุงศรีฝากประจำ
// CATEGORY: SALE/TRANSFER/PAYMENT/EXPENSE/UNKNOWN(รอผู้ใช้ระบุ)
// ACCOUNT: ผังบัญชีค่าใช้จ่าย → ดึงเข้างบกำไรขาดทุน

// ── ทะเบียนบัญชีจริง (source of truth) — เลขหลักที่ 2: 0=กระแส 1=ออม 2=ประจำ ──
var BANK_ACCOUNTS = {
  KTB:  { full:'307-0-40478-2', digits:'3070404782', short:'40478', name:'กรุงไทย ออมทรัพย์',   type:'ออมทรัพย์' },
  BAY:  { full:'023-1-64428-0', digits:'0231644280', short:'64428', name:'กรุงศรี ออมทรัพย์',   type:'ออมทรัพย์' },
  BAYC: { full:'023-0-02116-7', digits:'0230021167', short:'02116', name:'กรุงศรี กระแสรายวัน', type:'กระแสรายวัน' },
  BAYF: { full:'023-2-08835-4', digits:'0232088354', short:'08835', name:'กรุงศรี ฝากประจำ',    type:'ฝากประจำ' }
};
// ชื่อโฟลเดอร์ย่อยใน BANK_STATEMENTS → รหัสบัญชี (ระบุบัญชีตอนนำเข้า ไม่ต้องเดา)
function bankFromFolderName_(nm) {
  nm = String(nm || '');
  if (/กระแส|current|BAYC/i.test(nm)) return 'BAYC';
  if (/ฝากประจำ|ประจำ|fixed|BAYF/i.test(nm)) return 'BAYF';
  if (/ออม|saving|BAY(?!C|F)/i.test(nm)) return 'BAY';
  if (/กรุงไทย|KTB/i.test(nm)) return 'KTB';
  return '';
}
// เลขบัญชี (จากหัวไฟล์/ข้อความ) → รหัสบัญชี
function bankFromAccountDigits_(txt) {
  var d = String(txt || '').replace(/[^0-9]/g, '');
  // จับเฉพาะเลขบัญชีเต็ม 10 หลัก (แม่นยำ ไม่ false positive จากเลขอ้างอิงในรายการ)
  for (var k in BANK_ACCOUNTS) { if (d.indexOf(BANK_ACCOUNTS[k].digits) >= 0) return k; }
  return '';
}

function bankSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName(SH_BANK);
  if (!s) {
    s = ss.insertSheet(SH_BANK);
    s.getRange(1,1,1,H_BANK.length).setValues([H_BANK])
      .setBackground('#1A237E').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
  } else if (!s.getRange(1, 10).getValue()) {
    s.getRange(1, 10).setValue('ACCOUNT').setBackground('#1A237E').setFontColor('#fff').setFontWeight('bold');
  }
  return s;
}

// ════════════════════════════════════════════════════════════
//  ผังบัญชี (CHART_OF_ACCOUNTS) — เลขผัง · ชื่อ · ประเภท · ใช้งาน
//  TYPE: รายได้ / ค่าใช้จ่าย / หนี้สิน / สินทรัพย์ / ทุน
//  เฉพาะ TYPE='ค่าใช้จ่าย' เข้างบกำไรขาดทุน · หนี้สิน=งบดุล
// ════════════════════════════════════════════════════════════
var SH_COA = 'CHART_OF_ACCOUNTS';
var H_COA  = ['CODE', 'NAME', 'TYPE', 'ACTIVE'];

function chartSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName(SH_COA);
  if (!s) {
    s = ss.insertSheet(SH_COA);
    s.getRange(1, 1, 1, 4).setValues([H_COA]).setBackground('#00695C').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
    var seed = [
      ['4100', 'รายได้จากการขาย',                'รายได้',     true],
      ['4200', 'รายได้อื่น/เงินคืน',              'รายได้',     true],
      ['4210', 'ดอกเบี้ยรับ',                     'รายได้',     true],
      ['1180', 'ภาษีถูกหัก ณ ที่จ่าย',           'สินทรัพย์',  true],
      ['5100', 'ต้นทุนขาย',                       'ค่าใช้จ่าย',  true],
      ['5310', 'เงินเดือน/ค่าแรง',                'ค่าใช้จ่าย',  true],
      ['5311', 'ประกันสังคม (นายจ้าง)',           'ค่าใช้จ่าย',  true],
      ['5320', 'ค่าน้ำประปา',                     'ค่าใช้จ่าย',  true],
      ['5321', 'ค่าไฟฟ้า',                        'ค่าใช้จ่าย',  true],
      ['5322', 'ค่าโทรศัพท์/เน็ต',                'ค่าใช้จ่าย',  true],
      ['5330', 'ค่าขนส่ง',                        'ค่าใช้จ่าย',  true],
      ['5340', 'ค่าเช่า',                         'ค่าใช้จ่าย',  true],
      ['5350', 'ค่าธรรมเนียมธนาคาร',              'ค่าใช้จ่าย',  true],
      ['5351', 'ดอกเบี้ยธนาคาร',                  'ค่าใช้จ่าย',  true],
      ['5400', 'ภาษี',                            'ค่าใช้จ่าย',  true],
      ['5900', 'ค่าใช้จ่ายอื่น',                  'ค่าใช้จ่าย',  true],
      ['2100', 'ชำระเจ้าหนี้การค้า',              'หนี้สิน',    true],
      ['2210', 'เงินหักประกันสังคมพนักงาน',       'หนี้สิน',    true]
    ];
    s.getRange(2, 1, seed.length, 4).setValues(seed);
  }
  return s;
}
// เพิ่มผังบัญชีถ้ายังไม่มี (idempotent)
function coaEnsure_(code, name, type) {
  var s = chartSheet_(); var last = s.getLastRow();
  var codes = last > 1 ? s.getRange(2,1,last-1,1).getValues() : [];
  for (var i=0;i<codes.length;i++) if (String(codes[i][0])===String(code)) return;
  s.appendRow([code, name, type, true]);
}

// ════════════════════════════════════════════════════════════
//  รายงาน Excel การเคลื่อนไหวธนาคาร → ส่งเมล สนง.บัญชี (รายเดือน วันที่ 2)
//  CONFIG: ACCT_EMAIL = อีเมลสำนักงานบัญชี · ส่ง cc เจ้าของสคริปต์ด้วย
// ════════════════════════════════════════════════════════════
function reportPrevMonth_() {
  var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM');
}
function thaiMonth_(ym) {
  var m = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  var p = String(ym).split('-');
  return (m[Number(p[1]) - 1] || p[1]) + ' ' + p[0];
}

// รวบรวมข้อมูลรายงานของเดือน ym จาก BANK_TRANSACTIONS
function buildBankReportData_(ym) {
  var out = { ktbDaily:[], ktbOut:[], baySale:[], bayPay:[], transfers:[], pay:[], exp:[],
              sums:{ k_in:0,k_out:0,b_pp:0,b_tf:0,b_out:0,bc_in:0,pay:0,exp:0 } };
  var s = bankSheet_(); if (!s || s.getLastRow() < 2) return out;
  var rows = s.getRange(2,1,s.getLastRow()-1,11).getValues();
  function dd(v){ return v instanceof Date ? Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd') : String(v||'').slice(0,10); }
  var ktb = {}, S = out.sums;
  for (var i=0;i<rows.length;i++){
    var d = dd(rows[i][0]); if (d.slice(0,7) !== ym) continue;
    var bank=String(rows[i][1]).toUpperCase(), dir=String(rows[i][2]), amt=Number(rows[i][3])||0;
    var cat=String(rows[i][4]||''), subj=String(rows[i][5]||'').slice(0,60), coa=String(rows[i][9]||'');
    if (bank==='KTB' && dir==='IN'){ if(!ktb[d]) ktb[d]=[0,0]; ktb[d][0]++; ktb[d][1]+=amt; S.k_in+=amt; }
    else if (bank==='KTB' && dir==='OUT'){ out.ktbOut.push([d,amt,(cat==='TRANSFER'?'โอนออก':'ค่าใช้จ่าย'),subj]); S.k_out+=amt; }
    else if (bank==='BAY' && dir==='IN'){
      if (cat==='TRANSFER'){ out.transfers.push([d,'กรุงไทย → ออมทรัพย์ (ออมรับโอน)',amt]); S.b_tf+=amt; }
      else { out.baySale.push([d,amt,subj]); S.b_pp+=amt; }
    } else if (bank==='BAY' && dir==='OUT'){
      if (cat==='TRANSFER'){ out.transfers.push([d,'ออมทรัพย์ → กระแส (ออมโอนออก)',amt]); }
      else { out.bayPay.push([d,amt,coa,cat||'-']); }
      S.b_out+=amt;
    } else if (bank==='BAYC' && dir==='IN'){
      if (cat==='TRANSFER'){ out.transfers.push([d,'ออมทรัพย์ → กระแส (กระแสรับโอน)',amt]); }
      S.bc_in+=amt;
    } else if (bank==='BAYC' && dir==='OUT'){
      if (cat==='PAYMENT'){ out.pay.push([d,amt]); S.pay+=amt; }
      else { out.exp.push([d,amt,coa,cat||'-']); S.exp+=amt; }
    }
  }
  Object.keys(ktb).sort().forEach(function(k){ out.ktbDaily.push([k,ktb[k][0],Math.round(ktb[k][1]*100)/100]); });
  ['ktbOut','baySale','bayPay','transfers','pay','exp'].forEach(function(key){
    out[key].sort(function(a,b){ return a[0]<b[0]?-1:(a[0]>b[0]?1:0); });
  });
  return out;
}

// เขียนแท็บ 1 แท็บ (หัวกรมท่า + แถวรวม) ลงชีตชั่วคราว
function rptTab_(ss, name, headers, widths, dataRows, totalCol) {
  var sh = ss.insertSheet(name);
  sh.getRange(1,1,1,headers.length).setValues([headers]).setBackground('#1A237E').setFontColor('#fff').setFontWeight('bold');
  var n = dataRows.length;
  if (n) sh.getRange(2,1,n,headers.length).setValues(dataRows);
  if (totalCol){
    var tot=0; for (var i=0;i<n;i++){ if (typeof dataRows[i][totalCol-1]==='number') tot+=dataRows[i][totalCol-1]; }
    var tr=[]; for (var c=0;c<headers.length;c++) tr.push('');
    tr[0]='รวมทั้งเดือน'; tr[totalCol-1]=Math.round(tot*100)/100;
    sh.getRange(2+n,1,1,headers.length).setValues([tr]).setBackground('#ECE6DA').setFontWeight('bold');
    sh.getRange(2,totalCol,n+1,1).setNumberFormat('#,##0.00');
  }
  for (var w=0;w<widths.length;w++) sh.setColumnWidth(w+1, widths[w]);
  sh.setFrozenRows(1);
  return sh;
}

// สร้าง .xlsx รายงานเดือน ym + ส่งเมล สนง.บัญชี
function emailMonthlyBankReport(ym) {
  var tmpId = null;
  try {
    ym = ym || reportPrevMonth_();
    var cfg = getConfig();
    var to = String(cfg.ACCT_EMAIL || '').trim();
    if (!to) return { ok:false, msg:'ยังไม่ได้ตั้ง ACCT_EMAIL ใน CONFIG (อีเมลสำนักงานบัญชี)' };
    var ccUser = Session.getActiveUser().getEmail();
    var data = buildBankReportData_(ym), S = data.sums;

    var tmp = SpreadsheetApp.create('TMP_BANK_REPORT_' + ym); tmpId = tmp.getId();

    // แท็บสรุป (กรอบ)
    var sum = tmp.getSheets()[0]; sum.setName('สรุป');
    sum.setColumnWidth(1,32); sum.setColumnWidth(2,20);
    var sr = [
      ['สรุปการเคลื่อนไหวธนาคาร — ' + thaiMonth_(ym), ''],
      ['ห้างหุ้นส่วนจำกัด เคแอลเอช', ''],
      ['', ''],
      ['💰 รายรับ', ''],
      ['กรุงไทย เข้า (ยอดขาย)', S.k_in],
      ['กรุงศรี PromptPay เข้า (ขาย)', S.b_pp],
      ['รวมฐานยอดขายรับเข้า', S.k_in + S.b_pp],
      ['', ''],
      ['🔁 โยกเงินระหว่างบัญชี', ''],
      ['กรุงไทย → ออมทรัพย์', S.k_out],
      ['ออมทรัพย์ → กระแส', S.b_out],
      ['', ''],
      ['💸 จ่ายจากกระแสรายวัน', ''],
      ['ชำระเจ้าหนี้', S.pay],
      ['ค่าใช้จ่าย', S.exp],
      ['', ''],
      ['🏦 ยอดรวมแต่ละช่อง', ''],
      ['กรุงไทย เข้า', S.k_in],
      ['กรุงไทย ออก', S.k_out],
      ['ออมทรัพย์ รับขาย', S.b_pp],
      ['ออมทรัพย์ รับโอน', S.b_tf],
      ['ออมทรัพย์ ออก', S.b_out],
      ['กระแส รับโอน', S.bc_in],
      ['กระแส จ่ายรวม', S.pay + S.exp]
    ];
    sum.getRange(1,1,sr.length,2).setValues(sr);
    sum.getRange(1,1).setFontSize(14).setFontWeight('bold').setFontColor('#1A237E');
    sum.getRange(2,1).setFontColor('#888888');
    [4,9,13,17].forEach(function(r){ sum.getRange(r,1,1,2).setBackground('#37474F').setFontColor('#ffffff').setFontWeight('bold'); });
    sum.getRange(2,2,sr.length,1).setNumberFormat('#,##0.00');

    rptTab_(tmp,'กรุงไทยเข้า(รายวัน)',['วันที่','จำนวนรายการ','ยอดเข้ารวม'],[110,90,120],data.ktbDaily,3);
    rptTab_(tmp,'กรุงไทยออก',['วันที่','จำนวนเงิน','ประเภท','รายละเอียด'],[90,110,90,360],data.ktbOut,2);
    rptTab_(tmp,'ออมทรัพย์รับขาย',['วันที่','จำนวนเงิน','รายละเอียด'],[90,110,360],data.baySale,2);
    rptTab_(tmp,'ออมทรัพย์จ่ายอื่น',['วันที่','จำนวนเงิน','ผังบัญชี','หมวด'],[90,110,160,90],data.bayPay,2);
    rptTab_(tmp,'โอนระหว่างบัญชี',['วันที่','รายการ','จำนวนเงิน'],[90,280,120],data.transfers,3);
    rptTab_(tmp,'กระแสจ่ายเจ้าหนี้',['วันที่','จำนวนเงิน'],[110,130],data.pay,2);
    rptTab_(tmp,'กระแสค่าใช้จ่าย',['วันที่','จำนวนเงิน','ผังบัญชี','หมวด'],[90,110,160,90],data.exp,2);
    SpreadsheetApp.flush();

    var url = 'https://docs.google.com/spreadsheets/d/' + tmpId + '/export?format=xlsx';
    var blob = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } })
                 .getBlob().setName('รายงานธนาคาร_KLH_' + ym + '.xlsx');
    var mn = thaiMonth_(ym);
    GmailApp.sendEmail(to, 'รายงานการเคลื่อนไหวธนาคาร KLH — ' + mn,
      'เรียน สำนักงานบัญชี\n\nแนบรายงานการเคลื่อนไหวบัญชีธนาคาร หจก. เคแอลเอช ประจำเดือน ' + mn + '\n'
      + '· กรุงไทย เข้า (รายวัน)\n· กรุงศรีออมทรัพย์ / กระแสรายวัน (รายรายการ)\n\n(ระบบส่งอัตโนมัติ — หากต้องการข้อมูลเพิ่มแจ้งได้)',
      { attachments: [blob], cc: ccUser, name: 'KLH ระบบบัญชี' });

    return { ok:true, msg:'ส่งรายงาน ' + ym + ' → ' + to + ' (cc ' + ccUser + ') เรียบร้อย' };
  } catch(e){ return { ok:false, msg:String(e) }; }
  finally { if (tmpId){ try { DriveApp.getFileById(tmpId).setTrashed(true); } catch(e2){} } }
}

// trigger รายเดือน วันที่ 2 ~07:00 → ส่งรายงานเดือนก่อนหน้า
function monthlyBankReportJob() { emailMonthlyBankReport(); }
function setupMonthlyReportTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction()==='monthlyBankReportJob') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('monthlyBankReportJob').timeBased().onMonthDay(2).atHour(7).create();
  return 'ตั้ง trigger ส่งรายงานธนาคาร วันที่ 2 ของเดือน ~07:00 แล้ว';
}

// ── แจ้งเตือนหน้า Dashboard (รวมศูนย์ — เพิ่มรายการอื่นได้ภายหลัง) ──
function getDashboardReminders() {
  try {
    var out = [];
    var now = new Date();
    var y  = Number(Utilities.formatDate(now,'Asia/Bangkok','yyyy'));
    var mo = Number(Utilities.formatDate(now,'Asia/Bangkok','MM'));
    // 1) ดอกเบี้ยฝากประจำ — เข้า 9 เม.ย. ทุกปี · เตือน เม.ย.–มิ.ย. ถ้ายังไม่ลงบัญชีปีนี้
    if (mo >= 4 && mo <= 6) {
      var booked = false;
      var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName('BANK_TRANSACTIONS');
      if (s && s.getLastRow() > 1) {
        var rows = s.getRange(2,1,s.getLastRow()-1,3).getValues();
        for (var i=0;i<rows.length;i++){
          var d = rows[i][0] instanceof Date ? Utilities.formatDate(rows[i][0],'Asia/Bangkok','yyyy-MM') : String(rows[i][0]||'').slice(0,7);
          if (String(rows[i][1]).toUpperCase()==='BAYF' && String(rows[i][2])==='IN' && d===(y+'-04')){ booked = true; break; }
        }
      }
      if (!booked) out.push({
        level:'warn', icon:'🏦',
        title:'ดอกเบี้ยฝากประจำ ' + y + ' ยังไม่ลงบัญชี',
        text:'ดอกเบี้ยเข้า 9 เม.ย. — นำเข้า statement ฝากประจำ (.xls) ลงโฟลเดอร์ "ฝากประจำ" แล้วรัน bookFdInterest() เพื่อลงดอกเบี้ยรับ + ภาษีหัก ณ ที่จ่าย 1%',
        page:'bank'
      });
    }
    return { ok:true, items:out };
  } catch(e){ return { ok:false, msg:String(e), items:[] }; }
}

// ── ลงบัญชีดอกเบี้ยฝากประจำ (BAYF) + ภาษีหัก ณ ที่จ่าย 1% ──
//  ดอกเบี้ยรับ (code IN) → OTHER/ดอกเบี้ยรับ = รายได้อื่น เข้า P&L
//  ภาษีหัก 1% (code TX, OUT ≈1% ของดอกเบี้ยใกล้วัน) → WHT/ภาษีถูกหัก ณ ที่จ่าย = สินทรัพย์ ไม่เข้า P&L
//  รันใน editor หลังนำเข้า statement ฝากประจำ — idempotent
function bookFdInterest() {
  try {
    coaEnsure_('4210','ดอกเบี้ยรับ','รายได้');
    coaEnsure_('1180','ภาษีถูกหัก ณ ที่จ่าย','สินทรัพย์');
    var s = bankSheet_(); var last = s.getLastRow();
    if (last < 2) return 'ยังไม่มีรายการในสมุดธนาคาร';
    var rows = s.getRange(2,1,last-1,16).getValues();
    function dstr(v){ return v instanceof Date ? Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd') : String(v||'').slice(0,10); }
    var ins = [];   // ดอกเบี้ยที่เข้า BAYF (ไว้เทียบหา WHT)
    for (var i=0;i<rows.length;i++){
      if (String(rows[i][1]).toUpperCase()==='BAYF' && String(rows[i][2])==='IN')
        ins.push({ date:dstr(rows[i][0]), amt:Number(rows[i][3])||0 });
    }
    var nInt=0, nWht=0;
    for (var j=0;j<rows.length;j++){
      if (String(rows[j][1]).toUpperCase()!=='BAYF') continue;
      var row = j+2;
      if (String(rows[j][2])==='IN'){
        if (String(rows[j][4])!=='OTHER') s.getRange(row,5).setValue('OTHER');
        if (!String(rows[j][9]||'')) s.getRange(row,10).setValue('ดอกเบี้ยรับ');
        nInt++;
      } else if (String(rows[j][2])==='OUT'){
        var amt=Number(rows[j][3])||0, d=dstr(rows[j][0]), isWht=false;
        for (var k=0;k<ins.length;k++){
          var dd=Math.abs((new Date(d)-new Date(ins[k].date))/86400000);
          if (dd<=3 && Math.abs(amt - ins[k].amt*0.01) < 0.5){ isWht=true; break; }
        }
        if (isWht){ s.getRange(row,5).setValue('WHT'); s.getRange(row,10).setValue('ภาษีถูกหัก ณ ที่จ่าย'); nWht++; }
      }
    }
    backfillAccountNumbers();
    if (nInt===0) return 'ยังไม่พบรายการบัญชีฝากประจำ (BAYF) — นำเข้า statement ฝากประจำ (.xls) ก่อน แล้วรันใหม่';
    return 'ลงบัญชีฝากประจำเรียบร้อย: ดอกเบี้ยรับ '+nInt+' รายการ · ภาษีหัก ณ ที่จ่าย 1% '+nWht+' รายการ';
  } catch(e){ return 'ERROR: '+e; }
}

// ดึงผังบัญชี (เฉพาะที่ ACTIVE) → ใช้ในหน้า bank dropdown
function getChartOfAccounts() {
  try {
    var s = chartSheet_();
    var out = [];
    if (s.getLastRow() > 1) {
      s.getDataRange().getValues().slice(1).forEach(function(r) {
        if (r[3] === false || r[3] === 'FALSE') return;
        var nm = String(r[1] || '').trim();
        if (!nm) return;
        out.push({ code: String(r[0] || ''), name: nm, type: String(r[2] || '') });
      });
    }
    return { ok: true, accounts: out };
  } catch(e) { return { ok: false, msg: e.toString(), accounts: [] }; }
}

// map ชื่อผัง → ประเภท (ใช้แยกค่าใช้จ่ายจริง vs หนี้สิน ในงบ P&L)
function chartTypeMap_() {
  var m = {};
  try {
    chartSheet_().getDataRange().getValues().slice(1).forEach(function(r) {
      var nm = String(r[1] || '').trim();
      if (nm) m[nm] = String(r[2] || '');
    });
  } catch(e) {}
  return m;
}

// ดึงยอดเงินจากข้อความ (รองรับ "จำนวนเงิน 1,234.56 บาท" / "THB 1,234.56" / "1,234.56 บาท")
function extractAmount_(text) {
  var m = String(text).match(/(?:จำนวนเงิน|ยอดเงิน|amount|THB|฿)[^0-9]{0,12}([0-9,]+\.?[0-9]{0,2})/i)
       || String(text).match(/([0-9][0-9,]{2,})\.([0-9]{2})\s*(?:บาท|THB)/i);
  if (!m) return 0;
  var s = m[2] !== undefined ? (m[1] + '.' + m[2]) : m[1];
  return parseFloat(String(s).replace(/,/g, '')) || 0;
}

function isIncoming_(text) {
  var t = String(text);
  if (/(เงินเข้า|รับโอน|รับเงิน|ได้รับ|credit|deposit|incoming)/i.test(t)) return true;
  if (/(เงินออก|โอนออก|ถอน|ชำระ|จ่าย|debit|withdraw|outgoing)/i.test(t)) return false;
  return true; // อีเมลแจ้งเตือนส่วนใหญ่เป็นเงินเข้า
}

// อ่านอีเมลธนาคารย้อนหลัง N วัน → เขียน BANK_TRANSACTIONS (กันซ้ำด้วย MSG_ID)
// opts (ไม่บังคับ): { since:'yyyy/MM/dd', before:'yyyy/MM/dd', ktbOnly:true }
// ใช้ดึงย้อนหลังเป็นช่วงเวลา เช่น ดึง KTB เดือน พ.ค. โดยไม่แตะกรุงศรี
function fetchBankEmails(daysBack, opts) {
  try {
    opts = opts || {};
    daysBack = Number(daysBack) || 3;
    var cfg = getConfig();
    var ktbFrom = String(cfg.BANK_EMAIL_KTB || 'krungthai.com').trim();
    var bayFrom = String(cfg.BANK_EMAIL_BAY || 'krungsri.com').trim();
    var s = bankSheet_();

    // msg ids ที่บันทึกแล้ว (กันซ้ำ)
    var seen = {};
    if (s.getLastRow() > 1) {
      s.getRange(2, 8, s.getLastRow()-1, 1).getValues().forEach(function(r){ if (r[0]) seen[String(r[0])] = 1; });
    }

    var since = opts.since || Utilities.formatDate(new Date(Date.now() - daysBack*86400000), 'Asia/Bangkok', 'yyyy/MM/dd');
    var range = ' after:' + since + (opts.before ? ' before:' + opts.before : '');
    var added = 0, skipped = 0;

    // ── กรุงไทย: ใช้ "ไฟล์ statement แนบ (MT940 ใน ZIP)" เป็นแหล่งหลัก ──
    // อีเมลข้อความใช้เฉพาะ "โอนไปกรุงศรี" → บันทึกฝั่ง BAY IN (TRANSFER)
    GmailApp.search('from:' + ktbFrom + range, 0, 50).forEach(function(th) {
      th.getMessages().forEach(function(msg) {
        var id = msg.getId();
        if (seen[id]) { skipped++; return; }
        var subject = msg.getSubject() || '';
        var body = '';
        try { body = msg.getPlainBody().slice(0, 4000); } catch(e) {}

        // 1) ไฟล์แนบ statement (.zip → .txt MT940 หรือ .txt ตรงๆ)
        var gotStmt = 0;
        try {
          msg.getAttachments().forEach(function(att) {
            var nm = att.getName();
            if (/\.zip$/i.test(nm)) {
              // ไฟล์แนบธนาคารมักส่ง content-type ผิด → บังคับเป็น zip ก่อนแกะ
              var zb = att.copyBlob().setContentType('application/zip');
              Utilities.unzip(zb).forEach(function(b) {
                gotStmt += parseMt940_(b.getDataAsString('UTF-8'), s, seen);
              });
            } else if (/\.txt$/i.test(nm)) {
              gotStmt += parseMt940_(att.getDataAsString('UTF-8'), s, seen);
            }
          });
        } catch(eA) { Logger.log('attachment: ' + eA); }
        if (gotStmt > 0) { seen[id] = 1; added += gotStmt; return; }

        // 2) อีเมลแจ้งโอน KTB→กรุงศรี (เงิน "ออก" จาก KTB ไม่ใช่เงินเข้า)
        if (/ไปยังเลขที่บัญชี:\s*กรุงศรี/.test(body) || /credited[\s\S]{0,120}krungsri/i.test(body)) {
          var amtT = extractAmount_(body);
          if (amtT > 0) {
            var dT = Utilities.formatDate(msg.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd');
            // บันทึกฝั่ง BAY IN = โยกเงิน (ฝั่ง KTB OUT จะมาจาก statement เอง)
            s.appendRow([dT, 'BAY', 'IN', amtT, 'TRANSFER', 'โยกเงินจาก KTB (อีเมลแจ้งโอน)',
                         Utilities.formatDate(msg.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), id, '', '']);
            seen[id] = 1; added++;
          }
          return;
        }
        // อีเมลกรุงไทยอื่นๆ (แจ้งเงินเข้า ฯลฯ) ข้าม — statement ครอบคลุมแล้ว กันยอดซ้ำ
      });
    });

    // ── กรุงศรี: อีเมล = PromptPay ลูกค้าเข้า (ยอดขาย + เตือน 0.5%) ──
    if (!opts.ktbOnly) GmailApp.search('from:' + bayFrom + range, 0, 50).forEach(function(th) {
      th.getMessages().forEach(function(msg) {
        var id = msg.getId();
        if (seen[id]) { skipped++; return; }
        var subject = msg.getSubject() || '';
        var body = '';
        try { body = msg.getPlainBody().slice(0, 3000); } catch(e) {}
        var amt = extractAmount_(subject + '\n' + body);
        if (amt <= 0) return;
        s.appendRow([
          Utilities.formatDate(msg.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd'),
          'BAY', 'IN', amt, '', subject.slice(0, 120),
          Utilities.formatDate(msg.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'),
          id, '', ''
        ]);
        seen[id] = 1; added++;
      });
    });

    if (added > 0) {
      var alerts = categorizeBankTxns_();
      backfillAccountNumbers();
      if (alerts.length) sendWmsLine_('🔔 ตรวจอีเมลธนาคาร:\n' + alerts.slice(0, 10).join('\n――――\n'));
    }
    return { ok: true, added: added, skipped: skipped, msg: 'บันทึกใหม่ ' + added + ' รายการ (ซ้ำ ' + skipped + ')' };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── ดึง KTB จากอีเมลแบบกำหนดเดือน (long-term fix แทนการ decrypt .xls เอง) ──
// yyyymm เช่น '2026-05' → ค้นอีเมล KTB ตั้งแต่ต้นเดือน ถึงต้นเดือนถัดไป (เผื่อ statement ส่งต้นเดือนถัดไป)
// ktbOnly = true → ไม่แตะกรุงศรี (กันยอดที่ import จาก CSV แล้วซ้ำ)
function importKtbMonthFromEmail(yyyymm) {
  yyyymm = String(yyyymm || '').trim();
  var m = yyyymm.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return { ok: false, msg: 'รูปแบบเดือนไม่ถูก ต้องเป็น YYYY-MM เช่น 2026-05' };
  var y = Number(m[1]), mo = Number(m[2]);
  var since = m[1] + '/' + ('0' + mo).slice(-2) + '/01';
  var ny = mo === 12 ? y + 1 : y, nmo = mo === 12 ? 1 : mo + 1;
  var before = ny + '/' + ('0' + nmo).slice(-2) + '/08';   // ครอบอีเมล statement ที่ส่งต้นเดือนถัดไป (เผื่อถึงวันที่ 7)
  var r = fetchBankEmails(0, { since: since, before: before, ktbOnly: true });
  if (r && r.ok) r.msg = 'KTB เดือน ' + yyyymm + ': ' + r.msg + ' (ค้นเมล ' + since + ' ถึง ' + before + ')';
  return r;
}

// ── ดูเนื้อไฟล์ .txt ใน ZIP อีเมล KTB รายวัน (ยืนยันรูปแบบเพื่อ parse ให้ถูก) ──
// รันใน GAS Editor: debugKtbZip()  → ดู Logger หรือค่า return
function debugKtbZip() {
  var cfg = getConfig();
  var ktbFrom = String(cfg.BANK_EMAIL_KTB || 'krungthai.com').trim();
  var since = Utilities.formatDate(new Date(Date.now() - 7 * 86400000), 'Asia/Bangkok', 'yyyy/MM/dd');
  var out = [];
  GmailApp.search('from:' + ktbFrom + ' after:' + since, 0, 8).forEach(function(th) {
    th.getMessages().forEach(function(m) {
      var subj = m.getSubject() || '';
      var dt = Utilities.formatDate(m.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd');
      m.getAttachments().forEach(function(att) {
        var nm = att.getName();
        if (!/\.zip$/i.test(nm)) { out.push('• ' + dt + ' [' + subj.slice(0, 40) + '] ATT(ไม่ใช่ zip): ' + nm); return; }
        try {
          Utilities.unzip(att.copyBlob().setContentType('application/zip')).forEach(function(b) {
            var fn = b.getName(), bytes = b.getBytes().length, head = '';
            try { head = b.getDataAsString('UTF-8').slice(0, 1200); } catch(e) { head = '[อ่านเป็นข้อความไม่ได้ = อาจเข้ารหัส] ' + e; }
            out.push('• ' + dt + ' ZIP=' + nm + '\n   ไฟล์ใน: ' + fn + ' (' + bytes + ' bytes)\n   ── เนื้อหา 1200 ตัวแรก ──\n' + head + '\n════════');
          });
        } catch(e) { out.push('• ' + dt + ' unzip ' + nm + ' พัง: ' + e); }
      });
    });
  });
  var msg = out.length ? out.join('\n\n') : 'ไม่พบอีเมล KTB ใน 7 วัน';
  Logger.log(msg);
  return msg;
}

// ── ดู trigger ที่ติดตั้งแล้ว (เช็คว่ารายงาน 08:00 / สแกนโฟลเดอร์ 23:00 ตั้งไว้หรือยัง) ──
// รันใน GAS Editor: listTriggers()
function listTriggers() {
  var ts = ScriptApp.getProjectTriggers();
  if (!ts.length) return '⚠️ ยังไม่มี trigger เลย — ต้องรัน setupDailyStatementTrigger() + setupDailySalesTrigger() + setupWeeklyTaxTrigger() ครั้งเดียว';
  var cnt = {};
  ts.forEach(function(t){ var h = t.getHandlerFunction(); cnt[h] = (cnt[h]||0) + 1; });
  var want = {
    dailySalesReport: 'รายงานยอดขาย LINE 08:00',
    importBayStatements: 'สแกนโฟลเดอร์ statement 23:00',
    checkWeeklySalesTarget: 'เช็คเป้ายอดขาย อาทิตย์ 19:00',
    dailyBankJob: 'สรุปยอดธนาคาร LINE 06:00'
  };
  var out = ['📋 Trigger ที่ติดตั้ง (' + ts.length + '):'];
  Object.keys(cnt).forEach(function(h){ out.push('  ✅ ' + h + (want[h]?' — '+want[h]:'') + (cnt[h]>1?' ('+cnt[h]+' ตัว!)':'')); });
  Object.keys(want).forEach(function(h){ if (!cnt[h]) out.push('  ❌ ขาด: ' + h + ' — ' + want[h]); });
  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}

// ── เช็คแถวซ้ำในสมุดธนาคาร (ดู KTB เดือนหนึ่งๆ ว่ามีคีย์ซ้ำไหม) ──
// รันใน Editor: checkBankDup('2026-05')
function checkBankDup(yyyymm) {
  var s = bankSheet_();
  if (s.getLastRow() <= 1) return 'ไม่มีข้อมูล';
  var rows = s.getRange(2, 1, s.getLastRow() - 1, H_BANK.length).getValues();
  var byKey = {}, total = 0, dups = [];
  var sumByBank = {};
  rows.forEach(function(r) {
    var rd = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]).slice(0, 10);
    if (yyyymm && rd.slice(0, 7) !== yyyymm) return;
    total++;
    var bk = String(r[1]) + ' ' + String(r[2]);
    sumByBank[bk] = (sumByBank[bk] || 0) + Number(r[3] || 0);
    var k = String(r[7] || (rd + r[1] + r[2] + r[3]));
    byKey[k] = (byKey[k] || 0) + 1;
    if (byKey[k] === 2) dups.push(k);
  });
  var msg = '📊 เดือน ' + (yyyymm || 'ทั้งหมด') + ': ' + total + ' แถว · คีย์ซ้ำ ' + dups.length + ' รายการ';
  Object.keys(sumByBank).sort().forEach(function(b){ msg += '\n  ' + b + ' = ' + sumByBank[b].toLocaleString(); });
  if (dups.length) msg += '\n⚠️ คีย์ซ้ำ: ' + dups.slice(0, 8).join(', ');
  else msg += '\n✅ ไม่มีซ้ำ';
  Logger.log(msg);
  return msg;
}

// ── ปรับปรุงประกันสังคม: แยกครึ่งเป็นค่าใช้จ่าย(นายจ้าง) + ครึ่งเป็นหนี้สิน(หักพนักงานนำส่ง) ──
// เงินที่จ่าย สนง.ประกันสังคม = ส่วนนายจ้าง 50% (ค่าใช้จ่าย 5311) + ส่วนพนักงานที่หักไว้ 50% (หนี้สิน 2210)
// เรียกจากปุ่มในหน้า bank · ทำซ้ำได้ (ข้ามรายการที่แยกแล้ว)
function adjustSocialSecurity(yyyymm) {
  var s = bankSheet_();
  if (s.getLastRow() <= 1) return { ok: false, msg: 'ไม่มีข้อมูล' };
  var W = H_BANK.length;
  var rng = s.getRange(2, 1, s.getLastRow() - 1, W);
  var rows = rng.getValues();
  var add = [], n = 0, total = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var date = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]).slice(0, 10);
    if (yyyymm && date.slice(0, 7) !== yyyymm) continue;
    if (String(r[2]) !== 'OUT') continue;                         // เฉพาะเงินจ่ายออก
    var subj = String(r[5] || ''), note = String(r[8] || '');
    if (!/SOCIAL SECURITY|ประกันสังคม|SSO/i.test(subj)) continue;  // เฉพาะรายการประกันสังคม
    if (/แยกประกันสังคม/.test(note)) continue;                     // แยกไปแล้ว — ข้าม
    var amt = Number(r[3]) || 0;
    if (amt <= 0) continue;
    var emp = Math.round(amt / 2 * 100) / 100;                     // ครึ่งพนักงาน (หนี้สิน)
    var owner = Math.round((amt - emp) * 100) / 100;               // ครึ่งนายจ้าง (ค่าใช้จ่าย) — กันเศษ
    // แก้แถวเดิม → ครึ่งนายจ้าง เป็นค่าใช้จ่าย
    r[3] = owner; r[4] = 'EXPENSE';
    r[8] = (note ? note + ' · ' : '') + 'แยกประกันสังคม(นายจ้าง)';
    r[9] = 'ประกันสังคม (นายจ้าง)';
    // แถวใหม่ → ครึ่งพนักงาน เป็นหนี้สินนำส่ง (ไม่เข้างบกำไรขาดทุน)
    add.push([r[0], r[1], 'OUT', emp, 'LIABILITY', subj, r[6], String(r[7]) + '-SS2',
              'แยกประกันสังคม(พนักงาน) นำส่งหนี้สิน', 'เงินหักประกันสังคมพนักงาน']);
    n++; total += amt;
  }
  if (!n) return { ok: true, n: 0, msg: 'ไม่พบรายการประกันสังคมที่ยังไม่ได้แยก (หรือแยกครบแล้ว)' };
  rng.setValues(rows);
  s.getRange(s.getLastRow() + 1, 1, add.length, W).setValues(add);
  return { ok: true, n: n, msg: 'แยกประกันสังคม ' + n + ' รายการ (รวม ฿' + total.toLocaleString() + ') → ครึ่งค่าใช้จ่าย + ครึ่งหนี้สิน' };
}

// ── จัดประเภทตามผังเงิน 5 ข้อ + คืนรายการที่ต้องเตือน ──────────────
// 1) KTB IN = ยอดขาย KLH ทั้งหมด
// 2) KTB OUT จับคู่ BAY IN (statement) = โยกเงิน · ไม่ตรง = ค่าใช้จ่ายธนาคาร (เตือน)
// 3) BAY IN จากอีเมล = PromptPay ลูกค้า = SALE (โดนค่าธรรมเนียม 0.5% → เตือนตามตัวลูกค้า)
//    BAY OUT จับคู่ BAYC IN = โยกเงินภายใน · ไม่ตรง = ค่าใช้จ่าย เช่น ค่าน้ำ (เตือน)
// 4) BAYC IN จับคู่ BAY OUT = โยกเงิน · BAYC OUT ที่เหลือ = ชำระหนี้/ค่าใช้จ่าย (ต้องระบุ)
// KTB เงินเข้า: ลูกค้าโอน/PromptPay/เงินโอนเข้า = ขาย · ค่าธรรมเนียมคืน/ปรับปรุง(ADJ)/ดอกเบี้ย = รายได้อื่น
function ktbInCat_(desc) {
  return /\bADJ\b|BPGS|\bBSD\d|ดอกเบี้ย|interest|คืนค่าธรรมเนียม|fee\s*refund/i.test(String(desc || '')) ? 'OTHER' : 'SALE';
}

// โอนเงินระหว่างบัญชีตัวเอง? ดูจากรายละเอียด (ไม่ต้องจับคู่ยอด/วัน)
//  • IORSWT = กรุงไทยโอนออก ORFT ไปบัญชีตัวเอง
//  • "K L H"/"KLH" = ชื่อบัญชีตัวเอง (รับโอน/โอน ... K L H)
//  • เลขบัญชีตัวเอง (กรุงไทย/กรุงศรี) ปรากฏใน desc
function isOwnTransferDesc_(desc) {
  var t = String(desc || '');
  if (/IORSWT/i.test(t)) return true;
  if (/K\s*L\s*H/i.test(t)) return true;
  if (/รับโอนเงิน BAY K L H|โอนเงิน BAY K L H/.test(t)) return true;
  var dg = t.replace(/[^0-9]/g, '');
  for (var k in BANK_ACCOUNTS) { if (BANK_ACCOUNTS[k].digits && dg.indexOf(BANK_ACCOUNTS[k].digits) >= 0) return true; }
  return false;
}

function categorizeBankTxns_() {
  var s = bankSheet_();
  if (s.getLastRow() <= 1) return [];
  var rows = s.getDataRange().getValues();
  var alerts = [];

  function nd_(v){ return v instanceof Date ? Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd') : String(v||'').slice(0,10); }
  function matched(date, bank, dir, amt) {
    for (var j = 1; j < rows.length; j++) {
      if (nd_(rows[j][0]) === date && rows[j][1] === bank && rows[j][2] === dir
          && Math.abs(Number(rows[j][3]) - amt) < 1) return true;
    }
    return false;
  }

  // ── อัปเกรดรายการ "โอนระหว่างบัญชีตัวเอง" → TRANSFER จาก desc (แม้จัดหมวดผิดไปแล้ว) ──
  //    กันเฉพาะที่ยังเป็นค่าเริ่มต้นอัตโนมัติ (ว่าง/EXPENSE/UNKNOWN) — ไม่ทับที่ user ตั้งใจระบุ
  for (var u = 1; u < rows.length; u++) {
    var cu = String(rows[u][4] || '');
    if (cu !== 'TRANSFER' && (cu === '' || cu === 'EXPENSE' || cu === 'UNKNOWN') && isOwnTransferDesc_(rows[u][5])) {
      rows[u][4] = 'TRANSFER';
      s.getRange(u + 1, 5).setValue('TRANSFER');
    }
  }

  // จัดหมวด KTB เงินเข้าใหม่ตามรหัสธุรกรรม: ลูกค้าโอน/PromptPay = ขาย · ค่าธรรมเนียมคืน/ปรับปรุง/ดอกเบี้ย = รายได้อื่น
  for (var z = 1; z < rows.length; z++) {
    if (rows[z][1] === 'KTB' && rows[z][2] === 'IN' && rows[z][4] !== 'TRANSFER'
        && (rows[z][4] === 'SALE' || rows[z][4] === 'OTHER' || !rows[z][4])) {
      var want = ktbInCat_(rows[z][5]);
      if (rows[z][4] !== want) {
        rows[z][4] = want;
        s.getRange(z+1, 5).setValue(want);
        if (want === 'OTHER' && !rows[z][8]) alerts.push('💡 กรุงไทยเงินเข้า ฿' + Number(rows[z][3]).toLocaleString() + ' (' + String(rows[z][0]).slice(0,10) + ') = ค่าธรรมเนียม/ปรับปรุง → ตั้งเป็น "รายได้อื่น/เงินคืน" (ไม่ใช่ยอดขาย)');
      }
    }
  }

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][4]) continue;   // จัดประเภทแล้ว
    var date = nd_(rows[i][0]), bank = rows[i][1], dir = rows[i][2], amt = Number(rows[i][3]);
    var subj = String(rows[i][5] || ''), src = String(rows[i][7] || '');
    var fromEmail = src.indexOf('MANUAL') < 0 && src.indexOf('STMT') < 0;
    var cat = '';

    if (bank === 'KTB') {
      if (dir === 'IN') cat = 'SALE';                                   // ข้อ 1
      else {                                                            // ข้อ 2 — โอนระหว่างบัญชีตัวเอง: เดาจาก desc ก่อน (IORSWT/KLH/เลขบัญชี) ไม่งั้นจับคู่ยอด
        if (isOwnTransferDesc_(subj) || matched(date, 'BAY', 'IN', amt)) cat = 'TRANSFER';
        else { cat = 'EXPENSE';
          alerts.push('🟦 KTB เงินออก ฿' + amt.toLocaleString() + ' (' + date + ') ไม่ใช่โอนเข้ากรุงศรี → น่าจะค่าธรรมเนียม/ค่าบัญชี — เช็คในสมุดเงินธนาคาร'); }
      }
    } else if (bank === 'BAY') {
      if (dir === 'IN') {
        if (fromEmail || /promptpay|พร้อมเพย์/i.test(subj)) {           // ข้อ 3 อีเมล = PromptPay ลูกค้า
          cat = 'SALE';
          alerts.push('🟧 ลูกค้าโอน PromptPay เข้า กรุงศรี ฿' + amt.toLocaleString() + ' (' + date + ')\n→ เสียค่าธรรมเนียม 0.5% ≈ ฿' + (amt*0.005).toFixed(2) + ' — หาว่าลูกค้ารายไหน แจ้งให้โอนเข้า กรุงไทย แทน');
        } else if (matched(date, 'KTB', 'OUT', amt)) cat = 'TRANSFER';
        else { cat = 'UNKNOWN';
          alerts.push('🟧 กรุงศรีออมทรัพย์ เงินเข้า ฿' + amt.toLocaleString() + ' (' + date + ') ไม่ตรงโยกเงิน — ลูกค้าโอน? ไประบุในสมุดเงินธนาคาร'); }
      } else {                                                          // BAY OUT
        if (matched(date, 'BAYC', 'IN', amt)) cat = 'TRANSFER';
        else { cat = 'EXPENSE';
          alerts.push('🟧 กรุงศรีออมทรัพย์ เงินออก ฿' + amt.toLocaleString() + ' (' + date + ') ไม่ตรงเข้ากระแสรายวัน — ค่าน้ำประปา/ค่าใช้จ่ายอื่น? ไประบุผังบัญชี'); }
      }
    } else if (bank === 'BAYC') {                                       // ข้อ 4
      if (dir === 'IN') {
        if (matched(date, 'BAY', 'OUT', amt)) cat = 'TRANSFER';
        else cat = 'UNKNOWN';
      } else { cat = 'PAYMENT';
        if (!String(rows[i][8] || '')) alerts.push('🟥 กรุงศรีกระแสฯ จ่ายออก ฿' + amt.toLocaleString() + ' (' + date + ') — ระบุว่าชำระหนี้ใคร/ค่าอะไร + ผังบัญชี ในสมุดเงินธนาคาร'); }
    } else {
      cat = dir === 'IN' ? 'SALE' : 'PAYMENT';
    }
    s.getRange(i+1, 5).setValue(cat);
  }
  return alerts;
}

// ════════════════════════════════════════════════════════════
//  นำเข้า statement กรุงศรี (ออมทรัพย์/กระแสรายวัน) จากโฟลเดอร์ Drive
//  รองรับ .csv / .xlsx / Google Sheet · สแกนทุกคืน 23:00 อัตโนมัติ
//  วางไฟล์ในโฟลเดอร์ "BANK_STATEMENTS" (ระบบสร้างให้ + ย้ายไป "นำเข้าแล้ว" เมื่อเสร็จ)
//  ชื่อไฟล์มีคำว่า "กระแส" หรือ "current" หรือ "BAYC" = บัญชีกระแสรายวัน, อื่นๆ = ออมทรัพย์
// ════════════════════════════════════════════════════════════
function stmtFolder_() {
  var cfg = getConfig();
  if (cfg.STATEMENT_FOLDER_ID) { try { return DriveApp.getFolderById(String(cfg.STATEMENT_FOLDER_ID).trim()); } catch(e) {} }
  var it = DriveApp.getFoldersByName('BANK_STATEMENTS');
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder('BANK_STATEMENTS');
}

// ประมวลผลไฟล์ statement หนึ่งไฟล์ — forceBank (ถ้ามี) = บัญชีที่ระบุจากโฟลเดอร์/ผู้ใช้ (ไม่เดา)
function processStmtFile_(f, forceBank, s, seen, ctx) {
  var name = f.getName();
  var grid = null, tempId = null;
  try {
    var mime = f.getMimeType();
    if (/\.zip$/i.test(name)) {
      var n0 = 0;
      Utilities.unzip(f.getBlob().setContentType('application/zip')).forEach(function(b) {
        n0 += parseMt940_(b.getDataAsString('UTF-8'), s, seen);
      });
      ctx.imported += n0; ctx.fileCount++; f.moveTo(ctx.done); return;
    }
    if (/\.txt$/i.test(name)) {
      ctx.imported += parseMt940_(f.getBlob().getDataAsString('UTF-8'), s, seen);
      ctx.fileCount++; f.moveTo(ctx.done); return;
    }
    if (mime === MimeType.CSV || /\.csv$/i.test(name)) {
      grid = Utilities.parseCsv(f.getBlob().getDataAsString('UTF-8').replace(/^﻿/, ''));  // ตัด BOM
    } else if (mime === MimeType.GOOGLE_SHEETS) {
      grid = SpreadsheetApp.openById(f.getId()).getSheets()[0].getDataRange().getValues();
    } else if (/\.xlsx?$/i.test(name) || mime === MimeType.MICROSOFT_EXCEL) {
      var conv = Drive.Files.create({ name: 'tmp_stmt', mimeType: 'application/vnd.google-apps.spreadsheet' }, f.getBlob());
      tempId = conv.id;
      grid = SpreadsheetApp.openById(tempId).getSheets()[0].getDataRange().getValues();
    } else { return; }

    var head = grid.slice(0, 12).map(function(r){ return (r||[]).join('|'); }).join('\n');
    // จับบัญชีแบบไม่เดา: 1) โฟลเดอร์ที่ผู้ใช้วาง 2) เลขบัญชีในหัวไฟล์ 3) ชื่อไฟล์
    var detected = forceBank || bankFromAccountDigits_(head + '|' + name) || bankFromFolderName_(name);

    var isKtb = (detected === 'KTB') || /Historical_SSKB|กรุงไทย/i.test(name) || /ถอนเงิน\/ฝากเงิน|ยอดคงเหลือยกมา/.test(head);
    var isKrungsri = /statement\s*inquiry|inquiry/i.test(name) || /B\/F/.test(head) || /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/.test(head);

    var n;
    if (isKtb) n = parseKtbStatementGrid_(grid, name, s, seen);
    else if (isKrungsri) n = parseKrungsriCsv_(grid, name, s, seen, ctx.alerts, detected || '');
    else n = parseStatementGrid_(grid, detected || 'BAY', name, s, seen);
    ctx.imported += n; ctx.fileCount++; f.moveTo(ctx.done);
  } catch(e) { ctx.errs.push(name + ': ' + e.message); }
  finally { if (tempId) { try { DriveApp.getFileById(tempId).setTrashed(true); } catch(e2) {} } }
}

function importBayStatements() {
  try {
    var folder = stmtFolder_();
    var doneIt = folder.getFoldersByName('นำเข้าแล้ว');
    var done = doneIt.hasNext() ? doneIt.next() : folder.createFolder('นำเข้าแล้ว');
    var s = bankSheet_();
    var seen = {};
    if (s.getLastRow() > 1) s.getRange(2, 8, s.getLastRow()-1, 1).getValues().forEach(function(r){ if (r[0]) seen[String(r[0])] = 1; });

    var ctx = { imported:0, fileCount:0, errs:[], alerts:[], done:done };

    // 1) ไฟล์ที่ราก BANK_STATEMENTS — จับบัญชีจากหัวไฟล์/ชื่อ
    var files = folder.getFiles();
    while (files.hasNext()) { processStmtFile_(files.next(), '', s, seen, ctx); }

    // 2) โฟลเดอร์ย่อยต่อบัญชี (กระแส/ออม/ฝากประจำ/กรุงไทย) — บังคับบัญชีตามโฟลเดอร์ (ไม่เดา)
    var subs = folder.getFolders();
    while (subs.hasNext()) {
      var sub = subs.next();
      if (sub.getName() === 'นำเข้าแล้ว') continue;
      var fb = bankFromFolderName_(sub.getName());
      if (!fb) continue;
      var subDoneIt = sub.getFoldersByName('นำเข้าแล้ว');
      var subDone = subDoneIt.hasNext() ? subDoneIt.next() : sub.createFolder('นำเข้าแล้ว');
      var subCtx = { imported:ctx.imported, fileCount:ctx.fileCount, errs:ctx.errs, alerts:ctx.alerts, done:subDone };
      var sf = sub.getFiles();
      while (sf.hasNext()) { processStmtFile_(sf.next(), fb, s, seen, subCtx); }
      ctx.imported = subCtx.imported; ctx.fileCount = subCtx.fileCount;
    }

    var imported = ctx.imported, fileCount = ctx.fileCount, errs = ctx.errs, alerts = ctx.alerts;
    if (imported > 0) { alerts = alerts.concat(categorizeBankTxns_()); backfillAccountNumbers(); }
    if (alerts.length) sendWmsLine_('🏦 ตรวจ statement ธนาคาร:\n' + alerts.slice(0, 10).join('\n――――\n')
      + (alerts.length > 10 ? '\n…และอีก ' + (alerts.length - 10) + ' รายการ (ดูในสมุดเงินธนาคาร)' : ''));
    return { ok: errs.length === 0, files: fileCount, imported: imported,
             msg: 'นำเข้า ' + fileCount + ' ไฟล์ / ' + imported + ' รายการ' + (errs.length ? ' · ผิดพลาด: ' + errs.join(' | ') : '') };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── MT940 (SWIFT) — รูปแบบ statement กรุงไทย Business ──────────────
// :25:เลขบัญชี → ระบุธนาคาร · :61:YYMMDD..C/D + ยอด(จุลภาค=ทศนิยม) · :86:คำอธิบาย
function parseMt940_(text, s, seen) {
  if (!text || text.indexOf(':61:') < 0) return 0;
  var cfg = {};
  try { cfg = getConfig(); } catch(e) {}
  // map เลขบัญชี → ธนาคาร (เพิ่มได้ใน CONFIG: ACCT_KTB / ACCT_BAY / ACCT_BAYC)
  var acctMap = {};
  acctMap[String(cfg.ACCT_KTB  || '3070404782').replace(/[^0-9]/g, '')] = 'KTB';
  if (cfg.ACCT_BAY)  acctMap[String(cfg.ACCT_BAY).replace(/[^0-9]/g, '')]  = 'BAY';
  if (cfg.ACCT_BAYC) acctMap[String(cfg.ACCT_BAYC).replace(/[^0-9]/g, '')] = 'BAYC';

  var lines = String(text).split(/\r?\n/);
  var bank = 'KTB';
  var count = 0;
  var cur = null;   // { date, dir, amt, ref, desc[] }

  function flush() {
    if (!cur) return;
    var key = 'STMT-' + bank + '-' + cur.date + '-' + cur.dir + '-' + cur.amt + '-' + cur.ref;
    if (!seen[key]) {
      var desc = cur.desc.join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);
      // จัดหมวด: เงินเข้าที่เป็น PromptPay/ORFT = ยอดขายลูกค้า · นอกนั้น (ADJ FEE/ดอกเบี้ย/เงินคืน) = รายได้อื่น
      var cat = '';
      if (cur.dir === 'IN') cat = ktbInCat_(desc);
      s.appendRow([cur.date, bank, cur.dir, cur.amt, cat, desc || ('MT940 ' + cur.ref),
                   Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), key, '', '']);
      seen[key] = 1; count++;
    }
    cur = null;
  }

  for (var i = 0; i < lines.length; i++) {
    var L = lines[i];
    var mAcc = L.match(/^:25:.*?(\d{6,})/);
    if (mAcc) { var an = mAcc[1].replace(/[^0-9]/g, ''); if (acctMap[an]) bank = acctMap[an]; continue; }
    var m61 = L.match(/^:61:(\d{2})(\d{2})(\d{2})\d{0,4}(C|D)(\d+,\d{2})\S*?(\S{0,16})$/);
    if (m61) {
      flush();
      cur = {
        date: '20' + m61[1] + '-' + m61[2] + '-' + m61[3],
        dir:  m61[4] === 'C' ? 'IN' : 'OUT',
        amt:  parseFloat(m61[5].replace(',', '.')) || 0,
        ref:  m61[6] || ('L' + i),
        desc: []
      };
      continue;
    }
    if (cur) {
      if (L.indexOf(':86:') === 0) { cur.desc.push(L.slice(4)); continue; }
      if (L.charAt(0) !== ':' && L.charAt(0) !== '-' && L.charAt(0) !== '{') { cur.desc.push(L); continue; }
      if (L.indexOf(':6') === 0 || L.indexOf('-}') === 0) flush();
    }
  }
  flush();
  return count;
}

// ── KTB statement (ถอดรหัสแล้ว xls/csv) — คอลัมน์รวม "ถอนเงิน/ฝากเงิน" + ยอดคงเหลือบอกทิศทาง ──
// header: วันที่/เวลา | รายการ(code) | รายละเอียด | หมายเลขเช็ค | ถอนเงิน/ฝากเงิน | ภาษี | ยอดคงเหลือ | ช่องทาง
// ทิศทาง: ยอดคงเหลือเพิ่ม = เข้า · ลด = ออก · PromptPay(MORPSD/NMPSDP/IORSDT) = ขาย · อื่น = รายได้อื่น
function parseKtbStatementGrid_(grid, fileName, s, seen) {
  var hRow = -1, cDate = 0, cCode = 1, cDetail = 2, cAmt = 4, cBal = 6;
  for (var i = 0; i < Math.min(grid.length, 20); i++) {
    var row = (grid[i] || []).map(function(x){ return String(x || ''); });
    if (row.some(function(c){ return /ยอดคงเหลือ/.test(c); }) && row.some(function(c){ return /วันที่/.test(c); })) {
      hRow = i;
      for (var j = 0; j < row.length; j++) {
        if (/วันที่/.test(row[j])) cDate = j;
        if (/ถอน|ฝาก/.test(row[j])) cAmt = j;
        if (/คงเหลือ/.test(row[j])) cBal = j;
        if (/รายละเอียด/.test(row[j])) cDetail = j;
        if (/^รายการ$/.test(row[j].trim())) cCode = j;
      }
      break;
    }
  }
  if (hRow < 0) return 0;

  var prev = null, count = 0, now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
  function num(v){ var n = parseFloat(String(v).replace(/[, ]/g, '')); return isNaN(n) ? null : n; }

  // ── pass 1: รวบรวมรายการใหม่ + หาช่วงวันที่ของ statement ──
  var rows = [], minD = null, maxD = null;
  for (var r = hRow + 1; r < grid.length; r++) {
    var cell = grid[r][cDate];
    var isDate = (cell instanceof Date) && !isNaN(cell);   // กรณี CSV ถูกแปลงเป็น Google Sheets แล้ววันที่กลายเป็น Date
    var dtRaw = String(cell || '').trim();
    var bal = num(grid[r][cBal]);
    if (!isDate && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dtRaw)) { if (bal !== null) prev = bal; continue; }  // B/F
    if (bal === null) continue;
    var amt = Math.abs(num(grid[r][cAmt]) || 0);
    var delta = (prev !== null) ? (bal - prev) : 0;
    var dir = delta > 0 ? 'IN' : (delta < 0 ? 'OUT' : (amt > 0 ? 'IN' : ''));
    if (!dir) { prev = bal; continue; }
    if (amt <= 0) amt = Math.abs(delta);
    var d = parseThaiDate_(cell);
    var detail = (String(grid[r][cCode] || '') + ' ' + String(grid[r][cDetail] || '')).replace(/\s+/g, ' ').trim().slice(0, 120);
    var cat = '';
    if (dir === 'IN') cat = ktbInCat_(detail);
    var key = 'STMT-KTB-' + d + '-' + dir + '-' + amt + '-' + bal;   // ยอดคงเหลือ = unique ต่อรายการ
    rows.push([d, 'KTB', dir, amt, cat, detail, now, key, '', '']);
    if (!minD || d < minD) minD = d;
    if (!maxD || d > maxD) maxD = d;
    prev = bal;
  }
  if (!rows.length || !minD) return 0;

  // ── authoritative replace แบบ batch (อ่าน-กรอง-เขียนครั้งเดียว: เร็ว + ไม่ row-range error + กันซ้ำ) ──
  var W = H_BANK.length;                                  // 10 คอลัมน์
  var lastRow = s.getLastRow();
  var existing = lastRow > 1 ? s.getRange(2, 1, lastRow - 1, W).getValues() : [];

  // เก็บทุกแถวที่ "ไม่ใช่ KTB ในช่วงวันที่นี้" (ลบ KTB ช่วงนี้ทิ้งทั้งหมด → กันซ้ำกับ email/รันซ้ำ)
  var kept = [], keptKeys = {};
  existing.forEach(function(r) {
    var rd = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]).slice(0, 10);
    if (String(r[1]) === 'KTB' && rd >= minD && rd <= maxD) return;   // ตัดทิ้ง จะใส่ใหม่จากไฟล์
    kept.push(r);
    if (r[7]) keptKeys[String(r[7])] = 1;
  });

  // dedup รายการใหม่ (กันคีย์ซ้ำในไฟล์เอง + ซ้ำกับแถวที่เก็บไว้)
  var fresh = [];
  rows.forEach(function(row) {
    if (keptKeys[row[7]]) return;
    keptKeys[row[7]] = 1; fresh.push(row); count++;
  });

  var out = kept.concat(fresh);
  if (lastRow > 1) s.getRange(2, 1, lastRow - 1, W).clearContent();
  if (out.length) s.getRange(2, 1, out.length, W).setValues(out);
  return count;
}

// ── Krungsri StatementInquiry CSV (ไม่มี header, แถวแรก B/F ยอดยกมา) ──
// คอลัมน์: 0 วันเวลา dd/mm/yyyy hh:mm:ss · 1 ถอน · 2 ฝาก · 3 คงเหลือ · 4 รหัส(TN/TW/TD/FE/DN/CL) · 5 รายละเอียด
// แยกบัญชี: เจอ "รับโอนเงิน BAY K L H บัญชีต้นทาง" = กระแสรายวัน(BAYC) · เจอ "โอนเงิน BAY K L H บัญชีปลายทาง" = ออมทรัพย์(BAY)
function parseKrungsriCsv_(grid, fileName, s, seen, alerts, forceBank) {
  alerts = alerts || [];
  var joined = grid.map(function(r){ return r.join('|'); }).join('\n');
  // จับบัญชี (ลำดับความแน่นอน): บังคับจากโฟลเดอร์ → เลขบัญชีในไฟล์ → ชื่อไฟล์ → ข้อความโอนภายใน → default ออม
  // ลำดับความแน่นอน: โฟลเดอร์ → เลขบัญชีในหัวไฟล์(.xls) → ประเภทบัญชีในหัวไฟล์(.xls) → ชื่อไฟล์ → ข้อความโอน → default
  var bank = forceBank || bankFromAccountDigits_(joined + '|' + fileName) || '';
  if (!bank && /ประเภทบัญชี/.test(joined)) {
    if (/ประเภทบัญชี.{0,4}กระแส/.test(joined)) bank = 'BAYC';
    else if (/ประเภทบัญชี.{0,6}(ฝากประจำ|ประจำ)/.test(joined)) bank = 'BAYF';
    else if (/ประเภทบัญชี.{0,4}ออม/.test(joined)) bank = 'BAY';
  }
  if (!bank) {
    if (/กระแส|current|BAYC/i.test(fileName)) bank = 'BAYC';
    else if (/ฝากประจำ|ประจำ|BAYF/i.test(fileName)) bank = 'BAYF';
    else if (/รับโอนเงิน BAY K L H บัญชีต้นทาง/.test(joined)) bank = 'BAYC';
    else if (/โอนเงิน BAY K L H บัญชีปลายทาง/.test(joined)) bank = 'BAY';
    else bank = 'BAY';
  }
  // ข้อเท็จจริงธนาคาร: ออมทรัพย์/ฝากประจำ ติดลบไม่ได้ — ยอดคงเหลือ(col3)ติดลบ = บัญชีกระแสรายวัน(OD) แน่นอน
  for (var bi = 0; bi < grid.length; bi++) {
    var bal = parseFloat(String((grid[bi] || [])[3] || '').replace(/[, ]/g, ''));
    if (!isNaN(bal) && bal < 0) { bank = 'BAYC'; break; }
  }

  var count = 0;
  var fileKeys = {};            // กุญแจทุกแถวในไฟล์นี้ (ไว้เทียบหาเช็คคืน/แก้ไข)
  var minD = null, maxD = null;

  for (var r = 0; r < grid.length; r++) {
    var row = grid[r];
    if (!row || row.length < 6) continue;
    var dt = String(row[0] || '').trim();
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dt)) continue;        // ข้าม B/F และแถวว่าง
    var d = parseThaiDate_(dt);
    if (!d) continue;
    if (!minD || d < minD) minD = d;
    if (!maxD || d > maxD) maxD = d;
    var amtOut = Number(String(row[1]).replace(/[, ]/g, '')) || 0;
    var amtIn  = Number(String(row[2]).replace(/[, ]/g, '')) || 0;
    var code = String(row[4] || '').trim();
    var desc = String(row[5] || '').replace(/\s+/g, ' ').trim().slice(0, 120);

    // pre-category จากรหัส/คำอธิบาย
    var cat = '', acct = '';
    var isCustomerIn = false;
    if (code === 'FE') { cat = 'EXPENSE'; acct = 'ค่าธรรมเนียมธนาคาร'; }
    else if (code === 'IN') { cat = 'OTHER'; acct = 'ดอกเบี้ยรับ'; }    // ดอกเบี้ยเงินฝาก (ฝากประจำ ฯลฯ)
    else if (code === 'TX') { cat = 'WHT'; acct = 'ภาษีถูกหัก ณ ที่จ่าย'; }  // ภาษีหัก ณ ที่จ่ายดอกเบี้ย 1% = สินทรัพย์/เครดิตภาษี (ไม่เข้า P&L)
    else if (/K L H/.test(desc)) cat = 'TRANSFER';              // โยกเงินภายในชื่อตัวเอง
    else if (amtIn > 0 && /รับโอนเงิน|จ่ายคิวอาร์|พร้อมเพย์/.test(desc)) { cat = 'SALE'; isCustomerIn = true; }
    else if (amtOut > 0 && /โอนเงิน|จ่าย|เงินออก/.test(desc)) cat = 'PAYMENT';

    var pair = [];
    if (amtIn > 0)  pair.push(['IN', amtIn]);
    if (amtOut > 0) pair.push(['OUT', amtOut]);
    pair.forEach(function(p) {
      var key = 'STMT-' + bank + '-' + dt + '-' + p[0] + '-' + p[1];
      fileKeys[key] = 1;
      if (seen[key]) return;
      s.appendRow([d, bank, p[0], p[1], cat, desc || ('statement: ' + fileName),
                   Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), key, '', acct]);
      seen[key] = 1; count++;
      // ลูกค้าโอนเข้า → เตือนเช็คตัดลูกหนี้ (AR)
      if (isCustomerIn) {
        alerts.push('🟧 ลูกค้าโอนเข้า ' + (bank === 'BAY' ? 'กรุงศรีออมฯ' : 'กรุงศรีกระแสฯ')
          + ' ฿' + p[1].toLocaleString() + ' (' + d + ')\n' + desc.slice(0, 70)
          + '\n→ เช็คว่าเป็นลูกหนี้ชำระหนี้ไหม → ตัด AR ใน Customer & AR แล้วเปลี่ยนหมวดเป็น "ตัดลูกหนี้"');
      }
    });
  }

  // ── เช็คเปลี่ยนแปลง/เช็คคืน: แถวในชีต (ช่วงวันที่เดียวกัน) ที่หายไปจาก statement ล่าสุด ──
  if (minD && maxD) {
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var mid = String(rows[i][7] || '');
      if (mid.indexOf('STMT-' + bank + '-') !== 0) continue;
      var rd = rows[i][0] instanceof Date
        ? Utilities.formatDate(rows[i][0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(rows[i][0]);
      if (rd < minD || rd > maxD) continue;
      if (!fileKeys[mid]) {
        var note9 = String(rows[i][8] || '');
        if (note9.indexOf('ไม่พบใน statement') < 0) {
          s.getRange(i + 1, 9).setValue((note9 ? note9 + ' | ' : '') + '⚠️ไม่พบใน statement ล่าสุด (เช็คคืน/แก้ไข?)');
          alerts.push('⚠️ รายการ ' + rd + ' ' + rows[i][2] + ' ฿' + Number(rows[i][3]).toLocaleString()
            + ' (' + bank + ') หายจาก statement ล่าสุด — อาจมีเช็คคืน/ธนาคารแก้รายการ ตรวจในสมุดเงินธนาคาร');
        }
      }
    }
  }
  return count;
}

// หา header แล้วอ่านแถว: วันที่ / ถอน(เดบิต) / ฝาก(เครดิต) / รายละเอียด
function parseStatementGrid_(grid, bankCode, fileName, s, seen) {
  var hRow = -1, cDate = -1, cOut = -1, cIn = -1, cDesc = -1;
  for (var i = 0; i < Math.min(grid.length, 15); i++) {
    for (var j = 0; j < grid[i].length; j++) {
      var h = String(grid[i][j] || '').toLowerCase();
      if (cDate < 0 && /วันที่|date/.test(h)) { hRow = i; cDate = j; }
      if (/ถอน|withdraw|debit|จ่าย/.test(h)) cOut = j;
      if (/ฝาก|deposit|credit|รับ/.test(h))  cIn = j;
      if (/รายละเอียด|รายการ|desc/.test(h))  cDesc = j;
    }
    if (hRow >= 0 && (cOut >= 0 || cIn >= 0)) break;
  }
  // fallback: ถ้าไม่เจอ header → ลอง parser กรุงศรี (กันไฟล์รูปแบบไม่คาดคิด) ไม่ throw ให้ batch ล้ม
  if (hRow < 0 || cDate < 0) return parseKrungsriCsv_(grid, fileName, s, seen, []);

  var count = 0;
  for (var r = hRow + 1; r < grid.length; r++) {
    var dRaw = grid[r][cDate];
    if (!dRaw) continue;
    var d = parseThaiDate_(dRaw);
    if (!d) continue;
    var amtIn  = cIn  >= 0 ? Number(String(grid[r][cIn]).replace(/[, ]/g, ''))  || 0 : 0;
    var amtOut = cOut >= 0 ? Number(String(grid[r][cOut]).replace(/[, ]/g, '')) || 0 : 0;
    var desc = cDesc >= 0 ? String(grid[r][cDesc] || '').slice(0, 120) : '';
    var pair = amtIn > 0 ? [['IN', amtIn]] : [];
    if (amtOut > 0) pair.push(['OUT', amtOut]);
    pair.forEach(function(p) {
      var key = 'STMT-' + bankCode + '-' + d + '-' + p[0] + '-' + p[1] + '-' + desc.slice(0, 20);
      if (seen[key]) return;
      s.appendRow([d, bankCode, p[0], p[1], '', desc || ('statement: ' + fileName),
                   Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), key, '', '']);
      seen[key] = 1; count++;
    });
  }
  return count;
}

// dd/mm/yyyy (รองรับ พ.ศ.) หรือ Date object → 'yyyy-MM-dd'
function parseThaiDate_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd');
  var m = String(v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) return null;
  var y = Number(m[3]); if (y < 100) y += 2500;
  if (y > 2400) y -= 543;
  return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}

// ── debug: ดูว่าในโฟลเดอร์ statement มีไฟล์อะไร, mime, จำนวนแถว, ตรวจ KTB/หัวตารางเจอไหม ──
// รันใน GAS Editor แล้วดูผลใน Execution log (และส่งเข้า LINE ให้ด้วย)
function debugStmtImport() {
  var folder = stmtFolder_();
  var report = ['📁 โฟลเดอร์: ' + folder.getName()];
  var files = folder.getFiles(), any = false;
  while (files.hasNext()) {
    any = true;
    var f = files.next(), name = f.getName(), mime = f.getMimeType();
    var line = '• ' + name + '\n   mime=' + mime;
    var tempId = null;
    try {
      var grid = null;
      if (mime === MimeType.CSV || /\.csv$/i.test(name)) {
        grid = Utilities.parseCsv(f.getBlob().getDataAsString('UTF-8').replace(/^﻿/, ''));
      } else if (mime === MimeType.GOOGLE_SHEETS) {
        grid = SpreadsheetApp.openById(f.getId()).getSheets()[0].getDataRange().getValues();
      } else if (/\.xlsx?$/i.test(name) || mime === MimeType.MICROSOFT_EXCEL) {
        var conv = Drive.Files.create({ name: 'tmp_dbg', mimeType: 'application/vnd.google-apps.spreadsheet' }, f.getBlob());
        tempId = conv.id;
        grid = SpreadsheetApp.openById(tempId).getSheets()[0].getDataRange().getValues();
      } else { line += '\n   (ชนิดไฟล์ไม่รองรับ → ข้าม)'; report.push(line); continue; }

      var isKtb = /Historical_SSKB|กรุงไทย/i.test(name);
      var headerRow = -1;
      for (var i = 0; i < Math.min(grid.length, 20); i++) {
        var rk = (grid[i] || []).join('|');
        if (/ถอนเงิน\/ฝากเงิน|ยอดคงเหลือยกมา/.test(rk)) isKtb = true;
        if (/ยอดคงเหลือ/.test(rk) && /วันที่/.test(rk)) headerRow = i;
      }
      line += '\n   rows=' + grid.length + ' · isKtb=' + isKtb + ' · headerRow=' + headerRow;
      if (isKtb && headerRow >= 0) {
        var firstData = (grid[headerRow + 2] || []).slice(0, 7).join(' | ');
        line += '\n   ตัวอย่างแถวข้อมูล: ' + firstData;
      }
    } catch (e) { line += '\n   ERROR: ' + e.message; }
    finally { if (tempId) { try { DriveApp.getFileById(tempId).setTrashed(true); } catch (e2) {} } }
    report.push(line);
  }
  if (!any) report.push('(ไม่มีไฟล์ในโฟลเดอร์ — ยังไม่ได้อัปโหลด หรืออัปโหลดผิดโฟลเดอร์)');
  var msg = report.join('\n');
  Logger.log(msg);
  try { sendWmsLine_('🔍 ' + msg); } catch (e3) {}
  return msg;
}

// ตั้ง trigger สแกนโฟลเดอร์ทุกคืน 23:00 (รันครั้งเดียวใน Editor)
function setupDailyStatementTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'importBayStatements') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('importBayStatements').timeBased().everyDays(1).atHour(23).create();
  var folder = stmtFolder_();
  return 'ตั้งสแกน statement ทุกคืน 23:00 แล้ว · โฟลเดอร์: ' + folder.getName() + ' (id: ' + folder.getId() + ')';
}

// สรุปยอดธนาคารรายเดือน (ใช้ในหน้า ภพ.30) — ยอดขายฐานภาษี = IN ที่ไม่ใช่ TRANSFER
function getBankSummary(yyyymm) {
  try {
    var ym = yyyymm || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
    var s = bankSheet_();
    var out = { ok: true, month: ym, ktbIn: 0, bayIn: 0, transfer: 0, payment: 0, salesBase: 0, count: 0 };
    if (s.getLastRow() <= 1) return out;
    s.getDataRange().getValues().slice(1).forEach(function(r) {
      var rd = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM') : String(r[0]).slice(0, 7);
      if (rd !== ym) return;
      var bank = r[1], dir = r[2], amt = Number(r[3]) || 0, cat = r[4];
      out.count++;
      if (cat === 'TRANSFER') { out.transfer += amt; return; }
      if (dir === 'IN') {
        if (bank === 'KTB') out.ktbIn += amt; else out.bayIn += amt;
        if (cat === 'SALE' || cat === 'AR') out.salesBase += amt;   // AR = ลูกหนี้ชำระ ก็เป็นเงินเข้าฐานภาษี
      } else out.payment += amt;
    });
    return out;
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── ดึง KTB รายวันจากอีเมล: แกะ ZIP → parse MT940 (.txt ไม่เข้ารหัส) เท่านั้น ──
// ข้ามไฟล์เข้ารหัส (statement รายเดือน) · ไม่สร้างแถวฝั่ง BAY (กันซ้ำกับ statement กรุงศรี)
// ยอดรายเดือน (CSV เข้ารหัส) ค่อยถอดเป็น CSV มา import ทับทีหลัง (authoritative replace เคลียร์ให้ตรง)
function fetchKtbDaily(daysBack) {
  try {
    daysBack = Number(daysBack) || 2;
    var cfg = getConfig();
    var ktbFrom = String(cfg.BANK_EMAIL_KTB || 'krungthai.com').trim();
    var s = bankSheet_();
    var seen = {};
    if (s.getLastRow() > 1) s.getRange(2, 8, s.getLastRow() - 1, 1).getValues().forEach(function(r){ if (r[0]) seen[String(r[0])] = 1; });
    var since = Utilities.formatDate(new Date(Date.now() - daysBack * 86400000), 'Asia/Bangkok', 'yyyy/MM/dd');
    var added = 0, files = 0;
    GmailApp.search('from:' + ktbFrom + ' after:' + since, 0, 50).forEach(function(th) {
      th.getMessages().forEach(function(m) {
        m.getAttachments().forEach(function(att) {
          var nm = att.getName();
          try {
            if (/\.zip$/i.test(nm)) {
              Utilities.unzip(att.copyBlob().setContentType('application/zip')).forEach(function(b) {
                var t = '';
                try { t = b.getDataAsString('UTF-8'); } catch(e) { return; }   // เข้ารหัส/ไบนารี → ข้าม
                if (t.indexOf(':61:') >= 0) { added += parseMt940_(t, s, seen); files++; }
              });
            } else if (/\.txt$/i.test(nm)) {
              var t2 = att.getDataAsString('UTF-8');
              if (t2.indexOf(':61:') >= 0) { added += parseMt940_(t2, s, seen); files++; }
            }
          } catch(e) {}
        });
      });
    });
    if (added > 0) categorizeBankTxns_();
    return { ok: true, added: added, files: files, msg: 'KTB รายวัน: เพิ่ม ' + added + ' รายการ (จาก ' + files + ' ไฟล์ MT940 ใน ' + daysBack + ' วัน)' };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── กระทบยอด KTB: เช็คว่าเดือนนี้มีข้อมูลครบทุกวันไหม (วันขาด = อาจดึงไม่ครบ) ──
// เทียบความครบถ้วน — ถ้ามีวันขาด ให้ import statement รายเดือนมาเติม (authoritative replace)
function reconcileKtb(yyyymm) {
  try {
    var s = bankSheet_();
    var ym = yyyymm || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
    if (s.getLastRow() <= 1) return { ok: true, msg: 'ยังไม่มีข้อมูลในสมุดธนาคาร' };
    var rows = s.getRange(2, 1, s.getLastRow() - 1, H_BANK.length).getValues();
    var dayIn = {}, totalIn = 0, totalOut = 0, cnt = 0;
    rows.forEach(function(r) {
      if (String(r[1]) !== 'KTB') return;
      var d = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]).slice(0, 10);
      if (d.slice(0, 7) !== ym) return;
      cnt++;
      var amt = Number(r[3]) || 0;
      if (r[2] === 'IN') { var day = Number(d.slice(8, 10)); dayIn[day] = (dayIn[day] || 0) + amt; totalIn += amt; }
      else totalOut += amt;
    });
    if (!cnt) return { ok: true, msg: '🔍 KTB เดือน ' + ym + ': ยังไม่มีข้อมูลเลย — กดดึง KTB หรือ import statement' };
    var days = Object.keys(dayIn).map(Number).sort(function(a, b){ return a - b; });
    var first = days[0], last = days[days.length - 1], missing = [];
    for (var d = first; d <= last; d++) if (!dayIn[d]) missing.push(d);
    var msg = '🔍 กระทบยอด KTB ' + ym
      + '\nรายการ ' + cnt + ' · เงินเข้ารวม ฿' + Math.round(totalIn).toLocaleString()
      + '\nมีข้อมูลวันที่ ' + first + '–' + last + ' (' + days.length + ' วัน)';
    if (missing.length) msg += '\n⚠️ วันไม่มีเงินเข้า: ' + missing.join(', ') + '\n→ เช็คว่าปิดร้าน หรือข้อมูลขาด (import statement รายเดือนมาเติมครบ)';
    else msg += '\n✅ ครบทุกวันในช่วง ไม่มีวันขาด';
    return { ok: true, msg: msg, totalIn: totalIn, missing: missing };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// เช็คว่าวันที่ ymd มีรายการของแต่ละธนาคารไหม (ไว้เตือนถ้าลืมเรียก statement)
function bankDayPresence_(ymd) {
  var s = bankSheet_();
  var has = { KTB: false, BAY: false, BAYC: false };
  if (s.getLastRow() <= 1) return has;
  s.getRange(2, 1, s.getLastRow() - 1, 2).getValues().forEach(function(r) {
    var d = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]).slice(0, 10);
    if (d === ymd && has.hasOwnProperty(r[1])) has[r[1]] = true;
  });
  return has;
}

// รายวัน 06:00: ดึง KTB รายวัน (MT940) + สรุปยอดสะสมส่ง LINE + เตือนถ้าเมื่อวานไม่มียอด
function dailyBankJob() {
  var ktb = fetchKtbDaily(2);
  var ym = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
  var yest = Utilities.formatDate(new Date(Date.now() - 86400000), 'Asia/Bangkok', 'yyyy-MM-dd');
  var sum = getBankSummary(ym);
  // เตือนถ้าเมื่อวานยังไม่มียอด (ลืมเรียก/ดึง statement)
  var has = bankDayPresence_(yest);
  var miss = [];
  if (!has.KTB) miss.push('กรุงไทย (KTB)');
  if (!has.BAY && !has.BAYC) miss.push('กรุงศรี (BAY) — เรียก statement เองทุกคืน');
  if (sum.ok) {
    var msg = '🏦 รายงานยอดเงินธนาคาร (' + ym + ' สะสม)\n'
      + '🟦 KTB เข้า: ฿' + Math.round(sum.ktbIn).toLocaleString() + '\n'
      + '🟧 กรุงศรี เข้า: ฿' + Math.round(sum.bayIn).toLocaleString() + '\n'
      + '🔁 โยกเงิน (ไม่นับขาย): ฿' + Math.round(sum.transfer).toLocaleString() + '\n'
      + '💰 ฐานยอดขายภาษี: ฿' + Math.round(sum.salesBase).toLocaleString()
      + (ktb && ktb.added ? '\n(KTB อีเมลใหม่ ' + ktb.added + ' รายการ)' : '');
    if (miss.length) msg += '\n\n⚠️ เมื่อวาน (' + yest + ') ยังไม่มียอด:\n   • ' + miss.join('\n   • ') + '\n→ เรียก/นำเข้า statement ให้ครบ';
    sendWmsLine_(msg);
  }
  return { ok: true, ktb: ktb, sum: sum, missingYesterday: miss };
}

// ════════════════════════════════════════════════════════════
//  หน้าสมุดเงินธนาคาร (?page=bank) — ดู/แก้/เพิ่ม BANK_TRANSACTIONS
//  CATEGORY: SALE=ยอดขาย · TRANSFER=โยกเงิน · PAYMENT=ชำระหนี้ · EXPENSE=ค่าใช้จ่าย
// ════════════════════════════════════════════════════════════

// รายการเดือนนั้น พร้อมเลขแถวจริง (ไว้แก้ไขกลับ)
function getBankTxns(yyyymm) {
  try {
    var ym = yyyymm || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
    var s = bankSheet_();
    var out = [];
    if (s.getLastRow() > 1) {
      var rows = s.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        var d = rows[i][0] instanceof Date
          ? Utilities.formatDate(rows[i][0], 'Asia/Bangkok', 'yyyy-MM-dd')
          : String(rows[i][0]);
        if (d.slice(0, 7) !== ym) continue;
        out.push({
          row: i + 1, date: d,
          bank: String(rows[i][1] || ''), dir: String(rows[i][2] || ''),
          amount: Number(rows[i][3]) || 0, cat: String(rows[i][4] || ''),
          subject: String(rows[i][5] || ''), note: String(rows[i][8] || ''),
          account: String(rows[i][9] || ''), acctNo: String(rows[i][10] || '')
        });
      }
    }
    out.sort(function(a, b) { return a.date < b.date ? 1 : -1; });
    return { ok: true, month: ym, txns: out };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ════════════════════════════════════════════════════════════
//  ยอดเคลื่อนไหว (Statement) — running balance + ตรวจยอดต้น/ปลายงวด ต่อบัญชี
// ════════════════════════════════════════════════════════════
var SH_ACCTBAL = 'ACCOUNT_BALANCES';
var H_ACCTBAL  = ['DATE','BANK','BALANCE','NOTE'];
function acctBalSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName(SH_ACCTBAL);
  if (!s) { s = ss.insertSheet(SH_ACCTBAL);
    s.getRange(1,1,1,H_ACCTBAL.length).setValues([H_ACCTBAL]).setFontWeight('bold').setBackground('#1A237E').setFontColor('#fff');
    s.setFrozenRows(1);
  }
  return s;
}
function abDate_(v){ return v instanceof Date ? Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd') : String(v||'').slice(0,10); }

// เติมเลขบัญชีจริงลงคอลัมน์ K (ACCT_NO) ทุกแถว — ดึงจาก BANK code (B) อัตโนมัติ · idempotent
function backfillAccountNumbers() {
  try {
    var s = bankSheet_();
    // แก้หัวคอลัมน์ให้ตรงเนื้อหา: J = ผังบัญชีค่าใช้จ่าย (ไม่ใช่เลขบัญชี) · K = เลขบัญชีธนาคาร
    s.getRange(1,10).setValue('ผังบัญชี(ค่าใช้จ่าย)').setFontWeight('bold').setBackground('#1A237E').setFontColor('#fff');
    if (String(s.getRange(1,11).getValue()) !== 'เลขบัญชี')
      s.getRange(1,11).setValue('เลขบัญชี').setFontWeight('bold').setBackground('#1A237E').setFontColor('#fff');
    var last = s.getLastRow();
    if (last < 2) return { ok:true, filled:0 };
    var banks = s.getRange(2,2,last-1,1).getValues();   // คอลัมน์ B
    var out = banks.map(function(r){ var a = BANK_ACCOUNTS[String(r[0]).toUpperCase()]; return [ a ? a.full : '' ]; });
    s.getRange(2,11,out.length,1).setValues(out);
    return { ok:true, filled:out.length };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// บัญชีทั้งหมด (ให้ UI ทำ dropdown + โชว์เลขบัญชี)
function getBankAccountsList() {
  var out = [];
  for (var k in BANK_ACCOUNTS) out.push({ code:k, full:BANK_ACCOUNTS[k].full, name:BANK_ACCOUNTS[k].name, type:BANK_ACCOUNTS[k].type });
  return { ok:true, accounts:out };
}

// ยอดอ้างอิงต้น/ปลายงวดที่บันทึกไว้ (anchor) — ผู้ใช้กรอกจากยอดจริงในธนาคาร
function getAccountBalances() {
  try {
    var s = acctBalSheet_(); if (s.getLastRow()<2) return { ok:true, items:[] };
    var rows = s.getRange(2,1,s.getLastRow()-1,H_ACCTBAL.length).getValues();
    var items = rows.map(function(r,i){ return { row:i+2, date:abDate_(r[0]), bank:String(r[1]||''), balance:Number(r[2])||0, note:String(r[3]||'') }; })
      .filter(function(x){ return x.date && x.bank; });
    return { ok:true, items:items };
  } catch(e){ return { ok:false, msg:String(e) }; }
}
// บันทึก/แก้ยอดอ้างอิง (upsert ตาม วันที่+บัญชี)
function saveAccountBalance(date, bank, balance, note) {
  try {
    date = abDate_(date); bank = String(bank||'').toUpperCase();
    if (!date || !bank) return { ok:false, msg:'ต้องระบุวันที่ + บัญชี' };
    var s = acctBalSheet_();
    var rows = s.getLastRow()>1 ? s.getRange(2,1,s.getLastRow()-1,H_ACCTBAL.length).getValues() : [];
    for (var i=0;i<rows.length;i++){
      if (abDate_(rows[i][0])===date && String(rows[i][1]).toUpperCase()===bank){
        s.getRange(i+2,3).setValue(Number(balance)||0); s.getRange(i+2,4).setValue(String(note||''));
        return { ok:true, msg:'อัปเดตยอด '+bank+' '+date };
      }
    }
    s.appendRow([date, bank, Number(balance)||0, String(note||'')]);
    return { ok:true, msg:'บันทึกยอด '+bank+' '+date };
  } catch(e){ return { ok:false, msg:String(e) }; }
}
function deleteAccountBalance(row) {
  try { var s = acctBalSheet_(); if (row<2||row>s.getLastRow()) return { ok:false }; s.deleteRow(row); return { ok:true }; }
  catch(e){ return { ok:false, msg:String(e) }; }
}
// seed ยอดอ้างอิงที่ผู้ใช้แจ้ง 20/6 + 22/6 (รันใน editor ครั้งเดียว)
function seedBalances() {
  var data = [
    ['2026-06-20','KTB',384354.62], ['2026-06-20','BAY',669.43], ['2026-06-20','BAYC',-66980.49], ['2026-06-20','BAYF',723167.29],
    ['2026-06-22','KTB',453266.62], ['2026-06-22','BAY',6779.43], ['2026-06-22','BAYC',-118793.49], ['2026-06-22','BAYF',723167.29]
  ];
  data.forEach(function(d){ saveAccountBalance(d[0], d[1], d[2], 'แจ้งยอดจริง'); });
  return 'seed ยอดอ้างอิง 8 รายการ (20/6 + 22/6) เรียบร้อย';
}

// Statement: รายการเรียงวัน + ยอดคงเหลือวิ่ง (running) + จุดตรวจยอด (checkpoint) เทียบ anchor
// openDate = วันยอดต้นงวด (ใช้ anchor วันนั้น/ก่อนหน้าล่าสุดเป็นยอดเปิด) · toDate ไม่บังคับ
function bankStatement(bank, openDate, toDate) {
  try {
    bank = String(bank||'').toUpperCase();
    openDate = abDate_(openDate);
    toDate = toDate ? abDate_(toDate) : Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd');
    var anchors = (getAccountBalances().items||[]).filter(function(a){ return a.bank===bank; });
    // ยอดเปิด = anchor วันที่ <= openDate ที่ใหม่สุด
    var open = null;
    anchors.forEach(function(a){ if (a.date<=openDate && (!open || a.date>open.date)) open = a; });
    var openBal = open ? open.balance : 0;
    var openDt  = open ? open.date : openDate;

    var s = bankSheet_(); var rows = s.getLastRow()>1 ? s.getDataRange().getValues() : [];
    var txns = [];
    for (var i=1;i<rows.length;i++){
      if (String(rows[i][1]).toUpperCase()!==bank) continue;
      var d = abDate_(rows[i][0]);
      if (d<=openDt || d>toDate) continue;
      txns.push({ row:i+1, date:d, dir:String(rows[i][2]||''), amount:Number(rows[i][3])||0,
        cat:String(rows[i][4]||''), subject:String(rows[i][5]||''), note:String(rows[i][8]||'') });
    }
    txns.sort(function(a,b){ return a.date<b.date?-1:(a.date>b.date?1:a.row-b.row); });

    var running = openBal, endOfDay = {};
    txns.forEach(function(t){ running += (t.dir==='IN'? t.amount : -t.amount); t.running = running; endOfDay[t.date] = running; });

    // checkpoint: anchor ใด ๆ ในช่วง (openDt, toDate] → เทียบยอดคำนวณสิ้นวันนั้น
    var checks = [];
    anchors.forEach(function(a){
      if (a.date>openDt && a.date<=toDate){
        var comp = openBal, bd = openDt;
        for (var dk in endOfDay){ if (dk<=a.date && dk>=bd){ if (dk>bd || comp===openBal){ bd=dk; comp=endOfDay[dk]; } } }
        // หา end-of-day ล่าสุด <= a.date
        comp = openBal; var best='';
        for (var dk2 in endOfDay){ if (dk2<=a.date && dk2>best){ best=dk2; comp=endOfDay[dk2]; } }
        checks.push({ date:a.date, computed:comp, actual:a.balance, diff:Math.round((comp-a.balance)*100)/100 });
      }
    });
    return { ok:true, bank:bank, account:(BANK_ACCOUNTS[bank]||{}), open:{date:openDt,balance:openBal,hasAnchor:!!open},
             toDate:toDate, rows:txns, checks:checks, close:Math.round(running*100)/100, count:txns.length };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// แก้หมวด + หมายเหตุ + ผังบัญชี (ชำระหนี้ใคร / ค่าใช้จ่ายอะไร)
function updateBankTxn(row, cat, note, account) {
  try {
    var s = bankSheet_();
    if (row < 2 || row > s.getLastRow()) return { ok: false, msg: 'แถวไม่ถูกต้อง' };
    s.getRange(row, 5).setValue(String(cat || ''));
    s.getRange(row, 9).setValue(String(note || ''));
    s.getRange(row, 10).setValue(String(account || ''));
    return { ok: true };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── จัดบัญชีรายการ ACH "เงินออก หมายเลขอ้างอิง" ให้ถูกแบบฟันธง ──
//  ข้อเท็จจริง: desc นี้ใช้ทั้งกระแสและออมทรัพย์ — แต่ของออมทรัพย์มี "ref เดียว" คือ 0018902360 (auto-debit ประจำ)
//  → ref 0018902360 = ออมทรัพย์(BAY) · ที่เหลือทั้งหมด = กระแส(BAYC)
//  + ตรวจรายการซ้ำ (วัน+ยอด+ref เดียวกัน) มารายงาน (ไม่ลบเอง — ให้ยืนยันก่อน)
//  idempotent · รันซ้ำได้
var BAY_ACH_REFS_ = ['0018902360'];   // ref ของ auto-debit ที่เป็นออมทรัพย์จริง (โทรถามธนาคารแล้วเติมได้)
function fixAchAccounts() {
  try {
    var s = bankSheet_(); if (s.getLastRow() < 2) return 'ไม่มีข้อมูล';
    var rows = s.getDataRange().getValues();
    function dstr(v){ return v instanceof Date ? Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd') : String(v||'').slice(0,10); }
    var seen = {}, dups = [], toBayc = 0, keepBay = 0;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][2]) !== 'OUT') continue;
      var subj = String(rows[i][5] || '');
      if (!/เงินออก\s+หมายเลขอ้างอิง/.test(subj)) continue;
      var d = dstr(rows[i][0]), amt = Number(rows[i][3]) || 0;
      var rm = subj.match(/หมายเลขอ้างอิง\s*:?\s*(\d+)/); var ref = rm ? rm[1] : '';
      var isBay = false;
      for (var b = 0; b < BAY_ACH_REFS_.length; b++) if (ref === BAY_ACH_REFS_[b]) isBay = true;
      var target = isBay ? 'BAY' : 'BAYC';
      if (String(rows[i][1]).toUpperCase() !== target) {
        s.getRange(i+1, 2).setValue(target);
        s.getRange(i+1, 11).setValue((BANK_ACCOUNTS[target] || {}).full || '');
      }
      if (target === 'BAYC') toBayc++; else keepBay++;
      var key = d + '|' + amt + '|' + ref;
      if (seen[key]) dups.push(d + ' ฿' + amt.toLocaleString() + ' (ref ' + ref + ')');
      else seen[key] = (i+1);
    }
    var msg = 'จัดบัญชี ACH: กระแส ' + toBayc + ' · ออมทรัพย์(auto-debit) ' + keepBay;
    if (dups.length) msg += ' · ⚠️ พบรายการซ้ำ ' + dups.length + ': ' + dups.join(', ') + ' (ยืนยันแล้วผมลบให้)';
    else msg += ' · ไม่มีซ้ำ';
    Logger.log(msg);
    return msg;
  } catch(e){ return 'ERROR: ' + e; }
}
// ลบรายการ ACH ที่ซ้ำ (วัน+ยอด+ref ซ้ำ) — รันหลังยืนยันจาก fixAchAccounts
function removeDupAchRows() {
  try {
    var s = bankSheet_(); if (s.getLastRow() < 2) return 'ไม่มีข้อมูล';
    var rows = s.getDataRange().getValues();
    function dstr(v){ return v instanceof Date ? Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd') : String(v||'').slice(0,10); }
    var seen = {}, del = [], removed = [];
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][2]) !== 'OUT') continue;
      var subj = String(rows[i][5] || '');
      if (!/เงินออก\s+หมายเลขอ้างอิง/.test(subj)) continue;
      var d = dstr(rows[i][0]), amt = Number(rows[i][3]) || 0;
      var rm = subj.match(/หมายเลขอ้างอิง\s*:?\s*(\d+)/); var ref = rm ? rm[1] : '';
      var key = d + '|' + amt + '|' + ref;
      if (seen[key]) { del.push(i+1); removed.push(d + ' ฿' + amt.toLocaleString()); }
      else seen[key] = true;
    }
    del.sort(function(a,b){ return b - a; }).forEach(function(r){ s.deleteRow(r); });
    return del.length ? ('ลบรายการซ้ำ ' + del.length + ': ' + removed.join(', ')) : 'ไม่พบรายการซ้ำ';
  } catch(e){ return 'ERROR: ' + e; }
}

// ย้ายรายการไปบัญชีที่ถูก (backend — ใช้จากหน้าผู้มีอำนาจ ภายหลัง)
function reclassifyBankTxn(row, newBank) {
  try {
    var s = bankSheet_();
    if (row < 2 || row > s.getLastRow()) return { ok: false, msg: 'แถวไม่ถูกต้อง' };
    var nb = String(newBank || '').trim().toUpperCase();
    if (['KTB','BAY','BAYC','BAYF'].indexOf(nb) < 0) return { ok: false, msg: 'บัญชีไม่ถูกต้อง' };
    s.getRange(row, 2).setValue(nb);
    s.getRange(row, 11).setValue((BANK_ACCOUNTS[nb] || {}).full || '');   // อัปเดตเลขบัญชี K ตามไปด้วย
    return { ok: true, msg: 'ย้ายไป ' + nb + ' แล้ว' };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// ค่าใช้จ่ายจากธนาคาร แยกตามผังบัญชี (ดึงเข้างบกำไรขาดทุน — ผังเงินข้อ 5)
function getBankExpenses(yyyymm) {
  try {
    var ym = yyyymm || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM');
    var s = bankSheet_();
    var typeMap = chartTypeMap_();
    var by = {}, total = 0, unspecified = 0;
    if (s.getLastRow() > 1) {
      s.getDataRange().getValues().slice(1).forEach(function(r) {
        var d = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Bangkok', 'yyyy-MM-dd') : String(r[0]);
        if (d.slice(0, 7) !== ym) return;
        var cat = String(r[4] || '');
        if (cat !== 'EXPENSE') return;                    // เฉพาะค่าใช้จ่ายจริง (ชำระหนี้/หนี้สิน = งบดุล ไม่เข้า P&L)
        var amt = Number(r[3]) || 0;
        var acc = String(r[9] || '').trim();
        var aType = typeMap[acc] || '';
        if (aType === 'หนี้สิน' || aType === 'สินทรัพย์' || /หนี้สิน/.test(acc)) return;  // ไม่ใช่ค่าใช้จ่าย P&L
        if (!acc) { acc = 'ค่าใช้จ่ายอื่น (ยังไม่ระบุ)'; unspecified += amt; }
        by[acc] = (by[acc] || 0) + amt;
        total += amt;
      });
    }
    var rows = [];
    for (var k in by) rows.push({ account: k, amount: by[k] });
    rows.sort(function(a, b) { return b.amount - a.amount; });
    return { ok: true, month: ym, total: total, unspecified: unspecified, rows: rows };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// เพิ่มรายการมือ (คีย์จาก statement เองได้)
function addBankTxn(d) {
  try {
    if (!d || !d.date || !(Number(d.amount) > 0)) return { ok: false, msg: 'กรอกวันที่และยอดเงิน' };
    var s = bankSheet_();
    s.appendRow([String(d.date), String(d.bank || 'KTB'), String(d.dir || 'IN'),
                 Number(d.amount), String(d.cat || ''), String(d.subject || 'คีย์มือ'),
                 Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'),
                 'MANUAL-' + Date.now(), String(d.note || '')]);
    categorizeBankTxns_();
    return { ok: true };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

function deleteBankTxn(row) {
  try {
    var s = bankSheet_();
    if (row < 2 || row > s.getLastRow()) return { ok: false, msg: 'แถวไม่ถูกต้อง' };
    s.deleteRow(row);
    return { ok: true };
  } catch(e) { return { ok: false, msg: e.toString() }; }
}

// จับคู่โยกเงินใหม่ทั้งเดือน (หลังแก้ข้อมูล)
function recategorizeBank() {
  try { categorizeBankTxns_(); return { ok: true }; }
  catch(e) { return { ok: false, msg: e.toString() }; }
}

// ── TEST: ส่งข้อความทดสอบเข้า LINE — รันใน GAS Editor ดูว่าเข้าห้องไหม ──
function testLine() {
  var cfg = getConfig();
  var dest = String(cfg.LINE_GROUP_ID || '');
  var msg = '🔔 ทดสอบระบบ KLH\n'
    + 'เวลา: ' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss') + '\n'
    + 'ปลายทาง: ' + (dest.charAt(0) === 'C' ? 'ห้องกลุ่ม ✓' : (dest.charAt(0) === 'U' ? 'แชทส่วนตัว (U…)' : '?')) + '\n'
    + 'ถ้าเห็นข้อความนี้ = ระบบส่ง LINE ได้ปกติ';
  sendWmsLine_(msg);
  Logger.log('ส่งไป: ' + dest + '\n' + msg);
  return 'ส่งแล้ว → ' + dest;
}

// ── DEBUG: สแกนหาอีเมลธนาคารจริง 14 วัน — รันใน GAS Editor แล้วดู Log ──
// ใช้ปรับ BANK_EMAIL_KTB / BANK_EMAIL_BAY และ regex ให้ตรงรูปแบบจริง
function debugBankEmails(daysBack) {
  daysBack = Number(daysBack) || 14;
  var queries = [
    'from:krungthai.com', 'from:ktb.co.th', 'from:krungsri.com', 'from:bay.co.th',
    'กรุงไทย', 'กรุงศรี', 'Krungthai', 'Krungsri', 'เงินเข้า', 'รับโอนเงิน'
  ];
  var since = Utilities.formatDate(new Date(Date.now() - daysBack*86400000), 'Asia/Bangkok', 'yyyy/MM/dd');
  var out = [];
  queries.forEach(function(q) {
    try {
      var threads = GmailApp.search(q + ' after:' + since, 0, 5);
      threads.forEach(function(th) {
        var m = th.getMessages()[0];
        var body = ''; try { body = m.getPlainBody().slice(0, 200).replace(/\s+/g, ' '); } catch(e) {}
        var att = 0, attNames = ''; try { var atts = m.getAttachments(); att = atts.length; attNames = atts.map(function(a){ return a.getName(); }).join(', '); } catch(e) {}
        out.push('Q[' + q + '] FROM: ' + m.getFrom()
          + '\n  DATE: ' + Utilities.formatDate(m.getDate(), 'Asia/Bangkok', 'yyyy-MM-dd')
          + '\n  SUBJ: ' + m.getSubject()
          + '\n  ATT: ' + att + (attNames ? ' [' + attNames + ']' : '') + ' | AMT-PARSE: ' + extractAmount_(m.getSubject() + ' ' + body)
          + '\n  BODY: ' + body.slice(0, 150));
      });
    } catch(e) { out.push('Q[' + q + '] ERROR: ' + e); }
  });
  var txt = out.length ? out.join('\n----------------\n') : 'ไม่พบอีเมลธนาคารใน 14 วัน — เช็คว่า Gmail บัญชีนี้รับอีเมลแจ้งเตือนธนาคารหรือไม่';
  Logger.log(txt);
  return txt;
}

// ตั้ง trigger รายวัน 06:00 (รันครั้งเดียวใน GAS Editor)
function setupDailyBankTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'dailyBankJob') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyBankJob').timeBased().everyDays(1).atHour(6).create();
  return 'ตั้ง trigger อ่านอีเมลธนาคารทุกวัน 06:00 แล้ว';
}
