const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const { salt, hash } = hashPassword(password);
    const accountId = `ACC${Date.now()}`;

    const [result] = await db.query(
      'INSERT INTO users (username, email, password, salt, account_id) VALUES (?, ?, ?, ?, ?)',
      [username, email, hash, salt, accountId]
    );

    await db.query('INSERT INTO accounts (user_id, account_id) VALUES (?, ?)', [result.insertId, accountId]);

    const token = jwt.sign({ id: result.insertId, accountId }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ token, user: { id: result.insertId, username, email, accountId } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    const isMatch = verifyPassword(password, user.salt, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, accountId: user.account_id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, user: { id: user.id, username: user.username, email: user.email, accountId: user.account_id } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;