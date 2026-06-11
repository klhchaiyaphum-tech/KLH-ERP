/* ============================================================
   page-ocr.jsx — Invoice OCR (สแกนบิล) redesigned, KLH theme
   3-step wizard: ① upload ② verify (split) ③ done + WMS receive
   maps: getOcrPageData · uploadInvoiceFile · lookupSupplierForOcr ·
         lookupProductsForOcr · saveInvoiceOcr · doBatchReceive · getOcrHistory
   ============================================================ */
const { useState: oS, useMemo: oMemo } = React;
const OD = window.OCR;

function OcrPage() {
  const [step, setStep] = oS(1);        // 1 upload, 2 verify, 3 done
  const [view, setView] = oS("wizard"); // wizard | history
  const [entity, setEntity] = oS("");
  const [hasFile, setHasFile] = oS(false);
  const [doc, setDoc] = oS(null);       // parsed invoice
  const [recvNo, setRecvNo] = oS("");
  const [toast, showToast] = useToast();

  const runOcr = () => {
    const p = OD.parsed;
    setDoc({
      recvNo: "RCV-260611-07", invNo: p.suggestions.invoiceNo, invDate: p.suggestions.invoiceDate, dueDate: p.suggestions.dueDate,
      supplier: p.suggestions.supplier, supplierCode: p.suggestions.supplierCode, vatType: "override",
      ocrSug: p.suggestions, ocrText: p.ocrText,
      items: p.items.map((it, i) => ({ ...it, _id: i })),
    });
    setRecvNo("RCV-260611-07"); setStep(2);
  };
  const manual = () => {
    setDoc({ recvNo: "INV-MANUAL-" + Date.now(), invNo: "", invDate: "2026-06-11", dueDate: "", supplier: "", supplierCode: "", vatType: "exclusive", ocrSug: null, ocrText: "(กรอกข้อมูลเอง)", items: [{ _id: 0, productName: "", barcode: "", qty: 1, free: 0, unit: "", unitPrice: 0 }] });
    setStep(2);
  };

  return (
    <Win title="KLH · Invoice OCR — สแกนใบกำกับภาษี">
      <div className="phead">
        <div className="pic" style={{ background: "linear-gradient(135deg,#FF7A2E,#E2502B)" }}>{ICO.scan}</div>
        <div><h1>สแกนบิล · Invoice OCR</h1><p>อัปโหลดใบกำกับ → OCR แยกข้อมูล → ตรวจสอบ → บันทึก + รับเข้าคลัง</p></div>
        <div className="actions"><button className={"btn ghost" + (view === "history" ? " primary" : "")} onClick={() => setView(view === "history" ? "wizard" : "history")}>{ICO.doc} ประวัติ</button></div>
      </div>

      {view === "wizard" && (
        <div className="steps">
          {[["1", "อัปโหลด"], ["2", "ตรวจสอบ"], ["3", "บันทึก"]].map(([n, t]) => (
            <div key={n} className={"step" + (+n === step ? " on" : +n < step ? " done" : "")}><span className="snum">{+n < step ? ICO.checkS || "✓" : n}</span> {t}</div>
          ))}
        </div>
      )}

      <div className="body">
        {view === "history" ? <HistoryView onBack={() => setView("wizard")} /> : (<>
          {step === 1 && <UploadStep entity={entity} setEntity={setEntity} hasFile={hasFile} setHasFile={setHasFile} onOcr={runOcr} onManual={manual} />}
          {step === 2 && doc && <VerifyStep doc={doc} setDoc={setDoc} entity={entity} onBack={() => setStep(1)} onSave={() => { setStep(3); showToast("บันทึกใบกำกับแล้ว"); }} />}
          {step === 3 && <DoneStep recvNo={recvNo} onNew={() => { setStep(1); setHasFile(false); setDoc(null); }} onReceive={() => showToast("รับสินค้าเข้าคลังแล้ว")} onHistory={() => setView("history")} />}
        </>)}
      </div>
      {toast}
    </Win>
  );
}

/* ---- STEP 1: upload ---- */
function UploadStep({ entity, setEntity, hasFile, setHasFile, onOcr, onManual }) {
  return (
    <div className="formwrap">
      <div className="formcard" style={{ maxWidth: 560 }}>
        <div className="fc-head" style={{ background: "var(--paper-2)", color: "var(--ink)" }}>{ICO.scan} อัปโหลดใบกำกับ</div>
        <div className="fc-body">
          <Field label="กิจการที่รับสินค้า" req full>
            <select value={entity} onChange={(e) => setEntity(e.target.value)}><option value="">— เลือกกิจการ —</option>{OD.entities.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </Field>
          <div className={"dropzone" + (hasFile ? " has" : "")} onClick={() => setHasFile(true)} style={{ marginTop: 14 }}>
            <div className="dz-ic">{hasFile ? (ICO.checkS || "✓") : ICO.scan}</div>
            {hasFile ? <div><b>invoice-แป้งสยาม-0609.jpg</b><div className="muted" style={{ fontSize: 12, marginTop: 3 }}>พร้อมอัปโหลด</div></div>
              : <div>คลิกหรือลากไฟล์มาวางที่นี่<div className="muted" style={{ fontSize: 12, marginTop: 3 }}>รองรับ JPG, PNG, PDF</div></div>}
          </div>
          <div className="la-row" style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn primary" style={{ flex: 1, padding: 12 }} disabled={!entity || !hasFile} onClick={onOcr}>{ICO.scan} OCR &amp; อัปโหลด</button>
            <button className="btn ghost" style={{ padding: 12 }} disabled={!entity} onClick={onManual}>{ICO.edit} กรอกเอง</button>
          </div>
          {!entity && <div className="note" style={{ marginTop: 12 }}>เลือกกิจการก่อนเริ่มอัปโหลด</div>}
        </div>
      </div>
    </div>
  );
}

/* ---- STEP 2: verify (split) ---- */
function VerifyStep({ doc, setDoc, entity, onBack, onSave }) {
  const [cost, setCost] = oS(null);  // row id for cost-compare modal
  const set = (patch) => setDoc({ ...doc, ...patch });
  const setItem = (id, patch) => setDoc({ ...doc, items: doc.items.map((it) => it._id === id ? { ...it, ...patch } : it) });
  const addRow = () => setDoc({ ...doc, items: [...doc.items, { _id: Date.now(), productName: "", barcode: "", qty: 1, free: 0, unit: "", unitPrice: 0 }] });
  const delRow = (id) => setDoc({ ...doc, items: doc.items.filter((it) => it._id !== id) });

  const lineSum = doc.items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
  let sub, vat, grand, note = "";
  if (doc.vatType === "override" && doc.ocrSug) { sub = doc.ocrSug.subtotal; vat = doc.ocrSug.vatAmt; grand = doc.ocrSug.totalAmt; note = "ใช้ยอดจาก OCR โดยตรง"; }
  else if (doc.vatType === "inclusive") { grand = lineSum; vat = Math.round(grand * 7 / 107 * 100) / 100; sub = grand - vat; note = "VAT รวมในราคา ÷1.07"; }
  else { sub = lineSum; vat = Math.round(sub * 0.07 * 100) / 100; grand = sub + vat; }

  return (
    <div className="ocr-split">
      {/* LEFT: image + ocr text */}
      <div className="ocr-left">
        <div className="ocr-img">
          <div className="invoice-mock">
            <div className="im-top"><b>บริษัท แป้งสยาม จำกัด</b><span>ใบกำกับภาษี / ใบส่งของ</span></div>
            <div className="im-line" style={{ width: "60%" }} /><div className="im-line" style={{ width: "40%" }} />
            <div className="im-rows">{doc.items.map((it, i) => <div key={i} className="im-r"><span>{i + 1}. {it.productName.slice(0, 18)}</span><span className="num">{it.unitPrice.toFixed(2)}</span></div>)}</div>
            <div className="im-tot"><span>ยอดสุทธิ</span><b className="num">{(doc.ocrSug ? doc.ocrSug.totalAmt : grand).toFixed(2)}</b></div>
          </div>
        </div>
        <div className="ocr-raw"><div className="ocr-raw-lbl">OCR Text (raw)</div><pre>{doc.ocrText}</pre></div>
      </div>

      {/* RIGHT: form */}
      <div className="ocr-right">
        {doc.ocrSug && (
          <div className="sug-bar">
            <div className="sug-h">{ICO.scan} OCR พบข้อมูล — แตะเพื่อใช้</div>
            <div className="sug-chips">
              {[["ผู้ขาย", doc.ocrSug.supplier], ["เลขบิล", doc.ocrSug.invoiceNo], ["วันที่", doc.ocrSug.invoiceDate], ["TAX ID", doc.ocrSug.taxId], ["ยอดสุทธิ", "฿" + doc.ocrSug.totalAmt.toLocaleString()]].map(([l, v]) => (
                <span key={l} className="sug-chip"><span className="sl">{l}</span><span className="sv">{v}</span></span>
              ))}
            </div>
          </div>
        )}

        <div className="ocr-sec">
          <h3>{ICO.doc} ข้อมูลใบกำกับ</h3>
          <div className="fgrid">
            <Field label="เลขที่รับ (RECV_NO)"><input className="in num" value={doc.recvNo} readOnly style={{ background: "var(--paper-2)", color: "var(--ink-3)" }} /></Field>
            <Field label="เลขที่ใบกำกับ"><input className="in num" value={doc.invNo} onChange={(e) => set({ invNo: e.target.value })} placeholder="เลขที่บิล" /></Field>
            <Field label="วันที่ในใบ"><input className="in num" type="date" value={doc.invDate} onChange={(e) => set({ invDate: e.target.value })} /></Field>
            <Field label="ครบกำหนดชำระ"><input className="in num" type="date" value={doc.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
            <Field label="ผู้ขาย / ซัพพลายเออร์" full>
              <div className="scan-in"><input className="in" value={doc.supplier} onChange={(e) => set({ supplier: e.target.value })} placeholder="ชื่อร้านค้า / บริษัท" /><button className="scanbtn coral" style={{ width: 40 }}>{ICO.search}</button></div>
              {doc.supplierCode && <div className="sup-ok">{ICO.checkS} {doc.supplierCode} — จับคู่ SUPPLIER_MASTER แล้ว</div>}
            </Field>
            <Field label="กิจการ"><input className="in" value={entity} readOnly style={{ background: "var(--paper-2)", color: "var(--ink-3)" }} /></Field>
            <Field label="ประเภท VAT"><select value={doc.vatType} onChange={(e) => set({ vatType: e.target.value })}><option value="exclusive">VAT แยกนอก (+7%)</option><option value="inclusive">VAT รวมในราคา (÷1.07)</option><option value="override">ใช้ยอดจาก OCR</option></select></Field>
          </div>
        </div>

        <div className="ocr-sec">
          <h3>{ICO.doc} รายการสินค้า</h3>
          <div className="tbl"><div className="scroll">
            <table className="items-tbl">
              <thead><tr><th>#</th><th>ชื่อสินค้า (OCR)</th><th>บาร์โค้ด KLH</th><th className="r">ซื้อ</th><th className="r">แถม</th><th>หน่วย</th><th className="r">ราคา/หน่วย</th><th className="r">ทุนจริง</th><th className="r">รวม</th><th></th></tr></thead>
              <tbody>
                {doc.items.map((it, i) => {
                  const total = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
                  const realCost = (Number(it.qty) + Number(it.free)) > 0 ? total / (Number(it.qty) + Number(it.free)) : Number(it.unitPrice);
                  return (
                    <tr key={it._id}>
                      <td className="muted c">{i + 1}</td>
                      <td><input className="cellin" style={{ width: 150 }} value={it.productName} onChange={(e) => setItem(it._id, { productName: e.target.value })} placeholder="ชื่อสินค้า" /></td>
                      <td>{it.barcode ? <span className="code">{it.barcode}</span> : <button className="btn sm ghost" style={{ color: "var(--blue)", fontSize: 11 }} onClick={() => setItem(it._id, { barcode: "ITEM-NEW" })}>{ICO.search} หา</button>}</td>
                      <td className="r"><input className="cellin num" style={{ width: 48, textAlign: "right" }} type="number" value={it.qty} onChange={(e) => setItem(it._id, { qty: e.target.value })} /></td>
                      <td className="r"><input className="cellin num" style={{ width: 40, textAlign: "right" }} type="number" value={it.free} onChange={(e) => setItem(it._id, { free: e.target.value })} /></td>
                      <td><input className="cellin" style={{ width: 48 }} value={it.unit} onChange={(e) => setItem(it._id, { unit: e.target.value })} /></td>
                      <td className="r"><input className="cellin num" style={{ width: 70, textAlign: "right" }} type="number" value={it.unitPrice} onChange={(e) => setItem(it._id, { unitPrice: e.target.value })} /></td>
                      <td className="r num" style={{ color: Number(it.free) > 0 ? "var(--purple)" : "var(--red)", fontWeight: 600 }} title={Number(it.free) > 0 ? "ซื้อ " + it.qty + " + แถม " + it.free : ""}>{realCost > 0 ? realCost.toFixed(2) : "—"}</td>
                      <td className="r num" style={{ fontWeight: 600 }}>{total.toFixed(2)}</td>
                      <td className="c"><button className="lnk-x" onClick={() => delRow(it._id)}>{ICO.close}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div></div>
          <button className="addrow" onClick={addRow}>{ICO.plus} เพิ่มรายการ</button>
        </div>

        <div className="totbox">
          {note && <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>{note}</div>}
          <div className="tr"><span>ยอดก่อน VAT</span><span className="num">{sub.toFixed(2)}</span></div>
          <div className="tr"><span>VAT 7%</span><span className="num">{vat.toFixed(2)}</span></div>
          <div className="tr grand"><span>ยอดรวมสุทธิ</span><span className="num">{grand.toFixed(2)}</span></div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="btn ghost" onClick={onBack}>{ICO.back} กลับ</button>
          <button className="btn green" style={{ flex: 1 }} onClick={onSave}>{ICO.checkS} บันทึกใบกำกับ</button>
        </div>
      </div>
    </div>
  );
}

/* ---- STEP 3: done ---- */
function DoneStep({ recvNo, onNew, onReceive, onHistory }) {
  const [wh, setWh] = oS("");
  return (
    <div className="formwrap">
      <div className="formcard" style={{ maxWidth: 460, textAlign: "center" }}>
        <div className="fc-body" style={{ padding: "36px 24px" }}>
          <div className="done-chk">{ICO.checkS}</div>
          <h2 style={{ margin: "14px 0 6px", color: "var(--green)" }}>บันทึกสำเร็จ</h2>
          <div className="muted">เลขที่รับ: <b className="num" style={{ color: "var(--ink)" }}>{recvNo}</b></div>
          <div className="wms-box">
            <div className="wms-h">{ICO.box} รับสินค้าเข้าคลัง WMS</div>
            <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
              <div className="sel" style={{ flex: 1 }}><select value={wh} onChange={(e) => setWh(e.target.value)} style={{ width: "100%" }}><option value="">— เลือกคลัง —</option>{OD.warehouses.map((w) => <option key={w.id} value={w.id}>{w.id} — {w.name}</option>)}</select><span className="cv">{ICO.chevR}</span></div>
              <button className="btn green" disabled={!wh} onClick={onReceive}>{ICO.box} รับทันที</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "center" }}>
            <button className="btn primary" onClick={onNew}>{ICO.plus} บันทึกใหม่</button>
            <button className="btn ghost" onClick={onHistory}>{ICO.doc} ดูประวัติ</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- History ---- */
function HistoryView({ onBack }) {
  return (
    <>
      <div className="toolbar"><span className="grow" style={{ fontWeight: 600, color: "var(--ink-2)" }}>ประวัติใบกำกับล่าสุด</span><button className="btn ghost sm" onClick={onBack}>{ICO.back} กลับ</button></div>
      <div className="tbl"><div className="scroll">
        <table>
          <thead><tr><th>เลขที่รับ</th><th>เลขที่บิล</th><th>วันที่</th><th>ผู้ขาย</th><th>กิจการ</th><th className="r">ยอด</th><th className="c">สถานะ</th></tr></thead>
          <tbody>
            {OD.history.map((h) => (
              <tr key={h.recvNo}>
                <td><span className="code">{h.recvNo}</span></td>
                <td className="num muted">{h.invNo}</td>
                <td className="num muted">{h.date}</td>
                <td className="name">{h.supplier}</td>
                <td className="muted" style={{ fontSize: 12 }}>{h.entity}</td>
                <td className="r num price">{baht(h.total, 1)}</td>
                <td className="c"><span className={"pill " + (h.status === "DONE" ? "green" : "amber")}>{h.status === "DONE" ? "บันทึกแล้ว" : "รอตรวจ"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<OcrPage />);
