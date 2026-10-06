import mongoose from "mongoose";

const IncidentSchema = new mongoose.Schema({
  type: { type: String, required: true },
  location: { type: String, required: true },
  description: String,
  affected: String,
  severity: { type: String, enum: ["CRITICAL", "HIGH", "MEDIUM"], required: true },
  status: { type: String, default: "REPORTED" },
  assignedTeam: { type: String, default: null }, // Team.teamId
  missionStep: { type: Number, default: 0 },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reportedByName: String,
  source: { type: String, default: "citizen-report" },
  
  // Volunteer Tracking
  assignedVolunteer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  volunteerStatus: { type: String, enum: ["Pending", "Accepted", "On the Way", "Arrived", "In Progress", "Completed"], default: "Pending" },
  lat: Number,
  lng: Number,
}, { timestamps: true });

export default mongoose.model("Incident", IncidentSchema);
