const pool = require('./db');
async function run() {
  const conn = await pool.getConnection();
  try {
    console.log('Altering BuySell table...');
    await conn.query('ALTER TABLE BuySell ADD COLUMN price DECIMAL(10,2) DEFAULT 0.00 AFTER category');
    console.log('Added price column successfully.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column price already exists.');
    } else {
      console.error(err);
    }
  } finally {
    conn.release();
    process.exit(0);
  }
}
run();
