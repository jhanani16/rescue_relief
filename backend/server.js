import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import incidentRoutes from "./routes/incidents.js";
import teamRoutes from "./routes/teams.js";
import shelterRoutes from "./routes/shelters.js";
import missingRoutes from "./routes/missing.js";
import volunteerRoutes from "./routes/volunteers.js";
import complaintRoutes from "./routes/complaints.js";
import donationRoutes from "./routes/donations.js";
import chatbotRoutes from "./routes/chatbot.js";

import Incident from "./models/Incident.js";
import Team from "./models/Team.js";
import Shelter from "./models/Shelter.js";
import Volunteer from "./models/Volunteer.js";
import Donation from "./models/Donation.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" },
});

app.set("io", io);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/test-email", async (req, res) => {
  try {
    const { sendEmail } = await import("./mailer.js");
    const result = await sendEmail({
      to: req.query.to || process.env.EMAIL_USER || "24104019@nec.edu.in",
      subject: "Test Email from RescueRelief",
      text: "If you are reading this, RescueRelief email system is working perfectly!"
    });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/public/stats", async (req, res) => {
  try {
    const activeIncidents = await Incident.countDocuments({ status: { $ne: "COMPLETED" } });
    const teamsDeployed = await Team.countDocuments({ status: { $ne: "Available" } });
    const shelters = await Shelter.find();
    let totalCapacity = 0;
    let totalOccupancy = 0;
    shelters.forEach(s => { totalCapacity += s.capacity; totalOccupancy += s.occupancy; });
    const volunteers = await Volunteer.countDocuments();
    const donations = await Donation.find();
    let totalDonations = 0;
    donations.forEach(d => { if (d.kind === "funds") totalDonations += d.amount; });
    
    res.json({ 
      activeIncidents, 
      teamsDeployed, 
      availableShelterSpace: totalCapacity - totalOccupancy,
      totalVolunteers: volunteers,
      totalDonations
    });
  } catch (err) { res.status(500).json({ error: "Failed to fetch stats" }); }
});

app.use("/api/auth", authRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/shelters", shelterRoutes);
app.use("/api/missing", missingRoutes);
app.use("/api/volunteers", volunteerRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/chatbot", chatbotRoutes);

// Socket auth: client connects with { auth: { token } }; we join a
// per-user room so donation-receipt notifications etc. can be targeted.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(); // allow anonymous connections (read-only live feed)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.id;
  } catch { /* ignore invalid token, treat as anonymous */ }
  next();
});

io.on("connection", (socket) => {
  if (socket.userId) socket.join(`user:${socket.userId}`);
});

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    server.listen(PORT, () => console.log(`[server] RescueRelief API running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error("[db] connection failed:", err.message);
    process.exit(1);
  });
