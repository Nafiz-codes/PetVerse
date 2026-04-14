const router = require('express').Router();
const pool   = require('../db');

// GET /api/animal-types
// Returns all animal types currently in the AnimalTypes table
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM AnimalTypes ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error('AnimalTypes error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
