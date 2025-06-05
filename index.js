require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => res.send('OK'));

// URL Validation Helper
const validateUrl = (url) => {
  if (!url) throw new Error('URL is required');
  if (!url.startsWith('http')) throw new Error('URL must start with http:// or https://');
  return url.replace(/([^:]\/)\/+/g, '$1'); // Remove duplicate slashes
};

// Root route with plan links
app.get('/', (req, res) => {
  res.send(`
    <h1>Choose a Plan</h1>
    <a href="/subscribe?plan=starter">Starter Plan</a><br>
    <a href="/subscribe?plan=pro">Pro Plan</a>
  `);
});

// Stripe Checkout
app.get('/subscribe', async (req, res) => {
  try {
    // Validate BASE_URL first
    const BASE_URL = validateUrl(process.env.BASE_URL || `http://localhost:${PORT}`);
    
    const priceId = req.query.plan === 'pro' 
      ? 'price_1RQwwfQ7aI0fg0NlHxqF0ZDy' 
      : 'price_1RQwvgQ7aI0fg0NlJQLVMok9';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${BASE_URL}/success`,
      cancel_url: `${BASE_URL}/cancel`,
    });

    res.redirect(303, session.url);
  } catch (err) {
    console.error('Stripe Error:', {
      message: err.message,
      BASE_URL: process.env.BASE_URL,
      error: err
    });
    res.status(400).send(`Checkout Error: ${err.message}`);
  }
});

// Success/Cancel pages
app.get('/success', (req, res) => res.send('✅ Payment succeeded!'));
app.get('/cancel', (req, res) => res.send('❌ Payment canceled'));

app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});
