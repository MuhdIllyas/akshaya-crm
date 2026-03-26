import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

/* ======================================================
   AUTH MIDDLEWARE (same as wallet.js – stable)
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
   CREATE EXPENSE (TRANSACTION – client required)
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

    await client.query("BEGIN");

    // Validate wallet
    const walletRes = await client.query(
      `SELECT id, balance FROM wallets WHERE id = $1 AND centre_id = $2`,
      [wallet_id, centreId]
    );

    if (walletRes.rows.length === 0) {
      throw new Error("Invalid wallet for your centre");
    }

    // Insert expense
    const expenseRes = await client.query(
      `
      INSERT INTO expenses (
        centre_id, staff_id, category, category_id, amount,
        description, remarks, wallet_id, payment_method,
        receipt_number, expense_date, status, requires_approval, submitted_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW()
      )
      RETURNING *
      `,
      [
        centreId,
        staffId,
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
      ]
    );

    // Auto-approved → debit wallet
    if (!requires_approval) {
      const walletBalance = Number(walletRes.rows[0].balance);
      if (walletBalance < Number(amount)) {
        throw new Error("Insufficient wallet balance");
      }

      await client.query(
        `
        INSERT INTO wallet_transactions (
          wallet_id, staff_id, type, amount, description, category, created_at
        )
        VALUES ($1,$2,'debit',$3,$4,'Expense',NOW())
        `,
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
    client.release(); // 🔒 ALWAYS RELEASE
  }
});

/* ======================================================
   GET MY EXPENSES (READ-ONLY – NO CLIENT)
====================================================== */
router.get("/my", async (req, res) => {
  try {
    const result = await req.db.query(
      `
      SELECT e.*, w.name AS wallet_name
      FROM expenses e
      JOIN wallets w ON e.wallet_id = w.id
      WHERE e.staff_id = $1 AND e.centre_id = $2
      ORDER BY e.expense_date DESC, e.created_at DESC
      `,
      [req.user.id, req.user.centre_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch my expenses error:", err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

/* ======================================================
   DELETE EXPENSE (TRANSACTION)
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
   ADMIN – GET ALL EXPENSES (READ-ONLY)
====================================================== */
router.get("/", async (req, res) => {
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const result = await req.db.query(
      `
    SELECT
      e.*,
      TO_CHAR(e.expense_date, 'YYYY-MM-DD') AS expense_date,
      s.name AS staff_name,
      w.name AS wallet_name
      FROM expenses e
      JOIN staff s ON e.staff_id = s.id
      JOIN wallets w ON e.wallet_id = w.id
      WHERE e.centre_id = $1
      ORDER BY e.expense_date DESC
      `,
      [req.user.centre_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch expenses error:", err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

/* ======================================================
   ADMIN – APPROVE EXPENSE (TRANSACTION)
====================================================== */
router.put("/:id/approve", async (req, res) => {
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }

  const client = await req.db.connect();

  try {
    await client.query("BEGIN");

    const expRes = await client.query(
      `SELECT * FROM expenses WHERE id = $1 AND status = 'pending'`,
      [req.params.id]
    );

    if (expRes.rows.length === 0) {
      throw new Error("Expense not found or already processed");
    }

    const exp = expRes.rows[0];

    await client.query(
      `
      INSERT INTO wallet_transactions (
        wallet_id, staff_id, type, amount, description, category, created_at
      )
      VALUES ($1,$2,'debit',$3,$4,'Expense',NOW())
      `,
      [exp.wallet_id, exp.staff_id, exp.amount, exp.category]
    );

    await client.query(
      `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
      [exp.amount, exp.wallet_id]
    );

    await client.query(
      `
      UPDATE expenses
      SET status = 'approved', approved_at = NOW(), approved_by = $1
      WHERE id = $2
      `,
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
   ADMIN – REJECT EXPENSE (TRANSACTION)
====================================================== */
router.put("/:id/reject", async (req, res) => {
  if (!["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }

  const client = await req.db.connect();

  try {
    await client.query(
      `
      UPDATE expenses
      SET status = 'rejected', approved_at = NOW(), approved_by = $1
      WHERE id = $2 AND status = 'pending'
      `,
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

export default router;