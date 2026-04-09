const { DataTypes } = require("sequelize");
const { sqliteSafeInteger } = require("./utils");

module.exports = (sequelize) => {
  const IntegerType = sqliteSafeInteger(sequelize);

  return sequelize.define(
    "User",
    {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING, allowNull: false },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      resetPasswordTokenHash: { type: DataTypes.STRING, allowNull: true },
      resetPasswordExpiresAt: { type: DataTypes.DATE, allowNull: true },
      stripeCustomerId: { type: DataTypes.STRING, allowNull: true },
      stripeSubscriptionId: { type: DataTypes.STRING, allowNull: true },
      subscriptionStatus: { type: DataTypes.STRING, allowNull: true },
      subscriptionPlan: { type: DataTypes.STRING, allowNull: true },
      subscriptionCurrentPeriodEnd: { type: DataTypes.DATE, allowNull: true },
      role: { type: DataTypes.ENUM("tenant", "landlord"), allowNull: false },
      phone: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: "users",
      timestamps: true,
    },
  );
};
