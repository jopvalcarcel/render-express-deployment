require('dotenv').config(); // MUST be at the very top

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Conditionally apply JSON middleware (skip for Stripe webhooks)
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next(); // Skip for raw body parsing
  } else {
    express.json()(req, res, next);
  }
});

// Home page
app.get('/', (req, res) => {
  res.render('index'); // Renders views/index.ejs
});

// Handle subscription
app.get('/subscribe', async (req, res) => {
  const { plan } = req.query;

  const priceLookup = {
    starter: 'price_1RQwvgQ7aI0fg0NlJQLVMok9',
    pro: 'price_1RQwwfQ7aI0fg0NlHxqF0ZDy'
  };

  const priceId = priceLookup[plan];

  if (!priceId) {
    return res.status(400).send('Invalid plan selected.');
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: 'https://render-express-deployment-k27o.onrender.com/success',
      cancel_url: 'https://render-express-deployment-k27o.onrender.com/cancel',
    });

    res.redirect(session.url);
  } catch (err) {
    console.error('❌ Stripe session error:', err.message);
    res.status(500).send(`Internal Server Error: ${err.message}`);
  }
});

// Success and cancel views
app.get('/success', (req, res) => {
  res.render('success');
});

app.get('/cancel', (req, res) => {
  res.render('cancel');
});

// Stripe Webhook
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY;

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle events
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('✅ Checkout session completed.');
      break;
    case 'invoice.paid':
      console.log('💰 Invoice paid.');
      break;
    case 'invoice.payment_failed':
      console.log('❌ Invoice payment failed.');
      break;
    case 'customer.subscription.updated':
      console.log('🔄 Subscription updated.');
      break;
    case 'customer.subscription.deleted':
      console.log('🗑️ Subscription canceled.');
      break;
    default:
      console.log(`ℹ️ Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
