require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0'; // Critical for Render

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check (required by Render)
app.get('/health', (req, res) => res.status(200).send('OK'));

// Root route - serves your landing page
app.get('/', (req, res) => {
  res.send(`
    <h1>Welcome to Our Service</h1>
    <p>Available plans:</p>
    <ul>
      <li><a href="/subscribe?plan=starter">Starter Plan</a></li>
      <li><a href="/subscribe?plan=pro">Pro Plan</a></li>
    </ul>
  `);
});

// Stripe subscription handler
app.get('/subscribe', async (req, res) => {
  try {
    const priceId = req.query.plan === 'pro' 
      ? 'price_1RQwwfQ7aI0fg0NlHxqF0ZDy' 
      : 'price_1RQwvgQ7aI0fg0NlJQLVMok9';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
    });
    res.redirect(303, session.url);
  } catch (err) {
    console.error('Stripe Error:', err);
    res.status(500).send(`Payment Error: ${err.message}`);
  }
});

// Success and cancel routes
app.get('/success', (req, res) => res.send('✅ Payment succeeded!'));
app.get('/cancel', (req, res) => res.send('❌ Payment canceled'));

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`🌐 External URL: ${process.env.BASE_URL}`);
});
