const Stripe = require('stripe');

// Stripe is optional — only active if STRIPE_SECRET_KEY is set
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

function requireStripe() {
  if (!stripe) throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to your .env file.');
  return stripe;
}

// Create a Stripe customer (called at registration)
async function createCustomer({ email, name }) {
  const s = requireStripe();
  return s.customers.create({ email, name });
}

// Create a PaymentIntent for Apple Pay / card payments
async function createPaymentIntent({ amount, currency = 'usd', metadata = {} }) {
  const s = requireStripe();
  const intent = await s.paymentIntents.create({
    amount: Math.round(amount * 100), // Stripe uses cents
    currency,
    payment_method_types: ['card'], // includes Apple Pay and Google Pay when on HTTPS
    metadata,
  });
  return { clientSecret: intent.client_secret, intentId: intent.id };
}

// Confirm a completed PaymentIntent (called by webhook or after confirm)
async function retrievePaymentIntent(intentId) {
  const s = requireStripe();
  return s.paymentIntents.retrieve(intentId);
}

// Create a Stripe Connect account link for vendors (Pro+ vendor payouts)
async function createVendorConnectLink(vendorEmail, vendorName, returnUrl, refreshUrl) {
  const s = requireStripe();
  const account = await s.accounts.create({
    type: 'express',
    email: vendorEmail,
    business_profile: { name: vendorName },
    capabilities: { transfers: { requested: true } },
  });
  const link = await s.accountLinks.create({
    account: account.id,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return { accountId: account.id, url: link.url };
}

// Transfer funds to vendor via Stripe Connect
async function payVendorViaConnect(vendorStripeAccountId, amount, description) {
  const s = requireStripe();
  return s.transfers.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    destination: vendorStripeAccountId,
    description,
  });
}

module.exports = {
  isConfigured: () => !!stripe,
  createCustomer,
  createPaymentIntent,
  retrievePaymentIntent,
  createVendorConnectLink,
  payVendorViaConnect,
};
