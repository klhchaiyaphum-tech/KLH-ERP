/* ============================================================
   page-customer.jsx — Customer & AR (ลูกหนี้) redesigned, KLH theme
   maps: getAllCustomers · addCustomer · updateCustomer ·
         getArByCustomer · getArSummary · payArEntry
   ============================================================ */
const { useState: cS, useMemo: cMemo } = React;
const CD = window.CUST;

const LEVEL = { retail:{ c:"green", t:"ราคาปลีก" }, wholesale:{ c:"coral", t:"ราคาส่ง" }, vip:{ c:"purple", t:"VIP" } };
const ARSTAT = { UNPAID:{ c:"amber", t:"ยังไม่ชำระ" }, PARTIAL:{ c:"blue", t:"ชำระบางส่วน" }, PAID:{ c:"green", t:"ชำระแล้ว" }, OVERDUE:{ c:"red", t:"เกินกำหนด" } };

function CustomerPage() {
  const [tab, setTab] = cS("customers");
  const [q, setQ] = cS("");
  const [arStatus, setArStatus] = cS("");
  const [arQ, setArQ] = cS("");
  const [edit, setEdit] = cS(null);     // customer object or {} for new
  const [pay, setPay] = cS(null);       // ar object
  const [toast, showToast] = useToast();

  const custs = cMemo(() => {
    const ql = q.trim().toLowerCase();
    return ql ? CD.customers.filter((r) => (r.custId + r.name + r.phone).toLowerCase().includes(ql)) : CD.customers;
  }, [q]);

  const ars = cMemo(() => {
    let rows = arStatus ? CD.ar.filter((r) => r.status === arStatus) : CD.ar;
    const ql = arQ.trim().toLowerCase();
    if (ql) rows = rows.filter((r) => (r.arId + r.saleId + r.custName + r.custId).toLowerCase().includes(ql));
    return rows;
  }, [arStatus, arQ]);

  const arSummary = cMemo(() => {
    const open = CD.ar.filter((r) => r.status !== "PAID");
    return { total: open.reduce((a, r) => a + r.balance, 0), overdue: open.filter((r) => r.status === "OVERDUE").reduce((a, r) => a + r.balance, 0), count: open.length };
  }, []);

  return (
    <Win title="KLH · Customer & AR — สมาชิกและลูกหนี้">
      <div className="phead">
        <div className="pic" style={{ background: "linear-gradient(135deg,#4A52C8,#3A37C9)" }}>{ICO.people}</div>
        <div><h1>ลูกหนี้ · Customer &amp; AR</h1><p>จัดการสมาชิก ระดับราคา วงเงินเครดิต และลูกหนี้การค้า</p></div>
        <div className="actions"><button className="btn primary" onClick={() => setEdit({})}>{ICO.plus} เพิ่มสมาชิก</button></div>
      </div>

      <div className="tabs">
        <button className={"tab" + (tab === "customers" ? " on" : "")} onClick={() => setTab("customers")}>{ICO.people} สมาชิก <span className="count">({CD.customers.length})</span></button>
        <button className={"tab" + (tab === "ar" ? " on" : "")} onClick={() => setTab("ar")}>{ICO.cash} ลูกหนี้การค้า (AR) <span className="count">({arSummary.count})</span></button>
      </div>

      <div className="body">
        {tab === "customers" ? (
          <>
            <div className="toolbar">
              <div className="search">{ICO.search}<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / เบอร์ / รหัส…" /></div>
              <span className="count">{custs.length} รายการ</span>
            </div>
            <div className="tbl"><div className="scroll">
              <table>
                <thead><tr>
                  <th>รหัส</th><th>ชื่อ</th><th>เบอร์</th><th>ระดับราคา</th>
                  <th className="r">วงเงิน</th><th className="r">ค้างชำระ</th><th className="c">เทอม</th><th className="c">จัดการ</th>
                </tr></thead>
                <tbody>
                  {custs.map((r) => (
                    <tr key={r.custId}>
                      <td><span className="code blue">{r.custId}</span></td>
                      <td className="name">{r.name}</td>
                      <td className="num muted">{r.phone}</td>
                      <td><span className={"pill " + LEVEL[r.priceLevel].c}>{LEVEL[r.priceLevel].t}</span></td>
                      <td className="r num">{r.creditLimit > 0 ? baht(r.creditLimit) : "—"}</td>
                      <td className="r num" style={{ color: r.outstanding > 0 ? "var(--red)" : "var(--ink-3)", fontWeight: r.outstanding > 0 ? 700 : 400 }}>{r.outstanding > 0 ? baht(r.outstanding) : "—"}</td>
                      <td className="c muted">{r.creditDays || 0} วัน</td>
                      <td className="c"><div className="rowbtns" style={{ justifyContent: "center" }}>
                        <button className="btn sm ghost" onClick={() => setEdit(r)}>{ICO.edit}</button>
                        <button className="btn sm ghost" style={{ color: "var(--green)" }} onClick={() => { setTab("ar"); setArQ(r.custId); }} title="ดู AR">{ICO.cash}</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div><div className="foot-bar">{custs.length} รายการ · ทั้งหมด {CD.customers.length} สมาชิก</div></div>
          </>
        ) : (
          <>
            <div className="kpis">
              <div className="kpi"><div className="kv num">{baht(arSummary.total)}</div><div className="kk">ยอดลูกหนี้รวม</div><div className="kic">{ICO.cash}</div></div>
              <div className="kpi"><div className="kv num" style={{ color: "var(--red)" }}>{baht(arSummary.overdue)}</div><div className="kk">เกินกำหนด</div></div>
              <div className="kpi"><div className="kv num">{arSummary.count}</div><div className="kk">รายการค้าง</div></div>
            </div>
            <div className="toolbar">
              <div className="search">{ICO.search}<input value={arQ} onChange={(e) => setArQ(e.target.value)} placeholder="ค้นหาลูกหนี้ / เลขบิล…" /></div>
              <div className="sel">
                <select value={arStatus} onChange={(e) => setArStatus(e.target.value)}>
                  <option value="">ทุกสถานะ</option><option value="UNPAID">ยังไม่ชำระ</option><option value="PARTIAL">ชำระบางส่วน</option><option value="OVERDUE">เกินกำหนด</option><option value="PAID">ชำระแล้ว</option>
                </select><span className="cv">{ICO.chevR}</span>
              </div>
            </div>
            <div className="tbl"><div className="scroll">
              <table>
                <thead><tr>
                  <th>เลข AR</th><th>เลขบิล</th><th>ลูกค้า</th><th>กิจการ</th><th>ออกบิล</th><th>ครบกำหนด</th>
                  <th className="r">ยอด</th><th className="r">ชำระแล้ว</th><th className="r">คงเหลือ</th><th className="c">สถานะ</th><th className="c">รับเงิน</th>
                </tr></thead>
                <tbody>
                  {ars.map((r) => (
                    <tr key={r.arId}>
                      <td><span className="code">{r.arId}</span></td>
                      <td className="num muted">{r.saleId}</td>
                      <td className="name">{r.custName}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{r.entity}</td>
                      <td className="num muted">{r.invDate}</td>
                      <td className="num" style={{ color: r.status === "OVERDUE" ? "var(--red)" : "inherit" }}>{r.dueDate}</td>
                      <td className="r num price">{baht(r.amount, 1)}</td>
                      <td className="r num" style={{ color: "var(--green)" }}>{baht(r.paidAmt, 1)}</td>
                      <td className="r num" style={{ fontWeight: 700 }}>{baht(r.balance, 1)}</td>
                      <td className="c"><span className={"pill " + ARSTAT[r.status].c}><span className="ld" />{ARSTAT[r.status].t}</span></td>
                      <td className="c">{r.status !== "PAID" && <button className="btn sm green" onClick={() => setPay(r)}>{ICO.cash} รับเงิน</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div><div className="foot-bar">{ars.length} รายการ</div></div>
          </>
        )}
      </div>

      {edit && <CustForm cust={edit} onClose={() => setEdit(null)} onSave={() => { setEdit(null); showToast(edit.custId ? "อัปเดตสมาชิกแล้ว" : "เพิ่มสมาชิกแล้ว"); }} />}
      {pay && <PayModal ar={pay} onClose={() => setPay(null)} onSave={(amt) => { setPay(null); showToast("รับเงิน " + baht(amt, 1) + " แล้ว"); }} />}
      {toast}
    </Win>
  );
}

function CustForm({ cust, onClose, onSave }) {
  const isNew = !cust.custId;
  const [f, setF] = cS({ name:"", phone:"", taxId:"", priceLevel:"retail", creditLimit:0, creditDays:30, address:"", note:"", ...cust });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={isNew ? "เพิ่มสมาชิกใหม่" : "แก้ไข " + cust.custId} icon={<span style={{ color: "var(--blue)" }}>{ICO.people}</span>} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>ยกเลิก</button><button className="btn primary" disabled={!f.name.trim()} onClick={() => onSave(f)}>บันทึก</button></>}>
      <div className="fgrid">
        <Field label="ชื่อ" req full><input className="in" value={f.name} onChange={set("name")} placeholder="ชื่อสมาชิก / ร้าน" /></Field>
        <Field label="เบอร์โทร"><input className="in num" value={f.phone} onChange={set("phone")} placeholder="08x-xxx-xxxx" /></Field>
        <Field label="เลขผู้เสียภาษี"><input className="in num" value={f.taxId} onChange={set("taxId")} placeholder="13 หลัก" /></Field>
        <Field label="ระดับราคา"><select value={f.priceLevel} onChange={set("priceLevel")}><option value="retail">ราคาปลีก</option><option value="wholesale">ราคาส่ง</option><option value="vip">VIP</option></select></Field>
        <Field label="เทอมเครดิต (วัน)"><input className="in num" type="number" value={f.creditDays} onChange={set("creditDays")} /></Field>
        <Field label="วงเงินเครดิต (฿)"><input className="in num" type="number" value={f.creditLimit} onChange={set("creditLimit")} /></Field>
        <Field label="ที่อยู่" full><input className="in" value={f.address} onChange={set("address")} placeholder="ที่อยู่จัดส่ง / ออกบิล" /></Field>
        <Field label="หมายเหตุ" full><input className="in" value={f.note} onChange={set("note")} /></Field>
      </div>
      {isNew && <div className="note blue" style={{ marginTop: 14 }}>บันทึกแล้วระบบจะออกรหัสสมาชิกอัตโนมัติ (addCustomer)</div>}
    </Modal>
  );
}

function PayModal({ ar, onClose, onSave }) {
  const [amt, setAmt] = cS(ar.balance);
  return (
    <Modal title="รับชำระเงิน" icon={<span style={{ color: "var(--green)" }}>{ICO.cash}</span>} onClose={onClose} max="420"
      footer={<><button className="btn ghost" onClick={onClose}>ยกเลิก</button><button className="btn green" disabled={!(amt > 0)} onClick={() => onSave(Number(amt))}>บันทึกรับเงิน</button></>}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 13 }}>{ar.arId} · {ar.custName}</div>
        <div className="num" style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>บิล {ar.saleId} · ครบกำหนด {ar.dueDate}</div>
      </div>
      <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
        <div className="kpi"><div className="kv num" style={{ fontSize: 20 }}>{baht(ar.amount, 1)}</div><div className="kk">ยอดบิล</div></div>
        <div className="kpi"><div className="kv num" style={{ fontSize: 20, color: "var(--red)" }}>{baht(ar.balance, 1)}</div><div className="kk">คงเหลือ</div></div>
      </div>
      <Field label="จำนวนเงินที่รับ (฿)" full><input className="in num" type="number" value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus style={{ fontSize: 20, textAlign: "center" }} /></Field>
      <div className="note" style={{ marginTop: 12 }}>payArEntry(arId, amount) — รับบางส่วนได้ สถานะจะอัปเป็น PARTIAL/PAID อัตโนมัติ</div>
    </Modal>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<CustomerPage />);
