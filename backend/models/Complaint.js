import mongoose from "mongoose";

const ComplaintSchema = new mongoose.Schema({
  category: { type: String, required: true },
  text: { type: String, required: true },
  status: { type: String, enum: ["Submitted", "Under Review", "Assigned", "Resolved"], default: "Submitted" },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export default mongoose.model("Complaint", ComplaintSchema);
