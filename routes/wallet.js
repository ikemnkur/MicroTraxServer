const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const [walletData] = await db.query(
      `SELECT a.balance, at.name as accountTier, at.daily_transaction_limit
       FROM accounts a
       JOIN user_tiers ut ON a.user_id = ut.user_id
       JOIN account_tiers at ON ut.tier_id = at.id
       WHERE a.user_id = ? AND ut.end_date IS NULL`,
      [req.user.id]
    );

    if (walletData.length === 0) {
      return res.status(404).json({ message: 'Wallet data not found' });
    }

    res.json(walletData[0]);
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;