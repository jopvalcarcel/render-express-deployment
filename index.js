// Environment configuration
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Verify critical environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY environment variable');
  process.exit(1);
}

if (!process.env.BASE_URL) {
  console.warn('BASE_URL environment variable not set - using fallback');
  process.env.BASE_URL = 'http://localhost:3000';
}

const app = express();

// Configuration
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.render('index', { 
    baseUrl: process.env.BASE_URL,
    // Add any other data you want to pass to your index.ejs
  });
});

app.get('/test', (req, res) => {
  res.json({ 
    status: 'active',
    stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'missing',
    baseUrl: process.env.BASE_URL 
  });
});

// Subscription handler
app.get('/subscribe', async (req, res) => {
  const plan = req.query.plan?.toLowerCase();
  const validPlans = ['starter', 'pro'];

  if (!plan || !validPlans.includes(plan)) {
    return res.status(400).render('error', {
      title: 'Invalid Plan',
      message: 'Please select a valid subscription plan'
    });
  }

  try {
    const priceId = plan === 'starter' 
      ? 'price_1RQwvgQ7aI0fg0NlJQLVMok9' 
      : 'price_1RQwwfQ7aI0fg0NlHxqF0ZDy';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
      customer_email: req.query.email || undefined, // Optional: Pre-fill email
      metadata: {
        plan_name: plan
      }
    });

    res.redirect(303, session.url);
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).render('error', {
      title: 'Checkout Error',
      message: 'Unable to initiate payment process'
    });
  }
});

// Success page
app.get('/success', async (req, res) => {
  if (!req.query.session_id) {
    return res.redirect('/');
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(
      req.query.session_id,
      { expand: ['customer', 'subscription'] }
    );

    res.render('success', {
      customerEmail: session.customer_details?.email,
      planName: session.metadata?.plan_name || 'your plan',
      sessionId: session.id
    });
  } catch (error) {
    console.error('Session retrieval error:', error);
    res.redirect('/');
  }
});

// Cancel page
app.get('/cancel', (req, res) => {
  res.render('cancel');
});

// Customer portal
app.get('/customer-portal', async (req, res) => {
  try {
    // In production, you would look up the customer ID from your database
    // For now, we'll use a query parameter for testing
    const customerId = req.query.customer_id;
    
    if (!customerId) {
      return res.status(400).render('error', {
        title: 'Access Denied',
        message: 'Customer ID not provided'
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.BASE_URL}/success?session_id=${req.query.session_id}`
    });

    res.redirect(portalSession.url);
  } catch (error) {
    console.error('Portal error:', error);
    res.status(500).render('error', {
      title: 'Portal Error',
      message: 'Unable to access customer portal'
    });
  }
});

// Webhook handler
app.post('/webhook', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET_KEY
      );
    } catch (err) {
      console.error('Webhook verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`Processing event: ${event.type}`);

    // Handle important subscription events
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Checkout completed for:', session.customer_email);
        // Here you would typically create a user in your database
        break;

      case 'customer.subscription.created':
        const subscription = event.data.object;
        console.log('Subscription created:', subscription.id);
        break;

      case 'invoice.paid':
        console.log('Invoice paid');
        break;

      case 'invoice.payment_failed':
        console.log('Payment failed!');
        // Notify customer of failed payment
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  }
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong on our end'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The requested page does not exist'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Stripe mode: ${process.env.STRIPE_SECRET_KEY.includes('test') ? 'TEST' : 'LIVE'}`);
});
