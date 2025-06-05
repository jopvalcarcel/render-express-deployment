require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

console.log('File loaded'); // confirm script runs

const app = express();

// Set up view engine
app.set('view engine', 'ejs');

// Optional: Serve static files from /public
app.use(express.static('public'));

// Routes
app.get('/', async (req, res) => {
    res.render('index.ejs');
});

app.get('/test', (req, res) => {
    console.log('Test route hit');
    res.send('Test route works!');
});

app.get('/subscribe', async (req, res) => {
    console.log('Subscribe route hit');

    const plan = req.query.plan;
    if (!plan) {
        return res.send('Subscription plan not found');
    }

    let priceId;
    switch (plan.toLowerCase()) {
        case 'starter':
            priceId = 'price_1RQwvgQ7aI0fg0NlJQLVMok9';
            break;
        case 'pro':
            priceId = 'price_1RQwwfQ7aI0fg0NlHxqF0ZDy';
            break;
        default:
            return res.send('Subscription plan not found');
    }

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [
            {
                price: priceId,
                quantity: 1
            }
        ],
        success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.BASE_URL}/cancel`
    });

    res.redirect(session.url);
});

app.get('/success', async (req, res) => {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id, {
        expand: ['subscription', 'subscription.plan.product']
    });

    console.log(JSON.stringify(session));

    res.send('Subscribed successfully'); // Optional: render success.ejs
});

app.get('/cancel', (req, res) => {
    res.redirect('/'); // Optional: render cancel.ejs
});

app.get('/customers/:customerId', async (req, res) => {
    console.log('Customer route hit:', req.params.customerId);

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: req.params.customerId,
        return_url: `${process.env.BASE_URL}/`
    });
    res.redirect(portalSession.url);
});

// Webhook route must come before body parsers like express.json()
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET_KEY
        );
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            console.log('New Subscription started!');
            console.log(event.data);
            break;
        case 'invoice.paid':
            console.log('Invoice paid');
            console.log(event.data);
            break;
        case 'invoice.payment_failed':
            console.log('Invoice payment failed!');
            console.log(event.data);
            break;
        case 'customer.subscription.updated':
            console.log('Subscription updated!');
            console.log(event.data);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.send();
});

// Use Render's dynamic port or fallback to 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

