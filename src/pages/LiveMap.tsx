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
interface Volunteer {
  id: number; name: string; lat: number; lng: number;
  is_available: boolean; rating: number; skills: string[];
}

function createVolIcon(available: boolean) {
  return L.divIcon({
    html: `<div class="vol-marker ${available ? "available" : "on-task"}"><i class="bi bi-person-fill"></i></div>`,
    className: "", iconSize: [32, 32], iconAnchor: [16, 16],
  });
}

export default function LiveMap() {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [matchModal, setMatchModal] = useState<{ open: boolean; matches: any[]; needDesc: string; needId: number }>({ open: false, matches: [], needDesc: "", needId: 0 });

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const [needsData, volsData] = await Promise.all([apiGet("/api/needs"), apiGet("/api/volunteers/location")]);
    if (needsData?.needs) setNeeds(needsData.needs);
    if (volsData?.volunteers) setVolunteers(volsData.volunteers);
  };

  const openMatchModal = async (needId: number, desc: string) => {
    const data = await apiGet(`/api/match/${needId}`);
    setMatchModal({ open: true, matches: data?.matches || [], needDesc: truncate(desc, 40), needId });
  };

  const openNeeds = needs.filter(n => n.status === "open").length;
  const activeVols = volunteers.filter(v => v.is_available).length;

  const tileUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  return (
    <div className="relative" style={{ height: "calc(100vh - 56px)" }}>
      <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: "100%", width: "100%" }} zoomControl={true}>
        <TileLayer attribution={tileAttribution} url={tileUrl} />

        {needs.filter(n => n.lat && n.lng).map(need => {
          const color = getUrgencyColor(need.urgency_score);
          const radius = 8 + (need.urgency_score * 12);
          return (
            <CircleMarker key={`need-${need.id}`} center={[need.lat, need.lng]} radius={radius} pathOptions={{ color, fillColor: color, fillOpacity: 0.6, weight: 2 }}>
              <Popup>
                <div style={{ minWidth: "240px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "999px", fontWeight: 600, background: color + "20", color }}>{need.category}</span>
                    <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: need.status === "open" ? "#EF4444" : need.status === "assigned" ? "#F59E0B" : "#10B981", color: "white" }}>{need.status}</span>
                  </div>
                  <p style={{ fontSize: "13px", margin: "0 0 8px 0", lineHeight: "1.5", color: "var(--sra-popup-text)" }}>{truncate(need.description, 100)}</p>
                  <div style={{ fontSize: "12px", color: "var(--sra-text-secondary)", marginBottom: "4px" }}>⏱ Urgency: <strong style={{ color: "var(--sra-popup-text)" }}>{need.urgency_score.toFixed(2)}</strong> ({getUrgencyLabel(need.urgency_score)})</div>
                  <div style={{ fontSize: "12px", color: "var(--sra-text-secondary)", marginBottom: "12px" }}>📍 {need.location} • {need.zone}</div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => openMatchModal(need.id, need.description)} style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "10px", border: "none", background: "#2563EB", color: "white", cursor: "pointer", fontWeight: 500 }}>🔗 Match</button>
                    <a href={`/chat/task_${need.id}`} style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "10px", border: "1px solid var(--sra-border)", background: "var(--sra-bg-input)", color: "var(--sra-popup-text)", textDecoration: "none", fontWeight: 500 }}>💬 Chat</a>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {volunteers.filter(v => v.lat && v.lng).map(vol => (
          <Marker key={`vol-${vol.id}`} position={[vol.lat, vol.lng]} icon={createVolIcon(vol.is_available)}>
            <Popup>
              <div style={{ minWidth: "220px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "6px", color: "var(--sra-popup-text)" }}>{vol.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "2px", marginBottom: "8px" }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} style={{ color: i < Math.floor(vol.rating) ? "#F59E0B" : "#64748b", fontSize: "13px" }}>★</span>
                  ))}
                  <span style={{ fontSize: "12px", color: "var(--sra-text-secondary)", marginLeft: "4px" }}>{vol.rating}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px" }}>
                  {vol.skills.map(s => (
                    <span key={s} style={{ fontSize: "10px", background: "rgba(37,99,235,0.1)", color: "#60a5fa", padding: "2px 8px", borderRadius: "6px" }}>{s}</span>
                  ))}
                </div>
                <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: vol.is_available ? "rgba(16,185,129,0.15)" : "rgba(100,116,139,0.15)", color: vol.is_available ? "#34d399" : "#94a3b8" }}>{vol.is_available ? "Available" : "On Task"}</span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Filter Panel */}
      <div className="map-panel map-filter-panel">
        <button onClick={() => setFilterOpen(!filterOpen)} className="w-full flex items-center justify-between text-sm font-semibold" style={{ color: "var(--sra-text-primary)", background: "none", border: "none", cursor: "pointer" }}>
          <span><i className="bi bi-funnel me-2" style={{ color: "#2563EB" }}></i>Filters</span>
          <i className={`bi ${filterOpen ? "bi-chevron-up" : "bi-chevron-down"} transition-transform duration-200`}></i>
        </button>
        {filterOpen && (
          <div className="mt-4 space-y-4 fade-in-up">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: "var(--sra-text-secondary)" }}>Category</label>
              <div className="space-y-1.5">
                {["Medical", "Food", "Shelter", "Education", "Mental Health", "Construction"].map(cat => (
                  <label key={cat} className="flex items-center gap-2.5 text-sm cursor-pointer py-0.5" style={{ color: "var(--sra-text-primary)" }}>
                    <input type="checkbox" className="form-check-input" defaultChecked />{cat}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: "var(--sra-text-secondary)" }}>Zone</label>
              <select className="form-select form-select-sm">
                <option value="">All Zones</option>
                <option>North Delhi</option><option>South Delhi</option><option>East Delhi</option><option>West Delhi</option><option>Central Delhi</option>
              </select>
            </div>
            <button className="btn btn-sm text-white w-full rounded-xl border-0 font-medium" style={{ background: "#2563EB" }}>
              <i className="bi bi-funnel me-1"></i>Apply Filters
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="map-panel map-legend">
        <h6 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--sra-text-primary)" }}>
          <i className="bi bi-info-circle me-1.5" style={{ color: "#2563EB" }}></i>Legend
        </h6>
        <div className="space-y-2.5">
          {[
            { color: "#EF4444", label: "High Urgency (>0.70)" },
            { color: "#F59E0B", label: "Medium Urgency (0.40-0.70)" },
            { color: "#10B981", label: "Low Urgency (<0.40)" },
            { color: "#2563EB", label: "Volunteer (Available)" },
            { color: "#94A3B8", label: "Volunteer (On Task)" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2.5 text-xs" style={{ color: "var(--sra-text-primary)" }}>
              <span className="flex-shrink-0" style={{ width: "14px", height: "14px", borderRadius: "50%", background: item.color, display: "inline-block" }}></span>
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Live Stats */}
      <div className="map-panel map-stats">
        <div className="flex gap-6 text-xs font-medium">
          <div>
            <span style={{ color: "var(--sra-text-secondary)" }}>Open Needs:</span>{" "}
            <strong style={{ color: "#EF4444", fontSize: "14px" }}>{openNeeds}</strong>
          </div>
          <div>
            <span style={{ color: "var(--sra-text-secondary)" }}>Active Vols:</span>{" "}
            <strong style={{ color: "#2563EB", fontSize: "14px" }}>{activeVols}</strong>
          </div>
        </div>
      </div>

      {/* Match Modal */}
      {matchModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1001] flex items-center justify-center p-4" onClick={() => setMatchModal(m => ({ ...m, open: false }))}>
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm" style={{ color: "var(--sra-text-primary)" }}>Top Matches for &ldquo;{matchModal.needDesc}&rdquo;</h3>
              <button onClick={() => setMatchModal(m => ({ ...m, open: false }))} className="btn-close"></button>
            </div>
            <div className="p-5">
              {matchModal.matches.length > 0 ? matchModal.matches.map((m: any, i: number) => (
                <div key={m.volunteer_id} className={`flex items-center gap-4 p-4 rounded-xl mb-3 border transition-all duration-200 hover:shadow-md ${i === 0 ? "border-sra-primary bg-blue-50/30" : "border-sra-border hover:border-blue-200"}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${i === 0 ? "text-white" : ""}`} style={{ background: i === 0 ? "#2563EB" : "var(--sra-bg-input)", color: i === 0 ? "white" : "var(--sra-text-secondary)" }}>#{i + 1}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm" style={{ color: "var(--sra-text-primary)" }}>{m.name}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--sra-text-secondary)" }}>{m.distance_km} km • Skill: {m.skill_score} • Geo: {m.geo_score}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-sra-primary">{(m.final_score * 100).toFixed(0)}%</div>
                    <button onClick={() => setMatchModal(m => ({ ...m, open: false }))} className="btn btn-sm bg-sra-primary text-white mt-1 rounded-xl border-0 px-3 text-xs transition-all duration-200 hover:scale-105">
                      <i className="bi bi-check2 me-1"></i>Assign
                    </button>
                  </div>
                </div>
              )) : <div className="text-center py-8" style={{ color: "var(--sra-text-secondary)" }}><i className="bi bi-people text-3xl block mb-2 opacity-30"></i>No matching volunteers found</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}