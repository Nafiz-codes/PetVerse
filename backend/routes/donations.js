const router = require('express').Router();
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/donations — list campaigns (optionally filter by animal_type_id)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { animal_type_id } = req.query;
    let sql = `
      SELECT
        d.donation_id, d.title, d.description, d.start_date, d.end_date,
        d.target_amount, d.current_amount,
        at.animal_type_id, at.name AS animal_type_name,
        ROUND((d.current_amount / d.target_amount) * 100, 1) AS progress_pct
      FROM Donations d
      LEFT JOIN AnimalTypes at ON at.animal_type_id = d.animal_type_id
      WHERE 1=1
    `;
    const params = [];
    if (animal_type_id) {
      sql += ' AND d.animal_type_id = ?';
      params.push(animal_type_id);
    }
    sql += ' ORDER BY d.start_date DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /donations error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/donations/:id — single campaign details
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, at.name AS animal_type_name,
        ROUND((d.current_amount / d.target_amount) * 100, 1) AS progress_pct
       FROM Donations d
       LEFT JOIN AnimalTypes at ON at.animal_type_id = d.animal_type_id
       WHERE d.donation_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Campaign not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/donations/:id/contribute — user donates to a campaign
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/contribute', authenticate, async (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'Only users can donate' });
  }

  const donation_id = parseInt(req.params.id);
  const amount      = parseFloat(req.body.amount);

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'amount must be a positive number' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock campaign row
    const [campaigns] = await conn.query(
      'SELECT donation_id, end_date, target_amount, current_amount FROM Donations WHERE donation_id = ? FOR UPDATE',
      [donation_id]
    );
    if (campaigns.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Campaign not found' });
    }
    const campaign = campaigns[0];

    // Check campaign still active
    const today = new Date().toISOString().slice(0, 10);
    if (today > campaign.end_date) {
      await conn.rollback();
      return res.status(400).json({ message: 'This campaign has ended' });
    }

    // Lock user account row and check balance
    const [accounts] = await conn.query(
      'SELECT account_id, balance FROM Accounts WHERE account_id = ? FOR UPDATE',
      [req.user.account_id]
    );
    if (accounts.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Account not found' });
    }
    const balance = parseFloat(accounts[0].balance);
    if (balance < amount) {
      await conn.rollback();
      return res.status(400).json({ message: `Insufficient balance. Your balance: $${balance.toFixed(2)}` });
    }

    // Deduct from user balance
    await conn.query(
      'UPDATE Accounts SET balance = balance - ? WHERE account_id = ?',
      [amount, req.user.account_id]
    );

    // Increase campaign amount
    await conn.query(
      'UPDATE Donations SET current_amount = current_amount + ? WHERE donation_id = ?',
      [amount, donation_id]
    );

    // Record transaction
    await conn.query(
      'INSERT INTO Donation_Transactions (user_id, donation_id, amount, date) VALUES (?, ?, ?, ?)',
      [req.user.account_id, donation_id, amount, today]
    );

    await conn.commit();

    // Return updated balance
    const [updatedAcc] = await pool.query('SELECT balance FROM Accounts WHERE account_id = ?', [req.user.account_id]);
    res.json({ message: 'Donation successful!', new_balance: updatedAcc[0].balance });
  } catch (err) {
    await conn.rollback();
    console.error('Contribute error:', err);
    res.status(500).json({ message: 'Donation failed' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/donations/my/transactions — user's donation history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my/transactions', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT dt.transaction_id, dt.amount, dt.date,
              d.donation_id, d.title AS campaign_title,
              at.name AS animal_type_name
       FROM Donation_Transactions dt
       JOIN Donations d ON d.donation_id = dt.donation_id
       LEFT JOIN AnimalTypes at ON at.animal_type_id = d.animal_type_id
       WHERE dt.user_id = ?
       ORDER BY dt.date DESC`,
      [req.user.account_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Transactions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
