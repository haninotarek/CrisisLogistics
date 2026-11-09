import React, { useState } from "react";
import { Send, MapPin, Search, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import InteractiveCrisisMap from "../components/InteractiveCrisisMap";
import { enhanceRouteGeometry } from "../services/api";

const INJURY_TYPES = [
  "حادث سيارة",
  "ألم في الصدر",
  "سقوط من ارتفاع",
  "حروق",
  "جرح قطعي",
  "كسر في الذراع أو الساق",
  "إغماء",
  "اختناق أو صعوبة تنفس",
  "إصابة أخرى",
];

const BLEEDING_OPTIONS = [
  { value: "none", label: "لا يوجد" },
  { value: "mild", label: "خفيف" },
  { value: "moderate", label: "متوسط" },
  { value: "severe", label: "شديد" },
];

const PHONE_RE = /^\+?[0-9][0-9\s-]{3,18}$/;

export default function NewReportPage({
  hospitals,
  ambulances,
  reports,
  graph,
  onCreateReport,
  onBackToDashboard,
}) {
  const [form, setForm] = useState({
    patient_name: "",
    age: "",
    injury_type: "حادث سيارة",
    injured_count: 1,
    conscious: true,
    bleeding: "none",
    breathing_issue: false,
    pain_level: 6,
    reporter_name: "",
    reporter_phone: "",
    latitude: 31.014033,
    longitude: 32.662891,
    auto_dispatch: true,
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [resultRoute, setResultRoute] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [focusCoords, setFocusCoords] = useState(null);

  const updateField = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const validateForm = () => {
    const errs = {};
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      errs.latitude = "يرجى تحديد خط عرض صحيح من الخريطة";
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      errs.longitude = "يرجى تحديد خط طول صحيح من الخريطة";
    }
    if (!form.injury_type || !form.injury_type.trim()) {
      errs.injury_type = "نوع الإصابة مطلوب";
    }
    if (form.age !== "" && (Number(form.age) < 0 || Number(form.age) > 130)) {
      errs.age = "العمر يجب أن يكون بين 0 و 130";
    }
    if (Number(form.injured_count) < 1 || Number(form.injured_count) > 1000) {
      errs.injured_count = "عدد المصابين يجب أن يكون 1 على الأقل";
    }
    if (form.reporter_phone && !PHONE_RE.test(form.reporter_phone.trim())) {
      errs.reporter_phone = "رقم الهاتف غير صالح (مثال: 01012345678)";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSearchPlace = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchingPlace(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=eg&limit=1&q=${encodeURIComponent(
        searchQuery.trim()
      )}`;
      const res = await fetch(url);
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const lat = Number(Number(list[0].lat).toFixed(6));
        const lng = Number(Number(list[0].lon).toFixed(6));
        updateField("latitude", lat);
        updateField("longitude", lng);
        setFocusCoords({ latitude: lat, longitude: lng, zoom: 13 });
      }
    } catch {
      // Ignore search network error silently
    } finally {
      setSearchingPlace(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        patient_name: form.patient_name.trim() || undefined,
        age: form.age !== "" ? Number(form.age) : undefined,
        injury_type: form.injury_type,
        injured_count: Number(form.injured_count || 1),
        conscious: Boolean(form.conscious),
        bleeding: form.bleeding,
        breathing_issue: Boolean(form.breathing_issue),
        pain_level: Number(form.pain_level),
        reporter_name: form.reporter_name.trim() || undefined,
        reporter_phone: form.reporter_phone.trim() || undefined,
      };

      const res = await onCreateReport(payload, form.auto_dispatch);
      setSubmitResult(res);

      if (res?.dispatch?.route) {
        const enhanced = await enhanceRouteGeometry(res.dispatch.route);
        setResultRoute(enhanced);
      } else {
        setResultRoute(null);
      }
    } catch (err) {
      setErrors({ submit: err.message || "تعذر تسجيل البلاغ" });
    } finally {
      setSubmitting(false);
    }
  };

  const sevBadgeClass = (sev) =>
    sev === "Critical"
      ? "badge-critical"
      : sev === "Medium"
      ? "badge-medium"
      : "badge-low";

  const sevText = (sev) =>
    sev === "Critical" ? "حرجة (Critical)" : sev === "Medium" ? "متوسطة (Medium)" : "بسيطة (Low)";

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">تسجيل بلاغ طوارئ جديد</h1>
          <p className="page-subtitle">
            أدخل الحالة الطبية وحدد موقع الحادث على الخريطة ليقوم النظام بتصنيف الخطورة (AI Triage) وإرسال أقرب إسعاف فوراً
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={onBackToDashboard}>
          <ArrowLeft size={16} />
          <span>العودة للوحة التحكم</span>
        </button>
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="toast-banner err">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={18} />
            <span>
              {errors.submit || "يرجى مراجعة الحقول المطلوبة باللون الأحمر قبل إرسال البلاغ"}
            </span>
          </div>
        </div>
      )}

      <div className="report-layout">
        {/* Right Column (RTL): Clinical Triage Form */}
        <div className="card" style={{ padding: 20 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, borderBottom: "1px solid #e2e8f0", paddingBottom: 10 }}>
              بيانات المصاب والفرز الطبي
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label className="form-label">اسم المصاب (اختياري)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: أحمد محمود"
                  value={form.patient_name}
                  onChange={(e) => updateField("patient_name", e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label">العمر التقديري</label>
                <input
                  type="number"
                  min={0}
                  max={130}
                  className={`form-input ${errors.age ? "invalid" : ""}`}
                  placeholder="مثال: 35"
                  value={form.age}
                  onChange={(e) => updateField("age", e.target.value)}
                />
                {errors.age && <span className="field-error">{errors.age}</span>}
              </div>

              <div className="form-field">
                <label className="form-label">نوع الإصابة *</label>
                <select
                  className={`form-select ${errors.injury_type ? "invalid" : ""}`}
                  value={form.injury_type}
                  onChange={(e) => updateField("injury_type", e.target.value)}
                >
                  {INJURY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {errors.injury_type && <span className="field-error">{errors.injury_type}</span>}
              </div>

              <div className="form-field">
                <label className="form-label">عدد المصابين *</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={`form-input ${errors.injured_count ? "invalid" : ""}`}
                  value={form.injured_count}
                  onChange={(e) => updateField("injured_count", e.target.value)}
                />
                {errors.injured_count && <span className="field-error">{errors.injured_count}</span>}
              </div>

              {/* Consciousness Toggle */}
              <div className="form-field">
                <label className="form-label">حالة الوعي *</label>
                <div className="seg-group">
                  <button
                    type="button"
                    className={`seg-btn ${form.conscious ? "active" : ""}`}
                    onClick={() => updateField("conscious", true)}
                  >
                    واعي
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${!form.conscious ? "active-danger" : ""}`}
                    onClick={() => updateField("conscious", false)}
                  >
                    فاقد الوعي
                  </button>
                </div>
              </div>

              {/* Breathing Toggle */}
              <div className="form-field">
                <label className="form-label">صعوبة في التنفس؟ *</label>
                <div className="seg-group">
                  <button
                    type="button"
                    className={`seg-btn ${!form.breathing_issue ? "active" : ""}`}
                    onClick={() => updateField("breathing_issue", false)}
                  >
                    تنفس طبيعي
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${form.breathing_issue ? "active-danger" : ""}`}
                    onClick={() => updateField("breathing_issue", true)}
                  >
                    صعوبة بالتنفس
                  </button>
                </div>
              </div>

              {/* Bleeding Level */}
              <div className="form-field full">
                <label className="form-label">مستوى النزيف *</label>
                <div className="seg-group">
                  {BLEEDING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`seg-btn ${
                        form.bleeding === opt.value
                          ? opt.value === "severe"
                            ? "active-danger"
                            : "active"
                          : ""
                      }`}
                      onClick={() => updateField("bleeding", opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pain Slider */}
              <div className="form-field full">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label className="form-label">شدة الألم (0 - 10)</label>
                  <span
                    className={`badge ${
                      form.pain_level >= 8
                        ? "badge-critical"
                        : form.pain_level >= 5
                        ? "badge-medium"
                        : "badge-low"
                    }`}
                  >
                    {form.pain_level} / 10
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={form.pain_level}
                  onChange={(e) => updateField("pain_level", Number(e.target.value))}
                  style={{ width: "100%", accentColor: form.pain_level >= 8 ? "#dc2626" : "#2563eb" }}
                />
              </div>

              {/* Reporter Info */}
              <div className="form-field">
                <label className="form-label">اسم المُبلّغ</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: سامي حسن"
                  value={form.reporter_name}
                  onChange={(e) => updateField("reporter_name", e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label">رقم هاتف المُبلّغ</label>
                <input
                  type="tel"
                  dir="ltr"
                  className={`form-input ${errors.reporter_phone ? "invalid" : ""}`}
                  placeholder="01012345678"
                  value={form.reporter_phone}
                  onChange={(e) => updateField("reporter_phone", e.target.value)}
                />
                {errors.reporter_phone && <span className="field-error">{errors.reporter_phone}</span>}
              </div>

              {/* Coordinates */}
              <div className="form-field">
                <label className="form-label">خط العرض (Latitude) *</label>
                <input
                  type="number"
                  step="any"
                  dir="ltr"
                  className={`form-input ${errors.latitude ? "invalid" : ""}`}
                  value={form.latitude}
                  onChange={(e) => updateField("latitude", e.target.value)}
                />
                {errors.latitude && <span className="field-error">{errors.latitude}</span>}
              </div>

              <div className="form-field">
                <label className="form-label">خط الطول (Longitude) *</label>
                <input
                  type="number"
                  step="any"
                  dir="ltr"
                  className={`form-input ${errors.longitude ? "invalid" : ""}`}
                  value={form.longitude}
                  onChange={(e) => updateField("longitude", e.target.value)}
                />
                {errors.longitude && <span className="field-error">{errors.longitude}</span>}
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                fontSize: 13,
                fontWeight: 700,
                background: "#f8fafc",
                padding: "10px 12px",
                borderRadius: 9,
                border: "1px solid #e2e8f0",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.auto_dispatch}
                onChange={(e) => updateField("auto_dispatch", e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#2563eb" }}
              />
              <span>إرسال أقرب سيارة إسعاف وتخصيص أنسب مستشفى تلقائياً فور التسجيل</span>
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ padding: "12px 18px", fontSize: 15 }}
            >
              <Send size={17} />
              <span>{submitting ? "جاري تحليل الحالة وتوجيه الإسعاف..." : "إرسال البلاغ وتوجيه الإسعاف"}</span>
            </button>
          </form>
        </div>

        {/* Left Column (RTL): Dispatch Result Card (Figma Screen 4) + Interactive Map Picker */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {submitResult?.data && (
            <div className="result-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 15, color: "#1e3a8a" }}>
                  <CheckCircle2 size={20} color="#16a34a" />
                  <span>تم تسجيل البلاغ #{submitResult.data.id} بنجاح</span>
                </div>
                <span className={`badge ${sevBadgeClass(submitResult.data.severity)}`}>
                  الخطورة: {sevText(submitResult.data.severity)}
                </span>
              </div>

              <div className="result-metrics">
                <div className="metric-box">
                  <div className="metric-label">نقاط الأولوية (Triage Score)</div>
                  <div className="metric-val">{submitResult.data.priority_score} / 100</div>
                </div>
                <div className="metric-box">
                  <div className="metric-label">مصدر التصنيف</div>
                  <div className="metric-val">
                    {submitResult.triage_source === "ai" ? "موديل الذكاء الاصطناعي" : "القواعد الطبية"}
                  </div>
                </div>
                <div className="metric-box">
                  <div className="metric-label">الإسعاف الموجه</div>
                  <div className="metric-val">
                    {submitResult.dispatch?.ambulance?.name || "في طابور الانتظار"}
                  </div>
                </div>
                <div className="metric-box">
                  <div className="metric-label">المستشفى المستهدف</div>
                  <div className="metric-val">
                    {submitResult.dispatch?.hospital?.name || "بانتظار التخصيص"}
                  </div>
                </div>
                {submitResult.dispatch?.route && (
                  <>
                    <div className="metric-box">
                      <div className="metric-label">إجمالي مسافة المهمة (Dijkstra)</div>
                      <div className="metric-val" style={{ color: "#2563eb" }}>
                        {submitResult.dispatch.route.total_distance_km} كم
                      </div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-label">الوقت المتوقع للوصول (ETA)</div>
                      <div className="metric-val" style={{ color: "#16a34a" }}>
                        {submitResult.dispatch.route.total_eta_minutes} دقيقة
                      </div>
                    </div>
                  </>
                )}
              </div>

              {submitResult.dispatch_error && (
                <div style={{ fontSize: 12.5, color: "#b45309", fontWeight: 700 }}>
                  ملاحظة: تم حفظ البلاغ في طابور الأولوية ({submitResult.dispatch_error})
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <MapPin size={17} color="#2563eb" />
                <span>اضغط على الخريطة لتحديد موقع البلاغ أو ابحث بالاسم</span>
              </div>
              <form onSubmit={handleSearchPlace} style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: "5px 10px", fontSize: 12.5, width: 175 }}
                  placeholder="ابحث (العريش، رمانة، بورسعيد...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-xs btn-outline" disabled={searchingPlace}>
                  <Search size={13} />
                  <span>{searchingPlace ? "..." : "بحث"}</span>
                </button>
              </form>
            </div>

            <InteractiveCrisisMap
              hospitals={hospitals}
              ambulances={ambulances}
              reports={reports}
              graph={graph}
              pickedLocation={{ latitude: form.latitude, longitude: form.longitude }}
              onPickLocation={({ latitude, longitude }) => {
                updateField("latitude", latitude);
                updateField("longitude", longitude);
              }}
              activeRoute={resultRoute}
              activeMissionMeta={
                submitResult?.dispatch
                  ? {
                      ambulanceName: submitResult.dispatch.ambulance?.name,
                      hospitalName: submitResult.dispatch.hospital?.name,
                    }
                  : null
              }
              focusCoords={focusCoords}
              height={460}
            />
          </div>
        </div>
      </div>
    </>
  );
}
