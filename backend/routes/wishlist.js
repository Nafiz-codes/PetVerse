const router = require('express').Router();
const pool = require('../db');
const { authenticate, requireUser } = require('../middleware/auth');

// POST /api/wishlist/:postId - Add to wishlist
router.post('/:postId', authenticate, requireUser, async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.account_id;

  try {
    await pool.query(
      'INSERT IGNORE INTO Wishlists (user_id, post_id) VALUES (?, ?)',
      [userId, postId]
    );
    res.status(201).json({ message: 'Added to wishlist' });
  } catch (err) {
    console.error('Add to wishlist error:', err);
    res.status(500).json({ message: 'Failed to add to wishlist' });
  }
});

// DELETE /api/wishlist/:postId - Remove from wishlist
router.delete('/:postId', authenticate, requireUser, async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.account_id;

  try {
    await pool.query(
      'DELETE FROM Wishlists WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );
    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    console.error('Remove from wishlist error:', err);
    res.status(500).json({ message: 'Failed to remove from wishlist' });
  }
});

// GET /api/wishlist - Get user's wishlist posts
router.get('/', authenticate, requireUser, async (req, res) => {
  const userId = req.user.account_id;

  try {
    // The query is similar to GET /api/posts but filtered by Wishlists table
    const query = `
      SELECT p.post_id, p.description, p.post_date, p.post_type,
             a.name AS author_name,
             m.post_id AS moderated,
             ad.animal_name, ad.gender, ad.age, ad.location,
             at.name AS animal_type_name,
             bs.category, bs.price,
             med.expire_date,
             1 AS is_wishlisted
      FROM Wishlists w
      JOIN Posts p ON w.post_id = p.post_id
      JOIN Accounts a ON p.account_id = a.account_id
      LEFT JOIN Moderation m ON p.post_id = m.post_id
      LEFT JOIN Adoptions ad ON p.post_id = ad.post_id
      LEFT JOIN AnimalTypes at ON ad.animal_type_id = at.animal_type_id
      LEFT JOIN BuySell bs ON p.post_id = bs.post_id
      LEFT JOIN Medicine med ON bs.buysell_id = med.buysell_id
      WHERE w.user_id = ?
        AND NOT EXISTS (SELECT 1 FROM Delete_Post dp WHERE dp.post_id = p.post_id)
      ORDER BY w.created_at DESC
    `;
    const [posts] = await pool.query(query, [userId]);
    res.json({ posts });
  } catch (err) {
    console.error('Get wishlist error:', err);
    res.status(500).json({ message: 'Failed to fetch wishlist' });
  }
});

module.exports = router;
