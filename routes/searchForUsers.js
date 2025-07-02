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



// router.get('/favorites', authenticateToken, async (req, res) => {
//   const { term } = req.query;
//   console.log("Favorite Searching for:", term);
  
//   if (!term) {
//     return res.status(400).json({ message: 'Search term is required' });
//   }
  
//   try {
//     // Get user info with favorites
//     const [results] = await db.query(
//       "SELECT * FROM users WHERE id = ?", 
//       [req.user.id]
//     );
    
//     console.log("Results:", results);
    
//     // Check if user exists
//     if (!results || results.length === 0) {
//       return res.status(404).json({ message: 'User not found' });
//     }
    
//     // Get favorites from user data
//     const favoritesString = results[0].Favorites;
//     console.log("Favorites string:", favoritesString);
    
//     // Check if favorites exist
//     if (!favoritesString) {
//       return res.status(200).json([]); // Return empty array if no favorites
//     }
    
//     // Parse the JSON string into an array and convert to numbers
//     let favoriteIds = [];
//     try {
//       // Try parsing as JSON array first (["9", "11", "12"])
//       const parsedArray = JSON.parse(favoritesString);
//       favoriteIds = parsedArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
//     } catch (parseError) {
//       // Fallback to comma-separated string if JSON parsing fails
//       console.log("JSON parse failed, trying comma separation:", parseError);
//       favoriteIds = favoritesString.split(',')
//         .map(id => parseInt(id.trim(), 10))
//         .filter(id => !isNaN(id));
//     }
    
//     console.log("Favorite IDs:", favoriteIds);
    
//     // Check if we have any valid favorite IDs
//     if (favoriteIds.length === 0) {
//       return res.status(200).json([]); // Return empty array if no valid favorite IDs
//     }
    
//     // Fix the SQL query syntax and search for users in favorites matching the term
//     const [users] = await db.query(
//       `SELECT id, username, profilePic, user_id, accountTier, rating, firstName, lastName
//        FROM users
//        WHERE id IN (?) AND username LIKE ?
//        LIMIT 10`,
//       [favoriteIds, `%${term}%`]
//     );
    
//     console.log("Users:", users);
    
//     // Return the results (empty array if no users found)
//     res.json(users || []);
    
//   } catch (error) {
//     console.error('Error searching favorites:', error);
//     res.status(500).json({ 
//       message: 'Server error', 
//       error: error.message 
//     });
//   }
// });

router.get('/favorites', authenticateToken, async (req, res) => {
  const { term } = req.query;
  console.log("Favorite Searching for:", term);
  
  if (!term) {
    return res.status(400).json({ message: 'Search term is required' });
  }
  
  try {
    const currentUserId = req.user.user_id; // Use user_id from token
    console.log("Current user ID:", currentUserId);
    
    // Search within the current user's favorites using the junction table
    // Join user_favorites with users table to get user details
    const [users] = await db.query(`
      SELECT 
        u.id, 
        u.username, 
        u.profilePic, 
        u.user_id, 
        u.accountTier, 
        u.rating, 
        u.firstName, 
        u.lastName,
        u.email,
        uf.created_at as favorited_at
      FROM user_favorites uf
      JOIN users u ON uf.favorite_user_id = u.user_id
      WHERE uf.user_id = ? 
        AND (
          u.username LIKE ? OR 
          u.firstName LIKE ? OR 
          u.lastName LIKE ? OR
          CONCAT(u.firstName, ' ', u.lastName) LIKE ?
        )
      ORDER BY uf.created_at DESC
      LIMIT 10
    `, [
      currentUserId, 
      `%${term}%`, 
      `%${term}%`, 
      `%${term}%`, 
      `%${term}%`
    ]);
    
    console.log("Found favorite users:", users.length);
    console.log("Users:", users);
    
    // Return the results (empty array if no users found)
    res.json({
      success: true,
      count: users.length,
      users: users || []
    });
    
  } catch (error) {
    console.error('Error searching favorites:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Optional: Enhanced version with pagination and more search options
router.get('/favorites/search', authenticateToken, async (req, res) => {
  const { 
    term, 
    page = 1, 
    limit = 10, 
    sortBy = 'favorited_at', 
    sortOrder = 'DESC' 
  } = req.query;
  
  console.log("Advanced favorite search for:", term);
  
  if (!term) {
    return res.status(400).json({ message: 'Search term is required' });
  }
  
  try {
    const currentUserId = req.user.user_id;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Validate sort parameters
    const allowedSortBy = ['favorited_at', 'username', 'firstName', 'lastName', 'rating'];
    const allowedSortOrder = ['ASC', 'DESC'];
    
    const validSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'favorited_at';
    const validSortOrder = allowedSortOrder.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    
    // Get total count for pagination
    const [countResult] = await db.query(`
      SELECT COUNT(*) as total
      FROM user_favorites uf
      JOIN users u ON uf.favorite_user_id = u.user_id
      WHERE uf.user_id = ? 
        AND (
          u.username LIKE ? OR 
          u.firstName LIKE ? OR 
          u.lastName LIKE ? OR
          CONCAT(u.firstName, ' ', u.lastName) LIKE ?
        )
    `, [
      currentUserId, 
      `%${term}%`, 
      `%${term}%`, 
      `%${term}%`, 
      `%${term}%`
    ]);
    
    const totalCount = countResult[0].total;
    
    // Get paginated results
    const [users] = await db.query(`
      SELECT 
        u.id, 
        u.username, 
        u.profilePic, 
        u.user_id, 
        u.accountTier, 
        u.rating, 
        u.firstName, 
        u.lastName,
        u.email,
        u.bio,
        uf.created_at as favorited_at
      FROM user_favorites uf
      JOIN users u ON uf.favorite_user_id = u.user_id
      WHERE uf.user_id = ? 
        AND (
          u.username LIKE ? OR 
          u.firstName LIKE ? OR 
          u.lastName LIKE ? OR
          CONCAT(u.firstName, ' ', u.lastName) LIKE ?
        )
      ORDER BY ${validSortBy === 'favorited_at' ? 'uf.' + validSortBy : 'u.' + validSortBy} ${validSortOrder}
      LIMIT ? OFFSET ?
    `, [
      currentUserId, 
      `%${term}%`, 
      `%${term}%`, 
      `%${term}%`, 
      `%${term}%`,
      parseInt(limit),
      offset
    ]);
    
    console.log(`Found ${users.length} of ${totalCount} favorite users`);
    
    res.json({
      success: true,
      data: {
        users: users || [],
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: totalCount,
          total_pages: Math.ceil(totalCount / parseInt(limit)),
          has_next_page: offset + users.length < totalCount,
          has_prev_page: parseInt(page) > 1
        },
        search: {
          term: term,
          sort_by: validSortBy,
          sort_order: validSortOrder
        }
      }
    });
    
  } catch (error) {
    console.error('Error in advanced favorites search:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;