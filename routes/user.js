const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.id, u.username, u.email, u.firstName, u.lastName, u.phoneNumber, u.birthDate, 
              a.balance, at.name as accountTier, at.daily_transaction_limit, at.monthly_fee
       FROM users u
       JOIN accounts a ON u.id = a.user_id
       JOIN user_tiers ut ON u.id = ut.user_id
       JOIN account_tiers at ON ut.tier_id = at.id
       WHERE u.id = ? AND ut.end_date IS NULL`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  const { firstName, lastName, phoneNumber, birthDate } = req.body;

  try {
    await db.query(
      'UPDATE users SET firstName = ?, lastName = ?, phoneNumber = ?, birthDate = ? WHERE id = ?',
      [firstName, lastName, phoneNumber, birthDate, req.user.id]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;