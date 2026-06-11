/* data-wms.js — mock for WMS (โครงตรง getWmsData / getStockBalance / getPickLists / getRopConfig) */
window.WMS = {
  warehouses: [
    { id:"W1", name:"หน้าร้าน" }, { id:"W2", name:"คลังกลาง" }, { id:"W3", name:"ครัวเบเกอรี่" }, { id:"W4", name:"สาขาตลาด" }, { id:"W5", name:"ห้องเย็น" },
  ],
  stock: [
    { sku:"ITEM-0001", name:"แป้งจิงโจ้ อเนกประสงค์ 1 กก.", wh:"W2", onHand:480, reserved:24, costAvg:23.50, updated:"11/06 09:12" },
    { sku:"ITEM-0001", name:"แป้งจิงโจ้ อเนกประสงค์ 1 กก.", wh:"W1", onHand:36, reserved:0, costAvg:23.50, updated:"11/06 08:40" },
    { sku:"ITEM-0030", name:"ยีสต์แห้ง ซาฟ 500 ก.", wh:"W2", onHand:120, reserved:6, costAvg:39.53, updated:"10/06 16:20" },
    { sku:"ITEM-0034", name:"เนยสด อลาวรี่ 5 กก.", wh:"W5", onHand:18, reserved:2, costAvg:679.53, updated:"11/06 07:55" },
    { sku:"ITEM-0041", name:"น้ำตาลทรายขาว มิตรผล 1 กก.", wh:"W2", onHand:300, reserved:0, costAvg:22.80, updated:"09/06 14:02" },
    { sku:"ITEM-0102", name:"น้ำดื่ม สิงห์ 600 มล.", wh:"W1", onHand:8, reserved:0, costAvg:4.80, updated:"11/06 10:01" },
    { sku:"ITEM-0203", name:"ข้าวหอมมะลิ 5 กก.", wh:"W4", onHand:0, reserved:0, costAvg:142.00, updated:"08/06 11:30" },
    { sku:"ITEM-0301", name:"กล่องเค้ก 1 ปอนด์", wh:"W3", onHand:240, reserved:20, costAvg:6.20, updated:"10/06 13:15" },
  ],
  pickLists: [
    { plId:"PL-260611-01", status:"PENDING", whFrom:"W2", whTo:"W1", date:"11/06/2026", items:[
      { sku:"ITEM-0001", name:"แป้งจิงโจ้ 1 กก.", qtyReq:24, qtyPicked:24 },
      { sku:"ITEM-0041", name:"น้ำตาลทราย 1 กก.", qtyReq:12, qtyPicked:5 },
      { sku:"ITEM-0030", name:"ยีสต์แห้ง ซาฟ", qtyReq:6, qtyPicked:0 },
    ]},
    { plId:"PL-260610-03", status:"PENDING", whFrom:"W2", whTo:"W4", date:"10/06/2026", items:[
      { sku:"ITEM-0034", name:"เนยสด อลาวรี่ 5 กก.", qtyReq:4, qtyPicked:4 },
      { sku:"ITEM-0301", name:"กล่องเค้ก 1 ปอนด์", qtyReq:50, qtyPicked:50 },
    ]},
    { plId:"PL-260609-07", status:"DONE", whFrom:"W2", whTo:"W1", date:"09/06/2026", items:[
      { sku:"ITEM-0102", name:"น้ำดื่ม สิงห์", qtyReq:24, qtyPicked:24 },
    ]},
  ],
  rop: [
    { sku:"ITEM-0001", wh:"W1", rop:48, roq:120, maxStock:200, active:true },
    { sku:"ITEM-0102", wh:"W1", rop:24, roq:96, maxStock:144, active:true },
    { sku:"ITEM-0203", wh:"W4", rop:10, roq:40, maxStock:60, active:true },
    { sku:"ITEM-0034", wh:"W5", rop:6, roq:20, maxStock:30, active:false },
  ],
  // sku lookup (lookupSkuForWms)
  skus: {
    "ITEM-0001":{ name:"แป้งจิงโจ้ อเนกประสงค์ 1 กก.", unit:"ลัง(10)", entity:"หจก. เคแอลเอช", convRate:10, baseUnit:"ถุง" },
    "ITEM-0030":{ name:"ยีสต์แห้ง ซาฟ 500 ก.", unit:"ทับ", entity:"หจก. เคแอลเอช", convRate:1, baseUnit:"ทับ" },
    "ITEM-0102":{ name:"น้ำดื่ม สิงห์ 600 มล.", unit:"แพ็ก(12)", entity:"หจก. เคแอลเอช", convRate:12, baseUnit:"ขวด" },
  },
};
