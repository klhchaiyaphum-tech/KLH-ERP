/* ============================================================
   survey-detail.jsx — ProductForm: sections rendered inline
     2 ข้อมูลพื้นฐาน · 🪙 ต้นทุน&ราคาขาย · 3 รูปภาพ&บาร์โค้ด
   + cost-calc popup (full) · photo-studio popup
   exports window.ProductForm
   ============================================================ */
const { useState: dS } = React;
const SV = window.SURVEY;

/* ---------- ▲▼ 0.25 stepper ---------- */
function Adj({ value, onChange, snap025, readonly, accent }) {
  return (
    <div className="adj">
      <div className={"adj-val num" + (readonly ? " ro" : "") + (accent ? " ac" : "")}>{value === "" || value == null ? "" : Number(value).toFixed(2)}</div>
      <div className="adj-btns">
        <button onClick={() => !readonly && onChange(snap025(value, +1))} disabled={readonly}>▲</button>
        <button onClick={() => !readonly && onChange(snap025(value, -1))} disabled={readonly}>▼</button>
      </div>
    </div>
  );
}

/* ---------- native-style select with ⚙️ ---------- */
function Sel({ label, col, value, options, onChange, ic, onGear, gearColor, placeholder, after }) {
  return (
    <div className="ffield">
      <label>{label} {col && <span className="col">({col})</span>}</label>
      <div className="sel-row">
        <div className="sel-wrap">
          <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <span className="sel-cv">{ic.chevR}</span>
        </div>
        {after}
        {onGear && <button className="mini-btn" style={{ background: gearColor || "#A78BFA" }} onClick={onGear}>{ic.gear}</button>}
      </div>
    </div>
  );
}

/* ========== COST CALC POPUP (full — matches real impl) ========== */
function CostPopup({ d, ic, baht, onClose, onApply }) {
  const [mode, setMode] = dS("perPiece");   // คีย์ราคาต่อ 1 ชิ้น
  const [vatMode, setVatMode] = dS("exclude"); // ยกเว้น VAT / รวม VAT
  const [rawCost, setRawCost] = dS(d.buyPrice || "");  // ทุนดิบ/ไม่รวมภาษี (I)
  const [billCost, setBillCost] = dS("");    // หรือทุนรวมภาษีแล้ว
  const [cash, setCash] = dS(0);   // H ลดเงินสด
  const [discP, setDiscP] = dS(0); // J ลด%
  const [buyQ, setBuyQ] = dS(100); // L ซื้อ
  const [freeQ, setFreeQ] = dS(0); // M แถม
  const [freight, setFreight] = dS(0); // O ค่าขนส่ง
  const [wPct, setWPct] = dS(d.wholePct ?? 8);
  const [rPct, setRPct] = dS(d.retailPct ?? 12);

  const I = parseFloat(rawCost) || 0;
  const K = I * (parseFloat(discP) || 0) / 100;                 // ลด%
  const N = (parseInt(freeQ) || 0) > 0 ? I * (parseInt(freeQ)) / ((parseInt(buyQ) || 1) + parseInt(freeQ)) : 0; // มูลค่าแถม
  const Q = vatMode === "include" ? I * 0.07 : 0;              // ภาษี
  const R = Math.max(0, (I - (parseFloat(cash) || 0) - K - N) + Q + (parseFloat(freight) || 0));

  return (
    <div className="pop" onClick={onClose}>
      <div className="pop-card" onClick={(e) => e.stopPropagation()}>
        <div className="pop-head"><b>📟 คำนวณต้นทุน/ชิ้น</b><button className="sc-btn dark" onClick={onClose}>{ic.x}</button></div>
        <div className="pop-body">
          <div className="ffield">
            <label className="blue">รูปแบบการคีย์ราคา:</label>
            <div className="sel-wrap red"><select value={mode} onChange={(e) => setMode(e.target.value)}><option value="perPiece">คีย์ราคาต่อ 1 ชิ้น</option><option value="perBig">คีย์ราคาต่อหน่วยใหญ่</option></select><span className="sel-cv">{ic.chevR}</span></div>
          </div>
          <div className="ffield">
            <label className="blue">การคำนวณภาษี:</label>
            <div className="sel-wrap blue"><select value={vatMode} onChange={(e) => setVatMode(e.target.value)}><option value="exclude">ยกเว้น VAT (0%)</option><option value="include">รวม VAT (7%)</option></select><span className="sel-cv">{ic.chevR}</span></div>
          </div>
          <div className="cost-box">
            <div className="row2">
              <div className="ffield mb0"><label className="blue">ทุนดิบ / ไม่รวมภาษี</label><input className="inp num" inputMode="decimal" value={rawCost} onChange={(e) => setRawCost(e.target.value)} /></div>
              <div className="ffield mb0"><label>หรือ ทุนรวมภาษีแล้ว</label><input className="inp num" inputMode="decimal" value={billCost} onChange={(e) => setBillCost(e.target.value)} placeholder="ราคาบิล" /></div>
            </div>
          </div>
          <div className="row2">
            <div className="ffield"><label>ลดเงินสด/หน่วย (H)</label><input className="inp num" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} /></div>
            <div className="ffield"><label>ลด % / หน่วย (J)</label><input className="inp num" inputMode="decimal" value={discP} onChange={(e) => setDiscP(e.target.value)} /></div>
          </div>
          <div className="row3">
            <div className="ffield"><label>ซื้อ (L)</label><input className="inp num" inputMode="numeric" value={buyQ} onChange={(e) => setBuyQ(e.target.value)} /></div>
            <div className="ffield"><label>แถม (M)</label><input className="inp num" inputMode="numeric" value={freeQ} onChange={(e) => setFreeQ(e.target.value)} /></div>
            <div className="ffield"><label>มูลค่าแถม (N)</label><input className="inp num ro" value={N ? N.toFixed(2) : ""} readOnly /></div>
          </div>
          <div className="row2">
            <div className="ffield"><label>ภาษี 7% (Q)</label><input className="inp num ro" value={Q.toFixed(2)} readOnly /></div>
            <div className="ffield"><label>ค่าขนส่ง/หน่วย (O)</label><input className="inp num" inputMode="decimal" value={freight} onChange={(e) => setFreight(e.target.value)} /></div>
          </div>
          <div className="dash" />
          <div className="row2 peach">
            <div className="ffield mb0"><label className="coral">% กำไรส่ง (S)</label><div className="pct"><input className="inp num" inputMode="decimal" value={wPct} onChange={(e) => setWPct(e.target.value)} /><span>%</span></div></div>
            <div className="ffield mb0"><label className="coral">% กำไรปลีก (T)</label><div className="pct"><input className="inp num" inputMode="decimal" value={rPct} onChange={(e) => setRPct(e.target.value)} /><span>%</span></div></div>
          </div>
          <div className="cost-out"><span>สรุปต้นทุนสุทธิ/ชิ้น (R)</span><b className="num">{baht(R)}</b></div>
        </div>
        <div className="pop-foot one">
          <button className="btn ok" onClick={() => onApply({ costFinal: R, wholePct: parseFloat(wPct) || 0, retailPct: parseFloat(rPct) || 0, buyPrice: I })}>{ic.checkS} ยืนยัน</button>
        </div>
      </div>
    </div>
  );
}

/* ========== PHOTO STUDIO POPUP ========== */
function PhotoStudio({ d, ic, onClose, onApply }) {
  const [stage, setStage] = dS("shot");
  const [bg, setBg] = dS(SV.bgColors[0]);
  const [center, setCenter] = dS(true);
  const run = () => { setStage("removing"); setTimeout(() => setStage("ready"), 1400); };
  return (
    <div className="pop" onClick={onClose}>
      <div className="pop-card" onClick={(e) => e.stopPropagation()}>
        <div className="pop-head"><b>📷 ถ่ายรูป + ตัดพื้นหลัง</b><button className="sc-btn dark" onClick={onClose}>{ic.x}</button></div>
        <div className="pop-body">
          <div className="studio-prev" style={{ background: stage === "ready" ? bg : "#23201C" }}>
            {stage === "shot" && <div className="st-empty">{ic.camBig}<span>ถ่ายรูปสินค้า</span></div>}
            {stage === "removing" && <div className="st-empty light"><span className="spin2" /><span>กำลังตัดพื้นหลัง…</span></div>}
            {stage === "ready" && <div className={"st-prod" + (center ? " ctr" : "")} style={{ color: bg === "#1C1A17" ? "#fff" : "#23201C" }}>📦</div>}
            {stage === "ready" && <span className="st-badge">1024×1024 · ตัดพื้นหลังแล้ว</span>}
          </div>
          {stage === "shot" && <button className="btn" style={{ marginTop: 14 }} onClick={run}>{ic.camBig} ถ่ายรูป</button>}
          {stage === "ready" && (<>
            <div className="sec2"><h4>สีพื้นหลัง</h4></div>
            <div className="bg-swatches">
              {SV.bgColors.map((c) => <button key={c} className={"sw" + (c === bg ? " on" : "")} style={{ background: c }} onClick={() => setBg(c)}>{c === bg && <span style={{ color: c === "#1C1A17" ? "#fff" : "#23201C" }}>{ic.checkS}</span>}</button>)}
            </div>
            <div className="opt-row">
              <button className={"chiptog" + (center ? " on" : "")} onClick={() => setCenter((v) => !v)}>{ic.checkS} จัดภาพกึ่งกลาง</button>
              <button className="chiptog" onClick={run}>{ic.refresh} ถ่ายใหม่</button>
            </div>
          </>)}
        </div>
        <div className="pop-foot">
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn" disabled={stage !== "ready"} onClick={() => onApply(bg)}>{ic.checkS} ใช้รูปนี้</button>
        </div>
      </div>
    </div>
  );
}

/* ========== PRODUCT FORM (sections 2 / cost / 3) ========== */
function ProductForm({ app, d, ic, baht, supName, snap025 }) {
  const set = app.setField;
  const [pop, setPop] = dS(null);

  const R = parseFloat(d.costFinal) || 0;
  const wholeCalc = d.packMult && R ? d.packMult * R * (1 + (d.wholePct || 0) / 100) : null;
  const retailCalc = R ? R * (1 + (d.retailPct || 0) / 100) : null;
  const canSave = (d.barcode || "").trim().length > 0;

  return (
    <>
      {/* ===== SECTION 2 — ข้อมูลพื้นฐาน ===== */}
      <div className="card sec-card blue-edge">
        <div className="sec-h">
          <span className="sec-chip blue"><span className="g">{ic.clipboard}</span><i className="sn">2</i></span><h3>ข้อมูลพื้นฐาน</h3>
          {!app.isNew && <span className="edit-tag">แก้ไขแถว {Math.floor(Math.random() * 8) + 2}</span>}
          {app.isNew && <span className="edit-tag new">สินค้าใหม่</span>}
        </div>

        <div className="row2">
          <div className="ffield"><label>รหัสกลุ่ม <span className="col">(AE)</span></label><input className="inp" value={d.groupCode} onChange={(e) => set({ groupCode: e.target.value })} placeholder="รวบสินค้าทดแทน" /></div>
          <Sel label="นิติบุคคล" col="AD" value={d.entity} options={SV.entities} onChange={(v) => set({ entity: v })} ic={ic} onGear={() => app.toast("จัดการนิติบุคคล (manageListData)")} gearColor="#A78BFA" placeholder="เลือกกิจการ" />
        </div>
        <div className="row2">
          <div className="ffield"><label>ชื่อสินค้า <span className="col">(B)</span></label><input className="inp" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="ชื่อสินค้า" /></div>
          <div className="ffield"><label>ขนาด <span className="col">(D)</span></label><input className="inp" value={d.size} onChange={(e) => set({ size: e.target.value })} placeholder="เช่น 1 กก." /></div>
        </div>
        <div className="row2">
          <Sel label="หมวด" col="C" value={d.cat} options={SV.cats} onChange={(v) => set({ cat: v })} ic={ic} onGear={() => app.toast("เพิ่ม/แก้หมวด")} gearColor="#F0B23E" placeholder="เลือกหมวด" />
          <Sel label="ผู้จำหน่าย" col="G" value={supName(d.supplier)} options={SV.suppliers.map((s) => s.name)} onChange={(v) => set({ supplier: (SV.suppliers.find((s) => s.name === v) || {}).code })} ic={ic} placeholder="เลือกผู้จำหน่าย"
            after={<><button className="mini-btn" style={{ background: "#5B86E5" }} onClick={() => app.toast("คัดลอกผู้จำหน่าย")}>{ic.copy}</button><button className="mini-btn" style={{ background: "#F4701E" }} onClick={() => app.toast("แก้ไขผู้จำหน่าย")}>{ic.edit}</button></>} />
        </div>
        <div className="row2">
          <Sel label="หน่วยบรรจุ" col="F" value={d.packUnit} options={SV.units} onChange={(v) => set({ packUnit: v })} ic={ic} onGear={() => app.toast("เพิ่ม/แก้หน่วย")} gearColor="#5BC88A" placeholder="เลือกหน่วย" />
          <div className="ffield"><label>ตัวคูณ <span className="col">(E)</span></label><input className="inp num" inputMode="numeric" value={d.packMult} onChange={(e) => set({ packMult: parseInt(e.target.value) || 0 })} /></div>
        </div>
      </div>

      {/* ===== ต้นทุน & ราคาขาย ===== */}
      <div className="card sec-card peach-bg">
        <div className="sec-h"><span className="sec-chip gold"><span className="g">{ic.tag}</span></span><h3>ต้นทุน &amp; ราคาขาย</h3></div>
        <div className="ffield"><label>ต้นทุนสุทธิ/ชิ้น <span className="col">(R)</span></label>
          <div className="cost-row">
            <div className="cost-val num">{d.costFinal === "" || d.costFinal == null ? "—" : Number(d.costFinal).toFixed(2)}</div>
            <button className="calc-btn" onClick={() => setPop("cost")}>{ic.calc} คำนวณ</button>
          </div>
        </div>
        <div className="price-grid">
          <div className="pg-cell"><div className="pg-l">ขายส่งเก่า <span className="col">(U)</span></div><Adj value={d.wholeOld} onChange={(v) => set({ wholeOld: v })} snap025={snap025} /></div>
          <div className="pg-cell"><div className="pg-l">ส่ง×หน่วยใหญ่ <span className="col">(V)</span> <i>×{d.packMult || 1} ({(d.wholePct || 0).toFixed(1)}%)</i></div><Adj value={wholeCalc} readonly snap025={snap025} accent /></div>
          <div className="pg-cell"><div className="pg-l">ขายปลีกเก่า <span className="col">(W)</span></div><Adj value={d.retailOld} onChange={(v) => set({ retailOld: v })} snap025={snap025} /></div>
          <div className="pg-cell"><div className="pg-l">ปลีกคำนวณ <span className="col">(X)</span> <i>({(d.retailPct || 0).toFixed(1)}%)</i></div><Adj value={retailCalc} readonly snap025={snap025} accent /></div>
        </div>
        <button className={"dozen" + (d.makeDozen ? " on" : "")} onClick={() => set({ makeDozen: !d.makeDozen })}>
          <span className="dz-box">{d.makeDozen && ic.checkS}</span>📦 สร้างหน่วยโหล (×12)
        </button>
        {d.makeDozen && (
          <div className="row2" style={{ marginTop: 11 }}>
            <div className="ffield mb0"><label>บาร์โค้ดโหล <span className="col">(AH)</span></label><input className="inp num" value={d.barcode ? "5" + d.barcode : ""} readOnly /></div>
            <div className="ffield mb0"><label>ราคาโหล <span className="col">(AI)</span></label><input className="inp num ro" value={retailCalc ? (R * (1 + (d.wholePct || 0) / 100) * 12).toFixed(2) : ""} readOnly /></div>
          </div>
        )}
      </div>

      {/* ===== SECTION 3 — รูปภาพ & บาร์โค้ด ===== */}
      <div className="card sec-card">
        <div className="sec-h"><span className="sec-chip"><span className="g">{ic.imgbc}</span><i className="sn">3</i></span><h3>รูปภาพ &amp; บาร์โค้ด</h3></div>
        {d.hasImg && <div className="ph-shot wide" style={d._bg ? { background: d._bg } : null}>📦<button className="rm" onClick={() => set({ hasImg: false, _bg: null })}>{ic.x}</button></div>}
        <div className="row2 btns">
          <button className="big-btn gray" onClick={() => setPop("photo")}>{ic.studio} {d.hasImg ? "แก้รูป" : "ถ่ายรูป"}</button>
          <button className="big-btn dark" onClick={() => app.openScan("barcode")}>{ic.scan} สแกนบาร์โค้ด</button>
        </div>
        <div className="row2">
          <div className="ffield"><label>บาร์โค้ดชิ้น <span className="col">(A)</span> <span className="req">*</span></label><input className="inp num" value={d.barcode} onChange={(e) => set({ barcode: e.target.value })} placeholder="ITEM / บาร์โค้ด" /></div>
          <div className="ffield"><label>บาร์โค้ดลัง <span className="col">(AB)</span></label><input className="inp num" value={d.barcodeBig} onChange={(e) => set({ barcodeBig: e.target.value })} placeholder="เว้น = auto -B" /></div>
        </div>
        <div className="ffield"><label>วันที่อัปเดต <span className="col">(Y)</span></label><input className="inp num" type="date" value={d.updatedAt || "2026-06-07"} onChange={(e) => set({ updatedAt: e.target.value })} /></div>

        <button className={"big-btn save" + (canSave ? "" : " off")} disabled={!canSave} onClick={() => app.save(d)}>{ic.save} บันทึกเข้าระบบ</button>
        <button className="big-btn dark2" onClick={() => app.toast("ตรวจสอบ & พิมพ์ป้ายราคา")}>{ic.print} ตรวจสอบ &amp; พิมพ์ป้าย</button>
        {!canSave && <div className="save-hint">{ic.warn} ต้องมีบาร์โค้ดชิ้น (A) ก่อนจึงบันทึกได้</div>}
      </div>

      {pop === "cost" && <CostPopup d={d} ic={ic} baht={baht} onClose={() => setPop(null)} onApply={(patch) => { set(patch); setPop(null); }} />}
      {pop === "photo" && <PhotoStudio d={d} ic={ic} onClose={() => setPop(null)} onApply={(bg) => { set({ hasImg: true, _bg: bg }); setPop(null); }} />}
    </>
  );
}

Object.assign(window, { ProductForm });
