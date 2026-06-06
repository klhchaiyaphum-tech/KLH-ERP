/* ============================================================
   klh-mods-a.jsx — Price List · WMS · Supplier Master
   register on window.KLH_SCREENS
   ============================================================ */
const { useState: aS, useMemo: aM } = React;

/* ============================================================
   PRICE LIST — book-style price table, by category, searchable
   ============================================================ */
function PriceList({ mod }) {
  const cats = KLH.priceCats;
  const [cat, setCat] = aS(cats[0].id);
  const [q, setQ] = aS("");
  const [tier, setTier] = aS("all"); // all | retail | whole
  const cur = cats.find((c) => c.id === cat);
  const rows = aM(() => cur.items.filter((it) => !q || it.name.includes(q) || it.code.includes(q)), [cur, q]);

  return (
    <div className="winner">
      <ModHead mod={mod}>
        <button className="btn sm">{Ui.print} พิมพ์</button>
        <button className="btn sm primary">{Ui.plus} เพิ่มสินค้า</button>
      </ModHead>

      <div className="toolbar">
        <div className="search">{Ui.searchS}<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อสินค้า / รหัส / บาร์โค้ด…" /></div>
        <div className="seg">
          {[["all","ทุกราคา"],["retail","ราคาปลีก"],["whole","ราคาส่ง"]].map(([k,l]) => (
            <button key={k} className={tier === k ? "on" : ""} onClick={() => setTier(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="split" style={{ gap: 16 }}>
        {/* category rail */}
        <div className="side" style={{ width: 220 }}>
          <div className="surface" style={{ padding: 6 }}>
            {cats.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 11, textAlign: "left",
                background: cat === c.id ? "var(--coral-soft)" : "transparent",
              }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: mod.color, opacity: cat === c.id ? 1 : .35, flex: "0 0 auto" }} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: cat === c.id ? 700 : 500, color: cat === c.id ? "var(--coral-2)" : "var(--ink)" }}>{c.name}</span>
                <span className="num" style={{ fontSize: 12, color: "var(--ink-3)" }}>{c.items.length}</span>
              </button>
            ))}
          </div>
        </div>

        {/* table */}
        <div className="main">
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "2px 2px 12px" }}>
            <span style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap" }}>{cur.name}</span>
            <span className="count">{rows.length} รายการ</span>
          </div>
          <div className="tbl">
            <table>
              <thead><tr>
                <th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>ขนาด</th><th>บรรจุ/หน่วย</th>
                {(tier === "all") && <th className="r">ราคาทุน</th>}
                {(tier === "all" || tier === "retail") && <th className="r">ราคาปลีก</th>}
                {(tier === "all" || tier === "whole") && <th className="r">ราคาส่ง</th>}
              </tr></thead>
              <tbody>
                {rows.map((it) => (
                  <tr key={it.code}>
                    <td><span className="code">{it.code}</span></td>
                    <td className="name">{it.name}</td>
                    <td className="muted">{it.size}</td>
                    <td><span className="pill gray">{it.pack}</span></td>
                    {(tier === "all") && <td className="r price muted">{it.cost.toLocaleString()}</td>}
                    {(tier === "all" || tier === "retail") && <td className="r price">{it.retail}</td>}
                    {(tier === "all" || tier === "whole") && <td className="r price" style={{ color: "var(--coral-2)" }}>{it.whole}</td>}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan="7"><div className="empty">ไม่พบสินค้า “{q}”</div></td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12.5, color: "var(--ink-3)" }}>
            <span>{cur.name} · {rows.length} รายการ</span><span>KLH Group · ปรับปรุงล่าสุด วันนี้</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   WMS — รับสินค้า / โอน / ดูสต็อก / Pick List / ตั้งค่า ROP
   ============================================================ */
function WMS({ mod }) {
  const [tab, setTab] = aS("receive");
  const tabs = [["receive","รับสินค้า"],["transfer","โอนสินค้า"],["stock","ดูสต็อก"],["pick","Pick List"],["rop","ตั้งค่า ROP"]];
  return (
    <div className="winner">
      <ModHead mod={mod}>
        <button className="btn sm">{Ui.refresh} รีเฟรช</button>
      </ModHead>
      <div className="seg" style={{ marginBottom: 18 }}>
        {tabs.map(([k,l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === "receive" && <WmsReceive mod={mod} />}
      {tab === "transfer" && <WmsTransfer mod={mod} />}
      {tab === "stock" && <WmsStock />}
      {tab === "pick" && <WmsPick />}
      {tab === "rop" && <WmsRop />}
    </div>
  );
}

function WmsReceive({ mod }) {
  const [saved, setSaved] = aS(false);
  return (
    <div className="split">
      <div className="main" style={{ maxWidth: 640 }}>
        <div className="surface" style={{ padding: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Sq color={mod.color} size={28} radius={8} style={{ boxShadow: "none" }}><span style={{ fontSize: 15 }}>{Ui.plus}</span></Sq>
            <span style={{ whiteSpace: "nowrap" }}>รับสินค้าเข้าคลัง</span>
          </div>
          <div className="form-grid">
            <div className="field full">
              <label>รหัสสินค้า / บาร์โค้ด</label>
              <div className="input-scan">
                <input className="input" placeholder="สแกนหรือพิมพ์รหัสสินค้า" />
                <button className="iconbtn" style={{ width: 44 }}>{Ui.scan}</button>
              </div>
            </div>
            <div className="field"><label>ชื่อสินค้า</label><input className="input" placeholder="(auto-fill จากรหัสสินค้า)" /></div>
            <div className="field"><label>หน่วยใหญ่</label><input className="input" defaultValue="ลัง/แพ็ก" /></div>
            <div className="field full"><label>คลังปลายทาง</label>
              <select defaultValue="W1">{KLH.warehouses.map((w) => <option key={w.id} value={w.id}>{w.id} — {w.name}</option>)}</select>
            </div>
            <div className="field"><label>จำนวน (หน่วย)</label><input className="input num" placeholder="0" /></div>
            <div className="field"><label>ต้นทุน/หน่วย (฿)</label><input className="input num" placeholder="0.00" /></div>
            <div className="field"><label>เลขที่ PO/ใบกำกับ</label><input className="input" placeholder="PO-XXXXXX" /></div>
            <div className="field"><label>วันที่รับ</label><input className="input" type="date" defaultValue="2026-06-05" /></div>
            <div className="field full"><label>Entity (กิจการ)</label>
              <select>{KLH.entities.map((e) => <option key={e.id}>{e.name}</option>)}</select>
            </div>
            <div className="field full"><label>หมายเหตุ</label><input className="input" placeholder="หมายเหตุเพิ่มเติม" /></div>
          </div>
          <button className="btn primary" style={{ width: "100%", marginTop: 18, padding: 14 }} onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 1800); }}>
            {Ui.check} {saved ? "บันทึกแล้ว ✓" : "บันทึก รับสินค้า"}
          </button>
        </div>
      </div>
      <div className="side">
        <div className="surface" style={{ padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>รับเข้าล่าสุดวันนี้</div>
          <div className="list-rows">
            {[["แป้งจิงโจ้ กระสอบ 22.5 กก.","40 กระสอบ","W2"],["เนยสด อลาวรี่ 5 กก.","12 ลัง","W3"],["น้ำตาลทราย 1 กก.","200 ถุง","W1"]].map((r,i) => (
              <div key={i}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{r[0]}</div><div className="num" style={{ fontSize: 12, color: "var(--ink-3)" }}>{r[1]}</div></div>
                <span className="pill coral">{r[2]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="note" style={{ marginTop: 14 }}>เมื่อบันทึก ระบบจะตัด PO อัปเดตสต็อกคลังปลายทาง และส่งแจ้งเตือนเข้า LINE กลุ่มจัดซื้ออัตโนมัติ</div>
      </div>
    </div>
  );
}

function WmsTransfer() {
  return (
    <div className="main" style={{ maxWidth: 640 }}>
      <div className="surface" style={{ padding: 22 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>โอนสินค้าระหว่างคลัง</div>
        <div className="form-grid">
          <div className="field"><label>คลังต้นทาง</label><select defaultValue="W2">{KLH.warehouses.map((w) => <option key={w.id} value={w.id}>{w.id} — {w.name}</option>)}</select></div>
          <div className="field"><label>คลังปลายทาง</label><select defaultValue="W1">{KLH.warehouses.map((w) => <option key={w.id} value={w.id}>{w.id} — {w.name}</option>)}</select></div>
          <div className="field full"><label>รหัสสินค้า / บาร์โค้ด</label><div className="input-scan"><input className="input" placeholder="สแกนหรือพิมพ์รหัสสินค้า" /><button className="iconbtn" style={{ width: 44 }}>{Ui.scan}</button></div></div>
          <div className="field"><label>จำนวน (หน่วย)</label><input className="input num" placeholder="0" /></div>
          <div className="field"><label>วันที่โอน</label><input className="input" type="date" defaultValue="2026-06-05" /></div>
        </div>
        <button className="btn primary" style={{ width: "100%", marginTop: 18, padding: 14 }}>{Ui.check} ยืนยันการโอน</button>
      </div>
    </div>
  );
}

function WmsStock() {
  const [q, setQ] = aS("");
  const stock = [
    { code: "ITEM-0001", name: "แป้งจิงโจ้ 1 กก.", w: "W1", qty: 86, rop: 50, unit: "ถุง" },
    { code: "ITEM-0002", name: "แป้งจิงโจ้ กระสอบ 22.5 กก.", w: "W2", qty: 14, rop: 20, unit: "กระสอบ" },
    { code: "ITEM-0034", name: "เนยสด อลาวรี่ 5 กก.", w: "W3", qty: 6, rop: 10, unit: "ลัง" },
    { code: "ITEM-0102", name: "น้ำดื่ม สิงห์ 600 มล.", w: "W1", qty: 240, rop: 120, unit: "ขวด" },
    { code: "ITEM-0203", name: "ข้าวหอมมะลิ 5 กก.", w: "W2", qty: 58, rop: 40, unit: "ถุง" },
    { code: "ITEM-0301", name: "กล่องเค้ก 1 ปอนด์", w: "W3", qty: 320, rop: 200, unit: "ใบ" },
  ];
  const rows = stock.filter((s) => !q || s.name.includes(q) || s.code.includes(q));
  return (
    <>
      <div className="toolbar">
        <div className="search">{Ui.searchS}<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาสินค้าในสต็อก…" /></div>
        <div className="dd">คลัง: ทั้งหมด {Ui.chevron}</div>
      </div>
      <div className="tbl">
        <table>
          <thead><tr><th>รหัส</th><th>ชื่อสินค้า</th><th className="c">คลัง</th><th className="r">คงเหลือ</th><th className="r">ROP</th><th className="c">สถานะ</th></tr></thead>
          <tbody>
            {rows.map((s) => {
              const low = s.qty <= s.rop;
              return (
                <tr key={s.code + s.w}>
                  <td><span className="code">{s.code}</span></td>
                  <td className="name">{s.name}</td>
                  <td className="c"><span className="pill gray">{s.w}</span></td>
                  <td className="r price">{s.qty} <span className="muted" style={{ fontWeight: 400 }}>{s.unit}</span></td>
                  <td className="r muted num">{s.rop}</td>
                  <td className="c">{low ? <span className="pill amber"><span className="ld"></span>ต่ำกว่า ROP</span> : <span className="pill green"><span className="ld"></span>ปกติ</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function WmsPick() {
  const picks = [
    { no: "PICK-0605-01", order: "ORD-20260605-001", cust: "ร้านเค้กบ้านสวน", lines: 6, status: "รอจัด" },
    { no: "PICK-0605-02", order: "ORD-20260605-003", cust: "คาเฟ่ มุมหวาน", lines: 3, status: "กำลังจัด" },
  ];
  return (
    <div className="tbl">
      <table>
        <thead><tr><th>เลขที่ Pick</th><th>ออเดอร์</th><th>ลูกค้า</th><th className="c">รายการ</th><th className="c">สถานะ</th><th className="r">จัดการ</th></tr></thead>
        <tbody>
          {picks.map((p) => (
            <tr key={p.no}>
              <td><span className="code">{p.no}</span></td>
              <td className="muted num">{p.order}</td>
              <td className="name">{p.cust}</td>
              <td className="c num">{p.lines}</td>
              <td className="c"><span className={"pill " + (p.status === "รอจัด" ? "amber" : "blue")}>{p.status}</span></td>
              <td className="r"><button className="btn sm primary">เริ่มจัด</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WmsRop() {
  return (
    <div className="main" style={{ maxWidth: 680 }}>
      <div className="note" style={{ marginBottom: 14 }}>ตั้งจุดสั่งซื้อซ้ำ (ROP) ต่อสินค้า/คลัง · เมื่อคงเหลือ ≤ ROP ระบบจะแจ้งเตือนเข้า LINE กลุ่มจัดซื้อ</div>
      <div className="tbl">
        <table>
          <thead><tr><th>รหัส</th><th>ชื่อสินค้า</th><th className="c">คลัง</th><th className="r">ROP</th><th className="c">แจ้ง LINE</th></tr></thead>
          <tbody>
            {[["ITEM-0002","แป้งจิงโจ้ กระสอบ 22.5 กก.","W2",20],["ITEM-0034","เนยสด อลาวรี่ 5 กก.","W3",10],["ITEM-0203","ข้าวหอมมะลิ 5 กก.","W2",40]].map((r,i) => (
              <tr key={i}>
                <td><span className="code">{r[0]}</span></td><td className="name">{r[1]}</td><td className="c"><span className="pill gray">{r[2]}</span></td>
                <td className="r"><input className="input num" defaultValue={r[3]} style={{ width: 80, textAlign: "right", padding: "7px 10px" }} /></td>
                <td className="c"><span className="pill green"><span className="ld"></span>เปิด</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn primary" style={{ marginTop: 16 }}>{Ui.check} บันทึกการตั้งค่า</button>
    </div>
  );
}

/* ============================================================
   SUPPLIER MASTER — เจ้าหนี้/ผู้จำหน่าย list + add
   ============================================================ */
function Supplier({ mod }) {
  const [q, setQ] = aS("");
  const rows = KLH.suppliers.filter((s) => !q || s.name.includes(q) || s.code.includes(q) || (s.phone || "").includes(q));
  return (
    <div className="winner">
      <ModHead mod={mod}>
        <button className="btn sm">{Ui.refresh} รีเฟรช</button>
        <button className="btn sm primary">{Ui.plus} เพิ่มเจ้าหนี้</button>
      </ModHead>
      <div className="toolbar">
        <div className="search">{Ui.searchS}<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัส / ชื่อ / TAX ID / เบอร์…" /></div>
        <span className="count">{rows.length} / {KLH.suppliers.length} รายการ · ทั้งหมด 190</span>
      </div>
      <div className="tbl">
        <table>
          <thead><tr><th>รหัส</th><th>ชื่อเจ้าหนี้</th><th>ผู้ติดต่อ</th><th>เบอร์โทร</th><th>เลขผู้เสียภาษี</th><th className="c">เครดิต</th><th className="r">จัดการ</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.code}>
                <td><span className="code">{s.code}</span></td>
                <td className="name">{s.name}{s.note && <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 400, marginTop: 2 }}>{s.note}</div>}</td>
                <td className="muted">{s.contact}</td>
                <td className="num muted">{s.phone}</td>
                <td className="num muted">{s.tax}</td>
                <td className="c">{s.credit > 0 ? <span className="pill blue num">{s.credit} วัน</span> : <span className="muted">—</span>}</td>
                <td className="r"><div style={{ display: "inline-flex", gap: 6 }}><button className="iconbtn" style={{ width: 30, height: 30, color: "var(--coral-2)" }}>{Ui.edit}</button><button className="iconbtn" style={{ width: 30, height: 30, color: "var(--ink-3)" }}>{Ui.trash}</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.KLH_SCREENS = Object.assign(window.KLH_SCREENS || {}, { price: PriceList, wms: WMS, supplier: Supplier });
