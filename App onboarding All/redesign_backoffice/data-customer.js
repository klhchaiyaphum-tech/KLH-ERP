/* ============================================================
   data-customer.js — mock for Customer & AR (โครงตรง getAllCustomers/getArByCustomer)
   ============================================================ */
window.CUST = {
  customers: [
    { custId:"KLH-00481", name:"แอม เบเกอรี่ โฮม", phone:"081-234-5678", taxId:"", priceLevel:"retail", creditLimit:0, creditDays:0, outstanding:0, address:"88/12 ถ.ริมคลอง ต.ตลาด อ.เมือง สุราษฎร์ธานี", note:"สมัครผ่าน LINE" },
    { custId:"C-002", name:"คาเฟ่ มุมหวาน", phone:"089-876-5432", taxId:"0105539000111", priceLevel:"wholesale", creditLimit:20000, creditDays:15, outstanding:0, address:"12 ถ.ตลาดใหม่ อ.เมือง", note:"" },
    { custId:"C-003", name:"เบเกอรี่ ป้านวล", phone:"062-555-1122", taxId:"", priceLevel:"wholesale", creditLimit:80000, creditDays:30, outstanding:34800, address:"45/7 ม.3 ต.มะขามเตี้ย", note:"ส่งทุกอังคาร" },
    { custId:"C-005", name:"โรงแรมริมเล", phone:"077-321-900", taxId:"0845551000222", priceLevel:"vip", creditLimit:150000, creditDays:45, outstanding:68200, address:"199 ถ.ชายทะเล ต.บางใบไม้", note:"วางบิลทุกสิ้นเดือน" },
    { custId:"C-006", name:"ร้านกาแฟ บ้านสวน", phone:"081-700-4521", taxId:"", priceLevel:"wholesale", creditLimit:30000, creditDays:30, outstanding:12400, address:"7/2 ซ.สุขุมวิท ต.มะขามเตี้ย", note:"" },
    { custId:"C-007", name:"ครัวคุณยาย", phone:"086-223-7788", taxId:"", priceLevel:"retail", creditLimit:0, creditDays:0, outstanding:0, address:"การ์เด้นโฮม ต.ขุนทะเล", note:"" },
    { custId:"C-008", name:"โรงเรียนอนุบาลแสงเทียน", phone:"077-489-120", taxId:"0994000333111", priceLevel:"wholesale", creditLimit:50000, creditDays:30, outstanding:0, address:"100 ถ.การุณราษฎร์ ต.ตลาด", note:"นิติบุคคล" },
    { custId:"C-009", name:"ป้าจิต ของชำ", phone:"089-112-3030", taxId:"", priceLevel:"wholesale", creditLimit:15000, creditDays:7, outstanding:8200, address:"55 ตลาดสด ต.ตลาด", note:"" },
  ],
  ar: [
    { arId:"AR-260605-01", saleId:"INV-26060312", custName:"เบเกอรี่ ป้านวล", custId:"C-003", entity:"หจก. เคแอลเอช", invDate:"05/05/2026", dueDate:"04/06/2026", amount:18400, paidAmt:0, balance:18400, status:"OVERDUE" },
    { arId:"AR-260520-04", saleId:"INV-26052004", custName:"เบเกอรี่ ป้านวล", custId:"C-003", entity:"หจก. เคแอลเอช", invDate:"20/05/2026", dueDate:"19/06/2026", amount:16400, paidAmt:0, balance:16400, status:"UNPAID" },
    { arId:"AR-260528-02", saleId:"INV-26052802", custName:"โรงแรมริมเล", custId:"C-005", entity:"บ. เคแอลเอช ค้าส่ง จก.", invDate:"28/05/2026", dueDate:"12/07/2026", amount:42000, paidAmt:0, balance:42000, status:"UNPAID" },
    { arId:"AR-260512-07", saleId:"INV-26051207", custName:"โรงแรมริมเล", custId:"C-005", entity:"บ. เคแอลเอช ค้าส่ง จก.", invDate:"12/05/2026", dueDate:"26/06/2026", amount:38200, paidAmt:12000, balance:26200, status:"PARTIAL" },
    { arId:"AR-260601-03", saleId:"INV-26060103", custName:"ร้านกาแฟ บ้านสวน", custId:"C-006", entity:"หจก. เคแอลเอช", invDate:"01/06/2026", dueDate:"01/07/2026", amount:12400, paidAmt:0, balance:12400, status:"UNPAID" },
    { arId:"AR-260530-05", saleId:"INV-26053005", custName:"ป้าจิต ของชำ", custId:"C-009", entity:"หจก. เคแอลเอช", invDate:"30/05/2026", dueDate:"06/06/2026", amount:8200, paidAmt:0, balance:8200, status:"OVERDUE" },
    { arId:"AR-260415-09", saleId:"INV-26041509", custName:"คาเฟ่ มุมหวาน", custId:"C-002", entity:"บ. เคแอลเอช เบเกอรี่ จก.", invDate:"15/04/2026", dueDate:"30/04/2026", amount:9600, paidAmt:9600, balance:0, status:"PAID" },
  ],
  entities: ["หจก. เคแอลเอช","บ. เคแอลเอช เบเกอรี่ จก.","บ. เคแอลเอช ค้าส่ง จก."],
};
