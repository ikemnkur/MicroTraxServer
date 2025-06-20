// routes/adminwithdraws.js
const express = require('express');
const db = require('../config/db'); // Ensure this points to your DB connection
const router = express.Router();

// Utility function to build search/filter query fragments
function buildSearchAndFilter(queryParams) {
  const { search, status, sortField = 'created_at', sortDirection = 'DESC' } = queryParams;
  let query = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)';
  let params = [];

  // Add a basic search by username or reference_code, etc.
  if (search) {
    query += ` AND (username LIKE ? OR reference_code LIKE ? OR transactionId LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Optional filter by withdraw status
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  // Sorting
  query += ` ORDER BY ${sortField} ${sortDirection}`;

  return { query, params };
}

// 1) Fetch withdraws in Last 48 Hours
router.get('/withdraws', async (req, res) => {
  try {
    const { query, params } = buildSearchAndFilter(req.query);
    const sql = `
      SELECT id, username, amount, date, status, reference_id, transactionId, created_at
      FROM withdraws
      ${query}
    `;
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching recent withdraws:', error);
    res.sendStatus(500);
  }
});

// 2) Get user details and transactions by username
router.get('/user-info/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Fetch user details
    const [userRows] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    console.log("UR: ", userRows)

    // Fetch user details
    const [userAccRows] = await db.query(
      'SELECT * FROM accounts WHERE user_id = ?',
      [userRows[0].user_id]
    );

    const user = userRows.length ? userRows[0] : null;
    const userAcc = userAccRows.length ? userAccRows[0] : null;

    // Fetch transactions involving the user as sender or receiver
    const [transactionRows] = await db.query(
      `SELECT * FROM transactions
       WHERE receiving_user = ? OR sending_user = ?
       ORDER BY created_at DESC`,
      [username, username]
    );

    res.json({ user, transactions: transactionRows, account: userAcc });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.sendStatus(500);
  }
});
// Function to convert JavaScript date string to MySQL datetime format
function convertToMySQLDateTime(dateString) {
  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date string');
  }
  
  // Format: YYYY-MM-DD HH:MM:SS
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 3) Confirm (Complete) a Withdraw
router.post('/confirm-withdraw/:withdrawId', async (req, res) => {
  const { withdrawId } = req.params;
  const { username, increaseAmount = 0, created } = req.body;
  console.log("Confirming withdraw for user:", username, "with amount:", increaseAmount, "created on:", created);
  
  // example Withdraw body data
  // {id: '24', username: 'ikemnkur', amount: '5005', status: 'Pending', created: 'Wed Jun 11 2025 05:49:56 GMT-0500 (Central Daylight Time)', reference_id: '24', transactionId: '24'}
  
  try {
    // Convert the date to MySQL format
    const mysqlDateTime = convertToMySQLDateTime(created);
    console.log("Converted date for MySQL:", mysqlDateTime);
    
    await db.query('START TRANSACTION');
    
    // Update the withdraw status
    await db.query(
      'UPDATE withdraws SET status = ? WHERE id = ?',
      ['Completed', withdrawId]
    );
    
    // Update transaction status using the converted MySQL datetime
    await db.query(
      'UPDATE transactions SET status = ? WHERE created_at = ? AND receiving_user = ?',
      ['Completed', mysqlDateTime, username]
    );
    
    // Increase user's account balance (assuming an 'accounts' table or a field in 'users')
    // Modify this to match your schema (if storing balance in 'users', or a separate accounts table)
    await db.query(
      'UPDATE accounts SET spendable = spendable + ? WHERE user_id = (SELECT user_id FROM users WHERE username = ?)',
      [increaseAmount, username]
    );
    
    // Fetch user details
    const [user] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    // Check if user exists
    if (!user || user.length === 0) {
      throw new Error('User not found');
    }
    
    // Create Notification
    let notificationMsg = `Hoo-ray, Your withdrawal of ${increaseAmount} coins has been approved and processed!`
    
    try {
      const [result] = await db.query(
        `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["withdrawal-approved", user[0].user_id, notificationMsg, "0", user[0].username, new Date()]
      );
      console.log("New notification successfully created:", notificationMsg);
    } catch (error) {
      console.error('Error creating notification:', error);
      // Continue with the transaction even if notification fails
    }
    
    await db.query('COMMIT');
    res.json({ message: 'Withdraw confirmed and user balance updated.' });
    
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error confirming withdraw:', error);
    res.status(500).json({ message: 'Failed to confirm withdraw.', error: error.message });
  }
});

// 4) Reject (Deny) a Withdraw
router.post('/reject-withdraw/:withdrawId', async (req, res) => {
  const { withdrawId } = req.params;
  
  try {
    // Begin a MySQL transaction
    await db.query('START TRANSACTION');

    // 1) Update the withdraw status to 'Rejected'
    await db.query(
      'UPDATE withdraws SET status = ? WHERE id = ?',
      ['Rejected', withdrawId]
    );

    // 2) Fetch the updated withdraw record
    const [withdraw] = await db.query(
      'SELECT * FROM withdraws WHERE id = ?',
      [withdrawId]
    );
    if (!withdraw || !withdraw.length) {
      throw new Error('Withdraw not found.');
    }

    // 3) Find the corresponding transaction by reference ID
    const [tx] = await db.query(
      'SELECT * FROM transactions WHERE reference_id = ?',
      [withdraw[0].reference_id]
    );
    if (!tx || !tx.length) {
      throw new Error('Matching transaction not found.');
    }

    // 4) Update the transaction status to 'Rejected'
    await db.query(
      'UPDATE transactions SET status = ? WHERE reference_id = ?',
      ['Rejected', tx[0].reference_id]
    );

    let notificationMsg = `Sorry, Your withdrawl of ${increaseAmount} coins has been rejected! There is an issue within the system transaction logs and the coins have been suspended awaiting manual review.`;

    try {
      const [result] = await db.query(
        `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
    VALUES (?, ?, ?, ?, ?, ?)`,
        ["withdrawl-approved", user.user_id, notificationMsg, "0", user.username, new Date()]
      );

      console.log("New notification successfully created:", notificationMsg);
    } catch (error) {
      console.error('Error creating notification:', error);
      // res.status(500).json({ message: 'Server error' });
    }

    // Commit all changes if everything is successful
    await db.query('COMMIT');

    res.json({ message: 'Withdraw rejected successfully. User balance unchanged.' });
  } catch (error) {
    // Roll back any changes on error
    await db.query('ROLLBACK');
    console.error('Error rejecting withdraw:', error);
    res.status(500).json({ message: 'Failed to reject withdraw.' });
  }
});

module.exports = router;