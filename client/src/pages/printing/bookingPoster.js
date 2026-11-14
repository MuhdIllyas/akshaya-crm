// Builds the A4 online-booking poster (HTML) — used for the preview and for printing.
// Design 1 "Phone in hand": navy header with a phone showing the booking screen,
// the centre's booking QR, four steps, the centre's popular services.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ICONS = {
  scan: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M4 12h16"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  upload: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M12 11v6M9 14l3-3 3 3"/>',
  done: '<path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M9 12l2 2 4-4"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
const tick = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4"><path d="M5 12l5 5L20 7"/></svg>';

const STEPS = [
  { icon: "scan", en: "Scan the code", ml: "QR കോഡ് സ്കാൻ ചെയ്യുക" },
  { icon: "phone", en: "Register with WhatsApp OTP", ml: "WhatsApp OTP വഴി രജിസ്റ്റർ ചെയ്യുക" },
  { icon: "upload", en: "Choose a service, add documents", ml: "സേവനം തിരഞ്ഞെടുത്ത് രേഖകൾ ചേർക്കുക" },
  { icon: "done", en: "Track &amp; chat with us", ml: "അപേക്ഷയുടെ നില ഫോണിൽ അറിയാം" },
];

const TILE_COLOURS = ["#dbeafe", "#fef3c7", "#dcfce7", "#fce7f3", "#e0e7ff"];
const FALLBACK_SERVICES = ["Aadhaar", "Voter ID", "Passport", "Income certificate", "Ration card", "PAN card"];

/**
 * @param {object} o
 * @param {string} o.qrDataUrl    PNG data URL of the centre's booking QR
 * @param {string} o.centreName   e.g. "Akshaya e Centre Pukayur"
 * @param {string[]} [o.services] the centre's popular services (up to 8 shown)
 * @param {boolean} [o.autoPrint] open the print dialog once fonts are loaded
 */
export function buildBookingPosterHTML({ qrDataUrl, centreName, services = [], autoPrint = false }) {
  const list = (services.length ? services : FALLBACK_SERVICES).slice(0, 8);
  const phoneRows = list.slice(0, 5).map((name, i) =>
    `<div class="svc"><b style="background:${TILE_COLOURS[i % TILE_COLOURS.length]}"></b><span>${esc(name)}</span><u>Book</u></div>`).join("");
  const chips = list.map((name) => `<span>${esc(name)}</span>`).join("") + "<span>+ many more</span>";
  const steps = STEPS.map((s, i) => `
    <div class="step">${i < STEPS.length - 1 ? '<div class="line"></div>' : ""}
      <div class="ico">${icon(s.icon)}</div><div class="no">${i + 1}</div>
      <div class="en">${s.en}</div><div class="s ml">${s.ml}</div>
    </div>`).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Book online — ${esc(centreName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Noto+Sans+Malayalam:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #e2e8f0; }
  body { font-family: 'Plus Jakarta Sans', 'Noto Sans', Arial, sans-serif; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ml { font-family: 'Noto Sans Malayalam', 'Noto Sans', sans-serif; }
  .page { width: 210mm; height: 297mm; margin: 0 auto; background: #fff; position: relative; overflow: hidden; display: flex; flex-direction: column; }

  .top { position: relative; background: #0f2742; color: #fff; padding: 14mm 14mm 0; height: 140mm; flex-shrink: 0; overflow: hidden; }
  .blob1 { position: absolute; width: 150mm; height: 150mm; border-radius: 50%; background: #1e3a5f; right: -55mm; top: -40mm; }
  .blob2 { position: absolute; width: 70mm; height: 70mm; border-radius: 50%; background: #f59e0b; right: 18mm; bottom: -30mm; }
  .chip { position: relative; display: inline-flex; align-items: center; gap: 2mm; background: rgba(255,255,255,.1); border: 0.3mm solid rgba(255,255,255,.25); padding: 2mm 4mm; border-radius: 99mm; font-size: 9.5pt; font-weight: 600; letter-spacing: .04em; }
  .chip i { width: 2.4mm; height: 2.4mm; border-radius: 50%; background: #22c55e; display: inline-block; }
  h1 { position: relative; font-size: 42pt; line-height: .98; font-weight: 800; margin: 7mm 0 4mm; width: 112mm; letter-spacing: -.02em; }
  h1 em { font-style: normal; color: #fbbf24; }
  .mlh { position: relative; font-size: 15pt; font-weight: 700; width: 105mm; line-height: 1.4; color: #e2e8f0; }
  .sub { position: relative; font-size: 11pt; color: #94a3b8; margin-top: 4mm; width: 100mm; line-height: 1.45; }

  .phone { position: absolute; right: 16mm; top: 30mm; width: 62mm; height: 124mm; background: #0b1220; border-radius: 9mm; padding: 2.4mm; box-shadow: 0 6mm 14mm rgba(0,0,0,.35); transform: rotate(6deg); }
  .screen { width: 100%; height: 100%; background: #f8fafc; color: #0f172a; border-radius: 7mm; overflow: hidden; display: flex; flex-direction: column; }
  .sbar { background: #1e3a5f; color: #fff; padding: 6mm 4mm 4mm; }
  .sbar .s1 { font-size: 6.5pt; opacity: .7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sbar .s2 { font-size: 10pt; font-weight: 800; margin-top: 1mm; }
  .svc { margin: 2.2mm 3mm 0; background: #fff; border: 0.3mm solid #e2e8f0; border-radius: 3mm; padding: 2.4mm 3mm; display: flex; align-items: center; gap: 2.4mm; font-size: 7.5pt; font-weight: 700; }
  .svc b { width: 6mm; height: 6mm; border-radius: 1.8mm; display: inline-block; flex-shrink: 0; }
  .svc span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .svc u { text-decoration: none; font-size: 6.5pt; color: #1e3a5f; background: #e0e7ef; padding: .6mm 1.8mm; border-radius: 99mm; }
  .sbtn { margin: auto 3mm 4mm; background: #f59e0b; color: #0f172a; text-align: center; border-radius: 3mm; padding: 3mm; font-size: 8pt; font-weight: 800; }

  .mid { display: flex; gap: 8mm; padding: 0 14mm; margin-top: -24mm; position: relative; z-index: 2; align-items: flex-end; }
  .qrcard { background: #fff; border-radius: 7mm; padding: 5mm; box-shadow: 0 3mm 10mm rgba(15,39,66,.18); border: 0.4mm solid #e2e8f0; text-align: center; width: 70mm; flex-shrink: 0; }
  .qrcard img { width: 60mm; height: 60mm; display: block; margin: 0 auto; }
  .qrcard .scan { margin-top: 3mm; background: #0f2742; color: #fff; border-radius: 99mm; padding: 2.2mm 0; font-weight: 800; font-size: 12pt; letter-spacing: .08em; }
  .qrcard .scanml { font-size: 9.5pt; font-weight: 700; color: #1e3a5f; margin-top: 1.5mm; }
  .centre { flex: 1; min-width: 0; padding-bottom: 3mm; }
  .centre .k { font-size: 9pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #f59e0b; }
  .centre .v { font-size: 21pt; font-weight: 800; color: #0f2742; line-height: 1.1; margin-top: 2mm; }
  .centre .v.long { font-size: 16pt; }
  .centre .p { font-size: 10.5pt; color: #475569; margin-top: 3mm; line-height: 1.5; }

  .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; padding: 0 14mm; margin-top: 6mm; }
  .step { position: relative; }
  .ico { width: 13mm; height: 13mm; border-radius: 4mm; background: #eef2f7; display: flex; align-items: center; justify-content: center; }
  .ico svg { width: 7mm; height: 7mm; }
  .step .no { position: absolute; left: 10mm; top: -1.5mm; width: 5.5mm; height: 5.5mm; border-radius: 50%; background: #f59e0b; color: #0f172a; font-size: 8pt; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 0.6mm solid #fff; }
  .step .en { font-size: 11pt; font-weight: 800; margin-top: 3mm; line-height: 1.2; }
  .step .s { font-size: 9pt; font-weight: 600; color: #1e3a5f; margin-top: 1.5mm; line-height: 1.4; }
  .line { position: absolute; top: 6.5mm; left: 15mm; right: -3mm; border-top: 0.5mm dashed #cbd5e1; }

  .pop { padding: 0 14mm; margin: 6mm 0 4mm; }
  .pop .h { font-size: 10pt; font-weight: 800; color: #0f2742; margin-bottom: 3mm; }
  .pop .chips { display: flex; flex-wrap: wrap; gap: 2mm; }
  .pop .chips span { background: #fff7e6; border: 0.35mm solid #fcd9a0; border-radius: 99mm; padding: 1.6mm 3.6mm; font-size: 9pt; font-weight: 700; color: #7c4a03; }

  .foot { margin-top: auto; background: #f8fafc; border-top: 0.4mm solid #e2e8f0; padding: 5mm 14mm; display: flex; justify-content: space-between; align-items: center; }
  .perks { display: flex; gap: 6mm; }
  .perk { display: flex; align-items: center; gap: 2mm; font-size: 9.5pt; font-weight: 700; color: #334155; }
  .perk i { width: 4.5mm; height: 4.5mm; border-radius: 50%; background: #22c55e; display: inline-flex; align-items: center; justify-content: center; }
  .perk i svg { width: 3mm; height: 3mm; }
  .brand { font-size: 9pt; font-weight: 800; color: #94a3b8; letter-spacing: .1em; }
  @media print { html, body { background: #fff; } }
</style></head>
<body>
<div class="page">
  <div class="top">
    <div class="blob1"></div><div class="blob2"></div>
    <div class="chip"><i></i> NOW ONLINE · Akshaya Sahayi</div>
    <h1>Book services <em>from your phone</em></h1>
    <div class="mlh ml">ഓൺലൈനായി സേവനങ്ങൾ ബുക്ക് ചെയ്യാം</div>
    <div class="sub">No queue. Apply in minutes, upload your documents, and track your application anytime.</div>
    <div class="phone"><div class="screen">
      <div class="sbar"><div class="s1">${esc(centreName)}</div><div class="s2">Apply for a service</div></div>
      ${phoneRows}
      <div class="sbtn">Submit application</div>
    </div></div>
  </div>

  <div class="mid">
    <div class="qrcard">
      <img src="${qrDataUrl}" alt="Scan to book">
      <div class="scan">SCAN TO BOOK</div>
      <div class="scanml ml">സ്കാൻ ചെയ്ത് ബുക്ക് ചെയ്യൂ</div>
    </div>
    <div class="centre">
      <div class="k">Your centre</div>
      <div class="v${String(centreName).length > 26 ? " long" : ""}">${esc(centreName)}</div>
      <div class="p">Open your camera or Google Lens, point it at the code, and follow the steps.</div>
    </div>
  </div>

  <div class="steps">${steps}</div>

  <div class="pop">
    <div class="h">Popular services</div>
    <div class="chips">${chips}</div>
  </div>

  <div class="foot">
    <div class="perks">
      <span class="perk"><i>${tick}</i>No waiting in line</span>
      <span class="perk"><i>${tick}</i>Pay at the centre</span>
      <span class="perk"><i>${tick}</i>Help from our staff</span>
    </div>
    <div class="brand">AKSHAYA SAHAYI</div>
  </div>
</div>
${autoPrint ? `<script>
  window.onload = function () {
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () { setTimeout(function () { window.print(); }, 300); });
  };
</script>` : ""}
</body></html>`;
}
