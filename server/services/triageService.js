const env = require("../config/env");

const SEVERITIES = ["Low", "Medium", "Critical"];

/**
 * Asks the AI service for the severity.
 * Contract:  POST {AI_URL}/predict  body = case features (JSON)
 *            -> { "severity": "Low" | "Medium" | "Critical" }   ("prediction" also accepted)
 * Returns null on ANY problem (service down, timeout, bad answer) so the caller can fall back.
 */
async function predictWithAI(features) {
    if (!env.AI_URL) return null;
    try {
        const res = await fetch(`${env.AI_URL}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(features),
            signal: AbortSignal.timeout(env.AI_TIMEOUT_MS)
        });
        if (!res.ok) {
            console.warn(`[ai] /predict returned HTTP ${res.status} - using rule-based triage`);
            return null;
        }
        const data = await res.json();
        const raw = data?.severity ?? data?.prediction ?? (Array.isArray(data?.predictions) ? data.predictions[0] : null);
        const match = SEVERITIES.find((s) => s.toLowerCase() === String(raw).toLowerCase());
        if (!match) {
            console.warn(`[ai] Unexpected response ${JSON.stringify(data)} - using rule-based triage`);
            return null;
        }
        return match;
    } catch (error) {
        console.warn(`[ai] Unavailable (${error.name === "TimeoutError" ? "timeout" : error.message}) - using rule-based triage`);
        return null;
    }
}

/** Simple medical rules used when the AI service is not reachable. */
function ruleBasedSeverity(c) {
    if (!c.conscious || c.breathing_issue || c.bleeding === "severe" || (c.pain_level ?? 0) >= 9) {
        return "Critical";
    }
    if (
        c.bleeding === "moderate"
        || (c.pain_level ?? 0) >= 5
        || c.injured_count >= 3
        || (c.age !== null && c.age !== undefined && (c.age >= 65 || c.age < 5))
    ) {
        return "Medium";
    }
    return "Low";
}

/** Priority score 0..100 (higher = more urgent). */
function computePriorityScore(c, severity) {
    const base = { Critical: 70, Medium: 40, Low: 10 }[severity] ?? 10;
    let score = base;
    if (!c.conscious) score += 10;
    if (c.breathing_issue) score += 10;
    score += { severe: 8, moderate: 4, mild: 1 }[c.bleeding] ?? 0;
    score += Math.round((c.pain_level ?? 0) / 2);            // 0..5
    score += Math.min(15, (Math.max(1, c.injured_count) - 1) * 3);
    if (c.age !== null && c.age !== undefined && (c.age < 12 || c.age >= 65)) score += 5;
    return Math.max(0, Math.min(100, score));
}

/**
 * Full triage for a new report.
 * `manualSeverity` (from the operator) wins over AI; AI wins over rules.
 */
async function triage(c, manualSeverity = null) {
    let severity = manualSeverity;
    let source = "manual";

    if (!severity) {
        severity = await predictWithAI({
            age: c.age,
            injury_type: c.injury_type,
            injured_count: c.injured_count,
            conscious: c.conscious,
            bleeding: c.bleeding,
            breathing_issue: c.breathing_issue,
            pain_level: c.pain_level
        });
        source = "ai";
    }
    if (!severity) {
        severity = ruleBasedSeverity(c);
        source = "rules";
    }
    return { severity, priority_score: computePriorityScore(c, severity), source };
}

module.exports = { SEVERITIES, triage, ruleBasedSeverity, computePriorityScore, predictWithAI };
