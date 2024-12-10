const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');


// // Fetch content data
// router.get('/unlock-content/:itemId', async (req, res) => {
//     try {
//         const [content] = await db.query(
//             'SELECT * FROM user_content WHERE id = ?',
//             [req.params.itemId]
//         );
//         if (content.length === 0) {
//             return res.status(404).json({ message: 'Content not found' });
//         }
//         res.json(content[0]);
//     } catch (error) {
//         res.status(500).json({ message: 'Server error' });
//     }
// });


// Fetch user's content list
router.get('/user-content', authenticateToken, async (req, res) => {
    console.log("get user content: " + JSON.stringify(req.user))
    try {
        const [content] = await db.query(
            'SELECT * FROM user_content WHERE onwer_id = ?',
            [req.user.user_id]
        );
        res.json(content);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Add new content
router.post('/add-public-content', authenticateToken, async (req, res) => {
    const { title, cost, description, content, type, username } = req.body;
    console.log("Req.Body: " + req.body)
    try {
        await db.query(
            'INSERT INTO public_content (title, cost, description, content, type, host_username, host_user_id, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, cost, description, JSON.stringify({ content }), type, username, req.user.user_id, uuidv4()]
        );
        res.status(201).json({ message: 'Content added successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/edit-public-content', authenticateToken, async (req, res) => {
    const { title, cost, description, content, type, reference_id } = req.body;
    console.log("Editing content with reference_id:", reference_id);

    try {
        const result = await db.query(
            'UPDATE public_content SET title = ?, cost = ?, description = ?, content = ?, type = ? WHERE reference_id = ?',
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

// Delete public content
router.delete('/delete-public-content/:id', authenticateToken, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM public_content WHERE id = ? AND host_user_id = ?',
            [req.params.id, req.user.user_id]
        );
        res.json({ message: 'Content deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete user content
router.delete('/delete-your-content/:id', authenticateToken, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM user_content WHERE id = ? AND host_user_id = ?',
            [req.params.id, req.user.user_id]
        );
        res.json({ message: 'Content deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
