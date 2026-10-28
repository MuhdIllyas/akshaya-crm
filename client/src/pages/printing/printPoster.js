// Builds the A4 self-service printing poster (HTML) — used for the preview and for printing.
const NAVY = '#1e3a5f';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- illustrations (inline SVG) ---------- */
const phone = (inner, screen = '#ffffff') => `
<svg viewBox="0 0 120 200" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans, Arial, sans-serif">
  <rect x="6" y="4" width="108" height="192" rx="16" fill="${NAVY}"/>
  <rect x="12" y="18" width="96" height="164" rx="7" fill="${screen}"/>
  <rect x="48" y="9" width="24" height="4" rx="2" fill="#4b6584"/>
  ${inner}
</svg>`;

// Step 1 — camera scanning the QR
const miniQr = (x, y, s) => {
  const f = (fx, fy) => `<rect x="${fx}" y="${fy}" width="${s * 3}" height="${s * 3}" fill="none" stroke="#fff" stroke-width="${s * 0.8}"/><rect x="${fx + s}" y="${fy + s}" width="${s}" height="${s}" fill="#fff"/>`;
  const dots = [[4, 0], [5, 1], [4, 2], [0, 4], [2, 4], [4, 4], [5, 5], [6, 4], [4, 6], [6, 6], [5, 3], [1, 5], [3, 5]]
    .map(([dx, dy]) => `<rect x="${x + dx * s}" y="${y + dy * s}" width="${s}" height="${s}" fill="#fff"/>`).join('');
  return f(x, y) + f(x + 4 * s, y) + f(x, y + 4 * s) + dots;
};
const stepScan = phone(`
  ${miniQr(39, 62, 6)}
  <g stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round">
    <path d="M28 60 V48 H40"/><path d="M80 48 H92 V60"/><path d="M92 112 V124 H80"/><path d="M40 124 H28 V112"/>
  </g>
  <rect x="26" y="84" width="68" height="3" rx="1.5" fill="#22c55e"/>
  <text x="60" y="152" text-anchor="middle" font-size="10" fill="#cbd5e1">Point camera</text>
  <text x="60" y="166" text-anchor="middle" font-size="10" fill="#cbd5e1">at the QR code</text>`, '#1f2937');

// Step 2 — upload PDF
const stepUpload = phone(`
  <text x="60" y="36" text-anchor="middle" font-size="10" font-weight="700" fill="${NAVY}">Choose PDF</text>
  <rect x="22" y="44" width="76" height="62" rx="8" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 3"/>
  <path d="M46 84 a12 12 0 0 1 2-23 a15 15 0 0 1 27 4 a10 10 0 0 1 -1 19 Z" fill="${NAVY}"/>
  <path d="M60 90 V70 M52 77 L60 69 L68 77" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="22" y="120" width="76" height="34" rx="6" fill="#fff" stroke="#e2e8f0" stroke-width="1.5"/>
  <rect x="28" y="125" width="18" height="24" rx="2" fill="#dc2626"/>
  <text x="37" y="141" text-anchor="middle" font-size="7" font-weight="700" fill="#fff">PDF</text>
  <rect x="51" y="129" width="30" height="5" rx="2.5" fill="#cbd5e1"/>
  <rect x="51" y="139" width="20" height="5" rx="2.5" fill="#e2e8f0"/>
  <circle cx="89" cy="137" r="6" fill="#16a34a"/>
  <path d="M86 137 l2 2.5 l4 -5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
  <text x="60" y="172" text-anchor="middle" font-size="9" fill="#64748b">PDF only</text>`);

// Step 3 — options, price, confirm
const stepConfirm = phone(`
  <rect x="20" y="28" width="38" height="16" rx="4" fill="${NAVY}"/>
  <text x="39" y="39.5" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff">B&amp;W</text>
  <rect x="62" y="28" width="38" height="16" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="1.5"/>
  <text x="81" y="39.5" text-anchor="middle" font-size="8.5" fill="#334155">Colour</text>
  <text x="20" y="62" font-size="9" fill="#475569">Copies</text>
  <rect x="62" y="51" width="38" height="16" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="1.5"/>
  <text x="69" y="62.5" font-size="10" fill="#475569">−</text><text x="81" y="62.5" text-anchor="middle" font-size="9.5" font-weight="700" fill="#0f172a">2</text><text x="90" y="62.5" font-size="10" fill="#475569">+</text>
  <text x="20" y="84" font-size="9" fill="#475569">Pages</text>
  <text x="100" y="84" text-anchor="end" font-size="9" font-weight="700" fill="#0f172a">All</text>
  <rect x="20" y="96" width="80" height="36" rx="6" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="28" y="111" font-size="8.5" fill="#64748b">Total to pay</text>
  <text x="28" y="126" font-size="14" font-weight="800" fill="${NAVY}">₹ 12.00</text>
  <rect x="20" y="142" width="80" height="22" rx="6" fill="${NAVY}"/>
  <text x="60" y="156.5" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">Confirm &amp; print</text>`);

// Step 4 — printer + pay
const stepCollect = `
<svg viewBox="0 0 170 200" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans, Arial, sans-serif">
  <rect x="45" y="20" width="70" height="40" rx="3" fill="#fff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="15" y="52" width="130" height="64" rx="12" fill="${NAVY}"/>
  <rect x="27" y="66" width="20" height="6" rx="3" fill="#22c55e"/>
  <rect x="35" y="100" width="90" height="8" rx="4" fill="#0f2742"/>
  <rect x="42" y="104" width="76" height="72" rx="3" fill="#fff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="52" y="118" width="56" height="5" rx="2.5" fill="#94a3b8"/>
  <rect x="52" y="130" width="46" height="5" rx="2.5" fill="#cbd5e1"/>
  <rect x="52" y="142" width="52" height="5" rx="2.5" fill="#cbd5e1"/>
  <rect x="52" y="154" width="36" height="5" rx="2.5" fill="#cbd5e1"/>
  <circle cx="126" cy="164" r="17" fill="#16a34a" stroke="#fff" stroke-width="3"/>
  <path d="M118 164 l6 6 l10 -12" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="30" cy="160" r="18" fill="#f59e0b" stroke="#fff" stroke-width="3"/>
  <text x="30" y="167" text-anchor="middle" font-size="20" font-weight="800" fill="#fff">₹</text>
</svg>`;

const STEPS = [
  { art: stepScan, en: 'Scan the QR code', ml: 'QR കോഡ് സ്കാൻ ചെയ്യുക', tip: 'Use your phone camera or Google Lens' },
  { art: stepUpload, en: 'Upload your PDF', ml: 'നിങ്ങളുടെ PDF അപ്‌ലോഡ് ചെയ്യുക', tip: 'From WhatsApp, email or phone files' },
  { art: stepConfirm, en: 'Choose options & confirm', ml: 'ഓപ്ഷനുകൾ തിരഞ്ഞെടുത്ത് ഉറപ്പാക്കുക', tip: 'Colour, copies, pages — price shown first' },
  { art: stepCollect, en: 'Collect & pay at counter', ml: 'കൗണ്ടറിൽ പണം നൽകി വാങ്ങുക', tip: 'Your print comes out in seconds' },
];

/**
 * @param {object} o
 * @param {string} o.qrDataUrl   PNG data URL of the QR
 * @param {string} o.centreName  e.g. "Akshaya e Centre Pukayur"
 * @param {boolean} [o.autoPrint] open the print dialog once fonts are loaded
 */
export function buildPosterHTML({ qrDataUrl, centreName, autoPrint = false }) {
  const steps = STEPS.map((s, i) => `
    <div class="step">
      <div class="art">${s.art}</div>
      <div class="txt">
        <div class="num">${i + 1}</div>
        <div class="en">${s.en}</div>
        <div class="ml">${s.ml}</div>
        <div class="tip">${s.tip}</div>
      </div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Self-Service Printing — ${esc(centreName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700;800&family=Noto+Sans+Malayalam:wght@500;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #e2e8f0; }
  body { font-family: 'Noto Sans', Arial, sans-serif; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; height: 297mm; margin: 0 auto; background: #fff; padding: 10mm; display: flex; flex-direction: column; gap: 6mm; overflow: hidden; }
  .ml { font-family: 'Noto Sans Malayalam', 'Noto Sans', sans-serif; }

  .hero { background: ${NAVY}; color: #fff; border-radius: 7mm; padding: 9mm 9mm 9mm 11mm; display: flex; align-items: center; gap: 8mm; }
  .hero .left { flex: 1; min-width: 0; }
  .brand { font-size: 10.5pt; letter-spacing: .18em; text-transform: uppercase; opacity: .75; font-weight: 700; }
  .hero h1 { font-size: 36pt; line-height: 1.02; margin: 3mm 0 3mm; font-weight: 800; }
  .hero .ml { font-size: 15pt; font-weight: 700; line-height: 1.35; }
  .hero .sub { font-size: 11.5pt; opacity: .85; margin-top: 3mm; }
  .qr { background: #fff; border-radius: 5mm; padding: 3.5mm 3.5mm 2.5mm; text-align: center; color: ${NAVY}; flex-shrink: 0; }
  .qr img { width: 64mm; height: 64mm; display: block; }
  .qr .scan { font-weight: 800; font-size: 13pt; letter-spacing: .06em; margin-top: 1mm; }
  .qr .scan-ml { font-size: 10pt; font-weight: 700; }

  .centre { text-align: center; }
  .centre .name { font-size: 22pt; font-weight: 800; color: ${NAVY}; line-height: 1.15; }
  .centre .label { font-size: 10pt; color: #64748b; letter-spacing: .14em; text-transform: uppercase; font-weight: 600; }

  .how { display: flex; align-items: baseline; gap: 4mm; border-bottom: 0.6mm solid #e2e8f0; padding-bottom: 2mm; }
  .how .t { font-size: 15pt; font-weight: 800; color: ${NAVY}; }
  .how .ml { font-size: 12pt; color: #475569; font-weight: 700; }

  .steps { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 5mm; min-height: 0; }
  .step { border: 0.5mm solid #e2e8f0; border-radius: 5mm; background: #f8fafc; display: flex; align-items: center; gap: 4mm; padding: 4mm 5mm; min-height: 0; }
  .step .art { width: 31mm; height: 100%; max-height: 52mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .step .art svg { width: 100%; height: 100%; }
  .step .txt { min-width: 0; }
  .num { width: 10mm; height: 10mm; border-radius: 50%; background: ${NAVY}; color: #fff; font-weight: 800; font-size: 14pt; display: flex; align-items: center; justify-content: center; margin-bottom: 2.5mm; }
  .step .en { font-size: 14pt; font-weight: 800; line-height: 1.15; color: #0f172a; }
  .step .ml { font-size: 10.5pt; font-weight: 700; color: ${NAVY}; margin-top: 1.5mm; line-height: 1.35; }
  .step .tip { font-size: 9pt; color: #64748b; margin-top: 2mm; line-height: 1.3; }

  .foot { display: flex; justify-content: center; flex-wrap: wrap; gap: 3mm; }
  .pill { border: 0.5mm solid #e2e8f0; border-radius: 99mm; padding: 2mm 4.5mm; font-size: 9.5pt; font-weight: 600; color: #334155; background: #fff; }
  .pill b { color: ${NAVY}; }
  .help { text-align: center; font-size: 9.5pt; color: #64748b; margin-top: -2mm; }

  @media print { html, body { background: #fff; } .page { margin: 0; } }
</style></head>
<body>
  <div class="page">
    <div class="hero">
      <div class="left">
        <div class="brand">Akshaya Sahayi</div>
        <h1>Self-Service<br>Printing</h1>
        <div class="ml">ഫോണിൽ നിന്ന് നേരിട്ട്<br>പ്രിന്റ് എടുക്കാം</div>
        <div class="sub">Skip the queue — print straight from your phone.</div>
      </div>
      <div class="qr">
        <img src="${qrDataUrl}" alt="Scan to print">
        <div class="scan">SCAN TO PRINT</div>
        <div class="scan-ml ml">സ്കാൻ ചെയ്യുക</div>
      </div>
    </div>

    <div class="centre">
      <div class="label">Available at</div>
      <div class="name">${esc(centreName)}</div>
    </div>

    <div class="how"><span class="t">How it works</span><span class="ml">ഇങ്ങനെ പ്രിന്റ് എടുക്കാം</span></div>

    <div class="steps">${steps}</div>

    <div class="foot">
      <span class="pill"><b>PDF</b> files only</span>
      <span class="pill">Price shown <b>before</b> printing</span>
      <span class="pill">Pay at the <b>counter</b></span>
    </div>
    <div class="help">Need help? Ask our staff · <span class="ml">സഹായത്തിന് ജീവനക്കാരെ സമീപിക്കുക</span></div>
  </div>
  ${autoPrint ? `<script>
    window.onload = function () {
      var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      ready.then(function () { setTimeout(function () { window.print(); }, 300); });
    };
  </script>` : ''}
</body></html>`;
}