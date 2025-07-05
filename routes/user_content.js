const express = require('express');
const router = express.Router();
const db = require('../config/db');
const mysql = require('mysql2/promise');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

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
  console.log("Get Content - USER ID: ", req.user.user_id)
  try {
    const [rows] = await db.query(
      'SELECT * FROM user_content WHERE owner_id = ?',
      [req.user.user_id]
    );
    res.json(rows);
    console.log("resulting rows: " + rows)
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all subscriptions for a certain user
router.get('/getOther/:otherUser',  async (req, res) => {
  console.log("Get Content - USER ID: ", req.params.otherUser)
  try {
    const [rows] = await db.query(
      'SELECT * FROM user_content WHERE host_username = ?',
      [req.params.otherUser]
    );
    res.json(rows);
    console.log("'Get other user' resulting rows: " + rows)
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user content
router.delete('/delete/:id', authenticateToken, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM user_content WHERE id = ? AND owner_id = ?',
      [req.params.id, req.user.user_id]
    );
    res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
