import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from './api.js';

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export function VolunteerDashboardExpanded({ volunteers, incidents, currentUser, S }) {
  const me = volunteers.find(v => v.ownerId === currentUser.id) || {};
  
  const acceptTask = async (id) => {
    try {
      const res = await fetch(`http://localhost:4000/api/volunteers/tasks/${id}/accept`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("rr_token")}` }
      });
      if (!res.ok) alert("Failed to accept task");
    } catch(err) { console.error(err); }
  };

  const advanceTask = async (id) => {
    try {
      await fetch(`http://localhost:4000/api/volunteers/tasks/${id}/advance`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("rr_token")}` }
      });
    } catch(err) { console.error(err); }
  };

  const myTasks = incidents.filter(i => i.assignedVolunteer === currentUser.id);
  const openTasks = incidents.filter(i => !i.assignedVolunteer && i.status !== "COMPLETED");

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{...S.card, background: "linear-gradient(135deg, #1A2841 0%, #0F1B2E 100%)", color: "white"}}>
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>Welcome back, {currentUser.name}!</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
          <span>Status:</span>
          <span style={{ padding: "4px 10px", borderRadius: 12, background: me.status === "Busy" ? "#B8860B" : "#2E8B57" }}>
            {me.status || "Available"}
          </span>
          <span style={{ marginLeft: 20 }}>⭐ {me.rating || "5.0"} Rating</span>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15 }}>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: 15, borderRadius: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Tasks Completed</div>
            <div style={{ fontSize: 24, fontWeight: "bold" }}>{me.tasksCompleted || 0}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: 15, borderRadius: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>People Helped</div>
            <div style={{ fontSize: 24, fontWeight: "bold" }}>{me.peopleHelped || 0}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: 15, borderRadius: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Hours Contributed</div>
            <div style={{ fontSize: 24, fontWeight: "bold" }}>{me.hoursContributed || 0}h</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: 15, borderRadius: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Active Tasks</div>
            <div style={{ fontSize: 24, fontWeight: "bold" }}>{myTasks.filter(t => t.volunteerStatus !== "Completed").length}</div>
          </div>
        </div>
      </div>

      {myTasks.length > 0 && (
        <div style={S.card}>
          <h3 style={S.cardTitle}>My Active Assignments</h3>
          {myTasks.map(t => (
            <div key={t._id} style={{ border: "1px solid #22314A", padding: 15, borderRadius: 8, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <strong style={{ fontSize: 16 }}>{t.type} - {t.location}</strong>
                <span style={{ color: "#F0A500" }}>{t.volunteerStatus}</span>
              </div>
              <p style={{ fontSize: 13, color: "#8496AE", marginBottom: 10 }}>{t.description || "No description provided."}</p>
              {t.volunteerStatus !== "Completed" && (
                <button onClick={() => advanceTask(t._id)} style={{...S.primaryBtn, width: 'auto', padding: '6px 12px'}}>
                  Advance Status (Current: {t.volunteerStatus})
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={S.card}>
        <h3 style={S.cardTitle}>Nearby Emergency Requests</h3>
        {openTasks.length === 0 ? <p style={{color: "#8496AE"}}>No nearby requests.</p> : openTasks.map(t => (
          <div key={t._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottom: "1px solid #16243A" }}>
            <div>
              <div style={{ fontWeight: "bold", color: "#E2E8F0" }}>{t.type}</div>
              <div style={{ fontSize: 12, color: "#8496AE" }}>📍 {t.location} | Affected: {t.affected || "Unknown"}</div>
              <div style={{ fontSize: 12, color: t.severity === "CRITICAL" ? "#D64545" : "#E5A023", marginTop: 4 }}>
                Priority: {t.severity}
              </div>
            </div>
            <div>
              <button onClick={() => acceptTask(t._id)} style={{...S.primaryBtn, width: 'auto', padding: '8px 16px'}}>Accept Request</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LiveRescueMap({ incidents, shelters }) {
  const defaultCenter = [9.9252, 78.1198]; 
  return (
    <div style={{ height: "600px", width: "100%", borderRadius: "12px", overflow: "hidden", border: "1px solid #22314A" }}>
      <MapContainer center={defaultCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        />
        {incidents.filter(i => i.status !== "COMPLETED").map(i => {
          const lat = i.lat || (defaultCenter[0] + (Math.random() - 0.5) * 0.05);
          const lng = i.lng || (defaultCenter[1] + (Math.random() - 0.5) * 0.05);
          return (
            <Marker key={i._id} position={[lat, lng]}>
              <Popup><strong>{i.type}</strong><br/>{i.location}<br/>Priority: {i.severity}</Popup>
            </Marker>
          );
        })}
        {shelters.map((s, idx) => {
          const lat = defaultCenter[0] + (Math.random() - 0.5) * 0.05;
          const lng = defaultCenter[1] + (Math.random() - 0.5) * 0.05;
          return (
            <Marker key={`s${idx}`} position={[lat, lng]}>
              <Popup><strong>{s.name}</strong><br/>Capacity: {s.occupancy}/{s.capacity}</Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export function VolunteerRegisterExpanded({ currentUser, volunteers, onSubmit, S }) {
  const existing = volunteers.find(v => v.ownerId === currentUser.id) || {};
  const hasProfile = !!existing._id;
  const [isEditing, setIsEditing] = useState(!hasProfile);

  const [formData, setFormData] = useState({
    fullName: existing.fullName || currentUser.name,
    dob: existing.dob || "",
    gender: existing.gender || "Male",
    phone: existing.phone || "",
    email: existing.email || "",
    address: existing.address || "",
    city: existing.city || "",
    district: existing.district || "",
    state: existing.state || "",
    emergencyContactName: existing.emergencyContactName || "",
    emergencyContactPhone: existing.emergencyContactPhone || "",
    preferredLanguage: existing.preferredLanguage || "English",
    volunteerType: existing.volunteerType || "Independent",
    ngoName: existing.ngoName || "",
    experienceYears: existing.experienceYears || 0,
    status: existing.status || "Available",
    preferredArea: existing.preferredArea || "",
    maxTravelDistance: existing.maxTravelDistance || 10,
    otherSkills: existing.otherSkills || ""
  });

  const [selectedSkills, setSelectedSkills] = useState(existing.skills || []);

  const SKILLS_LIST = [
    "First Aid", "CPR", "Medical Assistance", "Search and Rescue", "Swimming",
    "Fire Safety", "Driving", "Cooking", "Food Distribution", "Logistics",
    "Crowd Management", "Communication", "Shelter Management", "Child Care",
    "Elderly Care", "Psychological Support", "Technical Support", "Drone Operation", "Navigation"
  ];

  const handleToggleSkill = (skill) => {
    if (selectedSkills.includes(skill)) setSelectedSkills(selectedSkills.filter(s => s !== skill));
    else setSelectedSkills([...selectedSkills, skill]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, skills: selectedSkills });
    setIsEditing(false);
  };

  if (!isEditing && hasProfile) {
    return (
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={S.cardTitle}>My Volunteer Profile</h2>
          <button onClick={() => setIsEditing(true)} style={{...S.secondaryBtn, width: 'auto', padding: '6px 16px'}}>Edit Profile</button>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, fontSize: 14 }}>
          <div>
            <h3 style={{ color: "#E2E8F0", borderBottom: "1px solid #16243A", paddingBottom: 5, marginBottom: 10 }}>Personal Details</h3>
            <p><strong style={{ color: "#8496AE" }}>Name:</strong> {existing.fullName}</p>
            <p><strong style={{ color: "#8496AE" }}>Gender:</strong> {existing.gender} | <strong style={{ color: "#8496AE" }}>DOB:</strong> {existing.dob || "N/A"}</p>
            <p><strong style={{ color: "#8496AE" }}>Phone:</strong> {existing.phone}</p>
            <p><strong style={{ color: "#8496AE" }}>Emergency Contact:</strong> {existing.emergencyContactName} ({existing.emergencyContactPhone})</p>
          </div>
          <div>
            <h3 style={{ color: "#E2E8F0", borderBottom: "1px solid #16243A", paddingBottom: 5, marginBottom: 10 }}>Volunteer Details</h3>
            <p><strong style={{ color: "#8496AE" }}>Type:</strong> {existing.volunteerType} {existing.ngoName ? `(${existing.ngoName})` : ""}</p>
            <p><strong style={{ color: "#8496AE" }}>Experience:</strong> {existing.experienceYears} Years</p>
            <p><strong style={{ color: "#8496AE" }}>Max Travel:</strong> {existing.maxTravelDistance} km</p>
          </div>
        </div>

        <h3 style={{ color: "#E2E8F0", borderBottom: "1px solid #16243A", paddingBottom: 5, marginTop: 20, marginBottom: 10 }}>Certified Skills</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {existing.skills?.length > 0 ? existing.skills.map(s => (
            <span key={s} style={{ background: "#22314A", padding: "4px 10px", borderRadius: 12, fontSize: 12 }}>{s}</span>
          )) : <span style={{ color: "#8496AE" }}>No specific skills listed.</span>}
        </div>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={S.cardTitle}>{hasProfile ? "Edit Profile" : "Volunteer Profile Registration"}</h2>
        {hasProfile && <button onClick={() => setIsEditing(false)} style={{...S.secondaryBtn, width: 'auto', padding: '6px 16px'}}>Cancel</button>}
      </div>
      
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        <h3 style={{ borderBottom: "1px solid #16243A", paddingBottom: 5 }}>Personal Information</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input style={S.input} placeholder="Full Name" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required />
          <input style={S.input} placeholder="Date of Birth" type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
          <select style={S.input} value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
            <option>Male</option><option>Female</option><option>Other</option>
          </select>
          <input style={S.input} placeholder="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
          <input style={S.input} placeholder="Emergency Contact Name" value={formData.emergencyContactName} onChange={e => setFormData({...formData, emergencyContactName: e.target.value})} required />
          <input style={S.input} placeholder="Emergency Contact Phone" value={formData.emergencyContactPhone} onChange={e => setFormData({...formData, emergencyContactPhone: e.target.value})} required />
        </div>

        <h3 style={{ borderBottom: "1px solid #16243A", paddingBottom: 5, marginTop: 10 }}>Volunteer Information</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <select style={S.input} value={formData.volunteerType} onChange={e => setFormData({...formData, volunteerType: e.target.value})}>
            <option>Independent</option><option>NGO</option>
          </select>
          <input style={S.input} placeholder="NGO Name (if applicable)" value={formData.ngoName} onChange={e => setFormData({...formData, ngoName: e.target.value})} />
          <input style={S.input} placeholder="Years of Experience" type="number" value={formData.experienceYears} onChange={e => setFormData({...formData, experienceYears: e.target.value})} />
          <input style={S.input} placeholder="Max Travel Distance (km)" type="number" value={formData.maxTravelDistance} onChange={e => setFormData({...formData, maxTravelDistance: e.target.value})} />
        </div>

        <h3 style={{ borderBottom: "1px solid #16243A", paddingBottom: 5, marginTop: 10 }}>Skills (Select all that apply)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {SKILLS_LIST.map(skill => (
            <label key={skill} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={selectedSkills.includes(skill)} onChange={() => handleToggleSkill(skill)} />
              {skill}
            </label>
          ))}
        </div>
        <input style={S.input} placeholder="Other Skills (comma separated)" value={formData.otherSkills} onChange={e => setFormData({...formData, otherSkills: e.target.value})} />

        <button type="submit" style={{...S.primaryBtn, marginTop: 20}}>Save Profile</button>
      </form>
    </div>
  );
}
