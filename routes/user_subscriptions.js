const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authenticateToken = require('../middleware/auth'); // Assuming you have this middleware

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
router.get('/get', authenticateToken, async (req, res) => {
  console.log("Get Subscriptions- USER ID: ", req.user.id)
  try {
    const [rows] = await pool.query(
      'SELECT * FROM user_subscriptions WHERE user_id = ?',
      [req.user.id]
    );
    res.json(rows);
    console.log("resulting rows: "+ rows)
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific public subscription, used when sharing a subscription service
router.get('/:id', authenticateToken, async (req, res) => {
  console.log("Get Subscriptions- USE ID: ", req.user.id)
  try {
    const [rows] = await pool.query(
      'SELECT * FROM public_subscriptions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
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

// Get a specific public subscription, used when sharing a subscription service
router.get('/:id', authenticateToken, async (req, res) => {
  console.log("Get Subscriptions- USE ID: ", req.user.id)
  try {
    const [rows] = await pool.query(
      'SELECT * FROM public_subscriptions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
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


// Delete a user subscription (user unsubscribing)
router.delete('/delete/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM user_subscriptions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Subscription not found or you do not have permission to delete it' });
    }
    console.log("AR: ", result.affectedRows)
    res.json({ message: 'Subscription deleted successfully', deleted: result.affectedRows});
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if a user has an active subscription for a specific page
router.get('/check/:subId', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM user_subscriptions WHERE user_id = ? AND sub_id = ? AND status = "active" AND end_date > NOW()',
      [req.user.userId, req.params.subId]
    );
    res.json({ hasSubscription: rows.length > 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;