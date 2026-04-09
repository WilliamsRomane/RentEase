const { DataTypes } = require("sequelize");
const { sqliteSafeInteger } = require("./utils");

module.exports = (sequelize) => {
  const IntegerType = sqliteSafeInteger(sequelize);

  return sequelize.define(
    "Property",
    {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
      },
      landlordId: { type: IntegerType, allowNull: false },
      address: { type: DataTypes.STRING, allowNull: false },
      rentAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      dueDay: {
        type: IntegerType,
        allowNull: false,
        defaultValue: 1,
      },
      gracePeriodDays: {
        type: IntegerType,
        allowNull: false,
        defaultValue: 5,
      },
      dailyLateFee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      lateFee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "properties",
      timestamps: true,
    },
  );
};
