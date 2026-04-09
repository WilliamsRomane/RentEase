const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { User } = require("../models");
const config = require("../config");

const router = express.Router();
const PENDING_PASSWORD_HASH = "__PENDING_REGISTRATION__";

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

router.post(
  "/register",
  body("name").trim().notEmpty(),
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  body("role").isIn(["tenant", "landlord"]),
  body("phone").optional({ checkFalsy: true }).isMobilePhone("any"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const { name, email, password, role, phone } = req.body;
    try {
      const existing = await User.findOne({ where: { email } });
      if (existing && existing.passwordHash !== PENDING_PASSWORD_HASH)
        return res.status(409).json({ message: "Email already in use" });

      const passwordHash = await bcrypt.hash(password, 10);
      let user;

      if (existing) {
        if (existing.role !== "tenant" || role !== "tenant") {
          return res.status(409).json({ message: "Email already in use" });
        }

        user = await existing.update({
          name,
          passwordHash,
          phone: phone || null,
        });
      } else {
        user = await User.create({
          name,
          email,
          passwordHash,
          role,
          phone,
        });
      }

      return res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Registration failed" });
    }
  },
);

router.post(
  "/forgot-password",
  body("email").isEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { email } = req.body;

    try {
      const user = await User.findOne({ where: { email } });

      if (!user || user.passwordHash === PENDING_PASSWORD_HASH) {
        return res.json({
          message:
            "If that email is registered, a password reset link has been generated.",
        });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetPasswordTokenHash = hashResetToken(resetToken);
      const resetPasswordExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await user.update({
        resetPasswordTokenHash,
        resetPasswordExpiresAt,
      });

      return res.json({
        message:
          "Password reset link generated successfully.",
        resetToken,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Could not start password reset." });
    }
  },
);

router.post(
  "/reset-password",
  body("token").notEmpty(),
  body("password").isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { token, password } = req.body;

    try {
      const user = await User.findOne({
        where: {
          resetPasswordTokenHash: hashResetToken(token),
        },
      });

      if (
        !user ||
        !user.resetPasswordExpiresAt ||
        new Date(user.resetPasswordExpiresAt).getTime() < Date.now()
      ) {
        return res.status(400).json({ message: "Reset link is invalid or expired." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await user.update({
        passwordHash,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
      });

      return res.json({ message: "Password reset successfully." });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Could not reset password." });
    }
  },
);

router.post(
  "/login",
  body("email").isEmail(),
  body("password").notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ where: { email } });
      if (!user)
        return res.status(401).json({ message: "Invalid credentials" });
      if (user.passwordHash === PENDING_PASSWORD_HASH)
        return res.status(401).json({
          message:
            "Finish creating your account first. Please register with this email before logging in.",
        });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid)
        return res.status(401).json({ message: "Invalid credentials" });
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        config.jwtSecret,
        { expiresIn: "8h" },
      );
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Login failed" });
    }
  },
);

module.exports = router;
