require('dotenv').config(); // MUST be at the very top

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced environment logging
console.log('Environment Check:', {
  NODE_ENV: process.env.NODE_ENV,
  BASE_URL: process.env.BASE_URL,
  PORT: PORT
});

// URL Configuration with validation
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`)
  .replace(/\/$/, ''); // Remove trailing slash
console.log('✅ Final BASE_URL:', BASE_URL);

// EJS view engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Conditionally apply JSON middleware
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

// Enhanced subscribe handler
app.get('/subscribe', async (req, res) => {
  const { plan } = req.query;

  const priceLookup = {
    starter: 'price_1RQwvgQ7aI0fg0NlJQLVMok9',
    pro: 'price_1RQwwfQ7aI0fg0NlHxqF0ZDy'
  };

  const priceId = priceLookup[plan];
  if (!priceId) return res.status(400).send('Invalid plan selected.');

  // URL construction with validation
  const urls = {
    success: `${BASE_URL}/success`,
    cancel: `${BASE_URL}/cancel`
  };
  console.log('Using URLs:', urls);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: urls.success,
      cancel_url: urls.cancel,
    });

    return res.redirect(303, session.url);
  } catch (err) {
    console.error('Stripe Error:', {
      message: err.message,
      urlsUsed: urls,
      rawError: err
    });
    return res.status(500).send(`Payment Error: ${err.message}`);
  }
});

app.get('/success', (req, res) => {
  res.send('✅ Subscription successful!');
});

app.get('/cancel', (req, res) => {
  res.send('❌ Subscription canceled.');
});

// Webhook handler
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY;
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('✅ New Subscription started');
        break;
      case 'invoice.paid':
        console.log('💰 Invoice paid');
        break;
      case 'invoice.payment_failed':
        console.log('❌ Invoice payment failed');
        break;
      case 'customer.subscription.updated':
        console.log('🔄 Subscription updated');
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('❌ Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  if (process.env.BASE_URL) {
    console.log(`🌐 Live: ${process.env.BASE_URL}`);
  }
});
