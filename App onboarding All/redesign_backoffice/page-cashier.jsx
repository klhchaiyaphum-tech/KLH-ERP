/* ============================================================
   page-cashier.jsx — Cashier (แคชเชียร์) redesigned, KLH theme
   Deferred settlement: scan QR → merge orders → pay (cash/QR/credit)
   → close + deduct stock · Tigercashbox + KTB ถุงเงิน QR
   maps: getPendingOrders · loadOrderById · closeSale · getPosPageData
   ============================================================ */
const { useState: hS, useMemo: hMemo } = React;
const HD = window.CASHIER;
const fmt = (n) => "฿" + Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });

function CashierApp() {
  const [pending, setPending] = hS(HD.pending);
  const [loaded, setLoaded] = hS([]);       // loaded orders
  const [method, setMethod] = hS("CASH");
  const [discType, setDiscType] = hS("amt");
  const [disc, setDisc] = hS("");
  const [cashStr, setCashStr] = hS("");
  const [drawer, setDrawer] = hS(false);
  const [done, setDone] = hS(null);
  const [toast, showToast] = useToast();

  const orderTotal = loaded.reduce((a, o) => a + (Number(o.total) || 0), 0);
  const discount = (() => { const v = parseFloat(disc) || 0; return discType === "pct" ? Math.min(orderTotal, orderTotal * v / 100) : Math.min(orderTotal, v); })();
  const grand = Math.max(0, orderTotal - discount);
  const cashRecv = parseInt(cashStr || "0", 10);
  const change = cashRecv - grand;
  const items = loaded.flatMap((o) => o.items || []);
  const cust = loaded[0] || {};

  const load = (id) => {
    if (loaded.find((o) => o.orderId === id)) { showToast(id + " อยู่ในรายการแล้ว"); return; }
    const o = HD.pending.find((p) => p.orderId === id);
    if (!o) { showToast("ไม่พบออเดอร์ " + id); return; }
    setLoaded([...loaded, o]); setPending(pending.filter((p) => p.orderId !== id));
  };
  const removeOrder = (id) => { const o = loaded.find((x) => x.orderId === id); setLoaded(loaded.filter((x) => x.orderId !== id)); if (o && !pending.find((p) => p.orderId === id)) setPending([o, ...pending]); };
  const canPay = grand > 0 && (method !== "CASH" || cashRecv >= grand);
  const close = () => { if (!canPay) return; if (method === "CASH") setDrawer(true); setDone({ saleId: "SALE-260611-" + (Math.floor(Math.random() * 90) + 10), total: grand, method, change: method === "CASH" ? Math.max(0, change) : 0 }); };
  const reset = () => { setLoaded([]); setDisc(""); setCashStr(""); setDrawer(false); setDone(null); setMethod("CASH"); };

  const tapKey = (k) => { if (k === "del") setCashStr((s) => s.slice(0, -1)); else setCashStr((s) => (s + k).replace(/^0+(?=\d)/, "").slice(0, 8)); };

  return (
    <div className="cashier">
      {/* topbar */}
      <div className="csh-top">
        <div className="brandmark">💰</div>
        <div><div className="ct-name">KLH Cashier</div><div className="ct-sub">รับชำระเงิน · กะเช้า</div></div>
        <div className="vline" />
        <div className="devchip2 lite"><span className="ld" />Tigercashbox พร้อม</div>
        <div className="grow" />
        <button className="btn ghost sm" onClick={() => showToast("รีเฟรชออเดอร์")}>{ICO.refresh} รีเฟรช</button>
      </div>

      <div className="csh-main">
        {/* LEFT */}
        <div className="csh-left">
          <div className="scan-wrap2">
            <div className="sw-lbl">สแกน QR หรือกรอกเลขออเดอร์</div>
            <div className="scan-field2">
              {ICO.scan}
              <input placeholder="สแกน QR หรือพิมพ์ ORD-YYYYMMDD-XXX…" onKeyDown={(e) => { if (e.key === "Enter") { load(e.target.value.trim()); e.target.value = ""; } }} />
              <button className="ld-btn" onClick={(e) => { const i = e.target.closest(".scan-field2").querySelector("input"); load(i.value.trim()); i.value = ""; }}>โหลด</button>
            </div>
          </div>

          {loaded.length > 0 && (
            <div className="loaded-bar">
              <div className="loaded-tabs">{loaded.map((o) => <span key={o.orderId} className="ltab">{o.orderId} · {o.source}<button className="rm" onClick={() => removeOrder(o.orderId)}>✕</button></span>)}</div>
              {cust.customerName && cust.customerName !== "ลูกค้าทั่วไป" && (
                <div className="cust-bar">{ICO.people}<div><div className="cb-name">{cust.customerName}</div><div className="cb-detail">{cust.customerCode}{cust.entity ? " · " + cust.entity : ""}</div></div></div>
              )}
            </div>
          )}

          <div className="items-area">
            {items.length === 0 ? (
              <div className="empty-orders"><div style={{ fontSize: 34, marginBottom: 8 }}>📋</div>สแกน QR จากใบรายการขาย<br/>หรือคลิกออเดอร์ด้านล่าง</div>
            ) : items.map((it, i) => (
              <div className="item-row2" key={i}>
                <div style={{ flex: 1, minWidth: 0 }}><div className="ir-name">{it.name}</div><div className="ir-unit">{it.unit}</div></div>
                <div className="ir-qty num">×{it.qty}</div>
                <div className="ir-total num">{fmt(it.lineTotal)}</div>
              </div>
            ))}
          </div>

          <div className="pending-list">
            <div className="pending-hdr">ออเดอร์รอชำระ <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>auto-refresh<span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--green)" }} /></span></div>
            {pending.length === 0 ? <div className="center muted" style={{ padding: 14, fontSize: 13 }}>ไม่มีออเดอร์รอชำระ</div> : pending.map((o) => (
              <div className="pending-item" key={o.orderId} onClick={() => load(o.orderId)}>
                <span className="pi-id">{o.orderId.replace("ORD-", "")}</span>
                <span className="pi-info"><b>{o.customerName}</b> <span className="muted" style={{ fontSize: 11 }}>{o.date} {o.time}</span></span>
                <span className="pi-source">{o.source}</span>
                <span className="pi-total num">{fmt(o.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="csh-right">
          {/* dark amount panel */}
          <div className="pay-amount">
            <div className="pa-label">ยอดที่ต้องชำระ</div>
            <div className="pa-total num">{fmt(orderTotal)}</div>
            <div className="disc-row">
              <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,.7)" }}>ส่วนลด</span>
              <input className="disc-in num" type="number" min="0" value={disc} onChange={(e) => setDisc(e.target.value)} placeholder="0" />
              <select className="disc-sel" value={discType} onChange={(e) => setDiscType(e.target.value)}><option value="amt">฿</option><option value="pct">%</option></select>
            </div>
            {discount > 0 && <div className="disc-after">หลังส่วนลด: <b className="num" style={{ color: "#7FE0A8" }}>{fmt(grand)}</b></div>}
            <div className="pa-info">{loaded.length} ออเดอร์ · {items.length} รายการ</div>
            <div className="devchip2"><span className="ld" />Tigercashbox · เชื่อมต่อแล้ว</div>
            <div className="devrow"><span className="dl">ลิ้นชักเก็บเงิน</span><span className="ds" style={{ color: drawer ? "#7FE0A8" : "rgba(255,255,255,.4)" }}>● {drawer ? "เปิดอยู่" : "ปิด"}</span></div>
            <div className="devrow"><span className="dl">เครื่องพิมพ์</span><span className="ds" style={{ color: "#7FE0A8" }}>● พร้อม</span></div>
          </div>

          {/* body */}
          <div className="pay-body">
            <div className="pay-tabs">
              {[["CASH", "เงินสด", ICO.cash], ["QR", "QR / โอน", ICO.scan], ["CREDIT", "เชื่อ", ICO.doc]].map(([m, t, ic]) => (
                <button key={m} className={"ptab" + (method === m ? " on" : "")} onClick={() => setMethod(m)}>{ic}<span>{t}</span></button>
              ))}
            </div>

            {method === "CASH" && (
              <div className="cash-panel">
                <div className="cash-display">
                  <div className="cd-row"><span>รับมา</span><span className="num cd-val">฿{cashRecv.toLocaleString("th-TH")}</span></div>
                  <div className="cd-row" style={{ marginTop: 6, color: change >= 0 && cashRecv > 0 ? "var(--green)" : "var(--ink-3)" }}><span>เงินทอน</span><span className="num cd-val">{change >= 0 && cashRecv > 0 ? "฿" + change.toLocaleString("th-TH") : "—"}</span></div>
                </div>
                <div className="quick-cash">
                  {[["พอดี", 0], ["฿20", 20], ["฿50", 50], ["฿100", 100], ["฿500", 500], ["฿1000", 1000]].map(([l, v]) => (
                    <button key={l} className="qcash-btn" onClick={() => { if (v === 0) setCashStr(String(grand)); else setCashStr(String(cashRecv + v)); }}>{l}</button>
                  ))}
                </div>
                <div className="keypad">{["1","2","3","4","5","6","7","8","9","00","0","del"].map((k) => <button key={k} className="kkey" onClick={() => tapKey(k)}>{k === "del" ? "⌫" : k}</button>)}</div>
              </div>
            )}
            {method === "QR" && (
              <div className="qr-panel">
                <div className="qr-amt"><div className="qa-lbl">ยอดที่ต้องโอน</div><div className="qa-val num">{fmt(grand)}</div></div>
                <div className="qr-box2"><FQRC value={"KTB" + grand} /></div>
                <div className="center"><div style={{ fontSize: 14, fontWeight: 700 }}>เค แอล เอช</div><div className="muted" style={{ fontSize: 11.5 }}>กรุงไทย ถุงเงิน · รับทุกธนาคาร</div></div>
                <div className="qr-waiting"><span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--amber)" }} />รอลูกค้าโอนเงิน…</div>
              </div>
            )}
            {method === "CREDIT" && (
              <div className="credit-panel">
                <div className="cp-ic">{ICO.doc}</div>
                <div className="center" style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>ยืนยันการขายเชื่อ<br/>ลูกหนี้จะถูกบันทึกใน AR_LEDGER<br/>ยอด <b className="num" style={{ color: "var(--ink)" }}>{fmt(grand)}</b></div>
              </div>
            )}

            <button className="btn-confirm" disabled={!canPay || !loaded.length} onClick={close}>
              {ICO.checkS} {method === "CASH" ? "ยืนยันรับเงิน · เปิดลิ้นชัก" : method === "QR" ? "ยืนยันรับชำระ QR" : "บันทึกเชื่อ + ตัดสต็อก"}
            </button>
          </div>

          {done && (
            <div className="success-ovl">
              <div className="success-icon">{ICO.checkS}</div>
              <div className="center">
                <div style={{ fontSize: 21, fontWeight: 700 }}>ปิดบิลสำเร็จ!</div>
                <div className="muted" style={{ marginTop: 4, fontSize: 14 }}>Sale: {done.saleId} · {fmt(done.total)}{done.method === "CASH" && done.change > 0 ? " · ทอน " + fmt(done.change) : done.method === "QR" ? " · QR" : done.method === "CREDIT" ? " · เชื่อ" : ""}</div>
                {drawer && <div className="devchip2 lite" style={{ margin: "10px auto 0" }}><span className="ld" />ลิ้นชักเปิดแล้วผ่าน Tigercashbox</div>}
              </div>
              <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 320 }}>
                <button className="btn ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => showToast("พิมพ์ใบเสร็จ " + done.saleId)}>{ICO.doc} พิมพ์</button>
                <button className="btn" style={{ flex: 1, background: "var(--ink)", color: "#fff", borderColor: "var(--ink)", justifyContent: "center" }} onClick={reset}>ปิดบิลถัดไป</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {toast}
    </div>
  );
}

/* faux KTB QR */
function FQRC({ value, size = 168 }) {
  const N = 27; let h = 2166136261; for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0; const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const finder = (r, c) => { for (const [R, C] of [[0, 0], [0, N - 7], [N - 7, 0]]) { if (r >= R && r < R + 7 && c >= C && c < C + 7) { const dr = r - R, dc = c - C; return dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4); } } return null; };
  const near = (r, c) => [[0, 0], [0, N - 7], [N - 7, 0]].some(([R, C]) => r >= R - 1 && r <= R + 7 && c >= C - 1 && c <= C + 7);
  const m = size / N, rects = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const f = finder(r, c); const on = f !== null ? f : (!near(r, c) && rnd() > 0.5); if (on) rects.push(<rect key={r + "_" + c} x={c * m} y={r * m} width={m + 0.6} height={m + 0.6} fill="#10151C" />); }
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">{rects}</svg>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<CashierApp />);
