// routes/adminPurchases.js
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

  // Optional filter by purchase status
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  // Sorting
  query += ` ORDER BY ${sortField} ${sortDirection}`;

  return { query, params };
}

// 1) Fetch Purchases in Last 48 Hours
router.get('/purchases', async (req, res) => {
  try {
    const { query, params } = buildSearchAndFilter(req.query);
    const sql = `
      SELECT id, username, amount, date, status, reference_code, transactionId, created_at
      FROM purchases
      ${query}
    `;
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching recent purchases:', error);
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


// 3) Confirm (Complete) a Purchase
router.post('/confirm-purchase/:purchaseId', async (req, res) => {
  const { purchaseId } = req.params;
  const { username, increaseAmount = 0, created_at } = req.body;

  // Example: increase the user’s account balance and change purchase status
  try {
    await db.query('START TRANSACTION');

    // Update the purchase status
    await db.query(
      'UPDATE purchases SET status = ? WHERE id = ?',
      ['Completed', purchaseId]
    );
    await db.query(
      'UPDATE transactions SET status = ? WHERE created_at = ? AND receiving_user = ?',
      ['Completed', created_at, username]
    );

    // Increase user’s account balance (assuming an 'accounts' table or a field in 'users')
    // Modify this to match your schema (if storing balance in 'users', or a separate accounts table)
    await db.query(
      'UPDATE accounts SET spendable = spendable + ? WHERE user_id = (SELECT user_id FROM users WHERE username = ?)',
      [increaseAmount, username]
    );
    // Create Notification
    //  const { type, recipient_user_id, recipient_username, Nmessage, from_user, date } = req.body;
    //  console.log("New notification: ", Nmessage);

    // Fetch user details
    const [user] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );



    let notificationMsg = `Hoo-ray, Your purchase of ${increaseAmount} coins has been confirmed and processed!`

    try {
      const [result] = await db.query(
        `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
    VALUES (?, ?, ?, ?, ?, ?)`,
        ["purchase-confirmed", user.user_id, notificationMsg, "0", user.username, new Date()]
      );

      console.log("New notification successfully created:", notificationMsg);
      // res.status(201).json({ message: 'Notification created successfully', id: result.insertId });
    } catch (error) {
      console.error('Error creating notification:', error);
      // res.status(500).json({ message: 'Server error' });
    }

    await db.query('COMMIT');

    res.json({ message: 'Purchase confirmed and user balance updated.' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error confirming purchase:', error);
    res.status(500).json({ message: 'Failed to confirm purchase.' });
  }
});


// 4) Reject (Deny) a Purchase
router.post('/reject-purchase/:purchaseId', async (req, res) => {
  const { purchaseId } = req.params;
  const { username, increaseAmount = 0, created_at } = req.body;

  // Example: increase the user’s account balance and change purchase status
  try {
    await db.query('START TRANSACTION');

    // Update the purchase status
    await db.query(
      'UPDATE purchases SET status = ? WHERE id = ?',
      ['Rejected', purchaseId]
    );

    await db.query('COMMIT');

    res.json({ message: 'Logged purchase rejected. User balance unchanged.' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error rejecting purchase:', error);
    res.status(500).json({ message: 'Failed to reject purchase.' });
  }
});

module.exports = router;