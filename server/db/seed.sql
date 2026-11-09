-- =====================================================================
-- CrisisLogistics - demo data (Database / Kaju)
-- Runs AFTER `npm run db:seed`, which loads nodes, roads, hospitals and
-- ambulances from server/data/graph.json. This file only adds what
-- graph.json does not have: current free beds and 10 sample reports.
-- Safe to re-run: it clears the reports first.
-- Run everything with:  npm run db:setup
-- =====================================================================

TRUNCATE reports RESTART IDENTITY;

-- 1) free beds right now (graph.json only has total capacity)
UPDATE hospitals h
SET available_beds = v.available_beds
FROM (VALUES
('H_S00', 32),
('H_S07', 22),
('H_S08', 45),
('H_D08', 130),
('H_D09', 110),
('H_D10', 80),
('H_S01', 60),
('H_S02', 40),
('H_S03', 30),
('H_S04', 20),
('H_S05', 17),
('H_S06', 45),
('H_C01', 160),
('H_C02', 140),
('H_C03', 0),
('H_C04', 130),
('H_C05', 90),
('H_C06', 75),
('H_C07', 110),
('H_C08', 95),
('H_C09', 80),
('H_C10', 70),
('H_A01', 120),
('H_A02', 150),
('H_A03', 90),
('H_A04', 60),
('H_D01', 140),
('H_D02', 100),
('H_D03', 130),
('H_D04', 125),
('H_D05', 95),
('H_D06', 85),
('H_D07', 105),
('H_P01', 145),
('H_P02', 100),
('H_P03', 120),
('H_P04', 90),
('H_P05', 105)
) AS v(node_id, available_beds)
WHERE h.node_id = v.node_id;

-- 2) reports (10)
INSERT INTO reports
(incident_code, latitude, longitude, node_id, patient_name, age, injury_type,
 conscious, bleeding, breathing_issue, pain_level, severity,
 reporter_name, reporter_phone, priority_score, status,
 ambulance_id, hospital_id, assigned_at, completed_at)
VALUES
('INC-001-1', 31.2350, 32.2950, 'J_CAN_02', 'أحمد محمود', 35, 'حادث سيارة',
 false, 'severe', true, 9, 'Critical',
 'سامي حسن', '01012345678', 95, 'assigned',
 (SELECT id FROM ambulances WHERE node_id = 'A_D13'),
 (SELECT id FROM hospitals WHERE node_id = 'H_D09'),
 NOW() - INTERVAL '10 minutes', NULL),

('INC-001-2', 31.2350, 32.2950, 'J_CAN_02', 'منى سعيد', 29, 'حادث سيارة',
 true, 'moderate', false, 6, 'Medium',
 'سامي حسن', '01012345678', 55, 'waiting',
 NULL, NULL, NULL, NULL),

('INC-001-3', 31.2350, 32.2950, 'J_CAN_02', 'يوسف سامي', 8, 'حادث سيارة',
 true, 'none', false, 3, 'Low',
 'سامي حسن', '01012345678', 20, 'waiting',
 NULL, NULL, NULL, NULL),

('INC-002', 31.2653, 32.3019, 'J_CAN_02', 'سارة علي', 24, 'كسر في الذراع',
 true, 'none', false, 7, 'Medium',
 'نادية علي', '01123456789', 50, 'waiting',
 NULL, NULL, NULL, NULL),

('INC-003', 31.2440, 32.3203, 'J_CAN_02', 'محمد إبراهيم', 62, 'ألم في الصدر',
 true, 'none', true, 8, 'Critical',
 'كريم إبراهيم', '01234567890', 90, 'waiting',
 NULL, NULL, NULL, NULL),

('INC-004', 30.5900, 32.2680, 'J_CAN_01', 'هدى كمال', 45, 'جرح قطعي',
 true, 'moderate', false, 5, 'Medium',
 'منى كمال', '01098765432', 45, 'waiting',
 NULL, NULL, NULL, NULL),

('INC-005', 30.0444, 31.2357, 'J_CAI_01', 'آدم رضا', 5, 'سقوط من ارتفاع',
 false, 'none', false, NULL, 'Critical',
 'رضا فؤاد', '01155554444', 92, 'waiting',
 NULL, NULL, NULL, NULL),

('INC-006', 30.5965, 32.2715, 'J_CAN_01', 'عمر خالد', 19, 'كدمات بسيطة',
 true, 'none', false, 2, 'Low',
 'خالد حسن', '01066667777', 15, 'done',
 (SELECT id FROM ambulances WHERE node_id = 'A_D14'),
 (SELECT id FROM hospitals WHERE node_id = 'H_D08'),
 NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'),

('INC-007', 30.0660, 31.2850, 'J_CAI_03', 'فاطمة نبيل', 70, 'إغماء',
 false, 'none', false, 4, 'Medium',
 'ليلى نبيل', '01177778888', 60, 'waiting',
 NULL, NULL, NULL, NULL),

('INC-008', 30.0620, 31.2465, 'J_CAI_02', 'حسن عادل', 33, 'حروق',
 true, 'none', false, 8, 'Medium',
 'طارق سمير', '01299990000', 58, 'waiting',
 NULL, NULL, NULL, NULL);

-- 3) a report is created before an ambulance is assigned to it
UPDATE reports
SET created_at = assigned_at - INTERVAL '5 minutes'
WHERE assigned_at IS NOT NULL AND created_at > assigned_at;

-- 4) an ambulance assigned to a report is busy
UPDATE ambulances
SET status = 'busy'
WHERE id IN (SELECT ambulance_id FROM reports WHERE status = 'assigned');
