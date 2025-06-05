// Only load .env locally (not in production)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY) // Debug: check if key is loaded
console.log('BASE_URL:', process.env.BASE_URL)

const app = express()

app.set('view engine', 'ejs')

app.get('/', async (req, res) => {
  res.render('index.ejs')
})

app.get('/test', (req, res) => {
  console.log('Test route hit')
  res.send('Test route works!')
})

app.get('/subscribe', async (req, res) => {
  console.log('Subscribe route hit')

  const plan = req.query.plan

  if (!plan) {
    return res.send('Subscription plan not found')
  }

  let priceId

  switch (plan.toLowerCase()) {
    case 'starter':
      priceId = 'price_1RQwvgQ7aI0fg0NlJQLVMok9'
      break
    case 'pro':
      priceId = 'price_1RQwwfQ7aI0fg0NlHxqF0ZDy'
      break
    default:
      return res.send('Subscription plan not found')
  }

  try {
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
    })

    res.redirect(session.url)
  } catch (error) {
    console.error('Stripe session creation error:', error)
    res.status(500).send('Error creating checkout session')
  }
})

app.get('/success', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id, {
      expand: ['subscription', 'subscription.plan.product']
    })

    console.log(JSON.stringify(session))

    res.send('Subscribed successfully')
  } catch (error) {
    console.error('Error retrieving session:', error)
    res.status(500).send('Error retrieving session')
  }
})

app.get('/cancel', (req, res) => {
  res.redirect('/')
})

app.get('/customers/:customerId', async (req, res) => {
  console.log('Customer route hit:', req.params.customerId)

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: req.params.customerId,
      return_url: `${process.env.BASE_URL}/`
    })
    res.redirect(portalSession.url)
  } catch (error) {
    console.error('Error creating billing portal session:', error)
    res.status(500).send('Error redirecting to billing portal')
  }
})

// Stripe webhook endpoint
app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['stripe-signature']

    let event

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET_KEY
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    switch (event.type) {
      case 'checkout.session.completed':
        console.log('New Subscription started!')
        console.log(event.data)
        break

      case 'invoice.paid':
        console.log('Invoice paid')
        console.log(event.data)
        break

      case 'invoice.payment_failed':
        console.log('Invoice payment failed!')
        console.log(event.data)
        break

      case 'customer.subscription.updated':
        console.log('Subscription updated!')
        console.log(event.data)
        break

      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    res.send()
  }
)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server started on port ${PORT}`))
