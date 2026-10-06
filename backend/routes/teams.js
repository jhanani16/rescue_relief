import express from "express";
import Team from "../models/Team.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const teams = await Team.find();
  res.json({ teams });
});

// Response accounts can only toggle their own team; admin can set any team + status.
router.patch("/:teamId", requireAuth, requireRole("response", "admin"), async (req, res) => {
  const io = req.app.get("io");
  if (req.user.role === "response" && req.params.teamId !== req.user.teamId) {
    return res.status(403).json({ error: "You can only update your own team." });
  }
  const { status } = req.body;
  const team = await Team.findOneAndUpdate({ teamId: req.params.teamId }, { status }, { new: true });
  if (!team) return res.status(404).json({ error: "Team not found." });
  io.emit("log", { message: `${team.name} marked ${status}`, tone: "info" });
  io.emit("team:updated", team);
  res.json({ team });
});

export default router;
