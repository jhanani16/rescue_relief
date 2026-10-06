import mongoose from "mongoose";

const DonationSchema = new mongoose.Schema({
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  donorName: String,
  amount: { type: Number, required: true },
  kind: { type: String, enum: ["funds", "food", "medical"], required: true },
}, { timestamps: true });

export default mongoose.model("Donation", DonationSchema);
