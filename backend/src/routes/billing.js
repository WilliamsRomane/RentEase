const crypto = require("crypto");
const express = require("express");
const { body, validationResult } = require("express-validator");
const { User } = require("../models");
const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/role");
const config = require("../config");

const router = express.Router();
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const callbackAuditLog = [];
const CALLBACK_AUDIT_LIMIT = 100;

function applyTemplate(template, values) {
  return Object.entries(values).reduce((url, [key, value]) => {
    const safeValue = encodeURIComponent(value || "");
    return url.replaceAll(`{{${key}}}`, safeValue);
  }, template);
}

function extractUserIdFromReference(reference) {
  if (!reference || typeof reference !== "string") {
    return null;
  }

  const match = reference.match(/^ptz_sub_(\d+)_/);
  return match ? Number(match[1]) : null;
}

function parsePayload(req) {
  if (Buffer.isBuffer(req.body)) {
    const raw = req.body.toString("utf8");
    try {
      return JSON.parse(raw);
    } catch {
      const params = new URLSearchParams(raw);
      return Object.fromEntries(params.entries());
    }
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      const params = new URLSearchParams(req.body);
      return Object.fromEntries(params.entries());
    }
  }

  return req.body || {};
}

function normalizeProviderStatus(statusRaw) {
  const normalized = String(statusRaw || "").toLowerCase().trim();
  if (["active", "approved", "success", "successful", "paid", "trialing"].includes(normalized)) {
    return "active";
  }
  if (["trial", "in_trial"].includes(normalized)) {
    return "trialing";
  }
  if (["cancelled", "canceled"].includes(normalized)) {
    return "cancelled";
  }
  if (["failed", "declined", "error", "inactive", "expired"].includes(normalized)) {
    return "inactive";
  }
  return "pending";
}

function readSignatureHeader(req) {
  const signature =
    req.headers["x-powertranz-signature"] ||
    req.headers["x-signature"] ||
    "";
  if (typeof signature !== "string") {
    return "";
  }
  return signature.startsWith("sha256=")
    ? signature.slice("sha256=".length)
    : signature;
}

function verifyWithHmac(req, secret) {
  if (!secret) {
    return false;
  }
  const provided = readSignatureHeader(req);
  if (!provided) {
    return false;
  }
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (provided.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

function verifyWithCallbackSecret(req, secret, payload) {
  if (!secret) {
    return false;
  }
  const headerSecret = req.headers["x-powertranz-callback-secret"];
  const authHeader = req.headers.authorization;
  const bearerSecret =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
  const querySecret = req.query?.token;
  const bodySecret = payload?.token || payload?.secret;
  const candidates = [headerSecret, bearerSecret, querySecret, bodySecret].filter(Boolean);
  return candidates.some((candidate) => String(candidate) === secret);
}

async function enforceExpiryForUser(user) {
  const status = user.subscriptionStatus || "inactive";
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(status)) {
    return;
  }

  if (!user.subscriptionCurrentPeriodEnd) {
    return;
  }

  const periodEnd = new Date(user.subscriptionCurrentPeriodEnd);
  if (Number.isNaN(periodEnd.getTime())) {
    return;
  }

  if (periodEnd.getTime() < Date.now()) {
    await user.update({ subscriptionStatus: "expired" });
  }
}

function appendCallbackAudit(entry) {
  callbackAuditLog.unshift({
    ...entry,
    recordedAt: new Date().toISOString(),
  });
  if (callbackAuditLog.length > CALLBACK_AUDIT_LIMIT) {
    callbackAuditLog.length = CALLBACK_AUDIT_LIMIT;
  }
}

// PowerTranz provider callback endpoint (server-to-server verification)
router.post("/provider-callback", async (req, res) => {
  const payload = parsePayload(req);

  const isVerified =
    verifyWithHmac(req, config.powertranzCallbackHmacSecret) ||
    verifyWithCallbackSecret(req, config.powertranzCallbackSecret, payload);

  if (!isVerified) {
    appendCallbackAudit({
      verified: false,
      userId: Number(payload?.userId || payload?.user_id || 0) || null,
      reference:
        payload?.reference ||
        payload?.orderReference ||
        payload?.transactionReference ||
        null,
      providerStatus:
        payload?.status || payload?.paymentStatus || payload?.result || null,
      mappedStatus: "signature_rejected",
      callbackType: "provider-callback",
    });
    return res.status(401).json({ message: "Invalid callback signature" });
  }

  try {
    const reference =
      payload.reference ||
      payload.orderReference ||
      payload.transactionReference ||
      payload.orderId ||
      payload.referenceNumber ||
      null;
    const fallbackUserId = extractUserIdFromReference(reference);
    const userId = Number(payload.userId || payload.user_id || fallbackUserId || 0);
    if (!userId) {
      return res.status(400).json({ message: "Missing user identifier in callback" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      appendCallbackAudit({
        verified: true,
        userId,
        reference,
        providerStatus:
          payload.status || payload.paymentStatus || payload.result || null,
        mappedStatus: "unknown_user",
        callbackType: "provider-callback",
      });
      return res.status(404).json({ message: "User not found" });
    }

    const normalizedStatus = normalizeProviderStatus(
      payload.status || payload.paymentStatus || payload.result,
    );

    const periodEndRaw =
      payload.periodEnd ||
      payload.nextBillingDate ||
      payload.subscriptionEndDate ||
      null;
    const periodEnd = periodEndRaw ? new Date(periodEndRaw) : null;

    await user.update({
      subscriptionStatus: normalizedStatus,
      subscriptionPlan:
        payload.plan ||
        payload.planCode ||
        payload.productCode ||
        user.subscriptionPlan ||
        "powertranz",
      subscriptionCurrentPeriodEnd:
        periodEnd && !Number.isNaN(periodEnd.getTime())
          ? periodEnd
          : user.subscriptionCurrentPeriodEnd,
      stripeSubscriptionId:
        payload.subscriptionId ||
        payload.recurringId ||
        payload.customerSubscriptionId ||
        user.stripeSubscriptionId,
    });

    appendCallbackAudit({
      verified: true,
      userId: user.id,
      reference,
      providerStatus:
        payload.status || payload.paymentStatus || payload.result || null,
      mappedStatus: normalizedStatus,
      callbackType: "provider-callback",
    });

    return res.json({ received: true });
  } catch (err) {
    console.error("[Billing] Provider callback failed", err);
    return res.status(500).json({ message: "Provider callback failed" });
  }
});

router.use(auth);
router.use(requireRole("landlord"));

router.get("/diagnostics", async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: [
        "id",
        "email",
        "subscriptionStatus",
        "subscriptionPlan",
        "subscriptionCurrentPeriodEnd",
        "stripeSubscriptionId",
        "updatedAt",
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const limitRaw = Number(req.query?.limit || 10);
    const limit = Number.isNaN(limitRaw) ? 10 : Math.max(1, Math.min(50, limitRaw));
    const recentCallbacks = callbackAuditLog
      .filter((entry) => entry.userId === user.id)
      .slice(0, limit);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
      },
      subscription: {
        status: user.subscriptionStatus || "inactive",
        plan: user.subscriptionPlan || "powertranz",
        currentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
        externalSubscriptionId: user.stripeSubscriptionId || null,
        lastUpdatedAt: user.updatedAt,
      },
      diagnostics: {
        callbacksTrackedInMemory: callbackAuditLog.length,
        callbacksForCurrentUser: recentCallbacks.length,
        recentCallbacks,
      },
      note:
        "Callback diagnostics are in-memory and reset when the backend process restarts.",
    });
  } catch (err) {
    console.error("[Billing] Could not fetch diagnostics", err);
    return res.status(500).json({ message: "Could not fetch diagnostics" });
  }
});

router.get("/subscription-status", async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: [
        "stripeCustomerId",
        "stripeSubscriptionId",
        "subscriptionStatus",
        "subscriptionPlan",
        "subscriptionCurrentPeriodEnd",
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await enforceExpiryForUser(user);
    await user.reload();

    const status = user.subscriptionStatus || "inactive";
    const isActive = ACTIVE_SUBSCRIPTION_STATUSES.has(status);

    return res.json({
      stripeCustomerId: user.stripeCustomerId || null,
      stripeSubscriptionId: user.stripeSubscriptionId || null,
      subscriptionStatus: status,
      subscriptionPlan: user.subscriptionPlan || "powertranz",
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
      isActive,
    });
  } catch (err) {
    console.error("[Billing] Could not fetch subscription status", err);
    return res.status(500).json({ message: "Could not fetch subscription status" });
  }
});

router.post(
  "/checkout-session",
  body("successUrl").optional().isURL(),
  body("cancelUrl").optional().isURL(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!config.powertranzSubscriptionUrlTemplate) {
      return res.status(500).json({
        message:
          "PowerTranz subscription is not configured. Add POWERTRANZ_SUBSCRIPTION_URL_TEMPLATE.",
      });
    }

    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const successUrl =
        req.body.successUrl ||
        `${config.appBaseUrl}/landlord/dashboard?billing=success`;
      const cancelUrl =
        req.body.cancelUrl ||
        `${config.appBaseUrl}/landlord/dashboard?billing=cancelled`;
      const reference = `ptz_sub_${user.id}_${Date.now()}`;

      const sessionUrl = applyTemplate(config.powertranzSubscriptionUrlTemplate, {
        reference,
        email: user.email,
        name: user.name,
        successUrl,
        cancelUrl,
      });

      await user.update({
        subscriptionStatus: "pending",
        subscriptionPlan: "powertranz",
      });

      return res.json({ sessionId: reference, sessionUrl });
    } catch (err) {
      console.error("[Billing] Could not create PowerTranz checkout session", err);
      return res.status(500).json({ message: "Could not create subscription session" });
    }
  },
);

router.post(
  "/portal-session",
  body("returnUrl").optional().isURL(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!config.powertranzMerchantPortalUrl) {
      return res.status(500).json({
        message:
          "PowerTranz merchant portal is not configured. Add POWERTRANZ_MERCHANT_PORTAL_URL.",
      });
    }

    return res.json({ url: config.powertranzMerchantPortalUrl });
  },
);

module.exports = router;
