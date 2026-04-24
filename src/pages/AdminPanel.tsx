import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch, formatDate, getCategoryColor } from "../utils/api";

interface User {
  id: number; name: string; email: string; role: string;
  is_active: boolean; created_at: string;
}
interface DeadLetter {
  id: number; source_id: string; reason: string;
  raw_data: any; created_at: string; reviewed: boolean;
}

const PIPELINE_STAGES = ["extracted", "cleaned", "classified", "scored", "matched", "notified"];

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [expandedDL, setExpandedDL] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const categoryWeights = [
    { category: "Medical", severity: 0.35, frequency: 0.25, gap: 0.40 },
    { category: "Food", severity: 0.30, frequency: 0.35, gap: 0.35 },
    { category: "Shelter", severity: 0.25, frequency: 0.30, gap: 0.45 },
    { category: "Education", severity: 0.20, frequency: 0.25, gap: 0.55 },
    { category: "Mental Health", severity: 0.40, frequency: 0.15, gap: 0.45 },
    { category: "Construction", severity: 0.30, frequency: 0.20, gap: 0.50 },
  ];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [usersData, dlData] = await Promise.all([apiGet("/api/admin/users"), apiGet("/api/admin/dead-letters")]);
    if (usersData?.users) setUsers(usersData.users);
    if (dlData?.items) setDeadLetters(dlData.items);
  };

  const toggleUserActive = async (userId: number, currentActive: boolean) => {
    await apiPatch(`/api/admin/users/${userId}`, { is_active: !currentActive });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentActive } : u));
  };

  const changeUserRole = async (userId: number, newRole: string) => {
    await apiPatch(`/api/admin/users/${userId}`, { role: newRole });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const markReviewed = async (dlId: number) => {
    await apiPatch(`/api/admin/dead-letters/${dlId}/review`);
    setDeadLetters(prev => prev.map(d => d.id === dlId ? { ...d, reviewed: true } : d));
  };

  const searchPipeline = async () => {
    if (!pipelineSearch.trim()) return;
    const data = await apiGet(`/api/admin/pipeline/${pipelineSearch}`);
    setPipelineResult(data);
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (searchQuery && !u.name.toLowerCase().includes(searchQuery.toLowerCase()) && !u.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const unreviewedCount = deadLetters.filter(d => !d.reviewed).length;

  return (
    <div className="flex min-h-screen bg-sra-light">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-0 overflow-hidden"} lg:w-56 sra-sidebar flex-shrink-0 transition-all duration-300`}>
        <div className="px-4 py-3 border-b border-white/10">
          <span className="text-white font-bold text-sm">Smart Resource Allocation</span>
        </div>
        <nav className="mt-2">
          {[
            { to: "/dashboard", icon: "bi-speedometer2", label: "Dashboard" },
            { to: "/map", icon: "bi-map", label: "Live Map" },
            { to: "/dashboard", icon: "bi-upload", label: "Upload Data" },
            { to: "/dashboard", icon: "bi-list-check", label: "Needs Queue" },
            { to: "/admin", icon: "bi-people", label: "Volunteers" },
            { to: "/admin", icon: "bi-gear", label: "Admin Panel", active: true },
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
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden btn btn-sm btn-outline-secondary mb-3 rounded-xl">
          <i className="bi bi-list"></i>Menu
        </button>

        {/* ── Section 1: User Management ── */}
        <div className="sra-card p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-sra-dark flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-sm"><i className="bi bi-people-fill"></i></span>
              User Management
            </h2>
            <button className="btn btn-sm rounded-xl mt-3 sm:mt-0 font-medium flex items-center gap-1.5" style={{ background: "linear-gradient(135deg, #2563EB, #6366F1)", color: "white", border: "none", padding: "0.5rem 1.125rem" }}>
              <i className="bi bi-person-plus"></i>Invite User
            </button>
          </div>

          {/* Search + Filter Row */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="sra-search-input">
              <i className="bi bi-search sra-search-icon"></i>
              <input
                type="text"
                className="form-control"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="relative">
              <i className="bi bi-funnel position-absolute" style={{ left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--sra-text-muted)", fontSize: "0.85rem", pointerEvents: "none", zIndex: 2 }}></i>
              <select
                className="form-select"
                style={{ paddingLeft: "2.5rem !important", minWidth: "160px" }}
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="volunteer">Volunteer</option>
                <option value="user">User</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="table-responsive">
            <table className="table table-hover sra-table mb-0">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: user.role === "admin" ? "#6366F1" : user.role === "volunteer" ? "#10B981" : "#2563EB" }}>
                          {user.name.charAt(0)}
                        </div>
                        <span className="font-medium text-sm text-sra-dark">{user.name}</span>
                      </div>
                    </td>
                    <td className="text-sm text-sra-muted">{user.email}</td>
                    <td>
                      <select className="form-select form-select-sm" value={user.role} onChange={e => changeUserRole(user.id, e.target.value)}
                        style={{ fontSize: "0.75rem", width: "auto", display: "inline-block" }}>
                        <option value="admin">Admin</option>
                        <option value="volunteer">Volunteer</option>
                        <option value="user">User</option>
                      </select>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        <i className={`bi ${user.is_active ? "bi-check-circle-fill" : "bi-x-circle-fill"} text-[10px]`}></i>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-xs text-sra-muted">{formatDate(user.created_at)}</td>
                    <td>
                      <button onClick={() => toggleUserActive(user.id, user.is_active)}
                        className={`btn btn-sm rounded-xl px-3 font-medium ${user.is_active ? "btn-outline-danger" : "btn-outline-success"}`}>
                        {user.is_active
                          ? <><i className="bi bi-toggle-on me-1"></i>Disable</>
                          : <><i className="bi bi-toggle-off me-1"></i>Enable</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="empty-state"><i className="bi bi-people"></i><p className="text-sm">No users found</p></div>
          )}
        </div>

        {/* ── Section 2: Failed Ingestions ── */}
        <div className="sra-card p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold text-sra-dark flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-sm"><i className="bi bi-exclamation-triangle-fill"></i></span>
              Failed Ingestions
            </h2>
            {unreviewedCount > 0 && (
              <span className="bg-sra-danger text-white text-xs px-2.5 py-1 rounded-full font-semibold">{unreviewedCount}</span>
            )}
          </div>

          {unreviewedCount > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4 flex items-center gap-2">
              <i className="bi bi-exclamation-triangle"></i>
              ⚠ {unreviewedCount} failed ingestion{unreviewedCount > 1 ? "s need" : " needs"} review
            </div>
          )}

          <div className="table-responsive">
            <table className="table table-hover sra-table mb-0">
              <thead>
                <tr><th>Source ID</th><th>Failure Reason</th><th>Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {deadLetters.map(dl => (
                  <>
                    <tr key={dl.id}>
                      <td className="text-sm font-mono text-sra-muted">{dl.source_id.slice(0, 16)}...</td>
                      <td className="text-sm">{dl.reason}</td>
                      <td className="text-xs text-sra-muted">{formatDate(dl.created_at)}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${dl.reviewed ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          <i className={`bi ${dl.reviewed ? "bi-check-circle-fill" : "bi-clock-fill"} text-[10px]`}></i>
                          {dl.reviewed ? "Reviewed" : "Pending"}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1.5">
                          <button onClick={() => setExpandedDL(expandedDL === dl.id ? null : dl.id)}
                            className="btn btn-sm btn-outline-secondary rounded-xl px-2.5">
                            <i className="bi bi-eye me-1"></i>Raw
                          </button>
                          {!dl.reviewed && (
                            <button onClick={() => markReviewed(dl.id)}
                              className="btn btn-sm btn-outline-success rounded-xl px-2.5">
                              <i className="bi bi-check2 me-1"></i>Reviewed
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedDL === dl.id && (
                      <tr key={`${dl.id}-raw`}>
                        <td colSpan={5} className="p-4">
                          <div className="rounded-xl p-4" style={{ background: "var(--sra-bg-input)" }}>
                            <pre className="text-xs mb-0 overflow-auto" style={{ color: "var(--sra-text-primary)", maxHeight: "200px" }}>{JSON.stringify(dl.raw_data, null, 2)}</pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          {deadLetters.length === 0 && (
            <div className="empty-state"><i className="bi bi-check-circle"></i><p className="text-sm">No failed ingestions</p></div>
          )}
        </div>

        {/* ── Section 3: Pipeline Tracker ── */}
        <div className="sra-card p-6 mb-6">
          <h2 className="text-lg font-bold text-sra-dark mb-5 flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-sm"><i className="bi bi-gear-wide-connected"></i></span>
            Active Pipeline Jobs
          </h2>
          <div className="flex gap-2.5 mb-5">
            <div className="sra-search-input">
              <i className="bi bi-upc-scan sra-search-icon"></i>
              <input
                type="text"
                className="form-control"
                placeholder="Enter Source ID (e.g. src_test123)..."
                value={pipelineSearch}
                onChange={e => setPipelineSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchPipeline()}
              />
            </div>
            <button onClick={searchPipeline} className="btn text-white rounded-xl border-0 px-5 font-medium flex items-center gap-1.5 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #2563EB, #6366F1)" }}>
              <i className="bi bi-search"></i>Search
            </button>
          </div>
          {pipelineResult && (
            <div className="rounded-xl p-5 border border-sra-border" style={{ background: "var(--sra-bg-input)" }}>
              <div className="text-sm font-medium mb-2" style={{ color: "var(--sra-text-secondary)" }}>
                Stage: <span className="font-bold text-sra-primary">{pipelineResult.stage}</span>
              </div>
              <div className="pipeline-steps">
                {PIPELINE_STAGES.map((stage, i) => {
                  const currentIdx = PIPELINE_STAGES.indexOf(pipelineResult.stage);
                  const isDone = i < currentIdx;
                  const isActive = i === currentIdx;
                  return (
                    <div key={stage} className={`pipeline-step ${isDone ? "done" : ""}`}>
                      <div className={`step-icon ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}>
                        {isDone ? <i className="bi bi-check"></i> : isActive ? <i className="bi bi-arrow-repeat"></i> : <span className="text-xs">{i + 1}</span>}
                      </div>
                      <span className="step-label">{stage.charAt(0).toUpperCase() + stage.slice(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Section 4: Category Weights ── */}
        <div className="sra-card p-6">
          <h2 className="text-lg font-bold text-sra-dark mb-2 flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm"><i className="bi bi-sliders"></i></span>
            AI Priority Weights (Learned)
          </h2>
          <p className="text-sm text-sra-muted mb-5">These weights self-calibrate based on task outcomes</p>
          <div className="space-y-4">
            {categoryWeights.map(cw => (
              <div key={cw.category} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-sra-dark flex-shrink-0 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: getCategoryColor(cw.category) }}></span>
                  {cw.category}
                </div>
                <div className="flex-1 rounded-full h-3 overflow-hidden flex" style={{ background: "var(--sra-bg-input)" }}>
                  <div className="h-full rounded-l-full transition-all duration-700" style={{ width: `${cw.severity * 100}%`, background: "#EF4444" }}></div>
                  <div className="h-full transition-all duration-700" style={{ width: `${cw.frequency * 100}%`, background: "#F59E0B" }}></div>
                  <div className="h-full rounded-r-full transition-all duration-700" style={{ width: `${cw.gap * 100}%`, background: "#2563EB" }}></div>
                </div>
                <div className="flex gap-3 text-[11px] text-sra-muted w-36 flex-shrink-0">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sra-danger inline-block"></span>S:{(cw.severity * 100).toFixed(0)}%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sra-warning inline-block"></span>F:{(cw.frequency * 100).toFixed(0)}%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sra-primary inline-block"></span>G:{(cw.gap * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
