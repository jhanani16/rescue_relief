import express from "express";
import Donation from "../models/Donation.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  const records = await Donation.find().sort({ createdAt: -1 });
  const totals = { funds: 0, food: 0, medical: 0 };
  records.forEach(r => { totals[r.kind] += r.amount; });
  res.json({ records, totals });
});

router.post("/", requireAuth, requireRole("citizen"), async (req, res) => {
  const { amount, kind } = req.body;
  const n = Number(amount);
  if (!n || n <= 0 || !["funds", "food", "medical"].includes(kind)) {
    return res.status(400).json({ error: "Valid amount and donation type are required." });
  }
  const donation = await Donation.create({ donorId: req.user._id, donorName: req.user.name, amount: n, kind });

  const label = kind === "funds" ? `₹${n.toLocaleString("en-IN")}` : `${n} units of ${kind}`;
  req.user.notifications.unshift({ text: `Your donation of ${label} was received. Thank you for your support!` });
  await req.user.save();

  try {
    const twilio = (await import("twilio")).default;
    const nodemailer = (await import("nodemailer")).default;
    
    // Simulate SMS if credentials exist
    if (process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN && req.user.phone) {
      const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `RescueRelief: Thank you ${req.user.name} for your generous donation of ${label}!`,
        from: process.env.TWILIO_PHONE,
        to: req.user.phone
      });
    }

    // Send Email notification
    try {
      const { sendEmail } = await import("../mailer.js");
      await sendEmail({
        to: req.user.email || req.user.username || "24104019@nec.edu.in",
        subject: "RescueRelief Donation Confirmation",
        text: `Dear ${req.user.name},\n\nWe received your donation of ${label}. Thank you for helping us make a difference.`
      });
    } catch (e) {
      console.error("Donation email failed:", e.message);
    }
  } catch (err) {
    console.error("Failed to send external notifications:", err);
  }

  req.app.get("io").emit("log", { message: `Donation received from ${req.user.name}: ${label}`, tone: "success" });
  req.app.get("io").emit("donation:new", donation);

  res.status(201).json({ donation, user: { notifications: req.user.notifications } });
});

export default router;
