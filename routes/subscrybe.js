const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');


router.get('/get/:itemId', async (req, res) => {
    try {
        const [content] = await db.query(
            'SELECT * FROM public_subscriptions WHERE reference_id = ?',
            [req.params.itemId]
        );
        if (content.length === 0) {
            return res.status(404).json({ message: 'Content not found' });
        }
        res.json(content[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
// Todo: Fix this
// DELETE /api/notifications/delete/:id - Delete a notification
router.delete('/delete/:id', authenticateToken, async (req, res) => {
    const subId = req.params.id;

    try {
        const [result] = await db.query(
            'DELETE FROM user_subscriptions WHERE id = ? AND user_id = ?',
            [subId, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Notification not found or unauthorized' });
        }

        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ message: 'Server error' });
    }
});



// subscribe to content
router.post('/subscribe-to-user', authenticateToken, async (req, res) => {
    const { contentId, msg } = req.body;
    console.log("Subscription ID: " + contentId + " & Msg: " + msg)
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // Get content details
        const [content] = await connection.query(
            'SELECT * FROM public_subscriptions WHERE id = ?',
            [contentId]
        );
        if (content.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Content not found' });
        }

        // Check user's balance
        const [account] = await connection.query(
            'SELECT * FROM accounts WHERE user_id = ?',
            [req.user.id]
        );
        // if (account.length === 0 || account[0].balance < content[0].cost) {
        //     await connection.rollback();
        //     return res.status(400).json({ message: 'Insufficient balance' });
        // }
        if (account.length === 0 || account[0].spendable < content[0].cost) {
            await connection.rollback();
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        console.log("req.user.id: ", req.user.id)
        // Update user's balance
        await connection.query(
            'UPDATE accounts SET balance = balance - ? WHERE user_id = ?',
            [content[0].cost, req.user.id]
        );
        await connection.query(
            'UPDATE accounts SET spendable = spendable - ? WHERE user_id = ?',
            [content[0].cost, req.user.id]
        );


        // Update content host's balance
        let resluts = await connection.query(
            'UPDATE accounts SET balance = balance + ? WHERE user_id = ?',
            [content[0].cost, content[0].host_user_id]
        );
        // Update content host's balance
        let results = await connection.query(
            'UPDATE accounts SET redeemable = redeemable + ? WHERE user_id = ?',
            [content[0].cost, content[0].host_user_id]
        );

        console.log("update host balance: ", results)

        console.log("insert--- Account: " + account[0].id + " Host: " + content[0].host_user_id + " amount: " + content[0].cost + ", Msg: " + msg)

        // Record the transaction
        await connection.query(
            'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, reference_id, message, receiving_user, sending_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [account[0].id, content[0].host_user_id, content[0].cost, 'subscribe', 'completed', content[0].reference_id, msg, receiving_user, sending_user]
        );

        await connection.query(
            'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [recipientId, req.user.id, content[0].cost, 'new subscription', 'completed', receiving_user, sending_user]
        );

        // Increment unlock count
        await connection.query(
            'UPDATE public_subscriptions SET num_of_subs = num_of_subs + 1 WHERE id = ?',
            [contentId]
        );

        await connection.query(
            'UPDATE users SET subscriptions = subscriptions + 1 WHERE id = ?',
            [req.user.id]
        );

        console.log("rupdate 2")
        await connection.commit();
        res.json({ message: 'Content unlocked successfully' });
    } catch (error) {
        console.log("Error: " + error)
        await connection.rollback();
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
});


// Add new content
router.post('/add-like', authenticateToken, async (req, res) => {
    const { title, cost, description, content, type, username, subId } = req.body;
    console.log("Req.Body: " + req.body)

    try {
        const [sub] = await connection.query(
            'SELECT * FROM public_subscriptions WHERE id = ?',
            [subId]
        );
        await db.query(
            'UPDATE public_subscriptions SET like = like + ? WHERE user_id = ?',
            [1, subId]
        );
        res.status(201).json({ message: 'subscription liked successfully' });
        // res.status(201).json({ message: 'subscription liked successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Add new content
router.post('/add-dislike', authenticateToken, async (req, res) => {
    const { title, cost, description, content, type, username, subId } = req.body;
    console.log("Req.Body: " + req.body)
    try {
        const [sub] = await connection.query(
            'SELECT * FROM public_subscriptions WHERE id = ?',
            [subId]
        );
        await db.query(
            'UPDATE public_subscriptions SET dislike = dislike + ? WHERE user_id = ?',
            [1, subId]
        );
        res.status(201).json({ message: 'subscription liked successfully' });
        // res.status(201).json({ message: 'subscription liked successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


// Add new content
router.post('/add-visit', authenticateToken, async (req, res) => {
    const { title, cost, description, content, type, username, subId } = req.body;
    console.log("Req.Body: " + req.body)
    try {
        const [sub] = await connection.query(
            'SELECT * FROM public_subscriptions WHERE id = ?',
            [subId]
        );
        await db.query(
            'UPDATE public_subscriptions SET visits = visits + ? WHERE user_id = ?',
            [1, subId]
        );
        res.status(201).json({ message: 'subscription liked successfully' });
        // res.status(201).json({ message: 'subscription liked successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});



module.exports = router;
