/* ============================================================
   survey-data.js — KLH Data Survey (field product-data update)
   Model mirrors Index.html sheet columns A–AI (see SURVEY_SPEC).
   window.SURVEY
   ============================================================ */
window.SURVEY = {
  store: { name: "KLH Data Survey", sub: "สำรวจ/อัปเดตข้อมูลสินค้า", user: "นัท", branch: "หน้าร้าน W1" },

  // master lists (from getDropdownData) — each editable via ⚙️
  entities: ["หจก. เคแอลเอช", "บ. เคแอลเอช เบเกอรี่", "บ. เคแอลเอช ค้าส่ง", "ร้าน KLH ตลาด"],
  cats: ["วัตถุดิบเบเกอรี่", "เครื่องดื่ม", "ของแห้ง", "บรรจุภัณฑ์", "อื่นๆ"],
  units: ["ถุง", "หีบ", "ลัง", "กระสอบ", "ทับ", "โหล", "ชิ้น", "กล่อง", "ขวด"],
  suppliers: [
    { code: "VEND-002", name: "บ.แป้งสยาม" },
    { code: "VEND-009", name: "บ. คิงส์ มิลลิ่ง" },
    { code: "VEND-014", name: "บ. ทรีท็อป เคมีคัล" },
    { code: "VEND-015", name: "บ. ยูเอฟเอ็ม ฟู้ดเซ็นเตอร์" },
  ],

  // bg colors for the photo studio
  bgColors: ["#FFFFFF", "#F4F1EA", "#FDEBDD", "#E7EFF7", "#EFEAF7", "#1C1A17"],

  // products — `done` already surveyed today; `miss` = fields still missing
  // fields: item(ITEM*), barcode(A), name(B), cat(C), size(D), packMult(E),
  //   packUnit(F), supplier(G), entity(AD), buyPrice(I), costFinal(R),
  //   wholeOld(U), retailOld(W), wholePct(S), retailPct(T), hasImg
  items: [
    { item: "ITEM-0001", barcode: "8851234500011", name: "แป้งจิงโจ้ อเนกประสงค์", cat: "วัตถุดิบเบเกอรี่", size: "1 กก.", packMult: 10, packUnit: "ทับ", supplier: "VEND-002", entity: "หจก. เคแอลเอช", buyPrice: 23.29, costFinal: 24.92, wholeOld: 26, retailOld: 28, wholePct: 4.3, retailPct: 12.4, hasImg: true,  done: true,  miss: [] },
    { item: "ITEM-0002", barcode: "8851234500028", name: "แป้งจิงโจ้ กระสอบ", cat: "วัตถุดิบเบเกอรี่", size: "22.5 กก.", packMult: 1, packUnit: "กระสอบ", supplier: "VEND-009", entity: "บ. เคแอลเอช ค้าส่ง", buyPrice: 645, costFinal: 684.21, wholeOld: null, retailOld: null, wholePct: 6, retailPct: 12, hasImg: true, done: false, miss: ["whole", "retail"] },
    { item: "ITEM-0030", barcode: "8851234500305", name: "ยีสต์แห้ง ซาฟ", cat: "วัตถุดิบเบเกอรี่", size: "500 ก.", packMult: 20, packUnit: "ทับ", supplier: "VEND-014", entity: "หจก. เคแอลเอช", buyPrice: 38, costFinal: 39.53, wholeOld: 45, retailOld: 49, wholePct: 13.8, retailPct: 24, hasImg: false, done: false, miss: ["img"] },
    { item: "ITEM-0034", barcode: "", name: "เนยสด อลาวรี่", cat: "วัตถุดิบเบเกอรี่", size: "5 กก.", packMult: 5, packUnit: "กระสอบ", supplier: "VEND-015", entity: "บ. เคแอลเอช เบเกอรี่", buyPrice: 660, costFinal: 679.53, wholeOld: null, retailOld: 790, wholePct: 8, retailPct: 16, hasImg: false, done: false, miss: ["whole", "barcode", "img"] },
    { item: "ITEM-0041", barcode: "8850987000414", name: "น้ำตาลทรายขาว มิตรผล", cat: "วัตถุดิบเบเกอรี่", size: "1 กก.", packMult: 1, packUnit: "ถุง", supplier: "VEND-002", entity: "หจก. เคแอลเอช", buyPrice: 21.5, costFinal: 22.8, wholeOld: 25, retailOld: 27, wholePct: 9.6, retailPct: 18.4, hasImg: true, done: true, miss: [] },
    { item: "ITEM-0102", barcode: "8850999320014", name: "น้ำดื่ม สิงห์ 600 มล.", cat: "เครื่องดื่ม", size: "600 มล.×12", packMult: 12, packUnit: "ลัง", supplier: "VEND-015", entity: "ร้าน KLH ตลาด", buyPrice: 57.6, costFinal: 58.9, wholeOld: 72, retailOld: 84, wholePct: 22, retailPct: 42, hasImg: true, done: false, miss: [] },
    { item: "ITEM-0203", barcode: "", name: "ข้าวหอมมะลิ 5 กก.", cat: "ของแห้ง", size: "5 กก.", packMult: 1, packUnit: "ถุง", supplier: "VEND-009", entity: "บ. เคแอลเอช ค้าส่ง", buyPrice: 138, costFinal: 142, wholeOld: 156, retailOld: 165, wholePct: 9.8, retailPct: 16.2, hasImg: false, done: false, miss: ["barcode", "img"] },
  ],

  // KPI (from backend; mock here)
  kpi: { total: 1186, complete: 742, todo: 444, barcodePct: 81 },
  target: 20,
  doneToday: 6,
};
