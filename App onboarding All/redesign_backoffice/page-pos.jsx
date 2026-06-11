/* ============================================================
   page-pos.jsx — POS ขายหน้าร้าน redesigned, KLH theme
   3 device variants: PC (3-col) · T2 Lite (terminal+customer display) · Handheld
   shared cart + member + park-bill (hold/resume)
   maps: getPosPageData · createOrder/holdOrder/resumeOrder · member lookup
   ============================================================ */
const { useState: pS, useMemo: pMemo } = React;
const PD = window.POSD;
const baht2 = (n) => "฿" + Number(n || 0).toLocaleString("th-TH");
const prod = (id) => PD.products.find((p) => p.id === id);

function usePos() {
  const [cart, setCart] = pS({ "ITEM-0001": 5, "ITEM-0041": 3 });
  const [member, setMember] = pS(null);
  const [parked, setParked] = pS([{ no: 1042, count: 3, total: 412 }]);
  const [billNo, setBillNo] = pS(1043);
  const setQty = (id, q) => setCart((c) => { const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = q; return n; });
  const price = (p) => member && member.level === "whole" ? p.whole : p.retail;
  const items = Object.entries(cart);
  const sub = items.reduce((a, [id, q]) => a + price(prod(id)) * q, 0);
  const disc = member ? items.reduce((a, [id, q]) => a + (prod(id).retail - price(prod(id))) * q, 0) : 0;
  const count = items.reduce((a, [, q]) => a + q, 0);
  const park = () => { if (!count) return; setParked([...parked, { no: billNo, count, total: sub }]); setCart({}); setMember(null); setBillNo(billNo + 1); };
  const resume = (no) => { setParked(parked.filter((p) => p.no !== no)); };
  const newBill = () => { if (count) park(); setCart({}); setMember(null); };
  return { cart, setQty, member, setMember, parked, billNo, items, sub, disc, count, price, park, resume, newBill };
}

/* ---- catalog grid (shared) ---- */
function Catalog({ pos, big, cols }) {
  const [cat, setCat] = pS("all");
  const [q, setQ] = pS("");
  const list = PD.products.filter((p) => (cat === "all" || p.cat === cat) && (!q || p.name.includes(q) || p.id.includes(q)));
  return (
    <div className="pos-cat">
      <div className="pos-search">{ICO.search}<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="สแกนบาร์โค้ด / ค้นหาสินค้า…" /><span className="muted" style={{ fontSize: 12 }}>{list.length} รายการ</span></div>
      <div className="cat-chips">{PD.cats.map((c) => <button key={c.id} className={"cchip" + (cat === c.id ? " on" : "")} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>
      <div className={"pgrid" + (big ? " big" : "")} style={cols ? { gridTemplateColumns: `repeat(${cols},1fr)` } : null}>
        {list.map((p) => {
          const inCart = pos.cart[p.id] || 0;
          return (
            <button key={p.id} className={"pcard" + (inCart ? " in" : "")} onClick={() => pos.setQty(p.id, inCart + 1)}>
              {inCart > 0 && <span className="pc-badge num">{inCart}</span>}
              <div className="pc-name">{p.name}</div>
              <div className="pc-unit">{p.unit}</div>
              <div className="pc-price num">{baht2(pos.price(p))}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---- order panel (shared) ---- */
function OrderPanel({ pos, compact }) {
  const [memOpen, setMemOpen] = pS(false);
  const net = pos.sub;
  return (
    <div className="order-panel">
      <div className="op-head">
        <div><b>บิล #{pos.billNo}</b><span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>{pos.count} ชิ้น</span></div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn sm ghost" onClick={pos.newBill}>{ICO.plus} ใหม่</button>
          {pos.parked.length > 0 && <button className="btn sm ghost" style={{ color: "var(--coral-2)" }} onClick={() => pos.resume(pos.parked[pos.parked.length - 1].no)}>พักไว้ {pos.parked.length}</button>}
        </div>
      </div>
      {/* member */}
      <button className={"mem-row" + (pos.member ? " on" : "")} onClick={() => setMemOpen(!memOpen)}>
        {ICO.people}
        <div style={{ flex: 1, textAlign: "left" }}>
          {pos.member ? <><b style={{ fontSize: 13 }}>{pos.member.name}</b><div className="muted" style={{ fontSize: 11 }}>{pos.member.code} · {pos.member.tier}</div></> : <span className="muted" style={{ fontSize: 13 }}>เลือกสมาชิก (ราคาส่ง)</span>}
        </div>
        {pos.member ? <span className="x-mem" onClick={(e) => { e.stopPropagation(); pos.setMember(null); }}>{ICO.close}</span> : ICO.chevR}
      </button>
      {memOpen && !pos.member && (
        <div className="mem-list">{PD.members.map((m) => <button key={m.code} className="mem-opt" onClick={() => { pos.setMember(m); setMemOpen(false); }}><b>{m.name}</b><span className="pill coral">{m.tier}</span></button>)}</div>
      )}
      {/* items */}
      <div className="op-items">
        {pos.items.length === 0 ? <div className="empty" style={{ padding: "40px 0" }}>ยังไม่มีสินค้า<br/>แตะเลือกจากแคตตาล็อก</div> : pos.items.map(([id, q]) => {
          const p = prod(id);
          return (
            <div className="op-item" key={id}>
              <div style={{ flex: 1, minWidth: 0 }}><div className="oi-name">{p.name}</div><div className="oi-meta num">{baht2(pos.price(p))} × {q}</div></div>
              <div className="stepper"><button onClick={() => pos.setQty(id, q - 1)}>−</button><span className="num">{q}</span><button onClick={() => pos.setQty(id, q + 1)}>+</button></div>
              <div className="oi-total num">{baht2(pos.price(p) * q)}</div>
              <button className="oi-x" onClick={() => pos.setQty(id, 0)}>{ICO.close}</button>
            </div>
          );
        })}
      </div>
      {/* totals */}
      <div className="op-foot">
        <div className="of-row"><span>ยอดรวม</span><span className="num">{baht2(pos.sub + pos.disc)}</span></div>
        {pos.disc > 0 && <div className="of-row"><span>ส่วนลดสมาชิก</span><span className="num" style={{ color: "var(--green)" }}>-{baht2(pos.disc)}</span></div>}
        <div className="of-row net"><span>สุทธิ</span><span className="num">{baht2(net)}</span></div>
        <div style={{ display: "flex", gap: 9, marginTop: 11 }}>
          <button className="btn ghost" style={{ flex: 1, justifyContent: "center" }} disabled={!pos.count} onClick={pos.park}>พักบิล</button>
          <button className="btn primary" style={{ flex: 2, justifyContent: "center" }} disabled={!pos.count}>{ICO.checkS} พิมพ์บิล QR</button>
        </div>
      </div>
    </div>
  );
}

/* ---- PC layout ---- */
function PosPC({ pos }) {
  return (
    <div className="pos-pc">
      <div className="pos-topbar">
        <div className="brandmark2 logo"><img src="assets/klh-logo.png" alt="KLH" /></div><div><b style={{ fontSize: 14 }}>KLH POS · หน้าร้าน</b><div className="muted" style={{ fontSize: 11.5 }}>สาขาตลาดสด · นัท</div></div>
        <div className="bill-tabs">
          <span className="btab on">#{pos.billNo}</span>
          {pos.parked.map((p) => <button key={p.no} className="btab" onClick={() => pos.resume(p.no)}>#{p.no} · {baht2(p.total)}</button>)}
          <button className="btab add" onClick={pos.newBill}>{ICO.plus}</button>
        </div>
        <div className="grow" />
        <div className="devchip2 lite"><span className="ld" />Tigercashbox</div>
      </div>
      <div className="pos-pc-body">
        <Catalog pos={pos} cols={3} />
        <OrderPanel pos={pos} />
      </div>
    </div>
  );
}

/* ---- T2 Lite layout (terminal + customer display) ---- */
function PosT2({ pos }) {
  return (
    <div className="t2-wrap">
      <div className="t2-main">
        <div className="t2-bezel">
          <div className="t2-screen">
            <div className="pos-topbar slim">
              <div className="brandmark2 sm logo"><img src="assets/klh-logo.png" alt="KLH" /></div><b style={{ fontSize: 13 }}>T2 Lite · นัท</b>
              <div className="grow" />
              <button className="btn sm ghost" onClick={pos.newBill}>{ICO.plus} ใหม่</button>
              {pos.parked.length > 0 && <button className="btn sm ghost" style={{ color: "var(--coral-2)" }} onClick={() => pos.resume(pos.parked[pos.parked.length - 1].no)}>พัก {pos.parked.length}</button>}
            </div>
            <div className="t2-body"><Catalog pos={pos} big cols={2} /><OrderPanel pos={pos} compact /></div>
          </div>
        </div>
        <div className="t2-stand" />
      </div>
      <div className="cust-display">
        <div className="cd-logo"><img src="assets/klh-logo.png" alt="KLH" /></div>
        <div className="cd-title">KLH Bakery &amp; Mart</div>
        <div className="cd-items">
          {pos.items.slice(0, 6).map(([id, q]) => { const p = prod(id); return <div className="cd-i" key={id}><span>{p.name}</span><span className="num">×{q}</span></div>; })}
        </div>
        <div className="cd-total"><span>ยอดสุทธิ</span><b className="num">{baht2(pos.sub)}</b></div>
      </div>
    </div>
  );
}

/* ---- Handheld (Sunmi) ---- */
function PosHandheld({ pos }) {
  return (
    <div className="hh-bezel">
      <div className="hh-screen">
        <div className="hh-top">
          <div className="brandmark2 sm logo"><img src="assets/klh-logo.png" alt="KLH" /></div><b style={{ fontSize: 13, flex: 1 }}>POS Handheld</b>
          <button className="hh-icon" onClick={pos.newBill}>{ICO.plus}</button>
          {pos.parked.length > 0 && <span className="hh-park">{pos.parked.length}</span>}
        </div>
        <div className="hh-body">
          <Catalog pos={pos} big cols={2} />
        </div>
        <div className="hh-cart">
          <div className="hh-cart-info"><b className="num">{pos.count} ชิ้น</b><span className="num" style={{ fontWeight: 800, color: "var(--coral-2)", fontSize: 17 }}>{baht2(pos.sub)}</span></div>
          <button className="btn primary sm" disabled={!pos.count}>{ICO.checkS} บิล QR</button>
        </div>
      </div>
    </div>
  );
}

/* each device enters its own channel via window.POS_DEVICE ("pc" | "t2" | "hh") */
function PosApp() {
  const pos = usePos();
  const dev = window.POS_DEVICE || "pc";
  return (
    <div className={"pos-app pos-" + dev}>
      {dev === "pc" && <PosPC pos={pos} />}
      {dev === "t2" && <PosT2 pos={pos} />}
      {dev === "hh" && <PosHandheld pos={pos} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<PosApp />);
