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

// Get a specific public subscription, used when sharing a subscription service
router.get('/get/:id', authenticateToken, async (req, res) => {
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

// Corrected the typo in 'frequency'
// Create a public Subscription
router.post('/create', authenticateToken, async (req, res) => {
  const {hostuser_id, title, cost, frequency, description, content, type, sub_id } = req.body;
  console.log("create sub: ", req.body);
  try {
    const [result] = await pool.query(
      'INSERT INTO public_subscriptions (hostuser_id, sub_id, description, content, cost, frequency, title, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [hostuser_id, sub_id, description, content, cost, frequency, title, type]
    );
    res.status(201).json({ id: result.insertId, message: 'Subscription created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// // Get a specific public subscription, used when sharing a subscription service
// router.get('/get', authenticateToken, async (req, res) => {
//   console.log("Get Subscriptions- USE ID: ", req.user.id)
  
// });

// Get all of a creator's public subscriptions
router.get('/get', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM public_subscriptions WHERE hostuser_id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit a public subscription
router.put('/edit/:id', authenticateToken, async (req, res) => {
  const { hostuser_id, title, cost, frequency, description, content, type, sub_id, id } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE public_subscriptions SET title = ?, cost = ?, frequency = ?, description = ?, content = ?, type = ?  WHERE sub_id = ? AND hostuser_id = ?',
      [title, cost, frequency, description, content, type, sub_id, hostuser_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Subscription not found or you do not have permission to edit it' });
    }
    res.json({ message: 'Subscription updated successfully' });
    console.log("updated subscription")
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a public subscription
router.delete('/delete/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM public_subscriptions WHERE id = ? AND hostuser_id = ?',
      [req.params.id, req.user.id]
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



module.exports = router;