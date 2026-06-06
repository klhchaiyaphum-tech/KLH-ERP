# KLH ERP — แผนที่อุปกรณ์ ↔ เมนู (Device Deployment Map)
> เมนูไหนใช้บนอุปกรณ์ไหน — ใช้กำหนดทิศทางดีไซน์ UI ต่ออุปกรณ์
> ทุกอุปกรณ์มี 🏷️ พิมพ์สติ๊กเกอร์ (label)

## 📱 iPhone (มือถือ)
| เมนู | route |
|---|---|
| 🧾 ตรวจสลิปโอนเงิน | `?page=slip` |
| 🏷️ พิมพ์สติ๊กเกอร์ | `?page=label` |

## 📋 iPad
| เมนู | route |
|---|---|
| KLH Price List | `?page=pricelist` |
| KLH Invoice OCR (สแกนใบกำกับภาษี) | `?page=ocr` |
| 🏷️ พิมพ์สติ๊กเกอร์ | `?page=label` |

## 🖥️ PC
| เมนู | route |
|---|---|
| เมนูรวม KLH Grocery EPS-POS | `?page=index` |
| Customer & AR (สมาชิก/ลูกหนี้) | `?page=customer` |
| KLH WMS (คลังสินค้า) | `?page=wms` |
| Supplier Master (เจ้าหนี้) | `?page=supplier` |
| POS PC | `?page=pos_pc` |
| KLH Cashier | `?page=cashier` |
| 🏷️ พิมพ์สติ๊กเกอร์ | `?page=label` |

## 🤚 Sunmi (handheld)
| เมนู | route |
|---|---|
| POS Handheld | `?page=pos` |
| 🏷️ พิมพ์สติ๊กเกอร์ | `?page=label` |

## 🖥️🖥️ Sunmi T2 / D3 (2 จอ)
| เมนู | route |
|---|---|
| POS T2 (จอลูกค้า + จอแคชเชียร์) | `?page=pos_t2` |
| 🏷️ พิมพ์สติ๊กเกอร์ | `?page=label` |

---
## หมายเหตุดีไซน์
- **มือถือ/Sunmi** = จอเล็ก แนวตั้ง นิ้วโป้ง ปุ่มใหญ่
- **iPad** = จอกลาง แนวนอน อ่านสบาย (pricelist แบบหนังสือ)
- **PC** = จอใหญ่ เมาส์ ตารางข้อมูลเยอะได้
- **Sunmi T2/D3** = 2 จอ (แคชเชียร์ + ลูกค้า) แสดง QR/รายการเรียลไทม์
- Survey (`?page=survey`) = มือถือ (ไม่อยู่ในลิสต์นี้ แต่ใช้มือถือเดินสำรวจ)
