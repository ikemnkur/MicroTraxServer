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
            [req.user.user_id]
        );
        if (account.length === 0) {
            return res.status(404).json({ message: 'Account not found' });
        }
        res.json({ balance: account[0].balance, spendable: account[0].spendable, redeemable: account[0].redeemable, });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Unlock content
router.post('/unlock-content', authenticateToken, async (req, res) => {
    const { contentId, message, } = req.body;
    console.log("Content ID: " + contentId + " & message: " + message);
    const connection = await db.getConnection();
    await connection.beginTransaction();
    // / Fetch user data along with account ID
    const [userData] = await db.query(
        `SELECT u.user_id AS userId, a.id AS accountId, a.balance, u.accountTier, a.spendable, a.redeemable
     FROM users u
     LEFT JOIN accounts a ON u.user_id = a.user_id
     WHERE u.user_id = ?`,
        [req.user.user_id]
    );
    console.log('User Data:', userData);

    // if (userData[0].spendable < amount) {
    //     console.log("Insuffiecent spendable balance for unlocking content");
    //     console.error('Unlock money data error:', error);
    //     return res.status(500).json({ message: 'Server error: Insuffiecent spendable balance for unlocking Peer Content' });
    // }
    try {
        // Get content details
        const [contentRows] = await connection.query(
            'SELECT * FROM public_content WHERE id = ?',
            [contentId]
        );

        if (contentRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Content not found' });
        }
        const content = contentRows[0];
        console.log("CT: ", content);

        // Check user's balance
        const [accountRows] = await connection.query(
            'SELECT * FROM accounts WHERE user_id = ?',
            [req.user.user_id]
        );

        if (accountRows.length === 0 || accountRows[0].spendable < content.cost) {
            await connection.rollback();
            return res.status(400).json({ message: 'Insufficient balance' });
        }
        const account = accountRows[0];
        console.log("req.user.user_id: ", req.user.user_id);

        // Update user's balance and spendable balance
        await connection.query(
            'UPDATE accounts SET balance = balance - ?, spendable = spendable - ? WHERE user_id = ?',
            [content.cost, content.cost, req.user.user_id]
        );

        // Update content host's balance and redeemable
        await connection.query(
            'UPDATE accounts SET balance = balance + ?, redeemable = redeemable + ? WHERE user_id = ?',
            [content.cost, content.cost, content.host_user_id]
        );

        console.log("Balances updated");
        console.log("User:", req.user)

        // Get the username of the sender and receiver
        const [sending_user_rows] = await connection.query(
            'SELECT username FROM users WHERE user_id = ?',
            [req.user.user_id]
        );
        // const sending_use = await connection.query(
        //     'SELECT username FROM users WHERE user_id = ?',
        //     [content.user_id]
        // );
        console.log(content.user_id)
        // console.log(sending_use[0][0].username)
        const [receiving_user_rows] = await connection.query(
            'SELECT * FROM users WHERE user_id = ?',
            [content.host_user_id]
        );

        const sending_user = sending_user_rows.length > 0 ? sending_user_rows[0].username : null;
        const receiving_user = receiving_user_rows.length > 0 ? receiving_user_rows[0].username : null;

        console.log("Usernames retrieved: ", sending_user, receiving_user);

        if (!sending_user || !receiving_user) {
            await connection.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        console.log("Unlock Content: ", content)

        // Record the transactions
        await connection.query(
            'INSERT INTO user_content (owner_username, owner_id, title, cost, description, content, host_username, host_user_id, type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [sending_user, req.user.user_id, content.title, content.cost, content.description, content.content, content.host_username, content.host_user_id, content.type, content.reference_id]
        );

        // console.log("First transaction recorded");

        await connection.query(
            `INSERT INTO transactions 
            (sender_account_id, recipient_account_id, amount, transaction_type, status, reference_id, message, receiving_user, sending_user) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.user_id,
                content.host_user_id,
                content.cost,
                'unlock-content',
                'completed',
                content.reference_id,
                message,
                receiving_user,
                sending_user,
            ]
        );

        console.log(" transaction recorded");

        // Increment unlock count for the public content
        await connection.query(
            'UPDATE public_content SET unlocks = unlocks + 1 WHERE id = ?',
            [contentId]
        );

        // Increment the total unlock counts for the user
        await connection.query(
            'UPDATE users SET unlocks = unlocks + 1 WHERE user_id = ?',
            [req.user.user_id]
        );

        console.log("Unlock counts updated");

        // Commit the transaction
        await connection.commit();
        res.json({ message: 'Content unlocked successfully' });
    } catch (error) {
        console.log("Error: " + error);
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
            [contentId, req.user.user_id]
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
            [contentId, req.user.user_id]
        );

        if (existingEntry.length > 0) {
            if (existingEntry[0].like_status === 1) {
                // User already liked, remove the like (toggle off)
                await db.query(
                    'UPDATE content_ratings SET like_status = NULL WHERE content_id = ? AND user_id = ?',
                    [contentId, req.user.user_id]
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
                    [contentId, req.user.user_id]
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
                [contentId, req.user.user_id, 1]
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
            [contentId, req.user.user_id]
        );

        if (existingEntry.length > 0) {
            if (existingEntry[0].like_status === -1) {
                // User already disliked, remove the dislike (toggle off)
                await db.query(
                    'UPDATE content_ratings SET like_status = NULL WHERE content_id = ? AND user_id = ?',
                    [contentId, req.user.user_id]
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
                    [contentId, req.user.user_id]
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
                'INSERT INTO content_ratings (content_id, userid, user_id, like_status) VALUES (?, ?, ?, ?)',
                [contentId, req.user.id, req.user.user_id, -1]
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
        console.log("0")
        // Update the average rating
        await db.query(
            'INSERT INTO content_ratings (content_id, userid, user_id, rating) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE rating = ?',
            [contentId, req.user.id, req.user.user_id, rating, rating]
        );
        console.log("1")
        // Recalculate the average rating
        const [rows] = await db.query(
            'SELECT AVG(rating) as avgRating FROM content_ratings WHERE content_id = ?',
            [contentId]
        );
        const avgRating = rows[0].avgRating;
        console.log("rating: ", rating)
        await db.query(
            'UPDATE public_content SET rating = ? WHERE id = ?',
            [avgRating, contentId]
        );
        console.log("3")
        res.status(200).json({ message: 'Rating submitted', avgRating });
        console.log("4")
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
