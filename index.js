require('dotenv').config(); // MUST be at the very top

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 3000;

// EJS view engine (optional, depending on if you're rendering templates)
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Conditionally apply JSON middleware (skip for Stripe webhooks)
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next(); // skip bodyParser for raw body
  } else {
    express.json()(req, res, next);
  }
});

// Home page with pricing plans
app.get('/', (req, res) => {
  res.render('index'); // make sure index.ejs is in the 'views' folder
});

// Handle subscription creation
app.get('/subscribe', async (req, res) => {
  const { plan } = req.query;

  const priceLookup = {
    starter: 'price_1234567890starter', // REPLACE with actual Stripe Price ID
    pro: 'price_1234567890pro',         // REPLACE with actual Stripe Price ID
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
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
    });

    res.redirect(session.url);
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Confirmation pages
app.get('/success', (req, res) => {
  res.send('✅ Subscription successful!');
});

app.get('/cancel', (req, res) => {
  res.send('❌ Subscription canceled.');
});

// Stripe webhook endpoint
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

  // Handle Stripe events
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

  res.status(200).json({ received: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
