import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost, getUrgencyClass, getUrgencyLabel, SRA, formatDate } from "../utils/api";

const CATEGORY_LIST = ["Medical","Food","Shelter","Education","Mental Health","Construction","Other"];

interface Need {
  id: number; category: string; description: string; severity: number;
  urgency_score: number; status: string; location: string; zone: string;
  created_at: string;
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const [myNeeds, setMyNeeds] = useState<Need[]>([]);
  const [openNeeds, setOpenNeeds] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [form, setForm] = useState({
    category: "Medical", description: "", severity: "5",
    location: "", zone: "", lat: "", lng: "",
  });

  const userName = SRA.name || "Member";

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [myData, allData] = await Promise.all([
      apiGet("/api/needs?status=all"),
      apiGet("/api/needs"),
    ]);
    if (myData?.needs) setMyNeeds(myData.needs.slice(0, 5));
    if (allData?.needs) setOpenNeeds(allData.needs);
    setLoading(false);
  };

  const getLocation = () => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setForm(f => ({ ...f, lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(""); setSubmitSuccess("");
    if (!form.description.trim()) { setSubmitError("Please describe the need."); return; }
    setSubmitting(true);
    try {
      const payload: any = {
        category: form.category,
        description: form.description,
        severity: parseInt(form.severity),
        location: form.location,
        zone: form.zone,
      };
      if (form.lat && form.lng) { payload.lat = parseFloat(form.lat); payload.lng = parseFloat(form.lng); }
      const res = await apiPost("/api/needs", payload);
      if (res?.need_id) {
        setSubmitSuccess(`Need #${res.need_id} submitted! Urgency score: ${(res.urgency_score * 100).toFixed(0)}%`);
        setForm({ category: "Medical", description: "", severity: "5", location: "", zone: "", lat: "", lng: "" });
        setShowSubmit(false);
        loadData();
      } else {
        setSubmitError(res?.message || "Submission failed.");
      }
    } catch (e: any) { setSubmitError(e.message || "Submission failed."); }
    setSubmitting(false);
  };

  const urgencyBg = (score: number) => {
    if (score >= 0.8) return "rgba(239,68,68,0.12)";
    if (score >= 0.6) return "rgba(245,158,11,0.12)";
    if (score >= 0.4) return "rgba(59,130,246,0.12)";
    return "rgba(100,116,139,0.1)";
  };

  const statusColor = (s: string) => s === "open" ? "#EF4444" : s === "assigned" ? "#F59E0B" : "#10B981";

  return (
    <div className="container-fluid px-3 px-md-4" style={{ maxWidth: 1100, margin: "0 auto", paddingTop: "1.5rem", paddingBottom: "3rem" }}>

      {/* Welcome banner */}
      <div className="mb-4 p-4 rounded-3 text-white d-flex align-items-center gap-3"
        style={{ background: "linear-gradient(135deg,#2563EB,#10B981)", boxShadow: "0 4px 24px rgba(37,99,235,0.2)" }}>
        <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
          style={{ width: 52, height: 52, background: "rgba(255,255,255,0.18)" }}>
          <i className="bi bi-person-heart" style={{ fontSize: 26 }}></i>
        </div>
        <div className="flex-grow-1">
          <h5 className="mb-0 fw-bold">Welcome, {userName} 👋</h5>
          <p className="mb-0 opacity-75 small">Community Member Dashboard — Report a need or track open requests in your area.</p>
        </div>
        <button onClick={() => setShowSubmit(true)}
          className="btn btn-light btn-sm fw-semibold d-flex align-items-center gap-2 flex-shrink-0"
          style={{ borderRadius: 10, padding: "8px 16px" }}>
          <i className="bi bi-plus-circle"></i> Report a Need
        </button>
      </div>

      {/* Success message */}
      {submitSuccess && (
        <div className="alert alert-success d-flex align-items-center gap-2 mb-4" style={{ borderRadius: 12 }}>
          <i className="bi bi-check-circle-fill"></i> {submitSuccess}
        </div>
      )}

      {/* Stats row */}
      <div className="row g-3 mb-4">
        {[
          { icon: "bi-clipboard-pulse", label: "Open Needs", val: openNeeds.filter(n => n.status === "open").length, color: "#EF4444" },
          { icon: "bi-clock-history", label: "Assigned", val: openNeeds.filter(n => n.status === "assigned").length, color: "#F59E0B" },
          { icon: "bi-check-circle", label: "Completed", val: openNeeds.filter(n => n.status === "completed").length, color: "#10B981" },
          { icon: "bi-geo-alt", label: "Zones Active", val: new Set(openNeeds.map(n => n.zone).filter(Boolean)).size, color: "#2563EB" },
        ].map(stat => (
          <div key={stat.label} className="col-6 col-md-3">
            <div className="card border-0 h-100" style={{ borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <div className="card-body d-flex align-items-center gap-3 p-3">
                <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 44, height: 44, background: stat.color + "18" }}>
                  <i className={`bi ${stat.icon}`} style={{ fontSize: 20, color: stat.color }}></i>
                </div>
                <div>
                  <div className="fw-bold fs-5 lh-1">{loading ? "—" : stat.val}</div>
                  <div className="text-muted small">{stat.label}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4">
        {/* Open needs feed */}
        <div className="col-lg-8">
          <div className="card border-0" style={{ borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <div className="card-header border-0 bg-transparent d-flex align-items-center justify-content-between pt-3 pb-0 px-4">
              <h6 className="fw-bold mb-0"><i className="bi bi-list-ul me-2 text-primary"></i>Open Needs in Your Area</h6>
              <button onClick={() => navigate("/map")} className="btn btn-sm btn-outline-primary" style={{ borderRadius: 8, fontSize: 12 }}>
                <i className="bi bi-map me-1"></i>View Map
              </button>
            </div>
            <div className="card-body p-3">
              {loading ? (
                <div className="text-center py-4 text-muted"><div className="spinner-border spinner-border-sm me-2"></div>Loading needs...</div>
              ) : openNeeds.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-emoji-smile fs-1 d-block mb-2"></i>No open needs right now — things look good!
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {openNeeds.slice(0, 10).map(need => (
                    <div key={need.id} className="p-3 rounded-3" style={{ background: urgencyBg(need.urgency_score), border: "1px solid rgba(0,0,0,0.06)" }}>
                      <div className="d-flex align-items-start gap-2 mb-1">
                        <span className="badge rounded-pill" style={{ background: statusColor(need.status) + "20", color: statusColor(need.status), fontWeight: 600, fontSize: 10 }}>
                          {need.category}
                        </span>
                        <span className="badge rounded-pill ms-auto" style={{ background: statusColor(need.status), color: "white", fontSize: 10 }}>
                          {need.status}
                        </span>
                      </div>
                      <p className="mb-1 small fw-medium" style={{ lineHeight: 1.5 }}>{need.description}</p>
                      <div className="d-flex align-items-center gap-3" style={{ fontSize: 11, color: "#64748b" }}>
                        <span><i className="bi bi-geo-alt me-1"></i>{need.location || need.zone || "—"}</span>
                        <span><i className="bi bi-clock me-1"></i>{formatDate(need.created_at)}</span>
                        <span className={`ms-auto fw-semibold urgency-${getUrgencyClass(need.urgency_score)}`}>
                          {getUrgencyLabel(need.urgency_score)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions sidebar */}
        <div className="col-lg-4">
          <div className="card border-0 mb-3" style={{ borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <div className="card-body p-4">
              <h6 className="fw-bold mb-3"><i className="bi bi-lightning-fill me-2 text-warning"></i>Quick Actions</h6>
              <div className="d-flex flex-column gap-2">
                <button onClick={() => setShowSubmit(true)}
                  className="btn btn-primary d-flex align-items-center gap-2 w-100"
                  style={{ borderRadius: 10, justifyContent: "flex-start" }}>
                  <i className="bi bi-plus-circle-fill"></i> Report a Community Need
                </button>
                <button onClick={() => navigate("/map")}
                  className="btn btn-outline-secondary d-flex align-items-center gap-2 w-100"
                  style={{ borderRadius: 10, justifyContent: "flex-start" }}>
                  <i className="bi bi-map"></i> View Affected Areas Map
                </button>
                <button onClick={() => navigate("/chat/general")}
                  className="btn btn-outline-secondary d-flex align-items-center gap-2 w-100"
                  style={{ borderRadius: 10, justifyContent: "flex-start" }}>
                  <i className="bi bi-chat-dots"></i> Community Chat
                </button>
              </div>
            </div>
          </div>

          <div className="card border-0" style={{ borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <div className="card-body p-4">
              <h6 className="fw-bold mb-3"><i className="bi bi-info-circle me-2 text-info"></i>About This Platform</h6>
              <p className="text-muted small mb-2">
                This platform connects community members who need help with trained volunteers and NGO resources.
              </p>
              <p className="text-muted small mb-0">
                Report needs using the button above. Volunteers and admins will be notified and matched automatically.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Need Modal */}
      {showSubmit && (
        <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 9999 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0" style={{ borderRadius: 20 }}>
              <div className="modal-header border-0 pb-0 px-4 pt-4">
                <h5 className="modal-title fw-bold"><i className="bi bi-clipboard-plus me-2 text-primary"></i>Report a Community Need</h5>
                <button type="button" className="btn-close" onClick={() => { setShowSubmit(false); setSubmitError(""); }}></button>
              </div>
              <div className="modal-body px-4 pb-4">
                {submitError && (
                  <div className="alert alert-danger d-flex gap-2 align-items-center" style={{ borderRadius: 10, fontSize: 14 }}>
                    <i className="bi bi-exclamation-circle"></i>{submitError}
                  </div>
                )}
                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small">Category</label>
                      <select className="form-select" style={{ borderRadius: 10 }}
                        value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                        {CATEGORY_LIST.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small">Severity (1 = low, 10 = critical)</label>
                      <input type="range" className="form-range mt-2" min={1} max={10}
                        value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} />
                      <div className="text-center small text-muted">Level {form.severity}</div>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold small">Description <span className="text-danger">*</span></label>
                      <textarea className="form-control" rows={4} style={{ borderRadius: 10 }}
                        placeholder="Describe the need in detail — who is affected, what is needed, and how urgent..."
                        value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small">Location / Address</label>
                      <input className="form-control" style={{ borderRadius: 10 }}
                        placeholder="e.g. North Delhi Community Centre"
                        value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small">Zone / Area</label>
                      <input className="form-control" style={{ borderRadius: 10 }}
                        placeholder="e.g. North Delhi"
                        value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} />
                    </div>
                    <div className="col-12">
                      <div className="d-flex gap-2">
                        <div className="flex-1" style={{ flex: 1 }}>
                          <label className="form-label fw-semibold small">Latitude (optional)</label>
                          <input className="form-control" style={{ borderRadius: 10 }} placeholder="e.g. 28.7041"
                            value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
                        </div>
                        <div className="flex-1" style={{ flex: 1 }}>
                          <label className="form-label fw-semibold small">Longitude (optional)</label>
                          <input className="form-control" style={{ borderRadius: 10 }} placeholder="e.g. 77.1025"
                            value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
                        </div>
                        <div className="d-flex align-items-end">
                          <button type="button" className="btn btn-outline-secondary" style={{ borderRadius: 10, whiteSpace: "nowrap" }}
                            onClick={getLocation}><i className="bi bi-geo-alt"></i> My Location</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="d-flex gap-2 mt-4">
                    <button type="button" className="btn btn-light flex-1" style={{ borderRadius: 10 }}
                      onClick={() => { setShowSubmit(false); setSubmitError(""); }}>Cancel</button>
                    <button type="submit" disabled={submitting} className="btn btn-primary flex-1" style={{ borderRadius: 10 }}>
                      {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Submitting...</> : <><i className="bi bi-send me-2"></i>Submit Need</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
