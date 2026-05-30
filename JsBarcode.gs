// --- ระบบสั่งพิมพ์ป้ายราคา (Xprinter 80x40mm) ---
  function printLabel() {
    const name = document.getElementById('eName').value || "ไม่ระบุชื่อสินค้า";
    const barcode = document.getElementById('bcVal').value;
    const price = document.getElementById('eRetailX').value || "0.00"; // ดึงราคาปลีกคำนวณมาโชว์

    if (!barcode) {
      Swal.fire('แจ้งเตือน', 'ไม่มีรหัสบาร์โค้ด ไม่สามารถพิมพ์ได้', 'warning');
      return;
    }

    const frame = document.getElementById('printFrame');
    const doc = frame.contentWindow.document;
    
    // โครงสร้างหน้าพิมพ์ (HTML & CSS)
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
        <style>
          /* 1. กำหนดขนาดหน้ากระดาษเครื่องพิมพ์ให้เป๊ะ */
          @page { size: 80mm 40mm; margin: 0; }
          body { 
            margin: 0; padding: 0; width: 80mm; height: 40mm; 
            position: relative; font-family: sans-serif; box-sizing: border-box;
          }
          
          /* 2. พิกัดชื่อสินค้า (แก้ top, left ให้ตรงกับช่องสีขาวบนสติ๊กเกอร์ของคุณหนุ่ม) */
          .itemName { 
            position: absolute; top: 4mm; left: 4mm; 
            font-size: 14px; font-weight: bold; width: 50mm;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          
          /* 3. พิกัดบาร์โค้ด (กะให้อยู่มุมซ้ายล่าง) */
          .itemBarcode { 
            position: absolute; bottom: 3mm; left: 2mm; 
          }
          
          /* 4. พิกัดราคา (กะให้อยู่ในกรอบสีเหลือง/แดงมุมขวาล่าง) */
          .itemPrice { 
            position: absolute; bottom: 5mm; right: 4mm; 
            font-size: 24px; font-weight: bold; color: black; text-align: right;
          }
        </style>
      </head>
      <body>
        <!-- วางตัวหนังสือตามพิกัด -->
        <div class="itemName">${name}</div>
        
        <div class="itemBarcode">
          <svg id="barcode"></svg>
        </div>
        
        <div class="itemPrice">฿${price}</div>

        <script>
          // สร้างแท่งบาร์โค้ด
          JsBarcode("#barcode", "${barcode}", {
            format: "CODE128",
            width: 1.5,
            height: 35,
            displayValue: true,
            fontSize: 12,
            margin: 0
          });
          
          // สั่งพิมพ์อัตโนมัติเมื่อโหลดเสร็จ
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        <\/script>
      </body>
      </html>
    `;

    doc.open();
    doc.write(printContent);
    doc.close();
  }