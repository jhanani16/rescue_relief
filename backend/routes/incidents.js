import express from "express";
import Incident from "../models/Incident.js";
import Team from "../models/Team.js";
import User from "../models/User.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { classify, findAndReserveTeam } from "../dispatch.js";

const router = express.Router();
const MISSION_STEPS = ["ASSIGNED", "ACKNOWLEDGED", "EN ROUTE", "ON SCENE", "RESCUE IN PROGRESS", "COMPLETED"];

router.get("/", requireAuth, async (req, res) => {
  let query = {};
  // Response team accounts only ever see incidents assigned to their own team.
  if (req.user.role === "response") query.assignedTeam = req.user.teamId;
  const incidents = await Incident.find(query).sort({ createdAt: -1 });
  res.json({ incidents });
});

router.post("/", requireAuth, requireRole("citizen", "admin"), async (req, res) => {
  const io = req.app.get("io");
  const { type, location, description, affected, source } = req.body;
  if (!type || !location) return res.status(400).json({ error: "Type and location are required." });

  const rule = classify(type);
  const incident = await Incident.create({
    type, location, description, affected,
    severity: rule.severity, status: "REPORTED",
    reportedBy: req.user._id, reportedByName: req.user.name,
    source: source || "citizen-report",
  });

  io.emit("log", { message: `New incident reported: ${type} at ${location}`, tone: "critical" });
  io.emit("incident:new", incident);

  // Run dispatch asynchronously so the citizen gets an instant response,
  // matching the "engine runs in the background" behavior from the brief.
  setTimeout(async () => {
    io.emit("log", { message: `Incident ${incident._id} classified as ${type} — priority ${rule.severity}`, tone: "warn" });
    const team = await findAndReserveTeam(rule.teams);
    if (team) {
      let eta = Math.floor(Math.random() * 10) + 2; // ETA between 2-12 mins
      if (location.includes("GPS")) eta = Math.floor(Math.random() * 5) + 2; // Faster if GPS
      incident.assignedTeam = team.teamId;
      incident.status = "ASSIGNED";
      await incident.save();
      io.emit("log", { message: `${team.name} (${team.spec}) matched — nearest available unit. ETA: ${eta} mins`, tone: "info" });
      io.emit("incident:updated", incident);
      io.emit("team:updated", team);

      try {
        const nodemailer = (await import("nodemailer")).default;
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
          const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
          });
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: "24104019@nec.edu.in",
            subject: "RescueRelief Alert: Team Assigned",
            text: `Admin Alert:\n\n${team.name} (${team.spec}) has been assigned and deployed to ${type} at ${location}.\nETA: ${eta} minutes.`
          });
        }
      } catch (err) { console.error("Email failed:", err); }

      io.emit("team:updated", team);
    } else {
      incident.status = "PENDING — NO UNIT AVAILABLE";
      await incident.save();
      io.emit("log", { message: `No available unit for ${type} — queued`, tone: "critical" });
      io.emit("incident:updated", incident);
    }
  }, 900);

  res.status(201).json({ incident });
});

router.post("/:id/advance", requireAuth, requireRole("response", "admin"), async (req, res) => {
  const io = req.app.get("io");
  const incident = await Incident.findById(req.params.id);
  if (!incident) return res.status(404).json({ error: "Incident not found." });

  // Response accounts may only advance their own team's missions.
  if (req.user.role === "response" && incident.assignedTeam !== req.user.teamId) {
    return res.status(403).json({ error: "This mission isn't assigned to your team." });
  }

  const nextStep = Math.min(incident.missionStep + 1, MISSION_STEPS.length - 1);
  incident.missionStep = nextStep;
  incident.status = MISSION_STEPS[nextStep];
  await incident.save();

  io.emit("log", { message: `${incident._id} status → ${incident.status}`, tone: incident.status === "COMPLETED" ? "success" : "info" });
  io.emit("incident:updated", incident);

  try {
    const nodemailer = (await import("nodemailer")).default;
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS && incident.assignedTeam) {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: "24104019@nec.edu.in",
        subject: `RescueRelief Alert: Operation Update`,
        text: `Admin Alert:\n\nIncident ${incident._id} (${incident.type} at ${incident.location}) status has been updated to: ${incident.status} by Team ${incident.assignedTeam}.`
      });
    }
  } catch (err) { console.error("Email failed:", err); }

  if (incident.status === "COMPLETED" && incident.assignedTeam) {
    const team = await Team.findOneAndUpdate({ teamId: incident.assignedTeam }, { status: "Available" }, { new: true });
    if (team) io.emit("team:updated", team);
  }

  res.json({ incident });
});

export default router;
