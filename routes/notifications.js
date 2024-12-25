// notifications.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Adjust the path as needed
// const authenticateToken = require('../middleware/authenticateToken'); // Adjust the path as needed
const authenticateToken = require('../middleware/auth');

// GET /api/notifications - Get all notifications for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [notifications] = await db.query(
      'SELECT * FROM notifications WHERE recipient_user_id = ? ORDER BY created_at DESC',
      [req.user.user_id]
    );

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/notifications/create - Create a new notification
router.post('/create', authenticateToken, async (req, res) => {
  const { type, recipient_user_id, recipient_username, message, from_user, date } = req.body;

  try {
    const [result] = await db.query(
      'INSERT INTO notifications (type, recipient_user_id, message, `from`, recipient_username, date) VALUES (?, ?, ?, ?, ?, ?)',
      [type, recipient_user_id, message, from_user, recipient_username, date]
    );
    console.log("New notification: ", message)
    res.status(201).json({ message: 'Notification created successfully', id: result.insertId });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
  
});

// DELETE /api/notifications/delete/:id - Delete a notification
router.delete('/delete/:id', authenticateToken, async (req, res) => {
  const notificationId = req.params.id;

  try {
    const [result] = await db.query(
      'DELETE FROM notifications WHERE id = ? AND recipient_user_id = ?',
      [notificationId, req.user.user_id]
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

module.exports = router;


// GET /api/notifications
// Fetches all notifications for the authenticated user.
// Orders notifications by created_at in descending order (most recent first).
// Responds with a JSON array of notifications.

// POST /api/notifications/create
// Creates a new notification.
// Expects type, recipient_user_id, message, and from_user in the request body.
// Inserts a new record into the notifications table.
// Responds with a success message and the ID of the newly created notification.

// DELETE /api/notifications/delete/:id
// Deletes a notification specified by id from the URL parameter.
// Ensures that the notification belongs to the authenticated user before deleting.
// Responds with a success message upon deletion.

// Adjustments and Corrections

// Consistent Naming: Changed recipient_user_id and from fields to match your database schema.

// Proper HTTP Methods:
// Used GET for fetching notifications.
// Used POST for creating notifications.
// Used DELETE for deleting notifications.

// Security:
// Added a check in the DELETE route to ensure that users can only delete their own notifications.

// Error Handling:
// Added error handling to catch database errors and respond with appropriate HTTP status codes and messages.

// Date Handling:
// The created_at timestamp is automatically handled by the database.