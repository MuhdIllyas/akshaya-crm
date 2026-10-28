// routes/printAgent.js  —  mount:  app.use('/api/print-agent', printAgentRoutes)
// Talks to Print Agent v2 on the centre PCs + "Print Stations" admin page.
// Job flow: DRAFT -> (customer confirms) WAITING -> (agent claims) PRINTING -> COMPLETED | FAILED
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const router = express.Router();
router.use(express.json({ limit: '256kb' }));

const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const ONLINE_WINDOW_MS = 90_000;
const STALE_PRINTING_MIN = 15;
const uploadDir = path.join(process.cwd(), 'uploads', 'printjobs');
const norm = s => String(s || '').trim().toLowerCase().replace(/\s*\(copy \d+\)$/, '');

/* ---------- staff auth (same as other routes) ---------- */
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
// admin -> own centre, superadmin -> requested centre (or all when allowAll)
function centreFor(req, requested) {
  if (req.user?.role === 'superadmin') return requested ? Number(requested) : null;
  if (requested && Number(requested) !== Number(req.user?.centre_id)) return undefined; // forbidden
  return Number(req.user?.centre_id);
}

/* ---------- agent auth (device token) ---------- */
async function agentAuth(req, res, next) {
  try {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    if (!m) return res.status(401).json({ error: 'Missing token' });
    const { rows } = await pool.query('SELECT * FROM print_stations WHERE token_hash = $1 AND revoked_at IS NULL', [sha256(m[1])]);
    if (!rows[0]) return res.status(401).json({ error: 'Station removed or token invalid' });
    req.station = rows[0];
    next();
  } catch (e) { next(e); }
}

const attempts = new Map();
function pairLimiter(req, res, next) {
  const now = Date.now();
  const a = attempts.get(req.ip) || { n: 0, reset: now + 15 * 60_000 };
  if (now > a.reset) { a.n = 0; a.reset = now + 15 * 60_000; }
  a.n += 1;
  attempts.set(req.ip, a);
  if (a.n > 10) return res.status(429).json({ error: 'Too many attempts, try again in 15 minutes' });
  next();
}

/* =================== ADMIN / SUPERADMIN =================== */

router.post('/pairing-codes', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const centreId = centreFor(req, req.body.centre_id);
    if (!centreId) return res.status(403).json({ error: 'Select a centre' });
    await pool.query(`DELETE FROM print_pairing_codes WHERE expires_at < now() - interval '1 day'`);
    for (let i = 0; i < 5; i++) {
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const { rowCount } = await pool.query(
        `INSERT INTO print_pairing_codes (code, centre_id, created_by, expires_at)
         VALUES ($1, $2, $3, now() + interval '15 minutes') ON CONFLICT (code) DO NOTHING`,
        [code, centreId, req.user?.id ?? null],
      );
      if (rowCount) return res.json({ code, expires_in: 900 });
    }
    res.status(500).json({ error: 'Could not generate code, try again' });
  } catch (e) { next(e); }
});

router.get('/stations', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const centreId = centreFor(req, req.query.centre_id);
    if (centreId === undefined) return res.status(403).json({ error: 'Not allowed' });
    const { rows } = await pool.query(
      `SELECT s.id, s.centre_id, c.name AS centre_name, s.name, s.hostname, s.os, s.os_user, s.agent_version,
              s.printers, s.last_error, s.last_seen_at, s.created_at
         FROM print_stations s LEFT JOIN centres c ON c.id = s.centre_id
        WHERE s.revoked_at IS NULL AND ($1::int IS NULL OR s.centre_id = $1)
        ORDER BY c.name, s.name`,
      [centreId],
    );
    res.json({
      stations: rows.map(s => ({
        ...s,
        online: s.last_seen_at ? Date.now() - new Date(s.last_seen_at).getTime() < ONLINE_WINDOW_MS : false,
      })),
    });
  } catch (e) { next(e); }
});

async function stationForUser(req, res) {
  const { rows } = await pool.query('SELECT centre_id FROM print_stations WHERE id = $1 AND revoked_at IS NULL', [req.params.id]);
  const ok = rows[0] && (req.user.role === 'superadmin' || Number(rows[0].centre_id) === Number(req.user.centre_id));
  if (!ok) res.status(404).json({ error: 'Not found' });
  return ok;
}

router.patch('/stations/:id', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    if (!(await stationForUser(req, res))) return;
    await pool.query('UPDATE print_stations SET name = $1 WHERE id = $2', [String(req.body.name || '').slice(0, 80), req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/stations/:id', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    if (!(await stationForUser(req, res))) return;
    await pool.query('UPDATE print_stations SET revoked_at = now() WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ============================ AGENT ============================ */

router.post('/pair', pairLimiter, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const code = String(req.body.code || '').replace(/\D/g, '');
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM print_pairing_codes WHERE code = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
      [code],
    );
    const pc = rows[0];
    if (!pc) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Code is wrong or expired. Generate a new one in Sahayi.' }); }

    const hostname = String(req.body.hostname || 'PC').slice(0, 80);
    await client.query(
      `UPDATE print_stations SET revoked_at = now() WHERE centre_id = $1 AND hostname = $2 AND revoked_at IS NULL`,
      [pc.centre_id, hostname],
    );
    const token = crypto.randomBytes(32).toString('base64url');
    const ins = await client.query(
      `INSERT INTO print_stations (centre_id, name, hostname, os, agent_version, token_hash, printers, last_seen_at, created_by)
       VALUES ($1, $2, $2, $3, $4, $5, $6::jsonb, now(), $7) RETURNING id, name`,
      [pc.centre_id, hostname, req.body.os || null, req.body.version || null, sha256(token),
        JSON.stringify(Array.isArray(req.body.printers) ? req.body.printers : []), pc.created_by],
    );
    await client.query('UPDATE print_pairing_codes SET used_at = now(), station_id = $1 WHERE code = $2', [ins.rows[0].id, code]);
    const centre = await client.query('SELECT name FROM centres WHERE id = $1', [pc.centre_id]);
    await client.query('COMMIT');
    res.json({ token, station_id: ins.rows[0].id, station_name: ins.rows[0].name, centre_id: pc.centre_id, centre_name: centre.rows[0]?.name || null });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
});

router.post('/heartbeat', agentAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    await pool.query(
      `UPDATE print_stations
          SET last_seen_at = now(), agent_version = $2, hostname = $3, os = $4, os_user = $5, printers = $6::jsonb, last_error = $7
        WHERE id = $1`,
      [req.station.id, b.version || null, b.hostname || req.station.hostname, b.os || null, b.os_user || null,
        JSON.stringify(Array.isArray(b.printers) ? b.printers : req.station.printers || []),
        b.printer_error || b.last_error || null],
    );
    res.json({ ok: true, server_time: new Date().toISOString() });
  } catch (e) { next(e); }
});

router.post('/jobs/claim', agentAuth, async (req, res, next) => {
  const st = req.station;
  const client = await pool.connect();
  try {
    await client.query('UPDATE print_stations SET last_seen_at = now() WHERE id = $1', [st.id]);

    // stuck in PRINTING (PC crashed / unplugged) -> FAILED. Never reprinted silently.
    await client.query(
      `UPDATE print_jobs SET status = 'FAILED', error_message = 'Print agent did not confirm within ${STALE_PRINTING_MIN} minutes'
        WHERE station_id = $1 AND status = 'PRINTING' AND claimed_at < now() - interval '${STALE_PRINTING_MIN} minutes'`,
      [st.id],
    );

    const names = Array.isArray(req.body.printers) && req.body.printers.length
      ? req.body.printers : (st.printers || []).map(p => p.name);
    const have = new Set(names.map(norm));

    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT pj.id, pj.copies, pj.page_range, pj.pages, pj.color, pj.duplex, pj.paper_size, p.driver_name
         FROM print_jobs pj
         LEFT JOIN printers p ON p.id = pj.printer_id
        WHERE pj.centre_id = $1 AND pj.status = 'WAITING'
        ORDER BY coalesce(pj.confirmed_at, pj.created_at) ASC
        LIMIT 25
        FOR UPDATE OF pj SKIP LOCKED`,
      [st.centre_id],
    );
    // only jobs for printers that exist on THIS PC (centres with 2+ PCs work automatically)
    const job = rows.find(j => j.driver_name && (!have.size || have.has(norm(j.driver_name))));
    if (!job) { await client.query('COMMIT'); return res.json({ job: null }); }

    await client.query(
      `UPDATE print_jobs SET status = 'PRINTING', station_id = $2, claimed_at = now(), attempts = attempts + 1 WHERE id = $1`,
      [job.id, st.id],
    );
    await client.query('COMMIT');
    res.json({
      job: {
        id: job.id,
        printer_name: job.driver_name,
        driver_name: job.driver_name,
        file_url: `/api/print-agent/jobs/${job.id}/file`, // authenticated download, not the public /uploads URL
        copies: job.copies,
        page_range: job.page_range,
        pages: job.pages,
        color_mode: job.color ? 'color' : 'bw',
        duplex: job.duplex ? 'long' : 'simplex',
        paper_size: job.paper_size,
      },
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
});

// The PDF, only for the station that claimed the job
router.get('/jobs/:id/file', agentAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT filepath, file_deleted_at FROM print_jobs WHERE id = $1 AND station_id = $2 AND status = 'PRINTING'`,
      [req.params.id, req.station.id],
    );
    const j = rows[0];
    if (!j || j.file_deleted_at) return res.status(404).json({ error: 'File not available' });
    const full = path.resolve(process.cwd(), j.filepath || '');
    if (!full.startsWith(uploadDir + path.sep) || !fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(full).pipe(res);
  } catch (e) { next(e); }
});

router.post('/jobs/:id/status', agentAuth, async (req, res, next) => {
  try {
    const completed = req.body.status === 'completed';
    const error = completed ? null : String(req.body.error || 'Unknown error').slice(0, 1000);
    const { rows } = await pool.query(
      `UPDATE print_jobs
          SET status = $3::text, error_message = $4::text,
              printed_at = CASE WHEN $3::text = 'COMPLETED' THEN now() ELSE printed_at END
        WHERE id = $1 AND station_id = $2 AND status = 'PRINTING'
        RETURNING id`,
      [req.params.id, req.station.id, completed ? 'COMPLETED' : 'FAILED', error],
    );
    if (!rows[0]) return res.status(409).json({ error: 'Job is not printing on this station' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;