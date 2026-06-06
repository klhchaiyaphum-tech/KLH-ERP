/* ============================================================
   variants.jsx — three handheld POS layout directions.
   Each is fully interactive (browse → add → summary/pay).
   ============================================================ */
const { useState: uS, useMemo: uM } = React;

const ALL_CATS = [{ id: "all", name: "ทั้งหมด", tint: "#E94E27" }, ...DATA.categories];
const byCat = (cat, q = "") => DATA.products.filter(
  (p) => (cat === "all" || p.cat === cat) &&
    (!q || p.name.includes(q) || p.code.includes(q))
);

/* small store header shared by variants A & C */
function StoreHead({ right }) {
  return (
    <div className="appbar" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px" }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontFamily: "var(--ff-num)", fontSize: 15, flex: "0 0 auto" }}>ส</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.1, whiteSpace: "nowrap" }}>{DATA.store.name}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 1 }}>{DATA.store.branch}</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>{right}</div>
    </div>
  );
}

function CartBar({ cart, onOpen, label = "ดูตะกร้า · สรุปออเดอร์" }) {
  if (cart.count === 0) return null;
  return (
    <div style={{ flex: "0 0 auto", padding: 12, background: "transparent" }}>
      <button onClick={onOpen} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 15, background: "var(--ink)", color: "#fff",
        boxShadow: "0 10px 26px -10px rgba(34,30,26,.9)",
      }}>
        <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
          <Ic.cart />
          <span className="badge num" style={{ position: "absolute", top: -8, right: -10 }}>{cart.count}</span>
        </span>
        <span style={{ fontSize: 14.5, fontWeight: 500 }}>{label}</span>
        <span className="num" style={{ marginLeft: "auto", fontSize: 17, fontWeight: 700 }}>{baht(cart.subtotal)}</span>
      </button>
    </div>
  );
}

/* ============================================================
   VARIANT A — กริดสินค้า (photo grid + floating cart)
   ============================================================ */
function VariantGrid() {
  const cart = useCart();
  const [cat, setCat] = uS("all");
  const [screen, setScreen] = uS("browse");
  const list = uM(() => byCat(cat), [cat]);

  if (screen === "summary") return (<><StatusBar /><SummaryScreen cart={cart} onBack={() => setScreen("browse")} /></>);

  return (
    <>
      <StatusBar />
      <StoreHead right={<button style={ibtn}><Ic.scan /></button>} />
      {/* category chips */}
      <div style={{ flex: "0 0 auto", background: "var(--surface)", borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
        <div className="scroll" style={{ display: "flex", gap: 8, overflowX: "auto", overflowY: "hidden", padding: "2px 14px 0" }}>
          {ALL_CATS.map((c) => (
            <button key={c.id} className={"chip" + (cat === c.id ? " active" : "")} onClick={() => setCat(c.id)}>{c.name}</button>
          ))}
        </div>
      </div>
      {/* grid */}
      <div className="scroll" style={{ padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
          {list.map((p) => {
            const q = cart.lines[p.id] || 0;
            return (
              <div key={p.id} style={{ background: "var(--surface)", borderRadius: 15, border: "1px solid var(--line)", padding: 9, boxShadow: "var(--sh-1)" }}>
                <div style={{ position: "relative" }}>
                  <Thumb tint={catOf(p.cat).tint} size="100%" style={{ height: 84 }} />
                  <button className={"addfab" + (q ? " in" : "")} style={{ position: "absolute", right: 6, bottom: 6 }}
                    onClick={() => cart.add(p.id, 1)}>{q ? <span className="num" style={{ fontSize: 13, fontWeight: 700 }}>{q}</span> : <Ic.plus />}</button>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.28, marginTop: 8, height: 34, overflow: "hidden" }}>{p.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                  <span className="num" style={{ fontSize: 16, fontWeight: 700, color: "var(--brand-2)" }}>{baht(p.price)}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>/ {p.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ height: 4 }} />
      </div>
      <CartBar cart={cart} onOpen={() => setScreen("summary")} />
    </>
  );
}

/* ============================================================
   VARIANT B — รายการเร็ว (side category rail + dense list)
   ============================================================ */
function VariantList() {
  const cart = useCart();
  const [cat, setCat] = uS("drink");
  const [q, setQ] = uS("");
  const [screen, setScreen] = uS("browse");
  const list = uM(() => byCat(cat, q), [cat, q]);

  if (screen === "summary") return (<><StatusBar /><SummaryScreen cart={cart} onBack={() => setScreen("browse")} /></>);

  return (
    <>
      <StatusBar />
      {/* search header */}
      <div className="appbar" style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface-3)", borderRadius: 11, padding: "9px 12px" }}>
          <Ic.search style={{ color: "var(--ink-3)", flex: "0 0 auto" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาสินค้า / บาร์โค้ด"
            style={{ border: "none", outline: "none", background: "transparent", fontFamily: "var(--ff)", fontSize: 14.5, width: "100%", color: "var(--ink)" }} />
          <button style={{ ...ibtn, width: 30, height: 30, color: "var(--brand-2)" }}><Ic.scan /></button>
        </div>
      </div>
      {/* body: rail + list */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div className="scroll" style={{ flex: "0 0 84px", background: "var(--surface-2)", borderRight: "1px solid var(--line)", paddingBottom: 20 }}>
          {ALL_CATS.filter((c) => c.id !== "all").map((c) => {
            const on = cat === c.id;
            return (
              <button key={c.id} onClick={() => setCat(c.id)} style={{
                width: "100%", padding: "13px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                borderLeft: "3px solid " + (on ? "var(--brand)" : "transparent"),
                background: on ? "var(--surface)" : "transparent",
              }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: on ? c.tint : "color-mix(in srgb," + c.tint + " 16%, #fff)", color: on ? "#fff" : c.tint, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13, fontFamily: "var(--ff-num)" }}>{c.name[0]}</span>
                <span style={{ fontSize: 11, lineHeight: 1.15, textAlign: "center", color: on ? "var(--ink)" : "var(--ink-2)", fontWeight: on ? 600 : 400 }}>{c.name}</span>
              </button>
            );
          })}
        </div>
        <div className="scroll" style={{ flex: 1 }}>
          {list.map((p) => {
            const qy = cart.lines[p.id] || 0;
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderBottom: "1px solid var(--line)", background: qy ? "var(--brand-soft)" : "transparent" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.25 }}>{p.name}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                    <span className="num" style={{ fontSize: 14.5, fontWeight: 700, color: "var(--brand-2)" }}>{baht(p.price)}</span>
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)" }} className="num">#{p.code}</span>
                  </div>
                </div>
                {qy ? (
                  <Stepper q={qy} onMinus={() => cart.add(p.id, -1)} onPlus={() => cart.add(p.id, 1)} />
                ) : (
                  <button className="addfab" style={{ flex: "0 0 auto" }} onClick={() => cart.add(p.id, 1)}><Ic.plus /></button>
                )}
              </div>
            );
          })}
          {list.length === 0 && <div style={{ textAlign: "center", color: "var(--ink-3)", padding: "50px 16px", fontSize: 14 }}>ไม่พบสินค้า “{q}”</div>}
        </div>
      </div>
      <CartBar cart={cart} onOpen={() => setScreen("summary")} label="ไปสรุปออเดอร์" />
    </>
  );
}

/* ============================================================
   VARIANT C — สแกน + ตะกร้าคู่ (scan-first, live cart pane)
   ============================================================ */
function VariantSplit() {
  const cart = useCart();
  const [cat, setCat] = uS("all");
  const [q, setQ] = uS("");
  const [screen, setScreen] = uS("browse");
  const list = uM(() => byCat(cat, q), [cat, q]);

  if (screen === "summary") return (<><StatusBar /><SummaryScreen cart={cart} onBack={() => setScreen("browse")} /></>);

  return (
    <>
      <StatusBar />
      {/* scan bar */}
      <div className="appbar" style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--ink)", borderRadius: 12, padding: "10px 12px", color: "#fff" }}>
          <Ic.scan style={{ color: "var(--brand)", flex: "0 0 auto" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="สแกน / พิมพ์รหัสสินค้า"
            style={{ border: "none", outline: "none", background: "transparent", fontFamily: "var(--ff)", fontSize: 14.5, width: "100%", color: "#fff" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }} className="num">{list.length} รายการ</span>
        </div>
      </div>
      {/* category chips */}
      <div style={{ flex: "0 0 auto", background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
        <div className="scroll" style={{ display: "flex", gap: 7, overflowX: "auto", padding: "9px 12px" }}>
          {ALL_CATS.map((c) => (
            <button key={c.id} className={"chip" + (cat === c.id ? " active" : "")} style={{ padding: "6px 13px", fontSize: 13 }} onClick={() => setCat(c.id)}>{c.name}</button>
          ))}
        </div>
      </div>
      {/* TOP: quick product tiles */}
      <div className="scroll" style={{ flex: "1 1 46%", padding: 10, background: "var(--surface-2)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {list.map((p) => {
            const qy = cart.lines[p.id] || 0;
            return (
              <button key={p.id} onClick={() => cart.add(p.id, 1)} style={{
                textAlign: "left", background: "var(--surface)", borderRadius: 12,
                border: "1px solid " + (qy ? "var(--brand)" : "var(--line)"),
                padding: "9px 10px", display: "flex", flexDirection: "column", gap: 4, minHeight: 64, position: "relative",
                boxShadow: "var(--sh-1)",
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.22, color: "var(--ink)" }}>{p.name}</span>
                <span className="num" style={{ marginTop: "auto", fontSize: 14.5, fontWeight: 700, color: "var(--brand-2)" }}>{baht(p.price)}</span>
                {qy > 0 && <span className="num" style={{ position: "absolute", top: 7, right: 7, minWidth: 19, height: 19, padding: "0 5px", borderRadius: 999, background: "var(--brand)", color: "#fff", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center" }}>{qy}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {/* BOTTOM: live cart pane */}
      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", background: "var(--surface)", borderTop: "1px solid var(--line-2)", boxShadow: "0 -10px 28px -18px rgba(40,28,16,.4)", maxHeight: "46%", minHeight: 132 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "9px 14px 4px" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>ตะกร้า</span>
          <span className="num" style={{ marginLeft: 6, fontSize: 12, color: "var(--ink-3)" }}>{cart.count} ชิ้น</span>
          {cart.count > 0 && <button onClick={cart.clear} style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 4 }}><Ic.trash width="14" height="14" /> ล้าง</button>}
        </div>
        <div className="scroll" style={{ flex: 1, padding: "0 14px" }}>
          {cart.items.length === 0 && <div style={{ color: "var(--ink-3)", fontSize: 13, padding: "18px 0", textAlign: "center" }}>แตะสินค้าด้านบนเพื่อเพิ่ม</div>}
          {cart.items.map((it) => (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
              <Stepper q={it.qty} onMinus={() => cart.add(it.id, -1)} onPlus={() => cart.add(it.id, 1)} />
              <div className="num" style={{ width: 50, textAlign: "right", fontSize: 13, fontWeight: 600 }}>{baht(it.sum)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px 14px" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>ยอดสุทธิ</div>
            <div className="num" style={{ fontSize: 23, fontWeight: 700, color: "var(--brand-2)", lineHeight: 1 }}>{baht(cart.subtotal)}</div>
          </div>
          <button className="btn" style={{ flex: 1, width: "auto" }} disabled={cart.count === 0} onClick={() => setScreen("summary")}>
            ชำระเงิน <Ic.back style={{ transform: "rotate(180deg)" }} />
          </button>
        </div>
      </div>
    </>
  );
}

const ibtn = { width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--surface-3)", color: "var(--ink-2)" };

Object.assign(window, { VariantGrid, VariantList, VariantSplit });
