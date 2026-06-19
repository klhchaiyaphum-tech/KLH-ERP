/* ============================================================
   page-wms.jsx — WMS คลังสินค้า redesigned, KLH theme — 5 tabs
   maps: getWmsData · receiveGoods · transferGoods · getStockBalance ·
         adjustStock · createPickList · getPickLists · updatePickItem ·
         completePickList · getRopConfig · saveRopConfigs · lookupSkuForWms
   ============================================================ */
const { useState: wS, useMemo: wMemo } = React;
const WD = window.WMS;
const whName = (id) => { const w = WD.warehouses.find((x) => x.id === id); return w ? w.id + " — " + w.name : id; };

function WmsPage() {
  const [tab, setTab] = wS("receive");
  const [scan, setScan] = wS(null);     // {field} when scanning
  const [toast, showToast] = useToast();
  const TABS = [
    ["receive", "รับสินค้า", ICO.box], ["transfer", "โอนสินค้า", ICO.truck], ["stock", "ดูสต็อก", ICO.box],
    ["picklist", "Pick List", ICO.doc], ["rop", "ตั้งค่า ROP", ICO.gear],
  ];
  return (
    <Win title="KLH · WMS — ระบบคลังสินค้า">
      <div className="phead">
        <div className="pic" style={{ background: "linear-gradient(135deg,#FF7A2E,#E2502B)" }}>{ICO.box}</div>
        <div><h1>บริหารคลัง · WMS</h1><p>รับเข้า โอนระหว่างคลัง ดูสต็อก สร้าง Pick List และตั้งจุดสั่งซื้อ ROP</p></div>
        <div className="actions"><button className="btn ghost" onClick={() => showToast("รีเฟรชข้อมูลคลัง")}>{ICO.refresh} รีเฟรช</button></div>
      </div>
      <div className="tabs">
        {TABS.map(([k, t, ic]) => <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{ic} {t}</button>)}
      </div>
      <div className="body">
        {tab === "receive" && <ReceiveForm onScan={() => setScan({ to: "receive" })} onSave={() => showToast("บันทึกรับสินค้าแล้ว")} />}
        {tab === "transfer" && <TransferForm onScan={() => setScan({ to: "transfer" })} onSave={() => showToast("โอนสินค้าแล้ว")} />}
        {tab === "stock" && <StockTab onAdjust={() => showToast("ปรับสต็อกแล้ว")} />}
        {tab === "picklist" && <PickListTab onToast={showToast} />}
        {tab === "rop" && <RopTab onToast={showToast} />}
      </div>
      {scan && <ScanModal onClose={() => setScan(null)} onResult={(code) => { setScan(null); showToast("สแกนได้: " + code); }} />}
      {toast}
    </Win>
  );
}

/* ---- TAB 1: Receive ---- */
function ReceiveForm({ onScan, onSave }) {
  const [f, setF] = wS({ sku:"", name:"", unit:"", wh:"W2", qty:"", cost:"", ref:"", date:"2026-06-11", entity:"", note:"", convRate:1, baseUnit:"" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const lookup = () => { const s = WD.skus[f.sku.trim()]; if (s) setF((x) => ({ ...x, name:s.name, unit:s.unit, entity:s.entity, convRate:s.convRate, baseUnit:s.baseUnit })); };
  const pieces = (Number(f.qty) || 0) * (f.convRate || 1);
  const perPiece = f.convRate > 1 ? (Number(f.cost) || 0) / f.convRate : 0;
  return (
    <div className="formwrap">
      <div className="formcard">
        <div className="fc-head" style={{ background: "linear-gradient(90deg,#E2502B,#F6704C)" }}>{ICO.box} รับสินค้าเข้าคลัง</div>
        <div className="fc-body">
          <Field label="รหัสสินค้า / บาร์โค้ด" full>
            <div className="scan-in"><input className="in" value={f.sku} onChange={set("sku")} onBlur={lookup} placeholder="สแกนหรือพิมพ์รหัสสินค้า" /><button className="scanbtn" onClick={onScan}>{ICO.scan}</button></div>
          </Field>
          <div className="fgrid">
            <Field label="ชื่อสินค้า" full><input className="in" value={f.name} onChange={set("name")} placeholder="(auto-fill จากรหัส)" /></Field>
            <Field label="คลังปลายทาง"><select value={f.wh} onChange={set("wh")}>{WD.warehouses.map((w) => <option key={w.id} value={w.id}>{whName(w.id)}</option>)}</select></Field>
            <Field label="หน่วยใหญ่"><input className="in" value={f.unit} onChange={set("unit")} placeholder="ลัง/แพ็ก" /></Field>
            <Field label={"จำนวน (" + (f.unit || "หน่วย") + ")"}><input className="in num" type="number" value={f.qty} onChange={set("qty")} placeholder="0" /></Field>
            <Field label={"ต้นทุน/" + (f.unit || "หน่วย") + " (฿)"}><input className="in num" type="number" value={f.cost} onChange={set("cost")} placeholder="0.00" /></Field>
          </div>
          {f.convRate > 1 && Number(f.qty) > 0 && (
            <div className="note blue" style={{ marginTop: 12 }}>รับเข้า <b>{pieces}</b> {f.baseUnit} · ต้นทุน/{f.baseUnit} <b className="num">{perPiece.toFixed(2)}</b> ฿ · รวม <b className="num">{(pieces * perPiece).toFixed(2)}</b> ฿</div>
          )}
          <div className="fgrid" style={{ marginTop: 14 }}>
            <Field label="เลขที่ PO / ใบกำกับ"><input className="in num" value={f.ref} onChange={set("ref")} placeholder="PO-XXXXXX" /></Field>
            <Field label="วันที่รับ"><input className="in num" type="date" value={f.date} onChange={set("date")} /></Field>
            <Field label="Entity" full><input className="in" value={f.entity} onChange={set("entity")} placeholder="(auto-fill)" /></Field>
            <Field label="หมายเหตุ" full><input className="in" value={f.note} onChange={set("note")} /></Field>
          </div>
          <button className="btn primary" style={{ width: "100%", marginTop: 16, padding: 13 }} disabled={!f.sku || !f.qty} onClick={onSave}>{ICO.box} บันทึก รับสินค้า</button>
        </div>
      </div>
    </div>
  );
}

/* ---- TAB 2: Transfer ---- */
function TransferForm({ onScan, onSave }) {
  const [f, setF] = wS({ sku:"", name:"", unit:"", from:"W2", to:"W1", qty:"", ref:"", note:"" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const lookup = () => { const s = WD.skus[f.sku.trim()]; if (s) setF((x) => ({ ...x, name:s.name, unit:s.unit })); };
  const stock = WD.stock.filter((r) => r.sku === f.sku.trim());
  const sameWh = f.from === f.to;
  return (
    <div className="formwrap">
      <div className="formcard">
        <div className="fc-head" style={{ background: "linear-gradient(90deg,#E2502B,#F6704C)" }}>{ICO.truck} โอนสินค้าระหว่างคลัง</div>
        <div className="fc-body">
          <Field label="รหัสสินค้า / บาร์โค้ด" full>
            <div className="scan-in"><input className="in" value={f.sku} onChange={set("sku")} onBlur={lookup} placeholder="สแกนหรือพิมพ์รหัสสินค้า" /><button className="scanbtn" onClick={onScan}>{ICO.scan}</button></div>
          </Field>
          {stock.length > 0 && <div className="note blue" style={{ marginBottom: 12 }}>คงเหลือ: {stock.map((r) => <span key={r.wh}><b>{r.wh}</b> {r.onHand} </span>)}</div>}
          <div className="fgrid">
            <Field label="ชื่อสินค้า"><input className="in" value={f.name} onChange={set("name")} placeholder="(auto-fill)" /></Field>
            <Field label="หน่วย"><input className="in" value={f.unit} onChange={set("unit")} /></Field>
            <Field label="จากคลัง"><select value={f.from} onChange={set("from")}>{WD.warehouses.map((w) => <option key={w.id} value={w.id}>{whName(w.id)}</option>)}</select></Field>
            <Field label="ไปคลัง"><select value={f.to} onChange={set("to")} style={sameWh ? { borderColor: "var(--red)" } : null}>{WD.warehouses.map((w) => <option key={w.id} value={w.id}>{whName(w.id)}</option>)}</select></Field>
            <Field label="จำนวน"><input className="in num" type="number" value={f.qty} onChange={set("qty")} placeholder="0" /></Field>
            <Field label="เลขอ้างอิง"><input className="in num" value={f.ref} onChange={set("ref")} placeholder="(auto-generate)" /></Field>
            <Field label="หมายเหตุ" full><input className="in" value={f.note} onChange={set("note")} /></Field>
          </div>
          {sameWh && <div className="note" style={{ marginTop: 12 }}>คลังต้นทาง/ปลายทางต้องต่างกัน</div>}
          <button className="btn primary" style={{ width: "100%", marginTop: 16, padding: 13 }} disabled={!f.sku || !f.qty || sameWh} onClick={onSave}>{ICO.truck} บันทึก โอนสินค้า</button>
        </div>
      </div>
    </div>
  );
}

/* ---- TAB 3: Stock ---- */
function StockTab({ onAdjust }) {
  const [wh, setWh] = wS("");
  const [q, setQ] = wS("");
  const [adj, setAdj] = wS(false);
  const rows = WD.stock.filter((r) => (!wh || r.wh === wh) && (!q || (r.sku + r.name).toLowerCase().includes(q.toLowerCase())));
  const skuCount = new Set(rows.map((r) => r.sku)).size;
  return (
    <>
      <div className="toolbar">
        <div className="sel"><select value={wh} onChange={(e) => setWh(e.target.value)}><option value="">ทุกคลัง</option>{WD.warehouses.map((w) => <option key={w.id} value={w.id}>{whName(w.id)}</option>)}</select><span className="cv">{ICO.chevR}</span></div>
        <div className="search">{ICO.search}<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา SKU / ชื่อ" /></div>
        <button className="btn ghost" onClick={() => setAdj(true)}>{ICO.edit} ปรับสต็อก</button>
      </div>
      <div className="tbl"><div className="scroll">
        <table>
          <thead><tr><th>SKU</th><th>ชื่อสินค้า</th><th className="c">คลัง</th><th className="r">คงเหลือ</th><th className="r">จอง</th><th className="r">ต้นทุนเฉลี่ย</th><th>อัปเดต</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><span className="code">{r.sku}</span></td>
                <td className="name">{r.name}</td>
                <td className="c"><span className="pill gray">{r.wh}</span></td>
                <td className="r num" style={{ fontWeight: 700, color: r.onHand <= 0 ? "var(--red)" : r.onHand < 20 ? "var(--amber)" : "var(--green)" }}>{r.onHand.toLocaleString()}</td>
                <td className="r num muted">{r.reserved || 0}</td>
                <td className="r num">{baht(r.costAvg, 1)}</td>
                <td className="muted" style={{ fontSize: 12 }}>{r.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div><div className="foot-bar">{rows.length} รายการ · {skuCount} SKU</div></div>
      {adj && <AdjustModal onClose={() => setAdj(false)} onSave={() => { setAdj(false); onAdjust(); }} />}
    </>
  );
}

function AdjustModal({ onClose, onSave }) {
  const [f, setF] = wS({ sku:"", wh:"W2", qty:"", reason:"" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="ปรับสต็อก" icon={<span style={{ color: "var(--coral-2)" }}>{ICO.edit}</span>} onClose={onClose} max="420"
      footer={<><button className="btn ghost" onClick={onClose}>ยกเลิก</button><button className="btn primary" disabled={!f.sku || f.qty === ""} onClick={onSave}>บันทึกปรับ</button></>}>
      <div className="fgrid" style={{ gridTemplateColumns: "1fr" }}>
        <Field label="SKU" req><input className="in num" value={f.sku} onChange={set("sku")} placeholder="SKU" /></Field>
        <Field label="คลัง"><select value={f.wh} onChange={set("wh")}>{WD.warehouses.map((w) => <option key={w.id} value={w.id}>{whName(w.id)}</option>)}</select></Field>
        <Field label="จำนวนจริง (Actual Count)" req><input className="in num" type="number" value={f.qty} onChange={set("qty")} /></Field>
        <Field label="เหตุผล"><input className="in" value={f.reason} onChange={set("reason")} placeholder="นับสต็อก / เสียหาย / …" /></Field>
      </div>
      <div className="note" style={{ marginTop: 12 }}>adjustStock — ระบบจะคำนวณส่วนต่างและบันทึก movement</div>
    </Modal>
  );
}

/* ---- TAB 4: Pick List ---- */
function PickListTab({ onToast }) {
  const [items, setItems] = wS([]);
  const [from, setFrom] = wS("W2");
  const [to, setTo] = wS("W1");
  const [sku, setSku] = wS("");
  const [qty, setQty] = wS("");
  const [note, setNote] = wS("");
  const [filter, setFilter] = wS("PENDING");
  const add = () => { if (!sku.trim() || !(Number(qty) > 0)) return; const s = WD.skus[sku.trim()]; setItems([...items, { sku: sku.trim(), qty: Number(qty), name: s ? s.name : sku.trim() }]); setSku(""); setQty(""); };
  const pls = WD.pickLists.filter((p) => !filter || p.status === filter);
  return (
    <div className="pl-grid">
      <div className="formcard">
        <div className="fc-head" style={{ background: "linear-gradient(90deg,#E2502B,#F6704C)" }}>{ICO.plus} สร้าง Pick List</div>
        <div className="fc-body">
          <div className="fgrid">
            <Field label="จากคลัง"><select value={from} onChange={(e) => setFrom(e.target.value)}>{WD.warehouses.map((w) => <option key={w.id} value={w.id}>{whName(w.id)}</option>)}</select></Field>
            <Field label="ไปคลัง / ปลายทาง"><select value={to} onChange={(e) => setTo(e.target.value)}><option value="">—</option>{WD.warehouses.map((w) => <option key={w.id} value={w.id}>{whName(w.id)}</option>)}</select></Field>
          </div>
          <div className="scan-in" style={{ marginTop: 12 }}>
            <input className="in" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" />
            <input className="in num" type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" style={{ maxWidth: 90 }} />
            <button className="scanbtn coral" onClick={add}>{ICO.plus}</button>
          </div>
          <div className="pl-items">
            {items.length === 0 ? <span className="muted">ยังไม่มีรายการ</span> : items.map((it, i) => (
              <div className="pl-item" key={i}><span><span className="code">{it.sku}</span> {it.name}</span><span><span className="qty-badge num">{it.qty}</span> <button className="lnk-x" onClick={() => setItems(items.filter((_, j) => j !== i))}>{ICO.close}</button></span></div>
            ))}
          </div>
          <Field label="หมายเหตุ" full><input className="in" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button className="btn primary" style={{ width: "100%", marginTop: 14 }} disabled={!items.length} onClick={() => { onToast("สร้าง Pick List แล้ว"); setItems([]); setNote(""); }}>สร้าง Pick List</button>
        </div>
      </div>
      <div className="formcard">
        <div className="fc-head" style={{ background: "var(--paper-2)", color: "var(--ink)", display: "flex", alignItems: "center" }}>
          {ICO.doc} <span style={{ flex: 1, marginLeft: 8 }}>Pick Lists</span>
          <div className="sel"><select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: "6px 28px 6px 10px", fontSize: 12.5 }}><option value="PENDING">Pending</option><option value="">ทั้งหมด</option><option value="DONE">Done</option></select><span className="cv">{ICO.chevR}</span></div>
        </div>
        <div className="fc-body" style={{ maxHeight: 460, overflowY: "auto" }}>
          {pls.length === 0 ? <div className="empty">ไม่มีรายการ</div> : pls.map((pl) => (
            <div className="plcard" key={pl.plId}>
              <div className="plc-top"><b>{pl.plId}</b><span className={"pill " + (pl.status === "DONE" ? "green" : "amber")}>{pl.status}</span></div>
              <div className="muted" style={{ fontSize: 12, margin: "3px 0 9px" }}>{pl.whFrom} → {pl.whTo || "—"} · {pl.date}</div>
              <table className="mini-tbl"><tbody>
                {pl.items.map((it) => (
                  <tr key={it.sku}><td><span className="code">{it.sku}</span></td><td>{it.name}</td><td className="r muted">{it.qtyReq}</td><td className="r num" style={{ fontWeight: 700, color: it.qtyPicked >= it.qtyReq ? "var(--green)" : "var(--amber)" }}>{it.qtyPicked}/{it.qtyReq}</td></tr>
                ))}
              </tbody></table>
              {pl.status !== "DONE" && <button className="btn green sm" style={{ width: "100%", marginTop: 9 }} onClick={() => onToast("ปิด " + pl.plId + " เสร็จสิ้น")}>ทำเสร็จแล้ว</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- TAB 5: ROP ---- */
function RopTab({ onToast }) {
  const [rows, setRows] = wS(WD.rop.map((r) => ({ ...r })));
  const upd = (i, k, v) => setRows(rows.map((r, j) => j === i ? { ...r, [k]: v } : r));
  return (
    <>
      <div className="toolbar">
        <span className="grow" style={{ fontWeight: 600, color: "var(--ink-2)" }}>ตั้งจุดสั่งซื้อ (ROP) / ปริมาณสั่ง (ROQ) ต่อ SKU·คลัง</span>
        <button className="btn ghost" onClick={() => setRows([...rows, { sku:"", wh:"W1", rop:0, roq:0, maxStock:0, active:true }])}>{ICO.plus} เพิ่ม</button>
        <button className="btn primary" onClick={() => onToast("บันทึก ROP " + rows.length + " รายการ")}>บันทึก</button>
      </div>
      <div className="tbl"><div className="scroll">
        <table>
          <thead><tr><th>SKU</th><th className="c">คลัง</th><th className="c">ROP (จุดสั่ง)</th><th className="c">ROQ (ปริมาณสั่ง)</th><th className="c">Max Stock</th><th className="c">Active</th><th></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><input className="cellin num" value={r.sku} onChange={(e) => upd(i, "sku", e.target.value)} placeholder="SKU" style={{ width: 130 }} /></td>
                <td className="c"><select className="cellin" value={r.wh} onChange={(e) => upd(i, "wh", e.target.value)}>{WD.warehouses.map((w) => <option key={w.id} value={w.id}>{w.id}</option>)}</select></td>
                <td className="c"><input className="cellin num" type="number" value={r.rop} onChange={(e) => upd(i, "rop", e.target.value)} style={{ width: 70 }} /></td>
                <td className="c"><input className="cellin num" type="number" value={r.roq} onChange={(e) => upd(i, "roq", e.target.value)} style={{ width: 70 }} /></td>
                <td className="c"><input className="cellin num" type="number" value={r.maxStock} onChange={(e) => upd(i, "maxStock", e.target.value)} style={{ width: 70 }} /></td>
                <td className="c"><input type="checkbox" checked={r.active} onChange={(e) => upd(i, "active", e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--coral)" }} /></td>
                <td className="c"><button className="btn sm ghost" style={{ color: "var(--red)" }} onClick={() => setRows(rows.filter((_, j) => j !== i))}>{ICO.trash}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </>
  );
}

/* ---- Scan modal (shared) ---- */
function ScanModal({ onClose, onResult }) {
  React.useEffect(() => { const t = setTimeout(() => onResult("ITEM-0001"), 1900); return () => clearTimeout(t); }, []);
  return (
    <div className="ovl" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="mh"><span style={{ color: "var(--coral-2)" }}>{ICO.scan}</span><h3>สแกนบาร์โค้ด</h3><button className="tb-btn" onClick={onClose}>{ICO.close}</button></div>
        <div className="mb">
          <div className="scanview"><span className="laser" /><span className="cn tl" /><span className="cn tr" /><span className="cn bl" /><span className="cn br" /></div>
          <div className="center muted" style={{ marginTop: 12, fontSize: 13 }}>กำลังเล็งกล้องอ่านบาร์โค้ด…</div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<WmsPage />);
