const pool = require('./db');
async function run() {
  const conn = await pool.getConnection();
  try {
    console.log('Creating Wishlists table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS Wishlists (
          wishlist_id INT PRIMARY KEY AUTO_INCREMENT,
          user_id     INT NOT NULL,
          post_id     INT NOT NULL,
          created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY  unique_bookmark (user_id, post_id),
          FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
          FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE
      )
    `);
    console.log('Wishlists table created successfully.');
  } catch (err) {
    console.error('Error creating Wishlists table:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}
run();
