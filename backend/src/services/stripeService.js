const Stripe = require("stripe");
const config = require("../config");
const stripe = new Stripe(config.stripeSecretKey, { apiVersion: "2024-08-01" });

async function createCheckoutSession({
  amount,
  currency = "usd",
  tenant,
  successUrl,
  cancelUrl,
}) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: "Rent Payment",
            description: `Rent for ${tenant.id}`,
          },
          unit_amount: Math.round(Number(amount) * 100),
        },
        quantity: 1,
      },
    ],
    metadata: { tenantId: tenant.id },
    customer_email: tenant.user?.email,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return session;
}

async function ensureStripeCustomer(user) {
  if (!user) {
    throw new Error("User is required");
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      userId: String(user.id),
      role: String(user.role || ""),
    },
  });

  await user.update({ stripeCustomerId: customer.id });
  return customer.id;
}

async function createSubscriptionCheckoutSession({
  user,
  priceId,
  successUrl,
  cancelUrl,
}) {
  if (!priceId) {
    throw new Error("Missing Stripe price id for subscription");
  }

  const customerId = await ensureStripeCustomer(user);

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        userId: String(user.id),
      },
    },
    metadata: {
      userId: String(user.id),
      type: "landlord_subscription",
    },
  });
}

async function createCustomerPortalSession({ customerId, returnUrl }) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

module.exports = {
  createCheckoutSession,
  createCustomerPortalSession,
  createSubscriptionCheckoutSession,
  ensureStripeCustomer,
  stripe,
};
