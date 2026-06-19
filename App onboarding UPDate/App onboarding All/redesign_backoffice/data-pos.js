/* data-pos.js — mock catalog for POS (โครงตรง getPosPageData / catalog) */
window.POSD = {
  cats: [
    { id:"all", name:"ทั้งหมด" }, { id:"bake", name:"วัตถุดิบเบเกอรี่" }, { id:"drink", name:"เครื่องดื่ม" },
    { id:"dry", name:"ของแห้ง" }, { id:"pack", name:"บรรจุภัณฑ์" },
  ],
  products: [
    { id:"ITEM-0001", cat:"bake", name:"แป้งจิงโจ้ อเนกประสงค์", unit:"1 กก.", retail:28, whole:26 },
    { id:"ITEM-0002", cat:"bake", name:"แป้งจิงโจ้ กระสอบ", unit:"22.5 กก.", retail:684, whole:645 },
    { id:"ITEM-0030", cat:"bake", name:"ยีสต์แห้ง ซาฟ", unit:"500 ก.", retail:49, whole:45 },
    { id:"ITEM-0034", cat:"bake", name:"เนยสด อลาวรี่", unit:"5 กก.", retail:790, whole:745 },
    { id:"ITEM-0041", cat:"bake", name:"น้ำตาลทรายขาว มิตรผล", unit:"1 กก.", retail:27, whole:25 },
    { id:"ITEM-0102", cat:"drink", name:"น้ำดื่ม สิงห์", unit:"600มล.×12", retail:84, whole:72 },
    { id:"ITEM-0108", cat:"drink", name:"โค้ก กระป๋อง", unit:"325มล.×24", retail:384, whole:360 },
    { id:"ITEM-0115", cat:"drink", name:"นมเมจิ รสจืด", unit:"200มล.×6", retail:84, whole:78 },
    { id:"ITEM-0203", cat:"dry", name:"ข้าวหอมมะลิ", unit:"5 กก.", retail:165, whole:156 },
    { id:"ITEM-0210", cat:"dry", name:"มาม่า ต้มยำกุ้ง", unit:"60ก.×6", retail:42, whole:39 },
    { id:"ITEM-0301", cat:"pack", name:"กล่องเค้ก 1 ปอนด์", unit:"×10", retail:90, whole:80 },
    { id:"ITEM-0305", cat:"pack", name:"ถุงหูหิ้ว 9×18", unit:"1 กก.", retail:48, whole:44 },
  ],
  members: [
    { code:"C-002", name:"คาเฟ่ มุมหวาน", tier:"ส่ง-เงิน", level:"whole" },
    { code:"C-003", name:"เบเกอรี่ ป้านวล", tier:"ส่ง-ทอง", level:"whole" },
    { code:"C-005", name:"โรงแรมริมเล", tier:"VIP", level:"whole" },
  ],
};
