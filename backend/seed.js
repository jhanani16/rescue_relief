import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import Team from "./models/Team.js";
import Shelter from "./models/Shelter.js";
import MissingPerson from "./models/MissingPerson.js";

const TEAM_SEED = [
  { teamId: "ALPHA-6", name: "Alpha-6", spec: "Search & Rescue", sector: "Sector 4", status: "Available", personnel: 8 },
  { teamId: "BRAVO-2", name: "Bravo-2", spec: "Medical", sector: "Sector 2", status: "Available", personnel: 5 },
  { teamId: "GAMMA-9", name: "Gamma-9", spec: "Heavy Equipment", sector: "Hub Gamma", status: "Available", personnel: 6 },
  { teamId: "DELTA-3", name: "Delta-3", spec: "Fire Response", sector: "Sector 6", status: "Available", personnel: 10 },
  { teamId: "ECHO-1", name: "Echo-1", spec: "Search & Rescue", sector: "Sector 1", status: "Available", personnel: 7 },
  { teamId: "FOX-5", name: "Fox-5", spec: "Logistics", sector: "Hub North", status: "Available", personnel: 4 },
];

const SHELTER_SEED = [
  { name: "Riverside Community Hall", capacity: 200, occupancy: 118, location: "Sector 2" },
  { name: "St. Xavier School Shelter", capacity: 150, occupancy: 150, location: "Sector 4" },
  { name: "North Hub Relief Center", capacity: 300, occupancy: 64, location: "Hub North" },
];

const MISSING_SEED = [
  { name: "Ravi Kumar", age: "34", gender: "Male", lastSeen: "Riverside Area", status: "Missing", photo: "🧑" },
  { name: "Anjali Devi", age: "8", gender: "Female", lastSeen: "Sector 4 Market", status: "Found/Safe", photo: "👩" },
];

async function run() {
  await connectDB();

  await Promise.all([
    User.deleteMany({ role: { $in: ["admin", "response"] } }),
    Team.deleteMany({}),
    Shelter.deleteMany({}),
    MissingPerson.deleteMany({}),
  ]);

  try {
    await mongoose.connection.collection('users').drop();
    console.log("Dropped entire users collection to wipe old indexes");
  } catch (e) {
    console.log("Collection drop skipped:", e.message);
  }

  const adminHash = await bcrypt.hash("admin123", 10);
  await User.create({ username: "admin", password: adminHash, name: "Command Admin", role: "admin", notifications: [] });

  const teamHash = await bcrypt.hash("team123", 10);
  for (const t of TEAM_SEED) {
    await Team.create(t);
    const username = t.teamId.split("-")[0].toLowerCase() + t.teamId.split("-")[1];
    await User.create({
      username, password: teamHash, name: `${t.name} Team Lead`, role: "response", teamId: t.teamId, notifications: [],
    });
    console.log(`  response login: ${username} / team123  ->  ${t.teamId}`);
  }

  await Shelter.insertMany(SHELTER_SEED);
  await MissingPerson.insertMany(MISSING_SEED);

  console.log("\nSeed complete.");
  console.log("Admin login: admin / admin123");
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
