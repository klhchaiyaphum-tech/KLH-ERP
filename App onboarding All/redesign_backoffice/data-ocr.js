/* data-ocr.js — mock for Invoice OCR (โครงตรง uploadInvoiceFile parsed result) */
window.OCR = {
  entities: ["หจก. เคแอลเอช","บ. เคแอลเอช เบเกอรี่ จก.","บ. เคแอลเอช ค้าส่ง จก.","กวงล่งเฮง","วิศาลศักดิ์"],
  warehouses: [{ id:"W1", name:"หน้าร้าน" },{ id:"W2", name:"คลังกลาง" },{ id:"W3", name:"ครัวเบเกอรี่" }],
  // simulated parsed OCR result (Gemini)
  parsed: {
    suggestions: { supplier:"บ.แป้งสยาม จำกัด", supplierCode:"VEND-002", invoiceNo:"IV6806-2210", invoiceDate:"2026-06-09", dueDate:"2026-07-09", taxId:"0105532000123", subtotal:21878.50, vatAmt:1531.50, totalAmt:23410.00 },
    items: [
      { productName:"แป้งจิงโจ้ อเนกประสงค์ 22.5 กก.", barcode:"ITEM-0002", qty:20, free:1, unit:"กระสอบ", unitPrice:584.21 },
      { productName:"ยีสต์แห้ง ซาฟ 500 ก.", barcode:"ITEM-0030", qty:24, free:0, unit:"ทับ", unitPrice:39.53 },
      { productName:"น้ำตาลทรายขาว มิตรผล 1 กก.", barcode:"", qty:100, free:0, unit:"ถุง", unitPrice:22.80 },
    ],
    ocrText: "บริษัท แป้งสยาม จำกัด\nใบกำกับภาษี/ใบส่งของ\nเลขที่ IV6806-2210  วันที่ 09/06/2026\nเลขประจำตัวผู้เสียภาษี 0105532000123\n--------------------------------\n1. แป้งจิงโจ้ 22.5กก. x20 +1  @584.21\n2. ยีสต์แห้ง ซาฟ x24  @39.53\n3. น้ำตาลทราย 1กก. x100  @22.80\n--------------------------------\nรวมเงิน        21,878.50\nภาษี 7%         1,531.50\nยอดสุทธิ       23,410.00",
  },
  history: [
    { recvNo:"RCV-260609-02", invNo:"IV6806-2210", date:"09/06/2026", supplier:"บ.แป้งสยาม จำกัด", entity:"หจก. เคแอลเอช", total:23410.00, status:"DONE" },
    { recvNo:"RCV-260608-05", invNo:"UF-44120", date:"08/06/2026", supplier:"บ. ยูเอฟเอ็ม", entity:"บ. เคแอลเอช เบเกอรี่ จก.", total:8650.00, status:"DONE" },
    { recvNo:"RCV-260607-01", invNo:"KM-9981", date:"07/06/2026", supplier:"บ. คิงส์ มิลลิ่ง", entity:"หจก. เคแอลเอช", total:45200.00, status:"PENDING" },
  ],
};
