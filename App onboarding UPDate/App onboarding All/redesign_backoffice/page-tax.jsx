/* ============================================================
   page-tax.jsx — ประมาณการ สรรพากร (ภพ.30) (KLH theme)
   maps: getPP30(ym) · saveTaxEstimate(ym, pct, lastYearAvg)
   ============================================================ */
const { useState: tS } = React;
const RT = window.REPORTS.pp30;
const nf2 = (n) => Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });

function TaxPage() {
  const [ym, setYm] = tS("2026-05");
  const [loaded, setLoaded] = tS(false);
  const [pct, setPct] = tS(RT.estimate.execPercent);
  const [lastYear, setLastYear] = tS(RT.estimate.lastYearAvg);
  const [toast, showToast] = useToast();

  const r = RT;
  const est = r.estimate;
  return (
    <Win title="KLH · ประมาณการ สรรพากร (ภพ.30)">
      <div className="phead">
        <div className="pic" style={{ background: "linear-gradient(135deg,#26A69A,#00695C)" }}>{ICO.doc}</div>
        <div><h1>ประมาณการ สรรพากร (ภพ.30)</h1><p>ภาษีซื้อจาก Invoice OCR (บิลชื่อ KLH) · ภาษีขายจากยอดขาย · เป้า = ภาษีซื้อ + % ผู้บริหาร</p></div>
      </div>
      <div className="body">
        <div className="toolbar" style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: 13 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>เดือน</span>
          <input className="in" type="month" value={ym} onChange={(e) => setYm(e.target.value)} style={{ width: 170, border: "1.5px solid var(--line-2)", borderRadius: 10, padding: "9px 11px", fontFamily: "var(--ffn)" }} />
          <button className="btn primary" onClick={() => { setLoaded(true); showToast("โหลดข้อมูลแล้ว"); }}>โหลดข้อมูล</button>
        </div>

        {!loaded ? <div className="empty" style={{ marginTop: 30 }}>เลือกเดือนแล้วกด "โหลดข้อมูล"</div> : (<>
          <div className="kpis" style={{ marginTop: 16 }}>
            <div className="kpi" style={{ borderLeft: "4px solid var(--blue)" }}><div className="kv num" style={{ color: "var(--blue)" }}>{nf2(r.input.vat)}</div><div className="kk">ภาษีซื้อ (บิลชื่อ KLH)</div><div className="kd">{r.input.count} ใบกำกับ · ฐาน ฿{nf2(r.input.base)}</div></div>
            <div className="kpi" style={{ borderLeft: "4px solid var(--coral)" }}><div className="kv num" style={{ color: "var(--coral-2)" }}>{nf2(r.outputVatActual)}</div><div className="kk">ภาษีขาย (จากยอดจริง)</div><div className="kd">ยอดขาย KLH ฿{nf2(r.actualSales)}</div></div>
            <div className="kpi" style={{ borderLeft: "4px solid " + (r.netVat >= 0 ? "var(--green)" : "var(--red)") }}><div className="kv num" style={{ color: r.netVat >= 0 ? "var(--green)" : "var(--red)" }}>{nf2(r.netVat)}</div><div className="kk">VAT สุทธิ (ต้องนำส่ง)</div><div className="kd">{r.netVat >= 0 ? "ขาย > ซื้อ ✓" : "⚠️ ขาย < ซื้อ — ต้องเพิ่มยอดขาย"}</div></div>
            <div className="kpi"><div className="kv num">{nf2(r.purchaseAllEntities)}</div><div className="kk">ยอดซื้อรวมทุกนิติ (เจ้าหนี้)</div><div className="kd">เก็บทุกชื่อใน SHOPS</div></div>
          </div>

          <div className="surface" style={{ padding: 18, marginTop: 4 }}>
            <h2 style={{ fontSize: 15.5, margin: "0 0 12px" }}>📋 สรุป ภพ.30 — {r.month}</h2>
            <div className="taxrow"><span>ยอดขายขั้นต่ำที่ต้องมี (ให้ VAT ขาย &gt; ซื้อ)</span><b className="num">฿{nf2(r.minSalesRequired)}</b></div>
            <div className="taxrow"><span>ยอดขายจริงเดือนนี้ (KLH)</span><b className="num" style={{ color: r.actualSales >= r.minSalesRequired ? "var(--green)" : "var(--red)" }}>฿{nf2(r.actualSales)}</b></div>
            <div className="taxrow"><span>เป้าผู้บริหาร (+{est.execPercent}% เหนือภาษีซื้อ)</span><b className="num">฿{nf2(est.targetSales)}</b></div>
            <div className="taxrow"><span>VAT ขายตามเป้า</span><b className="num">฿{nf2(est.targetVat)}</b></div>
            <div className="taxrow"><span>ส่วนต่างจากเป้า</span><b className="num" style={{ color: r.actualSales >= est.targetSales ? "var(--green)" : "var(--red)" }}>{r.actualSales >= est.targetSales ? "+" : ""}{nf2(r.actualSales - est.targetSales)}</b></div>
          </div>

          <div className="surface" style={{ padding: 18, marginTop: 14 }}>
            <h2 style={{ fontSize: 15.5, margin: "0 0 12px" }}>🎯 ตั้งเป้าผู้บริหาร (เดือนนี้)</h2>
            <div className="toolbar" style={{ margin: 0 }}>
              <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 600 }}>% เพิ่มเหนือภาษีซื้อ</span>
              <input className="in num" type="number" value={pct} onChange={(e) => setPct(e.target.value)} style={{ width: 100, border: "1.5px solid var(--line-2)", borderRadius: 10, padding: "9px 11px" }} />
              <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 600 }}>ยอดขายปีที่แล้ว (เฉลี่ย/เดือน)</span>
              <input className="in num" type="number" value={lastYear} onChange={(e) => setLastYear(e.target.value)} style={{ width: 150, border: "1.5px solid var(--line-2)", borderRadius: 10, padding: "9px 11px" }} />
              <button className="btn green" onClick={() => showToast("บันทึกเป้าแล้ว")}>บันทึกเป้า</button>
            </div>
            <div className="note blue" style={{ marginTop: 12 }}>VAT ขายเป้า = VAT ซื้อ × (1 + %) → ยอดขายที่ต้องมี = VAT เป้า × 107/7 · ทุกวันอาทิตย์ 19:00 ระบบเทียบยอดจริงกับเป้า แล้วแจ้งเตือนเข้ากลุ่ม LINE อัตโนมัติ</div>
          </div>
        </>)}
      </div>
      {toast}
    </Win>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<TaxPage />);
