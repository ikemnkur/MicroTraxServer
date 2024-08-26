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
       LEFT JOIN accounts a ON u.id = a.user_id
       LEFT JOIN user_tiers ut ON u.id = ut.user_id AND ut.end_date IS NULL
       LEFT JOIN account_tiers at ON ut.tier_id = at.id
       WHERE u.id = ?`,
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
  const { username, email, firstName, lastName, phoneNumber, birthDate, accountTier, encryptionKey, profilePic } = req.body;
  console.log("Body: " , req.body)
  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Update user information
      await connection.query(
        'UPDATE users SET username = ?, email = ?, firstName = ?, lastName = ?, phoneNumber = ?, birthDate = ?, encryptionKey = ?, profilePic = ?, accountTier = ? WHERE id = ?',
        [username, email, firstName, lastName, phoneNumber, birthDate, encryptionKey, profilePic, accountTier, req.user.id]
      );

      // If account tier is provided, update it
      if (accountTier !== undefined) {
        await connection.query(
          'UPDATE user_tiers SET end_date = CURRENT_TIMESTAMP WHERE user_id = ? AND end_date IS NULL',
          [req.user.id]
        );
        await connection.query(
          'INSERT INTO user_tiers (user_id, tier_id, start_date) VALUES (?, ?, CURRENT_TIMESTAMP)',
          [req.user.id, accountTier]
        );
      }

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


router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    console.log('User ID from token:', req.user.id);

    const [userData] = await db.query(
      `SELECT u.id, a.balance, at.name as accountTier, at.daily_transaction_limit as dailyLimit
       FROM users u
       LEFT JOIN accounts a ON u.id = a.user_id
       LEFT JOIN user_tiers ut ON u.id = ut.user_id
       LEFT JOIN account_tiers at ON ut.tier_id = at.id
       WHERE u.id = ? AND (ut.end_date IS NULL OR ut.end_date > CURRENT_DATE())
       ORDER BY ut.start_date DESC
       LIMIT 1`,
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

    const dashboardData = {
      balance: userData[0].balance ?? 0,
      accountTier: userData[0].accountTier ?? 'Not Set',
      dailyLimit: userData[0].dailyLimit ?? 0,
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


// 1. GET /user/:userId/profile - Fetch user profile
router.get('/:userId/profile', authenticateToken, async (req, res) => {
  try {
    console.log("ID: ", req.user.id)
    const [users] = await db.query(
      `SELECT u.id, u.username, u.email, u.firstName, u.lastName, u.phoneNumber, u.birthDate, 
              a.balance, at.name as accountTier, at.daily_transaction_limit, at.monthly_fee,
              u.favorites
       FROM users u
       LEFT JOIN accounts a ON u.id = a.user_id
       LEFT JOIN user_tiers ut ON u.id = ut.user_id AND ut.end_date IS NULL
       LEFT JOIN account_tiers at ON ut.tier_id = at.id
       WHERE u.id = ?`,
      // [req.params.userId]
      [req.user.id]
    );
    
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


// // In routes/user.js
// router.get('/dashboard', authenticateToken, async (req, res) => {
//   try {

//     console.log('User ID from token:', req.user.id);

//     // Check users table
//     const [user] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
//     console.log('User:', user);

//     // Check accounts table
//     const [account] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [req.user.id]);
//     console.log('Account:', account);

//     // Check user_tiers table
//     const [userTier] = await db.query('SELECT * FROM user_tiers WHERE user_id = ?', [req.user.id]);
//     console.log('User Tier:', userTier);

//     // Check account_tiers table
//     if (userTier && userTier.length > 0) {
//       const [accountTier] = await db.query('SELECT * FROM account_tiers WHERE id = ?', [userTier[0].tier_id]);
//       console.log('Account Tier:', accountTier);
//     }

//     const [userData] = await db.query(
//       `SELECT u.id, a.balance, at.name as accountTier, at.daily_transaction_limit as dailyLimit
//        FROM users u
//        LEFT JOIN accounts a ON u.id = a.user_id
//        LEFT JOIN user_tiers ut ON u.id = ut.user_id
//        LEFT JOIN account_tiers at ON ut.tier_id = at.id
//        WHERE u.id = ? AND (ut.end_date IS NULL OR ut.end_date > CURRENT_DATE())`,
//       [req.user.id]
//     );

//     // const [userData] = await db.query(
//     //   `SELECT u.id, a.balance, at.name as accountTier, at.daily_transaction_limit as dailyLimit
//     //    FROM users u
//     //    LEFT JOIN accounts a ON u.id = a.user_id
//     //    LEFT JOIN user_tiers ut ON u.id = ut.user_id
//     //    LEFT JOIN account_tiers at ON ut.tier_id = at.id
//     //    WHERE u.id = ? AND (ut.end_date IS NULL OR ut.end_date > CURRENT_DATE())`,
//     //   [req.user.id]
//     // );

//     if (!userData) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     const [transactions] = await db.query(
//       `SELECT 
//          SUM(CASE WHEN sender_account_id = ? THEN 1 ELSE 0 END) as sentTransactions,
//          SUM(CASE WHEN recipient_account_id = ? THEN 1 ELSE 0 END) as receivedTransactions
//        FROM transactions
//        WHERE (sender_account_id = ? OR recipient_account_id = ?)
//          AND DATE(created_at) = CURDATE()`,
//       [userData.id, userData.id, userData.id, userData.id]
//     );

//     // const dashboardData = {
//     //   balance: userData.balance,
//     //   accountTier: userData.accountTier,
//     //   dailyLimit: userData.dailyLimit,
//     //   sentTransactions: transactions.sentTransactions || 0,
//     //   receivedTransactions: transactions.receivedTransactions || 0
//     // };

//     const dashboardData = {
//       balance: userData[0]?.balance ?? 0,
//       accountTier: userData[0]?.accountTier ?? 'Not Set',
//       dailyLimit: userData[0]?.dailyLimit ?? 0,
//       sentTransactions: transactions.sentTransactions || 0,
//       receivedTransactions: transactions.receivedTransactions || 0
//     };
    
//     console.log('Dashboard Data:', dashboardData);
//     res.json(dashboardData);

  
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

module.exports = router;