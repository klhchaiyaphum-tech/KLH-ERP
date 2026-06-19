/* ============================================================
   line-screens-b.jsx — Fulfillment · Summary+QR · Slip · Status · Receipt
   ============================================================ */
const { useState: bS, useEffect: bE, useRef: bR } = React;
const DB = window.LINEDATA;

/* ====================== FULFILLMENT ====================== */
function ScreenFulfil({ app }) {
  const m = app.fulfil;
  const sub = cartTotal(app.cart);
  const disc = Math.round(sub * 0.05);
  const ship = m === "delivery" ? DB.order.ship : 0;
  return (
    <>
      <div className="inset-top" style={{ height: app.insetTop, background: "#fff" }} />
      <AppHead app={app} title="วิธีรับสินค้า" cart={false} onBack={() => app.go("cart")} />
      <div className="la-body la-pad">
        <div className={"opt" + (m === "pickup" ? " on" : "")} onClick={() => app.setFulfil("pickup")}>
          <div className="oic">{LI.store}</div>
          <div className="oin"><h4>รับเองที่ร้าน</h4><p>{DB.store.branch} · พร้อมรับใน 1 ชม.</p></div>
          <div className="orad">{m === "pickup" && <span className="odot" />}</div>
        </div>
        <div className={"opt" + (m === "delivery" ? " on" : "")} onClick={() => app.setFulfil("delivery")}>
          <div className="oic">{LI.truck}</div>
          <div className="oin"><h4>จัดส่งถึงที่</h4><p>ค่าส่ง {baht(DB.order.ship)} · ส่งวันนี้–พรุ่งนี้</p></div>
          <div className="orad">{m === "delivery" && <span className="odot" />}</div>
        </div>

        {m === "pickup" ? (
          <>
            <div className="sec-l">จุดรับสินค้า</div>
            <div className="card" style={{ padding: 14 }}>
              <div className="la-row" style={{ gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "var(--co2)", marginTop: 2 }}>{LI.pin}</span>
                <div>
                  <b style={{ fontSize: 14 }}>{DB.store.name} — {DB.store.branch}</b>
                  <p className="muted" style={{ fontSize: 12.5, margin: "3px 0 0", lineHeight: 1.5 }}>เปิด 06:00–18:00 น. ทุกวัน · โทร 077-200-145</p>
                </div>
              </div>
              <div style={{ height: 90, borderRadius: 11, marginTop: 12, background: "linear-gradient(135deg,#E7EFE2,#D9ECF6)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%,-50%)", color: "var(--co2)" }}>{LI.pin}</div>
              </div>
            </div>
            <div className="sec-l">เวลารับ</div>
            <div className="la-row" style={{ gap: 8, flexWrap: "wrap" }}>
              {["ภายใน 1 ชม.", "วันนี้ 16:00", "พรุ่งนี้ 09:00"].map((t, i) => (
                <button key={t} className={"cat-chip" + (i === 0 ? " on" : "")}>{t}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="sec-l">ที่อยู่จัดส่ง</div>
            <div className="card" style={{ padding: 14 }}>
              <div className="la-field" style={{ marginBottom: 11 }}><label>ชื่อผู้รับ</label><input className="la-input" defaultValue="คุณแอม" style={{ fontSize: 15, padding: "11px 13px" }} /></div>
              <div className="la-field" style={{ marginBottom: 11 }}><label>เบอร์โทร</label><input className="la-input num" defaultValue="081-234-5678" style={{ fontSize: 15, padding: "11px 13px" }} /></div>
              <div className="la-field" style={{ marginBottom: 11 }}><label>ที่อยู่</label><textarea className="la-input" rows="2" defaultValue={DB.order.address} style={{ fontSize: 14.5, padding: "11px 13px", resize: "none", fontFamily: "var(--ff)" }} /></div>
              <div className="la-field" style={{ marginBottom: 0 }}><label>หมายเหตุถึงคนส่ง</label><input className="la-input" defaultValue={DB.order.addrNote} style={{ fontSize: 14.5, padding: "11px 13px" }} /></div>
            </div>
            <div className="note2" style={{ marginTop: 12 }}>🛵 ส่งฟรีเมื่อสั่งครบ ฿800 · ออเดอร์นี้ {sub >= 800 ? "ได้ส่งฟรีแล้ว!" : `อีก ${baht(800 - sub)} ได้ส่งฟรี`}</div>
          </>
        )}

        <div className="card" style={{ padding: "6px 16px", marginTop: 16 }}>
          <div className="sumrow"><span className="sl">ยอดสินค้า</span><span className="sv num">{baht(sub)}</span></div>
          <div className="sumrow"><span className="sl">ส่วนลดสมาชิก 5%</span><span className="sv num" style={{ color: "var(--green)" }}>-{baht(disc)}</span></div>
          <div className="sumrow"><span className="sl">ค่าจัดส่ง</span><span className="sv num">{ship === 0 ? "ฟรี" : baht(ship)}</span></div>
          <div className="sumrow total"><span className="sl">รวมทั้งสิ้น</span><span className="sv num">{baht(sub - disc + ship)}</span></div>
        </div>
      </div>
      <div className="footbar" style={{ paddingBottom: 12 + app.insetBottom }}>
        <button className="la-btn" onClick={() => app.go("summary")}>ยืนยันออเดอร์ {LI.chevR}</button>
      </div>
    </>
  );
}

/* ====================== SUMMARY + QR PROMPTPAY ====================== */
function ScreenSummary({ app }) {
  const sub = cartTotal(app.cart);
  const disc = Math.round(sub * 0.05);
  const ship = app.fulfil === "delivery" ? DB.order.ship : 0;
  const net = sub - disc + ship;
  const [secs, setSecs] = bS(894);
  bE(() => { const iv = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000); return () => clearInterval(iv); }, []);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");
  return (
    <>
      <div className="inset-top" style={{ height: app.insetTop, background: "#fff" }} />
      <AppHead app={app} title="ชำระเงิน" cart={false} onBack={() => app.go("fulfil")} />
      <div className="la-body la-pad">
        {/* order brief */}
        <div className="card" style={{ padding: 14 }}>
          <div className="la-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>ออเดอร์ {DB.order.no}</span>
            <span className="chip coral">{app.fulfil === "delivery" ? "🛵 จัดส่ง" : "🏪 รับเอง"}</span>
          </div>
          {Object.entries(app.cart).map(([id, q]) => {
            const p = prod(id);
            return <div className="sumrow" key={id} style={{ padding: "4px 0" }}><span className="sl"><span className="num">{q}×</span> {p.name}</span><span className="sv num">{baht(p.price * q)}</span></div>;
          })}
          <div className="sumrow"><span className="sl">ส่วนลด / ค่าส่ง</span><span className="sv num">-{baht(disc)} / {ship ? baht(ship) : "ฟรี"}</span></div>
          <div className="sumrow total"><span className="sl">ยอดชำระ</span><span className="sv num">{baht(net)}</span></div>
        </div>

        {/* PromptPay QR */}
        <div className="qr-card" style={{ marginTop: 16 }}>
          <div className="la-row" style={{ justifyContent: "center", gap: 7, color: "var(--ink2)", fontSize: 13, fontWeight: 600 }}>{LI.qr} สแกนจ่ายด้วย PromptPay</div>
          <div style={{ margin: "14px 0 10px" }}>
            <div className="qr-promptpay">
              <div className="pp-logo">THAI QR PAYMENT</div>
              <FQR2 value={DB.order.promptpayRef + net} size={172} />
            </div>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>{DB.store.name}</div>
          <div className="num muted" style={{ fontSize: 12 }}>พร้อมเพย์ {DB.store.promptpay}</div>
          <div style={{ fontSize: 27, fontWeight: 800, fontFamily: "var(--ffn)", color: "var(--co2)", marginTop: 8 }}>{baht(net)}</div>
          <div className="la-row" style={{ justifyContent: "center", gap: 6, marginTop: 8, fontSize: 12.5, color: "var(--ink2)" }}>{LI.clock} QR หมดอายุใน <span className="countdown num">{mm}:{ss}</span></div>
        </div>

        <button className="la-btn ghost sm" style={{ marginTop: 12 }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v8m5-8v8m5-8v8M3 21h18M5 10h14L12 3 5 10Z"/></svg>
          บันทึก QR ไว้ในเครื่อง
        </button>
        <div className="note-blue" style={{ marginTop: 12 }}>ℹ️ โอนแล้วกด “แจ้งชำระเงิน” แล้วแนบสลิป ระบบจะตรวจยอดอัตโนมัติทันที</div>
      </div>
      <div className="footbar" style={{ paddingBottom: 12 + app.insetBottom }}>
        <button className="la-btn" onClick={() => app.go("slip")}>แจ้งชำระเงิน · แนบสลิป</button>
      </div>
    </>
  );
}

/* ====================== SLIP UPLOAD + VERIFY (auto / manual) ====================== */
function ScreenSlip({ app }) {
  // app.slipState: "upload" | "checking" | "auto" | "manual"
  const st = app.slipState;
  const sub = cartTotal(app.cart);
  const net = sub - Math.round(sub * 0.05) + (app.fulfil === "delivery" ? DB.order.ship : 0);
  bE(() => {
    if (st === "checking") { const t = setTimeout(() => app.setSlip("auto"), 2200); return () => clearTimeout(t); }
  }, [st]);

  return (
    <>
      <div className="inset-top" style={{ height: app.insetTop, background: "#fff" }} />
      <AppHead app={app} title="แจ้งชำระเงิน" cart={false} onBack={() => app.go("summary")} />
      <div className="la-body la-pad">
        {/* demo state switch */}
        <div className="la-row" style={{ gap: 6, marginBottom: 14, background: "var(--paper2)", padding: 4, borderRadius: 11 }}>
          {[["upload", "อัปโหลด"], ["auto", "ตรวจอัตโนมัติ ✓"], ["manual", "รอตรวจมือ"]].map(([k, l]) => (
            <button key={k} onClick={() => app.setSlip(k)} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: st === k || (k === "auto" && st === "checking") ? "#fff" : "transparent", color: st === k ? "var(--co2)" : "var(--ink3)", boxShadow: st === k ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>{l}</button>
          ))}
        </div>

        {/* slip preview */}
        <div className="slip-thumb">
          <div className="sl-bank">🟣 ธนาคารไทยพาณิชย์</div>
          <div className="sl-line" style={{ width: "70%" }} />
          <div className="sl-line" style={{ width: "45%" }} />
          <div className="muted" style={{ fontSize: 11 }}>โอนเข้า {DB.store.promptpay}</div>
          <div className="sl-amt">{baht(net)}</div>
          <div className="muted num" style={{ fontSize: 11 }}>6 มิ.ย. 69 14:21 · Ref {DB.order.promptpayRef}</div>
          {st === "checking" && <div className="scan-line" />}
        </div>

        {/* state-specific */}
        {st === "upload" && (
          <>
            <button className="la-btn ghost" style={{ marginTop: 14 }}>{LI.camera} เปลี่ยนรูปสลิป</button>
            <div className="note2" style={{ marginTop: 12 }}>แนบสลิปให้เห็น <b>ยอดเงิน เลขอ้างอิง และเวลา</b> ชัดเจน เพื่อตรวจอัตโนมัติ</div>
          </>
        )}
        {st === "checking" && (
          <div className="center" style={{ marginTop: 18 }}>
            <div className="la-row" style={{ justifyContent: "center", gap: 8, color: "var(--co2)", fontWeight: 700 }}>
              <span className="spin" style={{ width: 18, height: 18, border: "2.5px solid var(--co-soft)", borderTopColor: "var(--co)", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              กำลังตรวจสอบยอดโอน…
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>ตรวจกับรายการเดินบัญชี PromptPay อัตโนมัติ</p>
          </div>
        )}
        {st === "auto" && (
          <div className="card" style={{ marginTop: 14, padding: 16, textAlign: "center", borderColor: "#CFEBD8", background: "#F2FBF5" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--green)", color: "#fff", display: "grid", placeItems: "center", margin: "0 auto 10px" }}>{LI.check}</div>
            <b style={{ fontSize: 16 }}>ตรวจยอดอัตโนมัติสำเร็จ</b>
            <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 0" }}>ยอด {baht(net)} ตรงกับรายการโอน · จับคู่อัตโนมัติแล้ว</p>
            <div className="la-row" style={{ justifyContent: "center", gap: 6, marginTop: 10 }}>
              <span className="chip green"><span className="ld" />จับคู่สำเร็จ</span>
              <span className="chip blue">ออกใบรายการแล้ว</span>
            </div>
          </div>
        )}
        {st === "manual" && (
          <div className="card" style={{ marginTop: 14, padding: 16, textAlign: "center", borderColor: "#F2E0B8", background: "#FCF8EE" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--amber)", color: "#fff", display: "grid", placeItems: "center", margin: "0 auto 10px" }}>{LI.clock}</div>
            <b style={{ fontSize: 16 }}>ส่งให้แอดมินตรวจสอบ</b>
            <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 0" }}>ยอดไม่ตรงอัตโนมัติ หรือสลิปไม่ชัด · แอดมินยืนยันภายใน 5–15 นาที</p>
            <div className="la-row" style={{ justifyContent: "center", gap: 6, marginTop: 10 }}>
              <span className="chip amber"><span className="ld" />รอตรวจสอบ</span>
              <span className="chip gray">แจ้งเตือนเมื่อยืนยัน</span>
            </div>
          </div>
        )}
      </div>
      <div className="footbar" style={{ paddingBottom: 12 + app.insetBottom }}>
        {st === "upload" && <button className="la-btn green" onClick={() => app.setSlip("checking")}>{LI.check} ส่งสลิป · ตรวจยอดอัตโนมัติ</button>}
        {st === "checking" && <button className="la-btn" disabled>กำลังตรวจสอบ…</button>}
        {st === "auto" && <button className="la-btn" onClick={() => app.go("status")}>ดูสถานะออเดอร์ {LI.chevR}</button>}
        {st === "manual" && <button className="la-btn ghost" onClick={() => app.go("status")}>ดูสถานะออเดอร์ {LI.chevR}</button>}
      </div>
    </>
  );
}

/* ====================== ORDER STATUS ====================== */
function ScreenStatus({ app }) {
  const paid = app.slipState === "auto";
  const steps = [
    { k: "order", t: "รับออเดอร์แล้ว", s: "6 มิ.ย. 14:23 น.", done: true },
    { k: "pay", t: paid ? "ชำระเงินสำเร็จ" : "รอยืนยันการชำระ", s: paid ? "ตรวจยอดอัตโนมัติ ✓" : "แอดมินกำลังตรวจสลิป", done: paid, cur: !paid },
    { k: "prep", t: "กำลังจัดสินค้า", s: "พิมพ์ใบจัดที่หลังร้านอัตโนมัติ", done: false, cur: paid },
    { k: "ship", t: app.fulfil === "delivery" ? "กำลังจัดส่ง" : "พร้อมให้รับ", s: app.fulfil === "delivery" ? "ส่งวันนี้–พรุ่งนี้" : "ที่ " + DB.store.branch, done: false },
  ];
  const net = cartTotal(app.cart) - Math.round(cartTotal(app.cart) * 0.05) + (app.fulfil === "delivery" ? DB.order.ship : 0);
  return (
    <>
      <div className="inset-top" style={{ height: app.insetTop, background: "#fff" }} />
      <AppHead app={app} title="สถานะออเดอร์" cart={false} onBack={() => app.go("chat")} />
      <div className="la-body la-pad">
        <div className="card" style={{ padding: 16 }}>
          <div className="la-row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="num" style={{ fontWeight: 800, fontSize: 16 }}>{DB.order.no}</div>
              <div className="muted" style={{ fontSize: 12 }}>{DB.order.date}</div>
            </div>
            <span className={"chip " + (paid ? "green" : "amber")}><span className="ld" />{paid ? "ชำระแล้ว" : "รอชำระ"}</span>
          </div>
          <div className="divider" />
          <div className="tl">
            {steps.map((s) => (
              <div key={s.k} className={"tl-step " + (s.done ? "done" : s.cur ? "cur" : "todo")}>
                <div className="tl-dot">{s.done ? LI.check : s.cur ? <span style={{ width: 8, height: 8, borderRadius: 999, background: "#fff" }} /> : ""}</div>
                <h4>{s.t}</h4>
                <p>{s.s}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 14, marginTop: 14 }}>
          <div className="la-row" style={{ justifyContent: "space-between" }}>
            <span className="muted" style={{ fontSize: 13 }}>{Object.keys(app.cart).length} รายการ · {app.fulfil === "delivery" ? "จัดส่ง" : "รับเอง"}</span>
            <span className="num" style={{ fontWeight: 800, color: "var(--co2)" }}>{baht(net)}</span>
          </div>
        </div>

        <div className="la-row" style={{ gap: 10, marginTop: 14 }}>
          <button className="la-btn ghost" onClick={() => app.go("receipt")}>{LI.print} ใบรายการ</button>
          <button className="la-btn ghost" onClick={() => app.go("chat")}>{LI.chat} แชตร้าน</button>
        </div>
        <div className="note2" style={{ marginTop: 12 }}>🖨️ เมื่อชำระสำเร็จ ระบบพิมพ์ใบจัดสินค้า (Pick List) ที่หลังร้านอัตโนมัติ และตัดสต็อกใน WMS ทันที</div>
      </div>
    </>
  );
}

/* ====================== RECEIPT (printable) ====================== */
function ScreenReceipt({ app }) {
  const [fmt, setFmt] = bS("thermal"); // thermal | a4
  const sub = cartTotal(app.cart);
  const disc = Math.round(sub * 0.05);
  const ship = app.fulfil === "delivery" ? DB.order.ship : 0;
  const net = sub - disc + ship;
  const entries = Object.entries(app.cart);
  return (
    <>
      <div className="inset-top" style={{ height: app.insetTop, background: "#fff" }} />
      <AppHead app={app} title="ใบรายการสั่งซื้อ" cart={false} onBack={() => app.go("status")} />
      <div className="la-body la-pad" style={{ background: "var(--paper2)" }}>
        <div className="la-row" style={{ gap: 6, marginBottom: 14, background: "var(--paper)", padding: 4, borderRadius: 11, border: "1px solid var(--hair)" }}>
          {[["thermal", "ใบสลิป 80mm"], ["a4", "ใบ A4 / PDF"]].map(([k, l]) => (
            <button key={k} onClick={() => setFmt(k)} style={{ flex: 1, padding: "9px 6px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: fmt === k ? "var(--co)" : "transparent", color: fmt === k ? "#fff" : "var(--ink3)" }}>{l}</button>
          ))}
        </div>

        <div className={"receipt " + (fmt === "thermal" ? "thermal" : "")} style={fmt === "a4" ? { width: "100%", fontSize: 12.5 } : null}>
          <div className="rc-c">
            <div style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", margin: "0 auto 4px" }}><img src="line/assets/klh-logo.png" style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /></div>
            <h3>{DB.store.name}</h3>
            <div className="rc-sm">{DB.store.branch} · {DB.store.oa}</div>
            <div className="rc-sm">โทร 077-200-145</div>
          </div>
          <div className="rc-hr" />
          <div className="rc-row"><span>เลขที่</span><b>{DB.order.no}</b></div>
          <div className="rc-row"><span>วันที่</span><span>{DB.order.date}</span></div>
          <div className="rc-row"><span>ลูกค้า</span><span>{DB.user.name} · {DB.user.member}</span></div>
          <div className="rc-row"><span>รับสินค้า</span><span>{app.fulfil === "delivery" ? "จัดส่ง" : "รับเองที่ร้าน"}</span></div>
          {app.fulfil === "delivery" && <div className="rc-sm" style={{ marginTop: 2 }}>{DB.order.address}</div>}
          <div className="rc-hr" />
          {entries.map(([id, q]) => {
            const p = prod(id);
            return (
              <div key={id} style={{ marginBottom: 5 }}>
                <div className="rc-row" style={{ alignItems: "flex-start" }}><span style={{ flex: 1, paddingRight: 8 }}>{p.name}</span><b style={{ whiteSpace: "nowrap" }}>{baht(p.price * q)}</b></div>
                <div className="rc-sm">{q} × {baht(p.price)}</div>
              </div>
            );
          })}
          <div className="rc-hr" />
          <div className="rc-row"><span>รวมสินค้า</span><span>{baht(sub)}</span></div>
          <div className="rc-row"><span>ส่วนลดสมาชิก 5%</span><span>-{baht(disc)}</span></div>
          <div className="rc-row"><span>ค่าจัดส่ง</span><span>{ship ? baht(ship) : "ฟรี"}</span></div>
          <div className="rc-row b" style={{ fontSize: fmt === "thermal" ? 15 : 17, marginTop: 4 }}><span>รวมทั้งสิ้น</span><span>{baht(net)}</span></div>
          <div className="rc-hr" />
          <div className="rc-row"><span>การชำระ</span><span>PromptPay {app.slipState === "auto" ? "✓ ชำระแล้ว" : "รอยืนยัน"}</span></div>
          <div className="rc-c" style={{ marginTop: 10 }}>
            <FQR2 value={DB.order.no} size={fmt === "thermal" ? 90 : 110} />
            <div className="rc-sm" style={{ marginTop: 4 }}>สแกนเพื่อดูสถานะ / ชำระที่แคชเชียร์</div>
            <div className="rc-sm" style={{ marginTop: 8 }}>ขอบคุณที่ใช้บริการ 🧡</div>
          </div>
        </div>

        <div style={{ height: 14 }} />
      </div>
      <div className="footbar" style={{ paddingBottom: 12 + app.insetBottom }}>
        <button className="la-btn" onClick={() => window.print()}>{LI.print} {fmt === "thermal" ? "พิมพ์ใบสลิป 80mm" : "บันทึก PDF / พิมพ์ A4"}</button>
      </div>
    </>
  );
}

Object.assign(window, { ScreenFulfil, ScreenSummary, ScreenSlip, ScreenStatus, ScreenReceipt });
