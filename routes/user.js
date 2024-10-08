
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.id, u.username, u.email, u.firstName, u.lastName, u.phoneNumber, u.birthDate, 
              u.accountTier, a.balance, u.bio, u.encryptionKey
       FROM users u
       LEFT JOIN accounts a ON u.id = a.user_id
       WHERE u.id = ?`,
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = users[0];
    console.log("Get.Body: ", user);
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  const { username, email, firstName, lastName, phoneNumber, birthDate, accountTier, encryptionKey, profilePic } = req.body;
  console.log("Put.Body: ", req.body);
  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Update user information
      await connection.query(
        'UPDATE users SET username = ?, email = ?, firstName = ?, lastName = ?, phoneNumber = ?, birthDate = ?, encryptionKey = ?, profilePic = ?, accountTier = ? WHERE id = ?',
        [username, email, firstName, lastName, phoneNumber, birthDate, encryptionKey, profilePic, accountTier, req.user.id]
      );
      console.log()
      await connection.commit();
      res.json({ message: 'Profile updated successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch user's balance
router.get('/user-balance', authenticateToken, async (req, res) => {
  try {
      const [account] = await db.query(
          'SELECT balance FROM accounts WHERE user_id = ?',
          [req.user.id]
      );
      if (account.length === 0) {
          return res.status(404).json({ message: 'Account not found' });
      }
      res.json({ balance: account[0].balance });
  } catch (error) {
      res.status(500).json({ message: 'Server error' });
  }
});

router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    console.log('User ID from token:', req.user.id);
    const [userData] = await db.query(
      `SELECT u.id, a.balance, u.accountTier
       FROM users u
       LEFT JOIN accounts a ON u.id = a.user_id
       WHERE u.id = ?`,
      [req.user.id]
    );
    console.log('User Data:', userData);

    if (!userData || userData.length === 0) {
      return res.status(404).json({ message: 'User data not found' });
    }

    const [transactions] = await db.query(
      `SELECT
         COUNT(CASE WHEN sender_account_id = ? THEN 1 END) as sentTransactions,
         COUNT(CASE WHEN recipient_account_id = ? THEN 1 END) as receivedTransactions
       FROM transactions
       WHERE (sender_account_id = ? OR recipient_account_id = ?)
         AND DATE(created_at) = CURDATE()`,
      [userData[0].id, userData[0].id, userData[0].id, userData[0].id]
    );
    console.log('Transactions:', transactions);

    // Define daily limits based on account tier
    const dailyLimits = {
      1: 100,   // Basic
      2: 500,   // Standard
      3: 1000,  // Premium
      4: 5000,  // Gold
      5: 10000, // Platinum
      6: 50000, // Diamond
      7: 100000 // Ultimate
    };

    const dashboardData = {
      balance: userData[0].balance ?? 0,
      accountTier: userData[0].accountTier ?? 1,
      dailyLimit: dailyLimits[userData[0].accountTier] ?? 100, // Default to 100 if not found
      sentTransactions: transactions[0].sentTransactions || 0,
      receivedTransactions: transactions[0].receivedTransactions || 0
    };

    console.log('Dashboard Data:', dashboardData);
    res.json(dashboardData);
  } catch (error) {
    console.error('Error in dashboard route:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// 1. GET /user/:userIdOrUsername/profile - Fetch user profile
router.get('/:userIdOrUsername/profile', authenticateToken, async (req, res) => {
  try {
    const { userIdOrUsername } = req.params;
    let query, params;
    console.log(userIdOrUsername);

    // Check if the parameter is a number (userId) or a string (username)
    if (/^\d+$/.test(userIdOrUsername)) {
      // It's a userId
      query = `
        SELECT u.id, u.username, u.email, u.firstName, u.lastName, u.phoneNumber, u.birthDate,
               a.balance, u.accountTier, u.favorites, u.bio
        FROM users u
        LEFT JOIN accounts a ON u.id = a.user_id
        WHERE u.id = ?
      `;
      params = [userIdOrUsername];
    } else {
      // It's a username
      query = `
        SELECT u.id, u.username, u.email, u.firstName, u.lastName, u.phoneNumber, u.birthDate,
               a.balance, u.accountTier, u.favorites, u.bio
        FROM users u
        LEFT JOIN accounts a ON u.id = a.user_id
        WHERE u.username = ?
      `;
      params = [userIdOrUsername];
    }

    const [users] = await db.query(query, params);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    // Check if the viewed user is in the current user's favorites
    const isFavorite = user.favorites ? JSON.parse(user.favorites).includes(req.user.id) : false;

    // Remove sensitive information before sending
    delete user.password;
    delete user.salt;

    res.json({ ...user, isFavorite });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 2. PUT /user/:userId/favorite - Update favorite status
router.put('/:userId/favorite', authenticateToken, async (req, res) => {
  const { isFavorite } = req.body;
  const favoriteUserId = req.params.userId;

  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Get current user's favorites
      const [users] = await connection.query('SELECT favorites FROM users WHERE id = ?', [req.user.id]);
      let favorites = users[0].favorites ? JSON.parse(users[0].favorites) : [];

      if (isFavorite) {
        // Add to favorites if not already present
        if (!favorites.includes(favoriteUserId)) {
          favorites.push(favoriteUserId);
        }
      } else {
        // Remove from favorites
        favorites = favorites.filter(id => id !== favoriteUserId);
      }

      // Update favorites
      await connection.query('UPDATE users SET favorites = ? WHERE id = ?', [JSON.stringify(favorites), req.user.id]);

      await connection.commit();
      res.json({ message: isFavorite ? 'User added to favorites' : 'User removed from favorites' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 3. POST /user/:userId/report - Submit a report
router.post('/:userId/report', authenticateToken, async (req, res) => {
  const { reportMessage } = req.body;
  const reportedUserId = req.params.userId;

  try {
    await db.query(
      'INSERT INTO user_reports (reporter_id, reported_user_id, report_message) VALUES (?, ?, ?)',
      [req.user.id, reportedUserId, reportMessage]
    );

    res.status(201).json({ message: 'Report submitted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
