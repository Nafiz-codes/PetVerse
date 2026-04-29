const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'animal_adoption_secret';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, mobile, date_of_birth, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'name, email, password and role are required' });
  }
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'role must be user or admin' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check duplicate email
    const [existing] = await conn.query('SELECT account_id FROM Accounts WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Insert into Accounts
    const [result] = await conn.query(
      `INSERT INTO Accounts (name, email, mobile, date_of_birth, balance, password_hash, role)
       VALUES (?, ?, ?, ?, 500.00, ?, ?)`,
      [name, email, mobile || null, date_of_birth || null, password_hash, role]
    );
    const account_id = result.insertId;

    // Insert into Users or Admins sub-table
    if (role === 'user') {
      await conn.query('INSERT INTO Users (user_id) VALUES (?)', [account_id]);
    } else {
      await conn.query('INSERT INTO Admins (admin_id) VALUES (?)', [account_id]);
    }

    await conn.commit();

    const token = jwt.sign({ account_id, name, email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, account_id, name, email, role, balance: 500.00 });
  } catch (err) {
    await conn.rollback();
    console.error('Register error:', err);
    res.status(500).json({ message: 'Registration failed' });
  } finally {
    conn.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT account_id, name, email, balance, password_hash, role FROM Accounts WHERE email = ?',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const account = rows[0];
    const valid = await bcrypt.compare(password, account.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { account_id: account.account_id, name: account.name, email: account.email, role: account.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, account_id: account.account_id, name: account.name, email: account.email, role: account.role, balance: account.balance });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
});

// GET /api/auth/me
const { authenticate } = require('../middleware/auth');
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT account_id, name, email, mobile, date_of_birth, balance, role, created_at FROM Accounts WHERE account_id = ?',
      [req.user.account_id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
