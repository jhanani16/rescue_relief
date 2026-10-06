import mongoose from "mongoose";

const MissingPersonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: String,
  gender: String,
  lastSeen: { type: String, required: true },
  status: { type: String, enum: ["Missing", "Found/Safe", "Identified"], default: "Missing" },
  photo: { type: String, default: "🧑" },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export default mongoose.model("MissingPerson", MissingPersonSchema);
