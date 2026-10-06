import mongoose from "mongoose";

const VolunteerSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  
  // Personal Info
  photo: String,
  fullName: { type: String, required: true },
  dob: String,
  gender: String,
  phone: String,
  email: String,
  address: String,
  city: String,
  district: String,
  state: String,
  emergencyContactName: String,
  emergencyContactPhone: String,
  preferredLanguage: String,

  // Volunteer Info
  volunteerId: String,
  volunteerType: String, // e.g. Independent, NGO
  ngoName: String,
  experienceYears: Number,
  previousExperience: String,
  status: { type: String, enum: ["Available", "Busy", "Offline"], default: "Available" },
  preferredArea: String,
  maxTravelDistance: Number, // in km
  availabilityDays: [String],
  availableTimeSlots: [String],
  skills: [String],
  otherSkills: String,

  // Stats
  tasksCompleted: { type: Number, default: 0 },
  peopleHelped: { type: Number, default: 0 },
  hoursContributed: { type: Number, default: 0 },
  rating: { type: Number, default: 5.0 },

  location: {
    lat: Number,
    lng: Number,
    address: String
  }
}, { timestamps: true });

export default mongoose.model("Volunteer", VolunteerSchema);
