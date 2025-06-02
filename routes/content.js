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


// Add these routes to your content.js backend file

// Get comments for a specific content
router.get('/comments/:contentId', async (req, res) => {
  const { contentId } = req.params;
  
  try {
    const [rows] = await db.query(
      'SELECT comments FROM public_content WHERE id = ?',
      [contentId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }
    
    // Return the comments field (which should be a JSON string)
    res.json({ 
      comments: rows[0].comments 
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update comments for a specific content
router.post('/update-comments', authenticateToken, async (req, res) => {
  const { contentId, comments } = req.body;
  
  try {
    // Validate that comments is a valid JSON string
    let commentsJson;
    try {
      commentsJson = typeof comments === 'string' ? comments : JSON.stringify(comments);
      // Test if it's valid JSON
      JSON.parse(commentsJson);
    } catch (parseError) {
      return res.status(400).json({ message: 'Invalid comments format' });
    }
    
    const [result] = await db.query(
      'UPDATE public_content SET comments = ? WHERE id = ?',
      [commentsJson, contentId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }
    
    res.json({ message: 'Comments updated successfully' });
  } catch (error) {
    console.error('Error updating comments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Optional: Get comments with user verification (for admin purposes)
router.get('/comments/:contentId/admin', authenticateToken, async (req, res) => {
  const { contentId } = req.params;
  
  try {
    const [rows] = await db.query(
      'SELECT comments, host_user_id FROM public_content WHERE id = ?',
      [contentId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }
    
    // Check if user is the content owner or admin
    if (rows[0].host_user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    res.json({ 
      comments: rows[0].comments 
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});