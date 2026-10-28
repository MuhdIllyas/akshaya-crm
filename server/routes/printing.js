// routes/printing.js  —  mounted at /api/printing
// Customer self-service printing + admin print settings.
// Changes vs previous version are marked  // FIX:  or  // NEW:
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import {
  countPdfPages, isPdfBuffer, parsePageRange, parseCopies, calculatePrice, toBool, MAX_COPIES,
} from './printingHelpers.js';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'printjobs');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  // FIX: never trust the client's extension; random, unguessable file name
  filename: (req, file, cb) => cb(null, `printjob-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.pdf`),
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  // FIX: server-side PDF check (was only checked in the browser)
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '');
    cb(ok ? null : Object.assign(new Error('Only PDF files can be printed'), { status: 400 }), ok);
  },
});

const removeFile = p => { if (p) fs.promises.unlink(p).catch(() => {}); };
const ONLINE_SQL = `last_seen_at > now() - interval '2 minutes' AND revoked_at IS NULL`;

/* ================================
   AUTH (same pattern as other routes)
================================ */
const authenticateToken = (req, res, next) => {
  const token = (req.headers.authorization || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};
const requireAdmin = (req, res, next) => {
  if (!['admin', 'superadmin'].includes(req.user?.role)) return res.status(403).json({ error: 'Admin access required' });
  next();
};
// admin -> own centre only, superadmin -> any centre
const canAccessCentre = (req, centreId) =>
  req.user?.role === 'superadmin' || Number(req.user?.centre_id) === Number(centreId);

/* ================================
   CUSTOMER SELF-SERVICE (public, from the QR page)
================================ */

// NEW: what this centre can print + prices, so the page only shows valid options
router.get('/public/centre/:centre_id', async (req, res) => {
  try {
    const centreId = Number(req.params.centre_id);
    if (!Number.isInteger(centreId)) return res.status(400).json({ error: 'Invalid centre' });

    const centre = await pool.query('SELECT id, name FROM centres WHERE id = $1', [centreId]);
    if (!centre.rows[0]) return res.status(404).json({ error: 'Centre not found' });

    const printers = await pool.query(
      `SELECT paper_sizes, supports_color, supports_duplex FROM printers WHERE centre_id = $1 AND status = 'ACTIVE'`,
      [centreId],
    );
    const prices = await pool.query(
      `SELECT paper_size, color, price_per_page, duplex_price FROM printing_prices WHERE centre_id = $1 ORDER BY paper_size, color`,
      [centreId],
    );

    const paperSizes = new Set();
    for (const p of printers.rows) {
      String(p.paper_sizes || '').split(/[,\s]+/).filter(Boolean).forEach(s => paperSizes.add(s.toUpperCase()));
    }

    let online = null;
    try {
      const st = await pool.query(`SELECT 1 FROM print_stations WHERE centre_id = $1 AND ${ONLINE_SQL} LIMIT 1`, [centreId]);
      online = st.rows.length > 0;
    } catch { /* print_stations not migrated yet */ }

    res.json({
      centre: centre.rows[0],
      available: printers.rows.length > 0,
      options: {
        paper_sizes: [...paperSizes],
        color: printers.rows.some(p => p.supports_color),
        duplex: printers.rows.some(p => p.supports_duplex),
        max_copies: MAX_COPIES,
      },
      prices: prices.rows,
      online,
    });
  } catch (error) {
    console.error('Print centre info error:', error);
    res.status(500).json({ error: 'Could not load printing options' });
  }
});

// POST /api/printing/upload  -> creates a DRAFT with the final price
router.post('/upload', (req, res, next) => {
  upload.single('document')(req, res, err => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 50 MB' : err.message;
      return res.status(err.status || 400).json({ error: msg });
    }
    next();
  });
}, async (req, res) => {
  const file = req.file;
  try {
    if (!file) return res.status(400).json({ error: 'No document uploaded' });
    const { centre_id, customer_name, phone, copies, color, paper_size, duplex, page_range } = req.body;

    const centreId = Number(centre_id);
    if (!Number.isInteger(centreId)) throw Object.assign(new Error('Invalid centre — please scan the QR code again'), { status: 400 });

    const isColor = toBool(color);
    const isDuplex = toBool(duplex);
    const paperSize = String(paper_size || 'A4').toUpperCase();
    if (!/^[A-Z0-9]{1,10}$/.test(paperSize)) throw Object.assign(new Error('Invalid paper size'), { status: 400 });

    let totalCopies;
    try { totalCopies = parseCopies(copies); } catch (e) { throw Object.assign(e, { status: 400 }); } // FIX: negative / huge copies

    // FIX: verify it really is a PDF and get the REAL page count (no silent "1 page")
    const buffer = await fs.promises.readFile(file.path);
    if (!isPdfBuffer(buffer)) throw Object.assign(new Error('This file is not a valid PDF'), { status: 400 });
    const numPages = await countPdfPages(buffer);
    if (!numPages) {
      throw Object.assign(new Error("We couldn't read this PDF (it may be password-protected or damaged). Please ask the staff for help."), { status: 400 });
    }

    // FIX: range validated against real pages ("page 50" of a 3-page PDF is rejected, not billed)
    let range;
    try { range = parsePageRange(page_range, numPages); } catch (e) { throw Object.assign(e, { status: 400 }); }

    const priceRow = await pool.query(
      `SELECT price_per_page, duplex_price FROM printing_prices WHERE centre_id = $1 AND paper_size = $2 AND color = $3 LIMIT 1`,
      [centreId, paperSize, isColor],
    );
    if (!priceRow.rows[0]) throw Object.assign(new Error('Pricing not configured for this selection'), { status: 400 });

    let totalPrice;
    try {
      totalPrice = calculatePrice({
        pages: range.count, copies: totalCopies, duplex: isDuplex,
        pricePerPage: priceRow.rows[0].price_per_page, duplexPrice: priceRow.rows[0].duplex_price,
      });
    } catch (e) { throw Object.assign(e, { status: 400 }); }

    // FIX: a colour printer can also print B&W (old query required supports_color = false for B&W),
    // FIX: duplex jobs only go to duplex printers,
    // NEW: prefer printers that are on a PC that is online right now, then B&W printers for B&W jobs.
    const printer = await pool.query(
      `SELECT p.id
         FROM printers p
        WHERE p.centre_id = $1
          AND p.status = 'ACTIVE'
          AND ($2::boolean = false OR p.supports_color = true)
          AND ($4::boolean = false OR p.supports_duplex = true)
          AND (',' || upper(replace(p.paper_sizes, ' ', '')) || ',') LIKE '%,' || $3 || ',%'
        ORDER BY
          EXISTS (
            SELECT 1 FROM print_stations s, jsonb_array_elements(s.printers) e
             WHERE s.centre_id = p.centre_id AND s.revoked_at IS NULL
               AND s.last_seen_at > now() - interval '2 minutes'
               AND lower(e->>'name') = lower(p.driver_name)
               AND coalesce((e->>'offline')::boolean, false) = false
          ) DESC,
          CASE WHEN $2::boolean = false AND p.supports_color = false THEN 0 ELSE 1 END,
          random()
        LIMIT 1`,
      [centreId, isColor, paperSize, isDuplex],
    );
    if (!printer.rows[0]) {
      throw Object.assign(new Error('No printer at this centre supports this selection'), { status: 400 });
    }

    const publicToken = crypto.randomUUID(); // NEW: customer must hold this to confirm / see the job
    const insert = await pool.query(
      `INSERT INTO print_jobs
         (centre_id, customer_name, phone, filename, filepath, printer_id, copies, paper_size, color, duplex,
          pages, page_range, price, status, public_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'DRAFT',$14)
       RETURNING id, status, price, pages, page_range`,
      [centreId, customer_name || null, phone || null, String(file.originalname || 'document.pdf').slice(0, 200),
        `uploads/printjobs/${file.filename}`, printer.rows[0].id, totalCopies, paperSize, isColor, isDuplex,
        range.count, range.normalized, totalPrice, publicToken],
    );
    const job = insert.rows[0];
    res.json({
      message: 'File processed',
      jobId: job.id,
      token: publicToken,
      pages: job.pages,
      totalPages: numPages,
      pageRange: job.page_range,
      totalPrice: job.price,
      status: job.status,
    });
  } catch (error) {
    removeFile(file?.path); // FIX: rejected uploads no longer pile up on disk
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Print Upload Error:', error);
    res.status(500).json({ error: 'Failed to process document' });
  }
});

// POST /api/printing/confirm  { jobId, token }   DRAFT -> WAITING
router.post('/confirm', async (req, res) => {
  try {
    const { jobId, token } = req.body;
    // FIX: needs the job's token, and only a DRAFT can be confirmed
    // (before, anyone could POST any id and re-queue already printed jobs = free reprints)
    const r = await pool.query(
      `UPDATE print_jobs SET status = 'WAITING', confirmed_at = now()
        WHERE id = $1 AND public_token = $2 AND status = 'DRAFT'
        RETURNING status`,
      [jobId, token],
    );
    if (r.rows[0]) return res.json({ success: true, status: r.rows[0].status });

    const cur = await pool.query('SELECT status FROM print_jobs WHERE id = $1 AND public_token = $2', [jobId, token]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Job not found' });
    return res.status(409).json({ error: 'This job was already sent', status: cur.rows[0].status });
  } catch (error) {
    console.error('Print Confirm Error:', error);
    res.status(500).json({ error: 'Failed to confirm job' });
  }
});

// NEW: POST /api/printing/cancel  { jobId, token }  (DRAFT only)
router.post('/cancel', async (req, res) => {
  try {
    const { jobId, token } = req.body;
    const r = await pool.query(
      `UPDATE print_jobs SET status = 'CANCELLED', file_deleted_at = now()
        WHERE id = $1 AND public_token = $2 AND status = 'DRAFT'
        RETURNING filepath`,
      [jobId, token],
    );
    if (r.rows[0]) removeFile(path.join(process.cwd(), r.rows[0].filepath));
    res.json({ success: true });
  } catch (error) {
    console.error('Print Cancel Error:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// GET /api/printing/status/:jobId?token=...
router.get('/status/:jobId', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, centre_id, status, pages, price, error_message, created_at, confirmed_at
         FROM print_jobs WHERE id = $1 AND public_token = $2`,
      [req.params.jobId, req.query.token],
    );
    const job = r.rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });

    let queueAhead = 0;
    if (job.status === 'WAITING') {
      const q = await pool.query(
        `SELECT count(*)::int AS n FROM print_jobs
          WHERE centre_id = $1 AND status IN ('WAITING','PRINTING')
            AND coalesce(confirmed_at, created_at) < coalesce($2, $3)`,
        [job.centre_id, job.confirmed_at, job.created_at],
      );
      queueAhead = q.rows[0].n;
    }
    res.json({
      status: job.status,
      pages: job.pages,
      price: job.price,
      queueAhead,
      // printer details stay internal; customers get a short reason
      message: job.status === 'FAILED' ? 'The printer could not print this job. Please show this screen to the staff.' : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

/* ================================
   LEGACY WORKER ENDPOINTS (old queue-service.js)
   Kept only until every centre runs Print Agent v2 (/api/print-agent).
================================ */

// FIX: if the centre already has a v2 agent, the old worker gets nothing -> no double printing
router.get('/pending', async (req, res) => {
  const { centre_id } = req.query;
  try {
    let hasAgent = false;
    try {
      const st = await pool.query(`SELECT 1 FROM print_stations WHERE centre_id = $1 AND revoked_at IS NULL LIMIT 1`, [centre_id]);
      hasAgent = st.rows.length > 0;
    } catch { /* not migrated */ }
    if (hasAgent) return res.json({ job: null });

    const result = await pool.query(
      `SELECT pj.id, pj.copies, pj.page_range, pj.pages, pj.filepath, p.driver_name
         FROM print_jobs pj
         LEFT JOIN printers p ON pj.printer_id = p.id
        WHERE pj.centre_id = $1 AND pj.status = 'WAITING'
        ORDER BY pj.created_at ASC
        LIMIT 1`,
      [centre_id],
    );
    if (!result.rows[0]) return res.json({ job: null });
    const job = result.rows[0];
    job.fileUrl = `${req.protocol}://${req.get('host')}/${job.filepath}`;
    delete job.filepath;
    res.json({ job });
  } catch (error) {
    console.error('Pending Queue Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/complete', async (req, res) => {
  try {
    await pool.query(
      `UPDATE print_jobs SET status = 'COMPLETED', printed_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status IN ('WAITING','PRINTING')`, // FIX: can't flip DRAFT/CANCELLED jobs
      [req.body.jobId],
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

/* ================================
   STAFF: job list + reprint  (NEW)
================================ */
router.get('/jobs', authenticateToken, async (req, res) => {
  try {
    const centreId = req.user.role === 'superadmin' ? (req.query.centre_id || null) : req.user.centre_id;
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const { rows } = await pool.query(
      `SELECT pj.id, pj.centre_id, pj.filename, pj.pages, pj.page_range, pj.copies, pj.paper_size, pj.color, pj.duplex,
              pj.price, pj.status, pj.error_message, pj.created_at, pj.printed_at, p.name AS printer_name
         FROM print_jobs pj LEFT JOIN printers p ON p.id = pj.printer_id
        WHERE ($1::int IS NULL OR pj.centre_id = $1)
          AND ($2::text IS NULL OR pj.status = $2)
          AND pj.status <> 'DRAFT'
        ORDER BY pj.created_at DESC
        LIMIT 100`,
      [centreId, status],
    );
    res.json(rows);
  } catch (error) {
    console.error('Print jobs list error:', error);
    res.status(500).json({ error: 'Failed to load print jobs' });
  }
});

router.post('/jobs/:id/reprint', authenticateToken, async (req, res) => {
  try {
    const job = await pool.query('SELECT centre_id, status, file_deleted_at FROM print_jobs WHERE id = $1', [req.params.id]);
    const j = job.rows[0];
    if (!j || !canAccessCentre(req, j.centre_id)) return res.status(404).json({ error: 'Job not found' });
    if (j.file_deleted_at) return res.status(410).json({ error: 'File was already deleted (older than 24 hours)' });
    if (!['FAILED', 'COMPLETED'].includes(j.status)) return res.status(409).json({ error: `Job is ${j.status}` });
    await pool.query(
      `UPDATE print_jobs SET status = 'WAITING', station_id = NULL, claimed_at = NULL, error_message = NULL WHERE id = $1`,
      [req.params.id],
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Reprint error:', error);
    res.status(500).json({ error: 'Failed to reprint' });
  }
});

/* ================================
   ADMIN SETTINGS  — FIX: were completely unauthenticated
================================ */
router.use('/settings', authenticateToken, requireAdmin);

router.put('/settings/prices/:centre_id', async (req, res) => {
  const { centre_id } = req.params;
  if (!canAccessCentre(req, centre_id)) return res.status(403).json({ error: 'Not allowed for this centre' });
  const { prices } = req.body;
  if (!Array.isArray(prices)) return res.status(400).json({ error: 'prices must be an array' });
  for (const p of prices) {
    if (!p.paper_size || Number(p.price_per_page) < 0 || (p.duplex_price != null && Number(p.duplex_price) < 0)) {
      return res.status(400).json({ error: 'Invalid price row' });
    }
  }

  // FIX: BEGIN/COMMIT on pool.query run on random connections = no real transaction.
  // A dedicated client makes delete+insert truly atomic.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM printing_prices WHERE centre_id = $1', [centre_id]);
    for (const p of prices) {
      await client.query(
        `INSERT INTO printing_prices (centre_id, paper_size, color, price_per_page, duplex_price) VALUES ($1,$2,$3,$4,$5)`,
        [centre_id, String(p.paper_size).toUpperCase(), toBool(p.color), p.price_per_page, p.duplex_price ?? null],
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Pricing Update Error:', error);
    res.status(500).json({ error: 'Failed to update prices' });
  } finally {
    client.release();
  }
});

router.post('/settings/printers', async (req, res) => {
  try {
    const { centre_id, name, driver_name, paper_sizes, supports_color, supports_duplex } = req.body;
    if (!canAccessCentre(req, centre_id)) return res.status(403).json({ error: 'Not allowed for this centre' });
    if (!name || !driver_name) return res.status(400).json({ error: 'Name and Windows printer are required' });
    const r = await pool.query(
      `INSERT INTO printers (centre_id, name, driver_name, paper_sizes, supports_color, supports_duplex, status)
       VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE') RETURNING *`,
      [centre_id, name, String(driver_name).trim(), String(paper_sizes || 'A4').toUpperCase(), toBool(supports_color), toBool(supports_duplex)],
    );
    res.status(201).json(r.rows[0]);
  } catch (error) {
    console.error('Add Printer Error:', error);
    res.status(500).json({ error: 'Failed to add printer' });
  }
});

router.get('/settings/:centre_id', async (req, res) => {
  try {
    const { centre_id } = req.params;
    if (!canAccessCentre(req, centre_id)) return res.status(403).json({ error: 'Not allowed for this centre' });
    const printers = await pool.query('SELECT * FROM printers WHERE centre_id = $1 ORDER BY id ASC', [centre_id]);
    const prices = await pool.query('SELECT * FROM printing_prices WHERE centre_id = $1', [centre_id]);
    res.json({ printers: printers.rows, prices: prices.rows });
  } catch (error) {
    console.error('Settings Fetch Error:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

async function loadPrinterForUser(req, res) {
  const r = await pool.query('SELECT centre_id FROM printers WHERE id = $1', [req.params.id]);
  if (!r.rows[0] || !canAccessCentre(req, r.rows[0].centre_id)) {
    res.status(404).json({ error: 'Printer not found' });
    return null;
  }
  return r.rows[0];
}

router.put('/settings/printers/:id', async (req, res) => {
  try {
    if (!(await loadPrinterForUser(req, res))) return;
    const { name, driver_name, paper_sizes, supports_color, supports_duplex, status } = req.body;
    const r = await pool.query(
      `UPDATE printers SET name = $1, driver_name = $2, paper_sizes = $3, supports_color = $4, supports_duplex = $5, status = $6
        WHERE id = $7 RETURNING *`,
      [name, String(driver_name || '').trim(), String(paper_sizes || 'A4').toUpperCase(), toBool(supports_color),
        toBool(supports_duplex), status === 'OFFLINE' ? 'OFFLINE' : 'ACTIVE', req.params.id],
    );
    res.json(r.rows[0]);
  } catch (error) {
    console.error('Edit Printer Error:', error);
    res.status(500).json({ error: 'Failed to update printer' });
  }
});

router.delete('/settings/printers/:id', async (req, res) => {
  try {
    if (!(await loadPrinterForUser(req, res))) return;
    await pool.query('DELETE FROM printers WHERE id = $1', [req.params.id]);
    res.json({ success: true, hardDeleted: true });
  } catch (error) {
    if (error.code === '23503') {
      await pool.query("UPDATE printers SET status = 'OFFLINE' WHERE id = $1", [req.params.id]);
      return res.json({ success: true, hardDeleted: false, message: 'Printer moved offline to preserve history.' });
    }
    console.error('Delete Printer Error:', error);
    res.status(500).json({ error: 'Failed to delete printer' });
  }
});

/* ================================
   NEW: CLEANUP — customer documents (Aadhaar, certificates…) are not kept forever
================================ */
async function cleanupPrintFiles() {
  try {
    await pool.query(
      `UPDATE print_jobs SET status = 'CANCELLED' WHERE status = 'DRAFT' AND created_at < now() - interval '2 hours'`,
    );
    const { rows } = await pool.query(
      `UPDATE print_jobs SET file_deleted_at = now()
        WHERE file_deleted_at IS NULL
          AND status IN ('COMPLETED','FAILED','CANCELLED')
          AND created_at < now() - interval '24 hours'
        RETURNING filepath`,
    );
    for (const r of rows) {
      const full = path.resolve(process.cwd(), r.filepath || '');
      if (full.startsWith(uploadDir)) removeFile(full);
    }
    if (rows.length) console.log(`[Print Module] Deleted ${rows.length} old print file(s)`);
  } catch (e) {
    console.error('[Print Module] Cleanup failed:', e.message);
  }
}
setInterval(cleanupPrintFiles, 30 * 60 * 1000).unref();
setTimeout(cleanupPrintFiles, 60 * 1000).unref();

export default router;
