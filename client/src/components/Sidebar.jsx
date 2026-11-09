import React from "react";
import {
  LayoutDashboard,
  FilePlus2,
  Ambulance,
  Building2,
  RefreshCw,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { id: "new-report", label: "بلاغ جديد", icon: FilePlus2 },
  { id: "ambulances", label: "الإسعافات", icon: Ambulance },
  { id: "hospitals", label: "المستشفيات", icon: Building2 },
];

export default function Sidebar({
  activeTab,
  onSelectTab,
  waitingCount = 0,
  connMode = "demo",
  onReconnect,
}) {
  return (
    <>
      {/* Desktop Right RTL Sidebar */}
      <aside className="figma-sidebar">
        <div className="brand-box">
          <div className="brand-logo">🚑</div>
          <div>
            <div className="brand-title">الحقني</div>
            <div className="brand-subtitle">إدارة الطوارئ والإمداد الطبي</div>
          </div>
        </div>

        <nav className="nav-list">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-btn ${isActive ? "active" : ""}`}
                onClick={() => onSelectTab(item.id)}
              >
                <span className="nav-btn-inner">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </span>
                {item.id === "dashboard" && waitingCount > 0 && (
                  <span className="nav-badge">{waitingCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="conn-pill">
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span className={`conn-dot ${connMode === "live" ? "live" : "demo"}`} />
              <span>
                {connMode === "live" ? "متصل بالسيرفر (API)" : "وضع العرض التفاعلي"}
              </span>
            </span>
            <button
              type="button"
              onClick={onReconnect}
              title="إعادة فحص الاتصال بالسيرفر وتحديث البيانات"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#475569",
                display: "flex",
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", padding: "0 4px" }}>
            CrisisLogistics · Frontend (لوزة)
          </div>
        </div>
      </aside>

      {/* Mobile Responsive Header & Tabs (Matches Figma Mobile Screens) */}
      <header className="mobile-topbar">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div className="brand-logo" style={{ width: 32, height: 32, fontSize: 15 }}>
              🚑
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>الحقني</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>غرفة تحكم الإسعاف</div>
            </div>
          </div>
          <span className="badge badge-assigned" style={{ fontSize: 11 }}>
            {connMode === "live" ? "متصل API" : "وضع تفاعلي"}
          </span>
        </div>

        <div className="mobile-tabs">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`btn btn-xs ${isActive ? "btn-primary" : "btn-outline"}`}
                onClick={() => onSelectTab(item.id)}
                style={{ flexDirection: "column", gap: 3, padding: "7px 4px" }}
              >
                <Icon size={15} />
                <span style={{ fontSize: 11 }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>
    </>
  );
}
