const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Helper function to get or create conversation between two users
const getOrCreateConversation = async (user1, user2) => {
  // Validate that both users are provided
  if (!user1 || !user2) {
    console.error(`getOrCreateConversation called with invalid users: user1=${user1}, user2=${user2}`);
    throw new Error('Both user1 and user2 are required');
  }

//   console.log(`Getting/creating conversation between ${user1} and ${user2}`);

  // Always order users alphabetically to ensure uniqueness
  const [userA, userB] = [user1, user2].sort();
  
  let [conversations] = await db.query(
    'SELECT * FROM conversations WHERE user1 = ? AND user2 = ?',
    [userA, userB]
  );

  if (conversations.length === 0) {
    // Create new conversation
    const conversationData = {
      messages: [],
      metadata: {
        unreadCount: { [userA]: 0, [userB]: 0 },
        lastRead: { [userA]: null, [userB]: null }
      }
    };

    const autoDeleteAt = new Date();
    autoDeleteAt.setDate(autoDeleteAt.getDate() + 7); // 7 days from now

    await db.query(
      `INSERT INTO conversations (user1, user2, conversation, auto_delete_at, pending_response_from) 
       VALUES (?, ?, ?, ?, ?)`,
      [userA, userB, JSON.stringify(conversationData), autoDeleteAt, userB]
    );

    [conversations] = await db.query(
      'SELECT * FROM conversations WHERE user1 = ? AND user2 = ?',
      [userA, userB]
    );
  }

  return conversations[0];
};

// Get all conversations for the authenticated user
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user.username;

    // Check if user is authenticated properly
    if (!currentUser) {
      return res.status(401).json({ message: 'User not authenticated properly' });
    }

    const [conversations] = await db.query(`
      SELECT 
        id, user1, user2, conversation, status, blocked_by, blocked_at,
        last_message_at, pending_response_from, auto_delete_at
      FROM conversations 
      WHERE (user1 = ? OR user2 = ?) AND status != 'deleted'
      ORDER BY COALESCE(last_message_at, created_at) DESC
    `, [currentUser, currentUser]);

    const conversationList = conversations.map(conv => {
      const otherUser = conv.user1 === currentUser ? conv.user2 : conv.user1;
      const conversationData = typeof conv.conversation === 'string' 
        ? JSON.parse(conv.conversation) 
        : conv.conversation;

      const messages = conversationData.messages || [];
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      const unreadCount = conversationData.metadata?.unreadCount?.[currentUser] || 0;

      return {
        id: conv.id,
        otherUser,
        lastMessage: lastMessage ? lastMessage.text : null,
        lastMessageTime: lastMessage ? lastMessage.timestamp : conv.last_message_at,
        unreadCount,
        status: conv.status || 'active',
        blockedBy: conv.blocked_by,
        isBlocked: conv.status && conv.status.includes('blocked'),
        pendingResponse: conv.pending_response_from === currentUser,
        autoDeleteAt: conv.auto_delete_at
      };
    });

    res.json(conversationList);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages for a specific conversation
router.get('/conversation/:otherUser', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user.username;
    const { otherUser } = req.params;

    // Check if user is authenticated properly
    if (!currentUser) {
      return res.status(401).json({ message: 'User not authenticated properly' });
    }

    // Validate otherUser parameter
    if (!otherUser || otherUser.trim() === '') {
      return res.status(400).json({ message: 'Other user parameter is required' });
    }

    console.log(`Getting conversation between ${currentUser} and ${otherUser}`);

    const conversation = await getOrCreateConversation(currentUser, otherUser.trim());
    
    if (conversation.status && conversation.status.includes('blocked')) {
      return res.status(403).json({ 
        message: 'This conversation is blocked',
        blockedBy: conversation.blocked_by 
      });
    }

    const conversationData = typeof conversation.conversation === 'string' 
      ? JSON.parse(conversation.conversation) 
      : conversation.conversation;

    res.json({
      conversationId: conversation.id,
      messages: conversationData.messages || [],
      status: conversation.status || 'active',
      pendingResponse: conversation.pending_response_from === currentUser,
      autoDeleteAt: conversation.auto_delete_at,
      user1: conversation.user1,
      user2: conversation.user2
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user.username;
    const { toUser, messageText, replyTo } = req.body;

    // Check if user is authenticated properly
    if (!currentUser) {
      return res.status(401).json({ message: 'User not authenticated properly' });
    }

    // console.log(`Send message request - from: ${currentUser}, to: ${toUser}, message: ${messageText}`);

    // Validate required fields
    if (!toUser || toUser.trim() === '') {
      return res.status(400).json({ message: 'Recipient user is required' });
    }

    if (!messageText || !messageText.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    // Prevent user from messaging themselves
    if (currentUser === toUser.trim()) {
      return res.status(400).json({ message: 'Cannot send message to yourself' });
    }

    const conversation = await getOrCreateConversation(currentUser, toUser.trim());

    // Check if conversation is blocked
    if (conversation.status && conversation.status.includes('blocked')) {
      return res.status(403).json({ 
        message: 'Cannot send message. Conversation is blocked.',
        blockedBy: conversation.blocked_by 
      });
    }

    // Check spam prevention - if user is waiting for response
    if (conversation.pending_response_from === currentUser) {
      return res.status(429).json({ 
        message: 'Please wait for the other user to respond before sending another message.' 
      });
    }

    const conversationData = typeof conversation.conversation === 'string' 
      ? JSON.parse(conversation.conversation) 
      : conversation.conversation;

    const newMessage = {
      id: uuidv4(),
      sender: currentUser,
      text: messageText.trim(),
      timestamp: new Date().toISOString(),
      read: false,
      liked: false,
      type: 'message'
    };

    if (replyTo) {
      newMessage.replyTo = replyTo;
    }

    // Add message to conversation
    conversationData.messages.push(newMessage);

    // Update unread count for the recipient
    if (!conversationData.metadata) {
      conversationData.metadata = {
        unreadCount: {},
        lastRead: {}
      };
    }

    const recipientUser = toUser.trim();
    conversationData.metadata.unreadCount[recipientUser] = 
      (conversationData.metadata.unreadCount[recipientUser] || 0) + 1;

    // Reset auto-delete timer (extend by 7 days)
    const autoDeleteAt = new Date();
    autoDeleteAt.setDate(autoDeleteAt.getDate() + 7);

    // Update conversation in database
    await db.query(`
      UPDATE conversations 
      SET conversation = ?, 
          last_message_at = NOW(), 
          pending_response_from = ?,
          auto_delete_at = ?
      WHERE id = ?
    `, [
      JSON.stringify(conversationData), 
      recipientUser, // Now the other user needs to respond
      autoDeleteAt,
      conversation.id
    ]);

    res.status(201).json({ 
      message: 'Message sent successfully',
      messageId: newMessage.id 
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark messages as read
router.post('/mark-read', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user.username;
    const { otherUser } = req.body;

    if (!currentUser) {
      return res.status(401).json({ message: 'User not authenticated properly' });
    }

    if (!otherUser || otherUser.trim() === '') {
      return res.status(400).json({ message: 'Other user is required' });
    }

    const conversation = await getOrCreateConversation(currentUser, otherUser.trim());
    const conversationData = typeof conversation.conversation === 'string' 
      ? JSON.parse(conversation.conversation) 
      : conversation.conversation;

    // Mark all messages as read and reset unread count
    conversationData.messages.forEach(msg => {
      if (msg.sender !== currentUser) {
        msg.read = true;
      }
    });

    if (!conversationData.metadata) {
      conversationData.metadata = { unreadCount: {}, lastRead: {} };
    }

    conversationData.metadata.unreadCount[currentUser] = 0;
    conversationData.metadata.lastRead[currentUser] = new Date().toISOString();

    // Clear pending response if this user was supposed to respond
    const clearPending = conversation.pending_response_from === currentUser;

    await db.query(`
      UPDATE conversations 
      SET conversation = ?${clearPending ? ', pending_response_from = NULL' : ''}
      WHERE id = ?
    `, [JSON.stringify(conversationData), conversation.id]);

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Like/unlike a message
router.post('/like', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user.username;
    const { conversationId, messageId, liked } = req.body;

    if (!currentUser) {
      return res.status(401).json({ message: 'User not authenticated properly' });
    }

    if (!conversationId || !messageId) {
      return res.status(400).json({ message: 'Conversation ID and message ID are required' });
    }

    const [conversations] = await db.query(
      'SELECT * FROM conversations WHERE id = ?',
      [conversationId]
    );

    if (conversations.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const conversation = conversations[0];
    const conversationData = typeof conversation.conversation === 'string' 
      ? JSON.parse(conversation.conversation) 
      : conversation.conversation;

    // Find and update the message
    const messageIndex = conversationData.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {
      return res.status(404).json({ message: 'Message not found' });
    }

    conversationData.messages[messageIndex].liked = liked;

    await db.query(
      'UPDATE conversations SET conversation = ? WHERE id = ?',
      [JSON.stringify(conversationData), conversationId]
    );

    res.json({ message: 'Message updated successfully' });
  } catch (error) {
    console.error('Error updating message like:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Block/Unblock user
router.post('/block', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user.username;
    const { otherUser, block } = req.body; // block: true/false

    if (!otherUser || otherUser.trim() === '') {
      return res.status(400).json({ message: 'Other user is required' });
    }

    if (currentUser === otherUser.trim()) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    const conversation = await getOrCreateConversation(currentUser, otherUser.trim());
    const conversationData = typeof conversation.conversation === 'string' 
      ? JSON.parse(conversation.conversation) 
      : conversation.conversation;

    if (block) {
      // Add system message about blocking
      const blockMessage = {
        id: uuidv4(),
        sender: 'system',
        text: `${currentUser} blocked ${otherUser.trim()}`,
        timestamp: new Date().toISOString(),
        read: true,
        liked: false,
        type: 'system'
      };

      conversationData.messages.push(blockMessage);

      const newStatus = conversation.user1 === currentUser ? 'blocked_by_user1' : 'blocked_by_user2';

      await db.query(`
        UPDATE conversations 
        SET conversation = ?, status = ?, blocked_by = ?, blocked_at = NOW()
        WHERE id = ?
      `, [JSON.stringify(conversationData), newStatus, currentUser, conversation.id]);

      res.json({ message: 'User blocked successfully' });
    } else {
      // Unblock - add system message
      const unblockMessage = {
        id: uuidv4(),
        sender: 'system',
        text: `${currentUser} unblocked ${otherUser.trim()}`,
        timestamp: new Date().toISOString(),
        read: true,
        liked: false,
        type: 'system'
      };

      conversationData.messages.push(unblockMessage);

      await db.query(`
        UPDATE conversations 
        SET conversation = ?, status = 'active', blocked_by = NULL, blocked_at = NULL
        WHERE id = ?
      `, [JSON.stringify(conversationData), conversation.id]);

      res.json({ message: 'User unblocked successfully' });
    }
  } catch (error) {
    console.error('Error blocking/unblocking user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete conversation (soft delete)
router.delete('/conversation/:otherUser', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user.username;
    const { otherUser } = req.params;

    if (!otherUser || otherUser.trim() === '') {
      return res.status(400).json({ message: 'Other user parameter is required' });
    }

    const conversation = await getOrCreateConversation(currentUser, otherUser.trim());

    await db.query(
      'UPDATE conversations SET status = ? WHERE id = ?',
      ['deleted', conversation.id]
    );

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search messages across all conversations
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user.username;
    const { query } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const [conversations] = await db.query(`
      SELECT id, user1, user2, conversation 
      FROM conversations 
      WHERE (user1 = ? OR user2 = ?) AND status != 'deleted'
    `, [currentUser, currentUser]);

    const searchResults = [];

    conversations.forEach(conv => {
      const otherUser = conv.user1 === currentUser ? conv.user2 : conv.user1;
      const conversationData = typeof conv.conversation === 'string' 
        ? JSON.parse(conv.conversation) 
        : conv.conversation;

      const matchingMessages = conversationData.messages.filter(msg => 
        msg.text.toLowerCase().includes(query.trim().toLowerCase()) && msg.type === 'message'
      );

      matchingMessages.forEach(msg => {
        searchResults.push({
          conversationId: conv.id,
          otherUser,
          message: msg,
          snippet: msg.text
        });
      });
    });

    res.json(searchResults);
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;