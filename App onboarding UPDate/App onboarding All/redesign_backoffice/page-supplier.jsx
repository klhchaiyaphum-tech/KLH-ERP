/* ============================================================
   page-supplier.jsx — Supplier Master (เจ้าหนี้) redesigned, KLH theme
   maps: getSupplierList · addNewSupplier · updateSupplier · deleteSupplier
   ============================================================ */
const { useState: sS, useMemo: sMemo } = React;
const SD = window.SUPP;

function SupplierPage() {
  const [q, setQ] = sS("");
  const [edit, setEdit] = sS(null);    // supplier or {} for new
  const [del, setDel] = sS(null);
  const [toast, showToast] = useToast();

  const rows = sMemo(() => {
    const ql = q.trim().toLowerCase();
    return ql ? SD.suppliers.filter((r) => (r.code + r.name + r.tel + r.contact + r.taxId).toLowerCase().includes(ql)) : SD.suppliers;
  }, [q]);

  return (
    <Win title="KLH · Supplier Master — จัดการเจ้าหนี้">
      <div className="phead">
        <div className="pic" style={{ background: "linear-gradient(135deg,#D1764F,#B25C3B)" }}>{ICO.truck}</div>
        <div><h1>เจ้าหนี้ · Supplier Master</h1><p>รวมรายชื่อผู้จำหน่าย ข้อมูลบัญชีโอนเงิน เช็คสั่งจ่าย และเทอมเครดิต</p></div>
        <div className="actions"><button className="btn primary" onClick={() => setEdit({})}>{ICO.plus} เพิ่มเจ้าหนี้</button></div>
      </div>

      <div className="body">
        <div className="toolbar">
          <div className="search">{ICO.search}<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัส / ชื่อ / TAX ID / เบอร์…" /></div>
          <span className="count">{rows.length} / {SD.suppliers.length} ราย</span>
        </div>
        <div className="tbl"><div className="scroll">
          <table>
            <thead><tr>
              <th>รหัส</th><th>ชื่อเจ้าหนี้</th><th>ผู้ติดต่อ</th><th>เบอร์โทร</th><th>เลขผู้เสียภาษี</th><th>บัญชีโอน</th><th className="c">เครดิต</th><th className="c">จัดการ</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code}>
                  <td><span className="code" style={{ color: "var(--clay)", background: "#F6E5DC" }}>{r.code}</span></td>
                  <td className="name">{r.name}</td>
                  <td className="muted">{r.contact || "—"}</td>
                  <td className="num muted">{r.tel || "—"}</td>
                  <td className="num muted" style={{ fontSize: 12 }}>{r.taxId || "—"}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.bankName ? <><b style={{ color: "var(--ink-2)" }}>{r.bankName}</b> · <span className="num">{r.bankAccount}</span></> : "—"}</td>
                  <td className="c">{r.creditDays ? <span className="pill gray">{r.creditDays} วัน</span> : "—"}</td>
                  <td className="c"><div className="rowbtns" style={{ justifyContent: "center" }}>
                    <button className="btn sm ghost" style={{ color: "var(--blue)" }} onClick={() => setEdit(r)}>{ICO.edit}</button>
                    <button className="btn sm ghost" style={{ color: "var(--red)" }} onClick={() => setDel(r)}>{ICO.trash}</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div><div className="foot-bar">{rows.length} รายการ · ทั้งหมด {SD.suppliers.length} เจ้าหนี้</div></div>
      </div>

      {edit && <SuppForm supp={edit} onClose={() => setEdit(null)} onSave={() => { setEdit(null); showToast(edit.code ? "อัปเดตเจ้าหนี้แล้ว" : "เพิ่มเจ้าหนี้แล้ว"); }} />}
      {del && <Modal title="ยืนยันการลบ" icon={<span style={{ color: "var(--red)" }}>{ICO.trash}</span>} onClose={() => setDel(null)} max="400"
        footer={<><button className="btn ghost" onClick={() => setDel(null)}>ยกเลิก</button><button className="btn" style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)" }} onClick={() => { showToast("ลบ " + del.code + " แล้ว"); setDel(null); }}>ลบ</button></>}>
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div className="code" style={{ color: "var(--red)", background: "var(--red-soft)", fontSize: 14 }}>{del.code}</div>
          <div style={{ fontWeight: 600, margin: "10px 0 4px" }}>{del.name}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>ลบแล้วไม่สามารถกู้คืนได้ (deleteSupplier)</div>
        </div>
      </Modal>}
      {toast}
    </Win>
  );
}

function SuppForm({ supp, onClose, onSave }) {
  const isNew = !supp.code;
  const [f, setF] = sS({ code:"", name:"", taxId:"", contact:"", tel:"", address:"", bankName:"", bankAccount:"", chequePayable:"", creditDays:30, note:"", ...supp });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={isNew ? "เพิ่มเจ้าหนี้ใหม่" : "แก้ไข — " + supp.code} icon={<span style={{ color: "var(--clay)" }}>{ICO.truck}</span>} onClose={onClose} max="580"
      footer={<><button className="btn ghost" onClick={onClose}>ยกเลิก</button><button className="btn primary" disabled={!f.name.trim()} onClick={() => onSave(f)}>บันทึก</button></>}>
      <div className="sec-title-row">ข้อมูลพื้นฐาน</div>
      <div className="fgrid">
        <Field label="รหัสเจ้าหนี้"><input className="in num" value={isNew ? "(auto)" : f.code} readOnly style={{ background: "var(--paper-2)", color: "var(--ink-3)" }} /></Field>
        <Field label="เลขผู้เสียภาษี (13 หลัก)"><input className="in num" value={f.taxId} onChange={set("taxId")} maxLength="13" placeholder="0000000000000" /></Field>
        <Field label="ชื่อเจ้าหนี้ / บริษัท" req full><input className="in" value={f.name} onChange={set("name")} placeholder="ชื่อบริษัท / ร้านค้า" /></Field>
        <Field label="ผู้ติดต่อ / พนักงานขาย"><input className="in" value={f.contact} onChange={set("contact")} placeholder="ชื่อพนักงานขาย" /></Field>
        <Field label="เบอร์โทรศัพท์"><input className="in num" value={f.tel} onChange={set("tel")} placeholder="0XX-XXX-XXXX" /></Field>
        <Field label="ที่อยู่" full><input className="in" value={f.address} onChange={set("address")} placeholder="ที่อยู่" /></Field>
      </div>
      <div className="sec-title-row" style={{ marginTop: 16 }}>ข้อมูลการชำระเงิน</div>
      <div className="fgrid">
        <Field label="ธนาคาร"><input className="in" value={f.bankName} onChange={set("bankName")} placeholder="กรุงไทย / กสิกร / SCB…" /></Field>
        <Field label="เลขบัญชีโอนเงิน"><input className="in num" value={f.bankAccount} onChange={set("bankAccount")} placeholder="XXX-X-XXXXX-X" /></Field>
        <Field label="เช็คสั่งจ่ายในนาม"><input className="in" value={f.chequePayable} onChange={set("chequePayable")} placeholder="ชื่อที่สั่งจ่าย" /></Field>
        <Field label="เทอมเครดิต (วัน)"><input className="in num" type="number" value={f.creditDays} onChange={set("creditDays")} /></Field>
        <Field label="หมายเหตุ" full><input className="in" value={f.note} onChange={set("note")} /></Field>
      </div>
    </Modal>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<SupplierPage />);
