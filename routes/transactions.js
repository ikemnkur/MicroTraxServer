const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.post('/send', authenticateToken, async (req, res) => {
  const { recipientAccountId, amount } = req.body;

  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const [senderAccount] = await connection.query('SELECT * FROM accounts WHERE user_id = ?', [req.user.id]);
      const [recipientAccount] = await connection.query('SELECT * FROM accounts WHERE account_id = ?', [recipientAccountId]);

      if (senderAccount.length === 0 || recipientAccount.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Account not found' });
      }

      if (senderAccount[0].balance < amount) {
        await connection.rollback();
        return res.status(400).json({ message: 'Insufficient funds' });
      }

      await connection.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, senderAccount[0].id]);
      await connection.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, recipientAccount[0].id]);

      await connection.query(
        'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status) VALUES (?, ?, ?, ?, ?)',
        [senderAccount[0].id, recipientAccount[0].id, amount, 'send', 'completed']
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

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const [transactions] = await db.query(
      `SELECT t.*, 
              s.account_id as sender_account_id, 
              r.account_id as recipient_account_id
       FROM transactions t
       JOIN accounts s ON t.sender_account_id = s.id
       JOIN accounts r ON t.recipient_account_id = r.id
       WHERE s.user_id = ? OR r.user_id = ?
       ORDER BY t.created_at DESC`,
      [req.user.id, req.user.id]
    );

    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;