import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import notificationService from "../utils/notificationService.js"; 

const router = express.Router();

/* ======================================================
   AUTH MIDDLEWARE (same as wallet.js)
====================================================== */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

router.use(authenticateToken);

const httpErr = (status, message) => Object.assign(new Error(message), { status });

/* ======================================================
   TEAM RESOLUTION HELPER
====================================================== */

const resolveFinancialTeam = async ({
  client,
  staffId,
  role,
  selectedTeamId
}) => {

  // Admin / Superadmin manual selection
  if (
    selectedTeamId &&
    ["admin", "superadmin"].includes(role)
  ) {
    return selectedTeamId;
  }

  // Staff automatic primary team
  const result = await client.query(
    `
    SELECT team_id
    FROM team_members
    WHERE staff_id = $1
      AND is_primary = true
    LIMIT 1
    `,
    [staffId]
  );

  return result.rows[0]?.team_id || null;
};

/* ======================================================
   CREATE EXPENSE
====================================================== */
router.post("/", async (req, res) => {
  const client = await req.db.connect();

  try {
    const {
      category,
      category_id,
      amount,
      description,
      remarks,
      wallet_id,
      payment_method,
      receipt_number,
      expense_date,
      requires_approval = false,
      team_id,
    } = req.body;

    if (!category || !amount || !wallet_id || !expense_date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const staffId = req.user.id;
    const centreId = req.user.centre_id;
    const status = requires_approval ? "pending" : "auto_approved";
    const groupId = crypto.randomUUID();

    const resolvedTeamId =
      await resolveFinancialTeam({
        client,
        staffId,
        role: req.user.role,
        selectedTeamId: team_id,
    });

    await client.query("BEGIN");

    const walletRes = await client.query(
      `SELECT id, balance, name FROM wallets WHERE id = $1 AND centre_id = $2`,
      [wallet_id, centreId]
    );
    if (walletRes.rows.length === 0) {
      throw new Error("Invalid wallet for your centre");
    }
    const walletName = walletRes.rows[0].name;

  const expenseRes = await client.query(
    `INSERT INTO expenses (
      centre_id,
      staff_id,
      team_id,
      category,
      category_id,
      amount,
      description,
      remarks,
      wallet_id,
      payment_method,
      receipt_number,
      expense_date,
      status,
      requires_approval,
      correction_group_id,
      original_expense_id,
      is_reversal,
      submitted_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,NULL,FALSE,NOW()
    )
    RETURNING *`,
    [
      centreId,
      staffId,
      resolvedTeamId,
      category,
      category_id || null,
      amount,
      description || null,
      remarks || null,
      wallet_id,
      payment_method || null,
      receipt_number || null,
      expense_date,
      status,
      requires_approval,
      groupId
    ]
  );  

    if (!requires_approval) {
      if (Number(walletRes.rows[0].balance) < Number(amount)) {
        throw new Error("Insufficient wallet balance");
      }
      
      await client.query(
        `INSERT INTO wallet_transactions (
          wallet_id,
          staff_id,
          type,
          amount,
          description,
          category,
          team_id,
          reference_id,
          reference_type,
          correction_group_id,
          created_at
        )
        VALUES (
          $1,$2,'debit',$3,$4,'Expense',
          $5,$6,'expense',$7,NOW()
        )`,
        [
          wallet_id,
          staffId,
          amount,
          description || `${category} Expense`,
          resolvedTeamId,
          expenseRes.rows[0].id,
          groupId
        ]
      );
      
      await client.query(
        `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
        [amount, wallet_id]
      );
    }

    await client.query("COMMIT");

    // 🔥 NEW: NOTIFICATION ENGINE TRIGGER (Notify Admins)
    if (requires_approval) {
      try {
        // Find all admins for this centre
        const adminsRes = await client.query(
          `SELECT id FROM staff WHERE centre_id = $1 AND role IN ('admin', 'superadmin')`,
          [centreId]
        );
        const adminIds = adminsRes.rows.map(r => r.id);

        if (adminIds.length > 0) {
          await notificationService.createBulkNotifications({
            recipientStaffIds: adminIds,
            senderStaffId: staffId,
            type: 'expense',
            category: 'finance',
            title: '⏳ Expense Approval Required',
            message: `A new expense requires your approval.`,
            priority: 'medium',
            metadata: {
              'Category': category,
              'Amount': `₹${amount}`,
              'Wallet': walletName || 'Unknown Wallet'
            }
          });
        }
      } catch (notifErr) {
        console.error("Non-fatal: Failed to send expense request notification:", notifErr);
      }
    }

    res.status(201).json(expenseRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create expense error:", err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ======================================================
   GET MY EXPENSES (excludes reversals)
====================================================== */
router.get("/my", async (req, res) => {
  try {
    const result = await req.db.query(
      `SELECT e.*, w.name AS wallet_name, t.name AS team_name
       FROM expenses e
       JOIN wallets w ON e.wallet_id = w.id
       LEFT JOIN teams t ON t.id = e.team_id
       WHERE e.staff_id = $1 AND e.centre_id = $2
         AND COALESCE(e.is_reversal, FALSE) = FALSE
       ORDER BY e.expense_date DESC, e.created_at DESC`,
      [req.user.id, req.user.centre_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch my expenses error:", err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

/* ======================================================
   DELETE EXPENSE
   - pending (never debited): the owner or an admin can delete it, as before
   - approved / auto approved: ADMIN only. The amount goes back to the wallet
     (a credit posted today, so today's cash count is right), the expense is kept
     hidden (is_reversal, "Deleted by …" in remarks — kept for the audit
     trail) and any bank statement match on it is removed.
====================================================== */
router.delete("/:id", async (req, res) => {
  const client = await req.db.connect();
  try {
    const expenseId = parseInt(req.params.id, 10);
    if (Number.isNaN(expenseId)) return res.status(400).json({ error: "Invalid expense id" });
    const reason = String(req.body?.reason || req.query.reason || "").trim().slice(0, 300);

    await client.query("BEGIN");

    const expRes = await client.query(
      `SELECT * FROM expenses WHERE id = $1 AND COALESCE(is_reversal, FALSE) = FALSE FOR UPDATE`,
      [expenseId]
    );
    if (expRes.rows.length === 0) throw httpErr(404, "Expense not found");
    const exp = expRes.rows[0];

    const isAdmin = ["admin", "superadmin"].includes(req.user.role);
    const isOwner = exp.staff_id === req.user.id;
    if (req.user.role !== "superadmin" && Number(exp.centre_id) !== Number(req.user.centre_id)) {
      throw httpErr(403, "Access denied");
    }

    // 1. pending — nothing was debited
    if (exp.status === "pending") {
      if (!isOwner && !isAdmin) throw httpErr(403, "Access denied");
      await client.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);
      await client.query("COMMIT");
      return res.json({ message: "Expense deleted successfully" });
    }

    // 2. posted expense
    if (!["approved", "auto_approved"].includes(exp.status)) {
      throw httpErr(400, `An expense with status "${exp.status}" can't be deleted`);
    }
    if (!isAdmin) throw httpErr(403, "Only an admin can delete an expense that was already debited");
    if (reason.length < 3) throw httpErr(400, "Add a short reason for deleting this expense");

    // the debit(s) this expense made (latest version of each correction group)
    const debits = (await client.query(
      `SELECT DISTINCT ON (COALESCE(NULLIF(correction_group_id::text, ''), id::text))
              id, wallet_id, amount::numeric AS amount, type, is_reversal
       FROM wallet_transactions
       WHERE reference_id = $1 AND category = 'Expense'
       ORDER BY COALESCE(NULLIF(correction_group_id::text, ''), id::text), created_at DESC, id DESC`,
      [expenseId]
    )).rows.filter((t) => t.type === "debit" && !t.is_reversal);

    if (!debits.length) {
      throw httpErr(409, "No wallet debit is linked to this expense, so nothing can be returned automatically. Correct it by hand.");
    }
    const debitIds = debits.map((t) => t.id);
    const net = debits.reduce((sum, t) => sum + Number(t.amount), 0);

    // bank statement links (only if the bank statement tables exist)
    const hasBankTables = (await client.query(
      "SELECT to_regclass('public.bank_statement_match_items') AS t"
    )).rows[0].t;
    // a match may point at an earlier version of this expense (before a correction): same group
    const linkIds = (await client.query(
      `SELECT id FROM wallet_transactions
        WHERE id = ANY($1::int[])
           OR correction_group_id IN (SELECT correction_group_id FROM wallet_transactions
                                      WHERE id = ANY($1::int[]) AND correction_group_id IS NOT NULL)`,
      [debitIds]
    )).rows.map((r) => r.id);
    if (linkIds.length && hasBankTables) {
      await client.query(
        `UPDATE bank_statement_lines SET status = 'open'
         WHERE status = 'matched' AND id IN (
           SELECT i2.line_id FROM bank_statement_match_items i
           JOIN bank_statement_matches m ON m.id = i.match_id AND m.status = 'confirmed'
           JOIN bank_statement_match_items i2 ON i2.match_id = m.id AND i2.line_id IS NOT NULL
           WHERE i.wallet_tx_id = ANY($1::int[]))`,
        [linkIds]
      );
      await client.query(
        `DELETE FROM bank_statement_matches
         WHERE id IN (SELECT match_id FROM bank_statement_match_items WHERE wallet_tx_id = ANY($1::int[]))
            OR adjustment_tx_id = ANY($1::int[])`,
        [linkIds]
      );
      await client.query(`DELETE FROM bank_statement_app_checks WHERE wallet_tx_id = ANY($1::int[])`, [linkIds]);
    }

    // money back to the wallet, posted now, under the staff who made the expense
    for (const d of debits) {
      await client.query(
        `INSERT INTO wallet_transactions (
           wallet_id, staff_id, type, amount, description, category, team_id,
           reference_id, reference_type, created_at)
         VALUES ($1, $2, 'credit', $3, $4, 'Expense', $5, $6, 'expense', NOW())`,
        [d.wallet_id, exp.staff_id, d.amount,
         `Expense deleted, amount returned: ${exp.category} (#${expenseId}) — ${reason}`.slice(0, 500),
         exp.team_id, expenseId]
      );
      await client.query(`UPDATE wallets SET balance = balance + $1 WHERE id = $2`, [d.amount, d.wallet_id]);
    }

    await client.query(
      // status stays as it was (the status column only allows its fixed values); is_reversal hides it
      // from every list and report, the same way a corrected original is hidden
      `UPDATE expenses
          SET is_reversal = TRUE,
              remarks = CONCAT_WS(' | ', NULLIF(remarks, ''), $2::text), updated_at = NOW()
        WHERE id = $1`,
      [expenseId, `Deleted by ${req.user.username || req.user.id}: ${reason}`]
    );

    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ('Expense Deleted', $1, $2, $3, NOW())`,
      [req.user.username || String(req.user.id),
       `Expense #${expenseId} (${exp.category}, ₹${Number(exp.amount).toFixed(2)}) deleted, ₹${net.toFixed(2)} returned to the wallet. Reason: ${reason}`.slice(0, 1000),
       exp.centre_id]
    );

    await client.query("COMMIT");
    res.json({ message: "Expense deleted and amount returned to the wallet", returned: net });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Delete expense error:", err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to delete expense" });
  } finally {
    client.release();
  }
});

/* ======================================================
   ADMIN – GET ALL EXPENSES (excludes reversals)
====================================================== */
router.get("/", async (req, res) => {
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  try {
    let targetCentreId = req.user.centre_id;
    if (req.user.role === "superadmin" && req.query.centreId) {
      targetCentreId = req.query.centreId;
    }

    const result = await req.db.query(
      `SELECT e.*,
          TO_CHAR(e.expense_date, 'YYYY-MM-DD') AS expense_date,
          s.name AS staff_name,
          w.name AS wallet_name,
          t.name AS team_name
       FROM expenses e
       JOIN staff s ON e.staff_id = s.id
       JOIN wallets w ON e.wallet_id = w.id
       LEFT JOIN teams t ON e.team_id = t.id
       WHERE e.centre_id = $1
         AND COALESCE(e.is_reversal, FALSE) = FALSE
       ORDER BY e.expense_date DESC`,
      [targetCentreId] 
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch expenses error:", err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

/* ======================================================
   ADMIN – APPROVE EXPENSE (NOW WITH BALANCE CHECK + LOCK)
====================================================== */
router.put("/:id/approve", async (req, res) => {
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }

  const client = await req.db.connect();
  try {
    await client.query("BEGIN");

    const {
      team_id,
      assignment_notes
    } = req.body;

    const expRes = await client.query(
      `SELECT * FROM expenses WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [req.params.id]
    );
    if (expRes.rows.length === 0) {
      throw new Error("Expense not found or already processed");
    }
    const exp = expRes.rows[0];

    const finalTeamId = team_id || exp.team_id || null;

    const walletCheck = await client.query(
      `SELECT balance FROM wallets WHERE id = $1`,
      [exp.wallet_id]
    );
    if (walletCheck.rows.length === 0) {
      throw new Error("Wallet not found");
    }
    if (Number(walletCheck.rows[0].balance) < Number(exp.amount)) {
      throw new Error("Insufficient wallet balance");
    }

    await client.query(
      `INSERT INTO wallet_transactions (
        wallet_id,
        staff_id,
        type,
        amount,
        description,
        category,
        team_id,
        reference_id,
        reference_type,
        correction_group_id,
        created_at
      )
      VALUES (
        $1,$2,'debit',$3,$4,'Expense',
        $5,$6,'expense',$7,NOW()
      )`,
      [
        exp.wallet_id,
        exp.staff_id,
        exp.amount,
        exp.description || `${exp.category} Expense`,
        finalTeamId,
        exp.id,
        exp.correction_group_id
      ]
    );
    
    await client.query(
      `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
      [exp.amount, exp.wallet_id]
    );

    await client.query(
      `
      UPDATE expenses
      SET
        status = 'approved',
        approved_at = NOW(),
        approved_by = $1,
        team_id = $2,
        remarks = COALESCE($3, remarks)
      WHERE id = $4
      `,
      [
        req.user.id,
        finalTeamId,
        assignment_notes || null,
        req.params.id
      ]
    );

    await client.query("COMMIT");

    // 🔥 NEW: NOTIFICATION ENGINE TRIGGER (Notify the Submitter)
    if (exp.staff_id !== req.user.id) { // Don't notify if admin approves their own expense
      try {
        await notificationService.createNotification({
          recipientStaffId: exp.staff_id,
          senderStaffId: req.user.id,
          centreId: exp.centre_id,
          relatedEntityType: 'expense',
          relatedEntityId: exp.id,
          type: 'expense_approved',
          category: 'finance',
          title: '✅ Expense Approved',
          message: `Your expense request has been approved.`,
          priority: 'normal',
          metadata: {
            'Category': exp.category,
            'Amount': `₹${exp.amount}`
          }
        });
      } catch (notifErr) {
        console.error("Non-fatal: Failed to send approval notification:", notifErr);
      }
    }

    res.json({ message: "Expense approved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Approve expense error:", err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ======================================================
   ADMIN – REJECT EXPENSE
====================================================== */
router.put("/:id/reject", async (req, res) => {
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }
  const client = await req.db.connect();
  try {
    // 🔥 We query first so we can grab the staff ID for the notification
    const expRes = await client.query(
      `SELECT staff_id, amount, category, centre_id FROM expenses WHERE id = $1 AND status = 'pending'`, 
      [req.params.id]
    );
    
    if (expRes.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found or already processed" });
    }
    const exp = expRes.rows[0];

    await client.query(
      `UPDATE expenses SET status = 'rejected', approved_at = NOW(), approved_by = $1
       WHERE id = $2 AND status = 'pending'`,
      [req.user.id, req.params.id]
    );

    // 🔥 NEW: NOTIFICATION ENGINE TRIGGER (Notify the Submitter)
    if (exp.staff_id !== req.user.id) {
      try {
        await notificationService.createNotification({
          recipientStaffId: exp.staff_id,
          senderStaffId: req.user.id,
          centreId: exp.centre_id,
          relatedEntityType: 'expense',
          relatedEntityId: req.params.id,
          type: 'expense', 
          category: 'finance',
          title: '❌ Expense Rejected',
          message: `Your expense request was rejected.`,
          priority: 'high',
          metadata: {
            'Category': exp.category,
            'Amount': `₹${exp.amount}`
          }
        });
      } catch (notifErr) {
        console.error("Non-fatal: Failed to send rejection notification:", notifErr);
      }
    }

    res.json({ message: "Expense rejected successfully" });
  } catch (err) {
    console.error("Reject expense error:", err);
    res.status(500).json({ error: "Failed to reject expense" });
  } finally {
    client.release();
  }
});

/* ======================================================
   CORRECTION ENDPOINT – FULLY HARDENED
====================================================== */
router.put("/:id/correct", async (req, res) => {
  const amount = Number(req.body.amount);
  const walletId = Number(req.body.wallet_id);
  const reason = req.body.reason;
  // team_id: undefined = keep, null / "" = no team, number = that team
  const teamGiven = Object.prototype.hasOwnProperty.call(req.body, "team_id");
  const teamInput = teamGiven && req.body.team_id !== null && req.body.team_id !== "" ? Number(req.body.team_id) : null;
  if (teamGiven && teamInput !== null && !Number.isInteger(teamInput)) {
    return res.status(400).json({ error: "Invalid team" });
  }
  const expenseId = req.params.id;
 
  if (!(amount > 0) || !Number.isInteger(walletId)) {
    return res.status(400).json({ error: "Amount and wallet required" });
  }
 
  const client = await req.db.connect();
  try {
    await client.query("BEGIN");
 
    const expRes = await client.query(
      `SELECT * FROM expenses WHERE id = $1 AND COALESCE(is_reversal, FALSE) = FALSE FOR UPDATE`,
      [expenseId]
    );
    if (expRes.rows.length === 0) throw httpErr(404, "Expense not found or already reversed");
    const original = expRes.rows[0];
 
    const isSuperAdmin = req.user.role === "superadmin";
    const isAdmin = ["admin", "superadmin"].includes(req.user.role);
    const isOwner = original.staff_id === req.user.id;
 
    if (!isSuperAdmin && Number(original.centre_id) !== Number(req.user.centre_id)) throw httpErr(403, "Access denied");
    if (!isOwner && !isAdmin) throw httpErr(403, "Access denied");
 
    if (original.status === "pending") {
      throw httpErr(400, "Cannot correct a pending expense. Approve, reject or delete it first.");
    }
    if (original.status === "rejected") {
      throw httpErr(400, "A rejected expense was never debited, so it can't be corrected. Add a new expense instead.");
    }
    if (!["approved", "auto_approved"].includes(original.status)) {
      throw httpErr(400, `Cannot correct an expense with status "${original.status}"`);
    }
 
    // only an admin moves an expense to another team (team targets depend on it)
    if (teamGiven && !isAdmin && Number(teamInput || 0) !== Number(original.team_id || 0)) {
      throw httpErr(403, "Only an admin can change the team of an expense");
    }

    // team: must be a team of this centre or a global team
    const newTeamId = teamGiven ? teamInput : original.team_id;
    if (newTeamId !== null && newTeamId !== undefined && Number(newTeamId) !== Number(original.team_id)) {
      const t = await client.query(
        `SELECT id FROM teams WHERE id = $1 AND (centre_id = $2 OR centre_id IS NULL OR is_global = TRUE)`,
        [newTeamId, original.centre_id]
      );
      if (!t.rows.length) throw httpErr(400, "Team not found for this centre");
    }

    // Only the team changed: fix it in place — no money moves, the bank statement match stays
    const sameMoney = Math.round(amount * 100) === Math.round(Number(original.amount) * 100)
      && walletId === Number(original.wallet_id);
    if (sameMoney) {
      if (Number(newTeamId || 0) === Number(original.team_id || 0)) {
        throw httpErr(400, "Nothing to correct — amount, wallet and team are the same");
      }
      await client.query(
        `UPDATE expenses SET team_id = $1,
                remarks = CONCAT_WS(' | ', NULLIF(remarks, ''), $2::text), updated_at = NOW()
          WHERE id = $3`,
        [newTeamId, `Team corrected${reason ? `: ${reason}` : ""}`, expenseId]
      );
      await client.query(
        `UPDATE wallet_transactions SET team_id = $1
          WHERE reference_id = $2 AND category = 'Expense'`,
        [newTeamId, expenseId]
      );
      await client.query(
        `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
         VALUES ('Expense Team Corrected', $1, $2, $3, NOW())`,
        [req.user.username || String(req.user.id),
         `Expense #${expenseId}: team #${original.team_id ?? "none"} → #${newTeamId ?? "none"}${reason ? ` (${reason})` : ""}`,
         original.centre_id]
      );
      await client.query("COMMIT");
      return res.json({ message: "Expense team corrected", data: { ...original, team_id: newTeamId } });
    }

    const groupId = original.correction_group_id || crypto.randomUUID();
 
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS n FROM expenses WHERE correction_group_id = $1 AND COALESCE(is_reversal, FALSE) = FALSE`,
      [groupId]
    );
    if (countRes.rows[0].n >= 3 && req.user.role === "staff") {
      throw httpErr(400, "Maximum correction limit reached. Please contact an admin.");
    }
 
    // lock old + new wallet (same centre as the expense)
    const walletIds = [...new Set([Number(original.wallet_id), walletId])];
    const wRes = await client.query(
      `SELECT id, balance FROM wallets WHERE id = ANY($1::int[]) AND centre_id = $2 ORDER BY id FOR UPDATE`,
      [walletIds, original.centre_id]
    );
    const newWallet = wRes.rows.find((w) => w.id === walletId);
    if (!newWallet) throw httpErr(400, "Wallet not found or does not belong to this centre");
 
    const available =
      Number(newWallet.balance) + (walletId === Number(original.wallet_id) ? Number(original.amount) : 0);
    if (available < amount) throw httpErr(400, "Insufficient wallet balance for corrected expense");
 
    // STEP 1: credit back the original debit
    await client.query(
      `INSERT INTO wallet_transactions (
         wallet_id, staff_id, type, amount, description, category, team_id,
         is_reversal, correction_group_id, reference_id, reference_type, created_at)
       VALUES ($1,$2,'credit',$3,$4,'Expense',$5,TRUE,$6,$7,'expense',NOW())`,
      [original.wallet_id, original.staff_id, original.amount,
       `Expense correction reversal: ${original.category} (Original ID: ${expenseId})`,
       original.team_id, groupId, expenseId]
    );
    await client.query(`UPDATE wallets SET balance = balance + $1 WHERE id = $2`, [original.amount, original.wallet_id]);
 
    // STEP 2: mark original as reversed
    await client.query(`UPDATE expenses SET is_reversal = TRUE WHERE id = $1`, [expenseId]);
 
    // STEP 3: corrected expense
    const newExp = await client.query(
      `INSERT INTO expenses (
         centre_id, staff_id, team_id, category, category_id, amount,
         description, remarks, wallet_id, payment_method,
         receipt_number, expense_date, status,
         correction_group_id, original_expense_id, is_reversal, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'auto_approved',$13,$14,FALSE,NOW())
       RETURNING *`,
      [original.centre_id, original.staff_id, newTeamId ?? null, original.category, original.category_id,
       amount, original.description, reason || original.remarks, walletId, original.payment_method,
       original.receipt_number, original.expense_date, groupId, expenseId]
    );
 
    // STEP 4: debit the new wallet
    await client.query(
      `INSERT INTO wallet_transactions (
         wallet_id, staff_id, type, amount, description, category, team_id,
         correction_group_id, reference_id, reference_type, created_at)
       VALUES ($1,$2,'debit',$3,$4,'Expense',$5,$6,$7,'expense',NOW())`,
      [walletId, original.staff_id, amount,
       `Corrected expense: ${original.category} (Original ID: ${expenseId})`,
       newTeamId ?? null, groupId, newExp.rows[0].id]
    );
    await client.query(`UPDATE wallets SET balance = balance - $1 WHERE id = $2`, [amount, walletId]);
 
    await client.query("COMMIT");
    res.json({ message: "Expense corrected successfully", data: newExp.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Expense correction error:", err);
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;