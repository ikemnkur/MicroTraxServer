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

router.get('/favorites', authenticateToken, async (req, res) => {
  const { term } = req.query;
  console.log("Searcing for: ", term)

  if (!term) {
    return res.status(400).json({ message: 'Search term is required' });
  }

  try {
    const [favorites] = await db.query("SELECT favorites FROM users WHERE user_id = ?", [req.user.id]);

    console.log("Favorites: ", favorites)
    if (favorites.length === 0) {
      return res.status(404).json({ message: 'No favorites found' });
    }
    const favoriteIds = favorites[0].favorites.split(',').map(Number);
    console.log("Favorite IDs: ", favoriteIds)
    const [users] = await db.query(
      `SELECT id, username, profilePic, user_id, accountTier, rating
       FROM users
       WHERE id IN (?)
       LIMIT 10`,
      [favoriteIds]
    );
    console.log("Users: ", users)
    if (users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }
    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
  // const [users] = await db.query(
  //   `SELECT id, username, profilePic, user_id, accountTier, rating
  //    FROM users
  //    WHERE username LIKE ?
  //    LIMIT 10`,
  //   [`%${term}%`]
  // );

  //   res.json(users);
  // } catch (error) {
  //   console.error('Error searching users:', error);
  //   res.status(500).json({ message: 'Server error' });
  // }
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

module.exports = router;