import express from "express";
import Volunteer from "../models/Volunteer.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  res.json({ volunteers: await Volunteer.find() });
});

// Upsert the logged-in volunteer's own profile.
router.post("/me", requireAuth, requireRole("volunteer"), async (req, res) => {
  const data = req.body;
  const volunteer = await Volunteer.findOneAndUpdate(
    { ownerId: req.user._id },
    { ...data, ownerId: req.user._id, name: req.user.name, fullName: req.user.name },
    { new: true, upsert: true }
  );
  req.app.get("io").emit("volunteer:updated", volunteer);
  res.json({ volunteer });
});

// Volunteer accepting a task (incident)
router.post("/tasks/:id/accept", requireAuth, requireRole("volunteer"), async (req, res) => {
  const Incident = (await import("../models/Incident.js")).default;
  const incident = await Incident.findById(req.params.id);
  if (!incident) return res.status(404).json({ error: "Task not found." });
  
  incident.assignedVolunteer = req.user._id;
  incident.volunteerStatus = "Accepted";
  await incident.save();
  
  req.app.get("io").emit("incident:updated", incident);
  res.json({ incident });
});

// Volunteer advancing task status
router.post("/tasks/:id/advance", requireAuth, requireRole("volunteer"), async (req, res) => {
  const Incident = (await import("../models/Incident.js")).default;
  const incident = await Incident.findById(req.params.id);
  if (!incident || String(incident.assignedVolunteer) !== String(req.user._id)) {
    return res.status(403).json({ error: "Not your task." });
  }

  const steps = ["Pending", "Accepted", "On the Way", "Arrived", "In Progress", "Completed"];
  const currentIndex = steps.indexOf(incident.volunteerStatus);
  if (currentIndex >= 0 && currentIndex < steps.length - 1) {
    incident.volunteerStatus = steps[currentIndex + 1];
    await incident.save();

    if (incident.volunteerStatus === "Completed") {
      const vol = await Volunteer.findOne({ ownerId: req.user._id });
      if (vol) {
        vol.tasksCompleted += 1;
        vol.peopleHelped += parseInt(incident.affected || "0") || 1;
        vol.hoursContributed += 2;
        await vol.save();
        req.app.get("io").emit("volunteer:updated", vol);
      }
    }
    
    req.app.get("io").emit("incident:updated", incident);
  }
  res.json({ incident });
});

export default router;
