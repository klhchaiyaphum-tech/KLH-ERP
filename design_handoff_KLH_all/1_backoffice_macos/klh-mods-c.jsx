/* ============================================================
   klh-mods-c.jsx — POS launcher · Customer & AR · Accounting
   ============================================================ */
const { useState: cS2, useMemo: cM2 } = React;

/* ============================================================
   POS — back-office view of front-of-house sale terminals
   ============================================================ */
function POS({ mod }) {
  const [tab, setTab] = cS2("today");
  const sales = [
    { no: "ORD-20260605-014", term: "PC #1", cashier: "นัท", time: "16:42", items: 8, total: 1240, status: "ชำระแล้ว" },
    { no: "ORD-20260605-013", term: "T2 #1", cashier: "ฝน", time: "16:31", items: 3, total: 318, status: "ชำระแล้ว" },
    { no: "ORD-20260605-012", term: "Handheld", cashier: "บอย", time: "16:20", items: 24, total: 980, status: "รอชำระ" },
    { no: "ORD-20260605-011", term: "PC #1", cashier: "นัท", time: "16:05", items: 2, total: 96, status: "ชำระแล้ว" },
  ];
  const terminals = [
    { name: "PC #1 — เคาน์เตอร์หน้า", type: "POS PC", on: true, sales: 28, amount: 14820 },
    { name: "T2 #1 — เคาน์เตอร์ใน", type: "Sunmi T2 Lite", on: true, sales: 19, amount: 9240 },
    { name: "Handheld A", type: "Sunmi มือถือ", on: true, sales: 12, amount: 3180 },
    { name: "Handheld B", type: "Sunmi มือถือ", on: false, sales: 0, amount: 0 },
  ];
  return (
    <div className="winner">
      <ModHead mod={mod}>
        <button className="btn sm">{Ui.print} รายงานยอดขาย</button>
        <button className="btn sm primary">{Ui.plus} เปิดการขายใหม่</button>
      </ModHead>
      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi"><div className="kv coral num">฿27,240</div><div className="kk">ยอดขายวันนี้</div><div className="kd">59 บิล</div></div>
        <div className="kpi"><div className="kv green num">฿24,180</div><div className="kk">ชำระแล้ว</div><div className="kd">52 บิล</div></div>
        <div className="kpi"><div className="kv blue num">฿3,060</div><div className="kk">รอชำระที่แคชเชียร์</div><div className="kd">7 บิล</div></div>
        <div className="kpi"><div className="kv num">3 / 4</div><div className="kk">เครื่องออนไลน์</div><div className="kd">Handheld B ปิด</div></div>
      </div>
      <div className="seg" style={{ marginBottom: 16 }}>
        {[["today","บิลวันนี้"],["terminals","เครื่องขาย"]].map(([k,l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === "today" ? (
        <div className="tbl">
          <table>
            <thead><tr><th>เลขออเดอร์</th><th>เครื่อง</th><th>พนักงาน</th><th className="c">เวลา</th><th className="c">รายการ</th><th className="r">ยอด</th><th className="c">สถานะ</th></tr></thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.no}>
                  <td><span className="code">{s.no}</span></td>
                  <td className="name">{s.term}</td>
                  <td className="muted">{s.cashier}</td>
                  <td className="c num muted">{s.time}</td>
                  <td className="c num">{s.items}</td>
                  <td className="r price">{baht(s.total)}</td>
                  <td className="c">{s.status === "ชำระแล้ว" ? <span className="pill green">ชำระแล้ว</span> : <span className="pill amber"><span className="ld"></span>รอชำระ</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
          {terminals.map((t) => (
            <div key={t.name} className="surface" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
              <Sq color={mod.color} size={44} radius={12} style={{ opacity: t.on ? 1 : .4 }}>{I.cart}</Sq>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{t.type}</div>
                <div className="num" style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4 }}>{t.on ? `${t.sales} บิล · ${baht(t.amount)}` : "—"}</div>
              </div>
              <span className={"pill " + (t.on ? "green" : "gray")}><span className="ld"></span>{t.on ? "ออนไลน์" : "ปิด"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CUSTOMER & AR — members, price tier, credit, receivables
   ============================================================ */
function Customer({ mod }) {
  const [tab, setTab] = cS2("members");
  const [q, setQ] = cS2("");
  const members = KLH.members;
  const rows = members.filter((m) => !q || m.name.includes(q) || (m.phone||"").includes(q));
  const totalAR = members.reduce((a,b) => a + b.ar, 0);
  const tierPill = (t) => t.includes("แพลทินัม") ? "blue" : t.includes("ทอง") ? "amber" : t === "ปลีก" ? "gray" : "coral";
  return (
    <div className="winner">
      <ModHead mod={mod}>
        <button className="btn sm">{Ui.print} ใบวางบิล AR</button>
        <button className="btn sm primary">{Ui.plus} เพิ่มสมาชิก</button>
      </ModHead>
      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi"><div className="kv num">{members.length}</div><div className="kk">สมาชิก</div></div>
        <div className="kpi"><div className="kv coral num">{baht(totalAR)}</div><div className="kk">ลูกหนี้คงค้าง (AR)</div></div>
        <div className="kpi"><div className="kv blue num">4</div><div className="kk">ระดับราคา</div><div className="kd">ปลีก · ส่ง-เงิน/ทอง/แพลทินัม</div></div>
        <div className="kpi"><div className="kv amber num">฿42,300</div><div className="kk">เกินกำหนดชำระ</div><div className="kd">2 ราย</div></div>
      </div>
      <div className="seg" style={{ marginBottom: 16 }}>
        {[["members","สมาชิก/ลูกค้า"],["ar","ลูกหนี้การค้า (AR)"]].map(([k,l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="toolbar"><div className="search">{Ui.searchS}<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / เบอร์โทร…" /></div><span className="count">{rows.length} ราย</span></div>
      {tab === "members" ? (
        <div className="tbl">
          <table>
            <thead><tr><th>รหัส</th><th>ชื่อลูกค้า</th><th>เบอร์โทร</th><th className="c">ระดับราคา</th><th className="r">วงเงินเครดิต</th><th className="r">คงเหลือ</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td><span className="code">{m.id}</span></td>
                  <td className="name">{m.name}</td>
                  <td className="num muted">{m.phone}</td>
                  <td className="c"><span className={"pill " + tierPill(m.tier)}>{m.tier}</span></td>
                  <td className="r price">{m.credit ? baht(m.credit) : "—"}</td>
                  <td className="r price" style={{ color: m.credit - m.ar < m.credit*0.2 && m.credit ? "var(--coral-2)" : "var(--ink)" }}>{m.credit ? baht(m.credit - m.ar) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>รหัส</th><th>ลูกหนี้</th><th className="r">ยอดค้าง (AR)</th><th className="c">อายุหนี้</th><th className="r">รับชำระ</th></tr></thead>
            <tbody>
              {rows.filter((m) => m.ar > 0).map((m) => (
                <tr key={m.id}>
                  <td><span className="code">{m.id}</span></td>
                  <td className="name">{m.name}</td>
                  <td className="r price" style={{ color: "var(--coral-2)" }}>{baht(m.ar)}</td>
                  <td className="c"><span className={"pill " + (m.ar > 50000 ? "amber" : "gray")}>{m.ar > 50000 ? "เกินกำหนด" : "ในกำหนด"}</span></td>
                  <td className="r"><button className="btn sm primary">รับชำระ AR</button></td>
                </tr>
              ))}
              {rows.filter((m) => m.ar > 0).length === 0 && <tr><td colSpan="5"><div className="empty">ไม่มีลูกหนี้คงค้าง</div></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ACCOUNTING — AP/AR/VAT overview (sub-menus = TODO)
   ============================================================ */
function Accounting({ mod }) {
  const subs = [
    { name: "เจ้าหนี้ (AP)", desc: "บิลซื้อ ครบกำหนดชำระ ใบสำคัญจ่าย", glyph: I.supplier, color: "#D1764F" },
    { name: "ลูกหนี้ (AR)", desc: "ใบวางบิล ใบเสร็จรับเงิน อายุหนี้", glyph: I.customer, color: "#4A52C8" },
    { name: "ภาษีซื้อ-ขาย (VAT)", desc: "รายงานภาษีซื้อ/ขาย ภ.พ.30", glyph: I.ocr, color: "#3A37C9" },
    { name: "กำไร-ขาดทุน", desc: "งบ P&L แยก 5 กิจการ", glyph: I.calc, color: "#E0962F" },
  ];
  return (
    <div className="winner">
      <ModHead mod={mod}>
        <span className="pill amber" style={{ alignSelf: "center" }}>กำลังพัฒนา · TODO</span>
      </ModHead>

      <div className="todo-banner" style={{ marginBottom: 18 }}>
        <b style={{ color: "var(--ink)" }}>หน้านี้เตรียมโครงไว้แล้ว</b> — เมนูย่อยด้านล่างยังไม่ได้ลงรายละเอียดเขียนโปรแกรม วางเป็นภาพรวมให้เห็นทิศทาง โครงสร้างข้อมูลผูกกับ Supplier Master (AP), Customer &amp; AR (AR) และ Invoice OCR (VAT) ที่มีอยู่แล้ว
      </div>

      {/* overview KPIs (ตัวเลขประมาณการ) */}
      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi"><div className="kv coral num">฿486,200</div><div className="kk">เจ้าหนี้คงค้าง (AP)</div><div className="kd">ครบกำหนด 7 วัน ฿128,400</div></div>
        <div className="kpi"><div className="kv blue num">฿115,400</div><div className="kk">ลูกหนี้คงค้าง (AR)</div><div className="kd">เกินกำหนด ฿42,300</div></div>
        <div className="kpi"><div className="kv num">฿38,950</div><div className="kk">ภาษีซื้อเดือนนี้</div><div className="kd">ภาษีขาย ฿51,200</div></div>
        <div className="kpi"><div className="kv green num">฿312,800</div><div className="kk">กำไรสุทธิ (ประมาณ)</div><div className="kd">รวม 5 กิจการ</div></div>
      </div>

      <div className="seclabel"><h2>เมนูย่อย</h2><span>วางโครงไว้ · ยังไม่เปิดใช้งาน</span></div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        {subs.map((s) => (
          <div key={s.name} className="surface" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, opacity: .9 }}>
            <Sq color={s.color} size={44} radius={12}>{s.glyph}</Sq>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>{s.desc}</div>
            </div>
            <span className="pill gray">TODO</span>
          </div>
        ))}
      </div>

      {/* per-entity table */}
      <div className="seclabel" style={{ marginTop: 24 }}><h2>แยกตามกิจการ</h2><span>5 กิจการ</span></div>
      <div className="tbl">
        <table>
          <thead><tr><th>กิจการ</th><th className="r">เจ้าหนี้ (AP)</th><th className="r">ลูกหนี้ (AR)</th><th className="r">ภาษีสุทธิ</th><th className="r">กำไร (ประมาณ)</th></tr></thead>
          <tbody>
            {[["หจก. เคแอลเอช",186200,52400,8200,124300],["บ. เคแอลเอช เบเกอรี่ จก.",142800,28600,4100,86400],["บ. เคแอลเอช ค้าส่ง จก.",98400,31200,640,71200],["ร้าน KLH สาขาตลาด",42600,3200,-720,24600],["KLH ออนไลน์",16200,0,30,6300]].map((r,i) => (
              <tr key={i}>
                <td className="name">{r[0]}</td>
                <td className="r price muted">{baht(r[1])}</td>
                <td className="r price muted">{baht(r[2])}</td>
                <td className="r price" style={{ color: r[3] < 0 ? "var(--coral-2)" : "var(--ink)" }}>{r[3] < 0 ? "-" : ""}{baht(Math.abs(r[3]))}</td>
                <td className="r price" style={{ color: "var(--green)" }}>{baht(r[4])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.KLH_SCREENS = Object.assign(window.KLH_SCREENS || {}, { pos: POS, customer: Customer, account: Accounting });
