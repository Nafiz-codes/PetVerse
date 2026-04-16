const pool = require('./db');
const { ensureAnimalType } = require('./routes/posts');

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const typeId = await ensureAnimalType(conn, 'TestSnake');
    console.log('typeId for TestSnake: ', typeId);
    
    const [res] = await conn.query('INSERT INTO Posts (account_id, description, post_date, post_type) VALUES (1, "A test snake post", "2026-04-16", "Adoption")');
    const postId = res.insertId;
    console.log('postId: ', postId);
    
    await conn.query('INSERT INTO Adoptions (post_id, animal_type_id, animal_name) VALUES (?, ?, ?)', [postId, typeId, 'Ssss']);
    await conn.commit();
    console.log('Committed');
    
    const [rows] = await pool.query(`
      SELECT p.post_id, ad.animal_type_id, at.name
      FROM Posts p
      JOIN Adoptions ad ON p.post_id = ad.post_id
      LEFT JOIN AnimalTypes at ON ad.animal_type_id = at.animal_type_id
      WHERE p.post_id = ?
    `, [postId]);
    console.log('Fetch Result:', rows);
    
  } catch (err) {
    console.error(err);
    await conn.rollback();
  } finally {
    conn.release();
    process.exit(0);
  }
}
run();
