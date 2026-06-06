/* ============================================================
   klh-shell.jsx — macOS shell: menubar + window + dock + router
   + Home launcher. Module screens register on window.KLH_SCREENS.
   ============================================================ */
const { useState: kS, useMemo: kM, useEffect: kE } = React;
const KLH = window.KLH;
const baht = (n) => "฿" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

/* ---------- icons ---------- */
const I = {
  search: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/></svg>,
  boxes:  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/></svg>,
  book:   <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 0-2 2V5Z"/><path d="M20 5a2 2 0 0 0-2-2h-6v18h6a2 2 0 0 1 2 2V5Z"/></svg>,
  ocr:    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3a2 2 0 0 0-2 2v4M17 3a2 2 0 0 1 2 2v4M3 14h18M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5M8 17.5h5"/></svg>,
  supplier: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V8l6-4 6 4M3 21h18M15 21V11h6v10M6 12h3M6 16h3"/></svg>,
  cart:   <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2l2.3 12.2a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/></svg>,
  register: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="6" rx="1.5"/><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M9 14h6M9 17h3"/></svg>,
  customer: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="m17 4.5 1.2 2.5 2.8.4-2 2 .5 2.7L17 13.8 14.5 15l.5-2.7-2-2 2.8-.4L17 4.5Z"/></svg>,
  calc:   <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15v3"/></svg>,
};
/* small UI icons */
const Ui = {
  back: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg>,
  home: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8M5 9.5V21h14V9.5"/></svg>,
  refresh: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/></svg>,
  plus: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="M12 6v12M6 12h12"/></svg>,
  searchS: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/></svg>,
  print: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v7H7z"/></svg>,
  edit: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>,
  trash: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14"/></svg>,
  scan: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8"/></svg>,
  chevron: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  check: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19.5 6.5"/></svg>,
  gear: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-2.7 1.1 2 2 0 0 1-4 0 1.6 1.6 0 0 0-2.7-1.1 2 2 0 1 1-2.8-2.8A1.6 1.6 0 0 0 4.6 13a2 2 0 0 1 0-4 1.6 1.6 0 0 0 1.1-2.7 2 2 0 1 1 2.8-2.8A1.6 1.6 0 0 0 11 4.6a2 2 0 0 1 4 0 1.6 1.6 0 0 0 2.7 1.1 2 2 0 1 1 2.8 2.8A1.6 1.6 0 0 0 19.4 11"/></svg>,
};

/* ---------- modules registry ---------- */
const MODULES = [
  { id: "survey",   name: "KLH Data Survey",  color: "#F6704C", glyph: I.search,   status: "live", desc: "สำรวจ อัปเดต ราคาต้นทุน ราคาขาย บาร์โค้ด รูปสินค้า จาก KLH DATA" },
  { id: "wms",      name: "WMS คลังสินค้า",   color: "#E08A2E", glyph: I.boxes,    status: "live", desc: "รับสินค้าเข้า โอนระหว่างคลัง ดูสต็อก Pick List ตั้งค่า ROP แจ้งเตือน LINE" },
  { id: "price",    name: "Price List",       color: "#C85C3C", glyph: I.book,     status: "live", desc: "ตารางราคาสินค้าแบบหนังสือ แยกหมวดหมู่ ค้นหาได้ · iPad-optimized" },
  { id: "ocr",      name: "Invoice OCR",      color: "#3A37C9", glyph: I.ocr,      status: "live", desc: "สแกนใบกำกับภาษี OCR แยกข้อมูล ตรวจสอบ บันทึก เข้าระบบ WMS และบัญชี" },
  { id: "supplier", name: "Supplier Master",  color: "#D1764F", glyph: I.supplier, status: "live", desc: "จัดการรายชื่อเจ้าหนี้/ผู้จำหน่าย เพิ่ม แก้ไข ลบ รวม SUPPLIER_MASTER เดียว" },
  { id: "pos",      name: "POS ขายหน้าร้าน",  color: "#F2683C", glyph: I.cart,     status: "live", desc: "Handheld/PC สแกนสินค้า สร้างออเดอร์ พิมพ์ใบรายการ รอชำระที่แคชเชียร์" },
  { id: "cashier",  name: "Cashier รับชำระ",  color: "#E0962F", glyph: I.register, status: "live", desc: "สแกน QR จากใบรายการ รวมบิล รับเงิน ปิดบิล ตัดสต็อก ผ่าน Tiger Cashbox" },
  { id: "customer", name: "Customer & AR",    color: "#4A52C8", glyph: I.customer, status: "live", desc: "สมาชิก ระดับราคา วงเงินเครดิต ลูกหนี้การค้า รับชำระ AR" },
  { id: "account",  name: "บัญชี AP/AR/VAT",  color: "#8A8378", glyph: I.calc,     status: "todo", desc: "เจ้าหนี้ ลูกหนี้ ภาษีซื้อ-ขาย แยก 5 กิจการ รายงานกำไร-ขาดทุน" },
];
const MOD = Object.fromEntries(MODULES.map((m) => [m.id, m]));

/* ---------- shared bits ---------- */
function Sq({ color, size = 52, radius = 14, children, style }) {
  return <div className="sq" style={{ "--sq": color, width: size, height: size, borderRadius: radius, ...style }}>{children}</div>;
}
function ModHead({ mod, children }) {
  return (
    <div className="mod-head">
      <Sq color={mod.color} size={46} radius={13}>{mod.glyph}</Sq>
      <div className="mh-t">
        <h1>{mod.name}</h1>
        <p className="mh-s">{mod.desc}</p>
      </div>
      <div className="mh-actions">{children}</div>
    </div>
  );
}
function Empty({ children }) {
  return <div className="empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h8"/></svg><div>{children}</div></div>;
}
Object.assign(window, { KLH, baht, I, Ui, MODULES, MOD, Sq, ModHead, Empty });

/* ---------- Home launcher ---------- */
function Home({ onOpen }) {
  const today = new Date();
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const dstr = today.getDate() + " " + months[today.getMonth()] + " " + (today.getFullYear() + 543);
  return (
    <div className="winner">
      <div className="hero">
        <div className="hero-logo"><img src="assets/klh-logo.png" alt="KLH Bakery Store" /></div>
        <div>
          <h1>KLH Grocery EPS-POS</h1>
          <p className="sub">ระบบบริหารจัดการธุรกิจค้าส่ง — ห้างหุ้นส่วน เคแอลเอช</p>
        </div>
        <div className="stats">
          <div className="stat"><div className="v num">{dstr}</div><div className="k">วันนี้</div></div>
          <div className="stat"><div className="v coral num">5</div><div className="k">กิจการ</div></div>
          <div className="stat"><div className="v coral num">5</div><div className="k">คลังสินค้า</div></div>
          <div className="stat live"><div className="v"><span className="ld"></span>Live</div><div className="k">ระบบทำงานปกติ</div></div>
        </div>
      </div>
      <div className="seclabel"><h2>โมดูลทั้งหมด</h2><span>9 แอปพลิเคชัน · แตะเพื่อเปิด</span></div>
      <div className="grid">
        {MODULES.map((m) => (
          <button key={m.id} className={"card" + (m.status === "todo" ? " todo" : "")} style={{ "--sq": m.color }} onClick={() => onOpen(m.id)}>
            <div className="card-top">
              <Sq color={m.color}>{m.glyph}</Sq>
              {m.status === "live"
                ? <span className="badge live"><span className="ld"></span>LIVE</span>
                : <span className="badge todo">TODO</span>}
            </div>
            <h3>{m.name}</h3>
            <p>{m.desc}</p>
            <span className="go">เปิดโมดูล →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Shell ---------- */
function MacShell() {
  const [screen, setScreen] = kS("home");
  const [clock, setClock] = kS("");
  kE(() => {
    const days = ["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."], months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    const pad = (n) => (n < 10 ? "0" : "") + n;
    const t = () => { const d = new Date(); setClock(days[d.getDay()] + " " + d.getDate() + " " + months[d.getMonth()] + " " + pad(d.getHours()) + ":" + pad(d.getMinutes())); };
    t(); const iv = setInterval(t, 30000); return () => clearInterval(iv);
  }, []);
  kE(() => { const wb = document.querySelector(".wbody"); if (wb) wb.scrollTop = 0; }, [screen]);

  const mod = screen !== "home" ? MOD[screen] : null;
  const Screen = screen !== "home" ? (window.KLH_SCREENS || {})[screen] : null;
  const open = (id) => setScreen(id);

  const dockApps = ["home", "price", "wms", "pos", "cashier", "supplier", "account"];

  return (
    <div className="desktop">
      {/* menu bar */}
      <div className="menubar">
        <div className="mb-logo">K</div>
        <span className="mb-app">KLH EPS-POS</span>
        {["ไฟล์","แก้ไข","มุมมอง","ระบบ","ช่วยเหลือ"].map((m) => <span key={m} className="mb-item">{m}</span>)}
        <div className="mb-right">
          <span className="mb-live"><span className="ld"></span>Live</span>
          {Ui.searchS}
          <span className="num" style={{ fontWeight: 500 }}>{clock}</span>
        </div>
      </div>

      {/* window */}
      <div className="stage">
        <div className="window" data-screen-label={mod ? mod.name : "หลังบ้าน"}>
          <div className="titlebar">
            <div className="lights"><i className="r"></i><i className="y"></i><i className="g"></i></div>
            {screen !== "home" && (
              <button className="btn sm ghost" style={{ marginLeft: 14, gap: 5 }} onClick={() => setScreen("home")}>{Ui.back} หน้าหลัก</button>
            )}
            <div className="tt">{mod ? "KLH · " + mod.name : "KLH Grocery EPS-POS — หลังบ้าน"}</div>
            <div className="tb-actions">
              <button className="tb-btn" title="รีเฟรช">{Ui.refresh}</button>
              <button className="tb-btn" title="ตั้งค่า">{Ui.gear}</button>
            </div>
          </div>
          <div className="wbody">
            {screen === "home" && <Home onOpen={open} />}
            {mod && Screen && <Screen mod={mod} onOpen={open} />}
            {mod && !Screen && (
              <div className="winner"><ModHead mod={mod} /><div className="todo-banner">หน้านี้กำลังจัดทำ — ยังไม่ได้ลงรายละเอียด</div></div>
            )}
          </div>
        </div>
      </div>

      {/* dock */}
      <div className="dock-wrap">
        <div className="dock">
          {dockApps.map((id, i) => {
            const m = id === "home" ? null : MOD[id];
            const prevSep = (id === "price" || id === "account");
            return (
              <React.Fragment key={id}>
                {prevSep && <div className="dock-sep"></div>}
                <button className={"dock-app" + (id === "home" ? " dot" : "")} onClick={() => open(id)}>
                  {id === "home"
                    ? <div className="sq" style={{ overflow: "hidden", background: "var(--cream)", padding: 0 }}><img src="assets/klh-logo.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                    : <Sq color={m.color} size={50} radius={13}>{m.glyph}</Sq>}
                  <span className="tip">{id === "home" ? "หน้าหลัก" : m.name}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Home, MacShell });
