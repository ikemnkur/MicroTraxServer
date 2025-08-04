// server.js - Main server file
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
// const PORT = process.env.AD_PORT || 3001;

const authenticateToken = require('../middleware/auth');

// Middleware
// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5001',
      'https://microtrax.netlify.app',
      "https://servers4sqldb.uc.r.appspot.com",
      "https://orca-app-j32vd.ondigitalocean.app",
      "https://monkfish-app-mllt8.ondigitalocean.app/",
      "*"
      // Add any other origins you want to allow
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Database connection
const dbConfig = {
 host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_4_ADS_NAME || "ad_system",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2.5 * 1024 * 1024 // 2.5MB
  }
});

// JWT Authentication middleware
// const authenticateToken = (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];

//   if (!token) {
//     return res.status(401).json({ error: 'Access token required' });
//   }

//   jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
//     if (err) {
//       return res.status(403).json({ error: 'Invalid token' });
//     }
//     req.user = user;
//     next();
//   });
// };

// Database helper functions
const executeQuery = async (query, params = []) => {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// =================
// AUTH ROUTES
// =================

// Register user
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await executeQuery(
      'SELECT id FROM advertisers WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await executeQuery(
      'INSERT INTO advertisers (name, email, password, credits) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 5000] // Starting credits
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.insertId, email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: result.insertId, name, email, credits: 5000 }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const users = await executeQuery(
      'SELECT id, name, email, password, credits FROM advertisers WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, credits: user.credits }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =================
// USER ROUTES
// =================

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const users = await executeQuery(
      'SELECT id, name, email, credits, created_at FROM advertisers WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user credits
app.get('/api/user/credits', authenticateToken, async (req, res) => {
  try {
    const users = await executeQuery(
      'SELECT credits FROM advertisers WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ credits: users[0].credits });
  } catch (error) {
    console.error('Get credits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user credits
app.put('/api/user/credits', authenticateToken, async (req, res) => {
  try {
    const { amount, operation } = req.body; // operation: 'add' or 'subtract'

    const users = await executeQuery(
      'SELECT credits FROM advertisers WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentCredits = users[0].credits;
    let newCredits;

    if (operation === 'add') {
      newCredits = currentCredits + amount;
    } else if (operation === 'subtract') {
      newCredits = Math.max(0, currentCredits - amount);
    } else {
      return res.status(400).json({ error: 'Invalid operation' });
    }

    await executeQuery(
      'UPDATE advertisers SET credits = ? WHERE id = ?',
      [newCredits, req.user.userId]
    );

    res.json({ credits: newCredits });
  } catch (error) {
    console.error('Update credits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =================
// AD ROUTES
// =================

// Create new ad
app.post('/ad', authenticateToken, upload.single('media'), async (req, res) => {
// app.post('/ad',  upload.single('media'), async (req, res) => {
  try {
    const {
      title,
      description,
      link,
      format,
      budget,
      reward,
      frequency,
      quiz
    } = req.body;

    console.log('Create ad');
    // console.log('Active User ID:', req.user);

    // Validate required fields
    if (!title || !description || !link || !format || !budget) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate budget range
    if (budget < 2000 || budget > 20000) {
      return res.status(400).json({ error: 'Budget must be between 2000 and 20000 credits' });
    }

    // Validate reward range
    if (reward < 0 || reward > 100) {
      return res.status(400).json({ error: 'Reward must be between 0 and 100 credits' });
    }

    // Check user has enough credits
    const users = await executeQuery(
      'SELECT credits FROM advertisers WHERE id = ?',
      [req.user.user_id]
    );

    if (users.length === 0 || users[0].credits < budget) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    // Get media URL if file uploaded
    const mediaUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Create ad
    const adResult = await executeQuery(
      `INSERT INTO ads (user_id, title, description, link, format, media_url, budget, reward, frequency, active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.userId, title, description, link, format, mediaUrl, budget, reward, frequency, true]
    );

    const adId = adResult.insertId;

    // Parse and insert quiz questions
    if (quiz) {
      const quizQuestions = JSON.parse(quiz);
      for (const question of quizQuestions) {
        await executeQuery(
          `INSERT INTO quiz_questions (ad_id, question, type, options, correct_answer, short_answer) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            adId,
            question.question,
            question.type,
            question.type === 'multiple' ? JSON.stringify(question.options) : null,
            question.type === 'multiple' ? question.correct : null,
            question.type === 'short' ? question.answer : null
          ]
        );
      }
    }

    res.status(201).json({
      message: 'Ad created successfully',
      adId,
      mediaUrl
    });
  } catch (error) {
    console.error('Create ad error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's ads
app.get('/ad', authenticateToken, async (req, res) => {
  try {
    const ads = await executeQuery(
      `SELECT a.*, 
       COUNT(DISTINCT ai_view.id) as views,
       COUNT(DISTINCT ai_completion.id) as completions,
       COALESCE(SUM(ai_reward.credits_earned), 0) as total_rewards_paid
       FROM ads a
       LEFT JOIN ad_interactions ai_view ON a.id = ai_view.ad_id AND ai_view.interaction_type = 'view'
       LEFT JOIN ad_interactions ai_completion ON a.id = ai_completion.ad_id AND ai_completion.interaction_type = 'completion'
       LEFT JOIN ad_interactions ai_reward ON a.id = ai_reward.ad_id AND ai_reward.interaction_type = 'reward_claimed'
       WHERE a.user_id = ?
       GROUP BY a.id
       ORDER BY a.created_at DESC`,
      [req.user.userId]
    );

    res.json({ ads });
  } catch (error) {
    console.error('Get ads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single ad with quiz questions
app.get('/ad/:id', authenticateToken, async (req, res) => {
  try {
    const adId = req.params.id;

    // Get ad details
    const ads = await executeQuery(
      'SELECT * FROM ads WHERE id = ? AND user_id = ?',
      [adId, req.user.userId]
    );

    if (ads.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Get quiz questions
    const quizQuestions = await executeQuery(
      'SELECT * FROM quiz_questions WHERE ad_id = ?',
      [adId]
    );

    // Format quiz questions
    const formattedQuiz = quizQuestions.map(q => ({
      id: q.id,
      question: q.question,
      type: q.type,
      options: q.options ? JSON.parse(q.options) : null,
      correct: q.correct_answer,
      answer: q.short_answer
    }));

    res.json({
      ad: {
        ...ads[0],
        quiz: formattedQuiz
      }
    });
  } catch (error) {
    console.error('Get ad error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update ad
app.put('/ad/:id', authenticateToken, upload.single('media'), async (req, res) => {
  try {
    const adId = req.params.id;
    const {
      title,
      description,
      link,
      format,
      budget,
      reward,
      frequency,
      quiz
    } = req.body;

    // Check if ad belongs to user
    const ads = await executeQuery(
      'SELECT * FROM ads WHERE id = ? AND user_id = ?',
      [adId, req.user.userId]
    );

    if (ads.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Get media URL if file uploaded
    const mediaUrl = req.file ? `/uploads/${req.file.filename}` : ads[0].media_url;

    // Update ad
    await executeQuery(
      `UPDATE ads SET title = ?, description = ?, link = ?, format = ?, 
       media_url = ?, budget = ?, reward = ?, frequency = ? WHERE id = ?`,
      [title, description, link, format, mediaUrl, budget, reward, frequency, adId]
    );

    // Update quiz questions if provided
    if (quiz) {
      // Delete existing quiz questions
      await executeQuery('DELETE FROM quiz_questions WHERE ad_id = ?', [adId]);

      // Insert new quiz questions
      const quizQuestions = JSON.parse(quiz);
      for (const question of quizQuestions) {
        await executeQuery(
          `INSERT INTO quiz_questions (ad_id, question, type, options, correct_answer, short_answer) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            adId,
            question.question,
            question.type,
            question.type === 'multiple' ? JSON.stringify(question.options) : null,
            question.type === 'multiple' ? question.correct : null,
            question.type === 'short' ? question.answer : null
          ]
        );
      }
    }

    res.json({ message: 'Ad updated successfully' });
  } catch (error) {
    console.error('Update ad error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete ad
app.delete('/ad/:id', authenticateToken, async (req, res) => {
  try {
    const adId = req.params.id;

    // Check if ad belongs to user
    const ads = await executeQuery(
      'SELECT * FROM ads WHERE id = ? AND user_id = ?',
      [adId, req.user.userId]
    );

    if (ads.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Delete quiz questions first (foreign key constraint)
    await executeQuery('DELETE FROM quiz_questions WHERE ad_id = ?', [adId]);

    // Delete ad interactions
    await executeQuery('DELETE FROM ad_interactions WHERE ad_id = ?', [adId]);

    // Delete ad
    await executeQuery('DELETE FROM ads WHERE id = ?', [adId]);

    // Delete media file if exists
    if (ads[0].media_url) {
      const filePath = path.join(__dirname, ads[0].media_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ message: 'Ad deleted successfully' });
  } catch (error) {
    console.error('Delete ad error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle ad active status
app.patch('/ad/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const adId = req.params.id;

    // Check if ad belongs to user
    const ads = await executeQuery(
      'SELECT active FROM ads WHERE id = ? AND user_id = ?',
      [adId, req.user.userId]
    );

    if (ads.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    const newActiveStatus = !ads[0].active;

    await executeQuery(
      'UPDATE ads SET active = ? WHERE id = ?',
      [newActiveStatus, adId]
    );

    res.json({ 
      message: 'Ad status updated', 
      active: newActiveStatus 
    });
  } catch (error) {
    console.error('Toggle ad error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =================
// AD INTERACTION ROUTES
// =================

// Get ads to display (for viewers)
app.get('/display', authenticateToken, async (req, res) => {
  try {
    const { format, excludeUserId } = req.query;

    let query = `
      SELECT a.*, u.name as advertiser_name,
      COUNT(DISTINCT ai_view.id) as views,
      COUNT(DISTINCT ai_completion.id) as completions
      FROM ads a
      JOIN advertisers u ON a.user_id = u.id
      LEFT JOIN ad_interactions ai_view ON a.id = ai_view.ad_id AND ai_view.interaction_type = 'view'
      LEFT JOIN ad_interactions ai_completion ON a.id = ai_completion.ad_id AND ai_completion.interaction_type = 'completion'
      WHERE a.active = 1 AND a.spent < a.budget
    `;

    const params = [];

    if (format) {
      query += ' AND a.format = ?';
      params.push(format);
    }

    if (excludeUserId) {
      query += ' AND a.user_id != ?';
      params.push(excludeUserId);
    }

    query += ' GROUP BY a.id ORDER BY a.frequency DESC, RAND() LIMIT 10';

    const ads = await executeQuery(query, params);

    res.json({ ads });
  } catch (error) {
    console.error('Get display ads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record ad interaction
app.post('/ad/:id/interactions', authenticateToken, async (req, res) => {
  try {
    const adId = req.params.id;
    const { interactionType, creditsEarned = 0 } = req.body;

    // Validate interaction type
    const validTypes = ['view', 'completion', 'skip', 'reward_claimed'];
    if (!validTypes.includes(interactionType)) {
      return res.status(400).json({ error: 'Invalid interaction type' });
    }

    // Check if ad exists and is active
    const ads = await executeQuery(
      'SELECT * FROM ads WHERE id = ? AND active = 1',
      [adId]
    );

    if (ads.length === 0) {
      return res.status(404).json({ error: 'Ad not found or inactive' });
    }

    const ad = ads[0];

    // Record interaction
    await executeQuery(
      'INSERT INTO ad_interactions (ad_id, user_id, interaction_type, credits_earned) VALUES (?, ?, ?, ?)',
      [adId, req.user.userId, interactionType, creditsEarned]
    );

    // Update ad spent credits for views
    if (interactionType === 'view') {
      const costPerView = getCostPerView(ad.frequency);
      const newSpent = ad.spent + costPerView;
      
      await executeQuery(
        'UPDATE ads SET spent = ? WHERE id = ?',
        [newSpent, adId]
      );

      // Deduct credits from advertiser
      await executeQuery(
        'UPDATE advertisers SET credits = credits - ? WHERE id = ?',
        [costPerView, ad.user_id]
      );
    }

    // Add credits to viewer for rewards
    if (interactionType === 'reward_claimed' && creditsEarned > 0) {
      await executeQuery(
        'UPDATE advertisers SET credits = credits + ? WHERE id = ?',
        [creditsEarned, req.user.userId]
      );
    }

    res.json({ message: 'Interaction recorded successfully' });
  } catch (error) {
    console.error('Record interaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =================
// QUIZ ROUTES
// =================

// Submit quiz answer
app.post('/quiz/answer', authenticateToken, async (req, res) => {
  try {
    const { adId, questionId, answer, selectedOption } = req.body;

    // Get question details
    const questions = await executeQuery(
      'SELECT * FROM quiz_questions WHERE id = ? AND ad_id = ?',
      [questionId, adId]
    );

    if (questions.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const question = questions[0];
    let isCorrect = false;

    // Check answer based on question type
    if (question.type === 'multiple') {
      isCorrect = selectedOption === question.correct_answer;
    } else if (question.type === 'short') {
      const userAnswer = answer.toLowerCase().trim();
      const correctAnswer = question.short_answer.toLowerCase().trim();
      isCorrect = userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer);
    }

    res.json({ 
      correct: isCorrect,
      message: isCorrect ? 'Correct answer!' : 'Incorrect answer'
    });
  } catch (error) {
    console.error('Submit quiz answer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get random quiz question for ad
app.get('/ad/:id/quiz/random', authenticateToken, async (req, res) => {
  try {
    const adId = req.params.id;

    const questions = await executeQuery(
      'SELECT * FROM quiz_questions WHERE ad_id = ? ORDER BY RAND() LIMIT 1',
      [adId]
    );

    if (questions.length === 0) {
      return res.status(404).json({ error: 'No quiz questions found' });
    }

    const question = questions[0];
    
    // Format response
    const formattedQuestion = {
      id: question.id,
      question: question.question,
      type: question.type,
      options: question.options ? JSON.parse(question.options) : null
    };

    res.json({ question: formattedQuestion });
  } catch (error) {
    console.error('Get random quiz question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =================
// ANALYTICS ROUTES
// =================

// Get ad analytics
app.get('/ad/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const adId = req.params.id;

    // Check if ad belongs to user
    const ads = await executeQuery(
      'SELECT * FROM ads WHERE id = ? AND user_id = ?',
      [adId, req.user.userId]
    );

    if (ads.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Get detailed analytics
    const analytics = await executeQuery(
      `SELECT 
        interaction_type,
        COUNT(*) as count,
        SUM(credits_earned) as total_credits,
        DATE(created_at) as date
       FROM ad_interactions 
       WHERE ad_id = ?
       GROUP BY interaction_type, DATE(created_at)
       ORDER BY date DESC`,
      [adId]
    );

    // Get hourly breakdown for today
    const hourlyBreakdown = await executeQuery(
      `SELECT 
        HOUR(created_at) as hour,
        interaction_type,
        COUNT(*) as count
       FROM ad_interactions 
       WHERE ad_id = ? AND DATE(created_at) = CURDATE()
       GROUP BY HOUR(created_at), interaction_type
       ORDER BY hour`,
      [adId]
    );

    res.json({
      analytics,
      hourlyBreakdown
    });
  } catch (error) {
    console.error('Get ad analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user dashboard analytics
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get summary stats
    const summary = await executeQuery(
      `SELECT 
        COUNT(*) as total_ads,
        SUM(budget) as total_budget,
        SUM(spent) as total_spent,
        AVG(spent/budget * 100) as avg_budget_usage
       FROM ads 
       WHERE user_id = ?`,
      [userId]
    );

    // Get interaction stats
    const interactions = await executeQuery(
      `SELECT 
        ai.interaction_type,
        COUNT(*) as count,
        SUM(ai.credits_earned) as total_credits
       FROM ad_interactions ai
       JOIN ads a ON ai.ad_id = a.id
       WHERE a.user_id = ?
       GROUP BY ai.interaction_type`,
      [userId]
    );

    // Get recent activity
    const recentActivity = await executeQuery(
      `SELECT 
        a.title,
        ai.interaction_type,
        ai.created_at,
        u.name as viewer_name
       FROM ad_interactions ai
       JOIN ads a ON ai.ad_id = a.id
       JOIN advertisers u ON ai.user_id = u.id
       WHERE a.user_id = ?
       ORDER BY ai.created_at DESC
       LIMIT 20`,
      [userId]
    );

    res.json({
      summary: summary[0],
      interactions,
      recentActivity
    });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =================
// UTILITY FUNCTIONS
// =================

// Calculate cost per view based on frequency
function getCostPerView(frequency) {
  const costs = {
    low: 1,
    light: 2,
    moderate: 3,
    high: 4,
    aggressive: 5
  };
  return costs[frequency] || 3;
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// // Start server
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

module.exports = app;