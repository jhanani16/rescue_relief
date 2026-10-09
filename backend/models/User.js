import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  text: String,
  time: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String }, // Added to bypass legacy DB constraints
  password: { type: String, required: true }, // bcrypt hash
  name: { type: String, required: true },
  role: { type: String, enum: ["citizen", "volunteer", "response", "admin"], required: true },
  teamId: { type: String }, // only for role: response
  phone: { type: String }, // For SMS notifications
  notifications: [NotificationSchema],
}, { timestamps: true });

export default mongoose.model("User", UserSchema);
