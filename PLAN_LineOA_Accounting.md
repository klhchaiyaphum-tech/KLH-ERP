# แผนพัฒนา: LINE OA Shopping + ระบบรายงานบัญชี
> วางแผนโดย Claude — KLH ERP Phase ถัดไป

---

# ════════════════════════════════════
# ฟีเจอร์ 1: LINE OA Shopping (Rich Menu)
# ════════════════════════════════════

## ภาพรวม Flow
```
ลูกค้าเปิด LINE OA → Rich Menu "สั่งสินค้า"
  ↓
LIFF เปิดหน้าเว็บ (GAS) → Login ด้วยเบอร์โทร
  ↓ (match เบอร์ใน CUSTOMER_MASTER + ผูก LINE UserID อัตโนมัติ)
ดูสินค้า (ตามระดับราคาของลูกค้า) → เพิ่มลงตะกร้า
  ↓
เลือก: 🚚 จัดส่ง / 🏪 มารับเอง
  ↓
สร้างออเดอร์ → แสดง QR ถุงเงิน (ตามยอด)
  ↓
ลูกค้าโอน → ถ่ายสลิป → Gemini OCR ตรวจยอด
  ↓
ออเดอร์เข้า "POS Order LINE" (หน้าใหม่) → แจ้งเตือน
  ↓
Staff เห็นออเดอร์ → พิมพ์ใบสั่ง → จัดของ
```

## Login: เบอร์โทร + LINE UserID
- ลูกค้าพิมพ์เบอร์ → match `CUSTOMER_MASTER`
- ถ้าเจอ → บันทึก LINE UserID ลง column ใหม่ `LINE_UID`
- ครั้งต่อไป → ใช้ LINE UserID auto-login (ไม่ต้องพิมพ์เบอร์)
- ถ้าไม่เจอเบอร์ → สมัครสมาชิกใหม่ (ลูกค้าทั่วไป retail)

## หน้าที่ต้องสร้าง
| หน้า/ไฟล์ | URL | ทำอะไร |
|-----------|-----|--------|
| `line_shop.html` | `?page=line_shop` | LIFF — เลือกสินค้า + ตะกร้า |
| `line_checkout.html` | (ใน line_shop) | QR ชำระ + ถ่ายสลิป |
| `pos_order_line.html` | `?page=order_line` | หน้า Staff ดูออเดอร์ LINE เข้าใหม่ |

## ตรวจสลิป: Gemini OCR
- ลูกค้าถ่ายสลิปใน LIFF → Gemini อ่านยอด (มีอยู่แล้ว `verifySlipGemini`)
- เทียบยอดออเดอร์ → ผ่าน = ยืนยัน, ไม่ผ่าน = แจ้ง Staff ตรวจ
- บันทึกสลิปลง Drive (มีแล้ว `saveSlipToDrive`)

## Sheet ใหม่
- `LINE_ORDERS` — ออเดอร์จาก LINE (เพิ่ม field: delivery_type, line_uid, slip_url)
- เพิ่ม column `LINE_UID` ใน CUSTOMER_MASTER

## พิมพ์ใบสั่ง
- หน้า POS Order LINE มีปุ่ม "พิมพ์ใบสั่ง"
- ใช้ template เดียวกับ slip ปกติ + รายการสินค้า + ที่อยู่จัดส่ง

## สิ่งที่ต้องตั้งก่อน (LINE Developer)
- [ ] LINE Official Account
- [ ] LINE Login Channel (LIFF app)
- [ ] Messaging API Channel + Access Token
- [ ] Rich Menu (ออกแบบ + upload)
- [ ] LIFF Endpoint URL = GAS exec URL ?page=line_shop

---

# ════════════════════════════════════
# ฟีเจอร์ 2: ระบบรายงานบัญชี + LINE
# ════════════════════════════════════

## ภาพรวม Flow
```
อีเมลธนาคารเข้า Gmail ทุกวัน
  ├── กรุงไทย (Krungthai Business) — Account Statement
  └── กรุงศรี (Krungsri Biz Mung-Mee) — รายงานใช้บริการ
  ↓
GAS อ่านอีเมล (time trigger ทุกเช้า)
  ↓
ดึงยอดจาก attachment / เนื้อหา
  ↓
แยกประเภท:
  • กรุงไทย รับเข้า = ยอดขาย (สำหรับ VAT) ✅
  • กรุงศรี:
      - ยอดที่ตรงกับโอนออกจากกรุงไทย = "โยกเงิน" (ไม่นับขาย)
      - ยอดรับเข้าอื่นๆ = ยอดขาย (รวมกับกรุงไทย)
  ↓
สร้างรายงานแยก 2 ธนาคาร
  ↓
ส่ง LINE (แบบ Line Notify.gs)
  ↓
บันทึกลง Sheet ACCOUNTING_DAILY
```

## Logic การแยกยอด

### กรุงไทย (KTB)
```
ยอดรับเข้าทั้งหมด = ยอดขายผ่าน KTB (VAT base)
```

### กรุงศรี (BAY)
```
สำหรับแต่ละรายการรับเข้า:
  IF ยอด == ยอดโอนออกจากกรุงไทย (วันเดียวกัน ± buffer)
    → ประเภท = "โยกเงิน" (ไม่นับเป็นขาย)
  ELSE
    → ประเภท = "ยอดขาย BAY"

ยอดขายรวม = ยอดขาย KTB + ยอดขาย BAY (แยกแสดง)
```

## เมนูใหม่: รายงานบัญชี
| หน้า/ไฟล์ | URL | ทำอะไร |
|-----------|-----|--------|
| `accounting.html` | `?page=accounting` | Dashboard ยอดเงินโอน 2 ธนาคาร |

แสดง:
- ยอดขายวันนี้ (KTB / BAY / รวม)
- ยอดโยกเงิน (KTB→BAY)
- รายการเดินบัญชีแต่ละธนาคาร
- กราฟยอดขายรายวัน/เดือน

## Sheet ใหม่
- `ACCOUNTING_DAILY` — บันทึกยอดรายวัน (date, ktb_sale, bay_sale, transfer, total)
- `BANK_TRANSACTIONS` — รายการเดินบัญชีดิบ (จากอีเมล)

## GAS Functions ที่ต้องเขียน
```javascript
// อ่านอีเมลธนาคาร
function fetchBankEmails() {
  // search Gmail: from:Krungthai.BizMungMee@krungsri.com
  // search Gmail: from:noreply@krungthai.com
  // ดึง attachment (statement) หรือ parse เนื้อหา
}

// แยกยอดขาย vs โยกเงิน
function categorizeTransactions(ktbTxns, bayTxns) {
  // จับคู่โอนออก KTB กับ รับเข้า BAY = โยกเงิน
}

// ส่งรายงาน LINE (ดัดแปลงจาก Line Notify.gs)
function sendDailyReportToLine() {
  // ใช้ Messaging API push
}

// Time trigger ทุกเช้า
function setupDailyTrigger() {
  // ScriptApp time-based trigger 8:00 AM
}
```

## ตัวอย่างข้อความ LINE
```
📊 รายงานยอดขาย KLH
📅 วันที่ 4 มิ.ย. 2569

🟦 กรุงไทย (VAT)
   รับเข้า: 12,450.00 บาท

🟧 กรุงศรี
   ยอดขาย: 3,200.00 บาท
   โยกเงิน: 10,000.00 บาท (ไม่นับขาย)

💰 ยอดขายรวม: 15,650.00 บาท
```

---

# ════════════════════════════════════
# ลำดับการทำ (แนะนำ)
# ════════════════════════════════════

## Phase A: รายงานบัญชี (ง่ายกว่า ทำก่อน)
1. สร้าง `fetchBankEmails()` อ่านอีเมล 2 ธนาคาร
2. Parse ยอด + แยกประเภท
3. หน้า `accounting.html` แสดงผล
4. ส่ง LINE รายวัน + time trigger

## Phase B: LINE OA Shopping (ใหญ่ ต้องตั้ง LINE Dev)
1. ตั้ง LINE Developer (Login + Messaging + Rich Menu)
2. `line_shop.html` (LIFF) — เลือกสินค้า + ตะกร้า
3. Checkout + QR + ถ่ายสลิป
4. `pos_order_line.html` — Staff ดูออเดอร์

---

# ข้อมูลที่มีอยู่แล้ว (ใช้ต่อได้)
- ✅ `verifySlipGemini` — ตรวจสลิป
- ✅ `saveSlipToDrive` — บันทึกสลิป
- ✅ genKtbQr — สร้าง QR ตามยอด (ใน slip.html/cashier)
- ✅ Line Notify.gs script (token + groupId)
- ✅ CUSTOMER_MASTER + ระดับราคา
- ✅ posSearchProducts — ดึงสินค้า

# ข้อมูลที่ต้องขอเพิ่ม
- [ ] รูปแบบอีเมลกรุงไทย (attachment เป็น CSV/PDF/Excel?)
- [ ] รูปแบบอีเมลกรุงศรี (attachment เป็นอะไร?)
- [ ] LINE Channel Access Token (ตัวใหม่สำหรับ KLH)
- [ ] LINE Group ID / User ID สำหรับส่งรายงาน

---
*สร้าง 5 มิ.ย. 2569 — รอเริ่ม Phase A*
