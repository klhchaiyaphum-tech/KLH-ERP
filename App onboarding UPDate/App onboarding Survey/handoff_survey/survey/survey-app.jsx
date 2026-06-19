/* ============================================================
   survey-app.jsx — KLH Data Survey (mobile) — SINGLE-PAGE flow
   matches real GAS impl order:
     1 ค้นหาสินค้า → 2 ข้อมูลพื้นฐาน → 🪙 ต้นทุน&ราคาขาย → 3 รูปภาพ&บาร์โค้ด
   Sections 2/3 + popups live in survey-detail.jsx (window.ProductForm)
   ============================================================ */
const { useState: uS, useEffect: uE, useRef: uR } = React;
const S = window.SURVEY;
const baht = (n) => (n == null || n === "" ? "—" : Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const supName = (code) => (S.suppliers.find((s) => s.code === code) || {}).name || code || "";

/* snap to nearest 0.25 then ±0.25 (spec §5.1) */
function snap025(val, dir) {
  const v = parseFloat(val) || 0;
  const nearest = Math.round(v / 0.25) * 0.25;
  if (Math.abs(nearest - v) > 1e-9) return dir > 0 ? Math.ceil(v / 0.25) * 0.25 : Math.floor(v / 0.25) * 0.25;
  return Math.max(0, nearest + dir * 0.25);
}

const ic = {
  search: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/></svg>,
  scan: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M6 12h12M6 9v6M10 9v6M14 9v6M18 9v6"/></svg>,
  cam: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"/><circle cx="12" cy="12.5" r="3.4"/></svg>,
  camBig: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"/><circle cx="12" cy="12.5" r="3.4"/></svg>,
  back: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg>,
  refresh: <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/></svg>,
  chevR: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>,
  plus: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 6v12M6 12h12"/></svg>,
  check: <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19.5 6.5"/></svg>,
  checkS: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19.5 6.5"/></svg>,
  warn: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>,
  x: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>,
  gear: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-2.7 1.1 2 2 0 0 1-4 0 1.6 1.6 0 0 0-2.7-1.1 2 2 0 1 1-2.8-2.8A1.6 1.6 0 0 0 4.6 13a2 2 0 0 1 0-4 1.6 1.6 0 0 0 1.1-2.7 2 2 0 1 1 2.8-2.8A1.6 1.6 0 0 0 11 4.6a2 2 0 0 1 4 0 1.6 1.6 0 0 0 2.7 1.1 2 2 0 1 1 2.8 2.8A1.6 1.6 0 0 0 19.4 11"/></svg>,
  copy: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>,
  edit: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>,
  flash: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>,
  studio: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 14l5-4 4 3 3-2 6 5M16 9h.01"/></svg>,
  calc: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15v3"/></svg>,
  print: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1M7 14h10v7H7z"/></svg>,
  save: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>,
  clipboard: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3M8.5 12h7M8.5 16h5"/></svg>,
  tag: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 12.5V5a1.5 1.5 0 0 1 1.5-1.5h7.5L21 12l-8 8-9.5-7.5Z"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/></svg>,
  imgbc: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2.5"/><path d="M3 14l4.5-3.5 3.5 2.5M14 11l3-2 4 3.5"/><circle cx="9" cy="9" r="1.4"/></svg>,
};

/* ===================== SECTION 1 — ค้นหาสินค้า ===================== */
function SearchSection({ app }) {
  const [q, setQ] = uS(app.query || "");
  const [open, setOpen] = uS(false);
  uE(() => { setQ(app.query || ""); }, [app.query]);
  const results = q.trim()
    ? S.items.filter((it) => it.name.includes(q) || it.item.includes(q) || (it.barcode || "").includes(q))
    : [];

  return (
    <div className="card sec-card">
      <div className="sec-h"><span className="sec-chip"><span className="g">{ic.search}</span><i className="sn">1</i></span><h3>ค้นหาสินค้า</h3></div>
      <div className="search-row">
        <input className="inp" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="ชื่อ / บาร์โค้ดชิ้น / บาร์โค้ดลัง…" />
        <button className="sq-btn dark" onClick={() => app.openScan("find")} title="สแกนบาร์โค้ด">{ic.cam}</button>
        <button className="sq-btn blue" onClick={() => setOpen(true)} title="ค้นหา">{ic.search}</button>
      </div>

      {open && results.length > 0 && (
        <div className="res-list">
          {results.map((it) => (
            <button key={it.item} className="res-row" onClick={() => { app.select(it); setOpen(false); }}>
              <div className="rr-in">
                <h4>{it.name}</h4>
                <div className="rr-meta">ชิ้น: <b>{it.item}</b> | ลัง: {it.barcodeBig || "-"}</div>
              </div>
              {!it.done && <span className="dotwarn" />}
            </button>
          ))}
        </div>
      )}
      {open && q.trim() && results.length === 0 && (
        <div className="res-empty">ไม่พบ “{q}” — เพิ่มเป็นสินค้าใหม่ได้ด้านล่าง</div>
      )}

      <button className="btn-addnew" onClick={() => { app.addNew(q); setOpen(false); }}>{ic.plus} เพิ่มสินค้าใหม่</button>
    </div>
  );
}

/* ===================== SCAN overlay ===================== */
function ScanOverlay({ app }) {
  uE(() => {
    const t = setTimeout(() => app.scanDone(S.items[Math.floor(Math.random() * 3) + 1]), 1700);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="scancam">
      <div className="sc-top">
        <button className="sc-btn" onClick={app.closeScan}>{ic.x}</button>
        <span>เล็งบาร์โค้ดให้อยู่ในกรอบ</span>
        <button className="sc-btn">{ic.flash}</button>
      </div>
      <div className="sc-frame">
        <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
        <div className="sc-laser" />
      </div>
      <div className="sc-hint">{ic.scan} กำลังอ่านบาร์โค้ด…</div>
    </div>
  );
}

/* ===================== SAVED sheet ===================== */
function SavedSheet({ app }) {
  return (
    <div className="saved" onClick={app.closeSaved}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="chk">{ic.check}</div>
        <h2>บันทึกเข้าระบบแล้ว</h2>
        <p><b>{app.justSaved?.name}</b><br/>อัปเดตเข้า KLH DATA เรียบร้อย</p>
        <div className="saved-row">
          <button className="btn ghost" style={{ flex: 1, width: "auto" }} onClick={app.closeSaved}>เสร็จสิ้น</button>
          <button className="btn" onClick={() => app.openScan("find")}>{ic.scan} สแกนตัวถัดไป</button>
        </div>
      </div>
    </div>
  );
}

/* ===================== ROOT (single page) ===================== */
function SurveyApp({ insetTop = 50, insetBottom = 20 }) {
  const [d, setD] = uS(null);        // selected/edited product, or null
  const [isNew, setIsNew] = uS(false);
  const [query, setQuery] = uS("");
  const [saved, setSaved] = uS(false);
  const [justSaved, setJustSaved] = uS(null);
  const [toast, setToast] = uS(null);
  const [scan, setScan] = uS(null);
  const scrollRef = uR(null);
  const formRef = uR(null);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 1700); };
  const scrollToForm = () => setTimeout(() => { formRef.current && scrollRef.current && scrollRef.current.scrollTo({ top: formRef.current.offsetTop - 8, behavior: "smooth" }); }, 90);

  const app = {
    insetTop, insetBottom, query, d, isNew,
    toast: showToast,
    setField: (patch) => setD((x) => ({ ...x, ...patch })),
    select: (it) => { setQuery(it.name); setD({ ...it }); setIsNew(false); scrollToForm(); },
    addNew: (q) => {
      setD({ item: "ITEM-" + String(Math.floor(2000 + Math.random() * 7999)), barcode: "", barcodeBig: "", name: q || "", cat: "", size: "", packMult: 1, packUnit: "", supplier: "", entity: S.entities[0], groupCode: "", buyPrice: "", costFinal: "", wholeOld: "", retailOld: "", wholePct: 8, retailPct: 12, makeDozen: false, updatedAt: "2026-06-07", hasImg: false, done: false, miss: [], _new: true });
      setIsNew(true); scrollToForm();
    },
    openScan: (mode) => setScan({ mode }),
    closeScan: () => setScan(null),
    scanDone: (it) => { setScan(null); if (it) { showToast("พบ: " + it.name); setQuery(it.name); setD({ ...it }); setIsNew(false); scrollToForm(); } },
    save: (prod) => { setJustSaved(prod); setSaved(true); },
    closeSaved: () => { setSaved(false); },
  };

  const Form = window.ProductForm;
  return (
    <div className="sv">
      <div className="inset-top" style={{ height: insetTop }} />
      {/* header */}
      <div className="sv-head">
        <div className="hlogo"><img src="survey/assets/klh-logo.png" alt="" /></div>
        <div className="hh">
          <b>ห้างหุ้นส่วนจำกัด เคแอลเอช</b>
          <span>Enterprise Survey &amp; Pricing</span>
        </div>
        <button className="hbtn" onClick={() => showToast("ดึงข้อมูลล่าสุดจาก KLH DATA…")}>{ic.refresh}</button>
      </div>

      <div className="sv-scroll" ref={scrollRef}>
        <div className="sv-pad">
          <SearchSection app={app} />
          {d && Form && (
            <div ref={formRef}>
              <Form app={app} d={d} ic={ic} baht={baht} supName={supName} snap025={snap025} />
            </div>
          )}
          <div style={{ height: 24 }} />
        </div>
      </div>

      {saved && <SavedSheet app={app} />}
      {scan && <ScanOverlay app={app} />}
      {toast && <div className="toast">{ic.scan}{toast}</div>}
    </div>
  );
}

Object.assign(window, { SurveyApp, SV_IC: ic });
