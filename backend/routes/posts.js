const router = require('express').Router();
const pool   = require('../db');
const { authenticate, requireUser } = require('../middleware/auth');

// ─── Helper: ensure animal type exists (insert if new), return its ID ──────────
async function ensureAnimalType(conn, animalTypeName) {
  let name = animalTypeName.trim();
  // Capitalize first letter so emojis and listing look consistent ("Snake" not "snake")
  name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  
  await conn.query('INSERT IGNORE INTO AnimalTypes (name) VALUES (?)', [name]);
  const [rows] = await conn.query('SELECT animal_type_id FROM AnimalTypes WHERE name = ?', [name]);
  return rows[0].animal_type_id;
}

// ─── Helper: clean up orphan animal types after a deletion ────────────────────
async function cleanupOrphanAnimalType(conn, animal_type_id) {
  if (!animal_type_id) return;
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS cnt FROM Adoptions WHERE animal_type_id = ?',
    [animal_type_id]
  );
  if (rows[0].cnt === 0) {
    // Also check if any Donation campaign references it
    const [donRows] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM Donations WHERE animal_type_id = ?',
      [animal_type_id]
    );
    if (donRows[0].cnt === 0) {
      await conn.query('DELETE FROM AnimalTypes WHERE animal_type_id = ?', [animal_type_id]);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts
// Query: { type, animal_type_id, category, page, limit }
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { type, animal_type_id, category, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT
        p.post_id, p.description, p.post_date, p.post_type, p.image_url,
        a.name AS author_name, a.account_id,
        -- Adoption fields
        ad.adoption_id, ad.animal_name, ad.gender, ad.age, ad.location,
        at.name AS animal_type_name, at.animal_type_id,
        -- BuySell fields
        bs.buysell_id, bs.category,
        m.expire_date,
        -- Moderation flag
        (SELECT COUNT(*) FROM Moderation m2 WHERE m2.post_id = p.post_id) AS moderated
      FROM Posts p
      JOIN Accounts a ON a.account_id = p.account_id
      LEFT JOIN Adoptions ad ON ad.post_id = p.post_id
      LEFT JOIN AnimalTypes at ON at.animal_type_id = ad.animal_type_id
      LEFT JOIN BuySell bs ON bs.post_id = p.post_id
      LEFT JOIN Medicine m ON m.buysell_id = bs.buysell_id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      sql += ' AND p.post_type = ?';
      params.push(type);
    }
    if (animal_type_id) {
      sql += ' AND ad.animal_type_id = ?';
      params.push(animal_type_id);
    }
    if (category) {
      sql += ' AND bs.category = ?';
      params.push(category);
    }

    sql += ' ORDER BY p.post_date DESC, p.post_id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(sql, params);

    // Count total
    let countSql = `
      SELECT COUNT(*) AS total FROM Posts p
      LEFT JOIN Adoptions ad ON ad.post_id = p.post_id
      LEFT JOIN BuySell bs ON bs.post_id = p.post_id
      WHERE 1=1
    `;
    const countParams = [];
    if (type) { countSql += ' AND p.post_type = ?'; countParams.push(type); }
    if (animal_type_id) { countSql += ' AND ad.animal_type_id = ?'; countParams.push(animal_type_id); }
    if (category) { countSql += ' AND bs.category = ?'; countParams.push(category); }

    const [countRows] = await pool.query(countSql, countParams);

    res.json({ posts: rows, total: countRows[0].total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('GET /posts error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts — create a new post (authenticated users only)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  const { post_type, description, image_url } = req.body;

  if (!post_type || !['Adoption', 'BuySell'].includes(post_type)) {
    return res.status(400).json({ message: 'post_type must be Adoption or BuySell' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const today = new Date().toISOString().slice(0, 10);

    // Insert base Post
    const [postResult] = await conn.query(
      'INSERT INTO Posts (account_id, description, post_date, post_type, image_url) VALUES (?, ?, ?, ?, ?)',
      [req.user.account_id, description || null, today, post_type, image_url || null]
    );
    const post_id = postResult.insertId;

    if (post_type === 'Adoption') {
      const { animal_type_name, animal_name, gender, age, location } = req.body;
      if (!animal_type_name) {
        await conn.rollback();
        return res.status(400).json({ message: 'animal_type_name is required for Adoption posts' });
      }

      // Auto-insert animal type if new
      const animal_type_id = await ensureAnimalType(conn, animal_type_name);

      await conn.query(
        'INSERT INTO Adoptions (post_id, animal_type_id, animal_name, gender, age, location) VALUES (?, ?, ?, ?, ?, ?)',
        [post_id, animal_type_id, animal_name || null, gender || null, age || null, location || null]
      );

    } else if (post_type === 'BuySell') {
      const { category, expire_date } = req.body;
      if (!category || !['Medicine', 'Toys'].includes(category)) {
        await conn.rollback();
        return res.status(400).json({ message: 'category must be Medicine or Toys' });
      }

      const [bsResult] = await conn.query(
        'INSERT INTO BuySell (post_id, category) VALUES (?, ?)',
        [post_id, category]
      );
      const buysell_id = bsResult.insertId;

      if (category === 'Medicine') {
        await conn.query(
          'INSERT INTO Medicine (buysell_id, expire_date) VALUES (?, ?)',
          [buysell_id, expire_date || null]
        );
      } else {
        await conn.query('INSERT INTO Toys (buysell_id) VALUES (?)', [buysell_id]);
      }
    }

    await conn.commit();
    res.status(201).json({ message: 'Post created', post_id });
  } catch (err) {
    await conn.rollback();
    console.error('POST /posts error:', err);
    res.status(500).json({ message: 'Failed to create post' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/posts/:id — user deletes their own post (or admin helper)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  const post_id = parseInt(req.params.id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verify ownership (unless admin)
    const [postRows] = await conn.query('SELECT account_id, post_type FROM Posts WHERE post_id = ?', [post_id]);
    if (postRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Post not found' });
    }
    if (req.user.role !== 'admin' && postRows[0].account_id !== req.user.account_id) {
      await conn.rollback();
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // Get animal_type_id before cascade delete
    let animal_type_id = null;
    if (postRows[0].post_type === 'Adoption') {
      const [adRows] = await conn.query('SELECT animal_type_id FROM Adoptions WHERE post_id = ?', [post_id]);
      if (adRows.length > 0) animal_type_id = adRows[0].animal_type_id;
    }

    // Delete post (cascades to Adoptions, BuySell, Medicine, Toys, Moderation)
    await conn.query('DELETE FROM Posts WHERE post_id = ?', [post_id]);

    // Clean up orphan animal type if applicable
    if (animal_type_id) {
      await cleanupOrphanAnimalType(conn, animal_type_id);
    }

    await conn.commit();
    res.json({ message: 'Post deleted' });
  } catch (err) {
    await conn.rollback();
    console.error('DELETE /posts/:id error:', err);
    res.status(500).json({ message: 'Failed to delete post' });
  } finally {
    conn.release();
  }
});

module.exports = { router, ensureAnimalType, cleanupOrphanAnimalType };
