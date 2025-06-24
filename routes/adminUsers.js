// Admin API Routes
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Ensure this points to your DB connection
const bcrypt = require('bcryptjs'); // Using bcryptjs instead of bcrypt
const crypto = require('crypto');
// const { sendPasswordResetEmail } = require('../email-service'); // Adjust path as needed

// // Middleware to ensure admin access
// const ensureAdmin = (req, res, next) => {
// //   if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
// //     return res.status(403).json({ error: 'Unauthorized access' });
// //   }
//   next();
// };

// Apply admin middleware to all routes
// router.use(ensureAdmin);

// Get user details by username
router.get('/user-info/:username', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    let { username } = req.params;
    // Trim and convert to lowercase for consistency
    username = username.trim().toLowerCase();
    
    // Fetch user details using a case-insensitive comparison
    const [userRows] = await connection.query(
      'SELECT * FROM users WHERE LOWER(username) = ?',
      [username]
    );
    
    // Ensure we have a user before proceeding
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let userId = userRows[0].user_id;

    // Fetch user account details if you have an accounts table
    let accountData = null;
    try {
      const [userAccRows] = await connection.query(
        'SELECT * FROM accounts WHERE user_id = ?',
        [userRows[0].user_id]
      );
      accountData = userAccRows[0];
    } catch (err) {
      console.log('No account data found or accounts table does not exist');
    }
    
    // Fetch transactions involving the user as sender or receiver
    // const [transactionRows] = await connection.query(
    //   `SELECT * FROM transactions
    //    WHERE receiving_user = ? OR sending_user = ?
    //    ORDER BY created_at DESC`,
    //   [username, username]
    // );

    console.log('User ID:', userId);

    const [transactionRows] = await connection.query(
      'SELECT * FROM transactions WHERE sender_account_id = ? OR recipient_account_id = ? OR recipient_account_id = ? OR sender_account_id = ?',
      [userId, userId, userId, userId]
    );


    

      // Fetch transactions involving the user as sender or receiver
      const [contentRows] = await connection.query(
        `SELECT * FROM public_content
         WHERE host_username = ? 
         ORDER BY created_at DESC`,
        [username]
      );
      
    
    res.json({ 
      user: userRows[0], 
      transactions: transactionRows,
      account: accountData,
      public_content: contentRows
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

// Update user data
router.post('/update-user', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    
    // Extract user data from request body
    const userData = req.body;
    
    // Validate required fields
    if (!userData.id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Start building the update query
    let updateFields = [];
    let updateValues = [];
    
    // Loop through the user data and add fields to be updated
    for (const [key, value] of Object.entries(userData)) {
      // Skip the id and user_id fields as they are used for identification
      if (key !== 'id' && key !== 'user_id') {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    }
    
    // Add the WHERE clause value
    updateValues.push(userData.id);
    
    // Build and execute the SQL query
    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    const [result] = await connection.query(updateQuery, updateValues);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found or no changes made' });
    }
    
    res.json({ success: true, message: 'User data updated successfully' });
  } catch (error) {
    console.error('Error updating user data:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

// Reset user password
router.post('/reset-password/:userId', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const { userId } = req.params;
    
    // Generate a random password
    const newPassword = crypto.randomBytes(8).toString('hex');
    
    // Hash the new password - bcryptjs version
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Get user email for sending the reset password
    const [userRows] = await connection.query(
      'SELECT email, username FROM users WHERE id = ?',
      [userId]
    );
    
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userEmail = userRows[0].email;
    const username = userRows[0].username;
    
    // Update the user's password and salt in the database
    const [result] = await connection.query(
      'UPDATE users SET password = ?, salt = ? WHERE id = ?',
      [hashedPassword, salt, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Failed to update password' });
    }
    
    // Send the new password to the user's email
    // await sendPasswordResetEmail(userEmail, username, newPassword);
    
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

// Disable user account
router.post('/disable-user/:userId', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const { userId } = req.params;
    
    // Update the user's status to disabled
    const [result] = await connection.query(
      'UPDATE users SET status = "disabled" WHERE id = ?',
      [userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found or already disabled' });
    }
    
    res.json({ success: true, message: 'User account disabled successfully' });
  } catch (error) {
    console.error('Error disabling user account:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

// Enable user account
router.post('/enable-user/:userId', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const { userId } = req.params;
    
    // Update the user's status to active
    const [result] = await connection.query(
      'UPDATE users SET status = "active" WHERE id = ?',
      [userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found or already active' });
    }
    
    res.json({ success: true, message: 'User account enabled successfully' });
  } catch (error) {
    console.error('Error enabling user account:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;