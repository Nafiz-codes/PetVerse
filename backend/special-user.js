const bcrypt = require('bcryptjs');
const pool = require('./db');

async function createSpecialUser() {
  const passwordStr = 'rich123';
  const password_hash = await bcrypt.hash(passwordStr, 10);
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Check if user already exists
    const [existing] = await conn.query('SELECT account_id FROM Accounts WHERE email = ?', ['rich@example.com']);
    if (existing.length > 0) {
       console.log('User already exists!');
       await conn.rollback();
       process.exit(0);
    }

    const [result] = await conn.query(
      `INSERT INTO Accounts (name, email, mobile, date_of_birth, balance, password_hash, role)
       VALUES ('Rich User', 'rich@example.com', '01799999999', '1990-01-01', 500000.00, ?, 'user')`,
      [password_hash]
    );
    await conn.query('INSERT INTO Users (user_id) VALUES (?)', [result.insertId]);
    await conn.commit();
    console.log('✅ Rich User created! Login -> rich@example.com / rich123 / Balance: $500,000.00');
  } catch (err) {
    await conn.rollback();
    console.error(err);
  } finally {
    conn.release();
    process.exit(0);
  }
}
createSpecialUser();
