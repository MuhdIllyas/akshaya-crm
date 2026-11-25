import express from 'express';
import jwt from 'jsonwebtoken';
import { getTodayBalance, getDailyBalances } from "../controllers/walletDailyBalanceController.js";
import { logActivity } from "../utils/activityLogger.js";
import { UPI_SOURCES } from "../utils/upiCredit.js";
import { todayIST } from "../utils/dates.js";

const router = express.Router();

/* =====================================================================
   wallet.js — access fixes (staging test 20 Oct 2026)
   Before: any logged-in user (including staff) could
     - list every centre's wallets and balances      (GET /, GET /wallets)
     - read any wallet / its transactions / balances (GET /wallets/:id, /transactions/:id, /:id/*-balance(s))
     - edit, delete or create wallets in ANY centre  (PUT /:id, DELETE /:id, POST /create)
     - credit or debit ANY centre's wallet           (POST /transactions)
     - pay salary from ANY centre's wallet           (POST /debit-salary)
     - read every centre's audit log and staff list  (GET /audit-logs, GET /all)
   Now: everything is limited to the user's own centre (superadmin: all),
   and creating / editing / deleting wallets, salary payments and the audit
   log need admin or superadmin.
   Removed: a second GET /transactions route that could never run (the first
   one with the same path always answered).
   ===================================================================== */

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

router.use(authenticateToken);

const isSuper = (req) => req.user.role === 'superadmin';
const MANAGE_ROLES = ['admin', 'superadmin'];

const requireManager = (req, res, next) => {
  if (!MANAGE_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const httpError = (status, message) => Object.assign(new Error(message), { status });

/* UPI payment check settings (see routes/upiCredits.js).
   A wallet can read payments from several places, e.g. ['sms', 'gpay'] for an
   SBI account with an SBI QR and a GPay QR that settles in the evening.
   Accepts upi_match_sources (array) or the older upi_match_source (one value).
   Returns { sources, last4 }, keeping `current` for fields not sent;
   throws 400 for bad values. */
const readUpiSettings = (body, current = {}) => {
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  let sources;
  if (has('upi_match_sources')) sources = body.upi_match_sources;
  else if (has('upi_match_source')) sources = body.upi_match_source ? [body.upi_match_source] : [];
  else sources = current.upi_match_sources ?? [];
  if (!Array.isArray(sources)) sources = sources ? [sources] : [];
  sources = [...new Set(sources.map((v) => String(v).trim()).filter((v) => v && v !== 'none'))];
  const bad = sources.find((v) => !UPI_SOURCES.includes(v));
  if (bad) throw httpError(400, `UPI check must be one of: ${UPI_SOURCES.join(', ')}`);

  let last4 = has('upi_account_last4') ? body.upi_account_last4 : current.upi_account_last4 ?? null;
  last4 = last4 === null || last4 === undefined ? '' : String(last4).replace(/\D/g, '');
  if (last4 && last4.length !== 4) throw httpError(400, 'Account number: enter the last 4 digits');
  if (!sources.includes('sms')) last4 = ''; // only bank SMS uses the account digits
  return { sources: sources.length ? sources : null, last4: last4 || null };
};

/* Can this user touch this wallet? Superadmin: any. Others: own centre only.
   Returns the wallet row, or sends 400/403/404 and returns null. */
const loadWalletFor = async (req, res, walletIdRaw) => {
  const walletId = parseInt(walletIdRaw, 10);
  if (Number.isNaN(walletId)) {
    res.status(400).json({ error: 'Invalid wallet id' });
    return null;
  }
  const { rows } = await req.db.query('SELECT * FROM wallets WHERE id = $1', [walletId]);
  if (!rows.length) {
    res.status(404).json({ error: 'Wallet not found' });
    return null;
  }
  if (!isSuper(req) && rows[0].centre_id !== req.user.centre_id) {
    res.status(403).json({ error: 'You do not have access to this wallet' });
    return null;
  }
  return rows[0];
};

// Middleware form, for routes with :walletId
const walletAccess = async (req, res, next) => {
  try {
    const wallet = await loadWalletFor(req, res, req.params.walletId);
    if (!wallet) return;
    req.wallet = wallet;
    next();
  } catch (err) {
    console.error('Wallet access check failed:', err);
    res.status(500).json({ error: 'Failed to check wallet access' });
  }
};

/* Centre a list should be limited to: own centre, or for superadmin ?centre_id= (or all = null). */
const listCentre = (req) => {
  if (!isSuper(req)) return req.user.centre_id ?? -1; // -1 = nothing for a user without a centre
  const c = parseInt(req.query.centre_id ?? req.query.centreId, 10);
  return Number.isNaN(c) ? null : c;
};

// ========== Batch today balances (performance) ==========
router.post('/today-balances', async (req, res) => {
  const { walletIds } = req.body;
  if (!walletIds || !Array.isArray(walletIds) || walletIds.length === 0) {
    return res.status(400).json({ error: 'walletIds must be a non-empty array' });
  }
  const ids = walletIds.map((x) => parseInt(x, 10));
  if (ids.some(Number.isNaN)) {
    return res.status(400).json({ error: 'walletIds must be numbers' });
  }

  const client = await req.db.connect();
  try {
    if (!isSuper(req)) {
      const centreCheck = await client.query(
        `SELECT centre_id FROM wallets WHERE id = ANY($1::int[]) GROUP BY centre_id`,
        [ids]
      );
      if (centreCheck.rows.length !== 1) {
        return res.status(403).json({ error: 'Wallets must belong to a single centre' });
      }
      if (centreCheck.rows[0].centre_id !== req.user.centre_id) {
        return res.status(403).json({ error: 'You do not have access to these wallets' });
      }
    }

    /* Today opening = the last closed day's closing (yesterday, or the last day
         that was closed if the close was missed).
       Today closing = only once TODAY has been closed (the scheduler's close, or
         "Re-run Close"); until then it is null and the card says "Not closed yet".
       Before: both read today's snapshot row, which only exists after the close,
       so the cards showed "—" all day. Also used the DB's CURRENT_DATE, not IST. */
    const result = await client.query(
      `SELECT w.id AS wallet_id,
              COALESCE(cur.opening_balance, prev.closing_balance) AS opening_balance,
              prev.date                                            AS opening_from,
              cur.closing_balance                                  AS closing_balance,
              cur.date                                             AS closed_date,
              mv.today_in,
              mv.today_out
       FROM unnest($1::int[]) AS w(id)
       LEFT JOIN LATERAL (
         -- money in / out of this wallet since IST midnight (all entries, not just the last 100)
         SELECT COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'credit'), 0) AS today_in,
                COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'debit'),  0) AS today_out
         FROM wallet_transactions t
         WHERE t.wallet_id = w.id
           AND t.created_at >= ($2::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
       ) mv ON true
       LEFT JOIN LATERAL (
         SELECT d.closing_balance, d.date
         FROM wallet_daily_balances d
         WHERE d.wallet_id = w.id AND d.date < $2::date
         ORDER BY d.date DESC
         LIMIT 1
       ) prev ON true
       LEFT JOIN wallet_daily_balances cur
              ON cur.wallet_id = w.id AND cur.date = $2::date`,
      [ids, todayIST()]
    );

    const num = (v) => (v === null || v === undefined ? null : parseFloat(v));
    const balancesMap = {};
    result.rows.forEach(row => {
      balancesMap[row.wallet_id] = {
        date: todayIST(),
        opening_balance: num(row.opening_balance),
        opening_from: row.opening_from,
        closing_balance: num(row.closing_balance),
        closed: row.closed_date !== null,
        today_in: num(row.today_in) ?? 0,
        today_out: num(row.today_out) ?? 0,
      };
    });

    res.json(balancesMap);
  } catch (err) {
    console.error('Error fetching batch today balances:', err);
    res.status(500).json({ error: 'Failed to fetch balances' });
  } finally {
    client.release();
  }
});

// Daily balance APIs — now checked: the wallet must be in the user's centre
router.get("/:walletId/today-balance", walletAccess, getTodayBalance);
router.get("/:walletId/daily-balances", walletAccess, getDailyBalances);

// Get wallets (for ServiceEntry.jsx) — own centre only (superadmin: all, or ?centre_id=)
router.get('/', async (req, res) => {
  try {
    const centreId = listCentre(req);
    const result = await req.db.query(`
      SELECT id, name, balance, wallet_type, status, centre_id, assigned_staff_id, upi_match_sources, upi_account_last4
      FROM wallets
      WHERE ($1::int IS NULL OR centre_id = $1)
      ORDER BY name ASC
    `, [centreId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching wallets:', err);
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// Get wallets with optional pagination — own centre only (superadmin: all, or ?centre_id=)
router.get('/wallets', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 1000, 1), 1000);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  try {
    const centreId = listCentre(req);
    const result = await req.db.query(`
      SELECT w.*, c.name AS centre_name
      FROM wallets w
      LEFT JOIN centres c ON w.centre_id = c.id
      WHERE ($1::int IS NULL OR w.centre_id = $1)
      ORDER BY w.created_at DESC
      LIMIT $2 OFFSET $3
    `, [centreId, limit, offset]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching wallets:', err);
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// GET /api/wallet/my-centre-wallets
router.get('/my-centre-wallets', async (req, res) => {
  try {
    if (!req.user.centre_id && !isSuper(req)) {
      return res.status(400).json({ error: 'No centre associated with this user' });
    }
    const centreId = req.user.centre_id;
    const result = await req.db.query(`
      SELECT id, name, balance, wallet_type, status, is_shared, assigned_staff_id, upi_match_sources, upi_account_last4
      FROM wallets
      WHERE centre_id = $1
      ORDER BY name ASC
    `, [centreId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching centre wallets:', err);
    res.status(500).json({ error: 'Failed to load wallets' });
  }
});

// GET /api/wallet/centre/:centreId — superadmin only
router.get('/centre/:centreId', async (req, res) => {
  try {
    if (!isSuper(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const centreId = parseInt(req.params.centreId, 10);
    if (Number.isNaN(centreId)) return res.status(400).json({ error: 'Invalid centre id' });
    const result = await req.db.query(`
      SELECT id, name, balance, wallet_type, status
      FROM wallets
      WHERE centre_id = $1
      ORDER BY name ASC
    `, [centreId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching centre wallets:', err);
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// Create a new wallet — admin (own centre) / superadmin (any centre)
router.post('/create', requireManager, async (req, res) => {
  const { name, wallet_type, is_shared, assigned_staff_id, status, centre_id } = req.body;
  const balance = Number(req.body.balance || 0);
  const finalCentreId = isSuper(req) ? parseInt(centre_id, 10) : req.user.centre_id;

  if (!finalCentreId || Number.isNaN(finalCentreId)) {
    return res.status(400).json({ error: 'Centre ID is required' });
  }
  if (!String(name || '').trim()) {
    return res.status(400).json({ error: 'Wallet name is required' });
  }
  if (!Number.isFinite(balance) || balance < 0) {
    return res.status(400).json({ error: 'Opening balance must be 0 or more' });
  }
  let upi;
  try {
    upi = readUpiSettings(req.body);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }

  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const walletResult = await client.query(
      `INSERT INTO wallets (name, balance, wallet_type, is_shared, assigned_staff_id, status, centre_id,
                            upi_match_sources, upi_account_last4, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
      [String(name).trim(), balance, wallet_type, is_shared, assigned_staff_id || null, status, finalCentreId,
       upi.sources, upi.last4]
    );
    const wallet = walletResult.rows[0];
    if (balance > 0) {
      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, created_at)
         VALUES ($1, $2, 'credit', $3, $4, NOW())`,
        [wallet.id, assigned_staff_id || null, balance, `Initial balance for ${wallet.name}`]
      );
    }
    const centreResult = await client.query('SELECT name FROM centres WHERE id = $1', [finalCentreId]);
    const centreName = centreResult.rows[0]?.name || 'Unknown Centre';
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Wallet Created', req.user.username, `Created wallet ${wallet.name} for ${centreName}`, finalCentreId]
    );
    await client.query('COMMIT');

    // after COMMIT: a logging failure must not undo the wallet
    logActivity({
      centre_id: finalCentreId,
      related_type: 'wallet',
      related_id: wallet.id,
      action: 'Wallet Created',
      description: `Created new wallet: ${wallet.name} (${wallet_type}) with initial balance ₹${balance}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    }).catch((e) => console.error('Non-fatal: wallet activity log failed', e));

    res.status(201).json(wallet);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating wallet:', err);
    res.status(500).json({ error: 'Failed to create wallet' });
  } finally {
    client.release();
  }
});

// Update a wallet's settings — admin (own centre) / superadmin
/* PUT /api/wallet/:id/upi-settings — only the UPI payment check settings
   (upi_match_sources, upi_account_last4). For the supervisor, who keeps the
   payment check working but doesn't set up or rename wallets. Admin and
   superadmin can use it too. */
router.put('/:id/upi-settings', async (req, res) => {
  if (!['admin', 'superadmin', 'supervisor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid wallet id' });

  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const currentWallet = await client.query('SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [id]);
    if (currentWallet.rows.length === 0) throw httpError(404, 'Wallet not found');
    const current = currentWallet.rows[0];
    if (!isSuper(req) && current.centre_id !== req.user.centre_id) {
      throw httpError(403, 'You do not have access to this wallet');
    }

    const upi = readUpiSettings(req.body, current); // not sent = keep
    const result = await client.query(
      `UPDATE wallets SET upi_match_sources=$1, upi_account_last4=$2, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [upi.sources, upi.last4, id]
    );

    const changes = [];
    if ((current.upi_match_sources || []).join(', ') !== (upi.sources || []).join(', ')) {
      changes.push(`UPI check set to "${(upi.sources || []).join(', ') || 'off'}"`);
    }
    if ((upi.last4 || null) !== (current.upi_account_last4 || null)) {
      changes.push(`UPI account set to "${upi.last4 ? 'XX' + upi.last4 : 'any'}"`);
    }
    if (changes.length) {
      await client.query(
        `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        ['Wallet UPI Settings Updated', req.user.username,
         `Wallet ${current.name}: ${changes.join(', ')}`, current.centre_id]
      );
    }
    await client.query('COMMIT');

    if (changes.length) {
      logActivity({
        centre_id: current.centre_id,
        related_type: 'wallet',
        related_id: id,
        action: 'Wallet Updated',
        description: `Updated wallet: ${changes.join(', ')}`,
        performed_by: req.user.id,
        performed_by_role: req.user.role
      }).catch((e) => console.error('Non-fatal: wallet activity log failed', e));
    }

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating wallet UPI settings:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to update UPI settings' });
  } finally {
    client.release();
  }
});

// The balance is NEVER changed here, even if the request sends one.
// Edit forms used to send back the balance they loaded when opened; saving
// later wiped out every entry made in between (23 Nov 2026: SBI +₹10,000 at
// 12:55 and +₹3,877 at 13:23, with no transaction behind either).
// To correct a balance, record a transaction (POST /transactions) so it
// shows in the ledger, the bank check and the books check.
router.put('/:id', requireManager, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid wallet id' });

  const { name, wallet_type, is_shared, assigned_staff_id, status } = req.body;

  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const currentWallet = await client.query('SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [id]);
    if (currentWallet.rows.length === 0) throw httpError(404, 'Wallet not found');
    const current = currentWallet.rows[0];
    if (!isSuper(req) && current.centre_id !== req.user.centre_id) {
      throw httpError(403, 'You do not have access to this wallet');
    }

    const centreId = current.centre_id;
    const upi = readUpiSettings(req.body, current); // not sent = keep
    // balance is deliberately not in this UPDATE (see note above the route)
    const result = await client.query(
      `UPDATE wallets SET name=$1, wallet_type=$2, is_shared=$3, assigned_staff_id=$4, status=$5,
              upi_match_sources=$7, upi_account_last4=$8, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [name, wallet_type, is_shared, assigned_staff_id || null, status, id, upi.sources, upi.last4]
    );
    const centreResult = await client.query('SELECT name FROM centres WHERE id = $1', [centreId]);
    const centreName = centreResult.rows[0]?.name || 'Unknown Centre';

    const changes = [];
    if (name !== current.name) changes.push(`name changed to "${name}"`);
    if (status !== current.status) changes.push(`status changed to "${status}"`);
    const oldSources = (current.upi_match_sources || []).join(', ');
    const newSources = (upi.sources || []).join(', ');
    if (oldSources !== newSources) {
      changes.push(`UPI check set to "${newSources || 'off'}"`);
    }
    if ((upi.last4 || null) !== (current.upi_account_last4 || null)) {
      changes.push(`UPI account set to "${upi.last4 ? 'XX' + upi.last4 : 'any'}"`);
    }

    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Wallet Updated', req.user.username,
       `Updated wallet ${name} for ${centreName}${changes.length ? `: ${changes.join(', ')}` : ''}`, centreId]
    );
    await client.query('COMMIT');

    logActivity({
      centre_id: centreId,
      related_type: 'wallet',
      related_id: id,
      action: 'Wallet Updated',
      description: `Updated wallet: ${changes.length > 0 ? changes.join(', ') : 'details updated'}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    }).catch((e) => console.error('Non-fatal: wallet activity log failed', e));

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating wallet:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to update wallet' });
  } finally {
    client.release();
  }
});

// Delete a wallet — admin (own centre) / superadmin
router.delete('/:id', requireManager, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid wallet id' });

  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const walletResult = await client.query('SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [id]);
    if (walletResult.rows.length === 0) throw httpError(404, 'Wallet not found');
    const wallet = walletResult.rows[0];
    if (!isSuper(req) && wallet.centre_id !== req.user.centre_id) {
      throw httpError(403, 'You do not have access to this wallet');
    }

    const centreId = wallet.centre_id;
    const centreResult = await client.query('SELECT name FROM centres WHERE id = $1', [centreId]);
    const centreName = centreResult.rows[0]?.name || 'Unknown Centre';
    await client.query('DELETE FROM wallets WHERE id = $1', [id]);
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Wallet Deleted', req.user.username, `Deleted wallet ${wallet.name} for ${centreName}`, centreId]
    );
    await client.query('COMMIT');

    logActivity({
      centre_id: centreId,
      related_type: 'wallet',
      related_id: id,
      action: 'Wallet Deleted',
      description: `Deleted wallet: ${wallet.name} (${wallet.wallet_type})`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    }).catch((e) => console.error('Non-fatal: wallet activity log failed', e));

    res.json({ message: 'Wallet deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting wallet:', err);
    // 23503 = wallet still has transactions (foreign key)
    if (err.code === '23503') {
      return res.status(409).json({ error: 'This wallet has transactions and cannot be deleted. Set it to inactive instead.' });
    }
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to delete wallet' });
  } finally {
    client.release();
  }
});

// Get transactions (own centre; superadmin: all or ?centre_id=)
router.get('/transactions', async (req, res) => {
  const { limit = 50, offset = 0, centre_id } = req.query;

  try {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

    let query = `
      SELECT
        wt.id,
        wt.wallet_id,
        wt.staff_id,
        wt.type,
        wt.amount,
        wt.description,
        wt.category,
        wt.created_at,
        w.name AS wallet_name,
        s.name AS staff_name,
        s.role AS staff_role,
        s.photo AS staff_photo
      FROM wallet_transactions wt
      LEFT JOIN wallets w ON wt.wallet_id = w.id
      LEFT JOIN staff s ON wt.staff_id = s.id
    `;

    const values = [];
    const whereClauses = [];

    if (!isSuper(req)) {
      whereClauses.push(`w.centre_id = $${values.length + 1}`);
      values.push(req.user.centre_id);
    } else if (centre_id) {
      whereClauses.push(`w.centre_id = $${values.length + 1}`);
      values.push(parseInt(centre_id, 10));
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }

    query += `
      ORDER BY wt.created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;
    values.push(safeLimit, safeOffset);

    const result = await req.db.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Staff list (wallet pages) — own centre only (superadmin: all)
router.get('/all', async (req, res) => {
  try {
    const centreId = isSuper(req) ? null : (req.user.centre_id ?? -1);
    const result = await req.db.query(`
      SELECT id, name, role, photo AS "photoUrl", centre_id AS "centreId"
      FROM staff
      WHERE ($1::int IS NULL OR centre_id = $1)
      ORDER BY name ASC
    `, [centreId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching staff:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Create a transaction — wallet must be in the user's centre
router.post('/transactions', async (req, res) => {
  const { wallet_id, type, description, category } = req.body;
  const amount = Math.round(Number(req.body.amount) * 100) / 100;

  if (!wallet_id || !type || !req.body.amount) {
    return res.status(400).json({ error: 'wallet_id, type, and amount are required' });
  }
  if (!['credit', 'debit'].includes(type)) {
    return res.status(400).json({ error: 'type must be either "credit" or "debit"' });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount must be positive' });
  }

  // Only admins / superadmin may record a transaction in someone else's name
  const staffId = MANAGE_ROLES.includes(req.user.role) ? (req.body.staff_id || req.user.id) : req.user.id;

  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const walletResult = await client.query('SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [wallet_id]);
    if (walletResult.rows.length === 0) throw httpError(404, 'Wallet not found');
    const wallet = walletResult.rows[0];
    if (!isSuper(req) && wallet.centre_id !== req.user.centre_id) {
      throw httpError(403, 'You do not have access to this wallet');
    }
    const centreId = wallet.centre_id;

    const transactionResult = await client.query(
      `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [wallet.id, staffId, type, amount, description, category]
    );
    const transaction = transactionResult.rows[0];
    if (type === 'credit') {
      await client.query(`UPDATE wallets SET balance = balance + $1 WHERE id = $2`, [amount, wallet.id]);
    } else {
      await client.query(`UPDATE wallets SET balance = balance - $1 WHERE id = $2`, [amount, wallet.id]);
    }
    const centreResult = await client.query('SELECT name FROM centres WHERE id = $1', [centreId]);
    const centreName = centreResult.rows[0]?.name || 'Unknown Centre';
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Transaction Created', req.user.username, `Created transaction: ${description || 'No description'} for ${wallet.name} (${centreName})`, centreId]
    );
    await client.query('COMMIT');

    logActivity({
      centre_id: centreId,
      related_type: 'transaction',
      related_id: transaction.id,
      action: type === 'credit' ? 'Wallet Credited' : 'Wallet Debited',
      description: `${type === 'credit' ? 'Credit' : 'Debit'} of ₹${amount} to/from ${wallet.name}${description ? `: ${description}` : ''}`,
      performed_by: staffId,
      performed_by_role: req.user.role
    }).catch((e) => console.error('Non-fatal: transaction activity log failed', e));

    res.status(201).json(transaction);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating transaction:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to create transaction' });
  } finally {
    client.release();
  }
});

// Transfer between wallets (unchanged — it already checked the centre)
router.post('/transfer', async (req, res) => {
  const fromId = Number(req.body.from_wallet_id);
  const toId = Number(req.body.to_wallet_id);
  const amount = Number(req.body.amount);
  const description = (req.body.description || '').trim();
  const staffId = req.user.id;

  if (!Number.isInteger(fromId) || !Number.isInteger(toId)) {
    return res.status(400).json({ error: 'from_wallet_id and to_wallet_id are required' });
  }
  if (fromId === toId) return res.status(400).json({ error: 'Source and destination wallets cannot be the same' });
  if (!(amount > 0)) return res.status(400).json({ error: 'Amount must be positive' });

  const client = await req.db.connect();
  try {
    await client.query('BEGIN');

    // Lock both wallets in id order (prevents deadlocks between opposite transfers)
    const locked = await client.query(
      `SELECT w.*, c.name AS centre_name
         FROM wallets w
         LEFT JOIN centres c ON c.id = w.centre_id
        WHERE w.id = ANY($1::int[])
        ORDER BY w.id
        FOR UPDATE OF w`,
      [[fromId, toId]]
    );
    const fromWallet = locked.rows.find((r) => r.id === fromId);
    const toWallet = locked.rows.find((r) => r.id === toId);

    if (!fromWallet) throw httpError(404, 'Source wallet not found');
    if (!toWallet) throw httpError(404, 'Destination wallet not found');
    if (fromWallet.centre_id !== toWallet.centre_id) {
      throw httpError(400, 'Both wallets must belong to the same centre');
    }
    if (!isSuper(req) && fromWallet.centre_id !== req.user.centre_id) {
      throw httpError(403, 'You do not have access to these wallets');
    }
    if (Number(fromWallet.balance) < amount) throw httpError(400, 'Insufficient balance in source wallet');

    const debit = await client.query(
      `INSERT INTO wallet_transactions
         (wallet_id, staff_id, type, amount, description, category, reference_type, created_at)
       VALUES ($1, $2, 'debit', $3, $4, 'Transfer', 'transfer', NOW())
       RETURNING *`,
      [fromId, staffId, amount, description || `Transfer to ${toWallet.name}`]
    );
    const credit = await client.query(
      `INSERT INTO wallet_transactions
         (wallet_id, staff_id, type, amount, description, category, reference_type, reference_id, created_at)
       VALUES ($1, $2, 'credit', $3, $4, 'Transfer', 'transfer', $5, NOW())
       RETURNING *`,
      [toId, staffId, amount, description || `Transfer from ${fromWallet.name}`, debit.rows[0].id]
    );
    // link the debit back to its credit so either side can find the other
    await client.query(`UPDATE wallet_transactions SET reference_id = $1 WHERE id = $2`, [credit.rows[0].id, debit.rows[0].id]);

    await client.query(`UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2`, [amount, fromId]);
    await client.query(`UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`, [amount, toId]);

    const details = `Transferred ₹${amount} from ${fromWallet.name} to ${toWallet.name}${description ? `: ${description}` : ''}`;
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ('Wallet Transfer', $1, $2, $3, NOW())`,
      [req.user.username, details, fromWallet.centre_id]
    );

    await client.query('COMMIT');

    // after COMMIT: logActivity uses its own connection, a failure here must not undo the transfer
    logActivity({
      centre_id: fromWallet.centre_id,
      related_type: 'transfer',
      related_id: debit.rows[0].id,
      action: 'Wallet Transfer',
      description: details,
      performed_by: staffId,
      performed_by_role: req.user.role,
    }).catch((e) => console.error('Non-fatal: transfer activity log failed', e));

    res.status(201).json({ debit_transaction: debit.rows[0], credit_transaction: credit.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error processing transfer:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to process transfer' });
  } finally {
    client.release();
  }
});

// Get a single wallet by ID — own centre only
router.get('/wallets/:walletId', walletAccess, async (req, res) => {
  res.json(req.wallet);
});

// Transactions of one wallet — own centre only
router.get("/transactions/:walletId", walletAccess, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  try {
    const result = await req.db.query(`
      SELECT
        wt.id,
        wt.wallet_id,
        wt.staff_id,
        wt.type,
        wt.amount,
        LEFT(wt.description, 200) AS description,
        wt.category,
        wt.created_at,
        w.name AS wallet_name,
        s.name AS staff_name,
        LEFT(s.photo, 50000) AS staff_photo
      FROM wallet_transactions wt
      JOIN wallets w ON wt.wallet_id = w.id
      LEFT JOIN staff s ON wt.staff_id = s.id
      WHERE wt.wallet_id = $1
      ORDER BY wt.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.wallet.id, limit, offset]);

    res.json(result.rows);
  } catch (err) {
    console.error("Wallet transactions error:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Audit logs — admin: own centre, superadmin: all (or ?centre_id=). Staff: no.
router.get('/audit-logs', requireManager, async (req, res) => {
  try {
    const centreId = listCentre(req);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 1000, 1), 5000);
    const result = await req.db.query(`
      SELECT al.*, c.name AS centre_name
      FROM audit_logs al
      LEFT JOIN centres c ON al.centre_id = c.id
      WHERE ($1::int IS NULL OR al.centre_id = $1)
      ORDER BY al.created_at DESC
      LIMIT $2
    `, [centreId, limit]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get centres (names only list, used by pickers) — unchanged
router.get('/centres', async (req, res) => {
  try {
    const result = await req.db.query('SELECT * FROM centres ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching centres:', err);
    res.status(500).json({ error: 'Failed to fetch centres' });
  }
});

// POST /api/wallet/debit-salary — admin (own centre) / superadmin
router.post('/debit-salary', requireManager, async (req, res) => {
  const { wallet_id, salary_id, month } = req.body;
  const amount = Math.round(Number(req.body.amount) * 100) / 100;
  if (!wallet_id || !Number.isFinite(amount) || amount <= 0 || !salary_id || !month) {
    return res.status(400).json({ error: 'wallet_id, amount, salary_id and month are required' });
  }
  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const walletRes = await client.query(`
      SELECT w.id, w.name, w.balance, w.centre_id, c.name AS centre_name
      FROM wallets w
      LEFT JOIN centres c ON w.centre_id = c.id
      WHERE w.id = $1
      FOR UPDATE OF w
    `, [wallet_id]);
    if (walletRes.rows.length === 0) throw httpError(400, 'Wallet not found');
    const wallet = walletRes.rows[0];
    if (!isSuper(req) && wallet.centre_id !== req.user.centre_id) {
      throw httpError(403, 'You do not have access to this wallet');
    }
    if (Number(wallet.balance) < amount) {
      throw httpError(400, `Insufficient balance. Available: ₹${wallet.balance}`);
    }
    const salaryRes = await client.query(`
      SELECT s.id, s.net_salary, s.staff_id, st.name AS staff_name, st.centre_id
      FROM salaries s
      JOIN staff st ON st.id = s.staff_id
      WHERE s.id = $1
    `, [salary_id]);
    if (salaryRes.rows.length === 0) throw httpError(400, 'Salary record not found');
    const salary = salaryRes.rows[0];
    if (salary.centre_id !== wallet.centre_id) {
      throw httpError(400, 'Salary and wallet belong to different centres');
    }
    const staffName = salary.staff_name;
    await client.query(`UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2`, [amount, wallet.id]);
    const transactionDescription = `Salary payment – ${staffName} (${month})`;
    await client.query(`
      INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, created_at)
      VALUES ($1, $2, 'debit', $3, $4, 'Salary', NOW())
    `, [wallet.id, req.user.id, amount, transactionDescription]);

    // Inserted into expense table to view as expense category
    await client.query(`
      INSERT INTO expenses (
        centre_id, staff_id, category, amount, description, wallet_id,
        payment_method, expense_date, status, requires_approval, submitted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, 'auto_approved', false, NOW())
    `, [wallet.centre_id, req.user.id, 'Salary', amount, transactionDescription, wallet.id, 'salary']);

    const performedBy = req.user.username || req.user.name || req.user.email || 'System';
    await client.query(`
      INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
      VALUES ('Salary Payment', $1, $2, $3, NOW())
    `, [performedBy, `Paid ₹${amount} salary to ${staffName} (${month}) from wallet "${wallet.name}"`, wallet.centre_id]);
    await client.query('COMMIT');

    logActivity({
      centre_id: wallet.centre_id,
      related_type: 'salary_payment',
      related_id: salary_id,
      action: 'Salary Payment',
      description: `Paid ₹${amount} salary to ${staffName} (${month}) from wallet "${wallet.name}"`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    }).catch((e) => console.error('Non-fatal: salary activity log failed', e));

    res.json({ success: true, message: `Salary ₹${amount} paid to ${staffName} from wallet "${wallet.name}"` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Salary debit failed:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Salary payment failed' });
  } finally {
    client.release();
  }
});

export default router;