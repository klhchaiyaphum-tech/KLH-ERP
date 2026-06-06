// Product catalog for the handheld POS prototype.
// Retail / wholesale store, Thai. Prices in THB.
window.POS_DATA = {
  store: { name: "ร้านค้า ส.รุ่งเรือง", branch: "สาขาตลาดสด", cashier: "พนักงาน: นัท" },
  categories: [
    { id: "drink",   name: "เครื่องดื่ม",   tint: "#E8612C" },
    { id: "snack",   name: "ขนม·ของกินเล่น", tint: "#D9A21B" },
    { id: "dry",     name: "ของแห้ง",       tint: "#C0512E" },
    { id: "season",  name: "เครื่องปรุง",    tint: "#B5471F" },
    { id: "home",    name: "ของใช้ในบ้าน",   tint: "#7A6A4F" },
    { id: "fresh",   name: "ของสด",         tint: "#5E8C3A" },
  ],
  products: [
    // drinks
    { id: "d1", cat: "drink",  name: "น้ำดื่ม สิงห์ 600 มล.",     price: 7,   unit: "ขวด", code: "8850001" },
    { id: "d2", cat: "drink",  name: "โค้ก กระป๋อง 325 มล.",      price: 16,  unit: "กระป๋อง", code: "8851959" },
    { id: "d3", cat: "drink",  name: "นมเมจิ รสจืด 200 มล.",      price: 14,  unit: "กล่อง", code: "8852017" },
    { id: "d4", cat: "drink",  name: "เอ็ม-150",                  price: 12,  unit: "ขวด", code: "8850123" },
    { id: "d5", cat: "drink",  name: "กาแฟเบอร์ดี้ กระป๋อง",       price: 17,  unit: "กระป๋อง", code: "8850777" },
    { id: "d6", cat: "drink",  name: "น้ำส้มมินิทเมด 350 มล.",     price: 22,  unit: "ขวด", code: "8850456" },
    // snacks
    { id: "s1", cat: "snack",  name: "เลย์ คลาสสิก 50 ก.",        price: 20,  unit: "ถุง", code: "8852003" },
    { id: "s2", cat: "snack",  name: "ปาเปา รสต้มยำ",             price: 10,  unit: "ซอง", code: "8853110" },
    { id: "s3", cat: "snack",  name: "เวเฟอร์ ฟันโอ",             price: 15,  unit: "กล่อง", code: "8851234" },
    { id: "s4", cat: "snack",  name: "ถั่วโก๋แก่ อบเกลือ",          price: 12,  unit: "ซอง", code: "8854321" },
    { id: "s5", cat: "snack",  name: "ช็อกโกแลต คิทแคท",          price: 25,  unit: "แท่ง", code: "8850999" },
    // dry
    { id: "g1", cat: "dry",    name: "มาม่า ต้มยำกุ้ง",            price: 7,   unit: "ซอง", code: "8850047" },
    { id: "g2", cat: "dry",    name: "ข้าวหอมมะลิ 5 กก.",          price: 165, unit: "ถุง", code: "8850088" },
    { id: "g3", cat: "dry",    name: "ปลากระป๋อง สามแม่ครัว",       price: 21,  unit: "กระป๋อง", code: "8850066" },
    { id: "g4", cat: "dry",    name: "นมข้นหวาน ตรามะลิ",          price: 19,  unit: "กระป๋อง", code: "8850055" },
    { id: "g5", cat: "dry",    name: "ไข่ไก่ เบอร์ 2 (แผง 10)",     price: 42,  unit: "แผง", code: "8850033" },
    // seasoning
    { id: "c1", cat: "season", name: "น้ำปลา ทิพรส 700 มล.",       price: 35,  unit: "ขวด", code: "8850201" },
    { id: "c2", cat: "season", name: "ซีอิ๊วขาว เด็กสมบูรณ์",        price: 32,  unit: "ขวด", code: "8850202" },
    { id: "c3", cat: "season", name: "น้ำตาลทราย 1 กก.",           price: 26,  unit: "ถุง", code: "8850203" },
    { id: "c4", cat: "season", name: "น้ำมันพืช มรกต 1 ลิตร",       price: 58,  unit: "ขวด", code: "8850204" },
    // home
    { id: "h1", cat: "home",   name: "ผงซักฟอก บรีส 800 ก.",       price: 49,  unit: "ถุง", code: "8850301" },
    { id: "h2", cat: "home",   name: "น้ำยาล้างจาน ซันไลต์",        price: 27,  unit: "ขวด", code: "8850302" },
    { id: "h3", cat: "home",   name: "ทิชชู่ ม้วนใหญ่ (4 ม้วน)",     price: 39,  unit: "แพ็ค", code: "8850303" },
    { id: "h4", cat: "home",   name: "ถ่านพานา AA (4 ก้อน)",        price: 45,  unit: "แพ็ค", code: "8850304" },
    // fresh
    { id: "f1", cat: "fresh",  name: "กล้วยหอม",                  price: 35,  unit: "หวี", code: "2000011" },
    { id: "f2", cat: "fresh",  name: "ไข่เป็ด (แผง 10)",           price: 55,  unit: "แผง", code: "2000022" },
    { id: "f3", cat: "fresh",  name: "ผักบุ้ง",                    price: 15,  unit: "กำ", code: "2000033" },
  ],
};
