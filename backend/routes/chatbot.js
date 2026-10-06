import express from "express";

const router = express.Router();

router.post("/", (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required" });

  const msgLower = message.toLowerCase();
  let reply = "Hello! I am the RescueRelief support assistant. How can I help you today?";

  if (msgLower.includes("sos") || msgLower.includes("emergency") || msgLower.includes("help")) {
    reply = "If you have an immediate emergency, please click the red 'Trigger SOS' button on the dashboard. This will immediately dispatch the nearest available rescue team to your location.";
  } else if (msgLower.includes("donate") || msgLower.includes("fund") || msgLower.includes("money")) {
    reply = "You can make a donation of funds, food supplies, or medical kits by visiting the 'Donate' tab in your dashboard. Your contribution directly supports the relief efforts.";
  } else if (msgLower.includes("shelter") || msgLower.includes("camp") || msgLower.includes("hub")) {
    reply = "To find the nearest operational relief hub or medical camp, please check the 'Relief Services' or 'Hubs' tab. You will find real-time occupancy data there.";
  } else if (msgLower.includes("missing")) {
    reply = "You can report or search for missing persons in the 'Missing Persons' section of the app. Please provide as much detail as possible to assist the search teams.";
  } else if (msgLower.includes("report") || msgLower.includes("incident")) {
    reply = "To report a new incident (such as a flood or fire), please use the 'Report Incident' form. This helps our dispatch engine assign teams efficiently.";
  }

  res.json({ reply });
});

export default router;
