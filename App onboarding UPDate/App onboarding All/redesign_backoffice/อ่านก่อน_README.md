# KLH หลังบ้าน — Redesign 6 หน้า (ธีม KLH ใหม่) — Handoff สำหรับ Claude Code

> ดีไซน์ **หน้าตาใหม่** ของ 6 โมดูลในระบบ KLH-ERP จริง (Google Apps Script)
> **กฎเหล็ก: ทำเฉพาะ UI/หน้าตา · ห้ามแก้ลำดับขั้นตอน · ห้ามตัดปุ่ม · ห้ามแตะ logic/ฟังก์ชันเดิม**
> เอา UI ใหม่ไปครอบฟังก์ชันเดิม (`google.script.run.xxx`) — ชื่อฟิลด์/ID/คอลัมน์คงเดิมทั้งหมด

อ้างอิงจากไฟล์จริงใน `github.com/klhchaiyaphum-tech/KLH-ERP` — อ่านโครงสร้าง ฟิลด์ และฟังก์ชัน backend มาแล้ว ดีไซน์ใหม่ใช้ **ธีม KLH เดียวกัน** (ส้มคอรัล `#F6704C`/`#E2502B`, ครีม, IBM Plex Sans Thai, การ์ดกลมมน เงานุ่ม สไตล์ macOS)

---

## 6 หน้าในแพ็กเกจ

| # | ไฟล์ HTML | ของจริง (GAS) | ฟังก์ชัน backend ที่ต้องคงไว้ |
|---|---|---|---|
| 1 | `1 ลูกหนี้ Customer & AR.html` | `customer.html` | `getAllCustomers` · `addCustomer` · `updateCustomer` · `getArByCustomer` · `getArSummary` · `payArEntry` |
| 2 | `2 บริหารคลัง WMS.html` | `wms.html` | `getWmsData` · `receiveGoods` · `transferGoods` · `getStockBalance` · `adjustStock` · `createPickList` · `getPickLists` · `updatePickItem` · `completePickList` · `getRopConfig` · `saveRopConfigs` · `lookupSkuForWms` |
| 3 | `3 สแกนบิล OCR.html` | `ocr.html` | `getOcrPageData` · `uploadInvoiceFile` · `lookupSupplierForOcr` · `lookupProductsForOcr` · `saveInvoiceOcr` · `doBatchReceive` · `getOcrHistory` |
| 4 | `4 เจ้าหนี้ Supplier.html` | `supplier.html` | `getSupplierList` · `addNewSupplier` · `updateSupplier` · `deleteSupplier` |
| 5 | `5 แคชเชียร์ Cashier.html` | `pos_cashier.html` | `getPosPageData` · `getPendingOrders` · `loadOrderById` · `closeSale` |
| 6 | `6 POS ขายหน้าร้าน.html` | `pos.html` · `pos_pc.html` · `pos_t2.html` | `getPosPageData` · createOrder/holdOrder/resumeOrder · member lookup |

> เปิดไฟล์ HTML ในเบราว์เซอร์กดเล่นได้จริง (เป็นภาพอ้างอิงเชิงโต้ตอบ ไม่ใช่โค้ดโปรดักชัน)

---

## รายละเอียดต่อหน้า (โครง/แท็บ/ปุ่ม ที่ต้องคงครบ)

### 1) ลูกหนี้ Customer & AR — 2 แท็บ
- **สมาชิก**: ตาราง (รหัส/ชื่อ/เบอร์/ระดับราคา/วงเงิน/ค้างชำระ/เทอม) + ปุ่ม แก้ไข · ดู AR · เพิ่มสมาชิก → modal ฟอร์ม (ชื่อ*/เบอร์/TAX/ระดับราคา retail-wholesale-vip/วงเงิน/เทอม/ที่อยู่/หมายเหตุ)
- **ลูกหนี้การค้า (AR)**: KPI (ยอดรวม/เกินกำหนด/รายการ) + ฟิลเตอร์สถานะ (UNPAID/PARTIAL/OVERDUE/PAID) + ตาราง + ปุ่ม **รับเงิน** → modal `payArEntry` (รับบางส่วนได้)

### 2) บริหารคลัง WMS — 5 แท็บ (ห้ามสลับลำดับ)
รับสินค้า (สแกน+auto-fill+แปลงหน่วยลัง→ชิ้น) · โอนสินค้า (preview สต็อก) · ดูสต็อก (ฟิลเตอร์คลัง+ปรับสต็อก) · Pick List (สร้าง+รายการ+ทำเสร็จ) · ตั้งค่า ROP (ตาราง inline edit ROP/ROQ/Max/Active)

### 3) สแกนบิล OCR — wizard 3 ขั้น
① อัปโหลด (เลือกกิจการ*+drop zone+กรอกเอง) → ② ตรวจสอบ (split: รูปบิล+OCR text ซ้าย / chip OCR+ฟอร์มใบกำกับ+ค้นซัพพลายเออร์+รายการสินค้า ซื้อ/แถม/ทุนจริง+VAT type+ยอดรวม ขวา) → ③ บันทึก (+ รับเข้าคลัง WMS เลือกคลัง) · ปุ่ม **ประวัติ**

### 4) เจ้าหนี้ Supplier — ตารางเดียว
รหัส/ชื่อ/ผู้ติดต่อ/เบอร์/TAX/บัญชีโอน/เครดิต + ปุ่ม แก้ไข · ลบ (ยืนยัน) · เพิ่ม → modal 2 ส่วน: ข้อมูลพื้นฐาน + ข้อมูลการชำระเงิน (ธนาคาร/เลขบัญชี/เช็คสั่งจ่าย/เทอม)

### 5) แคชเชียร์ Cashier — full-screen terminal
ซ้าย: สแกน QR/กรอกเลขออเดอร์ + แท็บออเดอร์ที่โหลด (merge หลายบิล) + ข้อมูลลูกค้า + รายการ + **ออเดอร์รอชำระ** (auto-refresh). ขวา: แผงดำยอด+ส่วนลด (฿/%)+**Tigercashbox** (ลิ้นชัก/พิมพ์) + 3 วิธีจ่าย **เงินสด** (คีย์แพด+ปุ่มเงินด่วน+เงินทอน) / **QR ถุงเงิน KTB** / **เชื่อ (AR)** + ปุ่มปิดบิล+ตัดสต็อก + หน้าสำเร็จ (พิมพ์/ปิดบิลถัดไป)

### 6) POS ขายหน้าร้าน — 3 เครื่อง (สลับด้วย segment)
- **PC**: 3 คอลัมน์ (หมวด+ค้นหา / catalog grid / order panel) + แท็บบิล + พักบิล
- **T2 Lite**: จอขายสัมผัส (ในกรอบเครื่อง+ขาตั้ง) + **จอลูกค้า** แยก (รายการเรียลไทม์+ยอดสุทธิ)
- **Handheld**: มือถือ catalog 2 คอลัมน์ + แถบตะกร้าล่าง + พิมพ์บิล QR
- ทุกเครื่อง: เลือกสมาชิก→ราคาส่งอัตโนมัติ · **พักบิล/เปิดบิลใหม่/เรียกบิลเดิม** · พิมพ์บิล QR รอชำระที่แคชเชียร์

---

## ไฟล์ร่วม (shared)
| ไฟล์ | หน้าที่ |
|---|---|
| `klh-theme.css` | โทเคนสี/ฟอนต์ + window/tabs/table/pill/modal/kpi/form/button (ทุกหน้าใช้ร่วม) |
| `klh-ui.jsx` | `ICO` (ไอคอน), `baht()`, `Win`, `Modal`, `Field`, `useToast` |
| `klh-cashier.css` / `klh-pos.css` | สไตล์เฉพาะแคชเชียร์ / POS |
| `data-*.js` | ข้อมูลตัวอย่างต่อหน้า (ของจริงดึงจาก backend) |
| `page-*.jsx` | โค้ดแต่ละหน้า |

## Design tokens
ส้มคอรัล `#F6704C` / เข้ม `#E2502B` / อ่อน `#FCE6DC` · น้ำเงิน `#3A37C9` · เขียว `#2E9E55` · แดง `#D9512B` · ม่วง `#6A1B9A` · ครีม `#F1EBDE` · ink `#2A2521`/`#6B6258`/`#A89E90` · ฟอนต์ IBM Plex Sans Thai + IBM Plex Sans (ตัวเลข)

---

## ประโยคสั่ง Claude Code
> อ่านโฟลเดอร์ handoff นี้ทั้งหมด แล้วปรับ **หน้าตา/CSS/layout** ของหน้า `customer` / `wms` / `ocr` / `supplier` / `pos_cashier` / `pos_pc`·`pos_t2`·`pos` ในระบบ GAS ให้ตรงดีไซน์ KLH ใหม่นี้ — **ห้ามเปลี่ยนลำดับขั้นตอน ห้ามตัดปุ่ม ห้ามแก้ logic** เก็บ `google.script.run.*`, ชื่อฟิลด์/ID, คอลัมน์ชีต และฟังก์ชันเดิมทั้งหมด ทำทีละหน้าแล้วเทสไม่ให้ของเดิมพัง
