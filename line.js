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
      phone:      cfg.SHOP_PHONE || cfg.PHONE || cfg.TEL || '',
      email:      cfg.SHOP_EMAIL || cfg.EMAIL || '',
      address:    cfg.SHOP_ADDRESS || cfg.ADDRESS || '',
      ktbQr:      KTB_QR_STATIC_LINE,
      categories: getPosCategories()
    };
  } catch (e) {
    return { ok: false, msg: e.message, ktbQr: KTB_QR_STATIC_LINE, categories: [] };
  }
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
    var p = String(phone || '').replace(/[^0-9]/g, '');
    if (p.length < 6) return { ok: false, msg: 'เบอร์โทรไม่ถูกต้อง' };
    var s = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CUSTOMER_MASTER');
    if (!s) return { ok: false, msg: 'ไม่พบ CUSTOMER_MASTER' };
    var rows = s.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var ph = String(rows[i][2] || '').replace(/[^0-9]/g, '');
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
    return res;   // { ok, orderId, msg }
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// โปรโมชั่น — staff แก้เองใน sheet PROMOTIONS (NAME · PRICE · IMAGE_URL · NOTE · ACTIVE)
function getPromotions(){
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var s = ss.getSheetByName('PROMOTIONS');
    if (!s){
      s = ss.insertSheet('PROMOTIONS');
      s.getRange(1,1,1,5).setValues([['NAME','PRICE','IMAGE_URL','NOTE','ACTIVE']]);
      s.getRange(1,1,1,5).setFontWeight('bold').setBackground('#F6704C').setFontColor('#fff');
      return { ok:true, items:[] };
    }
    if (s.getLastRow() <= 1) return { ok:true, items:[] };
    var rows = s.getRange(2,1,s.getLastRow()-1,5).getValues();
    var items = rows.filter(function(r){ return r[0] && String(r[4]).toUpperCase() !== 'FALSE'; })
      .map(function(r){ return { name:String(r[0]), price:Number(r[1])||0, image:String(r[2]||''), note:String(r[3]||'') }; });
    return { ok:true, items:items };
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

// แนบสลิปกับออเดอร์ LINE (ตรวจ Gemini + เซฟ Drive — ใช้ของเดิม)
function lineAttachSlip(orderId, base64, mimeType, expectedAmount) {
  try {
    var verify = verifySlipGemini(base64, mimeType, expectedAmount);
    var saved  = saveSlipToDrive(base64, mimeType, orderId);
    return { ok: true, verify: verify, saved: saved };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}
