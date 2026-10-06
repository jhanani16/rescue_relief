import express from "express";
import Shelter from "../models/Shelter.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  res.json({ shelters: await Shelter.find() });
});

router.patch("/:id", requireAuth, requireRole("admin", "volunteer"), async (req, res) => {
  const shelter = await Shelter.findById(req.params.id);
  if (!shelter) return res.status(404).json({ error: "Shelter not found." });
  const delta = Number(req.body.delta || 0);
  shelter.occupancy = Math.max(0, Math.min(shelter.capacity, shelter.occupancy + delta));
  await shelter.save();
  req.app.get("io").emit("shelter:updated", shelter);
  res.json({ shelter });
});

export default router;
