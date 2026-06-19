/* ============================================================
   line-data.js — KLH LINE OA storefront catalog + demo order
   window.LINEDATA
   ============================================================ */
window.LINEDATA = {
  store: { name: "KLH Bakery & Mart", oa: "@klhmart", promptpay: "0-9876-54321 (KLH)", branch: "สาขาตลาดสด" },
  user:  { name: "คุณแอม", phone: "081-234-5678", member: "KLH-00481", tier: "สมาชิกทอง", points: 1240 },

  cats: [
    { id: "all",   name: "ทั้งหมด" },
    { id: "bake",  name: "วัตถุดิบเบเกอรี่" },
    { id: "drink", name: "เครื่องดื่ม" },
    { id: "dry",   name: "ของแห้ง" },
    { id: "pack",  name: "บรรจุภัณฑ์" },
  ],

  products: [
    { id: "p1", cat: "bake", name: "แป้งจิงโจ้ อเนกประสงค์", size: "1 กก.", price: 28, emoji: "🌾", tint: "#FBE7CF" },
    { id: "p2", cat: "bake", name: "แป้งจิงโจ้ กระสอบ", size: "22.5 กก.", price: 684, emoji: "🛍️", tint: "#F6E0C2" },
    { id: "p3", cat: "bake", name: "ยีสต์แห้ง ซาฟ", size: "500 ก.", price: 49, emoji: "🧫", tint: "#EFE3CB" },
    { id: "p4", cat: "bake", name: "เนยสด อลาวรี่", size: "5 กก.", price: 790, emoji: "🧈", tint: "#FCEFCB" },
    { id: "p5", cat: "bake", name: "น้ำตาลทรายขาว มิตรผล", size: "1 กก.", price: 27, emoji: "🍬", tint: "#F3EEE4" },
    { id: "p6", cat: "drink", name: "น้ำดื่ม สิงห์", size: "600 มล. × 12", price: 84, emoji: "💧", tint: "#D9ECF6" },
    { id: "p7", cat: "drink", name: "โค้ก กระป๋อง", size: "325 มล. × 24", price: 384, emoji: "🥤", tint: "#F6D9D9" },
    { id: "p8", cat: "drink", name: "นมเมจิ รสจืด", size: "200 มล. × 6", price: 84, emoji: "🥛", tint: "#EEEAF6" },
    { id: "p9", cat: "dry", name: "ข้าวหอมมะลิ", size: "5 กก.", price: 165, emoji: "🍚", tint: "#EEEEE6" },
    { id: "p10", cat: "dry", name: "มาม่า ต้มยำกุ้ง", size: "60 ก. × 6", price: 42, emoji: "🍜", tint: "#F6E2D4" },
    { id: "p11", cat: "pack", name: "กล่องเค้ก 1 ปอนด์", size: "× 10 ใบ", price: 90, emoji: "📦", tint: "#EAE6DC" },
    { id: "p12", cat: "pack", name: "ถุงหูหิ้ว 9×18", size: "1 กก.", price: 48, emoji: "🛍️", tint: "#E7EFE2" },
  ],

  // pre-filled demo cart (so reviewer lands on a populated flow)
  demoCart: { p1: 5, p3: 2, p5: 3, p11: 1 },

  // sample paid order for status / receipt screens
  order: {
    no: "KLH-26060142",
    date: "6 มิ.ย. 2569 · 14:23 น.",
    method: "delivery",          // pickup | delivery
    address: "88/12 ถ.ริมคลอง ต.ตลาด อ.เมือง จ.สุราษฎร์ธานี 84000",
    addrNote: "ฝากไว้หน้าร้านกาแฟ โทรก่อนส่ง",
    ship: 40,
    pay: "promptpay",
    promptpayRef: "004999012600142",
  },

  promos: [
    { tag: "ลด 5%", title: "สมาชิกทองวันนี้", sub: "ช้อปครบ ฿1,000 รับส่วนลดทันที" },
    { tag: "ส่งฟรี", title: "ส่งฟรีในเขตเมือง", sub: "เมื่อสั่งครบ ฿800 ขึ้นไป" },
  ],
};
