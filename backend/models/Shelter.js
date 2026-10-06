import mongoose from "mongoose";

const ShelterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  capacity: { type: Number, required: true },
  occupancy: { type: Number, default: 0 },
  location: { type: String, required: true },
});

export default mongoose.model("Shelter", ShelterSchema);
