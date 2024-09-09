// routes/paymentRoutes.js

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const db = require('../config/db');

router.post('/create-payment-intent', authenticateToken, async (req, res) => {
  const { amount, currency } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/confirm-payment', authenticateToken, async (req, res) => {
  const { paymentIntentId } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === 'succeeded') {
      // Update user's balance in the database
      const amountInDollars = paymentIntent.amount / 100; // Convert cents to dollars
      await db.query('UPDATE accounts SET balance = balance + ? WHERE user_id = ?', [amountInDollars, req.user.id]);
      res.json({ success: true, message: 'Payment confirmed and balance updated' });
    } else {
      res.status(400).json({ success: false, message: 'Payment not succeeded' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
