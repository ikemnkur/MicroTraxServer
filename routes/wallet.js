const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// const express = require('express');
// const router = express.Router();
const { v4: uuidv4 } = require('uuid');
// const db = require('../db');
// const { authenticateToken } = require('../middleware/auth');

// router.post('/reload', authenticateToken, async (req, res) => {
//   const { username, amount, date, stripe } = req.body;
//   console.log("reloading: ", amount);
  
//   try {
//     // Check for duplicates
//     const row = await db.query(
//       'SELECT * FROM purchases WHERE username = ? AND amount = ? AND stripe = ? AND date = ?',
//       [username, amount, stripe, date]
//     );
    
//     console.log("Result: ", row);
    
//     if (row !== null)
//       return

//     // Start a transaction
//     await db.query('START TRANSACTION');

//     // Insert into purchases table
//     await db.query(
//       'INSERT INTO purchases (username, userid, amount, reference_code, stripe, date) VALUES (?, ?, ?, ?, ?, ?)',
//       [username, req.user.id, amount, uuidv4(), stripe, date]
//     );

//     // Update user's coin balance
//     await db.query(
//       'UPDATE accounts SET balance = balance + ? WHERE user_id = ?',
//       [amount, req.user.id]
//     );

//     // Commit the transaction
//     await db.query('COMMIT');

//     res.status(201).json({ message: 'Wallet reloaded successfully' });
//   } catch (error) {
//     // If there's an error, rollback the transaction
//     await db.query('ROLLBACK');
//     console.error('Error reloading wallet:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.post('/reload', authenticateToken, async (req, res) => {
  const { username, amount, date, stripe, session_id } = req.body;
  console.log("Reloading amount: ", amount);
  console.log("Session ID: ", session_id);
  
  try {
    // Check for duplicates
    const [rows, fields] = await db.query(
      'SELECT * FROM purchases WHERE username = ? AND amount = ? AND sessionID = ?',
      [username, amount, session_id]
    );
    
    console.log("Duplicate Check Result: ", rows);
    
    if (rows.length > 0) {
      // Duplicate found, send a 409 Conflict response
      return res.status(409).json({ message: 'Duplicate purchase detected' });
    }

    // Start a transaction
    await db.query('START TRANSACTION');

    // Insert into purchases table
    await db.query(
      'INSERT INTO purchases (username, userid, amount, reference_code, stripe, date, sessionID) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, req.user.id, amount, uuidv4(), stripe, date, session_id]
    );

    // Update user's coin balance
    await db.query(
      'UPDATE accounts SET balance = balance + ? WHERE user_id = ?',
      [amount, req.user.id]
    );

    // Commit the transaction
    await db.query('COMMIT');

    res.status(201).json({ message: 'Wallet reloaded successfully' });
  } catch (error) {
    // If there's an error, rollback the transaction
    await db.query('ROLLBACK');
    console.error('Error reloading wallet:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    // const [walletData] = await db.query(
    //   `SELECT a.balance, at.name as accountTier, at.daily_transaction_limit, at.spendable, at.redeemable,
    //    FROM accounts a
    //    JOIN user_tiers ut ON a.user_id = ut.user_id
    //    JOIN account_tiers at ON ut.tier_id = at.id
    //    WHERE a.user_id = ? AND ut.end_date IS NULL`,
    //   [req.user.id]
    // );

    const [walletData] = await db.query(
      `SELECT 
         a.balance, 
         a.spendable, 
         a.redeemable,
         at.name AS accountTier, 
         at.daily_transaction_limit
         
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

// router.post('/reload', authenticateToken, async (req, res) => {
  
//   const { username, amount, date } = req.body;
//   console.log("redloading: ", amount)
//   try {

//     await db.query(
//       'INSERT INTO purchases (username, userid, amount, reference_code) VALUES (?, ?, ?, ?)',
//       [username, req.user.id, amount, uuidv4()]
//     );
//     res.status(201).json({ message: 'Content added successfully' });

//   } catch (error) {
//     console.error('Error post purchase data:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.post('/withdraw', authenticateToken, async (req, res) => {
  const { username, amount, date } = req.body;
  console.log("withdrawing: ", amount)
  try {

    await db.query(
      'INSERT INTO withdraws (username, userid, amount, reference_code) VALUES (?, ?, ?, ?)',
      [username, req.user.id, amount, uuidv4()]
    );
    res.status(201).json({ message: 'Content added successfully' });

  } catch (error) {
    console.error('Error post purchase data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;