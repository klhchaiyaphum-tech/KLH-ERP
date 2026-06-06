/* ============================================================
   shared.jsx — icons, helpers, cart store, device frame,
   and the shared order-summary screen used by all variants.
   Exposes everything on window for the variant files.
   ============================================================ */
const { useState, useMemo, useCallback, useRef, useEffect } = React;

/* ---------- helpers ---------- */
const baht = (n) => "฿" + n.toLocaleString("en-US");
const DATA = window.POS_DATA;
const catOf = (id) => DATA.categories.find((c) => c.id === id);

/* ---------- icons (stroke, 1.7) ---------- */
const Ic = {
  cart: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2l2.3 12.2a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/></svg>),
  search: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>),
  back: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 5l-7 7 7 7"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12.5 10 17.5 19.5 6.5"/></svg>),
  trash: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14"/></svg>),
  scan: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M10 8v8M13 8v8M17 8v8"/></svg>),
  user: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>),
  qr: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7M14 21h3"/></svg>),
  cash: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.4"/><path d="M6 9.5v5M18 9.5v5"/></svg>),
  plus: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" {...p}><path d="M12 6v12M6 12h12"/></svg>),
};

/* ---------- cart store ---------- */
function useCart() {
  const [lines, setLines] = useState({}); // id -> qty
  const add = useCallback((id, d = 1) => setLines((s) => {
    const q = (s[id] || 0) + d;
    const n = { ...s };
    if (q <= 0) delete n[id]; else n[id] = q;
    return n;
  }), []);
  const setQty = useCallback((id, q) => setLines((s) => {
    const n = { ...s }; if (q <= 0) delete n[id]; else n[id] = q; return n;
  }), []);
  const clear = useCallback(() => setLines({}), []);
  const count = useMemo(() => Object.values(lines).reduce((a, b) => a + b, 0), [lines]);
  const items = useMemo(() => Object.entries(lines).map(([id, q]) => {
    const p = DATA.products.find((x) => x.id === id); return { ...p, qty: q, sum: p.price * q };
  }), [lines]);
  const subtotal = useMemo(() => items.reduce((a, b) => a + b.sum, 0), [items]);
  return { lines, add, setQty, clear, count, items, subtotal };
}

/* ---------- status bar + screen shell ---------- */
function StatusBar() {
  return (
    <div className="statusbar">
      <span className="num">09:41</span>
      <div className="sb-icons">
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 11h2M5 8.5h2M9 6h2M13 3.5h2" strokeLinecap="round"/></svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8.5 3.2C6 3.2 3.8 4.1 2.2 5.6M8.5 6.4c-1.4 0-2.6.5-3.6 1.4M8.5 1C5 1 1.8 2.3-.3 4.4" transform="translate(0.3 1.5)" strokeLinecap="round"/></svg>
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x="1" y="2" width="19" height="8" rx="2" stroke="currentColor" strokeWidth="1.3"/><rect x="2.6" y="3.6" width="13" height="4.8" rx="1" fill="currentColor"/><rect x="21" y="4.4" width="1.6" height="3.2" rx=".8" fill="currentColor"/></svg>
      </div>
    </div>
  );
}

/* product image placeholder */
function Thumb({ tint, size, style }) {
  return <div className="thumb" style={{ "--tint": tint, width: size, height: size, ...style }} />;
}

/* qty stepper */
function Stepper({ q, onMinus, onPlus }) {
  return (
    <div className="stepper">
      <button className="minus" onClick={onMinus}>–</button>
      <span className="q num">{q}</span>
      <button onClick={onPlus}>+</button>
    </div>
  );
}

/* ============================================================
   Shared order-summary / cart screen
   ============================================================ */
function SummaryScreen({ cart, onBack }) {
  const [pay, setPay] = useState("qr"); // qr | cash
  const [done, setDone] = useState(false);
  const vat = Math.round(cart.subtotal * 0.07);
  const total = cart.subtotal;

  if (done) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--surface)" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 28 }}>
          <div style={{ width: 76, height: 76, borderRadius: 999, background: "var(--ok)", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 12px 26px -10px var(--ok)" }}>
            <Ic.check width="38" height="38" strokeWidth="2.4" />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 21, fontWeight: 700 }}>ชำระเงินสำเร็จ</div>
            <div style={{ color: "var(--ink-2)", marginTop: 4, fontSize: 14 }}>ยอดรับชำระ {baht(total)} · {pay === "qr" ? "พร้อมเพย์" : "เงินสด"}</div>
          </div>
          <div style={{ width: "100%", borderTop: "1px dashed var(--line-2)", margin: "6px 0" }} />
          <div style={{ color: "var(--ink-3)", fontSize: 13 }}>เลขที่ใบเสร็จ #A-10427</div>
        </div>
        <div style={{ padding: 16, display: "flex", gap: 10 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => { setDone(false); }}>พิมพ์ใบเสร็จ</button>
          <button className="btn" style={{ flex: 1 }} onClick={() => { cart.clear(); onBack(); setDone(false); }}>ออเดอร์ใหม่</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--surface-2)" }}>
      <div className="appbar" style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px" }}>
        <button onClick={onBack} style={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 10 }}><Ic.back /></button>
        <div style={{ fontSize: 17, fontWeight: 600 }}>สรุปออเดอร์</div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--ink-2)" }} className="num">{cart.count} ชิ้น</div>
      </div>

      <div className="scroll" style={{ padding: "8px 12px" }}>
        {cart.items.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <Thumb tint={catOf(it.cat).tint} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
              <div className="num" style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>{baht(it.price)} / {it.unit}</div>
            </div>
            <Stepper q={it.qty} onMinus={() => cart.add(it.id, -1)} onPlus={() => cart.add(it.id, 1)} />
            <div className="num" style={{ width: 56, textAlign: "right", fontWeight: 600, fontSize: 14 }}>{baht(it.sum)}</div>
          </div>
        ))}
        {cart.items.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--ink-3)", padding: "60px 0", fontSize: 14 }}>ยังไม่มีสินค้าในตะกร้า</div>
        )}

        {/* payment method */}
        {cart.items.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>วิธีชำระเงิน</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["qr", "พร้อมเพย์ / QR", Ic.qr], ["cash", "เงินสด", Ic.cash]].map(([k, label, I]) => (
                <button key={k} onClick={() => setPay(k)} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "12px 8px", borderRadius: 12, fontSize: 14, fontWeight: 500,
                  border: "1.5px solid " + (pay === k ? "var(--brand)" : "var(--line-2)"),
                  background: pay === k ? "var(--brand-soft)" : "var(--surface)",
                  color: pay === k ? "var(--brand-2)" : "var(--ink-2)",
                }}><I />{label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* totals + pay */}
      <div style={{ flex: "0 0 auto", background: "var(--surface)", borderTop: "1px solid var(--line)", padding: "12px 16px 16px", boxShadow: "0 -8px 24px -16px rgba(40,28,16,.3)" }}>
        <Row label="ยอดรวมสินค้า" val={baht(cart.subtotal)} />
        <Row label="ภาษีมูลค่าเพิ่ม (รวมใน)" val={baht(vat)} sub />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingTop: 10, borderTop: "1px dashed var(--line-2)" }}>
          <span style={{ fontWeight: 600 }}>ยอดสุทธิ</span>
          <span className="num" style={{ fontSize: 26, fontWeight: 700, color: "var(--brand-2)" }}>{baht(total)}</span>
        </div>
        <button className="btn" style={{ marginTop: 12 }} disabled={cart.items.length === 0} onClick={() => setDone(true)}>
          <Ic.check /> รับชำระเงิน
        </button>
      </div>
    </div>
  );
}

function Row({ label, val, sub }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: sub ? 12.5 : 14, color: sub ? "var(--ink-3)" : "var(--ink-2)", marginTop: sub ? 3 : 0 }}>
      <span>{label}</span><span className="num">{val}</span>
    </div>
  );
}

Object.assign(window, { baht, DATA, catOf, Ic, useCart, StatusBar, Thumb, Stepper, SummaryScreen, Row });
