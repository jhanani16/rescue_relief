import express from "express";
import Complaint from "../models/Complaint.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();
const FLOW = ["Submitted", "Under Review", "Assigned", "Resolved"];

router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  res.json({ complaints: await Complaint.find().sort({ createdAt: -1 }) });
});

router.post("/", requireAuth, async (req, res) => {
  const { category, text } = req.body;
  if (!text) return res.status(400).json({ error: "Details are required." });
  const complaint = await Complaint.create({ category, text, submittedBy: req.user._id });
  req.app.get("io").emit("log", { message: `New complaint: ${category}`, tone: "warn" });
  res.status(201).json({ complaint });
});

router.post("/:id/advance", requireAuth, requireRole("admin"), async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) return res.status(404).json({ error: "Not found." });
  const idx = FLOW.indexOf(complaint.status);
  complaint.status = FLOW[Math.min(idx + 1, FLOW.length - 1)];
  await complaint.save();
  res.json({ complaint });
});

export default router;
