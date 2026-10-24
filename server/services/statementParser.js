// services/statementParser.js — reads an SBI account-statement PDF (text PDF, not a scan).
// No AI. Works from the text positions, not from column headings (in SBI PDFs the
// headings are not readable text), and refuses the file unless the numbers add up:
//   1. every row: balance = previous balance − debit + credit
//   2. debit / credit totals and counts = the statement's own "Statement Summary"
//   3. last balance = the summary's closing balance
// Needs: npm install pdfjs-dist@4.10.38
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const DATE_RE = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/;
const AMOUNT_RE = /^-?[\d,]+\.\d{2}(CR|DR|Cr|Dr)?$/;
const DASH_RE = /^[-–—]$/;

const toNum = (s) => {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  if (!t || DASH_RE.test(t)) return null;
  const n = Number(t.replace(/,/g, '').replace(/(CR|DR)$/i, ''));
  return Number.isFinite(n) ? n : null;
};
const r2 = (n) => Math.round(n * 100) / 100;
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

async function readItems(buffer) {
  const data = buffer instanceof Uint8Array ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer || buffer);
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true, disableFontFace: true }).promise;
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
  const m = /Account\s+Number\s*:?\s*(\d{6,})/i.exec(text);
  return m ? m[1].slice(-4) : null; // only the last 4 digits are kept
}

/**
 * @returns {Promise<{ok:boolean, errors:string[], bank:string, period, accountLast4, summary,
 *   openingBalance:number, closingBalance:number, rows:Array}>}
 */
export async function parseStatementPdf(buffer) {
  const errors = [];
  let pages, fullText;
  try {
    ({ pages, fullText } = await readItems(buffer));
  } catch (e) {
    return { ok: false, errors: ['Could not open the PDF (is it password protected or a scan?)'], rows: [] };
  }
  if (!fullText.trim()) {
    return { ok: false, errors: ['No text found in the PDF. Scanned statements cannot be read — download the statement from net banking as PDF.'], rows: [] };
  }

  const bank = /State\s+Bank\s+of\s+India|\bSBIN\d/i.test(fullText) ? 'SBI' : 'Unknown';
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

  // ---- 3. decide which of (a, b) is debit vs credit using the balance chain
  const opening = summary?.broughtForward ?? r2(anchors[0].balance + (anchors[0].a || 0) - (anchors[0].b || 0));
  const chainOk = (debitFirst) => {
    let bal = opening;
    for (const r of anchors) {
      const debit = (debitFirst ? r.a : r.b) || 0;
      const credit = (debitFirst ? r.b : r.a) || 0;
      if (Math.abs(r2(bal - debit + credit) - r.balance) > 0.005) return false;
      bal = r.balance;
    }
    return true;
  };
  let debitFirst = true;
  if (!chainOk(true)) {
    if (chainOk(false)) debitFirst = false;
    else errors.push('Balances do not add up row by row — the statement could not be read reliably.');
  }

  const rows = anchors.map((r, i) => {
    const details = r.details
      .sort((a, b) => (a.page - b.page) || (b.y - a.y))
      .map((d) => d.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const debit = (debitFirst ? r.a : r.b) || 0;
    const credit = (debitFirst ? r.b : r.a) || 0;
    const type = classifyNarration(details);
    return {
      line_no: i + 1,
      value_date: r.valueDate,
      post_date: r.postDate,
      details,
      debit: r2(debit),
      credit: r2(credit),
      balance: r2(r.balance),
      bank_ref: extractRef(details),
      type_key: type.key,
      type_label: type.label,
    };
  });

  // ---- 4. cross-check with the statement summary
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

export default parseStatementPdf;