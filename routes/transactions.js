const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.post('/send', authenticateToken, async (req, res) => {
  const { recipientId, amount, recipientUsername, sendingUsername, message, reference_id } = req.body;
  console.log("recipientAccountId: " + recipientId)
  const recipientAccountId = recipientId;
  console.log("Amount:  " + amount)
   // / Fetch user data along with account ID
   const [userData] = await db.query(
    `SELECT u.user_id AS userId, a.id AS accountId, a.balance, u.accountTier, a.spendable, a.redeemable
     FROM users u
     LEFT JOIN accounts a ON u.user_id = a.user_id
     WHERE u.user_id = ?`,
    [req.user.user_id]
  );
  console.log('User Data:', userData);

  if (userData[0].spendable < amount) {
    console.log("Insuffiecent spendable balance for sending to peers");
    console.error('Send-money data error:', error);
    return res.status(500).json({ message: 'Server error: Insuffiecent spendable balance for Peer 2 Peer Sending' });
  }
  
  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const [senderAccount] = await connection.query('SELECT * FROM accounts WHERE user_id = ?', [req.user.user_id]);
      const [recipientAccount] = await connection.query('SELECT * FROM accounts WHERE user_id = ?', [recipientAccountId]);

      console.log("RC: " + JSON.stringify(recipientAccount[0]))

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

      console.log("success in find accounts / verify suffiecent balance")
      
      // // # To Do Implemnte psuedo code

      // // recent transactions in the last 24 hours, the recent_transaction field is of the text type 
      // console.log("sender recent transactions: ", senderAccount.recent_transactions)
      // console.log("receiver recent transactions: ", recipientAccount.recent_transactions)

      // // if recentTransactions object array has item that are older than 24 hours delete them?

      // updatedSenderRencentTransactions = updateRecentTransactionsList(senderAccount.recent_transactions)
      // updatedRecipientRencentTransactions = updateRecentTransactionsList(senderAccount.recent_transactions)

      // const recentTransactionSender = {
      //   trx: "debit",
      //   type: 'send_money',
      //   message: message,
      //   from_user: thisUser.username,
      //   to_user: toUser.username,
      //   amount: parseFloat(amount),
      //   date: new Date(),
      // }
      // // this may not be nesscary but I am unsure if i should keep it
      // const recentTransactionReceiver = {
      //   trx: "credit",
      //   type: 'send_money',
      //   message: message,
      //   from_user: thisUser.username,
      //   to_user: toUser.username,
      //   amount: parseFloat(amount),
      //   date: new Date(),
      // }

      // // add this transaction to the top of the list of the recent transactions 
      // newReciverRencentTransactions = senderAccount.recent_transactions + recentTransactionReceiver
      // newSenderRencentTransactions = senderAccount.recent_transactions + recentTransactionSender

      // await connection.query('UPDATE accounts SET recent_transactions = ? WHERE id = ?', [newSenderRencentTransactions, senderAccount[0].id]);
      // await connection.query('UPDATE accounts SET recent_transactions = ? WHERE id = ?', [newReciverRencentTransactions, recipientAccount[0].id]);

      // //# end of TODO

      await connection.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, senderAccount[0].id]);
      await connection.query('UPDATE accounts SET spendable = spendable - ? WHERE id = ?', [amount, senderAccount[0].id]);
      await connection.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, recipientAccount[0].id]);
      await connection.query('UPDATE accounts SET redeemable = redeemable + ? WHERE id = ?', [amount, recipientAccount[0].id]);

      await connection.query(
        'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.user_id, recipientId, amount, 'send', 'completed', recipientUsername, sendingUsername, message, reference_id]
      );

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
