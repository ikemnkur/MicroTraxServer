const express = require('express');
const router = express.Router();
const db = require('../config/db');
const mysql = require('mysql2/promise');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Create a MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Get all of a creator's public content
router.get('/get', authenticateToken, async (req, res) => {
    console.log("gET: PUBLIC CONTENT:", req.user.user_id)
    try {/*  */
        console.log("gET: PUBLIC CONTENT:", req.user.user_id)
        const [rows] = await db.query(
            'SELECT * FROM public_content WHERE host_user_id = ?',
            [req.user.user_id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Public Content not found' });
        }
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add new content
router.post('/create', authenticateToken, async (req, res) => {
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

// Edit public content
router.put('/edit', authenticateToken, async (req, res) => {
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
router.delete('/delete/:id', authenticateToken, async (req, res) => {
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

module.exports = router;