// Pure helpers for the printing module (no DB / express) — easy to unit test.
import { createRequire } from 'module';
import { PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
let pdfParseLib = null;
try { pdfParseLib = require('pdf-parse'); } catch { /* optional fallback only */ }

export const MAX_COPIES = 50;

/**
 * Real page count of a PDF. Returns 0 if it can't be read.
 * (Old code fell back to "1 page" — every unreadable PDF was billed as 1 page.)
 */
export async function countPdfPages(buffer) {
  // 1. pdf-lib: pure JS, handles object streams, ignores owner-password encryption
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
    const n = doc.getPageCount();
    if (n > 0) return n;
  } catch { /* try next */ }

  // 2. pdf-parse v1 (function) or v2 (PDFParse class) — the old unwrap broke on v2
  try {
    if (pdfParseLib) {
      const fn = typeof pdfParseLib === 'function' ? pdfParseLib
        : typeof pdfParseLib.default === 'function' ? pdfParseLib.default : null;
      if (fn) {
        const d = await fn(buffer);
        if (d?.numpages > 0) return d.numpages;
      }
      const Cls = pdfParseLib.PDFParse || pdfParseLib.default?.PDFParse;
      if (Cls) {
        const p = new Cls({ data: buffer });
        const info = await p.getInfo();
        await p.destroy?.();
        if (info?.total > 0) return info.total;
      }
    }
  } catch { /* try next */ }

  // 3. last resort: count page objects in uncompressed PDFs
  const m = buffer.toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return m ? m.length : 0;
}

export const isPdfBuffer = buf => buf.length > 4 && buf.subarray(0, 1024).includes('%PDF');

/**
 * Validates a customer page range against the real page count.
 * "1 - 3, 5" -> { count: 4, normalized: "1-3,5" }.  Throws Error with a customer-friendly message.
 */
export function parsePageRange(raw, totalPages) {
  const s = String(raw ?? '').trim();
  if (!s || /^all$/i.test(s)) return { count: totalPages, normalized: 'ALL' };

  const cleaned = s.replace(/[–—]/g, '-').replace(/\s+/g, '').replace(/;/g, ',').replace(/,+$/, '').replace(/^,+/, '');
  if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(cleaned)) {
    throw new Error('Pages must look like 1-3, 5, 8');
  }
  const pages = new Set();
  for (const part of cleaned.split(',')) {
    const [a, b = a] = part.split('-').map(Number);
    if (a < 1 || b < a) throw new Error(`"${part}" is not a valid range`);
    if (b > totalPages) {
      throw new Error(`Page ${b} doesn't exist — this PDF has ${totalPages} page${totalPages === 1 ? '' : 's'}`);
    }
    for (let i = a; i <= b; i++) pages.add(i);
  }
  const sorted = [...pages].sort((x, y) => x - y);
  if (sorted.length === totalPages) return { count: totalPages, normalized: 'ALL' };

  // compress back to ranges: 1,2,3,5 -> "1-3,5"
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    out.push(start === sorted[i] ? `${start}` : `${start}-${sorted[i]}`);
  }
  return { count: sorted.length, normalized: out.join(',') };
}

export function parseCopies(raw) {
  const n = Number(raw ?? 1);
  if (!Number.isInteger(n) || n < 1 || n > MAX_COPIES) {
    throw new Error(`Copies must be between 1 and ${MAX_COPIES}`);
  }
  return n;
}

/** Duplex is charged per physical sheet. Returns rupees rounded to 2 decimals. */
export function calculatePrice({ pages, copies, duplex, pricePerPage, duplexPrice }) {
  let total;
  if (duplex) {
    const dp = Number(duplexPrice);
    if (!(dp > 0)) throw new Error('Double-sided printing is not priced at this centre');
    total = Math.ceil(pages / 2) * dp * copies;
  } else {
    const pp = Number(pricePerPage);
    if (!(pp >= 0)) throw new Error('Pricing not configured for this selection');
    total = pages * pp * copies;
  }
  return Math.round(total * 100) / 100;
}

export const toBool = v => v === true || v === 'true' || v === 1 || v === '1';
