import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiGet, getUrgencyLabel, getUrgencyColor, truncate } from "../utils/api";

interface Need {
  id: number; category: string; description: string; severity: number;
  urgency_score: number; status: string; location: string; zone: string;
  lat: number; lng: number; created_at: string;
}

// Volunteer's own marker
function createMyIcon() {
  return L.divIcon({
    html: `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#10B981,#2563EB);
           display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(16,185,129,0.5);
           border:3px solid white;color:white;font-size:16px;">
             <i class="bi bi-person-fill"></i>
           </div>`,
    className: "", iconSize: [36, 36], iconAnchor: [18, 18],
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  Medical: "#EF4444", Food: "#F59E0B", Shelter: "#3B82F6",
  Education: "#8B5CF6", "Mental Health": "#EC4899", Construction: "#F97316", Other: "#64748b",
};

export default function VolunteerMap() {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [myPos, setMyPos] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all"); // category filter
  const [onlyOpen, setOnlyOpen] = useState(true);

  useEffect(() => {
    loadNeeds();
    const iv = setInterval(loadNeeds, 30000);
    // Get volunteer's position for centering
    navigator.geolocation?.getCurrentPosition(pos => {
      setMyPos([pos.coords.latitude, pos.coords.longitude]);
    });
    return () => clearInterval(iv);
  }, []);

  const loadNeeds = async () => {
    const data = await apiGet("/api/needs");
    if (data?.needs) setNeeds(data.needs);
    setLoading(false);
  };

  const filtered = needs.filter(n => {
    if (onlyOpen && n.status === "completed") return false;
    if (filter !== "all" && n.category !== filter) return false;
    return n.lat && n.lng;
  });

  const categories = Array.from(new Set(needs.map(n => n.category)));
  const defaultCenter: [number, number] = myPos || [20.5937, 78.9629];
  const tileUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  return (
    <div style={{ position: "relative", height: "calc(100vh - 56px)" }}>
      {/* Filter bar */}
      <div style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
        zIndex: 1000, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center",
        background: "white", borderRadius: 14, padding: "10px 16px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)", maxWidth: "90vw",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
          <i className="bi bi-funnel"></i> Filter:
        </div>
        <button onClick={() => setFilter("all")}
          style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: "1.5px solid",
            borderColor: filter === "all" ? "#2563EB" : "#e2e8f0",
            background: filter === "all" ? "#2563EB" : "white",
            color: filter === "all" ? "white" : "#64748b", cursor: "pointer", fontWeight: 600 }}>
          All
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: "1.5px solid",
              borderColor: filter === cat ? (CATEGORY_COLORS[cat] || "#64748b") : "#e2e8f0",
              background: filter === cat ? (CATEGORY_COLORS[cat] || "#64748b") : "white",
              color: filter === cat ? "white" : "#64748b", cursor: "pointer", fontWeight: 600 }}>
            {cat}
          </button>
        ))}
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b", cursor: "pointer", marginLeft: 4 }}>
          <input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} style={{ cursor: "pointer" }} />
          Hide completed
        </label>
      </div>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 24, left: 12, zIndex: 1000,
        background: "white", borderRadius: 12, padding: "12px 16px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)", fontSize: 12,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: "#1e293b" }}>
          <i className="bi bi-info-circle me-1" style={{ color: "#2563EB" }}></i>Affected Areas
        </div>
        <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8, maxWidth: 200, lineHeight: 1.4 }}>
          Circles show community needs. Larger = higher urgency. Tap for details.
        </div>
        {[
          { label: "Critical", color: "#EF4444" }, { label: "High", color: "#F59E0B" },
          { label: "Medium", color: "#3B82F6" }, { label: "Low", color: "#10B981" },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, opacity: 0.7 }}></div>
            <span style={{ color: "#475569" }}>{label}</span>
          </div>
        ))}
        {myPos && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, paddingTop: 6, borderTop: "1px solid #e2e8f0" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "linear-gradient(135deg,#10B981,#2563EB)" }}></div>
            <span style={{ color: "#475569" }}>Your location</span>
          </div>
        )}
      </div>

      {/* Stats overlay */}
      <div style={{
        position: "absolute", top: 12, right: 12, zIndex: 1000,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {[
          { label: "Open", val: needs.filter(n => n.status === "open").length, color: "#EF4444" },
          { label: "Assigned", val: needs.filter(n => n.status === "assigned").length, color: "#F59E0B" },
          { label: "On Map", val: filtered.length, color: "#2563EB" },
        ].map(s => (
          <div key={s.label} style={{
            background: "white", borderRadius: 10, padding: "6px 12px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }}></div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{s.val}</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {loading && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          zIndex: 2000, background: "white", borderRadius: 16, padding: "20px 32px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)", textAlign: "center",
        }}>
          <div className="spinner-border text-primary mb-2" style={{ width: 32, height: 32 }}></div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Loading affected areas...</div>
        </div>
      )}

      <MapContainer center={defaultCenter} zoom={myPos ? 11 : 5} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution={tileAttribution} url={tileUrl} />

        {/* My location marker */}
        {myPos && (
          <Marker position={myPos} icon={createMyIcon()}>
            <Popup>
              <div style={{ fontWeight: 600 }}>📍 Your location</div>
            </Popup>
          </Marker>
        )}

        {/* Affected area circles */}
        {filtered.map(need => {
          const color = getUrgencyColor(need.urgency_score);
          const radius = 8 + need.urgency_score * 14;
          const catColor = CATEGORY_COLORS[need.category] || color;
          return (
            <CircleMarker
              key={`need-${need.id}`}
              center={[need.lat, need.lng]}
              radius={radius}
              pathOptions={{ color: catColor, fillColor: catColor, fillOpacity: 0.55, weight: 2 }}
            >
              <Popup>
                <div style={{ minWidth: 240, fontFamily: "inherit" }}>
                  {/* Header */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    <span style={{
                      fontSize: 11, padding: "3px 10px", borderRadius: 999, fontWeight: 600,
                      background: catColor + "22", color: catColor,
                    }}>{need.category}</span>
                    <span style={{
                      fontSize: 11, padding: "3px 10px", borderRadius: 999, color: "white",
                      background: need.status === "open" ? "#EF4444" : need.status === "assigned" ? "#F59E0B" : "#10B981",
                    }}>{need.status}</span>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: 13, margin: "0 0 8px 0", lineHeight: 1.5, color: "#1e293b" }}>
                    {truncate(need.description, 120)}
                  </p>

                  {/* Meta */}
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                    ⏱ Urgency: <strong style={{ color: "#1e293b" }}>{need.urgency_score.toFixed(2)}</strong> ({getUrgencyLabel(need.urgency_score)})
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                    📍 {need.location || "—"} {need.zone ? `• ${need.zone}` : ""}
                  </div>

                  {/* Volunteer-safe actions: Chat only, no Match/Assign */}
                  <div style={{ display: "flex", gap: 8 }}>
                    {need.status === "assigned" && (
                      <a href={`/chat/task_${need.id}`} style={{
                        fontSize: 12, padding: "6px 14px", borderRadius: 10,
                        border: "1px solid #e2e8f0", background: "#f8fafc",
                        color: "#1e293b", textDecoration: "none", fontWeight: 500,
                      }}>💬 Chat Room</a>
                    )}
                    {need.status === "open" && (
                      <span style={{
                        fontSize: 12, padding: "6px 14px", borderRadius: 10,
                        background: "rgba(239,68,68,0.1)", color: "#EF4444", fontWeight: 500,
                      }}>⚠ Awaiting Assignment</span>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
