// services/statementParser.js — reads an SBI account statement:
//   • PDF downloaded from net banking (a text PDF — not "Print to PDF", a photo or a scan)
//   • Excel (.xlsx) downloaded from net banking
// Password-protected PDF / Excel files are opened with the password the staff types in.
// The password is used in memory only — never stored, logged or sent anywhere.
// No AI. The file is refused unless the numbers add up:
//   1. every row: balance = previous balance − debit + credit
//   2. debit / credit totals and counts = the statement's own "Statement Summary"
//   3. last balance = the summary's closing balance
// Needs: npm install pdfjs-dist@4.10.38 exceljs@4.4.0 officecrypto-tool@0.0.19
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import ExcelJS from 'exceljs';
import officeCrypto from 'officecrypto-tool';

const DATE_RE = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/;
const AMOUNT_RE = /^-?[\d,]+\.\d{2}(CR|DR|Cr|Dr)?$/;
const DASH_RE = /^[-–—]$/;
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const toNum = (s) => {
  if (s === null || s === undefined) return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const t = String(s).trim();
  if (!t || DASH_RE.test(t)) return null;
  const n = Number(t.replace(/,/g, '').replace(/\s*(CR|DR)$/i, ''));
  return Number.isFinite(n) ? n : null;
};
const r2 = (n) => Math.round(n * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');
const toYMD = (s) => {
  const m = DATE_RE.exec(String(s).trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/* Classify the narration. Order matters (first match wins).
   Centres can add their own keywords later (bank_narration_patterns table). */
export const DEFAULT_TYPES = [
  { key: 'e_treasury', label: 'e-Treasury', test: /KL_ETREASURY|CYBER\s+TREASURY|ETREASURY/i },
  { key: 'ikm', label: 'IKM portal (KSmart / eDistrict)', test: /INFORMATION\s+KERALA\s+MISSI|INB\s+INFORMATION/i },
  { key: 'scert', label: 'SCERT', test: /SCERT/i },
  { key: 'money_transfer', label: 'Money transfer', test: /MONEY\s*TR|IMPS\/|NEFT|RTGS/i },
  { key: 'upi', label: 'UPI', test: /UPI\/(DR|CR)\//i },
  { key: 'charges', label: 'Bank charges', test: /CHARGES|CHRG|SMS\s+ALERT|GST\b|AMC\b/i },
  { key: 'cash', label: 'Cash', test: /CASH\s+(WDL|DEP)|ATM\s+WDL/i },
];

export const classifyNarration = (text, types = DEFAULT_TYPES) => {
  for (const t of types) {
    const re = t.test instanceof RegExp ? t.test : new RegExp(t.test, 'i');
    if (re.test(text)) return { key: t.key, label: t.label };
  }
  return { key: 'other', label: 'Other' };
};

// Unique references (UPI / IMPS numbers). The "INB ... 0094742162098" numbers repeat, so they are not used.
export const extractRef = (text) => {
  const m = /(?:UPI\/(?:CR|DR)|IMPS)\/(\d{9,})/i.exec(text) || /\bSBI[A-Z0-9]{10,}\b/.exec(text);
  return m ? (m[1] || m[0]) : null;
};

const passwordResult = (triedPassword) => ({
  ok: false,
  needsPassword: true,
  wrongPassword: triedPassword,
  errors: [triedPassword
    ? 'Wrong password — the file did not open. Check the password and try again.'
    : 'This file is password protected. Enter its password to read it.'],
  rows: [],
});

/* ======================= shared: summary / period / account ======================= */

function parseSummary(text) {
  // "Brought Forward ... Closing Balance" then a row: 38,190.49CR 15 1 22,830.90 3,000.00 18,359.59CR
  const m = /Brought\s+Forward[\s\S]{0,300}?([\d,]+\.\d{2})\s*(CR|DR)?\s+(\d+)\s+(\d+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*(CR|DR)?/i.exec(text);
  if (!m) return null;
  const sign = (v, s) => (String(s || 'CR').toUpperCase() === 'DR' ? -v : v);
  return {
    broughtForward: sign(toNum(m[1]), m[2]),
    debitCount: Number(m[3]),
    creditCount: Number(m[4]),
    totalDebits: toNum(m[5]),
    totalCredits: toNum(m[6]),
    closingBalance: sign(toNum(m[7]), m[8]),
  };
}

function parsePeriod(text) {
  const m = /Statement\s+From\s*:?\s*(\d{2}[-\/]\d{2}[-\/]\d{4})\s+to\s+(\d{2}[-\/]\d{2}[-\/]\d{4})/i.exec(text);
  return m ? { from: toYMD(m[1]), to: toYMD(m[2]) } : null;
}

function parseAccountTail(text) {
  const m = /Account\s+(?:Number|No\.?)\s*:?\s*(\d{6,})/i.exec(text);
  return m ? m[1].slice(-4) : null; // only the last 4 digits are kept
}

const detectBank = (text) => (/State\s+Bank\s+of\s+India|\bSBIN\d/i.test(text) ? 'SBI' : 'Unknown');

/* Checks the balance chain + summary and builds the rows.
   raw: [{ valueDate, postDate, a, b, balance, details, ref }]
   sides: 'unknown' (PDF — work out which of a/b is the debit) or 'debit-first' (Excel columns are named) */
function finishStatement({ bank, period, accountLast4, summary, raw, sides = 'unknown' }) {
  const errors = [];
  const opening = summary?.broughtForward ?? r2(raw[0].balance + (raw[0].a || 0) - (raw[0].b || 0));
  const chainOk = (debitFirst) => {
    let bal = opening;
    for (const r of raw) {
      const debit = (debitFirst ? r.a : r.b) || 0;
      const credit = (debitFirst ? r.b : r.a) || 0;
      if (Math.abs(r2(bal - debit + credit) - r.balance) > 0.005) return false;
      bal = r.balance;
    }
    return true;
  };
  let debitFirst = true;
  if (!chainOk(true)) {
    if (sides === 'unknown' && chainOk(false)) debitFirst = false;
    else errors.push('Balances do not add up row by row — the statement could not be read reliably.');
  }

  const rows = raw.map((r, i) => {
    const details = String(r.details || '').replace(/\s+/g, ' ').trim();
    const debit = (debitFirst ? r.a : r.b) || 0;
    const credit = (debitFirst ? r.b : r.a) || 0;
    const type = classifyNarration(details);
    const ref = r.ref && !DASH_RE.test(String(r.ref).trim()) ? String(r.ref).trim().slice(0, 60) : null;
    return {
      line_no: i + 1,
      value_date: r.valueDate,
      post_date: r.postDate,
      details,
      debit: r2(debit),
      credit: r2(credit),
      balance: r2(r.balance),
      bank_ref: extractRef(details) || ref,
      type_key: type.key,
      type_label: type.label,
    };
  });

  // cross-check with the statement summary
  const totalDebits = r2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredits = r2(rows.reduce((s, r) => s + r.credit, 0));
  const debitCount = rows.filter((r) => r.debit > 0).length;
  const creditCount = rows.filter((r) => r.credit > 0).length;
  const closing = rows[rows.length - 1].balance;
  if (summary) {
    if (Math.abs(summary.totalDebits - totalDebits) > 0.005) errors.push(`Debit total ${totalDebits} ≠ statement summary ${summary.totalDebits}`);
    if (Math.abs(summary.totalCredits - totalCredits) > 0.005) errors.push(`Credit total ${totalCredits} ≠ statement summary ${summary.totalCredits}`);
    if (summary.debitCount !== debitCount) errors.push(`Debit count ${debitCount} ≠ statement summary ${summary.debitCount}`);
    if (summary.creditCount !== creditCount) errors.push(`Credit count ${creditCount} ≠ statement summary ${summary.creditCount}`);
    if (Math.abs(summary.closingBalance - closing) > 0.005) errors.push(`Last balance ${closing} ≠ closing balance ${summary.closingBalance}`);
  } else {
    errors.push('Statement summary (Brought Forward / Total Debits) not found — only the row-by-row balance check was possible.');
  }
  const blocking = errors.filter((e) => !/only the row-by-row/.test(e));

  return {
    ok: blocking.length === 0,
    errors,
    warnings: errors.filter((e) => /only the row-by-row/.test(e)),
    bank,
    period: period || { from: rows[0].value_date, to: rows[rows.length - 1].value_date },
    accountLast4,
    summary,
    openingBalance: r2(opening),
    closingBalance: closing,
    totals: { debits: totalDebits, credits: totalCredits, debitCount, creditCount },
    rows,
  };
}

/* ======================= PDF ======================= */

async function readItems(buffer, password) {
  const data = buffer instanceof Uint8Array ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer || buffer);
  const doc = await pdfjs.getDocument({
    data, isEvalSupported: false, useSystemFonts: true, disableFontFace: true,
    ...(password ? { password } : {}),
  }).promise;
  const pages = [];
  let fullText = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5], page: p }));
    pages.push(items);
    // text in reading order (top → bottom, left → right) for the summary block
    const lines = groupLines(items);
    fullText += lines.map((l) => l.items.map((i) => i.s).join(' ')).join('\n') + '\n';
  }
  await doc.destroy();
  return { pages, fullText };
}

// items with (almost) the same y form one visual line
function groupLines(items, tol = 1.5) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tol);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  lines.forEach((l) => l.items.sort((a, b) => a.x - b.x));
  return lines.sort((a, b) => b.y - a.y);
}

/**
 * @returns {Promise<{ok:boolean, errors:string[], needsPassword?:boolean, wrongPassword?:boolean, bank:string,
 *   period, accountLast4, summary, openingBalance:number, closingBalance:number, rows:Array}>}
 */
export async function parseStatementPdf(buffer, { password } = {}) {
  let pages, fullText;
  try {
    ({ pages, fullText } = await readItems(buffer, password));
  } catch (e) {
    if (e?.name === 'PasswordException') return passwordResult(!!password);
    return { ok: false, errors: ['Could not open the PDF. Download the statement again from net banking.'], rows: [] };
  }
  if (!fullText.trim()) {
    return {
      ok: false,
      errors: ['This PDF has no text — it is a picture of the statement (made with "Print to PDF", a photo or a scan). Download the statement from net banking (PDF or Excel) and upload that file as it is.'],
      rows: [],
    };
  }

  const bank = detectBank(fullText);
  const summary = parseSummary(fullText);
  const period = parsePeriod(fullText);
  const accountLast4 = parseAccountTail(fullText);

  // ---- 1. find transaction anchor lines: first item is a date, the line ends with 3+ amount/dash cells
  const anchors = []; // { page, y, valueDate, postDate, cells:[...], amountX }
  pages.forEach((items, pi) => {
    for (const line of groupLines(items)) {
      const first = line.items[0];
      if (!first || !DATE_RE.test(first.s) || first.x > 60) continue;
      const tail = line.items.filter((i) => AMOUNT_RE.test(i.s) || DASH_RE.test(i.s));
      if (tail.length < 3) continue;
      const dates = line.items.filter((i) => DATE_RE.test(i.s));
      const last3 = tail.slice(-3);
      anchors.push({
        page: pi + 1,
        y: line.y,
        valueDate: toYMD(dates[0].s),
        postDate: toYMD((dates[1] || dates[0]).s),
        a: toNum(last3[0].s),
        b: toNum(last3[1].s),
        balance: toNum(last3[2].s),
        amountX: tail[0].x, // description ends before the first amount / ref cell
        detailsX: (dates[dates.length - 1].x || 0) + 40,
        details: [],
      });
    }
  });

  if (anchors.length === 0) {
    return { ok: false, errors: ['No transaction rows found. Is this an SBI account statement?'], bank, period, summary, rows: [] };
  }

  // ---- 2. attach description lines (SBI puts the first line just ABOVE the date row)
  const detailsMinX = Math.min(...anchors.map((a) => a.detailsX)) - 10;
  pages.forEach((items, pi) => {
    const pageAnchors = anchors.filter((a) => a.page === pi + 1); // top → bottom
    for (const line of groupLines(items)) {
      const parts = line.items.filter((i) => i.x >= detailsMinX && i.x < Math.min(...pageAnchors.map((a) => a.amountX), Infinity) - 2);
      if (parts.length === 0) continue;
      if (pageAnchors.some((a) => Math.abs(a.y - line.y) <= 1.5) && parts.every((p) => DATE_RE.test(p.s))) continue;
      const text = parts.map((p) => p.s).join(' ');
      if (/^(Balance|Details|Page no\.?)/i.test(text)) continue;
      if (/Statement\s+Summary|Brought\s+Forward|Please do not share|computer generated/i.test(text)) continue;
      if (/(Dr|Cr)\s+Count|Total\s+(Debits|Credits)|Closing\s+Balance/i.test(text)) continue; // summary table header
      if ((text.match(/[\d,]+\.\d{2}/g) || []).length >= 2 && /^[\d,.\s]+(CR|DR)?$/i.test(text)) continue; // summary values row
      const below = pageAnchors.filter((a) => a.y < line.y - 1.5).sort((a, b) => b.y - a.y)[0];
      const above = pageAnchors.filter((a) => a.y >= line.y - 1.5).sort((a, b) => a.y - b.y)[0];
      let owner = null;
      if (below && line.y - below.y <= 12 && /^(WDL|DEP|CHQ|ATM|CASH|BY|TO|NEFT|IMPS|UPI)\b/i.test(text)) owner = below; // pre-line
      else if (above && above.y - line.y <= 45) owner = above; // a row's description is at most ~4 lines
      else if (!above && pi > 0 && !below) {
        // continuation at the top of a page belongs to the last row of the previous page
        owner = anchors.filter((a) => a.page === pi).slice(-1)[0] || null;
      }
      if (!owner && below && line.y - below.y <= 12) owner = below;
      if (owner) owner.details.push({ y: line.y, page: pi + 1, text });
    }
  });

  return finishStatement({
    bank, period, accountLast4, summary,
    raw: anchors.map((r) => ({
      valueDate: r.valueDate,
      postDate: r.postDate,
      a: r.a,
      b: r.b,
      balance: r.balance,
      details: r.details.sort((x, y) => (x.page - y.page) || (y.y - x.y)).map((d) => d.text).join(' '),
    })),
  });
}

/* ======================= Excel (.xlsx) ======================= */

// a cell as plain text (dates as dd/mm/yyyy, like the PDF)
function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return cellText(v.result); // formula
    if ('text' in v) return String(v.text);       // hyperlink
    return '';
  }
  return String(v).trim();
}

// dd/mm/yyyy, dd-mm-yyyy, "01 Oct 2026", "01-Oct-26", a real date cell or an Excel date number
function cellDate(v) {
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'number' && v > 30000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const t = cellText(v);
  let m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(t);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = /^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-](\d{2}|\d{4})$/.exec(t);
  if (m && MONTHS[m[2].toLowerCase()]) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`;
  }
  return null;
}

// which column is which, from the heading row
function findColumns(cells) {
  const h = cells.map((c) => cellText(c).toLowerCase().replace(/\s+/g, ' ').trim());
  const find = (re) => h.findIndex((t) => re.test(t));
  const valueDate = find(/^value ?date$/);
  const txnDate = find(/^(txn|transaction|post(ing)?)? ?date$/);
  const col = {
    date: valueDate >= 0 ? valueDate : txnDate,
    postDate: txnDate >= 0 ? txnDate : valueDate,
    details: find(/details|description|narration|particulars|remarks/),
    ref: find(/ref|cheque|chq/),
    debit: find(/debit|withdrawal/),
    credit: find(/credit|deposit/),
    balance: find(/balance/),
  };
  return [col.date, col.details, col.debit, col.credit, col.balance].every((i) => i >= 0) ? col : null;
}

export async function parseStatementExcel(buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (e) {
    return { ok: false, errors: ['Could not open the Excel file. Download the statement again from net banking.'], rows: [] };
  }

  for (const ws of wb.worksheets) {
    // every row as an array of raw values (index 0 = column A)
    const grid = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
      grid[n - 1] = vals;
    });
    for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = [];

    const headIdx = grid.findIndex((cells) => findColumns(cells));
    if (headIdx < 0) continue;
    const col = findColumns(grid[headIdx]);

    // text above the table (account no., period) and below it (summary), like the PDF text
    const textOf = (rows) => rows.map((cells) => cells.map(cellText).filter(Boolean).join(' ')).join('\n');
    const fullText = textOf(grid);
    const raw = [];
    let endIdx = grid.length;
    for (let i = headIdx + 1; i < grid.length; i++) {
      const cells = grid[i];
      const line = cells.map(cellText).join(' ').trim();
      if (/Statement\s+Summary|Brought\s+Forward/i.test(line)) { endIdx = i; break; }
      const valueDate = cellDate(cells[col.date]);
      if (!valueDate) {
        // a wrapped description line under the row before it
        const extra = cellText(cells[col.details]);
        if (raw.length && extra && cells.filter((c) => cellText(c)).length === 1) raw[raw.length - 1].details += ` ${extra}`;
        continue;
      }
      const balance = toNum(cellText(cells[col.balance]));
      if (balance === null) continue;
      const balText = cellText(cells[col.balance]);
      raw.push({
        valueDate,
        postDate: cellDate(cells[col.postDate]) || valueDate,
        a: toNum(cellText(cells[col.debit])),
        b: toNum(cellText(cells[col.credit])),
        balance: /DR$/i.test(balText) ? -Math.abs(balance) : balance,
        details: cellText(cells[col.details]),
        ref: col.ref >= 0 ? cellText(cells[col.ref]) : null,
      });
    }
    if (!raw.length) {
      return { ok: false, errors: ['The Excel file has the statement headings but no transaction rows.'], rows: [] };
    }

    return finishStatement({
      bank: detectBank(fullText),
      period: parsePeriod(fullText),
      accountLast4: parseAccountTail(textOf(grid.slice(0, headIdx))),
      summary: parseSummary(textOf(grid.slice(endIdx))),
      raw,
      sides: 'debit-first',
    });
  }
  return { ok: false, errors: ['No statement table (Date, Details, Debit, Credit, Balance) found in the Excel file. Is this an SBI account statement?'], rows: [] };
}

/* ======================= any file ======================= */

const kindOf = (buf) => {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf[0] === 0x50 && buf[1] === 0x4b) return 'xlsx';                       // zip = .xlsx
  if (buf.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return 'ole'; // locked .xlsx, or old .xls
  return 'other';
};

/** Reads a PDF or Excel statement. `password` only when the file is locked. */
export async function parseStatementFile(buffer, { password } = {}) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const kind = kindOf(buf);
  if (kind === 'pdf') return parseStatementPdf(buf, { password });
  if (kind === 'xlsx') return parseStatementExcel(buf);
  if (kind === 'ole') {
    let locked = false;
    try { locked = officeCrypto.isEncrypted(buf); } catch { locked = false; }
    if (!locked) {
      return { ok: false, errors: ['This is an old-format .xls file. Open it in Excel and "Save As" Excel Workbook (.xlsx), or download the PDF instead.'], rows: [] };
    }
    if (!password) return passwordResult(false);
    let plain;
    try {
      plain = await officeCrypto.decrypt(buf, { password });
    } catch {
      return passwordResult(true);
    }
    if (kindOf(plain) !== 'xlsx') {
      return { ok: false, errors: ['The file opened, but it is an old-format .xls. Open it in Excel and "Save As" .xlsx, or download the PDF instead.'], rows: [] };
    }
    return parseStatementExcel(plain);
  }
  return { ok: false, errors: ['Upload the statement as PDF or Excel (.xlsx), downloaded from net banking.'], rows: [] };
}

export default parseStatementFile;