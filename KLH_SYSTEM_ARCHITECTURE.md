# KLH Grocery EPS-POS-WMS — System Architecture & Database Map
> Last updated: 2026-05-30

---

## 1. ภาพรวมระบบ

```
Stack:  Google Apps Script (GAS) + Google Sheets + HTML/CSS/JS
Host:   GAS Web App (deployed URL)
DB:     Google Sheets (SHEET_ID = 1ko72nyTpeQZ410eVALhlzZ2EhY7Qk0e340DAdQG8z4U)
Notify: LINE Messaging API (push to group)
```

### 5 กิจการ (TAX_ENTITY)
| ลำดับ | ชื่อกิจการ | VAT |
|-------|-----------|-----|
| 1 | หจก. เค แอล เอช | ✅ มี VAT |
| 2 | กวงล่งเฮง | ❌ |
| 3 | อึ้งกวงล่งเฮง | ❌ |
| 4 | วิศาลศักดิ์ | ❌ |
| 5 | เอี่ยมเช็ง | ❌ |

---

## 2. ไฟล์โปรเจกต์ (C:\Users\num_s\KLH-ERP\)

| ไฟล์ | ประเภท | หน้าที่ |
|------|--------|---------|
| Code.js → Code.gs | GAS Backend | doGet routing, Config, Survey, Price List |
| inventory.js → inventory.gs | GAS Backend | WMS: receive, transfer, FIFO, ROP, LINE |
| Index.html | Frontend | Phase 0: KLH Data Survey |
| wms.html | Frontend | Phase 2: WMS (all JS inline) |
| pricelist.html | Frontend | Price List catalog |
| ocr.html | Frontend | *(TODO)* Invoice OCR |
| JsBarcode.gs | Library | Barcode rendering |

### Route Map
| URL | Template | สถานะ |
|-----|----------|-------|
| ?page=(none) | Index.html | ✅ LIVE |
| ?page=wms | wms.html | ✅ LIVE |
| ?page=pricelist | pricelist.html | ✅ LIVE |
| ?page=ocr | ocr.html | 🔲 TODO |
| ?page=pos | pos.html | 🔲 TODO |

---

## 3. Database Sheets — ผังเชื่อมโยง

```
┌─────────────────────────────────────────────────────────────┐
│                    KLH DATA (Master)                        │
│  A:SKU  B:Name  C:Category  D:Size  E:Multiplier           │
│  F:UnitBig  R:CostFinal  U:WholesaleOld  W:RetailOld       │
│  AB:BarcodeBig  AD:TaxEntity  AF:SupplierCompare           │
└──────────────┬──────────────────────────────────────────────┘
               │ lookup (barcode → name, unit, cost, entity)
               ▼
┌──────────────────────┐    ┌─────────────────────────┐
│   SUPPLIER_MASTER    │    │   PRODUCT_CATEGORY       │
│  A:Code  B:Name      │    │  A:Code  B:Name          │
│  C:Contact  E:Tel    │    │  (หมวดหมู่สำหรับ dropdown)│
└──────┬───────────────┘    └─────────────────────────┘
       │ FK: SUPPLIER_CODE
       ▼
┌──────────────────────────────────────────────────────────────┐
│             INVOICE_HEADER  (TODO — OCR flow)                │
│  RECV_NO  INVOICE_NO  DATE  SUPPLIER_CODE  TAX_ENTITY       │
│  TOTAL_AMT  VAT_AMT  NET_AMT  STATUS  PDF_URL  OCR_RAW      │
└──────┬───────────────────────────────────────────────────────┘
       │ 1 : N
       ▼
┌──────────────────────────────────────────────────────────────┐
│             INVOICE_DETAIL  (TODO — OCR flow)                │
│  RECV_NO  LINE_NO  BARCODE  PRODUCT_NAME  QTY_LARGE        │
│  UNIT_LARGE  QTY_PIECE  UNIT_PRICE  DISCOUNT  NET_PRICE     │
│  TOTAL  WMS_POSTED  AP_POSTED                               │
└──────┬───────────────────────────────────────────────────────┘
       │ on approve → receiveGoods()
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    STOCK_LOG  (WMS)                          │
│  Date  Time  Type  SKU  Name  Entity  WH  Qty  Unit         │
│  CostPerUnit  Amount  Ref  User  Note                        │
│  Type values: IN | TRANSFER_OUT | TRANSFER_IN | ADJUST       │
└──────┬───────────────────────────────────────────────────────┘
       │ updateBal_()
       ▼
┌──────────────────────┐    ┌─────────────────────────┐
│   STOCK_BALANCE      │    │   FIFO_BATCH             │
│  SKU  Name  WH_ID    │    │  Batch_ID  Date  SKU     │
│  Qty_OnHand          │    │  WH_ID  Qty_Remaining    │
│  Qty_Reserved        │    │  Cost_Per_Unit  Ref       │
│  Cost_Avg  Updated   │    │  (FIFO lot tracking)     │
└──────────────────────┘    └─────────────────────────┘
       │ ropAlert_()
       ▼
┌──────────────────────┐
│   SKU_WH_CONFIG      │
│  SKU  WH_ID          │
│  ROP  ROQ  MaxStock  │
│  Active              │
└──────────────────────┘

┌──────────────────────┐    ┌─────────────────────────┐
│   WAREHOUSE          │    │   PICK_LIST              │
│  WH_ID  WH_Name      │    │  PL_ID  Date  WH_From   │
│  Entity  Location    │    │  WH_To  SKU  Name        │
│  Manager  Active     │    │  QtyReq  QtyPicked       │
│  W1-W5              │    │  Status  Picker           │
└──────────────────────┘    └─────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                 PRICE_HISTORY  (existing)                    │
│  Date  SKU  Product_Name  Old_Cost  New_Cost                 │
│  Old_Retail  New_Retail  Old_Wholesale  New_Wholesale        │
│  Changed_By  Ref  Note                                       │
│  ► ใช้: บันทึกทุกครั้งที่ราคาเปลี่ยน (ทั้ง cost และ selling) │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                 PRICE_LOG  (TODO)                            │
│  Date  SKU  RECV_NO  Supplier  Qty_Large  Unit_Large        │
│  Cost_Per_Large  Cost_Per_Piece  Discount_Total             │
│  ► ใช้: บันทึกราคาต้นทุนจากใบกำกับแต่ละครั้ง (purchase log) │
│  ► ต่างจาก PRICE_HISTORY: เน้น "ซื้อมาราคาเท่าไร"           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                 AP_LEDGER  (TODO)                            │
│  AP_ID  RECV_NO  Supplier_Code  TAX_ENTITY                  │
│  Invoice_Date  Due_Date  Total_Amt  Paid_Amt  Balance       │
│  Status  Payment_Ref  Note                                   │
│  ► ใช้: ติดตามยอดหนี้เจ้าหนี้ แจ้งเตือนครบกำหนดผ่าน LINE   │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. LOG Overlap Analysis — ซ้ำกันไหม?

| Sheet | เก็บอะไร | ซ้ำกับ |
|-------|---------|--------|
| **STOCK_LOG** | ทุก stock movement (qty + cost) | ไม่ซ้ำ |
| **PRICE_HISTORY** | ประวัติราคาขาย (retail/wholesale เปลี่ยน) | ไม่ซ้ำ |
| **PRICE_LOG** | ราคาต้นทุนจากใบกำกับแต่ละใบ | ซ้อนกับ STOCK_LOG บางส่วน |
| **AP_LEDGER** | ยอดหนี้เจ้าหนี้ balance | ไม่ซ้ำ |
| **INVOICE_HEADER** | metadata ใบกำกับ | ไม่ซ้ำ |
| **INVOICE_DETAIL** | รายการสินค้าในใบกำกับ | ซ้อนกับ STOCK_LOG |

### ข้อแนะนำ
- **PRICE_LOG** กับ **STOCK_LOG** ซ้อนกัน: STOCK_LOG เก็บ CostPerUnit อยู่แล้ว
  - ✅ ถ้าต้องการ purchase price history แยก → ใช้ PRICE_LOG
  - หรือ query STOCK_LOG ที่ Type='IN' แทนได้เลย
- **ไม่ต้องสร้าง SUPPLIER_LOG** แยก — ใช้ AP_LEDGER ดูประวัติ transaction ต่อ supplier ได้

---

## 5. Function Reference

### Code.js (Code.gs)
| Function | Input | Output | Calls |
|----------|-------|--------|-------|
| `doGet(e)` | URL param `page` | HtmlOutput | - |
| `include(filename)` | filename | HTML string | - |
| `getConfig()` | - | {TAX_RATE, TAB_SURVEY, ...} | SpreadsheetApp |
| `getDropdownData()` | - | {categories, packages, shops, suppliers} | getConfig, getSupplierList |
| `getSupplierList(sheetName)` | sheetName | [{code,name,contact,tel}] | SpreadsheetApp |
| `addNewSupplier(data)` | {name,contact,tel} | {status,code,name} | SpreadsheetApp |
| `searchProductsFromSheet(query)` | string | [{barcode,name,...}] | getConfig |
| `processAndSaveAll(img,barcode,info)` | base64,string,obj | {status} | getConfig, DriveApp |
| `manageListData(key,old,new,mode)` | strings | string | getConfig |
| `getPriceListCategories()` | - | {ok,categories:[{name,count}]} | klhDataSheet_ |
| `getPriceListItems(catName)` | string | {ok,items:[...]} | klhDataSheet_ |
| `klhDataSheet_()` | - | Sheet object | getConfig |

### inventory.js (inventory.gs)
| Function | Input | Output | Calls |
|----------|-------|--------|-------|
| `initWmsSheets()` | - | string | ss_() |
| `getWmsData()` | - | {ok,warehouses,stock,pickLists} | getWarehouses_,getStockBalance,getPickLists |
| `lookupSkuForWms(sku)` | barcode | {sku,name,unit,entity,convRate,baseUnit,barcodeLarge} | getConfig,ss_() |
| `getStockBalance(whId)` | whId or '' | [{sku,name,wh,onHand,reserved,costAvg,updated}] | sh_(SH_BAL) |
| `updateBal_(sku,pName,whId,delta,newCost)` | - | newQty | sh_(SH_BAL) |
| `addBatch_(sku,whId,qty,cost,ref)` | - | - | sh_(SH_FIFO) |
| `consumeFifo_(sku,whId,needed)` | - | {ok,unitCost} | sh_(SH_FIFO) |
| `receiveGoods(d)` | {sku,whId,qty,convRate,...} | {ok,msg,newQty} | LockService,updateBal_,addBatch_,ropAlert_ |
| `transferGoods(d)` | {sku,fromWH,toWH,qty,...} | {ok,msg,ref} | LockService,consumeFifo_,updateBal_ |
| `adjustStock(d)` | {sku,whId,qtyActual,...} | {ok,msg,newQty} | LockService,consumeFifo_,updateBal_ |
| `createPickList(d)` | {whFrom,whTo,items,...} | {ok,plId,msg} | sh_(SH_PL) |
| `getPickLists(status)` | 'PENDING' or '' | [{plId,items,...}] | sh_(SH_PL) |
| `updatePickItem(plId,sku,qty)` | - | {ok,allDone} | sh_(SH_PL) |
| `getRopConfig(whId)` | whId or '' | [{sku,wh,rop,roq,maxStock}] | sh_(SH_CFG) |
| `saveRopConfigs(configs)` | [{...}] | {ok} | sh_(SH_CFG) |
| `ropAlert_(sku,whId,curQ)` | - | - | sh_(SH_CFG),sendWmsLine_ |
| `checkAllRop()` | - | string | sh_(SH_BAL),ropAlert_ |
| `sendWmsLine_(text)` | string | - | getConfig,UrlFetchApp |
| `seedTestData()` | - | string | ss_(),receiveGoods-like |

---

## 6. Unit Conversion Model
```
KLH DATA:
  E (MULTIPLIER) = conv_rate = ชิ้นต่อหน่วยใหญ่
  F (UNIT_BIG)   = unit      = ลัง / แพ็ก / ถุง

WMS Receive Flow:
  User enters:  qty_large = 10 ลัง,  cost_per_large = 45 บาท
  System stores: pieces = 10 × 12 = 120 ชิ้น
                 cost_per_piece = 45 / 12 = 3.75 บาท/ชิ้น

Stored in STOCK_LOG / FIFO_BATCH / STOCK_BALANCE:
  Qty = ชิ้น (base unit)  |  Cost = ต่อชิ้น
```

---

## 7. OCR Invoice Flow (TODO)
```
User uploads image/PDF
        │
        ▼
[GAS] store in Drive:
  Invoice/{Entity}/{YYYY}/{MM}/INV-YYYYMMDD-NNN.pdf
        │
        ▼
[Drive API v2] convert to Google Doc → read text → delete temp doc
        │
        ▼
[GAS] Parse text: supplier, invoice_no, date, line items
        │
        ▼
[Frontend] Split screen:
  LEFT: original image preview
  RIGHT: parsed data form + KLH DATA lookup
        │
        ├─ User verifies each line item
        ├─ Match to KLH DATA barcode
        ├─ Confirm cost calculation (modal)
        │
        ▼ [Approve]
┌───────────────────────────────────────────┐
│ Write to:                                 │
│  INVOICE_HEADER  (doc metadata)           │
│  INVOICE_DETAIL  (line items)             │
│  STOCK_LOG       (IN transaction)         │
│  PRICE_LOG       (purchase price record)  │
│  AP_LEDGER       (payable entry)          │
│  PRICE_HISTORY   (if cost changed)        │
└───────────────────────────────────────────┘
        │
        ▼
[LINE] notify ผู้บริหาร: "ราคาสินค้าเปลี่ยน" → approve ใน KLH DATA
```

---

## 8. GAS Technical Rules (SES Sandbox)
```
❌ ห้าม:  include() แล้วเรียก function จาก onclick
❌ ห้าม:  nested template literals  ` outer ${arr.map(x => `inner`)} `
❌ ห้าม:  optional chaining ?.
❌ ห้าม:  shorthand object {sku} → ต้องเขียน {sku: sku}
✅ ใช้:   var แทน const/let ใน HTML <script>
✅ ใช้:   function(){} แทน arrow functions ใน HTML
✅ ใช้:   string concatenation แทน template literals ใน HTML
✅ OK:    const/let/arrow/template literals ใน .gs files (V8 engine)
✅ ใช้:   String().normalize('NFC') สำหรับ search ภาษาไทย
```

---

## 9. Change Log

| วันที่ | การเปลี่ยนแปลง | ไฟล์ |
|--------|----------------|------|
| 2026-05-30 | สร้าง WMS (wms.html + inventory.js) Phase 2 | wms.html, inventory.js |
| 2026-05-30 | เพิ่ม doGet routing ?page=wms | Code.js |
| 2026-05-30 | แก้ GAS SES scope bug — ย้าย JS inline wms.html | wms.html |
| 2026-05-30 | เพิ่ม unit conversion (convRate/baseUnit) ใน receiveGoods | inventory.js |
| 2026-05-30 | lookupSkuForWms อ่านจาก KLH DATA โดยตรง (E=conv, F=unit) | inventory.js |
| 2026-05-30 | searchProductsFromSheet ขยาย 31→33 คอลัมน์ (AF,AG) | Code.js |
| 2026-05-30 | seedTestData ขยาย PRODUCTS เป็น 7 คอลัมน์ | inventory.js |
| 2026-05-30 | สร้าง Price List (pricelist.html + getPriceListCategories/Items) | pricelist.html, Code.js |
| 2026-05-30 | แก้ Thai NFC normalization bug ใน searchProductsFromSheet | Code.js |
| 2026-05-30 | แก้ case-insensitive sheet name lookup | Code.js |

---

## 10. CONFIG Sheet Keys ที่ระบบใช้

| Key | หน้าที่ | ใช้ใน |
|-----|---------|-------|
| TAB_SURVEY | ชื่อ Sheet ข้อมูลสินค้า (KLH DATA) | searchProductsFromSheet, getPriceListCategories |
| TAB_CATEGORY | Sheet หมวดหมู่ | getDropdownData |
| TAB_PACKAGE | Sheet หน่วยบรรจุ | getDropdownData |
| TAB_SHOPS | Sheet รายชื่อร้าน | getDropdownData |
| TAB_SUPPLIER | Sheet SUPPLIER_MASTER | getSupplierList |
| TAX_RATE | อัตราภาษี (0.07) | getDropdownData |
| COMPANY_NAME | ชื่อบริษัท | getDropdownData |
| TEMP_FOLDER_ID | Google Drive folder สำหรับรูปสินค้า | processAndSaveAll |
| LINE_CHANNEL_TOKEN | LINE Messaging API token | sendWmsLine_ |
| LINE_GROUP_ID | LINE Group ID | sendWmsLine_ |
| INVOICE_FOLDER_ID | Drive folder รากสำหรับ OCR invoices | *(TODO)* |
