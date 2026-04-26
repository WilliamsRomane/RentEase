const { DataTypes } = require("sequelize");
const { ensureColumn, ensureIndex, ensureTable, hasTable } = require("../migration-utils");

module.exports = {
  name: "202604250001-initial-schema",
  async up({ queryInterface, sequelize }) {
    const IntegerType =
      sequelize.getDialect() === "sqlite"
        ? DataTypes.INTEGER
        : DataTypes.INTEGER.UNSIGNED;

    await ensureTable(queryInterface, "users", {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      resetPasswordTokenHash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      resetPasswordExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      stripeCustomerId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      stripeSubscriptionId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      subscriptionStatus: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      subscriptionPlan: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      subscriptionCurrentPeriodEnd: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM("tenant", "landlord"),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await ensureTable(queryInterface, "properties", {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      landlordId: {
        type: IntegerType,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      address: {
        type: DataTypes.STRING,
        allowNull: false,
      },
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await ensureTable(queryInterface, "tenants", {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: IntegerType,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      propertyId: {
        type: IntegerType,
        allowNull: false,
        references: {
          model: "properties",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      rentAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      nextDueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await ensureTable(queryInterface, "payments", {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      tenantId: {
        type: IntegerType,
        allowNull: false,
        references: {
          model: "tenants",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
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
      paymentDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      transactionId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await ensureTable(queryInterface, "notifications", {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      landlordId: {
        type: IntegerType,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tenantId: {
        type: IntegerType,
        allowNull: true,
        references: {
          model: "tenants",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      propertyId: {
        type: IntegerType,
        allowNull: true,
        references: {
          model: "properties",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await ensureTable(queryInterface, "maintenance_requests", {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      landlordId: {
        type: IntegerType,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tenantId: {
        type: IntegerType,
        allowNull: false,
        references: {
          model: "tenants",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      propertyId: {
        type: IntegerType,
        allowNull: false,
        references: {
          model: "properties",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await ensureTable(queryInterface, "feedback", {
      id: {
        type: IntegerType,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await ensureColumn(queryInterface, "users", "resetPasswordTokenHash", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "users", "resetPasswordExpiresAt", {
      type: DataTypes.DATE,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "users", "stripeCustomerId", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "users", "stripeSubscriptionId", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "users", "subscriptionStatus", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "users", "subscriptionPlan", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "users", "subscriptionCurrentPeriodEnd", {
      type: DataTypes.DATE,
      allowNull: true,
    });

    await ensureColumn(queryInterface, "properties", "gracePeriodDays", {
      type: IntegerType,
      allowNull: false,
      defaultValue: 5,
    });
    await ensureColumn(queryInterface, "properties", "dailyLateFee", {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await ensureColumn(queryInterface, "payments", "balanceRemaining", {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await ensureColumn(queryInterface, "tenants", "paymentMethod", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "tenants", "landlordBankName", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "tenants", "landlordAccountName", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "tenants", "landlordAccountNumber", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "tenants", "landlordBranch", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "tenants", "landlordAccountType", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "tenants", "landlordRoutingNumber", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "tenants", "landlordLynxPhoneNumber", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "tenants", "paymentInstructions", {
      type: DataTypes.TEXT,
      allowNull: true,
    });

    await ensureIndex(queryInterface, "users", ["email"], {
      name: "users_email_unique",
      unique: true,
    });
    await ensureIndex(queryInterface, "properties", ["landlordId"], {
      name: "properties_landlordId_idx",
    });
    await ensureIndex(queryInterface, "tenants", ["userId"], {
      name: "tenants_userId_idx",
    });
    await ensureIndex(queryInterface, "tenants", ["propertyId"], {
      name: "tenants_propertyId_idx",
    });
    await ensureIndex(queryInterface, "payments", ["tenantId"], {
      name: "payments_tenantId_idx",
    });
    await ensureIndex(queryInterface, "notifications", ["landlordId"], {
      name: "notifications_landlordId_idx",
    });
    await ensureIndex(queryInterface, "maintenance_requests", ["landlordId"], {
      name: "maintenance_requests_landlordId_idx",
    });
    await ensureIndex(queryInterface, "maintenance_requests", ["tenantId"], {
      name: "maintenance_requests_tenantId_idx",
    });
    await ensureIndex(queryInterface, "maintenance_requests", ["propertyId"], {
      name: "maintenance_requests_propertyId_idx",
    });
  },
  async down({ queryInterface }) {
    if (await hasTable(queryInterface, "feedback")) {
      await queryInterface.dropTable("feedback");
    }

    if (await hasTable(queryInterface, "maintenance_requests")) {
      await queryInterface.dropTable("maintenance_requests");
    }

    if (await hasTable(queryInterface, "notifications")) {
      await queryInterface.dropTable("notifications");
    }

    if (await hasTable(queryInterface, "payments")) {
      await queryInterface.dropTable("payments");
    }

    if (await hasTable(queryInterface, "tenants")) {
      await queryInterface.dropTable("tenants");
    }

    if (await hasTable(queryInterface, "properties")) {
      await queryInterface.dropTable("properties");
    }

    if (await hasTable(queryInterface, "users")) {
      await queryInterface.dropTable("users");
    }
  },
};
