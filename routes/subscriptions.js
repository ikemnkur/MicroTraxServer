const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authenticateToken = require('../middleware/authenticateToken'); // Assuming you have this middleware

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Get all subscriptions for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ?',
      [req.user.userId]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific subscription
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a new subscription
router.post('/', authenticateToken, async (req, res) => {
  const { page_id, status, end_date } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO subscriptions (user_id, page_id, status, start_date, end_date) VALUES (?, ?, ?, NOW(), ?)',
      [req.user.userId, page_id, status, end_date]
    );
    res.status(201).json({ id: result.insertId, message: 'Subscription created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit a subscription
router.put('/:id', authenticateToken, async (req, res) => {
  const { status, end_date } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE subscriptions SET status = ?, end_date = ? WHERE id = ? AND user_id = ?',
      [status, end_date, req.params.id, req.user.userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Subscription not found or you do not have permission to edit it' });
    }
    res.json({ message: 'Subscription updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a subscription
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM subscriptions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Subscription not found or you do not have permission to delete it' });
    }
    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if a user has an active subscription for a specific page
router.get('/check/:pageId', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND page_id = ? AND status = "active" AND end_date > NOW()',
      [req.user.userId, req.params.pageId]
    );
    res.json({ hasSubscription: rows.length > 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;