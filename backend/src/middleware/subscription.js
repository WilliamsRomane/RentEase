const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

async function requireActiveLandlordSubscription(req, res, next) {
  try {
    const user = req.user;
    if (!user || user.role !== "landlord") {
      return res.status(403).json({ message: "Landlord access required" });
    }

    const status = user.subscriptionStatus || "inactive";
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(status)) {
      return res.status(402).json({
        message: "An active landlord subscription is required for this action.",
      });
    }

    if (user.subscriptionCurrentPeriodEnd) {
      const periodEnd = new Date(user.subscriptionCurrentPeriodEnd);
      if (!Number.isNaN(periodEnd.getTime()) && periodEnd.getTime() < Date.now()) {
        await user.update({ subscriptionStatus: "expired" });
        return res.status(402).json({
          message: "Your subscription has expired. Please renew to continue.",
        });
      }
    }

    return next();
  } catch (err) {
    console.error("[Subscription] Enforcement failed", err);
    return res.status(500).json({ message: "Could not verify subscription status" });
  }
}

module.exports = { requireActiveLandlordSubscription };
