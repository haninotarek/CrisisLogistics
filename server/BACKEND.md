# CrisisLogistics – Backend guide

## 1. Run it

```bash
npm install
npm run db:setup   # first time only: create tables + import graph.json
npm run dev        # nodemon, auto-restart   (or: npm start)
npm test           # backend tests + the team's algorithm tests
```

`server/.env` (see `.env.example`):

| var | default | note |
|---|---|---|
| `PORT` | `4000` | README says backend = 4000 (5000 is the AI service) |
| `DATABASE_URL` | – | required |
| `AI_URL` | – | e.g. `http://localhost:5000` |
| `AI_TIMEOUT_MS` | `3000` | after this the backend stops waiting for the AI |
| `AVG_SPEED_KMH` | `40` | used for ETA |
| `CORS_ORIGIN` | `*` | e.g. `http://localhost:5173` |

### Database: works with the current dump, upgrade optional

The backend runs on the **current database exactly as dumped**. Parts of the ERD that are
missing from the dump are detected at runtime (`config/schemaInfo.js`):

| ERD item | missing in dump → behaviour |
|---|---|
| `nodes`, `edges` tables | road graph is read from `data/graph.json`; if that is empty too, distances are straight-line × 1.4 and the route has `"approximate": true` |
| `reports.incident_code` | not filled |

`npm run db:init` (`db/schema.sql`) brings the DB up to the ERD **without touching existing data**:
creates `nodes`/`edges`, adds `incident_code`, adds checks/FKs (a constraint that existing data
violates is skipped with a NOTICE, never fails), adds indexes. It is idempotent.

`npm run db:seed` (`db/seed.js`) imports the team's road network `data/graph.json` into the DB:
all nodes + edges (re-runnable), and — only if those tables are empty — hospitals
(`type: "hospital"`, `total_beds = available_beds = capacity`) and ambulances (`type: "ambulance"`).
`npm run db:demo` (`db/seed.sql`, Database / Kaju) adds the demo state on top of that: current free beds
per hospital and 10 sample reports (one of them assigned, so its ambulance becomes busy). It clears
`reports` first, so it is safe to re-run. Roads are stored once; Dijkstra treats every road as two-way.

`npm run db:setup` = all three, in order: `db:init`, `db:seed`, `db:demo`.

## 2. Architecture

```
routes/        URL -> controller function (no logic)
controllers/   read + validate request, call services, send JSON
services/      business logic
  triageService.js    ML call + rule fallback + priority score
  queueService.js     dispatch order, built on Looz's MaxHeap
  dispatchService.js  assign / complete / unassign / queue (transactions + row locks)
  graphService.js     picks the graph source (DB or graph.json) and calls Ain Gamal's dijkstra()
algorithms/    pure algorithms, no DB  (team-owned, reused as-is)
  priorityQueue.js    MaxHeap + sortReports            (feature/looz-priority-queue)
  dijkstra.js         Dijkstra, A*, nearest node, ...  (feature/ain-gamal-dijkstra)
  dispatcher.js       pick ambulance / hospital
config/        env, db pool, schema detection
middleware/    404 + central error handler
utils/         AppError, validate()
```

Express 5 passes errors from `async` handlers to the error handler automatically, so the
controllers have no `try/catch`. Any error turns into a clean JSON response and never crashes
the process. Postgres error codes are mapped to HTTP codes (duplicate → 409, check violation → 400,
DB down → 503). All SQL is parameterized (`$1, $2…`). The only dynamic SQL parts are column
names, and those come from a whitelist (validator schema keys), never from the user.

## 3. The dispatch workflow

```
POST /api/reports
  validate body ─► nearest graph node ─► triage:
      operator "severity" given?  → use it                 (triage_source: "manual")
      else AI /predict answers?   → use it                 (triage_source: "ai")
      else                        → rule-based fallback    (triage_source: "rules")
  ─► priority_score (0-100) ─► INSERT status='waiting'

GET /api/reports/queue  → waiting reports, ordered by Looz's MaxHeap with
      score = tier*1000 + priority_score + aging   (services/queueService.js):
      1. severity tier  Critical > Medium > Low   (always)
      2. effective priority = priority_score + aging (+1 per 2 min waited, max +20)
      3. older first

POST /api/reports/:id/assign   (or /api/dispatch/next, /api/dispatch/all)
  BEGIN
    lock report (must be 'waiting')
    lock available ambulances, lock hospitals with available_beds >= injured_count
    team dijkstra() patient → each candidate (memoised per node)
    ambulance = nearest available
    hospital  = Critical: nearest | else: distance + crowding penalty (≤ 2 km)
    ambulance.status='busy', hospital.available_beds -= injured_count,
    report.status='assigned', assigned_at=NOW()
  COMMIT  → returns report, ambulance, hospital, route (both legs: path, coords, km, ETA)

POST /api/reports/:id/complete
  report → 'done', completed_at=NOW(); ambulance → 'available' and moved to the hospital's location
  (bed stays occupied — the patient is admitted. Free beds with PATCH /api/hospitals/:id/beds)

POST /api/reports/:id/unassign   (ambulance broke down etc.)
  report → 'waiting', ambulance → 'available', beds released
```

`FOR UPDATE` row locks guarantee that two operators can never get the same ambulance or the last
bed. This was tested: two simultaneous assigns with one free ambulance → one `200`, one `409`.

### Priority score (`services/triageService.js`)
base Critical 70 / Medium 40 / Low 10, +10 unconscious, +10 breathing issue,
bleeding severe +8 / moderate +4 / mild +1, +pain/2, +3 per extra injured (max 15),
+5 child < 12 or elderly ≥ 65; capped at 100.

### Rule-based fallback (NOT machine learning)
Critical if unconscious, breathing issue, severe bleeding or pain ≥ 9.
Medium if moderate bleeding, pain ≥ 5, ≥ 3 injured, age ≥ 65 or < 5. Otherwise Low.

## 4. ML integration contract (still needed from the AI service)

`ai-service/app.py` is currently empty, so there is **no trained model yet**. The Node side
is ready and expects:

```
POST {AI_URL}/predict
Content-Type: application/json
{ "age": 40, "injury_type": "car accident", "injured_count": 1, "conscious": false,
  "bleeding": "severe", "breathing_issue": true, "pain_level": 9 }

200 → { "severity": "Low" | "Medium" | "Critical" }     (case-insensitive; "prediction" also accepted)
```

Any non-200, timeout, or unexpected answer → rule-based fallback plus a warning in the log. The
report is still created. The response's `triage_source` always tells you which path was used.
Needed from the AI side: training data, a trained model file (e.g. joblib), and a Flask `/predict`
route following the contract above.

## 5. Endpoints

| Method | URL | What |
|---|---|---|
| GET | `/api/health` (`/api/db-test`) | server + DB status (503 if DB down) |
| GET | `/api/stats` | dashboard counters |
| GET | `/api/reports?status=&severity=&limit=&offset=` | list + filters |
| GET | `/api/reports/queue` | waiting reports by priority |
| GET | `/api/reports/:id` | one report (+ ambulance_name, hospital_name) |
| POST | `/api/reports[?auto_dispatch=true]` | create (validated, triaged) |
| PATCH | `/api/reports/:id` | edit; medical fields only while `waiting` (re-scores) |
| PATCH | `/api/reports/:id/status` | `{status}` → runs assign / complete / unassign |
| POST | `/api/reports/:id/assign` · `/complete` · `/unassign` | workflow steps |
| GET | `/api/reports/:id/route` | route legs for map |
| DELETE | `/api/reports/:id` | not allowed while `assigned` |
| POST | `/api/dispatch/next` · `/api/dispatch/all` | dispatch from the queue |
| GET | `/api/ambulances?status=` · `/:id` | list / one (+ active_report_id) |
| POST · PATCH · DELETE | `/api/ambulances[/:id]` | CRUD (location → nearest node) |
| PATCH | `/api/ambulances/:id/status` | `available` / `offline` (blocked while on a report) |
| GET | `/api/hospitals` · `/available?beds=` · `/:id` | |
| POST · PATCH · DELETE | `/api/hospitals[/:id]` | CRUD |
| PATCH | `/api/hospitals/:id/beds` | `{available_beds}` or `{change: -1}` |
| GET | `/api/graph` · `/nodes` · `/edges` | graph (`source`: database / graph.json / none) |
| GET | `/api/graph/route?from=N7&to=N3` | Dijkstra between two nodes |
| GET | `/api/graph/nearest?lat=&lng=` | nearest node |
| POST · DELETE | `/api/graph/nodes`, `/api/graph/edges` | needs the nodes/edges tables |

## 6. Postman examples (real responses from the test run)

**Create report** `POST /api/reports`
```json
{ "latitude": 30.045, "longitude": 31.236, "injury_type": "car accident", "conscious": false,
  "bleeding": "severe", "breathing_issue": true, "pain_level": 9, "age": 40,
  "reporter_phone": "01012345678" }
```
→ `201`
```json
{ "success": true, "triage_source": "rules",
  "data": { "id": 1, "severity": "Critical", "priority_score": 100, "status": "waiting", "...": "..." } }
```

**Validation error** `POST /api/reports` `{"latitude":"abc","longitude":31.24,"injury_type":"x","conscious":"maybe","bleeding":"lots","pain_level":20}` → `400`
```json
{ "success": false, "message": "Validation failed",
  "details": ["latitude must be a number", "conscious must be true or false",
              "bleeding must be one of: none, mild, moderate, severe", "pain_level must be <= 10"] }
```

**Assign** `POST /api/reports/4/assign` → `200` (route part)
```json
"route": {
  "ambulance_to_patient": { "distance_km": 2.6, "approximate": false, "path": ["N8","N7"],
                            "coordinates": [[30.005,31.233],[30.0131,31.2085]], "eta_minutes": 4 },
  "patient_to_hospital":  { "distance_km": 2.6, "approximate": false, "path": ["N7","N8"], "...": "..." },
  "total_distance_km": 5.2, "total_eta_minutes": 8 }
```

**Conflicts** → `409`
```json
{ "success": false, "message": "Report is already 'assigned', only 'waiting' reports can be assigned" }
{ "success": false, "message": "No hospital has 3 free bed(s) right now" }
{ "success": false, "message": "Ambulance is on report #1 - complete or unassign that report first" }
```

**Shortest route** `GET /api/graph/route?from=A_S00&to=H_D08` → `200` (real graph.json data)
```json
{ "success": true, "data": { "from": "A_S00", "to": "H_D08", "distance_km": 72.32,
  "path": ["A_S00","J_SIN_05","H_D08"],
  "coordinates": [[31.005,32.654],[31.008,32.658],[30.5965,32.2715]], "visited_nodes": 17 } }
```

**Dispatch on the seeded data** `POST /api/dispatch/all` with a Critical report at (30.59, 32.27):
`إسعاف الإسماعيلية [A_D14]` → patient (0.74 km, `A_D14>J_CAN_01`) → `مجمع الإسماعيلية الطبي [H_D08]`
(0.94 km), total 1.68 km / 3 min, `approximate: false`.

**Dispatch all** `POST /api/dispatch/all` → `200`
```json
{ "success": true, "data": { "assigned": [ { "report": {"id": 3, "...": "..."}, "...": "..." } ],
  "skipped": [ { "report_id": 2, "reason": "No hospital has 3 free bed(s) right now" } ],
  "remaining_in_queue": 1 } }
```

**Beds** `PATCH /api/hospitals/2/beds` `{"change": 5}` → `200`; `{"available_beds": 1000}` → `400 available_beds cannot be greater than total_beds`
