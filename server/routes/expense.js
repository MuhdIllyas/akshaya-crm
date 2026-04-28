import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

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
    } = req.body;

    if (!category || !amount || !wallet_id || !expense_date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const staffId = req.user.id;
    const centreId = req.user.centre_id;
    const status = requires_approval ? "pending" : "auto_approved";
    const groupId = crypto.randomUUID();

    await client.query("BEGIN");

    const walletRes = await client.query(
      `SELECT id, balance FROM wallets WHERE id = $1 AND centre_id = $2`,
      [wallet_id, centreId]
    );
    if (walletRes.rows.length === 0) {
      throw new Error("Invalid wallet for your centre");
    }

    const expenseRes = await client.query(
      `INSERT INTO expenses (
         centre_id, staff_id, category, category_id, amount,
         description, remarks, wallet_id, payment_method,
         receipt_number, expense_date, status, requires_approval,
         correction_group_id, original_expense_id, is_reversal,
         submitted_at
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
         $14, NULL, FALSE,
         NOW()
       )
       RETURNING *`,
      [
        centreId, staffId, category, category_id || null, amount,
        description || null, remarks || null, wallet_id,
        payment_method || null, receipt_number || null,
        expense_date, status, requires_approval,
        groupId
      ]
    );

    if (!requires_approval) {
      if (Number(walletRes.rows[0].balance) < Number(amount)) {
        throw new Error("Insufficient wallet balance");
      }
      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, created_at)
         VALUES ($1,$2,'debit',$3,$4,'Expense',NOW())`,
        [wallet_id, staffId, amount, category]
      );
      await client.query(
        `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
        [amount, wallet_id]
      );
    }

    await client.query("COMMIT");
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
      `SELECT e.*, w.name AS wallet_name
       FROM expenses e
       JOIN wallets w ON e.wallet_id = w.id
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
   DELETE EXPENSE (unchanged core)
====================================================== */
router.delete("/:id", async (req, res) => {
  const client = await req.db.connect();
  try {
    const expenseId = req.params.id;
    await client.query("BEGIN");

    const expRes = await client.query(
      `SELECT id, staff_id, status, requires_approval FROM expenses WHERE id = $1`,
      [expenseId]
    );
    if (expRes.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }
    const exp = expRes.rows[0];
    if (!exp.requires_approval || exp.status !== "pending") {
      return res.status(400).json({ error: "Expense cannot be deleted" });
    }
    const isOwner = exp.staff_id === req.user.id;
    const isAdmin = ["admin", "superadmin"].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }
    await client.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);
    await client.query("COMMIT");
    res.json({ message: "Expense deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete expense error:", err);
    res.status(500).json({ error: "Failed to delete expense" });
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
    // ✅ Use requested centreId for SuperAdmins, otherwise use the user's own centre_id
    let targetCentreId = req.user.centre_id;
    if (req.user.role === "superadmin" && req.query.centreId) {
      targetCentreId = req.query.centreId;
    }

    const result = await req.db.query(
      `SELECT e.*,
              TO_CHAR(e.expense_date, 'YYYY-MM-DD') AS expense_date,
              s.name AS staff_name,
              w.name AS wallet_name
       FROM expenses e
       JOIN staff s ON e.staff_id = s.id
       JOIN wallets w ON e.wallet_id = w.id
       WHERE e.centre_id = $1
         AND COALESCE(e.is_reversal, FALSE) = FALSE
       ORDER BY e.expense_date DESC`,
      [targetCentreId] // ✅ Replaced req.user.centre_id with targetCentreId
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

    // 🔒 Lock the expense row to prevent double approval
    const expRes = await client.query(
      `SELECT * FROM expenses WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [req.params.id]
    );
    if (expRes.rows.length === 0) {
      throw new Error("Expense not found or already processed");
    }
    const exp = expRes.rows[0];

    // 💰 Balance check before deduction
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

    // Debit wallet
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, created_at)
       VALUES ($1,$2,'debit',$3,$4,'Expense',NOW())`,
      [exp.wallet_id, exp.staff_id, exp.amount, exp.category]
    );
    await client.query(
      `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
      [exp.amount, exp.wallet_id]
    );

    // Mark as approved
    await client.query(
      `UPDATE expenses SET status = 'approved', approved_at = NOW(), approved_by = $1 WHERE id = $2`,
      [req.user.id, req.params.id]
    );

    await client.query("COMMIT");
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
    await client.query(
      `UPDATE expenses SET status = 'rejected', approved_at = NOW(), approved_by = $1
       WHERE id = $2 AND status = 'pending'`,
      [req.user.id, req.params.id]
    );
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
  const client = await req.db.connect();
  try {
    const { amount, wallet_id, reason } = req.body;
    const expenseId = req.params.id;

    if (!amount || !wallet_id) {
      return res.status(400).json({ error: "Amount and wallet required" });
    }

    await client.query("BEGIN");

    // 🔒 Lock original expense row to prevent race conditions
    const expRes = await client.query(
      `SELECT * FROM expenses WHERE id = $1 AND is_reversal = FALSE FOR UPDATE`,
      [expenseId]
    );
    if (expRes.rows.length === 0) {
      throw new Error("Expense not found or already reversed");
    }
    const original = expRes.rows[0];

    // 🔒 Permission check
    const isOwner = original.staff_id === req.user.id;
    const isAdmin = ["admin", "superadmin"].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      throw new Error("Access denied");
    }

    // 🚫 Cannot correct a pending expense
    if (original.status === "pending") {
      throw new Error("Cannot correct a pending expense. Delete or reject it first.");
    }

    const groupId = original.correction_group_id || crypto.randomUUID();

    // Correction limit (only active versions)
    const countRes = await client.query(
      `SELECT COUNT(*) FROM expenses WHERE correction_group_id = $1 AND is_reversal = FALSE`,
      [groupId]
    );
    const activeCorrections = Number(countRes.rows[0].count);
    if (activeCorrections >= 3 && req.user.role === "staff") {
      throw new Error("Maximum correction limit reached. Please contact an admin.");
    }

    // 🔒 Validate new wallet belongs to same centre
    const walletCheck = await client.query(
      `SELECT id, balance FROM wallets WHERE id = $1 AND centre_id = $2`,
      [wallet_id, original.centre_id]
    );
    if (walletCheck.rows.length === 0) {
      throw new Error("Wallet not found or does not belong to your centre");
    }
    if (Number(walletCheck.rows[0].balance) < Number(amount)) {
      throw new Error("Insufficient wallet balance for corrected expense");
    }

    // 🔁 STEP 1: Reverse old wallet debit (credit back)
    await client.query(
      `INSERT INTO wallet_transactions (
         wallet_id, staff_id, type, amount, description, category,
         is_reversal, correction_group_id, reference_id, reference_type, created_at
       )
       VALUES ($1,$2,'credit',$3,$4,'Expense',TRUE,$5,$6,'expense',NOW())`,
      [
        original.wallet_id,
        req.user.id,
        original.amount,
        `Expense correction reversal: ${original.category} (Original ID: ${expenseId})`,
        groupId,
        expenseId
      ]
    );
    await client.query(
      `UPDATE wallets SET balance = balance + $1 WHERE id = $2`,
      [original.amount, original.wallet_id]
    );

    // 🔥 STEP 2: Mark original as reversed
    await client.query(
      `UPDATE expenses SET is_reversal = TRUE WHERE id = $1`,
      [expenseId]
    );

    // 🔥 STEP 3: Create corrected expense (auto‑approved)
    const newExp = await client.query(
      `INSERT INTO expenses (
         centre_id, staff_id, category, category_id, amount,
         description, remarks, wallet_id, payment_method,
         receipt_number, expense_date, status,
         correction_group_id, original_expense_id, is_reversal,
         submitted_at
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'auto_approved',
         $12,$13,FALSE,NOW()
       )
       RETURNING *`,
      [
        original.centre_id,
        original.staff_id,
        original.category,
        original.category_id,
        amount,
        original.description,
        reason || original.remarks,
        wallet_id,
        original.payment_method,
        original.receipt_number,
        original.expense_date,
        groupId,
        expenseId
      ]
    );

    // 🔁 STEP 4: Debit the new wallet
    await client.query(
      `INSERT INTO wallet_transactions (
         wallet_id, staff_id, type, amount, description, category,
         correction_group_id, reference_id, reference_type, created_at
       )
       VALUES ($1,$2,'debit',$3,$4,'Expense',$5,$6,'expense',NOW())`,
      [
        wallet_id,
        req.user.id,
        amount,
        `Corrected expense: ${original.category} (Original ID: ${expenseId})`,
        groupId,
        newExp.rows[0].id
      ]
    );
    await client.query(
      `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
      [amount, wallet_id]
    );

    await client.query("COMMIT");
    res.json({
      message: "Expense corrected successfully",
      data: newExp.rows[0]
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Expense correction error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
