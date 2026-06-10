/* ============================================================
   survey-page.jsx — page chrome: phone frame + screen jumper
   ============================================================ */
const { useState: pS } = React;

function SurveyPage() {
  return (
    <div className="page">
      <header className="pg-head">
        <div className="pg-brand">
          <div className="pg-logo"><img src="survey/assets/klh-logo.png" alt="" /></div>
          <div>
            <h1>KLH Data Survey — เวอร์ชันมือถือ</h1>
            <p>หน้าเดียวเลื่อนยาว ตรงขั้นตอนระบบจริง: ① ค้นหา (กล้อง/ค้นหา/เพิ่มใหม่) → ② ข้อมูลพื้นฐาน → 🪙 ต้นทุน&ราคาขาย (ป๊อปคำนวณ ▲▼0.25) → ③ รูปภาพ&บาร์โค้ด → บันทึก / พิมพ์ป้าย · คงทุกปุ่ม ฟังก์ชันเดิมไม่แตะ</p>
          </div>
        </div>
      </header>

      <div className="phone-wrap">
        <div className="phone-col">
          <div className="phone-label">iPhone · มือถือพนักงานสำรวจ</div>
          <IOSDevice width={390} height={838}>
            <SurveyApp insetTop={50} insetBottom={20} />
          </IOSDevice>
        </div>

        <aside className="sidecard">
          <h2>การเชื่อมต่อ (สำหรับ dev)</h2>
          <p className="lead">หน้านี้คือ <b>UI ใหม่</b> เท่านั้น — วางทับเฉพาะส่วน HTML/CSS ของ <code>page=survey</code> ใน Google Apps Script โดย <b>คงฟังก์ชันเดิมทั้งหมด</b></p>
          <ul>
            <li><b>หน้าแรก = สแกน:</b> ปุ่มสแกนใหญ่ → กล้องอ่านบาร์โค้ด → decode เป็นเลข → เรียก <code>searchProductsFromSheet(barcode)</code> เด้งเข้าหน้ารายละเอียด</li>
            <li><b>ค้นหา/เพิ่มใหม่:</b> ช่องพิมพ์ชื่อบางส่วนเรียก <code>searchProductsFromSheet(q)</code> · ปุ่ม "เพิ่มสินค้าใหม่" เปิดฟอร์มเปล่า (รหัส ITEM*)</li>
            <li><b>① ต้นทุน:</b> ป๊อปคำนวณ = logic เดิม §6.1 (R) · ปุ่ม ▲▼ ปรับ 0.25 snap · V/X คำนวณจาก R + %</li>
            <li><b>② รูป:</b> สตูดิโอ = ถ่าย → ตัดพื้นหลัง → จัดกึ่งกลาง → เลือกสีพื้นหลัง → ครอป 1024×1024 ผูกอัปโหลดเดิม</li>
            <li><b>③ บาร์โค้ด:</b> บาร์โค้ดชิ้น (A) <b>บังคับก่อน Save</b> · ปุ่มสแกนต่อกล้องเดิม · รหัส ITEM*</li>
            <li><b>บันทึก:</b> ปุ่ม Save เรียก <code>processAndSaveAll(img, barcodeA, info)</code> ตาม payload §8 — คงชื่อฟิลด์เดิมทั้งหมด</li>
            <li><b>⚙️ dropdown:</b> ปุ่มเฟืองข้างหมวด/หน่วย/ผู้ขาย/นิติ เรียก <code>manageListData(...)</code></li>
          </ul>
          <p className="foot">โทเคนสี/ฟอนต์ตรงกับโมดูลเดิม (header ส้ม · IBM Plex Sans Thai) เพื่อกลมกลืนกับ KLH WMS / Price List</p>
        </aside>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<SurveyPage />);
