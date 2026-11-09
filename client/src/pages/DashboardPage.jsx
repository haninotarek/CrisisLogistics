import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Ambulance,
  BedDouble,
  Clock,
  Play,
  Route,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Plus,
} from "lucide-react";
import InteractiveCrisisMap from "../components/InteractiveCrisisMap";

const SEVERITY_LABELS = {
  Critical: { text: "حرجة", cls: "badge-critical" },
  Medium: { text: "متوسطة", cls: "badge-medium" },
  Low: { text: "بسيطة", cls: "badge-low" },
};

const STATUS_LABELS = {
  waiting: { text: "بالانتظار", cls: "badge-waiting" },
  assigned: { text: "قيد التنفيذ", cls: "badge-assigned" },
  done: { text: "مكتمل", cls: "badge-done" },
};

export default function DashboardPage({
  stats,
  reports,
  queue,
  ambulances,
  hospitals,
  graph,
  activeRoute,
  activeMissionMeta,
  selectedReportId,
  busyAction,
  onShowRoute,
  onAssignReport,
  onCompleteReport,
  onUnassignReport,
  onDeleteReport,
  onDispatchNext,
  onDispatchAll,
  onGoNewReport,
}) {
  const [statusFilter, setStatusFilter] = useState("queue"); // "queue" | "all" | "waiting" | "assigned" | "done"
  const [severityFilter, setSeverityFilter] = useState("all");
  const [focusCoords, setFocusCoords] = useState(null);

  const displayedReports = useMemo(() => {
    let base = statusFilter === "queue" ? queue : reports;
    if (statusFilter !== "queue" && statusFilter !== "all") {
      base = base.filter((r) => r.status === statusFilter);
    }
    if (severityFilter !== "all") {
      base = base.filter((r) => r.severity === severityFilter);
    }
    return base;
  }, [statusFilter, severityFilter, reports, queue]);

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">لوحة التحكم</h1>
          <p className="page-subtitle">
            متابعة البلاغات الحية مرتبة بالأولوية (Max-Heap) وتوجيه أقرب إسعاف ومستشفى بأقصر مسار (Dijkstra)
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-outline"
            disabled={busyAction || (stats?.reports_waiting ?? 0) === 0}
            onClick={onDispatchNext}
          >
            <Play size={15} />
            <span>توجيه الأعلى أولوية</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busyAction || (stats?.reports_waiting ?? 0) === 0}
            onClick={onDispatchAll}
          >
            <Ambulance size={16} />
            <span>توجيه كل المنتظر ({stats?.reports_waiting ?? 0})</span>
          </button>
          <button type="button" className="btn btn-success" onClick={onGoNewReport}>
            <Plus size={16} />
            <span>بلاغ جديد</span>
          </button>
        </div>
      </div>

      {/* 4 Figma KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-label">بلاغات بالانتظار</div>
            <div className="kpi-value">{stats?.reports_waiting ?? 0}</div>
            <div className="kpi-note" style={{ color: "#dc2626" }}>
              منها {stats?.critical_waiting ?? 0} حالات حرجة
            </div>
          </div>
          <div className="kpi-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">مهام قيد التنفيذ</div>
            <div className="kpi-value">{stats?.reports_assigned ?? 0}</div>
            <div className="kpi-note" style={{ color: "#2563eb" }}>
              تم إنجاز {stats?.reports_done ?? 0} بلاغ
            </div>
          </div>
          <div className="kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
            <Clock size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">إسعافات متاحة</div>
            <div className="kpi-value">{stats?.ambulances_available ?? 0}</div>
            <div className="kpi-note" style={{ color: "#16a34a" }}>
              {stats?.ambulances_busy ?? 0} مشغولة حالياً
            </div>
          </div>
          <div className="kpi-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}>
            <Ambulance size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">الأسرة المتاحة</div>
            <div className="kpi-value">{stats?.beds_available ?? 0}</div>
            <div className="kpi-note" style={{ color: "#64748b" }}>
              من إجمالي {stats?.beds_total ?? 0} سرير
            </div>
          </div>
          <div className="kpi-icon" style={{ background: "#fffbeb", color: "#d97706" }}>
            <BedDouble size={22} />
          </div>
        </div>
      </div>

      {/* Yellow Figma Alert Strip */}
      {(stats?.critical_waiting ?? 0) > 0 && (
        <div className="alert-strip">
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <AlertTriangle size={18} />
            <span>
              تنبيه عاجل: يوجد <b>{stats.critical_waiting}</b> بلاغ بدرجة خطورة <b>حرجة (Critical)</b> في طابور الانتظار بانتظار إرسال إسعاف فوري!
            </span>
          </div>
          <button
            type="button"
            className="btn btn-xs btn-primary"
            disabled={busyAction}
            onClick={onDispatchNext}
          >
            إرسال إسعاف للحالة الأخطر الآن
          </button>
        </div>
      )}

      {/* Main Split: Priority Reports Table + Interactive Street/GPS Map */}
      <div className="dashboard-split">
        {/* Priority Queue & Reports Table Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span>قائمة البلاغات والفرز الذكي</span>
              <span className="badge badge-assigned">{displayedReports.length}</span>
            </div>

            <div className="pill-group">
              {[
                { id: "queue", label: "طابور الأولوية" },
                { id: "all", label: "الكل" },
                { id: "assigned", label: "قيد التنفيذ" },
                { id: "done", label: "مكتمل" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`filter-pill ${statusFilter === tab.id ? "active" : ""}`}
                  onClick={() => setStatusFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}

              <select
                className="filter-pill"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="all">كل الدرجات</option>
                <option value="Critical">حرجة (Critical)</option>
                <option value="Medium">متوسطة (Medium)</option>
                <option value="Low">بسيطة (Low)</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="figma-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>المريض والإصابة</th>
                  <th>الخطورة</th>
                  <th>الأولوية</th>
                  <th>الحالة والتخصيص</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {displayedReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
                      لا توجد بلاغات مطابقة للفلتر المحدد حالياً
                    </td>
                  </tr>
                ) : (
                  displayedReports.map((r, idx) => {
                    const sev = SEVERITY_LABELS[r.severity] || SEVERITY_LABELS.Low;
                    const st = STATUS_LABELS[r.status] || STATUS_LABELS.waiting;
                    const isSelected = selectedReportId === r.id;
                    return (
                      <tr
                        key={r.id}
                        className={isSelected ? "selected-row" : ""}
                        onClick={() => {
                          setFocusCoords({ latitude: r.latitude, longitude: r.longitude, zoom: 12 });
                          if (r.status === "assigned" || r.status === "done") {
                            onShowRoute(r);
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ fontWeight: 800, color: "#475569" }}>
                          {statusFilter === "queue" ? `${idx + 1}` : `#${r.id}`}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>
                            {r.patient_name || `بلاغ #${r.id}`}
                            {r.age ? <span style={{ color: "#64748b", fontWeight: 500 }}> ({r.age} سنة)</span> : null}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            {r.injury_type}
                            {r.injured_count > 1 ? ` • ${r.injured_count} مصابين` : ""}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${sev.cls}`}>{sev.text}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, color: "#0f172a" }}>{r.priority_score}</span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>/100</span>
                        </td>
                        <td>
                          <span className={`badge ${st.cls}`}>{st.text}</span>
                          {(r.ambulance_name || r.hospital_name) && (
                            <div style={{ fontSize: 11.5, color: "#475569", marginTop: 4 }}>
                              {r.ambulance_name && <div>إسعاف: {r.ambulance_name}</div>}
                              {r.hospital_name && <div>مستشفى: {r.hospital_name}</div>}
                            </div>
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {r.status === "waiting" && (
                              <button
                                type="button"
                                className="btn btn-xs btn-primary"
                                disabled={busyAction}
                                onClick={() => onAssignReport(r.id)}
                              >
                                إرسال إسعاف
                              </button>
                            )}
                            {r.status === "assigned" && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-outline"
                                  onClick={() => onShowRoute(r)}
                                  title="عرض المسار على الخريطة"
                                >
                                  <Route size={13} />
                                  <span>المسار</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-success"
                                  disabled={busyAction}
                                  onClick={() => onCompleteReport(r.id)}
                                  title="تأكيد وصول المريض للمستشفى"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>تم الوصول</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-outline"
                                  disabled={busyAction}
                                  onClick={() => onUnassignReport(r.id)}
                                  title="إلغاء التخصيص وإرجاعه للطابور"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              </>
                            )}
                            {r.status !== "assigned" && (
                              <button
                                type="button"
                                className="btn btn-xs btn-danger"
                                disabled={busyAction}
                                onClick={() => onDeleteReport(r.id)}
                                title="حذف البلاغ"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Interactive Technical Map Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span>الخريطة التفاعلية الحية</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#64748b" }}>
                (إسعافات • مستشفيات • مسارات Dijkstra)
              </span>
            </div>
          </div>
          <InteractiveCrisisMap
            hospitals={hospitals}
            ambulances={ambulances}
            reports={reports}
            graph={graph}
            activeRoute={activeRoute}
            activeMissionMeta={activeMissionMeta}
            focusCoords={focusCoords}
            onAssignReport={onAssignReport}
            onSelectReport={(r) => {
              if (r.status === "assigned" || r.status === "done") onShowRoute(r);
            }}
            height={520}
          />
        </div>
      </div>
    </>
  );
}
