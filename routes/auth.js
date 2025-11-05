const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
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
    const connection = await db.getConnection();
    await connection.beginTransaction();
    try {
      const [existingUsers] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
      if (existingUsers.length > 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'User already exists' });
      }
      const { salt, hash } = hashPassword(password);
      const accountId = `ACC${Date.now()}`;
      const user_Id = uuidv4()
      // Insert user
      const [userResult] = await connection.query(
        'INSERT INTO users (username, email, password, salt, account_id, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [username, email, hash, salt, accountId, user_Id]
      );
      const userId = userResult.insertId;
      // Insert account with default balance
      const defaultBalance = 25;
      await connection.query(
        'INSERT INTO accounts (user_id, account_id, balance, userId) VALUES (?, ?, ?, ?)',
        [user_Id, accountId, defaultBalance, 0]
      );
      // Check if the default tier exists
      const defaultTierId = 1;
      const [tiers] = await connection.query('SELECT id FROM account_tiers WHERE id = ?', [defaultTierId]);
      if (tiers.length === 0) {
        throw new Error('Default account tier does not exist');
      }
      // Insert default account tier
      await connection.query(
        'INSERT INTO user_tiers (user_id, tier_id, start_date) VALUES (?, ?, CURRENT_DATE())',
        [userId, defaultTierId]
      );

      // Create Notification
      let notificationMsg = `Welcome, ${username}, please start by funding your account, go to the wallet section to begin!`

      try {
        const [result] = await db.query(
          `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
         VALUES (?, ?, ?, ?, ?, ?)`,
          ["welcome", userId, notificationMsg, "0", username, new Date()]
        );
        console.log("New notification successfully created:", notificationMsg);
      } catch (error) {
        console.error('Error creating notification:', error);
        // Continue with the transaction even if notification fails
      }

      await connection.commit();

      // ✅ Fixed: Use the actual variables you have
      const token = jwt.sign({
        id: userId,           // Use userId (the insertId from MySQL)
        user_id: user_Id,     // Use user_Id (the UUID you generated)
        username: username,   // Use username from req.body
        accountId: accountId  // Use accountId you generated
      }, process.env.JWT_SECRET, { expiresIn: '1h' });

      res.status(201).json({
        token,
        user: {
          id: userId,
          user_id: user_Id,  // Include this for consistency
          username,
          email,
          accountId
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', details: error.message });
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

    // const token = jwt.sign({ id: user.id, user_id: user.user_id, accountId: user.account_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const token = jwt.sign({
      id: user.id,
      user_id: user.user_id,
      username: user.username,  // Add this line
      accountId: user.accountId
    }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, user: { id: user.id, username: user.username, email: user.email, accountId: user.account_id } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;