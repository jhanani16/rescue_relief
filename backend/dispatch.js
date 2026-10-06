import Team from "./models/Team.js";

/* Rule-based dispatch engine — mirrors the logic described in the
   project brief: classify the incident, work out which team
   specializations are needed, then find the nearest available match. */

export const DISASTER_RULES = {
  Flood: { severity: "HIGH", teams: ["Search & Rescue", "Medical"] },
  Fire: { severity: "CRITICAL", teams: ["Fire Response", "Medical"] },
  "Building Collapse": { severity: "CRITICAL", teams: ["Search & Rescue", "Medical", "Heavy Equipment"] },
  "Medical Emergency": { severity: "HIGH", teams: ["Medical"] },
  Cyclone: { severity: "CRITICAL", teams: ["Search & Rescue", "Medical", "Logistics"] },
  "Water Contamination": { severity: "MEDIUM", teams: ["Medical", "Infrastructure"] },
};

export function classify(type) {
  return DISASTER_RULES[type] || { severity: "MEDIUM", teams: ["Search & Rescue"] };
}

// Finds and reserves (marks Deployed) the best available team for the
// required specializations, in priority order. Returns the team doc or null.
export async function findAndReserveTeam(requiredSpecs) {
  for (const spec of requiredSpecs) {
    const team = await Team.findOneAndUpdate(
      { spec, status: "Available" },
      { status: "Deployed" },
      { new: true }
    );
    if (team) return team;
  }
  return null;
}
