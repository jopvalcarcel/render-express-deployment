require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0'; // ← Critical for Render

// Health check (MUST be first route)
app.get('/health', (req, res) => res.status(200).send('OK'));

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Stripe routes
app.get('/subscribe', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: req.query.plan === 'pro' 
          ? 'price_1RQwwfQ7aI0fg0NlHxqF0ZDy' 
          : 'price_1RQwvgQ7aI0fg0NlJQLVMok9',
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
    });
    res.redirect(303, session.url);
  } catch (err) {
    console.error('Stripe Error:', err);
    res.status(500).send(err.message);
  }
});

// Start server (with HOST binding)
app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on ${HOST}:${PORT}`);
});
