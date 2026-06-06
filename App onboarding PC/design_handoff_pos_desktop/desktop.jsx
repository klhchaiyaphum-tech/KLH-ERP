/* ============================================================
   desktop.jsx — POS PC + Sunmi T2 Lite + cashier payment
   (ลิ้นชักเก็บเงิน + QR ชำระ + เตรียมเชื่อม Tigercashbox)
   ใช้ baht/Ic/useCart/StatusBar จาก shared.jsx
   ============================================================ */
const { useState: dUS, useMemo: dUM } = React;
const D = window.POS_DATA;

const D_CATS = [{ id: "all", name: "ทั้งหมด", tint: "#E94E27" }, ...D.categories];
const dFilt = (cat, q = "") => D.products.filter((p) => (cat === "all" || p.cat === cat) && (!q || p.name.includes(q) || p.code.includes(q)));
const dNow = () => { const d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); };
const DEMO_MEMBER = { name: "สมชาย ใจดี", phone: "081-234-5678", tier: "ทอง", points: 1240 };
const TIER_DISC = { "เงิน": 0.03, "ทอง": 0.05, "แพลทินัม": 0.08 };

/* small icons */
const X = (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>;
const IcCard = (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /></svg>;
const IcDrawer = (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11l2-6h14l2 6M3 11v7a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-7M3 11h18M9.5 15h5" /></svg>;
const IcBag = (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2" /></svg>;

/* ---- faux QR (decorative) ---- */
function dHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function dRng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function QR({ value, size = 150, fg = "#1A1714", bg = "#fff" }) {
  const N = 25, rnd = dRng(dHash(value));
  const finder = (r, c) => { for (const [R, C] of [[0, 0], [0, N - 7], [N - 7, 0]]) { if (r >= R && r < R + 7 && c >= C && c < C + 7) { const dr = r - R, dc = c - C; return (dr === 0 || dr === 6 || dc === 0 || dc === 6) || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4); } } return null; };
  const near = (r, c) => [[0, 0], [0, N - 7], [N - 7, 0]].some(([R, C]) => r >= R - 1 && r <= R + 7 && c >= C - 1 && c <= C + 7);
  const m = size / N, rects = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const f = finder(r, c); const on = f !== null ? f : (!near(r, c) && rnd() > 0.5); if (on) rects.push(<rect key={r + "_" + c} x={c * m} y={r * m} width={m + 0.5} height={m + 0.5} fill={fg} />); }
  return <div style={{ background: bg, padding: size * 0.06, borderRadius: 12, display: "inline-block", boxShadow: "var(--sh-1)" }}><svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">{rects}</svg></div>;
}

/* ============================================================
   register hook — cart + member + parked bills
   ============================================================ */
function useRegister() {
  const cart = useCart();
  const [member, setMember] = dUS(null);
  const [parked, setParked] = dUS([]);
  const [billNo, setBillNo] = dUS(1042);
  const snap = () => ({ id: "pk" + Date.now() + Math.random().toString(36).slice(2, 5), no: billNo, lines: { ...cart.lines }, member, count: cart.count, total: cart.subtotal, time: dNow() });
  const park = () => { if (!cart.count) return; setParked((p) => [snap(), ...p]); cart.replace({}); setMember(null); setBillNo((n) => n + 1); };
  const resume = (e) => { setParked((p) => { let r = p.filter((x) => x.id !== e.id); if (cart.count > 0) r = [snap(), ...r]; return r; }); if (cart.count > 0) setBillNo((n) => n + 1); cart.replace(e.lines); setMember(e.member || null); };
  const newBill = () => { if (cart.count > 0) { setParked((p) => [snap(), ...p]); setBillNo((n) => n + 1); } cart.replace({}); setMember(null); };
  const disc = member ? Math.round(cart.subtotal * TIER_DISC[member.tier]) : 0;
  return { cart, member, setMember, parked, park, resume, newBill, billNo, disc, net: cart.subtotal - disc };
}

/* ============================================================
   shared building blocks
   ============================================================ */
function ProductGrid({ cat, q, cart, columns = 3, big }) {
  const list = dUM(() => dFilt(cat, q), [cat, q]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 11 }}>
      {list.map((p) => {
        const qy = cart.lines[p.id] || 0;
        return (
          <button key={p.id} className="pcard" style={{ position: "relative", minHeight: big ? 104 : 88 }} onClick={() => cart.add(p.id, 1)}>
            <div className="pn" style={{ fontSize: big ? 14.5 : 13.5, flex: 1 }}>{p.name}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span className="pp num" style={{ fontSize: big ? 18 : 16 }}>{baht(p.price)}</span>
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>/ {p.unit}</span>
            </div>
            {qy > 0 && <span className="pqty num">{qy}</span>}
          </button>
        );
      })}
      {list.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--ink-3)", padding: "60px 0" }}>ไม่พบสินค้า “{q}”</div>}
    </div>
  );
}

function MemberRow({ reg, big }) {
  if (reg.member) return (
    <button onClick={() => reg.setMember(null)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 11px", borderRadius: 11, background: "var(--brand-soft)", border: "1px solid " + "var(--brand-tint)", textAlign: "left" }}>
      <span style={{ width: 32, height: 32, borderRadius: 999, background: "#C8932A", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14 }}>ส</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{reg.member.name}</span>
        <span className="num" style={{ display: "block", fontSize: 11.5, color: "var(--ink-3)" }}>{reg.member.tier} · {reg.member.points.toLocaleString()} แต้ม</span>
      </span>
      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>เปลี่ยน</span>
    </button>
  );
  return (
    <button onClick={() => reg.setMember(DEMO_MEMBER)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "10px", borderRadius: 11, background: "var(--surface)", border: "1.5px dashed var(--line-2)", color: "var(--ink-2)", fontSize: 13.5, fontWeight: 600 }}>
      <Ic.user width="17" height="17" /> เพิ่มสมาชิก / สแกนบัตร
    </button>
  );
}

function OrderPanel({ reg, onPay, title }) {
  const cart = reg.cart;
  return (
    <div className="opanel" style={{ height: "100%" }}>
      <div style={{ flex: "0 0 auto", padding: "13px 16px 10px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{title || "บิลปัจจุบัน"}</span>
          <span className="num" style={{ marginLeft: 8, fontSize: 12.5, color: "var(--ink-3)", background: "var(--surface-3)", padding: "2px 8px", borderRadius: 999 }}>#{reg.billNo}</span>
          <span className="num" style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--ink-3)" }}>{cart.count} ชิ้น</span>
        </div>
        <MemberRow reg={reg} />
      </div>
      <div className="dscroll" style={{ flex: 1, padding: "0 16px" }}>
        {cart.items.length === 0 && <div style={{ textAlign: "center", color: "var(--ink-3)", padding: "48px 0", fontSize: 14 }}>ยังไม่มีสินค้า<br /><span style={{ fontSize: 12.5 }}>เลือกสินค้าจากรายการด้านซ้าย</span></div>}
        {cart.items.map((it) => (
          <div key={it.id} className="oline">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.25 }}>{it.name}</div>
              <div className="num" style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{baht(it.price)} × {it.qty}</div>
            </div>
            <Stepper q={it.qty} onMinus={() => cart.add(it.id, -1)} onPlus={() => cart.add(it.id, 1)} />
            <div className="num" style={{ width: 58, textAlign: "right", fontWeight: 700, fontSize: 13.5 }}>{baht(it.sum)}</div>
            <button onClick={() => cart.setQty(it.id, 0)} style={{ color: "var(--ink-3)", width: 24, height: 24, display: "grid", placeItems: "center" }}><X width="15" height="15" /></button>
          </div>
        ))}
      </div>
      <div style={{ flex: "0 0 auto", padding: "12px 16px 16px", borderTop: "1px solid var(--line)", background: "var(--surface-2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--ink-2)" }}><span>ยอดรวม</span><span className="num">{baht(cart.subtotal)}</span></div>
        {reg.disc > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ok)", marginTop: 3 }}><span>ส่วนลดสมาชิก ({reg.member.tier})</span><span className="num">-{baht(reg.disc)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingTop: 9, borderTop: "1px dashed var(--line-2)" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>ยอดสุทธิ</span>
          <span className="num" style={{ fontSize: 28, fontWeight: 700, color: "var(--brand-2)" }}>{baht(reg.net)}</span>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button className="dbtn ghost" style={{ flex: "0 0 auto", padding: "15px 16px" }} disabled={!cart.count} onClick={reg.park}><Ic.layers /> พักบิล</button>
          <button className="dbtn primary" style={{ flex: 1 }} disabled={!cart.count} onClick={onPay}><Ic.cash width="20" height="20" /> ชำระเงิน</button>
        </div>
      </div>
    </div>
  );
}

/* parked-bills strip / tabs */
function OrderTabs({ reg }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flex: 1, minWidth: 0, overflowX: "auto", paddingTop: 6 }}>
      <div className="otab on"><span className="od" /> บิล #{reg.billNo}</div>
      {reg.parked.map((p) => (
        <div key={p.id} className="otab" onClick={() => reg.resume(p)} title="คลิกเพื่อเปิดบิลที่พักไว้">
          <span className="od" style={{ background: "var(--ink-3)" }} /> #{p.no}
          <span className="num" style={{ color: "var(--ink-3)", fontSize: 11.5 }}>· {baht(p.total)}</span>
        </div>
      ))}
      <button onClick={reg.newBill} className="otab" style={{ color: "var(--brand-2)", fontWeight: 700 }}>＋ บิลใหม่</button>
    </div>
  );
}

/* ============================================================
   PAYMENT OVERLAY — cashier (cash drawer + QR + Tigercashbox)
   ============================================================ */
function PaymentOverlay({ reg, onClose, onDone }) {
  const total = reg.net;
  const [method, setMethod] = dUS("qr");
  const [recv, setRecv] = dUS("");
  const [drawer, setDrawer] = dUS(false);
  const [paid, setPaid] = dUS(false);
  const received = parseInt(recv || "0", 10);
  const change = received - total;
  const tap = (k) => { if (k === "del") setRecv((s) => s.slice(0, -1)); else if (k === "C") setRecv(""); else setRecv((s) => (s + k).replace(/^0+(?=\d)/, "").slice(0, 7)); };
  const canConfirm = method === "cash" ? received >= total : true;

  const confirm = () => { if (method === "cash") setDrawer(true); setPaid(true); };

  return (
    <div className="ovl">
      <div className="pay">
        {/* LEFT — amount + Tigercashbox devices */}
        <div style={{ width: 300, flex: "0 0 auto", background: "var(--ink)", color: "#fff", padding: "22px 18px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)" }}>ยอดที่ต้องชำระ</div>
          <div className="num" style={{ fontSize: 42, fontWeight: 800, color: "#fff", lineHeight: 1.05, marginTop: 4 }}>{baht(total)}</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.6)", marginTop: 6 }}>บิล #{reg.billNo} · {reg.cart.count} ชิ้น{reg.member ? " · " + reg.member.name : ""}</div>

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 9 }}>
            <div className="devchip" style={{ alignSelf: "flex-start", background: "rgba(255,255,255,.08)", color: "#7FE0A8", border: "1px solid rgba(127,224,168,.3)", whiteSpace: "nowrap" }}>
              <span className="ld" style={{ background: "#7FE0A8" }} /> Tigercashbox · เชื่อมต่อแล้ว
            </div>
            <DevRow icon={<IcDrawer />} label="ลิ้นชักเก็บเงิน" state={drawer ? "เปิดอยู่" : "ปิด"} on={drawer} />
            <DevRow icon={<Ic.print />} label="เครื่องพิมพ์ใบเสร็จ" state="พร้อม" on />
            <DevRow icon={<Ic.scan />} label="เครื่องสแกนบาร์โค้ด" state="พร้อม" on />
            <button onClick={() => setDrawer(true)} style={{ marginTop: 4, padding: "11px", borderRadius: 11, border: "1.5px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.06)", color: "#fff", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", whiteSpace: "nowrap" }}>
              <IcDrawer width="18" height="18" /> เปิดลิ้นชัก
            </button>
          </div>
        </div>

        {/* RIGHT — methods / keypad / result */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "16px 20px 0" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{paid ? "ชำระเงินสำเร็จ" : "รับชำระเงิน"}</div>
            <button onClick={onClose} style={{ marginLeft: "auto", color: "var(--ink-3)", padding: 4 }}><X /></button>
          </div>

          {paid ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
              <div style={{ width: 72, height: 72, borderRadius: 999, background: "var(--ok)", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 12px 26px -10px var(--ok)" }}><Ic.check width="38" height="38" strokeWidth="2.4" /></div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>รับชำระ {baht(total)}</div>
                <div style={{ color: "var(--ink-2)", marginTop: 3, fontSize: 13.5 }}>{method === "cash" ? `รับเงิน ${baht(received)} · เงินทอน ${baht(Math.max(0, change))}` : method === "qr" ? "ชำระผ่านพร้อมเพย์ QR" : "ชำระผ่านบัตร"}</div>
              </div>
              {method === "cash" && <div className="devchip"><span className="ld" /> ลิ้นชักเปิดแล้วผ่าน Tigercashbox</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button className="dbtn ghost" style={{ padding: "12px 18px", fontSize: 14 }}><Ic.print /> พิมพ์ใบเสร็จ</button>
                <button className="dbtn primary" style={{ padding: "12px 22px", fontSize: 14 }} onClick={onDone}>เสร็จสิ้น</button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "14px 20px 18px" }}>
              <div style={{ display: "flex", gap: 9 }}>
                <button className={"ptab" + (method === "qr" ? " on" : "")} onClick={() => setMethod("qr")}><Ic.qr width="22" height="22" /> พร้อมเพย์ QR</button>
                <button className={"ptab" + (method === "cash" ? " on" : "")} onClick={() => setMethod("cash")}><Ic.cash width="22" height="22" /> เงินสด</button>
                <button className={"ptab" + (method === "card" ? " on" : "")} onClick={() => setMethod("card")}><IcCard /> บัตร</button>
              </div>

              {method === "qr" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "8px 0" }}>
                  <QR value={"PP" + reg.billNo + total} size={158} />
                  <div style={{ textAlign: "center", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5 }}>ให้ลูกค้าสแกนด้วยแอปธนาคาร / เป๋าตัง<br />ยอด <b className="num" style={{ color: "var(--ink)" }}>{baht(total)}</b></div>
                  <div className="devchip" style={{ background: "#FFF7EA", color: "var(--warn)", border: "1px solid #F3D9A6", whiteSpace: "nowrap" }}><span className="ld" style={{ background: "var(--warn)" }} /> รอ Tigercashbox ยืนยันการชำระ…</div>
                </div>
              )}

              {method === "cash" && (
                <div style={{ flex: 1, display: "flex", gap: 16, paddingTop: 12, minHeight: 0 }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--ink-2)" }}><span>รับเงิน</span><span className="num" style={{ fontWeight: 700, color: "var(--ink)", fontSize: 17 }}>{baht(received)}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: change >= 0 ? "var(--ok)" : "var(--ink-3)", marginTop: 6 }}><span>เงินทอน</span><span className="num" style={{ fontWeight: 700, fontSize: 17 }}>{change >= 0 ? baht(change) : "—"}</span></div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                      <button className="qcash" onClick={() => setRecv(String(total))}>พอดี</button>
                      {[100, 500, 1000].map((v) => <button key={v} className="qcash" onClick={() => setRecv(String(v))}>{v.toLocaleString()}</button>)}
                    </div>
                  </div>
                  <div style={{ width: 210, flex: "0 0 auto", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignContent: "start" }}>
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"].map((k) => (
                      <button key={k} className="kkey" onClick={() => tap(k)}>{k === "del" ? "⌫" : k}</button>
                    ))}
                  </div>
                </div>
              )}

              {method === "card" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <div style={{ width: 88, height: 88, borderRadius: 999, background: "var(--surface)", border: "1.5px solid var(--line-2)", display: "grid", placeItems: "center", color: "var(--brand-2)" }}><IcCard width="40" height="40" /></div>
                  <div style={{ textAlign: "center", fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}>สอด / แตะบัตรที่เครื่อง EDC<br />ยอด <b className="num" style={{ color: "var(--ink)" }}>{baht(total)}</b></div>
                </div>
              )}

              <button className="dbtn primary" style={{ marginTop: 14 }} disabled={!canConfirm} onClick={confirm}>
                <Ic.check /> {method === "cash" ? "ยืนยันรับเงิน · เปิดลิ้นชัก" : "ยืนยันรับชำระ"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DevRow({ icon, label, state, on }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
      <span style={{ color: "rgba(255,255,255,.7)" }}>{icon}</span>
      <span style={{ flex: 1, color: "rgba(255,255,255,.8)", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: on ? "#7FE0A8" : "rgba(255,255,255,.45)", fontWeight: 600, whiteSpace: "nowrap" }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: on ? "#7FE0A8" : "rgba(255,255,255,.35)" }} />{state}
      </span>
    </div>
  );
}

/* ============================================================
   LAYOUT 1 — PC POS (3-column desktop app)
   ============================================================ */
function PCPos() {
  const reg = useRegister();
  const [cat, setCat] = dUS("all");
  const [q, setQ] = dUS("");
  const [pay, setPay] = dUS(false);
  return (
    <div className="win" style={{ height: 752, position: "relative" }}>
      <div className="win-os">
        <span className="dot" style={{ background: "#ED6A5E" }} /><span className="dot" style={{ background: "#F4BF4F" }} /><span className="dot" style={{ background: "#61C554" }} />
        <span className="t">ระบบขายหน้าร้าน — ร้านค้า ส.รุ่งเรือง</span>
      </div>
      <div className="topbar">
        <span className="brandmark">ส</span>
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.1 }}>{D.store.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{D.store.branch}</div>
        </div>
        <div style={{ width: 1, height: 30, background: "var(--line)", margin: "0 4px" }} />
        <OrderTabs reg={reg} />
        <div className="devchip"><span className="ld" /> Tigercashbox</div>
        <div style={{ textAlign: "right", lineHeight: 1.2 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{D.store.cashier}</div>
          <div className="num" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>กะเช้า · {dNow()} น.</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* categories */}
        <div className="dscroll" style={{ width: 176, flex: "0 0 auto", background: "var(--surface)", borderRight: "1px solid var(--line)" }}>
          {D_CATS.map((c) => (
            <button key={c.id} className={"dcat" + (cat === c.id ? " on" : "")} onClick={() => setCat(c.id)}>
              <span className="dcdot" style={{ background: c.tint }} />{c.name}
            </button>
          ))}
        </div>
        {/* catalog */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 11, padding: "10px 13px" }}>
              <Ic.search style={{ color: "var(--ink-3)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาสินค้า / สแกนบาร์โค้ด…" style={{ border: "none", outline: "none", background: "transparent", fontFamily: "var(--ff)", fontSize: 14.5, width: "100%" }} />
              <span style={{ fontSize: 12, color: "var(--ink-3)" }} className="num">{dFilt(cat, q).length} รายการ</span>
            </div>
          </div>
          <div className="dscroll" style={{ flex: 1, padding: 16 }}>
            <ProductGrid cat={cat} q={q} cart={reg.cart} columns={3} />
          </div>
        </div>
        {/* order */}
        <div style={{ width: 376, flex: "0 0 auto", borderLeft: "1px solid var(--line)" }}>
          <OrderPanel reg={reg} onPay={() => setPay(true)} />
        </div>
      </div>
      {pay && <PaymentOverlay reg={reg} onClose={() => setPay(false)} onDone={() => { reg.cart.clear(); reg.setMember(null); setPay(false); }} />}
    </div>
  );
}

/* ============================================================
   LAYOUT 2 — Sunmi T2 Lite (dual-screen countertop terminal)
   ============================================================ */
function CustomerDisplay({ reg, paying }) {
  return (
    <div className="cust-body">
      <div className="cust-screen">
        <div style={{ padding: "16px 16px 12px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "var(--brand)", display: "grid", placeItems: "center", fontWeight: 700, margin: "0 auto 8px" }}>ส</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{D.store.name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>ยินดีต้อนรับ</div>
        </div>
        {paying ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 16 }}>
            <QR value={"PP" + reg.billNo + reg.net} size={150} bg="#fff" />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.6)" }}>สแกนเพื่อชำระเงิน</div>
              <div className="num" style={{ fontSize: 30, fontWeight: 800, color: "#fff", marginTop: 2 }}>{baht(reg.net)}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="dscroll" style={{ flex: 1, padding: "10px 16px" }}>
              {reg.cart.items.length === 0 && <div style={{ color: "rgba(255,255,255,.4)", textAlign: "center", padding: "40px 0", fontSize: 13 }}>รอรายการสินค้า…</div>}
              {reg.cart.items.map((it) => (
                <div key={it.id} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,.07)", fontSize: 12.5 }}>
                  <span className="num" style={{ color: "rgba(255,255,255,.5)", width: 20 }}>{it.qty}×</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                  <span className="num">{baht(it.sum)}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
              {reg.disc > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7FE0A8" }}><span>ส่วนลดสมาชิก</span><span className="num">-{baht(reg.disc)}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,.6)" }}>ยอดสุทธิ</span>
                <span className="num" style={{ fontSize: 30, fontWeight: 800 }}>{baht(reg.net)}</span>
              </div>
            </div>
          </>
        )}
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: "var(--ink-3)", marginTop: 9 }}>จอลูกค้า (Customer Display)</div>
    </div>
  );
}

function SunmiT2() {
  const reg = useRegister();
  const [cat, setCat] = dUS("all");
  const [q, setQ] = dUS("");
  const [pay, setPay] = dUS(false);
  return (
    <div className="term">
      <div>
        <div className="term-body">
          <div className="term-screen" style={{ position: "relative" }}>
            <div className="topbar" style={{ height: 52 }}>
              <span className="brandmark" style={{ width: 34, height: 34, fontSize: 15 }}>ส</span>
              <div style={{ flex: "0 0 auto" }}>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>{D.store.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{D.store.branch} · {D.store.cashier}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={reg.newBill} style={{ fontSize: 13, fontWeight: 600, color: "var(--brand-2)", padding: "8px 12px", borderRadius: 9, border: "1.5px solid var(--brand-tint)", background: "var(--brand-soft)" }}>＋ บิลใหม่</button>
                {reg.parked.length > 0 && (
                  <button onClick={() => reg.resume(reg.parked[0])} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--ink)", padding: "8px 12px", borderRadius: 9, border: "1px solid var(--line-2)", background: "var(--surface)" }}>
                    <Ic.layers width="17" height="17" /> บิลพัก <span className="num" style={{ background: "var(--brand)", color: "#fff", borderRadius: 999, padding: "0 6px", fontSize: 11 }}>{reg.parked.length}</span>
                  </button>
                )}
                <div className="devchip"><span className="ld" /> Tigercashbox</div>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 11, padding: "9px 12px" }}>
                    <Ic.search style={{ color: "var(--ink-3)" }} />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา / สแกนบาร์โค้ด" style={{ border: "none", outline: "none", background: "transparent", fontFamily: "var(--ff)", fontSize: 14, width: "100%" }} />
                  </div>
                </div>
                <div style={{ flex: "0 0 auto", display: "flex", gap: 7, overflowX: "auto", padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                  {D_CATS.map((c) => <button key={c.id} className={"chip" + (cat === c.id ? " active" : "")} onClick={() => setCat(c.id)}>{c.name}</button>)}
                </div>
                <div className="dscroll" style={{ flex: 1, padding: 14, background: "var(--surface-2)" }}>
                  <ProductGrid cat={cat} q={q} cart={reg.cart} columns={3} big />
                </div>
              </div>
              <div style={{ width: 348, flex: "0 0 auto", borderLeft: "1px solid var(--line)" }}>
                <OrderPanel reg={reg} onPay={() => setPay(true)} />
              </div>
            </div>
            {pay && <PaymentOverlay reg={reg} onClose={() => setPay(false)} onDone={() => { reg.cart.clear(); reg.setMember(null); setPay(false); }} />}
          </div>
        </div>
        <div className="term-neck" /><div className="term-foot" />
      </div>
      <CustomerDisplay reg={reg} paying={pay} />
    </div>
  );
}

Object.assign(window, { PCPos, SunmiT2, PaymentOverlay, useRegister });
