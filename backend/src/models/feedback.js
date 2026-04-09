const { DataTypes } = require("sequelize");
const { sqliteSafeInteger } = require("./utils");

module.exports = (sequelize) => {
  const IntegerType = sqliteSafeInteger(sequelize);

  return sequelize.define(
    "Feedback",
    {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      tableName: "feedback",
      timestamps: true,
    },
  );
};
