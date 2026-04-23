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

  return (
    <div className="relative" style={{ height: "calc(100vh - 56px)" }}>
      {/* Map */}
      <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: "100%", width: "100%" }} zoomControl={true}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Need Markers */}
        {needs.filter(n => n.lat && n.lng).map(need => {
          const color = getUrgencyColor(need.urgency_score);
          const radius = 8 + (need.urgency_score * 12);
          return (
            <CircleMarker key={`need-${need.id}`} center={[need.lat, need.lng]} radius={radius} pathOptions={{ color, fillColor: color, fillOpacity: 0.6, weight: 2 }}
              >
              <Popup>
                <div className="min-w-[220px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: color + "20", color }}>{need.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${need.status === "open" ? "badge-open" : need.status === "assigned" ? "badge-assigned" : "badge-completed"}`}>{need.status}</span>
                  </div>
                  <p className="text-sm mb-2">{truncate(need.description, 100)}</p>
                  <div className="text-xs text-sra-muted mb-1"><i className="bi bi-speedometer2 me-1"></i>Urgency: <strong>{need.urgency_score.toFixed(2)}</strong> ({getUrgencyLabel(need.urgency_score)})</div>
                  <div className="text-xs text-sra-muted mb-2"><i className="bi bi-geo-alt me-1"></i>{need.location} • {need.zone}</div>
                  <div className="flex gap-2">
                    <button onClick={() => openMatchModal(need.id, need.description)} className="btn btn-sm btn-primary rounded-lg text-xs border-0" style={{ background: "#2563EB" }}><i className="bi bi-link-45deg me-1"></i>Match</button>
                    <a href={`/chat/task_${need.id}`} className="btn btn-sm btn-outline-secondary rounded-lg text-xs"><i className="bi bi-chat me-1"></i>Chat</a>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Volunteer Markers */}
        {volunteers.filter(v => v.lat && v.lng).map(vol => (
          <Marker key={`vol-${vol.id}`} position={[vol.lat, vol.lng]} icon={createVolIcon(vol.is_available)}>
            <Popup>
              <div className="min-w-[200px]">
                <div className="font-semibold text-sra-dark mb-1">{vol.name}</div>
                <div className="flex items-center gap-1 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => <i key={i} className={`bi ${i < Math.floor(vol.rating) ? "bi-star-fill text-yellow-400" : "bi-star text-gray-300"} text-xs`}></i>)}
                  <span className="text-xs text-sra-muted">{vol.rating}</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {vol.skills.map(s => <span key={s} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{s}</span>)}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${vol.is_available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{vol.is_available ? "Available" : "On Task"}</span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Filter Panel */}
      <div className="map-panel map-filter-panel">
        <button onClick={() => setFilterOpen(!filterOpen)} className="w-full flex items-center justify-between text-sm font-semibold text-sra-dark">
          <span><i className="bi bi-funnel me-2"></i>Filters</span>
          <i className={`bi ${filterOpen ? "bi-chevron-up" : "bi-chevron-down"}`}></i>
        </button>
        {filterOpen && (
          <div className="mt-3 space-y-3 fade-in-up">
            <div>
              <label className="text-xs font-medium text-sra-muted mb-1 block">Category</label>
              {["Medical", "Food", "Shelter", "Education", "Mental Health", "Construction"].map(cat => (
                <label key={cat} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                  <input type="checkbox" className="form-check-input" defaultChecked />{cat}
                </label>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-sra-muted mb-1 block">Zone</label>
              <select className="form-select form-select-sm rounded-xl border-sra-border">
                <option value="">All Zones</option>
                <option>North Delhi</option><option>South Delhi</option><option>East Delhi</option><option>West Delhi</option><option>Central Delhi</option>
              </select>
            </div>
            <button className="btn btn-sm bg-sra-primary text-white w-full rounded-xl border-0">Apply Filters</button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="map-panel map-legend top-4 right-4">
        <h6 className="text-xs font-semibold text-sra-dark mb-2">Legend</h6>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: "#EF4444" }}></span>High Urgency (&gt;0.70)</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: "#F59E0B" }}></span>Medium Urgency (0.40-0.70)</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: "#10B981" }}></span>Low Urgency (&lt;0.40)</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: "#2563EB" }}></span>Volunteer (Available)</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: "#94A3B8" }}></span>Volunteer (On Task)</div>
        </div>
      </div>

      {/* Live Stats */}
      <div className="map-panel bottom-8 right-4">
        <div className="flex gap-6 text-xs">
          <div><span className="text-sra-muted">Open Needs:</span> <strong className="text-sra-danger">{openNeeds}</strong></div>
          <div><span className="text-sra-muted">Active Vols:</span> <strong className="text-sra-primary">{activeVols}</strong></div>
        </div>
      </div>

      {/* Match Modal */}
      {matchModal.open && (
        <div className="fixed inset-0 bg-black/50 z-[1001] flex items-center justify-center p-4" onClick={() => setMatchModal(m => ({ ...m, open: false }))}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-sra-border flex items-center justify-between">
              <h3 className="font-semibold text-sra-dark text-sm">Top Matches for "{matchModal.needDesc}"</h3>
              <button onClick={() => setMatchModal(m => ({ ...m, open: false }))} className="btn-close"></button>
            </div>
            <div className="p-5">
              {matchModal.matches.length > 0 ? matchModal.matches.map((m: any, i: number) => (
                <div key={m.volunteer_id} className={`flex items-center gap-4 p-4 rounded-xl mb-3 border ${i === 0 ? "border-sra-primary bg-blue-50/30" : "border-sra-border"}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? "bg-sra-primary text-white" : "bg-slate-100 text-sra-muted"}`}>#{i + 1}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sra-dark text-sm">{m.name}</div>
                    <div className="text-xs text-sra-muted mt-1">{m.distance_km} km • Skill: {m.skill_score} • Geo: {m.geo_score}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-sra-primary">{(m.final_score * 100).toFixed(0)}%</div>
                    <button onClick={() => { setMatchModal(m => ({ ...m, open: false })); }} className="btn btn-sm bg-sra-primary text-white mt-1 rounded-xl border-0 px-3 text-xs"><i className="bi bi-check2 me-1"></i>Assign</button>
                  </div>
                </div>
              )) : <div className="text-center py-8 text-sra-muted"><i className="bi bi-people text-3xl block mb-2 opacity-30"></i>No matching volunteers found</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
