/* ============================================================
   klh-data.js — sample data for KLH back-office modules
   อิงจากภาพตัวอย่างจริง (Price List / Supplier Master / WMS / Cashier)
   ============================================================ */
window.KLH = {
  store: { name: "KLH Grocery EPS-POS", legal: "ห้างหุ้นส่วน เคแอลเอช", cashier: "นัท" },

  entities: [
    { id: "E1", name: "หจก. เคแอลเอช" },
    { id: "E2", name: "บ. เคแอลเอช เบเกอรี่ จก." },
    { id: "E3", name: "บ. เคแอลเอช ค้าส่ง จก." },
    { id: "E4", name: "ร้าน KLH สาขาตลาด" },
    { id: "E5", name: "KLH ออนไลน์" },
  ],

  warehouses: [
    { id: "W1", name: "หน้าร้าน",        items: 412, value: 318400 },
    { id: "W2", name: "คลังกลาง",        items: 1186, value: 1240500 },
    { id: "W3", name: "ครัวเบเกอรี่",     items: 96, value: 84200 },
    { id: "W4", name: "สาขาตลาด",        items: 268, value: 196300 },
    { id: "W5", name: "ห้องเย็น",        items: 54, value: 142800 },
  ],

  priceCats: [
    { id: "bake", name: "วัตถุดิบเบเกอรี่", items: [
      { code: "ITEM-0001", name: "แป้งจิงโจ้ 1 กก.",          size: "1 กก.",    pack: "10 ถุง",   cost: 23.50, retail: 28,  whole: 26 },
      { code: "ITEM-0002", name: "แป้งจิงโจ้ กระสอบ 22.5 กก.", size: "22.5 กก.", pack: "กระสอบ",   cost: 584.21, retail: 684, whole: 645 },
      { code: "ITEM-0030", name: "ยีสต์แห้ง ซาฟ 500 ก.",       size: "500 ก.",   pack: "ทับ",      cost: 39.53, retail: 49,  whole: 45 },
      { code: "ITEM-0034", name: "เนยสด อลาวรี่ 5 กก.",        size: "5 กก.",    pack: "5 กระสอบ", cost: 679.53, retail: 790, whole: 745 },
      { code: "ITEM-0041", name: "น้ำตาลทรายขาว มิตรผล 1 กก.", size: "1 กก.",    pack: "ถุง",      cost: 22.80, retail: 27,  whole: 25 },
    ]},
    { id: "drink", name: "เครื่องดื่ม", items: [
      { code: "ITEM-0102", name: "น้ำดื่ม สิงห์ 600 มล.",  size: "600 มล.", pack: "12 ขวด", cost: 4.80, retail: 7,  whole: 6 },
      { code: "ITEM-0108", name: "โค้ก กระป๋อง 325 มล.",   size: "325 มล.", pack: "24 กระป๋อง", cost: 12.50, retail: 16, whole: 14 },
      { code: "ITEM-0115", name: "นมเมจิ รสจืด 200 มล.",   size: "200 มล.", pack: "48 กล่อง", cost: 10.20, retail: 14, whole: 12 },
    ]},
    { id: "dry", name: "ของแห้ง", items: [
      { code: "ITEM-0203", name: "ข้าวหอมมะลิ 5 กก.",      size: "5 กก.",  pack: "ถุง", cost: 142.00, retail: 165, whole: 156 },
      { code: "ITEM-0210", name: "มาม่า ต้มยำกุ้ง",        size: "60 ก.",  pack: "30 ซอง", cost: 5.10, retail: 7, whole: 6.5 },
    ]},
    { id: "pack", name: "บรรจุภัณฑ์", items: [
      { code: "ITEM-0301", name: "กล่องเค้ก 1 ปอนด์",      size: "1 ปอนด์", pack: "50 ใบ", cost: 6.20, retail: 9, whole: 8 },
      { code: "ITEM-0305", name: "ถุงหูหิ้ว 9x18",         size: "9x18",   pack: "กก.", cost: 38.00, retail: 48, whole: 44 },
    ]},
  ],

  suppliers: [
    { code: "VEND-002", name: "บ.แป้งสยาม", contact: "—", phone: "02-225-0200", tax: "0105532000xxx", credit: 30, note: "โอน BB 102-0-65736-5" },
    { code: "VEND-003", name: "บ. สเปเชียล ฟู้ด จก", contact: "—", phone: "—", tax: "—", credit: 0 },
    { code: "VEND-004", name: "บ. อินเทค ฟลาวมิลล์ จก", contact: "—", phone: "—", tax: "—", credit: 15 },
    { code: "VEND-005", name: "บ.จีฟู้ด จก", contact: "—", phone: "—", tax: "—", credit: 0 },
    { code: "VEND-006", name: "บ.เอ็มซี ฟู้ดส์ จำกัด", contact: "—", phone: "—", tax: "—", credit: 30 },
    { code: "VEND-007", name: "บ.แหลมทอง จก.", contact: "—", phone: "02-225-3777", tax: "—", credit: 0 },
    { code: "VEND-008", name: "บ. คิงเมอร์ลี่", contact: "—", phone: "081-701-6389", tax: "—", credit: 7 },
    { code: "VEND-009", name: "บ. คิงส์ มิลลิ่ง (สุราษฎร์ธานี) จก", contact: "สมยศ ยงยิ่งศักดิ์ถาวร", phone: "093-923-6426", tax: "—", credit: 30 },
    { code: "VEND-010", name: "บ. อี ที ซี เยียบตงจัน", contact: "—", phone: "—", tax: "—", credit: 0 },
    { code: "VEND-011", name: "บ.เกรียงไกรค้าแป้ง", contact: "—", phone: "—", tax: "—", credit: 0 },
    { code: "VEND-012", name: "บ.นิวสยามฟู้ด", contact: "—", phone: "02-865-1764", tax: "—", credit: 15 },
    { code: "VEND-013", name: "บ.ดนัย", contact: "—", phone: "—", tax: "—", credit: 0 },
    { code: "VEND-014", name: "บ. ทรีท็อป เคมีคัลแอนด์ฟู้ดส์ คอร์ปอเรชั่น จก.", contact: "สมพงษ์", phone: "089-677-8481", tax: "0105540000xxx", credit: 30 },
    { code: "VEND-015", name: "บ. ยูเอฟเอ็ม ฟู้ดเซ็นเตอร์", contact: "—", phone: "02-713-9000", tax: "—", credit: 30 },
  ],

  // pending orders waiting at cashier (from POS handheld)
  pendingOrders: [
    { no: "ORD-20260605-001", src: "POS #1 · นัท", time: "16:02", items: [
      { name: "แป้งจิงโจ้ 1 กก.", qty: 5, price: 28 }, { name: "ยีสต์แห้ง ซาฟ 500 ก.", qty: 2, price: 49 }, { name: "น้ำตาลทราย 1 กก.", qty: 3, price: 27 },
    ]},
    { no: "ORD-20260605-002", src: "POS #2 · ฝน", time: "16:09", items: [
      { name: "เนยสด อลาวรี่ 5 กก.", qty: 1, price: 790 }, { name: "กล่องเค้ก 1 ปอนด์", qty: 20, price: 9 },
    ]},
    { no: "ORD-20260605-003", src: "Handheld · บอย", time: "16:14", items: [
      { name: "โค้ก กระป๋อง", qty: 24, price: 16 }, { name: "น้ำดื่ม สิงห์", qty: 12, price: 7 }, { name: "มาม่า ต้มยำกุ้ง", qty: 30, price: 7 },
    ]},
  ],

  members: [
    { id: "C-001", name: "ร้านเค้กบ้านสวน", phone: "081-234-5678", tier: "ส่ง-ทอง", credit: 50000, ar: 12400 },
    { id: "C-002", name: "คาเฟ่ มุมหวาน", phone: "089-876-5432", tier: "ส่ง-เงิน", credit: 20000, ar: 0 },
    { id: "C-003", name: "เบเกอรี่ ป้านวล", phone: "062-555-1122", tier: "ส่ง-ทอง", credit: 80000, ar: 34800 },
    { id: "C-004", name: "ลูกค้าทั่วไป (ปลีก)", phone: "—", tier: "ปลีก", credit: 0, ar: 0 },
    { id: "C-005", name: "โรงแรมริมเล", phone: "077-321-900", tier: "ส่ง-แพลทินัม", credit: 150000, ar: 68200 },
  ],

  invoices: [ // invoice OCR queue
    { file: "INV-แป้งสยาม-0605.jpg", vendor: "บ.แป้งสยาม", no: "IV6805-2210", date: "05/06/2026", total: 23410, vat: 1531, status: "ตรวจแล้ว" },
    { file: "INV-ยูเอฟเอ็ม-0604.pdf", vendor: "บ. ยูเอฟเอ็ม", no: "UF-44120", date: "04/06/2026", total: 8650, vat: 566, status: "รอตรวจ" },
    { file: "INV-คิงส์มิล-0603.jpg", vendor: "บ. คิงส์ มิลลิ่ง", no: "KM-9981", date: "03/06/2026", total: 45200, vat: 2957, status: "รอตรวจ" },
  ],
};
