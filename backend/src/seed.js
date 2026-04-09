const bcrypt = require("bcrypt");
const { sequelize, User, Property, Tenant } = require("./models");

async function seed() {
  await sequelize.sync({ alter: true });

  const [landlord] = await User.findOrCreate({
    where: { email: "landlord@demo.com" },
    defaults: {
      name: "Landlord Demo",
      passwordHash: await bcrypt.hash("Landlord123!", 10),
      role: "landlord",
      phone: "+1234567890",
    },
  });

  const [tenantUser] = await User.findOrCreate({
    where: { email: "tenant@demo.com" },
    defaults: {
      name: "Tenant Demo",
      passwordHash: await bcrypt.hash("Tenant123!", 10),
      role: "tenant",
      phone: "+0987654321",
    },
  });

  const [property] = await Property.findOrCreate({
    where: { landlordId: landlord.id, address: "123 Demo Ave" },
    defaults: { rentAmount: 1200.0, dueDay: 1, lateFee: 20.0 },
  });

  await Tenant.findOrCreate({
    where: { userId: tenantUser.id, propertyId: property.id },
    defaults: {
      rentAmount: 1200.0,
      nextDueDate: new Date().toISOString().slice(0, 10),
    },
  });

  console.log(
    "Seed complete. Log in as landlord@demo.com / Landlord123! and tenant@demo.com / Tenant123!",
  );
  process.exit();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
