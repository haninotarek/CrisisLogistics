import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const REGIONS = [
  { id: "sinai", label: "شمال سيناء والقناة", center: [31.05, 32.85], zoom: 9 },
  { id: "cairo", label: "القاهرة الكبرى", center: [30.0444, 31.2357], zoom: 11 },
  { id: "alex", label: "الإسكندرية", center: [31.2001, 29.9187], zoom: 11 },
  { id: "delta", label: "الدلتا", center: [30.85, 31.25], zoom: 9 },
  { id: "upper", label: "الصعيد", center: [26.8, 31.5], zoom: 7 },
  { id: "all", label: "مصر كلها", center: [29.4, 31.7], zoom: 6 },
];

function makeBubbleIcon(emoji, cls) {
  return L.divIcon({
    className: "crisis-div-icon",
    html: `<div class="marker-bubble ${cls}"><span>${emoji}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function MapClickHandler({ onPickLocation }) {
  useMapEvents({
    click(e) {
      if (onPickLocation) {
        onPickLocation({
          latitude: Number(e.latlng.lat.toFixed(6)),
          longitude: Number(e.latlng.lng.toFixed(6)),
        });
      }
    },
  });
  return null;
}

function MapViewportController({ targetView, activeRoute }) {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 120);
  }, [map]);

  useEffect(() => {
    if (!targetView) return;
    if (targetView.bounds && targetView.bounds.length >= 2) {
      map.fitBounds(targetView.bounds, { padding: [44, 44], maxZoom: 13 });
    } else if (targetView.center) {
      map.flyTo(targetView.center, targetView.zoom || 12, { duration: 0.9 });
    }
  }, [map, targetView]);

  useEffect(() => {
    if (!activeRoute) return;
    const pts = [];
    const leg1 =
      activeRoute.ambulance_to_patient?.road_coordinates ||
      activeRoute.ambulance_to_patient?.coordinates ||
      [];
    const leg2 =
      activeRoute.patient_to_hospital?.road_coordinates ||
      activeRoute.patient_to_hospital?.coordinates ||
      [];
    leg1.forEach((p) => pts.push(p));
    leg2.forEach((p) => pts.push(p));
    if (pts.length >= 2) {
      map.fitBounds(pts, { padding: [48, 48], maxZoom: 13 });
    }
  }, [map, activeRoute]);

  return null;
}

export default function InteractiveCrisisMap({
  hospitals = [],
  ambulances = [],
  reports = [],
  graph = null,
  activeRoute = null,
  activeMissionMeta = null,
  pickedLocation = null,
  onPickLocation = null,
  onSelectReport = null,
  onAssignReport = null,
  focusCoords = null,
  height = 490,
}) {
  const [tileMode, setTileMode] = useState("street"); // "street" | "satellite"
  const [showGraphEdges, setShowGraphEdges] = useState(false);
  const [showHospitals, setShowHospitals] = useState(true);
  const [showAmbulances, setShowAmbulances] = useState(true);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [targetView, setTargetView] = useState({ center: [30.88, 32.55], zoom: 8 });

  useEffect(() => {
    if (focusCoords?.latitude && focusCoords?.longitude) {
      setTargetView({
        center: [Number(focusCoords.latitude), Number(focusCoords.longitude)],
        zoom: focusCoords.zoom || 12,
        ts: Date.now(),
      });
    }
  }, [focusCoords]);

  const icons = useMemo(
    () => ({
      hospOk: makeBubbleIcon("🏥", "hosp-ok"),
      hospFull: makeBubbleIcon("🏥", "hosp-full"),
      ambAvail: makeBubbleIcon("🚑", "amb-available"),
      ambBusy: makeBubbleIcon("🚑", "amb-busy"),
      ambOff: makeBubbleIcon("🚑", "amb-offline"),
      repCrit: makeBubbleIcon("⚠️", "rep-critical"),
      repMed: makeBubbleIcon("⚠️", "rep-medium"),
      repLow: makeBubbleIcon("⚠️", "rep-low"),
      pickPin: makeBubbleIcon("📍", "pick-pin"),
    }),
    []
  );

  const graphPolylines = useMemo(() => {
    if (!showGraphEdges || !graph?.nodes || !graph?.edges) return [];
    const nMap = new Map();
    graph.nodes.forEach((n) => {
      nMap.set(n.node_id || n.id, [
        Number(n.latitude ?? n.lat),
        Number(n.longitude ?? n.lng),
      ]);
    });
    const lines = [];
    graph.edges.forEach((e) => {
      const a = nMap.get(e.from_node || e.from);
      const b = nMap.get(e.to_node || e.to);
      if (a && b) lines.push([a, b]);
    });
    return lines;
  }, [showGraphEdges, graph]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setGpsCoords([lat, lng]);
        setTargetView({ center: [lat, lng], zoom: 13, ts: Date.now() });
        if (onPickLocation) onPickLocation({ latitude: lat, longitude: lng });
      },
      () => {
        // Fallback to Romana / North Sinai center if browser blocks geolocation
        const lat = 31.014033;
        const lng = 32.662891;
        setGpsCoords([lat, lng]);
        setTargetView({ center: [lat, lng], zoom: 12, ts: Date.now() });
        if (onPickLocation) onPickLocation({ latitude: lat, longitude: lng });
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const leg1 =
    activeRoute?.ambulance_to_patient?.road_coordinates ||
    activeRoute?.ambulance_to_patient?.coordinates ||
    null;
  const leg2 =
    activeRoute?.patient_to_hospital?.road_coordinates ||
    activeRoute?.patient_to_hospital?.coordinates ||
    null;

  return (
    <div className="map-wrapper" style={{ height, minHeight: height }}>
      {/* Top Interactive Controls HUD */}
      <div className="map-hud-top">
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`map-chip ${tileMode === "street" ? "active" : ""}`}
            onClick={() => setTileMode("street")}
          >
            🗺️ شوارع
          </button>
          <button
            type="button"
            className={`map-chip ${tileMode === "satellite" ? "active" : ""}`}
            onClick={() => setTileMode("satellite")}
          >
            🛰️ قمر صناعي
          </button>
          <button
            type="button"
            className={`map-chip ${showGraphEdges ? "active" : ""}`}
            onClick={() => setShowGraphEdges((v) => !v)}
            title="إظهار/إخفاء شبكة الطرق (Dijkstra Graph)"
          >
            🕸️ الشبكة
          </button>
          <button
            type="button"
            className={`map-chip ${showHospitals ? "active" : ""}`}
            onClick={() => setShowHospitals((v) => !v)}
          >
            🏥 المستشفيات
          </button>
          <button
            type="button"
            className={`map-chip ${showAmbulances ? "active" : ""}`}
            onClick={() => setShowAmbulances((v) => !v)}
          >
            🚑 الإسعافات
          </button>
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <select
            className="map-chip"
            defaultValue="sinai"
            onChange={(e) => {
              const r = REGIONS.find((x) => x.id === e.target.value);
              if (r) setTargetView({ center: r.center, zoom: r.zoom, ts: Date.now() });
            }}
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                📍 {r.label}
              </option>
            ))}
          </select>
          <button type="button" className="map-chip" onClick={handleLocateMe}>
            🎯 موقعي GPS
          </button>
        </div>
      </div>

      <MapContainer
        center={[30.88, 32.55]}
        zoom={8}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        {tileMode === "street" ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution="&copy; Esri World Imagery"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        <MapClickHandler onPickLocation={onPickLocation} />
        <MapViewportController targetView={targetView} activeRoute={activeRoute} />

        {/* Optional Dijkstra Graph Network Overlay */}
        {graphPolylines.map((pair, idx) => (
          <Polyline
            key={`edge-${idx}`}
            positions={pair}
            pathOptions={{ color: "#3b82f6", weight: 1.5, opacity: 0.38, dashArray: "4 4" }}
          />
        ))}

        {/* Mission Route Leg 1: Ambulance -> Patient */}
        {leg1 && leg1.length >= 2 && (
          <>
            <Polyline
              positions={leg1}
              pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.9 }}
            />
            <Polyline
              positions={leg1}
              pathOptions={{
                color: "#f97316",
                weight: 5,
                opacity: 0.96,
                dashArray: "10 8",
              }}
            />
          </>
        )}

        {/* Mission Route Leg 2: Patient -> Hospital */}
        {leg2 && leg2.length >= 2 && (
          <>
            <Polyline
              positions={leg2}
              pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.9 }}
            />
            <Polyline
              positions={leg2}
              pathOptions={{ color: "#2563eb", weight: 5.5, opacity: 0.98 }}
            />
          </>
        )}

        {/* Hospitals */}
        {showHospitals &&
          hospitals.map((h) => (
            <Marker
              key={`hosp-${h.id}`}
              position={[Number(h.latitude), Number(h.longitude)]}
              icon={h.available_beds > 0 ? icons.hospOk : icons.hospFull}
            >
              <Popup>
                <div style={{ direction: "rtl", textAlign: "right", fontFamily: "Cairo, sans-serif", minWidth: 180 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 4 }}>
                    🏥 {h.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    العقدة: <b>{h.node_id}</b>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 3 }}>
                    الأسرة المتاحة:{" "}
                    <b style={{ color: h.available_beds > 0 ? "#16a34a" : "#dc2626" }}>
                      {h.available_beds}
                    </b>{" "}
                    من {h.total_beds}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Ambulances */}
        {showAmbulances &&
          ambulances.map((a) => {
            const icon =
              a.status === "available"
                ? icons.ambAvail
                : a.status === "busy"
                ? icons.ambBusy
                : icons.ambOff;
            const statusAr =
              a.status === "available"
                ? "متاحة"
                : a.status === "busy"
                ? "مشغولة في مهمة"
                : "خارج الخدمة";
            return (
              <Marker
                key={`amb-${a.id}`}
                position={[Number(a.latitude), Number(a.longitude)]}
                icon={icon}
              >
                <Popup>
                  <div style={{ direction: "rtl", textAlign: "right", fontFamily: "Cairo, sans-serif", minWidth: 170 }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 4 }}>
                      🚑 {a.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569" }}>
                      العقدة: <b>{a.node_id}</b> • الحالة: <b>{statusAr}</b>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* Active & Waiting Patient Reports */}
        {reports
          .filter((r) => r.status !== "done")
          .map((r) => {
            const icon =
              r.severity === "Critical"
                ? icons.repCrit
                : r.severity === "Medium"
                ? icons.repMed
                : icons.repLow;
            return (
              <Marker
                key={`rep-${r.id}`}
                position={[Number(r.latitude), Number(r.longitude)]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    if (onSelectReport) onSelectReport(r);
                  },
                }}
              >
                <Popup>
                  <div style={{ direction: "rtl", textAlign: "right", fontFamily: "Cairo, sans-serif", minWidth: 195 }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5 }}>
                      ⚠️ بلاغ #{r.id} — {r.patient_name || "مصاب"}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>
                      الإصابة: <b>{r.injury_type}</b> ({r.severity})
                    </div>
                    <div style={{ fontSize: 12, color: "#475569" }}>
                      الأولوية: <b>{r.priority_score}/100</b>
                    </div>
                    {r.status === "waiting" && onAssignReport && (
                      <button
                        type="button"
                        onClick={() => onAssignReport(r.id)}
                        style={{
                          marginTop: 8,
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: 7,
                          border: "none",
                          background: "#2563eb",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        🚑 إرسال أقرب إسعاف فوراً
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* Picked Location Pin (New Report Mode) */}
        {pickedLocation?.latitude && pickedLocation?.longitude && (
          <Marker
            position={[Number(pickedLocation.latitude), Number(pickedLocation.longitude)]}
            icon={icons.pickPin}
          >
            <Popup>
              <div style={{ direction: "rtl", textAlign: "right", fontFamily: "Cairo, sans-serif" }}>
                <b>📍 موقع البلاغ المحدد</b>
                <div style={{ fontSize: 11.5 }}>
                  {pickedLocation.latitude}, {pickedLocation.longitude}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* User Live GPS Radar Dot */}
        {gpsCoords && (
          <CircleMarker
            center={gpsCoords}
            radius={9}
            pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#0ea5e9", fillOpacity: 1 }}
          />
        )}
      </MapContainer>

      {/* Bottom Active Mission Route Telemetry HUD */}
      {activeRoute && (
        <div className="map-route-hud">
          <div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>
              🛣️ مسار المهمة النشط (Dijkstra + Street Routing)
            </div>
            <div style={{ fontSize: 11.5, color: "#cbd5e1", marginTop: 2 }}>
              {activeMissionMeta?.ambulanceName && (
                <span>🟠 {activeMissionMeta.ambulanceName} ← المصاب &nbsp;|&nbsp; </span>
              )}
              {activeMissionMeta?.hospitalName && (
                <span>🔵 المصاب ← {activeMissionMeta.hospitalName}</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>المسافة الكلية: </span>
              <b style={{ color: "#38bdf8" }}>{activeRoute.total_distance_km} كم</b>
            </div>
            <div>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>زمن الوصول: </span>
              <b style={{ color: "#4ade80" }}>{activeRoute.total_eta_minutes} دقيقة</b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
