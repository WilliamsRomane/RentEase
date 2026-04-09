const { DataTypes } = require("sequelize");

function sqliteSafeInteger(sequelize) {
  return sequelize.getDialect() === "sqlite"
    ? DataTypes.INTEGER
    : DataTypes.INTEGER.UNSIGNED;
}

module.exports = {
  sqliteSafeInteger,
};
