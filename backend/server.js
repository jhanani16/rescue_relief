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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" },
});

app.set("io", io);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

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
