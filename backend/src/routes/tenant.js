const express = require("express");
const { body, validationResult } = require("express-validator");
const { generateReceipt } = require("../services/receiptService");
const { Tenant, Payment, Notification, MaintenanceRequest } = require("../models");
const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();
router.use(auth);
router.use(requireRole("tenant"));

const { Op } = require("sequelize");

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function resolveCurrentDueDate(tenant) {
  if (tenant.nextDueDate) {
    return new Date(tenant.nextDueDate);
  }

  const dueDay = tenant.property?.dueDay || 1;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);

  if (dueDate < today) {
    dueDate.setMonth(dueDate.getMonth() + 1);
  }

  return dueDate;
}

function resolveNextMonthlyDueDate(currentDueDate, tenant) {
  const baseDate = currentDueDate ? new Date(currentDueDate) : new Date();
  const nextDueDate = new Date(baseDate);
  const dueDay = tenant.property?.dueDay || nextDueDate.getDate();

  nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  nextDueDate.setDate(dueDay);

  return nextDueDate;
}

function getDaysUntil(date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((target.getTime() - current.getTime()) / millisecondsPerDay);
}

function getDaysPastDue(date) {
  return Math.max(0, -getDaysUntil(date));
}

function calculateAccruedLateFee(property, daysPastDue) {
  const gracePeriodDays = Number(property?.gracePeriodDays ?? 5);
  const dailyLateFee = Number(property?.dailyLateFee ?? property?.lateFee ?? 0);
  const daysSubjectToFee = Math.max(0, daysPastDue - gracePeriodDays);

  return Number((daysSubjectToFee * dailyLateFee).toFixed(2));
}

router.get("/rent", async (req, res) => {
  try {
    const tenant = await Tenant.findOne({
      where: { userId: req.user.id },
      include: ["property"],
    });
    if (!tenant)
      return res.status(404).json({ message: "Tenant record not found" });

    const now = new Date();
    const dueDate = tenant.nextDueDate ? new Date(tenant.nextDueDate) : null;
    const isLate = dueDate ? dueDate < now : false;
    const daysPastDue = dueDate ? getDaysPastDue(dueDate) : 0;
    const gracePeriodDays = Number(tenant.property?.gracePeriodDays ?? 5);
    const lateFeeApplies = daysPastDue > gracePeriodDays;
    const lateFee = calculateAccruedLateFee(tenant.property, daysPastDue);
    const baseAmount = Number(tenant.rentAmount);
    const dueAmount = baseAmount + lateFee;
    const daysUntilDue = dueDate ? getDaysUntil(dueDate) : null;
    const dueSoon = daysUntilDue === 3;

    const paidSinceDue = await Payment.sum("amount", {
      where: {
        tenantId: tenant.id,
        status: "paid",
        paymentDate: {
          [Op.gte]: dueDate ? dueDate.toISOString() : new Date(0).toISOString(),
        },
      },
    });

    const outstanding = Math.max(0, dueAmount - (Number(paidSinceDue) || 0));

    return res.json({
      rentAmount: baseAmount,
      nextDueDate: tenant.nextDueDate,
      property: tenant.property,
      dueAmount,
      isLate,
      lateFee,
      outstanding,
      daysUntilDue,
      daysPastDue,
      gracePeriodDays,
      lateFeeApplies,
      dueSoon,
      reminderMessage: dueSoon
        ? `Reminder: your rent is due in 3 days on ${tenant.nextDueDate}.`
        : null,
      paymentMethod: tenant.paymentMethod,
      landlordBankName: tenant.landlordBankName,
      landlordAccountName: tenant.landlordAccountName,
      landlordAccountNumber: tenant.landlordAccountNumber,
      landlordBranch: tenant.landlordBranch,
      landlordAccountType: tenant.landlordAccountType,
      landlordRoutingNumber: tenant.landlordRoutingNumber,
      landlordLynxPhoneNumber: tenant.landlordLynxPhoneNumber,
      paymentInstructions: tenant.paymentInstructions,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not fetch rent info" });
  }
});

router.get("/payment-method", async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ where: { userId: req.user.id } });
    if (!tenant)
      return res.status(404).json({ message: "Tenant record not found" });

    return res.json({
      paymentMethod: tenant.paymentMethod || "bank_transfer",
      landlordBankName: tenant.landlordBankName || "",
      landlordAccountName: tenant.landlordAccountName || "",
      landlordAccountNumber: tenant.landlordAccountNumber || "",
      landlordBranch: tenant.landlordBranch || "",
      landlordAccountType: tenant.landlordAccountType || "",
      landlordRoutingNumber: tenant.landlordRoutingNumber || "",
      landlordLynxPhoneNumber: tenant.landlordLynxPhoneNumber || "",
      paymentInstructions: tenant.paymentInstructions || "",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not fetch payment method" });
  }
});

router.put(
  "/payment-method",
  body("paymentMethod").optional().isIn(["bank_transfer", "cash_app", "wire_transfer", "lynx"]),
  body("landlordBankName").optional({ checkFalsy: true }).isString(),
  body("landlordAccountName").optional({ checkFalsy: true }).isString(),
  body("landlordAccountNumber").optional({ checkFalsy: true }).isString(),
  body("landlordBranch").optional({ checkFalsy: true }).isString(),
  body("landlordAccountType").optional({ checkFalsy: true }).isIn(["checking", "saving"]),
  body("landlordRoutingNumber").optional({ checkFalsy: true }).isString(),
  body("landlordLynxPhoneNumber").optional({ checkFalsy: true }).isString(),
  body("paymentInstructions").optional({ checkFalsy: true }).isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const tenant = await Tenant.findOne({ where: { userId: req.user.id } });
      if (!tenant)
        return res.status(404).json({ message: "Tenant record not found" });

      await tenant.update({
        paymentMethod: req.body.paymentMethod || "bank_transfer",
        landlordBankName: req.body.landlordBankName || null,
        landlordAccountName: req.body.landlordAccountName || null,
        landlordAccountNumber: req.body.landlordAccountNumber || null,
        landlordBranch: req.body.landlordBranch || null,
        landlordAccountType: req.body.landlordAccountType || null,
        landlordRoutingNumber: req.body.landlordRoutingNumber || null,
        landlordLynxPhoneNumber: req.body.landlordLynxPhoneNumber || null,
        paymentInstructions: req.body.paymentInstructions || null,
      });

      return res.json({ message: "Payment details saved successfully" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Could not save payment method" });
    }
  },
);

router.post(
  "/maintenance-requests",
  body("issueTitle").trim().notEmpty(),
  body("issueDescription").trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tenant = await Tenant.findOne({
        where: { userId: req.user.id },
        include: ["property"],
      });
      if (!tenant) {
        return res.status(404).json({ message: "Tenant record not found" });
      }

      const request = await MaintenanceRequest.create({
        landlordId: tenant.property.landlordId,
        tenantId: tenant.id,
        propertyId: tenant.propertyId,
        issueTitle: req.body.issueTitle,
        issueDescription: req.body.issueDescription,
      });

      await Notification.create({
        landlordId: tenant.property.landlordId,
        tenantId: tenant.id,
        propertyId: tenant.propertyId,
        type: "maintenance_request",
        message: `${tenant.property?.address || "A property"} has a new maintenance request: ${req.body.issueTitle}.`,
      });

      return res.status(201).json(request);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Could not submit maintenance request" });
    }
  },
);

router.get("/maintenance-requests", async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ where: { userId: req.user.id } });
    if (!tenant) {
      return res.status(404).json({ message: "Tenant record not found" });
    }

    const requests = await MaintenanceRequest.findAll({
      where: { tenantId: tenant.id },
      include: ["property"],
      order: [["createdAt", "DESC"]],
    });

    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not fetch maintenance requests" });
  }
});

router.post(
  "/confirm-payment",
  body("amount").optional().isFloat({ gt: 0 }),
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const tenant = await Tenant.findOne({
      where: { userId: req.user.id },
      include: ["user", "property"],
    });
    if (!tenant)
      return res.status(404).json({ message: "Tenant record not found" });

    if (!tenant.nextDueDate) {
      tenant.nextDueDate = formatDateOnly(resolveCurrentDueDate(tenant));
      await tenant.save();
    }

    const now = new Date();
    const dueDate = tenant.nextDueDate ? new Date(tenant.nextDueDate) : null;
    const isLate = dueDate ? dueDate < now : false;
    const daysPastDue = dueDate ? getDaysPastDue(dueDate) : 0;
    const lateFee = calculateAccruedLateFee(tenant.property, daysPastDue);
    const dueAmount = Number(tenant.rentAmount) + lateFee;

    const paidSinceDue = await Payment.sum("amount", {
      where: {
        tenantId: tenant.id,
        status: "paid",
        paymentDate: {
          [Op.gte]: dueDate ? dueDate.toISOString() : new Date(0).toISOString(),
        },
      },
    });

    const outstanding = Math.max(0, dueAmount - (Number(paidSinceDue) || 0));
    if (outstanding <= 0) {
      return res.status(400).json({ message: "No outstanding rent to pay" });
    }

    const paymentAmount = req.body.amount
      ? Number(req.body.amount)
      : outstanding;

    if (paymentAmount > outstanding) {
      return res
        .status(400)
        .json({ message: "Payment amount cannot exceed outstanding balance" });
    }

    const remainingOutstanding = Math.max(0, outstanding - paymentAmount);
    const isShortPayment = remainingOutstanding > 0;

    const payment = await Payment.create({
      tenantId: tenant.id,
      amount: paymentAmount,
      status: "paid",
      balanceRemaining: remainingOutstanding,
      paymentDate: now,
      transactionId: `manual-${tenant.id}-${Date.now()}`,
      description: isShortPayment
        ? `Tenant confirmed short payment of ${paymentAmount.toFixed(2)} with ${remainingOutstanding.toFixed(2)} still outstanding`
        : `Tenant confirmed manual payment of ${paymentAmount.toFixed(2)}`,
    });

    await Notification.create({
      landlordId: tenant.property.landlordId,
      tenantId: tenant.id,
      propertyId: tenant.propertyId,
      type: isShortPayment ? "short_payment_confirmed" : "payment_confirmed",
      message: isShortPayment
        ? `${tenant.user?.name || "A tenant"} made a short payment of $${paymentAmount.toFixed(2)} for ${tenant.property?.address || "their property"}. Remaining balance: $${remainingOutstanding.toFixed(2)}. Please confirm the short payment.`
        : `${tenant.user?.name || "A tenant"} confirmed rent payment of $${paymentAmount.toFixed(2)} for ${tenant.property?.address || "their property"}.`,
    });

    if (remainingOutstanding === 0) {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ).toISOString();

      await Payment.update(
        { balanceRemaining: 0 },
        {
          where: {
            tenantId: tenant.id,
            status: "paid",
            paymentDate: {
              [Op.gte]: monthStart,
              [Op.lte]: monthEnd,
            },
          },
        },
      );

      const currentDue = tenant.nextDueDate
        ? new Date(tenant.nextDueDate)
        : resolveCurrentDueDate(tenant);
      const nextDueDate = resolveNextMonthlyDueDate(currentDue, tenant);
      tenant.nextDueDate = formatDateOnly(nextDueDate);
      await tenant.save();
    }

    return res.json({
      message: "Payment confirmation sent to landlord",
      payment,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not send payment confirmation" });
  }
});

router.get("/payments", async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ where: { userId: req.user.id } });
    if (!tenant)
      return res.status(404).json({ message: "Tenant record not found" });
    const payments = await Payment.findAll({
      where: { tenantId: tenant.id },
      order: [["createdAt", "DESC"]],
    });
    return res.json(payments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not fetch payment history" });
  }
});

router.get("/receipt/:paymentId", async (req, res) => {
  try {
    const tenant = await Tenant.findOne({
      where: { userId: req.user.id },
      include: ["user", "property"],
    });
    if (!tenant)
      return res.status(404).json({ message: "Tenant record not found" });

    const payment = await Payment.findOne({
      where: { id: req.params.paymentId, tenantId: tenant.id, status: "paid" },
    });
    if (!payment)
      return res.status(404).json({ message: "Payment not found or not paid" });

    const pdfBuffer = await generateReceipt(payment, tenant, tenant.property);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${payment.id}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not generate receipt" });
  }
});

module.exports = router;
