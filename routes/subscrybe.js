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
            [subId, req.user.user_id]
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
            [req.user.user_id]
        );
        // if (account.length === 0 || account[0].balance < content[0].cost) {
        //     await connection.rollback();
        //     return res.status(400).json({ message: 'Insufficient balance' });
        // }
        if (account.length === 0 || account[0].spendable < content[0].cost) {
            await connection.rollback();
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        console.log("req.user.user_id: ", req.user.user_id)
        // Update user's balance
        await connection.query(
            'UPDATE accounts SET balance = balance - ? WHERE user_id = ?',
            [content[0].cost, req.user.user_id]
        );
        await connection.query(
            'UPDATE accounts SET spendable = spendable - ? WHERE user_id = ?',
            [content[0].cost, req.user.user_id]
        );


        // // Update content host's balance
        // let resluts = await connection.query(
        //     'UPDATE accounts SET balance = balance + ? WHERE user_id = ?',
        //     [content[0].cost, content[0].host_user_id]
        // );
        // Update content host's balance
        let results = await connection.query(
            'UPDATE accounts SET redeemable = redeemable + ? WHERE user_id = ?',
            [content[0].cost, content[0].host_user_id]
        );
        // Get the username of the sender and receiver?
        const [sending_user] = await db.query(
            'SELECT username FROM users WHERE user_id = ?',
            [req.user.user_id]
        );
        const [receiving_user] = await db.query(
            'SELECT username FROM users WHERE user_id = ?',
            [content[0].host_user_id]
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
            [recipientId, req.user.user_id, content[0].cost, 'new subscription', 'completed', receiving_user, sending_user]
        );

        // Increment unlock count
        await connection.query(
            'UPDATE public_subscriptions SET num_of_subs = num_of_subs + 1 WHERE id = ?',
            [contentId]
        );

        await connection.query(
            'UPDATE users SET subscriptions = subscriptions + 1 WHERE id = ?',
            [req.user.user_id]
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

// Increment views
router.post('/add-view', async (req, res) => {
    const { contentId } = req.body;
    try {
        await db.query(
            'UPDATE public_subscriptions SET views = views + 1 WHERE id = ?',
            [contentId]
        );
        res.status(200).json({ message: 'View count updated' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Add like
router.post('/add-like', authenticateToken, async (req, res) => {
    const { contentId } = req.body;
    try {
        // Check if the user has already liked or disliked the content
        const [existingEntry] = await db.query(
            'SELECT like_status FROM subscription_ratings WHERE content_id = ? AND user_id = ?',
            [contentId, req.user.user_id]
        );

        if (existingEntry.length > 0) {
            if (existingEntry[0].like_status === 1) {
                // User already liked, remove the like (toggle off)
                await db.query(
                    'UPDATE subscription_ratings SET like_status = NULL WHERE content_id = ? AND user_id = ?',
                    [contentId, req.user.user_id]
                );
                // Decrement total likes
                await db.query(
                    'UPDATE public_subscriptions SET likes = likes - 1 WHERE id = ?',
                    [contentId]
                );
                return res.status(200).json({ message: 'Like removed' });
            } else {
                // Update to like
                await db.query(
                    'UPDATE subscription_ratings SET like_status = 1 WHERE content_id = ? AND user_id = ?',
                    [contentId, req.user.user_id]
                );
                if (existingEntry[0].like_status === -1) {
                    // Previously disliked, decrement dislikes
                    await db.query(
                        'UPDATE public_subscriptions SET dislikes = dislikes - 1 WHERE id = ?',
                        [contentId]
                    );
                    // Example for decrementing likes
                    await db.query(
                        'UPDATE public_subscriptions SET likes = GREATEST(likes - 1, 0) WHERE id = ?',
                        [contentId]
                    );
                }
                // Increment total likes
                await db.query(
                    'UPDATE public_subscriptions SET likes = likes + 1 WHERE id = ?',
                    [contentId]
                );
                return res.status(200).json({ message: 'Content liked successfully' });
            }
        } else {
            // No existing entry, insert new
            await db.query(
                'INSERT INTO subscription_ratings (content_id, user_id, like_status) VALUES (?, ?, ?)',
                [contentId, req.user.user_id, 1]
            );
            // Increment total likes
            await db.query(
                'UPDATE public_subscriptions SET likes = likes + 1 WHERE id = ?',
                [contentId]
            );
            return res.status(200).json({ message: 'Content liked successfully' });
        }
    } catch (error) {
        console.error('Error in add-like:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add dislike
router.post('/add-dislike', authenticateToken, async (req, res) => {
    const { contentId } = req.body;
    try {
        // Check if the user has already liked or disliked the content
        const [existingEntry] = await db.query(
            'SELECT like_status FROM subscription_ratings WHERE content_id = ? AND user_id = ?',
            [contentId, req.user.user_id]
        );

        if (existingEntry.length > 0) {
            if (existingEntry[0].like_status === -1) {
                // User already disliked, remove the dislike (toggle off)
                await db.query(
                    'UPDATE subscription_ratings SET like_status = NULL WHERE content_id = ? AND user_id = ?',
                    [contentId, req.user.user_id]
                );
                // Decrement total dislikes
                await db.query(
                    'UPDATE public_subscriptions SET dislikes = dislikes - 1 WHERE id = ?',
                    [contentId]
                );
                return res.status(200).json({ message: 'Dislike removed' });
            } else {
                // Update to dislike
                await db.query(
                    'UPDATE subscription_ratings SET like_status = -1 WHERE content_id = ? AND user_id = ?',
                    [contentId, req.user.user_id]
                );
                if (existingEntry[0].like_status === 1) {
                    // Previously liked, decrement likes
                    await db.query(
                        'UPDATE public_subscriptions SET likes = likes - 1 WHERE id = ?',
                        [contentId]
                    );
                }
                // Increment total dislikes
                await db.query(
                    'UPDATE public_subscriptions SET dislikes = dislikes + 1 WHERE id = ?',
                    [contentId]
                );
                return res.status(200).json({ message: 'Content disliked successfully' });
            }
        } else {
            // No existing entry, insert new
            await db.query(
                'INSERT INTO subscription_ratings (content_id, user_id, like_status) VALUES (?, ?, ?)',
                [contentId, req.user.user_id, -1]
            );
            // Increment total dislikes
            await db.query(
                'UPDATE public_subscriptions SET dislikes = dislikes + 1 WHERE id = ?',
                [contentId]
            );
            return res.status(200).json({ message: 'Content disliked successfully' });
        }
    } catch (error) {
        console.error('Error in add-dislike:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Add rating
router.post('/add-rating', authenticateToken, async (req, res) => {
    const { contentId, rating } = req.body;
    try {
        // Update the average rating
        await db.query(
            'INSERT INTO subscription_ratings (content_id, user_id, rating) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rating = ?',
            [contentId, req.user.user_id, rating, rating]
        );

        // Recalculate the average rating
        const [rows] = await db.query(
            'SELECT AVG(rating) as avgRating FROM subscription_ratings WHERE content_id = ?',
            [contentId]
        );
        const avgRating = rows[0].avgRating;

        await db.query(
            'UPDATE public_subscriptions SET rating = ? WHERE id = ?',
            [avgRating, contentId]
        );

        res.status(200).json({ message: 'Rating submitted', avgRating });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;
