/* ============================================================
   line-screens-a.jsx — Login(OTP) · Chat+RichMenu · Browse · Cart
   Each screen renders the full in-phone column for given `app`.
   exports: AppHead, CartFooter + screen components on window
   ============================================================ */
const { useState: aS, useEffect: aE, useRef: aR } = React;
const D = window.LINEDATA;
const prod = (id) => D.products.find((p) => p.id === id);
const cartCount = (cart) => Object.values(cart).reduce((a, b) => a + b, 0);
const cartTotal = (cart) => Object.entries(cart).reduce((a, [id, q]) => a + prod(id).price * q, 0);

/* shared app header (LIFF style) */
function AppHead({ app, title, cart = true, onBack, accent }) {
  return (
    <div className="la-head" style={accent ? { background: "var(--co)", borderColor: "transparent" } : null}>
      <button className="hi" style={accent ? { color: "#fff" } : null} onClick={onBack || (() => app.go("chat"))}>{LI.back}</button>
      <div className="ht" style={{ textAlign: "center" }}>
        <b style={accent ? { color: "#fff" } : null}>{title}</b>
      </div>
      {cart ? (
        <button className="hi" style={{ position: "relative", ...(accent ? { color: "#fff" } : null) }} onClick={() => app.go("cart")}>
          {LI.cart}
          {cartCount(app.cart) > 0 && <span style={{ position: "absolute", top: 0, right: 0, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: accent ? "#fff" : "var(--co)", color: accent ? "var(--co2)" : "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", fontFamily: "var(--ffn)" }}>{cartCount(app.cart)}</span>}
        </button>
      ) : <div style={{ width: 32 }} />}
    </div>
  );
}

/* ====================== LOGIN ====================== */
function ScreenLogin({ app }) {
  return (
    <>
      <div className="inset-top" style={{ height: app.insetTop }} />
      <div className="login">
        <div className="logo"><img src="line/assets/klh-logo.png" alt="KLH" /></div>
        <h1>KLH Bakery &amp; Mart</h1>
        <p className="sub">สั่งสินค้าผ่าน LINE ง่ายๆ<br/>เข้าสู่ระบบด้วยเบอร์โทรของคุณ</p>

        <div className="la-field">
          <label>เบอร์โทรศัพท์</label>
          <div style={{ position: "relative" }}>
            <input className="la-input num" defaultValue="081-234-5678" inputMode="tel" />
            <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink3)" }}>{LI.phone}</span>
          </div>
        </div>

        <button className="la-btn" onClick={() => app.go("otp")}>ขอรหัส OTP</button>
        <div style={{ height: 14 }} />
        <button className="la-btn green" onClick={() => app.go("chat")}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.5 2 2 5.7 2 10.2c0 2.6 1.5 4.9 3.8 6.4-.1.6-.7 2.3-.8 2.7 0 0 0 .3.2.4.1 0 .3 0 .4-.1.3-.2 2.7-1.8 3.6-2.4.9.1 1.8.2 2.8.2 5.5 0 10-3.7 10-8.2S17.5 2 12 2Z"/></svg>
          เข้าสู่ระบบด้วย LINE
        </button>

        <p className="muted" style={{ fontSize: 11.5, marginTop: 18, lineHeight: 1.6 }}>
          การเข้าสู่ระบบถือว่ายอมรับ<br/>เงื่อนไขการใช้บริการและนโยบายความเป็นส่วนตัว
        </p>
        <div className="grow" />
        <div className="la-row" style={{ justifyContent: "center", color: "var(--ink3)", fontSize: 11.5, gap: 6 }}>{LI.shield} เชื่อมต่อปลอดภัยผ่าน LINE Login</div>
      </div>
    </>
  );
}

/* ====================== OTP ====================== */
function ScreenOTP({ app }) {
  const [code, setCode] = aS("");
  aE(() => {
    if (code.length === 6) { const t = setTimeout(() => app.go("chat"), 450); return () => clearTimeout(t); }
  }, [code]);
  const tap = (k) => { if (k === "del") setCode((c) => c.slice(0, -1)); else if (code.length < 6) setCode((c) => c + k); };
  return (
    <>
      <div className="inset-top" style={{ height: app.insetTop }} />
      <AppHead app={app} title="ยืนยันเบอร์โทร" cart={false} onBack={() => app.go("login")} />
      <div className="la-body la-pad" style={{ display: "flex", flexDirection: "column" }}>
        <div className="center" style={{ marginTop: 8 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: "var(--co-soft)", color: "var(--co2)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>{LI.phone}</div>
          <h2 style={{ fontSize: 19, margin: "0 0 6px" }}>กรอกรหัส OTP</h2>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>ส่งรหัส 6 หลักไปที่ <b className="num" style={{ color: "var(--ink)" }}>081-234-5678</b></p>
        </div>
        <div className="otp">
          {[0,1,2,3,4,5].map((i) => (
            <div key={i} className={"d" + (code[i] ? " on" : "") + (i === code.length ? " cur" : "")}>{code[i] || ""}</div>
          ))}
        </div>
        <div className="center resend">ขอรหัสใหม่ได้ใน <b className="num">04:58</b></div>
        <div className="grow" />
        {/* number pad */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9 }}>
          {["1","2","3","4","5","6","7","8","9","","0","del"].map((k, i) => k === "" ? <div key={i} /> : (
            <button key={i} onClick={() => tap(k)} style={{ height: 52, borderRadius: 14, background: k === "del" ? "transparent" : "var(--paper)", border: k === "del" ? "none" : "1px solid var(--hair)", fontSize: 22, fontWeight: 600, fontFamily: "var(--ffn)" }}>{k === "del" ? "⌫" : k}</button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ====================== LINE CHAT + RICH MENU ====================== */
function ScreenChat({ app }) {
  const cells = [
    { k: "browse", ic: LI.bag, label: "สั่งสินค้า", feat: true, go: "browse" },
    { k: "cart", ic: LI.cart, label: "ตะกร้า", badge: cartCount(app.cart) || null, go: "cart" },
    { k: "status", ic: LI.box, label: "สถานะออเดอร์", go: "status" },
    { k: "promo", ic: LI.gift, label: "โปรโมชั่น", go: "browse" },
    { k: "member", ic: LI.user, label: "สมาชิก", go: null },
    { k: "contact", ic: LI.chat, label: "ติดต่อร้าน", go: null },
  ];
  return (
    <>
      <div className="inset-top" style={{ height: app.insetTop, background: "#fff" }} />
      {/* LINE chat header */}
      <div className="la-head">
        <button className="hi" onClick={() => app.go("login")}>{LI.back}</button>
        <div className="hl"><img src="line/assets/klh-logo.png" alt="" /></div>
        <div className="ht">
          <b>KLH Bakery &amp; Mart</b>
          <span style={{ color: "var(--green)" }}>● ตอบกลับอัตโนมัติ 24 ชม.</span>
        </div>
        <button className="hi">{LI.phone}</button>
        <button className="hi">{LI.dots}</button>
      </div>

      <div className="chat">
        <div className="cscroll">
          <div className="day">วันนี้</div>
          <div className="bubrow">
            <div className="av"><img src="line/assets/klh-logo.png" alt="" /></div>
            <div>
              <div className="bub">สวัสดีค่ะ คุณแอม 🧡 ยินดีต้อนรับสู่ KLH Bakery &amp; Mart<br/>เลือกเมนูด้านล่างเพื่อเริ่มสั่งสินค้าได้เลยค่ะ</div>
            </div>
          </div>
          <div className="bubrow">
            <div className="av"><img src="line/assets/klh-logo.png" alt="" /></div>
            <div className="flexcard">
              <div className="fc-img">🧡 โปรสมาชิกทอง<br/>ลด 5% วันนี้</div>
              <div className="fc-b">
                <h4>ช้อปครบ ฿1,000</h4>
                <p>รับส่วนลดทันที + ส่งฟรีในเขตเมือง</p>
                <button className="fc-btn" onClick={() => app.go("browse")}>เริ่มสั่งสินค้า</button>
              </div>
            </div>
          </div>
          {cartCount(app.cart) > 0 && (
            <div className="bubrow me">
              <div className="bub">มีของในตะกร้า {cartCount(app.cart)} รายการ · {baht(cartTotal(app.cart))}</div>
            </div>
          )}
        </div>

        {/* RICH MENU */}
        <div className="richwrap">
          <div className="rich-tab"><div className="pull" /></div>
          <div className="richmenu">
            {cells.map((c) => (
              <button key={c.k} className={"rm-cell" + (c.feat ? " feat" : "")} onClick={() => c.go && app.go(c.go)}>
                <span className="ic">{c.ic}</span>
                <span>{c.label}</span>
                {c.badge && <span className="badge num">{c.badge}</span>}
              </button>
            ))}
          </div>
          <div className="chatbar">
            <span>{LI.plus}</span>
            <div className="cb-in">พิมพ์ข้อความ…</div>
            <span style={{ color: "var(--ink3)" }}>{LI.camera}</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ====================== BROWSE ====================== */
function ScreenBrowse({ app }) {
  const [cat, setCat] = aS("all");
  const [q, setQ] = aS("");
  const items = D.products.filter((p) => (cat === "all" || p.cat === cat) && (!q || p.name.includes(q)));
  return (
    <>
      <div className="inset-top" style={{ height: app.insetTop, background: "#fff" }} />
      <AppHead app={app} title="สั่งสินค้า" onBack={() => app.go("chat")} />
      <div className="search2">{LI.search}<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาสินค้า / รหัส…" /></div>
      <div className="cat-bar" style={{ borderBottom: "none", paddingTop: 12 }}>
        {D.cats.map((c) => <button key={c.id} className={"cat-chip" + (cat === c.id ? " on" : "")} onClick={() => setCat(c.id)}>{c.name}</button>)}
      </div>
      <div className="la-body" style={{ padding: "0 14px" }}>
        {items.map((p) => {
          const q = app.cart[p.id] || 0;
          return (
            <div className="prod" key={p.id}>
              <div className="pim" style={{ background: p.tint }}>{p.emoji}</div>
              <div className="pin">
                <h4>{p.name}</h4>
                <div className="pmeta">{p.size}</div>
                <div className="prow">
                  <span className="price">{baht(p.price)}</span>
                  {q > 0
                    ? <Stepper2 q={q} onDec={() => app.setQty(p.id, q - 1)} onInc={() => app.setQty(p.id, q + 1)} />
                    : <button className="addbtn" onClick={() => app.setQty(p.id, 1)}>{LI.plus}</button>}
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="center muted" style={{ padding: 50 }}>ไม่พบสินค้า “{q}”</div>}
        <div style={{ height: 8 }} />
      </div>
      {cartCount(app.cart) > 0 && (
        <div className="footbar" style={{ paddingBottom: 12 + app.insetBottom }}>
          <button className="la-btn" onClick={() => app.go("cart")}>
            <span style={{ background: "rgba(255,255,255,.25)", borderRadius: 8, padding: "2px 8px", fontFamily: "var(--ffn)", fontSize: 13 }}>{cartCount(app.cart)}</span>
            ดูตะกร้า
            <span className="grow" />
            <span className="num">{baht(cartTotal(app.cart))}</span>
          </button>
        </div>
      )}
    </>
  );
}

/* ====================== CART ====================== */
function ScreenCart({ app }) {
  const entries = Object.entries(app.cart);
  const sub = cartTotal(app.cart);
  return (
    <>
      <div className="inset-top" style={{ height: app.insetTop, background: "#fff" }} />
      <AppHead app={app} title="ตะกร้าสินค้า" cart={false} onBack={() => app.go("browse")} />
      <div className="la-body la-pad">
        {entries.length === 0 ? (
          <div className="center muted" style={{ padding: "60px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
            ยังไม่มีสินค้าในตะกร้า
            <div style={{ height: 16 }} />
            <button className="la-btn ghost" onClick={() => app.go("browse")}>เลือกสินค้า</button>
          </div>
        ) : (<>
          <div className="card" style={{ padding: "2px 14px" }}>
            {entries.map(([id, q]) => {
              const p = prod(id);
              return (
                <div className="line-item" key={id}>
                  <div className="li-im" style={{ background: p.tint }}>{p.emoji}</div>
                  <div className="li-in">
                    <h4>{p.name}</h4>
                    <div className="lm">{p.size} · {baht(p.price)}</div>
                  </div>
                  <div className="li-rt">
                    <span className="lp">{baht(p.price * q)}</span>
                    <Stepper2 q={q} onDec={() => app.setQty(id, q - 1)} onInc={() => app.setQty(id, q + 1)} />
                  </div>
                </div>
              );
            })}
          </div>

          <button className="la-row" onClick={() => app.go("browse")} style={{ color: "var(--co2)", fontWeight: 600, fontSize: 13.5, margin: "14px 2px", gap: 6 }}>{LI.plus} เพิ่มสินค้าอื่น</button>

          <div className="card" style={{ padding: "13px 14px", marginTop: 4 }}>
            <div className="la-row" style={{ gap: 10 }}>
              <span style={{ color: "var(--co2)" }}>{LI.tag}</span>
              <input className="la-input" placeholder="ใส่โค้ดส่วนลด" style={{ border: "none", padding: "4px 0", fontSize: 14 }} />
              <button className="chip coral" style={{ padding: "6px 12px" }}>ใช้โค้ด</button>
            </div>
          </div>

          <div className="card" style={{ padding: "6px 16px", marginTop: 14 }}>
            <div className="sumrow"><span className="sl">ยอดรวมสินค้า ({cartCount(app.cart)} ชิ้น)</span><span className="sv num">{baht(sub)}</span></div>
            <div className="sumrow"><span className="sl">ส่วนลดสมาชิกทอง 5%</span><span className="sv num" style={{ color: "var(--green)" }}>-{baht(Math.round(sub * 0.05))}</span></div>
            <div className="sumrow total"><span className="sl">รวมทั้งสิ้น</span><span className="sv num">{baht(sub - Math.round(sub * 0.05))}</span></div>
          </div>
        </>)}
      </div>
      {entries.length > 0 && (
        <div className="footbar" style={{ paddingBottom: 12 + app.insetBottom }}>
          <button className="la-btn" onClick={() => app.go("fulfil")}>เลือกวิธีรับสินค้า {LI.chevR}</button>
        </div>
      )}
    </>
  );
}

Object.assign(window, { AppHead, ScreenLogin, ScreenOTP, ScreenChat, ScreenBrowse, ScreenCart, prod, cartCount, cartTotal });
