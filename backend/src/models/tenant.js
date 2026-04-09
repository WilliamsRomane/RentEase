const { DataTypes } = require("sequelize");
const { sqliteSafeInteger } = require("./utils");

module.exports = (sequelize) => {
  const IntegerType = sqliteSafeInteger(sequelize);

  return sequelize.define(
    "Tenant",
    {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: { type: IntegerType, allowNull: false },
      propertyId: { type: IntegerType, allowNull: false },
      rentAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      nextDueDate: { type: DataTypes.DATEONLY, allowNull: true },
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
    },
    {
      tableName: "tenants",
      timestamps: true,
    },
  );
};
