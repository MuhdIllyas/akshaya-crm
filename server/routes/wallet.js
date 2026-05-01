import express from 'express';
import jwt from 'jsonwebtoken';
import { getTodayBalance, getDailyBalances } from "../controllers/walletDailyBalanceController.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

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

// ========== NEW: Batch today balances (performance) ==========
router.post('/today-balances', authenticateToken, async (req, res) => {
  const { walletIds } = req.body;
  if (!walletIds || !Array.isArray(walletIds) || walletIds.length === 0) {
    return res.status(400).json({ error: 'walletIds must be a non-empty array' });
  }

  const client = await req.db.connect();
  try {
    if (req.user.role !== 'superadmin') {
      const centreCheck = await client.query(
        `SELECT centre_id FROM wallets WHERE id = ANY($1) GROUP BY centre_id`,
        [walletIds]
      );
      if (centreCheck.rows.length !== 1) {
        return res.status(403).json({ error: 'Wallets must belong to a single centre' });
      }
      if (centreCheck.rows[0].centre_id !== req.user.centre_id) {
        return res.status(403).json({ error: 'You do not have access to these wallets' });
      }
    }

    const result = await client.query(
      `SELECT wallet_id, opening_balance, closing_balance, date
       FROM wallet_daily_balances
       WHERE wallet_id = ANY($1) AND date = CURRENT_DATE`,
      [walletIds]
    );

    const balancesMap = {};
    result.rows.forEach(row => {
      balancesMap[row.wallet_id] = {
        opening_balance: parseFloat(row.opening_balance),
        closing_balance: parseFloat(row.closing_balance),
        date: row.date
      };
    });
    walletIds.forEach(id => {
      if (!balancesMap[id]) balancesMap[id] = null;
    });

    res.json(balancesMap);
  } catch (err) {
    console.error('Error fetching batch today balances:', err);
    res.status(500).json({ error: 'Failed to fetch balances' });
  } finally {
    client.release();
  }
});

// Daily balance APIs (unchanged)
router.get("/:walletId/today-balance", authenticateToken, getTodayBalance);
router.get("/:walletId/daily-balances", authenticateToken, getDailyBalances);

// Get all wallets (for ServiceEntry.jsx) - unchanged
router.get('/', async (req, res) => {
  try {
    const result = await req.db.query(`
      SELECT id, name, balance, wallet_type, status, centre_id, assigned_staff_id
      FROM wallets
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching wallets:', err);
    res.status(500).json({ error: 'Failed to fetch wallets: ' + err.message });
  }
});

// Get all wallets with optional pagination (backward‑compatible)
router.get('/wallets', async (req, res) => {
  const { limit = 1000, offset = 0 } = req.query;
  try {
    const result = await req.db.query(`
      SELECT w.*, c.name AS centre_name
      FROM wallets w
      LEFT JOIN centres c ON w.centre_id = c.id
      ORDER BY w.created_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching wallets:', err);
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// GET /api/wallet/my-centre-wallets - unchanged
router.get('/my-centre-wallets', async (req, res) => {
  try {
    if (!req.user.centre_id && req.user.role !== 'superadmin') {
      return res.status(400).json({ error: 'No centre associated with this user' });
    }
    const centreId = req.user.centre_id;
    const result = await req.db.query(`
      SELECT id, name, balance, wallet_type, status, is_shared, assigned_staff_id
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

// GET /api/wallet/centre/:centreId - unchanged
router.get('/centre/:centreId', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { centreId } = req.params;
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

// Create a new wallet - unchanged
router.post('/create', async (req, res) => {
  const { name, balance, wallet_type, is_shared, assigned_staff_id, status, centre_id } = req.body;
  const userCentreId = req.user.centre_id;
  const finalCentreId = req.user.role === 'superadmin' ? centre_id : userCentreId;
  if (!finalCentreId) {
    return res.status(400).json({ error: 'Centre ID is required' });
  }
  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const walletResult = await client.query(
      `INSERT INTO wallets (name, balance, wallet_type, is_shared, assigned_staff_id, status, centre_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [name, balance, wallet_type, is_shared, assigned_staff_id || null, status, finalCentreId]
    );
    const wallet = walletResult.rows[0];
    if (balance > 0) {
      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, created_at)
         VALUES ($1, $2, 'credit', $3, $4, NOW())`,
        [wallet.id, assigned_staff_id || null, balance, `Initial balance for ${name}`]
      );
    }
    const centreResult = await client.query('SELECT name FROM centres WHERE id = $1', [finalCentreId]);
    const centreName = centreResult.rows[0]?.name || 'Unknown Centre';
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Wallet Created', req.user.username, `Created wallet ${name} for ${centreName}`, finalCentreId]
    );
    await logActivity({
      centre_id: finalCentreId,
      related_type: 'wallet',
      related_id: wallet.id,
      action: 'Wallet Created',
      description: `Created new wallet: ${name} (${wallet_type}) with initial balance ₹${balance}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    await client.query('COMMIT');
    res.status(201).json(walletResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating wallet:', err);
    res.status(500).json({ error: 'Failed to create wallet' });
  } finally {
    client.release();
  }
});

// Update a wallet - unchanged
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, balance, wallet_type, is_shared, assigned_staff_id, status } = req.body;
  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const currentWallet = await client.query('SELECT * FROM wallets WHERE id = $1', [id]);
    if (currentWallet.rows.length === 0) throw new Error('Wallet not found');
    const centreId = currentWallet.rows[0].centre_id;
    const oldName = currentWallet.rows[0].name;
    const oldBalance = currentWallet.rows[0].balance;
    const result = await client.query(
      `UPDATE wallets SET name=$1, balance=$2, wallet_type=$3, is_shared=$4, assigned_staff_id=$5, status=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, balance, wallet_type, is_shared, assigned_staff_id || null, status, id]
    );
    if (result.rows.length === 0) throw new Error('Wallet not found');
    const centreResult = await client.query('SELECT name FROM centres WHERE id = $1', [centreId]);
    const centreName = centreResult.rows[0]?.name || 'Unknown Centre';
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Wallet Updated', req.user.username, `Updated wallet ${name} for ${centreName}`, centreId]
    );
    let changes = [];
    if (name !== oldName) changes.push(`name changed to "${name}"`);
    if (balance !== oldBalance) changes.push(`balance changed from ₹${oldBalance} to ₹${balance}`);
    if (status !== currentWallet.rows[0].status) changes.push(`status changed to "${status}"`);
    await logActivity({
      centre_id: centreId,
      related_type: 'wallet',
      related_id: id,
      action: 'Wallet Updated',
      description: `Updated wallet: ${changes.length > 0 ? changes.join(', ') : 'details updated'}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating wallet:', err);
    res.status(err.message === 'Wallet not found' ? 404 : 500).json({ error: 'Failed to update wallet' });
  } finally {
    client.release();
  }
});

// Delete a wallet - unchanged
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const walletResult = await client.query('SELECT * FROM wallets WHERE id = $1', [id]);
    if (walletResult.rows.length === 0) throw new Error('Wallet not found');
    const wallet = walletResult.rows[0];
    const centreId = wallet.centre_id;
    const centreResult = await client.query('SELECT name FROM centres WHERE id = $1', [centreId]);
    const centreName = centreResult.rows[0]?.name || 'Unknown Centre';
    await client.query('DELETE FROM wallets WHERE id = $1', [id]);
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Wallet Deleted', req.user.username, `Deleted wallet ${wallet.name} for ${centreName}`, centreId]
    );
    await logActivity({
      centre_id: centreId,
      related_type: 'wallet',
      related_id: id,
      action: 'Wallet Deleted',
      description: `Deleted wallet: ${wallet.name} (${wallet.wallet_type})`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    await client.query('COMMIT');
    res.json({ message: 'Wallet deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting wallet:', err);
    res.status(err.message === 'Wallet not found' ? 404 : 500).json({ error: 'Failed to delete wallet' });
  } finally {
    client.release();
  }
});

// Get all transactions with optional pagination
router.get('/transactions', async (req, res) => {
  const { limit = 50, offset = 0, centre_id } = req.query;

  try {
    // ✅ Safety: limit cap (avoid heavy load)
    const safeLimit = Math.min(parseInt(limit) || 50, 100);
    const safeOffset = parseInt(offset) || 0;

    // ✅ Base query
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

    let values = [];
    let whereClauses = [];

    // ✅ Centre filter (IMPORTANT for performance)
    if (req.user.role !== 'superadmin') {
      whereClauses.push(`w.centre_id = $${values.length + 1}`);
      values.push(req.user.centre_id);
    } else if (centre_id) {
      whereClauses.push(`w.centre_id = $${values.length + 1}`);
      values.push(centre_id);
    }

    // ✅ Apply WHERE if exists
    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }

    // ✅ Order + pagination
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

// Get all staff - unchanged
router.get('/all', async (req, res) => {
  try {
    const result = await req.db.query(`
      SELECT id, name, role, photo AS "photoUrl", centre_id AS "centreId"
      FROM staff
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching staff:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Create a new transaction - unchanged
router.post('/transactions', async (req, res) => {
  const { wallet_id, staff_id, type, amount, description, category } = req.body;
  if (!wallet_id || !type || !amount) {
    return res.status(400).json({ error: 'wallet_id, type, and amount are required' });
  }
  if (!['credit', 'debit'].includes(type)) {
    return res.status(400).json({ error: 'type must be either "credit" or "debit"' });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: 'amount must be positive' });
  }
  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const walletResult = await client.query('SELECT * FROM wallets WHERE id = $1', [wallet_id]);
    if (walletResult.rows.length === 0) throw new Error('Wallet not found');
    const wallet = walletResult.rows[0];
    const centreId = wallet.centre_id;
    const transactionResult = await client.query(
      `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [wallet_id, staff_id || null, type, amount, description, category]
    );
    const transaction = transactionResult.rows[0];
    if (type === 'credit') {
      await client.query(`UPDATE wallets SET balance = balance + $1 WHERE id = $2`, [amount, wallet_id]);
    } else {
      await client.query(`UPDATE wallets SET balance = balance - $1 WHERE id = $2`, [amount, wallet_id]);
    }
    const centreResult = await client.query('SELECT name FROM centres WHERE id = $1', [centreId]);
    const centreName = centreResult.rows[0]?.name || 'Unknown Centre';
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Transaction Created', req.user.username, `Created transaction: ${description || 'No description'} for ${wallet.name} (${centreName})`, centreId]
    );
    await logActivity({
      centre_id: centreId,
      related_type: 'transaction',
      related_id: transaction.id,
      action: type === 'credit' ? 'Wallet Credited' : 'Wallet Debited',
      description: `${type === 'credit' ? 'Credit' : 'Debit'} of ₹${amount} to/from ${wallet.name}${description ? `: ${description}` : ''}`,
      performed_by: staff_id || req.user.id,
      performed_by_role: req.user.role
    });
    await client.query('COMMIT');
    res.status(201).json(transaction);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating transaction:', err);
    if (err.message === 'Wallet not found') {
      res.status(404).json({ error: 'Wallet not found' });
    } else {
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  } finally {
    client.release();
  }
});

// Transfer between wallets - unchanged
router.post('/transfer', async (req, res) => {
  const { from_wallet_id, to_wallet_id, amount, description, staff_id, category } = req.body;
  if (!from_wallet_id || !to_wallet_id || !amount || !staff_id) {
    return res.status(400).json({ error: 'from_wallet_id, to_wallet_id, amount, and staff_id are required' });
  }
  if (from_wallet_id === to_wallet_id) {
    return res.status(400).json({ error: 'Source and destination wallets cannot be the same' });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: 'Amount must be positive' });
  }
  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const fromWalletResult = await client.query(
      'SELECT w.*, c.name AS centre_name FROM wallets w LEFT JOIN centres c ON w.centre_id = c.id WHERE w.id = $1',
      [from_wallet_id]
    );
    const toWalletResult = await client.query(
      'SELECT w.*, c.name AS centre_name FROM wallets w LEFT JOIN centres c ON w.centre_id = c.id WHERE w.id = $1',
      [to_wallet_id]
    );
    if (fromWalletResult.rows.length === 0) throw new Error('Source wallet not found');
    if (toWalletResult.rows.length === 0) throw new Error('Destination wallet not found');
    const fromWallet = fromWalletResult.rows[0];
    const toWallet = toWalletResult.rows[0];
    if (fromWallet.balance < amount) throw new Error('Insufficient balance in source wallet');
    const staffResult = await client.query('SELECT id FROM staff WHERE id = $1', [staff_id]);
    if (staffResult.rows.length === 0) throw new Error('Staff not found');
    const debitTransaction = await client.query(
      `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, created_at)
       VALUES ($1, $2, 'debit', $3, $4, $5, NOW()) RETURNING *`,
      [from_wallet_id, staff_id, amount, description || `Transfer to ${toWallet.name} (${toWallet.centre_name || 'Unknown Centre'})`, category || 'Transfer']
    );
    const creditTransaction = await client.query(
      `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, created_at)
       VALUES ($1, $2, 'credit', $3, $4, $5, NOW()) RETURNING *`,
      [to_wallet_id, staff_id, amount, description || `Transfer from ${fromWallet.name} (${fromWallet.centre_name || 'Unknown Centre'})`, category || 'Transfer']
    );
    await client.query(`UPDATE wallets SET balance = balance - $1 WHERE id = $2`, [amount, from_wallet_id]);
    await client.query(`UPDATE wallets SET balance = balance + $1 WHERE id = $2`, [amount, to_wallet_id]);
    const auditDetails = description || `Transferred ${amount} from ${fromWallet.name} (${fromWallet.centre_name || 'Unknown Centre'}) to ${toWallet.name} (${toWallet.centre_name || 'Unknown Centre'})`;
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Wallet Transfer', req.user.username, auditDetails, fromWallet.centre_id]
    );
    await logActivity({
      centre_id: fromWallet.centre_id,
      related_type: 'transfer',
      related_id: debitTransaction.rows[0].id,
      action: 'Wallet Transfer',
      description: `Transferred ₹${amount} from ${fromWallet.name} to ${toWallet.name}${description ? `: ${description}` : ''}`,
      performed_by: staff_id,
      performed_by_role: req.user.role
    });
    await client.query('COMMIT');
    res.status(201).json({
      debit_transaction: debitTransaction.rows[0],
      credit_transaction: creditTransaction.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error processing transfer:', err);
    if (err.message === 'Source wallet not found' || err.message === 'Destination wallet not found') {
      res.status(404).json({ error: err.message });
    } else if (err.message === 'Insufficient balance in source wallet') {
      res.status(400).json({ error: err.message });
    } else if (err.message === 'Staff not found') {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Failed to process transfer' });
    }
  } finally {
    client.release();
  }
});

// Get a single wallet by ID - unchanged
router.get('/wallets/:walletId', async (req, res) => {
  const { walletId } = req.params;
  try {
    const result = await req.db.query(`SELECT * FROM wallets WHERE id = $1`, [walletId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Wallet not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching wallet:', err);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// Get transactions for a specific wallet - unchanged
router.get('/transactions', async (req, res) => {
  const centreId = req.user.centre_id;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = (page - 1) * limit;

  try {
    const result = await req.db.query(`
      SELECT 
        wt.id,
        wt.wallet_id,
        wt.staff_id,
        wt.type,
        wt.amount,
        wt.description,
        wt.created_at,
        w.name AS wallet_name,
        s.name AS staff_name,
        s.photo AS staff_photo
      FROM wallet_transactions wt
      JOIN wallets w ON wt.wallet_id = w.id
      LEFT JOIN staff s ON wt.staff_id = s.id
      WHERE w.centre_id = $1
      ORDER BY wt.created_at DESC
      LIMIT $2 OFFSET $3
    `, [centreId, limit, offset]);

    res.json({
      data: result.rows,
      page,
      limit
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.get("/transactions/:walletId", async (req, res) => {
  const { walletId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = await req.db.query(`
      SELECT 
        wt.id,
        wt.wallet_id,
        wt.staff_id,
        wt.type,
        wt.amount,
        LEFT(wt.description, 200) AS description,
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
    `, [walletId, limit, offset]);

    res.json(result.rows);
  } catch (err) {
    console.error("Wallet transactions error:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Get audit logs - unchanged
router.get('/audit-logs', async (req, res) => {
  try {
    const result = await req.db.query(`
      SELECT al.*, c.name AS centre_name
      FROM audit_logs al
      LEFT JOIN centres c ON al.centre_id = c.id
      ORDER BY al.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get centres - unchanged
router.get('/centres', async (req, res) => {
  try {
    const result = await req.db.query('SELECT * FROM centres ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching centres:', err);
    res.status(500).json({ error: 'Failed to fetch centres' });
  }
});

// POST /api/wallet/debit-salary - unchanged
router.post('/debit-salary', async (req, res) => {
  const { wallet_id, amount, salary_id, month } = req.body;
  if (!wallet_id || !amount || amount <= 0 || !salary_id || !month) {
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
    `, [wallet_id]);
    if (walletRes.rows.length === 0) throw new Error('Wallet not found');
    const wallet = walletRes.rows[0];
    if (Number(wallet.balance) < Number(amount)) {
      throw new Error(`Insufficient balance. Available: ₹${wallet.balance}`);
    }
    const salaryRes = await client.query(`
      SELECT s.id, s.net_salary, s.staff_id, st.name AS staff_name
      FROM salaries s
      JOIN staff st ON st.id = s.staff_id
      WHERE s.id = $1
    `, [salary_id]);
    if (salaryRes.rows.length === 0) throw new Error('Salary record not found');
    const salary = salaryRes.rows[0];
    const staffName = salary.staff_name;
    await client.query(`UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2`, [amount, wallet_id]);
    const transactionDescription = `Salary payment – ${staffName} (${month})`;
    await client.query(`
      INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, created_at)
      VALUES ($1, $2, 'debit', $3, $4, 'Salary', NOW())
    `, [wallet_id, req.user.id, amount, transactionDescription]);
    const performedBy = req.user.username || req.user.name || req.user.email || 'System';
    await client.query(`
      INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
      VALUES ('Salary Payment', $1, $2, $3, NOW())
    `, [performedBy, `Paid ₹${amount} salary to ${staffName} (${month}) from wallet "${wallet.name}"`, wallet.centre_id]);
    await logActivity({
      centre_id: wallet.centre_id,
      related_type: 'salary_payment',
      related_id: salary_id,
      action: 'Salary Payment',
      description: `Paid ₹${amount} salary to ${staffName} (${month}) from wallet "${wallet.name}"`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    await client.query('COMMIT');
    res.json({ success: true, message: `Salary ₹${amount} paid to ${staffName} from wallet "${wallet.name}"` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Salary debit failed:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
