const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/search', authenticateToken, async (req, res) => {
  const { term } = req.query;
  console.log("Searcing for: ", term)

  if (!term) {
    return res.status(400).json({ message: 'Search term is required' });
  }

  try {
    const [users] = await db.query(
      `SELECT id, username, profilePic, user_id, accountTier, rating
       FROM users
       WHERE username LIKE ?
       LIMIT 10`,
      [`%${term}%`]
    );

    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/users/search', authenticateToken, async (req, res) => {
  const { term } = req.query;

  if (!term) {
    return res.status(400).json({ message: 'Search term is required' });
  }

  try {
    const [users] = await db.query(
      `SELECT id, username, avatar, user_id, rating, accountTier
       FROM users
       WHERE username LIKE ?
       LIMIT 10`,
      [`%${term}%`]
    );

    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



router.get('/favorites', authenticateToken, async (req, res) => {
  const { term } = req.query;
  console.log("Favorite Searching for:", term);
  
  if (!term) {
    return res.status(400).json({ message: 'Search term is required' });
  }
  
  try {
    // Get user info with favorites
    const [results] = await db.query(
      "SELECT * FROM users WHERE id = ?", 
      [req.user.id]
    );
    
    console.log("Results:", results);
    
    // Check if user exists
    if (!results || results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get favorites from user data
    const favoritesString = results[0].Favorites;
    console.log("Favorites string:", favoritesString);
    
    // Check if favorites exist
    if (!favoritesString) {
      return res.status(200).json([]); // Return empty array if no favorites
    }
    
    // Parse the JSON string into an array and convert to numbers
    let favoriteIds = [];
    try {
      // Try parsing as JSON array first (["9", "11", "12"])
      const parsedArray = JSON.parse(favoritesString);
      favoriteIds = parsedArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    } catch (parseError) {
      // Fallback to comma-separated string if JSON parsing fails
      console.log("JSON parse failed, trying comma separation:", parseError);
      favoriteIds = favoritesString.split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id));
    }
    
    console.log("Favorite IDs:", favoriteIds);
    
    // Check if we have any valid favorite IDs
    if (favoriteIds.length === 0) {
      return res.status(200).json([]); // Return empty array if no valid favorite IDs
    }
    
    // Fix the SQL query syntax and search for users in favorites matching the term
    const [users] = await db.query(
      `SELECT id, username, profilePic, user_id, accountTier, rating, firstName, lastName
       FROM users
       WHERE id IN (?) AND username LIKE ?
       LIMIT 10`,
      [favoriteIds, `%${term}%`]
    );
    
    console.log("Users:", users);
    
    // Return the results (empty array if no users found)
    res.json(users || []);
    
  } catch (error) {
    console.error('Error searching favorites:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;