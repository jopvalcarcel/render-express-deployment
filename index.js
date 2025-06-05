require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0'; // Required for Render

// 1. STRICT URL VALIDATION
const validateAndFormatUrl = (url) => {
  if (!url) throw new Error('URL is required');
  
  // Ensure proper protocol
  if (!url.match(/^https?:\/\//)) {
    url = `https://${url}`;
  }
  
  // Remove trailing slashes and whitespace
  url = url.trim().replace(/\/+$/, '');
  
  // Final validation
  if (!url.match(/^https?:\/\/[^\s\/$.?#].[^\s]*$/)) {
    throw new Error(`Invalid URL format: ${url}`);
  }
  
  return url;
};

// 2. GET BASE_URL FROM ENV (with fallback)
const getBaseUrl = () => {
  try {
    return validateAndFormatUrl(
      process.env.BASE_URL || `http://localhost:${PORT}`
    );
  } catch (err) {
    console.error('❌ Invalid BASE_URL:', err.message);
    // Fallback to Render's default if available
    return `https://render-express-deployment-k27o.onrender.com`;
  }
};

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check (for Render)
app.get('/health', (req, res) => res.send('OK'));

// 3. ROUTE HANDLERS
app.get('/', (req, res) => {
  res.send(`
    <h1>Choose Plan</h1>
    <a href="/subscribe?plan=starter">Starter</a> | 
    <a href="/subscribe?plan=pro">Pro</a>
    <p>Using BASE_URL: ${getBaseUrl()}</p>
  `);
});

app.get('/subscribe', async (req, res) => {
  try {
    const BASE_URL = getBaseUrl();
    console.log('Using BASE_URL:', BASE_URL); // DEBUG

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: req.query.plan === 'pro' 
          ? 'price_1RQwwfQ7aI0fg0NlHxqF0ZDy' 
          : 'price_1RQwvgQ7aI0fg0NlJQLVMok9',
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/cancel`,
    });
    
    res.redirect(303, session.url);
  } catch (err) {
    console.error('💥 Stripe Error:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.status(400).send(`Checkout failed: ${err.message}`);
  }
});

// Success/Cancel handlers
app.get('/success', (req, res) => res.send('✅ Payment succeeded!'));
app.get('/cancel', (req, res) => res.send('❌ Payment canceled'));

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`🔗 Base URL: ${getBaseUrl()}`);
});
