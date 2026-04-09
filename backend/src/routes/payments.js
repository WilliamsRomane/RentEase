const express = require("express");
const { body, validationResult } = require("express-validator");
const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/role");
const { Tenant, Payment, Property, User } = require("../models");
const { createCheckoutSession, stripe } = require("../services/stripeService");
const { generateReceipt } = require("../services/receiptService");
const config = require("../config");

const router = express.Router();

router.post(
  "/session",
  auth,
  requireRole("tenant"),
  body("successUrl").isURL(),
  body("cancelUrl").isURL(),
  body("amount").optional().isFloat({ gt: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const tenant = await Tenant.findOne({
        where: { userId: req.user.id },
        include: ["user", "property"],
      });
      if (!tenant)
        return res.status(404).json({ message: "Tenant profile not found" });

      const requestedAmount = req.body.amount
        ? Number(req.body.amount)
        : Number(tenant.rentAmount);
      const dueAmount = Number(tenant.rentAmount);

      if (requestedAmount > dueAmount) {
        return res
          .status(400)
          .json({ message: "Payment amount cannot exceed rent due" });
      }

      const session = await createCheckoutSession({
        amount: requestedAmount,
        tenant,
        successUrl: req.body.successUrl,
        cancelUrl: req.body.cancelUrl,
      });

      await Payment.create({
        tenantId: tenant.id,
        amount: requestedAmount,
        status: "pending",
        transactionId: session.id,
        description: `Rent payment session ${session.id}`,
      });

      return res.json({ sessionUrl: session.url, sessionId: session.id });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Could not create payment session" });
    }
  },
);

router.post(
  "/webhook",
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripeWebhookSecret,
      );
    } catch (err) {
      console.error("Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const payment = await Payment.findOne({
        where: { transactionId: session.id },
      });
      if (payment) {
        payment.status = "paid";
        payment.paymentDate = new Date();
        payment.transactionId = session.payment_intent;
        await payment.save();

        const tenant = await Tenant.findByPk(payment.tenantId, {
          include: ["user", "property"],
        });
        if (tenant) {
          const currentDue = tenant.nextDueDate
            ? new Date(tenant.nextDueDate)
            : new Date();
          const nextDueDate = new Date(currentDue);
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          tenant.nextDueDate = nextDueDate.toISOString().slice(0, 10);
          await tenant.save();

          // Generate and send receipt
          try {
            const pdfBuffer = await generateReceipt(payment, tenant, tenant.property);
            console.log(`[Receipt] Generated PDF for payment ${payment.id}, size: ${pdfBuffer.length} bytes`);
            // TODO: Send via email or store
          } catch (receiptErr) {
            console.error("[Receipt] Failed to generate receipt", receiptErr);
          }
        }
      }
    }

    res.json({ received: true });
  },
);

module.exports = router;
