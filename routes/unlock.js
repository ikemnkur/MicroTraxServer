const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');


router.get('/unlock-content/:itemId', async (req, res) => {
    try {
        const [content] = await db.query(
            'SELECT * FROM public_content WHERE reference_id = ?',
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

// Fetch user's balance
router.get('/user-balance', authenticateToken, async (req, res) => {
    try {
        const [account] = await db.query(
            'SELECT * FROM accounts WHERE user_id = ?',
            [req.user.id]
        );
        if (account.length === 0) {
            return res.status(404).json({ message: 'Account not found' });
        }
        res.json({ balance: account[0].balance, spendable: account[0].spendable, redeemable: account[0].redeemable,  });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});



// Unlock content
router.post('/unlock-content', authenticateToken, async (req, res) => {
    const { contentId, msg } = req.body;
    console.log("Content ID: " + contentId + " & Msg: " + msg)
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // Get content details
        const [content] = await connection.query(
            'SELECT * FROM public_content WHERE id = ?',
            [contentId]
        );

        console.log("CT: ", content[0])

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

        // Update user's spendable balance
        await connection.query(
            'UPDATE accounts SET spendable = spendable - ? WHERE user_id = ?',
            [content[0].cost, req.user.id]
        );

        console.log("update ")

        // Update content host's balance
        await connection.query(
            'UPDATE accounts SET balance = balance + ? WHERE user_id = ?',
            [content[0].cost, content[0].host_user_id]
        );
        // Update content host's balance redeemable
        await connection.query(
            'UPDATE accounts SET redeemable = redeemable + ? WHERE user_id = ?',
            [content[0].cost, content[0].host_user_id]
        );

        console.log("insert--- Account: " + account[0].id + " Host: " + content[0].host_user_id + " cost: " + content[0].cost + ", Msg: " + msg)

        // Get the username of the sender and receiver?
        const [sending_user] = await db.query(
            'SELECT username FROM users WHERE user_id = ?',
            [req.user.id]
        );
        const [receiveing_user] = await db.query(
            'SELECT username FROM users WHERE user_id = ?',
            [content[0].host_user_id]
        );

        // Record the transaction
        await connection.query(
            'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, reference_id, message, receiving_user, sending_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [account[0].id, content[0].host_user_id, content[0].cost, 'unlock-content', 'completed', content[0].reference_id, msg, receiveing_user, sending_user]
        );

        // Record the transaction
        await connection.query(
            'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, reference_id, message, receiving_user, sending_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [account[0].id, content[0].host_user_id, content[0].cost, 'content sold', 'completed', content[0].reference_id, msg, receiveing_user, sending_user]
        );

        // Increment unlock count for the public content
        await connection.query(
            'UPDATE public_content SET unlocks = unlocks + 1 WHERE id = ?',
            [contentId]
        );
        // Increment the total amount of unlock counts for the user
        await connection.query(
            'UPDATE users SET unlocks = unlocks + 1 WHERE id = ?',
            [req.user.id]
        );

        // Update content host's balance
        await connection.query(
            'UPDATE accounts SET balance = balance + ? WHERE user_id = ?',
            [content[0].cost, content[0].host_user_id]
        );
        await connection.query(
            'UPDATE accounts SET redeemable = redeemable + ? WHERE user_id = ?',
            [content[0].cost, content[0].host_user_id]
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

// Get user's like/dislike status and rating for a content
router.get('/user-rating/:contentId', authenticateToken, async (req, res) => {
    const { contentId } = req.params;
    try {
        const [rows] = await db.query(
            'SELECT like_status, rating FROM content_ratings WHERE content_id = ? AND user_id = ?',
            [contentId, req.user.id]
        );
        if (rows.length > 0) {
            res.status(200).json(rows[0]);
        } else {
            res.status(200).json({ like_status: 0, rating: null });
        }
    } catch (error) {
        console.error('Error in user-rating:', error);
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

// Increment views
router.post('/add-view', async (req, res) => {
    const { contentId } = req.body;
    try {
        await db.query(
            'UPDATE public_content SET views = views + 1 WHERE id = ?',
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
            'SELECT like_status FROM content_ratings WHERE content_id = ? AND user_id = ?',
            [contentId, req.user.id]
        );

        if (existingEntry.length > 0) {
            if (existingEntry[0].like_status === 1) {
                // User already liked, remove the like (toggle off)
                await db.query(
                    'UPDATE content_ratings SET like_status = NULL WHERE content_id = ? AND user_id = ?',
                    [contentId, req.user.id]
                );
                // Decrement total likes
                await db.query(
                    'UPDATE public_content SET likes = likes - 1 WHERE id = ?',
                    [contentId]
                );
                return res.status(200).json({ message: 'Like removed' });
            } else {
                // Update to like
                await db.query(
                    'UPDATE content_ratings SET like_status = 1 WHERE content_id = ? AND user_id = ?',
                    [contentId, req.user.id]
                );
                if (existingEntry[0].like_status === -1) {
                    // Previously disliked, decrement dislikes
                    await db.query(
                        'UPDATE public_content SET dislikes = dislikes - 1 WHERE id = ?',
                        [contentId]
                    );
                    // Example for decrementing likes
                    await db.query(
                        'UPDATE public_content SET likes = GREATEST(likes - 1, 0) WHERE id = ?',
                        [contentId]
                    );
                }
                // Increment total likes
                await db.query(
                    'UPDATE public_content SET likes = likes + 1 WHERE id = ?',
                    [contentId]
                );
                return res.status(200).json({ message: 'Content liked successfully' });
            }
        } else {
            // No existing entry, insert new
            await db.query(
                'INSERT INTO content_ratings (content_id, user_id, like_status) VALUES (?, ?, ?)',
                [contentId, req.user.id, 1]
            );
            // Increment total likes
            await db.query(
                'UPDATE public_content SET likes = likes + 1 WHERE id = ?',
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
            'SELECT like_status FROM content_ratings WHERE content_id = ? AND user_id = ?',
            [contentId, req.user.id]
        );

        if (existingEntry.length > 0) {
            if (existingEntry[0].like_status === -1) {
                // User already disliked, remove the dislike (toggle off)
                await db.query(
                    'UPDATE content_ratings SET like_status = NULL WHERE content_id = ? AND user_id = ?',
                    [contentId, req.user.id]
                );
                // Decrement total dislikes
                await db.query(
                    'UPDATE public_content SET dislikes = dislikes - 1 WHERE id = ?',
                    [contentId]
                );
                return res.status(200).json({ message: 'Dislike removed' });
            } else {
                // Update to dislike
                await db.query(
                    'UPDATE content_ratings SET like_status = -1 WHERE content_id = ? AND user_id = ?',
                    [contentId, req.user.id]
                );
                if (existingEntry[0].like_status === 1) {
                    // Previously liked, decrement likes
                    await db.query(
                        'UPDATE public_content SET likes = likes - 1 WHERE id = ?',
                        [contentId]
                    );
                }
                // Increment total dislikes
                await db.query(
                    'UPDATE public_content SET dislikes = dislikes + 1 WHERE id = ?',
                    [contentId]
                );
                return res.status(200).json({ message: 'Content disliked successfully' });
            }
        } else {
            // No existing entry, insert new
            await db.query(
                'INSERT INTO content_ratings (content_id, user_id, like_status) VALUES (?, ?, ?)',
                [contentId, req.user.id, -1]
            );
            // Increment total dislikes
            await db.query(
                'UPDATE public_content SET dislikes = dislikes + 1 WHERE id = ?',
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
            'INSERT INTO content_ratings (content_id, user_id, rating) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rating = ?',
            [contentId, req.user.id, rating, rating]
        );

        // Recalculate the average rating
        const [rows] = await db.query(
            'SELECT AVG(rating) as avgRating FROM content_ratings WHERE content_id = ?',
            [contentId]
        );
        const avgRating = rows[0].avgRating;

        await db.query(
            'UPDATE public_content SET rating = ? WHERE id = ?',
            [avgRating, contentId]
        );

        res.status(200).json({ message: 'Rating submitted', avgRating });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
