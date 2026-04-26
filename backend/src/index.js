const express = require("express");
const cors = require("cors");
const { sequelize } = require("./models");
const config = require("./config");
const { runMigrations } = require("./db/migrate");

const cron = require("node-cron");
const authRoutes = require("./routes/auth");
const contactRoutes = require("./routes/contact");
const landlordRoutes = require("./routes/landlord");
const tenantRoutes = require("./routes/tenant");
const paymentRoutes = require("./routes/payments");
const billingRoutes = require("./routes/billing");
const { sendOverdueReminders } = require("./services/reminderService");

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    },
  }),
);
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

async function init() {
  try {
    await sequelize.authenticate();
    await runMigrations();
    console.log("Database connected and migrations applied");

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
