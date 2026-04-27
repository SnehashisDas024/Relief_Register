import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiUpload, getUrgencyClass, getUrgencyLabel, truncate, getCategoryColor, timeAgo } from "../utils/api";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

// Center text plugin for doughnut
const centerTextPlugin = {
  id: "centerText",
  afterDraw(chart: any) {
    if (chart.config.type !== "doughnut") return;
    const { ctx, chartArea: { top, bottom, left, right } } = chart;
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const total = chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 28px system-ui"; ctx.fillStyle = "#1E293B";
    ctx.fillText(total, centerX, centerY - 8);
    ctx.font = "12px system-ui"; ctx.fillStyle = "#64748B";
    ctx.fillText("Total Needs", centerX, centerY + 14);
    ctx.restore();
  },
};
ChartJS.register(centerTextPlugin);

interface Need {
  id: number; category: string; description: string; severity: number;
  urgency_score: number; status: string; location: string; zone: string;
  lat: number; lng: number; created_at: string;
}
interface Match { volunteer_id: number; name: string; skills: string[]; distance_km: string; skill_score: number; geo_score: number; final_score: number; }

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [showMatch, setShowMatch] = useState(false);
  const [matchData, setMatchData] = useState<{ matches: Match[]; needDesc: string }>({ matches: [], needDesc: "" });
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pipeline, setPipeline] = useState<{ source_id: string; stage: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pipelineStages = ["extracted", "cleaned", "classified", "scored", "matched", "notified"];

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const [statsData, needsData] = await Promise.all([apiGet("/api/admin/stats"), apiGet("/api/needs")]);
    setStats(statsData);
    if (needsData?.needs) setNeeds(needsData.needs.filter((n: Need) => n.status !== "completed").slice(0, 10));
  };

  const countUp = (el: HTMLElement | null, target: number, suffix = "") => {
    if (!el) return;
    let current = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(timer); }
      el.textContent = current.toLocaleString() + suffix;
    }, 20);
  };

  const openMatchModal = async (needId: number, desc: string) => {
    const data = await apiGet(`/api/match/${needId}`);
    setMatchData({ matches: data?.matches || [], needDesc: truncate(desc, 40) });
    setShowMatch(true);
  };

  const confirmAssign = async (needId: number, volId: number) => {
    await apiPost("/api/assign", { need_id: needId, volunteer_id: volId });
    setShowMatch(false);
    loadData();
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);
    try {
      const data = await apiPost("/api/upload", formData);
      if (data?.source_id) {
        setPipeline({ source_id: data.source_id, stage: "extracted" });
        pollPipeline(data.source_id);
      }
    } catch { /* error handled */ }
    setUploading(false);
  };

  const pollPipeline = useCallback((_sourceId: string) => {
    let stageIdx = 0;
    const timer = setInterval(async () => {
      stageIdx++;
      if (stageIdx >= pipelineStages.length) {
        setPipeline(p => p ? { ...p, stage: "notified" } : null);
        clearInterval(timer);
        return;
      }
      setPipeline(p => p ? { ...p, stage: pipelineStages[stageIdx] } : null);
    }, 2000);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setUploadFile(file);
  };

  const barChartData = stats ? {
    labels: Object.keys(stats.needs_by_category || {}),
    datasets: [{
      data: Object.values(stats.needs_by_category || {}),
      backgroundColor: Object.keys(stats.needs_by_category || {}).map(k => getCategoryColor(k)),
      borderRadius: 6, barThickness: 28,
    }],
  } : null;

  const doughnutData = stats ? {
    labels: ["Open", "Assigned", "Completed"],
    datasets: [{ data: [stats.status_distribution?.open || 0, stats.status_distribution?.assigned || 0, stats.status_distribution?.completed || 0], backgroundColor: ["#EF4444", "#F59E0B", "#10B981"], borderWidth: 0, cutout: "72%" }],
  } : null;

  return (
    <div className="flex min-h-screen bg-sra-light">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-0 overflow-hidden"} lg:w-56 sra-sidebar flex-shrink-0 transition-all duration-300`}>
        <div className="px-4 py-3 border-b border-white/10">
          <span className="text-white font-bold text-sm">Smart Resource Allocation</span>
        </div>
        <nav className="mt-2">
          {[
            { to: "/dashboard", icon: "bi-speedometer2", label: "Dashboard", active: true },
            { to: "/map", icon: "bi-map", label: "Live Map" },
            { to: "#upload-section", icon: "bi-upload", label: "Upload Data" },
            { to: "#needs-table", icon: "bi-list-check", label: "Needs Queue" },
            { to: "/admin", icon: "bi-people", label: "Volunteers" },
            { to: "/admin", icon: "bi-gear", label: "Admin Panel" },
          ].map((link, i) => (
            <Link key={i} to={link.to} className={`nav-link no-underline ${link.active ? "active" : ""}`}>
              <i className={`bi ${link.icon}`}></i>{link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-4 py-3 border-t border-white/10">
          <div className="text-white text-sm font-medium">{localStorage.getItem("sra_name")}</div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Admin</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden btn btn-sm btn-outline-secondary mb-3">
          <i className="bi bi-list"></i>Menu
        </button>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { icon: "bi-exclamation-triangle-fill", iconClass: "kpi-icon-danger", label: "Open Needs", value: stats?.open_needs || 0, sub: "+3 in last hour", color: "text-sra-danger" },
            { icon: "bi-check-circle-fill", iconClass: "kpi-icon-success", label: "Completed Today", value: stats?.completed_today || 0, sub: "Avg 2.4 hrs resolution", color: "text-sra-secondary" },
            { icon: "bi-person-check-fill", iconClass: "kpi-icon-primary", label: "Active Volunteers", value: stats?.active_volunteers || 0, sub: "8 currently on task", color: "text-sra-primary" },
            { icon: "bi-graph-up", iconClass: "kpi-icon-info", label: "Match Success Rate", value: Math.round((stats?.match_success_rate || 0) * 100), sub: "Last 30 days", color: "text-sra-info", suffix: "%" },
          ].map((kpi, i) => (
            <div key={i} className="sra-card sra-card-hover p-5">
              <div className="flex items-start gap-4">
                <div className={`kpi-icon ${kpi.iconClass}`}><i className={`bi ${kpi.icon}`}></i></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium uppercase tracking-wider text-sra-muted mb-1">{kpi.label}</div>
                  <div ref={el => { if (el && stats) countUp(el, kpi.value, kpi.suffix || ""); }} className={`text-3xl font-bold ${kpi.color}`}>{kpi.suffix === "%" ? "0%" : "0"}</div>
                  <div className="text-xs text-sra-muted mt-1">{kpi.sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 mb-6">
          <div className="lg:col-span-4 sra-card p-5">
            <h3 className="text-sm font-semibold text-sra-dark mb-4">Needs by Category — This Week</h3>
            {barChartData && <Bar data={barChartData} options={{ indexAxis: "y", responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { display: false } } } }} />}
          </div>
          <div className="lg:col-span-3 sra-card p-5">
            <h3 className="text-sm font-semibold text-sra-dark mb-4">Status Distribution</h3>
            {doughnutData && <div className="max-w-[240px] mx-auto"><Doughnut data={doughnutData} options={{ responsive: true, plugins: { legend: { position: "bottom", labels: { padding: 16, usePointStyle: true, pointStyle: "circle" } } } }} /></div>}
          </div>
        </div>

        {/* Needs Queue + Upload */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 mb-6">
          {/* Needs Table */}
          <div className="lg:col-span-4 sra-card p-5" id="needs-table">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-sra-dark">Top Priority Needs</h3>
              <button onClick={() => loadData()} className="btn btn-sm btn-outline-primary rounded-xl"><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
            </div>
            {needs.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-hover sra-table mb-0">
                  <thead>
                    <tr>
                      <th>#</th><th>Category</th><th>Description</th><th>Urgency</th><th>Status</th><th>Submitted</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {needs.map((need, i) => (
                      <tr key={need.id}>
                        <td className="text-sra-muted text-sm">{i + 1}</td>
                        <td><span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: getCategoryColor(need.category) + "18", color: getCategoryColor(need.category) }}>{need.category}</span></td>
                        <td className="text-sm">{truncate(need.description, 50)}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress flex-grow-1" style={{ height: "8px", width: "80px" }}>
                              <div className={`progress-bar bg-${getUrgencyClass(need.urgency_score)} progress-bar-animated`} style={{ width: `${need.urgency_score * 100}%` }}></div>
                            </div>
                            <small className={`text-${getUrgencyClass(need.urgency_score)} fw-semibold`}>{getUrgencyLabel(need.urgency_score)}</small>
                          </div>
                        </td>
                        <td><span className={`badge rounded-pill badge-${need.status === "open" ? "open" : need.status === "assigned" ? "assigned" : "completed"}`}>{need.status}</span></td>
                        <td className="text-xs text-sra-muted">{timeAgo(need.created_at)}</td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn btn-sm btn-outline-secondary rounded-lg px-2 py-1" title="View"><i className="bi bi-eye"></i></button>
                            <button onClick={() => openMatchModal(need.id, need.description)} className="btn btn-sm btn-outline-primary rounded-lg px-2 py-1" title="Match"><i className="bi bi-link-45deg"></i>Match</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><i className="bi bi-inbox"></i><p className="text-sm">No open needs right now</p></div>
            )}
          </div>

          {/* Upload Panel */}
          <div className="lg:col-span-3 sra-card p-5" id="upload-section">
            <h3 className="text-sm font-semibold text-sra-dark mb-4">Upload Field Data</h3>
            <div className={`upload-zone ${dragOver ? "drag-over" : ""} ${uploadFile ? "border-sra-primary bg-blue-50/30" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" className="d-none" accept=".csv,.xlsx,.pdf,.png,.jpg,.jpeg" onChange={e => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }} />
              {uploadFile ? (
                <div>
                  <i className="bi bi-file-earmark-check text-3xl text-sra-primary mb-2"></i>
                  <div className="fw-medium text-sra-dark">{uploadFile.name}</div>
                  <div className="text-xs text-sra-muted">{(uploadFile.size / 1024).toFixed(1)} KB</div>
                  <button onClick={e => { e.stopPropagation(); setUploadFile(null); }} className="btn btn-sm btn-outline-danger mt-2 rounded-xl"><i className="bi bi-x-lg"></i>Remove</button>
                </div>
              ) : (
                <div>
                  <i className="bi bi-cloud-upload text-4xl text-sra-muted mb-2"></i>
                  <div className="fw-medium text-sra-dark">Drag files here</div>
                  <div className="text-sm text-sra-muted">or <span className="text-sra-primary cursor-pointer">browse</span></div>
                  <div className="text-xs text-sra-muted mt-2">CSV, Excel, PDF, PNG, JPG • Max 16MB</div>
                </div>
              )}
            </div>

            {uploadFile && (
              <button onClick={handleFileUpload} disabled={uploading} className="btn text-white w-full mt-3 py-2.5 rounded-xl font-medium border-0 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #2563EB, #6366F1)" }}>
                {uploading ? <><span className="spinner-border spinner-border-sm"></span>Processing...</> : <><i className="bi bi-gear-wide-connected"></i>Process Data</>}
              </button>
            )}

            {/* Pipeline Tracker */}
            {pipeline && (
              <div className="mt-4 p-4 rounded-xl" style={{ background: "var(--sra-bg-input)" }}>
                <div className="text-xs text-sra-muted mb-2">Source: <span className="font-mono">{pipeline.source_id.slice(0, 16)}...</span></div>
                <div className="pipeline-steps">
                  {pipelineStages.map((stage, i) => {
                    const currentIdx = pipelineStages.indexOf(pipeline.stage);
                    const isDone = i < currentIdx;
                    const isActive = i === currentIdx;
                    const isFailed = pipeline.stage === "failed" && isActive;
                    return (
                      <div key={stage} className={`pipeline-step ${isDone ? "done" : ""}`}>
                        <div className={`step-icon ${isDone ? "done" : ""} ${isActive ? "active" : ""} ${isFailed ? "failed" : ""}`}>
                          {isDone ? <i className="bi bi-check"></i> : isFailed ? <i className="bi bi-x"></i> : isActive ? <i className="bi bi-arrow-repeat"></i> : <span className="text-xs">{i + 1}</span>}
                        </div>
                        <span className="step-label">{stage.charAt(0).toUpperCase() + stage.slice(1)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="sra-card p-5">
          <h3 className="text-sm font-semibold text-sra-dark mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {[
              { icon: "bi-plus-circle text-sra-danger", text: "Medical need submitted by Rahul Verma in North Delhi", time: "10 min ago" },
              { icon: "bi-person-check text-sra-primary", text: "Priya Sharma assigned to Medical need in North Delhi", time: "25 min ago" },
              { icon: "bi-check-circle text-sra-secondary", text: "Task completed — rated 5/5 stars", time: "1 hour ago" },
              { icon: "bi-exclamation-triangle text-sra-warning", text: "Failed ingestion detected (src_abc123)", time: "2 hours ago" },
              { icon: "bi-upload text-sra-info", text: "New data uploaded: field_report_dec.csv (150 rows)", time: "3 hours ago" },
            ].map((act, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-sra-border last:border-0">
                <i className={`bi ${act.icon} text-lg mt-0.5`}></i>
                <div className="flex-1">
                  <div className="text-sm text-sra-dark">{act.text}</div>
                  <div className="text-xs text-sra-muted">{act.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Match Modal */}
      {showMatch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowMatch(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto fade-in-up" style={{ background: "var(--sra-bg-card-solid)" }} onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-sra-border flex items-center justify-between">
              <h3 className="font-semibold text-sra-dark">Top Volunteer Matches for "{matchData.needDesc}"</h3>
              <button onClick={() => setShowMatch(false)} className="btn-close"></button>
            </div>
            <div className="p-5">
              {matchData.matches.length > 0 ? matchData.matches.map((m, i) => (
                <div key={m.volunteer_id} className={`flex items-center gap-4 p-4 rounded-xl mb-3 border ${i === 0 ? "border-sra-primary bg-blue-50/30" : "border-sra-border"}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${i === 0 ? "text-white" : ""}`} style={{ background: i === 0 ? "#2563EB" : "var(--sra-bg-input)", color: i === 0 ? "white" : "var(--sra-text-secondary)" }}>#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sra-dark">{m.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.skills.map(s => <span key={s} className="text-[10px] bg-blue-50 text-sra-primary px-1.5 py-0.5 rounded">{s}</span>)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-sra-muted">
                      <span><i className="bi bi-geo-alt me-1"></i>{m.distance_km} km</span>
                      <span>Skill: {m.skill_score}</span>
                      <span>Geo: {m.geo_score}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-sra-primary">{(m.final_score * 100).toFixed(0)}%</div>
                    <div className="text-[10px] text-sra-muted uppercase">Match Score</div>
                    <button onClick={() => confirmAssign(matchData.matches[0]?.volunteer_id || m.volunteer_id, m.volunteer_id)} className="btn btn-sm bg-sra-primary text-white mt-2 rounded-xl border-0 px-3">
                      <i className="bi bi-check2 me-1"></i>Assign
                    </button>
                  </div>
                </div>
              )) : <div className="empty-state"><i className="bi bi-people"></i><p>No matching volunteers found</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
