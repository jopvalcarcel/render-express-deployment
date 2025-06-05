require('dotenv').config(); // MUST be at the very top

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Home page with plans
app.get('/', (req, res) => {
  res.render('index');
});

// Handle subscription
app.get('/subscribe', async (req, res) => {
  const { plan } = req.query;

  // Use your Stripe Price IDs here
  const priceLookup = {
    starter: 'price_1234567890starter', // replace with actual Stripe Price ID
    pro: 'price_1234567890pro' // replace with actual Stripe Price ID
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

app.get('/success', (req, res) => {
  res.send('Subscription successful!');
});

app.get('/cancel', (req, res) => {
  res.send('Subscription canceled.');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
