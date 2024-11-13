// routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user === 'admin') {
    return next();
  } else {
    res.redirect('/admin/login');
  }
}

// Login Page
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Handle Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Simple authentication (Replace with secure method)
  if (username === 'admin' && password === 'your_admin_password') {
    req.session.user = 'admin';
    res.redirect('/admin/dashboard');
  } else {
    res.render('login', { error: 'Invalid credentials' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Admin Dashboard
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    // Fetch initial data or stats if needed
    res.render('dashboard', { uptime: process.uptime() });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// View Records
router.get('/records/:table', isAuthenticated, async (req, res) => {
  const { table } = req.params;
  const { search, timeframe, sortField, sortOrder } = req.query;

  let validTables = ['accounts', 'transactions', 'withdraws', 'purchases'];
  if (!validTables.includes(table)) {
    return res.status(400).send('Invalid table name');
  }

  let query = `SELECT * FROM ${table}`;
  let queryParams = [];

  // Timeframe filter
  if (timeframe) {
    query += ` WHERE created_at >= NOW() - INTERVAL ? HOUR`;
    queryParams.push(parseInt(timeframe));
  }

  // Search filter
  if (search) {
    const searchFields = {
      accounts: ['user_id', 'account_status', 'account_id'],
      transactions: ['transaction_type', 'status', 'message', 'reference_id', 'receiving_user'],
      withdraws: ['username', 'userid', 'reference_code', 'method'],
      purchases: ['username', 'userid', 'reference_code', 'stripe', 'type', 'status', 'transactionId'],
    };
    const fields = searchFields[table];
    if (fields) {
      const searchQuery = fields.map(field => `${field} LIKE ?`).join(' OR ');
      query += timeframe ? ' AND (' : ' WHERE (';
      query += searchQuery + ')';
      fields.forEach(() => queryParams.push(`%${search}%`));
    }
  }

  // Sorting
  if (sortField && sortOrder) {
    query += ` ORDER BY ${sortField} ${sortOrder.toUpperCase()}`;
  } else {
    query += ` ORDER BY created_at DESC`;
  }

  try {
    const [rows] = await db.query(query, queryParams);
    res.render('records', {
      table,
      records: rows,
      search,
      timeframe,
      sortField,
      sortOrder,
    });
  } catch (error) {
    console.error('DB Error:', error);
    res.status(500).send('Database error');
  }
});

// Edit Record
router.get('/edit/:table/:id', isAuthenticated, async (req, res) => {
  const { table, id } = req.params;

  let validTables = ['accounts', 'transactions', 'withdraws', 'purchases'];
  if (!validTables.includes(table)) {
    return res.status(400).send('Invalid table name');
  }

  try {
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).send('Record not found');
    }
    res.render('edit', { table, record: rows[0] });
  } catch (error) {
    console.error('DB Error:', error);
    res.status(500).send('Database error');
  }
});

// Handle Edit
router.post('/edit/:table/:id', isAuthenticated, async (req, res) => {
  const { table, id } = req.params;
  const data = req.body;

  let validTables = ['accounts', 'transactions', 'withdraws', 'purchases'];
  if (!validTables.includes(table)) {
    return res.status(400).send('Invalid table name');
  }

  const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
  const values = Object.values(data);

  const query = `UPDATE ${table} SET ${fields} WHERE id = ?`;

  try {
    await db.query(query, [...values, id]);
    res.redirect(`/admin/records/${table}`);
  } catch (error) {
    console.error('DB Error:', error);
    res.status(500).send('Database error');
  }
});

module.exports = router;
