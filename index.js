require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0'; // Required for Render

// Validate and sanitize BASE_URL
const validateAndFormatUrl = (url) => {
  if (!url) throw new Error('URL is required');
  if (!url.match(/^https?:\/\//)) {
    url = `https://${url}`;
  }
  url = url.trim().replace(/\/+$/, '');
  if (!url.match(/^https?:\/\/[^\s\/$.?#].[^\s]*$/)) {
    throw new Error(`Invalid URL format: ${url}`);
  }
  return url;
};

// Get BASE_URL with fallback
const getBaseUrl = () => {
  try {
    return validateAndFormatUrl(
      process.env.BASE_URL || `http://localhost:${PORT}`
    );
  } catch (err) {
    console.error('❌ Invalid BASE_URL:', err.message);
    return `https://render-express-deployment-k27o.onrender.com`;
  }
};

// View engine and middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Health check for Render
app.get('/health', (req, res) => res.send('OK'));

// Home route – show pricing page
app.get('/', (req, res) => {
  res.render('index', { baseUrl: getBaseUrl() });
});

// Stripe subscription route
app.get('/subscribe', async (req, res) => {
  try {
    const BASE_URL = getBaseUrl();
    const plan = req.query.plan;

    const priceLookup = {
      starter: 'price_1RQwvgQ7aI0fg0NlJQLVMok9',
      pro: 'price_1RQwwfQ7aI0fg0NlHxqF0ZDy'
    };

    const priceId = priceLookup[plan];

    if (!priceId) {
      return res.status(400).send('Invalid plan selected.');
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/cancel`
    });

    res.redirect(303, session.url);
  } catch (err) {
    console.error('💥 Stripe Error:', err.message);
    res.status(500).send(`Checkout failed: ${err.message}`);
  }
});

// Render success and cancel pages
app.get('/success', (req, res) => res.render('success'));
app.get('/cancel', (req, res) => res.render('cancel'));

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`🔗 Base URL: ${getBaseUrl()}`);
});
