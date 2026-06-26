// ============================================================
//  line.js — KLH LINE OA Shop (LIFF) backend
//  LIFF ID: 2010316243-qBWR42sj
//  ใช้ซ้ำของเดิม: posSearchProducts, getPosCategories, createOrder,
//                verifySlipGemini, saveSlipToDrive
// ============================================================

// KTB ถุงเงิน QR (static) — ฝั่ง client เติมยอดเอง (dynamic)
var KTB_QR_STATIC_LINE = '00020101021130690016A000000677010112011501075370008820502192A036354TB2000326PG0303KLH53037645802TH620807040000630499B3';

// โหลดค่าตั้งต้นหน้าร้าน LINE
function getLineShopConfig() {
  try {
    var cfg = getConfig();
    return {
      ok: true,
      company:    cfg.COMPANY_NAME || 'KLH',
      logoUrl:    cfg.LOGO_URL || '',
      phone:      cfg.SHOP_PHONE || cfg.PHONE || cfg.TEL || '044-811-040',
      email:      cfg.SHOP_EMAIL || cfg.EMAIL || 'KLH.CHAIYAPHUM@GMAIL.COM',
      address:    cfg.SHOP_ADDRESS || cfg.ADDRESS || 'หน้าตลาดสดเทศบาล 1 ชัยภูมิ',
      ktbQr:      KTB_QR_STATIC_LINE,
      categories: getPosCategories()
    };
  } catch (e) {
    return { ok: false, msg: e.message, ktbQr: KTB_QR_STATIC_LINE, categories: [] };
  }
}

// ── ส่งข้อความเข้ากลุ่ม LINE (ออเดอร์ใหม่ + อัปเดตสถานะ) ──
function pushLineGroup_(text) {
  try {
    var cfg = getConfig();
    var token = cfg.LINE_CHANNEL_TOKEN;
    var gid   = cfg.LINE_GROUP_ID || 'C9936ac4af81efc524493fe83a0a7b328';
    if (!token || !gid) return;
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ to: gid, messages: [{ type: 'text', text: text }] }),
      muteHttpExceptions: true
    });
  } catch (e) { Logger.log('pushLineGroup_ ' + e); }
}

// ทดสอบส่งข้อความเข้ากลุ่ม + บอกผลตรวจ (เรียกผ่าน API ได้)
function testLinePush() {
  try {
    var cfg = getConfig();
    var token = cfg.LINE_CHANNEL_TOKEN;
    var gid   = cfg.LINE_GROUP_ID;
    var out = {
      ok: true,
      tokenFound: !!token,
      tokenPreview: token ? (String(token).slice(0,12) + '...') : '',
      groupIdFromConfig: gid || '',
      lineKeysInConfig: Object.keys(cfg).filter(function(k){ return String(k).indexOf('LINE') >= 0; })
    };
    if (!token) { out.ok = false; out.msg = '❌ ไม่พบ LINE_CHANNEL_TOKEN ใน CONFIG'; return out; }
    var g = gid || 'C9936ac4af81efc524493fe83a0a7b328';
    out.sentTo = g;
    var resp = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method:'post',
      headers:{ 'Authorization':'Bearer '+token, 'Content-Type':'application/json' },
      payload: JSON.stringify({ to:g, messages:[{ type:'text', text:'🔔 ทดสอบแจ้งเตือน KLH เข้ากลุ่ม\n'+ Utilities.formatDate(new Date(),'Asia/Bangkok','dd/MM/yyyy HH:mm:ss') }] }),
      muteHttpExceptions:true
    });
    out.httpCode = resp.getResponseCode();
    out.lineResponse = resp.getContentText();
    out.sent = (out.httpCode === 200);
    if (!out.sent) out.ok = false;
    return out;
  } catch(e) { return { ok:false, msg:String(e) }; }
}

// ตั้งกลุ่ม LINE สำหรับแจ้งเตือน (รันครั้งเดียวใน GAS Editor) — เปลี่ยนทุกการแจ้งเตือนให้เข้าห้องกลุ่ม
function setLineNotifyGroup() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName('CONFIG');
  if (!s) { s = ss.insertSheet('CONFIG'); s.getRange(1,1,1,2).setValues([['KEY','VALUE']]); }
  var gid = 'Cb3abd1785d20129463eeab9e8ce61a62';   // ห้องรายงาน KLH (เปลี่ยน 2026-06-26)
  var rows = s.getDataRange().getValues(); var found = false;
  for (var i=1;i<rows.length;i++){ if (String(rows[i][0])==='LINE_GROUP_ID'){ s.getRange(i+1,2).setValue(gid); found=true; break; } }
  if (!found) s.appendRow(['LINE_GROUP_ID', gid]);
  return 'LINE_GROUP_ID = ' + gid;
}

// เขียนข้อมูลติดต่อร้านลง CONFIG (รันครั้งเดียวใน GAS Editor เพื่อบันทึกถาวร)
function setupShopContact() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName('CONFIG');
  if (!s) { s = ss.insertSheet('CONFIG'); s.getRange(1,1,1,2).setValues([['KEY','VALUE']]); }
  var want = {
    SHOP_PHONE:   '044-811-040',
    SHOP_EMAIL:   'KLH.CHAIYAPHUM@GMAIL.COM',
    SHOP_ADDRESS: 'หน้าตลาดสดเทศบาล 1 ชัยภูมิ'
  };
  var rows = s.getDataRange().getValues();
  Object.keys(want).forEach(function(k){
    var found = false;
    for (var i=1;i<rows.length;i++){ if (String(rows[i][0])===k){ s.getRange(i+1,2).setValue(want[k]); found=true; break; } }
    if (!found) s.appendRow([k, want[k]]);
  });
  return 'CONFIG updated: ' + JSON.stringify(want);
}

// ค้นหาสินค้า (ใช้ posSearchProducts เดิม) — คลัง W1
function lineSearchProducts(query, catFilter) {
  try {
    return posSearchProducts(query || '', 'W1', catFilter || '');
  } catch (e) {
    Logger.log('lineSearchProducts error: ' + e);
    return [];
  }
}

// หาสมาชิกจากเบอร์โทร (CUSTOMER_MASTER: 0 CUST_ID, 1 NAME, 2 PHONE, 5 PRICE_LEVEL, 10 ENTITY)
function lineFindMember(phone, lineUid) {
  try {
    function normPh(x){ return String(x || '').replace(/[^0-9]/g, '').replace(/^0+/, ''); }
    var p = normPh(phone);
    if (p.length < 6) return { ok: false, msg: 'เบอร์โทรไม่ถูกต้อง' };
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CUSTOMER_MASTER');
    if (!s) return { ok: false, msg: 'ไม่พบ CUSTOMER_MASTER' };
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var ph = normPh(rows[i][2]);
      if (ph && ph === p) {
        // ผูก LINE UID ลง NOTE col ถ้ายังไม่มี (เก็บแบบเบาๆ)
        return {
          ok: true, found: true,
          member: {
            custId:     String(rows[i][0] || ''),
            name:       String(rows[i][1] || ''),
            phone:      String(rows[i][2] || ''),
            priceLevel: String(rows[i][5] || 'retail'),
            entity:     String(rows[i][10] || '')
          }
        };
      }
    }
    return { ok: true, found: false };   // ลูกค้าใหม่ (guest)
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// สร้างออเดอร์จาก LINE → เข้า ORDERS (source=LINE OA) ให้แคชเชียร์/Staff เห็น
function createLineOrder(payload) {
  // payload = { customerCode, customerName, phone, lineUid, deliveryType('pickup'|'delivery'),
  //             address, items:[{barcode,name,qty,unit,unitPrice,lineTotal,convRate,unitBig}],
  //             subtotal, total, note }
  try {
    var items = (payload.items || []).map(function (it) {
      return {
        barcode:     it.barcode || '',
        name:        it.name || '',
        qty:         Number(it.qty) || 0,
        unit:        it.unit || 'ชิ้น',
        unitPrice:   Number(it.unitPrice) || 0,
        discountAmt: 0,
        lineTotal:   Number(it.lineTotal) || 0,
        convRate:    Number(it.convRate) || 1,
        unitBig:     it.unitBig || ''
      };
    });
    if (!items.length) return { ok: false, msg: 'ตะกร้าว่าง' };

    var deliv = (payload.deliveryType === 'delivery')
      ? ('จัดส่ง: ' + (payload.address || '-'))
      : 'รับเองที่ร้าน';
    var note = 'LINE OA | ' + deliv
      + (payload.phone ? (' | โทร ' + payload.phone) : '')
      + (payload.lineUid ? (' | UID:' + payload.lineUid) : '')
      + (payload.note ? (' | ' + payload.note) : '');

    var res = createOrder({
      entity:       'ห้างหุ้นส่วนจำกัด เคแอลเอช',
      device:       'LINE',
      source:       'LINE OA',
      customerCode: payload.customerCode || '',
      customerName: payload.customerName || 'ลูกค้า LINE',
      whId:         'W1',
      items:        items,
      subtotal:     Number(payload.subtotal) || 0,
      discount:     0,
      total:        Number(payload.total) || 0,
      note:         note
    });
    // แจ้งเตือนเข้ากลุ่ม LINE
    if (res && res.ok) {
      try {
        pushLineGroup_('🛒 ออเดอร์ใหม่จาก LINE\n'
          + 'เลขที่: ' + res.orderId + '\n'
          + 'ลูกค้า: ' + (payload.customerName || 'ลูกค้า LINE') + '\n'
          + 'ยอด: ฿' + (Number(payload.total)||0).toLocaleString('th-TH') + '\n'
          + deliv
          + (payload.note ? ('\nชำระ: ' + payload.note) : ''));
      } catch(e) {}
    }
    return res;   // { ok, orderId, msg }
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// โปรโมชั่น — sheet PROMOTIONS (NAME · PRICE · IMAGE_URL · NOTE · ACTIVE)
// 6 ตัวอย่างเริ่มต้น (ใส่ครั้งแรกถ้า sheet ว่าง)
var PROMO_SAMPLES_ = [
  ['ข้าวหอมมะลิ 5 กก.', 165, '', 'ปกติ 195 — ลดเหลือ 165 บาท', 'TRUE'],
  ['น้ำมันพืช 1 ลิตร ซื้อ 2 แถม 1', 0, '', 'ซื้อ 2 ขวด แถมฟรี 1 ขวด', 'TRUE'],
  ['น้ำปลาทิพรส 700ml แพ็คคู่', 65, '', '2 ขวด เพียง 65 บาท', 'TRUE'],
  ['ไข่ไก่เบอร์ 2 (แผง 30 ฟอง)', 99, '', 'สดใหม่ทุกวัน 99 บาท/แผง', 'TRUE'],
  ['ผงซักฟอก 3 กก. ลด 20%', 0, '', 'ลดทันที 20% ทุกสูตร', 'TRUE'],
  ['น้ำดื่ม แพ็ค 12 ขวด', 45, '', 'ยกแพ็ค 12 ขวด 45 บาท', 'TRUE']
];
function _promoSheet_(seedIfEmpty){
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var s = ss.getSheetByName('PROMOTIONS');
  if (!s){
    s = ss.insertSheet('PROMOTIONS');
    s.getRange(1,1,1,5).setValues([['NAME','PRICE','IMAGE_URL','NOTE','ACTIVE']]);
    s.getRange(1,1,1,5).setFontWeight('bold').setBackground('#F6704C').setFontColor('#fff');
  }
  if (seedIfEmpty && s.getLastRow() <= 1){
    s.getRange(2,1,PROMO_SAMPLES_.length,5).setValues(PROMO_SAMPLES_);
  }
  return s;
}

// ฝั่งลูกค้า LINE — เฉพาะ ACTIVE
function getPromotions(){
  try {
    var s = _promoSheet_(true);
    if (s.getLastRow() <= 1) return { ok:true, items:[] };
    var rows = s.getRange(2,1,s.getLastRow()-1,5).getValues();
    var items = rows.filter(function(r){ return r[0] && String(r[4]).toUpperCase() !== 'FALSE'; })
      .map(function(r){ return { name:String(r[0]), price:Number(r[1])||0, image:String(r[2]||''), note:String(r[3]||'') }; });
    return { ok:true, items:items };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// ฝั่ง staff — ทั้งหมด (รวมที่ปิดอยู่) พร้อมเลขแถวสำหรับแก้ไข
function getAllPromotions(){
  try {
    var s = _promoSheet_(true);
    if (s.getLastRow() <= 1) return { ok:true, items:[] };
    var rows = s.getRange(2,1,s.getLastRow()-1,5).getValues();
    var items = rows.map(function(r,i){
      return { row:i+2, name:String(r[0]||''), price:Number(r[1])||0, image:String(r[2]||''),
               note:String(r[3]||''), active: String(r[4]).toUpperCase() !== 'FALSE' };
    }).filter(function(it){ return it.name; });
    return { ok:true, items:items };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// เพิ่ม/แก้ไขโปรโมชั่น — p.row>0 = แก้ไขแถวนั้น, ไม่งั้น = เพิ่มใหม่
function savePromotion(p){
  try {
    if (!p || !String(p.name||'').trim()) return { ok:false, msg:'กรุณากรอกชื่อโปรโมชั่น' };
    var s = _promoSheet_(false);
    var vals = [ String(p.name).trim(), Number(p.price)||0, String(p.image||''),
                 String(p.note||''), (p.active===false?'FALSE':'TRUE') ];
    if (p.row && Number(p.row) >= 2){
      s.getRange(Number(p.row),1,1,5).setValues([vals]);
      return { ok:true, msg:'บันทึกแล้ว', row:Number(p.row) };
    }
    s.appendRow(vals);
    return { ok:true, msg:'เพิ่มโปรโมชั่นแล้ว', row:s.getLastRow() };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// ลบโปรโมชั่นตามเลขแถว
function deletePromotion(row){
  try {
    var r = Number(row); if (!r || r < 2) return { ok:false, msg:'แถวไม่ถูกต้อง' };
    var s = _promoSheet_(false);
    if (r > s.getLastRow()) return { ok:false, msg:'ไม่พบแถว' };
    s.deleteRow(r);
    return { ok:true, msg:'ลบแล้ว' };
  } catch(e){ return { ok:false, msg:String(e) }; }
}

// สมัครสมาชิกจาก LINE → addCustomer เดิม (บังคับ retail, ไม่มีเครดิต)
// ลูกค้ากรอกเองได้แค่ฟิลด์พื้นฐาน — ราคาส่ง/เครดิตให้ staff ปรับทีหลัง
function lineRegisterMember(data) {
  try {
    if (!data || !String(data.name||'').trim()) return { ok:false, msg:'กรุณากรอกชื่อ' };
    if (String(data.phone||'').replace(/[^0-9]/g,'').length < 6) return { ok:false, msg:'เบอร์โทรไม่ถูกต้อง' };
    var noteParts = [];
    if (data.memberType) noteParts.push(data.memberType === 'shop' ? 'ร้านค้า' : 'บุคคล');
    if (data.lineUid)   noteParts.push('LINE:' + data.lineUid);
    var res = addCustomer({
      name:        String(data.name).trim(),
      phone:       String(data.phone).trim(),
      address:     data.address || '',
      taxId:       data.taxId || '',
      priceLevel:  'retail',     // บังคับเสมอ
      creditLimit: 0,
      creditDays:  0,
      note:        noteParts.join(' | '),
      entity:      ''
    });
    return res;   // { ok, custId }
  } catch (e) {
    return { ok:false, msg:e.message };
  }
}

// โปรไฟล์ของฉัน (ฝั่งลูกค้า) — เห็นเฉพาะข้อมูลตัวเอง
// ❌ ไม่ส่ง creditLimit / outstanding / AR / สมาชิกคนอื่น
function lineGetMyProfile(custId) {
  try {
    var c = getCustomerById(custId);
    if (!c) return { ok:false, msg:'ไม่พบสมาชิก' };
    var orders = 0, spent = 0;
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName('SALES_HEADER');
    if (s && s.getLastRow() > 1) {
      var rows = s.getDataRange().getValues().slice(1);
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][5]).trim() === String(custId).trim()) { orders++; spent += Number(rows[i][9]) || 0; }
      }
    }
    return {
      ok: true,
      custId: c.custId, name: c.name, phone: c.phone, address: c.address,
      priceLevel: c.priceLevel,
      orders: orders, spent: spent, points: Math.floor(spent / 100)
    };
  } catch (e) {
    return { ok:false, msg:e.message };
  }
}

// สมาชิก LINE แก้ข้อมูลตัวเอง (ชื่อ/เบอร์/ที่อยู่ — ไม่แตะราคา/เครดิต)
function lineUpdateMember(custId, data) {
  try {
    if (!custId) return { ok:false, msg:'ยังไม่ได้เป็นสมาชิก' };
    return updateCustomer(custId, { name:data.name, phone:data.phone, address:data.address });
  } catch (e) { return { ok:false, msg:String(e) }; }
}

// สมาชิก LINE ดูบิลค้างชำระของตัวเอง
function lineGetMyAr(custId) {
  try {
    if (!custId) return { ok:true, items:[], total:0 };
    var r = getArByCustomer(custId, '');
    if (!r || !r.ok) return r || { ok:false, msg:'โหลดไม่สำเร็จ' };
    var items = (r.items || []).filter(function(a){ return (Number(a.balance)||0) > 0; });
    var total = items.reduce(function(t,a){ return t + (Number(a.balance)||0); }, 0);
    return { ok:true, items:items, total:total };
  } catch (e) { return { ok:false, msg:String(e) }; }
}

// สมาชิก LINE ชำระหนี้ออนไลน์ (แนบสลิป → ตรวจ Gemini → ถ้ายอดตรงตัดให้เลย ไม่ตรงแจ้งแอดมิน)
function linePayArSlip(custId, arId, amount, base64, mimeType) {
  try {
    var verify = verifySlipGemini(base64, mimeType, amount);
    saveSlipToDrive(base64, mimeType, arId);
    var amt = (verify && verify.amount) ? Number(verify.amount) : 0;
    var matched = amt && Math.abs(amt - Number(amount)) < 1;
    if (matched) {
      payArEntry(arId, Number(amount));
      pushLineGroup_('💰 ลูกค้าชำระหนี้ออนไลน์ (ยอดตรง ✅)\nAR: ' + arId + '\nลูกค้า: ' + custId
        + '\nยอด: ฿' + Number(amount).toLocaleString('th-TH') + '\nตัดยอดให้อัตโนมัติแล้ว');
      return { ok:true, matched:true, msg:'ชำระสำเร็จ — ยอดตรง ตัดหนี้ให้แล้ว' };
    }
    pushLineGroup_('⚠️ ลูกค้าแนบสลิปชำระหนี้ (รอตรวจ)\nAR: ' + arId + '\nลูกค้า: ' + custId
      + '\nต้องชำระ ฿' + Number(amount).toLocaleString('th-TH') + (amt ? ('\nยอดในสลิป ฿' + amt.toLocaleString('th-TH')) : '')
      + '\nโปรดตรวจสอบและตัดยอดที่แคชเชียร์');
    return { ok:true, matched:false, msg:'รับสลิปแล้ว แอดมินจะตรวจสอบและตัดยอดให้' };
  } catch (e) { return { ok:false, msg:String(e) }; }
}

// แนบสลิปกับออเดอร์ LINE (ตรวจ Gemini + เซฟ Drive — ใช้ของเดิม)
function lineAttachSlip(orderId, base64, mimeType, expectedAmount) {
  try {
    var verify = verifySlipGemini(base64, mimeType, expectedAmount) || {};
    // รูปนี้ไม่ใช่สลิปโอนเงิน → ปฏิเสธ ไม่บันทึก
    if (verify.isSlip === false) {
      return { ok: true, isSlip: false, matched: false, msg: 'รูปนี้ไม่ใช่สลิปโอนเงิน' };
    }
    var saved   = saveSlipToDrive(base64, mimeType, orderId) || {};
    var slipUrl = saved.url || '';
    var amt     = verify.amount ? Number(verify.amount) : 0;
    var matched = amt && Math.abs(amt - Number(expectedAmount)) < 1;
    // อัปเดตออเดอร์ + เก็บลิงก์สลิป + แจ้งกลุ่ม (แคชเชียร์เปิดดูสลิป/ยอดได้)
    try {
      var s = _ordSheet_(), row = _ordRow_(s, orderId);
      if (row > 0) {
        var cust = String(s.getRange(row, 9).getValue() || '');
        var note = String(s.getRange(row, 15).getValue() || '');
        var add  = ' | SLIP:' + slipUrl + (amt ? (' | สลิปยอด:' + amt) : '');
        if (matched) {
          s.getRange(row, 13).setValue('PAID');                 // ยอดตรง → ชำระแล้วอัตโนมัติ
          s.getRange(row, 15).setValue(note + add + ' (ยอดตรง)');
          pushLineGroup_('💰 โอนออนไลน์ ยอดตรง ✅\n' + orderId + '\nลูกค้า: ' + cust
            + '\nยอด ฿' + Number(expectedAmount).toLocaleString('th-TH')
            + (verify.bank ? ('\nธนาคาร: ' + verify.bank) : '')
            + '\nสลิป: ' + slipUrl + '\nสถานะ: ชำระแล้ว — เตรียมจัดของได้');
        } else {
          s.getRange(row, 15).setValue(note + add + ' (รอตรวจ)');  // คงสถานะ PENDING
          pushLineGroup_('⚠️ แนบสลิป รอแคชเชียร์ตรวจ\n' + orderId + '\nลูกค้า: ' + cust
            + '\nต้องชำระ ฿' + Number(expectedAmount).toLocaleString('th-TH')
            + (amt ? ('\nยอดในสลิป ฿' + amt.toLocaleString('th-TH') + ' (ไม่ตรง)') : '\n(อ่านยอดในสลิปไม่ได้)')
            + '\nสลิป: ' + slipUrl + '\nกดดูสลิป + ยืนยันที่แคชเชียร์');
        }
      }
    } catch (eU) { Logger.log('lineAttachSlip update: ' + eU); }
    return { ok: true, isSlip: true, matched: matched, amt: amt, slipUrl: slipUrl };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}
