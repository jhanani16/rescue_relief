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

    // Simulate Email if credentials exist
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: req.user.username, // Assuming username is email
        subject: "RescueRelief Donation Confirmation",
        text: `Dear ${req.user.name},\n\nWe received your donation of ${label}. Thank you for helping us make a difference.`
      });
    }
  } catch (err) {
    console.error("Failed to send external notifications:", err);
  }

  req.app.get("io").emit("log", { message: `Donation received from ${req.user.name}: ${label}`, tone: "success" });
  req.app.get("io").emit("donation:new", donation);

  res.status(201).json({ donation, user: { notifications: req.user.notifications } });
});

export default router;
