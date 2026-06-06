/* ============================================================
   klh-mods-b.jsx — Cashier · KLH Data Survey · Invoice OCR
   ============================================================ */
const { useState: bS, useMemo: bM } = React;

/* faux QR (decorative) */
function bHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function bRng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function FQR({ value, size = 150 }) {
  const N = 25, rnd = bRng(bHash(value));
  const fc = (r,c) => { for (const [R,C] of [[0,0],[0,N-7],[N-7,0]]) { if (r>=R&&r<R+7&&c>=C&&c<C+7){const dr=r-R,dc=c-C;return (dr===0||dr===6||dc===0||dc===6)||(dr>=2&&dr<=4&&dc>=2&&dc<=4);} } return null; };
  const near = (r,c) => [[0,0],[0,N-7],[N-7,0]].some(([R,C]) => r>=R-1&&r<=R+7&&c>=C-1&&c<=C+7);
  const m = size/N, rects = [];
  for (let r=0;r<N;r++) for (let c=0;c<N;c++){ const f=fc(r,c); const on=f!==null?f:(!near(r,c)&&rnd()>0.5); if(on) rects.push(<rect key={r+"_"+c} x={c*m} y={r*m} width={m+0.5} height={m+0.5} fill="#1A1714" />); }
  return <div className="qrbox"><svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">{rects}</svg></div>;
}

/* ============================================================
   CASHIER — scan order → pay (cash/QR/credit) → Tigercashbox
   ============================================================ */
function Cashier({ mod }) {
  const [orders, setOrders] = bS(KLH.pendingOrders);
  const [active, setActive] = bS(null); // order object
  const [method, setMethod] = bS("cash");
  const [recv, setRecv] = bS("");
  const [drawer, setDrawer] = bS(false);
  const [done, setDone] = bS(false);

  const total = active ? active.items.reduce((a, b) => a + b.qty * b.price, 0) : 0;
  const count = active ? active.items.reduce((a, b) => a + b.qty, 0) : 0;
  const received = parseInt(recv || "0", 10);
  const change = received - total;
  const tap = (k) => { if (k === "del") setRecv((s) => s.slice(0,-1)); else setRecv((s) => (s + k).replace(/^0+(?=\d)/, "").slice(0,7)); };
  const canPay = method === "cash" ? received >= total : true;

  const pick = (o) => { setActive(o); setDone(false); setRecv(""); setMethod("cash"); setDrawer(false); };
  const pay = () => { if (method === "cash") setDrawer(true); setDone(true); };
  const finish = () => { setOrders((os) => os.filter((o) => o.no !== active.no)); setActive(null); setDone(false); };

  return (
    <div className="winner">
      <ModHead mod={mod}>
        <span className="devchip2"><span className="ld"></span>Tigercashbox พร้อม</span>
        <button className="btn sm">{Ui.refresh} รีเฟรช</button>
      </ModHead>

      <div className="split">
        {/* main: scan + order list / detail */}
        <div className="main">
          <div className="field" style={{ marginBottom: 16 }}>
            <label>สแกน QR หรือกรอกเลขออเดอร์</label>
            <div className="input-scan">
              <input className="input" placeholder="สแกน QR หรือพิมพ์ ORD-YYYYMMDD-XXX…" />
              <button className="btn primary" style={{ padding: "0 18px" }}>โหลด</button>
            </div>
          </div>

          {!active ? (
            <div className="surface" style={{ padding: 6 }}>
              <div style={{ padding: "10px 14px", fontSize: 13.5, fontWeight: 700, color: "var(--ink-2)" }}>ออเดอร์รอชำระ <span className="num" style={{ color: "var(--ink-3)" }}>({orders.length})</span></div>
              {orders.length === 0 && <Empty>ไม่มีออเดอร์รอชำระ</Empty>}
              {orders.map((o) => {
                const t = o.items.reduce((a,b) => a + b.qty*b.price, 0);
                return (
                  <button key={o.no} onClick={() => pick(o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: "1px solid var(--line)", textAlign: "left" }}>
                    <Sq color={mod.color} size={40} radius={11} style={{ boxShadow: "none" }}>{Ui.scan}</Sq>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="num" style={{ fontSize: 13.5, fontWeight: 700 }}>{o.no}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{o.src} · {o.time} น. · {o.items.length} รายการ</div>
                    </div>
                    <div className="num" style={{ fontSize: 17, fontWeight: 700, color: "var(--coral-2)" }}>{baht(t)}</div>
                    <span style={{ color: "var(--ink-3)" }}>{Ui.chevron}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="surface" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--line)", background: "var(--paper-2)" }}>
                <div className="num" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{active.no}</div>
                <span className="pill gray">{active.src}</span>
                <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => setActive(null)}>เปลี่ยนออเดอร์</button>
              </div>
              <div style={{ padding: "4px 16px" }}>
                {active.items.map((it, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: i < active.items.length-1 ? "1px solid var(--line)" : "none" }}>
                    <span className="num" style={{ color: "var(--ink-3)", width: 34 }}>{it.qty}×</span>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{it.name}</span>
                    <span className="num muted" style={{ fontSize: 12.5 }}>{baht(it.price)}</span>
                    <span className="num" style={{ width: 70, textAlign: "right", fontWeight: 700 }}>{baht(it.qty*it.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* side: payment panel */}
        <div className="side">
          <div className="panel-dark">
            <div className="pd-label">ยอดที่ต้องชำระ</div>
            <div className="pd-amount">{baht(total)}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginTop: 4 }}>{active ? active.no + " · " + count + " ชิ้น" : "ยังไม่เลือกออเดอร์"}</div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="devchip2"><span className="ld"></span>Tigercashbox · เชื่อมต่อแล้ว</span>
              <div className="devrow"><span style={{ color: "rgba(255,255,255,.7)" }}>{Ui.print}</span><span className="dl">ลิ้นชักเก็บเงิน</span><span className="ds" style={{ color: drawer ? "#7FE0A8" : "rgba(255,255,255,.45)" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: drawer ? "#7FE0A8" : "rgba(255,255,255,.35)" }}></span>{drawer ? "เปิดอยู่" : "ปิด"}</span></div>
              <div className="devrow"><span style={{ color: "rgba(255,255,255,.7)" }}>{Ui.print}</span><span className="dl">เครื่องพิมพ์ใบเสร็จ</span><span className="ds" style={{ color: "#7FE0A8" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: "#7FE0A8" }}></span>พร้อม</span></div>
            </div>
          </div>

          {!active ? (
            <div className="todo-banner" style={{ marginTop: 14 }}>เลือกออเดอร์ที่รอชำระเพื่อเริ่มรับเงิน</div>
          ) : done ? (
            <div className="surface" style={{ marginTop: 14, padding: 18, textAlign: "center" }}>
              <div style={{ width: 60, height: 60, borderRadius: 999, background: "var(--green)", color: "#fff", display: "grid", placeItems: "center", margin: "0 auto 10px", boxShadow: "0 10px 22px -10px var(--green)" }}>{Ui.check}</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>ปิดบิลสำเร็จ</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 3 }}>{method === "cash" ? `รับ ${baht(received)} · ทอน ${baht(Math.max(0,change))}` : method === "qr" ? "ชำระผ่าน QR / โอน" : "ลงบัญชีเชื่อ (AR)"}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>ตัดสต็อกอัตโนมัติแล้ว</div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button className="btn sm" style={{ flex: 1 }}>{Ui.print} ใบเสร็จ</button>
                <button className="btn sm primary" style={{ flex: 1 }} onClick={finish}>ออเดอร์ถัดไป</button>
              </div>
            </div>
          ) : (
            <div className="surface" style={{ marginTop: 14, padding: 14 }}>
              <div className="paytabs" style={{ marginBottom: 12 }}>
                {[["cash","เงินสด"],["qr","QR / โอน"],["credit","เชื่อ"]].map(([k,l]) => (
                  <button key={k} className={"paytab" + (method === k ? " on" : "")} onClick={() => setMethod(k)}>
                    <span>{k === "qr" ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7M14 21h3" strokeLinecap="round"/></svg> : k === "cash" ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.4"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19" strokeLinecap="round"/></svg>}</span>
                    {l}
                  </button>
                ))}
              </div>

              {method === "cash" && (<>
                <div style={{ border: "1px solid var(--line-2)", borderRadius: 12, padding: "11px 13px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span className="muted">รับมา</span><span className="num" style={{ fontWeight: 700, fontSize: 16 }}>{baht(received)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 5, color: change >= 0 ? "var(--green)" : "var(--ink-3)" }}><span>เงินทอน</span><span className="num" style={{ fontWeight: 700, fontSize: 16 }}>{change >= 0 ? baht(change) : "—"}</span></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, marginBottom: 8 }}>
                  <button className="qcash2" onClick={() => setRecv(String(total))}>พอดี</button>
                  {[100,500,1000].map((v) => <button key={v} className="qcash2" onClick={() => setRecv(String(v))}>{v.toLocaleString()}</button>)}
                </div>
                <div className="keypad">{["1","2","3","4","5","6","7","8","9","00","0","del"].map((k) => <button key={k} className="kkey2" onClick={() => tap(k)}>{k === "del" ? "⌫" : k}</button>)}</div>
              </>)}

              {method === "qr" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <FQR value={"PP" + (active.no) + total} size={150} />
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", textAlign: "center" }}>ให้ลูกค้าสแกนจ่าย ยอด <b className="num">{baht(total)}</b></div>
                  <span className="pill amber"><span className="ld"></span>รอ Tigercashbox ยืนยัน…</span>
                </div>
              )}

              {method === "credit" && (
                <div style={{ padding: "4px 0 8px" }}>
                  <div className="note" style={{ marginBottom: 10 }}>ลงบิลเป็นลูกหนี้การค้า (AR) ของสมาชิกค้าส่ง — ตัดวงเงินเครดิตและไปออกใบวางบิลในโมดูล Customer &amp; AR</div>
                  <div className="field"><label>เลือกสมาชิก</label><select>{KLH.members.filter(m => m.tier !== "ปลีก").map((m) => <option key={m.id}>{m.name} · เครดิตคงเหลือ {baht(m.credit - m.ar)}</option>)}</select></div>
                </div>
              )}

              <button className="btn primary" style={{ width: "100%", marginTop: 12, padding: 13 }} disabled={!canPay} onClick={pay}>
                {Ui.check} {method === "cash" ? "ปิดบิล · เปิดลิ้นชัก" : method === "qr" ? "ยืนยันรับชำระ" : "ลงบิลเชื่อ (AR)"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   KLH DATA SURVEY — สำรวจ/อัปเดตข้อมูลสินค้า
   ============================================================ */
function Survey({ mod }) {
  const [q, setQ] = bS("");
  const items = [
    { code: "ITEM-0001", name: "แป้งจิงโจ้ 1 กก.", cost: 23.5, retail: 28, barcode: true, photo: true, done: true },
    { code: "ITEM-0002", name: "แป้งจิงโจ้ กระสอบ 22.5 กก.", cost: 584.21, retail: 684, barcode: true, photo: false, done: false },
    { code: "ITEM-0034", name: "เนยสด อลาวรี่ 5 กก.", cost: 679.53, retail: 790, barcode: false, photo: false, done: false },
    { code: "ITEM-0102", name: "น้ำดื่ม สิงห์ 600 มล.", cost: 4.8, retail: 7, barcode: true, photo: true, done: true },
    { code: "ITEM-0301", name: "กล่องเค้ก 1 ปอนด์", cost: 6.2, retail: 9, barcode: true, photo: false, done: false },
  ];
  const rows = items.filter((it) => !q || it.name.includes(q) || it.code.includes(q));
  const pending = items.filter((it) => !it.done).length;
  return (
    <div className="winner">
      <ModHead mod={mod}>
        <button className="btn sm">{Ui.scan} สแกนสำรวจ</button>
        <button className="btn sm primary">ดึงจาก KLH DATA</button>
      </ModHead>
      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi"><div className="kv num">2,156</div><div className="kk">สินค้าทั้งหมด</div></div>
        <div className="kpi"><div className="kv green num">1,884</div><div className="kk">ข้อมูลครบ</div></div>
        <div className="kpi"><div className="kv coral num">272</div><div className="kk">รอสำรวจ/อัปเดต</div></div>
        <div className="kpi"><div className="kv blue num">96%</div><div className="kk">มีบาร์โค้ด</div></div>
      </div>
      <div className="toolbar">
        <div className="search">{Ui.searchS}<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาสินค้าเพื่อสำรวจ/อัปเดต…" /></div>
        <div className="dd">เฉพาะรอสำรวจ ({pending}) {Ui.chevron}</div>
      </div>
      <div className="tbl">
        <table>
          <thead><tr><th>รหัส</th><th>ชื่อสินค้า</th><th className="r">ทุน</th><th className="r">ปลีก</th><th className="c">บาร์โค้ด</th><th className="c">รูป</th><th className="c">สถานะ</th></tr></thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it.code}>
                <td><span className="code">{it.code}</span></td>
                <td className="name">{it.name}</td>
                <td className="r price muted">{it.cost.toLocaleString()}</td>
                <td className="r price">{it.retail}</td>
                <td className="c">{it.barcode ? <span style={{ color: "var(--green)" }}>{Ui.check}</span> : <span className="muted">—</span>}</td>
                <td className="c">{it.photo ? <span style={{ color: "var(--green)" }}>{Ui.check}</span> : <span className="muted">—</span>}</td>
                <td className="c">{it.done ? <span className="pill green">ครบ</span> : <span className="pill amber">รออัปเดต</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   INVOICE OCR — สแกนใบกำกับ → ตรวจ → บันทึก
   ============================================================ */
function OCR({ mod }) {
  const [sel, setSel] = bS(KLH.invoices[0]);
  return (
    <div className="winner">
      <ModHead mod={mod}>
        <button className="btn sm primary">{Ui.plus} อัปโหลด/สแกนใบใหม่</button>
      </ModHead>
      <div className="split">
        <div className="side" style={{ width: 320 }}>
          <div className="surface" style={{ padding: 6 }}>
            <div style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>คิวใบกำกับ ({KLH.invoices.length})</div>
            {KLH.invoices.map((iv) => (
              <button key={iv.file} onClick={() => setSel(iv)} style={{ width: "100%", display: "flex", gap: 11, padding: "11px 12px", borderTop: "1px solid var(--line)", textAlign: "left", borderRadius: 10, background: sel.file === iv.file ? "var(--coral-soft)" : "transparent" }}>
                <div style={{ width: 38, height: 46, borderRadius: 7, background: "var(--paper-2)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center", color: "var(--ink-3)", flex: "0 0 auto" }}>{Ui.print}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{iv.vendor}</div>
                  <div className="num" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{iv.no} · {iv.date}</div>
                  <div style={{ marginTop: 4 }}><span className={"pill " + (iv.status === "ตรวจแล้ว" ? "green" : "amber")} style={{ fontSize: 11 }}>{iv.status}</span></div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="main">
          <div className="split" style={{ gap: 16 }}>
            {/* preview */}
            <div style={{ flex: "0 0 240px" }}>
              <div className="surface" style={{ padding: 12, aspectRatio: "3/4", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>{sel.file}</div>
                <div style={{ flex: 1, background: "repeating-linear-gradient(0deg,var(--paper-2) 0 14px,#fff 14px 28px)", borderRadius: 8, border: "1px solid var(--line)", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: "32%", height: 2, background: "var(--coral)", boxShadow: "0 0 12px 2px var(--coral)" }} />
                </div>
                <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--ink-3)" }}>กำลังอ่าน OCR…</div>
              </div>
            </div>
            {/* extracted fields */}
            <div className="main">
              <div className="surface" style={{ padding: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>ข้อมูลที่แยกได้ <span className="pill blue" style={{ fontSize: 11 }}>OCR · ความมั่นใจ 97%</span></div>
                <div className="form-grid">
                  <div className="field"><label>ผู้ขาย/เจ้าหนี้</label><input className="input" defaultValue={sel.vendor} /></div>
                  <div className="field"><label>เลขที่ใบกำกับ</label><input className="input num" defaultValue={sel.no} /></div>
                  <div className="field"><label>วันที่</label><input className="input num" defaultValue={sel.date} /></div>
                  <div className="field"><label>Entity (กิจการ)</label><select>{KLH.entities.map((e) => <option key={e.id}>{e.name}</option>)}</select></div>
                  <div className="field"><label>ยอดก่อน VAT</label><input className="input num" defaultValue={(sel.total - sel.vat).toLocaleString()} /></div>
                  <div className="field"><label>VAT 7%</label><input className="input num" defaultValue={sel.vat.toLocaleString()} /></div>
                  <div className="field full"><label>ยอดรวมสุทธิ</label><input className="input num" defaultValue={sel.total.toLocaleString()} style={{ fontWeight: 700 }} /></div>
                </div>
                <div className="divider"></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" style={{ flex: 1 }}>บันทึกร่าง</button>
                  <button className="btn primary" style={{ flex: 1.5 }}>{Ui.check} ยืนยัน → เข้า WMS + บัญชี</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.KLH_SCREENS = Object.assign(window.KLH_SCREENS || {}, { cashier: Cashier, survey: Survey, ocr: OCR });
