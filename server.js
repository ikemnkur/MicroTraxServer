require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const transactionRoutes = require('./routes/transactions');
const wallet = require('./routes/wallet');
const search4users = require('./routes/search4users');


const app = express();

// CORS configuration
const corsOptions = {
  origin: 'http://localhost:3000', // Replace with your frontend URL
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/wallet', wallet);
app.use('/api/search', search4users);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));