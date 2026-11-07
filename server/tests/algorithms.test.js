const test = require("node:test");
const assert = require("node:assert/strict");

const { sortReportsByPriority } = require("../services/queueService");
const { selectAmbulance, selectHospital } = require("../algorithms/dispatcher");
const { ruleBasedSeverity, computePriorityScore } = require("../services/triageService");
const { validate } = require("../utils/validate");

const ago = (now, min) => new Date(now - min * 60000).toISOString();

test("queue: higher priority first, ties -> older first", () => {
    const now = Date.now();
    const sorted = sortReportsByPriority([
        { id: 1, severity: "Medium", priority_score: 20, created_at: ago(now, 1) },
        { id: 2, severity: "Medium", priority_score: 90, created_at: ago(now, 1) },
        { id: 3, severity: "Medium", priority_score: 50, created_at: ago(now, 2) },
        { id: 4, severity: "Medium", priority_score: 50, created_at: ago(now, 1) }
    ], now);
    assert.deepEqual(sorted.map((r) => r.id), [2, 3, 4, 1]);
    assert.equal(sorted[0].queue_position, 1);
    assert.equal("score" in sorted[0], false);
});

test("queue: Critical always before Medium, even after long waits", () => {
    const now = Date.now();
    const sorted = sortReportsByPriority([
        { id: 1, severity: "Medium", priority_score: 93, created_at: ago(now, 600) },
        { id: 2, severity: "Critical", priority_score: 70, created_at: ago(now, 0) },
        { id: 3, severity: "Low", priority_score: 30, created_at: ago(now, 0) }
    ], now);
    assert.deepEqual(sorted.map((r) => r.id), [2, 1, 3]);
});

test("dispatcher picks nearest available ambulance and hospital with beds", () => {
    const dist = { N1: 3, N2: 1, N3: 2 };
    const distanceTo = (e) => dist[e.node_id] ?? null;
    const amb = selectAmbulance([
        { id: 1, node_id: "N1", status: "available" },
        { id: 2, node_id: "N2", status: "busy" },
        { id: 3, node_id: "N3", status: "available" }
    ], distanceTo);
    assert.equal(amb.ambulance.id, 3);

    const hosp = selectHospital([
        { id: 1, node_id: "N2", available_beds: 0, total_beds: 10 },
        { id: 2, node_id: "N1", available_beds: 5, total_beds: 10 }
    ], distanceTo, { severity: "Critical" });
    assert.equal(hosp.hospital.id, 2);

    const none = selectHospital([{ id: 1, node_id: "N2", available_beds: 2, total_beds: 10 }], distanceTo, { bedsNeeded: 3 });
    assert.equal(none, null);
});

test("rule-based triage + priority score", () => {
    const base = { conscious: true, breathing_issue: false, bleeding: "none", pain_level: 2, injured_count: 1, age: 30 };
    assert.equal(ruleBasedSeverity(base), "Low");
    assert.equal(ruleBasedSeverity({ ...base, bleeding: "moderate" }), "Medium");
    assert.equal(ruleBasedSeverity({ ...base, conscious: false }), "Critical");
    const s = computePriorityScore({ ...base, conscious: false }, "Critical");
    assert.ok(s > computePriorityScore(base, "Low") && s <= 100);
});

test("validate converts and rejects", () => {
    const schema = {
        age: { type: "integer", min: 0 },
        ok: { type: "boolean", required: true },
        sev: { type: "string", enum: ["Low", "Critical"] }
    };
    assert.deepEqual(validate({ age: "12", ok: "true", sev: "critical", extra: 1 }, schema), { age: 12, ok: true, sev: "Critical" });
    assert.throws(() => validate({ age: -1 }, schema), (e) => e.statusCode === 400 && e.details.length === 2);
    assert.throws(() => validate([], schema), (e) => e.statusCode === 400);
});
