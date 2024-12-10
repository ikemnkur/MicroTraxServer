
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.user_id, u.username, u.email, u.user_id, u.firstName, u.lastName, u.phoneNumber, u.birthDate, u.unlocks, u.subscriptions,
              u.accountTier, a.balance, a.spendable, a.redeemable, u.bio, u.encryptionKey, u.account_id
       FROM users u
       LEFT JOIN accounts a ON u.user_id = a.user_id
       WHERE u.user_id = ?`,
      [req.user.user_id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = users[0];
    // console.log("Get.Body: ", user);
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
        'UPDATE users SET username = ?, email = ?, firstName = ?, lastName = ?, phoneNumber = ?, birthDate = ?, encryptionKey = ?, profilePic = ?, accountTier = ? WHERE user_id = ?',
        [username, email, firstName, lastName, phoneNumber, birthDate, encryptionKey, profilePic, accountTier, req.user.user_id]
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

router.put('/user-data', authenticateToken, async (req, res) => {
  const { data } = req.body;
  console.log("Put.Body: ", req.body);
  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Update user information
      await connection.query(
        'UPDATE users SET data = ? WHERE user_id = ?',
        [data, req.user.user_id]
      );
      console.log()
      await connection.commit();
      res.json({ message: 'User-Data updated successfully' });
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

// Fetch user's balance and account ID
router.get('/user-balance', authenticateToken, async (req, res) => {
  try {
    const [account] = await db.query(
      'SELECT balance, spendable, redeemable FROM accounts WHERE user_id = ?',
      [req.user.user_id]
    );
    if (account.length === 0) {
      return res.status(404).json({ message: 'Account not found' });
    }
    res.json({ balance: account[0].balance, spendable: account[0].spendable, redeemable: account[0].redeemable,  });
  } catch (error) {
    console.error('Error fetching user balance:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    console.log('User ID from token:', req.user.user_id);
    console.log('req.user:', req.user);
    
    
    // Fetch user data along with account ID
    const [userData] = await db.query(
      `SELECT u.user_id AS userId, a.id AS accountId, a.balance, u.accountTier
       FROM users u
       LEFT JOIN accounts a ON u.user_id = a.user_id
       WHERE u.user_id = ?`,
      [req.user.user_id]
    );
    console.log('User Data:', userData);

    if (!userData || userData.length === 0) {
      return res.status(404).json({ message: 'User data not found' });
    }
    
    const id = userData[0].userId;
    const accountId = userData[0].accountId;
    if (!accountId) {
      return res.status(404).json({ message: 'Account ID not found for the user' });
    }

    // Aggregate transaction data
    const [transactions] = await db.query(
      `SELECT
         COUNT(CASE 
               WHEN (sender_account_id = ? OR recipient_account_id = ?) 
                    AND created_at >= NOW() - INTERVAL 1 DAY 
               THEN 1 
             END) AS transactionsLast24Hours,
         COUNT(CASE 
               WHEN (sender_account_id = ? OR recipient_account_id = ?) 
                    AND DATE(created_at) = CURDATE() 
               THEN 1 
             END) AS transactionsToday,
         SUM(CASE 
               WHEN (sender_account_id = ? OR recipient_account_id = ?) 
                    AND DATE(created_at) = CURDATE() 
               THEN amount 
               ELSE 0 
             END) AS totalAmountToday,
         COUNT(CASE 
               WHEN sender_account_id = ? 
                    AND DATE(created_at) = CURDATE() 
               THEN 1 
             END) AS sentTransactions,
         COUNT(CASE 
               WHEN recipient_account_id = ? 
                    AND DATE(created_at) = CURDATE() 
               THEN 1 
             END) AS receivedTransactions,
         SUM(CASE
               WHEN sender_account_id = ? AND created_at >= NOW() - INTERVAL 1 DAY
               THEN amount ELSE 0
             END) AS totalAmountSentLast24Hours,
         SUM(CASE
               WHEN recipient_account_id = ? AND created_at >= NOW() - INTERVAL 1 DAY
               THEN amount ELSE 0
             END) AS totalAmountReceivedLast24Hours,
         SUM(CASE
               WHEN sender_account_id = ? AND DATE(created_at) = CURDATE()
               THEN amount ELSE 0
             END) AS totalAmountSentToday,
         SUM(CASE
               WHEN recipient_account_id = ? AND DATE(created_at) = CURDATE()
               THEN amount ELSE 0
             END) AS totalAmountReceivedToday
       FROM transactions
       WHERE (sender_account_id = ? OR recipient_account_id = ?)`,
      [
        accountId, accountId, // For transactionsLast24Hours
        accountId, accountId, // For transactionsToday
        accountId, accountId, // For totalAmountToday
        accountId,            // For sentTransactions
        accountId,            // For receivedTransactions
        accountId,            // For totalAmountSentLast24Hours
        accountId,            // For totalAmountReceivedLast24Hours
        accountId,            // For totalAmountSentToday
        accountId,            // For totalAmountReceivedToday
        id, id  // For the WHERE clause
      ]
    );
    console.log('Transactions:', transactions);

    // Define daily limits based on account tier
    const dailyLimits = {
      1: 100,    // Basic
      2: 500,    // Standard
      3: 1000,   // Premium
      4: 5000,   // Gold
      5: 10000,  // Platinum
      6: 50000,  // Diamond
      7: 100000  // Ultimate
    };

    const dashboardData = {
      balance: userData[0].balance ?? 0,
      spendable: userData[0].spendable ?? 0,
      redeemable: userData[0].redeemable ?? 0,
      accountTier: userData[0].accountTier ?? 1,
      dailyLimit: dailyLimits[userData[0].accountTier] ?? 100, // Default to 100 if not found
      transactionsLast24Hours: transactions[0].transactionsLast24Hours || 0,
      transactionsToday: transactions[0].transactionsToday || 0,
      totalAmountToday: transactions[0].totalAmountToday ? parseFloat(transactions[0].totalAmountToday) : 0,
      sentTransactions: transactions[0].sentTransactions || 0,
      receivedTransactions: transactions[0].receivedTransactions || 0,
      // New fields
      totalAmountSentLast24Hours: transactions[0].totalAmountSentLast24Hours ? parseFloat(transactions[0].totalAmountSentLast24Hours) : 0,
      totalAmountReceivedLast24Hours: transactions[0].totalAmountReceivedLast24Hours ? parseFloat(transactions[0].totalAmountReceivedLast24Hours) : 0,
      totalAmountSentToday: transactions[0].totalAmountSentToday ? parseFloat(transactions[0].totalAmountSentToday) : 0,
      totalAmountReceivedToday: transactions[0].totalAmountReceivedToday ? parseFloat(transactions[0].totalAmountReceivedToday) : 0
    };

    console.log('Dashboard Data:', dashboardData);
    res.json(dashboardData);
  } catch (error) {
    console.error('Error in dashboard route:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 1. GET /user/:userIdOrUsername/profile - Fetch user profile
router.get('/:username/profile', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    let query, params;
    console.log(username);

    // Check if the parameter is a number (userId) or a string (username)
    
      // It's a username
      query = `
        SELECT u.user_id, u.username, u.email, u.accountTier, u.favorites, u.bio, u.rating, u.user_id
        FROM users u
        LEFT JOIN accounts a ON u.user_id = a.user_id
        WHERE u.username = ?
      `;
      params = [username];
    

    const [users] = await db.query(query, params);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    // Check if the viewed user is in the current user's favorites
    const isFavorite = user.favorites ? JSON.parse(user.favorites).includes(req.user.user_id) : false;

    // Remove sensitive information before sending
    delete user.password;
    delete user.salt;

    res.json({ ...user, isFavorite });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 1. GET /user/:userIdOrUsername/profile - Fetch user profile
router.get('/id/:userIdOrUsername/profile', authenticateToken, async (req, res) => {
  try {
    const { userIdOrUsername } = req.params;
    let query, params;
    console.log("/id/:userIdOrUsername/profile: ", userIdOrUsername);

  
    // Check if the parameter is a number (userId) or a string (username)
    if (/^\d+$/.test(userIdOrUsername)) {
      // It's a userId
      query = `
        SELECT u.user_id, u.username, u.email, a.balance, u.accountTier, u.favorites, u.bio, u.rating, u.user_id
        FROM users u
        LEFT JOIN accounts a ON u.user_id = a.user_id
        WHERE u.user_id = ?
      `;
      params = [userIdOrUsername];
    } else {
      // It's a username
      query = `
         SELECT u.user_id, u.username, u.email, a.balance, u.accountTier, u.favorites, u.bio, u.rating, u.user_id
        FROM users u
        LEFT JOIN accounts a ON u.user_id = a.user_id
        WHERE u.user_id = ?
      `;
      params = [userIdOrUsername];
    }

    const [users] = await db.query(query, params);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    // Check if the viewed user is in the current user's favorites
    const isFavorite = user.favorites ? JSON.parse(user.favorites).includes(req.user.user_id) : false;

    // Remove sensitive information before sending
    delete user.password;
    delete user.salt;

    res.json({ ...user, isFavorite });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add rating
router.post('/add-rating', authenticateToken, async (req, res) => {
  const { rateduserId, rating, user_id } = req.body;
  try {
      // Update the average rating
      await db.query(
          'INSERT INTO user_ratings (rated_user_id, user_id, rating) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rating = ?',
          [rateduserId, req.user.user_id, rating]
      );
      console.log("Rating Posted: ", rating)
      // Recalculate the average rating
      const [rows] = await db.query(
          'SELECT AVG(rating) as avgRating FROM content_ratings WHERE content_id = ?',
          [rateduserId]
      );
      const avgRating = rows[0].avgRating;

      await db.query(
          'UPDATE users SET rating = ? WHERE id = ?',
          [avgRating, rateduserId]
      );

      res.status(200).json({ message: 'Rating submitted', avgRating });
  } catch (error) {
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
      const [users] = await connection.query('SELECT favorites FROM users WHERE id = ?', [req.user.user_id]);
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
      await connection.query('UPDATE users SET favorites = ? WHERE id = ?', [JSON.stringify(favorites), req.user.user_id]);

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
      [req.user.user_id, reportedUserId, reportMessage]
    );

    res.status(201).json({ message: 'Report submitted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
