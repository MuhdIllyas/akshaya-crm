// routes/bankStatements.js — upload an SBI statement PDF for a bank wallet and match its
// DEBITS with the app's debits on that wallet. Rules only (no AI).
//
// Mount in server.js:   import bankStatementsRouter from './routes/bankStatements.js';
//                       app.use('/api/bank-statements', bankStatementsRouter);
// Needs:                npm install pdfjs-dist@4.10.38
//                       services/statementParser.js, services/statementMatcher.js
//                       bank-statements.sql (run once)
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { parseStatementPdf } from '../services/statementParser.js';
import { matchStatement } from '../services/statementMatcher.js';

const router = express.Router();

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

// admin: own centre (read + write). superadmin: any centre, read-only. Others: no access.
const VIEW_ROLES = ['admin', 'superadmin', 'supervisor'];
router.use((req, res, next) => {
  if (!VIEW_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Admin access required' });
  next();
});
const requireWriter = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: req.user.role === 'superadmin' ? 'Superadmin access is read-only' : 'Admin access required' });
  }
  next();
};

const httpError = (status, message) => Object.assign(new Error(message), { status });
const isYMD = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const fail = (res, err, what) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(`Bank statements: ${what} failed:`, err);
  return res.status(500).json({ error: `Failed to ${what}` });
};

async function loadWallet(db, req, walletId) {
  const id = parseInt(walletId, 10);
  if (Number.isNaN(id)) throw httpError(400, 'wallet_id is required');
  const { rows } = await db.query('SELECT id, name, centre_id, wallet_type FROM wallets WHERE id = $1', [id]);
  if (!rows.length) throw httpError(404, 'Wallet not found');
  if (req.user.role !== 'superadmin' && rows[0].centre_id !== req.user.centre_id) throw httpError(403, 'You do not have access to this wallet');
  if (rows[0].wallet_type !== 'bank') throw httpError(400, 'Bank statements can only be uploaded for bank wallets');
  return rows[0];
}

/* App debits on the wallet for [from − 1 day, to + 1 day] (IST days).
   Latest version of each corrected transaction only; reversals left out. */
const APP_DEBITS_SQL = `
  SELECT
    x.id, x.amount::numeric AS amount, x.category, x.description, x.reference_id,
    to_char(x.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date,
    to_char(x.created_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI')    AS time,
    se.id AS entry_id, se.customer_name, se.service_charges::numeric AS service_charges,
    sv.id AS service_id, sv.name AS service_name, sc.name AS subcategory_name,
    st.name AS staff_name
  FROM (
    SELECT DISTINCT ON (COALESCE(NULLIF(wt.correction_group_id::text, ''), wt.id::text))
      wt.id, wt.amount, wt.category, wt.description, wt.reference_id, wt.created_at,
      wt.staff_id, wt.is_reversal, wt.correction_group_id
    FROM wallet_transactions wt
    WHERE wt.wallet_id = $1
      AND wt.type = 'debit'
      AND wt.created_at >= (($2::date - 1)::timestamp AT TIME ZONE 'Asia/Kolkata')
      AND wt.created_at <  (($3::date + 2)::timestamp AT TIME ZONE 'Asia/Kolkata')
    ORDER BY COALESCE(NULLIF(wt.correction_group_id::text, ''), wt.id::text), wt.created_at DESC, wt.id DESC
  ) x
  LEFT JOIN service_entries se ON se.id = x.reference_id
        AND x.category IN ('Department Payment', 'Service Payment', 'Service Charge')
  LEFT JOIN services sv ON sv.id = se.category_id
  LEFT JOIN subcategories sc ON sc.id = se.subcategory_id
  LEFT JOIN staff st ON st.id = x.staff_id
  WHERE x.is_reversal IS NOT TRUE
    AND COALESCE(x.description, '') NOT ILIKE 'Correction reversal%'
  ORDER BY x.created_at
`;

/* Some corrections (e.g. expense corrections) do not use correction_group_id: they post a
   credit "… correction reversal …" for the old amount and a new debit. Such a reversed debit
   must not count as an app payment, otherwise it shows up as "In app, not in bank".
   Each ungrouped reversal credit cancels one earlier ungrouped debit of the same amount
   (same reference first, then the closest one before it). */
const REVERSAL_CREDITS_SQL = `
  SELECT wt.id, wt.amount::numeric AS amount, wt.reference_id, wt.description, wt.created_at
  FROM wallet_transactions wt
  WHERE wt.wallet_id = $1 AND wt.type = 'credit'
    AND (wt.is_reversal IS TRUE OR wt.description ILIKE '%reversal%')
    AND NULLIF(wt.correction_group_id::text, '') IS NULL
    AND wt.created_at >= (($2::date - 1)::timestamp AT TIME ZONE 'Asia/Kolkata')
    AND wt.created_at <  (($3::date + 2)::timestamp AT TIME ZONE 'Asia/Kolkata')
  ORDER BY wt.created_at, wt.id`;

async function loadAppDebits(db, walletId, from, to) {
  const debits = (await db.query(APP_DEBITS_SQL, [walletId, from, to])).rows;
  const reversals = (await db.query(REVERSAL_CREDITS_SQL, [walletId, from, to])).rows;
  // Bookings made FROM this screen ("Match & book" difference, "Book as expense") are already
  // explained by their match — they must not reappear as "In app, not in bank".
  const cancelled = new Set((await db.query(
    `SELECT adjustment_tx_id FROM bank_statement_matches
     WHERE wallet_id = $1 AND adjustment_tx_id IS NOT NULL AND status <> 'rejected'`,
    [walletId]
  )).rows.map((r) => r.adjustment_tx_id));
  const origId = (d) => (String(d || '').match(/Original ID:\s*(\d+)/i) || [])[1];
  for (const r of reversals) {
    const p = Math.round(Number(r.amount) * 100);
    const cands = debits.filter((d) => !cancelled.has(d.id)
      && !d.correction_group_id
      && Math.round(Number(d.amount) * 100) === p
      && new Date(d.created_at) <= new Date(r.created_at));
    if (!cands.length) continue;
    const ref = origId(r.description);
    const best = cands.find((d) => ref && String(d.reference_id) === ref)
      || cands.find((d) => r.reference_id != null && d.reference_id === r.reference_id)
      || cands[cands.length - 1]; // closest earlier debit
    cancelled.add(best.id);
  }
  return debits.filter((d) => !cancelled.has(d.id));
}

// Re-run matching for a wallet + period. Confirmed / rejected decisions are kept.
async function runMatching(client, wallet, from, to) {
  // 1. drop open suggestions that touch this period
  await client.query(
    `DELETE FROM bank_statement_matches m
     WHERE m.wallet_id = $1 AND m.status = 'proposed'
       AND EXISTS (
         SELECT 1 FROM bank_statement_match_items i
         JOIN bank_statement_lines l ON l.id = i.line_id
         WHERE i.match_id = m.id AND l.value_date BETWEEN $2 AND $3)`,
    [wallet.id, from, to]
  );

  // 2. what is still free
  const lines = (await client.query(
    `SELECT id, to_char(value_date, 'YYYY-MM-DD') AS value_date, debit::numeric AS debit, details, bank_ref, type_key, type_label
     FROM bank_statement_lines
     WHERE wallet_id = $1 AND value_date BETWEEN $2 AND $3 AND status = 'open' AND debit > 0
       AND NOT EXISTS (SELECT 1 FROM bank_statement_match_items i JOIN bank_statement_matches m ON m.id = i.match_id
                       WHERE i.line_id = bank_statement_lines.id AND m.status IN ('proposed', 'confirmed'))
     ORDER BY value_date, line_no`,
    [wallet.id, from, to]
  )).rows.map((l) => ({ ...l, debit: Number(l.debit) }));

  const used = new Set((await client.query(
    `SELECT i.wallet_tx_id FROM bank_statement_match_items i
     JOIN bank_statement_matches m ON m.id = i.match_id
     WHERE m.wallet_id = $1 AND m.status IN ('proposed', 'confirmed') AND i.wallet_tx_id IS NOT NULL
     UNION SELECT wallet_tx_id FROM bank_statement_app_checks WHERE wallet_id = $1`,
    [wallet.id]
  )).rows.map((r) => r.wallet_tx_id));

  const app = (await loadAppDebits(client, wallet.id, from, to))
    .filter((a) => !used.has(a.id))
    .map((a) => ({ ...a, amount: Number(a.amount) }));

  const learned = {};
  (await client.query('SELECT type_key, service_id, hits FROM bank_narration_learning WHERE centre_id = $1', [wallet.centre_id]))
    .rows.forEach((r) => { (learned[r.type_key] = learned[r.type_key] || {})[r.service_id] = r.hits; });

  // combinations the admin already rejected are not suggested again
  const rejected = new Set((await client.query(
    `SELECT string_agg(COALESCE('L' || i.line_id, 'T' || i.wallet_tx_id), ',' ORDER BY COALESCE('L' || i.line_id, 'T' || i.wallet_tx_id)) AS k
     FROM bank_statement_matches m JOIN bank_statement_match_items i ON i.match_id = m.id
     WHERE m.wallet_id = $1 AND m.status = 'rejected' GROUP BY m.id`,
    [wallet.id]
  )).rows.map((r) => r.k));
  const keyOf = (m) => [...m.bank_ids.map((id) => 'L' + id), ...m.app_ids.map((id) => 'T' + id)].sort().join(',');

  const result = matchStatement(lines, app, learned);

  // 3. save: auto = confirmed straight away, the rest waits for the admin
  let auto = 0, suggested = 0;
  for (const m of result.matches) {
    if (rejected.has(keyOf(m))) continue;
    const status = m.confidence === 'auto' ? 'confirmed' : 'proposed';
    const { rows } = await client.query(
      `INSERT INTO bank_statement_matches (wallet_id, kind, confidence, status, bank_total, app_total, diff, reason, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $4 = 'confirmed' THEN NOW() END) RETURNING id`,
      [wallet.id, m.kind, m.confidence, status, m.bank_total, m.app_total, m.diff, m.reason]
    );
    const matchId = rows[0].id;
    for (const lineId of m.bank_ids) {
      await client.query('INSERT INTO bank_statement_match_items (match_id, line_id) VALUES ($1, $2)', [matchId, lineId]);
    }
    for (const txId of m.app_ids) {
      await client.query('INSERT INTO bank_statement_match_items (match_id, wallet_tx_id) VALUES ($1, $2)', [matchId, txId]);
    }
    if (status === 'confirmed') {
      await client.query(`UPDATE bank_statement_lines SET status = 'matched' WHERE id = ANY($1::int[])`, [m.bank_ids]);
      await learnFromMatch(client, wallet, matchId);
      auto++;
    } else suggested++;
  }
  return { auto, suggested };
}

// learn "this narration type → this service" from a confirmed match
async function learnFromMatch(client, wallet, matchId) {
  await client.query(
    `INSERT INTO bank_narration_learning (centre_id, type_key, service_id, hits)
     SELECT DISTINCT $1::int, l.type_key, se.category_id, 1
     FROM bank_statement_match_items il
     JOIN bank_statement_lines l ON l.id = il.line_id
     JOIN bank_statement_match_items it ON it.match_id = il.match_id AND it.wallet_tx_id IS NOT NULL
     JOIN wallet_transactions wt ON wt.id = it.wallet_tx_id
     JOIN service_entries se ON se.id = wt.reference_id
     WHERE il.match_id = $2 AND l.type_key IS NOT NULL AND se.category_id IS NOT NULL
     ON CONFLICT (centre_id, type_key, service_id)
     DO UPDATE SET hits = bank_narration_learning.hits + 1, updated_at = NOW()`,
    [wallet.centre_id, matchId]
  );
}

/* Book a bank difference / bank-only debit in the app, posted today (like other corrections).
   amount > 0 → money went out of the bank that the app doesn't have: expense + debit
   amount < 0 → the app took out more than the bank: credit back (misc income)     */
// Only used for a bank row with NO app entry behind it ("Book as expense": bank charges,
// a payment nobody entered). staffId defaults to the admin who booked it.
async function bookAdjustment(client, req, wallet, amount, category, description, staffId = req.user.id) {
  const amt = r2(Math.abs(amount));
  if (!(amt > 0)) throw httpError(400, 'Nothing to book');
  if (amount > 0) {
    await client.query('UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2', [amt, wallet.id]);
    const tx = await client.query(
      `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, created_at)
       VALUES ($1, $2, 'debit', $3, $4, $5, NOW()) RETURNING id`,
      [wallet.id, staffId, amt, description, category]
    );
    await client.query(
      `INSERT INTO expenses (centre_id, staff_id, category, amount, description, wallet_id,
                             payment_method, expense_date, status, requires_approval, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'online', CURRENT_DATE, 'auto_approved', false, NOW())`,
      [wallet.centre_id, staffId, category, amt, description, wallet.id]
    );
    return tx.rows[0].id;
  }
  await client.query('UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2', [amt, wallet.id]);
  const tx = await client.query(
    `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, correction_group_id, created_at)
     VALUES ($1, $2, 'credit', $3, $4, 'Misc Income', $5, NOW()) RETURNING id`,
    [wallet.id, staffId, amt, description, crypto.randomUUID()]
  );
  return tx.rows[0].id;
}

// One wallet movement for a difference: + = bank paid more (debit), − = bank paid less (credit back).
async function postDifferenceTx(client, wallet, diff, staffId, category, referenceId, description) {
  const amt = r2(Math.abs(diff));
  const type = diff > 0 ? 'debit' : 'credit';
  await client.query(
    `UPDATE wallets SET balance = balance ${diff > 0 ? '-' : '+'} $1, updated_at = NOW() WHERE id = $2`,
    [amt, wallet.id]
  );
  // no correction_group_id: the original transaction stays the "latest" of its own group
  const tx = await client.query(
    `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, reference_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
    [wallet.id, staffId, type, amt, description.slice(0, 500), category, referenceId]
  );
  return tx.rows[0].id;
}

/* Change a department fee the way the app's own "Correct" does: reverse the current
   transaction and post the new amount in the SAME correction group. Then every screen that
   shows "the latest transaction of the group" (entry list, ledger, daily summary) shows the
   new amount — a separate adjustment transaction was invisible on the entry screens. */
async function correctDeptTx(client, wallet, depTx, diff, staffId, description) {
  let groupId = depTx.correction_group_id;
  if (!groupId) {
    groupId = crypto.randomUUID();
    await client.query('UPDATE wallet_transactions SET correction_group_id = $1 WHERE id = $2', [groupId, depTx.id]);
  }
  const cur = (await client.query(
    `SELECT id, wallet_id, type, amount::numeric AS amount, reference_id, team_id
     FROM wallet_transactions
     WHERE correction_group_id = $1 AND is_reversal IS NOT TRUE
     ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
    [groupId]
  )).rows[0];
  if (!cur || cur.type !== 'debit') throw httpError(409, 'The department fee of this entry was changed — re-run matching and try again');
  if (cur.wallet_id !== wallet.id) {
    throw httpError(409, 'The department fee of this entry was moved to another wallet after matching. Undo this match first.');
  }
  const oldAmt = r2(cur.amount);
  const newAmt = r2(oldAmt + diff);
  if (!(newAmt > 0)) throw httpError(409, 'The department fee would become ₹0 or less — correct the entry by hand');
  await client.query(
    `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, reference_id, reference_type,
                                      is_reversal, correction_group_id, team_id, created_at)
     VALUES ($1, $2, 'credit', $3, $4, 'Department Payment', $5, 'department', TRUE, $6, $7, NOW())`,
    [wallet.id, staffId, oldAmt, `Correction reversal: ${description}`.slice(0, 500), cur.reference_id, groupId, cur.team_id]
  );
  const tx = await client.query(
    `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, reference_id, reference_type,
                                      correction_group_id, team_id, created_at)
     VALUES ($1, $2, 'debit', $3, $4, 'Department Payment', $5, 'department', $6, $7, NOW()) RETURNING id`,
    [wallet.id, staffId, newAmt, description.slice(0, 500), cur.reference_id, groupId, cur.team_id]
  );
  // net change on the wallet = the difference only
  await client.query(`UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2`, [r2(newAmt - oldAmt), wallet.id]);
  return { txId: tx.rows[0].id, oldAmt, newAmt };
}

async function auditLog(client, req, wallet, action, details) {
  // best effort — never let the audit row break the booking
  await client.query('SAVEPOINT audit_sp');
  try {
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at) VALUES ($1, $2, $3, $4, NOW())`,
      [action, req.user.username || String(req.user.id), details.slice(0, 1000), wallet.centre_id]
    );
    await client.query('RELEASE SAVEPOINT audit_sp');
  } catch {
    await client.query('ROLLBACK TO SAVEPOINT audit_sp');
  }
}

/* The bank paid a different amount than was entered (e.g. bank ₹505.90, entered ₹500).
   The difference is NOT a separate expense / misc income: it is added to (or taken off)
   the SAME entry, under the SAME staff member who made it — even though an admin presses the button.
     • department fee of a service entry → department_charges ± diff, service_charges ∓ diff
       (the customer paid the same total, so what the centre keeps changes, not the bill)
     • an expense                        → that expense's amount ± diff
   With several app entries in one match the largest one carries the difference. */
async function bookDifference(client, req, wallet, m, dates) {
  const diff = r2(Number(m.diff));
  if (!diff) throw httpError(400, 'There is no difference to book');
  const txs = (await client.query(
    `SELECT wt.id, wt.amount::numeric AS amount, wt.category, wt.reference_id, wt.staff_id, wt.description,
            wt.correction_group_id,
            to_char(wt.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS d
     FROM bank_statement_match_items i JOIN wallet_transactions wt ON wt.id = i.wallet_tx_id
     WHERE i.match_id = $1 ORDER BY wt.amount DESC, wt.id`,
    [m.id]
  )).rows;
  if (!txs.length) throw httpError(400, 'This match has no app entry to adjust');
  const note = `bank statement ${dates}: bank ₹${Number(m.bank_total).toFixed(2)} vs entered ₹${Number(m.app_total).toFixed(2)}, adjusted by ${req.user.username || 'admin'}`;

  // 1. department fee of a service entry
  const dep = txs.find((t) => t.category === 'Department Payment' && t.reference_id);
  if (dep) {
    const se = (await client.query(
      `SELECT se.id, se.staff_id, se.service_charges, se.department_charges, sv.name AS service_name
       FROM service_entries se LEFT JOIN services sv ON sv.id = se.category_id
       WHERE se.id = $1 FOR UPDATE OF se`,
      [dep.reference_id]
    )).rows[0];
    if (se) {
      const newDept = r2(Number(se.department_charges) + diff);
      const newSvc = r2(Number(se.service_charges) - diff);
      if (newDept < 0) throw httpError(409, `The department fee of entry #${se.id} would go below zero — use "Match only" and correct the entry`);
      // The bank fee is bigger than the whole service charge: don't book it automatically —
      // the admin confirms with "Match only" and fixes the entry by hand.
      if (newSvc < 0) {
        throw httpError(409, `Entry #${se.id} (${se.service_name || 'service'}): the difference ₹${Math.abs(diff).toFixed(2)} is more than its service charge ₹${Number(se.service_charges).toFixed(2)}. Use "Match only" and correct the entry by hand.`);
      }
      await client.query(
        `UPDATE service_entries SET department_charges = $1, service_charges = $2, updated_at = NOW() WHERE id = $3`,
        [newDept, newSvc, se.id]
      );
      const { txId } = await correctDeptTx(
        client, wallet, dep, diff, se.staff_id || dep.staff_id,
        `Department charge for ${se.service_name || 'service'} (#${se.id}) ${diff > 0 ? '+' : '−'}₹${Math.abs(diff).toFixed(2)} — ${note}`
      );
      await auditLog(client, req, wallet, 'Department Charge Adjusted',
        `Entry #${se.id}: department ₹${Number(se.department_charges).toFixed(2)} → ₹${newDept.toFixed(2)}, service ₹${Number(se.service_charges).toFixed(2)} → ₹${newSvc.toFixed(2)} (${note})`);
      return txId;
    }
  }

  // 2. an expense (wallet transaction category 'Expense' → expenses row, same wallet and amount)
  const ex = txs.find((t) => t.category === 'Expense');
  if (ex) {
    const exp = (await client.query(
      `SELECT id, staff_id, amount::numeric AS amount, category FROM expenses
       WHERE wallet_id = $1 AND amount = $2 AND COALESCE(is_reversal, false) = false
         AND status NOT IN ('rejected', 'pending')
         AND (id = $3 OR (expense_date = $4::date AND staff_id = $5))
       ORDER BY (id = $3) DESC, id DESC LIMIT 1 FOR UPDATE`,
      [wallet.id, ex.amount, ex.reference_id || 0, ex.d, ex.staff_id || 0]
    )).rows[0];
    if (exp) {
      const newAmt = r2(Number(exp.amount) + diff);
      if (!(newAmt > 0)) throw httpError(409, `Expense #${exp.id} would become ₹0 or less — use "Match only" and correct the expense`);
      await client.query(
        `UPDATE expenses SET amount = $1,
                remarks = CONCAT_WS(' | ', NULLIF(remarks, ''), 'Bank difference ' || $2), updated_at = NOW()
         WHERE id = $3`,
        [newAmt, `${diff > 0 ? '+' : '−'}₹${Math.abs(diff).toFixed(2)} (${dates})`, exp.id]
      );
      const txId = await postDifferenceTx(
        client, wallet, diff, exp.staff_id || ex.staff_id, 'Expense', exp.id,
        `Expense adjustment: ${exp.category} (#${exp.id}) ${diff > 0 ? '+' : '−'}₹${Math.abs(diff).toFixed(2)} — ${note}`
      );
      await auditLog(client, req, wallet, 'Expense Adjusted',
        `Expense #${exp.id}: ₹${Number(exp.amount).toFixed(2)} → ₹${newAmt.toFixed(2)} (${note})`);
      return txId;
    }
  }

  // 3. anything else (transfers, manual debits): keep the old booking, but under the entry's staff
  return bookAdjustment(client, req, wallet, diff, 'Bank Difference',
    `Bank statement difference ${dates}: bank ₹${Number(m.bank_total).toFixed(2)} vs entered ₹${Number(m.app_total).toFixed(2)}`,
    txs[0].staff_id || req.user.id);
}

/* =========================================================
   POST /upload?wallet_id=…   body: the PDF (Content-Type: application/pdf)
========================================================= */
router.post('/upload', requireWriter, express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '10mb' }), async (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length < 100) return res.status(400).json({ error: 'Send the statement PDF as the request body' });
  if (buf.subarray(0, 5).toString() !== '%PDF-') return res.status(400).json({ error: 'That file is not a PDF' });

  const client = await req.db.connect();
  try {
    const wallet = await loadWallet(client, req, req.query.wallet_id);
    const parsed = await parseStatementPdf(buf);
    if (!parsed.ok) {
      return res.status(422).json({ error: 'The statement could not be read reliably', details: parsed.errors });
    }
    const fileHash = crypto.createHash('sha256').update(buf).digest('hex');
    const fileName = String(req.query.file_name || 'statement.pdf').slice(0, 200);

    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM bank_statements WHERE wallet_id = $1 AND file_hash = $2', [wallet.id, fileHash]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This statement was already uploaded', statement_id: existing.rows[0].id });
    }

    const st = await client.query(
      `INSERT INTO bank_statements (centre_id, wallet_id, bank, account_last4, period_from, period_to,
         opening_balance, closing_balance, total_debits, total_credits, debit_count, credit_count,
         file_name, file_hash, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [wallet.centre_id, wallet.id, parsed.bank, parsed.accountLast4, parsed.period.from, parsed.period.to,
       parsed.openingBalance, parsed.closingBalance, parsed.totals.debits, parsed.totals.credits,
       parsed.totals.debitCount, parsed.totals.creditCount, fileName, fileHash, req.user.id]
    );
    const statementId = st.rows[0].id;

    let added = 0, skipped = 0;
    for (const r of parsed.rows) {
      const key = `${r.value_date}|${r.debit.toFixed(2)}|${r.credit.toFixed(2)}|${r.balance.toFixed(2)}`;
      const ins = await client.query(
        `INSERT INTO bank_statement_lines (statement_id, wallet_id, line_no, value_date, post_date, details,
           debit, credit, balance, bank_ref, type_key, type_label, line_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (wallet_id, line_key) DO NOTHING RETURNING id`,
        [statementId, wallet.id, r.line_no, r.value_date, r.post_date, r.details, r.debit, r.credit, r.balance,
         r.bank_ref, r.type_key, r.type_label, key]
      );
      if (ins.rows.length) added++; else skipped++;
    }

    const counts = await runMatching(client, wallet, parsed.period.from, parsed.period.to);
    await client.query('COMMIT');

    res.status(201).json({
      statement_id: statementId,
      period: parsed.period,
      rows: parsed.rows.length,
      added,
      already_uploaded_rows: skipped,
      warnings: parsed.warnings,
      ...counts,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    fail(res, err, 'upload the statement');
  } finally {
    client.release();
  }
});

/* GET /?wallet_id=…   statements of a wallet (newest first) */
router.get('/', async (req, res) => {
  try {
    const wallet = await loadWallet(req.db, req, req.query.wallet_id);
    const { rows } = await req.db.query(
      `SELECT s.id, s.bank, s.account_last4, to_char(s.period_from,'YYYY-MM-DD') AS period_from,
              to_char(s.period_to,'YYYY-MM-DD') AS period_to, s.total_debits, s.debit_count, s.file_name,
              s.uploaded_at, st.name AS uploaded_by_name,
              (SELECT COUNT(*)::int FROM bank_statement_lines l
                WHERE l.wallet_id = s.wallet_id AND l.debit > 0 AND l.value_date BETWEEN s.period_from AND s.period_to
                  AND l.status = 'open') AS open_debits
       FROM bank_statements s LEFT JOIN staff st ON st.id = s.uploaded_by
       WHERE s.wallet_id = $1 ORDER BY s.period_to DESC, s.id DESC LIMIT 100`,
      [wallet.id]
    );
    res.json(rows);
  } catch (err) {
    fail(res, err, 'load statements');
  }
});

/* GET /:id   everything for one statement period */
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid statement id' });
  try {
    const s = (await req.db.query(
      `SELECT id, wallet_id, bank, account_last4, to_char(period_from,'YYYY-MM-DD') AS period_from,
              to_char(period_to,'YYYY-MM-DD') AS period_to, opening_balance, closing_balance,
              total_debits, total_credits, debit_count, credit_count, file_name, uploaded_at
       FROM bank_statements WHERE id = $1`, [id])).rows[0];
    if (!s) return res.status(404).json({ error: 'Statement not found' });
    const wallet = await loadWallet(req.db, req, s.wallet_id);

    const lines = (await req.db.query(
      `SELECT id, line_no, to_char(value_date,'YYYY-MM-DD') AS value_date, details, debit, credit, balance,
              bank_ref, type_key, type_label, status, note
       FROM bank_statement_lines
       WHERE wallet_id = $1 AND value_date BETWEEN $2 AND $3
       ORDER BY value_date, statement_id, line_no`,
      [wallet.id, s.period_from, s.period_to]
    )).rows;
    const lineIds = lines.map((l) => l.id);

    const app = await loadAppDebits(req.db, wallet.id, s.period_from, s.period_to);
    const appById = Object.fromEntries(app.map((a) => [a.id, a]));

    const matches = (await req.db.query(
      `SELECT m.id, m.kind, m.confidence, m.status, m.bank_total, m.app_total, m.diff, m.reason,
              m.adjustment_tx_id, m.decided_at,
              array_remove(array_agg(i.line_id), NULL) AS line_ids,
              array_remove(array_agg(i.wallet_tx_id), NULL) AS tx_ids
       FROM bank_statement_matches m
       JOIN bank_statement_match_items i ON i.match_id = m.id
       WHERE m.wallet_id = $1 AND m.status IN ('proposed', 'confirmed')
       GROUP BY m.id
       HAVING bool_or(i.line_id = ANY($2::int[]))`,
      [wallet.id, lineIds.length ? lineIds : [0]]
    )).rows;

    // app transactions outside the ±1 day window can still be part of a manual match
    const missingTx = [...new Set(matches.flatMap((m) => m.tx_ids))].filter((t) => !appById[t]);
    if (missingTx.length) {
      (await req.db.query(
        `SELECT wt.id, wt.amount::numeric AS amount, wt.category, wt.description, wt.reference_id,
                to_char(wt.created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS date,
                to_char(wt.created_at AT TIME ZONE 'Asia/Kolkata','HH24:MI') AS time,
                se.id AS entry_id, se.customer_name, se.service_charges::numeric AS service_charges,
                sv.name AS service_name, sc.name AS subcategory_name, st.name AS staff_name
         FROM wallet_transactions wt
         LEFT JOIN service_entries se ON se.id = wt.reference_id
               AND wt.category IN ('Department Payment', 'Service Payment', 'Service Charge')
         LEFT JOIN services sv ON sv.id = se.category_id
         LEFT JOIN subcategories sc ON sc.id = se.subcategory_id
         LEFT JOIN staff st ON st.id = wt.staff_id
         WHERE wt.id = ANY($1::int[])`, [missingTx]
      )).rows.forEach((t) => { appById[t.id] = t; });
    }

    // A matched entry that was corrected afterwards: moved to another wallet, or amount changed
    const matchedTx = [...new Set(matches.flatMap((m) => m.tx_ids))];
    const latestOf = {};
    if (matchedTx.length) {
      (await req.db.query(
        `SELECT o.id, l.wallet_id, l.amount::numeric AS amount
         FROM wallet_transactions o
         JOIN LATERAL (
           SELECT x.wallet_id, x.amount FROM wallet_transactions x
           WHERE NULLIF(o.correction_group_id::text, '') IS NOT NULL
             AND x.correction_group_id = o.correction_group_id AND x.is_reversal IS NOT TRUE
           ORDER BY x.created_at DESC, x.id DESC LIMIT 1
         ) l ON true
         WHERE o.id = ANY($1::int[])`,
        [matchedTx]
      )).rows.forEach((r) => { latestOf[r.id] = r; });
    }
    for (const m of matches) {
      if (m.adjustment_tx_id) continue; // our own correction made the latest one
      m.moved = m.tx_ids.filter((t) => latestOf[t] && latestOf[t].wallet_id !== wallet.id);
      m.changed = m.tx_ids
        .filter((t) => latestOf[t] && latestOf[t].wallet_id === wallet.id && appById[t] && r2(latestOf[t].amount) !== r2(appById[t].amount))
        .map((t) => ({ id: t, now: r2(latestOf[t].amount) }));
    }

    const inMatch = new Set(matches.flatMap((m) => m.tx_ids));
    // an entry may be matched to a row of ANOTHER statement (e.g. paid today, debited tomorrow)
    (await req.db.query(
      `SELECT DISTINCT i.wallet_tx_id FROM bank_statement_match_items i
       JOIN bank_statement_matches m ON m.id = i.match_id
       WHERE m.wallet_id = $1 AND m.status IN ('proposed', 'confirmed') AND i.wallet_tx_id IS NOT NULL`,
      [wallet.id]
    )).rows.forEach((r) => inMatch.add(r.wallet_tx_id));
    const checks = (await req.db.query('SELECT wallet_tx_id, note FROM bank_statement_app_checks WHERE wallet_id = $1', [wallet.id])).rows;
    const checkedNote = Object.fromEntries(checks.map((c) => [c.wallet_tx_id, c.note]));
    const appInPeriod = app.filter((a) => a.date >= s.period_from && a.date <= s.period_to);

    const debitLines = lines.filter((l) => Number(l.debit) > 0);
    const matchedLineIds = new Set(matches.filter((m) => m.status === 'confirmed').flatMap((m) => m.line_ids));
    const proposedLineIds = new Set(matches.filter((m) => m.status === 'proposed').flatMap((m) => m.line_ids));

    res.json({
      statement: s,
      wallet: { id: wallet.id, name: wallet.name },
      lines,
      app: appById,
      matches,
      bank_only: debitLines.filter((l) => l.status === 'open' && !matchedLineIds.has(l.id) && !proposedLineIds.has(l.id)).map((l) => l.id),
      app_only: appInPeriod.filter((a) => !inMatch.has(a.id) && !checkedNote[a.id]).map((a) => a.id),
      app_checked: appInPeriod.filter((a) => checkedNote[a.id]).map((a) => ({ id: a.id, note: checkedNote[a.id] })),
      counts: {
        debits: debitLines.length,
        matched: debitLines.filter((l) => matchedLineIds.has(l.id)).length,
        to_review: matches.filter((m) => m.status === 'proposed').length,
        bank_checked: debitLines.filter((l) => l.status === 'checked').length,
      },
    });
  } catch (err) {
    fail(res, err, 'load the statement');
  }
});

/* POST /:id/rematch   run the rules again (after new entries were added, etc.) */
router.post('/:id/rematch', requireWriter, async (req, res) => {
  const client = await req.db.connect();
  try {
    const s = (await client.query(`SELECT wallet_id, to_char(period_from,'YYYY-MM-DD') AS f, to_char(period_to,'YYYY-MM-DD') AS t FROM bank_statements WHERE id = $1`, [parseInt(req.params.id, 10)])).rows[0];
    if (!s) throw httpError(404, 'Statement not found');
    const wallet = await loadWallet(client, req, s.wallet_id);
    await client.query('BEGIN');
    const counts = await runMatching(client, wallet, s.f, s.t);
    await client.query('COMMIT');
    res.json(counts);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    fail(res, err, 're-run matching');
  } finally {
    client.release();
  }
});

async function loadMatch(client, req, id) {
  const m = (await client.query('SELECT * FROM bank_statement_matches WHERE id = $1 FOR UPDATE', [parseInt(id, 10)])).rows[0];
  if (!m) throw httpError(404, 'Match not found');
  const wallet = await loadWallet(client, req, m.wallet_id);
  const items = (await client.query('SELECT line_id, wallet_tx_id FROM bank_statement_match_items WHERE match_id = $1', [m.id])).rows;
  return { m, wallet, lineIds: items.filter((i) => i.line_id).map((i) => i.line_id) };
}

/* POST /matches/:id/confirm   { book_difference?: true }
   For an amount difference, book_difference = true adds the gap to the same entry
   (department fee / expense) under the same staff — see bookDifference. */
router.post('/matches/:id/confirm', requireWriter, async (req, res) => {
  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const { m, wallet, lineIds } = await loadMatch(client, req, req.params.id);
    if (m.status === 'confirmed') throw httpError(409, 'Already confirmed');
    if (m.status === 'rejected') throw httpError(409, 'This match was rejected — re-run matching');

    let adjustmentTxId = null;
    if (req.body?.book_difference && Number(m.diff) !== 0) {
      const dates = (await client.query(`SELECT string_agg(DISTINCT to_char(value_date,'DD Mon'), ', ') AS d FROM bank_statement_lines WHERE id = ANY($1::int[])`, [lineIds])).rows[0].d;
      adjustmentTxId = await bookDifference(client, req, wallet, m, dates);
    }
    await client.query(
      `UPDATE bank_statement_matches SET status = 'confirmed', decided_by = $1, decided_at = NOW(), adjustment_tx_id = $2 WHERE id = $3`,
      [req.user.id, adjustmentTxId, m.id]
    );
    await client.query(`UPDATE bank_statement_lines SET status = 'matched' WHERE id = ANY($1::int[])`, [lineIds]);
    await learnFromMatch(client, wallet, m.id);
    await client.query('COMMIT');
    res.json({ success: true, adjustment_tx_id: adjustmentTxId });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    fail(res, err, 'confirm the match');
  } finally {
    client.release();
  }
});

/* POST /matches/:id/reject   wrong suggestion (or undo a confirmed match without a booked difference) */
router.post('/matches/:id/reject', requireWriter, async (req, res) => {
  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const { m, lineIds } = await loadMatch(client, req, req.params.id);
    if (m.adjustment_tx_id) throw httpError(409, 'A difference was booked for this match — correct that booking first');
    await client.query(`UPDATE bank_statement_matches SET status = 'rejected', decided_by = $1, decided_at = NOW() WHERE id = $2`, [req.user.id, m.id]);
    await client.query(`UPDATE bank_statement_lines SET status = 'open' WHERE id = ANY($1::int[]) AND status = 'matched'`, [lineIds]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    fail(res, err, 'reject the match');
  } finally {
    client.release();
  }
});

/* POST /manual-match   { line_ids:[…], wallet_tx_ids:[…] }   link rows the rules didn't pair */
router.post('/manual-match', requireWriter, async (req, res) => {
  const lineIds = (req.body?.line_ids || []).map((x) => parseInt(x, 10)).filter(Number.isInteger);
  const txIds = (req.body?.wallet_tx_ids || []).map((x) => parseInt(x, 10)).filter(Number.isInteger);
  if (!lineIds.length || !txIds.length) return res.status(400).json({ error: 'Pick at least one bank row and one app entry' });

  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const lines = (await client.query('SELECT id, wallet_id, debit, status FROM bank_statement_lines WHERE id = ANY($1::int[]) FOR UPDATE', [lineIds])).rows;
    if (lines.length !== lineIds.length) throw httpError(404, 'Bank row not found');
    const walletId = lines[0].wallet_id;
    if (lines.some((l) => l.wallet_id !== walletId)) throw httpError(400, 'All rows must be from the same wallet');
    if (lines.some((l) => l.status !== 'open')) throw httpError(409, 'One of the bank rows is already matched or checked');
    const wallet = await loadWallet(client, req, walletId);

    const txs = (await client.query(`SELECT id, amount FROM wallet_transactions WHERE id = ANY($1::int[]) AND wallet_id = $2 AND type = 'debit'`, [txIds, walletId])).rows;
    if (txs.length !== txIds.length) throw httpError(400, 'App entries must be debits of the same wallet');
    const taken = await client.query(
      `SELECT 1 FROM bank_statement_match_items i JOIN bank_statement_matches m ON m.id = i.match_id
       WHERE m.status = 'confirmed' AND i.wallet_tx_id = ANY($1::int[]) LIMIT 1`, [txIds]);
    if (taken.rows.length) throw httpError(409, 'One of the app entries is already matched');

    // clear suggestions that used these rows / entries
    await client.query(
      `UPDATE bank_statement_matches SET status = 'rejected', decided_by = $1, decided_at = NOW()
       WHERE status = 'proposed' AND id IN (SELECT match_id FROM bank_statement_match_items WHERE line_id = ANY($2::int[]) OR wallet_tx_id = ANY($3::int[]))`,
      [req.user.id, lineIds, txIds]
    );

    const bankTotal = r2(lines.reduce((s, l) => s + Number(l.debit), 0));
    const appTotal = r2(txs.reduce((s, t) => s + Number(t.amount), 0));
    const { rows } = await client.query(
      `INSERT INTO bank_statement_matches (wallet_id, kind, confidence, status, bank_total, app_total, diff, reason, decided_by, decided_at)
       VALUES ($1, 'manual', 'suggest', 'proposed', $2, $3, $4, 'Matched by hand', $5, NOW()) RETURNING id`,
      [wallet.id, bankTotal, appTotal, r2(bankTotal - appTotal), req.user.id]
    );
    for (const l of lineIds) await client.query('INSERT INTO bank_statement_match_items (match_id, line_id) VALUES ($1,$2)', [rows[0].id, l]);
    for (const t of txIds) await client.query('INSERT INTO bank_statement_match_items (match_id, wallet_tx_id) VALUES ($1,$2)', [rows[0].id, t]);
    await client.query('COMMIT');
    // returned as "proposed": the screen confirms it next (with or without booking the difference)
    res.status(201).json({ match_id: rows[0].id, bank_total: bankTotal, app_total: appTotal, diff: r2(bankTotal - appTotal) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    fail(res, err, 'match by hand');
  } finally {
    client.release();
  }
});

/* POST /lines/:id/book   { category?, note }   a bank-only debit that is genuinely missing in the app
   (bank charges, a payment nobody entered) — books it as an expense and matches it */
router.post('/lines/:id/book', requireWriter, async (req, res) => {
  const note = String(req.body?.note || '').trim();
  const category = String(req.body?.category || 'Bank / CDM Charges').trim().slice(0, 60);
  if (note.length < 3) return res.status(400).json({ error: 'Add a short note' });
  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const l = (await client.query(`SELECT id, wallet_id, debit, status, to_char(value_date,'DD Mon YYYY') AS d, type_label FROM bank_statement_lines WHERE id = $1 FOR UPDATE`, [parseInt(req.params.id, 10)])).rows[0];
    if (!l) throw httpError(404, 'Bank row not found');
    if (l.status !== 'open') throw httpError(409, 'This bank row is already matched or checked');
    if (!(Number(l.debit) > 0)) throw httpError(400, 'Only debits can be booked');
    const wallet = await loadWallet(client, req, l.wallet_id);
    const txId = await bookAdjustment(client, req, wallet, Number(l.debit), category, `${note} (bank ${l.type_label || 'debit'} ${l.d})`);
    const { rows } = await client.query(
      `INSERT INTO bank_statement_matches (wallet_id, kind, confidence, status, bank_total, app_total, diff, reason, adjustment_tx_id, decided_by, decided_at)
       VALUES ($1, 'booked', 'suggest', 'confirmed', $2, $2, 0, $3, $4, $5, NOW()) RETURNING id`,
      [wallet.id, l.debit, `Booked as ${category}: ${note}`, txId, req.user.id]
    );
    await client.query('INSERT INTO bank_statement_match_items (match_id, line_id) VALUES ($1,$2)', [rows[0].id, l.id]);
    await client.query('INSERT INTO bank_statement_match_items (match_id, wallet_tx_id) VALUES ($1,$2)', [rows[0].id, txId]);
    await client.query(`UPDATE bank_statement_lines SET status = 'matched' WHERE id = $1`, [l.id]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, wallet_tx_id: txId });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    fail(res, err, 'book the bank debit');
  } finally {
    client.release();
  }
});

/* POST /lines/:id/check   { note }   bank-only row that needs no booking (e.g. transfer to own account already entered elsewhere)
   POST /lines/:id/uncheck */
router.post('/lines/:id/check', requireWriter, async (req, res) => {
  const note = String(req.body?.note || '').trim();
  if (note.length < 3) return res.status(400).json({ error: 'Add a short note' });
  try {
    const l = (await req.db.query('SELECT id, wallet_id, status FROM bank_statement_lines WHERE id = $1', [parseInt(req.params.id, 10)])).rows[0];
    if (!l) throw httpError(404, 'Bank row not found');
    await loadWallet(req.db, req, l.wallet_id);
    if (l.status !== 'open') throw httpError(409, 'This bank row is already matched or checked');
    await req.db.query(`UPDATE bank_statement_lines SET status = 'checked', note = $1 WHERE id = $2`, [note.slice(0, 300), l.id]);
    res.json({ success: true });
  } catch (err) {
    fail(res, err, 'mark the row');
  }
});
router.post('/lines/:id/uncheck', requireWriter, async (req, res) => {
  try {
    const l = (await req.db.query('SELECT id, wallet_id, status FROM bank_statement_lines WHERE id = $1', [parseInt(req.params.id, 10)])).rows[0];
    if (!l) throw httpError(404, 'Bank row not found');
    await loadWallet(req.db, req, l.wallet_id);
    if (l.status !== 'checked') throw httpError(409, 'This row is not marked as checked');
    await req.db.query(`UPDATE bank_statement_lines SET status = 'open', note = NULL WHERE id = $1`, [l.id]);
    res.json({ success: true });
  } catch (err) {
    fail(res, err, 'undo the mark');
  }
});

/* POST /app/:txId/check   { note }   app-only entry that is fine (e.g. paid from another account) */
router.post('/app/:txId/check', requireWriter, async (req, res) => {
  const note = String(req.body?.note || '').trim();
  if (note.length < 3) return res.status(400).json({ error: 'Add a short note' });
  try {
    const t = (await req.db.query(`SELECT id, wallet_id FROM wallet_transactions WHERE id = $1 AND type = 'debit'`, [parseInt(req.params.txId, 10)])).rows[0];
    if (!t) throw httpError(404, 'Entry not found');
    await loadWallet(req.db, req, t.wallet_id);
    await req.db.query(
      `INSERT INTO bank_statement_app_checks (wallet_tx_id, wallet_id, note, checked_by) VALUES ($1,$2,$3,$4)
       ON CONFLICT (wallet_tx_id) DO UPDATE SET note = EXCLUDED.note, checked_by = EXCLUDED.checked_by, checked_at = NOW()`,
      [t.id, t.wallet_id, note.slice(0, 300), req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    fail(res, err, 'mark the entry');
  }
});
router.delete('/app/:txId/check', requireWriter, async (req, res) => {
  try {
    const t = (await req.db.query('SELECT wallet_tx_id, wallet_id FROM bank_statement_app_checks WHERE wallet_tx_id = $1', [parseInt(req.params.txId, 10)])).rows[0];
    if (!t) throw httpError(404, 'Not marked');
    await loadWallet(req.db, req, t.wallet_id);
    await req.db.query('DELETE FROM bank_statement_app_checks WHERE wallet_tx_id = $1', [t.wallet_tx_id]);
    res.json({ success: true });
  } catch (err) {
    fail(res, err, 'undo the mark');
  }
});

export { loadAppDebits };
export default router;