import React, { useMemo, useState } from "react";
import { Ambulance, Plus, Search, Power, Trash2, X } from "lucide-react";

const STATUS_META = {
  available: { text: "متاحة", cls: "badge-available" },
  busy: { text: "مشغولة بمهمة", cls: "badge-busy" },
  offline: { text: "خارج الخدمة", cls: "badge-offline" },
};

export default function AmbulancesPage({
  ambulances,
  busyAction,
  onToggleStatus,
  onCreateAmbulance,
  onDeleteAmbulance,
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    latitude: 31.132,
    longitude: 33.803,
    status: "available",
  });
  const [formError, setFormError] = useState("");

  const counts = useMemo(
    () => ({
      all: ambulances.length,
      available: ambulances.filter((a) => a.status === "available").length,
      busy: ambulances.filter((a) => a.status === "busy").length,
      offline: ambulances.filter((a) => a.status === "offline").length,
    }),
    [ambulances]
  );

  const filtered = useMemo(() => {
    return ambulances.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          String(a.node_id || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [ambulances, statusFilter, search]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("يرجى إدخال اسم وحدة الإسعاف");
      return;
    }
    try {
      setFormError("");
      await onCreateAmbulance({
        name: form.name.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        status: form.status,
      });
      setShowModal(false);
      setForm({ name: "", latitude: 31.132, longitude: 33.803, status: "available" });
    } catch (err) {
      setFormError(err.message);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">إدارة وحدات الإسعاف</h1>
          <p className="page-subtitle">
            متابعة أسطول سيارات الإسعاف ({counts.all} وحدة) وتحديث حالتها التشغيلية لحظياً
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          <span>إضافة سيارة إسعاف</span>
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="pill-group">
            {[
              { id: "all", label: `الكل (${counts.all})` },
              { id: "available", label: `متاحة (${counts.available})` },
              { id: "busy", label: `مشغولة (${counts.busy})` },
              { id: "offline", label: `خارج الخدمة (${counts.offline})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`filter-pill ${statusFilter === t.id ? "active" : ""}`}
                onClick={() => setStatusFilter(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Search size={15} color="#64748b" />
            <input
              type="text"
              className="form-input"
              style={{ padding: "6px 11px", width: 220 }}
              placeholder="ابحث بالاسم أو كود العقدة (A_S00)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="figma-table">
            <thead>
              <tr>
                <th>#</th>
                <th>اسم وحدة الإسعاف</th>
                <th>عقدة الشبكة</th>
                <th>الإحداثيات</th>
                <th>الحالة</th>
                <th>المهمة النشطة</th>
                <th>التحكم</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#64748b" }}>
                    لا توجد وحدات إسعاف مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const st = STATUS_META[a.status] || STATUS_META.offline;
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 700, color: "#64748b" }}>#{a.id}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                          <Ambulance size={16} color="#2563eb" />
                          <span>{a.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-done" style={{ fontFamily: "monospace" }}>
                          {a.node_id}
                        </span>
                      </td>
                      <td dir="ltr" style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
                        {Number(a.latitude).toFixed(4)}, {Number(a.longitude).toFixed(4)}
                      </td>
                      <td>
                        <span className={`badge ${st.cls}`}>{st.text}</span>
                      </td>
                      <td>
                        {a.active_report_id ? (
                          <span className="badge badge-assigned">بلاغ #{a.active_report_id}</span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {a.status !== "busy" && (
                            <button
                              type="button"
                              className={`btn btn-xs ${
                                a.status === "available" ? "btn-outline" : "btn-success"
                              }`}
                              disabled={busyAction}
                              onClick={() =>
                                onToggleStatus(
                                  a.id,
                                  a.status === "available" ? "offline" : "available"
                                )
                              }
                            >
                              <Power size={13} />
                              <span>
                                {a.status === "available" ? "إيقاف مؤقت" : "تفعيل للخدمة"}
                              </span>
                            </button>
                          )}
                          {a.status !== "busy" && (
                            <button
                              type="button"
                              className="btn btn-xs btn-danger"
                              disabled={busyAction}
                              onClick={() => onDeleteAmbulance(a.id)}
                              title="حذف وحدة الإسعاف"
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

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 17, fontWeight: 800 }}>إضافة سيارة إسعاف جديدة</h3>
              <button
                type="button"
                className="btn btn-xs btn-outline"
                onClick={() => setShowModal(false)}
              >
                <X size={14} />
              </button>
            </div>

            {formError && <div className="field-error">{formError}</div>}

            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="form-field">
                <label className="form-label">اسم وتمركز الوحدة *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: إسعاف العريش - وسط البلد"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">خط العرض (Latitude)</label>
                  <input
                    type="number"
                    step="any"
                    dir="ltr"
                    className="form-input"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">خط الطول (Longitude)</label>
                  <input
                    type="number"
                    step="any"
                    dir="ltr"
                    className="form-input"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                حفظ وإضافة للأسطول
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
