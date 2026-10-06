import express from "express";
import MissingPerson from "../models/MissingPerson.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  res.json({ missing: await MissingPerson.find().sort({ createdAt: -1 }) });
});

import { findAndReserveTeam } from "../dispatch.js";

router.post("/", requireAuth, requireRole("citizen", "admin"), async (req, res) => {
  const { name, age, gender, lastSeen } = req.body;
  if (!name || !lastSeen) return res.status(400).json({ error: "Name and last seen location are required." });
  const photo = gender === "Female" ? "👩" : "🧑";
  const person = await MissingPerson.create({ name, age, gender, lastSeen, photo, reportedBy: req.user._id });
  req.app.get("io").emit("missing:new", person);

  // Dispatch Echo-1 (Search & Rescue) automatically
  setTimeout(async () => {
    const team = await findAndReserveTeam(["Search & Rescue"]);
    if (team) {
      req.app.get("io").emit("log", { message: `Missing Person reported: ${team.name} (${team.spec}) dispatched to ${lastSeen}`, tone: "critical" });
      req.app.get("io").emit("team:updated", team);
    }
  }, 900);

  res.status(201).json({ person });
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const person = await MissingPerson.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!person) return res.status(404).json({ error: "Not found." });
  req.app.get("io").emit("missing:updated", person);
  res.json({ person });
});

export default router;
