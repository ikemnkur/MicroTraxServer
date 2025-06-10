// routes/adminPurchases.js
const express = require('express');
const db = require('../config/db'); // Ensure this points to your DB connection
const router = express.Router();

// Utility function to build search/filter query fragments
function buildSearchAndFilter(queryParams) {
  const { search, status, sortField = 'created_at', sortDirection = 'DESC' } = queryParams;
  let query = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)';
  let params = [];

  // Add a basic search by username or reference_id, etc.
  if (search) {
    query += ` AND (username LIKE ? OR reference_id LIKE ? OR transactionId LIKE ?)`;
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
      SELECT * FROM purchases
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
  let connection;
  try {
    connection = await db.getConnection();

    let { username } = req.params;
    // Trim and convert to lowercase for consistency
    username = username.trim().toLowerCase();
    console.log("Username (processed):", username);

    // Fetch user details using a case-insensitive comparison
    const [userRows] = await connection.query(
      'SELECT * FROM users WHERE LOWER(username) = ?',
      [username]
    );
    // console.log("User Rows:", userRows);

    // Test query using a constant works as expected:
    const [userRows1] = await connection.query(
      'SELECT * FROM users WHERE LOWER(username) = ?',
      ["user2".toLowerCase()]
    );
    // console.log("User Rows (literal):", userRows1);

    // Ensure we have a user before proceeding
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch user account details using the user_id from the fetched user
    const [userAccRows] = await db.query(
      'SELECT * FROM accounts WHERE user_id = ?',
      [userRows[0].user_id]
    );

    // Fetch transactions involving the user as sender or receiver
    const [transactionRows] = await db.query(
      `SELECT * FROM transactions
       WHERE receiving_user = ? OR sending_user = ?
       ORDER BY created_at DESC`,
      [username, username]
    );

    res.json({ user: userRows[0], transactions: transactionRows, account: userAccRows[0] });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.sendStatus(500);
  } finally {
    if (connection) connection.release();
  }
});


// // 2) Get user details and transactions by username
// router.get('/user-info/:username', async (req, res) => {

//   try {
//     const connection = await db.getConnection();

//     const { username } = req.params;
//     console.log("Username: ", username)

//     // Fetch user details - this does not work
//     const [userRows] = await connection.query(
//       'SELECT * FROM users WHERE username = ?',
//       [username]
//     );
//     console.log("UR: ", userRows)

//     // Fetch user details - this works
//     const [userRows1] = await connection.query(
//       'SELECT * FROM users WHERE username = ?',
//       ["user2"]
//     );
//     console.log("UR: ", userRows1)


//     // Fetch user details
//     const [userAccRows] = await db.query(
//       'SELECT * FROM accounts WHERE user_id = ?',
//       [userRows[0].user_id]
//     );

//     const user = userRows.length ? userRows[0] : null;
//     const userAcc = userAccRows.length ? userAccRows[0] : null;

//     // Fetch transactions involving the user as sender or receiver
//     const [transactionRows] = await db.query(
//       `SELECT * FROM transactions
//        WHERE receiving_user = ? OR sending_user = ?
//        ORDER BY created_at DESC`,
//       [username, username]
//     );

//     res.json({ user, transactions: transactionRows, account: userAcc });
//   } catch (error) {
//     console.error('Error fetching user info:', error);
//     res.sendStatus(500);
//   }
// });


// 3) Confirm (Complete) a Purchase
router.post('/confirm-purchase/:purchaseId', async (req, res) => {
  const { purchaseId } = req.params;
  const { username, increaseAmount = 0, created_at, reference_id } = req.body;

  // Example: increase the user's account balance and change purchase status
  try {
    await db.query('START TRANSACTION');

    // Convert created_at to proper MySQL datetime format
    let mysqlDateTime = null;
    if (created_at) {
      const date = new Date(created_at);
      if (!isNaN(date.getTime())) {
        // Convert to MySQL datetime format: 'YYYY-MM-DD HH:MM:SS'
        mysqlDateTime = date.toISOString().slice(0, 19).replace('T', ' ');
      }
    }
    console.log("Original created_at:", created_at);
    console.log("MySQL formatted created_at:", mysqlDateTime);

    // Update the purchase status
    await db.query(
      'UPDATE purchases SET status = ? WHERE id = ?',
      ['Completed', purchaseId]
    );

    if(reference_id){
      // Update transactions with reference_id if provided
      await db.query(
        'UPDATE transactions SET status = ? WHERE reference_id = ? AND receiving_user = ?',
        ['Completed', reference_id, username]
      );
    }

    // Update transactions with proper datetime format
    if (mysqlDateTime) {
      // try {/
        await db.query(
        'UPDATE transactions SET status = ? WHERE created_at = ? AND receiving_user = ?',
        ['Completed', mysqlDateTime, username]
      );
      // } catch (error) {
       
      
    } else {
      // Fallback: update by reference_id or other identifier if datetime conversion fails
      console.warn("Could not parse created_at, using alternative query");
      await db.query(
        'UPDATE transactions SET status = ? WHERE receiving_user = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
        ['Completed', username, 'pending']
      );
    }

    // Increase user's account balance
    await db.query(
      'UPDATE accounts SET spendable = spendable + ? WHERE user_id = (SELECT user_id FROM users WHERE username = ?)',
      [increaseAmount, username]
    );

    // Fetch user details
    const [user] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    console.log("User: ", user);

    let notificationMsg = `Hoo-ray, ${username} Your purchase of ${increaseAmount} coins has been confirmed and processed!`

    try {
      const [result] = await db.query(
        `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
          VALUES (?, ?, ?, ?, ?, ?)`,
        ["purchase-confirmed", user[0].user_id, notificationMsg, "0", username, new Date()]
      );
      console.log("New notification successfully created:", notificationMsg);
    } catch (error) {
      console.error('Error creating notification:', error);
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