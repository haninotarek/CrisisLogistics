import axios from "axios";
import { mockBackend } from "./mockBackend";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const http = axios.create({
  baseURL: API_BASE,
  timeout: 3500,
  headers: { "Content-Type": "application/json" },
});

let connectionMode = "checking"; // "live" | "demo" | "checking"
const listeners = new Set();

function setMode(next) {
  if (connectionMode !== next) {
    connectionMode = next;
    listeners.forEach((fn) => fn(connectionMode));
  }
}

export function subscribeConnectionMode(fn) {
  listeners.add(fn);
  fn(connectionMode);
  return () => listeners.delete(fn);
}

export function getConnectionMode() {
  return connectionMode;
}

export async function checkBackendConnection() {
  try {
    const res = await http.get("/health", { timeout: 1800 });
    if (res.data?.success && res.data?.database === "connected") {
      setMode("live");
      return "live";
    }
  } catch {
    // Fallback cleanly to interactive demo mode when backend/DB is not running
  }
  setMode("demo");
  return "demo";
}

function extractError(err) {
  if (err?.response?.data) {
    const d = err.response.data;
    if (Array.isArray(d.details) && d.details.length > 0) {
      return d.details.join(" • ");
    }
    if (d.message) return d.message;
  }
  return err?.message || "حدث خطأ غير متوقع";
}

async function callOrFallback(liveFn, demoFn) {
  if (connectionMode === "checking") {
    await checkBackendConnection();
  }
  if (connectionMode === "live") {
    try {
      const res = await liveFn();
      return res.data;
    } catch (err) {
      // Network/503 DB down -> switch to demo; 4xx validation/conflict -> surface real backend error!
      if (!err.response || err.response.status === 503 || err.response.status === 502 || err.response.status === 404 && !err.response.data?.message) {
        setMode("demo");
        return demoFn();
      }
      throw new Error(extractError(err));
    }
  }
  return demoFn();
}

export const api = {
  getStats: () => callOrFallback(() => http.get("/stats"), () => mockBackend.getStats()),

  getReports: (params = {}) =>
    callOrFallback(
      () => http.get("/reports", { params }),
      () => mockBackend.getReports(params)
    ),

  getQueue: () =>
    callOrFallback(
      () => http.get("/reports/queue"),
      () => mockBackend.getQueue()
    ),

  createReport: (payload, autoDispatch = true) =>
    callOrFallback(
      () => http.post(`/reports${autoDispatch ? "?auto_dispatch=true" : ""}`, payload),
      () => mockBackend.createReport(payload, autoDispatch)
    ),

  assignReport: (id) =>
    callOrFallback(
      () => http.post(`/reports/${id}/assign`),
      () => mockBackend.assignReport(id)
    ),

  completeReport: (id) =>
    callOrFallback(
      () => http.post(`/reports/${id}/complete`),
      () => mockBackend.completeReport(id)
    ),

  unassignReport: (id) =>
    callOrFallback(
      () => http.post(`/reports/${id}/unassign`),
      () => mockBackend.unassignReport(id)
    ),

  deleteReport: (id) =>
    callOrFallback(
      () => http.delete(`/reports/${id}`),
      () => mockBackend.deleteReport(id)
    ),

  getReportRoute: (id) =>
    callOrFallback(
      () => http.get(`/reports/${id}/route`),
      () => mockBackend.getReportRoute(id)
    ),

  dispatchNext: () =>
    callOrFallback(
      () => http.post("/dispatch/next"),
      () => mockBackend.dispatchNext()
    ),

  dispatchAll: () =>
    callOrFallback(
      () => http.post("/dispatch/all"),
      () => mockBackend.dispatchAll()
    ),

  getAmbulances: (status = "") =>
    callOrFallback(
      () => http.get("/ambulances", { params: status ? { status } : {} }),
      () => mockBackend.getAmbulances(status)
    ),

  createAmbulance: (payload) =>
    callOrFallback(
      () => http.post("/ambulances", payload),
      () => mockBackend.createAmbulance(payload)
    ),

  updateAmbulanceStatus: (id, status) =>
    callOrFallback(
      () => http.patch(`/ambulances/${id}/status`, { status }),
      () => mockBackend.updateAmbulanceStatus(id, status)
    ),

  deleteAmbulance: (id) =>
    callOrFallback(
      () => http.delete(`/ambulances/${id}`),
      () => mockBackend.deleteAmbulance(id)
    ),

  getHospitals: (onlyAvailable = false) =>
    callOrFallback(
      () => http.get(onlyAvailable ? "/hospitals/available" : "/hospitals"),
      () => mockBackend.getHospitals(onlyAvailable)
    ),

  createHospital: (payload) =>
    callOrFallback(
      () => http.post("/hospitals", payload),
      () => mockBackend.createHospital(payload)
    ),

  updateHospitalBeds: (id, body) =>
    callOrFallback(
      () => http.patch(`/hospitals/${id}/beds`, body),
      () => mockBackend.updateHospitalBeds(id, body)
    ),

  deleteHospital: (id) =>
    callOrFallback(
      () => http.delete(`/hospitals/${id}`),
      () => mockBackend.deleteHospital(id)
    ),

  getGraph: () =>
    callOrFallback(
      () => http.get("/graph"),
      () => mockBackend.getGraph()
    ),
};

async function fetchOsrmLeg(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return coords;
  const start = coords[0];
  const end = coords[coords.length - 1];
  if (!start || !end) return coords;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return coords;
    const json = await res.json();
    const geo = json?.routes?.[0]?.geometry?.coordinates;
    if (Array.isArray(geo) && geo.length > 2) {
      return geo.map(([lng, lat]) => [lat, lng]);
    }
  } catch {
    // Keep Dijkstra node-to-node polyline if OSRM times out
  }
  return coords;
}

export async function enhanceRouteGeometry(route) {
  if (!route) return null;
  const [leg1Coords, leg2Coords] = await Promise.all([
    route.ambulance_to_patient?.coordinates
      ? fetchOsrmLeg(route.ambulance_to_patient.coordinates)
      : Promise.resolve(null),
    route.patient_to_hospital?.coordinates
      ? fetchOsrmLeg(route.patient_to_hospital.coordinates)
      : Promise.resolve(null),
  ]);
  return {
    ...route,
    ambulance_to_patient: route.ambulance_to_patient
      ? { ...route.ambulance_to_patient, road_coordinates: leg1Coords }
      : null,
    patient_to_hospital: route.patient_to_hospital
      ? { ...route.patient_to_hospital, road_coordinates: leg2Coords }
      : null,
  };
}
