const router = require('express').Router();
const pool   = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { cleanupOrphanAnimalType } = require('./posts');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/posts — all posts with details
// ─────────────────────────────────────────────────────────────────────────────
router.get('/posts', authenticate, requireAdmin, async (req, res) => {
  try {
    const { type, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT
        p.post_id, p.description, p.post_date, p.post_type, p.image_url,
        a.name AS author_name, a.email AS author_email, p.account_id,
        ad.animal_name, ad.gender, ad.age, ad.location,
        at.name AS animal_type_name,
        bs.category, m.expire_date,
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
    if (type) { sql += ' AND p.post_type = ?'; params.push(type); }
    sql += ' ORDER BY p.post_date DESC, p.post_id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(sql, params);
    res.json({ posts: rows });
  } catch (err) {
    console.error('Admin GET /posts error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/moderate/:postId — mark a post as moderated
// ─────────────────────────────────────────────────────────────────────────────
router.post('/moderate/:postId', authenticate, requireAdmin, async (req, res) => {
  const { postId } = req.params;
  const { notes } = req.body;
  try {
    // Check post exists
    const [postRows] = await pool.query('SELECT post_id FROM Posts WHERE post_id = ?', [postId]);
    if (postRows.length === 0) return res.status(404).json({ message: 'Post not found' });

    // INSERT IGNORE so re-moderating same post by same admin is ignored
    await pool.query(
      'INSERT IGNORE INTO Moderation (admin_id, post_id, notes) VALUES (?, ?, ?)',
      [req.user.account_id, postId, notes || null]
    );
    res.json({ message: 'Post marked as moderated' });
  } catch (err) {
    console.error('Admin moderate error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/posts/:postId — admin deletes a post
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/posts/:postId', authenticate, requireAdmin, async (req, res) => {
  const post_id = parseInt(req.params.postId);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verify post exists
    const [postRows] = await conn.query('SELECT post_type FROM Posts WHERE post_id = ?', [post_id]);
    if (postRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get animal_type_id before cascade delete
    let animal_type_id = null;
    if (postRows[0].post_type === 'Adoption') {
      const [adRows] = await conn.query('SELECT animal_type_id FROM Adoptions WHERE post_id = ?', [post_id]);
      if (adRows.length > 0) animal_type_id = adRows[0].animal_type_id;
    }

    // Record deletion in Delete_Post log
    await conn.query(
      'INSERT INTO Delete_Post (admin_id, post_id) VALUES (?, ?)',
      [req.user.account_id, post_id]
    );

    // Delete post (cascades to Adoptions, BuySell, Medicine, Toys, Moderation)
    await conn.query('DELETE FROM Posts WHERE post_id = ?', [post_id]);

    // Clean orphan animal type
    if (animal_type_id) {
      await cleanupOrphanAnimalType(conn, animal_type_id);
    }

    await conn.commit();
    res.json({ message: 'Post deleted by admin' });
  } catch (err) {
    await conn.rollback();
    console.error('Admin delete post error:', err);
    res.status(500).json({ message: 'Failed to delete post' });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/stats — dashboard statistics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const [[{ totalPosts }]]       = await pool.query('SELECT COUNT(*) AS totalPosts FROM Posts');
    const [[{ totalUsers }]]       = await pool.query('SELECT COUNT(*) AS totalUsers FROM Users');
    const [[{ totalDonations }]]   = await pool.query('SELECT COUNT(*) AS totalDonations FROM Donations');
    const [[{ totalModerated }]]   = await pool.query('SELECT COUNT(DISTINCT post_id) AS totalModerated FROM Moderation');
    const [[{ totalDeleted }]]     = await pool.query('SELECT COUNT(*) AS totalDeleted FROM Delete_Post');
    const [[{ totalAdoptions }]]   = await pool.query('SELECT COUNT(*) AS totalAdoptions FROM Adoptions');
    const [[{ totalCollected }]]   = await pool.query('SELECT COALESCE(SUM(current_amount),0) AS totalCollected FROM Donations');

    res.json({ totalPosts, totalUsers, totalDonations, totalModerated, totalDeleted, totalAdoptions, totalCollected });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/donations — admin creates a donation campaign
// ─────────────────────────────────────────────────────────────────────────────
router.post('/donations', authenticate, requireAdmin, async (req, res) => {
  const { title, description, start_date, end_date, target_amount, animal_type_id } = req.body;
  if (!title || !start_date || !end_date || !target_amount) {
    return res.status(400).json({ message: 'title, start_date, end_date, target_amount are required' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO Donations (title, description, start_date, end_date, target_amount, animal_type_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description || null, start_date, end_date, target_amount, animal_type_id || null]
    );
    res.status(201).json({ message: 'Campaign created', donation_id: result.insertId });
  } catch (err) {
    console.error('Admin create donation error:', err);
    res.status(500).json({ message: 'Failed to create campaign' });
  }
});

module.exports = router;
