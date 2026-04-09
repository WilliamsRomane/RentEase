const express = require("express");
const { body, validationResult } = require("express-validator");
const { Property, Tenant, User, Payment, Notification, MaintenanceRequest } = require("../models");
const { getOverdueTenants } = require("../services/reminderService");
const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/role");
const router = express.Router();
const PENDING_PASSWORD_HASH = "__PENDING_REGISTRATION__";

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function getMonthlyDueDate(dueDay, fromDate = new Date()) {
  const referenceDate = new Date(fromDate);
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const dueDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    dueDay,
  );

  if (dueDate < today) {
    dueDate.setMonth(dueDate.getMonth() + 1);
  }

  return dueDate;
}

router.use(auth);
router.use(requireRole("landlord"));

router.post(
  "/property",
  body("address").notEmpty(),
  body("rentAmount").isFloat({ gt: 0 }),
  body("dueDay").isInt({ min: 1, max: 28 }),
  body("gracePeriodDays").optional().isInt({ min: 0 }),
  body("dailyLateFee").optional().isFloat({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const {
      address,
      rentAmount,
      dueDay,
      gracePeriodDays,
      dailyLateFee,
      lateFee,
    } = req.body;
    try {
      const property = await Property.create({
        landlordId: req.user.id,
        address,
        rentAmount,
        dueDay,
        gracePeriodDays: gracePeriodDays ?? 5,
        dailyLateFee: dailyLateFee ?? lateFee ?? 0,
        lateFee: lateFee || 0,
      });
      return res.status(201).json(property);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Could not create property" });
    }
  },
);

router.post(
  "/tenant",
  body("name").optional().isString().trim().notEmpty(),
  body("email").isEmail(),
  body("propertyId").isInt({ gt: 0 }),
  body("rentAmount").isFloat({ gt: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const { name, email, propertyId, rentAmount, nextDueDate } = req.body;
    try {
      const normalizedName =
        typeof name === "string" && name.trim() ? name.trim() : null;
      const property = await Property.findOne({
        where: { id: propertyId, landlordId: req.user.id },
      });
      if (!property)
        return res.status(404).json({ message: "Property not found" });
      let user = await User.findOne({ where: { email } });
      if (user && user.role !== "tenant")
        return res.status(400).json({ message: "This email belongs to a non-tenant account" });

      if (!user) {
        user = await User.create({
          name: normalizedName || "Pending Tenant",
          email,
          passwordHash: PENDING_PASSWORD_HASH,
          role: "tenant",
          phone: null,
        });
      } else if (
        normalizedName &&
        user.passwordHash === PENDING_PASSWORD_HASH &&
        (!user.name || user.name === "Pending Tenant")
      ) {
        await user.update({ name: normalizedName });
      }

      let tenant = await Tenant.findOne({
        where: { userId: user.id, propertyId },
      });

      const resolvedNextDueDate =
        nextDueDate || formatDateOnly(getMonthlyDueDate(property.dueDay));

      if (tenant) {
        tenant = await tenant.update({
          rentAmount,
          nextDueDate: resolvedNextDueDate,
        });
      } else {
        tenant = await Tenant.create({
          userId: user.id,
          propertyId,
          rentAmount,
          nextDueDate: resolvedNextDueDate,
        });
      }

      return res.status(201).json(tenant);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Could not add tenant" });
    }
  },
);

router.delete("/tenant/:tenantId", async (req, res) => {
  try {
    const tenant = await Tenant.findOne({
      where: { id: req.params.tenantId },
      include: ["property", "user"],
    });

    if (!tenant || tenant.property?.landlordId !== req.user.id) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    await Payment.destroy({ where: { tenantId: tenant.id } });
    await tenant.destroy();

    if (
      tenant.user &&
      tenant.user.passwordHash === PENDING_PASSWORD_HASH
    ) {
      const remainingTenantAssignments = await Tenant.count({
        where: { userId: tenant.user.id },
      });

      if (remainingTenantAssignments === 0) {
        await tenant.user.destroy();
      }
    }

    return res.json({ message: "Tenant deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not delete tenant" });
  }
});

router.delete("/property/:propertyId", async (req, res) => {
  try {
    const property = await Property.findOne({
      where: { id: req.params.propertyId, landlordId: req.user.id },
      include: [{ model: Tenant, as: "tenants", include: ["user"] }],
    });

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    for (const tenant of property.tenants || []) {
      await Payment.destroy({ where: { tenantId: tenant.id } });
      await tenant.destroy();

      if (tenant.user && tenant.user.passwordHash === PENDING_PASSWORD_HASH) {
        const remainingTenantAssignments = await Tenant.count({
          where: { userId: tenant.user.id },
        });

        if (remainingTenantAssignments === 0) {
          await tenant.user.destroy();
        }
      }
    }

    await property.destroy();
    return res.json({ message: "Property deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not delete property" });
  }
});

router.get("/properties", async (req, res) => {
  try {
    const properties = await Property.findAll({
      where: { landlordId: req.user.id },
      include: ["tenants"],
    });
    return res.json(properties);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not fetch properties" });
  }
});

router.get("/tenants", async (req, res) => {
  try {
    const properties = await Property.findAll({
      where: { landlordId: req.user.id },
    });
    const propertyIds = properties.map((p) => p.id);
    const tenants = await Tenant.findAll({
      where: { propertyId: propertyIds },
      include: ["user", "property", "payments"],
    });
    return res.json(tenants);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not list tenants" });
  }
});

router.get("/payments", async (req, res) => {
  try {
    const properties = await Property.findAll({
      where: { landlordId: req.user.id },
    });
    const propertyIds = properties.map((p) => p.id);
    const tenants = await Tenant.findAll({
      where: { propertyId: propertyIds },
      include: ["user", "property", "payments"],
    });
    return res.json(tenants);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not list payments" });
  }
});

router.get("/reminders", async (req, res) => {
  try {
    const overdue = await getOverdueTenants(req.user.id);
    return res.json(overdue);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not fetch reminder list" });
  }
});

router.get("/reports", async (req, res) => {
  try {
    const properties = await Property.findAll({
      where: { landlordId: req.user.id },
    });
    const propertyIds = properties.map((p) => p.id);

    const tenants = await Tenant.findAll({
      where: { propertyId: propertyIds },
      include: ["user", "property", "payments"],
    });

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalPayments = 0;
    let monthlyPayments = 0;
    let overdueCount = 0;
    let totalRevenue = 0;

    for (const tenant of tenants) {
      // Check overdue
      const isLate = tenant.nextDueDate
        ? new Date(tenant.nextDueDate) < now
        : false;
      if (isLate) overdueCount++;

      // Sum payments
      for (const payment of tenant.payments || []) {
        if (payment.status === "paid") {
          totalPayments++;
          totalRevenue += Number(payment.amount);

          const paymentDate = new Date(payment.paymentDate);
          if (
            paymentDate.getMonth() === currentMonth &&
            paymentDate.getFullYear() === currentYear
          ) {
            monthlyPayments++;
          }
        }
      }
    }

    return res.json({
      totalProperties: properties.length,
      totalTenants: tenants.length,
      totalPayments,
      monthlyPayments,
      overdueCount,
      totalRevenue: totalRevenue.toFixed(2),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not generate reports" });
  }
});

router.get("/maintenance-requests", async (req, res) => {
  try {
    const requests = await MaintenanceRequest.findAll({
      where: { landlordId: req.user.id },
      include: [
        {
          model: Tenant,
          as: "tenant",
          include: ["user"],
        },
        {
          model: Property,
          as: "property",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not fetch maintenance requests" });
  }
});

router.patch(
  "/maintenance-requests/:requestId/respond",
  body("status").optional().isIn(["open", "in_progress", "resolved"]),
  body("landlordResponse").trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const request = await MaintenanceRequest.findOne({
        where: { id: req.params.requestId, landlordId: req.user.id },
        include: [
          {
            model: Tenant,
            as: "tenant",
            include: ["user"],
          },
          {
            model: Property,
            as: "property",
          },
        ],
      });

      if (!request) {
        return res.status(404).json({ message: "Maintenance request not found" });
      }

      await request.update({
        landlordResponse: req.body.landlordResponse,
        status: req.body.status || request.status,
        landlordRespondedAt: new Date(),
      });

      return res.json(request);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Could not respond to maintenance request" });
    }
  },
);

router.get("/notifications", async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { landlordId: req.user.id, isRead: false },
      include: [
        {
          model: Tenant,
          as: "tenant",
          include: ["user"],
        },
        {
          model: Property,
          as: "property",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json(notifications);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not fetch notifications" });
  }
});

router.patch("/notifications/:notificationId/read", async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.notificationId, landlordId: req.user.id },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.isRead = true;
    await notification.save();

    return res.json({ message: "Notification marked as read" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not update notification" });
  }
});

module.exports = router;
