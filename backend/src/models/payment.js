const { DataTypes } = require("sequelize");
const { sqliteSafeInteger } = require("./utils");

module.exports = (sequelize) => {
  const IntegerType = sqliteSafeInteger(sequelize);

  return sequelize.define(
    "Payment",
    {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
      },
      tenantId: { type: IntegerType, allowNull: false },
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      balanceRemaining: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM("pending", "paid", "failed"),
        allowNull: false,
        defaultValue: "pending",
      },
      paymentDate: { type: DataTypes.DATE, allowNull: true },
      transactionId: { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: "payments",
      timestamps: true,
    },
  );
};
