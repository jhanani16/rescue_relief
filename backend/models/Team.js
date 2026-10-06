import mongoose from "mongoose";

const TeamSchema = new mongoose.Schema({
  teamId: { type: String, required: true, unique: true }, // e.g. ALPHA-6
  name: { type: String, required: true },
  spec: { type: String, required: true },
  sector: { type: String, required: true },
  status: { type: String, enum: ["Available", "Busy", "Deployed"], default: "Available" },
  personnel: { type: Number, default: 5 },
});

export default mongoose.model("Team", TeamSchema);
