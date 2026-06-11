/* data-reports.js — mock for stock_month + tax (ภพ.30) */
window.REPORTS = {
  // getMonthEndStockByEntity(ym)
  stockMonth: {
    generatedAt: "11 มิ.ย. 2569 09:40",
    klh: {
      totals: { costVal: 318400, qty: 2186, soldQty: 540, soldAmt: 48250 },
      items: [
        { barcode:"ITEM-0001", name:"แป้งจิงโจ้ อเนกประสงค์ 1 กก.", onHand:480, cost:23.50, costVal:11280, soldQty:120, soldAmt:3360 },
        { barcode:"ITEM-0030", name:"ยีสต์แห้ง ซาฟ 500 ก.", onHand:120, cost:39.53, costVal:4744, soldQty:48, soldAmt:2352 },
        { barcode:"ITEM-0041", name:"น้ำตาลทรายขาว มิตรผล 1 กก.", onHand:300, cost:22.80, costVal:6840, soldQty:210, soldAmt:5670 },
        { barcode:"ITEM-0034", name:"เนยสด อลาวรี่ 5 กก.", onHand:18, cost:679.53, costVal:12232, soldQty:6, soldAmt:4740 },
      ],
    },
    other: {
      totals: { costVal: 642100, qty: 4820, soldQty: 1240, soldAmt: 132400 },
      byEntity: [
        { entity:"บ. เคแอลเอช เบเกอรี่ จก.", count:86, qty:2100, costVal:284500, soldAmt:62100 },
        { entity:"บ. เคแอลเอช ค้าส่ง จก.", count:142, qty:1980, costVal:268200, soldAmt:54300 },
        { entity:"กวงล่งเฮง", count:38, qty:740, costVal:89400, soldAmt:16000 },
      ],
    },
  },
  // simulateKlhStock(ym, target) — computed client-side from a target
  // getPP30(ym)
  pp30: {
    month: "พฤษภาคม 2569",
    input: { vat: 8540.50, base: 122007, count: 14 },         // ภาษีซื้อ (บิล KLH)
    outputVatActual: 3377.50, actualSales: 48250,             // ภาษีขายจริง
    netVat: -5163.00,                                         // ขาย - ซื้อ
    purchaseAllEntities: 486200,
    minSalesRequired: 122007,                                 // ยอดขายให้ VAT ขาย > ซื้อ
    estimate: { execPercent: 15, lastYearAvg: 95000, targetSales: 150040, targetVat: 9821.58 },
  },
};
