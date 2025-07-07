require('dotenv').config(); // Load environment variables

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 3000;

// Enable EJS templating
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Use raw body only for Stripe webhooks
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

// ==================== ROUTES ====================

// Home page with plan options
app.get('/', (req, res) => {
  res.render('index'); // Make sure 'views/index.ejs' exists
});

// Checkout subscription
app.get('/subscribe', async (req, res) => {
  const { plan } = req.query;

  const priceLookup = {
    starter: 'price_1Ri1GKQ7aI0fg0NlCvuJWrAZ',
    pro: 'price_1Ri1T9Q7aI0fg0Nl5y45vIvx'
  };

  const priceId = priceLookup[plan];

  if (!priceId) {
    return res.status(400).send('Invalid plan selected.');
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: 'https://render-express-deployment-k27o.onrender.com/success',
      cancel_url: 'https://render-express-deployment-k27o.onrender.com/cancel',
    });

    res.redirect(session.url);
  } catch (err) {
    console.error('❌ Stripe session error:', err.message);
    res.status(500).send(`Internal Server Error: ${err.message}`);
  }
});

// Success and cancel pages
app.get('/success', (req, res) => {
  res.render('success'); // Make sure views/success.ejs exists
});

app.get('/cancel', (req, res) => {
  res.render('cancel'); // Make sure views/cancel.ejs exists
});

// Customer Portal Route
app.get('/portal', async (req, res) => {
  const customerId = 'cus_SRaBk8xGbfT3Zc'; // Replace with dynamic user data later

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://render-express-deployment-k27o.onrender.com/account',
    });

    res.redirect(session.url);
  } catch (err) {
    console.error('❌ Failed to create portal session:', err.message);
    res.status(500).send('Could not redirect to customer portal.');
  }
});

// After portal returns
app.get('/account', (req, res) => {
  res.send('<h2>Welcome back from the Stripe Customer Portal</h2><a href="/">Return Home</a>');
});

// Stripe Webhook
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY;

app.post('/webhook', (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Log webhook events
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('✅ Subscription completed');
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

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
