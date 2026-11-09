import React, { useCallback, useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import NewReportPage from "./pages/NewReportPage";
import AmbulancesPage from "./pages/AmbulancesPage";
import HospitalsPage from "./pages/HospitalsPage";
import { X } from "lucide-react";
import {
  api,
  checkBackendConnection,
  enhanceRouteGeometry,
  subscribeConnectionMode,
} from "./services/api";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [connMode, setConnMode] = useState("checking");
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [queue, setQueue] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [graph, setGraph] = useState(null);

  const [selectedReportId, setSelectedReportId] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [activeMissionMeta, setActiveMissionMeta] = useState(null);
  const [busyAction, setBusyAction] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((cur) => (cur?.msg === msg ? null : cur));
    }, 4500);
  };

  useEffect(() => {
    const unsub = subscribeConnectionMode(setConnMode);
    return unsub;
  }, []);

  const refreshAll = useCallback(async () => {
    const [stRes, repRes, qRes, ambRes, hospRes, gRes] = await Promise.all([
      api.getStats(),
      api.getReports({ limit: 100 }),
      api.getQueue(),
      api.getAmbulances(),
      api.getHospitals(),
      api.getGraph(),
    ]);
    setStats(stRes.data);
    setReports(repRes.data || []);
    setQueue(qRes.data || []);
    setAmbulances(ambRes.data || []);
    setHospitals(hospRes.data || []);
    setGraph(gRes.data || null);
    return { reports: repRes.data || [] };
  }, []);

  const handleShowRoute = useCallback(async (reportObj) => {
    if (!reportObj) return;
    try {
      setSelectedReportId(reportObj.id);
      const rRes = await api.getReportRoute(reportObj.id);
      const enhanced = await enhanceRouteGeometry(rRes.data);
      setActiveRoute(enhanced);
      setActiveMissionMeta({
        ambulanceName: reportObj.ambulance_name,
        hospitalName: reportObj.hospital_name,
      });
    } catch (err) {
      notify(err.message, "err");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await checkBackendConnection();
      const { reports: initialReports } = await refreshAll();
      const firstAssigned = initialReports.find((r) => r.status === "assigned");
      if (firstAssigned) {
        handleShowRoute(firstAssigned);
      }
    })();
  }, [refreshAll, handleShowRoute]);

  const wrapAction = async (fn, successMessage) => {
    setBusyAction(true);
    try {
      const out = await fn();
      await refreshAll();
      if (successMessage) notify(successMessage, "ok");
      return out;
    } catch (err) {
      notify(err.message || "حدث خطأ أثناء تنفيذ العملية", "err");
      throw err;
    } finally {
      setBusyAction(false);
    }
  };

  const handleAssignReport = (id) =>
    wrapAction(async () => {
      const res = await api.assignReport(id);
      if (res.data?.route) {
        setSelectedReportId(id);
        const enhanced = await enhanceRouteGeometry(res.data.route);
        setActiveRoute(enhanced);
        setActiveMissionMeta({
          ambulanceName: res.data.ambulance?.name,
          hospitalName: res.data.hospital?.name,
        });
      }
      notify(
        `تم توجيه ${res.data?.ambulance?.name || "الإسعاف"} إلى البلاغ #${id} نحو ${
          res.data?.hospital?.name || "المستشفى"
        }`,
        "ok"
      );
      return res;
    });

  const handleCompleteReport = (id) =>
    wrapAction(async () => {
      await api.completeReport(id);
      if (selectedReportId === id) {
        setActiveRoute(null);
        setActiveMissionMeta(null);
      }
    }, `تم إنهاء مهمة البلاغ #${id} وعودة الإسعاف للخدمة`);

  const handleUnassignReport = (id) =>
    wrapAction(async () => {
      await api.unassignReport(id);
      if (selectedReportId === id) {
        setActiveRoute(null);
        setActiveMissionMeta(null);
      }
    }, `تم إلغاء تخصيص البلاغ #${id} وإعادته لطابور الأولوية`);

  const handleDeleteReport = (id) =>
    wrapAction(() => api.deleteReport(id), `تم حذف البلاغ #${id}`);

  const handleDispatchNext = () =>
    wrapAction(async () => {
      const res = await api.dispatchNext();
      const assigned = res.data?.assigned || [];
      if (assigned.length > 0) {
        const first = assigned[0];
        setSelectedReportId(first.report.id);
        const enhanced = await enhanceRouteGeometry(first.route);
        setActiveRoute(enhanced);
        setActiveMissionMeta({
          ambulanceName: first.ambulance?.name,
          hospitalName: first.hospital?.name,
        });
        notify(
          `تم توجيه ${first.ambulance?.name} للبلاغ الأخطر #${first.report.id} (${first.route.total_distance_km} كم)`,
          "ok"
        );
      } else {
        notify(res.data?.skipped?.[0]?.reason || "لا توجد بلاغات قابلة للتوجيه حالياً", "err");
      }
    });

  const handleDispatchAll = () =>
    wrapAction(async () => {
      const res = await api.dispatchAll();
      const assigned = res.data?.assigned || [];
      if (assigned.length > 0) {
        const first = assigned[0];
        setSelectedReportId(first.report.id);
        const enhanced = await enhanceRouteGeometry(first.route);
        setActiveRoute(enhanced);
        setActiveMissionMeta({
          ambulanceName: first.ambulance?.name,
          hospitalName: first.hospital?.name,
        });
        notify(`تم توجيه ${assigned.length} سيارة إسعاف للبلاغات المنتظرة بنجاح!`, "ok");
      } else {
        notify("لم يتم توجيه بلاغات جديدة — تحقق من توفر الإسعافات والأسرة", "err");
      }
    });

  const handleCreateReport = async (payload, autoDispatch) => {
    const res = await api.createReport(payload, autoDispatch);
    await refreshAll();
    if (res.dispatch?.route) {
      setSelectedReportId(res.data.id);
      const enhanced = await enhanceRouteGeometry(res.dispatch.route);
      setActiveRoute(enhanced);
      setActiveMissionMeta({
        ambulanceName: res.dispatch.ambulance?.name,
        hospitalName: res.dispatch.hospital?.name,
      });
    }
    notify(`تم تسجيل البلاغ #${res.data.id} بدرجة خطورة (${res.data.severity})`, "ok");
    return res;
  };

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        waitingCount={stats?.reports_waiting ?? 0}
        connMode={connMode}
        onReconnect={async () => {
          const mode = await checkBackendConnection();
          await refreshAll();
          notify(
            mode === "live"
              ? "تم الاتصال بالسيرفر الحي (Express + PostgreSQL) بنجاح"
              : "تحديث البيانات في وضع العرض التفاعلي",
            "ok"
          );
        }}
      />

      <main className="main-area">
        {toast && (
          <div className={`toast-banner ${toast.type === "err" ? "err" : "ok"}`}>
            <span>{toast.msg}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontWeight: 800,
                color: "inherit",
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {activeTab === "dashboard" && (
          <DashboardPage
            stats={stats}
            reports={reports}
            queue={queue}
            ambulances={ambulances}
            hospitals={hospitals}
            graph={graph}
            activeRoute={activeRoute}
            activeMissionMeta={activeMissionMeta}
            selectedReportId={selectedReportId}
            busyAction={busyAction}
            onShowRoute={handleShowRoute}
            onAssignReport={handleAssignReport}
            onCompleteReport={handleCompleteReport}
            onUnassignReport={handleUnassignReport}
            onDeleteReport={handleDeleteReport}
            onDispatchNext={handleDispatchNext}
            onDispatchAll={handleDispatchAll}
            onGoNewReport={() => setActiveTab("new-report")}
          />
        )}

        {activeTab === "new-report" && (
          <NewReportPage
            hospitals={hospitals}
            ambulances={ambulances}
            reports={reports}
            graph={graph}
            onCreateReport={handleCreateReport}
            onBackToDashboard={() => setActiveTab("dashboard")}
          />
        )}

        {activeTab === "ambulances" && (
          <AmbulancesPage
            ambulances={ambulances}
            busyAction={busyAction}
            onToggleStatus={(id, status) =>
              wrapAction(
                () => api.updateAmbulanceStatus(id, status),
                "تم تحديث حالة وحدة الإسعاف"
              )
            }
            onCreateAmbulance={(payload) =>
              wrapAction(
                () => api.createAmbulance(payload),
                "تمت إضافة وحدة الإسعاف الجديدة"
              )
            }
            onDeleteAmbulance={(id) =>
              wrapAction(() => api.deleteAmbulance(id), "تم حذف وحدة الإسعاف")
            }
          />
        )}

        {activeTab === "hospitals" && (
          <HospitalsPage
            hospitals={hospitals}
            busyAction={busyAction}
            onChangeBeds={(id, body) =>
              wrapAction(() => api.updateHospitalBeds(id, body), "تم تحديث الأسرة المتاحة")
            }
            onCreateHospital={(payload) =>
              wrapAction(() => api.createHospital(payload), "تمت إضافة المستشفى بنجاح")
            }
            onDeleteHospital={(id) =>
              wrapAction(() => api.deleteHospital(id), "تم حذف المستشفى")
            }
          />
        )}
      </main>
    </div>
  );
}
