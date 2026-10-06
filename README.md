# RescueRelief — Emergency Response & Disaster Management System

A full-stack disaster coordination platform: citizens report incidents or
trigger SOS, a rule-based dispatch engine auto-assigns the nearest available
response team, and every status change streams live to everyone watching
(Command Center, the assigned team, etc.) via Socket.io.

## Stack
- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.io, JWT auth, bcrypt password hashing
- **Frontend**: React (Vite), axios, socket.io-client, lucide-react icons

## Project structure
```
rescuerelief/
  backend/     Express API + MongoDB models + Socket.io + dispatch engine
  frontend/    Vite + React client
```

## 1. Prerequisites
- Node.js 18+
- MongoDB running locally (`mongodb://127.0.0.1:27017`) — or a MongoDB Atlas
  connection string. Install MongoDB Community Server, or run it in Docker:
  `docker run -d -p 27017:27017 --name rescuerelief-mongo mongo`

## 2. Backend setup
```bash
cd backend
cp .env.example .env      # edit MONGODB_URI / JWT_SECRET if needed
npm install
npm run seed               # creates admin + 6 response-team logins + demo data
npm run dev                 # starts API on http://localhost:4000
```
The seed script prints every login it creates, e.g.:
```
response login: alpha6 / team123  ->  ALPHA-6
...
Admin login: admin / admin123
```

## 3. Frontend setup
Open a second terminal:
```bash
cd frontend
cp .env.example .env       # defaults already point at localhost:4000
npm install
npm run dev                 # starts the app on http://localhost:5173
```
Open http://localhost:5173.

## Accounts
| Role | How it's created | Example login |
|---|---|---|
| Citizen | Self-signup on the login screen | (you create it) |
| Volunteer | Self-signup on the login screen | (you create it) |
| Response Team | Pre-seeded, one per team | `alpha6 / team123` (ALPHA-6), same pattern for bravo2, gamma9, delta3, echo1, fox5 |
| Admin | Pre-seeded | `admin / admin123` |

## How the dispatch engine works
1. A citizen reports an incident (or triggers SOS).
2. The backend classifies severity and the required team specializations
   (`backend/dispatch.js`), based on the disaster type.
3. It finds the nearest **available** team matching a required specialization
   and atomically reserves it (`findOneAndUpdate` — avoids two incidents
   grabbing the same team in a race).
4. Everyone connected over Socket.io gets a live update: the activity feed,
   the incident's new status, and the team's new "Deployed" status.
5. The response team walks the mission through
   ASSIGNED → ACKNOWLEDGED → EN ROUTE → ON SCENE → RESCUE IN PROGRESS → COMPLETED.
   Completing a mission frees the team back to "Available".

## Access control
- Every route except signup/login requires a valid JWT (`middleware/auth.js`).
- Role-specific routes are guarded server-side (`requireRole(...)`), not just
  hidden in the UI — e.g. only `admin` can adjust shelter occupancy or advance
  complaints; only `response`/`admin` can advance a mission, and a response
  account can only touch **its own team's** missions.
- Only `citizen` and `volunteer` accounts can self-register. Admin and
  response-team accounts are seeded, matching how a real deployment would
  hand out those credentials rather than letting anyone claim them.

## Notes / what's still a demo simplification
- No password reset / email verification flow.
- No file/photo upload for missing-person reports (just an emoji placeholder).
- Donations are simple ledger entries, not a real payment gateway.
- CORS is locked to `CLIENT_ORIGIN` in `.env` — update it if you deploy the
  frontend somewhere other than localhost:5173.
