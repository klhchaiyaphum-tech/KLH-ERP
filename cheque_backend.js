// ============================================================
//  cheque.js — เช็คสั่งจ่าย (กรุงศรีกระแส BAYC)
//  CHEQUES: A CHQ_NO · B PAYEE_CODE · C PAYEE_NAME · D AMOUNT · E ISSUE_DATE
//           F DUE_DATE · G STATUS(OUTSTANDING/CLEARED/CLEARED_DIFF/VOID)
//           H CLEARED_DATE · I CLEARED_AMT · J AP_NOTE · K NOTE · L CREATED
//  วงจร: ออกเช็ค (ตัด AP ได้ทันที) → เตือนครบกำหนดผ่านรายงาน 08:00
//        → statement มีรายการ "หมายเลขอ้างอิง = เลขเช็ค" → ตัดสถานะอัตโนมัติ + เช็คยอดตรงไหม
// ============================================================
var SH_CHQ = 'CHEQUES';
var H_CHQ = ['CHQ_NO','PAYEE_CODE','PAYEE_NAME','AMOUNT','ISSUE_DATE','DUE_DATE','STATUS','CLEARED_DATE','CLEARED_AMT','AP_NOTE','NOTE','CREATED'];

function chqSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName(SH_CHQ);
  if (!s) { s = ss.insertSheet(SH_CHQ);
    s.getRange(1,1,1,H_CHQ.length).setValues([H_CHQ]).setFontWeight('bold').setBackground('#1A237E').setFontColor('#fff');
    s.setFrozenRows(1);
    // เลขเช็คเป็นข้อความ กัน Sheets ตัด 0 นำหน้า
    s.getRange(2,1,s.getMaxRows()-1,1).setNumberFormat('@');
  }
  return s;
}
function chqDs_(v){ return v instanceof Date ? Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd') : String(v||'').slice(0,10); }
// เทียบเลขเช็ค: เอาเฉพาะตัวเลข + ตัด 0 นำหน้า (statement อาจเติม 0 ข้างหน้า)
function chqNorm_(v){ return String(v||'').replace(/\D/g,'').replace(/^0+/,''); }

// ── ออกเช็คใหม่ · cutAp=true → ตัดบิลเจ้าหนี้ FIFO ทันที (ถือว่าชำระเมื่อมอบเช็ค) ──
function addCheque(d) {
  try {
    var no = String(d.chqNo||'').trim();
    var amt = Number(d.amount)||0;
    if (!no || amt<=0) return { ok:false, msg:'ต้องมีเลขเช็ค + จำนวนเงิน' };
    if (!chqNorm_(no)) return { ok:false, msg:'เลขเช็คต้องเป็นตัวเลข' };
    var s = chqSheet_();
    if (s.getLastRow()>1) {
      var nos = s.getRange(2,1,s.getLastRow()-1,1).getValues();
      for (var i=0;i<nos.length;i++){ if (chqNorm_(nos[i][0])===chqNorm_(no)) return { ok:false, msg:'เลขเช็ค '+no+' มีอยู่แล้ว (แถว '+(i+2)+')' }; }
    }
    var issue = chqDs_(d.issueDate) || Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd');
    var due   = chqDs_(d.dueDate) || issue;
    var apNote = '';
    if (d.cutAp && d.payeeCode) {
      var r = apPayFromBank('CHQ:'+chqNorm_(no), d.payeeCode, amt, issue, 'BAYC-เช็ค');
      apNote = (r && r.ok) ? r.msg : ('ไม่ได้ตัด AP: '+((r&&r.msg)||''));
    } else if (d.apNote) apNote = String(d.apNote);
    s.appendRow([no, String(d.payeeCode||''), String(d.payeeName||''), amt, issue, due,
      'OUTSTANDING', '', '', apNote, String(d.note||''),
      Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd HH:mm')]);
    return { ok:true, msg:'บันทึกเช็ค '+no+' ฿'+amt.toLocaleString()+' จ่าย '+(d.payeeName||'-')+' ครบกำหนด '+due+(apNote?' · '+apNote:'') };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// ── จ่ายบิล AP รายใบด้วยเช็ค (เรียกจากหน้า AP) — ตัดบิล + ลงทะเบียนเช็ค ──
function apPayByCheque(apId, amount, chqNo, dueDate, payeeCode, payeeName) {
  try {
    var no = String(chqNo||'').trim();
    if (!no) return { ok:false, msg:'ใส่เลขเช็ค' };
    // ลงทะเบียนเช็คก่อน (กันเลขซ้ำ) — ไม่ FIFO เพราะจ่ายเจาะจงบิลนี้
    var c = addCheque({ chqNo:no, payeeCode:payeeCode, payeeName:payeeName, amount:amount,
      issueDate:'', dueDate:dueDate, cutAp:false, apNote:'จ่ายบิล '+apId });
    if (!c.ok) return c;
    var p = apPay(apId, amount, 'BAYC', 'เช็คสั่งจ่าย', 'CHQ:'+chqNorm_(no), 'เช็ค '+no+' ครบกำหนด '+chqDs_(dueDate));
    if (!p.ok) return { ok:false, msg:'ลงเช็คแล้วแต่ตัดบิลไม่สำเร็จ: '+p.msg };
    return { ok:true, msg:'เช็ค '+no+' จ่าย '+apId+' ฿'+Number(amount).toLocaleString()+' · '+p.msg };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// ── รายการเช็ค (ทั้งค้าง+ประวัติ) ──
function getCheques() {
  try {
    var s = chqSheet_(); if (s.getLastRow()<2) return { ok:true, items:[] };
    var today = Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd');
    var rows = s.getRange(2,1,s.getLastRow()-1,H_CHQ.length).getValues();
    var items = rows.map(function(r,i){
      var due = chqDs_(r[5]);
      var dLeft = null;
      try { dLeft = Math.round((new Date(due+'T00:00:00') - new Date(today+'T00:00:00'))/86400000); } catch(e){}
      return { row:i+2, chqNo:String(r[0]||''), payeeCode:String(r[1]||''), payeeName:String(r[2]||''),
        amount:Number(r[3])||0, issueDate:chqDs_(r[4]), dueDate:due, status:String(r[6]||''),
        clearedDate:chqDs_(r[7]), clearedAmt:Number(r[8])||0, apNote:String(r[9]||''), note:String(r[10]||''),
        daysLeft:dLeft };
    }).filter(function(x){ return x.chqNo; });
    items.sort(function(a,b){ return a.dueDate < b.dueDate ? -1 : 1; });
    return { ok:true, items:items };
  } catch(e){ return { ok:false, msg:String(e) }; }
}
function voidCheque(row, reason) {
  try {
    var s = chqSheet_(); if (row<2||row>s.getLastRow()) return { ok:false, msg:'แถวไม่ถูกต้อง' };
    if (String(s.getRange(row,7).getValue())!=='OUTSTANDING') return { ok:false, msg:'ยกเลิกได้เฉพาะเช็คที่ยังไม่ตัด' };
    s.getRange(row,7).setValue('VOID');
    s.getRange(row,11).setValue((String(s.getRange(row,11).getValue())||'')+' · ยกเลิก: '+String(reason||''));
    return { ok:true, msg:'ยกเลิกเช็คแล้ว (ถ้าตัด AP ไปแล้ว ไปคืนยอดที่หน้า AP เอง)' };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// ── จับเช็คที่มาตัดบัญชีจาก BANK_TRANSACTIONS (เรียกทุกเช้าใน dailyBankJob + รันมือได้) ──
//  เงื่อนไข: BAYC เงินออก + รายละเอียดมี "หมายเลขอ้างอิง : <เลขเช็ค>"
//  ยอดหักบัญชี ≠ ยอดสั่งจ่าย → สถานะ CLEARED_DIFF + แจ้ง
function chqSweep_() {
  var out = [];
  try {
    var cs = chqSheet_(); if (cs.getLastRow()<2) return out;
    var crows = cs.getRange(2,1,cs.getLastRow()-1,H_CHQ.length).getValues();
    var open = {};   // norm(chqNo) → {idx,amt,payee}
    for (var i=0;i<crows.length;i++){
      if (String(crows[i][6])!=='OUTSTANDING') continue;
      open[chqNorm_(crows[i][0])] = { idx:i, amt:Number(crows[i][3])||0, payee:String(crows[i][2]||''), no:String(crows[i][0]) };
    }
    if (!Object.keys(open).length) return out;
    var bs = bankSheet_(); if (bs.getLastRow()<2) return out;
    var brows = bs.getDataRange().getValues();
    for (var j=1;j<brows.length;j++){
      if (String(brows[j][2])!=='OUT') continue;
      if (String(brows[j][1]).indexOf('BAY')!==0) continue;   // เช็คกรุงศรี (BAYC/BAY)
      var m = String(brows[j][5]||'').match(/หมายเลขอ้างอิง\s*[:：]?\s*(\d{6,})/);
      if (!m) continue;
      var key = chqNorm_(m[1]);
      var chq = open[key]; if (!chq) continue;
      var paid = Number(brows[j][3])||0;
      var d = brows[j][0] instanceof Date ? Utilities.formatDate(brows[j][0],'Asia/Bangkok','yyyy-MM-dd') : String(brows[j][0]).slice(0,10);
      var diff = Math.round((paid - chq.amt)*100)/100;
      var st = Math.abs(diff)<0.01 ? 'CLEARED' : 'CLEARED_DIFF';
      cs.getRange(chq.idx+2,7).setValue(st);
      cs.getRange(chq.idx+2,8).setValue(d);
      cs.getRange(chq.idx+2,9).setValue(paid);
      if (st==='CLEARED') out.push('✅ เช็ค '+chq.no+' ('+chq.payee+') ตัดแล้ว ฿'+paid.toLocaleString()+' ('+d+')');
      else out.push('⚠️ เช็ค '+chq.no+' ('+chq.payee+') ยอดไม่ตรง! สั่งจ่าย ฿'+chq.amt.toLocaleString()+' แต่หักบัญชี ฿'+paid.toLocaleString()+' (ต่าง ฿'+diff.toLocaleString()+') — เช็คกับธนาคาร');
      delete open[key];
    }
  } catch(e){ out.push('chqSweep error: '+e); }
  return out;
}
function chqSweep(){ var r = chqSweep_(); return r.length ? r.join('\n') : 'ไม่มีเช็คมาตัดใหม่'; }

// ── ข้อความเตือนครบกำหนด (ผูกกับรายงาน 08:00 — ไม่กินโควตา LINE เพิ่ม) ──
//  เตือนที่: ก่อนครบ 7 วัน · วันครบกำหนด · เกินกำหนดแล้วยังไม่ตัด
function chqDueLines_() {
  var lines = [];
  try {
    var r = getCheques(); if (!r.ok) return lines;
    r.items.forEach(function(c){
      if (c.status!=='OUTSTANDING' || c.daysLeft===null) return;
      var money = '฿'+c.amount.toLocaleString()+' → '+(c.payeeName||c.payeeCode||'-');
      if (c.daysLeft===7)      lines.push('🧾 เช็ค '+c.chqNo+' ครบกำหนดใน 7 วัน ('+c.dueDate+') '+money);
      else if (c.daysLeft===0) lines.push('🧾❗ เช็ค '+c.chqNo+' ครบกำหนดวันนี้ '+money+' — เตรียมเงินในบัญชีกระแส');
      else if (c.daysLeft<0)   lines.push('🧾⏰ เช็ค '+c.chqNo+' เกินกำหนด '+(-c.daysLeft)+' วัน ยังไม่มาตัด '+money);
    });
  } catch(e){}
  return lines;
}

// ── OCR เช็คจากรูปถ่าย (Gemini — คีย์เดียวกับสลิป) → เติมฟอร์มให้ ──
//  อ่าน: เลขเช็ค (แถบเหลือง/MICR) · วันที่หน้าเช็ค (พ.ศ.→ค.ศ.) · จำนวนเงิน · ผู้รับ (ลายมือ)
function ocrCheque(base64, mimeType) {
  try {
    var cfg = getConfig();
    var apiKey = cfg.GEMINI_API_KEY || '';
    if (!apiKey) return { ok:false, msg:'ไม่พบ GEMINI_API_KEY ใน CONFIG' };
    var prompt = 'นี่คือรูปเช็คธนาคารไทย (กรุงศรี) กรุณาอ่านและตอบเป็น JSON เท่านั้น:\n'
      + '{\n'
      + ' "chqNo": "<เลขที่เช็ค Cheque No. — ดูจากแถบตัวเลขด้านล่าง (MICR) หรือช่อง เช็คเลขที่ ปกติ 8 หลัก>",\n'
      + ' "date": "<วันที่หน้าเช็ค รูปแบบ dd/mm/yyyy ปีอาจเป็น พ.ศ. เช่น 28/02/2569>",\n'
      + ' "amount": <จำนวนเงินตัวเลข เช่น 72301.00>,\n'
      + ' "payee": "<ชื่อผู้รับเงินในช่อง จ่าย/Pay (ลายมือ อ่านเท่าที่ได้)>",\n'
      + ' "isCheque": <true ถ้าเป็นเช็คจริง, false ถ้าไม่ใช่>\n'
      + '}\n'
      + 'ถ้าอ่านค่าใดไม่ได้ให้ใส่ null · เลขเช็คเอาเฉพาะตัวเลข';
    var models = ['gemini-2.0-flash-lite','gemini-1.5-flash'];
    var parsed = null;
    for (var m = 0; m < models.length; m++) {
      try {
        var resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[m] + ':generateContent?key=' + apiKey, {
          method:'post', contentType:'application/json', muteHttpExceptions:true,
          payload: JSON.stringify({
            contents:[{ parts:[ {text:prompt}, {inlineData:{ mimeType:mimeType||'image/jpeg', data:base64 }} ] }],
            generationConfig:{ temperature:0, maxOutputTokens:512 }
          })
        });
        if (resp.getResponseCode() !== 200) continue;
        var raw = JSON.parse(resp.getContentText()).candidates[0].content.parts[0].text;
        var match = raw.match(/\{[\s\S]*\}/);
        if (match) { parsed = JSON.parse(match[0]); break; }
      } catch(e2) { continue; }
    }
    if (!parsed) return { ok:false, msg:'OCR อ่านไม่ได้ — ลองถ่ายใหม่ให้ชัด/แสงพอ' };
    if (parsed.isCheque === false) return { ok:false, msg:'รูปนี้ไม่ใช่เช็ค' };
    // แปลงวันที่ พ.ศ. → ค.ศ. → yyyy-MM-dd
    var iso = '';
    var dm = String(parsed.date||'').match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (dm) {
      var y = Number(dm[3]); if (y < 100) y += 2500; if (y > 2400) y -= 543;
      iso = y + '-' + ('0'+dm[2]).slice(-2) + '-' + ('0'+dm[1]).slice(-2);
    }
    return { ok:true,
      chqNo: String(parsed.chqNo||'').replace(/\D/g,''),
      dueDate: iso,
      amount: Number(parsed.amount)||0,
      payee: String(parsed.payee||'') };
  } catch(e){ return { ok:false, msg:String(e) }; }
}
