const express = require("express");
const cors = require("cors");
const { DataTypes } = require("sequelize");
const { sequelize } = require("./models");
const config = require("./config");

const cron = require("node-cron");
const authRoutes = require("./routes/auth");
const contactRoutes = require("./routes/contact");
const landlordRoutes = require("./routes/landlord");
const tenantRoutes = require("./routes/tenant");
const paymentRoutes = require("./routes/payments");
const billingRoutes = require("./routes/billing");
const { sendOverdueReminders } = require("./services/reminderService");

const app = express();

app.use(cors());
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use("/api/billing/provider-callback", express.raw({ type: "*/*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/landlord", landlordRoutes);
app.use("/api/tenant", tenantRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/billing", billingRoutes);

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

async function ensureTenantPaymentColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const tenantTable = await queryInterface.describeTable("tenants");
  const tenantColumns = {
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    landlordBankName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    landlordAccountName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    landlordAccountNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    landlordBranch: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    landlordAccountType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    landlordRoutingNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    landlordLynxPhoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paymentInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  };

  for (const [columnName, columnDefinition] of Object.entries(tenantColumns)) {
    if (!tenantTable[columnName]) {
      await queryInterface.addColumn("tenants", columnName, columnDefinition);
    }
  }
}

async function ensurePropertyLateFeeColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const propertyTable = await queryInterface.describeTable("properties");
  const propertyColumns = {
    gracePeriodDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },
    dailyLateFee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
  };

  for (const [columnName, columnDefinition] of Object.entries(propertyColumns)) {
    if (!propertyTable[columnName]) {
      await queryInterface.addColumn("properties", columnName, columnDefinition);
    }
  }
}

async function ensurePaymentColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const paymentTable = await queryInterface.describeTable("payments");
  const paymentColumns = {
    balanceRemaining: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
  };

  for (const [columnName, columnDefinition] of Object.entries(paymentColumns)) {
    if (!paymentTable[columnName]) {
      await queryInterface.addColumn("payments", columnName, columnDefinition);
    }
  }
}

async function ensureUserPasswordResetColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const userTable = await queryInterface.describeTable("users");
  const userColumns = {
    resetPasswordTokenHash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    resetPasswordExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    stripeCustomerId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stripeSubscriptionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subscriptionStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subscriptionPlan: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subscriptionCurrentPeriodEnd: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  };

  for (const [columnName, columnDefinition] of Object.entries(userColumns)) {
    if (!userTable[columnName]) {
      await queryInterface.addColumn("users", columnName, columnDefinition);
    }
  }
}

async function init() {
  try {
    await sequelize.authenticate();
    const syncOptions = config.db.dialect === "sqlite" ? {} : { alter: true };
    await sequelize.sync(syncOptions);
    await ensureTenantPaymentColumns();
    await ensurePropertyLateFeeColumns();
    await ensurePaymentColumns();
    await ensureUserPasswordResetColumns();
    console.log("Database connected and synced");

    // send reminders every day at 08:00
    cron.schedule("0 8 * * *", async () => {
      try {
        console.log("[Reminder] running scheduled reminder check");
        const report = await sendOverdueReminders();
        console.log("[Reminder] report", report);
      } catch (error) {
        console.error("[Reminder] failed", error);
      }
    });

    app.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error("Startup error", err);
    process.exit(1);
  }
}

init();
