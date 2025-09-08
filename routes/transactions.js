const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.post('/send', authenticateToken, async (req, res) => {
  const { recipientId, amount, recipientUsername, sendingUsername, message, reference_id } = req.body;
  console.log("recipientAccountId: " + recipientId)
  console.log("send username: " + sendingUsername)
  const recipientAccountId = recipientId;
  console.log("Amount:  " + amount)
  // / Fetch user data along with account ID
  const [userData] = await db.query(
    `SELECT u.user_id AS userId, a.id AS accountId, a.balance, u.username, u.accountTier, a.spendable, a.redeemable
     FROM users u
     LEFT JOIN accounts a ON u.user_id = a.user_id
     WHERE u.user_id = ?`,
    [req.user.user_id]
  );
  console.log('User Data:', userData);

  if (userData[0].spendable < amount) {
    console.log("Insuffiecent spendable balance for sending to peers");
    // console.error('Send-money data error:', error);
    return res.status(500).json({ message: 'Server error: Insuffiecent spendable balance for Peer 2 Peer Sending' });
  }

  if (recipientUsername == userData[0].username) {
    console.log("Sending coin to oneself");
    // console.error('Send-money data error:', error);
    return res.status(500).json({ message: 'Server error: Sending coins to yourself is not allowed.' });
  }

  console.log("Rcpt: ", recipientId)
  console.log("UD: ", userData[0].userId)

  if (recipientId == userData[0].userId) {
    console.log("Sending coin to oneself");
    // console.error('Send-money data error:', error);
    return res.status(500).json({ message: 'Server error: Sending coins to yourself is not allowed.' });
  }

  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const [senderAccount] = await connection.query('SELECT * FROM accounts WHERE user_id = ?', [req.user.user_id]);
      const [recipientAccount] = await connection.query('SELECT * FROM accounts WHERE user_id = ?', [recipientAccountId]);

      // console.log("RC: " + JSON.stringify(recipientAccount[0]))

      if (senderAccount.length === 0 || recipientAccount.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Account not found' });
      }

      // if (senderAccount[0].balance < amount) {
      //   await connection.rollback();
      //   return res.status(400).json({ message: 'Insufficient funds' });
      // }

      if (senderAccount[0].spendable < amount) {
        await connection.rollback();
        return res.status(400).json({ message: 'Insufficient funds' });
      }

      // console.log("success in find accounts / verify suffiecent balance")


      const accountId = req.user.user_id;
      const id = req.user.user_id;

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


      // Define daily limits based on account tier
      const dailyLimits = {
        1: 5,    // Basic
        2: 10,    // Standard
        3: 25,   // Premium
        4: 50,   // Gold
        5: 100,  // Platinum
        6: 200,  // Diamond
        7: 500  // Ultimate
      };

      // Define daily limits based on account tier
      const dailyCoinLimits = {
        1: 100,    // Basic
        2: 500,    // Standard
        3: 1000,   // Premium
        4: 5000,   // Gold
        5: 10000,  // Platinum
        6: 50000,  // Diamond
        7: 100000  // Ultimate
      };

      let dailyLimit = dailyLimits[userData[0].accountTier] ?? 100; // Default to 100 if not found
      let dailyCoinLimit = dailyCoinLimits[userData[0].accountTier] ?? 100; // Default to 100 if not found
      let totalAmountSentLast24Hours = transactions[0].totalAmountSentLast24Hours ? parseFloat(transactions[0].totalAmountSentLast24Hours) : 0;
      let sentTransactions = transactions[0].sentTransactions || 0;

      let fee = Math.round(amount * 0.10)

      if ((totalAmountSentLast24Hours + amount) > dailyCoinLimit) {
        console.log(" you have a fee thing")
        let fee = Math.round(amount * 0.10)
        await connection.query(
          'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [req.user.user_id, 0, Math.round(amount * 0.10 + 1), 'Fee', 'Completed', recipientUsername, sendingUsername, "System: You have been charged a fee. You spent more than your daily transaction limit allows.", reference_id]
        );
        await connection.query('UPDATE accounts SET spendable = spendable - ? WHERE id = ?', [fee, senderAccount[0].id]);
      }

      console.log("24hr coins spent: ", totalAmountSentLast24Hours)
      console.log("24hr coins limit: ", dailyLimit)
      if ((sentTransactions + 1) > dailyLimit) 
        {createNotice() 
        console.log(" you have a fee thing")
        let fee = Math.round(amount * 0.10)
        await connection.query(
          'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [req.user.user_id, 0, Math.round(amount * 0.10 + 5), 'Fee', 'Completed', recipientUsername, sendingUsername, "System: You have been charged a fee. You spent more than your daily transaction limit allows.", reference_id]
        );
        await connection.query('UPDATE accounts SET spendable = spendable - ? WHERE id = ?', [fee, senderAccount[0].id]);
      }

      await connection.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, senderAccount[0].id]);
      await connection.query('UPDATE accounts SET spendable = spendable - ? WHERE id = ?', [amount, senderAccount[0].id]);
      await connection.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, recipientAccount[0].id]);
      await connection.query('UPDATE accounts SET redeemable = redeemable + ? WHERE id = ?', [amount, recipientAccount[0].id]);

      await connection.query(
        'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.user_id, recipientId, amount, 'send', 'Completed', recipientUsername, sendingUsername, message, reference_id]
      );

      async function createNotice() {
        // Send fee notification

        let notificationMsg = `You have been charged ${fee} coins as a fee for overspending.`

        try {
          const [result] = await db.query(
            `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
      VALUES (?, ?, ?, ?, ?, ?)`,
            ["Fee Charged", req.user.user_id, notificationMsg, "0", user.username, new Date()]
          );

          console.log("New notification successfully created:", notificationMsg);
          // res.status(201).json({ message: 'Notification created successfully', id: result.insertId });
        } catch (error) {
          console.error('Error creating notification:', error);
          // res.status(500).json({ message: 'Server error' });
        }
      }



      await connection.commit();
      res.json({ message: 'Transaction successful' });
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


// Helper function to update the in-memory list of recent transactions

// function updateRecentTransactionsList(recentTransactionsText) {
//   try {
//     // Try parsing the text column into a JavaScript array
//     let transactionsList = JSON.parse(recentTransactionsText || '[]');

//     // Calculate 24-hour threshold (in milliseconds)
//     const now = Date.now();
//     const threshold = now - 24 * 60 * 60 * 1000;

//     // Filter out any entries older than 24 hours
//     transactionsList = transactionsList.filter(trx => {
//       const trxDate = new Date(trx.date).getTime();
//       return trxDate >= threshold;
//     });

//     return transactionsList;
//   } catch (error) {
//     console.error('Error parsing recent_transactions:', error);
//     // If an error occurs, return an empty array as a fallback
//     return [];
//   }
// }

// router.post('/send', authenticateToken, async (req, res) => {
//   const {
//     recipientId,
//     amount,
//     recipientUsername,
//     sendingUsername,
//     message,
//     reference_id
//   } = req.body;

//   // If you have the actual user records, adjust as needed:
//   const fromUser = sendingUsername;
//   const toUser = recipientUsername;

//   try {
//     const connection = await db.getConnection();
//     await connection.beginTransaction();

//     try {
//       // Fetch sender and recipient account
//       const [senderAccount] = await connection.query(
//         'SELECT * FROM accounts WHERE user_id = ?',
//         [req.user.user_id]
//       );
//       const [recipientAccount] = await connection.query(
//         'SELECT * FROM accounts WHERE user_id = ?',
//         [recipientId]
//       );

//       if (senderAccount.length === 0 || recipientAccount.length === 0) {
//         await connection.rollback();
//         return res.status(404).json({ message: 'Account not found' });
//       }

//       // Check if sender has enough "spendable" balance
//       if (senderAccount[0].spendable < amount) {
//         await connection.rollback();
//         return res.status(400).json({ message: 'Insufficient funds' });
//       }

//       // -----------------------------------------------
//       //   UPDATE SENDER'S RECENT TRANSACTIONS
//       // -----------------------------------------------
//       const updatedSenderList = updateRecentTransactionsList(
//         senderAccount[0].recent_transactions
//       );

//       // Create a new transaction record for the sender
//       const senderTransaction = {
//         trx: 'debit',
//         type: 'send_money',
//         message: message,
//         from_user: fromUser,
//         to_user: toUser,
//         amount: parseFloat(amount),
//         date: new Date().toISOString()
//       };

//       // Append the new transaction to the sender's list
//       updatedSenderList.unshift(senderTransaction);

//       // Convert back to JSON string before storing
//       const newSenderRecentTransactions = JSON.stringify(updatedSenderList);

//       // -----------------------------------------------
//       //   UPDATE RECIPIENT'S RECENT TRANSACTIONS
//       // -----------------------------------------------
//       const updatedRecipientList = updateRecentTransactionsList(
//         recipientAccount[0].recent_transactions
//       );

//       // Create a new transaction record for the recipient
//       const recipientTransaction = {
//         trx: 'credit',
//         type: 'send_money',
//         message: message,
//         from_user: fromUser,
//         to_user: toUser,
//         amount: parseFloat(amount),
//         date: new Date().toISOString()
//       };

//       // Append the new transaction to the recipient's list
//       updatedRecipientList.unshift(recipientTransaction);

//       // Convert back to JSON string before storing
//       const newRecipientRecentTransactions = JSON.stringify(updatedRecipientList);

//       // -----------------------------------------------
//       //   SAVE UPDATED recent_transactions BACK TO DB
//       // -----------------------------------------------
//       await connection.query(
//         'UPDATE accounts SET recent_transactions = ? WHERE id = ?',
//         [newSenderRecentTransactions, senderAccount[0].id]
//       );
//       await connection.query(
//         'UPDATE accounts SET recent_transactions = ? WHERE id = ?',
//         [newRecipientRecentTransactions, recipientAccount[0].id]
//       );

//       // -----------------------------------------------
//       //   MOVE BALANCES: sender -> recipient
//       // -----------------------------------------------
//       await connection.query(
//         'UPDATE accounts SET balance = balance - ? WHERE id = ?',
//         [amount, senderAccount[0].id]
//       );
//       await connection.query(
//         'UPDATE accounts SET spendable = spendable - ? WHERE id = ?',
//         [amount, senderAccount[0].id]
//       );
//       await connection.query(
//         'UPDATE accounts SET balance = balance + ? WHERE id = ?',
//         [amount, recipientAccount[0].id]
//       );
//       await connection.query(
//         'UPDATE accounts SET redeemable = redeemable + ? WHERE id = ?',
//         [amount, recipientAccount[0].id]
//       );

//       // -----------------------------------------------
//       //   LOG THE TRANSACTION IN transactions TABLE
//       // -----------------------------------------------
//       await connection.query(
//         `INSERT INTO transactions 
//          (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id)
//          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//         [
//           req.user.user_id,
//           recipientId,
//           amount,
//           'send',
//           'completed',
//           recipientUsername,
//           sendingUsername,
//           message,
//           reference_id
//         ]
//       );

//       // Commit and finish
//       await connection.commit();
//       res.json({ message: 'Transaction successful' });
//     } catch (error) {
//       await connection.rollback();
//       console.error('Error in send transaction:', error);
//       res.status(500).json({ message: 'Server error' });
//     } finally {
//       connection.release();
//     }
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.delete('/transaction/:id', authenticateToken, async (req, res) => {
  const transactionId = req.params.id;

  try {
    const result = await db.query('DELETE FROM transactions WHERE id = ?', [transactionId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


router.get('/receiveHistory', authenticateToken, async (req, res) => {
  try {
    console.log("fetch receive history id: ", req.user.user_id)
    const [transactions] = await db.query(
      `SELECT t.*,
       s.account_id as sender_account_id,
       r.account_id as recipient_account_id
       FROM transactions t
       JOIN accounts s ON t.sender_account_id = s.id
       JOIN accounts r ON t.recipient_account_id = r.id
       WHERE r.user_id = ?
       ORDER BY t.created_at DESC`,
      [req.user.user_id]
    );
    // console.log("Trx: ", transactions)

    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/history', authenticateToken, async (req, res) => {
  try {
    console.log("fetch history id: ", req.user.user_id)
    // const [transactions] = await db.query(
    //   `SELECT t.*, 
    //           s.account_id as sender_account_id, 
    //           r.account_id as recipient_account_id
    //    FROM transactions t
    //    JOIN accounts s ON t.sender_account_id = s.id
    //    JOIN accounts r ON t.recipient_account_id = r.id
    //    WHERE s.user_id = ? OR r.user_id = ?
    //    ORDER BY t.created_at DESC`,
    //   [req.user.user_id, req.user.user_id]
    // );
    // const [transactions] = await db.query('SELECT * FROM transactions WHERE sender_account_id = ? OR recipient_account_id = ? OR recipient_account_id = ? sender_account_id = ? ', [req.user.user_id, req.user.user_id, req.user.id, req.user.id]);
    const [transactions] = await db.query(
      'SELECT * FROM transactions WHERE sender_account_id = ? OR recipient_account_id = ? OR recipient_account_id = ? OR sender_account_id = ?',
      [req.user.user_id, req.user.user_id, req.user.id, req.user.id]
    );

    // console.log("Trx: ", transactions)

    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
