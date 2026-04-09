const dotenv = require("dotenv");
dotenv.config();

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "unsafe_secret",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripeLandlordPriceId: process.env.STRIPE_LANDLORD_PRICE_ID || "",
  powertranzSubscriptionUrlTemplate:
    process.env.POWERTRANZ_SUBSCRIPTION_URL_TEMPLATE || "",
  powertranzMerchantPortalUrl: process.env.POWERTRANZ_MERCHANT_PORTAL_URL || "",
  powertranzCallbackSecret: process.env.POWERTRANZ_CALLBACK_SECRET || "",
  powertranzCallbackHmacSecret:
    process.env.POWERTRANZ_CALLBACK_HMAC_SECRET || "",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:4200",
  db: {
    dialect: process.env.DATABASE_DIALECT || "sqlite",
    storage: process.env.DATABASE_STORAGE || "./database.sqlite",
    host: process.env.DATABASE_HOST || "localhost",
    port: process.env.DATABASE_PORT || "3306",
    database: process.env.DATABASE_NAME || "rentease",
    username: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASSWORD || "",
  },
};
