# Handoff: POS Handheld — แบบ B "รายการเร็ว" (Fast List)

> เอกสารส่งงานให้ทีมพัฒนา (Claude Code) นำดีไซน์ไปสร้างในโปรแกรม POS เดิมที่มีอยู่แล้ว

---

## Overview

หน้าจอ **เลือกสินค้า → เพิ่มลงตะกร้า → สรุปออเดอร์/ชำระเงิน** สำหรับเครื่อง **POS มือถือ Android แนวตั้ง (สไตล์ Sunmi)** ของ **ร้านค้าปลีก/ส่ง** ภาษาไทยล้วน

แบบ B ออกแบบมาเพื่อ **ร้านที่มีสินค้า (SKU) จำนวนมากและต้องคีย์เร็ว**: ใช้ **แถบหมวดหมู่แนวตั้งด้านซ้าย** + **รายการสินค้าแบบหนาแน่น (dense list)** ที่มีปุ่ม `+ / −` ในแต่ละแถว + **ช่องค้นหา/สแกนบาร์โค้ดด้านบน** ไม่เน้นรูปสินค้า เน้นความเร็วในการหยิบของลงตะกร้า

This screen is one of three explored directions (A grid / **B list** / C split-cart). The customer chose **B**.

---

## About the Design Files

ไฟล์ในแพ็กเกจนี้คือ **ดีไซน์อ้างอิงที่สร้างด้วย HTML/React (ผ่าน Babel ในเบราว์เซอร์)** — เป็น *prototype* ที่แสดง "หน้าตาและพฤติกรรมที่ต้องการ" **ไม่ใช่โค้ดโปรดักชันที่จะก๊อปไปใช้ตรงๆ**

งานของผู้พัฒนาคือ **สร้างดีไซน์นี้ขึ้นใหม่ในโค้ดเบส/เฟรมเวิร์กเดิมของโปรแกรม POS** (React Native / Flutter / Android native / Vue ฯลฯ) โดยใช้ component library, design system, และ pattern ที่โปรเจกต์มีอยู่แล้ว — ไม่ใช่เอา HTML ไปฝังตรงๆ ใช้เอกสารนี้เป็น "spec" และใช้ไฟล์ HTML เป็น "ภาพอ้างอิงเชิงโต้ตอบ" (เปิดดู/กดเล่นได้)

**The HTML is a reference, not shippable code.** Recreate it with the existing app's patterns.

---

## Fidelity

**High-fidelity (hifi).** สี ฟอนต์ ระยะห่าง และ interaction เป็นค่าที่ตั้งใจให้ใช้จริง ผู้พัฒนาควรทำให้ตรงตามนี้ (pixel-faithful) โดยแมปเข้ากับ token/component ของระบบเดิม หากค่าบางอย่างชนกับ design system ที่มีอยู่ ให้ยึด design system เดิมเป็นหลักแต่คงเลย์เอาต์/พฤติกรรมตามสเปกนี้

---

## Device / Canvas

- เครื่องเป้าหมาย: Sunmi-class handheld, **portrait**, หน้าจอราว **360–414 dp กว้าง**
- ดีไซน์อ้างอิงวาดบน **screen 366 × 748 px** (logical) ภายในกรอบเครื่อง
- โครงหน้าจอเป็น **column fl=ex แนวตั้งเต็มจอ**: `StatusBar (คงที่) → Search header (คงที่) → Body [rail + list] (ยืด, scroll) → Cart bar (คงที่ล่าง)`
- พื้นที่ที่ scroll ได้: (1) รายการสินค้าด้านขวา (2) แถบหมวดหมู่ด้านซ้าย แยกกัน scroll อิสระ
- ปลอดภัยกับ keyboard เมื่อโฟกัสช่องค้นหา (header อยู่บนสุด คงที่)

---

## Screens / Views

แบบ B มี **2 หน้าหลัก** ในเครื่องเดียว (สลับด้วย state `screen`):

### 1) หน้า Browse — เลือกสินค้า (ค่าเริ่มต้น)

**Purpose:** พนักงานค้นหา/เลือกหมวด แล้วแตะ `+` เพิ่มสินค้าลงตะกร้าอย่างรวดเร็ว เห็นยอดสะสมที่แถบล่าง

**Layout (บนลงล่าง):**

1. **Status bar** — สูง 30px, พื้น `--surface` (#FFFFFF), ซ้ายแสดงเวลา `09:41` (tabular-nums), ขวาแสดงไอคอน signal / wifi / battery (สี `--ink`). นี่เป็น mock ของ Android status bar — ในแอปจริงใช้ system status bar ได้เลย
2. **Search header** — พื้น `--surface`, เส้นล่าง `1px var(--line)`, padding `10px 12px`. ข้างในเป็น search field:
   - พื้น `--surface-3` (#F4F1EA), radius 11px, padding `9px 12px`, จัด `flex` gap 9px
   - ไอคอนแว่นขยาย (สี `--ink-3`) + `<input>` placeholder **"ค้นหาสินค้า / บาร์โค้ด"** (fontSize 14.5, สี `--ink`) + ปุ่มสแกนบาร์โค้ดด้านขวา (ไอคอน scan, สี `--brand-2`, 30×30, radius 10, พื้น `--surface-3`)
3. **Body** — `flex: 1`, จัด `flex row`, สอง pane:
   - **Category rail (ซ้าย)** — กว้างคงที่ **84px**, พื้น `--surface-2`, เส้นขวา `1px var(--line)`, scroll แนวตั้งอิสระ. แต่ละหมวดเป็นปุ่มเต็มความกว้าง padding `13px 6px` จัดกลาง แนวตั้ง gap 6px:
     - **แถบ active**: `borderLeft: 3px solid var(--brand)` + พื้น `--surface`
     - ไอคอนหมวด = สี่เหลี่ยมมน 30×30 radius 9px แสดง **อักษรตัวแรกของชื่อหมวด** (เช่น "เ", "ข"). ตอน active พื้น = `category.tint`, ตัวอักษรขาว; ตอนปกติ พื้น = tint ผสมขาว 16%, ตัวอักษรเป็น tint
     - ป้ายชื่อหมวด fontSize 11, 2 บรรทัดได้, active = `--ink` หนา 600 / ปกติ = `--ink-2`
     - หมวด: เครื่องดื่ม · ขนม·ของกินเล่น · ของแห้ง · เครื่องปรุง · ของใช้ในบ้าน · ของสด (ไม่มี "ทั้งหมด" ใน rail; ค่าเริ่มต้น = `drink`)
   - **Product list (ขวา)** — `flex: 1`, scroll แนวตั้ง. แต่ละสินค้าเป็นแถว:
     - จัด `flex row` align center, gap 11px, padding `10px 12px`, เส้นล่าง `1px var(--line)`
     - **ถ้าสินค้าอยู่ในตะกร้าแล้ว**: พื้นแถวเป็น `--brand-soft` (ไฮไลต์อ่อน)
     - คอลัมน์ซ้าย (ยืด): ชื่อสินค้า (fontSize 14, weight 500, line-height 1.25) + แถวล่าง = ราคา `฿xx` (num, weight 700, สี `--brand-2`, fontSize 14.5) เว้น 8px แล้วตามด้วยรหัสบาร์โค้ด `#8850001` (fontSize 11.5, สี `--ink-3`, tabular-nums)
     - คอลัมน์ขวา: **ถ้ายังไม่อยู่ในตะกร้า** → ปุ่มกลม `+` (`.addfab` 30×30, พื้น `--brand`, ไอคอนขาว). **ถ้าอยู่แล้ว** → **Stepper** (`− [จำนวน] +`) แทนที่
     - กรณีค้นหาไม่เจอ: แสดงข้อความกลาง "ไม่พบสินค้า «query»" สี `--ink-3`
4. **Cart bar (ล่างคงที่)** — แสดงเฉพาะเมื่อ `cart.count > 0`. padding 12px. ปุ่มเต็มกว้าง:
   - พื้น `--ink` (#221E1A เกือบดำ), ตัวขาว, radius 15px, padding `12px 14px`, เงา `0 10px 26px -10px rgba(34,30,26,.9)`
   - ซ้าย: ไอคอนตะกร้า + **badge จำนวน** (วงกลมขาว ตัวเลขสี `--brand`) ลอยมุมขวาบนของไอคอน
   - กลาง: ข้อความ **"ไปสรุปออเดอร์"** (fontSize 14.5, weight 500)
   - ขวา: ยอดรวม `฿xxx` (num, fontSize 17, weight 700)
   - แตะ → ไปหน้า **สรุปออเดอร์**

### 2) หน้า Summary — สรุปออเดอร์ / ชำระเงิน

**Purpose:** ตรวจรายการ ปรับจำนวน เลือกวิธีชำระ แล้วรับเงิน

**Layout:**

1. **Status bar** (เหมือนเดิม)
2. **App bar** — พื้น `--surface`, เส้นล่าง `1px var(--line)`, padding `10px 12px`, `flex row`:
   - ปุ่มย้อนกลับ (ไอคอน chevron ซ้าย 36×36 radius 10) → กลับหน้า Browse
   - หัวข้อ **"สรุปออเดอร์"** (fontSize 17, weight 600)
   - ขวาสุด: **"{count} ชิ้น"** (fontSize 13, สี `--ink-2`, num)
3. **รายการในตะกร้า (scroll)** — padding `8px 12px`. แต่ละแถว: ภาพ thumbnail 44×44 (placeholder) + ชื่อสินค้า (ตัดบรรทัดเดียว …) + ราคา/หน่วย ใต้ชื่อ (`฿xx / หน่วย`, สี `--ink-2`) + **Stepper** + ยอดรวมต่อรายการ (กว้าง 56px ชิดขวา weight 600). คั่นด้วยเส้นล่าง `1px var(--line)`
   - ตะกร้าว่าง: ข้อความกลาง "ยังไม่มีสินค้าในตะกร้า"
4. **เลือกวิธีชำระเงิน** (เมื่อมีสินค้า) — หัวข้อเล็ก "วิธีชำระเงิน" แล้วปุ่ม 2 อันเรียงกัน (flex gap 8):
   - **"พร้อมเพย์ / QR"** (ไอคอน QR) และ **"เงินสด"** (ไอคอนธนบัตร)
   - ปุ่มที่เลือก: border `1.5px var(--brand)`, พื้น `--brand-soft`, ตัว `--brand-2`; ปุ่มที่ไม่เลือก: border `--line-2`, พื้น `--surface`, ตัว `--ink-2`
   - ค่าเริ่มต้น = `qr`
5. **แถบสรุปยอด (ล่างคงที่)** — พื้น `--surface`, เส้นบน `1px var(--line)`, เงาบนจางๆ. มี:
   - แถว "ยอดรวมสินค้า" = subtotal
   - แถวเล็ก "ภาษีมูลค่าเพิ่ม (รวมใน)" = round(subtotal × 0.07) — *VAT included, ใช้แสดงผลเท่านั้น ไม่บวกเพิ่ม*
   - เส้นประคั่น แล้ว **"ยอดสุทธิ"** + ตัวเลขใหญ่ `฿xxx` (fontSize 26, weight 700, สี `--brand-2`)
   - ปุ่มหลัก **"รับชำระเงิน"** (ไอคอน check) เต็มกว้าง พื้น `--brand` — disabled เมื่อตะกร้าว่าง
   - แตะ → หน้า **ชำระเงินสำเร็จ**

### 3) สถานะย่อย — ชำระเงินสำเร็จ (Success)

ภายในหน้า Summary หลังกดรับชำระ: ไอคอน check ในวงกลมเขียว `--ok` (76×76) + **"ชำระเงินสำเร็จ"** + บรรทัดย่อย "ยอดรับชำระ ฿xxx · {พร้อมเพย์|เงินสด}" + เลขใบเสร็จ mock "#A-10427" + ปุ่ม **"พิมพ์ใบเสร็จ"** (ghost) และ **"ออเดอร์ใหม่"** (primary → ล้างตะกร้า + กลับ Browse)

---

## Interactions & Behavior

| Action | Result |
|---|---|
| แตะหมวดใน rail | กรองรายการสินค้าตามหมวด, ไฮไลต์หมวด active |
| พิมพ์ในช่องค้นหา | กรองสินค้าด้วย **ชื่อ หรือ บาร์โค้ด** (substring, รวมหมวดที่เลือกอยู่) |
| แตะ `+` ในแถวสินค้า | เพิ่มจำนวน +1, แถวเปลี่ยนเป็นพื้นไฮไลต์ + ปุ่มกลายเป็น Stepper, cart bar อัปเดต |
| แตะ `−` / `+` ใน Stepper | ปรับจำนวน; ถ้าเหลือ 0 ลบออกจากตะกร้า (กลับเป็นปุ่ม `+`) |
| แตะ cart bar | ไปหน้า Summary |
| ปุ่ม back ใน Summary | กลับ Browse (ตะกร้าคงอยู่) |
| เลือกวิธีชำระ | toggle qr/cash |
| รับชำระเงิน | แสดงหน้า Success |
| ออเดอร์ใหม่ | `cart.clear()` + กลับ Browse |

- **ทรานสิชัน:** chip/ปุ่ม `background/color/border` transition ~0.12s. กดปุ่ม `:active` ขยับ `translateY(0.5px)` เล็กน้อย
- **Empty states:** ค้นหาไม่เจอ / ตะกร้าว่าง — มีข้อความกำกับ
- ไม่มี loading/error state ใน prototype — ในแอปจริงควรเพิ่ม: สแกนบาร์โค้ดไม่พบสินค้า, โหลดแคตตาล็อก, ชำระเงินล้มเหลว

---

## State Management

State ทั้งหมดอยู่ใน component เดียว (ดู `variants.jsx` → `VariantList`):

- `cart` (custom hook `useCart`, ดู `shared.jsx`): เก็บ `lines` = `{ [productId]: qty }`
  - `add(id, delta)` — บวก/ลบจำนวน, ลบคีย์เมื่อ ≤ 0
  - `setQty(id, q)`, `clear()`
  - derived: `count` (รวมจำนวนชิ้น), `items` (array พร้อม `qty`, `sum`), `subtotal`
- `cat` — id หมวดที่เลือก (เริ่ม `"drink"`)
- `q` — คำค้นหา (string)
- `screen` — `"browse" | "summary"`
- ในหน้า Summary: `pay` (`"qr" | "cash"`), `done` (boolean → success)

**Data fetching (ของจริง):** ในโปรแกรมเดิมควรดึง catalog/หมวด/ราคา/สต็อกจาก backend และผูกตะกร้ากับ order/transaction service เดิม. โครง state ด้านบนใช้แมปได้ตรงๆ

---

## Design Tokens

ค่าทั้งหมดอยู่ใน `pos.css` (`:root`). สรุป:

**Colors**
| Token | Hex | ใช้ |
|---|---|---|
| `--bg` | `#F3F1EC` | พื้นหน้าจอ (warm off-white) |
| `--surface` | `#FFFFFF` | การ์ด/แถบ/header |
| `--surface-2` | `#FAF8F4` | rail/พื้นรอง |
| `--surface-3` | `#F4F1EA` | ช่อง input / stepper track |
| `--ink` | `#221E1A` | ตัวอักษรหลัก / cart bar |
| `--ink-2` | `#6E665D` | ตัวอักษรรอง |
| `--ink-3` | `#A39A8E` | ตัวอักษรจาง / placeholder |
| `--line` | `#ECE8E0` | เส้นคั่น |
| `--line-2` | `#E0DAD0` | เส้นขอบเข้ม |
| `--brand` | `#E94E27` | สีแบรนด์หลัก (ส้มแดง) |
| `--brand-2` | `#C73A1B` | สีแบรนด์เข้ม (ราคา/ยอด) |
| `--brand-soft` | `#FCEDE6` | ไฮไลต์อ่อน (แถวในตะกร้า) |
| `--ok` | `#3E8E4F` | สำเร็จ |
| `--warn` | `#D98A0B` | เตือน |

> หมายเหตุ: ในไฟล์รวม (POS Handheld.html) มีสวิตช์สีแบรนด์ 3 ชุด — ส้มแดง `#E94E27` (ค่าเริ่ม), ส้ม `#F5731E`, แดง `#E23A2E`. แบบ B มาตรฐานใช้ "ส้มแดง"

**Category tints** (ใช้ในไอคอน rail): เครื่องดื่ม `#E8612C` · ขนม `#D9A21B` · ของแห้ง `#C0512E` · เครื่องปรุง `#B5471F` · ของใช้ในบ้าน `#7A6A4F` · ของสด `#5E8C3A`

**Radius:** `--r-sm 9` · `--r 13` · `--r-lg 18` · `--r-xl 24` (px); pill/badge = 999px

**Shadow:** `--sh-1` (การ์ด/ปุ่มเล็ก) · `--sh-2` · `--sh-pop` (กรอบเครื่อง)

**Typography:** ฟอนต์ **IBM Plex Sans Thai** (weights 300/400/500/600/700) สำหรับข้อความไทย; **IBM Plex Sans** สำหรับตัวเลข/รหัส (`--ff-num`). ราคา/จำนวน/บาร์โค้ดใช้ `font-variant-numeric: tabular-nums` (class `.num`) เพื่อให้ตัวเลขเรียงตรง. สเกลที่ใช้: 11–14.5px เนื้อหา, 17 หัวข้อ, 26 ยอดสุทธิ. **ขั้นต่ำ hit target ปุ่ม ~30px+** (ปุ่ม +/− 28–30px, ในแอปจริงแนะนำ ≥44px)

**Currency:** สัญลักษณ์ `฿` นำหน้า, คั่นหลักพันด้วย comma — ดู `baht()` ใน `shared.jsx`

---

## Assets

- **ไม่มีรูปจริง** — thumbnail สินค้าเป็น **placeholder ลายทาง (CSS repeating-linear-gradient)** กำกับด้วยข้อความ `IMG` (ดู `.thumb` ใน `pos.css`). แบบ B แทบไม่ใช้รูป (โชว์เฉพาะในหน้า Summary 44×44). **ต้องแทนด้วยรูปสินค้าจริงจากระบบเดิม**
- **ไอคอนทั้งหมดเป็น inline SVG** (stroke 1.6–1.8) — ดู object `Ic` ใน `shared.jsx`: cart, search, back, check, trash, scan, qr, cash, plus. แทนด้วยไอคอนเซ็ตของแอปเดิมได้
- **ฟอนต์** โหลดจาก Google Fonts (IBM Plex Sans Thai / IBM Plex Sans) — ในแอปจริงให้ bundle ฟอนต์เอง
- ไม่มี emoji, ไม่มีโลโก้ลิขสิทธิ์ — โลโก้ร้านเป็นกล่องตัวอักษร "ส" (placeholder)

---

## Files (ในแพ็กเกจนี้)

| ไฟล์ | เนื้อหา |
|---|---|
| `POS แบบ B.html` | ดีไซน์อ้างอิงแบบ B เดี่ยวๆ (เปิดในเบราว์เซอร์เพื่อกดเล่น) |
| `pos.css` | design tokens + สไตล์ทั้งหมด (กรอบเครื่อง, chip, stepper, ปุ่ม, thumbnail) |
| `data.js` | แคตตาล็อกสินค้า/หมวด mock (`window.POS_DATA`) — โครงสร้างข้อมูลอ้างอิง |
| `shared.jsx` | helper: `baht()`, ไอคอน `Ic`, hook `useCart`, `StatusBar`, `Thumb`, `Stepper`, **`SummaryScreen`** (หน้าสรุป/ชำระเงิน ใช้ร่วม) |
| `variants.jsx` | **`VariantList`** = แบบ B (โฟกัสที่นี่). มี `VariantGrid`/`VariantSplit` ของแบบ A/C ปนมาเป็นบริบทเฉยๆ |

**จุดเริ่มอ่านโค้ด:** `variants.jsx → VariantList` (หน้า Browse) และ `shared.jsx → SummaryScreen` (หน้าสรุป/ชำระเงิน) + `useCart` (สถานะตะกร้า)

---

## หมายเหตุการนำไปใช้ (สำหรับ Claude Code)

1. แบบ B เป็น React prototype รัน Babel ในเบราว์เซอร์ — **สร้างใหม่ในเฟรมเวิร์กของโปรแกรม POS เดิม** ไม่ต้องยก Babel/CDN ไปด้วย
2. แมป `--brand*` และ token อื่นเข้ากับ theme เดิม ถ้ามี
3. แทน `POS_DATA` ด้วย catalog/หมวด/ราคา/สต็อก จาก backend จริง และผูก `useCart` เข้ากับ order service เดิม
4. เพิ่ม state ที่ของจริงต้องมีแต่ prototype ยังไม่มี: สแกนบาร์โค้ดจริง, สต็อก/หมดสต็อก, ส่วนลด, เลือกลูกค้า, พักบิล, error/loading, การพิมพ์ใบเสร็จจริง
5. คงพฤติกรรมหลัก: rail กรองหมวด · ค้นหาด้วยชื่อ+บาร์โค้ด · แถวในตะกร้าไฮไลต์ + กลายเป็น stepper · cart bar ล่าง · หน้า Summary มีวิธีชำระ qr/cash + ยอดสุทธิเด่น
