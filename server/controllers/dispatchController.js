const db = require("../config/database");
const dispatchService = require("../services/dispatchService");

// POST /api/dispatch/next  -> assign the single most urgent waiting report
const dispatchNext = async (req, res) => {
    const result = await dispatchService.dispatchQueue({ max: 1 });
    res.json({ success: true, data: result });
};

// POST /api/dispatch/all   -> assign as many waiting reports as possible, by priority
const dispatchAll = async (req, res) => {
    const result = await dispatchService.dispatchQueue();
    res.json({ success: true, data: result });
};

// GET /api/stats  -> dashboard counters
const getStats = async (req, res) => {
    const { rows: [stats] } = await db.query(`
        SELECT
            (SELECT COUNT(*) FROM reports WHERE status = 'waiting')                       AS reports_waiting,
            (SELECT COUNT(*) FROM reports WHERE status = 'assigned')                      AS reports_assigned,
            (SELECT COUNT(*) FROM reports WHERE status = 'done')                          AS reports_done,
            (SELECT COUNT(*) FROM reports WHERE status = 'waiting' AND severity = 'Critical') AS critical_waiting,
            (SELECT COUNT(*) FROM ambulances WHERE status = 'available')                  AS ambulances_available,
            (SELECT COUNT(*) FROM ambulances WHERE status = 'busy')                       AS ambulances_busy,
            (SELECT COUNT(*) FROM ambulances WHERE status = 'offline')                    AS ambulances_offline,
            (SELECT COALESCE(SUM(available_beds), 0) FROM hospitals)                      AS beds_available,
            (SELECT COALESCE(SUM(total_beds), 0) FROM hospitals)                          AS beds_total,
            (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (assigned_at - created_at)) / 60)::numeric, 1)
               FROM reports WHERE assigned_at IS NOT NULL)                                AS avg_wait_minutes
    `);
    res.json({ success: true, data: stats });
};

module.exports = { dispatchNext, dispatchAll, getStats };
