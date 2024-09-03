const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

// Get all conversations for the authenticated user
router.get('/conversations', authenticateToken, async (req, res) => {
    try {
        const [conversations] = await db.query(`
            SELECT c.id, c.created_at, 
                   GROUP_CONCAT(CASE WHEN u.id != ? THEN u.username END) AS other_participants
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            JOIN users u ON cp.user_id = u.id
            WHERE c.id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = ?)
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `, [req.user.id, req.user.id]);

        res.json(conversations);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
    try {
        const [messages] = await db.query(`
            SELECT m.id, m.content, m.created_at, u.username as sender_username
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at ASC
        `, [req.params.conversationId]);

        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Send a message in a conversation
router.post('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
    const { content } = req.body;
    const conversationId = req.params.conversationId;

    try {
        await db.query('INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)', 
            [conversationId, req.user.id, content]);

        res.status(201).json({ message: 'Message sent successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Start a new conversation
router.post('/conversations', authenticateToken, async (req, res) => {
    const { username } = req.body;

    try {
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if the user exists
            const [users] = await connection.query('SELECT id FROM users WHERE username = ?', [username]);
            if (users.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'User not found' });
            }
            const otherUserId = users[0].id;

            // Check if a conversation already exists between these users
            const [existingConversations] = await connection.query(`
                SELECT c.id
                FROM conversations c
                JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
                JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
                WHERE cp1.user_id = ? AND cp2.user_id = ?
            `, [req.user.id, otherUserId]);

            let conversationId;

            if (existingConversations.length > 0) {
                conversationId = existingConversations[0].id;
            } else {
                // Create a new conversation
                const [result] = await connection.query('INSERT INTO conversations () VALUES ()');
                conversationId = result.insertId;

                // Add participants
                await connection.query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)', 
                    [conversationId, req.user.id, conversationId, otherUserId]);
            }

            await connection.commit();
            res.status(201).json({ conversationId });
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

module.exports = router;