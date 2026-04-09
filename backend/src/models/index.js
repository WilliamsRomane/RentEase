const { Sequelize } = require("sequelize");
const config = require("../config");

const sequelizeOptions = {
  host: config.db.host,
  port: config.db.port,
  dialect: config.db.dialect,
  logging: false,
};

if (config.db.dialect === "sqlite") {
  sequelizeOptions.storage = config.db.storage || "./database.sqlite";
}

const sequelize = new Sequelize(
  config.db.database,
  config.db.username,
  config.db.password,
  sequelizeOptions,
);

const User = require("./user")(sequelize);
const Property = require("./property")(sequelize);
const Tenant = require("./tenant")(sequelize);
const Payment = require("./payment")(sequelize);
const Notification = require("./notification")(sequelize);
const MaintenanceRequest = require("./maintenanceRequest")(sequelize);
const Feedback = require("./feedback")(sequelize);

User.hasMany(Property, { foreignKey: "landlordId", as: "properties" });
Property.belongsTo(User, { foreignKey: "landlordId", as: "landlord" });

User.hasOne(Tenant, { foreignKey: "userId", as: "tenantProfile" });
Tenant.belongsTo(User, { foreignKey: "userId", as: "user" });

Property.hasMany(Tenant, { foreignKey: "propertyId", as: "tenants" });
Tenant.belongsTo(Property, { foreignKey: "propertyId", as: "property" });

Tenant.hasMany(Payment, { foreignKey: "tenantId", as: "payments" });
Payment.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });

User.hasMany(Notification, { foreignKey: "landlordId", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "landlordId", as: "landlord" });

Tenant.hasMany(Notification, { foreignKey: "tenantId", as: "notifications" });
Notification.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });

Property.hasMany(Notification, { foreignKey: "propertyId", as: "notifications" });
Notification.belongsTo(Property, { foreignKey: "propertyId", as: "property" });

User.hasMany(MaintenanceRequest, { foreignKey: "landlordId", as: "maintenanceRequests" });
MaintenanceRequest.belongsTo(User, { foreignKey: "landlordId", as: "landlord" });

Tenant.hasMany(MaintenanceRequest, { foreignKey: "tenantId", as: "maintenanceRequests" });
MaintenanceRequest.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });

Property.hasMany(MaintenanceRequest, { foreignKey: "propertyId", as: "maintenanceRequests" });
MaintenanceRequest.belongsTo(Property, { foreignKey: "propertyId", as: "property" });

module.exports = {
  sequelize,
  User,
  Property,
  Tenant,
  Payment,
  Notification,
  MaintenanceRequest,
  Feedback,
};
