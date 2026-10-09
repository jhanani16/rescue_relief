import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertTriangle, Radio, Users, Package, Heart, MessageSquare,
  BarChart3, MapPin, Clock, CheckCircle2, Truck,
  Home, Shield, Stethoscope, Droplet, Building2,
  UserSearch, ChevronRight, X, Activity,
  Navigation, Zap, ClipboardList, ArrowRight, Plus, LogOut,
  UserPlus, Lock, User as UserIcon, Map
} from "lucide-react";
import api from "./api.js";
import { createSocket } from "./socket.js";
import { VolunteerDashboardExpanded, LiveRescueMap, VolunteerRegisterExpanded } from "./VolunteerFeatures";

/* ---------------------------------------------------------------
   RESCUE RELIEF — Frontend (Vite + React)
   Talks to the Express + MongoDB backend over REST, and listens
   for live updates over Socket.io.
---------------------------------------------------------------- */

const DISASTER_TYPES = ["Flood", "Fire", "Building Collapse", "Medical Emergency", "Cyclone", "Water Contamination"];
const DISASTER_COLOR = {
  Flood: "#3E7CB1", Fire: "#D64545", "Building Collapse": "#8A5A44",
  "Medical Emergency": "#D6486B", Cyclone: "#5B6EE8", "Water Contamination": "#3FA873",
};
const DISASTER_TEAM_HINT = {
  Flood: "Search & Rescue, Medical", Fire: "Fire Response, Medical",
  "Building Collapse": "Search & Rescue, Medical, Heavy Equipment",
  "Medical Emergency": "Medical", Cyclone: "Search & Rescue, Medical, Logistics",
  "Water Contamination": "Medical, Infrastructure",
};
const SEVERITY_HINT = {
  Flood: "HIGH", Fire: "CRITICAL", "Building Collapse": "CRITICAL",
  "Medical Emergency": "HIGH", Cyclone: "CRITICAL", "Water Contamination": "MEDIUM",
};

const MISSION_STEPS = ["ASSIGNED", "ACKNOWLEDGED", "EN ROUTE", "ON SCENE", "RESCUE IN PROGRESS", "COMPLETED"];
const ROLE_LABEL = { citizen: "Citizen", volunteer: "Volunteer", response: "Response Team", admin: "Command Admin" };

const uid = () => Math.random().toString(36).slice(2, 9);
const shortId = (id) => "INC-" + String(id).slice(-6).toUpperCase();
const nowStr = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/* ---------------- Root ---------------- */

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("rr_token"));
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(!!token);
  const [tab, setTab] = useState("home");

  const [incidents, setIncidents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [missing, setMissing] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [donations, setDonations] = useState({ totals: { funds: 0, food: 0, medical: 0 }, records: [] });
  const [log, setLog] = useState([]);
  const [toast, setToast] = useState(null);
  const [sosActive, setSosActive] = useState(false);
  const socketRef = useRef(null);

  const role = currentUser?.role;

  const pushLog = useCallback((message, tone = "info") => {
    setLog(prev => [...prev.slice(-49), { id: uid(), time: nowStr(), message, tone }]);
  }, []);

  const showToast = useCallback((title, body, tone = "info") => {
    setToast({ id: uid(), title, body, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---- Restore session on load ---- */
  useEffect(() => {
    if (!token) { setAuthLoading(false); return; }
    api.get("/auth/me")
      .then(res => setCurrentUser(res.data.user))
      .catch(() => { localStorage.removeItem("rr_token"); setToken(null); })
      .finally(() => setAuthLoading(false));
  }, []); // eslint-disable-line

  /* ---- Once logged in: connect socket + load data ---- */
  useEffect(() => {
    if (!currentUser) return;
    setTab("home");

    const socket = createSocket(token);
    socketRef.current = socket;

    socket.on("log", (l) => pushLog(l.message, l.tone));

    socket.on("incident:new", (incident) => {
      setIncidents(prev => [incident, ...prev.filter(i => i._id !== incident._id)]);
    });
    socket.on("incident:updated", (incident) => {
      setIncidents(prev => {
        const exists = prev.some(i => i._id === incident._id);
        if (!exists) return [incident, ...prev];
        return prev.map(i => i._id === incident._id ? incident : i);
      });
      if (incident.assignedTeam && incident.status === "ASSIGNED") {
        showToast("Team Assigned", `${incident.type} in ${incident.location}`, incident.severity === "CRITICAL" ? "critical" : "warn");
      }
      if (incident.status === "COMPLETED") {
        showToast("Mission Completed", `${incident.type} at ${incident.location} resolved`, "success");
      }
    });

    socket.on("team:updated", (team) => {
      setTeams(prev => prev.map(t => t.teamId === team.teamId ? team : t));
    });
    socket.on("shelter:updated", (shelter) => {
      setShelters(prev => prev.map(s => s._id === shelter._id ? shelter : s));
    });
    socket.on("missing:new", (person) => setMissing(prev => [person, ...prev]));
    socket.on("missing:updated", (person) => setMissing(prev => prev.map(m => m._id === person._id ? person : m)));
    socket.on("volunteer:updated", (v) => {
      setVolunteers(prev => {
        const exists = prev.some(x => x._id === v._id);
        return exists ? prev.map(x => x._id === v._id ? v : x) : [v, ...prev];
      });
    });
    socket.on("donation:new", (d) => {
      if (role === "admin") {
        setDonations(prev => ({
          totals: { ...prev.totals, [d.kind]: prev.totals[d.kind] + d.amount },
          records: [d, ...prev.records],
        }));
      }
    });

    // Initial data load
    api.get("/incidents").then(r => setIncidents(r.data.incidents)).catch(() => {});
    api.get("/teams").then(r => setTeams(r.data.teams)).catch(() => {});
    api.get("/shelters").then(r => setShelters(r.data.shelters)).catch(() => {});
    api.get("/missing").then(r => setMissing(r.data.missing)).catch(() => {});
    api.get("/volunteers").then(r => setVolunteers(r.data.volunteers)).catch(() => {});
    if (role === "admin") {
      api.get("/complaints").then(r => setComplaints(r.data.complaints)).catch(() => {});
      api.get("/donations").then(r => setDonations(r.data)).catch(() => {});
    }

    return () => socket.disconnect();
  }, [currentUser?.id]); // eslint-disable-line

  /* ---- Auth actions ---- */

  const login = useCallback(async (username, password) => {
    try {
      const res = await api.post("/auth/login", { username, password });
      localStorage.setItem("rr_token", res.data.token);
      setToken(res.data.token);
      setCurrentUser(res.data.user);
      setAuthError("");
    } catch (err) {
      setAuthError(err.response?.data?.error || "Login failed.");
    }
  }, []);

  const signup = useCallback(async ({ name, username, password, role: signupRole }) => {
    try {
      const res = await api.post("/auth/signup", { name, username, password, role: signupRole });
      localStorage.setItem("rr_token", res.data.token);
      setToken(res.data.token);
      setCurrentUser(res.data.user);
      setAuthError("");
    } catch (err) {
      setAuthError(err.response?.data?.error || "Signup failed.");
    }
  }, []);

  const logout = useCallback(() => {
    socketRef.current?.disconnect();
    localStorage.removeItem("rr_token");
    setToken(null);
    setCurrentUser(null);
    setIncidents([]); setTeams([]); setShelters([]); setMissing([]);
    setVolunteers([]); setComplaints([]); setDonations({ totals: { funds: 0, food: 0, medical: 0 }, records: [] });
    setLog([]);
  }, []);

  /* ---- Actions ---- */

  const reportIncident = useCallback(async (data) => {
    const res = await api.post("/incidents", data);
    showToast("Incident Reported", `${data.type} — dispatch engine running…`, "critical");
    return shortId(res.data.incident._id);
  }, [showToast]);

  const advanceMission = useCallback(async (incidentId) => {
    await api.post(`/incidents/${incidentId}/advance`);
  }, []);

  const triggerSOS = useCallback(async (location) => {
    setSosActive(true);
    const id = await reportIncident({ type: "Medical Emergency", location: location || "Current GPS Location", description: "SOS — immediate assistance requested", source: "SOS" });
    setTimeout(() => setSosActive(false), 3000);
    return id;
  }, [reportIncident]);

  const recordDonation = useCallback(async ({ amount, kind }) => {
    const res = await api.post("/donations", { amount, kind });
    setCurrentUser(u => ({ ...u, notifications: res.data.user.notifications }));
    showToast("Donation Received", "Thank you — a confirmation has been sent to your notifications.", "success");
  }, [showToast]);

  const markNotificationsRead = useCallback(async () => {
    const res = await api.patch("/auth/notifications/read");
    setCurrentUser(u => ({ ...u, notifications: res.data.user.notifications }));
  }, []);

  const toggleTeamStatus = useCallback(async (teamId, nextStatus) => {
    await api.patch(`/teams/${teamId}`, { status: nextStatus });
  }, []);

  const adjustShelter = useCallback(async (id, delta) => {
    await api.patch(`/shelters/${id}`, { delta });
  }, []);

  const reportMissing = useCallback(async (data) => {
    await api.post("/missing", data);
  }, []);

  const updateMissingStatus = useCallback(async (id, status) => {
    await api.patch(`/missing/${id}`, { status });
  }, []);

  const saveVolunteerProfile = useCallback(async (data) => {
    try {
      const res = await api.post("/volunteers/me", data);
      showToast("Profile Saved", "Your volunteer details have been updated successfully.", "success");
      return res.data.volunteer;
    } catch (err) {
      console.error(err);
      showToast("Error", "Failed to save profile.", "critical");
    }
  }, [showToast, setTab]);

  const submitFeedback = useCallback(async ({ category, text }) => {
    await api.post("/complaints", { category, text });
  }, []);

  const advanceComplaint = useCallback(async (id) => {
    const res = await api.post(`/complaints/${id}/advance`);
    setComplaints(prev => prev.map(c => c._id === id ? res.data.complaint : c));
  }, []);

  const stats = {
    active: incidents.filter(i => i.status !== "COMPLETED" && !i.status.startsWith("PENDING")).length,
    critical: incidents.filter(i => i.severity === "CRITICAL" && i.status !== "COMPLETED").length,
    deployed: teams.filter(t => t.status === "Deployed" || t.status === "Busy").length,
    shelterAvg: shelters.length ? Math.round(shelters.reduce((a, s) => a + s.occupancy / s.capacity, 0) / shelters.length * 100) : 0,
  };

  const NAV = {
    citizen: [
      { id: "home", label: "Overview", icon: Home },
      { id: "report", label: "Report Incident", icon: AlertTriangle },
      { id: "sos", label: "SOS Emergency", icon: Radio },
      { id: "missing", label: "Missing Persons", icon: UserSearch },
      { id: "relief", label: "Relief Services", icon: Stethoscope },
      { id: "donate", label: "Donate", icon: Heart },
      { id: "notifications", label: "Notifications", icon: Activity, badge: currentUser?.notifications?.filter(n => !n.read).length },
      { id: "feedback", label: "Feedback", icon: MessageSquare },
    ],
    volunteer: [
      { id: "home", label: "Overview", icon: Home },
      { id: "vol-register", label: "My Profile", icon: ClipboardList },
      { id: "vol-assignments", label: "My Tasks", icon: MapPin },
      { id: "shelters", label: "Manage Shelters", icon: Building2 },
    ],
    response: [
      { id: "home", label: "Overview", icon: Home },
      { id: "missions", label: "Active Missions", icon: Navigation },
      { id: "resources", label: "Team Status", icon: Package },
    ],
    admin: [
      { id: "home", label: "Dashboard", icon: BarChart3 },
      { id: "incidents", label: "Incident Management", icon: AlertTriangle },
      { id: "teams", label: "Team Deployment", icon: Truck },
      { id: "shelters", label: "Relief Hubs", icon: Building2 },
      { id: "missing", label: "Missing Persons", icon: UserSearch },
      { id: "donations", label: "Donations", icon: Heart },
      { id: "complaints", label: "Complaints", icon: MessageSquare },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
    ],
  };

  if (authLoading) {
    return <div style={S.app}><style>{CSS}</style><div style={S.authWrap}><div style={{ color: "#8496AE" }}>Loading…</div></div></div>;
  }

  if (!currentUser) {
    return (
      <div style={S.app}>
        <style>{CSS}</style>
        <LandingPage onLogin={login} onSignup={signup} error={authError} clearError={() => setAuthError("")} />
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{CSS}</style>
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      {sosActive && <SOSOverlay />}

      <div style={S.topbar}>
        <div style={S.brand}>
          <div style={S.brandMark}><Zap size={16} color="#0F1B2E" /></div>
          <div>
            <div style={S.brandName}>RescueRelief</div>
            <div style={S.brandSub}>Emergency Response Coordination</div>
          </div>
        </div>
        
        {/* Theme and Language Controls */}
        <div style={{ marginLeft: 20 }}>
          <GlobalSettings />
        </div>

        <div style={S.spacer} />
        <div style={S.userPill}>
          <div style={S.userAvatar}>{currentUser.name.charAt(0).toUpperCase()}</div>
          <div>
            <div style={S.userName}>{currentUser.name}</div>
            <div style={S.userRole}>{ROLE_LABEL[role]}{currentUser.teamId ? ` · ${currentUser.teamId}` : ""}</div>
          </div>
          <button style={S.logoutBtn} onClick={logout} title="Log out"><LogOut size={15} /></button>
        </div>
        <div style={S.liveBadge}><span style={S.liveDot} /> LIVE</div>
      </div>

      <div style={S.body}>
        <div style={S.sidenav}>
          {NAV[role].map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ ...S.navItem, ...(tab === n.id ? S.navItemActive : {}) }}>
              <n.icon size={17} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {!!n.badge && <span style={S.navBadge}>{n.badge}</span>}
            </button>
          ))}
          <div style={S.navSpacer} />
          <div style={S.tickerBox}>
            <div style={S.tickerHead}><Activity size={13} /> LIVE FEED</div>
            <div style={S.tickerList}>
              {log.slice(-8).reverse().map(l => (
                <div key={l.id} style={{ ...S.tickerItem, borderLeftColor: toneColor(l.tone) }}>
                  <span style={S.tickerTime}>{l.time}</span><span>{l.message}</span>
                </div>
              ))}
              {log.length === 0 && <div style={S.tickerEmpty}>No activity yet.</div>}
            </div>
          </div>
        </div>

        <div style={S.main}>
          {role === "citizen" && tab === "home" && <CitizenHome stats={stats} setTab={setTab} shelters={shelters} />}
          {role === "citizen" && tab === "report" && <ReportIncident onSubmit={reportIncident} />}
          {role === "citizen" && tab === "sos" && <SOSPanel onTrigger={triggerSOS} active={sosActive} />}
          {role === "citizen" && tab === "missing" && <MissingPersons missing={missing} editable onReport={reportMissing} />}
          {role === "citizen" && tab === "relief" && <ReliefServices shelters={shelters} />}
          {role === "citizen" && tab === "donate" && <DonatePanel onDonate={recordDonation} />}
          {role === "citizen" && tab === "notifications" && <NotificationsPanel user={currentUser} onOpen={markNotificationsRead} />}
          {role === "citizen" && tab === "feedback" && <FeedbackForm onSubmit={submitFeedback} />}

          {role === "volunteer" && tab === "home" && <VolunteerDashboardExpanded volunteers={volunteers} incidents={incidents} currentUser={currentUser} S={S} />}
          {role === "volunteer" && tab === "vol-register" && <VolunteerRegisterExpanded currentUser={currentUser} volunteers={volunteers} onSubmit={saveVolunteerProfile} S={S} />}
          {role === "volunteer" && tab === "vol-assignments" && <VolunteerDashboardExpanded volunteers={volunteers} incidents={incidents} currentUser={currentUser} S={S} />} 
          {role === "volunteer" && tab === "shelters" && <ShelterManagement shelters={shelters} onAdjust={adjustShelter} />}

          {role === "response" && tab === "home" && <ResponseHome teams={teams} incidents={incidents} currentUser={currentUser} />}
          {role === "response" && tab === "missions" && <ActiveMissions incidents={incidents} teams={teams} onAdvance={advanceMission} currentUser={currentUser} />}
          {role === "response" && tab === "resources" && <ResourceUpdates teams={teams} currentUser={currentUser} onToggle={toggleTeamStatus} />}

          {role === "admin" && tab === "home" && <AdminDashboard stats={stats} incidents={incidents} teams={teams} shelters={shelters} />}
          {role === "admin" && tab === "incidents" && <IncidentManagement incidents={incidents} teams={teams} onAdvance={advanceMission} />}
          {role === "admin" && tab === "teams" && <TeamDeployment teams={teams} onToggle={toggleTeamStatus} />}
          {role === "admin" && tab === "shelters" && <ShelterManagement shelters={shelters} onAdjust={adjustShelter} />}
          {role === "admin" && tab === "missing" && <MissingPersons missing={missing} editable={false} onUpdateStatus={updateMissingStatus} />}
          {role === "admin" && tab === "donations" && <DonationsPanel donations={donations} />}
          {role === "admin" && tab === "complaints" && <ComplaintsPanel complaints={complaints} onAdvance={advanceComplaint} />}
          {role === "admin" && tab === "analytics" && <AnalyticsPanel incidents={incidents} teams={teams} shelters={shelters} donations={donations} />}
        </div>
      </div>
      <ChatbotWidget />
    </div>
  );
}

function toneColor(tone) { return { critical: "#D64545", warn: "#E8A23D", success: "#3FA873", info: "#5B7290" }[tone] || "#5B7290"; }

function GlobalSettings() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#111E30', padding: '8px 16px', borderRadius: 8, border: '1px solid #1D2A3D' }}>
      <select style={{ ...S.input, padding: '4px 8px', fontSize: 11 }} onChange={(e) => document.documentElement.setAttribute('data-theme', e.target.value)}>
        <option value="dark">Dark Theme</option>
        <option value="light">Light Theme</option>
        <option value="darkblue">Dark Blue Theme</option>
      </select>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8496AE', fontSize: 11 }}>
        Text Color: 
        <input type="color" defaultValue="#E7ECF3" onChange={(e) => document.documentElement.style.setProperty('--text-color', e.target.value)} style={{ padding: 0, border: 'none', background: 'none', width: 20, height: 20, cursor: 'pointer' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8496AE', fontSize: 11 }}>
        Btn Color: 
        <input type="color" defaultValue="#3FA873" onChange={(e) => document.documentElement.style.setProperty('--btn-color', e.target.value)} style={{ padding: 0, border: 'none', background: 'none', width: 20, height: 20, cursor: 'pointer' }} />
      </div>
      <select style={{ ...S.input, padding: '4px 8px', fontSize: 11 }} onChange={(e) => {
        document.cookie = `googtrans=/en/${e.target.value}`;
        window.location.reload();
      }}>
        <option value="en">English</option>
        <option value="hi">Hindi (हिन्दी)</option>
        <option value="bn">Bengali (বাংলা)</option>
        <option value="te">Telugu (తెలుగు)</option>
        <option value="mr">Marathi (मराठी)</option>
        <option value="ta">Tamil (தமிழ்)</option>
        <option value="gu">Gujarati (ગુજરાતી)</option>
      </select>
    </div>
  );
}

function LandingPage({ onLogin, onSignup, error, clearError }) {
  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signupRole, setSignupRole] = useState("citizen");
  const [phone, setPhone] = useState("");

  const [stats, setStats] = useState(null);
  const [liveUpdates, setLiveUpdates] = useState([]);

  const submitLogin = (e) => { e.preventDefault(); onLogin(username, password); };
  const submitSignup = (e) => { e.preventDefault(); onSignup({ name, username, password, role: signupRole, phone }); };
  const switchMode = (m) => { setMode(m); clearError(); setUsername(""); setPassword(""); setName(""); setPhone(""); };

  useEffect(() => {
    api.get("/public/stats").then(res => setStats(res.data)).catch(()=>{});
    const socket = createSocket(null);
    socket.on("log", (l) => setLiveUpdates(prev => [l, ...prev].slice(0, 20)));
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (showAuth && mode === "login" && window.google) {
      window.google.accounts.id.initialize({
        client_id: "336658980922-tlhiqp8i93fvkshjqbn3evipsafhapoe.apps.googleusercontent.com",
        callback: async (response) => {
          try {
            const res = await api.post("/auth/google", { token: response.credential });
            localStorage.setItem("rr_token", res.data.token);
            window.location.reload();
          } catch(err) {
            console.error("Google Auth Error", err);
          }
        }
      });
      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-btn"),
        { theme: "outline", size: "large", type: "standard", width: "100%" }
      );
    }
  }, [showAuth, mode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0B1420' }}>
      {/* Top Navbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 30px', background: '#0F1B2E', borderBottom: '1px solid #1D2A3D' }}>
        <div style={S.brand}>
          <div style={S.brandMark}><Zap size={18} color="#0F1B2E" /></div>
          <div>
            <div style={{ ...S.brandName, fontSize: 19 }}>RescueRelief</div>
            <div style={S.brandSub}>Emergency Response Coordination</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <GlobalSettings />
          {!showAuth && (
            <button style={S.primaryBtn} onClick={() => setShowAuth(true)}>Login / Register</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: '40px', display: 'flex', justifyContent: 'center' }}>
        {showAuth ? (
          <div style={{ width: '100%', maxWidth: 420 }}>
            <button style={{...S.secondaryBtn, marginBottom: 20}} onClick={() => setShowAuth(false)}>← Back to Dashboard</button>

            <div style={S.authCard}>
              <div style={S.authBrand}>
                <div style={S.brandMark}><Zap size={18} color="#0F1B2E" /></div>
                <div>
                  <div style={{ ...S.brandName, fontSize: 19 }}>RescueRelief</div>
                  <div style={S.brandSub}>Emergency Response Coordination</div>
                </div>
              </div>
              <div style={S.authTabs}>
                <button style={{ ...S.authTab, ...(mode === "login" ? S.authTabActive : {}) }} onClick={() => switchMode("login")}>Log in</button>
                <button style={{ ...S.authTab, ...(mode === "signup" ? S.authTabActive : {}) }} onClick={() => switchMode("signup")}>Sign up</button>
              </div>
              {mode === "login" ? (
                <form onSubmit={submitLogin} style={S.form}>
                  <div id="google-signin-btn" style={{ marginBottom: 12 }}></div>
                  <div style={{ textAlign: "center", fontSize: 11, color: "#8496AE", marginBottom: 12 }}>OR</div>
                  <label style={S.label}>Username</label>
                  <div style={S.inputIcon}><UserIcon size={14} /><input style={S.inputBare} value={username} onChange={e => setUsername(e.target.value)} required /></div>
                  <label style={S.label}>Password</label>
                  <div style={S.inputIcon}><Lock size={14} /><input style={S.inputBare} type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
                  {error && <div style={S.authError}>{error}</div>}
                  <button type="submit" style={S.primaryBtn}>Log in</button>
                </form>
              ) : (
                <form onSubmit={submitSignup} style={S.form}>
                  <label style={S.label}>Full name</label>
                  <input style={S.input} value={name} onChange={e => setName(e.target.value)} required />
                  <label style={S.label}>Choose a username</label>
                  <input style={S.input} value={username} onChange={e => setUsername(e.target.value)} required />
                  <label style={S.label}>Choose a password</label>
                  <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                  <label style={S.label}>Phone Number (for SMS)</label>
                  <input style={S.input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+1234567890" />
                  <label style={S.label}>I am signing up as a</label>
                  <select style={S.input} value={signupRole} onChange={e => setSignupRole(e.target.value)}>
                    <option value="citizen">Citizen (report incidents, donate, get help)</option>
                    <option value="volunteer">Volunteer (offer to help on the ground)</option>
                  </select>
                  {error && <div style={S.authError}>{error}</div>}
                  <button type="submit" style={S.primaryBtn}><UserPlus size={15} /> Create account</button>
                </form>
              )}
              <div style={S.authHint}>
                <strong>Demo accounts</strong> (run <code>npm run seed</code> in backend first):
                <div style={S.authHintRow}>admin / admin123 <span>Command Admin</span></div>
                <div style={S.authHintRow}>alpha6 / team123 <span>Response — Alpha-6</span></div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 1000, background: "#111E30", border: "1px solid #1D2A3D", borderRadius: 16, padding: 36, display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h2 style={{margin: 0, color: "var(--text-color, #E7ECF3)", fontSize: 28, fontFamily: "'Space Grotesk', sans-serif"}}>Live Public Dashboard</h2>
              <p style={{margin: 0, color: "#8496AE", fontSize: 14, marginTop: 4}}>Monitor ongoing rescue operations and resource availability in real-time before you log in.</p>
            </div>
            
            {stats && (
              <div style={S.grid4}>
                <div style={S.statCard}><div style={{...S.statIcon, background: "#D6454522", color: "#D64545"}}><AlertTriangle size={20}/></div><div><div style={S.statValue}>{stats.activeIncidents}</div><div style={S.statLabel}>Active Incidents</div></div></div>
                <div style={S.statCard}><div style={{...S.statIcon, background: "#E8A23D22", color: "#E8A23D"}}><Truck size={20}/></div><div><div style={S.statValue}>{stats.teamsDeployed}</div><div style={S.statLabel}>Teams Deployed</div></div></div>
                <div style={S.statCard}><div style={{...S.statIcon, background: "#3FA87322", color: "#3FA873"}}><Users size={20}/></div><div><div style={S.statValue}>{stats.totalVolunteers}</div><div style={S.statLabel}>Active Volunteers</div></div></div>
                <div style={S.statCard}><div style={{...S.statIcon, background: "#D6486B22", color: "#D6486B"}}><Heart size={20}/></div><div><div style={S.statValue}>₹{stats.totalDonations.toLocaleString('en-IN')}</div><div style={S.statLabel}>Funds Raised</div></div></div>
              </div>
            )}

            <div style={{ flex: 1, ...S.tickerBox, maxHeight: 400 }}>
              <div style={S.tickerHead}><Activity size={14} /> LIVE DISPATCH UPDATES</div>
              <div style={S.tickerList}>
                {liveUpdates.length === 0 && <div style={S.tickerEmpty}>Waiting for live dispatch events...</div>}
                {liveUpdates.map((l, i) => (
                  <div key={i} style={{ ...S.tickerItem, borderLeftColor: toneColor(l.tone), color: "var(--text-color, #B7C1D1)" }}>
                    <span style={S.tickerTime}>{l.time || new Date().toLocaleTimeString()}</span> {l.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Shared bits ---------------- */

function SeverityBadge({ level }) {
  const map = { CRITICAL: { bg: "#3A1518", fg: "#FF7A7A" }, HIGH: { bg: "#3A2A12", fg: "#F0AE55" }, MEDIUM: { bg: "#123A2C", fg: "#5CD6A0" } };
  const c = map[level] || map.MEDIUM;
  return <span style={{ ...S.badge, background: c.bg, color: c.fg }}>{level}</span>;
}

function StatusPill({ status }) {
  let color = "#8A96A8";
  if (status === "Available") color = "#3FA873";
  else if (status === "Deployed" || status === "Busy") color = "#E8A23D";
  else if (status.includes("PENDING")) color = "#D64545";
  else if (status === "COMPLETED") color = "#3FA873";
  return <span style={{ ...S.pill, borderColor: color, color }}>{status}</span>;
}

function Toast({ toast, onClose }) {
  const c = { critical: "#D64545", warn: "#E8A23D", success: "#3FA873", info: "#5B7290" }[toast.tone];
  return (
    <div style={{ ...S.toast, borderLeftColor: c }}>
      <div style={{ flex: 1 }}><div style={S.toastTitle}>{toast.title}</div><div style={S.toastBody}>{toast.body}</div></div>
      <button onClick={onClose} style={S.toastClose}><X size={14} /></button>
    </div>
  );
}

function SOSOverlay() {
  return <div style={S.sosOverlay}><div style={S.sosPulse} /><div style={S.sosText}>SOS SIGNAL SENT — LOCATING NEAREST TEAM…</div></div>;
}

function Section({ title, subtitle, children, action }) {
  return (
    <div style={S.section}>
      <div style={S.sectionHead}>
        <div><h2 style={S.sectionTitle}>{title}</h2>{subtitle && <p style={S.sectionSub}>{subtitle}</p>}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div style={S.statCard}>
      <div style={{ ...S.statIcon, background: accent + "22", color: accent }}><Icon size={18} /></div>
      <div><div style={S.statValue}>{value}</div><div style={S.statLabel}>{label}</div></div>
    </div>
  );
}

/* ---------------- Citizen views ---------------- */

function CitizenHome({ stats, setTab, shelters }) {
  return (
    <>
      <Section title="Welcome" subtitle="Report emergencies, track relief efforts, and stay informed.">
        <div style={S.grid4}>
          <StatCard label="Active Incidents" value={stats.active} icon={AlertTriangle} accent="#D64545" />
          <StatCard label="Critical Right Now" value={stats.critical} icon={Zap} accent="#E8A23D" />
          <StatCard label="Teams Deployed" value={stats.deployed} icon={Truck} accent="#5B7290" />
          <StatCard label="Avg Shelter Load" value={stats.shelterAvg + "%"} icon={Building2} accent="#3FA873" />
        </div>
      </Section>
      <Section title="Quick actions">
        <div style={S.actionRow}>
          <button style={{ ...S.bigAction, background: "#D64545" }} onClick={() => setTab("sos")}><Radio size={20} /> Trigger SOS</button>
          <button style={{ ...S.bigAction, background: "#E8A23D" }} onClick={() => setTab("report")}><AlertTriangle size={20} /> Report an Incident</button>
          <button style={{ ...S.bigAction, background: "#3E7CB1" }} onClick={() => setTab("relief")}><Stethoscope size={20} /> Find Relief Services</button>
          <button style={{ ...S.bigAction, background: "#D6486B" }} onClick={() => setTab("donate")}><Heart size={20} /> Donate</button>
        </div>
      </Section>
      <Section title="Shelters near you">
        <div style={S.grid3}>
          {shelters.map(s => (
            <div key={s._id} style={S.card}>
              <div style={S.cardTitleRow}><Building2 size={16} /><strong>{s.name}</strong></div>
              <div style={S.cardMeta}><MapPin size={13} /> {s.location}</div>
              <OccupancyBar occupancy={s.occupancy} capacity={s.capacity} />
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function OccupancyBar({ occupancy, capacity }) {
  const pct = Math.min(100, Math.round((occupancy / capacity) * 100));
  const color = pct >= 95 ? "#D64545" : pct >= 70 ? "#E8A23D" : "#3FA873";
  return (
    <div>
      <div style={S.barTrack}><div style={{ ...S.barFill, width: pct + "%", background: color }} /></div>
      <div style={S.barLabel}>{occupancy}/{capacity} occupied {pct >= 95 && "— FULL"}</div>
    </div>
  );
}

function ReportIncident({ onSubmit }) {
  const [type, setType] = useState("Flood");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [affected, setAffected] = useState("");
  const [submitted, setSubmitted] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!location.trim()) return;
    const id = await onSubmit({ type, location, description, affected: affected || "Unknown" });
    setSubmitted(id);
    setLocation(""); setDescription(""); setAffected("");
  };

  if (submitted) {
    return (
      <Section title="Incident submitted">
        <div style={S.confirmBox}>
          <CheckCircle2 size={32} color="#3FA873" />
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Reference: {submitted}</div>
            <p style={S.sectionSub}>The dispatch engine is classifying your report and matching the nearest available team. Watch the live feed on the left.</p>
          </div>
        </div>
        <button style={S.primaryBtn} onClick={() => setSubmitted(null)}>Report another incident</button>
      </Section>
    );
  }

  return (
    <Section title="Report an incident" subtitle="Your report is routed automatically to the right response teams.">
      <form onSubmit={submit} style={S.form}>
        <label style={S.label}>Disaster type</label>
        <select style={S.input} value={type} onChange={e => setType(e.target.value)}>
          {DISASTER_TYPES.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <div style={S.ruleHint}>
          <SeverityBadge level={SEVERITY_HINT[type]} />
          <span>Will notify: {DISASTER_TEAM_HINT[type]}</span>
        </div>
        <label style={S.label}>Location</label>
        <input style={S.input} placeholder="e.g. Riverside Area, Sector 7B" value={location} onChange={e => setLocation(e.target.value)} required />
        <label style={S.label}>Approx. people affected</label>
        <input style={S.input} placeholder="e.g. 12" value={affected} onChange={e => setAffected(e.target.value)} />
        <label style={S.label}>Description</label>
        <textarea style={{ ...S.input, minHeight: 90 }} placeholder="Describe what's happening…" value={description} onChange={e => setDescription(e.target.value)} />
        <button type="submit" style={S.primaryBtn}><AlertTriangle size={15} /> Submit report</button>
      </form>
    </Section>
  );
}

function SOSPanel({ onTrigger, active }) {
  const [sent, setSent] = useState(false);
  return (
    <Section title="SOS Emergency" subtitle="For immediate, life-threatening emergencies only.">
      <div style={S.sosCard}>
        <button disabled={active} style={{ ...S.sosButton, opacity: active ? 0.6 : 1 }}
          onClick={async () => { await onTrigger("Live GPS — 9.9252° N, 78.1198° E"); setSent(true); }}>
          <Radio size={40} /><span>{active ? "SENDING…" : "PRESS FOR SOS"}</span>
        </button>
        <p style={S.sectionSub}>Pressing this captures your location and immediately alerts the nearest response team and Command Center.</p>
        {sent && !active && (
          <div style={S.confirmBox}><CheckCircle2 size={24} color="#3FA873" /><div>Your SOS was sent. A team has been dispatched — check the live feed for updates.</div></div>
        )}
      </div>
    </Section>
  );
}

function ReliefServices({ shelters }) {
  return (
    <>
      <Section title="Shelters">
        <div style={S.grid3}>
          {shelters.map(s => (
            <div key={s._id} style={S.card}>
              <div style={S.cardTitleRow}><Building2 size={16} /><strong>{s.name}</strong></div>
              <div style={S.cardMeta}><MapPin size={13} /> {s.location}</div>
              <OccupancyBar occupancy={s.occupancy} capacity={s.capacity} />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Medical services">
        <div style={S.grid3}>
          <div style={S.card}><Stethoscope size={16} /> <strong>Sector 2 Medical Camp</strong><div style={S.cardMeta}>6 doctors on site · Open 24/7</div></div>
          <div style={S.card}><Truck size={16} /> <strong>Ambulance Pool — North</strong><div style={S.cardMeta}>3 of 5 available</div></div>
        </div>
      </Section>
      <Section title="Food & hydration">
        <div style={S.grid3}>
          <div style={S.card}><Droplet size={16} /> <strong>Riverside Water Point</strong><div style={S.cardMeta}>Operational</div></div>
          <div style={S.card}><Package size={16} /> <strong>North Hub Food Distribution</strong><div style={S.cardMeta}>Serving until 8 PM</div></div>
        </div>
      </Section>
    </>
  );
}

function DonatePanel({ onDonate }) {
  const [kind, setKind] = useState("funds");
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!amount) return;
    await onDonate({ amount, kind });
    setAmount(""); setDone(true);
    setTimeout(() => setDone(false), 4000);
  };
  const unit = kind === "funds" ? "₹" : kind === "food" ? "kg" : "kits";
  return (
    <Section title="Donate" subtitle="Every contribution is logged and reflected in Command Center's live totals.">
      <form onSubmit={submit} style={S.form}>
        <label style={S.label}>Donation type</label>
        <select style={S.input} value={kind} onChange={e => setKind(e.target.value)}>
          <option value="funds">Funds (₹)</option><option value="food">Food supplies (kg)</option><option value="medical">Medical kits (units)</option>
        </select>
        <label style={S.label}>Amount ({unit})</label>
        <input style={S.input} value={amount} onChange={e => setAmount(e.target.value)} placeholder={kind === "funds" ? "e.g. 1000" : "e.g. 20"} required />
        <button type="submit" style={{ ...S.primaryBtn, background: "#D6486B" }}><Heart size={15} /> Donate</button>
        {done && <div style={S.confirmBox}><CheckCircle2 size={20} color="#3FA873" /><div>Thank you! A confirmation has been sent to your Notifications tab.</div></div>}
      </form>
    </Section>
  );
}

function NotificationsPanel({ user, onOpen }) {
  useEffect(() => { onOpen(); }, []); // eslint-disable-line
  return (
    <Section title="Notifications">
      {(!user.notifications || user.notifications.length === 0) && <div style={S.emptyState}>No notifications yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {user.notifications?.map(n => (
          <div key={n._id || n.id} style={S.card}>
            <div style={S.cardMeta}><Clock size={12} /> {new Date(n.time).toLocaleString("en-IN")}</div>
            <div style={{ fontSize: 13.5 }}>{n.text}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function MissingPersons({ missing, editable, onReport, onUpdateStatus }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(""); const [age, setAge] = useState(""); const [gender, setGender] = useState("Male");
  const [lastSeen, setLastSeen] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !lastSeen.trim()) return;
    await onReport({ name, age, gender, lastSeen });
    setName(""); setAge(""); setLastSeen(""); setShowForm(false);
  };

  return (
    <Section title="Missing persons" action={editable && (
      <button style={S.secondaryBtn} onClick={() => setShowForm(s => !s)}><Plus size={14} /> Report missing person</button>
    )}>
      {showForm && (
        <form onSubmit={submit} style={{ ...S.form, marginBottom: 20 }}>
          <label style={S.label}>Full name</label>
          <input style={S.input} value={name} onChange={e => setName(e.target.value)} required />
          <div style={S.formRow}>
            <div style={{ flex: 1 }}><label style={S.label}>Age</label><input style={S.input} value={age} onChange={e => setAge(e.target.value)} /></div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Gender</label>
              <select style={S.input} value={gender} onChange={e => setGender(e.target.value)}><option>Male</option><option>Female</option><option>Other</option></select>
            </div>
          </div>
          <label style={S.label}>Last seen location</label>
          <input style={S.input} value={lastSeen} onChange={e => setLastSeen(e.target.value)} required />
          <button type="submit" style={S.primaryBtn}>Submit</button>
        </form>
      )}
      <div style={S.grid3}>
        {missing.map(m => (
          <div key={m._id} style={S.card}>
            <div style={S.cardTitleRow}><span style={{ fontSize: 22 }}>{m.photo}</span><strong>{m.name}</strong></div>
            <div style={S.cardMeta}>{m.age} yrs · {m.gender}</div>
            <div style={S.cardMeta}><MapPin size={13} /> Last seen: {m.lastSeen}</div>
            <div style={{ marginTop: 8 }}><StatusPill status={m.status} /></div>
            {!editable && onUpdateStatus && (
              <select style={{ ...S.input, marginTop: 8 }} value={m.status} onChange={e => onUpdateStatus(m._id, e.target.value)}>
                <option>Missing</option><option>Found/Safe</option><option>Identified</option>
              </select>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function FeedbackForm({ onSubmit }) {
  const [category, setCategory] = useState("Infrastructure");
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onSubmit({ category, text });
    setText(""); setDone(true);
    setTimeout(() => setDone(false), 3000);
  };
  return (
    <Section title="Complaints & feedback">
      <form onSubmit={submit} style={S.form}>
        <label style={S.label}>Category</label>
        <select style={S.input} value={category} onChange={e => setCategory(e.target.value)}>
          <option>Infrastructure</option><option>Personnel Conduct</option><option>Medical Issues</option><option>Logistics</option><option>Other</option>
        </select>
        <label style={S.label}>Details</label>
        <textarea style={{ ...S.input, minHeight: 90 }} value={text} onChange={e => setText(e.target.value)} required />
        <button style={S.primaryBtn} type="submit">Submit feedback</button>
        {done && <div style={S.confirmBox}><CheckCircle2 size={20} color="#3FA873" /> Thanks — your feedback was logged.</div>}
      </form>
    </Section>
  );
}

/* ---------------- Volunteer views ---------------- */

function VolunteerHome({ volunteers, setTab }) {
  return (
    <>
      <Section title="Volunteer network" subtitle={`${volunteers.length} registered · ${volunteers.filter(v => v.status === "Available").length} available now`}>
        <div style={S.actionRow}>
          <button style={{ ...S.bigAction, background: "#6B5CD6" }} onClick={() => setTab("vol-register")}><ClipboardList size={18} /> My profile</button>
          <button style={{ ...S.bigAction, background: "#3E7CB1" }} onClick={() => setTab("vol-assignments")}><MapPin size={18} /> View assignments</button>
        </div>
      </Section>
      <Section title="Active volunteers">
        <Table cols={["Name", "Skill", "Location", "Status"]} rows={volunteers.map(v => [v.name, v.skill, v.location, <StatusPill status={v.status} />])} />
      </Section>
    </>
  );
}

function VolunteerRegister({ currentUser, volunteers, onSubmit }) {
  const existing = volunteers.find(v => v.name === currentUser.name);
  const [skill, setSkill] = useState(existing?.skill || "First Aid");
  const [location, setLocation] = useState(existing?.location || "");
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    await onSubmit({ skill, location });
    setDone(true); setTimeout(() => setDone(false), 3000);
  };
  return (
    <Section title="Volunteer profile">
      <form onSubmit={submit} style={S.form}>
        <label style={S.label}>Name</label>
        <input style={S.input} value={currentUser.name} disabled />
        <label style={S.label}>Primary skill</label>
        <select style={S.input} value={skill} onChange={e => setSkill(e.target.value)}>
          <option>First Aid</option><option>Search & Rescue Support</option><option>Logistics</option><option>Counselling</option><option>Cooking / Food Service</option>
        </select>
        <label style={S.label}>Preferred location</label>
        <input style={S.input} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Sector 4" />
        <button style={S.primaryBtn} type="submit">Save profile</button>
        {done && <div style={S.confirmBox}><CheckCircle2 size={20} color="#3FA873" /> Saved. Safety briefing will be sent to your assignment.</div>}
      </form>
    </Section>
  );
}

function VolunteerAssignments({ volunteers, incidents }) {
  const active = incidents.filter(i => i.status !== "COMPLETED");
  return (
    <Section title="Assignments" subtitle="Live incidents that may need volunteer support">
      {active.length === 0 && <div style={S.emptyState}>No active deployments right now.</div>}
      <div style={S.grid3}>
        {active.map(i => (
          <div key={i._id} style={S.card}>
            <div style={S.cardTitleRow}><AlertTriangle size={16} color={DISASTER_COLOR[i.type]} /><strong>{i.type}</strong></div>
            <div style={S.cardMeta}><MapPin size={13} /> {i.location}</div>
            <StatusPill status={i.status} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <Table cols={["Volunteer", "Skill", "Status"]} rows={volunteers.map(v => [v.name, v.skill, <StatusPill status={v.status} />])} />
      </div>
    </Section>
  );
}

/* ---------------- Response team views ---------------- */

function ResponseHome({ teams, incidents, currentUser }) {
  const myTeam = teams.find(t => t.teamId === currentUser.teamId);
  const mine = incidents.filter(i => i.assignedTeam === currentUser.teamId && i.status !== "COMPLETED");
  return (
    <>
      <Section title={`Welcome, ${currentUser.name}`} subtitle={myTeam ? `${myTeam.spec} · ${myTeam.sector} · ${myTeam.personnel} personnel` : ""}>
        <div style={S.grid4}>
          <StatCard label="My Team Status" value={myTeam?.status || "—"} icon={CheckCircle2} accent="#3FA873" />
          <StatCard label="Active Missions" value={mine.length} icon={Navigation} accent="#D64545" />
          <StatCard label="Personnel" value={myTeam?.personnel || 0} icon={Users} accent="#5B7290" />
          <StatCard label="Specialization" value={myTeam?.spec || "—"} icon={Shield} accent="#3E7CB1" />
        </div>
      </Section>
      <Section title="My active missions">
        {mine.length === 0 && <div style={S.emptyState}>No missions assigned to your team right now.</div>}
        <Table cols={["Incident", "Location", "Severity", "Status"]} rows={mine.map(i => [i.type, i.location, <SeverityBadge level={i.severity} />, <StatusPill status={i.status} />])} />
      </Section>
    </>
  );
}

function ActiveMissions({ incidents, teams, onAdvance, currentUser }) {
  const mine = incidents.filter(i => i.assignedTeam === currentUser.teamId);
  return (
    <Section title="Active missions" subtitle="Update mission status as your team progresses">
      {mine.length === 0 && <div style={S.emptyState}>No missions assigned to your team yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {mine.map(i => {
          const team = teams.find(t => t.teamId === i.assignedTeam);
          return (
            <div key={i._id} style={S.missionCard}>
              <div style={S.missionHead}>
                <div>
                  <div style={S.cardTitleRow}><AlertTriangle size={16} color={DISASTER_COLOR[i.type]} /><strong>{i.type}</strong> <SeverityBadge level={i.severity} /></div>
                  <div style={S.cardMeta}><MapPin size={13} /> {i.location} · Team: {team?.name || "—"}</div>
                </div>
                {i.status !== "COMPLETED" && !i.status.startsWith("PENDING") && (
                  <button style={S.primaryBtn} onClick={() => onAdvance(i._id)}>Advance status <ArrowRight size={14} /></button>
                )}
              </div>
              <MissionTimeline step={i.missionStep} />
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function MissionTimeline({ step }) {
  return (
    <div style={S.timeline}>
      {MISSION_STEPS.map((s, idx) => (
        <React.Fragment key={s}>
          <div style={{ ...S.timelineDot, background: idx <= step ? "#3FA873" : "#26344A", color: idx <= step ? "#0F1B2E" : "#5B7290" }}>
            {idx <= step ? <CheckCircle2 size={12} /> : idx + 1}
          </div>
          {idx < MISSION_STEPS.length - 1 && <div style={{ ...S.timelineBar, background: idx < step ? "#3FA873" : "#26344A" }} />}
        </React.Fragment>
      ))}
      <div style={S.timelineLabels}>{MISSION_STEPS.map(s => <span key={s} style={S.timelineLabel}>{s}</span>)}</div>
    </div>
  );
}

function ResourceUpdates({ teams, currentUser, onToggle }) {
  const myTeam = teams.find(t => t.teamId === currentUser.teamId);
  if (!myTeam) return <Section title="Team status"><div style={S.emptyState}>No team on file for this account.</div></Section>;
  return (
    <Section title="My team status">
      <div style={{ ...S.card, maxWidth: 340 }}>
        <div style={S.cardTitleRow}><Truck size={16} /><strong>{myTeam.name}</strong></div>
        <div style={S.cardMeta}>{myTeam.spec} · {myTeam.sector} · {myTeam.personnel} personnel</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <StatusPill status={myTeam.status} />
          <button style={S.secondaryBtn} onClick={() => onToggle(myTeam.teamId, myTeam.status === "Available" ? "Busy" : "Available")}>Toggle availability</button>
        </div>
      </div>
    </Section>
  );
}

/* ---------------- Admin / Command Center ---------------- */

function AdminDashboard({ stats, incidents, teams, shelters }) {
  return (
    <>
      <Section title="Command center" subtitle="Real-time overview of all operations">
        <div style={S.grid4}>
          <StatCard label="Active Incidents" value={stats.active} icon={AlertTriangle} accent="#D64545" />
          <StatCard label="Critical Alerts" value={stats.critical} icon={Zap} accent="#E8A23D" />
          <StatCard label="Teams Deployed" value={stats.deployed} icon={Truck} accent="#5B7290" />
          <StatCard label="Avg Shelter Load" value={stats.shelterAvg + "%"} icon={Building2} accent="#3FA873" />
        </div>
      </Section>
      <Section title="Recent incidents">
        {incidents.length === 0 && <div style={S.emptyState}>No incidents reported yet. Log in as a Citizen to file a report.</div>}
        <Table cols={["ID", "Type", "Location", "Severity", "Team", "Status"]}
          rows={incidents.slice(0, 6).map(i => [shortId(i._id), i.type, i.location, <SeverityBadge level={i.severity} />, teams.find(t => t.teamId === i.assignedTeam)?.name || "—", <StatusPill status={i.status} />])} />
      </Section>
      <Section title="Team status">
        <Table cols={["Team", "Specialization", "Sector", "Status"]} rows={teams.map(t => [t.name, t.spec, t.sector, <StatusPill status={t.status} />])} />
      </Section>
    </>
  );
}

function IncidentManagement({ incidents, teams, onAdvance }) {
  return (
    <Section title="Incident management" subtitle="Full log of reported incidents and their dispatch outcome">
      {incidents.length === 0 && <div style={S.emptyState}>No incidents yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {incidents.map(i => (
          <div key={i._id} style={S.incidentRow}>
            <div style={{ width: 6, alignSelf: "stretch", background: DISASTER_COLOR[i.type] || "#8A96A8", borderRadius: 3 }} />
            <div style={{ flex: 1 }}>
              <div style={S.cardTitleRow}><strong>{i.type}</strong> <SeverityBadge level={i.severity} /> <span style={S.idTag}>{shortId(i._id)}</span></div>
              <div style={S.cardMeta}><MapPin size={13} /> {i.location} · Reported by {i.reportedByName}</div>
              {i.description && <div style={S.cardDesc}>{i.description}</div>}
            </div>
            <div style={{ textAlign: "right", minWidth: 160 }}>
              <div style={{ marginBottom: 6 }}><StatusPill status={i.status} /></div>
              <div style={S.cardMeta}>{teams.find(t => t.teamId === i.assignedTeam)?.name || "Awaiting assignment"}</div>
              {i.assignedTeam && i.status !== "COMPLETED" && !i.status.startsWith("PENDING") && (
                <button style={{ ...S.secondaryBtn, marginTop: 6 }} onClick={() => onAdvance(i._id)}>Advance <ArrowRight size={12} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TeamDeployment({ teams, onToggle }) {
  const cycle = (team) => {
    const order = ["Available", "Busy", "Deployed"];
    const next = order[(order.indexOf(team.status) + 1) % order.length];
    onToggle(team.teamId, next);
  };
  return (
    <Section title="Team deployment" subtitle="Click a status pill to manually override">
      <Table cols={["Team", "Specialization", "Sector", "Personnel", "Status"]}
        rows={teams.map(t => [t.name, t.spec, t.sector, t.personnel, <button style={S.pillBtn} onClick={() => cycle(t)}><StatusPill status={t.status} /></button>])} />
    </Section>
  );
}

function ShelterManagement({ shelters, onAdjust }) {
  return (
    <Section title="Relief hubs & shelters">
      <div style={S.grid3}>
        {shelters.map(s => (
          <div key={s._id} style={S.card}>
            <div style={S.cardTitleRow}><Building2 size={16} /><strong>{s.name}</strong></div>
            <div style={S.cardMeta}><MapPin size={13} /> {s.location}</div>
            <OccupancyBar occupancy={s.occupancy} capacity={s.capacity} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={S.secondaryBtn} onClick={() => onAdjust(s._id, -5)}>-5 occupants</button>
              <button style={S.secondaryBtn} onClick={() => onAdjust(s._id, 5)}>+5 occupants</button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function DonationsPanel({ donations }) {
  return (
    <>
      <Section title="Donations">
        <div style={S.grid3}>
          <StatCard label="Funds Raised" value={"₹" + donations.totals.funds.toLocaleString("en-IN")} icon={Heart} accent="#D6486B" />
          <StatCard label="Food Supplies (kg)" value={donations.totals.food.toLocaleString()} icon={Package} accent="#E8A23D" />
          <StatCard label="Medical Kits" value={donations.totals.medical} icon={Stethoscope} accent="#3E7CB1" />
        </div>
      </Section>
      <Section title="Recent donations" subtitle="Logged live as citizens donate">
        {donations.records.length === 0 && <div style={S.emptyState}>No donations recorded yet.</div>}
        <Table cols={["Donor", "Type", "Amount", "Time"]}
          rows={donations.records.map(d => [d.donorName, d.kind, d.kind === "funds" ? "₹" + d.amount.toLocaleString("en-IN") : d.amount, new Date(d.createdAt).toLocaleTimeString("en-IN")])} />
      </Section>
    </>
  );
}

function ComplaintsPanel({ complaints, onAdvance }) {
  return (
    <Section title="Complaints & feedback">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {complaints.map(c => (
          <div key={c._id} style={S.incidentRow}>
            <div style={{ flex: 1 }}><div style={S.cardTitleRow}><strong>{c.category}</strong></div><div style={S.cardMeta}>{c.text}</div></div>
            <div style={{ textAlign: "right" }}>
              <StatusPill status={c.status} />
              {c.status !== "Resolved" && <div><button style={{ ...S.secondaryBtn, marginTop: 6 }} onClick={() => onAdvance(c._id)}>Advance</button></div>}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AnalyticsPanel({ incidents, teams, shelters, donations }) {
  const byType = {};
  incidents.forEach(i => { byType[i.type] = (byType[i.type] || 0) + 1; });
  const maxCount = Math.max(1, ...Object.values(byType));
  return (
    <>
      <Section title="Analytics & reports">
        <div style={S.grid4}>
          <StatCard label="Total Incidents" value={incidents.length} icon={AlertTriangle} accent="#D64545" />
          <StatCard label="Resolved" value={incidents.filter(i => i.status === "COMPLETED").length} icon={CheckCircle2} accent="#3FA873" />
          <StatCard label="Teams Active" value={teams.filter(t => t.status !== "Available").length} icon={Truck} accent="#E8A23D" />
          <StatCard label="Funds Deployed" value={"₹" + donations.totals.funds.toLocaleString("en-IN")} icon={Heart} accent="#D6486B" />
        </div>
      </Section>
      <Section title="Incident category distribution">
        {Object.keys(byType).length === 0 && <div style={S.emptyState}>Report incidents to populate this chart.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(byType).map(([type, count]) => (
            <div key={type} style={S.barRow}>
              <span style={S.barRowLabel}>{type}</span>
              <div style={S.barTrack}><div style={{ ...S.barFill, width: (count / maxCount) * 100 + "%", background: DISASTER_COLOR[type] || "#8A96A8" }} /></div>
              <span style={S.barRowCount}>{count}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Shelter occupancy">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shelters.map(s => (<div key={s._id}><div style={S.cardMeta}>{s.name}</div><OccupancyBar occupancy={s.occupancy} capacity={s.capacity} /></div>))}
        </div>
      </Section>
    </>
  );
}

function Table({ cols, rows }) {
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead><tr>{cols.map(c => <th key={c} style={S.th}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (<tr key={i} style={S.tr}>{r.map((cell, j) => <td key={j} style={S.td}>{cell}</td>)}</tr>))}</tbody>
      </table>
    </div>
  );
}

/* ---------------- Styles ---------------- */

const S = {
  app: { minHeight: "100vh", background: "#0B1420", color: "var(--text-color, #E7ECF3)", fontFamily: "Inter, system-ui, sans-serif", display: "flex", flexDirection: "column" },
  topbar: { display: "flex", alignItems: "center", gap: 16, padding: "12px 20px", borderBottom: "1px solid #1D2A3D", background: "#0F1B2E", flexWrap: "wrap" },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  brandMark: { width: 30, height: 30, borderRadius: 8, background: "#3FA873", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  brandName: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, lineHeight: 1.1 },
  brandSub: { fontSize: 11, color: "#7C8AA0" },
  spacer: { flex: 1 },
  userPill: { display: "flex", alignItems: "center", gap: 9, background: "#141F32", border: "1px solid #22314A", borderRadius: 30, padding: "5px 8px 5px 6px" },
  userAvatar: { width: 26, height: 26, borderRadius: "50%", background: "#3E7CB1", color: "#0B1420", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 },
  userName: { fontSize: 12.5, fontWeight: 600, lineHeight: 1.15 },
  userRole: { fontSize: 10.5, color: "#7C8AA0" },
  logoutBtn: { background: "none", border: "none", color: "#8496AE", cursor: "pointer", padding: 4, display: "flex" },
  liveBadge: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#3FA873", fontWeight: 600, letterSpacing: 0.3 },
  liveDot: { width: 7, height: 7, borderRadius: "50%", background: "#3FA873", boxShadow: "0 0 0 0 rgba(63,168,115,0.7)", animation: "pulse 1.8s infinite" },
  body: { display: "flex", flex: 1, minHeight: 0 },
  sidenav: { width: 230, borderRight: "1px solid #1D2A3D", padding: 14, display: "flex", flexDirection: "column", gap: 3, background: "#0D1826" },
  navItem: { display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 8, border: "none", background: "transparent", color: "#9AA7BC", fontSize: 13.5, cursor: "pointer", textAlign: "left", fontFamily: "inherit" },
  navItemActive: { background: "#16233A", color: "#F4F6F8" },
  navBadge: { background: "#D64545", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 6px" },
  navSpacer: { flex: "0 0 16px" },
  tickerBox: { marginTop: "auto", background: "#0B1420", border: "1px solid #1D2A3D", borderRadius: 10, padding: 10, maxHeight: 260, display: "flex", flexDirection: "column" },
  tickerHead: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#5B7290", fontWeight: 600, marginBottom: 8, letterSpacing: 0.4 },
  tickerList: { overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5 },
  tickerItem: { borderLeft: "2px solid", paddingLeft: 8, color: "#B7C1D1", lineHeight: 1.4 },
  tickerTime: { color: "#54637C", marginRight: 6, fontSize: 10 },
  tickerEmpty: { color: "#54637C", fontSize: 11.5, lineHeight: 1.5 },
  main: { flex: 1, overflowY: "auto", padding: "22px 28px 60px" },
  section: { marginBottom: 30, maxWidth: 1100 },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14, gap: 12, flexWrap: "wrap" },
  sectionTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 600, margin: 0 },
  sectionSub: { fontSize: 13, color: "#8496AE", margin: "4px 0 0" },
  grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 },
  statCard: { display: "flex", alignItems: "center", gap: 12, background: "#111E30", border: "1px solid #1D2A3D", borderRadius: 12, padding: 14 },
  statIcon: { width: 38, height: 38, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statValue: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 21, fontWeight: 700, lineHeight: 1, color: "var(--text-color, inherit)" },
  statLabel: { fontSize: 11.5, color: "var(--text-color, #8496AE)", marginTop: 3 },
  actionRow: { display: "flex", gap: 12, flexWrap: "wrap" },
  bigAction: { display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderRadius: 12, border: "none", color: "#0B1420", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" },
  card: { background: "#111E30", border: "1px solid #1D2A3D", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 6 },
  cardTitleRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-color, inherit)" },
  cardMeta: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-color, #8496AE)" },
  cardDesc: { fontSize: 12.5, color: "var(--text-color, #B7C1D1)", marginTop: 4 },
  barTrack: { height: 7, background: "#1D2A3D", borderRadius: 4, overflow: "hidden", flex: 1 },
  barFill: { height: "100%", borderRadius: 4, transition: "width 0.5s" },
  barLabel: { fontSize: 11, color: "var(--text-color, #8496AE)", marginTop: 4 },
  form: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 460 },
  formRow: { display: "flex", gap: 10 },
  label: { fontSize: 12, color: "var(--text-color, #8496AE)", marginTop: 6 },
  input: { background: "#0D1826", border: "1px solid #22314A", borderRadius: 8, padding: "10px 12px", color: "var(--text-color, #E7ECF3)", fontSize: 13.5, fontFamily: "inherit", outline: "none" },
  inputIcon: { display: "flex", alignItems: "center", gap: 8, background: "#0D1826", border: "1px solid #22314A", borderRadius: 8, padding: "10px 12px", color: "var(--text-color, #8496AE)" },
  inputBare: { background: "transparent", border: "none", outline: "none", color: "var(--text-color, #E7ECF3)", fontSize: 13.5, fontFamily: "inherit", flex: 1 },
  ruleHint: { display: "flex", alignItems: "center", gap: 10, background: "#111E30", border: "1px solid #1D2A3D", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: "var(--text-color, #B7C1D1)" },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 10, background: "var(--btn-color, #3FA873)", color: "#0B1420", border: "none", borderRadius: 9, padding: "11px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" },
  secondaryBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid #2C3E5C", color: "var(--text-color, #B7C1D1)", borderRadius: 7, padding: "6px 11px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  pillBtn: { background: "none", border: "none", cursor: "pointer", padding: 0 },
  confirmBox: { display: "flex", alignItems: "flex-start", gap: 12, background: "#0F241C", border: "1px solid #1F4A38", borderRadius: 10, padding: 14, marginTop: 10, maxWidth: 500 },
  badge: { padding: "3px 8px", borderRadius: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3 },
  pill: { border: "1px solid", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 },
  emptyState: { color: "var(--text-color, #5B7290)", fontSize: 13, background: "#111E30", border: "1px dashed #22314A", borderRadius: 10, padding: 18, lineHeight: 1.5 },
  tableWrap: { overflowX: "auto", border: "1px solid #1D2A3D", borderRadius: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "10px 14px", background: "#111E30", color: "var(--text-color, #8496AE)", fontWeight: 600, fontSize: 11.5, letterSpacing: 0.3, borderBottom: "1px solid #1D2A3D" },
  tr: { borderBottom: "1px solid #17233559" },
  td: { padding: "10px 14px", color: "var(--text-color, #D6DEE9)" },
  incidentRow: { display: "flex", gap: 14, background: "#111E30", border: "1px solid #1D2A3D", borderRadius: 12, padding: 14 },
  idTag: { fontSize: 10.5, color: "#5B7290", fontFamily: "monospace" },
  missionCard: { background: "#111E30", border: "1px solid #1D2A3D", borderRadius: 12, padding: 16 },
  missionHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14, flexWrap: "wrap" },
  timeline: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0, position: "relative" },
  timelineDot: { width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 },
  timelineBar: { flex: 1, height: 3, minWidth: 12 },
  timelineLabels: { display: "flex", justifyContent: "space-between", width: "100%", marginTop: 6 },
  timelineLabel: { fontSize: 9, color: "#5B7290", flex: 1, textAlign: "center" },
  barRow: { display: "flex", alignItems: "center", gap: 12 },
  barRowLabel: { width: 150, fontSize: 12.5, color: "#B7C1D1", flexShrink: 0 },
  barRowCount: { width: 24, fontSize: 12.5, color: "#8496AE", textAlign: "right" },
  toast: { position: "fixed", top: 16, right: 16, zIndex: 100, display: "flex", gap: 10, alignItems: "flex-start", background: "#151F30", border: "1px solid #22314A", borderLeft: "3px solid", borderRadius: 10, padding: "12px 14px", minWidth: 260, maxWidth: 340, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  toastTitle: { fontWeight: 700, fontSize: 13 },
  toastBody: { fontSize: 12, color: "#9AA7BC", marginTop: 2 },
  toastClose: { background: "none", border: "none", color: "#5B7290", cursor: "pointer" },
  sosOverlay: { position: "fixed", inset: 0, background: "rgba(11,20,32,0.85)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 },
  sosPulse: { width: 100, height: 100, borderRadius: "50%", background: "#D64545", animation: "sospulse 1s infinite" },
  sosText: { color: "#FF9B9B", fontWeight: 700, letterSpacing: 0.5, fontSize: 15 },
  sosCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: 16, maxWidth: 400 },
  sosButton: { width: 180, height: 180, borderRadius: "50%", background: "#D64545", border: "6px solid #3A1518", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, fontWeight: 800, fontSize: 14, letterSpacing: 0.5, cursor: "pointer" },
  authWrap: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  authCard: { width: "100%", maxWidth: 420, background: "#111E30", border: "1px solid #1D2A3D", borderRadius: 16, padding: 26 },
  authBrand: { display: "flex", alignItems: "center", gap: 10, marginBottom: 20 },
  authTabs: { display: "flex", gap: 4, background: "#0D1826", borderRadius: 10, padding: 4, marginBottom: 18 },
  authTab: { flex: 1, padding: "8px 0", borderRadius: 7, border: "none", background: "transparent", color: "#8496AE", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  authTabActive: { background: "#1B2A42", color: "#E7ECF3" },
  authError: { background: "#3A1518", color: "#FF9B9B", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, marginTop: 4 },
  authHint: { marginTop: 20, paddingTop: 16, borderTop: "1px solid #1D2A3D", fontSize: 11.5, color: "#8496AE", lineHeight: 1.6 },
  authHintRow: { display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 11.5, color: "#B7C1D1", marginTop: 3 },
  chatToggle: { position: "fixed", bottom: 24, right: 24, zIndex: 999, width: 50, height: 50, borderRadius: "50%", background: "#F0AE55", border: "none", fontSize: 24, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" },
  chatWidget: { position: "fixed", bottom: 84, right: 24, zIndex: 999, width: 320, background: "#111E30", border: "1px solid #F0AE55", borderRadius: 12, display: "flex", flexDirection: "column", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", overflow: "hidden" },
  chatHead: { background: "#0B1420", padding: "12px 14px", borderBottom: "1px solid #F0AE55", color: "#F0AE55", fontWeight: "bold", fontSize: 14, display: "flex", justifyContent: "space-between" },
  chatBody: { padding: 12, height: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 },
  chatMsgBot: { padding: "8px 12px", borderRadius: 8, fontSize: 13, maxWidth: "85%", alignSelf: "flex-start", background: "#1D2A3D", color: "#E7ECF3", borderLeft: "2px solid #F0AE55" },
  chatMsgUser: { padding: "8px 12px", borderRadius: 8, fontSize: 13, maxWidth: "85%", alignSelf: "flex-end", background: "rgba(240,174,85,0.15)", color: "#F0AE55" },
  chatFoot: { display: "flex", borderTop: "1px solid #1D2A3D" },
  chatInput: { flex: 1, background: "transparent", border: "none", padding: "10px 12px", color: "#E7ECF3", outline: "none", fontSize: 13 },
  chatSendBtn: { background: "#F0AE55", color: "#0B1420", border: "none", padding: "0 14px", fontWeight: "bold", cursor: "pointer" },
};

function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ id: 1, text: "Mischief managed! I am the RescueRelief bot. How can I help you?", sender: "bot" }]);
  const [input, setInput] = useState("");
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, open]);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = { id: Date.now(), text: input, sender: "user" };
    setMsgs(p => [...p, userMsg]);
    setInput("");
    try {
      const res = await api.post("/chatbot", { message: input });
      setMsgs(p => [...p, { id: Date.now(), text: res.data.reply, sender: "bot" }]);
    } catch {
      setMsgs(p => [...p, { id: Date.now(), text: "The floo network is down. Try again later.", sender: "bot" }]);
    }
  };

  return (
    <>
      <button style={S.chatToggle} onClick={() => setOpen(!open)}>🪄</button>
      {open && (
        <div style={S.chatWidget}>
          <div style={S.chatHead}>
            <span>🦉 Hogwarts Relief Bot</span>
            <button onClick={() => setOpen(false)} style={{background:"none",border:"none",color:"#F0AE55",cursor:"pointer"}}><X size={16}/></button>
          </div>
          <div style={S.chatBody} ref={bodyRef}>
            {msgs.map(m => (
              <div key={m.id} style={m.sender === "bot" ? S.chatMsgBot : S.chatMsgUser}>{m.text}</div>
            ))}
          </div>
          <div style={S.chatFoot}>
            <input style={S.chatInput} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Send a patronus..." />
            <button style={S.chatSendBtn} onClick={send}>Send</button>
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(63,168,115,0.6);} 70% { box-shadow: 0 0 0 8px rgba(63,168,115,0);} 100% { box-shadow: 0 0 0 0 rgba(63,168,115,0);} }
@keyframes sospulse { 0% { transform: scale(0.9); opacity: 1; } 70% { transform: scale(1.3); opacity: 0.4; } 100% { transform: scale(0.9); opacity: 1; } }
* { box-sizing: border-box; }
body { margin: 0; }
select, input, textarea { color-scheme: dark; }
button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid #3E7CB1; outline-offset: 2px; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: #22314A; border-radius: 4px; }

/* Theme Overrides via CSS Filters for quick theming of inline styles */
body { top: 0 !important; }
.skiptranslate > iframe.goog-te-banner-frame { display: none !important; }
#goog-gt-tt { display: none !important; }
.goog-te-spinner-pos { display: none !important; }
html[data-theme="light"] { filter: invert(1) hue-rotate(180deg) brightness(1.1); }
html[data-theme="light"] img, html[data-theme="light"] button[style*="background: #D64545"], html[data-theme="light"] .chatWidget { filter: invert(1) hue-rotate(180deg); }
html[data-theme="darkblue"] { filter: sepia(0.3) hue-rotate(190deg) saturate(1.8) brightness(0.9); }

`;
