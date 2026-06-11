/* data-cashier.js — mock for Cashier (โครงตรง getPendingOrders / loadOrderById / closeSale) */
window.CASHIER = {
  warehouses: [{ id:"W1", name:"หน้าร้าน" }],
  pending: [
    { orderId:"ORD-20260611-001", customerName:"เบเกอรี่ ป้านวล", customerCode:"C-003", source:"POS #1", date:"11/06", time:"16:02", total:1218, entity:"หจก. เคแอลเอช",
      items:[ { name:"แป้งจิงโจ้ 1 กก.", unit:"ถุง", qty:5, lineTotal:140 }, { name:"ยีสต์แห้ง ซาฟ", unit:"ทับ", qty:2, lineTotal:98 }, { name:"เนยสด อลาวรี่ 5 กก.", unit:"กระสอบ", qty:1, lineTotal:790 }, { name:"น้ำตาลทราย 1 กก.", unit:"ถุง", qty:7, lineTotal:190 } ] },
    { orderId:"ORD-20260611-002", customerName:"ลูกค้าทั่วไป", customerCode:"", source:"POS #2", date:"11/06", time:"16:09", total:432,
      items:[ { name:"โค้ก กระป๋อง", unit:"ลัง", qty:1, lineTotal:384 }, { name:"น้ำดื่ม สิงห์", unit:"แพ็ก", qty:8, lineTotal:48 } ] },
    { orderId:"ORD-20260611-003", customerName:"คาเฟ่ มุมหวาน", customerCode:"C-002", source:"Handheld", date:"11/06", time:"16:14", total:945, entity:"บ. เคแอลเอช เบเกอรี่ จก.",
      items:[ { name:"กล่องเค้ก 1 ปอนด์", unit:"แพ็ก", qty:5, lineTotal:450 }, { name:"แป้งเค้ก", unit:"ถุง", qty:11, lineTotal:495 } ] },
  ],
};
