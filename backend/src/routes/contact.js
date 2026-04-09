const express = require("express");
const { body, validationResult } = require("express-validator");
const { Feedback } = require("../models");

const router = express.Router();

router.post(
  "/feedback",
  body("name").trim().notEmpty().withMessage("Name is required."),
  body("email").trim().isEmail().withMessage("A valid email is required."),
  body("subject").trim().notEmpty().withMessage("Subject is required."),
  body("message")
    .trim()
    .isLength({ min: 10 })
    .withMessage("Message must be at least 10 characters."),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, subject, message } = req.body;

    try {
      const feedback = await Feedback.create({
        name,
        email,
        subject,
        message,
      });

      return res.status(201).json({
        id: feedback.id,
        message: "Feedback submitted successfully.",
      });
    } catch (error) {
      console.error("Failed to save feedback", error);
      return res.status(500).json({ message: "Could not submit feedback." });
    }
  },
);

module.exports = router;
