const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');


router.get('/unlock-content/:itemId', async (req, res) => {
    try {
        const [content] = await db.query(
            'SELECT * FROM user_content WHERE reference_id = ?',
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
            'SELECT balance FROM accounts WHERE user_id = ?',
            [req.user.id]
        );
        if (account.length === 0) {
            return res.status(404).json({ message: 'Account not found' });
        }
        res.json({ balance: account[0].balance });
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
            'SELECT * FROM user_content WHERE id = ?',
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
        if (account.length === 0 || account[0].balance < content[0].cost) {
            await connection.rollback();
            return res.status(400).json({ message: 'Insufficient balance' });
        }
        console.log("req.user.id: ", req.user.id)
        // Update user's balance
        await connection.query(
            'UPDATE accounts SET balance = balance - ? WHERE user_id = ?',
            [content[0].cost, req.user.id]
        );
        console.log("update ")
        // Update content host's balance
        await connection.query(
            'UPDATE accounts SET balance = balance + ? WHERE user_id = ?',
            [content[0].cost, content[0].host_user_id]
        );

        console.log("insert--- Account: " + account[0].id + " Host: " + content[0].host_user_id + " cost: " + content[0].cost+ ", Msg: "+ msg)
        // Record the transaction
        await connection.query(
            'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, reference_id, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [account[0].id, content[0].host_user_id, content[0].cost, 'unlock-content', 'completed', content[0].reference_id, msg]
        );

        // Increment unlock count
        await connection.query(
            'UPDATE user_content SET unlocks = unlocks + 1 WHERE id = ?',
            [contentId]
        );
        console.log("rupdate 2")
        await connection.commit();
        res.json({ message: 'Content unlocked successfully' });
    } catch (error) {
        console.log("Error: "+error)
        await connection.rollback();
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
});


// Add new content
router.post('/add-content', authenticateToken, async (req, res) => {
    const { title, cost, description, content, type, username } = req.body;
    console.log("Req.Body: " + req.body)
    try {
        await db.query(
            'INSERT INTO user_content (title, cost, description, content, type, host_username, host_user_id, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, cost, description, JSON.stringify({ content }), type, username, req.user.id, uuidv4()]
        );
        res.status(201).json({ message: 'Content added successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/edit-content', authenticateToken, async (req, res) => {
    const { title, cost, description, content, type, reference_id } = req.body;
    console.log("Editing content with reference_id:", reference_id);

    try {
        const result = await db.query(
            'UPDATE user_content SET title = ?, cost = ?, description = ?, content = ?, type = ? WHERE reference_id = ?',
            [title, cost, description, JSON.stringify(content), type, reference_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Content not found' });
        }

        res.status(200).json({ message: 'Content updated successfully' });
    } catch (error) {
        console.error('Error updating content:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete content
router.delete('/delete-content/:id', authenticateToken, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM user_content WHERE id = ? AND host_user_id = ?',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Content deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
