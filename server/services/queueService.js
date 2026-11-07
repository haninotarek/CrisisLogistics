/**
 * Orders waiting reports for dispatch using the team's MaxHeap (algorithms/priorityQueue.js, Looz).
 *
 * The heap pops the item with the highest `score` (ties -> older created_at first).
 * We feed it a score that guarantees the project rule "Critical before Medium before Low":
 *
 *   score = SEVERITY_TIER * 1000 + priority_score (0..100, from triage) + aging bonus (0..20)
 *
 * Because one tier step (1000) is bigger than any possible priority + aging (<= 120),
 * a report can never jump to a higher tier just by waiting; inside a tier the more
 * dangerous / longer-waiting case comes first.
 */
const { MaxHeap } = require("../algorithms/priorityQueue");

const SEVERITY_TIER = { Critical: 3, Medium: 2, Low: 1 };
const AGING_POINTS_PER_MINUTE = 0.5;
const MAX_AGING_BONUS = 20;

function agingBonus(report, now = Date.now()) {
    const created = new Date(report.created_at).getTime();
    if (!Number.isFinite(created)) return 0;
    const waitedMinutes = Math.max(0, (now - created) / 60000);
    return Math.min(MAX_AGING_BONUS, Math.floor(waitedMinutes * AGING_POINTS_PER_MINUTE));
}

function effectivePriority(report, now = Date.now()) {
    return (Number(report.priority_score) || 0) + agingBonus(report, now);
}

function queueScore(report, now = Date.now()) {
    return (SEVERITY_TIER[report.severity] || 0) * 1000 + effectivePriority(report, now);
}

/** Returns reports in dispatch order, each with `effective_priority` and `queue_position`. */
function sortReportsByPriority(reports, now = Date.now()) {
    const heap = new MaxHeap();
    for (const r of reports) heap.push({ ...r, score: queueScore(r, now) });

    const sorted = [];
    while (heap.size) {
        const { score, ...r } = heap.pop(); // `score` is internal to the heap
        sorted.push({ ...r, effective_priority: effectivePriority(r, now), queue_position: sorted.length + 1 });
    }
    return sorted;
}

module.exports = { sortReportsByPriority, effectivePriority, queueScore };
