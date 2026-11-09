import React, { useMemo, useState } from "react";
import { Building2, Plus, Search, Minus, Trash2, X } from "lucide-react";

export default function HospitalsPage({
  hospitals,
  busyAction,
  onChangeBeds,
  onCreateHospital,
  onDeleteHospital,
}) {
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    latitude: 31.132,
    longitude: 33.803,
    total_beds: 100,
    available_beds: 60,
  });
  const [formError, setFormError] = useState("");

  const filtered = useMemo(() => {
    return hospitals.filter((h) => {
      if (onlyAvailable && h.available_beds <= 0) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          h.name.toLowerCase().includes(q) ||
          String(h.node_id || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [hospitals, onlyAvailable, search]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("يرجى إدخال اسم المستشفى");
      return;
    }
    try {
      setFormError("");
      await onCreateHospital({
        name: form.name.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        total_beds: Number(form.total_beds),
        available_beds: Number(form.available_beds),
      });
      setShowModal(false);
      setForm({
        name: "",
        latitude: 31.132,
        longitude: 33.803,
        total_beds: 100,
        available_beds: 60,
      });
    } catch (err) {
      setFormError(err.message);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">المستشفيات والطاقة الاستيعابية</h1>
          <p className="page-subtitle">
            متابعة السعة السريرية الحية في {hospitals.length} مستشفى وتحديث الأسرة المتاحة لاستقبال الحالات
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          <span>إضافة مستشفى</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div
        className="card"
        style={{
          padding: "12px 18px",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div className="pill-group">
          <button
            type="button"
            className={`filter-pill ${!onlyAvailable ? "active" : ""}`}
            onClick={() => setOnlyAvailable(false)}
          >
            كل المستشفيات ({hospitals.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${onlyAvailable ? "active" : ""}`}
            onClick={() => setOnlyAvailable(true)}
          >
            بها أسرة متاحة ({hospitals.filter((h) => h.available_beds > 0).length})
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Search size={15} color="#64748b" />
          <input
            type="text"
            className="form-input"
            style={{ padding: "6px 11px", width: 235 }}
            placeholder="ابحث باسم المستشفى أو العقدة (H_S01)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Figma Hospital Cards Grid */}
      <div className="hospitals-grid">
        {filtered.map((h) => {
          const ratio = h.total_beds > 0 ? h.available_beds / h.total_beds : 0;
          const pct = Math.round(ratio * 100);
          const barColor =
            h.available_beds === 0
              ? "#dc2626"
              : ratio < 0.25
              ? "#d97706"
              : "#16a34a";

          return (
            <div key={h.id} className="hospital-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: h.available_beds > 0 ? "#f0fdf4" : "#fef2f2",
                      color: h.available_beds > 0 ? "#16a34a" : "#dc2626",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Building2 size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{h.name}</div>
                    <div style={{ fontSize: 11.5, color: "#64748b" }}>العقدة: {h.node_id}</div>
                  </div>
                </div>

                <span
                  className={`badge ${
                    h.available_beds === 0
                      ? "badge-critical"
                      : ratio < 0.25
                      ? "badge-medium"
                      : "badge-low"
                  }`}
                >
                  {h.available_beds === 0 ? "ممتلئ" : "متاح"}
                </span>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                  <span style={{ color: "#64748b", fontWeight: 600 }}>الأسرة المتاحة</span>
                  <span style={{ fontWeight: 800 }}>
                    <span style={{ color: barColor, fontSize: 15 }}>{h.available_beds}</span> / {h.total_beds} ({pct}%)
                  </span>
                </div>
                <div className="beds-bar-track">
                  <div
                    className="beds-bar-fill"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    disabled={busyAction || h.available_beds <= 0}
                    onClick={() => onChangeBeds(h.id, { change: -1 })}
                    title="إشغال سرير (-1)"
                  >
                    <Minus size={13} />
                    <span>إشغال سرير</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-success"
                    disabled={busyAction || h.available_beds >= h.total_beds}
                    onClick={() => onChangeBeds(h.id, { change: 1 })}
                    title="إخلاء سرير (+1)"
                  >
                    <Plus size={13} />
                    <span>إخلاء سرير</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-xs btn-danger"
                  disabled={busyAction}
                  onClick={() => onDeleteHospital(h.id)}
                  title="حذف المستشفى"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 17, fontWeight: 800 }}>🏥 إضافة مستشفى جديد</h3>
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
                <label className="form-label">اسم المستشفى *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: مستشفى العريش التخصصي"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">إجمالي الأسرة *</label>
                  <input
                    type="number"
                    min={1}
                    className="form-input"
                    value={form.total_beds}
                    onChange={(e) => setForm({ ...form, total_beds: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">الأسرة المتاحة حالياً *</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input"
                    value={form.available_beds}
                    onChange={(e) => setForm({ ...form, available_beds: e.target.value })}
                  />
                </div>
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
                حفظ وإضافة للشبكة
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
