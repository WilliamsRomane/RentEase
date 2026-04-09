const { DataTypes } = require("sequelize");
const { sqliteSafeInteger } = require("./utils");

module.exports = (sequelize) => {
  const IntegerType = sqliteSafeInteger(sequelize);

  return sequelize.define(
    "Notification",
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
        allowNull: true,
      },
      propertyId: {
        type: IntegerType,
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "notifications",
      timestamps: true,
    },
  );
};
