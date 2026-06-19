/* ============================================================
   line-app.jsx — LIFF app shell: state + router, rendered twice
   (iOS + Android) side by side with a shared screen jumper.
   ============================================================ */
const { useState: LS, useEffect: LE } = React;

const SCREENS = {
  login: window.ScreenLogin, otp: window.ScreenOTP, chat: window.ScreenChat,
  browse: window.ScreenBrowse, cart: window.ScreenCart, fulfil: window.ScreenFulfil,
  summary: window.ScreenSummary, slip: window.ScreenSlip, status: window.ScreenStatus,
  receipt: window.ScreenReceipt,
};

const FLOW = [
  ["chat", "แชต + Rich Menu"], ["login", "เข้าสู่ระบบ"], ["otp", "OTP"],
  ["browse", "เลือกสินค้า"], ["cart", "ตะกร้า"], ["fulfil", "รับ/ส่ง"],
  ["summary", "QR ชำระ"], ["slip", "แนบสลิป"], ["status", "สถานะ"], ["receipt", "ใบรายการ"],
];

/* The actual mini-app, parameterised by platform insets */
function LiffApp({ app, insetTop, insetBottom }) {
  const Screen = SCREENS[app.screen] || SCREENS.chat;
  return (
    <div className="la">
      <Screen app={{ ...app, insetTop, insetBottom }} />
    </div>
  );
}

function LineRoot() {
  const [screen, setScreen] = LS("chat");
  const [cart, setCart] = LS({ ...window.LINEDATA.demoCart });
  const [fulfil, setFulfil] = LS("delivery");
  const [slipState, setSlipState] = LS("upload");

  const app = {
    screen, cart, fulfil, slipState,
    go: (s) => setScreen(s),
    setQty: (id, q) => setCart((c) => { const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = q; return n; }),
    setFulfil, setSlip: setSlipState,
  };

  // reset slip to upload whenever we (re)enter the pay flow start
  LE(() => { if (screen === "summary") setSlipState("upload"); }, [screen]);

  const jump = (s) => { setScreen(s); };

  return (
    <div className="page">
      <header className="pg-head">
        <div className="pg-brand">
          <div className="pg-logo"><img src="line/assets/klh-logo.png" alt="" /></div>
          <div>
            <h1>KLH บน LINE OA — สั่งสินค้า + ชำระเงิน</h1>
            <p>Rich Menu → ตะกร้า → QR PromptPay → ตรวจสลิป → ใบรายการพิมพ์ได้ · เทียบ iOS / Android</p>
          </div>
        </div>
        <div className="pg-jump">
          {FLOW.map(([s, label]) => (
            <button key={s} className={"jbtn" + (screen === s ? " on" : "")} onClick={() => jump(s)}>{label}</button>
          ))}
        </div>
      </header>

      <div className="phones">
        <div className="phone-col">
          <div className="phone-label">iOS · iPhone</div>
          <IOSDevice width={390} height={838}>
            <LiffApp app={app} insetTop={50} insetBottom={20} />
          </IOSDevice>
        </div>
        <div className="phone-col">
          <div className="phone-label">Android · Material 3</div>
          <AndroidDevice width={392} height={838}>
            <LiffApp app={app} insetTop={4} insetBottom={6} />
          </AndroidDevice>
        </div>
      </div>

      <footer className="pg-foot">
        <span><b>ระบบจริง:</b> Rich Menu เปิด LIFF · LINE Login ผูกเบอร์ · PromptPay EMVCo จาก gateway · ตรวจสลิปด้วย Slip Verify API (จับคู่ statement) · ชำระสำเร็จ → พิมพ์ Pick List หลังร้านอัตโนมัติ + ตัดสต็อก WMS</span>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<LineRoot />);
