const { DataTypes } = require("sequelize");
const { sqliteSafeInteger } = require("./utils");

module.exports = (sequelize) => {
  const IntegerType = sqliteSafeInteger(sequelize);

  return sequelize.define(
    "MaintenanceRequest",
    {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
      },
      landlordId: {
        type: IntegerType,
        allowNull: false,
      },
      tenantId: {
        type: IntegerType,
        allowNull: false,
      },
      propertyId: {
        type: IntegerType,
        allowNull: false,
      },
      issueTitle: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      issueDescription: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("open", "in_progress", "resolved"),
        allowNull: false,
        defaultValue: "open",
      },
      landlordResponse: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      landlordRespondedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "maintenance_requests",
      timestamps: true,
    },
  );
};
