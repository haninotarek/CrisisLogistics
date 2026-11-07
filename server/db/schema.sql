-- =====================================================================
-- CrisisLogistics - Database schema (PostgreSQL)
-- Idempotent: safe to run on an empty database AND on the existing one
-- (it only creates what is missing). Run with:  npm run db:init
-- =====================================================================

-- ---------- Road graph ----------
CREATE TABLE IF NOT EXISTS nodes (
    node_id   VARCHAR(10)  PRIMARY KEY,
    latitude  NUMERIC(9,6) NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
    longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS edges (
    id          SERIAL PRIMARY KEY,
    from_node   VARCHAR(10)  NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    to_node     VARCHAR(10)  NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    distance_km NUMERIC(8,2) NOT NULL CHECK (distance_km >= 0),
    CONSTRAINT edges_not_self CHECK (from_node <> to_node),
    CONSTRAINT edges_unique_pair UNIQUE (from_node, to_node)
);

-- ---------- Hospitals ----------
CREATE TABLE IF NOT EXISTS hospitals (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(200) NOT NULL,
    latitude       NUMERIC(9,6) NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
    longitude      NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    total_beds     INTEGER NOT NULL CHECK (total_beds >= 0),
    available_beds INTEGER NOT NULL,
    node_id        VARCHAR(10) NOT NULL,
    CONSTRAINT hospitals_check CHECK (available_beds >= 0 AND available_beds <= total_beds)
);

-- ---------- Ambulances ----------
CREATE TABLE IF NOT EXISTS ambulances (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(200) NOT NULL,
    latitude  NUMERIC(9,6) NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
    longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    status    VARCHAR(20) NOT NULL DEFAULT 'available',
    node_id   VARCHAR(10) NOT NULL
);

-- ---------- Reports ----------
CREATE TABLE IF NOT EXISTS reports (
    id              SERIAL PRIMARY KEY,
    latitude        NUMERIC(9,6) NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
    longitude       NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    node_id         VARCHAR(10),
    patient_name    VARCHAR(100),
    age             INTEGER,
    injury_type     VARCHAR(100) NOT NULL,
    injured_count   INTEGER NOT NULL DEFAULT 1 CHECK (injured_count >= 1),
    conscious       BOOLEAN NOT NULL,
    bleeding        VARCHAR(20) NOT NULL,
    breathing_issue BOOLEAN NOT NULL DEFAULT FALSE,
    pain_level      INTEGER CHECK (pain_level BETWEEN 0 AND 10),
    severity        VARCHAR(20) CHECK (severity IN ('Low', 'Medium', 'Critical')),
    reporter_name   VARCHAR(100),
    reporter_phone  VARCHAR(20),
    priority_score  INTEGER,
    status          VARCHAR(20) NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'assigned', 'done')),
    ambulance_id    INTEGER REFERENCES ambulances(id),
    hospital_id     INTEGER REFERENCES hospitals(id),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    assigned_at     TIMESTAMP,
    completed_at    TIMESTAMP,
    incident_code   VARCHAR(20)
);

-- ---------- Upgrades for databases created from the old dump ----------
ALTER TABLE reports ADD COLUMN IF NOT EXISTS incident_code VARCHAR(20);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS injured_count INTEGER NOT NULL DEFAULT 1;

-- Constraints that may be missing on an existing database.
-- Each one is skipped (with a NOTICE) if it already exists or existing data violates it.
DO $$
DECLARE
    stmt TEXT;
    stmts TEXT[] := ARRAY[
        'ALTER TABLE ambulances ADD CONSTRAINT ambulances_status_check CHECK (status IN (''available'', ''busy'', ''offline''))',
        'ALTER TABLE ambulances ADD CONSTRAINT ambulances_node_id_fkey FOREIGN KEY (node_id) REFERENCES nodes(node_id)',
        'ALTER TABLE hospitals  ADD CONSTRAINT hospitals_node_id_fkey  FOREIGN KEY (node_id) REFERENCES nodes(node_id)',
        'ALTER TABLE reports    ADD CONSTRAINT reports_node_id_fkey    FOREIGN KEY (node_id) REFERENCES nodes(node_id) ON DELETE SET NULL',
        'ALTER TABLE reports    ADD CONSTRAINT reports_bleeding_check  CHECK (bleeding IN (''none'', ''mild'', ''moderate'', ''severe''))',
        'ALTER TABLE reports    ADD CONSTRAINT reports_incident_code_key UNIQUE (incident_code)'
    ];
BEGIN
    FOREACH stmt IN ARRAY stmts LOOP
        BEGIN
            EXECUTE stmt;
        EXCEPTION
            WHEN duplicate_object OR duplicate_table THEN NULL;
            WHEN others THEN RAISE NOTICE 'Skipped: % (%)', stmt, SQLERRM;
        END;
    END LOOP;
END $$;

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS idx_edges_from        ON edges(from_node);
CREATE INDEX IF NOT EXISTS idx_edges_to          ON edges(to_node);
CREATE INDEX IF NOT EXISTS idx_ambulances_status ON ambulances(status);
CREATE INDEX IF NOT EXISTS idx_reports_status    ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_queue     ON reports(status, priority_score DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_ambulance ON reports(ambulance_id);
CREATE INDEX IF NOT EXISTS idx_reports_hospital  ON reports(hospital_id);
