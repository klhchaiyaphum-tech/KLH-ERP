/* ============================================================
   page-stock-month.jsx — สต๊อกสิ้นเดือน KLH (KLH theme)
   maps: getMonthEndStockByEntity(ym) · simulateKlhStock(ym, target)
   ============================================================ */
const { useState: mS } = React;
const RM = window.REPORTS.stockMonth;
const nf = (n) => Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });

function StockMonth() {
  const [ym, setYm] = mS("2026-06");
  const [loaded, setLoaded] = mS(false);
  const [target, setTarget] = mS("");
  const [sim, setSim] = mS(null);
  const [toast, showToast] = useToast();

  const runSim = () => {
    const t = parseFloat(target) || 0;
    if (t <= 0) { showToast("กรุณาใส่ยอดขายเป้าหมาย"); return; }
    // distribute by retail weight, deduct from stock
    const items = RM.klh.items.map((r) => ({ ...r, retailVal: r.onHand * (r.cost * 1.2) }));
    const totW = items.reduce((a, r) => a + r.retailVal, 0);
    let simSoldAmt = 0, simSoldQty = 0, remainCost = 0, remainQty = 0;
    const rows = items.map((r) => {
      const share = totW ? r.retailVal / totW : 0;
      const amt = Math.min(r.onHand * r.cost * 1.2, t * share);
      const unit = r.cost * 1.2;
      const qty = Math.min(r.onHand, Math.round(amt / unit));
      simSoldAmt += qty * unit; simSoldQty += qty;
      const rq = r.onHand - qty; remainQty += rq; remainCost += rq * r.cost;
      return { barcode: r.barcode, name: r.name, onHand: r.onHand, simSoldQty: qty, simSoldAmt: qty * unit, remainQty: rq, remainCost: rq * r.cost };
    });
    setSim({ totals: { simSoldAmt, simSoldQty, remainCost, remainQty, unmatched: Math.max(0, t - simSoldAmt) }, items: rows });
  };

  const kt = RM.klh.totals, ot = RM.other.totals;
  return (
    <Win title="KLH · สต๊อกสิ้นเดือน">
      <div className="phead">
        <div className="pic" style={{ background: "linear-gradient(135deg,#26A69A,#00897B)" }}>{ICO.box}</div>
        <div><h1>สต๊อกสิ้นเดือน KLH</h1><p>แยกสต๊อก KLH กับร้านอื่น + สร้างยอดขายจำลองจาก statement → สต๊อกคงเหลือ KLH</p></div>
      </div>
      <div className="body">
        <div className="toolbar" style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: 13 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>เดือน (ยอดขายจริง)</span>
          <input className="in" type="month" value={ym} onChange={(e) => setYm(e.target.value)} style={{ width: 170, border: "1.5px solid var(--line-2)", borderRadius: 10, padding: "9px 11px", fontFamily: "var(--ffn)" }} />
          <button className="btn" style={{ background: "linear-gradient(135deg,#26A69A,#00897B)", color: "#fff", borderColor: "transparent" }} onClick={() => { setLoaded(true); showToast("โหลดรายงานแล้ว"); }}>โหลดรายงาน</button>
          {loaded && <span className="count">อัปเดต {RM.generatedAt}</span>}
        </div>

        {!loaded ? <div className="empty" style={{ marginTop: 30 }}>เลือกเดือนแล้วกด "โหลดรายงาน"</div> : (<>
          <div className="kpis" style={{ marginTop: 16 }}>
            <div className="kpi" style={{ borderLeft: "4px solid #00897B" }}><div className="kv num" style={{ color: "#00897B" }}>{nf(kt.costVal)}</div><div className="kk">สต๊อก KLH (มูลค่าทุน ฿)</div></div>
            <div className="kpi" style={{ borderLeft: "4px solid #00897B" }}><div className="kv num">{nf(kt.qty)}</div><div className="kk">ชิ้น KLH คงเหลือ</div></div>
            <div className="kpi" style={{ borderLeft: "4px solid #00897B" }}><div className="kv num">{nf(kt.soldAmt)}</div><div className="kk">ยอดขายจริง KLH ฿</div></div>
            <div className="kpi" style={{ borderLeft: "4px solid #E8910E" }}><div className="kv num" style={{ color: "#C77A0E" }}>{nf(ot.costVal)}</div><div className="kk">สต๊อกร้านอื่น (ทุน ฿)</div></div>
            <div className="kpi" style={{ borderLeft: "4px solid #E8910E" }}><div className="kv num">{nf(ot.qty)}</div><div className="kk">ชิ้นร้านอื่นคงเหลือ</div></div>
          </div>

          <div className="rep-sec"><span className="dot" style={{ background: "#26A69A" }} /> สินค้า KLH (ห้างหุ้นส่วนจำกัด เคแอลเอช)</div>
          <div className="tbl"><div className="scroll"><table>
            <thead><tr><th>บาร์โค้ด</th><th>สินค้า</th><th className="r">คงเหลือ</th><th className="r">ทุน/ชิ้น</th><th className="r">มูลค่าทุน</th><th className="r">ขายจริง(ชิ้น)</th><th className="r">ยอดขายจริง</th></tr></thead>
            <tbody>
              {RM.klh.items.map((r) => <tr key={r.barcode}><td><span className="code blue">{r.barcode}</span></td><td className="name">{r.name}</td><td className="r num">{nf(r.onHand)}</td><td className="r num">{nf(r.cost)}</td><td className="r num">฿{nf(r.costVal)}</td><td className="r num">{nf(r.soldQty)}</td><td className="r num">฿{nf(r.soldAmt)}</td></tr>)}
              <tr style={{ fontWeight: 700 }}><td colSpan="2">รวม KLH</td><td className="r num">{nf(kt.qty)}</td><td className="r">-</td><td className="r num">฿{nf(kt.costVal)}</td><td className="r num">{nf(kt.soldQty)}</td><td className="r num">฿{nf(kt.soldAmt)}</td></tr>
            </tbody>
          </table></div></div>

          <div className="rep-sec"><span className="dot" style={{ background: "#FF8F00" }} /> สินค้าหน่วยเข้าร้านอื่น</div>
          <div className="tbl"><div className="scroll"><table>
            <thead><tr><th>กิจการ</th><th className="r">SKU</th><th className="r">ชิ้นคงเหลือ</th><th className="r">มูลค่าทุน</th><th className="r">ยอดขายจริง</th></tr></thead>
            <tbody>
              {RM.other.byEntity.map((e) => <tr key={e.entity}><td className="name">{e.entity}</td><td className="r num">{nf(e.count)}</td><td className="r num">{nf(e.qty)}</td><td className="r num">฿{nf(e.costVal)}</td><td className="r num">฿{nf(e.soldAmt)}</td></tr>)}
              <tr style={{ fontWeight: 700 }}><td>รวมร้านอื่น</td><td className="r">-</td><td className="r num">{nf(ot.qty)}</td><td className="r num">฿{nf(ot.costVal)}</td><td className="r num">฿{nf(ot.soldAmt)}</td></tr>
            </tbody>
          </table></div></div>

          {/* simulate */}
          <div className="rep-sec"><span className="dot" style={{ background: "#7E57C2" }} /> สร้างยอดขาย KLH จำลอง (จาก statement)</div>
          <div className="toolbar" style={{ background: "#F3EEF9", border: "1px solid #E2D5F0", borderRadius: 14, padding: 13 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>ยอดขายเป้าหมาย (฿)</span>
            <input className="in num" type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="เช่น 50000" style={{ width: 160, border: "1.5px solid var(--line-2)", borderRadius: 10, padding: "9px 11px" }} />
            <button className="btn" style={{ background: "linear-gradient(135deg,#7E57C2,#5E35B1)", color: "#fff", borderColor: "transparent" }} onClick={runSim}>คำนวณสต๊อกคงเหลือจำลอง</button>
            <span className="count">กระจายยอดตามน้ำหนักมูลค่าขายปลีก แล้วหักจากสต๊อก</span>
          </div>
          {sim && (<>
            <div className="kpis" style={{ marginTop: 14 }}>
              <div className="kpi" style={{ borderLeft: "4px solid #7E57C2" }}><div className="kv num" style={{ color: "var(--green)" }}>{nf(sim.totals.simSoldAmt)}</div><div className="kk">ยอดขายจำลองรวม ฿</div></div>
              <div className="kpi" style={{ borderLeft: "4px solid #7E57C2" }}><div className="kv num">{nf(sim.totals.simSoldQty)}</div><div className="kk">ชิ้นที่ขายจำลอง</div></div>
              <div className="kpi" style={{ borderLeft: "4px solid #7E57C2" }}><div className="kv num">{nf(sim.totals.remainCost)}</div><div className="kk">สต๊อก KLH คงเหลือ (ทุน ฿)</div></div>
              <div className="kpi" style={{ borderLeft: "4px solid #7E57C2" }}><div className="kv num">{nf(sim.totals.remainQty)}</div><div className="kk">ชิ้นคงเหลือ KLH</div></div>
            </div>
            {sim.totals.unmatched > 0.5 && <div className="note" style={{ marginTop: 12 }}>⚠️ สต๊อกไม่พอจำลองขายได้ครบเป้า — ขายจำลองได้ไม่หมด ฿{nf(sim.totals.unmatched)}</div>}
            <div className="tbl" style={{ marginTop: 12 }}><div className="scroll"><table>
              <thead><tr><th>บาร์โค้ด</th><th>สินค้า</th><th className="r">เริ่มมี</th><th className="r">ขายจำลอง</th><th className="r">ยอดขายจำลอง</th><th className="r">คงเหลือ</th><th className="r">มูลค่าคงเหลือ</th></tr></thead>
              <tbody>{sim.items.map((r) => <tr key={r.barcode}><td><span className="code">{r.barcode}</span></td><td className="name">{r.name}</td><td className="r num">{nf(r.onHand)}</td><td className="r num">{nf(r.simSoldQty)}</td><td className="r num">฿{nf(r.simSoldAmt)}</td><td className="r num">{nf(r.remainQty)}</td><td className="r num">฿{nf(r.remainCost)}</td></tr>)}</tbody>
            </table></div></div>
          </>)}
        </>)}
      </div>
      {toast}
    </Win>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<StockMonth />);
