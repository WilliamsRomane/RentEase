const nodemailer = require("nodemailer");
const { Twilio } = require("twilio");
const { Op } = require("sequelize");
const { Tenant, Payment, Property, User } = require("../models");

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return new Twilio(accountSid, authToken);
}

async function sendTwilioSms(to, body) {
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) {
    throw new Error("TWILIO_FROM_NUMBER is required for SMS notifications");
  }
  const client = getTwilioClient();
  if (!client) {
    throw new Error(
      "Twilio not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN missing)",
    );
  }
  return client.messages.create({
    body,
    from,
    to,
  });
}

async function getOverdueTenants(landlordId) {
  const properties = await Property.findAll({ where: { landlordId } });
  const propertyIds = properties.map((p) => p.id);

  const tenants = await Tenant.findAll({
    where: { propertyId: propertyIds },
    include: ["user", "property", "payments"],
  });

  const now = new Date();
  const overdueList = [];

  for (const tenant of tenants) {
    const isLate = tenant.nextDueDate
      ? new Date(tenant.nextDueDate) < now
      : false;
    if (!isLate) continue;

    const dueDate = new Date(tenant.nextDueDate);
    const daysPastDue = getDaysPastDue(dueDate);
    const paidSinceDue = await Payment.sum("amount", {
      where: {
        tenantId: tenant.id,
        status: "paid",
        paymentDate: {
          [Op.gte]: dueDate.toISOString(),
        },
      },
    });

    const lateFee = calculateAccruedLateFee(tenant.property, daysPastDue);
    const target = Number(tenant.rentAmount) + lateFee;
    const outstanding = Math.max(0, target - (Number(paidSinceDue) || 0));

    if (outstanding > 0) {
      overdueList.push({
        tenantId: tenant.id,
        tenantEmail: tenant.user?.email,
        tenantName: tenant.user?.name,
        tenantPhone: tenant.user?.phone,
        propertyAddress: tenant.property?.address,
        nextDueDate: tenant.nextDueDate,
        outstanding,
      });
    }
  }

  return overdueList;
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

async function sendOverdueReminders() {
  const landlords = await User.findAll({ where: { role: "landlord" } });
  const reports = [];

  for (const landlord of landlords) {
    const overdue = await getOverdueTenants(landlord.id);
    if (overdue.length === 0) continue;

    const textLines = overdue.map(
      (item) =>
        `Tenant ${item.tenantName} (${item.tenantEmail}) on property ${item.propertyAddress} owes $${item.outstanding.toFixed(2)} due ${item.nextDueDate}`,
    );

    const body = `Overdue rent reminder for landlord ${landlord.name}:\n\n${textLines.join("\n")}`;
    reports.push({
      landlordId: landlord.id,
      landlordEmail: landlord.email,
      overdueCount: overdue.length,
    });

    if (
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    ) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@rentease.com",
        to: landlord.email,
        subject: "RentEase overdue rent reminders",
        text: body,
      });
    } else {
      console.info("[ReminderService]", body);
    }

    if (
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
    ) {
      for (const item of overdue) {
        if (!item.tenantPhone) continue;
        try {
          const smstext = `Dear ${item.tenantName}, your rent for ${item.propertyAddress} is overdue by $${item.outstanding.toFixed(2)} and was due on ${item.nextDueDate}.`;
          await sendTwilioSms(item.tenantPhone, smstext);
          console.info(`[ReminderService] SMS sent to ${item.tenantPhone}`);
        } catch (smsErr) {
          console.error(
            `[ReminderService] SMS failed for ${item.tenantPhone}`,
            smsErr,
          );
        }
      }
    }
  }

  return reports;
}

module.exports = { getOverdueTenants, sendOverdueReminders };
